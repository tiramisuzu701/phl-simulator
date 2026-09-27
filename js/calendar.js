/* PHL Franchise Simulator — the weekly calendar engine
 * Global namespace: window.PHLCalendar
 *
 * One button — Advance Week, in the header — drives the entire season:
 *   offseason (6 weeks, freeform) -> regular (22 weeks: 10-week first
 *   half, 2-week trade-deadline break, 10-week second half) ->
 *   playoffs (up to 4 weeks, per-division) -> back to offseason (repeats).
 * No more separate "start the draft" / "simulate this week" / "start
 * playoffs" buttons scattered across tabs — this module is the only thing
 * that moves the calendar forward, and every tab just reflects whatever
 * state it lands on.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var Sim = window.PHLSim;

  function settings() {
    return S.getSettings();
  }

  function isSetupComplete() {
    var sd = S.getStartupDraft();
    if (!sd || sd.status !== "complete") return false;
    // Be A Player mode never sets data.franchise.teamId (see js/state.js
    // myTeamId — that's what keeps every team, including your own player's,
    // fully AI-managed). The Startup Draft finishing headless (see
    // js/app.js initBeAPlayer / js/careerMode.js) is the only setup step
    // that mode needs.
    if (S.isBeAPlayerMode()) return true;
    var franchise = S.getFranchise();
    return !!(franchise && franchise.teamId);
  }

  function maxPlayoffWeeks() {
    var Playoffs = window.PHLPlayoffs;
    if (!Playoffs) return 4;
    var max = 1;
    S.getDivisions().forEach(function (d) {
      max = Math.max(max, Playoffs.totalRoundsForDivision(d.id));
    });
    return max;
  }

  function weekLabel() {
    var season = S.getSeason();
    if (!isSetupComplete()) return "Startup Draft in progress";
    if (season.phase === "offseason") return "Off-season " + season.calendarWeek + "/" + (settings().offseasonWeeks || 6);
    if (season.phase === "regular") return "Week " + season.calendarWeek + "/" + (settings().regularSeasonWeeks || 22);
    if (season.phase === "playoffs") return "Playoffs " + season.calendarWeek + "/" + maxPlayoffWeeks();
    return "";
  }

  // Returns a reason string if Advance Week can't run right now, else null.
  // Also opportunistically fixes every AI team's cap situation each call —
  // cheap, idempotent, and means the user's own cap violation is always
  // caught the moment it would block them.
  function checkBlocked() {
    if (!isSetupComplete()) return "Finish the Startup Draft and pick your team first.";
    var AI = window.PHLAIManager;
    if (AI) {
      var cap = AI.enforceCapForAllTeams();
      if (cap.userOverCap) {
        var team = S.getTeam(cap.userOverCap.teamId);
        return (team ? team.name : "Your team") + " is " + U.formatMoney(cap.userOverCap.overBy) +
          " over the salary cap. Release a player in the Contracts tab before advancing.";
      }
      // Every team must field a legal 2F/2D/1G roster throughout the regular
      // season and playoffs — only the off-season is a rebuilding window
      // (see js/state.js ROSTER_MIN / rosterMeetsMinimum). AI teams get
      // auto-signed up to compliance for free (js/aiManager.js
      // forceFillRosterMinimum, even down to whatever's cheapest and legally
      // eligible); the human GM's own team is never signed for automatically
      // — it's reported back here and Advance Week is blocked until the
      // user fixes it themselves in Contracts.
      var rosterCheck = AI.enforceRosterMinimumForAllTeams();
      if (rosterCheck.userBelowMinimum) {
        var myTeam = S.getTeam(rosterCheck.userBelowMinimum.teamId);
        return (myTeam ? myTeam.name : "Your team") + " is below the required " + S.ROSTER_MIN.F + "F/" +
          S.ROSTER_MIN.D + "D/" + S.ROSTER_MIN.G + "G, " + S.ROSTER_MIN.total +
          "-player roster minimum. Sign a free agent in the Contracts tab before advancing.";
      }
    }
    // Advance Week is the one button that runs the whole season — it is NOT
    // gated on the user simming their own game(s) first. "Sim My Game" on
    // the Dashboard is purely an optional preview if you want to see your
    // box score before the rest of the league plays out; skip it entirely
    // and Advance Week will simulate your game(s) right along with everyone
    // else's (see js/schedule.js simulateCalendarWeek, which doesn't
    // special-case any team).
    return null;
  }

  // The user's own unplayed game(s) for the CURRENT calendar week — only
  // meaningful during the regular season (playoffs keep their existing Sim
  // Game/Sim Series controls, and offseason/break weeks have no games at
  // all). Empty array means either it's not the regular season, this is a
  // trade-deadline break week, or the user's team has a bye this week — in
  // every one of those cases Advance Week should NOT be gated.
  function myUnplayedGamesThisWeek() {
    // S.myTeamId() reads franchise.teamId in GM mode and your own player's
    // current teamId in Be A Player mode (see js/state.js) — same "This
    // Week" panel now works for both without duplicating this logic.
    var teamId = S.myTeamId();
    if (!teamId) return [];
    var season = S.getSeason();
    if (season.phase !== "regular") return [];
    if (BREAK_WEEKS.indexOf(season.calendarWeek) !== -1) return [];
    return S.getSchedule().filter(function (g) {
      return g.week === season.calendarWeek && !g.played &&
        (g.homeTeamId === teamId || g.awayTeamId === teamId);
    });
  }

  // Simulates just the user's own game(s) for the current week (called from
  // the Dashboard's "Sim My Game" button, or My Career's equivalent in Be A
  // Player mode) so the player can see their own box score before the rest
  // of the league's games play out via Advance Week. Returns the now-played
  // games (with boxscore attached) so the caller can pop up the result.
  function simulateMyGamesThisWeek() {
    var games = myUnplayedGamesThisWeek();
    if (!games.length || !Sim) return [];
    var opts = window.PHLCareerMode ? window.PHLCareerMode.activeSimOpts() : null;
    games.forEach(function (g) { Sim.simulateAndApply(g, opts); });
    S.save();
    return games;
  }

  function runOffseasonWeek(season, summary) {
    var AI = window.PHLAIManager;
    if (AI) {
      var signed = AI.aiSignFreeAgents();
      if (signed.length) summary.push(signed.length + " free-agent signing(s) around the league.");
      var promoted = AI.aiRunPromotions();
      if (promoted.length) summary.push(promoted.length + " promotion(s) around the league.");
      var traded = AI.aiRunTrades();
      if (traded.length) summary.push(traded.length + " in-division AI trade(s) around the league.");
      AI.aiProposeTradesToUser();
    }

    var weeksTotal = settings().offseasonWeeks || 6;
    if (season.calendarWeek >= weeksTotal) {
      // No more recurring Entry Draft — the only draft in a save is the
      // one-time Startup Draft. New rookies/prospects are generated
      // straight into free agency below instead (see Stats.generateRookieClass()).
      var Stats = window.PHLStats;
      var retired = Stats ? Stats.ageAndDeclinePlayers() : [];
      var rookies = Stats ? Stats.generateRookieClass() : [];
      summary.push(retired.length + " player(s) retired, " + rookies.length + " breakout rookie(s) joined free agency.");
      window.PHLSchedule.generateSeasonSchedule(); // also sets phase="regular", calendarWeek=1
      // Refill every team's first-half scrim budget now that a fresh
      // regular season is starting — see js/scrims.js.
      if (window.PHLScrims) window.PHLScrims.resetSplitUsage();
      summary.push("The regular season begins.");
    } else {
      S.updateSeason({ calendarWeek: season.calendarWeek + 1 });
    }
  }

  // Weeks 11-12 of the regular season are the mid-season trade-deadline
  // break — no games are scheduled for them (see js/schedule.js
  // BREAK_WEEKS), but it's still the last window for trades, free-agent
  // signings, and roster drops before the deadline locks at week 13.
  var BREAK_WEEKS = [11, 12];

  function runRegularWeek(season, summary) {
    var onBreak = BREAK_WEEKS.indexOf(season.calendarWeek) !== -1;
    if (onBreak) {
      summary.push("Trade deadline break — no games this week. Last chance to make trades, sign free agents, or drop roster players before the deadline locks.");
    } else {
      var count = window.PHLSchedule.simulateCalendarWeek(season.calendarWeek);
      summary.push(count + " game(s) played across the league this week.");
    }

    var AI = window.PHLAIManager;
    if (AI) {
      var traded = AI.aiRunTrades();
      if (traded.length) summary.push(traded.length + " in-division AI trade(s) around the league.");
      AI.aiProposeTradesToUser();
    }

    // First-half MVPs are revealed right at week 10 of the regular season —
    // the last played week of the first half, right before the trade-
    // deadline break (see js/mvp.js) — one per division.
    if (season.calendarWeek === 10 && window.PHLMvp) {
      window.PHLMvp.computeFirstHalfMvps();
      summary.push("First-Half MVPs have been announced around the league.");
    }

    var weeksTotal = settings().regularSeasonWeeks || 22;
    var nextWeek = season.calendarWeek + 1;
    if (season.calendarWeek >= weeksTotal) {
      if (window.PHLMvp) {
        window.PHLMvp.computeSecondHalfMvps();
        summary.push("Second-Half MVPs have been announced around the league.");
      }
      if (window.PHLAwards) {
        window.PHLAwards.computeSeasonAwards();
        summary.push("Season Awards (Defenseman/Goalie/Rookie/Player of the Year) have been announced around the league.");
      }
      var Playoffs = window.PHLPlayoffs;
      S.getDivisions().forEach(function (d) {
        Playoffs.startPlayoffs(d.id);
      });
      S.updateSeason({ phase: "playoffs", calendarWeek: 1 });
      summary.push("Regular season complete — the playoffs begin.");
    } else {
      // The trade deadline locks league-wide the moment the break ends
      // (week 13 onward) — trades, free-agent signings, and releases stay
      // blocked through the rest of the season and all of the playoffs,
      // until the next off-season begins (see js/state.js
      // isTransactionWindowOpen).
      if (BREAK_WEEKS.indexOf(nextWeek) === -1 && nextWeek > BREAK_WEEKS[BREAK_WEEKS.length - 1] && season.calendarWeek <= BREAK_WEEKS[BREAK_WEEKS.length - 1]) {
        summary.push("The trade deadline has passed — trades, free-agent signings, and releases are locked league-wide until the next off-season.");
        // The break just ended and the second half is starting — refill
        // every team's scrim budget for it (see js/scrims.js).
        if (window.PHLScrims) window.PHLScrims.resetSplitUsage();
      }
      S.updateSeason({ calendarWeek: nextWeek });
    }
  }

  function runPlayoffsWeek(season, summary) {
    var Playoffs = window.PHLPlayoffs;
    var anyActive = false;
    S.getDivisions().forEach(function (d) {
      var wasChampioned = !!((S.getSeason().playoffs || {})[d.id] || {}).champion;
      if (Playoffs.simulateOneRound(d.id)) anyActive = true;
      var bracket = (S.getSeason().playoffs || {})[d.id];
      if (bracket && bracket.champion && !wasChampioned && window.PHLInbox && S.isUserRelevantTeam(bracket.champion)) {
        var champ = S.getTeam(bracket.champion);
        window.PHLInbox.addNotification({
          type: "playoff",
          title: (S.getDivision(d.id) || {}).name + " Division Champion",
          body: (champ ? champ.name : "A team") + " has won the " + (S.getDivision(d.id) || {}).name + " Division championship!",
        });
      }
    });
    if (anyActive) summary.push("A playoff round resolved across the league.");

    var allDone = Playoffs.allDivisionsHaveChampions();
    if (allDone || season.calendarWeek >= maxPlayoffWeeks()) {
      S.updateSeason({
        phase: "offseason",
        calendarWeek: 1,
        seasonNumber: (season.seasonNumber || 1) + 1,
        entryDraftDoneThisCycle: false,
      });
      // Refill every team's off-season scrim budget now that a fresh
      // off-season is starting — see js/scrims.js.
      if (window.PHLScrims) window.PHLScrims.resetOffseasonUsage();
      // Management (GM) offers only ever appear right here, at the very
      // start of the off-season — see js/gmOffers.js.
      if (window.PHLGmOffers) window.PHLGmOffers.generateOffers();
      summary.push("Playoffs complete — the off-season begins.");
      // Anyone who grew past their division's overall cutoff during the
      // season just played gets released to free agency now — see
      // js/state.js releasePlayersAboveOverallCutoff.
      var cutReleases = S.releasePlayersAboveOverallCutoff();
      if (cutReleases.length) {
        summary.push(cutReleases.length + " player(s) released for exceeding their division's overall cutoff.");
        if (window.PHLInbox) {
          cutReleases.forEach(function (r) {
            if (!S.isUserRelevantTeam(r.teamId)) return;
            var team = S.getTeam(r.teamId);
            window.PHLInbox.addNotification({
              type: "league",
              title: "Roster cut — overall cutoff",
              body: r.player.name + " (" + r.player.overall + " OVR) had to be released by " + (team ? team.name : "their team") +
                " for exceeding the division's overall cutoff.",
            });
          });
        }
      }
    } else {
      S.updateSeason({ calendarWeek: season.calendarWeek + 1 });
    }
  }

  // The one entry point the header button calls. Returns
  // { advanced: false, reason } if blocked, or { advanced: true, summary }.
  function advanceWeek() {
    var blockedReason = checkBlocked();
    if (blockedReason) return { advanced: false, reason: blockedReason };

    var Scrims = window.PHLScrims;
    if (Scrims) Scrims.weeklyChemistryUpkeep();
    if (window.PHLPlayerMessages) window.PHLPlayerMessages.weeklyCheck();
    if (window.PHLStrategy) window.PHLStrategy.autoAssignAiStrategies();
    // Be A Player mode only (no-ops instantly in GM mode) — contract-offer
    // generation, "trade me" resolution, career milestones, and retirement
    // detection. See js/careerMode.js.
    if (window.PHLCareerMode) window.PHLCareerMode.weeklyCheck();

    var season = S.getSeason();
    var summary = [];
    if (season.phase === "offseason") runOffseasonWeek(season, summary);
    else if (season.phase === "regular") runRegularWeek(season, summary);
    else if (season.phase === "playoffs") runPlayoffsWeek(season, summary);
    else summary.push("Nothing to advance.");

    // This week's game(s) (just simulated above, whether via this call or a
    // prior "Sim My Game" preview) have already consumed this week's
    // gameplan choice — clear it so next week starts fresh. See
    // js/careerMode.js activeSimOpts / setGameplanChoice.
    if (window.PHLCareerMode) window.PHLCareerMode.clearGameplanChoiceForNextWeek();

    return { advanced: true, summary: summary };
  }

  window.PHLCalendar = {
    isSetupComplete: isSetupComplete,
    maxPlayoffWeeks: maxPlayoffWeeks,
    weekLabel: weekLabel,
    checkBlocked: checkBlocked,
    advanceWeek: advanceWeek,
    myUnplayedGamesThisWeek: myUnplayedGamesThisWeek,
    simulateMyGamesThisWeek: simulateMyGamesThisWeek,
  };
})();
