/* PHL Franchise Simulator — Be A Player mode
 * Global namespace: window.PHLCareerMode
 *
 * You are ONE player on the league, not a GM — an AI runs your team's
 * roster, contracts, trades and lineup exactly like it runs every other
 * team (see js/state.js myTeamId/isUserRelevantTeam, and the fact that
 * Be A Player mode deliberately never sets data.franchise.teamId, which is
 * what keeps js/aiManager.js treating your team as fully AI-managed). This
 * module is the home for everything that IS yours to experience:
 *   - Entering the league via a lightweight "amateur draft" placement
 *     (createPlayerAndEnterDraft) when a career starts or restarts.
 *   - A pre-game "gameplan" choice that nudges your own performance in
 *     your team's next game(s) this week (see js/sim.js forcePlayerId /
 *     attributeBoost, threaded through by js/schedule.js, js/playoffs.js,
 *     and js/calendar.js simulateMyGamesThisWeek).
 *   - Contract offers, "trade me" requests, and career milestones,
 *     surfaced through the existing Inbox (js/inbox.js) via weeklyCheck(),
 *     called once from js/calendar.js advanceWeek() (a no-op outside Be A
 *     Player mode).
 *   - Retirement: a full career send-off screen, then a prompt to create a
 *     new player and start a new career in the SAME save — the league
 *     itself just keeps going.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null; // the My Career tab's own container (render/wireHub)
  // Separate container + state for the multi-step "create a player" flow
  // (tryouts -> draft day -> finalize) — shared by createSave.js (a save's
  // very first career) and My Career's own "no player yet" / send-off
  // screens (every career after a retirement). Kept independent of
  // `container` above so the two concerns never stomp on each other, since
  // they can be mounted on entirely different pages.
  var flowContainer = null;
  var onCareerCreated = null;
  var creationFlow = null;

  // ---------------- Gameplan (pre-game choice) ----------------------------
  // Position-aware attribute deltas fed straight into js/sim.js's existing
  // attributeBoost mechanism (offense/defense/goaltending) — the exact same
  // knobs archetypes and derived attributes already use, just applied for
  // one week instead of baked permanently into the player.
  var GAMEPLANS = [
    {
      key: "aggressive",
      label: "Play Aggressive",
      desc: "Push the offense hard — more chances for you, more risk at the other end.",
      biasFor: function (pos) {
        return pos === "G" ? { goaltending: -3, offense: 6 } : { offense: 7, defense: -4 };
      },
    },
    {
      key: "balanced",
      label: "Play It Balanced",
      desc: "No particular emphasis this week — just play your natural game.",
      biasFor: function () {
        return null;
      },
    },
    {
      key: "defensive",
      label: "Lock It Down",
      desc: "Focus on defense and limiting mistakes, at some cost to your offensive output.",
      biasFor: function (pos) {
        return pos === "G" ? { goaltending: 5, offense: -2 } : { offense: -4, defense: 7 };
      },
    },
    {
      key: "grind",
      label: "Grind It Out",
      desc: "A high-effort, shift-to-shift game — modest gains across the board, nothing lopsided.",
      biasFor: function (pos) {
        return pos === "G" ? { goaltending: 2 } : { offense: 2, defense: 2 };
      },
    },
  ];

  function archetypeExists(position, name) {
    return U.archetypesFor(position).some(function (a) { return a.name === name; });
  }

  // ---------------- Training focus (weekly, permanent, capped at Potential)
  // Distinct from Gameplan above: Gameplan is a one-game performance nudge
  // that's spent and cleared every week (see clearGameplanChoiceForNextWeek);
  // Training is a standing choice that sticks until you change it, and
  // instead of nudging one game, has a small weekly CHANCE of nudging your
  // real, permanent Overall (and the matching attribute) — bounded by your
  // existing Potential ceiling exactly the same way every other player's
  // ordinary season-end growth is (see js/stats.js developPlayer). It never
  // pushes you past that ceiling; it just gives you a way to lean into
  // reaching it faster, on top of the growth that already happens for free.
  var TRAINING_FOCUSES = [
    { key: "offense", label: "Offense Training", desc: "Drill shooting, passing, and playmaking.", positions: ["F", "D", "G"] },
    { key: "defense", label: "Defense Training", desc: "Work on positioning and physical play.", positions: ["F", "D", "G"] },
    { key: "goaltending", label: "Goaltending Training", desc: "Reps in the crease — reflexes and rebound control.", positions: ["G"] },
    { key: "conditioning", label: "Conditioning", desc: "General fitness and consistency — a smaller, steady all-around gain.", positions: ["F", "D", "G"] },
  ];

  function trainingFocusesFor(position) {
    return TRAINING_FOCUSES.filter(function (f) { return f.positions.indexOf(position) !== -1; });
  }

  function setTrainingFocus(key) {
    var d = S.getData();
    if (!d.myPlayer) return;
    d.myPlayer.trainingFocus = key || null;
    S.save();
  }

  // A miss most weeks is intentional — a guaranteed weekly tick would
  // trivialize reaching Potential. When it hits, the trained attribute gets
  // an extra small nudge on top of the recomputed baseline so the choice of
  // focus is actually visible in HOW the player improves, not just the
  // Overall number.
  function applyWeeklyTraining(p, mp) {
    if (!mp.trainingFocus) return;
    if (p.overall >= p.potential) return;
    var focus = TRAINING_FOCUSES.filter(function (f) { return f.key === mp.trainingFocus; })[0];
    if (!focus || focus.positions.indexOf(p.position) === -1) return;
    var chance = focus.key === "conditioning" ? 0.35 : 0.28;
    if (Math.random() > chance) return;
    var newOverall = U.clamp(p.overall + 1, p.overall, p.potential);
    var newAttributes = U.deriveAttributes(newOverall, p.position, p.archetype);
    if (focus.key !== "conditioning" && newAttributes[focus.key] != null) {
      newAttributes[focus.key] = U.clamp(newAttributes[focus.key] + 2, 40, 99);
    }
    S.updatePlayer(p.id, { overall: newOverall, attributes: newAttributes });
    if (newOverall > p.overall) {
      S.addNotification({ type: "career", title: "Training Payoff", body: "Your " + focus.label.toLowerCase() + " is paying off — Overall is now " + newOverall + "." });
    }
  }

  // ---------------- Tryouts (pre-draft) ------------------------------------
  // Each approach rolls an "impression score" on roughly the same 0-99 scale
  // as Overall, centered on your true Overall but with a risk/reward spread
  // that varies by approach — feeds the draft stock used to decide both how
  // early you're picked (see pickIndexFromStock) and a small one-time
  // Overall bump/penalty before Potential is even rolled (see
  // beginDraftDay), so a strong tryout tangibly pays off and a poor one has
  // a real (small) cost, without ever needing to touch a real player record.
  var TRYOUT_APPROACHES = [
    {
      key: "safe",
      label: "Play It Safe",
      desc: "Stick to fundamentals — a steady, low-risk showing.",
      roll: function (overall) { return U.clamp(overall + U.randInt(-5, 8), 20, 99); },
    },
    {
      key: "bold",
      label: "Show Off",
      desc: "Take risks to stand out — could dazzle scouts, could backfire.",
      roll: function (overall) { return U.clamp(overall + U.randInt(-18, 22), 10, 99); },
    },
    {
      key: "technical",
      label: "Focus on Fundamentals",
      desc: "A balanced, technically sound showing.",
      roll: function (overall) { return U.clamp(overall + U.randInt(-8, 12), 15, 99); },
    },
  ];

  function tryoutGrade(diff) {
    if (diff >= 15) return "Elite";
    if (diff >= 6) return "Great";
    if (diff >= -2) return "Good";
    if (diff >= -10) return "Average";
    return "Poor";
  }

  // Weighted toward whichever Prospect-division team is thinnest at your
  // position (and, as a tiebreak, smallest roster overall), with a random
  // jitter so it doubles as this player's "draft order" — a plausible
  // pick-by-pick sequence without needing a real draft board. Falls back to
  // any team at all if Prospect somehow has none (a heavily customized
  // league).
  function buildDraftOrder(position) {
    var teams = S.getTeams("prospect");
    if (!teams.length) teams = S.getTeams();
    var scored = teams.map(function (t) {
      var roster = S.getRoster(t.id);
      var atPos = roster.filter(function (p) { return p.position === position; }).length;
      var need = 1 / (1 + atPos) + (1 / (1 + roster.length)) * 0.3;
      return { t: t, key: need + Math.random() * 0.6 };
    });
    scored.sort(function (a, b) { return b.key - a.key; });
    return scored.map(function (s) { return s.t; });
  }

  // Better tryouts (higher average impression score) -> an earlier pick.
  function pickIndexFromStock(stock, teamCount) {
    if (!teamCount) return 0;
    var normalized = U.clamp(stock, 0, 99) / 99;
    var idx = Math.round((1 - normalized) * (teamCount - 1));
    return U.clamp(idx, 0, teamCount - 1);
  }

  function gameplanDef(key) {
    return GAMEPLANS.filter(function (g) { return g.key === key; })[0] || null;
  }

  function setGameplanChoice(key) {
    var d = S.getData();
    if (!d.myPlayer) return;
    d.myPlayer.gameplanChoice = key ? { key: key } : null;
    S.save();
  }

  // Called once, unconditionally, from the END of js/calendar.js
  // advanceWeek() — whichever game(s) this week's choice applied to have
  // already been simulated by that point (either via an earlier "Sim My
  // Game" preview, or by Advance Week itself), so the choice is spent.
  function clearGameplanChoiceForNextWeek() {
    if (!S.isBeAPlayerMode()) return;
    var d = S.getData();
    if (d.myPlayer) d.myPlayer.gameplanChoice = null;
    S.save();
  }

  // The opts object every sim call site (js/schedule.js, js/playoffs.js,
  // js/calendar.js simulateMyGamesThisWeek) now passes through to
  // js/sim.js — null in GM mode (a pure no-op, identical to omitting the
  // argument entirely), or between careers / once your player has retired.
  function activeSimOpts() {
    if (!S.isBeAPlayerMode()) return null;
    var mp = S.getMyPlayer();
    if (!mp || !mp.playerId) return null;
    var p = S.getPlayer(mp.playerId);
    if (!p || p.retired) return null;
    var opts = { forcePlayerId: p.id };
    var gp = mp.gameplanChoice;
    var def = gp && gp.key ? gameplanDef(gp.key) : null;
    var bias = def ? def.biasFor(p.position) : null;
    if (bias) opts.attributeBoost = bias;
    return opts;
  }

  // ---------------- Entering the league (amateur draft placement) --------
  // Deliberately NOT a full pick-by-pick draft board of the REAL player pool
  // — that machinery (js/startupDraft.js) exists to distribute that pool
  // across every team once per save, a very different job. Placement here
  // mirrors js/stats.js's breakout-rookie tiers instead (most prospects are
  // raw; a real difference-maker on day one is rare), just scoped to a
  // single player: rollPotential, generateRookieAge, deriveAttributes, and
  // the same 70%-of-asking-price entry contract the real Startup Draft uses
  // are all reused as-is. The tryouts + draft-day ceremony below (see
  // renderCareerCreationFlow) decides the actual Overall/team; this function
  // is a simpler, instant fallback path used only for programmatic/direct
  // creation (no UI ceremony) — kept because it's a reasonable public API in
  // its own right, not because anything here still calls it for the normal
  // "create a player" flow.
  function rollStartingOverall() {
    var roll = Math.random();
    if (roll < 0.05) return U.randInt(78, 86); // rare, can't-miss prospect
    if (roll < 0.25) return U.randInt(65, 78); // solid prospect
    return U.randInt(48, 64); // typical raw prospect — most common outcome
  }

  function createPlayerAndEnterDraft(opts) {
    opts = opts || {};
    var position = opts.position === "D" || opts.position === "G" ? opts.position : "F";
    var archetype = opts.archetype && archetypeExists(position, opts.archetype) ? opts.archetype : U.randomArchetype(position);
    var name = (opts.name || "").trim() || U.randomGamertag();
    var overall = rollStartingOverall();
    var potential = U.rollPotential(overall);
    var order = buildDraftOrder(position);
    var team = order.length ? order[0] : null;
    return finalizePlayerRecord({ name: name, position: position, archetype: archetype, overall: overall, potential: potential, team: team });
  }

  // The one place that actually writes the player record and points
  // data.myPlayer at them, however they got here (the instant path above,
  // or the tryouts/draft-day flow below).
  function finalizePlayerRecord(spec) {
    var age = U.generateRookieAge();
    var askingBase = U.salaryAsking(spec.overall, spec.potential);
    var entrySalary = Math.max(U.SALARY_MIN, Math.round((askingBase * 0.7) / 500) * 500);
    var player = {
      name: spec.name,
      position: spec.position,
      archetype: spec.archetype,
      overall: spec.overall,
      potential: spec.potential,
      attributes: U.deriveAttributes(spec.overall, spec.position, spec.archetype),
      salary: entrySalary,
      contractYears: 2,
      teamId: spec.team ? spec.team.id : null,
      isDraftProspect: false,
      age: age,
      retirementAge: U.retirementAgeFor(age),
      stats: S.freshStatLine(),
      careerStats: S.freshStatLine(),
      isMyPlayer: true,
    };
    var created = S.addPlayer(player);
    S.setMyPlayerId(created.id);
    var d = S.getData();
    d.myPlayer.pendingSendOff = null;
    d.myPlayer.tradeRequested = false;
    d.myPlayer.gameplanChoice = null;
    d.myPlayer.trainingFocus = null;
    d.myPlayer.milestonesHit = [];
    S.save();
    if (window.PHLInbox) {
      window.PHLInbox.addNotification({
        type: "career",
        title: "Welcome to the PHL",
        body: spec.team
          ? spec.team.name + " selected you in the amateur draft — welcome to the PHL!"
          : "You've entered the league as a " + spec.position + " — no team was available to place you on yet.",
      });
    }
    return created;
  }

  // ---------------- Career creation flow (tryouts -> draft day) -----------
  // A small multi-step wizard shared by js/createSave.js (a save's very
  // first career) and My Career's own "no player yet" / send-off screens
  // (every career after a retirement). `el` is mounted fresh each step
  // (its innerHTML is fully owned by this flow); `onComplete(createdPlayer)`
  // fires once the player is actually created. Resumable: calling this
  // again with the flow already in progress just re-renders wherever it
  // left off (e.g. after switching tabs and back), it does not restart.
  function renderCareerCreationFlow(el, onComplete) {
    flowContainer = el;
    onCareerCreated = onComplete;
    if (!creationFlow) {
      creationFlow = {
        step: "form",
        form: { name: "", position: "F", archetype: "" },
        overall: null,
        potential: null,
        draftStock: null,
        tryoutTeams: [],
        tryoutIndex: 0,
        impressions: [],
        draftOrder: [],
        pickIndex: 0,
        team: null,
        revealIndex: 0,
      };
    }
    renderFlowStep();
  }

  function renderFlowStep() {
    if (!flowContainer || !creationFlow) return;
    if (creationFlow.step === "tryouts") renderFlowTryoutStep();
    else if (creationFlow.step === "draft") renderFlowDraftStep();
    else renderFlowFormStep();
  }

  function renderFlowFormStep() {
    var f = creationFlow.form;
    if (!f.archetype || !archetypeExists(f.position, f.archetype)) f.archetype = U.randomArchetype(f.position);
    var html = '<div class="form-card"><h3>Create Your Player</h3>';
    html += '<p class="muted small">You\'ll try out for a few Prospect-division teams, then find out where the amateur draft sends you.</p>';
    html += '<div class="form-grid">';
    html += '<label>Name<input type="text" id="cf-name" value="' + U.escapeHtml(f.name) + '" placeholder="Leave blank for a random gamertag"></label>';
    html += '<label>Position<select id="cf-position">' + positionOptions(f.position) + "</select></label>";
    html += '<label>Archetype<select id="cf-archetype">' + archetypeOptions(f.position, f.archetype) + "</select></label>";
    html += "</div>";
    html += '<div class="form-actions"><button class="btn btn-primary" data-action="begin-tryouts">Begin Tryouts &raquo;</button></div>';
    html += "</div>";
    flowContainer.innerHTML = html;
    var nameInput = flowContainer.querySelector("#cf-name");
    if (nameInput) nameInput.addEventListener("input", function (e) { f.name = e.target.value; });
    var posSel = flowContainer.querySelector("#cf-position");
    if (posSel) posSel.addEventListener("change", function (e) {
      f.position = e.target.value;
      f.archetype = U.randomArchetype(f.position);
      renderFlowFormStep();
    });
    var archSel = flowContainer.querySelector("#cf-archetype");
    if (archSel) archSel.addEventListener("change", function (e) { f.archetype = e.target.value; });
    var beginBtn = flowContainer.querySelector('[data-action="begin-tryouts"]');
    if (beginBtn) beginBtn.addEventListener("click", beginTryouts);
  }

  function beginTryouts() {
    var f = creationFlow.form;
    creationFlow.overall = rollStartingOverall();
    var teams = S.getTeams("prospect");
    if (!teams.length) teams = S.getTeams();
    var shuffled = teams.slice().sort(function () { return Math.random() - 0.5; });
    creationFlow.tryoutTeams = shuffled.slice(0, Math.min(3, shuffled.length));
    creationFlow.tryoutIndex = 0;
    creationFlow.impressions = [];
    creationFlow.step = "tryouts";
    renderFlowStep();
  }

  function renderFlowTryoutStep() {
    var idx = creationFlow.tryoutIndex;
    if (!creationFlow.tryoutTeams.length || idx >= creationFlow.tryoutTeams.length) {
      renderFlowTryoutSummary();
      return;
    }
    var team = creationFlow.tryoutTeams[idx];
    var html = '<div class="form-card"><h3>Tryout ' + (idx + 1) + " of " + creationFlow.tryoutTeams.length + " &mdash; " +
      U.crestHtml(team, "crest-sm") + U.escapeHtml(team.name) + "</h3>";
    html += '<p class="muted small">How do you want to approach this tryout?</p>';
    html += '<div class="chip-row">';
    TRYOUT_APPROACHES.forEach(function (a) {
      html += '<button class="chip" data-approach="' + a.key + '" title="' + U.escapeHtml(a.desc) + '">' + U.escapeHtml(a.label) + "</button>";
    });
    html += "</div></div>";
    flowContainer.innerHTML = html;
    flowContainer.querySelectorAll("[data-approach]").forEach(function (b) {
      b.addEventListener("click", function () { runTryout(team, b.dataset.approach); });
    });
  }

  function runTryout(team, approachKey) {
    var approach = TRYOUT_APPROACHES.filter(function (a) { return a.key === approachKey; })[0] || TRYOUT_APPROACHES[0];
    var score = approach.roll(creationFlow.overall);
    creationFlow.impressions.push({ teamId: team.id, teamName: team.name, approachLabel: approach.label, score: score });
    creationFlow.tryoutIndex += 1;
    renderFlowStep();
  }

  function renderFlowTryoutSummary() {
    var html = '<div class="form-card"><h3>Tryout Results</h3>';
    html += '<table class="data-table compact"><thead><tr><th>Team</th><th>Approach</th><th>Grade</th></tr></thead><tbody>';
    creationFlow.impressions.forEach(function (imp) {
      var diff = imp.score - creationFlow.overall;
      html += "<tr><td>" + U.escapeHtml(imp.teamName) + "</td><td>" + U.escapeHtml(imp.approachLabel) + "</td><td>" + tryoutGrade(diff) + "</td></tr>";
    });
    html += "</tbody></table>";
    html += '<div class="form-actions"><button class="btn btn-primary" data-action="continue-to-draft">Continue to Draft Day &raquo;</button></div>';
    html += "</div>";
    flowContainer.innerHTML = html;
    flowContainer.querySelector('[data-action="continue-to-draft"]').addEventListener("click", beginDraftDay);
  }

  function beginDraftDay() {
    var avgStock = creationFlow.impressions.length ? U.avg(creationFlow.impressions.map(function (i) { return i.score; })) : creationFlow.overall;
    var bump = U.clamp(Math.round((avgStock - creationFlow.overall) / 6), -3, 3);
    var finalOverall = U.clamp(creationFlow.overall + bump, 30, 99);
    creationFlow.overall = finalOverall;
    creationFlow.potential = U.rollPotential(finalOverall);
    creationFlow.draftStock = avgStock;
    creationFlow.draftOrder = buildDraftOrder(creationFlow.form.position);
    creationFlow.pickIndex = pickIndexFromStock(avgStock, creationFlow.draftOrder.length);
    creationFlow.team = creationFlow.draftOrder.length ? creationFlow.draftOrder[creationFlow.pickIndex] : null;
    creationFlow.revealIndex = 0;
    creationFlow.step = "draft";
    renderFlowStep();
  }

  function renderFlowDraftStep() {
    var html = '<div class="form-card"><h3>Draft Day</h3>';
    html += '<p class="muted small">The Prospect-division amateur draft is underway.</p>';
    if (!creationFlow.draftOrder.length) {
      html += '<p class="muted">No Prospect-division teams available to draft you — entering as a free agent instead.</p>';
      html += '<div class="form-actions"><button class="btn btn-primary" data-action="finalize-career">Enter the League &raquo;</button></div></div>';
      flowContainer.innerHTML = html;
      flowContainer.querySelector('[data-action="finalize-career"]').addEventListener("click", finalizeCareerCreation);
      return;
    }
    html += '<div class="draft-pool-scroll"><table class="data-table compact"><thead><tr><th>Pick</th><th>Team</th><th>Selection</th></tr></thead><tbody>';
    for (var i = 0; i <= creationFlow.revealIndex && i < creationFlow.draftOrder.length; i++) {
      var t = creationFlow.draftOrder[i];
      var mine = i === creationFlow.pickIndex;
      html += "<tr" + (mine ? ' class="draft-pool-top-pick"' : "") + "><td>" + (i + 1) + "</td><td>" + U.crestHtml(t, "crest-sm") + U.escapeHtml(t.name) + "</td><td>" +
        (mine ? "<strong>YOU — " + U.escapeHtml((creationFlow.form.name || "").trim() || "your player") + "!</strong>" : "selects a prospect") + "</td></tr>";
    }
    html += "</tbody></table></div>";
    if (creationFlow.revealIndex < creationFlow.pickIndex) {
      html += '<div class="form-actions">';
      html += '<button class="btn btn-primary" data-action="reveal-next-pick">Reveal Next Pick</button>';
      html += '<button class="btn" data-action="skip-to-my-pick">Skip to My Pick</button>';
      html += "</div>";
    } else {
      html += '<p class="pill pill-mvp">&#127942; ' + U.escapeHtml(creationFlow.team ? creationFlow.team.name : "A team") + " selects you!</p>";
      html += '<div class="form-actions"><button class="btn btn-primary" data-action="finalize-career">Enter the League &raquo;</button></div>';
    }
    html += "</div>";
    flowContainer.innerHTML = html;
    var nextBtn = flowContainer.querySelector('[data-action="reveal-next-pick"]');
    if (nextBtn) nextBtn.addEventListener("click", function () { creationFlow.revealIndex += 1; renderFlowStep(); });
    var skipBtn = flowContainer.querySelector('[data-action="skip-to-my-pick"]');
    if (skipBtn) skipBtn.addEventListener("click", function () { creationFlow.revealIndex = creationFlow.pickIndex; renderFlowStep(); });
    var finalizeBtn = flowContainer.querySelector('[data-action="finalize-career"]');
    if (finalizeBtn) finalizeBtn.addEventListener("click", finalizeCareerCreation);
  }

  function finalizeCareerCreation() {
    var f = creationFlow.form;
    var name = (f.name || "").trim() || U.randomGamertag();
    var created = finalizePlayerRecord({
      name: name,
      position: f.position,
      archetype: f.archetype,
      overall: creationFlow.overall,
      potential: creationFlow.potential,
      team: creationFlow.team,
    });
    creationFlow = null;
    var cb = onCareerCreated;
    onCareerCreated = null;
    if (cb) cb(created);
  }

  // ---------------- Trade requests ----------------------------------------
  function setTradeRequested(flag) {
    var d = S.getData();
    if (!d.myPlayer) return;
    d.myPlayer.tradeRequested = !!flag;
    S.save();
  }

  // Fully automatic — no accept/reject step, unlike an AI's trade offer TO
  // a GM (js/aiManager.js aiProposeTradesToUser, which never fires in Be A
  // Player mode since it requires a franchise.teamId). Looks for an
  // in-division partner needing your position, willing to send back a
  // roughly fair-value player at your own asking price (reusing
  // js/trades.js tradeValue — the same estimate the GM-facing Trades tab
  // shows), and resolves over the following weeks rather than instantly so
  // it doesn't feel like a light switch.
  function checkTradeRequest(p, mp) {
    if (!mp.tradeRequested || !p.teamId) return;
    if (!S.isTransactionWindowOpen()) return;
    if (Math.random() > 0.4) return; // some weeks nothing happens — feels like a real front office
    var Trades = window.PHLTrades;
    if (!Trades) return;
    var myTeam = S.getTeam(p.teamId);
    if (!myTeam) return;
    var partners = S.getTeams(myTeam.division).filter(function (t) { return t.id !== myTeam.id; });
    if (!partners.length) return;
    var myValue = Trades.tradeValue(p);
    var best = null;
    partners.forEach(function (partner) {
      var roster = S.getRoster(partner.id);
      if (roster.length < 6) return;
      roster.filter(function (c) { return c.position === p.position; }).forEach(function (c) {
        if (!S.meetsOverallCap(c.overall, myTeam.division) || !S.meetsOverallFloor(c.overall, myTeam.division)) return;
        if (!S.meetsOverallCap(p.overall, partner.division) || !S.meetsOverallFloor(p.overall, partner.division)) return;
        var diff = Math.abs(Trades.tradeValue(c) - myValue);
        if (!best || diff < best.diff) best = { partner: partner, ret: c, diff: diff };
      });
    });
    if (!best || best.diff > myValue * 0.2) return; // nothing close enough to a fair swap this week
    if (!S.wouldMeetRosterMinimum(myTeam.id, [p.id], [best.ret])) return;
    if (!S.wouldMeetRosterMinimum(best.partner.id, [best.ret.id], [p])) return;
    if (!S.wouldMeetGoalieMax(myTeam.id, [p.id], [best.ret])) return;
    if (!S.wouldMeetGoalieMax(best.partner.id, [best.ret.id], [p])) return;

    var oldTeamName = myTeam.name;
    S.updatePlayer(p.id, { teamId: best.partner.id });
    S.updatePlayer(best.ret.id, { teamId: myTeam.id });
    S.addTrade({
      season: S.getSeasonNumber(),
      teamAId: myTeam.id,
      teamBId: best.partner.id,
      playersToB: [p.id],
      playersToA: [best.ret.id],
    });
    setTradeRequested(false);
    if (window.PHLInbox) {
      window.PHLInbox.addNotification({
        type: "career",
        title: "You've been traded!",
        body: "Your trade request came through — " + oldTeamName + " sent you to " + best.partner.name + " for " + best.ret.name + ".",
      });
    }
  }

  // ---------------- Contract offers ----------------------------------------
  function pendingContractOfferExists(playerId) {
    return S.getNotifications().some(function (n) {
      return n.type === "player-contract-offer" && n.payload && n.payload.playerId === playerId;
    });
  }

  // Picks a team willing to sign a free-agent player at their asking price
  // — same eligibility rules (overall cap/floor, goalie sub-cap, cap space)
  // js/aiManager.js aiSignFreeAgents already enforces for AI signings,
  // reused here so a free-agent stretch for your own player behaves the
  // same way it would for anyone else in the league.
  function pickSigningTeam(p) {
    var candidates = S.getTeams().filter(function (t) {
      if (!S.meetsOverallCap(p.overall, t.division) || !S.meetsOverallFloor(p.overall, t.division)) return false;
      if (p.position === "G" && S.goalieCountForTeam(t.id) >= S.GOALIE_MAX) return false;
      var division = S.getDivision(t.division);
      var asking = U.contractAskingPrice(p, division ? division.tier : null);
      return asking <= S.capSpace(t.id);
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return b.overall - a.overall; }); // no-op tiebreak, just deterministic-ish
    return U.pick(candidates.slice(0, Math.min(5, candidates.length)));
  }

  function checkContractOffer(p, mp) {
    if (pendingContractOfferExists(p.id)) return;
    if (!S.isTransactionWindowOpen()) return;
    var isReSign = !!p.teamId;
    if (isReSign && (p.contractYears == null || p.contractYears > 1)) return; // not expiring yet
    var team = isReSign ? S.getTeam(p.teamId) : pickSigningTeam(p);
    if (!team) return;
    var division = S.getDivision(team.division);
    var asking = U.contractAskingPrice(p, division ? division.tier : null);
    var years = U.randInt(2, 4);
    S.addNotification({
      type: "player-contract-offer",
      title: team.name + (isReSign ? " wants to re-sign you" : " wants to sign you"),
      body: team.name + " is offering a " + years + "-year deal at " + U.formatMoney(asking) + (isReSign ? " to keep you" : " as a free agent") + ".",
      actionable: true,
      payload: { playerId: p.id, teamId: team.id, salary: asking, years: years, isReSign: isReSign },
    });
  }

  function resolveContractOffer(notif, accept) {
    var payload = notif.payload;
    if (!payload) { S.removeNotification(notif.id); return; }
    if (!accept) { S.removeNotification(notif.id); return; }
    var p = S.getPlayer(payload.playerId);
    var team = S.getTeam(payload.teamId);
    if (!p || !team) { S.removeNotification(notif.id); return; }
    S.updatePlayer(p.id, { teamId: team.id, contractYears: payload.years, salary: payload.salary, eligibleDivisions: null });
    S.addSigning({ teamId: team.id, playerId: p.id, playerName: p.name, mode: payload.isReSign ? "re-sign" : "sign", salary: payload.salary, years: payload.years });
    S.removeNotification(notif.id);
    if (window.PHLInbox) {
      window.PHLInbox.addNotification({
        type: "career",
        title: "Contract signed",
        body: "You signed a " + payload.years + "-year deal with " + team.name + ".",
      });
    }
    if (window.PHLApp) window.PHLApp.refreshAll();
  }

  // ---------------- Career milestones --------------------------------------
  var SKATER_MILESTONES = [50, 100, 250, 500, 1000];
  var GOALIE_MILESTONES = [25, 50, 100, 200, 400]; // career games played

  function checkMilestones(p, mp) {
    if (!mp.milestonesHit) mp.milestonesHit = [];
    var cs = p.careerStats || S.freshStatLine();
    var cur = p.stats || S.freshStatLine();
    // Fold in the CURRENT (in-progress) season too, so a milestone lands
    // the moment it's actually hit instead of waiting for season-end
    // rollover into careerStats.
    var liveGp = (cs.gp || 0) + (cur.gp || 0);
    var livePts = (cs.pts || 0) + (cur.pts || 0);
    var hit = false;
    var list = p.position === "G" ? GOALIE_MILESTONES : SKATER_MILESTONES;
    var value = p.position === "G" ? liveGp : livePts;
    var label = p.position === "G" ? " career games played!" : " career points!";
    list.forEach(function (m) {
      var key = (p.position === "G" ? "gp-" : "pts-") + m;
      if (value >= m && mp.milestonesHit.indexOf(key) === -1) {
        mp.milestonesHit.push(key);
        hit = true;
        S.addNotification({ type: "career", title: "Career Milestone", body: "You've reached " + m + label });
      }
    });
    if (hit) S.save();
  }

  // ---------------- Retirement send-off ------------------------------------
  function handleRetirement(p) {
    var d = S.getData();
    var mp = d.myPlayer;
    if (mp.pendingSendOff) return; // already queued — waiting on the user to view My Career
    var cs = p.careerStats || S.freshStatLine();
    var HOF = window.PHLHallOfFame;
    var isHof = S.isHallOfFamer(p.id);
    var summary = {
      playerId: p.id,
      name: p.name,
      position: p.position,
      archetype: p.archetype,
      careerStats: JSON.parse(JSON.stringify(cs)),
      awardCount: HOF ? HOF.careerAwardCount(p.id) : 0,
      hallOfFame: isHof,
      hofScore: HOF ? Math.round(HOF.hofScore(p)) : null,
      finishedSeason: S.getSeasonNumber(),
    };
    mp.pastCareers = mp.pastCareers || [];
    mp.pastCareers.push(summary);
    mp.pendingSendOff = summary;
    mp.playerId = null;
    mp.tradeRequested = false;
    mp.gameplanChoice = null;
    mp.trainingFocus = null;
    mp.milestonesHit = [];
    S.save();
    S.addNotification({
      type: "career",
      title: "Career Over — " + p.name + " has retired",
      body: "Your playing career has ended. Visit My Career for your send-off, then start a new one whenever you're ready.",
    });
  }

  // The one hook js/calendar.js advanceWeek() calls every week — a no-op
  // outside Be A Player mode, and between careers (no playerId set).
  function weeklyCheck() {
    if (!S.isBeAPlayerMode()) return;
    var mp = S.getMyPlayer();
    if (!mp || !mp.playerId) return;
    var p = S.getPlayer(mp.playerId);
    if (!p) return;
    if (p.retired) {
      handleRetirement(p);
      return;
    }
    checkContractOffer(p, mp);
    checkTradeRequest(p, mp);
    checkMilestones(p, mp);
    applyWeeklyTraining(p, mp);
  }

  // ---------------- Rendering (My Career tab) ------------------------------
  function statLine(p) {
    var s = p.stats || S.freshStatLine();
    if (p.position === "G") {
      return "This season: " + s.gp + " GP, " + ((s.svPct || 0) * 100).toFixed(1) + "% SV%, " + U.round1(s.gaa || 0) + " GAA";
    }
    return "This season: " + s.gp + " GP, " + s.g + " G, " + s.a + " A, " + s.pts + " PTS";
  }
  function careerLine(p) {
    var cs = p.careerStats || S.freshStatLine();
    if (p.position === "G") {
      return "Career: " + cs.gp + " GP, " + ((cs.svPct || 0) * 100).toFixed(1) + "% SV%, " + U.round1(cs.gaa || 0) + " GAA";
    }
    return "Career: " + cs.gp + " GP, " + cs.g + " G, " + cs.a + " A, " + cs.pts + " PTS";
  }

  function positionOptions(selected) {
    var labels = { F: "Forward", D: "Defense", G: "Goalie" };
    return ["F", "D", "G"].map(function (pos) {
      return '<option value="' + pos + '"' + (pos === selected ? " selected" : "") + ">" + labels[pos] + "</option>";
    }).join("");
  }
  function archetypeOptions(position, selected) {
    var list = U.archetypesFor(position);
    return list.map(function (a) {
      return '<option value="' + U.escapeHtml(a.name) + '"' + (a.name === selected ? " selected" : "") + ">" + U.escapeHtml(a.name) + "</option>";
    }).join("");
  }

  function renderSendOff(summary) {
    var html = '<div class="panel-header"><h2>My Career</h2></div>';
    html += '<div class="empty-state"><h3>Career Over — ' + U.escapeHtml(summary.name) + "</h3>";
    var cs = summary.careerStats || S.freshStatLine();
    var statText = summary.position === "G"
      ? cs.gp + " games played, " + ((cs.svPct || 0) * 100).toFixed(1) + "% career save percentage, " + U.round1(cs.gaa || 0) + " GAA"
      : cs.gp + " games played, " + cs.pts + " career points (" + cs.g + " goals, " + cs.a + " assists)";
    html += "<p>" + U.escapeHtml(statText) + ".</p>";
    html += "<p>" + summary.awardCount + " career award(s) won.</p>";
    html += summary.hallOfFame
      ? '<p class="pill pill-mvp">&#127942; Inducted into the PHL Hall of Fame!</p>'
      : (summary.hofScore != null ? '<p class="muted small">Hall of Fame score: ' + summary.hofScore + " (220+ needed for induction)</p>" : "");
    html += "<p>Retired after Season " + summary.finishedSeason + ".</p></div>";
    html += '<div id="mc-flow-root"></div>';
    return html;
  }

  function renderThisWeek(p) {
    var Cal = window.PHLCalendar;
    var games = Cal ? Cal.myUnplayedGamesThisWeek() : [];
    var mp = S.getMyPlayer();
    var html = '<div class="hub-section"><h4>This Week</h4>';
    if (!games.length) {
      html += '<p class="muted small">No game to prep for right now.</p></div>';
      return html;
    }
    html += '<ul class="mini-standings">';
    games.forEach(function (g) {
      var isHome = g.homeTeamId === p.teamId;
      var opp = S.getTeam(isHome ? g.awayTeamId : g.homeTeamId);
      html += "<li><span>" + (isHome ? "vs " : "@ ") + U.escapeHtml(opp ? opp.abbr : "?") + "</span></li>";
    });
    html += "</ul>";
    html += '<p class="muted small">Pick a gameplan for this week\'s game(s):</p><div class="chip-row">';
    GAMEPLANS.forEach(function (g) {
      var active = mp.gameplanChoice && mp.gameplanChoice.key === g.key;
      html += '<button class="chip' + (active ? " chip-active" : "") + '" data-gameplan="' + g.key + '" title="' + U.escapeHtml(g.desc) + '">' + U.escapeHtml(g.label) + "</button>";
    });
    html += "</div>";
    html += '<button class="btn btn-primary btn-sm" data-action="sim-my-games" style="margin-top:8px">Sim My Game' + (games.length > 1 ? "s" : "") + "</button>";
    html += "</div>";
    return html;
  }

  function renderTrainingSection(p, mp) {
    var options = trainingFocusesFor(p.position);
    var html = '<div class="hub-section"><h4>Training Focus</h4>';
    if (p.overall >= p.potential) {
      html += '<p class="muted small">You\'ve reached your full potential (' + p.potential + ' Overall) — nothing left to train toward.</p></div>';
      return html;
    }
    html += '<p class="muted small">Pick a standing focus to work on between games — a weekly chance to nudge your Overall (and that attribute) toward your Potential of ' + p.potential + '.</p>';
    html += '<div class="chip-row">';
    options.forEach(function (f) {
      var active = mp.trainingFocus === f.key;
      html += '<button class="chip' + (active ? " chip-active" : "") + '" data-training="' + f.key + '" title="' + U.escapeHtml(f.desc) + '">' + U.escapeHtml(f.label) + "</button>";
    });
    html += "</div>";
    if (mp.trainingFocus) {
      html += '<button class="btn btn-sm" style="margin-top:8px" data-action="clear-training">Stop Training Focus</button>';
    }
    html += "</div>";
    return html;
  }

  function renderHub(p) {
    var mp = S.getMyPlayer();
    var team = p.teamId ? S.getTeam(p.teamId) : null;
    var division = team ? S.getDivision(team.division) : null;
    var isHof = S.isHallOfFamer(p.id);

    var html = '<div class="panel-header"><h2>My Career</h2></div>';
    html += '<div class="form-card"><h3>' + U.escapeHtml(p.name) + (isHof ? ' <span class="pill pill-mvp small">&#127942; HOF</span>' : "") + "</h3>";
    html += '<p class="muted small">' + U.escapeHtml(p.position) + " &middot; " + U.escapeHtml(p.archetype || "") +
      (team ? " &middot; " + U.crestHtml(team, "crest-sm") + U.escapeHtml(team.name) + (division ? " (" + U.escapeHtml(division.name) + ")" : "") : " &middot; Free Agent") + "</p>";
    html += '<div class="stat-tile-row">';
    html += '<div class="stat-tile"><div class="stat-tile-value">' + p.overall + '</div><div class="stat-tile-label">Overall</div></div>';
    html += '<div class="stat-tile"><div class="stat-tile-value">' + p.potential + '</div><div class="stat-tile-label">Potential</div></div>';
    html += '<div class="stat-tile"><div class="stat-tile-value">' + U.formatMoney(p.salary) + '</div><div class="stat-tile-label">Salary</div></div>';
    html += '<div class="stat-tile"><div class="stat-tile-value">' + (p.contractYears != null ? p.contractYears : "&mdash;") + '</div><div class="stat-tile-label">Years Left</div></div>';
    html += "</div>";
    html += '<p class="muted small">' + U.escapeHtml(statLine(p)) + " &middot; " + U.escapeHtml(careerLine(p)) + "</p>";
    html += "</div>";

    html += '<div class="dashboard-hub-grid">';
    html += renderThisWeek(p);
    html += renderTrainingSection(p, mp);

    html += '<div class="hub-section"><h4>Trade Request</h4>';
    if (mp.tradeRequested) {
      html += '<p class="pill pill-warn small">Trade request active — your team\'s AI front office may move you in the coming weeks.</p>';
      html += '<button class="btn btn-sm" data-action="cancel-trade-request">Cancel Request</button>';
    } else {
      html += '<p class="muted small">Not happy where you are? Ask your team\'s AI front office to move you.</p>';
      html += '<button class="btn btn-sm"' + (team ? "" : " disabled") + ' data-action="request-trade">Request a Trade</button>';
    }
    html += "</div>";

    var notifs = S.getNotifications().filter(function (n) { return n.type === "career" || n.type === "player-contract-offer"; }).slice(0, 6);
    html += '<div class="hub-section"><h4>Career Updates</h4>';
    if (!notifs.length) {
      html += '<p class="muted small">Nothing yet — check back after advancing a few weeks.</p>';
    } else {
      html += '<div class="inbox-list">';
      notifs.forEach(function (n) {
        html += '<div class="inbox-item' + (n.read ? "" : " inbox-item-unread") + '" data-id="' + n.id + '">';
        html += '<div class="inbox-item-body">';
        html += '<div class="inbox-item-title">' + U.escapeHtml(n.title || "") + "</div>";
        html += '<div class="inbox-item-text muted small">' + U.escapeHtml(n.body || "") + "</div>";
        if (n.actionable && n.type === "player-contract-offer") {
          html += '<div class="form-actions">' +
            '<button class="btn btn-sm btn-primary" data-action="accept-contract" data-id="' + n.id + '">Accept</button>' +
            '<button class="btn btn-sm btn-danger" data-action="reject-contract" data-id="' + n.id + '">Reject</button></div>';
        }
        html += "</div></div>";
      });
      html += "</div>";
    }
    html += "</div>";

    if (mp.pastCareers && mp.pastCareers.length) {
      html += '<div class="hub-section"><h4>Past Careers</h4><ul class="mini-standings">';
      mp.pastCareers.slice().reverse().forEach(function (c) {
        html += "<li><span>" + U.escapeHtml(c.name) + " (" + U.escapeHtml(c.position) + ")</span><span>" +
          (c.hallOfFame ? "HOF" : c.careerStats ? c.careerStats.pts + " PTS" : "") + "</span></li>";
      });
      html += "</ul></div>";
    }
    html += "</div>"; // .dashboard-hub-grid
    return html;
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    if (!S.isBeAPlayerMode()) {
      container.innerHTML = '<div class="panel-header"><h2>My Career</h2></div><p class="muted">This save is running in GM Franchise mode — My Career is only for Be A Player saves.</p>';
      return;
    }
    var mp = S.getMyPlayer();
    var html;
    if (mp && mp.pendingSendOff) {
      html = renderSendOff(mp.pendingSendOff);
      container.innerHTML = html;
      var sendOffRoot = container.querySelector("#mc-flow-root");
      renderCareerCreationFlow(sendOffRoot, function () {
        render();
        if (window.PHLApp) window.PHLApp.refreshAll();
      });
      return;
    }
    var p = mp && mp.playerId ? S.getPlayer(mp.playerId) : null;
    if (!p) {
      html = '<div class="panel-header"><h2>My Career</h2></div><div id="mc-flow-root"></div>';
      container.innerHTML = html;
      var flowRoot = container.querySelector("#mc-flow-root");
      renderCareerCreationFlow(flowRoot, function () {
        render();
        if (window.PHLApp) window.PHLApp.refreshAll();
      });
      return;
    }
    container.innerHTML = renderHub(p);
    wireHub();
  }

  function wireHub() {
    container.querySelectorAll("[data-gameplan]").forEach(function (b) {
      b.addEventListener("click", function () {
        setGameplanChoice(b.dataset.gameplan);
        render();
      });
    });
    container.querySelectorAll("[data-training]").forEach(function (b) {
      b.addEventListener("click", function () {
        setTrainingFocus(b.dataset.training);
        render();
      });
    });
    var clearTraining = container.querySelector('[data-action="clear-training"]');
    if (clearTraining) clearTraining.addEventListener("click", function () { setTrainingFocus(null); render(); });
    var simBtn = container.querySelector('[data-action="sim-my-games"]');
    if (simBtn) simBtn.addEventListener("click", function () {
      var games = window.PHLCalendar ? window.PHLCalendar.simulateMyGamesThisWeek() : [];
      render();
      if (window.PHLApp) window.PHLApp.refreshAll();
      if (games.length && window.PHLBoxscoreModal) {
        window.PHLBoxscoreModal.showGames(games, { title: games.length > 1 ? "Your Games This Week" : "Your Game This Week" });
      }
    });
    var reqTrade = container.querySelector('[data-action="request-trade"]');
    if (reqTrade) reqTrade.addEventListener("click", function () { setTradeRequested(true); render(); });
    var cancelTrade = container.querySelector('[data-action="cancel-trade-request"]');
    if (cancelTrade) cancelTrade.addEventListener("click", function () { setTradeRequested(false); render(); });
    container.querySelectorAll('[data-action="accept-contract"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var notif = S.getNotifications().find(function (n) { return n.id === b.dataset.id; });
        if (notif) resolveContractOffer(notif, true);
        render();
      });
    });
    container.querySelectorAll('[data-action="reject-contract"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var notif = S.getNotifications().find(function (n) { return n.id === b.dataset.id; });
        if (notif) resolveContractOffer(notif, false);
        render();
      });
    });
  }

  window.PHLCareerMode = {
    render: render,
    weeklyCheck: weeklyCheck,
    activeSimOpts: activeSimOpts,
    setGameplanChoice: setGameplanChoice,
    clearGameplanChoiceForNextWeek: clearGameplanChoiceForNextWeek,
    createPlayerAndEnterDraft: createPlayerAndEnterDraft,
    resolveContractOffer: resolveContractOffer,
    renderCareerCreationFlow: renderCareerCreationFlow,
    setTrainingFocus: setTrainingFocus,
    TRAINING_FOCUSES: TRAINING_FOCUSES,
    GAMEPLANS: GAMEPLANS,
  };
})();
