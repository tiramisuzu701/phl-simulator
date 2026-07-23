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

    container.innerHTML = html;
    wireEvents();
  }

  function statTile(label, value) {
    return '<div class="stat-tile"><div class="stat-tile-value">' + U.escapeHtml(String(value)) + '</div><div class="stat-tile-label">' + U.escapeHtml(label) + "</div></div>";
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
  }

  window.PHLTeamManagement = { render: render };
})();
