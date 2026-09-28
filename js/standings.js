/* PHL Franchise Simulator — standings
 * Global namespace: window.PHLStandings
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  function sortedStandings(divisionId) {
    var teams = S.getTeams(divisionId).slice();
    teams.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      var diffA = a.gf - a.ga;
      var diffB = b.gf - b.ga;
      return diffB - diffA;
    });
    return teams;
  }

  // Real clinch / elimination math (points only, ties treated as NOT
  // safe): a team has clinched a top-N finish once fewer than N other teams
  // can still reach its current points total, and is eliminated once N
  // teams already have more points than it can possibly reach. Everything
  // in between is just "currently in position", not clinched.
  function remainingGames(divisionId) {
    var rem = {};
    S.getSchedule(divisionId).forEach(function (g) {
      if (g.played) return;
      rem[g.homeTeamId] = (rem[g.homeTeamId] || 0) + 1;
      rem[g.awayTeamId] = (rem[g.awayTeamId] || 0) + 1;
    });
    return rem;
  }
  function clinchInfo(teams, divisionId) {
    var rem = remainingGames(divisionId);
    var maxPts = {};
    teams.forEach(function (t) { maxPts[t.id] = t.points + 2 * (rem[t.id] || 0); });
    function canCatch(t) {
      return teams.filter(function (o) { return o.id !== t.id && maxPts[o.id] >= t.points; }).length;
    }
    function aheadForSure(t) {
      return teams.filter(function (o) { return o.id !== t.id && o.points > maxPts[t.id]; }).length;
    }
    var info = {};
    teams.forEach(function (t) {
      info[t.id] = { threats: canCatch(t), lockedAhead: aheadForSure(t) };
    });
    return info;
  }

  function playoffFormatText(cfg) {
    if (cfg.teams <= cfg.byes) {
      return "Top " + cfg.teams + " make the playoffs.";
    }
    var wildcardSpots = cfg.teams - cfg.byes;
    return "Top " + cfg.byes + " clinch a bye straight into the bracket; seeds " + (cfg.byes + 1) + "–" + cfg.teams +
      " play a Wild Card round for the final " + wildcardSpots + (wildcardSpots === 1 ? " spot." : " spots.");
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var divisions = S.getDivisions().slice().sort(function (a, b) { return b.tier - a.tier; });
    var maxPoints = Math.max(1, S.getTeams().reduce(function (m, t) { return Math.max(m, t.points); }, 1));

    var html = '<div class="panel-header"><h2>Standings</h2></div>';
    divisions.forEach(function (div) {
      var teams = sortedStandings(div.id);
      html += '<div class="division-block">';
      html += '<h3 class="division-title">' + U.escapeHtml(div.name) + " Division</h3>";
      if (!teams.length) {
        html += '<p class="muted">No teams in this division.</p></div>';
        return;
      }
      var cfg = window.PHLPlayoffs ? window.PHLPlayoffs.getPlayoffConfig(div.id) : { teams: S.getSettings().playoffTeamsPerDivision || 4, byes: S.getSettings().playoffTeamsPerDivision || 4 };
      var hasWildcard = cfg.teams > cfg.byes;
      var clinch = clinchInfo(teams, div.id);

      html += '<table class="data-table standings-table"><thead><tr>' +
        "<th>#</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>OTL</th><th>PTS</th><th>GF</th><th>GA</th><th>DIFF</th><th></th><th>Status</th>" +
        "</tr></thead><tbody>";
      teams.forEach(function (t, i) {
        var gp = t.wins + t.losses + t.otLosses;
        var diff = t.gf - t.ga;
        var pct = U.clamp((t.points / maxPoints) * 100, 0, 100);
        var seed = i + 1;
        var rowClass = "";
        var statusPill = "";
        var ci = clinch[t.id];
        if (seed <= cfg.byes) rowClass = "in-playoffs";
        else if (seed <= cfg.teams) rowClass = "in-wildcard";
        if (hasWildcard && ci.threats < cfg.byes) {
          statusPill = '<span class="pill pill-clinch">Clinched Bye</span>';
        } else if (ci.threats < cfg.teams) {
          statusPill = '<span class="pill pill-clinch">Clinched</span>';
        } else if (ci.lockedAhead >= cfg.teams) {
          statusPill = '<span class="pill pill-loss">Eliminated</span>';
        } else if (seed <= cfg.byes) {
          statusPill = '<span class="pill pill-accent">' + (hasWildcard ? "Bye Spot" : "Playoff Spot") + "</span>";
        } else if (seed <= cfg.teams) {
          statusPill = '<span class="pill pill-warn">Wild Card Spot</span>';
        } else {
          statusPill = '<span class="muted small">&mdash;</span>';
        }
        html += '<tr class="' + rowClass + '">';
        html += "<td>" + seed + "</td>";
        html += '<td><span class="team-cell team-name-link" data-action="view-team" data-id="' + t.id + '" role="button" tabindex="0">' + U.crestHtml(t, "crest-sm") + U.escapeHtml(t.name) + "</span></td>";
        html += "<td>" + gp + "</td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.otLosses + "</td>";
        html += "<td><strong>" + t.points + "</strong></td>";
        html += "<td>" + t.gf + "</td><td>" + t.ga + "</td><td>" + (diff > 0 ? "+" + diff : diff) + "</td>";
        html += '<td class="bar-cell"><div class="mini-bar"><div class="mini-bar-fill" style="width:' + pct + '%"></div></div></td>';
        html += "<td>" + statusPill + "</td>";
        html += "</tr>";
      });
      html += "</tbody></table>";
      html += '<p class="muted small">' + playoffFormatText(cfg) + " &ldquo;Spot&rdquo; = currently in position; &ldquo;Clinched&rdquo; = mathematically locked in.</p>";
      html += "</div>";
    });

    container.innerHTML = html;
    container.querySelectorAll('[data-action="view-team"]').forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.PHLApp) window.PHLApp.showTeamDetail(b.dataset.id);
      });
    });
  }

  window.PHLStandings = { render: render, sortedStandings: sortedStandings };
})();
