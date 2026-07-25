/* PHL Franchise Simulator — Management Offers (GM Offers)
 * Global namespace: window.PHLGmOffers
 *
 * Once each off-season begins (see js/calendar.js runPlayoffsWeek), other
 * teams — from any division — may reach out wanting the user to become
 * THEIR general manager instead of the one they currently run. How many
 * offers show up, and how prestigious the offering teams tend to be,
 * scales with how the user's team just did: winning a division
 * championship draws the most and the best; making the playoffs draws a
 * couple of decent ones; missing them draws at most one, and it's much
 * more likely to be a lateral or rebuilding team. Offers are read from
 * the CURRENT off-season's own S.getSeason().playoffs snapshot — still
 * intact at this point since js/schedule.js generateSeasonSchedule (the
 * thing that wipes it) hasn't run yet for the season that's about to
 * start.
 *
 * Accepting reassigns the user's whole franchise via js/state.js
 * setFranchise — the team they leave behind simply becomes AI-managed,
 * like any other team in the league, no special handling needed. See
 * js/inbox.js resolveManagementOffer for how a queued offer actually gets
 * accepted or rejected.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;

  var TIER_CONFIG = {
    champion: { maxOffers: 3, chance: 0.9, power: 2.2 },
    playoffs: { maxOffers: 2, chance: 0.6, power: 1.4 },
    missed: { maxOffers: 1, chance: 0.25, power: 0.6 },
  };

  // "champion" / "playoffs" / "missed" — judged off the division bracket
  // the user's team just finished playing in.
  function successTier(userTeamId) {
    var team = S.getTeam(userTeamId);
    if (!team) return "missed";
    var bracket = (S.getSeason().playoffs || {})[team.division];
    if (bracket && bracket.champion === userTeamId) return "champion";
    if (bracket && (bracket.seeds || []).some(function (s) { return s.teamId === userTeamId; })) return "playoffs";
    return "missed";
  }

  // Higher-tier divisions and better recent records both raise a team's
  // pull as a destination — see js/state.js snapshotTeamRecordsForCap for
  // where lastSeasonWins/lastSeasonGames come from.
  function teamPrestige(t) {
    var div = S.getDivision(t.division);
    var tierWeight = div ? div.tier : 1;
    var games = t.lastSeasonGames || 0;
    var winPct = games > 0 ? (t.lastSeasonWins || 0) / games : 0.5;
    return tierWeight * (0.5 + winPct);
  }

  function generateOffers() {
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) return [];
    var userTeam = S.getTeam(franchise.teamId);
    if (!userTeam) return [];
    var tier = successTier(userTeam.id);
    var cfg = TIER_CONFIG[tier];
    var candidates = S.getTeams().filter(function (t) { return t.id !== userTeam.id; });
    if (!candidates.length) return [];

    var offeredIds = [];
    for (var i = 0; i < cfg.maxOffers; i++) {
      if (Math.random() > cfg.chance) continue;
      var pool = candidates.filter(function (t) { return offeredIds.indexOf(t.id) === -1; });
      if (!pool.length) break;
      var chosen = U.weightedPick(pool.map(function (t) {
        return { item: t, weight: Math.pow(Math.max(0.1, teamPrestige(t)), cfg.power) };
      }));
      if (!chosen) break;
      offeredIds.push(chosen.id);
      var div = S.getDivision(chosen.division);
      var reasonText = tier === "champion" ? " after watching you win a division championship"
        : tier === "playoffs" ? " after watching you make the playoffs"
        : "";
      if (window.PHLInbox) {
        window.PHLInbox.addNotification({
          type: "management-offer",
          title: chosen.name + " wants YOU as their GM",
          body: chosen.name + " (" + (div ? div.name : "?") + " Division) wants to hire you away as their new General Manager" + reasonText +
            ". Accepting hands " + userTeam.name + " to the AI and puts you in charge of " + chosen.name + " instead — this can't be undone.",
          actionable: true,
          payload: { teamId: chosen.id, divisionId: chosen.division, fromTeamId: userTeam.id },
        });
      }
    }
    return offeredIds;
  }

  window.PHLGmOffers = {
    generateOffers: generateOffers,
    successTier: successTier,
  };
})();
