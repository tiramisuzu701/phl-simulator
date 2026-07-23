/* PHL Franchise Simulator — league-wide entry draft
 * Global namespace: window.PHLDraft
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var ROUNDS = 3;
  var posFilter = "";

  function buildDraftOrder(rounds) {
    var teams = S.getTeams().slice();
    var anyPlayed = teams.some(function (t) { return t.wins + t.losses + t.otLosses > 0; });
    if (anyPlayed) {
      teams.sort(function (a, b) {
        if (a.points !== b.points) return a.points - b.points; // worst first
        return a.wins - b.wins;
      });
    } else {
      // no standings yet — random draft order
      teams.sort(function () { return Math.random() - 0.5; });
    }
    var order = [];
    for (var r = 0; r < rounds; r++) {
      var roundOrder = r % 2 === 0 ? teams.slice() : teams.slice().reverse();
      roundOrder.forEach(function (t) { order.push(t.id); });
    }
    return order;
  }

  function generateProspect() {
    var roll = Math.random();
    var position = roll < 0.45 ? "F" : roll < 0.8 ? "D" : "G";
    // Prospects skew lower/mid with occasional high-upside gems
    var overall = Math.random() < 0.12 ? U.randInt(78, 92) : U.randInt(45, 78);
    var offense = U.clamp(overall + U.randInt(-10, 10) + (position === "F" ? 3 : -3), 40, 99);
    var defense = U.clamp(overall + U.randInt(-10, 10) + (position === "D" ? 3 : -3), 40, 99);
    var goaltending = position === "G" ? U.clamp(overall + U.randInt(-8, 8), 40, 99) : 40;
    return {
      name: U.randomName(),
      position: position,
      age: U.randInt(18, 21),
      overall: overall,
      attributes: { offense: offense, defense: defense, goaltending: goaltending },
      salary: Math.round(U.salaryForOverall(overall) * 0.6 * 2) / 2,
      contractYears: 3,
      teamId: null,
      isDraftProspect: true,
      stats: S.freshStatLine(),
    };
  }

  function startDraft() {
    var order = buildDraftOrder(ROUNDS);
    if (!order.length) {
      alert("Add teams before starting a draft.");
      return;
    }
    var poolSize = order.length + 10;
    var poolIds = [];
    for (var i = 0; i < poolSize; i++) {
      var p = S.addPlayer(generateProspect());
      poolIds.push(p.id);
    }
    var prevYear = S.getDraft().year || 1;
    S.updateDraft({
      active: true,
      year: prevYear + 1,
      order: order,
      pickIndex: 0,
      pool: poolIds,
      picks: [],
    });
  }

  function currentTeamId() {
    var d = S.getDraft();
    if (!d.active) return null;
    return d.order[d.pickIndex];
  }

  function poolPlayers() {
    var d = S.getDraft();
    return d.pool
      .map(function (id) { return S.getPlayer(id); })
      .filter(function (p) { return p && p.isDraftProspect; });
  }

  function makePick(playerId) {
    var d = S.getDraft();
    if (!d.active) return;
    var teamId = currentTeamId();
    var player = S.getPlayer(playerId);
    if (!player || !player.isDraftProspect || player.teamId) return;
    S.updatePlayer(playerId, { teamId: teamId, isDraftProspect: false });
    d.picks.push({ pickNumber: d.pickIndex + 1, teamId: teamId, playerId: playerId });
    d.pickIndex += 1;
    if (d.pickIndex >= d.order.length) {
      finishDraft();
    } else {
      S.updateDraft(d);
    }
  }

  function finishDraft() {
    var d = S.getDraft();
    d.active = false;
    // Leftover undrafted prospects become free agents
    d.pool.forEach(function (id) {
      var p = S.getPlayer(id);
      if (p && p.isDraftProspect) S.updatePlayer(id, { isDraftProspect: false });
    });
    S.updateDraft(d);
  }

  function bestAvailable() {
    var pool = poolPlayers().sort(function (a, b) { return b.overall - a.overall; });
    if (!pool.length) return null;
    var top = pool.slice(0, Math.min(5, pool.length));
    return U.weightedPick(top.map(function (p) { return { item: p, weight: p.overall * p.overall }; }));
  }

  function autoPick() {
    var p = bestAvailable();
    if (p) makePick(p.id);
  }

  function autoDraftRemaining() {
    var guard = 0;
    while (S.getDraft().active && guard < 2000) {
      autoPick();
      guard++;
    }
  }

  // ---------------- Rendering ----------------
  function render(el) {
    container = el || container;
    if (!container) return;
    var d = S.getDraft();
    var html = '<div class="panel-header"><h2>Entry Draft</h2></div>';

    if (!d.active && (!d.picks || !d.picks.length)) {
      html += '<div class="empty-state"><p>Run a league-wide entry draft (' + ROUNDS + ' rounds, snake order, worst record picks first). Undrafted prospects join free agency afterward.</p>' +
        '<button class="btn btn-primary" data-action="start-draft">Start Entry Draft</button></div>';
      container.innerHTML = html;
      wireEvents();
      return;
    }

    if (d.active) {
      var team = S.getTeam(currentTeamId());
      html += '<div class="action-row">';
      html += '<span class="pill pill-accent">On the Clock: ' + U.escapeHtml(team ? team.name : "?") + "</span>";
      html += '<span class="muted">Pick ' + (d.pickIndex + 1) + " of " + d.order.length + "</span>";
      html += '<button class="btn" data-action="auto-pick">Auto-Pick</button>';
      html += '<button class="btn btn-primary" data-action="auto-draft-rest">Auto-Draft Remaining</button>';
      html += "</div>";

      html += '<div class="filter-bar"><select id="draft-pos-filter">' +
        '<option value="">All Positions</option><option value="F">Forward</option><option value="D">Defender</option><option value="G">Goalie</option>' +
        "</select></div>";

      var pool = poolPlayers().sort(function (a, b) { return b.overall - a.overall; });
      if (posFilter) pool = pool.filter(function (p) { return p.position === posFilter; });
      html += '<table class="data-table"><thead><tr><th>Prospect</th><th>Pos</th><th>Age</th><th>OVR</th><th>OFF</th><th>DEF</th><th>G</th><th></th></tr></thead><tbody>';
      pool.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + p.age + "</td><td><strong>" + p.overall + "</strong></td>" +
          "<td>" + p.attributes.offense + "</td><td>" + p.attributes.defense + "</td><td>" + (p.position === "G" ? p.attributes.goaltending : "&mdash;") + "</td>" +
          '<td><button class="btn btn-sm btn-primary" data-action="pick" data-id="' + p.id + '">Draft</button></td></tr>';
      });
      html += "</tbody></table>";
    } else {
      html += '<div class="action-row"><span class="pill">Draft Complete &mdash; Year ' + d.year + '</span>' +
        '<button class="btn btn-primary" data-action="start-draft">Run Another Draft</button></div>';
    }

    if (d.picks && d.picks.length) {
      html += '<h3>Draft Board</h3><table class="data-table"><thead><tr><th>#</th><th>Team</th><th>Player</th><th>Pos</th><th>OVR</th></tr></thead><tbody>';
      d.picks.slice().reverse().forEach(function (pick) {
        var t = S.getTeam(pick.teamId);
        var p = S.getPlayer(pick.playerId);
        html += "<tr><td>" + pick.pickNumber + "</td><td>" + U.escapeHtml(t ? t.abbr : "?") + "</td><td>" + U.escapeHtml(p ? p.name : "?") + "</td><td>" + (p ? p.position : "") + "</td><td>" + (p ? p.overall : "") + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    var posSel = container.querySelector("#draft-pos-filter");
    if (posSel) posSel.value = posFilter;
    wireEvents();
  }

  function wireEvents() {
    var start = container.querySelector('[data-action="start-draft"]');
    if (start) start.addEventListener("click", function () {
      if (!container.querySelector('[data-action="pick"]') || confirm("Start a new entry draft? A fresh prospect pool will be generated.")) {
        startDraft();
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      }
    });
    var auto = container.querySelector('[data-action="auto-pick"]');
    if (auto) auto.addEventListener("click", function () {
      autoPick();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var autoRest = container.querySelector('[data-action="auto-draft-rest"]');
    if (autoRest) autoRest.addEventListener("click", function () {
      autoDraftRemaining();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    container.querySelectorAll('[data-action="pick"]').forEach(function (b) {
      b.addEventListener("click", function () {
        makePick(b.dataset.id);
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
    var posSel = container.querySelector("#draft-pos-filter");
    if (posSel) posSel.addEventListener("change", function (e) {
      posFilter = e.target.value;
      render();
    });
  }

  window.PHLDraft = {
    render: render,
    startDraft: startDraft,
    makePick: makePick,
    autoPick: autoPick,
    autoDraftRemaining: autoDraftRemaining,
  };
})();
