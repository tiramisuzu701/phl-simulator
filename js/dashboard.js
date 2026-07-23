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
      if (myTeam) html += renderMyTeamHub(myTeam);
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

  // Recent games (played, most recent first) for `teamId`, tagged with
  // W/L/OTL relative to that team.
  function recentForm(teamId, limit) {
    var games = S.getSchedule().filter(function (g) {
      return g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId);
    });
    games.sort(function (a, b) { return b.week - a.week; });
    return games.slice(0, limit).map(function (g) {
      var isHome = g.homeTeamId === teamId;
      var myScore = isHome ? g.homeScore : g.awayScore;
      var oppScore = isHome ? g.awayScore : g.homeScore;
      var oppId = isHome ? g.awayTeamId : g.homeTeamId;
      var result = myScore > oppScore ? "W" : (g.wentToOT ? "OTL" : "L");
      return { game: g, result: result, oppId: oppId, myScore: myScore, oppScore: oppScore };
    });
  }

  // Next unplayed games (soonest first) for `teamId`.
  function upcomingGames(teamId, limit) {
    var games = S.getSchedule().filter(function (g) {
      return !g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId);
    });
    games.sort(function (a, b) { return a.week - b.week; });
    return games.slice(0, limit);
  }

  // The "full at-a-glance hub" — recent form, next 3 games, cap health,
  // roster-minimum status, and a quick Inbox preview, all on one card so
  // there's no need to hop between tabs just to see where things stand.
  function renderMyTeamHub(myTeam) {
    var recent = recentForm(myTeam.id, 5);
    var upcoming = upcomingGames(myTeam.id, 3);
    var cap = S.capForTeam(myTeam.id);
    var used = S.capUsed(myTeam.id);
    var space = S.capSpace(myTeam.id);
    var pct = U.clamp(cap ? (used / cap) * 100 : 0, 0, 100);
    var rosterOk = S.wouldMeetRosterMinimum(myTeam.id);
    var unread = S.unreadNotificationCount();
    var recentNotifs = S.getNotifications().slice(0, 3);

    var html = '<div class="form-card"><h3>Your Team At a Glance</h3><div class="dashboard-hub-grid">';

    html += '<div class="hub-section"><h4>Recent Form</h4>';
    if (!recent.length) {
      html += '<p class="muted small">No games played yet.</p>';
    } else {
      html += '<div class="form-pills">';
      recent.forEach(function (r) {
        var opp = S.getTeam(r.oppId);
        var cls = r.result === "W" ? "pill-clinch" : r.result === "OTL" ? "pill-warn" : "pill-loss";
        html += '<span class="pill ' + cls + ' small" title="' + r.myScore + '-' + r.oppScore + ' vs ' +
          U.escapeHtml(opp ? opp.abbr : "?") + ' (Week ' + r.game.week + ')">' + r.result + '</span>';
      });
      html += "</div>";
    }
    html += "</div>";

    html += '<div class="hub-section"><h4>Next Up</h4>';
    if (!upcoming.length) {
      html += '<p class="muted small">No games scheduled.</p>';
    } else {
      html += '<ul class="mini-standings">';
      upcoming.forEach(function (g) {
        var isHome = g.homeTeamId === myTeam.id;
        var opp = S.getTeam(isHome ? g.awayTeamId : g.homeTeamId);
        html += "<li><span>Week " + g.week + "</span><span>" + (isHome ? "vs " : "@ ") + U.escapeHtml(opp ? opp.abbr : "?") + "</span></li>";
      });
      html += "</ul>";
    }
    html += "</div>";

    html += '<div class="hub-section"><h4>Cap Health</h4>';
    html += '<div class="cap-bar' + (space < 0 ? " cap-over" : "") + '"><div class="cap-bar-fill" style="width:' + pct + '%"></div></div>';
    html += '<p class="muted small">' + U.formatMoney(used) + " / " + U.formatMoney(cap) +
      (space < 0 ? " &mdash; over by " + U.formatMoney(Math.abs(space)) : " &mdash; " + U.formatMoney(space) + " free") + "</p>";
    html += "</div>";

    html += '<div class="hub-section"><h4>Roster Status</h4>';
    html += rosterOk
      ? '<p class="muted small">Meets the ' + S.ROSTER_MIN.total + "-player roster minimum (" + S.ROSTER_MIN.F + "F/" + S.ROSTER_MIN.D + "D/" + S.ROSTER_MIN.G + "G).</p>"
      : '<p class="pill pill-warn small">Below the roster minimum &mdash; sign or call up players before advancing.</p>';
    if (!S.isTransactionWindowOpen()) html += '<p class="pill pill-warn small">Trade deadline passed &mdash; transactions locked.</p>';
    html += "</div>";

    html += '<div class="hub-section"><h4>Inbox <span class="pill pill-accent small">' + unread + " unread</span></h4>";
    if (!recentNotifs.length) {
      html += '<p class="muted small">No notifications yet.</p>';
    } else {
      html += '<ul class="mini-standings">';
      recentNotifs.forEach(function (n) {
        html += "<li><span>" + U.escapeHtml(n.title || "") + "</span>" + (n.read ? "" : '<span class="pill pill-accent small">New</span>') + "</li>";
      });
      html += "</ul>";
    }
    html += '<button class="btn btn-sm" data-goto="inbox">View Inbox</button>';
    html += "</div>";

    html += "</div></div>";
    return html;
  }

  function statTile(label, value) {
    return '<div class="stat-tile"><div class="stat-tile-value">' + U.escapeHtml(String(value)) + '</div><div class="stat-tile-label">' + U.escapeHtml(label) + "</div></div>";
  }
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.PHLDashboard = { render: render };
})();
