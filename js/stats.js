/* PHL Franchise Simulator — league leaderboards & offseason (new season) flow
 * Global namespace: window.PHLStats
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var divFilter = "";

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

  function playersInScope() {
    var players = S.getPlayers().filter(function (p) { return !p.isDraftProspect && !p.retired; });
    if (!divFilter) return players;
    return players.filter(function (p) {
      var t = p.teamId ? S.getTeam(p.teamId) : null;
      return t && t.division === divFilter;
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

  function render(el) {
    container = el || container;
    if (!container) return;
    var divisions = S.getDivisions();
    var players = playersInScope();
    var skaters = players.filter(function (p) { return p.position !== "G" && p.stats.gp > 0; });
    var goalies = players.filter(function (p) { return p.position === "G" && p.stats.gp > 0; });

    var html = '<div class="panel-header"><h2>League Leaders</h2></div>';
    html += '<div class="filter-bar"><select id="stats-division"><option value="">All Divisions</option>';
    divisions.forEach(function (d) {
      html += '<option value="' + d.id + '"' + (divFilter === d.id ? " selected" : "") + ">" + U.escapeHtml(d.name) + "</option>";
    });
    html += "</select></div>";

    html += '<div class="leaderboard-grid">';
    html += renderBoard("Points", leaderboard(skaters, function (p) { return p.stats.pts; }, 10), "PTS", function (p) { return p.stats.pts; });
    html += renderBoard("Goals", leaderboard(skaters, function (p) { return p.stats.g; }, 10), "G", function (p) { return p.stats.g; });
    html += renderBoard("Assists", leaderboard(skaters, function (p) { return p.stats.a; }, 10), "A", function (p) { return p.stats.a; });
    html += renderBoard("Plus/Minus", leaderboard(skaters, function (p) { return p.stats.plusMinus; }, 10), "+/-", function (p) { return p.stats.plusMinus; });
    html += renderBoard("Save %", leaderboard(goalies, function (p) { return p.stats.svPct; }, 10, { min: 5, countFn: function (p) { return p.stats.shotsAgainst; } }), "SV%", function (p) { return (p.stats.svPct * 100).toFixed(1); });
    html += renderBoard("GAA (lower is better)", leaderboard(goalies, function (p) { return p.stats.gaa; }, 10, { asc: true, min: 3, countFn: function (p) { return p.stats.gp; } }), "GAA", function (p) { return p.stats.gaa; });
    html += "</div>";

    var retiredCount = S.getRetiredPlayers().length;
    html += '<div class="panel-header" style="margin-top:2rem"><h2>Offseason</h2></div>';
    html += '<div class="form-card"><p class="muted">Season ' + S.getSeason().seasonNumber + " &middot; Phase: " + S.getSeason().phase +
      (retiredCount ? " &middot; " + retiredCount + " retired legend(s)" : "") + '</p>';
    html += "<p>Starting a new season quietly ages every active player, begins skill decline past " + S.getSettings().declineStartAge +
      ", retires players who reach their (hidden, randomized) retirement age, ticks down contracts (expiring players hit free agency), " +
      "drops in a fresh breakout rookie class, resets records/stats, and builds a new schedule.</p>";
    html += '<button class="btn btn-primary" data-action="new-season">Start New Season</button> ' +
      '<button class="btn" data-action="gen-rookies">Generate Rookie Class Only</button></div>';

    container.innerHTML = html;
    wireEvents();
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

    // Bigger gaps close faster (up to ~1/3 of what's left per season),
    // clamped to a sane per-season range so nobody leaps 40 points in a
    // year, but a wide-open gap still moves meaningfully every season.
    var maxStep = U.clamp(Math.round(gap * 0.35), 1, 8);
    var growth = Math.round(maxStep * ageFactor);
    if (growth <= 0) growth = 1; // any real development window guarantees at least +1

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
      if (p.retirementAge == null) p.retirementAge = U.retirementAgeFor();

      if (p.age >= p.retirementAge) {
        p.retired = true;
        p.teamId = null;
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
        }
      }
    });
    S.save();
    return retired;
  }

  // Breakout rookies: lower-overall, wide-spread-potential young players
  // that enter free agency each season. Restricted (at first signing only)
  // to Prospect — occasionally Contender — never straight to Pro.
  function generateRookieClass() {
    var settings = S.getSettings();
    var count = settings.rookiesPerSeason || 10;
    var created = [];
    for (var i = 0; i < count; i++) {
      var roll = Math.random();
      var position = roll < 0.45 ? "F" : roll < 0.8 ? "D" : "G";
      var overall = U.randInt(40, 65);
      var potentialRoll = Math.random();
      var potential;
      if (potentialRoll < 0.15) potential = U.randInt(85, 97); // boom-or-bust gem
      else if (potentialRoll < 0.5) potential = U.clamp(overall + U.randInt(15, 30), overall, 90);
      else potential = U.clamp(overall + U.randInt(2, 14), overall, 80);
      var archetype = U.randomArchetype(position);
      var eligibleDivisions = Math.random() < (settings.rookieContenderChance || 0.25)
        ? ["prospect", "contender"]
        : ["prospect"];
      var player = {
        name: U.randomName(),
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
        age: U.generateRookieAge(),
        retirementAge: U.retirementAgeFor(),
        stats: S.freshStatLine(),
      };
      created.push(S.addPlayer(player));
    }
    return created;
  }

  function startNewSeason() {
    if (!confirm("Start a new season? This ages players (some may retire), expires contracts, generates a new breakout rookie class, resets records/stats, and builds a new schedule.")) return;
    var priorSeasonNumber = S.getSeason().seasonNumber || 1;
    var retired = ageAndDeclinePlayers();
    var rookies = generateRookieClass();
    S.updateSeason({ seasonNumber: priorSeasonNumber + 1 });
    if (window.PHLSchedule) window.PHLSchedule.generateSeasonSchedule();
    alert(
      "Season " + priorSeasonNumber + " is in the books.\n" +
      retired.length + " player(s) retired.\n" +
      rookies.length + " breakout rookie(s) joined free agency (mostly Prospect-eligible)."
    );
  }

  function wireEvents() {
    container.querySelector("#stats-division").addEventListener("change", function (e) {
      divFilter = e.target.value;
      render();
    });
    container.querySelector('[data-action="new-season"]').addEventListener("click", function () {
      startNewSeason();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    container.querySelector('[data-action="gen-rookies"]').addEventListener("click", function () {
      var rookies = generateRookieClass();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
      alert(rookies.length + " breakout rookie(s) added to free agency.");
    });
  }

  window.PHLStats = {
    render: render,
    startNewSeason: startNewSeason,
    generateRookieClass: generateRookieClass,
    ageAndDeclinePlayers: ageAndDeclinePlayers,
  };
})();
