/* PHL Franchise Simulator — off-season inter-division promotions (call-ups)
 * Global namespace: window.PHLPromotions
 *
 * During the off-season, a manager can call a player up from any strictly
 * lower-tier division onto their own roster — permanent, no negotiation.
 * There's a league-set "call-up fee" (same valuation formula used for free
 * agent asking prices) that must fit in the acquiring team's cap space
 * alongside the player's own (freshly recalculated) salary at the moment
 * of the move — a stand-in for "compensation," since this sim tracks
 * salary cap space rather than a separate team cash balance.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var selectedTeamId = null;

  function isOffseasonWindow() {
    return S.getSeason().phase === "offseason";
  }

  function lowerDivisionIds(teamDivisionId) {
    var divisions = S.getDivisions();
    var actingTier = (S.getDivision(teamDivisionId) || {}).tier;
    if (actingTier == null) return [];
    return divisions.filter(function (d) { return d.tier < actingTier; }).map(function (d) { return d.id; });
  }

  function eligiblePlayers(teamId) {
    var team = S.getTeam(teamId);
    if (!team) return [];
    var lowerDivIds = lowerDivisionIds(team.division);
    if (!lowerDivIds.length) return [];
    return S.getPlayers().filter(function (p) {
      if (!p.teamId || p.retired) return false;
      var pt = S.getTeam(p.teamId);
      return pt && lowerDivIds.indexOf(pt.division) !== -1;
    });
  }

  function callUpFee(player) {
    return U.salaryAsking(player.overall, player.potential);
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Promotions</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first — Promotions only works for the team you manage.</p>';
      return;
    }
    selectedTeamId = franchise.teamId;
    var team = S.getTeam(selectedTeamId);
    if (!team) {
      container.innerHTML = '<div class="panel-header"><h2>Promotions</h2></div><p class="muted">Your managed team couldn\'t be found.</p>';
      return;
    }
    var division = S.getDivision(team.division);

    var html = '<div class="panel-header"><h2>Promotions</h2></div>';
    html += '<p class="muted">Off-season only: call a player up permanently from any lower-tier division onto ' +
      U.escapeHtml(team.name) + "'s roster. There's no negotiation — a league-set call-up fee (based on the player's " +
      "Overall/Potential) has to fit in your cap space alongside their new salary, or the move doesn't go through. " +
      "You can only manage promotions for the team you GM — every other team handles its own moves automatically.</p>";

    if (!isOffseasonWindow()) {
      html += '<div class="warning-banner">Promotions are only available in the off-season. Current phase: <strong>' + U.escapeHtml(capitalize(S.getSeason().phase || "offseason")) + "</strong>.</div>";
    }

    var cap = S.capForTeam(selectedTeamId);
    var used = S.capUsed(selectedTeamId);
    var space = S.capSpace(selectedTeamId);
    var pct = U.clamp((used / cap) * 100, 0, 100);
    html += '<div class="cap-summary-card" style="--accent:' + U.colorForId(team.id) + '">';
    html += '<div class="team-card-head">' + U.crestHtml(team) + '<span class="team-name">' + U.escapeHtml(team.name) +
      '</span><span class="pill">' + U.escapeHtml(division.name) + " budget</span></div>";
    html += '<div class="cap-bar cap-bar-lg' + (space < 0 ? " cap-over" : "") + '"><div class="cap-bar-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="muted">Cap Used: ' + U.formatMoney(used) + " / " + U.formatMoney(cap) + " &middot; Space: " + U.formatMoney(space) + "</div>";
    html += "</div>";

    var pool = eligiblePlayers(selectedTeamId).slice().sort(function (a, b) { return b.overall - a.overall; });
    html += "<h3>Eligible Players From Lower Divisions (" + pool.length + ")</h3>";
    if (!lowerDivisionIds(team.division).length) {
      html += '<p class="muted">' + U.escapeHtml(team.name) + " is already in the lowest division — there's nothing below it to call up from.</p>";
    } else if (!pool.length) {
      html += '<p class="muted">No rostered players in a lower division right now.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Current Team</th><th>New Salary</th><th>Call-Up Fee</th><th></th></tr></thead><tbody>';
      pool.forEach(function (p) {
        var pt = S.getTeam(p.teamId);
        var fee = callUpFee(p);
        var newSalary = fee; // same valuation formula drives both
        var totalCost = fee + newSalary;
        var affordable = totalCost <= space;
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td><strong>" + p.overall + "</strong></td><td>" + p.potential + "</td>";
        html += "<td>" + U.escapeHtml(pt ? pt.name : "?") + " <span class=\"muted\">(" + U.escapeHtml(S.getDivision(pt.division).name) + ")</span></td>";
        html += "<td>" + U.formatMoney(newSalary) + "</td><td>" + U.formatMoney(fee) + "</td>";
        if (!isOffseasonWindow()) {
          html += '<td><span class="pill pill-warn">Off-season only</span></td></tr>';
        } else if (!affordable) {
          html += '<td><span class="pill pill-warn" title="Needs ' + U.formatMoney(totalCost) + ' in cap space (salary + fee)">Not enough cap</span></td></tr>';
        } else {
          html += '<td><button class="btn btn-sm btn-primary" data-action="promote" data-id="' + p.id + '">Call Up</button></td></tr>';
        }
      });
      html += "</tbody></table>";
    }

    var history = S.getPromotions().slice().reverse();
    if (history.length) {
      html += "<h3>Promotion History</h3><table class=\"data-table\"><thead><tr><th>Season</th><th>Player</th><th>From</th><th>To</th><th>Fee</th></tr></thead><tbody>";
      history.slice(0, 20).forEach(function (entry) {
        var p = S.getPlayer(entry.playerId);
        var fromTeam = S.getTeam(entry.fromTeamId);
        var toTeam = S.getTeam(entry.toTeamId);
        html += "<tr><td>" + entry.season + "</td><td>" + U.escapeHtml(p ? p.name : "?") + "</td><td>" + U.escapeHtml(fromTeam ? fromTeam.abbr : "?") + "</td><td>" + U.escapeHtml(toTeam ? toTeam.abbr : "?") + "</td><td>" + U.formatMoney(entry.fee) + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function promotePlayer(playerId, toTeamId) {
    var player = S.getPlayer(playerId);
    var toTeam = S.getTeam(toTeamId);
    if (!player || !toTeam || !player.teamId) return false;
    if (!isOffseasonWindow()) {
      alert("Promotions are only available in the off-season.");
      return false;
    }
    var fromTeamId = player.teamId;
    // Defense in depth: an AI-initiated call-up (toTeamId !== the human's
    // team) must never pull a player off the human GM's own roster — only
    // the human decides what happens to their own contracts. (The AI
    // candidate pool is already filtered upstream in aiManager.js; this
    // guard just makes sure nothing can slip through that path.)
    if (fromTeamId === S.getFranchise().teamId && toTeamId !== S.getFranchise().teamId) {
      return false;
    }
    var fromTeam = S.getTeam(fromTeamId);
    var lowerDivIds = lowerDivisionIds(toTeam.division);
    if (!fromTeam || lowerDivIds.indexOf(fromTeam.division) === -1) {
      // Enforce the same strictly-lower-tier rule the UI uses to build the
      // eligible list — don't just trust the caller. Prevents same-tier or
      // reverse (higher-to-lower) "promotions" from ever slipping through.
      alert(player.name + " isn't eligible to be called up to " + toTeam.name + " (not in a lower division).");
      return false;
    }
    var fee = callUpFee(player);
    var newSalary = fee;
    var totalCost = fee + newSalary;
    var space = S.capSpace(toTeamId);
    if (totalCost > space) {
      alert("Not enough cap space to call up " + player.name + " (needs " + U.formatMoney(totalCost) + " — salary + call-up fee — but only " + U.formatMoney(space) + " is available).");
      return false;
    }
    var roster = S.getRoster(toTeamId);
    if (roster.length >= S.getSettings().rosterMax) {
      alert("Roster is full (" + S.getSettings().rosterMax + " players). Release someone first.");
      return false;
    }
    S.updatePlayer(playerId, { teamId: toTeamId, salary: newSalary, contractYears: 3, starter: false });
    S.addPromotion({
      season: S.getSeason().seasonNumber || 1,
      fromTeamId: fromTeamId,
      toTeamId: toTeamId,
      playerId: playerId,
      fee: fee,
    });
    return true;
  }

  function wireEvents() {
    container.querySelectorAll('[data-action="promote"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        if (confirm("Call up " + p.name + " to " + S.getTeam(selectedTeamId).name + " permanently for " + U.formatMoney(callUpFee(p)) + "?")) {
          if (promotePlayer(p.id, selectedTeamId)) {
            render();
            if (window.PHLApp) window.PHLApp.refresh();
          }
        }
      });
    });
  }

  window.PHLPromotions = {
    render: render,
    promotePlayer: promotePlayer,
    isOffseasonWindow: isOffseasonWindow,
    eligiblePlayers: eligiblePlayers,
    lowerDivisionIds: lowerDivisionIds,
    callUpFee: callUpFee,
  };
})();
