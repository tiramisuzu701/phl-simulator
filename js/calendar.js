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
    return null;
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

  function runRegularWeek(season, summary) {
    var count = window.PHLSchedule.simulateCalendarWeek(season.calendarWeek);
    summary.push(count + " game(s) played across the league this week.");

    var AI = window.PHLAIManager;
    if (AI) {
      var traded = AI.aiRunTrades();
      if (traded.length) summary.push(traded.length + " in-division AI trade(s) around the league.");
      AI.aiProposeTradesToUser();
    }

    // First-half MVPs are revealed right at week 7 of the 12-week regular
    // season (see js/mvp.js) — one per division.
    if (season.calendarWeek === 7 && window.PHLMvp) {
      window.PHLMvp.computeFirstHalfMvps();
      summary.push("First-Half MVPs have been announced around the league.");
    }

    var weeksTotal = settings().regularSeasonWeeks || 12;
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
      S.updateSeason({ calendarWeek: season.calendarWeek + 1 });
    }
  }

  function runPlayoffsWeek(season, summary) {
    var Playoffs = window.PHLPlayoffs;
    var anyActive = false;
    S.getDivisions().forEach(function (d) {
      var wasChampioned = !!((S.getSeason().playoffs || {})[d.id] || {}).champion;
      if (Playoffs.simulateOneRound(d.id)) anyActive = true;
      var bracket = (S.getSeason().playoffs || {})[d.id];
      if (bracket && bracket.champion && !wasChampioned && window.PHLInbox) {
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
  };
})();
