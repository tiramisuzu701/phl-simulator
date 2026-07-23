/* PHL Franchise Simulator — player-for-player trades
 * Global namespace: window.PHLTrades
 *
 * You can only propose trades for the team you GM — pick a partner team,
 * check off players from each side, and propose. Every other team's side
 * of a trade is evaluated automatically by a simple trade-value heuristic
 * (see tradeValue() below): the AI won't accept losing significantly more
 * value than it receives, so lopsided offers get turned down rather than
 * silently accepted. Both sides also have to stay roster- and cap-legal
 * after the swap, or the trade can't be proposed at all.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var view = { partnerId: null, mine: [], theirs: [] };

  // A simplified, transparent trade-value estimate: current ability +
  // unrealized upside, discounted by how much cap room they eat, boosted
  // by how many years a team keeps control of them. Not a hidden number —
  // shown right in the UI so it's clear why the AI likes or dislikes an
  // offer.
  function tradeValue(player) {
    var v = player.overall * 2.5 + (player.potential - player.overall) * 0.8;
    v -= (player.salary || 0) / 8000;
    v += (player.contractYears || 0) * 2;
    return Math.round(Math.max(1, v));
  }

  function sumValue(players) {
    return players.reduce(function (sum, p) { return sum + tradeValue(p); }, 0);
  }

  function otherTeams(myTeamId) {
    return S.getTeams().filter(function (t) { return t.id !== myTeamId; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Trades</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first — you can only propose trades for the team you GM.</p>';
      return;
    }
    var myTeamId = franchise.teamId;
    var myTeam = S.getTeam(myTeamId);
    var partners = otherTeams(myTeamId);
    if (!partners.length) {
      container.innerHTML = '<div class="panel-header"><h2>Trades</h2></div><p class="muted">There are no other teams to trade with yet.</p>';
      return;
    }
    if (!view.partnerId || !partners.some(function (t) { return t.id === view.partnerId; })) {
      view.partnerId = partners[0].id;
    }
    var partner = S.getTeam(view.partnerId);

    var html = '<div class="panel-header"><h2>Trades</h2></div>';
    html += '<p class="muted small">Propose a player-for-player trade with another team. Trade value is a simple, visible estimate — Overall + unrealized Potential, minus salary drag, plus years of contractual control — the other side won\'t accept a deal that gives up much more value than it gets back.</p>';

    html += '<div class="filter-bar"><label>Trade with<select id="trade-partner">';
    partners.forEach(function (t) {
      html += '<option value="' + t.id + '"' + (t.id === view.partnerId ? " selected" : "") + ">" + U.escapeHtml(t.name) + " (" + U.escapeHtml(S.getDivision(t.division).name) + ")</option>";
    });
    html += "</select></label></div>";

    html += '<div class="trade-columns">';
    html += tradeColumn(myTeam, view.mine, "mine");
    html += tradeColumn(partner, view.theirs, "theirs");
    html += "</div>";

    var mineValue = sumValue(view.mine.map(S.getPlayer).filter(Boolean));
    var theirsValue = sumValue(view.theirs.map(S.getPlayer).filter(Boolean));
    html += '<div class="trade-summary form-card">';
    html += '<div class="trade-summary-row"><span>You give (' + view.mine.length + ' player' + (view.mine.length === 1 ? "" : "s") + ')</span><strong>Value ' + mineValue + '</strong></div>';
    html += '<div class="trade-summary-row"><span>You get (' + view.theirs.length + ' player' + (view.theirs.length === 1 ? "" : "s") + ')</span><strong>Value ' + theirsValue + '</strong></div>';
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary" data-action="propose-trade"' + (!view.mine.length || !view.theirs.length ? " disabled" : "") + '>Propose Trade</button>';
    html += '<button class="btn" data-action="clear-trade">Clear Selections</button>';
    html += "</div></div>";

    var history = S.getTrades().slice().reverse();
    if (history.length) {
      html += "<h3>Trade History</h3><table class=\"data-table\"><thead><tr><th>Season</th><th>Teams</th><th>Details</th></tr></thead><tbody>";
      history.slice(0, 15).forEach(function (entry) {
        var teamA = S.getTeam(entry.teamAId);
        var teamB = S.getTeam(entry.teamBId);
        var aNames = entry.playersToB.map(function (id) { var p = S.getPlayer(id); return p ? p.name : "?"; }).join(", ") || "nobody";
        var bNames = entry.playersToA.map(function (id) { var p = S.getPlayer(id); return p ? p.name : "?"; }).join(", ") || "nobody";
        html += "<tr><td>" + entry.season + "</td><td>" + U.escapeHtml(teamA ? teamA.abbr : "?") + " &harr; " + U.escapeHtml(teamB ? teamB.abbr : "?") + "</td>" +
          "<td>" + U.escapeHtml((teamA ? teamA.abbr : "?") + " sends " + aNames + "; " + (teamB ? teamB.abbr : "?") + " sends " + bNames) + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function tradeColumn(team, selected, side) {
    var roster = S.getRoster(team.id).slice().sort(function (a, b) { return b.overall - a.overall; });
    var html = '<div class="trade-column"><h3>' + U.escapeHtml(team.name) + ' <span class="muted small">(' + roster.length + ' on roster)</span></h3>';
    if (!roster.length) {
      html += '<p class="muted small">No players on this roster.</p></div>';
      return html;
    }
    html += '<table class="data-table compact"><thead><tr><th></th><th>Name</th><th>Pos</th><th>OVR</th><th>Salary</th><th>Yrs</th><th>Value</th></tr></thead><tbody>';
    roster.forEach(function (p) {
      var checked = selected.indexOf(p.id) !== -1;
      html += '<tr><td><input type="checkbox" data-side="' + side + '" data-id="' + p.id + '"' + (checked ? " checked" : "") + '></td>';
      html += "<td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + p.overall + "</td><td>" + U.formatMoney(p.salary) + "</td><td>" + (p.contractYears || 0) + "</td><td>" + tradeValue(p) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function wireEvents() {
    var partnerSel = container.querySelector("#trade-partner");
    if (partnerSel) partnerSel.addEventListener("change", function (e) {
      view.partnerId = e.target.value;
      view.mine = [];
      view.theirs = [];
      render();
    });
    container.querySelectorAll('input[type="checkbox"][data-side]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        var list = cb.dataset.side === "mine" ? view.mine : view.theirs;
        var idx = list.indexOf(cb.dataset.id);
        if (cb.checked && idx === -1) list.push(cb.dataset.id);
        if (!cb.checked && idx !== -1) list.splice(idx, 1);
        render();
      });
    });
    var clearBtn = container.querySelector('[data-action="clear-trade"]');
    if (clearBtn) clearBtn.addEventListener("click", function () {
      view.mine = [];
      view.theirs = [];
      render();
    });
    var proposeBtn = container.querySelector('[data-action="propose-trade"]');
    if (proposeBtn) proposeBtn.addEventListener("click", proposeTrade);
  }

  function proposeTrade() {
    var franchise = S.getFranchise();
    var myTeamId = franchise.teamId;
    var partnerId = view.partnerId;
    var mine = view.mine.map(S.getPlayer).filter(Boolean);
    var theirs = view.theirs.map(S.getPlayer).filter(Boolean);
    if (!mine.length || !theirs.length) return;

    var settings = S.getSettings();
    var myRosterAfter = S.getRoster(myTeamId).length - mine.length + theirs.length;
    var partnerRosterAfter = S.getRoster(partnerId).length - theirs.length + mine.length;
    if (myRosterAfter > settings.rosterMax) {
      alert("That trade would put you over the " + settings.rosterMax + "-player roster limit.");
      return;
    }
    if (partnerRosterAfter > settings.rosterMax) {
      alert("That trade would put " + S.getTeam(partnerId).name + " over the " + settings.rosterMax + "-player roster limit — they won't do it.");
      return;
    }

    var myCapAfter = S.capForTeam(myTeamId) - (S.capUsed(myTeamId) - sumValue.salary(mine) + sumValue.salary(theirs));
    var partnerCapAfter = S.capForTeam(partnerId) - (S.capUsed(partnerId) - sumValue.salary(theirs) + sumValue.salary(mine));
    if (myCapAfter < 0) {
      alert("That trade would put you over your salary cap by " + U.formatMoney(Math.abs(myCapAfter)) + ".");
      return;
    }
    if (partnerCapAfter < 0) {
      alert(S.getTeam(partnerId).name + " would go over their salary cap by " + U.formatMoney(Math.abs(partnerCapAfter)) + " — they won't do it.");
      return;
    }

    var giveValue = sumValue(mine); // value the AI (partner) would receive
    var getValue = sumValue(theirs); // value the AI (partner) would give up
    // The AI won't accept losing more than ~10-15% more value than it
    // gets back; a little randomness keeps the threshold from being a
    // perfectly exploitable fixed number.
    var threshold = 0.88 + (Math.random() * 0.08 - 0.04);
    var accepted = giveValue >= getValue * threshold;
    if (!accepted) {
      alert(S.getTeam(partnerId).name + " turned down the trade — they want more value coming back. " +
        "You're offering about " + giveValue + " in value for about " + getValue + ".");
      return;
    }

    mine.forEach(function (p) { S.updatePlayer(p.id, { teamId: partnerId }); });
    theirs.forEach(function (p) { S.updatePlayer(p.id, { teamId: myTeamId }); });
    S.addTrade({
      season: S.getSeason().seasonNumber || 1,
      teamAId: myTeamId,
      teamBId: partnerId,
      playersToB: mine.map(function (p) { return p.id; }),
      playersToA: theirs.map(function (p) { return p.id; }),
    });
    alert("Trade accepted! " + mine.map(function (p) { return p.name; }).join(", ") + " to " + S.getTeam(partnerId).name +
      "; " + theirs.map(function (p) { return p.name; }).join(", ") + " to " + S.getTeam(myTeamId).name + ".");
    view.mine = [];
    view.theirs = [];
    render();
    if (window.PHLApp) window.PHLApp.refresh();
  }
  // Small helper so cap math above reads cleanly.
  sumValue.salary = function (players) {
    return players.reduce(function (sum, p) { return sum + (p.salary || 0); }, 0);
  };

  window.PHLTrades = { render: render, tradeValue: tradeValue };
})();
