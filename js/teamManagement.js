/* PHL Franchise Simulator — Team Management (post-Startup-Draft roster hub)
 * Global namespace: window.PHLTeamManagement
 *
 * Replaces the "Startup Draft" nav item once that one-time draft finishes
 * (see js/app.js's nav-visibility logic). This is the day-to-day home for
 * managing your roster: set your starting lineup, see roster-minimum
 * status (every team must carry at least 2F/2D/1G, 5 players — see
 * S.wouldMeetRosterMinimum), and jump to Contracts/Trades/Promotions for
 * anything that changes who's actually on the roster.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var view = {
    statsMode: "regular", // "regular" | "playoffs"
    skaterSort: { key: "pts", dir: "desc" },
    goalieSort: { key: "svPct", dir: "desc" },
  };

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Team Management</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first.</p>';
      return;
    }
    var team = S.getTeam(franchise.teamId);
    if (!team) return;
    var division = S.getDivision(team.division);
    var roster = S.getRoster(team.id).slice().sort(function (a, b) { return b.overall - a.overall; });
    var counts = { F: 0, D: 0, G: 0 };
    var starters = { F: 0, D: 0, G: 0 };
    roster.forEach(function (p) {
      counts[p.position] += 1;
      if (p.starter) starters[p.position] += 1;
    });
    var meetsMin = S.wouldMeetRosterMinimum(team.id);

    var html = '<div class="panel-header"><h2 class="team-detail-heading">' + U.crestHtml(team, "crest-lg") + "Team Management</h2></div>";
    html += '<p class="muted small">GM of <strong>' + U.escapeHtml(team.name) + "</strong> (" + U.escapeHtml(division ? division.name : "?") + '). Every team — yours included — must carry at least 5 players with a legal 2 Forward / 2 Defense / 1 Goalie lineup; releases, trades and call-ups that would break that are blocked automatically.</p>';

    html += '<div class="stat-tile-row">';
    html += statTile("Roster Size", roster.length + " / " + S.getSettings().rosterMax);
    html += statTile("Forwards", counts.F);
    html += statTile("Defense", counts.D);
    html += statTile("Goalies", counts.G);
    html += "</div>";

    html += '<div class="form-card' + (meetsMin ? "" : " roster-min-warning") + '">';
    html += '<h3>Roster Minimum</h3>';
    if (meetsMin) {
      html += '<p><span class="pill pill-clinch">&#10003; Meets the 2F/2D/1G minimum</span></p>';
    } else {
      html += '<div class="warning-banner">Below the required minimum (2F / 2D / 1G, 5 players total). Sign or call up players before you can release, trade, or promote anyone further.</div>';
    }
    html += "</div>";

    html += '<div class="form-card"><h3>Quick Links</h3><div class="action-row">';
    html += '<button class="btn" data-goto="contracts">Contracts &amp; Cap</button>';
    html += '<button class="btn" data-goto="trades">Trades</button>';
    html += '<button class="btn" data-goto="promotions">Promotions</button>';
    html += '<button class="btn" data-goto="scrims">Scrims</button>';
    html += "</div></div>";

    html += '<div class="form-card">';
    html += "<h3>Set Your Lineup</h3>";
    html += '<p class="muted small">Starters set: F ' + starters.F + "/2 &middot; D " + starters.D + "/2 &middot; G " + starters.G + "/1 (of " + roster.length + " total players). Anywhere you haven't set enough starters, the simulator automatically falls back to your best available players there.</p>";
    if (!roster.length) {
      html += '<p class="muted">No players on this roster yet — head to Contracts to sign free agents.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Nametag</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Salary</th><th>Yrs</th><th>Lineup</th></tr></thead><tbody>';
      roster.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td><strong>" + p.overall + "</strong></td><td>" + p.potential + "</td>" +
          "<td>" + U.formatMoney(p.salary) + "</td><td>" + (p.contractYears != null ? p.contractYears : "&mdash;") + "</td>" +
          '<td><button class="btn btn-sm ' + (p.starter ? "btn-primary" : "") + '" data-action="toggle-starter" data-id="' + p.id + '">' + (p.starter ? "Starter" : "Bench") + "</button></td></tr>";
      });
      html += "</tbody></table>";
    }
    html += "</div>";

    html += renderStatsCard(roster);

    container.innerHTML = html;
    wireEvents();
  }

  function statTile(label, value) {
    return '<div class="stat-tile"><div class="stat-tile-value">' + U.escapeHtml(String(value)) + '</div><div class="stat-tile-label">' + U.escapeHtml(label) + "</div></div>";
  }

  var SKATER_COLS = [
    { key: "gp", label: "GP" },
    { key: "g", label: "G" },
    { key: "a", label: "A" },
    { key: "pts", label: "PTS" },
    { key: "plusMinus", label: "+/-" },
  ];
  var GOALIE_COLS = [
    { key: "gp", label: "GP" },
    { key: "saves", label: "SV" },
    { key: "shotsAgainst", label: "SA" },
    { key: "goalsAgainst", label: "GA" },
    { key: "svPct", label: "SV%", fmt: function (v) { return (v * 100).toFixed(1) + "%"; } },
    { key: "gaa", label: "GAA", fmt: function (v) { return v.toFixed(2); } },
  ];

  function sortedRows(rows, statsField, sort) {
    return rows.slice().sort(function (a, b) {
      var av = (a[statsField] || {})[sort.key] || 0;
      var bv = (b[statsField] || {})[sort.key] || 0;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }

  function statsTable(rows, cols, statsField, sort, tableKey) {
    var html = '<table class="data-table compact"><thead><tr><th>Nametag</th><th>Pos</th>';
    cols.forEach(function (c) {
      var active = sort.key === c.key;
      html += '<th class="stats-sortable' + (active ? " stats-sort-active" : "") + '" data-action="sort-stats" data-table="' + tableKey + '" data-key="' + c.key + '">' +
        c.label + (active ? (sort.dir === "asc" ? " ▲" : " ▼") : "") + "</th>";
    });
    html += "</tr></thead><tbody>";
    sortedRows(rows, statsField, sort).forEach(function (p) {
      var s = p[statsField] || {};
      html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td>";
      cols.forEach(function (c) {
        var v = s[c.key] || 0;
        html += "<td>" + (c.fmt ? c.fmt(v) : v) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  // Sortable regular-season/playoff stat tables for the user's own roster —
  // separate Skaters/Goalies tables (their stat columns don't overlap),
  // each independently sortable by clicking a column header.
  function renderStatsCard(roster) {
    var statsField = view.statsMode === "playoffs" ? "playoffStats" : "stats";
    var skaters = roster.filter(function (p) { return p.position !== "G"; });
    var goalies = roster.filter(function (p) { return p.position === "G"; });
    var anyGamesPlayed = roster.some(function (p) { return (p[statsField] || {}).gp > 0; });

    var html = '<div class="form-card">';
    html += '<div class="stats-card-header"><h3>Season Stats</h3><div class="tab-strip stats-mode-strip">';
    html += '<button class="chip' + (view.statsMode === "regular" ? " chip-active" : "") + '" data-statsmode="regular">Regular Season</button>';
    html += '<button class="chip' + (view.statsMode === "playoffs" ? " chip-active" : "") + '" data-statsmode="playoffs">Playoffs</button>';
    html += "</div></div>";

    if (!roster.length) {
      html += '<p class="muted small">No players on this roster yet.</p></div>';
      return html;
    }
    if (!anyGamesPlayed) {
      html += '<p class="muted small">' + (view.statsMode === "playoffs" ? "No playoff games played yet this cycle." : "No regular-season games played yet.") + "</p></div>";
      return html;
    }

    if (skaters.length) {
      html += "<h4>Skaters</h4>" + statsTable(skaters, SKATER_COLS, statsField, view.skaterSort, "skater");
    }
    if (goalies.length) {
      html += "<h4>Goalies</h4>" + statsTable(goalies, GOALIE_COLS, statsField, view.goalieSort, "goalie");
    }
    html += "</div>";
    return html;
  }

  function wireEvents() {
    container.querySelectorAll('[data-action="toggle-starter"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (p) S.updatePlayer(p.id, { starter: !p.starter });
        render();
      });
    });
    container.querySelectorAll("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.PHLApp) window.PHLApp.showTab(b.dataset.goto);
      });
    });
    container.querySelectorAll("[data-statsmode]").forEach(function (b) {
      b.addEventListener("click", function () {
        view.statsMode = b.dataset.statsmode;
        render();
      });
    });
    container.querySelectorAll('[data-action="sort-stats"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var sort = b.dataset.table === "goalie" ? view.goalieSort : view.skaterSort;
        if (sort.key === b.dataset.key) {
          sort.dir = sort.dir === "asc" ? "desc" : "asc";
        } else {
          sort.key = b.dataset.key;
          sort.dir = "desc";
        }
        render();
      });
    });
  }

  window.PHLTeamManagement = { render: render };
})();
