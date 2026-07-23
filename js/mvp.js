/* PHL Franchise Simulator — MVP awards
 * Global namespace: window.PHLMvp
 *
 * Per-division awards (one league feels flat with 26 teams sharing a
 * single MVP): a First-Half MVP revealed at regular-season week 7, a
 * Second-Half MVP revealed right as the playoffs begin (computed off a
 * week-7 stat snapshot so it reflects weeks 8-12 only, not the full
 * season), and a Playoff Series MVP for every completed best-of-7 series
 * (see js/playoffs.js onSeriesWon, which calls seriesMvp()).
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;

  function scoreFor(p, stats) {
    if (!stats || !stats.gp) return -Infinity;
    if (p.position === "G") {
      if (stats.gp < 2) return -Infinity;
      return (stats.svPct || 0) * 140 - (stats.gaa || 0) * 8 + stats.gp * 0.5;
    }
    return stats.pts * 2 + (stats.plusMinus || 0) * 0.5 + stats.gp * 0.2;
  }

  function pickBest(players, statsFn) {
    var best = null;
    var bestScore = -Infinity;
    players.forEach(function (p) {
      var s = scoreFor(p, statsFn(p));
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    });
    return best;
  }

  function rosteredInDivision(divisionId) {
    var teamIds = S.getTeams(divisionId).map(function (t) { return t.id; });
    return S.getPlayers().filter(function (p) {
      return p.teamId && teamIds.indexOf(p.teamId) !== -1 && !p.retired;
    });
  }

  function computeFirstHalfMvps() {
    var season = S.getSeason();
    S.getDivisions().forEach(function (div) {
      var players = rosteredInDivision(div.id);
      // Snapshot every rostered player's stats right now so the second-half
      // award (computed at playoffs' start) can diff against this baseline.
      players.forEach(function (p) {
        S.updatePlayer(p.id, { statsAtHalf: JSON.parse(JSON.stringify(p.stats)) });
      });
      var best = pickBest(players, function (p) { return p.stats; });
      if (best) {
        S.addMvpAward({ season: season.seasonNumber, divisionId: div.id, type: "first-half", playerId: best.id, week: season.calendarWeek });
        if (window.PHLInbox) {
          window.PHLInbox.addNotification({
            type: "award",
            title: (S.getDivision(div.id) || {}).name + " First-Half MVP",
            body: best.name + " has been named First-Half MVP of the " + (S.getDivision(div.id) || {}).name + " Division!",
          });
        }
      }
    });
  }

  function diffStats(current, snapshot) {
    snapshot = snapshot || S.freshStatLine();
    current = current || S.freshStatLine();
    var gp = (current.gp || 0) - (snapshot.gp || 0);
    var saves = (current.saves || 0) - (snapshot.saves || 0);
    var shotsAgainst = (current.shotsAgainst || 0) - (snapshot.shotsAgainst || 0);
    var goalsAgainst = (current.goalsAgainst || 0) - (snapshot.goalsAgainst || 0);
    return {
      gp: gp,
      pts: (current.pts || 0) - (snapshot.pts || 0),
      plusMinus: (current.plusMinus || 0) - (snapshot.plusMinus || 0),
      saves: saves,
      shotsAgainst: shotsAgainst,
      goalsAgainst: goalsAgainst,
      svPct: shotsAgainst > 0 ? U.round3(saves / shotsAgainst) : 0,
      gaa: gp > 0 ? U.round1(goalsAgainst / gp) : 0,
    };
  }

  function computeSecondHalfMvps() {
    var season = S.getSeason();
    S.getDivisions().forEach(function (div) {
      var players = rosteredInDivision(div.id);
      var best = pickBest(players, function (p) { return diffStats(p.stats, p.statsAtHalf); });
      if (best) {
        S.addMvpAward({ season: season.seasonNumber, divisionId: div.id, type: "second-half", playerId: best.id });
        if (window.PHLInbox) {
          window.PHLInbox.addNotification({
            type: "award",
            title: (S.getDivision(div.id) || {}).name + " Second-Half MVP",
            body: best.name + " has been named Second-Half MVP of the " + (S.getDivision(div.id) || {}).name + " Division heading into the playoffs!",
          });
        }
      }
    });
  }

  // Best performer across every game of a completed playoff series, scored
  // straight off that series' own stored box scores (not playoffStats,
  // which accumulates across the WHOLE playoffs — a series MVP should only
  // reflect that one matchup).
  function seriesMvp(series, divisionId) {
    var totals = {};
    (series.games || []).forEach(function (g) {
      if (!g.boxscore) return;
      Object.keys(g.boxscore.skaterLines || {}).forEach(function (pid) {
        var line = g.boxscore.skaterLines[pid];
        totals[pid] = (totals[pid] || 0) + line.g * 2 + line.a * 1.3 + (line.plusMinus || 0) * 0.4;
      });
      Object.keys(g.boxscore.goalieLines || {}).forEach(function (pid) {
        var line = g.boxscore.goalieLines[pid];
        var svPct = line.shotsAgainst > 0 ? line.saves / line.shotsAgainst : 0;
        totals[pid] = (totals[pid] || 0) + svPct * 25 - (line.goalsAgainst || 0) * 1.2;
      });
    });
    var bestId = null;
    var bestScore = -Infinity;
    Object.keys(totals).forEach(function (pid) {
      if (totals[pid] > bestScore) { bestScore = totals[pid]; bestId = pid; }
    });
    if (!bestId) return null;
    var season = S.getSeason();
    S.addMvpAward({ season: season.seasonNumber, divisionId: divisionId, type: "playoff-series", seriesId: series.id, playerId: bestId });
    var p = S.getPlayer(bestId);
    if (window.PHLInbox && p) {
      window.PHLInbox.addNotification({
        type: "award",
        title: "Series MVP",
        body: p.name + " was named MVP of a playoff series!",
      });
    }
    return bestId;
  }

  window.PHLMvp = {
    computeFirstHalfMvps: computeFirstHalfMvps,
    computeSecondHalfMvps: computeSecondHalfMvps,
    seriesMvp: seriesMvp,
  };
})();
