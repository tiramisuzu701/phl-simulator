/* PHL Franchise Simulator — playoffs (best-of-7 series)
 * Global namespace: window.PHLPlayoffs
 *
 * Each division declares its own format via division.playoff = { teams, byes }:
 *   - `teams`: how many teams (by standings) are playoff-eligible at all.
 *   - `byes`:  how many of those skip straight into the main bracket.
 * When teams > byes, the remaining seeds play a Wild Card round; winners
 * fill out the last spot(s) of the main bracket alongside the bye teams.
 * A team finishing below `teams` in the standings — including an added
 * expansion team — simply misses the playoffs; no extra round is added.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var Sim = window.PHLSim;
  var Sched = window.PHLSchedule;
  var Standings = window.PHLStandings;
  var container = null;
  var view = { division: null };

  function getPlayoffConfig(divisionId) {
    var div = S.getDivision(divisionId);
    var fallback = S.getSettings().playoffTeamsPerDivision || 4;
    if (div && div.playoff && div.playoff.teams) return div.playoff;
    return { teams: fallback, byes: fallback };
  }

  // Analytically computes how many rounds (incl. a Wild Card round, if any)
  // a division's bracket takes to crown a champion, purely from its
  // {teams, byes} config — no simulation needed. The weekly calendar
  // engine uses this to know how many playoff weeks a division needs
  // (Pro: 2, Contender: 3, Prospect: 4 including Wild Card, with the
  // current default configs) and when it's safe to close out the whole
  // playoffs phase.
  function totalRoundsForDivision(divisionId) {
    var cfg = getPlayoffConfig(divisionId);
    var teams = cfg.teams;
    var byes = Math.min(cfg.byes, teams);
    var wildcardSeeds = teams - byes;
    var rounds = 0;
    var advancing;
    if (wildcardSeeds >= 2) {
      rounds += 1;
      advancing = byes + Math.floor(wildcardSeeds / 2) + (wildcardSeeds % 2 === 1 ? 1 : 0);
    } else {
      advancing = teams;
    }
    while (advancing > 1) {
      advancing = Math.floor(advancing / 2);
      rounds += 1;
    }
    return Math.max(1, rounds);
  }

  function roundNameForTeamCount(n) {
    if (n <= 2) return "Final";
    if (n === 4) return "Semifinals";
    if (n === 8) return "Quarterfinals";
    if (n === 16) return "Round of 16";
    return "Round of " + n;
  }

  function newSeries(teamAId, teamBId, seedA, seedB) {
    return {
      id: U.uid("series"),
      teamAId: teamAId,
      teamBId: teamBId,
      seedA: seedA,
      seedB: seedB,
      winsA: 0,
      winsB: 0,
      games: [],
      winnerId: null,
    };
  }

  // Pairs a seed-ordered list [best...worst] as 1v N, 2v(N-1), ... — the
  // standard single-elimination reseeding pattern. Assumes an even count;
  // an odd leftover (only possible with a hand-edited config) is dropped
  // rather than crashing.
  function buildBracketRound(seedsArr) {
    var series = [];
    var n = seedsArr.length;
    var half = Math.floor(n / 2);
    for (var i = 0; i < half; i++) {
      var hi = seedsArr[i];
      var lo = seedsArr[n - 1 - i];
      series.push(newSeries(hi.teamId, lo.teamId, hi.seed, lo.seed));
    }
    return { name: roundNameForTeamCount(half * 2), series: series };
  }

  // Wild Card round: same outer-vs-inner pairing, but tracks an unpaired
  // middle seed (odd count) so it can be carried forward as an automatic
  // advance rather than lost.
  function buildWildcardRound(wildcardSeeds) {
    var series = [];
    var n = wildcardSeeds.length;
    var half = Math.floor(n / 2);
    for (var i = 0; i < half; i++) {
      var hi = wildcardSeeds[i];
      var lo = wildcardSeeds[n - 1 - i];
      series.push(newSeries(hi.teamId, lo.teamId, hi.seed, lo.seed));
    }
    var pendingByeTeamId = n % 2 === 1 ? wildcardSeeds[half].teamId : null;
    return {
      round: { name: "Wild Card", series: series, isWildcard: true },
      pendingByeTeamId: pendingByeTeamId,
    };
  }

  function startPlayoffs(divisionId) {
    var cfg = getPlayoffConfig(divisionId);
    var standings = Standings.sortedStandings(divisionId).slice(0, cfg.teams);
    if (standings.length < 2) {
      alert("Not enough teams with a completed record in this division yet.");
      return;
    }
    var seedsList = standings.map(function (t, i) {
      return { teamId: t.id, seed: i + 1 };
    });
    var byesCount = Math.min(cfg.byes, seedsList.length);
    var byeSeeds = seedsList.slice(0, byesCount);
    var wildcardSeeds = seedsList.slice(byesCount);

    var bracket = {
      seeds: seedsList,
      byeTeamIds: byeSeeds.map(function (s) { return s.teamId; }),
      pendingWildcardByeTeamId: null,
      rounds: [],
      champion: null,
    };

    if (wildcardSeeds.length >= 2) {
      var wc = buildWildcardRound(wildcardSeeds);
      bracket.rounds.push(wc.round);
      bracket.pendingWildcardByeTeamId = wc.pendingByeTeamId;
    } else {
      bracket.rounds.push(buildBracketRound(seedsList));
    }

    var playoffs = S.getSeason().playoffs || {};
    playoffs[divisionId] = bracket;
    S.updateSeason({ phase: "playoffs", playoffs: playoffs });
  }

  function seriesIsDecided(series) {
    return series.winsA >= 4 || series.winsB >= 4;
  }

  // Best-of-7 home/away pattern: 2-2-1-1-1, higher seed (teamA) hosting
  // games 1, 2, 5, and 7.
  var SERIES_HOME_IS_A = [true, true, false, false, true, false, true];

  function simulateSeriesGame(series) {
    if (seriesIsDecided(series)) return null;
    var gameNum = series.games.length + 1;
    var homeIsASlot = SERIES_HOME_IS_A[gameNum - 1];
    var homeId = homeIsASlot ? series.teamAId : series.teamBId;
    var awayId = homeIsASlot ? series.teamBId : series.teamAId;
    var result = Sim.simulateGame(homeId, awayId);
    var homeIsA = homeId === series.teamAId;
    var aScore = homeIsA ? result.homeScore : result.awayScore;
    var bScore = homeIsA ? result.awayScore : result.homeScore;
    var winner = aScore > bScore ? "A" : "B";
    if (winner === "A") series.winsA++; else series.winsB++;
    series.games.push({
      gameNum: gameNum,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      wentToOT: result.wentToOT,
    });
    if (seriesIsDecided(series)) {
      series.winnerId = winner === "A" ? series.teamAId : series.teamBId;
    }
    S.save();
    return series;
  }

  function simulateSeries(series) {
    while (!seriesIsDecided(series)) simulateSeriesGame(series);
  }

  // True once every division currently in the playoffs.playoffs map has
  // crowned a champion. The weekly calendar engine (js/calendar.js) uses
  // this to know it can end the playoffs phase early rather than always
  // burning all 4 weeks, and to know it's safe to enforce the per-division
  // idle-once-you're-done behavior (a division with a shorter bracket,
  // e.g. Pro's 2 rounds, just sits done while others keep playing).
  function allDivisionsHaveChampions() {
    var divisions = S.getDivisions();
    var season = S.getSeason();
    return divisions.every(function (d) {
      var bracket = season.playoffs && season.playoffs[d.id];
      return bracket && bracket.champion;
    });
  }

  function advanceBracket(divisionId) {
    var bracket = S.getSeason().playoffs[divisionId];
    if (!bracket) return;
    var lastRound = bracket.rounds[bracket.rounds.length - 1];
    var allDecided = lastRound.series.every(seriesIsDecided);
    if (!allDecided) return;

    var seedOf = {};
    bracket.seeds.forEach(function (s) { seedOf[s.teamId] = s.seed; });

    if (lastRound.isWildcard) {
      // Wild Card winners fill the remaining bracket slot(s) right after
      // the bye teams, in the order their games were listed.
      var wcWinners = lastRound.series.map(function (s) { return s.winnerId; });
      var combinedIds = bracket.byeTeamIds.concat(wcWinners);
      if (bracket.pendingWildcardByeTeamId) combinedIds.push(bracket.pendingWildcardByeTeamId);
      var combinedSeeded = combinedIds.map(function (id, idx) {
        return { teamId: id, seed: seedOf[id] != null ? seedOf[id] : idx + 1 };
      });
      bracket.rounds.push(buildBracketRound(combinedSeeded));
      S.save();
      return;
    }

    if (lastRound.series.length === 1) {
      bracket.champion = lastRound.series[0].winnerId;
      S.save();
      return;
    }

    // Standard reseed: winners mirrored in bracket order (1/8-4/5 side,
    // 2/7-3/6 side, etc.) so bracket integrity holds round over round.
    var winners = lastRound.series.map(function (s) { return s.winnerId; });
    var nextSeries = [];
    for (var i = 0; i < winners.length / 2; i++) {
      var a = winners[i];
      var b = winners[winners.length - 1 - i];
      nextSeries.push(newSeries(a, b, seedOf[a], seedOf[b]));
    }
    bracket.rounds.push({ name: roundNameForTeamCount(nextSeries.length * 2), series: nextSeries });
    S.save();
  }

  function simulateFullBracket(divisionId) {
    var bracket = S.getSeason().playoffs[divisionId];
    if (!bracket) return;
    var guard = 0;
    while (!bracket.champion && guard < 10) {
      var lastRound = bracket.rounds[bracket.rounds.length - 1];
      lastRound.series.forEach(simulateSeries);
      advanceBracket(divisionId);
      guard++;
    }
  }

  // Resolves exactly the CURRENT round (all its series, end to end) and
  // advances the bracket to the next round — one call = one playoff week.
  // This is what the header's Advance Week button calls for each division
  // still active during the playoffs phase (js/calendar.js); a division
  // whose bracket already crowned a champion is simply skipped, so a
  // shorter bracket (e.g. Pro's 2 rounds) sits idle once it's done while
  // a longer one (e.g. Prospect's wild-card + 3 rounds) keeps playing.
  function simulateOneRound(divisionId) {
    var bracket = S.getSeason().playoffs[divisionId];
    if (!bracket || bracket.champion) return false;
    var lastRound = bracket.rounds[bracket.rounds.length - 1];
    lastRound.series.forEach(simulateSeries);
    advanceBracket(divisionId);
    return true;
  }

  // ---------------- Rendering ----------------
  function render(el) {
    container = el || container;
    if (!container) return;
    var divisions = S.getDivisions().slice().sort(function (a, b) { return b.tier - a.tier; });
    if (!view.division) view.division = divisions.length ? divisions[0].id : null;

    var html = '<div class="panel-header"><h2>Playoffs</h2></div>';
    html += '<div class="tab-strip">';
    divisions.forEach(function (d) {
      var cfg = getPlayoffConfig(d.id);
      html += '<button class="chip' + (view.division === d.id ? " chip-active" : "") + '" data-division="' + d.id + '">' +
        U.escapeHtml(d.name) + ' <span class="muted">(top ' + cfg.teams + ")</span></button>";
    });
    html += "</div>";

    var div = view.division;
    var cfg = getPlayoffConfig(div);
    var bracket = (S.getSeason().playoffs || {})[div];
    var regularDone = Sched.isRegularSeasonComplete(div);

    if (!bracket) {
      html += '<div class="empty-state">';
      if (!regularDone) {
        html += "<p>The regular season isn't finished for this division yet — keep hitting Advance Week up top.</p>";
      } else {
        var formatNote = cfg.byes < cfg.teams
          ? "Top " + cfg.byes + " get a bye; seeds " + (cfg.byes + 1) + "–" + cfg.teams + " play a Wild Card round for the last spot(s)."
          : "Top " + cfg.teams + " make it, straight into the bracket.";
        html += '<p>Regular season complete — the bracket is set the next time you hit Advance Week. <span class="muted">' + formatNote + '</span></p>';
      }
      html += "</div>";
      container.innerHTML = html;
      wireEvents();
      return;
    }

    if (bracket.champion) {
      var champ = S.getTeam(bracket.champion);
      html += '<div class="champion-banner">&#127942; <strong>' + U.escapeHtml(champ ? champ.name : "?") + "</strong> is the " + U.escapeHtml(S.getDivision(div).name) + " Division Champion!</div>";
    } else {
      html += '<p class="muted small">One round resolves per Advance Week — keep hitting the button up top to move the bracket forward.</p>';
    }

    bracket.rounds.forEach(function (round) {
      html += '<div class="playoff-round"><h4>' + U.escapeHtml(round.name) + "</h4>";
      html += '<div class="series-grid">';
      round.series.forEach(function (series) {
        var teamA = S.getTeam(series.teamAId);
        var teamB = S.getTeam(series.teamBId);
        html += '<div class="series-card">';
        html += '<div class="series-row"><span>(' + series.seedA + ") " + U.escapeHtml(teamA ? teamA.name : "?") + '</span><span class="series-wins">' + series.winsA + "</span></div>";
        html += '<div class="series-row"><span>(' + series.seedB + ") " + U.escapeHtml(teamB ? teamB.name : "?") + '</span><span class="series-wins">' + series.winsB + "</span></div>";
        if (series.games.length) {
          html += '<div class="series-games muted small">';
          series.games.forEach(function (g) {
            var h = S.getTeam(g.homeTeamId);
            html += "G" + g.gameNum + ": " + g.awayScore + "-" + g.homeScore + "@" + (h ? h.abbr : "?") + (g.wentToOT ? " OT" : "") + "  ";
          });
          html += "</div>";
        }
        if (series.winnerId) {
          html += '<div class="pill">Winner: ' + U.escapeHtml((S.getTeam(series.winnerId) || {}).name || "?") + "</div>";
        }
        html += "</div>";
      });
      html += "</div></div>";
    });

    if (bracket.byeTeamIds && bracket.byeTeamIds.length && bracket.rounds.length && bracket.rounds[0].isWildcard) {
      html += '<p class="muted small">Byes into the main bracket: ' +
        bracket.byeTeamIds.map(function (id) { var t = S.getTeam(id); return U.escapeHtml(t ? t.name : "?"); }).join(", ") +
        "</p>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    container.querySelectorAll("[data-division]").forEach(function (b) {
      if (b.dataset.action) return;
      b.addEventListener("click", function () {
        view.division = b.dataset.division;
        render();
      });
    });
  }

  window.PHLPlayoffs = {
    render: render,
    startPlayoffs: startPlayoffs,
    simulateFullBracket: simulateFullBracket,
    simulateOneRound: simulateOneRound,
    allDivisionsHaveChampions: allDivisionsHaveChampions,
    totalRoundsForDivision: totalRoundsForDivision,
    getPlayoffConfig: getPlayoffConfig,
  };
})();
