/* PHL Franchise Simulator — Players database (browse-only)
 * Global namespace: window.PHLPlayers
 *
 * A read-only browser of every player in the league — filter by pool,
 * division, team, or position, set your own team's starters, or delete a
 * player outright. Manually editing a player's stats (Overall, Potential,
 * Salary, etc.) is not possible — every player's numbers come from the
 * real roster sweep, the Startup Draft, breakout rookie generation, or
 * "Generate Sample Roster", never hand-typed, so results stay honest to
 * the simulator's own math.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var filters = { division: "", team: "", position: "", pool: "roster", search: "" };

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
      "</div></div>";
    html += '<p class="muted small">Browse-only — player stats aren\'t hand-editable. Every number here comes from the real roster sweep, the Startup Draft, breakout rookie generation, or the sample-roster generator.</p>';

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
    html += '<input type="search" id="filt-search" class="filt-search" placeholder="Search by name&hellip;" value="' + U.escapeHtml(filters.search) + '">';
    html += "</div>";

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
    if (filters.search.trim()) {
      var q = filters.search.trim().toLowerCase();
      list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
    }
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
        '<button class="btn btn-sm btn-danger" data-action="delete-player" data-id="' + p.id + '">Del</button>' +
        "</td>";
      html += "</tr>";
    });
    html += "</tbody></table>";
    html += '<p class="muted small">Lineup: click a rostered player\'s Starter/Bench button to set who plays. If a team doesn\'t have enough starters manually set at a position, the simulator automatically falls back to its best available players there — nothing breaks if you never touch this.</p>';
    wrap.innerHTML = html;

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
    container.querySelector("#filt-search").addEventListener("input", function (e) {
      filters.search = e.target.value;
      renderTable();
    });
    container.querySelector('[data-action="gen-sample"]').addEventListener("click", function () {
      if (confirm("Generate a randomized sample roster for every team that currently has fewer than 10 players? This is meant for testing the simulator — you can edit or delete these players any time.")) {
        generateSampleRosters();
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      }
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
    var potential = U.rollPotential(overall);
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
