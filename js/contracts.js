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
    var cap = S.capForTeam(selectedTeamId);
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
    html += '<div class="team-card-head"><span class="team-badge">' + U.escapeHtml(team.abbr) + '</span><span class="team-name">' + U.escapeHtml(team.name) +
      '</span><span class="pill">' + U.escapeHtml(S.getDivision(team.division).name) + " budget</span></div>";
    html += '<div class="cap-bar cap-bar-lg' + (space < 0 ? " cap-over" : "") + '"><div class="cap-bar-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="muted">Cap Used: ' + U.formatMoney(used) + " / " + U.formatMoney(cap) + " &middot; Space: " + U.formatMoney(space) + "</div>";
    if (space < 0) html += '<div class="warning-banner">Over the cap by ' + U.formatMoney(Math.abs(space)) + ". Release players to get compliant.</div>";
    html += "</div>";

    html += "<h3>Roster (" + roster.length + " / " + S.getSettings().rosterMax + ")</h3>";
    if (!roster.length) {
      html += '<p class="muted">No players on this roster yet.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Salary</th><th>Years Left</th><th></th></tr></thead><tbody>';
      roster.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td>" + p.overall + "</td><td>" + p.potential + "</td><td>" + U.formatMoney(p.salary) + "</td>";
        html += "<td>" + (p.contractYears <= 1 ? '<span class="pill pill-warn">' + p.contractYears + " (expiring)</span>" : p.contractYears) + "</td>";
        html += '<td class="row-actions"><button class="btn btn-sm" data-action="resign" data-id="' + p.id + '">Re-sign +2yr</button>' +
          '<button class="btn btn-sm btn-danger" data-action="release" data-id="' + p.id + '">Release</button></td></tr>';
      });
      html += "</tbody></table>";
    }

    var freeAgents = S.getFreeAgents().slice().sort(function (a, b) { return b.overall - a.overall; });
    html += "<h3>Free Agents (" + freeAgents.length + ")</h3>";
    if (!freeAgents.length) {
      html += '<p class="muted">No free agents available. Release players, run the draft, or generate a rookie class to populate the pool.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Asking Price</th><th></th></tr></thead><tbody>';
      freeAgents.forEach(function (p) {
        var eligible = isEligible(p, team.division);
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td>" + p.overall + "</td><td>" + p.potential + "</td><td>" + U.formatMoney(p.salary) + "</td>";
        if (eligible) {
          html += '<td><button class="btn btn-sm btn-primary" data-action="sign" data-id="' + p.id + '">Sign to ' + U.escapeHtml(team.abbr) + "</button></td></tr>";
        } else {
          html += '<td><span class="pill pill-warn" title="Breakout rookies cannot jump straight to this division">Not eligible here</span></td></tr>';
        }
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function isEligible(player, divisionId) {
    if (!player.eligibleDivisions || !player.eligibleDivisions.length) return true;
    return player.eligibleDivisions.indexOf(divisionId) !== -1;
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
        var team = S.getTeam(selectedTeamId);
        if (!isEligible(p, team.division)) {
          alert(p.name + " is a breakout rookie not yet eligible to sign with a " + S.getDivision(team.division).name + " team.");
          return;
        }
        var space = S.capSpace(selectedTeamId);
        var roster = S.getRoster(selectedTeamId);
        if (roster.length >= S.getSettings().rosterMax) {
          alert("Roster is full (" + S.getSettings().rosterMax + " players). Release someone first.");
          return;
        }
        if (p.salary > space) {
          alert("Not enough cap space to sign " + p.name + " (needs " + U.formatMoney(p.salary) + ", have " + U.formatMoney(space) + "). Release a player or lower their salary in the Players tab.");
          return;
        }
        // Once signed, a breakout rookie's division restriction is lifted —
        // it only gates their very first contract.
        S.updatePlayer(p.id, { teamId: selectedTeamId, contractYears: p.contractYears || 2, eligibleDivisions: null });
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
  }

  window.PHLContracts = { render: render };
})();
