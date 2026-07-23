/* PHL Franchise Simulator — individual team page (roster + stats)
 * Global namespace: window.PHLTeamDetail
 *
 * A PHLstats.com-style team page: full roster with per-player season
 * stats, team-level splits, and a recent-results log. Reachable by
 * clicking any team name (Teams, Standings) — read-only for every team,
 * including the one the GM manages (use Contracts/Players for actions).
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var teamId = null;

  function setTeam(id) {
    teamId = id;
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    if (!teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Team</h2></div><p class="muted">Pick a team from the Teams or Standings tab.</p>';
      return;
    }
    var team = S.getTeam(teamId);
    if (!team) {
      container.innerHTML = '<div class="panel-header"><h2>Team</h2></div><p class="muted">That team no longer exists.</p>';
      return;
    }
    var division = S.getDivision(team.division);
    var roster = S.getRoster(teamId).slice().sort(function (a, b) { return b.overall - a.overall; });
    var skaters = roster.filter(function (p) { return p.position !== "G"; });
    var goalies = roster.filter(function (p) { return p.position === "G"; });
    var gp = team.wins + team.losses + team.otLosses;
    var cap = S.capForTeam(teamId);
    var used = S.capUsed(teamId);

    var html = '<div class="panel-header"><h2>' + U.escapeHtml(team.name) + "</h2>" +
      '<button class="btn btn-sm" data-action="back-to-teams">&larr; Back to Teams</button></div>';
    html += '<p class="muted small">' + U.escapeHtml(division ? division.name : "?") + " Division" +
      (S.isManagedTeam(teamId) ? ' &middot; <span class="pill pill-accent">You GM this team</span>' : "") + "</p>";

    html += '<div class="stat-tile-row">';
    html += statTile("Record", team.wins + "-" + team.losses + "-" + team.otLosses);
    html += statTile("Points", team.points);
    html += statTile("GP", gp);
    html += statTile("GF", team.gf);
    html += statTile("GA", team.ga);
    html += statTile("Diff", (team.gf - team.ga > 0 ? "+" : "") + (team.gf - team.ga));
    html += statTile("Cap", U.formatMoney(used) + " / " + U.formatMoney(cap));
    html += "</div>";

    html += "<h3>Skaters (" + skaters.length + ")</h3>";
    if (!skaters.length) {
      html += '<p class="muted">No skaters on this roster.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th>' +
        "<th>GP</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th></tr></thead><tbody>";
      skaters.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + (p.starter ? ' <span class="pill pill-clinch" title="Starter">S</span>' : "") + "</td><td>" + p.position + "</td><td>" +
          U.escapeHtml(p.archetype || "") + "</td><td><strong>" + p.overall + "</strong></td><td>" + p.potential + "</td><td>" +
          p.stats.gp + "</td><td>" + p.stats.g + "</td><td>" + p.stats.a + "</td><td><strong>" + p.stats.pts + "</strong></td><td>" +
          (p.stats.plusMinus > 0 ? "+" + p.stats.plusMinus : p.stats.plusMinus) + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    html += "<h3>Goalies (" + goalies.length + ")</h3>";
    if (!goalies.length) {
      html += '<p class="muted">No goalies on this roster.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Archetype</th><th>OVR</th><th>POT</th>' +
        "<th>GP</th><th>SV</th><th>SA</th><th>GA</th><th>SV%</th><th>GAA</th></tr></thead><tbody>";
      goalies.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + (p.starter ? ' <span class="pill pill-clinch" title="Starter">S</span>' : "") + "</td><td>" +
          U.escapeHtml(p.archetype || "") + "</td><td><strong>" + p.overall + "</strong></td><td>" + p.potential + "</td><td>" +
          p.stats.gp + "</td><td>" + p.stats.saves + "</td><td>" + p.stats.shotsAgainst + "</td><td>" + p.stats.goalsAgainst + "</td><td>" +
          (p.stats.svPct * 100).toFixed(1) + "%</td><td>" + p.stats.gaa + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    var games = S.getSchedule(team.division).filter(function (g) {
      return (g.homeTeamId === teamId || g.awayTeamId === teamId) && g.played;
    }).sort(function (a, b) { return b.week - a.week; }).slice(0, 10);
    html += "<h3>Recent Results</h3>";
    if (!games.length) {
      html += '<p class="muted">No games played yet.</p>';
    } else {
      html += '<table class="data-table compact"><thead><tr><th>Wk</th><th>Opponent</th><th>Result</th></tr></thead><tbody>';
      games.forEach(function (g) {
        var isHome = g.homeTeamId === teamId;
        var oppId = isHome ? g.awayTeamId : g.homeTeamId;
        var opp = S.getTeam(oppId);
        var us = isHome ? g.homeScore : g.awayScore;
        var them = isHome ? g.awayScore : g.homeScore;
        var win = us > them;
        html += "<tr><td>" + g.week + "</td><td>" + (isHome ? "vs " : "@ ") + U.escapeHtml(opp ? opp.abbr : "?") + "</td><td>" +
          '<span class="pill ' + (win ? "pill-clinch" : "pill-warn") + '">' + (win ? "W" : g.wentToOT ? "OTL" : "L") + " " + us + "-" + them + "</span></td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    var back = container.querySelector('[data-action="back-to-teams"]');
    if (back) back.addEventListener("click", function () {
      if (window.PHLApp) window.PHLApp.showTab("teams");
    });
  }

  function statTile(label, value) {
    return '<div class="stat-tile"><div class="stat-tile-value">' + U.escapeHtml(String(value)) + '</div><div class="stat-tile-label">' + U.escapeHtml(label) + "</div></div>";
  }

  window.PHLTeamDetail = { render: render, setTeam: setTeam };
})();
