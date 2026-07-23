/* PHL Franchise Simulator — dashboard overview
 * Global namespace: window.PHLDashboard
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  function render(el) {
    container = el || container;
    if (!container) return;
    var season = S.getSeason();
    var divisions = S.getDivisions().slice().sort(function (a, b) { return b.tier - a.tier; });
    var teams = S.getTeams();
    var players = S.getPlayers().filter(function (p) { return !p.isDraftProspect; });
    var rostered = players.filter(function (p) { return p.teamId; });
    var freeAgents = S.getFreeAgents();
    var franchise = S.getFranchise();
    var startupDraft = S.getStartupDraft();

    var html = '<div class="panel-header"><h2>Dashboard</h2></div>';

    if (!franchise.teamId || startupDraft.status !== "complete") {
      html += '<div class="empty-state"><p>' +
        (!franchise.teamId
          ? "Pick your division and team to get started."
          : startupDraft.status === "active"
          ? "Your Startup Draft is in progress."
          : "You're all set up — begin the Startup Draft to fill out every team's roster.") +
        '</p><button class="btn btn-primary" data-goto="startup">Go to Startup Draft</button></div>';
    } else {
      var myTeam = S.getTeam(franchise.teamId);
      var myDiv = S.getDivision(franchise.divisionId);
      html += '<p class="muted small">GM of <strong>' + U.escapeHtml(myTeam ? myTeam.name : "?") + "</strong> (" + U.escapeHtml(myDiv ? myDiv.name : "?") +
        ') &middot; use <strong>Advance Week</strong> (top right) to move the season forward.</p>';
    }
    html += '<div class="stat-tile-row">';
    html += statTile("Season", season.seasonNumber || 1);
    html += statTile("Phase", capitalize(season.phase || "offseason"));
    html += statTile("Teams", teams.length);
    html += statTile("Players Rostered", rostered.length);
    html += statTile("Free Agents", freeAgents.length);
    html += "</div>";

    if (!players.length) {
      html += '<div class="empty-state"><p>Your league has no players yet. Head to the <strong>Players</strong> tab to add your own database, or generate a sample roster to try the simulator out.</p>' +
        '<button class="btn btn-primary" data-goto="players">Go to Players</button></div>';
    }

    html += '<div class="dashboard-grid">';
    divisions.forEach(function (div) {
      var standings = window.PHLStandings.sortedStandings(div.id).slice(0, 3);
      html += '<div class="form-card"><h3 class="division-title">' + U.escapeHtml(div.name) + "</h3>";
      if (!standings.length) {
        html += '<p class="muted small">No teams yet.</p>';
      } else {
        html += '<ol class="mini-standings">';
        standings.forEach(function (t) {
          html += "<li><span class=\"mini-standings-team\">" + U.crestHtml(t, "crest-sm") + U.escapeHtml(t.name) + "</span><span>" + t.points + " pts</span></li>";
        });
        html += "</ol>";
      }
      html += "</div>";
    });
    html += "</div>";

    html += '<div class="form-card"><h3>Quick Actions</h3><div class="action-row">';
    html += '<button class="btn" data-goto="schedule">Schedule &amp; Box Scores</button>';
    html += '<button class="btn" data-goto="standings">View Standings</button>';
    html += '<button class="btn" data-goto="playoffs">Playoffs</button>';
    html += '<button class="btn" data-goto="contracts">Contracts</button>';
    html += '<button class="btn" data-goto="trades">Trades</button>';
    html += '<button class="btn" data-goto="promotions">Promotions</button>';
    html += '<button class="btn" data-goto="teams">Teams &amp; Expansion</button>';
    html += '<button class="btn" data-goto="data">Export / Import League</button>';
    html += "</div></div>";

    container.innerHTML = html;
    container.querySelectorAll("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () {
        window.PHLApp.showTab(b.dataset.goto);
      });
    });
  }

  function statTile(label, value) {
    return '<div class="stat-tile"><div class="stat-tile-value">' + U.escapeHtml(String(value)) + '</div><div class="stat-tile-label">' + U.escapeHtml(label) + "</div></div>";
  }
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.PHLDashboard = { render: render };
})();
