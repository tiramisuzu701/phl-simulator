/* PHL Franchise Simulator — league leaderboards & offseason (new season) flow
 * Global namespace: window.PHLStats
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var divFilter = "";
  var subTab = "leaders"; // "leaders" | "playoffs" | "awards" | "hof" | "season"

  function leaderboard(list, keyFn, limit, opts) {
    opts = opts || {};
    var filtered = list.filter(function (p) {
      return opts.min == null || (opts.countFn ? opts.countFn(p) >= opts.min : true);
    });
    filtered.sort(function (a, b) {
      return opts.asc ? keyFn(a) - keyFn(b) : keyFn(b) - keyFn(a);
    });
    return filtered.slice(0, limit || 10);
  }

  // Stats can only ever be viewed one division at a time (no more "All
  // Divisions") — defaults to the user's own division the first time the
  // tab is opened, but the user can still switch to any other division.
  function effectiveDivFilter() {
    if (divFilter) return divFilter;
    var franchise = S.getFranchise();
    var divisions = S.getDivisions();
    if (franchise && franchise.divisionId) return franchise.divisionId;
    return divisions.length ? divisions[0].id : "";
  }

  function playersInScope() {
    var players = S.getPlayers().filter(function (p) { return !p.isDraftProspect && !p.retired; });
    var div = effectiveDivFilter();
    if (!div) return players;
    return players.filter(function (p) {
      var t = p.teamId ? S.getTeam(p.teamId) : null;
      return t && t.division === div;
    });
  }

  function renderBoard(title, rows, valueLabel, valueFn) {
    var max = rows.length ? Math.abs(valueFn(rows[0])) || 1 : 1;
    var html = '<div class="leaderboard-card"><h4>' + title + "</h4>";
    if (!rows.length) {
      html += '<p class="muted small">No qualifying players yet.</p></div>';
      return html;
    }
    html += '<table class="data-table compact"><tbody>';
    rows.forEach(function (p, i) {
      var t = p.teamId ? S.getTeam(p.teamId) : null;
      var val = valueFn(p);
      var pct = U.clamp((Math.abs(val) / max) * 100, 4, 100);
      html += "<tr><td>" + (i + 1) + "</td><td>" + U.escapeHtml(p.name) + '<span class="muted"> ' + (t ? t.abbr : "FA") + "</span></td>";
      html += '<td class="bar-cell"><div class="mini-bar"><div class="mini-bar-fill" style="width:' + pct + '%"></div></div></td>';
      html += "<td><strong>" + val + "</strong></td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  var SUBTABS = [
    { key: "leaders", label: "League Leaders" },
    { key: "playoffs", label: "Playoff Leaders" },
    { key: "awards", label: "Awards" },
    { key: "hof", label: "Hall of Fame" },
    { key: "season", label: "Season" },
  ];

  function render(el) {
    container = el || container;
    if (!container) return;
    var divisions = S.getDivisions();
    var activeDiv = effectiveDivFilter();

    // A clean, single-line header: title, sub-tabs (mirrors the sidebar's
    // own tab-based navigation instead of one long stacked page), and the
    // division picker all together so there's no hunting for the filter.
    var html = '<div class="panel-header"><h2>Stats &amp; Offseason</h2></div>';
    html += '<div class="stats-toolbar">';
    html += '<div class="tab-strip">';
    SUBTABS.forEach(function (t) {
      html += '<button class="chip' + (subTab === t.key ? " chip-active" : "") + '" data-subtab="' + t.key + '">' + t.label + "</button>";
    });
    html += "</div>";
    if (subTab !== "season" && subTab !== "hof") {
      html += '<select id="stats-division">';
      divisions.forEach(function (d) {
        html += '<option value="' + d.id + '"' + (activeDiv === d.id ? " selected" : "") + ">" + U.escapeHtml(d.name) + "</option>";
      });
      html += "</select>";
    }
    html += "</div>";

    if (subTab === "leaders") html += renderLeadersView();
    else if (subTab === "playoffs") html += renderPlayoffLeadersView();
    else if (subTab === "awards") html += renderAwardsView();
    else if (subTab === "hof") html += renderHallOfFameView();
    else html += renderSeasonView();

    container.innerHTML = html;
    wireEvents();
  }

  function renderLeadersView() {
    var players = playersInScope();
    var skaters = players.filter(function (p) { return p.position !== "G" && p.stats.gp > 0; });
    var goalies = players.filter(function (p) { return p.position === "G" && p.stats.gp > 0; });
    var html = '<div class="leaderboard-grid">';
    html += renderBoard("Points", leaderboard(skaters, function (p) { return p.stats.pts; }, 10), "PTS", function (p) { return p.stats.pts; });
    html += renderBoard("Goals", leaderboard(skaters, function (p) { return p.stats.g; }, 10), "G", function (p) { return p.stats.g; });
    html += renderBoard("Assists", leaderboard(skaters, function (p) { return p.stats.a; }, 10), "A", function (p) { return p.stats.a; });
    html += renderBoard("Plus/Minus", leaderboard(skaters, function (p) { return p.stats.plusMinus; }, 10), "+/-", function (p) { return p.stats.plusMinus; });
    html += renderBoard("Save %", leaderboard(goalies, function (p) { return p.stats.svPct; }, 10, { min: 5, countFn: function (p) { return p.stats.shotsAgainst; } }), "SV%", function (p) { return (p.stats.svPct * 100).toFixed(1); });
    html += renderBoard("GAA", leaderboard(goalies, function (p) { return p.stats.gaa; }, 10, { asc: true, min: 3, countFn: function (p) { return p.stats.gp; } }), "GAA", function (p) { return p.stats.gaa; });
    html += "</div>";
    return html;
  }

  function renderPlayoffLeadersView() {
    var playoffPlayers = playersInScope().filter(function (p) { return p.playoffStats && p.playoffStats.gp > 0; });
    var playoffSkaters = playoffPlayers.filter(function (p) { return p.position !== "G"; });
    var playoffGoalies = playoffPlayers.filter(function (p) { return p.position === "G"; });
    if (!playoffPlayers.length) {
      return '<div class="empty-state"><p>No playoff games have been played yet this cycle.</p></div>';
    }
    var html = '<div class="leaderboard-grid">';
    html += renderBoard("Playoff Points", leaderboard(playoffSkaters, function (p) { return p.playoffStats.pts; }, 10), "PTS", function (p) { return p.playoffStats.pts; });
    html += renderBoard("Playoff Goals", leaderboard(playoffSkaters, function (p) { return p.playoffStats.g; }, 10), "G", function (p) { return p.playoffStats.g; });
    html += renderBoard("Playoff Assists", leaderboard(playoffSkaters, function (p) { return p.playoffStats.a; }, 10), "A", function (p) { return p.playoffStats.a; });
    html += renderBoard("Playoff Save %", leaderboard(playoffGoalies, function (p) { return p.playoffStats.svPct; }, 10, { min: 2, countFn: function (p) { return p.playoffStats.shotsAgainst; } }), "SV%", function (p) { return (p.playoffStats.svPct * 100).toFixed(1); });
    html += "</div>";
    return html;
  }

  var SEASON_AWARD_LABEL = {
    defenseman: "Defenseman of the Year",
    goalie: "Goalie of the Year",
    rookie: "Rookie of the Year",
    "player-of-the-year": "Player of the Year",
  };

  function renderAwardsView() {
    var seasonNumber = S.getSeason().seasonNumber;
    var mvpAwards = S.getMvpAwards().filter(function (a) { return a.season === seasonNumber; });
    var seasonAwards = S.getSeasonAwards().filter(function (a) { return a.season === seasonNumber; });
    var combined = mvpAwards.concat(seasonAwards);
    if (!combined.length) {
      return '<div class="empty-state"><p>No awards announced yet this season — First-Half MVPs land at the midpoint of the season, the full Season Awards slate (Defenseman/Goalie/Rookie/Player of the Year) and Second-Half MVPs land at season\'s end, and Playoff Series MVPs as each series wraps up.</p></div>';
    }
    var html = '<h3>Season ' + seasonNumber + "</h3>";
    html += '<div class="leaderboard-grid">';
    combined.slice().reverse().forEach(function (a) {
      var p = S.getPlayer(a.playerId);
      var div = a.divisionId ? S.getDivision(a.divisionId) : null;
      var label = a.type === "first-half" ? "First-Half MVP" : a.type === "second-half" ? "Second-Half MVP" :
        a.type === "playoff-series" ? "Playoff Series MVP" : (SEASON_AWARD_LABEL[a.type] || "Award");
      html += '<div class="leaderboard-card mvp-card"><span class="pill pill-mvp">&#127942; ' + U.escapeHtml(label) + '</span>' +
        '<h4>' + U.escapeHtml(p ? p.name : "?") + "</h4>" +
        '<p class="muted small">' + (div ? U.escapeHtml(div.name) + " Division" : "League-wide") + "</p></div>";
    });
    html += "</div>";
    return html;
  }

  function renderHallOfFameView() {
    var inductees = S.getHallOfFame().slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    if (!inductees.length) {
      return '<div class="empty-state"><p>No Hall of Famers yet — induction is automatic, evaluated the moment a player retires, based on a combination of career stats and career awards (MVPs, Season Awards). It takes a real career to clear the bar.</p></div>';
    }
    var html = '<p class="muted small">Automatic induction at retirement, based on a blend of career stats and career awards. ' + inductees.length + ' player(s) enshrined so far.</p>';
    html += '<table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Career GP</th><th>Career PTS / Record</th><th>Awards</th><th>Inducted</th></tr></thead><tbody>';
    inductees.forEach(function (e) {
      var cs = e.careerStats || S.freshStatLine();
      var statLine = e.position === "G"
        ? cs.gp + " GP, " + (cs.svPct * 100).toFixed(1) + "% SV, " + U.round1(cs.gaa) + " GAA"
        : cs.pts + " PTS (" + cs.g + "G, " + cs.a + "A)";
      html += "<tr><td>" + U.escapeHtml(e.playerName) + "</td><td>" + U.escapeHtml(e.position || "?") + "</td><td>" + cs.gp +
        "</td><td>" + statLine + "</td><td>" + (e.awardCount || 0) + "</td><td>Season " + e.season + "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderSeasonView() {
    var retiredCount = S.getRetiredPlayers().length;
    var html = '<div class="form-card"><h3>Season ' + S.getSeason().seasonNumber + '</h3><p class="muted">Phase: ' + U.escapeHtml(S.getSeason().phase) +
      (retiredCount ? " &middot; " + retiredCount + " retired legend(s)" : "") + '</p>';
    html += "<p>Aging, decline, retirement, contract expiry, the breakout rookie class, and building the next schedule all " +
      "now happen automatically when Advance Week rolls out of the off-season — nothing to click here. " +
      "You can still drop in an extra rookie class by hand any time if you want more free agents on the market.</p>";
    html += '<button class="btn" data-action="gen-rookies">Generate Rookie Class Only</button></div>';
    return html;
  }

  // Growth window: development is strongest from rookie age through
  // PEAK_YOUNG_AGE, then linearly tapers to zero by declineStartAge. A
  // player's Potential now actually means something — a high-potential
  // young player reliably climbs most of the way to their ceiling over a
  // handful of seasons, not a coin-flip +1 here and there.
  var PEAK_YOUNG_AGE = 23;

  function developPlayer(p, settings) {
    var gap = p.potential - p.overall;
    if (gap <= 0) return; // already maxed out

    var declineAge = settings.declineStartAge;
    var ageFactor;
    if (p.age <= PEAK_YOUNG_AGE) {
      ageFactor = 1; // full development speed through the peak development years
    } else if (p.age >= declineAge) {
      ageFactor = 0; // no more room to grow once decline starts
    } else {
      ageFactor = 1 - (p.age - PEAK_YOUNG_AGE) / (declineAge - PEAK_YOUNG_AGE);
    }
    if (ageFactor <= 0) return;

    // Bigger gaps close faster, clamped to a sane per-season range so
    // nobody leaps 40 points in a year, but a wide-open gap still moves
    // meaningfully every season. Deliberately slower than it used to be —
    // a playoff series win now also grants a one-time manual +1 overall
    // pick (see js/playoffs.js onSeriesWon), so automatic growth alone is
    // no longer the only way a player climbs toward their potential.
    //
    // Slowed further (0.22 -> 0.15, ceiling 5 -> 4) alongside the 88+
    // Potential floor (see U.rollPotential) — with everyone now carrying a
    // real ceiling in the 90s, automatic growth alone closing that gap at
    // the old pace would let rosters approach max potential too easily.
    // The intent is for reaching a player's ceiling to take real investment
    // (playoff-series overall picks, patience, division promotion) rather
    // than happening for free just by advancing weeks.
    var maxStep = U.clamp(Math.round(gap * 0.15), 1, 4);
    var growth = Math.round(maxStep * ageFactor);
    if (growth <= 0) growth = 1; // any real development window guarantees at least +1

    // Growth is NOT clamped at the division overall cutoff here — a player
    // who grows past it mid-season is allowed to finish that season on the
    // roster (see js/state.js releasePlayersAboveOverallCutoff, run once
    // each time the off-season begins, which force-releases anyone still
    // over their division's cutoff at that point). The cutoff still blocks
    // a player from being SIGNED, TRADED, PROMOTED, or DRAFTED into a
    // division above it in the first place.
    p.overall = U.clamp(p.overall + growth, p.overall, p.potential);
    p.attributes = U.deriveAttributes(p.overall, p.position, p.archetype);
  }

  // Ages every active (non-retired, non-prospect) player by a year, applies
  // hidden skill decline/growth, and retires anyone past their randomized
  // retirement age. Returns the list of players who just retired.
  function ageAndDeclinePlayers() {
    var settings = S.getSettings();
    var retired = [];
    S.getPlayers().forEach(function (p) {
      if (p.isDraftProspect || p.startupDraftPool || p.retired) return;
      p.age = (p.age != null ? p.age : U.generateStartingAge()) + 1;
      if (p.retirementAge == null) p.retirementAge = U.retirementAgeFor(p.age);

      if (p.age >= p.retirementAge) {
        var lastTeamId = p.teamId;
        p.retired = true;
        p.teamId = null;
        // Fold their just-completed final season into career totals before
        // resetPlayerSeasonStats() would otherwise skip them (retirees are
        // excluded there specifically so this doesn't double-count — see
        // js/state.js), then let the Hall of Fame decide on induction off
        // that true lifetime total.
        S.accumulateCareerStats(p);
        if (window.PHLHallOfFame) window.PHLHallOfFame.evaluateRetiree(p, lastTeamId);
        retired.push(p);
        return;
      }

      if (p.age >= settings.declineStartAge) {
        var dropAmt = U.randInt(1, 3);
        p.overall = U.clamp(p.overall - dropAmt, 25, 99);
        p.attributes = U.deriveAttributes(p.overall, p.position, p.archetype);
      } else {
        developPlayer(p, settings);
      }

      if (p.teamId) {
        p.contractYears = (p.contractYears != null ? p.contractYears : 2) - 1;
        if (p.contractYears <= 0) {
          p.contractYears = 0;
          p.teamId = null; // hits free agency
          // A No-Movement Clause is a term of the contract that just
          // expired, not a standing right that follows the player into
          // free agency — see js/contracts.js, where NMC is now something
          // negotiated fresh into each new deal (not a free toggle).
          p.nmc = false;
        }
      }
    });
    S.save();
    return retired;
  }

  // Breakout rookies: lower-overall young players that enter free agency
  // each season — most are deliberately raw (Overall 40-65), but a small
  // minority enter already Contender- or (more rarely) Pro-caliber, same
  // as real free agency occasionally producing an immediate difference-
  // maker rather than only projects. Every one of them still carries the
  // league-wide 88+ Potential floor (see U.rollPotential), leaning toward
  // the 90s — what varies rookie to rookie is how far they currently are
  // from that ceiling, not whether they have one.
  //
  // The higher tiers aren't just flavor: Contender/Pro now have their own
  // overall FLOORS (see js/state.js meetsOverallFloor / js/starterData.js
  // divisions) — no player below 70 can be signed into Contender, none
  // below 83 into Pro. Retirement permanently removes players from the
  // pool over a long save (see ageAndDeclinePlayers below); without SOME
  // ongoing supply at those higher bands, Contender and Pro would slowly
  // starve of eligible free agents as their veterans age out, with the
  // rookie pipeline only ever refilling Prospect. This keeps that supply
  // trickling in — modestly (most rookies are still raw prospects).
  var ROOKIE_TIERS = [
    { key: "pro", chance: 0.08, min: 83, max: 90 }, // rare, ready-made Pro talent
    { key: "contender", chance: 0.17, min: 70, max: 85 }, // Contender-caliber
    { key: "raw", chance: 1, min: 40, max: 65 }, // the typical raw Prospect project
  ];
  function rollRookieTier() {
    var roll = Math.random();
    var acc = 0;
    for (var i = 0; i < ROOKIE_TIERS.length; i++) {
      acc += ROOKIE_TIERS[i].chance;
      if (roll < acc || i === ROOKIE_TIERS.length - 1) {
        var t = ROOKIE_TIERS[i];
        return { key: t.key, overall: U.randInt(t.min, t.max) };
      }
    }
  }
  function generateRookieClass() {
    var settings = S.getSettings();
    var count = settings.rookiesPerSeason || 10;
    var created = [];
    for (var i = 0; i < count; i++) {
      var roll = Math.random();
      var position = roll < 0.45 ? "F" : roll < 0.8 ? "D" : "G";
      var rolled = rollRookieTier();
      var overall = rolled.overall;
      var potential = U.rollPotential(overall);
      var archetype = U.randomArchetype(position);
      var eligibleDivisions;
      if (rolled.key === "raw") {
        // Historical "breakout rookie" flavor: raw prospects default to
        // Prospect-only, with a chance of early Contender eligibility. At
        // this tier's 40-65 overall range that chance never actually
        // clears Contender's own floor (see js/state.js meetsOverallFloor)
        // today, so it's effectively a no-op — kept floor-aware in case
        // either range changes later, rather than silently always/never
        // firing for an undocumented reason.
        var contenderFloor = S.overallFloorForDivision("contender");
        var meetsContenderFloor = contenderFloor == null || overall >= contenderFloor;
        eligibleDivisions = (meetsContenderFloor && Math.random() < (settings.rookieContenderChance || 0.25))
          ? ["prospect", "contender"]
          : ["prospect"];
      } else {
        // Contender-/Pro-caliber tiers: no artificial division whitelist.
        // Their overall can exceed Prospect's own ceiling (79), so hard-
        // coding them to "prospect only" (like the raw tier above) could
        // leave them eligible for NOTHING once that happens. Instead, let
        // the normal per-division overall floor/ceiling gates (see
        // js/state.js meetsOverallCap/meetsOverallFloor, enforced at every
        // signing/trade/promotion checkpoint) decide what they qualify
        // for, exactly like any other free agent.
        eligibleDivisions = null;
      }
      var rookieAge = U.generateRookieAge();
      var player = {
        name: U.randomGamertag(),
        position: position,
        archetype: archetype,
        overall: overall,
        potential: potential,
        attributes: U.deriveAttributes(overall, position, archetype),
        salary: Math.max(U.SALARY_MIN, Math.round((U.salaryAsking(overall, potential) * 0.5) / 500) * 500),
        contractYears: 2,
        teamId: null,
        isDraftProspect: false,
        eligibleDivisions: eligibleDivisions,
        isRookieClass: true,
        // Which season this rookie actually debuts in — scopes Rookie of
        // the Year eligibility (see js/awards.js) to just this class, not
        // every breakout rookie ever generated (isRookieClass alone never
        // gets cleared, so it can't tell "this year's rookies" apart from
        // "a rookie three seasons ago").
        rookieSeason: S.getSeasonNumber(),
        age: rookieAge,
        retirementAge: U.retirementAgeFor(rookieAge),
        stats: S.freshStatLine(),
        careerStats: S.freshStatLine(),
      };
      created.push(S.addPlayer(player));
    }
    return created;
  }

  function wireEvents() {
    container.querySelectorAll("[data-subtab]").forEach(function (b) {
      b.addEventListener("click", function () {
        subTab = b.dataset.subtab;
        render();
      });
    });
    var divSel = container.querySelector("#stats-division");
    if (divSel) divSel.addEventListener("change", function (e) {
      divFilter = e.target.value;
      render();
    });
    var genBtn = container.querySelector('[data-action="gen-rookies"]');
    if (genBtn) genBtn.addEventListener("click", function () {
      var rookies = generateRookieClass();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
      alert(rookies.length + " breakout rookie(s) added to free agency.");
    });
  }

  window.PHLStats = {
    render: render,
    generateRookieClass: generateRookieClass,
    ageAndDeclinePlayers: ageAndDeclinePlayers,
  };
})();
