/* PHL Franchise Simulator — Team Strategy
 * Global namespace: window.PHLStrategy
 *
 * A team-wide system, picked from 5 options, that only pays off if your
 * personnel actually fits it — the "Best Match" recommendation is
 * computed straight from your active lineup's archetypes (see
 * js/utils.js ARCHETYPES / js/sim.js getActiveLineup), the same signal
 * that already drives every player's hidden offense/defense attributes.
 * Pick a strategy your roster is built for and it's a real, amplified
 * bonus in every game (see strategyRatingBonus, wired into js/sim.js
 * simulateGame alongside chemistry); force a strategy your personnel
 * can't execute and it actively backfires instead of just doing nothing —
 * the choice has real stakes, not just an upside.
 *
 * AI teams auto-run whatever strategy currently best matches their own
 * active lineup (see autoAssignAiStrategies, called from
 * js/calendar.js advanceWeek each week) so the sim stays fair; the user's
 * own pick is never auto-overridden.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  // Each strategy's "ideal" archetype per position (full credit) plus any
  // secondary archetypes that still fit reasonably well (half credit).
  // bonus is the FULL offense/defense swing at a perfect (1.0) match — see
  // lineupMatchScore/strategyRatingBonus for how match quality scales it
  // (and can flip it negative on a bad fit).
  var STRATEGIES = [
    {
      key: "rush-offense",
      name: "Rush Offense",
      tagline: "Push the pace and win on skill — end-to-end speed and finishing.",
      bonus: { offense: 5, defense: -3 },
      ideal: {
        F: { primary: "Goal Scorer", secondary: ["Playmaker"] },
        D: { primary: "Offensive Defenseman", secondary: [] },
        G: { primary: "Puck-Handler", secondary: ["Hybrid"] },
      },
    },
    {
      key: "trap-defense",
      name: "Trap Defense",
      tagline: "Clog the neutral zone and make them earn every inch.",
      bonus: { offense: -3, defense: 5 },
      ideal: {
        F: { primary: "Power Forward", secondary: ["Grinder"] },
        D: { primary: "Stalwart Defender", secondary: ["Stay-at-Home Defenseman"] },
        G: { primary: "The Wall", secondary: ["Standup"] },
      },
    },
    {
      key: "cycle-possession",
      name: "Cycle Possession",
      tagline: "Control the puck down low and wear teams out — no weak link.",
      bonus: { offense: 2, defense: 2 },
      ideal: {
        F: { primary: "Two-Way Forward", secondary: [] },
        D: { primary: "Two-Way Defenseman", secondary: [] },
        G: { primary: "Hybrid", secondary: [] },
      },
    },
    {
      key: "aggressive-forecheck",
      name: "Aggressive Forecheck",
      tagline: "Hunt the puck and create chaos — force the other team into mistakes.",
      bonus: { offense: 1, defense: 4 },
      ideal: {
        F: { primary: "Grinder", secondary: ["Power Forward"] },
        D: { primary: "Stay-at-Home Defenseman", secondary: ["Two-Way Defenseman"] },
        G: { primary: "Standup", secondary: ["Butterfly"] },
      },
    },
    {
      key: "playmaking-transition",
      name: "Playmaking Transition",
      tagline: "Break out clean and attack off the rush — quick, smart puck movement.",
      bonus: { offense: 4, defense: -1 },
      ideal: {
        F: { primary: "Playmaker", secondary: ["Two-Way Forward"] },
        D: { primary: "Offensive Defenseman", secondary: ["Two-Way Defenseman"] },
        G: { primary: "Butterfly", secondary: ["Puck-Handler"] },
      },
    },
  ];

  function byKey(key) {
    return STRATEGIES.filter(function (s) { return s.key === key; })[0] || null;
  }

  function playerMatchValue(p, idealForPosition) {
    if (!p || !idealForPosition) return 0;
    if (p.archetype === idealForPosition.primary) return 1;
    if (idealForPosition.secondary.indexOf(p.archetype) !== -1) return 0.5;
    return 0;
  }

  // 0..1 — how well an active lineup (see js/sim.js getActiveLineup) fits
  // one strategy. Averages every dressed skater + the starting goalie so a
  // 2F/2D/1G lineup with, say, one dead-on forward and one total mismatch
  // lands somewhere in the middle rather than all-or-nothing.
  function lineupMatchScore(lineup, strategy) {
    if (!lineup || !strategy) return 0;
    var slots = [];
    (lineup.forwards || []).forEach(function (p) { slots.push(playerMatchValue(p, strategy.ideal.F)); });
    (lineup.defenders || []).forEach(function (p) { slots.push(playerMatchValue(p, strategy.ideal.D)); });
    if (lineup.goalie) slots.push(playerMatchValue(lineup.goalie, strategy.ideal.G));
    if (!slots.length) return 0;
    return slots.reduce(function (a, b) { return a + b; }, 0) / slots.length;
  }

  function bestMatchFor(teamId) {
    var Sim = window.PHLSim;
    if (!Sim) return null;
    var lineup = Sim.getActiveLineup(teamId);
    var best = null;
    var bestScore = -1;
    STRATEGIES.forEach(function (s) {
      var score = lineupMatchScore(lineup, s);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    });
    return best ? { strategy: best, score: bestScore } : null;
  }

  // The actual sim hook (see js/sim.js simulateGame). A well-matched
  // strategy amplifies its base bonus above 1x; a poor fit doesn't just
  // fall back to zero — past a certain point it flips negative, since
  // forcing a system your roster can't execute is a real liability, not a
  // neutral non-event. Piecewise-linear: match 1.0 -> 1.5x, match 0.5 ->
  // 0.5x (base bonus), match 0.25 -> 0x (wasted pick), match 0.0 -> -0.5x
  // (actively backfires).
  function matchMultiplier(matchScore) {
    return U.clamp(matchScore * 2 - 0.5, -0.5, 1.5);
  }

  function strategyRatingBonus(teamId) {
    var team = S.getTeam(teamId);
    var Sim = window.PHLSim;
    if (!team || !team.strategy || !Sim) return { offense: 0, defense: 0 };
    var strategy = byKey(team.strategy);
    if (!strategy) return { offense: 0, defense: 0 };
    var lineup = Sim.getActiveLineup(teamId);
    var multiplier = matchMultiplier(lineupMatchScore(lineup, strategy));
    return {
      offense: strategy.bonus.offense * multiplier,
      defense: strategy.bonus.defense * multiplier,
    };
  }

  // Every AI-managed team runs whatever strategy currently best fits its
  // own active lineup — never the user's own team, whose pick (or
  // deliberate no-strategy) is only ever changed from the Strategy tab.
  function autoAssignAiStrategies() {
    S.getTeams().forEach(function (t) {
      if (S.isManagedTeam(t.id)) return;
      var best = bestMatchFor(t.id);
      if (best && t.strategy !== best.strategy.key) {
        S.updateTeam(t.id, { strategy: best.strategy.key });
      }
    });
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Strategy</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first.</p>';
      return;
    }
    var team = S.getTeam(franchise.teamId);
    if (!team) return;
    var Sim = window.PHLSim;
    var lineup = Sim ? Sim.getActiveLineup(team.id) : null;
    var best = bestMatchFor(team.id);

    var html = '<div class="panel-header"><h2>Strategy</h2></div>';
    html += '<p class="muted small">Pick a team-wide system for your lineup to run. How well it fits YOUR players’ archetypes decides whether it actually helps — the bonus shown for each system scales with the fit, and a bad fit can backfire instead of doing nothing, so match it to what you’ve got rather than chasing whatever sounds best.</p>';

    if (lineup) {
      var lineupPlayers = (lineup.forwards || []).concat(lineup.defenders || []).concat(lineup.goalie ? [lineup.goalie] : []);
      html += '<div class="form-card"><h3>Current Active Lineup</h3><p class="muted small">Whoever’s currently set as your starters (Players tab) — this is who the fit scores below are computed against.</p><div class="scrim-lineup">';
      if (!lineupPlayers.length) {
        html += '<p class="muted small">No lineup available yet.</p>';
      } else {
        lineupPlayers.forEach(function (p) {
          html += '<span class="pill">' + U.escapeHtml(p.name) + ' <span class="muted">(' + U.escapeHtml(p.archetype || p.position) + ")</span></span>";
        });
      }
      html += "</div></div>";
    }

    html += '<div class="strategy-grid">';
    STRATEGIES.forEach(function (s) {
      var score = lineup ? lineupMatchScore(lineup, s) : 0;
      var pct = Math.round(score * 100);
      var multiplier = matchMultiplier(score);
      var effOff = Math.round(s.bonus.offense * multiplier * 10) / 10;
      var effDef = Math.round(s.bonus.defense * multiplier * 10) / 10;
      var isSelected = team.strategy === s.key;
      var isBest = best && best.strategy.key === s.key;
      html += '<div class="strategy-card' + (isSelected ? " strategy-card-active" : "") + '">';
      html += '<div class="strategy-card-head"><h4>' + U.escapeHtml(s.name) + "</h4>" + (isBest ? '<span class="pill pill-clinch small">Best Match</span>' : "") + "</div>";
      html += '<p class="muted small">' + U.escapeHtml(s.tagline) + "</p>";
      html += '<p class="small">Ideal: ' + U.escapeHtml(s.ideal.F.primary) + " (F) &middot; " + U.escapeHtml(s.ideal.D.primary) + " (D) &middot; " + U.escapeHtml(s.ideal.G.primary) + " (G)</p>";
      html += '<div class="chemistry-bar"><div class="chemistry-bar-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="muted small" style="margin:0.3rem 0">' + pct + "% fit &middot; effective bonus at this fit: " +
        (effOff >= 0 ? "+" : "") + effOff + " OFF / " + (effDef >= 0 ? "+" : "") + effDef + " DEF</div>";
      html += '<button class="btn btn-sm' + (isSelected ? " btn-primary" : "") + '" data-action="select-strategy" data-key="' + s.key + '">' + (isSelected ? "Selected" : "Select") + "</button>";
      html += "</div>";
    });
    html += "</div>";
    if (team.strategy) {
      html += '<div class="form-actions"><button class="btn btn-sm" data-action="clear-strategy">Run No Strategy</button></div>';
    }

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    container.querySelectorAll('[data-action="select-strategy"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var franchise = S.getFranchise();
        S.updateTeam(franchise.teamId, { strategy: b.dataset.key });
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
    var clearBtn = container.querySelector('[data-action="clear-strategy"]');
    if (clearBtn) clearBtn.addEventListener("click", function () {
      var franchise = S.getFranchise();
      S.updateTeam(franchise.teamId, { strategy: null });
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  window.PHLStrategy = {
    render: render,
    STRATEGIES: STRATEGIES,
    lineupMatchScore: lineupMatchScore,
    bestMatchFor: bestMatchFor,
    strategyRatingBonus: strategyRatingBonus,
    autoAssignAiStrategies: autoAssignAiStrategies,
  };
})();
