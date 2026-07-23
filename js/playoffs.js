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

  // Once every division has crowned a champion, the season is fully done —
  // flip the season phase to "complete" so offseason-only tools (Entry
  // Draft, Promotions, Start New Season) know it's safe to act. This
  // doesn't fire mid-way through — a division still has an active bracket
  // won't count as complete, so partial playoff progress never triggers it.
  function checkAllDivisionsComplete() {
    var divisions = S.getDivisions();
    var season = S.getSeason();
    var allDone = divisions.every(function (d) {
      var bracket = season.playoffs && season.playoffs[d.id];
      return bracket && bracket.champion;
    });
    if (allDone && season.phase !== "complete") {
      S.updateSeason({ phase: "complete" });
    }
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
      checkAllDivisionsComplete();
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
        html += "<p>The regular season isn't finished for this division yet. Finish it in the Schedule tab, then come back to start the playoffs.</p>";
      } else {
        var formatNote = cfg.byes < cfg.teams
          ? "Top " + cfg.byes + " get a bye; seeds " + (cfg.byes + 1) + "–" + cfg.teams + " play a Wild Card round for the last spot(s)."
          : "Top " + cfg.teams + " make it, straight into the bracket.";
        html += '<p>Regular season complete — ready to set the bracket. <span class="muted">' + formatNote + '</span></p>' +
          '<button class="btn btn-primary" data-action="start-playoffs" data-division="' + div + '">Start Playoffs</button>';
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
      html += '<div class="action-row"><button class="btn btn-primary" data-action="sim-bracket" data-division="' + div + '">Simulate Full Bracket</button></div>';
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
        if (!series.winnerId) {
          html += '<button class="btn btn-sm" data-action="sim-series-game" data-series="' + series.id + '" data-division="' + div + '">Sim Game</button>';
          html += '<button class="btn btn-sm" data-action="sim-series" data-series="' + series.id + '" data-division="' + div + '">Sim Series</button>';
        } else {
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

  function findSeries(divisionId, seriesId) {
    var bracket = S.getSeason().playoffs[divisionId];
    var found = null;
    bracket.rounds.forEach(function (round) {
      round.series.forEach(function (s) {
        if (s.id === seriesId) found = s;
      });
    });
    return found;
  }

  function wireEvents() {
    container.querySelectorAll("[data-division]").forEach(function (b) {
      if (b.dataset.action) return;
      b.addEventListener("click", function () {
        view.division = b.dataset.division;
        render();
      });
    });
    var start = container.querySelector('[data-action="start-playoffs"]');
    if (start) start.addEventListener("click", function () {
      startPlayoffs(start.dataset.division);
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var simBracket = container.querySelector('[data-action="sim-bracket"]');
    if (simBracket) simBracket.addEventListener("click", function () {
      simulateFullBracket(simBracket.dataset.division);
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    container.querySelectorAll('[data-action="sim-series-game"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var series = findSeries(b.dataset.division, b.dataset.series);
        simulateSeriesGame(series);
        advanceBracket(b.dataset.division);
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
    container.querySelectorAll('[data-action="sim-series"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var series = findSeries(b.dataset.division, b.dataset.series);
        simulateSeries(series);
        advanceBracket(b.dataset.division);
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
  }

  window.PHLPlayoffs = {
    render: render,
    startPlayoffs: startPlayoffs,
    simulateFullBracket: simulateFullBracket,
    getPlayoffConfig: getPlayoffConfig,
  };
})();
