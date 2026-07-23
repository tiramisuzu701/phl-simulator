/* PHL Franchise Simulator — AI team behavior
 * Global namespace: window.PHLAIManager
 *
 * Everything here runs automatically — there's no UI. The weekly calendar
 * engine (js/calendar.js) calls into this module so every team except the
 * human GM's stays reasonably competitive on its own: filling lineup
 * holes from free agency, occasionally calling a clear upgrade up from a
 * lower division, and staying under the salary cap.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;

  function aiTeams() {
    var franchiseTeamId = (S.getFranchise() || {}).teamId;
    return S.getTeams().filter(function (t) { return t.id !== franchiseTeamId; });
  }

  function isEligible(player, divisionId) {
    if (!player.eligibleDivisions || !player.eligibleDivisions.length) return true;
    return player.eligibleDivisions.indexOf(divisionId) !== -1;
  }

  // ---------------- Free agency ----------------
  // Each AI team looks for the biggest lineup hole first (below the active
  // lineup minimum at a position), then — once the basics are covered —
  // will still add affordable depth/upgrades so rosters don't stagnate.
  // Capped at a handful of moves per team per call so one tick can't empty
  // the free agent pool in one shot.
  function aiSignFreeAgents() {
    var settings = S.getSettings();
    var lineup = settings.lineup || { F: 2, D: 2, G: 1 };
    var signed = [];
    aiTeams().forEach(function (team) {
      var guard = 0;
      while (guard < 4) {
        guard++;
        var roster = S.getRoster(team.id);
        if (roster.length >= settings.rosterMax) break;
        var space = S.capSpace(team.id);
        if (space <= 0) break;
        var counts = { F: 0, D: 0, G: 0 };
        roster.forEach(function (p) { counts[p.position] = (counts[p.position] || 0) + 1; });
        var neededPos = ["G", "D", "F"].filter(function (pos) { return counts[pos] < (lineup[pos] || 0); })[0];

        var candidates = S.getFreeAgents().filter(function (p) {
          if (!isEligible(p, team.division)) return false;
          if (p.salary > space) return false;
          return neededPos ? p.position === neededPos : counts[p.position] < 4; // depth cap when no urgent need
        });
        if (!candidates.length) break;
        candidates.sort(function (a, b) { return b.overall - a.overall; });
        var top = candidates.slice(0, Math.min(3, candidates.length));
        var pick = U.pick(top);
        S.updatePlayer(pick.id, { teamId: team.id, contractYears: pick.contractYears || 2, eligibleDivisions: null });
        signed.push({ teamId: team.id, playerId: pick.id });
      }
    });
    return signed;
  }

  // ---------------- Promotions ----------------
  // At most one call-up attempt per AI team per tick, and only when the
  // available lower-division player is a clear upgrade (overall + 3 or
  // more) over that team's current weakest player at the same position —
  // otherwise it's not worth burning cap space and a roster spot on.
  function aiRunPromotions() {
    var P = window.PHLPromotions;
    if (!P || !P.isOffseasonWindow()) return [];
    var done = [];
    aiTeams().forEach(function (team) {
      var roster = S.getRoster(team.id);
      if (roster.length >= S.getSettings().rosterMax) return;
      var pool = P.eligiblePlayers(team.id).slice().sort(function (a, b) { return b.overall - a.overall; });
      if (!pool.length) return;
      var candidate = pool[0];
      var space = S.capSpace(team.id);
      var fee = P.callUpFee(candidate);
      if (fee * 2 > space) return; // call-up fee + the player's own new salary (same figure) must both fit
      var weakestAtPos = roster.filter(function (p) { return p.position === candidate.position; })
        .sort(function (a, b) { return a.overall - b.overall; })[0];
      if (weakestAtPos && candidate.overall < weakestAtPos.overall + 3) return; // not a meaningful upgrade
      if (P.promotePlayer(candidate.id, team.id)) done.push({ teamId: team.id, playerId: candidate.id });
    });
    return done;
  }

  // ---------------- Salary cap enforcement ----------------
  // Releases the lowest-Overall players on a team, one at a time, until
  // it's cap-compliant. Used automatically for every AI team; the human
  // GM's own team is deliberately left alone here — see
  // enforceCapForAllTeams(), which the calendar engine uses to block
  // Advance Week until the user fixes their own roster by hand.
  function autoReleaseToCompliance(teamId) {
    var released = [];
    var guard = 0;
    while (S.capSpace(teamId) < 0 && guard < 30) {
      guard++;
      var roster = S.getRoster(teamId).slice().sort(function (a, b) { return a.overall - b.overall; });
      if (!roster.length) break;
      var cut = roster[0];
      S.updatePlayer(cut.id, { teamId: null });
      released.push(cut);
    }
    return released;
  }

  // Runs cap compliance across the whole league. AI teams over the cap get
  // auto-fixed; if the human's own team is over, it's reported back
  // (unfixed) so the calendar engine can block Advance Week on it.
  function enforceCapForAllTeams() {
    var franchiseTeamId = (S.getFranchise() || {}).teamId;
    var released = [];
    var userOverCap = null;
    S.getTeams().forEach(function (t) {
      var space = S.capSpace(t.id);
      if (space >= 0) return;
      if (t.id === franchiseTeamId) {
        userOverCap = { teamId: t.id, overBy: -space };
        return;
      }
      var cut = autoReleaseToCompliance(t.id);
      if (cut.length) released.push({ teamId: t.id, players: cut });
    });
    return { released: released, userOverCap: userOverCap };
  }

  window.PHLAIManager = {
    aiSignFreeAgents: aiSignFreeAgents,
    aiRunPromotions: aiRunPromotions,
    enforceCapForAllTeams: enforceCapForAllTeams,
    autoReleaseToCompliance: autoReleaseToCompliance,
  };
})();
