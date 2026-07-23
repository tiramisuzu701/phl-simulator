/* PHL Franchise Simulator — Players editor (roster database)
 * Global namespace: window.PHLPlayers
 *
 * Visible player fields are intentionally simple: Nametag, Position,
 * Archetype, Overall, Potential, Team, Salary, Contract Years. Age is a
 * hidden internal mechanic (see utils.js) and is never shown or editable
 * here. The offense/defense/goaltending numbers the sim engine actually
 * uses are derived from Overall + Position + Archetype (utils.deriveAttributes)
 * rather than entered by hand.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var filters = { division: "", team: "", position: "", pool: "roster" };

  function render(el) {
    container = el || container;
    if (!container) return;

    var divisions = S.getDivisions();
    var teams = S.getTeams().slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    var html = "";
    html += '<div class="panel-header"><h2>Player Database</h2>' +
      '<div class="header-actions">' +
      '<button class="btn" data-action="gen-sample">Generate Sample Roster</button>' +
      '<button class="btn btn-primary" data-action="new-player">+ Add Player</button>' +
      "</div></div>";

    html += '<div class="filter-bar">';
    html += '<select id="filt-pool"><option value="roster">On a Team</option><option value="fa">Free Agents</option><option value="pool">Draft Pool</option><option value="startup">Startup Draft Pool</option><option value="retired">Retired</option><option value="all">All Players</option></select>';
    html += '<select id="filt-division"><option value="">All Divisions</option>';
    divisions.forEach(function (d) {
      html += '<option value="' + d.id + '">' + U.escapeHtml(d.name) + "</option>";
    });
    html += '</select>';
    html += '<select id="filt-team"><option value="">All Teams</option>';
    teams.forEach(function (t) {
      html += '<option value="' + t.id + '">' + U.escapeHtml(t.name) + "</option>";
    });
    html += '</select>';
    html += '<select id="filt-position"><option value="">All Positions</option><option value="F">Forward</option><option value="D">Defense</option><option value="G">Goalie</option></select>';
    html += "</div>";

    html += '<div id="player-form-panel"></div>';
    html += '<div id="player-table-wrap"></div>';

    container.innerHTML = html;
    container.querySelector("#filt-pool").value = filters.pool;
    container.querySelector("#filt-division").value = filters.division;
    container.querySelector("#filt-team").value = filters.team;
    container.querySelector("#filt-position").value = filters.position;

    renderTable();
    wireStaticEvents();
  }

  function currentList() {
    var list = S.getPlayers().slice();
    if (filters.pool === "roster") list = list.filter(function (p) { return !!p.teamId && !p.retired; });
    else if (filters.pool === "fa") list = list.filter(function (p) { return !p.teamId && !p.isDraftProspect && !p.startupDraftPool && !p.retired; });
    else if (filters.pool === "pool") list = list.filter(function (p) { return !!p.isDraftProspect; });
    else if (filters.pool === "startup") list = list.filter(function (p) { return !!p.startupDraftPool; });
    else if (filters.pool === "retired") list = list.filter(function (p) { return !!p.retired; });
    else list = list.filter(function (p) { return !p.retired; }); // "all" still hides retired legends by default
    if (filters.division) {
      list = list.filter(function (p) {
        var t = p.teamId ? S.getTeam(p.teamId) : null;
        return t && t.division === filters.division;
      });
    }
    if (filters.team) list = list.filter(function (p) { return p.teamId === filters.team; });
    if (filters.position) list = list.filter(function (p) { return p.position === filters.position; });
    list.sort(function (a, b) { return (b.overall || 0) - (a.overall || 0); });
    return list;
  }

  function renderTable() {
    var wrap = container.querySelector("#player-table-wrap");
    var list = currentList();
    if (!list.length) {
      wrap.innerHTML = '<p class="muted">No players match these filters yet. Add one, or generate a sample roster to try the simulator.</p>';
      return;
    }
    var html = '<table class="data-table"><thead><tr>' +
      "<th>Nametag</th><th>Pos</th><th>Archetype</th><th>Team</th><th>OVR</th><th>POT</th>" +
      "<th>Salary</th><th>Yrs</th><th>Status</th><th>Lineup</th><th></th>" +
      "</tr></thead><tbody>";
    list.forEach(function (p) {
      var t = p.teamId ? S.getTeam(p.teamId) : null;
      var status = p.retired ? "Retired" : p.isDraftProspect ? "Draft Pool" : p.startupDraftPool ? "Startup Draft Pool" : t ? "Rostered" : "Free Agent";
      html += "<tr>";
      html += "<td>" + U.escapeHtml(p.name) + "</td>";
      html += "<td>" + p.position + "</td>";
      html += "<td>" + U.escapeHtml(p.archetype || "") + "</td>";
      html += "<td>" + (t ? U.escapeHtml(t.abbr) : "&mdash;") + "</td>";
      html += '<td><strong>' + p.overall + "</strong></td>";
      html += "<td>" + p.potential + "</td>";
      html += "<td>" + U.formatMoney(p.salary) + "</td>";
      html += "<td>" + (p.contractYears != null ? p.contractYears : "&mdash;") + "</td>";
      html += '<td><span class="pill">' + status + "</span></td>";
      if (t && !p.retired && S.isManagedTeam(t.id)) {
        html += '<td><button class="btn btn-sm ' + (p.starter ? "btn-primary" : "") + '" data-action="toggle-starter" data-id="' + p.id + '">' +
          (p.starter ? "Starter" : "Bench") + "</button></td>";
      } else if (t && !p.retired) {
        html += '<td><span class="muted small" title="Only the team you manage can set lineups by hand — every other team auto-fills its best available players.">AI-managed</span></td>';
      } else {
        html += "<td>&mdash;</td>";
      }
      html += '<td class="row-actions">' +
        '<button class="btn btn-sm" data-action="edit-player" data-id="' + p.id + '">Edit</button>' +
        '<button class="btn btn-sm btn-danger" data-action="delete-player" data-id="' + p.id + '">Del</button>' +
        "</td>";
      html += "</tr>";
    });
    html += "</tbody></table>";
    html += '<p class="muted small">Lineup: click a rostered player\'s Starter/Bench button to set who plays. If a team doesn\'t have enough starters manually set at a position, the simulator automatically falls back to its best available players there — nothing breaks if you never touch this.</p>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-action="edit-player"]').forEach(function (b) {
      b.addEventListener("click", function () {
        showForm(S.getPlayer(b.dataset.id));
      });
    });
    wrap.querySelectorAll('[data-action="delete-player"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        if (p.teamId && !S.wouldMeetRosterMinimum(p.teamId, [p.id])) {
          alert("Can't delete " + p.name + " — that would drop " + (S.getTeam(p.teamId) || {}).name +
            " below the required 2F/2D/1G, " + S.ROSTER_MIN.total + "-player roster minimum. Trade or promote instead, or delete a different player.");
          return;
        }
        if (confirm('Delete "' + p.name + '"?')) {
          S.deletePlayer(p.id);
          renderTable();
          if (window.PHLApp) window.PHLApp.refresh();
        }
      });
    });
    wrap.querySelectorAll('[data-action="toggle-starter"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (p) S.updatePlayer(p.id, { starter: !p.starter });
        renderTable();
      });
    });
  }

  function wireStaticEvents() {
    container.querySelector("#filt-pool").addEventListener("change", function (e) {
      filters.pool = e.target.value;
      renderTable();
    });
    container.querySelector("#filt-division").addEventListener("change", function (e) {
      filters.division = e.target.value;
      renderTable();
    });
    container.querySelector("#filt-team").addEventListener("change", function (e) {
      filters.team = e.target.value;
      renderTable();
    });
    container.querySelector("#filt-position").addEventListener("change", function (e) {
      filters.position = e.target.value;
      renderTable();
    });
    container.querySelector('[data-action="new-player"]').addEventListener("click", function () {
      showForm(null);
    });
    container.querySelector('[data-action="gen-sample"]').addEventListener("click", function () {
      if (confirm("Generate a randomized sample roster for every team that currently has fewer than 10 players? This is meant for testing the simulator — you can edit or delete these players any time.")) {
        generateSampleRosters();
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      }
    });
  }

  function archetypeOptionsHtml(position, selected) {
    return U.archetypesFor(position).map(function (a) {
      return '<option value="' + U.escapeHtml(a.name) + '"' + (a.name === selected ? " selected" : "") + ">" + U.escapeHtml(a.name) + "</option>";
    }).join("");
  }

  function showForm(player) {
    var panel = container.querySelector("#player-form-panel");
    var isEdit = !!player;
    player = player || {
      id: "",
      name: "",
      position: "F",
      archetype: U.randomArchetype("F"),
      overall: 70,
      potential: 75,
      salary: U.salaryAsking(70, 75),
      contractYears: 2,
      teamId: "",
      isDraftProspect: false,
    };
    var teams = S.getTeams().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

    var html = '<div class="form-card">';
    html += "<h3>" + (isEdit ? "Edit Player" : "Add Player") + "</h3>";
    html += '<div class="form-grid">';
    html += '<label>Nametag<input type="text" id="pf-name" value="' + U.escapeHtml(player.name) + '"></label>';
    html += '<label>Position<select id="pf-position">' +
      '<option value="F"' + (player.position === "F" ? " selected" : "") + ">Forward</option>" +
      '<option value="D"' + (player.position === "D" ? " selected" : "") + ">Defense</option>" +
      '<option value="G"' + (player.position === "G" ? " selected" : "") + ">Goalie</option>" +
      "</select></label>";
    html += '<label>Archetype<select id="pf-archetype">' + archetypeOptionsHtml(player.position, player.archetype) + "</select></label>";
    html += '<label>Overall (1-99)<input type="number" id="pf-overall" min="1" max="99" value="' + player.overall + '"></label>';
    html += '<label>Potential (1-99)<input type="number" id="pf-potential" min="1" max="99" value="' + player.potential + '"></label>';
    html += '<label>Salary ($/yr)<input type="number" id="pf-salary" min="0" step="500" value="' + player.salary + '"></label>';
    html += '<label>Contract years<input type="number" id="pf-years" min="0" max="8" value="' + (player.contractYears != null ? player.contractYears : 2) + '"></label>';
    html += '<label>Team<select id="pf-team"><option value="">Free Agent</option>';
    teams.forEach(function (t) {
      html += '<option value="' + t.id + '"' + (player.teamId === t.id ? " selected" : "") + ">" + U.escapeHtml(t.name) + " (" + t.abbr + ")</option>";
    });
    html += "</select></label>";
    html += "</div>";
    html += '<p class="muted small">Age is tracked internally (PHL doesn\'t publish ages) and quietly drives skill decline after ~' + S.getSettings().declineStartAge + ' and retirement in the low-to-mid 30s — nothing to fill in here.</p>';
    html += '<div class="form-actions">';
    html += '<button class="btn" data-action="auto-salary">Auto Price from OVR/POT</button>';
    html += '<button class="btn btn-primary" data-action="save-player">' + (isEdit ? "Save" : "Add Player") + "</button>";
    html += '<button class="btn" data-action="cancel-player">Cancel</button>';
    html += "</div></div>";
    panel.innerHTML = html;

    panel.querySelector("#pf-position").addEventListener("change", function (e) {
      panel.querySelector("#pf-archetype").innerHTML = archetypeOptionsHtml(e.target.value, null);
    });
    panel.querySelector('[data-action="auto-salary"]').addEventListener("click", function () {
      var ovr = parseInt(panel.querySelector("#pf-overall").value, 10) || 60;
      var pot = parseInt(panel.querySelector("#pf-potential").value, 10) || ovr;
      panel.querySelector("#pf-salary").value = U.salaryAsking(ovr, pot);
    });
    panel.querySelector('[data-action="cancel-player"]').addEventListener("click", function () {
      panel.innerHTML = "";
    });
    panel.querySelector('[data-action="save-player"]').addEventListener("click", function () {
      var name = panel.querySelector("#pf-name").value.trim();
      if (!name) {
        alert("Player nametag is required.");
        return;
      }
      var position = panel.querySelector("#pf-position").value;
      var overall = U.clamp(parseInt(panel.querySelector("#pf-overall").value, 10) || 60, 1, 99);
      var potential = U.clamp(parseInt(panel.querySelector("#pf-potential").value, 10) || overall, 1, 99);
      if (potential < overall) potential = overall; // potential is a ceiling, never below current overall
      var archetype = panel.querySelector("#pf-archetype").value;
      var patch = {
        name: name,
        position: position,
        archetype: archetype,
        overall: overall,
        potential: potential,
        attributes: U.deriveAttributes(overall, position, archetype),
        salary: parseFloat(panel.querySelector("#pf-salary").value) || 0,
        contractYears: parseInt(panel.querySelector("#pf-years").value, 10) || 0,
        teamId: panel.querySelector("#pf-team").value || null,
        isDraftProspect: false,
      };
      if (isEdit) {
        S.updatePlayer(player.id, patch);
      } else {
        patch.stats = S.freshStatLine();
        patch.age = U.generateStartingAge();
        patch.retirementAge = U.retirementAgeFor(patch.age);
        S.addPlayer(patch);
      }
      panel.innerHTML = "";
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  // ---- Sample roster generator (demo/testing data, clearly separate from
  // the user's own database) ----
  function generateSampleRosters() {
    var teams = S.getTeams();
    teams.forEach(function (t) {
      var existing = S.getRoster(t.id).length;
      if (existing >= 10) return;
      var need = { F: 5, D: 4, G: 2 };
      var existingRoster = S.getRoster(t.id);
      ["F", "D", "G"].forEach(function (pos) {
        var have = existingRoster.filter(function (p) { return p.position === pos; }).length;
        for (var i = have; i < need[pos]; i++) {
          addGeneratedPlayer(t.id, pos);
        }
      });
    });
  }

  function addGeneratedPlayer(teamId, position) {
    var overall = U.randInt(52, 88);
    var potential = U.clamp(overall + U.randInt(0, 14), overall, 99);
    var archetype = U.randomArchetype(position);
    var age = U.generateStartingAge();
    var player = {
      name: U.randomName(),
      position: position,
      archetype: archetype,
      overall: overall,
      potential: potential,
      attributes: U.deriveAttributes(overall, position, archetype),
      salary: U.salaryAsking(overall, potential),
      contractYears: U.randInt(1, 4),
      teamId: teamId,
      isDraftProspect: false,
      age: age,
      retirementAge: U.retirementAgeFor(age),
      stats: S.freshStatLine(),
    };
    S.addPlayer(player);
  }

  window.PHLPlayers = {
    render: render,
    generateSampleRosters: generateSampleRosters,
    addGeneratedPlayer: addGeneratedPlayer,
  };
})();
