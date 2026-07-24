/* PHL Franchise Simulator — League Log (league-wide transaction history)
 * Global namespace: window.PHLLeagueLog
 *
 * A single chronological feed of every trade, signing, release, and
 * promotion across the WHOLE league (every team, not just the user's) —
 * the four transaction logs already tracked in js/state.js (getTrades /
 * getSignings / getReleases / getPromotions), merged and sorted by the
 * shared logSeq counter (see state.js nextLogSeq) so events interleave in
 * true chronological order regardless of which list they came from.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var filter = "all"; // "all" | "trade" | "signing" | "release" | "promotion"
  var SHOWN_LIMIT = 250;

  var TYPE_LABEL = { trade: "Trades", signing: "Signings", release: "Releases", promotion: "Promotions" };
  var TYPE_ICON = { trade: "⇄", signing: "+", release: "−", promotion: "↑" };
  var RELEASE_REASON_LABEL = {
    manual: "Released",
    "cap-compliance": "Released — cap compliance",
    "overall-cutoff": "Released — exceeded division overall cutoff",
  };
  var SIGNING_MODE_LABEL = { sign: "Free-agent signing", resign: "Re-signed" };

  function teamBadge(teamId) {
    var t = S.getTeam(teamId);
    if (!t) return '<span class="muted">Free Agency</span>';
    return U.crestHtml(t, "crest-sm") + U.escapeHtml(t.name);
  }

  function playerName(playerId, fallback) {
    var p = S.getPlayer(playerId);
    return U.escapeHtml(p ? p.name : (fallback || "?"));
  }

  function buildFeed() {
    var feed = [];
    S.getTrades().forEach(function (entry) {
      var teamA = S.getTeam(entry.teamAId);
      var teamB = S.getTeam(entry.teamBId);
      var aNames = entry.playersToB.map(function (id) { return playerName(id); }).join(", ") || "nobody";
      var bNames = entry.playersToA.map(function (id) { return playerName(id); }).join(", ") || "nobody";
      feed.push({
        type: "trade",
        logSeq: entry.logSeq || 0,
        season: entry.season,
        html: '<div class="log-item-teams">' + teamBadge(entry.teamAId) + ' <span class="muted">&harr;</span> ' + teamBadge(entry.teamBId) + "</div>" +
          '<div class="log-item-detail muted small">' + U.escapeHtml(teamA ? teamA.abbr : "?") + " sends " + aNames + "; " +
          U.escapeHtml(teamB ? teamB.abbr : "?") + " sends " + bNames + "</div>",
      });
    });
    S.getSignings().forEach(function (entry) {
      feed.push({
        type: "signing",
        logSeq: entry.logSeq || 0,
        season: entry.season,
        html: '<div class="log-item-teams">' + teamBadge(entry.teamId) + " signed " + playerName(entry.playerId, entry.playerName) + "</div>" +
          '<div class="log-item-detail muted small">' + (SIGNING_MODE_LABEL[entry.mode] || "Signed") + " &middot; " +
          U.formatMoney(entry.salary) + " &times; " + entry.years + " yr" + (entry.years === 1 ? "" : "s") + "</div>",
      });
    });
    S.getReleases().forEach(function (entry) {
      feed.push({
        type: "release",
        logSeq: entry.logSeq || 0,
        season: entry.season,
        html: '<div class="log-item-teams">' + teamBadge(entry.teamId) + " released " + playerName(entry.playerId, entry.playerName) + "</div>" +
          '<div class="log-item-detail muted small">' + (RELEASE_REASON_LABEL[entry.reason] || "Released") + "</div>",
      });
    });
    S.getPromotions().forEach(function (entry) {
      feed.push({
        type: "promotion",
        logSeq: entry.logSeq || 0,
        season: entry.season,
        html: '<div class="log-item-teams">' + playerName(entry.playerId) + " promoted: " + teamBadge(entry.fromTeamId) +
          ' <span class="muted">&rarr;</span> ' + teamBadge(entry.toTeamId) + "</div>" +
          '<div class="log-item-detail muted small">Call-up fee ' + U.formatMoney(entry.fee) + "</div>",
      });
    });
    feed.sort(function (a, b) { return b.logSeq - a.logSeq; });
    return feed;
  }

  function render(el) {
    container = el || container;
    if (!container) return;

    var feed = buildFeed();
    var counts = { trade: 0, signing: 0, release: 0, promotion: 0 };
    feed.forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    var filtered = filter === "all" ? feed : feed.filter(function (e) { return e.type === filter; });
    var shown = filtered.slice(0, SHOWN_LIMIT);

    var html = '<div class="panel-header"><h2>League Log</h2></div>';
    html += '<p class="muted small">Every trade, signing, release, and promotion across the whole league, most recent first — not just your own team\'s.</p>';

    html += '<div class="tab-strip">';
    html += '<button class="chip' + (filter === "all" ? " chip-active" : "") + '" data-filter="all">All (' + feed.length + ')</button>';
    ["trade", "signing", "release", "promotion"].forEach(function (t) {
      html += '<button class="chip' + (filter === t ? " chip-active" : "") + '" data-filter="' + t + '">' + TYPE_LABEL[t] + " (" + counts[t] + ")</button>";
    });
    html += "</div>";

    if (!shown.length) {
      html += '<div class="empty-state"><p>Nothing logged yet — check back after a few weeks of trades, signings, releases, and promotions happen around the league.</p></div>';
    } else {
      html += '<div class="log-list">';
      shown.forEach(function (entry) {
        html += '<div class="log-item log-item-' + entry.type + '">';
        html += '<div class="log-item-icon" title="' + TYPE_LABEL[entry.type] + '">' + TYPE_ICON[entry.type] + "</div>";
        html += '<div class="log-item-body">' + entry.html + "</div>";
        html += '<div class="log-item-season pill small">S' + (entry.season || "?") + "</div>";
        html += "</div>";
      });
      html += "</div>";
      if (filtered.length > SHOWN_LIMIT) {
        html += '<p class="muted small">Showing the ' + SHOWN_LIMIT + ' most recent of ' + filtered.length + ' — older entries are still saved, just not displayed here.</p>';
      }
    }

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    container.querySelectorAll("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        filter = b.dataset.filter;
        render();
      });
    });
  }

  window.PHLLeagueLog = { render: render };
})();
