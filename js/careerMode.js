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
  var container = null;
  var createForm = { name: "", position: "F", archetype: "" };

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
  // Deliberately NOT a full pick-by-pick draft board — that machinery
  // (js/startupDraft.js) exists to distribute the real player pool across
  // every team once per save, a very different job. Placement here mirrors
  // js/stats.js's breakout-rookie tiers instead (most prospects are raw;
  // a real difference-maker on day one is rare), just scoped to a single
  // player: rollPotential, generateRookieAge, deriveAttributes, and the
  // same 70%-of-asking-price entry contract the real Startup Draft uses are
  // all reused as-is.
  function rollStartingOverall() {
    var roll = Math.random();
    if (roll < 0.05) return U.randInt(78, 86); // rare, can't-miss prospect
    if (roll < 0.25) return U.randInt(65, 78); // solid prospect
    return U.randInt(48, 64); // typical raw prospect — most common outcome
  }

  // Weighted toward whichever Prospect-division team is thinnest at your
  // position (and, as a tiebreak, smallest roster overall) — a plausible
  // "who drafts you" without needing a real draft board. Falls back to any
  // team at all if Prospect somehow has none (a heavily customized league).
  function pickAmateurTeam(position) {
    var teams = S.getTeams("prospect");
    if (!teams.length) teams = S.getTeams();
    if (!teams.length) return null;
    var scored = teams.map(function (t) {
      var roster = S.getRoster(t.id);
      var atPos = roster.filter(function (p) { return p.position === position; }).length;
      var weight = 1 / (1 + atPos) + (1 / (1 + roster.length)) * 0.3;
      return { item: t, weight: weight };
    });
    return U.weightedPick(scored) || teams[0];
  }

  // Creates the user's custom player, places them on a Prospect team, and
  // points data.myPlayer.playerId at them. Used both for a save's very
  // first career (see js/createSave.js) and for every subsequent career
  // after a retirement send-off (see startNewCareer below) — the league
  // itself is untouched either way, only the player identity changes.
  function createPlayerAndEnterDraft(opts) {
    opts = opts || {};
    var position = opts.position === "D" || opts.position === "G" ? opts.position : "F";
    var archetype = opts.archetype && archetypeExists(position, opts.archetype) ? opts.archetype : U.randomArchetype(position);
    var name = (opts.name || "").trim() || U.randomGamertag();
    var overall = rollStartingOverall();
    var potential = U.rollPotential(overall);
    var age = U.generateRookieAge();
    var askingBase = U.salaryAsking(overall, potential);
    var entrySalary = Math.max(U.SALARY_MIN, Math.round((askingBase * 0.7) / 500) * 500);
    var team = pickAmateurTeam(position);
    var player = {
      name: name,
      position: position,
      archetype: archetype,
      overall: overall,
      potential: potential,
      attributes: U.deriveAttributes(overall, position, archetype),
      salary: entrySalary,
      contractYears: 2,
      teamId: team ? team.id : null,
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
    d.myPlayer.milestonesHit = [];
    S.save();
    if (window.PHLInbox) {
      window.PHLInbox.addNotification({
        type: "career",
        title: "Welcome to the PHL",
        body: team
          ? "You've entered the league as a " + position + " for " + team.name + "!"
          : "You've entered the league as a " + position + " — no team was available to place you on yet.",
      });
    }
    return created;
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

  function renderCreationForm(heading, intro) {
    if (!createForm.archetype || !archetypeExists(createForm.position, createForm.archetype)) {
      createForm.archetype = U.randomArchetype(createForm.position);
    }
    var html = '<div class="form-card"><h3>' + U.escapeHtml(heading) + "</h3>";
    html += '<p class="muted small">' + U.escapeHtml(intro) + "</p>";
    html += '<div class="form-grid">';
    html += '<label>Name<input type="text" id="mc-name" value="' + U.escapeHtml(createForm.name) + '" placeholder="Leave blank for a random gamertag"></label>';
    html += '<label>Position<select id="mc-position">' + positionOptions(createForm.position) + "</select></label>";
    html += '<label>Archetype<select id="mc-archetype">' + archetypeOptions(createForm.position, createForm.archetype) + "</select></label>";
    html += "</div>";
    html += '<div class="form-actions"><button class="btn btn-primary" data-action="create-player">Enter the League &raquo;</button></div>';
    html += "</div>";
    return html;
  }

  function wireCreationForm() {
    var nameInput = container.querySelector("#mc-name");
    if (nameInput) nameInput.addEventListener("input", function (e) { createForm.name = e.target.value; });
    var posSel = container.querySelector("#mc-position");
    if (posSel) posSel.addEventListener("change", function (e) {
      createForm.position = e.target.value;
      createForm.archetype = U.randomArchetype(createForm.position);
      render();
    });
    var archSel = container.querySelector("#mc-archetype");
    if (archSel) archSel.addEventListener("change", function (e) { createForm.archetype = e.target.value; });
    var createBtn = container.querySelector('[data-action="create-player"]');
    if (createBtn) createBtn.addEventListener("click", function () {
      createPlayerAndEnterDraft({ name: createForm.name, position: createForm.position, archetype: createForm.archetype });
      createForm = { name: "", position: "F", archetype: "" };
      render();
      if (window.PHLApp) window.PHLApp.refreshAll();
    });
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
    html += renderCreationForm("Start a New Career", "The league keeps going — build your next player and re-enter the amateur draft pool whenever you're ready.");
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
      wireCreationForm();
      return;
    }
    var p = mp && mp.playerId ? S.getPlayer(mp.playerId) : null;
    if (!p) {
      html = '<div class="panel-header"><h2>My Career</h2></div>' + renderCreationForm("Create Your Player", "Build a player and enter the amateur draft pool to start your career.");
      container.innerHTML = html;
      wireCreationForm();
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
    GAMEPLANS: GAMEPLANS,
  };
})();
