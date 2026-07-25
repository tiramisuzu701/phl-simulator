/* PHL Franchise Simulator — Scrims (team chemistry)
 * Global namespace: window.PHLScrims
 *
 * Pick an opponent from your own division and run a quick simulated
 * exhibition match against them (uses the same rating-based engine as a
 * real game — see js/sim.js simulateGame — but never touches standings,
 * cap, or player stats). A win is worth +2 chemistry, a loss still nets
 * you +1 — chemistry (0-25, baseline 12) gives a small but real boost to
 * both offense and defense in real games (see js/sim.js
 * chemistryRatingBonus).
 *
 * Scrims run on a budget, not a weekly allowance: 3 per half of the
 * regular season (see js/calendar.js resetSplitUsage hooks around the
 * week 11-12 trade-deadline break) and 5 per off-season — none during the
 * playoffs, when every team is busy with real games. Chemistry also decays
 * a little each week if you skip it (see weeklyChemistryUpkeep below,
 * called from js/calendar.js advanceWeek), so it needs upkeep, not a
 * one-time grind to the cap.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  var CHEM_MAX = 25;
  var CHEM_DECAY_ABOVE = 12; // baseline/midpoint — chemistry drifts back down toward here
  var SPLIT_SCRIM_BUDGET = 3; // per half of the regular season
  var OFFSEASON_SCRIM_BUDGET = 5;

  function currentBudget(team) {
    var season = S.getSeason();
    if (season.phase === "regular") {
      return { used: team.scrimsUsedThisSplit || 0, max: SPLIT_SCRIM_BUDGET, label: "half" };
    }
    if (season.phase === "offseason") {
      return { used: team.scrimsUsedThisOffseason || 0, max: OFFSEASON_SCRIM_BUDGET, label: "off-season" };
    }
    return { used: 0, max: 0, label: "playoffs" }; // no scrims during the playoffs
  }

  function eligibleOpponents(teamId) {
    var team = S.getTeam(teamId);
    if (!team) return [];
    return S.getTeams(team.division).filter(function (t) { return t.id !== teamId; });
  }

  // Runs a scrim for `teamId` against `opponentTeamId` (must be a
  // division-mate). Simulates a full exhibition game with `teamId` as the
  // home side purely to decide a winner — the result is never applied to
  // the schedule/standings/player stats (see js/sim.js simulateGame, which
  // is side-effect-free until you call applyResult, which we deliberately
  // never do here). Returns null if the scrim isn't allowed right now
  // (wrong phase, budget exhausted, invalid opponent).
  function runScrim(teamId, opponentTeamId) {
    var team = S.getTeam(teamId);
    var opponent = S.getTeam(opponentTeamId);
    if (!team || !opponent || opponent.id === team.id) return null;
    if (opponent.division !== team.division) return null;
    var season = S.getSeason();
    if (season.phase === "playoffs") return null;
    var budget = currentBudget(team);
    if (budget.used >= budget.max) return null;
    var Sim = window.PHLSim;
    if (!Sim) return null;

    var result = Sim.simulateGame(teamId, opponentTeamId);
    var win = result.homeScore > result.awayScore;
    var gain = win ? 2 : 1;
    S.addChemistry(teamId, gain);
    if (season.phase === "regular") {
      S.updateTeam(teamId, { scrimsUsedThisSplit: (team.scrimsUsedThisSplit || 0) + 1 });
    } else {
      S.updateTeam(teamId, { scrimsUsedThisOffseason: (team.scrimsUsedThisOffseason || 0) + 1 });
    }
    var updated = S.getTeam(teamId);
    return {
      win: win,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      gain: gain,
      chemistry: updated.chemistry,
      opponentName: opponent.name,
    };
  }

  // Refills every team's per-half scrim budget — called once when the
  // regular season begins (start of the first half) and again the moment
  // the trade-deadline break ends (start of the second half). See
  // js/calendar.js runOffseasonWeek/runRegularWeek.
  function resetSplitUsage() {
    S.getTeams().forEach(function (t) { S.updateTeam(t.id, { scrimsUsedThisSplit: 0 }); });
  }

  // Refills every team's off-season scrim budget — called once each time
  // the playoffs end and a new off-season begins. See js/calendar.js
  // runPlayoffsWeek.
  function resetOffseasonUsage() {
    S.getTeams().forEach(function (t) { S.updateTeam(t.id, { scrimsUsedThisOffseason: 0 }); });
  }

  // Small weekly decay toward the baseline for teams that skip scrims —
  // chemistry needs upkeep, not a one-time grind to the cap.
  function weeklyChemistryUpkeep() {
    S.getTeams().forEach(function (t) {
      var chem = t.chemistry == null ? CHEM_DECAY_ABOVE : t.chemistry;
      if (chem > CHEM_DECAY_ABOVE) S.addChemistry(t.id, -1);
    });
  }

  function chemistryLabel(chem) {
    if (chem >= 21) return "Elite";
    if (chem >= 17) return "Great";
    if (chem >= 13) return "Good";
    if (chem >= 9) return "Average";
    if (chem >= 5) return "Shaky";
    return "Poor";
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Scrims</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first.</p>';
      return;
    }
    var team = S.getTeam(franchise.teamId);
    if (!team) return;
    var chem = team.chemistry == null ? CHEM_DECAY_ABOVE : team.chemistry;
    var season = S.getSeason();
    var budget = currentBudget(team);
    var remaining = Math.max(0, budget.max - budget.used);
    var opponents = eligibleOpponents(team.id);
    var lineup = window.PHLSim ? window.PHLSim.getActiveLineup(team.id) : null;

    var html = '<div class="panel-header"><h2>Scrims</h2></div>';
    html += '<p class="muted small">Run a scrim against a division opponent to build team chemistry — a small but real boost to how your team performs in every game. A win is worth more chemistry than a loss, but either way you\'ll gain something. You get ' +
      SPLIT_SCRIM_BUDGET + ' scrims per half of the regular season and ' + OFFSEASON_SCRIM_BUDGET +
      ' during the off-season — none while the playoffs are on. Chemistry decays a little each week if you skip it, so keep it up.</p>';

    html += '<div class="form-card chemistry-card">';
    html += '<div class="chemistry-header"><h3>' + U.escapeHtml(team.name) + ' Chemistry</h3><span class="pill pill-accent">' + chemistryLabel(chem) + "</span></div>";
    html += '<div class="chemistry-bar"><div class="chemistry-bar-fill" style="width:' + Math.round((chem / CHEM_MAX) * 100) + '%"></div></div>';
    html += '<div class="muted small" style="margin-top:0.4rem">' + chem + " / " + CHEM_MAX + "</div>";
    html += "</div>";

    html += '<div class="form-card">';
    html += "<h3>Run a Scrim</h3>";
    if (season.phase === "playoffs") {
      html += '<p class="muted small">Scrims aren\'t available during the playoffs — everyone\'s busy with real games. They\'ll be back once the off-season starts.</p>';
    } else if (!opponents.length) {
      html += '<p class="muted small">No other teams in your division to scrim against yet.</p>';
    } else {
      html += '<div class="muted small" style="margin-bottom:0.5rem">' + remaining + " of " + budget.max + " scrims left this " + budget.label + ".</div>";
      html += '<label>Opponent<select id="scrim-opponent">';
      opponents.forEach(function (t) {
        html += '<option value="' + t.id + '">' + U.escapeHtml(t.name) + "</option>";
      });
      html += "</select></label>";
      html += '<div class="form-actions">';
      html += '<button class="btn btn-primary" data-action="run-scrim"' + (remaining <= 0 ? " disabled" : "") + ">Run Scrim</button>";
      html += "</div>";
    }
    html += "</div>";

    if (lineup) {
      html += '<div class="form-card"><h3>Scrimmaging Lineup</h3>';
      html += '<p class="muted small">Whoever\'s currently set as your starters (Players tab) is who takes the ice for scrims.</p>';
      html += '<div class="scrim-lineup">';
      var all = lineup.forwards.concat(lineup.defenders).concat(lineup.goalie ? [lineup.goalie] : []);
      if (!all.length) {
        html += '<p class="muted small">No starters set yet — the sim falls back to your best available players automatically.</p>';
      } else {
        all.forEach(function (p) {
          html += '<span class="pill">' + U.escapeHtml(p.name) + ' <span class="muted">(' + p.position + ")</span></span>";
        });
      }
      html += "</div></div>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    var btn = container.querySelector('[data-action="run-scrim"]');
    if (btn) btn.addEventListener("click", function () {
      var franchise = S.getFranchise();
      var sel = container.querySelector("#scrim-opponent");
      var opponentId = sel ? sel.value : null;
      if (!opponentId) {
        alert("Pick an opponent to scrim against first.");
        return;
      }
      var result = runScrim(franchise.teamId, opponentId);
      if (!result) {
        alert("No scrims left — check back after Advance Week.");
        return;
      }
      alert((result.win ? "Scrim win" : "Scrim loss") + " vs " + result.opponentName + " (" + result.homeScore + "-" + result.awayScore +
        ") — chemistry +" + result.gain + " (now " + result.chemistry + "/" + CHEM_MAX + ").");
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  window.PHLScrims = {
    render: render,
    runScrim: runScrim,
    eligibleOpponents: eligibleOpponents,
    currentBudget: currentBudget,
    resetSplitUsage: resetSplitUsage,
    resetOffseasonUsage: resetOffseasonUsage,
    weeklyChemistryUpkeep: weeklyChemistryUpkeep,
    CHEM_MAX: CHEM_MAX,
    SPLIT_SCRIM_BUDGET: SPLIT_SCRIM_BUDGET,
    OFFSEASON_SCRIM_BUDGET: OFFSEASON_SCRIM_BUDGET,
  };
})();
