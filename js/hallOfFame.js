/* PHL Franchise Simulator — Hall of Fame
 * Global namespace: window.PHLHallOfFame
 *
 * Induction is automatic and evaluated once, at the moment a player
 * retires (see js/stats.js ageAndDeclinePlayers, which calls
 * evaluateRetiree for every player who just hung it up). It's a
 * combination of career-stats weight and career hardware (MVP awards —
 * js/mvp.js — plus the season awards in js/awards.js): a very good long
 * career can get someone in on stats alone, a shorter career loaded with
 * awards can get someone in on hardware alone, and most inductees will be
 * some blend of both. Rendered on the Stats & Offseason > Hall of Fame tab
 * (see js/stats.js renderHallOfFameView).
 */
(function () {
  "use strict";
  var S = window.PHLState;

  // Every MVP/season award this player ever won, across every season —
  // each one is worth a flat bonus toward their Hall of Fame score.
  function careerAwardCount(playerId) {
    var mvp = S.getMvpAwards().filter(function (a) { return a.playerId === playerId; }).length;
    var season = S.getSeasonAwards().filter(function (a) { return a.playerId === playerId; }).length;
    return mvp + season;
  }

  function statScore(p) {
    var cs = p.careerStats;
    if (!cs || !cs.gp) return 0;
    if (p.position === "G") {
      return cs.gp * 0.4 + (cs.svPct || 0) * 200 - (cs.gaa || 0) * 10;
    }
    return cs.pts * 1.0 + cs.gp * 0.15 + Math.max(0, cs.plusMinus || 0) * 0.3;
  }

  var AWARD_WEIGHT = 40;
  var INDUCTION_THRESHOLD = 220;

  function hofScore(p) {
    return statScore(p) + careerAwardCount(p.id) * AWARD_WEIGHT;
  }

  // Called once per retiree, right when they retire (see
  // js/stats.js ageAndDeclinePlayers) — assumes the caller has ALREADY
  // folded their final season into p.careerStats (via
  // S.accumulateCareerStats) before calling this, so the score reflects a
  // true lifetime total. `lastTeamId` is the team they were just released
  // from (js/stats.js captures it before clearing p.teamId to null on
  // retirement) — needed here only to scope the Inbox notification to the
  // user's own team/division, same as every other award notification.
  function evaluateRetiree(p, lastTeamId) {
    if (S.isHallOfFamer(p.id)) return null;
    var score = hofScore(p);
    if (score < INDUCTION_THRESHOLD) return null;
    var entry = S.addHallOfFameEntry({
      playerId: p.id,
      playerName: p.name,
      position: p.position,
      season: S.getSeasonNumber(),
      score: Math.round(score),
      careerStats: JSON.parse(JSON.stringify(p.careerStats)),
      awardCount: careerAwardCount(p.id),
    });
    if (window.PHLInbox && S.isUserRelevantTeam(lastTeamId)) {
      window.PHLInbox.addNotification({
        type: "award",
        title: "Hall of Fame",
        body: p.name + " has been inducted into the PHL Hall of Fame!",
      });
    }
    return entry;
  }

  window.PHLHallOfFame = {
    hofScore: hofScore,
    careerAwardCount: careerAwardCount,
    evaluateRetiree: evaluateRetiree,
    INDUCTION_THRESHOLD: INDUCTION_THRESHOLD,
  };
})();
