/* PHL Franchise Simulator — Expansion Franchise
 * Global namespace: window.PHLExpansion
 *
 * Lets the GM add a brand-new team to any division mid-save and take it
 * over as their new managed franchise (their old team hands off to AI
 * control — see js/aiManager.js). The new team then runs its own solo
 * Expansion Draft: 6 rounds (vs. the one-time Startup Draft's 8), picking
 * one player per round from the current free-agent pool to build a roster
 * from scratch. Renders inline inside the Teams tab whenever an expansion
 * draft is active — see teams.js.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var posFilter = "";

  function startExpansionFranchise(name, abbr, divisionId) {
    var team = S.addTeam({ name: name, abbr: abbr, division: divisionId });
    S.setFranchise(divisionId, team.id);
    var rounds = S.getSettings().expansionDraftRounds || 6;
    S.setExpansionDraft({
      status: "active",
      teamId: team.id,
      round: 1,
      totalRounds: rounds,
      picks: [],
    });
    return team;
  }

  function isActive() {
    var ed = S.getExpansionDraft();
    return !!(ed && ed.status === "active");
  }

  function pool() {
    return S.getFreeAgents().slice().sort(function (a, b) { return b.overall - a.overall; });
  }

  function makePick(playerId) {
    var ed = S.getExpansionDraft();
    if (!ed || ed.status !== "active") return;
    var player = S.getPlayer(playerId);
    if (!player || player.teamId) return;
    S.updatePlayer(playerId, { teamId: ed.teamId, contractYears: player.contractYears || 2, eligibleDivisions: null });
    ed.picks.push({ round: ed.round, teamId: ed.teamId, playerId: playerId });
    if (ed.round >= ed.totalRounds) {
      S.updateExpansionDraft({ status: "complete", picks: ed.picks });
    } else {
      S.updateExpansionDraft({ round: ed.round + 1, picks: ed.picks });
    }
  }

  function finishNow() {
    S.setExpansionDraft(null);
  }

  // ---------------- Rendering (called from teams.js) ----------------
  function renderNewFranchiseForm(container) {
    var divisions = S.getDivisions();
    var html = '<div class="form-card">';
    html += "<h3>Add Expansion Franchise</h3>";
    html += '<p class="muted small">Creates a new team, hands your current team off to AI control, and puts you in charge of this one instead. ' +
      "You'll immediately draft its roster from scratch: " + (S.getSettings().expansionDraftRounds || 6) + " rounds, one pick at a time, from the current free-agent pool.</p>";
    html += '<label>Team name<input type="text" id="ex-name" placeholder="e.g. Denver Drift"></label>';
    html += '<label>Abbreviation<input type="text" id="ex-abbr" maxlength="4" placeholder="DEN"></label>';
    html += '<label>Division<select id="ex-division">';
    divisions.forEach(function (d) { html += '<option value="' + d.id + '">' + U.escapeHtml(d.name) + "</option>"; });
    html += "</select></label>";
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary" data-action="confirm-expansion">Create &amp; Draft Roster</button>';
    html += '<button class="btn" data-action="cancel-expansion">Cancel</button>';
    html += "</div></div>";
    container.innerHTML = html;

    container.querySelector('[data-action="cancel-expansion"]').addEventListener("click", function () {
      container.innerHTML = "";
    });
    container.querySelector('[data-action="confirm-expansion"]').addEventListener("click", function () {
      var name = container.querySelector("#ex-name").value.trim();
      var abbr = container.querySelector("#ex-abbr").value.trim().toUpperCase() || name.slice(0, 3).toUpperCase();
      var division = container.querySelector("#ex-division").value;
      if (!name) { alert("Team name is required."); return; }
      if (!confirm('Take over "' + name + '" as your new managed franchise? Your current team becomes AI-controlled.')) return;
      startExpansionFranchise(name, abbr, division);
      if (window.PHLApp) window.PHLApp.refreshAll();
      window.PHLTeams.render();
    });
  }

  function renderDraftUI(container) {
    var ed = S.getExpansionDraft();
    var team = S.getTeam(ed.teamId);
    var html = '<div class="panel-header"><h2>Expansion Draft — ' + U.escapeHtml(team ? team.name : "?") + "</h2></div>";
    html += '<div class="action-row"><span class="pill pill-accent">Round ' + ed.round + " of " + ed.totalRounds + "</span>" +
      '<span class="muted">' + S.getRoster(ed.teamId).length + " players drafted so far</span></div>";

    html += '<div class="filter-bar"><select id="ex-pos-filter">' +
      '<option value="">All Positions</option><option value="F">Forward</option><option value="D">Defense</option><option value="G">Goalie</option>' +
      "</select></div>";

    var list = pool();
    if (posFilter) list = list.filter(function (p) { return p.position === posFilter; });
    if (!list.length) {
      html += '<p class="muted">No free agents available to draft right now — try again after some roster movement, or finish up early.</p>';
      html += '<button class="btn btn-danger" data-action="end-expansion-draft">End Draft Now</button>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th></th></tr></thead><tbody>';
      list.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td><strong>" + p.overall + "</strong></td>" +
          "<td>" + p.potential + "</td>" +
          '<td><button class="btn btn-sm btn-primary" data-action="expansion-pick" data-id="' + p.id + '">Draft</button></td></tr>';
      });
      html += "</tbody></table>";
    }

    if (ed.picks.length) {
      html += '<h3>Your Picks</h3><table class="data-table"><thead><tr><th>Rd</th><th>Player</th><th>Pos</th><th>OVR</th></tr></thead><tbody>';
      ed.picks.slice().reverse().forEach(function (pick) {
        var p = S.getPlayer(pick.playerId);
        html += "<tr><td>" + pick.round + "</td><td>" + U.escapeHtml(p ? p.name : "?") + "</td><td>" + (p ? p.position : "") + "</td><td>" + (p ? p.overall : "") + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    var posSel = container.querySelector("#ex-pos-filter");
    if (posSel) {
      posSel.value = posFilter;
      posSel.addEventListener("change", function (e) {
        posFilter = e.target.value;
        renderDraftUI(container);
      });
    }
    container.querySelectorAll('[data-action="expansion-pick"]').forEach(function (b) {
      b.addEventListener("click", function () {
        makePick(b.dataset.id);
        if (window.PHLApp) window.PHLApp.refreshAll();
        var stillActive = isActive();
        window.PHLTeams.render();
        if (!stillActive) alert("Expansion Draft complete — " + (team ? team.name : "your new team") + "'s roster is set. Head to Players to set your starting lineup.");
      });
    });
    var end = container.querySelector('[data-action="end-expansion-draft"]');
    if (end) end.addEventListener("click", function () {
      if (confirm("End the Expansion Draft now? Any remaining rounds are skipped and the team keeps whatever roster it has.")) {
        finishNow();
        if (window.PHLApp) window.PHLApp.refreshAll();
        window.PHLTeams.render();
      }
    });
  }

  window.PHLExpansion = {
    isActive: isActive,
    renderNewFranchiseForm: renderNewFranchiseForm,
    renderDraftUI: renderDraftUI,
    startExpansionFranchise: startExpansionFranchise,
  };
})();
