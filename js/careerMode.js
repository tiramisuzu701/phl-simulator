/* PHL Franchise Simulator — Be A Player mode
 * Global namespace: window.PHLCareerMode
 *
 * You are ONE player on the league, not a GM — an AI runs your team's
 * roster, contracts, trades and lineup exactly like it runs every other
 * team (see js/state.js myTeamId/isUserRelevantTeam, and the fact that
 * Be A Player mode deliberately never sets data.franchise.teamId, which is
 * what keeps js/aiManager.js treating your team as fully AI-managed). This
 * module is the home for everything that IS yours to experience:
 *   - Entering the league: tryout invitations, tryouts, and a real
 *     pick-by-pick amateur draft (renderCareerCreationFlow) whenever a
 *     career starts or restarts.
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
  // that varies by approach. The average feeds your draft stock (how highly
  // every team values you on draft day) and a small one-time Overall
  // bump/penalty; each team's OWN grade additionally makes that specific
  // team more (or less) eager to draft you (see GRADE_TEAM_BONUS).
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
      roll: function (overall) { return U.clamp(overall + U.randInt(-16, 20), 10, 99); },
    },
    {
      key: "technical",
      label: "Focus on Fundamentals",
      desc: "A balanced, technically sound showing.",
      roll: function (overall) { return U.clamp(overall + U.randInt(-8, 12), 15, 99); },
    },
  ];

  var INVITE_COUNT = 5;
  var MAX_TRYOUTS = 3;
  var DRAFT_ROUNDS = 2;

  function tryoutGrade(diff) {
    if (diff >= 12) return "Elite";
    if (diff >= 5) return "Great";
    if (diff >= -2) return "Good";
    if (diff >= -8) return "Average";
    return "Poor";
  }
  var GRADE_TEAM_BONUS = { Elite: 9, Great: 5, Good: 2, Average: 0, Poor: -5 };
  var GRADE_PILL = { Elite: "pill-mvp", Great: "pill-clinch", Good: "pill-accent", Average: "pill-warn", Poor: "pill-loss" };
  var SCOUT_QUOTES = {
    Elite: [
      "Scouts were buzzing — you were the best player on the ice all session.",
      "Their GM pulled you aside afterward to ask about your plans for draft day.",
    ],
    Great: [
      "You clearly stood out — a couple of scouts were scribbling notes all session.",
      "The coaches liked what they saw. You're firmly on their board now.",
    ],
    Good: [
      "A solid, professional showing. You did your job.",
      "Nothing flashy, but you gave them no reason to worry either.",
    ],
    Average: [
      "You blended in with the pack — hard to remember afterward.",
      "A few good shifts, a few forgettable ones.",
    ],
    Poor: [
      "Rough day. A couple of turnovers stuck with the scouts.",
      "Nerves got the better of you — they'll need convincing.",
    ],
  };
  function scoutQuote(grade) {
    var list = SCOUT_QUOTES[grade] || SCOUT_QUOTES.Good;
    return list[U.randInt(0, list.length - 1)];
  }

  function prospectTeams() {
    var teams = S.getTeams("prospect");
    return teams.length ? teams : S.getTeams();
  }
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Used only by the instant, no-ceremony createPlayerAndEnterDraft path:
  // weighted toward whichever Prospect team is thinnest at your position.
  function buildDraftOrder(position) {
    var scored = prospectTeams().map(function (t) {
      var roster = S.getRoster(t.id);
      var atPos = roster.filter(function (p) { return p.position === position; }).length;
      var need = 1 / (1 + atPos) + (1 / (1 + roster.length)) * 0.3;
      return { t: t, key: need + Math.random() * 0.6 };
    });
    scored.sort(function (a, b) { return b.key - a.key; });
    return scored.map(function (s) { return s.t; });
  }

  // The rest of this year's amateur class — real, named rookies. The ones
  // that actually get drafted are written into the league as real players
  // on the teams that picked them (see finalizeCareerCreation); undrafted
  // ones are simply never created.
  function generateDraftClass(count) {
    var list = [];
    for (var i = 0; i < count; i++) {
      var roll = Math.random();
      var position = roll < 0.45 ? "F" : roll < 0.8 ? "D" : "G";
      var overall = U.randInt(42, 66);
      var potential = U.rollPotential(overall);
      list.push({
        isUser: false,
        name: U.randomGamertag(),
        position: position,
        archetype: U.randomArchetype(position),
        overall: overall,
        potential: potential,
        // How the league's scouts collectively rate this prospect — true
        // ability plus noise, with a little credit for upside.
        value: overall + U.randInt(-6, 6) + (potential - 90) * 0.25,
      });
    }
    return list;
  }

  // Simulates the whole two-round Prospect-division amateur draft up front
  // (nothing is written to the save until finalizeCareerCreation), so the
  // draft-day screen can then reveal it pick by pick. Each team takes the
  // best prospect it can fit (roster max, goalie max), with a small bump
  // for positions it's thin at — and, for YOU specifically, a bump or
  // penalty from how your tryout with that team went.
  function buildDraftBoard(flow) {
    var order = shuffled(prospectTeams());
    var rosterMax = (S.getSettings() && S.getSettings().rosterMax) || 10;
    var goalieMax = S.GOALIE_MAX || 3;
    var counts = {};
    order.forEach(function (t) {
      var roster = S.getRoster(t.id);
      counts[t.id] = {
        total: roster.length,
        G: roster.filter(function (p) { return p.position === "G"; }).length,
        F: roster.filter(function (p) { return p.position === "F"; }).length,
        D: roster.filter(function (p) { return p.position === "D"; }).length,
      };
    });
    var teamBonus = {};
    flow.impressions.forEach(function (imp) { teamBonus[imp.teamId] = GRADE_TEAM_BONUS[imp.grade] || 0; });

    var userEntry = {
      isUser: true,
      name: flow.displayName,
      position: flow.form.position,
      archetype: flow.form.archetype,
      overall: flow.overall,
      potential: flow.potential,
      value: flow.draftStock,
    };
    var pool = generateDraftClass(order.length * DRAFT_ROUNDS + 6).concat([userEntry]);

    var board = [];
    var pickNo = 0;
    for (var round = 1; round <= DRAFT_ROUNDS; round++) {
      order.forEach(function (team) {
        pickNo += 1;
        var c = counts[team.id];
        var best = null;
        var bestScore = -Infinity;
        if (c.total < rosterMax) {
          pool.forEach(function (cand) {
            if (cand.taken) return;
            if (cand.position === "G" && c.G >= goalieMax) return;
            var score = cand.value + ((c[cand.position] || 0) < 2 ? 3 : 0);
            if (cand.isUser) score += teamBonus[team.id] || 0;
            if (score > bestScore) { bestScore = score; best = cand; }
          });
        }
        if (best) {
          best.taken = true;
          c.total += 1;
          c[best.position] = (c[best.position] || 0) + 1;
        }
        board.push({ round: round, pickNo: pickNo, teamId: team.id, entry: best });
      });
    }

    var userPickIndex = -1;
    board.forEach(function (b, i) { if (b.entry && b.entry.isUser) userPickIndex = i; });
    var undraftedTeamId = null;
    if (userPickIndex === -1) {
      // Went undrafted — first team with room signs you as an undrafted
      // free agent, so a career still always starts on a roster if at all
      // possible.
      var signer = shuffled(order).filter(function (t) {
        var c = counts[t.id];
        return c.total < rosterMax && !(flow.form.position === "G" && c.G >= goalieMax);
      })[0];
      undraftedTeamId = signer ? signer.id : null;
    }
    return { board: board, userPickIndex: userPickIndex, undraftedTeamId: undraftedTeamId };
  }

  function teamName(teamId) {
    var t = teamId ? S.getTeam(teamId) : null;
    return t ? t.name : "a team";
  }
  function userTeamIdFromFlow(flow) {
    if (flow.userPickIndex >= 0) return flow.board[flow.userPickIndex].teamId;
    return flow.undraftedTeamId;
  }
  function ordinalRoundPick(b, teamsPerRound) {
    var inRound = ((b.pickNo - 1) % teamsPerRound) + 1;
    return "Round " + b.round + ", pick " + inRound + " (#" + b.pickNo + " overall)";
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

  // ---------------- Entering the league -----------------------------------
  // The normal path is the full creation flow further down
  // (renderCareerCreationFlow: invitations -> tryouts -> scouting report ->
  // a real two-round amateur draft revealed pick by pick).
  // createPlayerAndEnterDraft is only an instant, no-ceremony fallback kept
  // as a programmatic API — nothing in the UI calls it.
  // A new career ALWAYS starts as a low, unpolished Prospect-level player —
  // never above MAX_START_OVERALL, even after a great tryout bump (see
  // beginDraftDay). Potential is still rolled normally afterward, so the
  // climb from here is the whole point of a career.
  var MIN_START_OVERALL = 40;
  var MAX_START_OVERALL = 70;
  function rollStartingOverall() {
    var roll = Math.random();
    if (roll < 0.1) return U.randInt(61, 66); // polished for a prospect — the rare ceiling
    if (roll < 0.4) return U.randInt(55, 60); // solid raw prospect
    return U.randInt(45, 54); // typical raw prospect — most common outcome
  }
  function clampStartOverall(ovr) {
    return U.clamp(Math.round(ovr), MIN_START_OVERALL, MAX_START_OVERALL);
  }

  function createPlayerAndEnterDraft(opts) {
    opts = opts || {};
    var position = opts.position === "D" || opts.position === "G" ? opts.position : "F";
    var archetype = opts.archetype && archetypeExists(position, opts.archetype) ? opts.archetype : U.randomArchetype(position);
    var name = (opts.name || "").trim() || U.randomGamertag();
    var overall = clampStartOverall(rollStartingOverall());
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
    S.addNotification({
      type: "career",
      title: "Welcome to the PHL",
      body: spec.draftNote || (spec.team
        ? spec.team.name + " selected you in the amateur draft — welcome to the PHL!"
        : "You've entered the league as a " + spec.position + " — no team was available to place you on yet."),
    });
    return created;
  }

  // ---------------- Career creation flow ----------------------------------
  // Create -> Tryout Invitations -> Tryouts -> Draft Day -> finalize.
  // Shared by js/createSave.js (a save's very first career — which runs the
  // league's headless Startup Draft FIRST so every team has a real roster
  // before you try out) and My Career's own "no player yet" / send-off
  // screens (every career after a retirement). Nothing is written to the
  // save until the very last "Enter the League" click. `onComplete(created)`
  // fires once the player actually exists. Resumable: calling this again
  // mid-flow re-renders wherever it left off unless opts.fresh is set.
  var FLOW_STEPS = [
    { key: "form", label: "Create" },
    { key: "invites", label: "Invitations" },
    { key: "tryout", label: "Tryouts" },
    { key: "summary", label: "Scouting Report" },
    { key: "draft", label: "Draft Day" },
  ];

  function renderCareerCreationFlow(el, onComplete, opts) {
    flowContainer = el;
    onCareerCreated = onComplete;
    if (opts && opts.fresh) {
      stopDraftAutoPlay();
      creationFlow = null;
    }
    if (!creationFlow) {
      creationFlow = {
        step: "form",
        form: { name: "", position: "F", archetype: "" },
        displayName: "",
        baseOverall: null,
        overall: null,
        potential: null,
        draftStock: null,
        invites: [],
        selectedInvites: [],
        tryoutTeamIds: [],
        tryoutIndex: 0,
        lastResult: null,
        impressions: [],
        board: [],
        userPickIndex: -1,
        undraftedTeamId: null,
        revealIndex: 0,
        autoTimer: null,
      };
    }
    renderFlowStep();
  }

  function renderFlowStep() {
    if (!flowContainer || !creationFlow) return;
    var step = creationFlow.step;
    if (step === "invites") renderFlowInviteStep();
    else if (step === "tryout") renderFlowTryoutStep();
    else if (step === "summary") renderFlowSummaryStep();
    else if (step === "draft") renderFlowDraftStep();
    else renderFlowFormStep();
  }

  function flowStepperHtml() {
    var cur = creationFlow.step;
    var html = '<div class="chip-row career-stepper">';
    var reached = true;
    FLOW_STEPS.forEach(function (s, i) {
      var active = s.key === cur;
      html += '<span class="chip' + (active ? " chip-active" : "") + '"' + (reached || active ? "" : ' style="opacity:0.45"') + ">" + (i + 1) + ". " + s.label + "</span>";
      if (active) reached = false;
    });
    html += "</div>";
    return html;
  }

  function playerCardHtml() {
    var f = creationFlow.form;
    var html = '<p class="muted small"><strong>' + U.escapeHtml(creationFlow.displayName) + "</strong> &middot; " +
      U.escapeHtml(f.position) + " &middot; " + U.escapeHtml(f.archetype || "") + " &middot; " +
      '<span class="pill pill-accent">' + creationFlow.overall + " OVR</span>";
    if (creationFlow.potential != null) html += ' <span class="pill">' + creationFlow.potential + " POT</span>";
    html += "</p>";
    return html;
  }

  // ---- Step 1: create ----
  function renderFlowFormStep() {
    var f = creationFlow.form;
    if (!f.archetype || !archetypeExists(f.position, f.archetype)) f.archetype = U.randomArchetype(f.position);
    var html = flowStepperHtml();
    html += '<div class="form-card"><h3>Create Your Player</h3>';
    html += '<p class="muted small">Every career starts at the bottom: you\'re an unpolished amateur prospect (somewhere around ' +
      MIN_START_OVERALL + "&ndash;66 OVR, never above " + MAX_START_OVERALL + "). A few Prospect-division teams will invite you to try out, " +
      "then you'll watch the amateur draft unfold pick by pick to see where you land.</p>";
    html += '<div class="form-grid">';
    html += '<label>Name<input type="text" id="cf-name" value="' + U.escapeHtml(f.name) + '" placeholder="Leave blank for a random gamertag"></label>';
    html += '<label>Position<select id="cf-position">' + positionOptions(f.position) + "</select></label>";
    html += '<label>Archetype<select id="cf-archetype">' + archetypeOptions(f.position, f.archetype) + "</select></label>";
    html += "</div>";
    html += '<div class="form-actions"><button class="btn btn-primary" data-action="begin-invites">Scout Me &raquo;</button></div>';
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
    flowContainer.querySelector('[data-action="begin-invites"]').addEventListener("click", beginInvites);
  }

  function beginInvites() {
    var f = creationFlow.form;
    creationFlow.displayName = (f.name || "").trim() || U.randomGamertag();
    f.name = creationFlow.displayName;
    creationFlow.baseOverall = clampStartOverall(rollStartingOverall());
    creationFlow.overall = creationFlow.baseOverall;
    creationFlow.potential = null;
    creationFlow.invites = shuffled(prospectTeams()).slice(0, INVITE_COUNT).map(function (t) { return t.id; });
    creationFlow.selectedInvites = [];
    creationFlow.step = "invites";
    renderFlowStep();
  }

  // ---- Step 2: pick which invitations to accept ----
  function renderFlowInviteStep() {
    var sel = creationFlow.selectedInvites;
    var pos = creationFlow.form.position;
    var html = flowStepperHtml();
    html += '<div class="form-card"><h3>Tryout Invitations</h3>';
    html += playerCardHtml();
    html += '<p class="muted small">' + creationFlow.invites.length + " Prospect-division teams want a look at you. You only have time for " +
      MAX_TRYOUTS + " &mdash; pick which ones. A great tryout makes that team much more likely to draft you; a bad one can scare them off.</p>";
    html += '<table class="data-table compact"><thead><tr><th>Team</th><th>Roster</th><th>At ' + U.escapeHtml(pos) + '</th><th></th></tr></thead><tbody>';
    creationFlow.invites.forEach(function (id) {
      var t = S.getTeam(id);
      if (!t) return;
      var roster = S.getRoster(id);
      var atPos = roster.filter(function (p) { return p.position === pos; }).length;
      var on = sel.indexOf(id) !== -1;
      var disabled = !on && sel.length >= MAX_TRYOUTS;
      html += "<tr><td>" + U.crestHtml(t, "crest-sm") + U.escapeHtml(t.name) + "</td><td>" + roster.length + "</td><td>" + atPos + "</td>" +
        '<td><button class="btn btn-sm' + (on ? " btn-primary" : "") + '" data-invite="' + id + '"' + (disabled ? " disabled" : "") + ">" +
        (on ? "&#10003; Trying Out" : "Accept") + "</button></td></tr>";
    });
    html += "</tbody></table>";
    html += '<div class="form-actions"><span class="muted small">' + sel.length + " / " + MAX_TRYOUTS + " selected</span>" +
      '<button class="btn btn-primary" data-action="begin-tryouts"' + (sel.length ? "" : " disabled") + ">Start Tryouts &raquo;</button></div>";
    html += "</div>";
    flowContainer.innerHTML = html;
    flowContainer.querySelectorAll("[data-invite]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.invite;
        var i = sel.indexOf(id);
        if (i !== -1) sel.splice(i, 1);
        else if (sel.length < MAX_TRYOUTS) sel.push(id);
        renderFlowStep();
      });
    });
    flowContainer.querySelector('[data-action="begin-tryouts"]').addEventListener("click", function () {
      if (!sel.length) return;
      creationFlow.tryoutTeamIds = sel.slice();
      creationFlow.tryoutIndex = 0;
      creationFlow.impressions = [];
      creationFlow.lastResult = null;
      creationFlow.step = "tryout";
      renderFlowStep();
    });
  }

  // ---- Step 3: tryouts, one team at a time ----
  function renderFlowTryoutStep() {
    var ids = creationFlow.tryoutTeamIds;
    var idx = creationFlow.tryoutIndex;
    var html = flowStepperHtml();
    var res = creationFlow.lastResult;
    if (res) {
      var last = idx >= ids.length;
      html += '<div class="form-card"><h3>Tryout ' + idx + " of " + ids.length + " &mdash; " + U.escapeHtml(res.teamName) + "</h3>";
      html += '<p>You chose <strong>' + U.escapeHtml(res.approachLabel) + '</strong>. Scouts\' grade: <span class="pill ' + (GRADE_PILL[res.grade] || "") + '">' + res.grade + "</span></p>";
      html += '<p class="muted">&ldquo;' + U.escapeHtml(res.quote) + "&rdquo;</p>";
      html += '<div class="form-actions"><button class="btn btn-primary" data-action="next-tryout">' + (last ? "See Scouting Report &raquo;" : "Next Tryout &raquo;") + "</button></div></div>";
      flowContainer.innerHTML = html;
      flowContainer.querySelector('[data-action="next-tryout"]').addEventListener("click", function () {
        creationFlow.lastResult = null;
        if (creationFlow.tryoutIndex >= creationFlow.tryoutTeamIds.length) beginSummary();
        else renderFlowStep();
      });
      return;
    }
    if (idx >= ids.length) { beginSummary(); return; }
    var team = S.getTeam(ids[idx]);
    html += '<div class="form-card"><h3>Tryout ' + (idx + 1) + " of " + ids.length + " &mdash; " + U.crestHtml(team, "crest-sm") + U.escapeHtml(team ? team.name : "?") + "</h3>";
    html += playerCardHtml();
    html += '<p class="muted small">Their coaches and scouts are watching. How do you want to play this session?</p>';
    html += '<div class="mode-grid">';
    TRYOUT_APPROACHES.forEach(function (a) {
      html += '<button type="button" class="mode-card" data-approach="' + a.key + '"><h3>' + U.escapeHtml(a.label) + "</h3><p>" + U.escapeHtml(a.desc) + "</p></button>";
    });
    html += "</div></div>";
    flowContainer.innerHTML = html;
    flowContainer.querySelectorAll("[data-approach]").forEach(function (b) {
      b.addEventListener("click", function () { runTryout(team, b.dataset.approach); });
    });
  }

  function runTryout(team, approachKey) {
    var approach = TRYOUT_APPROACHES.filter(function (a) { return a.key === approachKey; })[0] || TRYOUT_APPROACHES[0];
    var score = approach.roll(creationFlow.baseOverall);
    var grade = tryoutGrade(score - creationFlow.baseOverall);
    var result = { teamId: team.id, teamName: team.name, approachLabel: approach.label, score: score, grade: grade, quote: scoutQuote(grade) };
    creationFlow.impressions.push(result);
    creationFlow.lastResult = result;
    creationFlow.tryoutIndex += 1;
    renderFlowStep();
  }

  // ---- Step 4: scouting report (tryout impact + mock-draft projection) ----
  function beginSummary() {
    var imps = creationFlow.impressions;
    var avgStock = imps.length ? U.avg(imps.map(function (i) { return i.score; })) : creationFlow.baseOverall;
    var bump = U.clamp(Math.round((avgStock - creationFlow.baseOverall) / 4), -3, 3);
    creationFlow.overall = clampStartOverall(creationFlow.baseOverall + bump);
    creationFlow.potential = U.rollPotential(creationFlow.overall);
    creationFlow.draftStock = avgStock;
    var built = buildDraftBoard(creationFlow);
    creationFlow.board = built.board;
    creationFlow.userPickIndex = built.userPickIndex;
    creationFlow.undraftedTeamId = built.undraftedTeamId;
    creationFlow.revealIndex = 0;
    creationFlow.step = "summary";
    renderFlowStep();
  }

  function renderFlowSummaryStep() {
    var f = creationFlow;
    var html = flowStepperHtml();
    html += '<div class="form-card"><h3>Scouting Report</h3>';
    html += '<table class="data-table compact"><thead><tr><th>Team</th><th>Approach</th><th>Grade</th></tr></thead><tbody>';
    f.impressions.forEach(function (imp) {
      html += "<tr><td>" + U.escapeHtml(imp.teamName) + "</td><td>" + U.escapeHtml(imp.approachLabel) + '</td><td><span class="pill ' + (GRADE_PILL[imp.grade] || "") + '">' + imp.grade + "</span></td></tr>";
    });
    html += "</tbody></table>";
    var delta = f.overall - f.baseOverall;
    html += "<p>Rating after tryouts: <strong>" + f.overall + " OVR</strong> " +
      (delta ? '<span class="pill ' + (delta > 0 ? "pill-clinch" : "pill-loss") + '">' + (delta > 0 ? "+" : "") + delta + "</span>" : '<span class="muted small">(unchanged)</span>') +
      " &middot; Potential: <strong>" + f.potential + "</strong></p>";
    var teamsPerRound = f.board.length / DRAFT_ROUNDS;
    var projection;
    if (f.userPickIndex === -1) {
      projection = "Mock drafts have you on the bubble &mdash; you might not hear your name called at all.";
    } else {
      var truePick = f.board[f.userPickIndex].pickNo;
      var lo = Math.max(1, truePick - U.randInt(1, 3));
      var hi = Math.min(f.board.length, truePick + U.randInt(1, 3));
      var loRound = Math.ceil(lo / teamsPerRound), hiRound = Math.ceil(hi / teamsPerRound);
      projection = "Mock drafts project you somewhere around pick #" + lo + "&ndash;#" + hi +
        " (Round " + loRound + (hiRound !== loRound ? "&ndash;" + hiRound : "") + ").";
    }
    html += '<p class="muted">' + projection + "</p>";
    html += '<div class="form-actions"><button class="btn btn-primary" data-action="continue-to-draft">Go to Draft Day &raquo;</button></div>';
    html += "</div>";
    flowContainer.innerHTML = html;
    flowContainer.querySelector('[data-action="continue-to-draft"]').addEventListener("click", function () {
      creationFlow.step = "draft";
      creationFlow.revealIndex = 0;
      renderFlowStep();
    });
  }

  // ---- Step 5: draft day, revealed pick by pick ----
  function stopDraftAutoPlay() {
    if (creationFlow && creationFlow.autoTimer) {
      clearTimeout(creationFlow.autoTimer);
      creationFlow.autoTimer = null;
    }
  }
  function draftAutoTick() {
    var f = creationFlow;
    if (!f || f.step !== "draft" || !flowContainer || !document.body.contains(flowContainer)) { if (f) f.autoTimer = null; return; }
    f.revealIndex = Math.min(f.board.length, f.revealIndex + 1);
    var justPickedMe = f.userPickIndex !== -1 && f.revealIndex === f.userPickIndex + 1;
    var done = f.revealIndex >= f.board.length;
    f.autoTimer = null;
    if (!justPickedMe && !done) f.autoTimer = setTimeout(draftAutoTick, 650);
    renderFlowDraftStep();
  }

  function renderFlowDraftStep() {
    var f = creationFlow;
    var teamsPerRound = f.board.length / DRAFT_ROUNDS;
    var myTeamId = userTeamIdFromFlow(f);
    var meRevealed = f.userPickIndex !== -1 && f.revealIndex > f.userPickIndex;
    var allRevealed = f.revealIndex >= f.board.length;
    var html = flowStepperHtml();
    html += '<div class="form-card"><h3>Amateur Draft &mdash; Prospect Division</h3>';
    html += playerCardHtml();
    if (!allRevealed) {
      var next = f.board[f.revealIndex];
      html += '<p>On the clock: ' + U.crestHtml(S.getTeam(next.teamId), "crest-sm") + "<strong>" + U.escapeHtml(teamName(next.teamId)) + "</strong> &middot; " +
        '<span class="muted small">' + ordinalRoundPick(next, teamsPerRound) + "</span></p>";
    }
    if (meRevealed) {
      var mine = f.board[f.userPickIndex];
      html += '<p class="pill pill-mvp">&#127942; With ' + ordinalRoundPick(mine, teamsPerRound).replace(/^Round/, "round") + ", the " +
        U.escapeHtml(teamName(mine.teamId)) + " select " + U.escapeHtml(f.displayName) + "!</p>";
    } else if (allRevealed && f.userPickIndex === -1) {
      html += '<p class="pill pill-warn">Your name was never called. ' +
        (myTeamId ? "But the " + U.escapeHtml(teamName(myTeamId)) + " sign you as an undrafted free agent!" : "You'll start as a free agent.") + "</p>";
    }
    html += '<div class="draft-pool-scroll" id="cf-draft-board"><table class="data-table compact"><thead><tr><th>#</th><th>Rd</th><th>Team</th><th>Selection</th><th>Pos</th><th>OVR</th></tr></thead><tbody>';
    for (var i = 0; i < f.revealIndex && i < f.board.length; i++) {
      var b = f.board[i];
      var e = b.entry;
      var isMe = e && e.isUser;
      html += "<tr" + (isMe ? ' class="draft-pool-top-pick"' : "") + "><td>" + b.pickNo + "</td><td>" + b.round + "</td><td>" + U.crestHtml(S.getTeam(b.teamId), "crest-sm") + U.escapeHtml(teamName(b.teamId)) + "</td>" +
        (e
          ? "<td>" + (isMe ? "<strong>YOU &mdash; " + U.escapeHtml(e.name) + "</strong>" : U.escapeHtml(e.name)) + "</td><td>" + e.position + "</td><td>" + e.overall + "</td>"
          : '<td class="muted">passes (roster full)</td><td></td><td></td>') +
        "</tr>";
    }
    if (!f.revealIndex) html += '<tr><td colspan="6" class="muted">The commissioner steps to the podium&hellip;</td></tr>';
    html += "</tbody></table></div>";

    html += '<div class="form-actions">';
    if (!allRevealed) {
      html += '<button class="btn btn-primary" data-action="reveal-next-pick">Next Pick</button>';
      html += '<button class="btn" data-action="auto-draft">' + (f.autoTimer ? "&#10074;&#10074; Pause" : "&#9654; Watch It Play Out") + "</button>";
      if (!meRevealed && f.userPickIndex !== -1) html += '<button class="btn" data-action="skip-to-my-pick">Skip to My Pick</button>';
      else html += '<button class="btn" data-action="finish-draft">Finish Draft</button>';
    } else {
      html += '<button class="btn btn-primary" data-action="finalize-career">Enter the League &raquo;</button>';
    }
    html += "</div></div>";
    flowContainer.innerHTML = html;

    var boardEl = flowContainer.querySelector("#cf-draft-board");
    if (boardEl) boardEl.scrollTop = boardEl.scrollHeight;
    function bind(action, fn) {
      var btn = flowContainer.querySelector('[data-action="' + action + '"]');
      if (btn) btn.addEventListener("click", fn);
    }
    bind("reveal-next-pick", function () { stopDraftAutoPlay(); f.revealIndex = Math.min(f.board.length, f.revealIndex + 1); renderFlowStep(); });
    bind("auto-draft", function () {
      if (f.autoTimer) { stopDraftAutoPlay(); renderFlowStep(); return; }
      f.autoTimer = setTimeout(draftAutoTick, 350);
      renderFlowStep();
    });
    bind("skip-to-my-pick", function () { stopDraftAutoPlay(); f.revealIndex = f.userPickIndex + 1; renderFlowStep(); });
    bind("finish-draft", function () { stopDraftAutoPlay(); f.revealIndex = f.board.length; renderFlowStep(); });
    bind("finalize-career", finalizeCareerCreation);
  }

  function finalizeCareerCreation() {
    var f = creationFlow;
    if (!f) return;
    stopDraftAutoPlay();
    var season = S.getSeasonNumber ? S.getSeasonNumber() : 1;
    // Everyone else drafted becomes a real player on the team that took
    // them — the class you were drafted alongside actually exists.
    f.board.forEach(function (b) {
      var e = b.entry;
      if (!e || e.isUser) return;
      var age = U.generateRookieAge();
      S.addPlayer({
        name: e.name,
        position: e.position,
        archetype: e.archetype,
        overall: e.overall,
        potential: e.potential,
        attributes: U.deriveAttributes(e.overall, e.position, e.archetype),
        salary: Math.max(U.SALARY_MIN, Math.round((U.salaryAsking(e.overall, e.potential) * 0.5) / 500) * 500),
        contractYears: 2,
        teamId: b.teamId,
        isDraftProspect: false,
        eligibleDivisions: ["prospect"],
        isRookieClass: true,
        rookieSeason: season,
        age: age,
        retirementAge: U.retirementAgeFor(age),
        stats: S.freshStatLine(),
        careerStats: S.freshStatLine(),
      });
    });
    var teamsPerRound = f.board.length / DRAFT_ROUNDS;
    var myTeamId = userTeamIdFromFlow(f);
    var team = myTeamId ? S.getTeam(myTeamId) : null;
    var draftNote = f.userPickIndex !== -1
      ? team.name + " drafted you in the amateur draft — " + ordinalRoundPick(f.board[f.userPickIndex], teamsPerRound) + ". Welcome to the PHL!"
      : team
        ? "You went undrafted, but " + team.name + " signed you as an undrafted free agent. Welcome to the PHL — time to prove everyone wrong."
        : "You went undrafted and start your career as a free agent.";
    var created = finalizePlayerRecord({
      name: f.displayName,
      position: f.form.position,
      archetype: f.form.archetype,
      overall: f.overall,
      potential: f.potential,
      team: team,
      draftNote: draftNote,
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
