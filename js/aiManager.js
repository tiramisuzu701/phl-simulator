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
      var division = S.getDivision(team.division);
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
          var asking = U.contractAskingPrice(p, division ? division.tier : null);
          if (asking > space) return false;
          return neededPos ? p.position === neededPos : counts[p.position] < 4; // depth cap when no urgent need
        });
        if (!candidates.length) break;
        candidates.sort(function (a, b) { return b.overall - a.overall; });
        var top = candidates.slice(0, Math.min(3, candidates.length));
        var pick = U.pick(top);
        // Offer right at asking price (AI teams don't lowball), with a
        // length weighted toward the middle of the 1-5yr range. Same
        // reject-chance dice every human offer rolls against — an AI
        // signing isn't guaranteed just because it's automatic.
        var years = U.randInt(2, 4);
        var asking = U.contractAskingPrice(pick, division ? division.tier : null);
        if (Math.random() < U.contractRejectChance(asking, asking, years)) break; // rare, but a player can still say no
        S.updatePlayer(pick.id, { teamId: team.id, contractYears: years, salary: asking, eligibleDivisions: null });
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
    var franchiseTeamId = (S.getFranchise() || {}).teamId;
    var done = [];
    aiTeams().forEach(function (team) {
      var roster = S.getRoster(team.id);
      if (roster.length >= S.getSettings().rosterMax) return;
      // Never poach a player off the human GM's own roster — the AI is only
      // allowed to touch its own teams' contracts. See eligiblePlayers() in
      // promotions.js, which otherwise has no concept of "whose team is
      // this" — it only checks division tier.
      var pool = P.eligiblePlayers(team.id)
        .filter(function (p) { return p.teamId !== franchiseTeamId; })
        .sort(function (a, b) { return b.overall - a.overall; });
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

  // ---------------- AI-AI trades (in-division only) ----------------
  // Fuller depth target the same as the Startup Draft aims for — a team
  // "thin" at a position relative to this is a trade candidate to fix it.
  var DEPTH_TARGET = { F: 3, D: 3, G: 2 };

  function positionCounts(teamId) {
    var counts = { F: 0, D: 0, G: 0 };
    S.getRoster(teamId).forEach(function (p) { if (counts[p.position] != null) counts[p.position] += 1; });
    return counts;
  }

  // Position this team is thinnest at relative to DEPTH_TARGET, or null if
  // every position is already at/above target.
  function weakestNeed(teamId) {
    var counts = positionCounts(teamId);
    var worst = null;
    var worstDeficit = 0;
    ["G", "D", "F"].forEach(function (pos) {
      var deficit = DEPTH_TARGET[pos] - counts[pos];
      if (deficit > worstDeficit) { worstDeficit = deficit; worst = pos; }
    });
    return worst;
  }

  // Each in-division pair of AI teams occasionally swaps a player 1-for-1
  // when it fixes a real need on both sides at a fair-ish value — mirrors
  // the acceptance threshold js/trades.js uses for user-proposed trades.
  // Never touches the human GM's roster (see aiProposeTradesToUser for
  // that path, which is actionable via the Inbox instead of automatic).
  function aiRunTrades() {
    var Trades = window.PHLTrades;
    if (!Trades) return [];
    var franchiseTeamId = (S.getFranchise() || {}).teamId;
    var completed = [];
    S.getDivisions().forEach(function (div) {
      var aiInDiv = S.getTeams(div.id).filter(function (t) { return t.id !== franchiseTeamId; });
      if (aiInDiv.length < 2) return;
      for (var attempt = 0; attempt < 2; attempt++) {
        var a = U.pick(aiInDiv);
        var partners = aiInDiv.filter(function (t) { return t.id !== a.id; });
        if (!partners.length) continue;
        var b = U.pick(partners);
        var rosterA = S.getRoster(a.id);
        var rosterB = S.getRoster(b.id);
        if (rosterA.length < 6 || rosterB.length < 6) continue; // keep enough depth to trade safely
        var needA = weakestNeed(a.id);
        var needB = weakestNeed(b.id);
        if (!needA || !needB || needA === needB) continue;
        var giveCandidate = rosterA.filter(function (p) { return p.position === needB; }).sort(function (x, y) { return x.overall - y.overall; })[0];
        var getCandidate = rosterB.filter(function (p) { return p.position === needA; }).sort(function (x, y) { return y.overall - x.overall; })[0];
        if (!giveCandidate || !getCandidate) continue;
        if (!S.wouldMeetRosterMinimum(a.id, [giveCandidate.id], [getCandidate])) continue;
        if (!S.wouldMeetRosterMinimum(b.id, [getCandidate.id], [giveCandidate])) continue;
        var capAOk = S.capForTeam(a.id) >= (S.capUsed(a.id) - giveCandidate.salary + getCandidate.salary);
        var capBOk = S.capForTeam(b.id) >= (S.capUsed(b.id) - getCandidate.salary + giveCandidate.salary);
        if (!capAOk || !capBOk) continue;
        var valGive = Trades.tradeValue(giveCandidate);
        var valGet = Trades.tradeValue(getCandidate);
        if (valGet < valGive * 0.85 || valGive < valGet * 0.85) continue; // neither side accepts a lopsided swap

        S.updatePlayer(giveCandidate.id, { teamId: b.id });
        S.updatePlayer(getCandidate.id, { teamId: a.id });
        S.addTrade({ season: S.getSeason().seasonNumber || 1, teamAId: a.id, teamBId: b.id, playersToB: [giveCandidate.id], playersToA: [getCandidate.id] });
        completed.push({ teamAId: a.id, teamBId: b.id, playerToB: giveCandidate.id, playerToA: getCandidate.id });
        if (window.PHLInbox) {
          window.PHLInbox.addNotification({
            type: "trade",
            title: "In-division trade",
            body: a.name + " traded " + giveCandidate.name + " to " + b.name + " for " + getCandidate.name + ".",
          });
        }
      }
    });
    return completed;
  }

  // ---------------- AI -> user trade offers (in-division only) ----------
  // Never executes automatically — queues an actionable Inbox entry (see
  // js/inbox.js) the human GM accepts or rejects.
  function aiProposeTradesToUser() {
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) return [];
    var myTeam = S.getTeam(franchise.teamId);
    if (!myTeam) return [];
    var Trades = window.PHLTrades;
    var Inbox = window.PHLInbox;
    if (!Trades || !Inbox) return [];
    // Don't pile up offers — cap how many unresolved ones can be pending.
    var pendingOffers = S.getNotifications().filter(function (n) { return n.type === "trade-offer"; });
    if (pendingOffers.length >= 3) return [];
    if (Math.random() > 0.35) return []; // not every tick generates an offer

    var partners = S.getTeams(myTeam.division).filter(function (t) { return t.id !== myTeam.id; });
    if (!partners.length) return [];
    var partner = U.pick(partners);
    var myRoster = S.getRoster(myTeam.id);
    var partnerRoster = S.getRoster(partner.id);
    if (myRoster.length < 6 || partnerRoster.length < 6) return [];

    var need = weakestNeed(partner.id);
    if (!need) return [];
    // The AI wants a player at its need position from the user's roster —
    // pick one of the user's decent-but-not-best players at that spot so
    // the offer feels plausible rather than a lowball for a star.
    var userCandidates = myRoster.filter(function (p) { return p.position === need; }).sort(function (a, b) { return b.overall - a.overall; });
    if (!userCandidates.length) return [];
    var wants = userCandidates[Math.min(1, userCandidates.length - 1)];
    var wantsValue = Trades.tradeValue(wants);
    // What the AI offers back: closest-value player it can spare at a
    // position the user doesn't already have plenty of, within ~15%.
    var offerCandidates = partnerRoster.slice().sort(function (a, b) {
      return Math.abs(Trades.tradeValue(a) - wantsValue) - Math.abs(Trades.tradeValue(b) - wantsValue);
    });
    var gives = offerCandidates.find(function (p) {
      var giveVal = Trades.tradeValue(p);
      return giveVal >= wantsValue * 0.85 && giveVal <= wantsValue * 1.05;
    });
    if (!gives) return [];
    if (!S.wouldMeetRosterMinimum(partner.id, [gives.id], [wants])) return [];
    if (!S.wouldMeetRosterMinimum(myTeam.id, [wants.id], [gives])) return [];

    Inbox.addTradeOffer(partner.id, myTeam.id, gives.id, wants.id);
    return [{ aiTeamId: partner.id, userTeamId: myTeam.id }];
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
      // Roster minimum (2F/2D/1G, 5 players) wins over cap compliance —
      // release the lowest-overall player that can go WITHOUT breaking the
      // minimum; if none can, stop (the team stays over cap rather than
      // becoming roster-illegal). AI-team cap overages don't block Advance
      // Week anyway (see js/calendar.js checkBlocked), so this is a safe
      // trade-off.
      var cut = roster.find(function (p) { return S.wouldMeetRosterMinimum(teamId, [p.id]); });
      if (!cut) break;
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
    aiRunTrades: aiRunTrades,
    aiProposeTradesToUser: aiProposeTradesToUser,
    enforceCapForAllTeams: enforceCapForAllTeams,
    autoReleaseToCompliance: autoReleaseToCompliance,
  };
})();
