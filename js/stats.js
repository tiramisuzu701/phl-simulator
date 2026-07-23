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
    var players = S.getPlayers().filter(function (p) { return !p.isDraftProspect; });
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

    html += '<div class="panel-header" style="margin-top:2rem"><h2>Offseason</h2></div>';
    html += '<div class="form-card"><p class="muted">Season ' + S.getSeason().seasonNumber + " &middot; Phase: " + S.getSeason().phase + '</p>';
    html += "<p>Starting a new season ages every player by a year, ticks down contracts (expiring players hit free agency), resets team records and player stats, and generates a fresh schedule.</p>";
    html += '<button class="btn btn-primary" data-action="new-season">Start New Season</button></div>';

    container.innerHTML = html;
    wireEvents();
  }

  function startNewSeason() {
    if (!confirm("Start a new season? This ages players, expires contracts, resets records/stats and builds a new schedule.")) return;
    S.getPlayers().forEach(function (p) {
      if (p.isDraftProspect) return;
      p.age = (p.age || 20) + 1;
      if (p.teamId) {
        p.contractYears = (p.contractYears != null ? p.contractYears : 2) - 1;
        if (p.contractYears <= 0) {
          p.contractYears = 0;
          p.teamId = null; // hits free agency
        }
      }
    });
    S.save();
    var season = S.getSeason();
    S.updateSeason({ seasonNumber: (season.seasonNumber || 1) + 1 });
    if (window.PHLSchedule) window.PHLSchedule.generateSeasonSchedule();
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
  }

  window.PHLStats = { render: render, startNewSeason: startNewSeason };
})();
