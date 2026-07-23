/* PHL Franchise Simulator — Players editor (roster database)
 * Global namespace: window.PHLPlayers
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
    html += '<select id="filt-pool"><option value="roster">On a Team</option><option value="fa">Free Agents</option><option value="pool">Draft Pool</option><option value="all">All Players</option></select>';
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
    html += '<select id="filt-position"><option value="">All Positions</option><option value="F">Forward</option><option value="D">Defender</option><option value="G">Goalie</option></select>';
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
    if (filters.pool === "roster") list = list.filter(function (p) { return !!p.teamId; });
    else if (filters.pool === "fa") list = list.filter(function (p) { return !p.teamId && !p.isDraftProspect; });
    else if (filters.pool === "pool") list = list.filter(function (p) { return !!p.isDraftProspect; });
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
      "<th>Name</th><th>Pos</th><th>Team</th><th>Age</th><th>OVR</th>" +
      "<th>OFF</th><th>DEF</th><th>G</th><th>Salary</th><th>Yrs</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>";
    list.forEach(function (p) {
      var t = p.teamId ? S.getTeam(p.teamId) : null;
      var status = p.isDraftProspect ? "Draft Pool" : t ? "Rostered" : "Free Agent";
      html += "<tr>";
      html += "<td>" + U.escapeHtml(p.name) + "</td>";
      html += "<td>" + p.position + "</td>";
      html += "<td>" + (t ? U.escapeHtml(t.abbr) : "&mdash;") + "</td>";
      html += "<td>" + (p.age || "&mdash;") + "</td>";
      html += '<td><strong>' + p.overall + "</strong></td>";
      html += "<td>" + p.attributes.offense + "</td>";
      html += "<td>" + p.attributes.defense + "</td>";
      html += "<td>" + (p.position === "G" ? p.attributes.goaltending : "&mdash;") + "</td>";
      html += "<td>" + U.round1(p.salary) + "</td>";
      html += "<td>" + (p.contractYears != null ? p.contractYears : "&mdash;") + "</td>";
      html += '<td><span class="pill">' + status + "</span></td>";
      html += '<td class="row-actions">' +
        '<button class="btn btn-sm" data-action="edit-player" data-id="' + p.id + '">Edit</button>' +
        '<button class="btn btn-sm btn-danger" data-action="delete-player" data-id="' + p.id + '">Del</button>' +
        "</td>";
      html += "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-action="edit-player"]').forEach(function (b) {
      b.addEventListener("click", function () {
        showForm(S.getPlayer(b.dataset.id));
      });
    });
    wrap.querySelectorAll('[data-action="delete-player"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (p && confirm('Delete "' + p.name + '"?')) {
          S.deletePlayer(p.id);
          renderTable();
          if (window.PHLApp) window.PHLApp.refresh();
        }
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

  function showForm(player) {
    var panel = container.querySelector("#player-form-panel");
    var isEdit = !!player;
    player = player || {
      id: "",
      name: "",
      position: "F",
      age: 24,
      overall: 70,
      attributes: { offense: 70, defense: 65, goaltending: 40 },
      salary: U.salaryForOverall(70),
      contractYears: 2,
      teamId: "",
      isDraftProspect: false,
    };
    var teams = S.getTeams().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

    var html = '<div class="form-card">';
    html += "<h3>" + (isEdit ? "Edit Player" : "Add Player") + "</h3>";
    html += '<div class="form-grid">';
    html += '<label>Name<input type="text" id="pf-name" value="' + U.escapeHtml(player.name) + '"></label>';
    html += '<label>Position<select id="pf-position">' +
      '<option value="F"' + (player.position === "F" ? " selected" : "") + ">Forward</option>" +
      '<option value="D"' + (player.position === "D" ? " selected" : "") + ">Defender</option>" +
      '<option value="G"' + (player.position === "G" ? " selected" : "") + ">Goalie</option>" +
      "</select></label>";
    html += '<label>Age<input type="number" id="pf-age" min="16" max="45" value="' + player.age + '"></label>';
    html += '<label>Overall (40-99)<input type="number" id="pf-overall" min="40" max="99" value="' + player.overall + '"></label>';
    html += '<label>Offense (40-99)<input type="number" id="pf-offense" min="40" max="99" value="' + player.attributes.offense + '"></label>';
    html += '<label>Defense (40-99)<input type="number" id="pf-defense" min="40" max="99" value="' + player.attributes.defense + '"></label>';
    html += '<label>Goaltending (40-99)<input type="number" id="pf-goaltending" min="40" max="99" value="' + player.attributes.goaltending + '"></label>';
    html += '<label>Salary (cap units)<input type="number" id="pf-salary" min="0" step="0.5" value="' + player.salary + '"></label>';
    html += '<label>Contract years<input type="number" id="pf-years" min="0" max="8" value="' + (player.contractYears != null ? player.contractYears : 2) + '"></label>';
    html += '<label>Team<select id="pf-team"><option value="">Free Agent</option>';
    teams.forEach(function (t) {
      html += '<option value="' + t.id + '"' + (player.teamId === t.id ? " selected" : "") + ">" + U.escapeHtml(t.name) + " (" + t.abbr + ")</option>";
    });
    html += "</select></label>";
    html += "</div>";
    html += '<p class="muted">Tip: click "Auto" to set salary from the overall rating using the league\'s standard curve.</p>';
    html += '<div class="form-actions">';
    html += '<button class="btn" data-action="auto-salary">Auto Salary</button>';
    html += '<button class="btn btn-primary" data-action="save-player">' + (isEdit ? "Save" : "Add Player") + "</button>";
    html += '<button class="btn" data-action="cancel-player">Cancel</button>';
    html += "</div></div>";
    panel.innerHTML = html;

    panel.querySelector('[data-action="auto-salary"]').addEventListener("click", function () {
      var ovr = parseInt(panel.querySelector("#pf-overall").value, 10) || 60;
      panel.querySelector("#pf-salary").value = U.salaryForOverall(ovr);
    });
    panel.querySelector('[data-action="cancel-player"]').addEventListener("click", function () {
      panel.innerHTML = "";
    });
    panel.querySelector('[data-action="save-player"]').addEventListener("click", function () {
      var name = panel.querySelector("#pf-name").value.trim();
      if (!name) {
        alert("Player name is required.");
        return;
      }
      var patch = {
        name: name,
        position: panel.querySelector("#pf-position").value,
        age: parseInt(panel.querySelector("#pf-age").value, 10) || null,
        overall: U.clamp(parseInt(panel.querySelector("#pf-overall").value, 10) || 60, 40, 99),
        attributes: {
          offense: U.clamp(parseInt(panel.querySelector("#pf-offense").value, 10) || 60, 40, 99),
          defense: U.clamp(parseInt(panel.querySelector("#pf-defense").value, 10) || 60, 40, 99),
          goaltending: U.clamp(parseInt(panel.querySelector("#pf-goaltending").value, 10) || 40, 40, 99),
        },
        salary: parseFloat(panel.querySelector("#pf-salary").value) || 0,
        contractYears: parseInt(panel.querySelector("#pf-years").value, 10) || 0,
        teamId: panel.querySelector("#pf-team").value || null,
        isDraftProspect: false,
      };
      if (isEdit) {
        S.updatePlayer(player.id, patch);
      } else {
        patch.stats = S.freshStatLine();
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
    var offense = U.clamp(overall + U.randInt(-8, 8) + (position === "F" ? 4 : -2), 40, 99);
    var defense = U.clamp(overall + U.randInt(-8, 8) + (position === "D" ? 4 : -2), 40, 99);
    var goaltending = position === "G" ? U.clamp(overall + U.randInt(-6, 6), 40, 99) : 40;
    var player = {
      name: U.randomName(),
      position: position,
      age: U.randInt(18, 34),
      overall: overall,
      attributes: { offense: offense, defense: defense, goaltending: goaltending },
      salary: U.salaryForOverall(overall),
      contractYears: U.randInt(1, 4),
      teamId: teamId,
      isDraftProspect: false,
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
