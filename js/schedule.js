/* PHL Franchise Simulator — schedule generation, results log & controls
 * Global namespace: window.PHLSchedule
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var Sim = window.PHLSim;
  var container = null;
  var view = { division: null };

  // The regular season now spans 14 calendar weeks, but games are only
  // played on 12 of them — weeks 10-11 are the mid-season trade-deadline
  // break (see js/calendar.js runRegularWeek and js/state.js
  // isTransactionWindowOpen). Games are labeled with their real calendar
  // week number so the schedule reads naturally around the gap.
  var PLAYING_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14];
  var BREAK_WEEKS = [10, 11];

  // Circle-method round robin. Returns an array of rounds; each round is an
  // array of [teamIdA, teamIdB] pairs. Handles odd team counts with a bye.
  function roundRobinRounds(teamIds) {
    var ids = teamIds.slice();
    if (ids.length % 2 !== 0) ids.push(null);
    var n = ids.length;
    var rounds = [];
    var arr = ids.slice();
    for (var r = 0; r < n - 1; r++) {
      var pairs = [];
      for (var i = 0; i < n / 2; i++) {
        var a = arr[i], b = arr[n - 1 - i];
        if (a != null && b != null) pairs.push([a, b]);
      }
      rounds.push(pairs);
      var fixed = arr[0];
      var rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed].concat(rest);
    }
    return rounds;
  }

  // Builds exactly `playingWeeks.length * gamesPerWeek` round-robin "rounds"
  // for a division (repeating/cycling the round-robin as many times as
  // needed, alternating home/away each full cycle for fairness), then
  // chunks them into weeks so every team plays exactly gamesPerWeek games
  // per week — e.g. Pro (2 games/wk x 12wk = 24 games), Contender/Prospect
  // (3/wk x 12wk = 36 games). Each chunk is labeled with the real calendar
  // week number from `playingWeeks` (skipping the week 10-11 trade-deadline
  // break — see PLAYING_WEEKS above) rather than a plain sequential index.
  // An odd team count still gets a bye each round (see roundRobinRounds),
  // so a team can occasionally fall short of the exact total — a known,
  // documented limitation, not a bug.
  function buildDivisionSchedule(div, playingWeeks) {
    var teams = S.getTeams(div.id);
    if (teams.length < 2) return [];
    var ids = teams.map(function (t) { return t.id; });
    var rounds = roundRobinRounds(ids);
    var gamesPerWeek = div.gamesPerWeek || 2;
    var weeksCount = playingWeeks.length;
    var totalRoundsNeeded = weeksCount * gamesPerWeek;

    var flatRounds = [];
    var cycle = 0;
    while (flatRounds.length < totalRoundsNeeded) {
      rounds.forEach(function (pairs) {
        flatRounds.push({ pairs: pairs, cycle: cycle });
      });
      cycle++;
    }
    flatRounds = flatRounds.slice(0, totalRoundsNeeded);

    var games = [];
    for (var w = 0; w < weeksCount; w++) {
      var weekRounds = flatRounds.slice(w * gamesPerWeek, (w + 1) * gamesPerWeek);
      weekRounds.forEach(function (rd) {
        rd.pairs.forEach(function (pair) {
          var home = rd.cycle % 2 === 0 ? pair[0] : pair[1];
          var away = rd.cycle % 2 === 0 ? pair[1] : pair[0];
          games.push({
            id: U.uid("game"),
            divisionId: div.id,
            week: playingWeeks[w],
            homeTeamId: home,
            awayTeamId: away,
            played: false,
            homeScore: null,
            awayScore: null,
            wentToOT: false,
            boxscore: null,
          });
        });
      });
    }
    return games;
  }

  function generateSeasonSchedule() {
    // Snapshot each team's just-finished regular season W-L-OTL record for
    // next season's performance-scaled salary cap (js/state.js
    // capForTeam) before resetTeamRecords() wipes it for the new season.
    S.snapshotTeamRecordsForCap();

    var schedule = [];
    S.getDivisions().forEach(function (div) {
      schedule = schedule.concat(buildDivisionSchedule(div, PLAYING_WEEKS));
    });

    S.resetTeamRecords();
    S.resetPlayerSeasonStats();
    S.setSchedule(schedule);
    S.updateSeason({ phase: "regular", calendarWeek: 1, currentWeekIndex: 0, playoffs: {} });
  }

  // Simulates every unplayed game across every division for one specific
  // calendar week (all divisions share the same 1..12 week numbering).
  // This is what the header's Advance Week button calls during the
  // regular season — see js/calendar.js.
  function simulateCalendarWeek(weekNumber) {
    var games = S.getSchedule().filter(function (g) { return g.week === weekNumber && !g.played; });
    games.forEach(function (g) { Sim.simulateAndApply(g); });
    S.save();
    return games.length;
  }

  function divisionWeeks(divisionId) {
    var games = S.getSchedule(divisionId);
    var weeks = {};
    games.forEach(function (g) {
      weeks[g.week] = weeks[g.week] || [];
      weeks[g.week].push(g);
    });
    return weeks;
  }

  function nextUnplayedWeek(divisionId) {
    var weeks = divisionWeeks(divisionId);
    var weekNums = Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < weekNums.length; i++) {
      var g = weeks[weekNums[i]];
      if (g.some(function (game) { return !game.played; })) return weekNums[i];
    }
    return null;
  }

  function simulateWeek(divisionId) {
    var wk = nextUnplayedWeek(divisionId);
    if (wk == null) return 0;
    var games = divisionWeeks(divisionId)[wk].filter(function (g) { return !g.played; });
    games.forEach(function (g) { Sim.simulateAndApply(g); });
    S.save();
    return games.length;
  }

  function simulateRestOfSeason(divisionId) {
    var count = 0;
    var games = S.getSchedule(divisionId).filter(function (g) { return !g.played; });
    games.forEach(function (g) { Sim.simulateAndApply(g); count++; });
    S.save();
    return count;
  }

  function simulateAllDivisionsRestOfSeason() {
    var games = S.getSchedule().filter(function (g) { return !g.played; });
    games.forEach(function (g) { Sim.simulateAndApply(g); });
    S.save();
    return games.length;
  }

  function isRegularSeasonComplete(divisionId) {
    var games = S.getSchedule(divisionId);
    return games.length > 0 && games.every(function (g) { return g.played; });
  }

  // ---------------- Box score ----------------
  function playerLabel(id) {
    var p = S.getPlayer(id);
    return p ? U.escapeHtml(p.name) + ' <span class="muted small">(' + p.position + ")</span>" : "?";
  }

  function renderBoxscore(g) {
    if (!g.played || !g.boxscore) return '<p class="muted small">No box score for this game.</p>';
    var home = S.getTeam(g.homeTeamId);
    var away = S.getTeam(g.awayTeamId);
    var bs = g.boxscore;

    function teamSkaterRows(teamId) {
      var roster = S.getRoster(teamId);
      var rows = "";
      Object.keys(bs.skaterLines).forEach(function (pid) {
        var p = S.getPlayer(pid);
        if (!p || p.teamId !== teamId) return;
        // A released/traded player still shows correctly via boxscore data
        // even if no longer on this roster — fall back to their current
        // team check only as a best-effort grouping; the line itself is
        // always historically accurate regardless.
        var line = bs.skaterLines[pid];
        if (!line.played) return;
        rows += "<tr><td>" + playerLabel(pid) + "</td><td>" + line.g + "</td><td>" + line.a + "</td><td>" + (line.g + line.a) + "</td><td>" + (line.plusMinus > 0 ? "+" + line.plusMinus : line.plusMinus) + "</td></tr>";
      });
      return rows;
    }
    function teamGoalieRows(teamId) {
      var rows = "";
      Object.keys(bs.goalieLines).forEach(function (pid) {
        var p = S.getPlayer(pid);
        if (!p || p.teamId !== teamId) return;
        var line = bs.goalieLines[pid];
        var svPct = line.shotsAgainst > 0 ? U.round3(line.saves / line.shotsAgainst) : 0;
        rows += "<tr><td>" + playerLabel(pid) + "</td><td>" + line.saves + "</td><td>" + line.shotsAgainst + "</td><td>" + line.goalsAgainst + "</td><td>" + (svPct * 100).toFixed(1) + "%</td></tr>";
      });
      return rows;
    }

    var html = '<div class="boxscore">';
    html += '<div class="boxscore-scoreline">' +
      '<span class="boxscore-scoreline-team">' + U.crestHtml(away, "crest-md") + U.escapeHtml(away ? away.name : "?") + '</span>' +
      '<span class="boxscore-scoreline-score">' + g.awayScore + " - " + g.homeScore + (g.wentToOT ? ' <span class="pill pill-warn small">OT</span>' : "") + '</span>' +
      '<span class="boxscore-scoreline-team">' + U.escapeHtml(home ? home.name : "?") + U.crestHtml(home, "crest-md") + '</span>' +
      "</div>";
    [{ team: away, id: g.awayTeamId }, { team: home, id: g.homeTeamId }].forEach(function (side) {
      html += '<div class="boxscore-team"><h5>' + U.crestHtml(side.team, "crest-sm") + U.escapeHtml(side.team ? side.team.name : "?") + "</h5>";
      html += '<table class="data-table compact"><thead><tr><th>Skater</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th></tr></thead><tbody>' +
        (teamSkaterRows(side.id) || '<tr><td colspan="5" class="muted small">No skaters recorded.</td></tr>') + "</tbody></table>";
      var goalieRows = teamGoalieRows(side.id);
      if (goalieRows) {
        html += '<table class="data-table compact"><thead><tr><th>Goalie</th><th>SV</th><th>SA</th><th>GA</th><th>SV%</th></tr></thead><tbody>' + goalieRows + "</tbody></table>";
      }
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  // ---------------- Rendering ----------------
  function render(el) {
    container = el || container;
    if (!container) return;
    var divisions = S.getDivisions().slice().sort(function (a, b) { return b.tier - a.tier; });
    if (!view.division) view.division = divisions.length ? divisions[0].id : null;

    var season = S.getSeason();
    var html = '<div class="panel-header"><h2>Schedule &amp; Results</h2></div>';
    html += '<p class="muted small">Games now play out automatically week by week — use the <strong>Advance Week</strong> button up top. This tab is for browsing the schedule and box scores.</p>';
    html += '<div class="tab-strip">';
    divisions.forEach(function (d) {
      html += '<button class="chip' + (view.division === d.id ? " chip-active" : "") + '" data-division="' + d.id + '">' + U.escapeHtml(d.name) + "</button>";
    });
    html += "</div>";

    var div = view.division;
    var games = S.getSchedule(div);
    if (!games.length) {
      html += '<div class="empty-state"><p>No schedule generated yet for this division. It\'ll be built automatically the first time Advance Week rolls out of the off-season.</p>' +
        '<button class="btn" data-action="gen-schedule">Generate Now</button></div>';
      container.innerHTML = html;
      wireEvents();
      return;
    }

    var played = games.filter(function (g) { return g.played; }).length;
    html += '<div class="action-row">';
    html += '<span class="muted">' + played + ' / ' + games.length + ' games played &middot; Week ' +
      (season.phase === "regular" ? season.calendarWeek : "—") + " of " + (S.getSettings().regularSeasonWeeks || 12) + "</span>";
    html += '<button class="btn btn-danger" data-action="regen-schedule">Regenerate Schedule</button>';
    html += "</div>";

    var weeks = divisionWeeks(div);
    var weekNums = Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; }); // Week 1 first, latest week at the bottom

    html += '<div class="schedule-layout">';
    html += renderPreviousWeekPanel(div, weeks, weekNums);
    html += '<div class="schedule-list">';
    weekNums.forEach(function (wn) {
      html += '<div class="week-block"><h4>Week ' + wn + (BREAK_WEEKS.indexOf(wn) !== -1 ? ' <span class="muted small">(Trade Deadline Break)</span>' : "") + "</h4>";
      weeks[wn].forEach(function (g) {
        var home = S.getTeam(g.homeTeamId);
        var away = S.getTeam(g.awayTeamId);
        html += '<div class="game-row' + (g.played ? "" : " game-upcoming") + '"' + (g.played ? ' data-action="show-box" data-id="' + g.id + '" role="button" tabindex="0"' : "") + '>';
        html += '<span class="game-team">' + U.crestHtml(away, "crest-sm") + U.escapeHtml(away ? away.abbr : "?") + "</span>";
        html += '<span class="game-score">' + (g.played ? g.awayScore + " - " + g.homeScore + (g.wentToOT ? " OT" : "") : "@") + "</span>";
        html += '<span class="game-team">' + U.crestHtml(home, "crest-sm") + U.escapeHtml(home ? home.abbr : "?") + "</span>";
        if (g.played) html += '<span class="muted small boxscore-toggle">Box score</span>';
        html += "</div>";
      });
      html += "</div>";
    });
    html += "</div>"; // .schedule-list
    html += "</div>"; // .schedule-layout

    container.innerHTML = html;
    wireEvents();
  }

  // "Previous Week" panel — a quick, at-a-glance look at how the last
  // *completed* week went for this division (the user's team highlighted),
  // sitting next to the full schedule so there's no need to scroll to find
  // it. Skips weeks with no games at all (e.g. before any week has been
  // played, or the trade-deadline break weeks, which never get games).
  function renderPreviousWeekPanel(divisionId, weeks, weekNums) {
    var completedWeeks = weekNums.filter(function (wn) {
      return weeks[wn].length && weeks[wn].every(function (g) { return g.played; });
    });
    var lastWeek = completedWeeks.length ? completedWeeks[completedWeeks.length - 1] : null;
    var myTeamId = S.getFranchise().teamId;

    var html = '<div class="previous-week-panel">';
    if (lastWeek == null) {
      html += "<h3>Previous Week</h3><p class=\"muted small\">No completed weeks yet for this division.</p>";
      html += "</div>";
      return html;
    }
    html += "<h3>Previous Week — Week " + lastWeek + "</h3>";
    weeks[lastWeek].forEach(function (g) {
      var home = S.getTeam(g.homeTeamId);
      var away = S.getTeam(g.awayTeamId);
      var involvesMe = g.homeTeamId === myTeamId || g.awayTeamId === myTeamId;
      html += '<div class="game-row' + (involvesMe ? " game-row-mine" : "") + '" data-action="show-box" data-id="' + g.id + '" role="button" tabindex="0">';
      html += '<span class="game-team">' + U.crestHtml(away, "crest-sm") + U.escapeHtml(away ? away.abbr : "?") + "</span>";
      html += '<span class="game-score">' + g.awayScore + " - " + g.homeScore + (g.wentToOT ? " OT" : "") + "</span>";
      html += '<span class="game-team">' + U.crestHtml(home, "crest-sm") + U.escapeHtml(home ? home.abbr : "?") + "</span>";
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function wireEvents() {
    container.querySelectorAll("[data-division]").forEach(function (b) {
      b.addEventListener("click", function () {
        view.division = b.dataset.division;
        render();
      });
    });
    var gen = container.querySelector('[data-action="gen-schedule"]');
    if (gen) gen.addEventListener("click", function () {
      generateSeasonSchedule();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var regen = container.querySelector('[data-action="regen-schedule"]');
    if (regen) regen.addEventListener("click", function () {
      if (confirm("Regenerate the season schedule? This resets all games, team records and player season stats.")) {
        generateSeasonSchedule();
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      }
    });
    container.querySelectorAll('[data-action="show-box"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var g = S.getSchedule().find(function (game) { return game.id === b.dataset.id; });
        if (g && window.PHLBoxscoreModal) window.PHLBoxscoreModal.showGames([g]);
      });
    });
  }

  window.PHLSchedule = {
    render: render,
    generateSeasonSchedule: generateSeasonSchedule,
    simulateWeek: simulateWeek,
    simulateCalendarWeek: simulateCalendarWeek,
    simulateRestOfSeason: simulateRestOfSeason,
    simulateAllDivisionsRestOfSeason: simulateAllDivisionsRestOfSeason,
    isRegularSeasonComplete: isRegularSeasonComplete,
    nextUnplayedWeek: nextUnplayedWeek,
    renderBoxscore: renderBoxscore,
  };
})();
