/* PHL Franchise Simulator — one-time Startup Draft
 * Global namespace: window.PHLStartupDraft
 *
 * Runs once, at the very beginning of a save. After the GM picks a
 * division and team, the real PHL player pool (see startupPool in
 * starterData.js) is drafted in three cascading phases:
 *   1. Pro drafts from the FULL pool (8 rounds, snake order).
 *   2. Contender drafts from whatever Pro left behind (8 rounds, snake).
 *   3. Prospect drafts from whatever Contender left behind (8 rounds, snake).
 * Anyone still undrafted after Prospect's phase becomes a normal free
 * agent. Pick order for every phase comes from a single random shuffle of
 * all teams, made once when the draft begins — each phase just filters
 * that master order down to its own division's teams.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  var PHASES = ["pro", "contender", "prospect"];
  var PHASE_LABEL = { pro: "Pro", contender: "Contender", prospect: "Prospect" };
  // Minimum viable lineup (matches the sim's 2F/2D/1G active lineup) — AI
  // teams prioritize hitting this on every single pick, before anything
  // else, so nobody ends up unable to field a lineup. Order matters for
  // tie-breaking (goalies are scarcest across the real player pool).
  var HARD_MIN = { G: 1, D: 2, F: 2 };
  // Fuller depth target AI teams draft toward once the hard minimum above
  // is covered (2F/2D/1G starting + a few bench players across 8 rounds).
  var TARGET = { G: 2, D: 3, F: 3 };
  var POS_LABEL = { F: "Forward", D: "Defense", G: "Goalie" };

  var posFilter = "";
  var setupDivisionChoice = null; // transient UI state for the GM-setup screen

  // ---------------- Helpers ----------------
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function currentRoundIndex(sd) {
    if (!sd.phaseTeamOrder.length) return 0;
    return Math.floor(sd.pickIndexInPhase / sd.phaseTeamOrder.length);
  }

  function totalPicksInPhase(sd) {
    return sd.phaseTeamOrder.length * sd.roundsPerPhase;
  }

  function currentTeamId(sd) {
    if (sd.status !== "active" || !sd.phaseTeamOrder.length) return null;
    var roundIndex = currentRoundIndex(sd);
    var order = roundIndex % 2 === 0 ? sd.phaseTeamOrder : sd.phaseTeamOrder.slice().reverse();
    var idxInRound = sd.pickIndexInPhase % sd.phaseTeamOrder.length;
    return order[idxInRound];
  }

  function teamNeedCounts(teamId) {
    var roster = S.getRoster(teamId);
    var counts = { F: 0, D: 0, G: 0 };
    roster.forEach(function (p) { if (counts[p.position] != null) counts[p.position] += 1; });
    return counts;
  }

  function picksSoFarForTeamThisPhase(sd, teamId) {
    return sd.picks.filter(function (pk) { return pk.teamId === teamId && pk.phase === sd.phase; }).length;
  }

  // ---------------- Draft flow ----------------
  function advancePhase(sd) {
    if (sd.phaseIndex >= PHASES.length - 1) {
      finishDraft(sd);
      return;
    }
    sd.phaseIndex += 1;
    sd.phase = PHASES[sd.phaseIndex];
    var divTeamIds = S.getTeams(sd.phase).map(function (t) { return t.id; });
    sd.phaseTeamOrder = sd.masterOrder.filter(function (id) { return divTeamIds.indexOf(id) !== -1; });
    sd.pickIndexInPhase = 0;
    if (!sd.phaseTeamOrder.length) {
      advancePhase(sd); // no teams in this division — skip straight to the next phase
      return;
    }
    S.updateStartupDraft(sd);
  }

  function finishDraft(sd) {
    sd.status = "complete";
    sd.phase = null;
    S.getStartupPool().forEach(function (p) {
      S.updatePlayer(p.id, { startupDraftPool: false });
    });
    S.updateStartupDraft(sd);
  }

  function startDraft() {
    var fr = S.getFranchise();
    if (!fr.teamId) {
      alert("Pick your division and team first.");
      return;
    }
    var sd = S.getStartupDraft();
    if (sd.status !== "not_started") return;
    sd.masterOrder = shuffle(S.getTeams().map(function (t) { return t.id; }));
    sd.status = "active";
    sd.phaseIndex = -1;
    sd.picks = [];
    sd.pickIndexInPhase = 0;
    sd.phase = null;
    sd.phaseTeamOrder = [];
    S.updateStartupDraft(sd);
    advancePhase(sd);
  }

  function pickForTeam(teamId, playerId) {
    var sd = S.getStartupDraft();
    if (sd.status !== "active") return;
    var player = S.getPlayer(playerId);
    if (!player || !player.startupDraftPool || player.teamId) return;
    S.updatePlayer(playerId, { teamId: teamId, startupDraftPool: false, contractYears: 3 });
    sd.picks.push({
      pickNumber: sd.picks.length + 1,
      phase: sd.phase,
      round: currentRoundIndex(sd) + 1,
      teamId: teamId,
      playerId: playerId,
    });
    sd.pickIndexInPhase += 1;
    if (!S.getStartupPool().length) {
      // The real player pool (192 players) is smaller than a full 8-round
      // draft across every team (208 slots), so it can run dry mid-phase.
      // Nothing left to distribute — end the draft right here.
      finishDraft(sd);
    } else if (sd.pickIndexInPhase >= totalPicksInPhase(sd)) {
      advancePhase(sd);
    } else {
      S.updateStartupDraft(sd);
    }
  }

  // Best-overall-available, weighted toward whatever position a team still
  // needs. Priority order every pick:
  //   1. Any position still below its hard minimum (2F/2D/1G) — always
  //      forced, immediately, so no team defers building a viable lineup
  //      until it's too late and the pool's dried up.
  //   2. Once the hard minimum is covered, a position still below its
  //      fuller depth target gets forced once a team's remaining rounds
  //      this phase are down to exactly what's needed to still reach it.
  //   3. Otherwise, best overall among positions still under target.
  //   4. Otherwise, pure best overall available.
  function aiPickPlayerFor(teamId) {
    var sd = S.getStartupDraft();
    var pool = S.getStartupPool();
    if (!pool.length) return null;

    var need = teamNeedCounts(teamId);
    var picksSoFar = picksSoFarForTeamThisPhase(sd, teamId);
    var roundsLeft = sd.roundsPerPhase - picksSoFar; // this pick counts as one of them

    var forcedPos = null;
    var bestUrgency = 0;
    ["G", "D", "F"].forEach(function (pos) {
      var hardDeficit = HARD_MIN[pos] - (need[pos] || 0);
      if (hardDeficit > 0) {
        // Hard-minimum needs always outrank soft-target needs, and outrank
        // each other by how badly unmet they are.
        var urgency = 1000 + hardDeficit;
        if (urgency > bestUrgency) { bestUrgency = urgency; forcedPos = pos; }
      }
    });
    if (!forcedPos) {
      ["G", "D", "F"].forEach(function (pos) {
        var deficit = TARGET[pos] - (need[pos] || 0);
        if (deficit > 0 && deficit >= roundsLeft && deficit > bestUrgency) {
          bestUrgency = deficit;
          forcedPos = pos;
        }
      });
    }

    var candidates;
    if (forcedPos) {
      candidates = pool.filter(function (p) { return p.position === forcedPos; });
      if (!candidates.length) candidates = pool; // that position's pool ran dry — fall back
    } else {
      candidates = pool.filter(function (p) { return (need[p.position] || 0) < TARGET[p.position]; });
      if (!candidates.length) candidates = pool; // target already met everywhere — pure best-available
    }

    candidates = candidates.slice().sort(function (a, b) { return b.overall - a.overall; });
    var top = candidates.slice(0, Math.min(6, candidates.length));
    return U.weightedPick(top.map(function (p) { return { item: p, weight: p.overall * p.overall }; }));
  }

  function simulateNextPick() {
    var sd = S.getStartupDraft();
    if (sd.status !== "active") return;
    if (!S.getStartupPool().length) { finishDraft(sd); return; }
    var teamId = currentTeamId(sd);
    if (!teamId) return;
    var fr = S.getFranchise();
    if (teamId === fr.teamId) return; // user's turn — they pick manually below
    var p = aiPickPlayerFor(teamId);
    if (p) pickForTeam(teamId, p.id);
    else finishDraft(S.getStartupDraft()); // defensive — pool emptied mid-check
  }

  function simulateUntilMyTurn() {
    var fr = S.getFranchise();
    var guard = 0;
    while (guard < 3000) {
      var sd = S.getStartupDraft();
      if (sd.status !== "active") return;
      if (!S.getStartupPool().length) { finishDraft(sd); return; }
      var teamId = currentTeamId(sd);
      if (!teamId || teamId === fr.teamId) return;
      simulateNextPick();
      guard++;
    }
  }

  function autoDraftRemaining() {
    var guard = 0;
    while (S.getStartupDraft().status === "active" && guard < 5000) {
      var sd = S.getStartupDraft();
      if (!S.getStartupPool().length) { finishDraft(sd); break; }
      var teamId = currentTeamId(sd);
      if (!teamId) break;
      var p = aiPickPlayerFor(teamId);
      if (!p) { finishDraft(S.getStartupDraft()); break; }
      pickForTeam(teamId, p.id);
      guard++;
    }
  }

  // ---------------- Rendering ----------------
  function render(el) {
    container = el || container;
    if (!container) return;
    var fr = S.getFranchise();
    var sd = S.getStartupDraft();

    if (!fr.teamId) {
      renderSetupScreen();
      return;
    }
    if (sd.status === "not_started") {
      renderReadyScreen(fr);
      return;
    }
    if (sd.status === "active") {
      if (!S.getStartupPool().length) {
        // Pool ran dry (the real 192-player pool is smaller than a full
        // 8-round/26-team draft) — nothing left to distribute, so finish
        // up automatically instead of showing an empty, stuck board.
        finishDraft(sd);
        sd = S.getStartupDraft();
      } else {
        renderDraftBoard(sd, fr);
        return;
      }
    }
    renderCompleteScreen(fr);
  }

  function renderSetupScreen() {
    var divisions = S.getDivisions().slice().sort(function (a, b) { return b.tier - a.tier; });
    var divId = setupDivisionChoice || (divisions[0] && divisions[0].id);
    var teams = S.getTeams(divId).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

    var html = '<div class="panel-header"><h2>Startup Draft — Choose Your Franchise</h2></div>';
    html += '<div class="form-card">';
    html += "<p>Pick the division and team you want to run. Once you confirm, the one-time Startup Draft " +
      "populates every team in the league (including yours) from the real PHL player pool — Pro drafts first " +
      "from the whole pool, then Contender drafts from what's left, then Prospect gets whatever remains.</p>";
    html += '<div class="tab-strip">';
    divisions.forEach(function (d) {
      html += '<button class="chip' + (d.id === divId ? " chip-active" : "") + '" data-action="pick-division" data-id="' + d.id + '">' + U.escapeHtml(d.name) + "</button>";
    });
    html += "</div>";
    html += '<div class="form-grid"><label>Team<select id="setup-team-select">';
    teams.forEach(function (t) {
      html += '<option value="' + t.id + '">' + U.escapeHtml(t.name) + "</option>";
    });
    html += "</select></label></div>";
    html += '<div class="form-actions"><button class="btn btn-primary" data-action="confirm-franchise">Confirm & Continue</button></div>';
    html += "</div>";
    container.innerHTML = html;

    container.querySelectorAll('[data-action="pick-division"]').forEach(function (b) {
      b.addEventListener("click", function () {
        setupDivisionChoice = b.dataset.id;
        render();
      });
    });
    container.querySelector('[data-action="confirm-franchise"]').addEventListener("click", function () {
      var teamSel = container.querySelector("#setup-team-select");
      var teamId = teamSel && teamSel.value;
      if (!teamId) { alert("Pick a team."); return; }
      S.setFranchise(divId, teamId);
      setupDivisionChoice = null;
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  function renderReadyScreen(fr) {
    var team = S.getTeam(fr.teamId);
    var div = S.getDivision(fr.divisionId);
    var html = '<div class="panel-header"><h2>Startup Draft</h2></div>';
    html += '<div class="form-card">';
    html += "<p>You're GM of <strong>" + U.escapeHtml(team ? team.name : "?") + "</strong> (" + U.escapeHtml(div ? div.name : "?") + ").</p>";
    html += "<p class=\"muted\">The Startup Draft runs in three cascading phases, each 8 rounds in snake order " +
      "(pick order reverses every round): <strong>Pro</strong> drafts first from the full real-player pool, " +
      "then <strong>Contender</strong> drafts from whoever's left, then <strong>Prospect</strong> gets the rest. " +
      "Draft order for every phase is randomized once, right when you start. Undrafted players afterward become " +
      "regular free agents.</p>";
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary" data-action="begin-draft">Begin Startup Draft</button>';
    html += '<button class="btn" data-action="change-team">Change Team</button>';
    html += "</div></div>";
    container.innerHTML = html;

    container.querySelector('[data-action="begin-draft"]').addEventListener("click", function () {
      startDraft();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    container.querySelector('[data-action="change-team"]').addEventListener("click", function () {
      S.setFranchise(null, null);
      render();
    });
  }

  function renderDraftBoard(sd, fr) {
    var teamId = currentTeamId(sd);
    var team = teamId ? S.getTeam(teamId) : null;
    var isMyTurn = teamId === fr.teamId;
    var roundIndex = currentRoundIndex(sd);

    var html = '<div class="panel-header"><h2>Startup Draft &mdash; ' + PHASE_LABEL[sd.phase] + ' Phase</h2></div>';

    html += '<div class="action-row">';
    html += '<span class="pill pill-accent">On the Clock: ' + U.escapeHtml(team ? team.name : "?") + (isMyTurn ? " (You)" : "") + "</span>";
    html += '<span class="muted">Round ' + (roundIndex + 1) + " of " + sd.roundsPerPhase + " &middot; Pick " + (sd.pickIndexInPhase + 1) + " of " + totalPicksInPhase(sd) + " this phase</span>";
    if (!isMyTurn) {
      html += '<button class="btn btn-primary" data-action="sim-next">Simulate Next Pick</button>';
      html += '<button class="btn" data-action="sim-until-me">Simulate Until My Turn</button>';
    }
    html += '<button class="btn" data-action="auto-draft-rest">Auto-Draft Remaining (Skip Ahead)</button>';
    html += "</div>";

    // Your roster so far
    var myRoster = S.getRoster(fr.teamId);
    if (myRoster.length) {
      var counts = { F: 0, D: 0, G: 0 };
      myRoster.forEach(function (p) { counts[p.position] += 1; });
      html += '<p class="muted small">Your roster so far: ' + myRoster.length + " players (F:" + counts.F + " D:" + counts.D + " G:" + counts.G + ")</p>";
    }

    if (isMyTurn) {
      html += '<div class="filter-bar"><select id="draft-pos-filter">' +
        '<option value="">All Positions</option><option value="F">Forward</option><option value="D">Defense</option><option value="G">Goalie</option>' +
        "</select></div>";

      var pool = S.getStartupPool().slice().sort(function (a, b) { return b.overall - a.overall; });
      if (posFilter) pool = pool.filter(function (p) { return p.position === posFilter; });
      html += '<table class="data-table"><thead><tr><th>Nametag</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th></th></tr></thead><tbody>';
      pool.forEach(function (p) {
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td>" +
          "<td><strong>" + p.overall + "</strong></td><td>" + p.potential + "</td>" +
          '<td><button class="btn btn-sm btn-primary" data-action="pick" data-id="' + p.id + '">Draft</button></td></tr>';
      });
      html += "</tbody></table>";
    } else {
      html += '<p class="muted">Watching ' + U.escapeHtml(team ? team.name : "this team") + " draft &mdash; click \"Simulate Next Pick\" to see who they take.</p>";
    }

    if (sd.picks.length) {
      html += '<h3>Recent Picks</h3><table class="data-table"><thead><tr><th>#</th><th>Phase</th><th>Rd</th><th>Team</th><th>Player</th><th>Pos</th><th>OVR</th></tr></thead><tbody>';
      sd.picks.slice(-15).reverse().forEach(function (pick) {
        var t = S.getTeam(pick.teamId);
        var p = S.getPlayer(pick.playerId);
        html += "<tr><td>" + pick.pickNumber + "</td><td>" + PHASE_LABEL[pick.phase] + "</td><td>" + pick.round + "</td><td>" +
          U.escapeHtml(t ? t.abbr : "?") + "</td><td>" + U.escapeHtml(p ? p.name : "?") + "</td><td>" + (p ? p.position : "") + "</td><td>" + (p ? p.overall : "") + "</td></tr>";
      });
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    var posSel = container.querySelector("#draft-pos-filter");
    if (posSel) posSel.value = posFilter;
    wireBoardEvents();
  }

  function wireBoardEvents() {
    var simNext = container.querySelector('[data-action="sim-next"]');
    if (simNext) simNext.addEventListener("click", function () {
      simulateNextPick();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var simUntil = container.querySelector('[data-action="sim-until-me"]');
    if (simUntil) simUntil.addEventListener("click", function () {
      simulateUntilMyTurn();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var autoRest = container.querySelector('[data-action="auto-draft-rest"]');
    if (autoRest) autoRest.addEventListener("click", function () {
      if (confirm("Auto-draft every remaining pick in every phase, including yours? You won't get to choose your own players.")) {
        autoDraftRemaining();
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      }
    });
    container.querySelectorAll('[data-action="pick"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var fr = S.getFranchise();
        pickForTeam(fr.teamId, b.dataset.id);
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

  function renderCompleteScreen(fr) {
    var team = S.getTeam(fr.teamId);
    var roster = S.getRoster(fr.teamId).slice().sort(function (a, b) { return b.overall - a.overall; });
    var counts = { F: 0, D: 0, G: 0 };
    var starters = { F: 0, D: 0, G: 0 };
    roster.forEach(function (p) {
      counts[p.position] += 1;
      if (p.starter) starters[p.position] += 1;
    });

    var html = '<div class="panel-header"><h2>Startup Draft Complete</h2></div>';
    html += '<div class="form-card">';
    html += "<p>Every team in the league now has an initial roster. You're set as GM of <strong>" + U.escapeHtml(team ? team.name : "?") + "</strong>. Head to Schedule to generate your season, or fine-tune your roster below.</p>";
    html += "<p class=\"muted small\">Lineup targets: 2 Forwards, 2 Defense, 1 Goalie starting; the simulator falls back to your best players automatically at any position you haven't set starters for.</p>";
    html += "</div>";

    html += '<div class="form-card">';
    html += "<h3>Set Your Lineup (" + U.escapeHtml(team ? team.name : "") + ")</h3>";
    html += '<p class="muted small">Starters set: F ' + starters.F + "/2 &middot; D " + starters.D + "/2 &middot; G " + starters.G + "/1 (of " + roster.length + " total players: F " + counts.F + ", D " + counts.D + ", G " + counts.G + ")</p>";
    html += '<table class="data-table"><thead><tr><th>Nametag</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Lineup</th></tr></thead><tbody>';
    roster.forEach(function (p) {
      html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td><strong>" + p.overall + "</strong></td><td>" + p.potential + "</td>" +
        '<td><button class="btn btn-sm ' + (p.starter ? "btn-primary" : "") + '" data-action="toggle-starter" data-id="' + p.id + '">' + (p.starter ? "Starter" : "Bench") + "</button></td></tr>";
    });
    html += "</tbody></table></div>";

    container.innerHTML = html;
    container.querySelectorAll('[data-action="toggle-starter"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (p) S.updatePlayer(p.id, { starter: !p.starter });
        render();
      });
    });
  }

  window.PHLStartupDraft = {
    render: render,
    startDraft: startDraft,
    simulateNextPick: simulateNextPick,
    simulateUntilMyTurn: simulateUntilMyTurn,
    autoDraftRemaining: autoDraftRemaining,
  };
})();
