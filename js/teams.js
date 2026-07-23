/* PHL Franchise Simulator — Teams & Divisions editor
 * Global namespace: window.PHLTeams
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  function render(el) {
    container = el || container;
    if (!container) return;

    var divisions = S.getDivisions().slice().sort(function (a, b) {
      return b.tier - a.tier;
    });
    var html = "";
    html += '<div class="panel-header"><h2>Divisions &amp; Teams</h2>' +
      '<div class="header-actions">' +
      '<button class="btn btn-primary" data-action="new-team">+ Add Team</button>' +
      "</div></div>";
    html += '<p class="muted small">"+ Add Team" is a plain league-building tool (AI-controlled, for filling out divisions) ' +
      '— it does not change who you manage. Expansion Franchises are chosen once, at save creation (see the ' +
      '<a href="create-save.html">Create Save</a> page), not added mid-save. Click any team name to see its full roster ' +
      'and stats. Playoff cutoffs are always "top N by standings," so a newly added team that finishes outside a ' +
      "division's playoff line just misses out, same as any other team.</p>";

    divisions.forEach(function (div) {
      var teams = S.getTeams(div.id).slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      var playoffCfg = (div.playoff && div.playoff.teams) ? div.playoff : { teams: S.getSettings().playoffTeamsPerDivision || 4, byes: S.getSettings().playoffTeamsPerDivision || 4 };
      var playoffNote = playoffCfg.byes < playoffCfg.teams
        ? "Playoffs: top " + playoffCfg.teams + " (" + playoffCfg.byes + " bye + wild card)"
        : "Playoffs: top " + playoffCfg.teams;
      html += '<div class="division-block">';
      html += '<h3 class="division-title">' + U.escapeHtml(div.name) +
        ' <span class="muted">Division &middot; Tier ' + div.tier +
        ' &middot; Cap ' + U.formatMoney(div.salaryCap) +
        ' &middot; ' + playoffNote + '</span></h3>';
      if (!teams.length) {
        html += '<p class="muted">No teams yet in this division.</p>';
      } else {
        html += '<div class="team-grid">';
        teams.forEach(function (t) {
          var roster = S.getRoster(t.id);
          var used = S.capUsed(t.id);
          var cap = S.capForTeam(t.id);
          var pct = U.clamp((used / cap) * 100, 0, 100);
          html += '<div class="team-card" style="--accent:' + U.colorForId(t.id) + '">';
          html += '<div class="team-card-head">';
          html += '<span class="team-badge">' + U.escapeHtml(t.abbr) + '</span>';
          html += '<span class="team-name team-name-link" data-action="view-team" data-id="' + t.id + '" role="button" tabindex="0">' + U.escapeHtml(t.name) + '</span>';
          if (S.isManagedTeam(t.id)) html += '<span class="pill pill-accent">GM</span>';
          if (t.isExpansionTeam) html += '<span class="pill" title="Created at save creation as an Expansion Franchise">Expansion</span>';
          html += '</div>';
          html += '<div class="team-card-stats">' +
            roster.length + ' players &middot; ' +
            t.wins + '-' + t.losses + '-' + t.otLosses +
            ' &middot; ' + t.points + ' pts</div>';
          html += '<div class="cap-bar' + (used > cap ? ' cap-over' : '') + '"><div class="cap-bar-fill" style="width:' + pct + '%"></div></div>';
          html += '<div class="team-card-cap muted">Cap: ' + U.formatMoney(used) + ' / ' + U.formatMoney(cap) + (used > cap ? ' <span class="pill pill-warn">over</span>' : '') + '</div>';
          html += '<div class="team-card-actions">';
          html += '<button class="btn btn-sm" data-action="edit-team" data-id="' + t.id + '">Edit</button>';
          html += '<button class="btn btn-sm btn-danger" data-action="delete-team" data-id="' + t.id + '">Delete</button>';
          html += '</div></div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });

    html += '<div id="team-form-panel"></div>';
    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    container.querySelectorAll('[data-action="new-team"]').forEach(function (b) {
      b.addEventListener("click", function () {
        showForm(null);
      });
    });
    container.querySelectorAll('[data-action="view-team"]').forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.PHLApp) window.PHLApp.showTeamDetail(b.dataset.id);
      });
    });
    container.querySelectorAll('[data-action="edit-team"]').forEach(function (b) {
      b.addEventListener("click", function () {
        showForm(S.getTeam(b.dataset.id));
      });
    });
    container.querySelectorAll('[data-action="delete-team"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var t = S.getTeam(b.dataset.id);
        if (!t) return;
        if (confirm('Delete "' + t.name + '"? Rostered players become free agents.')) {
          S.deleteTeam(t.id);
          render();
          if (window.PHLApp) window.PHLApp.refresh();
        }
      });
    });
  }

  function showForm(team) {
    var panel = container.querySelector("#team-form-panel");
    var divisions = S.getDivisions();
    var isEdit = !!team;
    team = team || { id: "", name: "", abbr: "", division: divisions[0].id };

    var html = '<div class="form-card">';
    html += "<h3>" + (isEdit ? "Edit Team" : "Add Team") + "</h3>";
    html += '<label>Team name<input type="text" id="f-name" value="' + U.escapeHtml(team.name) + '" placeholder="e.g. Denver Drift"></label>';
    html += '<label>Abbreviation<input type="text" id="f-abbr" maxlength="4" value="' + U.escapeHtml(team.abbr) + '" placeholder="DEN"></label>';
    html += '<label>Division<select id="f-division">';
    divisions.forEach(function (d) {
      html += '<option value="' + d.id + '"' + (team.division === d.id ? " selected" : "") + ">" + U.escapeHtml(d.name) + "</option>";
    });
    html += "</select></label>";
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary" data-action="save-team">' + (isEdit ? "Save" : "Add Team") + "</button>";
    html += '<button class="btn" data-action="cancel-team">Cancel</button>';
    html += "</div></div>";
    panel.innerHTML = html;

    panel.querySelector('[data-action="cancel-team"]').addEventListener("click", function () {
      panel.innerHTML = "";
    });
    panel.querySelector('[data-action="save-team"]').addEventListener("click", function () {
      var name = panel.querySelector("#f-name").value.trim();
      var abbr = panel.querySelector("#f-abbr").value.trim().toUpperCase();
      var division = panel.querySelector("#f-division").value;
      if (!name) {
        alert("Team name is required.");
        return;
      }
      if (!abbr) abbr = name.slice(0, 3).toUpperCase();
      if (isEdit) {
        S.updateTeam(team.id, { name: name, abbr: abbr, division: division });
      } else {
        S.addTeam({ name: name, abbr: abbr, division: division });
      }
      panel.innerHTML = "";
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  window.PHLTeams = { render: render };
})();
