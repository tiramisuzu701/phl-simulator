/* PHL Franchise Simulator — the weekly calendar engine
 * Global namespace: window.PHLCalendar
 *
 * One button — Advance Week, in the header — drives the entire season:
 *   offseason (5 weeks, freeform) -> regular (12 weeks) ->
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
    var franchise = S.getFranchise();
    var sd = S.getStartupDraft();
    return !!(franchise && franchise.teamId && sd && sd.status === "complete");
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
    if (season.phase === "offseason") return "Off-season " + season.calendarWeek + "/" + (settings().offseasonWeeks || 5);
    if (season.phase === "regular") return "Week " + season.calendarWeek + "/" + (settings().regularSeasonWeeks || 12);
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
    }
    // Regular-season only (see myUnplayedGamesThisWeek) — the user has to
    // sim their own game(s) for the week from the Dashboard before the rest
    // of the league's games can play out, so they always get a look at
    // their own box score first.
    var myGames = myUnplayedGamesThisWeek();
    if (myGames.length) {
      return "Simulate your team's game" + (myGames.length > 1 ? "s" : "") + " for this week on the Dashboard before advancing.";
    }
    return null;
  }

  // The user's own unplayed game(s) for the CURRENT calendar week — only
  // meaningful during the regular season (playoffs keep their existing Sim
  // Game/Sim Series controls, and offseason/break weeks have no games at
  // all). Empty array means either it's not the regular season, this is a
  // trade-deadline break week, or the user's team has a bye this week — in
  // every one of those cases Advance Week should NOT be gated.
  function myUnplayedGamesThisWeek() {
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) return [];
    var season = S.getSeason();
    if (season.phase !== "regular") return [];
    if (BREAK_WEEKS.indexOf(season.calendarWeek) !== -1) return [];
    return S.getSchedule().filter(function (g) {
      return g.week === season.calendarWeek && !g.played &&
        (g.homeTeamId === franchise.teamId || g.awayTeamId === franchise.teamId);
    });
  }

  // Simulates just the user's own game(s) for the current week (called from
  // the Dashboard's "Sim My Game" button) so the player can see their own
  // box score before the rest of the league's games play out via Advance
  // Week. Returns the now-played games (with boxscore attached) so the
  // caller can pop up the result.
  function simulateMyGamesThisWeek() {
    var games = myUnplayedGamesThisWeek();
    if (!games.length || !Sim) return [];
    games.forEach(function (g) { Sim.simulateAndApply(g); });
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

    var weeksTotal = settings().offseasonWeeks || 5;
    if (season.calendarWeek >= weeksTotal) {
      // No more recurring Entry Draft — the only draft in a save is the
      // one-time Startup Draft. New rookies/prospects are generated
      // straight into free agency below instead (see Stats.generateRookieClass()).
      var Stats = window.PHLStats;
      var retired = Stats ? Stats.ageAndDeclinePlayers() : [];
      var rookies = Stats ? Stats.generateRookieClass() : [];
      summary.push(retired.length + " player(s) retired, " + rookies.length + " breakout rookie(s) joined free agency.");
      window.PHLSchedule.generateSeasonSchedule(); // also sets phase="regular", calendarWeek=1
      summary.push("The regular season begins.");
    } else {
      S.updateSeason({ calendarWeek: season.calendarWeek + 1 });
    }
  }

  // Weeks 10-11 of the regular season are the mid-season trade-deadline
  // break — no games are scheduled for them (see js/schedule.js
  // BREAK_WEEKS), but it's still the last window for trades, free-agent
  // signings, and roster drops before the deadline locks at week 12.
  var BREAK_WEEKS = [10, 11];

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

    // First-half MVPs are revealed right at week 7 of the regular season
    // (see js/mvp.js) — one per division.
    if (season.calendarWeek === 7 && window.PHLMvp) {
      window.PHLMvp.computeFirstHalfMvps();
      summary.push("First-Half MVPs have been announced around the league.");
    }

    var weeksTotal = settings().regularSeasonWeeks || 12;
    var nextWeek = season.calendarWeek + 1;
    if (season.calendarWeek >= weeksTotal) {
      if (window.PHLMvp) {
        window.PHLMvp.computeSecondHalfMvps();
        summary.push("Second-Half MVPs have been announced around the league.");
      }
      var Playoffs = window.PHLPlayoffs;
      S.getDivisions().forEach(function (d) {
        Playoffs.startPlayoffs(d.id);
      });
      S.updateSeason({ phase: "playoffs", calendarWeek: 1 });
      summary.push("Regular season complete — the playoffs begin.");
    } else {
      // The trade deadline locks league-wide the moment the break ends
      // (week 12 onward) — trades, free-agent signings, and releases stay
      // blocked through the rest of the season and all of the playoffs,
      // until the next off-season begins (see js/state.js
      // isTransactionWindowOpen).
      if (BREAK_WEEKS.indexOf(nextWeek) === -1 && nextWeek > BREAK_WEEKS[BREAK_WEEKS.length - 1] && season.calendarWeek <= BREAK_WEEKS[BREAK_WEEKS.length - 1]) {
        summary.push("The trade deadline has passed — trades, free-agent signings, and releases are locked league-wide until the next off-season.");
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
    if (Scrims) {
      Scrims.weeklyChemistryUpkeep();
      Scrims.resetWeeklyUsage();
    }

    var season = S.getSeason();
    var summary = [];
    if (season.phase === "offseason") runOffseasonWeek(season, summary);
    else if (season.phase === "regular") runRegularWeek(season, summary);
    else if (season.phase === "playoffs") runPlayoffsWeek(season, summary);
    else summary.push("Nothing to advance.");

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
