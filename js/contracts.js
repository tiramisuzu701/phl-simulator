/* PHL Franchise Simulator — contracts & salary cap management
 * Global namespace: window.PHLContracts
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var selectedTeamId = null;

  function render(el) {
    container = el || container;
    if (!container) return;
    var teams = S.getTeams().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!teams.length) {
      container.innerHTML = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div><p class="muted">Add a team first.</p>';
      return;
    }
    if (!selectedTeamId || !teams.some(function (t) { return t.id === selectedTeamId; })) {
      selectedTeamId = teams[0].id;
    }
    var team = S.getTeam(selectedTeamId);
    var cap = S.getSettings().salaryCap;
    var used = S.capUsed(selectedTeamId);
    var space = S.capSpace(selectedTeamId);
    var pct = U.clamp((used / cap) * 100, 0, 100);
    var roster = S.getRoster(selectedTeamId).slice().sort(function (a, b) { return b.overall - a.overall; });

    var html = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div>';
    html += '<div class="filter-bar"><label>Team <select id="cap-team-select">';
    teams.forEach(function (t) {
      html += '<option value="' + t.id + '"' + (t.id === selectedTeamId ? " selected" : "") + ">" + U.escapeHtml(t.name) + "</option>";
    });
    html += "</select></label></div>";

    html += '<div class="cap-summary-card" style="--accent:' + U.colorForId(team.id) + '">';
    html += '<div class="team-card-head"><span class="team-badge">' + U.escapeHtml(team.abbr) + '</span><span class="team-name">' + U.escapeHtml(team.name) + "</span></div>";
    html += '<div class="cap-bar cap-bar-lg' + (space < 0 ? " cap-over" : "") + '"><div class="cap-bar-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="muted">Cap Used: ' + U.round1(used) + " / " + cap + " &middot; Space: " + space + "</div>";
    if (space < 0) html += '<div class="warning-banner">Over the cap by ' + Math.abs(space) + ". Release players to get compliant.</div>";
    html += "</div>";

    html += "<h3>Roster (" + roster.length + " / " + S.getSettings().rosterMax + ")</h3>";
    if (!roster.length) {
      html += '<p class="muted">No players on this roster yet.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>OVR</th><th>Salary</th><th>Years Left</th><th></th></tr></thead><tbody>';
      roster.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + p.overall + "</td><td>" + U.round1(p.salary) + "</td>";
        html += "<td>" + (p.contractYears <= 1 ? '<span class="pill pill-warn">' + p.contractYears + " (expiring)</span>" : p.contractYears) + "</td>";
        html += '<td class="row-actions"><button class="btn btn-sm" data-action="resign" data-id="' + p.id + '">Re-sign +2yr</button>' +
          '<button class="btn btn-sm btn-danger" data-action="release" data-id="' + p.id + '">Release</button></td></tr>';
      });
      html += "</tbody></table>";
    }

    var freeAgents = S.getFreeAgents().slice().sort(function (a, b) { return b.overall - a.overall; });
    html += "<h3>Free Agents (" + freeAgents.length + ")</h3>";
    if (!freeAgents.length) {
      html += '<p class="muted">No free agents available. Release players or run a draft to populate the pool.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th>Asking Salary</th><th></th></tr></thead><tbody>';
      freeAgents.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + (p.age || "&mdash;") + "</td><td>" + p.overall + "</td><td>" + U.round1(p.salary) + "</td>";
        html += '<td><button class="btn btn-sm btn-primary" data-action="sign" data-id="' + p.id + '">Sign to ' + U.escapeHtml(team.abbr) + "</button></td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    container.querySelector("#cap-team-select").addEventListener("change", function (e) {
      selectedTeamId = e.target.value;
      render();
    });
    container.querySelectorAll('[data-action="release"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (p && confirm('Release "' + p.name + '" to free agency?')) {
          S.updatePlayer(p.id, { teamId: null });
          render();
          if (window.PHLApp) window.PHLApp.refresh();
        }
      });
    });
    container.querySelectorAll('[data-action="resign"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        S.updatePlayer(p.id, { contractYears: (p.contractYears || 0) + 2 });
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
    container.querySelectorAll('[data-action="sign"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        var space = S.capSpace(selectedTeamId);
        var roster = S.getRoster(selectedTeamId);
        if (roster.length >= S.getSettings().rosterMax) {
          alert("Roster is full (" + S.getSettings().rosterMax + " players). Release someone first.");
          return;
        }
        if (p.salary > space) {
          alert("Not enough cap space to sign " + p.name + " (needs " + U.round1(p.salary) + ", have " + space + "). Release a player or lower their salary in the Players tab.");
          return;
        }
        S.updatePlayer(p.id, { teamId: selectedTeamId, contractYears: p.contractYears || 2 });
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
  }

  window.PHLContracts = { render: render };
})();
