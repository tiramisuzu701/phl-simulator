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
      html += '<table class="data-table standings-table"><thead><tr>' +
        "<th>#</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>OTL</th><th>PTS</th><th>GF</th><th>GA</th><th>DIFF</th><th></th>" +
        "</tr></thead><tbody>";
      teams.forEach(function (t, i) {
        var gp = t.wins + t.losses + t.otLosses;
        var diff = t.gf - t.ga;
        var pct = U.clamp((t.points / maxPoints) * 100, 0, 100);
        var playoffLine = S.getSettings().playoffTeamsPerDivision || 4;
        html += '<tr class="' + (i < playoffLine ? "in-playoffs" : "") + '">';
        html += "<td>" + (i + 1) + "</td>";
        html += '<td class="team-cell"><span class="dot" style="background:' + U.colorForId(t.id) + '"></span>' + U.escapeHtml(t.name) + "</td>";
        html += "<td>" + gp + "</td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.otLosses + "</td>";
        html += "<td><strong>" + t.points + "</strong></td>";
        html += "<td>" + t.gf + "</td><td>" + t.ga + "</td><td>" + (diff > 0 ? "+" + diff : diff) + "</td>";
        html += '<td class="bar-cell"><div class="mini-bar"><div class="mini-bar-fill" style="width:' + pct + '%"></div></div></td>';
        html += "</tr>";
      });
      html += "</tbody></table>";
      html += '<p class="muted small">Top ' + (S.getSettings().playoffTeamsPerDivision || 4) + " make the playoffs.</p>";
      html += "</div>";
    });

    container.innerHTML = html;
  }

  window.PHLStandings = { render: render, sortedStandings: sortedStandings };
})();
