/* PHL Franchise Simulator — Inbox (league & team notifications)
 * Global namespace: window.PHLInbox
 *
 * A running log of things happening around the league: AI trades (both
 * in-division AI-AI deals and, actionably, AI-to-user trade offers),
 * promotions, MVP awards, playoff results, and more. Most entries are
 * read-only; "trade-offer" entries are actionable — Accept executes the
 * trade (re-validated at accept time, same as any other trade), Reject
 * just dismisses it.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var filter = "all"; // "all" | "unread" | "actionable"

  function addNotification(entry) {
    return S.addNotification(entry);
  }

  // Convenience wrapper used by aiManager.js when it generates an AI ->
  // user trade offer — bundles the actionable payload the Inbox UI needs
  // to render Accept/Reject.
  function addTradeOffer(aiTeamId, userTeamId, aiGivesPlayerId, userGivesPlayerId) {
    var aiTeam = S.getTeam(aiTeamId);
    var aiGives = S.getPlayer(aiGivesPlayerId);
    var userGives = S.getPlayer(userGivesPlayerId);
    if (!aiTeam || !aiGives || !userGives) return null;
    return addNotification({
      type: "trade-offer",
      title: aiTeam.name + " wants to talk trade",
      body: aiTeam.name + " is offering " + aiGives.name + " (" + aiGives.position + ", OVR " + aiGives.overall + ") for your " +
        userGives.name + " (" + userGives.position + ", OVR " + userGives.overall + ").",
      actionable: true,
      payload: { aiTeamId: aiTeamId, userTeamId: userTeamId, aiGivesPlayerId: aiGivesPlayerId, userGivesPlayerId: userGivesPlayerId },
    });
  }

  function resolveTradeOffer(notif, accept) {
    var payload = notif.payload;
    if (!payload) { S.removeNotification(notif.id); return; }
    if (!accept) {
      S.removeNotification(notif.id);
      return;
    }
    var aiTeam = S.getTeam(payload.aiTeamId);
    var aiGives = S.getPlayer(payload.aiGivesPlayerId);
    var userGives = S.getPlayer(payload.userGivesPlayerId);
    if (!aiTeam || !aiGives || !userGives || aiGives.teamId !== payload.aiTeamId || userGives.teamId !== payload.userTeamId) {
      alert("That trade offer is no longer valid — one of the players has since moved.");
      S.removeNotification(notif.id);
      return;
    }
    if (!S.wouldMeetRosterMinimum(payload.userTeamId, [userGives.id], [aiGives])) {
      alert("Accepting would drop your roster below the required 2F/2D/1G minimum.");
      return;
    }
    if (!S.wouldMeetRosterMinimum(payload.aiTeamId, [aiGives.id], [userGives])) {
      alert(aiTeam.name + " can no longer make this trade — it would drop them below the roster minimum.");
      S.removeNotification(notif.id);
      return;
    }
    if (!S.wouldMeetGoalieMax(payload.userTeamId, [userGives.id], [aiGives])) {
      alert("Accepting would leave you with more than " + S.GOALIE_MAX + " goalies — the most a team can hold.");
      return;
    }
    if (!S.wouldMeetGoalieMax(payload.aiTeamId, [aiGives.id], [userGives])) {
      alert(aiTeam.name + " can no longer make this trade — it would leave them with too many goalies.");
      S.removeNotification(notif.id);
      return;
    }
    var myCapAfter = S.capForTeam(payload.userTeamId) - (S.capUsed(payload.userTeamId) - userGives.salary + aiGives.salary);
    if (myCapAfter < 0) {
      alert("Accepting would put you over your salary cap by " + U.formatMoney(Math.abs(myCapAfter)) + ".");
      return;
    }
    S.updatePlayer(aiGives.id, { teamId: payload.userTeamId });
    S.updatePlayer(userGives.id, { teamId: payload.aiTeamId });
    S.addTrade({
      season: S.getSeason().seasonNumber || 1,
      teamAId: payload.userTeamId,
      teamBId: payload.aiTeamId,
      playersToB: [userGives.id],
      playersToA: [aiGives.id],
    });
    S.removeNotification(notif.id);
    addNotification({
      type: "trade",
      title: "Trade completed",
      body: "You traded " + userGives.name + " to " + aiTeam.name + " for " + aiGives.name + ".",
    });
    if (window.PHLApp) window.PHLApp.refreshAll();
  }

  function typeIcon(type) {
    var icons = {
      "trade-offer": "⇄",
      trade: "⇄",
      promotion: "↑",
      award: "\u{1F3C6}",
      playoff: "\u{1F3C6}",
      growth: "⬆",
      league: "◎",
    };
    return icons[type] || "•";
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var all = S.getNotifications();
    var list = all;
    if (filter === "unread") list = all.filter(function (n) { return !n.read; });
    else if (filter === "actionable") list = all.filter(function (n) { return n.actionable; });

    var html = '<div class="panel-header"><h2>Inbox</h2>' +
      '<div class="header-actions"><button class="btn btn-sm" data-action="mark-all-read">Mark All Read</button></div></div>';
    html += '<p class="muted small">Trades between AI teams, trade offers sent to you, promotions, MVP awards and playoff results all show up here as they happen.</p>';
    html += '<div class="tab-strip">';
    ["all", "unread", "actionable"].forEach(function (f) {
      html += '<button class="chip' + (filter === f ? " chip-active" : "") + '" data-filter="' + f + '">' +
        (f === "all" ? "All" : f === "unread" ? "Unread" : "Needs Action") + "</button>";
    });
    html += "</div>";

    if (!list.length) {
      html += '<div class="empty-state"><p>Nothing here yet — check back after advancing a few weeks.</p></div>';
    } else {
      html += '<div class="inbox-list">';
      list.forEach(function (n) {
        html += '<div class="inbox-item' + (n.read ? "" : " inbox-item-unread") + '" data-id="' + n.id + '">';
        html += '<div class="inbox-item-icon">' + typeIcon(n.type) + "</div>";
        html += '<div class="inbox-item-body">';
        html += '<div class="inbox-item-title">' + U.escapeHtml(n.title || "") + (n.read ? "" : ' <span class="pill pill-accent small">New</span>') + "</div>";
        html += '<div class="inbox-item-text muted small">' + U.escapeHtml(n.body || "") + "</div>";
        if (n.actionable && n.type === "trade-offer") {
          html += '<div class="form-actions">' +
            '<button class="btn btn-sm btn-primary" data-action="accept-offer" data-id="' + n.id + '">Accept</button>' +
            '<button class="btn btn-sm btn-danger" data-action="reject-offer" data-id="' + n.id + '">Reject</button></div>';
        }
        html += "</div></div>";
      });
      html += "</div>";
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
    var markAll = container.querySelector('[data-action="mark-all-read"]');
    if (markAll) markAll.addEventListener("click", function () {
      S.markAllNotificationsRead();
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
    container.querySelectorAll(".inbox-item").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("[data-action]")) return;
        S.markNotificationRead(row.dataset.id);
        row.classList.remove("inbox-item-unread");
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
    container.querySelectorAll('[data-action="accept-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var notif = S.getNotifications().find(function (n) { return n.id === b.dataset.id; });
        if (notif) resolveTradeOffer(notif, true);
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
    container.querySelectorAll('[data-action="reject-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var notif = S.getNotifications().find(function (n) { return n.id === b.dataset.id; });
        if (notif) resolveTradeOffer(notif, false);
        render();
        if (window.PHLApp) window.PHLApp.refresh();
      });
    });
  }

  window.PHLInbox = {
    render: render,
    addNotification: addNotification,
    addTradeOffer: addTradeOffer,
  };
})();
