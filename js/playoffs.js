/* PHL Franchise Simulator — playoffs (best-of-3, top 4 per division)
 * Global namespace: window.PHLPlayoffs
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

  function startPlayoffs(divisionId) {
    var n = S.getSettings().playoffTeamsPerDivision || 4;
    var seeds = Standings.sortedStandings(divisionId).slice(0, n);
    if (seeds.length < 2) {
      alert("Not enough teams with a completed record in this division yet.");
      return;
    }
    // Standard bracket: 1v4, 2v3 (works cleanly for n=4; degrades gracefully otherwise)
    var series = [];
    for (var i = 0; i < Math.floor(seeds.length / 2); i++) {
      var high = seeds[i];
      var low = seeds[seeds.length - 1 - i];
      series.push(newSeries(high.id, low.id, i + 1, seeds.length - i));
    }
    var bracket = {
      seeds: seeds.map(function (t, i) { return { teamId: t.id, seed: i + 1 }; }),
      rounds: [{ name: seeds.length > 2 ? "Semifinals" : "Final", series: series }],
      champion: null,
    };
    var playoffs = S.getSeason().playoffs || {};
    playoffs[divisionId] = bracket;
    S.updateSeason({ phase: "playoffs", playoffs: playoffs });
  }

  function seriesIsDecided(series) {
    return series.winsA >= 2 || series.winsB >= 2;
  }

  function simulateSeriesGame(series) {
    if (seriesIsDecided(series)) return null;
    var gameNum = series.games.length + 1;
    // Games 1 & 3 at the higher seed (teamA); game 2 at the lower seed (teamB)
    var homeId = gameNum === 2 ? series.teamBId : series.teamAId;
    var awayId = gameNum === 2 ? series.teamAId : series.teamBId;
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

  function advanceBracket(divisionId) {
    var bracket = S.getSeason().playoffs[divisionId];
    if (!bracket) return;
    var lastRound = bracket.rounds[bracket.rounds.length - 1];
    var allDecided = lastRound.series.every(seriesIsDecided);
    if (!allDecided) return;
    if (lastRound.series.length === 1) {
      bracket.champion = lastRound.series[0].winnerId;
      S.save();
      return;
    }
    // Build next round from winners, pairing in bracket order
    var winners = lastRound.series.map(function (s) { return s.winnerId; });
    var seedOf = {};
    bracket.seeds.forEach(function (s) { seedOf[s.teamId] = s.seed; });
    var nextSeries = [];
    for (var i = 0; i < winners.length / 2; i++) {
      var a = winners[i];
      var b = winners[winners.length - 1 - i];
      nextSeries.push(newSeries(a, b, seedOf[a], seedOf[b]));
    }
    bracket.rounds.push({ name: nextSeries.length === 1 ? "Final" : "Round " + (bracket.rounds.length + 1), series: nextSeries });
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
      html += '<button class="chip' + (view.division === d.id ? " chip-active" : "") + '" data-division="' + d.id + '">' + U.escapeHtml(d.name) + "</button>";
    });
    html += "</div>";

    var div = view.division;
    var bracket = (S.getSeason().playoffs || {})[div];
    var regularDone = Sched.isRegularSeasonComplete(div);

    if (!bracket) {
      html += '<div class="empty-state">';
      if (!regularDone) {
        html += "<p>The regular season isn't finished for this division yet. Finish it in the Schedule tab, then come back to start the playoffs.</p>";
      } else {
        html += '<p>Regular season complete — ready to set the bracket.</p>' +
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
  };
})();
