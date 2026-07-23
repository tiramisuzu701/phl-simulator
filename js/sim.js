/* PHL Franchise Simulator — rating-based game simulation engine
 * Global namespace: window.PHLSim
 * Puck is played 2 Forwards + 2 Defenders + 1 Goalie per side.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;

  var REPLACEMENT = 50; // fallback rating used when a team lacks players at a spot

  function byOverallDesc(a, b) {
    return b.overall - a.overall;
  }

  // Weighted-random pick of `n` players out of `pool` without replacement,
  // favoring higher overall but not exclusively — used to give AI teams a
  // rotating lineup outside the playoffs instead of always dressing the
  // same strict best-available group every single game (see
  // pickLineupGroup below). Weight grows steeply with overall so the gap
  // between a 90 and a 60 overall is still huge, but a bench player still
  // has a real (if small) shot at getting picked over a marginally better
  // teammate on any given night.
  function weightedRotationPick(pool, n) {
    var remaining = pool.slice();
    var picked = [];
    for (var i = 0; i < n && remaining.length; i++) {
      var chosen = U.weightedPick(remaining.map(function (p) {
        return { item: p, weight: Math.pow(Math.max(1, p.overall), 1.8) };
      }));
      if (!chosen) break;
      picked.push(chosen);
      remaining = remaining.filter(function (p) { return p.id !== chosen.id; });
    }
    return picked;
  }

  // Picks `count` players at `position` for the active lineup. If the user
  // has manually flagged enough players as starters at that position (see
  // the Players tab), those are used (best-overall-first among them).
  // Otherwise: a human-managed team (or any team during the playoffs)
  // falls back to simply taking the best players available at that
  // position, exactly as before. An AI-managed team outside the playoffs
  // instead rotates through its depth with a weighted random pick — AI-managed
  // teams never set the `starter` flag, so they always hit this path when
  // it isn't the playoffs, giving bench players real (if less frequent)
  // playing time instead of the same lineup every week.
  function pickLineupGroup(roster, position, count, teamId) {
    var atPos = roster.filter(function (p) { return p.position === position; });
    var starters = atPos.filter(function (p) { return !!p.starter; }).sort(byOverallDesc);
    if (starters.length >= count) return starters.slice(0, count);
    var phase = (S.getSeason() || {}).phase;
    var rotate = teamId && !S.isManagedTeam(teamId) && phase !== "playoffs";
    if (rotate && atPos.length > count) {
      return weightedRotationPick(atPos, count);
    }
    return atPos.sort(byOverallDesc).slice(0, count);
  }

  function getActiveLineup(teamId) {
    var roster = S.getRoster(teamId);
    var forwards = pickLineupGroup(roster, "F", 2, teamId);
    var defenders = pickLineupGroup(roster, "D", 2, teamId);
    var goalies = pickLineupGroup(roster, "G", 1, teamId);
    var goalie = goalies.length ? goalies[0] : null;
    return { forwards: forwards, defenders: defenders, goalie: goalie };
  }

  function offenseRating(lineup) {
    var fOff = lineup.forwards.length ? U.avg(lineup.forwards.map(function (p) { return p.attributes.offense; })) : REPLACEMENT;
    var dOff = lineup.defenders.length ? U.avg(lineup.defenders.map(function (p) { return p.attributes.offense; })) : REPLACEMENT;
    return fOff * 0.65 + dOff * 0.35;
  }
  function defenseRating(lineup) {
    var dDef = lineup.defenders.length ? U.avg(lineup.defenders.map(function (p) { return p.attributes.defense; })) : REPLACEMENT;
    var fDef = lineup.forwards.length ? U.avg(lineup.forwards.map(function (p) { return p.attributes.defense; })) : REPLACEMENT;
    return dDef * 0.6 + fDef * 0.4;
  }
  function goalieRating(lineup) {
    return lineup.goalie ? lineup.goalie.attributes.goaltending : REPLACEMENT;
  }

  // ---- Team chemistry (Scrims, js/scrims.js) ----------------------------
  // A team's chemistry (0-100, baseline 50) nudges both its offense and
  // defense a little in either direction — small enough to never dominate
  // the sim, but a real, visible payoff for running scrims.
  function chemistryRatingBonus(teamId) {
    var t = S.getTeam(teamId);
    var chem = t && t.chemistry != null ? t.chemistry : 50;
    return (chem - 50) / 12; // roughly -4.2 .. +4.2
  }

  function pickScorer(skaters, excludeId) {
    var pool = skaters.filter(function (p) { return p.id !== excludeId; });
    if (!pool.length) pool = skaters;
    return U.weightedPick(
      pool.map(function (p) {
        var w = p.attributes.offense * (p.position === "F" ? 1.4 : 1.0);
        return { item: p, weight: Math.max(1, w) };
      })
    );
  }

  // Simulates one game between two teams. Does NOT mutate state — returns a
  // result object. Call applyResult() to persist it.
  function simulateGame(homeTeamId, awayTeamId) {
    var home = getActiveLineup(homeTeamId);
    var away = getActiveLineup(awayTeamId);

    var homeChem = chemistryRatingBonus(homeTeamId);
    var awayChem = chemistryRatingBonus(awayTeamId);
    var homeOff = offenseRating(home) + homeChem;
    var awayOff = offenseRating(away) + awayChem;
    var homeDefEff = defenseRating(home) * 0.5 + goalieRating(home) * 0.5 + homeChem * 0.6;
    var awayDefEff = defenseRating(away) * 0.5 + goalieRating(away) * 0.5 + awayChem * 0.6;

    var BASE = 3.1;
    var noiseHome = 0.85 + Math.random() * 0.3;
    var noiseAway = 0.85 + Math.random() * 0.3;

    var expHome = BASE * (homeOff / awayDefEff) * 1.06 * noiseHome;
    var expAway = BASE * (awayOff / homeDefEff) * 0.97 * noiseAway;

    var homeScore = U.poisson(expHome);
    var awayScore = U.poisson(expAway);
    var wentToOT = false;

    if (homeScore === awayScore) {
      wentToOT = true;
      var homeStrength = homeOff + homeDefEff + goalieRating(home);
      var awayStrength = awayOff + awayDefEff + goalieRating(away);
      var homeWinsOT = U.weightedPick([
        { item: true, weight: homeStrength + 20 }, // small home-ice edge in OT
        { item: false, weight: awayStrength },
      ]);
      if (homeWinsOT) homeScore += 1;
      else awayScore += 1;
    }

    var boxscore = buildBoxscore(home, away, homeScore, awayScore, homeOff, awayOff, homeDefEff, awayDefEff);

    return {
      homeScore: homeScore,
      awayScore: awayScore,
      wentToOT: wentToOT,
      boxscore: boxscore,
    };
  }

  function shotsFacedEstimate(goalsAllowed, opponentOffense, teamDefenseEff) {
    var swing = (opponentOffense - teamDefenseEff) / 3;
    var shots = Math.round(20 + swing + U.randInt(-4, 4));
    return Math.max(goalsAllowed + U.randInt(4, 10), shots, goalsAllowed);
  }

  function scoreGoals(count, lineup, oppLineup, side) {
    var events = [];
    var skaters = lineup.forwards.concat(lineup.defenders);
    if (!skaters.length) return events; // nobody to credit, still counts on scoreboard
    for (var i = 0; i < count; i++) {
      var scorer = pickScorer(skaters, null);
      var assists = [];
      var roll = Math.random();
      var numAssists = roll < 0.15 ? 0 : roll < 0.75 ? 1 : 2;
      var pool = skaters.filter(function (p) { return p.id !== scorer.id; });
      for (var a = 0; a < numAssists && pool.length; a++) {
        var assister = pickScorer(pool, null);
        assists.push(assister.id);
        pool = pool.filter(function (p) { return p.id !== assister.id; });
      }
      events.push({ scorerId: scorer.id, assistIds: assists, side: side });
    }
    return events;
  }

  function buildBoxscore(home, away, homeScore, awayScore, homeOff, awayOff, homeDefEff, awayDefEff) {
    var homeGoals = scoreGoals(homeScore, home, away, "home");
    var awayGoals = scoreGoals(awayScore, away, home, "away");

    // Shots faced by the away goalie are generated by the home team's offense
    // (and vice versa) — scaled against the facing team's defense/goaltending.
    var shotsOnAwayGoalie = shotsFacedEstimate(homeScore, homeOff, awayDefEff);
    var shotsOnHomeGoalie = shotsFacedEstimate(awayScore, awayOff, homeDefEff);

    var skaterLines = {}; // playerId -> {g,a,plusMinus, played}
    function ensure(p) {
      if (!skaterLines[p.id]) skaterLines[p.id] = { g: 0, a: 0, plusMinus: 0, played: true };
    }
    home.forwards.concat(home.defenders).forEach(ensure);
    away.forwards.concat(away.defenders).forEach(ensure);

    homeGoals.forEach(function (ev) {
      skaterLines[ev.scorerId].g += 1;
      ev.assistIds.forEach(function (id) { skaterLines[id].a += 1; });
      home.forwards.concat(home.defenders).forEach(function (p) { skaterLines[p.id].plusMinus += 1; });
      away.forwards.concat(away.defenders).forEach(function (p) { skaterLines[p.id].plusMinus -= 1; });
    });
    awayGoals.forEach(function (ev) {
      skaterLines[ev.scorerId].g += 1;
      ev.assistIds.forEach(function (id) { skaterLines[id].a += 1; });
      away.forwards.concat(away.defenders).forEach(function (p) { skaterLines[p.id].plusMinus += 1; });
      home.forwards.concat(home.defenders).forEach(function (p) { skaterLines[p.id].plusMinus -= 1; });
    });

    var goalieLines = {};
    if (home.goalie) {
      goalieLines[home.goalie.id] = {
        shotsAgainst: shotsOnHomeGoalie,
        saves: Math.max(0, shotsOnHomeGoalie - awayScore),
        goalsAgainst: awayScore,
        played: true,
      };
    }
    if (away.goalie) {
      goalieLines[away.goalie.id] = {
        shotsAgainst: shotsOnAwayGoalie,
        saves: Math.max(0, shotsOnAwayGoalie - homeScore),
        goalsAgainst: homeScore,
        played: true,
      };
    }

    return { skaterLines: skaterLines, goalieLines: goalieLines };
  }

  // Persist a simulated result onto a schedule game + team records + player stats.
  function applyResult(game, result) {
    var settings = S.getSettings();
    game.played = true;
    game.homeScore = result.homeScore;
    game.awayScore = result.awayScore;
    game.wentToOT = result.wentToOT;
    game.boxscore = result.boxscore;

    var home = S.getTeam(game.homeTeamId);
    var away = S.getTeam(game.awayTeamId);
    if (home) {
      home.gf += result.homeScore;
      home.ga += result.awayScore;
    }
    if (away) {
      away.gf += result.awayScore;
      away.ga += result.homeScore;
    }

    if (result.homeScore > result.awayScore) {
      if (home) { home.wins++; home.points += settings.pointsForWin; }
      if (away) { if (result.wentToOT) { away.otLosses++; away.points += settings.pointsForOtLoss; } else { away.losses++; } }
    } else {
      if (away) { away.wins++; away.points += settings.pointsForWin; }
      if (home) { if (result.wentToOT) { home.otLosses++; home.points += settings.pointsForOtLoss; } else { home.losses++; } }
    }

    Object.keys(result.boxscore.skaterLines).forEach(function (pid) {
      var line = result.boxscore.skaterLines[pid];
      var p = S.getPlayer(pid);
      if (!p) return;
      p.stats.gp += 1;
      p.stats.g += line.g;
      p.stats.a += line.a;
      p.stats.pts = p.stats.g + p.stats.a;
      p.stats.plusMinus += line.plusMinus;
    });
    Object.keys(result.boxscore.goalieLines).forEach(function (pid) {
      var line = result.boxscore.goalieLines[pid];
      var p = S.getPlayer(pid);
      if (!p) return;
      p.stats.gp += 1;
      p.stats.shotsAgainst += line.shotsAgainst;
      p.stats.saves += line.saves;
      p.stats.goalsAgainst += line.goalsAgainst;
      p.stats.svPct = p.stats.shotsAgainst > 0 ? U.round3(p.stats.saves / p.stats.shotsAgainst) : 0;
      p.stats.gaa = p.stats.gp > 0 ? U.round1(p.stats.goalsAgainst / p.stats.gp) : 0;
    });

    S.save();
  }

  function simulateAndApply(game) {
    var result = simulateGame(game.homeTeamId, game.awayTeamId);
    applyResult(game, result);
    return result;
  }

  // ---- Playoff stat tracking (js/playoffs.js) ----------------------------
  // Playoff games don't touch team wins/losses (the bracket/series objects
  // already track who's winning) but DO need their own, separate player
  // stat line (p.playoffStats) so playoff box scores and leaderboards work
  // without polluting a player's regular-season totals.
  function applyStatsToField(boxscore, field) {
    Object.keys(boxscore.skaterLines).forEach(function (pid) {
      var line = boxscore.skaterLines[pid];
      var p = S.getPlayer(pid);
      if (!p) return;
      if (!p[field]) p[field] = S.freshStatLine();
      var st = p[field];
      st.gp += 1;
      st.g += line.g;
      st.a += line.a;
      st.pts = st.g + st.a;
      st.plusMinus += line.plusMinus;
    });
    Object.keys(boxscore.goalieLines).forEach(function (pid) {
      var line = boxscore.goalieLines[pid];
      var p = S.getPlayer(pid);
      if (!p) return;
      if (!p[field]) p[field] = S.freshStatLine();
      var st = p[field];
      st.gp += 1;
      st.shotsAgainst += line.shotsAgainst;
      st.saves += line.saves;
      st.goalsAgainst += line.goalsAgainst;
      st.svPct = st.shotsAgainst > 0 ? U.round3(st.saves / st.shotsAgainst) : 0;
      st.gaa = st.gp > 0 ? U.round1(st.goalsAgainst / st.gp) : 0;
    });
  }

  function applyPlayoffGame(result) {
    applyStatsToField(result.boxscore, "playoffStats");
    S.save();
  }

  window.PHLSim = {
    getActiveLineup: getActiveLineup,
    offenseRating: offenseRating,
    defenseRating: defenseRating,
    goalieRating: goalieRating,
    simulateGame: simulateGame,
    applyResult: applyResult,
    simulateAndApply: simulateAndApply,
    applyPlayoffGame: applyPlayoffGame,
  };
})();
