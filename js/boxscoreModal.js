/* PHL Franchise Simulator — small pop-up box score viewer
 * Global namespace: window.PHLBoxscoreModal
 *
 * A lightweight overlay for showing one or more just-simmed box scores
 * (see the Dashboard's "Sim My Game" flow — js/dashboard.js /
 * js/calendar.js simulateMyGamesThisWeek) without navigating away to the
 * Schedule tab. Reuses js/schedule.js's renderBoxscore() so the layout
 * matches the Schedule tab exactly.
 */
(function () {
  "use strict";
  var U = window.PHLUtil;
  var overlayEl = null;

  function close() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  // games: array of played game objects (with .boxscore set). opts.title
  // overrides the default generic "Box Score(s)" heading (e.g. the
  // Dashboard's "Sim My Game" flow passes "Your Game This Week").
  function showGames(games, opts) {
    if (!document.body || !games || !games.length) return;
    close(); // only one instance at a time
    opts = opts || {};

    var S = window.PHLState;
    var Schedule = window.PHLSchedule;
    var title = opts.title || (games.length > 1 ? "Box Scores" : "Box Score");

    var body = "";
    games.forEach(function (g, i) {
      var home = S.getTeam(g.homeTeamId);
      var away = S.getTeam(g.awayTeamId);
      if (i > 0) body += '<hr class="modal-divider">';
      body += '<h4 class="modal-game-heading">' + U.escapeHtml(away ? away.abbr : "?") + " " + g.awayScore +
        " &ndash; " + g.homeScore + " " + U.escapeHtml(home ? home.abbr : "?") + (g.wentToOT ? " (OT)" : "") + "</h4>";
      body += Schedule.renderBoxscore(g);
    });

    overlayEl = document.createElement("div");
    overlayEl.className = "modal-overlay";
    overlayEl.innerHTML =
      '<div class="modal-box modal-box-wide">' +
      '<div class="modal-box-header"><h3>' + U.escapeHtml(title) + '</h3>' +
      '<button type="button" class="modal-close" aria-label="Close">&times;</button></div>' +
      '<div class="modal-box-body">' + body + "</div>" +
      "</div>";

    document.body.appendChild(overlayEl);
    overlayEl.addEventListener("click", function (e) {
      if (e.target === overlayEl) close();
    });
    overlayEl.querySelector(".modal-close").addEventListener("click", close);
    document.addEventListener("keydown", onKeydown);
  }

  window.PHLBoxscoreModal = { showGames: showGames, close: close };
})();
