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

  function generateSeasonSchedule() {
    var settings = S.getSettings();
    var target = settings.targetGamesPerTeam || 18;
    var schedule = [];

    S.getDivisions().forEach(function (div) {
      var teams = S.getTeams(div.id);
      if (teams.length < 2) return;
      var ids = teams.map(function (t) { return t.id; });
      var rounds = roundRobinRounds(ids);
      var cycles = Math.max(1, Math.ceil(target / rounds.length));
      var week = 1;
      for (var c = 0; c < cycles; c++) {
        rounds.forEach(function (pairs) {
          pairs.forEach(function (pair) {
            var home = c % 2 === 0 ? pair[0] : pair[1];
            var away = c % 2 === 0 ? pair[1] : pair[0];
            schedule.push({
              id: U.uid("game"),
              divisionId: div.id,
              week: week,
              homeTeamId: home,
              awayTeamId: away,
              played: false,
              homeScore: null,
              awayScore: null,
              wentToOT: false,
              boxscore: null,
            });
          });
          week++;
        });
      }
    });

    S.resetTeamRecords();
    S.resetPlayerSeasonStats();
    S.setSchedule(schedule);
    S.updateSeason({ phase: "regular", currentWeekIndex: 0, playoffs: {} });
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

  // ---------------- Rendering ----------------
  function render(el) {
    container = el || container;
    if (!container) return;
    var divisions = S.getDivisions().slice().sort(function (a, b) { return b.tier - a.tier; });
    if (!view.division) view.division = divisions.length ? divisions[0].id : null;

    var html = '<div class="panel-header"><h2>Schedule &amp; Results</h2></div>';
    html += '<div class="tab-strip">';
    divisions.forEach(function (d) {
      html += '<button class="chip' + (view.division === d.id ? " chip-active" : "") + '" data-division="' + d.id + '">' + U.escapeHtml(d.name) + "</button>";
    });
    html += "</div>";

    var div = view.division;
    var games = S.getSchedule(div);
    if (!games.length) {
      html += '<div class="empty-state"><p>No schedule generated yet for this division.</p>' +
        '<button class="btn btn-primary" data-action="gen-schedule">Generate Season Schedule (All Divisions)</button></div>';
      container.innerHTML = html;
      wireEvents();
      return;
    }

    var played = games.filter(function (g) { return g.played; }).length;
    html += '<div class="action-row">';
    html += '<span class="muted">' + played + ' / ' + games.length + ' games played</span>';
    html += '<button class="btn" data-action="sim-week" data-division="' + div + '">Simulate Next Week</button>';
    html += '<button class="btn" data-action="sim-rest" data-division="' + div + '">Simulate Rest of Season</button>';
    html += '<button class="btn btn-primary" data-action="sim-all">Simulate All Divisions</button>';
    html += '<button class="btn btn-danger" data-action="regen-schedule">Regenerate Schedule</button>';
    html += "</div>";

    var weeks = divisionWeeks(div);
    var weekNums = Object.keys(weeks).map(Number).sort(function (a, b) { return b - a; }); // newest first
    html += '<div class="schedule-list">';
    weekNums.forEach(function (wn) {
      html += '<div class="week-block"><h4>Week ' + wn + "</h4>";
      weeks[wn].forEach(function (g) {
        var home = S.getTeam(g.homeTeamId);
        var away = S.getTeam(g.awayTeamId);
        html += '<div class="game-row' + (g.played ? "" : " game-upcoming") + '">';
        html += '<span class="game-team">' + U.escapeHtml(away ? away.abbr : "?") + "</span>";
        html += '<span class="game-score">' + (g.played ? g.awayScore + " - " + g.homeScore + (g.wentToOT ? " OT" : "") : "@") + "</span>";
        html += '<span class="game-team">' + U.escapeHtml(home ? home.abbr : "?") + "</span>";
        html += "</div>";
      });
      html += "</div>";
    });
    html += "</div>";

    container.innerHTML = html;
    wireEvents();
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
    var week = container.querySelector('[data-action="sim-week"]');
    if (week) week.addEventListener("click", function () {
      simulateWeek(week.dataset.division);
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var rest = container.querySelector('[data-action="sim-rest"]');
    if (rest) rest.addEventListener("click", function () {
      simulateRestOfSeason(rest.dataset.division);
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    var all = container.querySelector('[data-action="sim-all"]');
    if (all) all.addEventListener("click", function () {
      simulateAllDivisionsRestOfSeason();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  window.PHLSchedule = {
    render: render,
    generateSeasonSchedule: generateSeasonSchedule,
    simulateWeek: simulateWeek,
    simulateRestOfSeason: simulateRestOfSeason,
    simulateAllDivisionsRestOfSeason: simulateAllDivisionsRestOfSeason,
    isRegularSeasonComplete: isRegularSeasonComplete,
    nextUnplayedWeek: nextUnplayedWeek,
  };
})();
