/* PHL Franchise Simulator — contracts & salary cap management
 * Global namespace: window.PHLContracts
 *
 * Negotiation model: every player (rostered or free agent) has an Asking
 * Price computed from their Overall/Potential, how they've actually
 * performed this season, and the paying division's tier (see
 * U.contractAskingPrice). You choose a contract length (1-5 years) and an
 * offer amount; players almost always accept a fair-or-better offer, but
 * the further you lowball them the more likely they turn it down (see
 * U.contractRejectChance). A rejected offer changes nothing — try again
 * with better terms, or move on.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var selectedTeamId = null;
  // Transient negotiation UI state — which player's offer panel is open,
  // and the length/amount currently dialed in. Reset whenever a panel
  // closes or a deal resolves.
  var offer = { playerId: null, years: 2, amount: 0 };

  function isEligible(player, divisionId) {
    if (!player.eligibleDivisions || !player.eligibleDivisions.length) return true;
    return player.eligibleDivisions.indexOf(divisionId) !== -1;
  }

  function askingPriceFor(player, team) {
    var division = S.getDivision(team.division);
    return U.contractAskingPrice(player, division ? division.tier : null);
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first — you can only manage contracts for the team you GM. (Want to browse another team\'s roster? See the Teams tab.)</p>';
      return;
    }
    selectedTeamId = franchise.teamId;
    var team = S.getTeam(selectedTeamId);
    if (!team) {
      container.innerHTML = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div><p class="muted">Your managed team couldn\'t be found.</p>';
      return;
    }
    var cap = S.capForTeam(selectedTeamId);
    var used = S.capUsed(selectedTeamId);
    var space = S.capSpace(selectedTeamId);
    var pct = U.clamp((used / cap) * 100, 0, 100);
    var roster = S.getRoster(selectedTeamId).slice().sort(function (a, b) { return b.overall - a.overall; });

    var html = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div>';
    html += '<p class="muted small">You can only manage contracts for the team you GM. Every other team signs, releases and re-signs on its own — and can never touch your roster. ' +
      'Asking price reflects Overall/Potential, this season\'s actual performance, and the division\'s pay scale. Offer below it and there\'s a real chance the player says no.</p>';

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
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Salary</th><th>Years Left</th><th>Asking Price</th><th></th></tr></thead><tbody>';
      roster.forEach(function (p) {
        var asking = askingPriceFor(p, team);
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td>" + p.overall + "</td><td>" + p.potential + "</td><td>" + U.formatMoney(p.salary) + "</td>";
        html += "<td>" + (p.contractYears <= 1 ? '<span class="pill pill-warn">' + p.contractYears + " (expiring)</span>" : p.contractYears) + "</td>";
        html += "<td>" + U.formatMoney(asking) + "</td>";
        html += '<td class="row-actions"><button class="btn btn-sm" data-action="toggle-offer" data-mode="resign" data-id="' + p.id + '">Re-sign</button>' +
          '<button class="btn btn-sm btn-danger" data-action="release" data-id="' + p.id + '">Release</button></td></tr>';
        if (offer.playerId === p.id) html += offerRow(p, team, "resign", 9);
      });
      html += "</tbody></table>";
    }

    var freeAgents = S.getFreeAgents().slice().sort(function (a, b) { return b.overall - a.overall; });
    html += "<h3>Free Agents (" + freeAgents.length + ")</h3>";
    if (!freeAgents.length) {
      html += '<p class="muted">No free agents available. Release players or wait for the next breakout rookie class to populate the pool.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Asking Price</th><th></th></tr></thead><tbody>';
      freeAgents.forEach(function (p) {
        var eligible = isEligible(p, team.division);
        var asking = askingPriceFor(p, team);
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td>" + p.overall + "</td><td>" + p.potential + "</td><td>" + U.formatMoney(asking) + "</td>";
        if (eligible) {
          html += '<td><button class="btn btn-sm btn-primary" data-action="toggle-offer" data-mode="sign" data-id="' + p.id + '">Sign</button></td></tr>';
        } else {
          html += '<td><span class="pill pill-warn" title="Breakout rookies cannot jump straight to this division">Not eligible here</span></td></tr>';
        }
        if (offer.playerId === p.id) html += offerRow(p, team, "sign", 7);
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  // Inline negotiation panel rendered directly under a player's row.
  function offerRow(p, team, mode, colspan) {
    var asking = askingPriceFor(p, team);
    if (offer.amount == null || !offer.amount) offer.amount = asking;
    var rejectChance = U.contractRejectChance(asking, offer.amount, offer.years);
    var riskLabel = rejectChance >= 0.5 ? "pill-warn" : rejectChance >= 0.2 ? "" : "pill-clinch";
    var html = '<tr class="offer-row"><td colspan="' + (colspan || 9) + '"><div class="offer-panel">';
    html += '<div class="offer-panel-title">' + (mode === "sign" ? "Offer a contract to " : "Re-sign ") + U.escapeHtml(p.name) + '</div>';
    html += '<div class="offer-panel-grid">';
    html += '<label>Years<select id="offer-years">';
    for (var y = 1; y <= 5; y++) {
      html += '<option value="' + y + '"' + (offer.years === y ? " selected" : "") + ">" + y + " yr" + (y > 1 ? "s" : "") + "</option>";
    }
    html += "</select></label>";
    html += '<label>Offer Salary<input type="number" id="offer-amount" step="500" min="' + U.SALARY_MIN + '" value="' + offer.amount + '"></label>';
    html += '<div class="offer-panel-info"><span class="muted small">Asking: ' + U.formatMoney(asking) + '</span>' +
      '<span class="pill ' + riskLabel + ' small">Reject risk: ' + Math.round(rejectChance * 100) + '%</span></div>';
    html += "</div>";
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary btn-sm" data-action="send-offer" data-mode="' + mode + '" data-id="' + p.id + '">Send Offer</button>';
    html += '<button class="btn btn-sm" data-action="cancel-offer">Cancel</button>';
    html += "</div></div></td></tr>";
    return html;
  }

  function wireEvents() {
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
    container.querySelectorAll('[data-action="toggle-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        if (offer.playerId === p.id) {
          offer = { playerId: null, years: 2, amount: 0 };
        } else {
          var team = S.getTeam(selectedTeamId);
          offer = { playerId: p.id, years: b.dataset.mode === "resign" ? Math.max(1, Math.min(5, (p.contractYears || 2))) : 2, amount: askingPriceFor(p, team) };
        }
        render();
      });
    });
    var cancelBtn = container.querySelector('[data-action="cancel-offer"]');
    if (cancelBtn) cancelBtn.addEventListener("click", function () {
      offer = { playerId: null, years: 2, amount: 0 };
      render();
    });
    var yearsSel = container.querySelector("#offer-years");
    if (yearsSel) yearsSel.addEventListener("change", function (e) {
      offer.years = parseInt(e.target.value, 10) || 2;
      render();
    });
    var amountInput = container.querySelector("#offer-amount");
    if (amountInput) amountInput.addEventListener("change", function (e) {
      offer.amount = Math.max(U.SALARY_MIN, parseInt(e.target.value, 10) || U.SALARY_MIN);
      render();
    });
    container.querySelectorAll('[data-action="send-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        sendOffer(b.dataset.id, b.dataset.mode);
      });
    });
  }

  function sendOffer(playerId, mode) {
    var p = S.getPlayer(playerId);
    var team = S.getTeam(selectedTeamId);
    if (!p || !team) return;
    if (mode === "sign" && !isEligible(p, team.division)) {
      alert(p.name + " is a breakout rookie not yet eligible to sign with a " + S.getDivision(team.division).name + " team.");
      return;
    }
    var roster = S.getRoster(selectedTeamId);
    if (mode === "sign" && roster.length >= S.getSettings().rosterMax) {
      alert("Roster is full (" + S.getSettings().rosterMax + " players). Release someone first.");
      return;
    }
    var space = S.capSpace(selectedTeamId);
    var currentSalary = mode === "resign" ? p.salary : 0;
    var spaceAfterRelease = space + (mode === "resign" ? currentSalary : 0); // re-signing frees up their old cap hit first
    if (offer.amount > spaceAfterRelease) {
      alert("Not enough cap space for that offer (needs " + U.formatMoney(offer.amount) + ", have " + U.formatMoney(spaceAfterRelease) + ").");
      return;
    }
    var asking = askingPriceFor(p, team);
    var rejectChance = U.contractRejectChance(asking, offer.amount, offer.years);
    var rejected = Math.random() < rejectChance;
    if (rejected) {
      alert(p.name + " turned down your offer (" + U.formatMoney(offer.amount) + " over " + offer.years + " yr" + (offer.years > 1 ? "s" : "") +
        ", asking " + U.formatMoney(asking) + "). Try sweetening the deal.");
      return;
    }
    var patch = { contractYears: offer.years, salary: offer.amount };
    if (mode === "sign") {
      patch.teamId = selectedTeamId;
      patch.eligibleDivisions = null; // once signed, a breakout rookie's division restriction is lifted permanently
    }
    S.updatePlayer(p.id, patch);
    offer = { playerId: null, years: 2, amount: 0 };
    alert(p.name + " agreed to " + U.formatMoney(offer.amount || patch.salary) + " over " + patch.contractYears + " yr" + (patch.contractYears > 1 ? "s" : "") + "!");
    render();
    if (window.PHLApp) window.PHLApp.refresh();
  }

  window.PHLContracts = { render: render, askingPriceFor: askingPriceFor };
})();
