/* PHL Franchise Simulator — app shell: tab navigation & render dispatch
 * Global namespace: window.PHLApp
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var currentTab = "dashboard";

  var modules = {
    dashboard: window.PHLDashboard,
    startup: window.PHLStartupDraft,
    teams: window.PHLTeams,
    teamdetail: window.PHLTeamDetail,
    players: window.PHLPlayers,
    schedule: window.PHLSchedule,
    standings: window.PHLStandings,
    playoffs: window.PHLPlayoffs,
    draft: window.PHLDraft,
    promotions: window.PHLPromotions,
    contracts: window.PHLContracts,
    stats: window.PHLStats,
    data: window.PHLDataTools,
  };

  function showTab(name) {
    if (!modules[name]) return;
    currentTab = name;
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("tab-btn-active", b.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.toggle("tab-panel-active", p.id === "tab-" + name);
    });
    var el = document.getElementById("tab-" + name);
    modules[name].render(el);
    updateHeaderMeta();
  }

  function refresh() {
    // Re-render whichever tab is active, using its own saved container ref.
    var el = document.getElementById("tab-" + currentTab);
    if (modules[currentTab]) modules[currentTab].render(el);
    updateHeaderMeta();
  }

  function refreshAll() {
    Object.keys(modules).forEach(function (name) {
      var el = document.getElementById("tab-" + name);
      if (modules[name] && el) modules[name].render(el);
    });
    updateHeaderMeta();
  }

  function updateHeaderMeta() {
    var meta = document.getElementById("header-meta");
    var season = S.getSeason();
    meta.textContent =
      "Season " + (season.seasonNumber || 1) + " · " +
      capitalize(season.phase || "offseason") + " · " +
      S.getTeams().length + " teams";
    updateAdvanceButton();
  }

  // The single control that drives the whole season forward — see
  // js/calendar.js. Lives in the header so it's reachable from every tab.
  function updateAdvanceButton() {
    var el = document.getElementById("header-advance");
    if (!el || !window.PHLCalendar) return;
    var Cal = window.PHLCalendar;
    if (!Cal.isSetupComplete()) {
      el.innerHTML = '<span class="muted small">Finish the Startup Draft to unlock Advance Week</span>';
      return;
    }
    var blocked = Cal.checkBlocked();
    el.innerHTML =
      '<span class="week-pill">' + U.escapeHtml(Cal.weekLabel()) + "</span>" +
      '<button class="btn btn-primary" id="btn-advance-week"' + (blocked ? " disabled" : "") + ">Advance Week</button>";
    if (blocked) {
      el.innerHTML += '<span class="warning-banner header-block-warning">' + U.escapeHtml(blocked) + "</span>";
    }
    var btn = document.getElementById("btn-advance-week");
    if (btn) {
      btn.addEventListener("click", function () {
        var result = Cal.advanceWeek();
        if (!result.advanced) {
          alert(result.reason);
          updateAdvanceButton();
          return;
        }
        refreshAll();
        if (result.summary && result.summary.length) {
          // A lightweight, non-blocking heads-up rather than a modal per
          // week — full detail always lives in the relevant tab.
          console.log("[Advance Week]", result.summary.join(" "));
        }
      });
    }
  }

  function showTeamDetail(teamId) {
    if (window.PHLTeamDetail) window.PHLTeamDetail.setTeam(teamId);
    showTab("teamdetail");
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function init() {
    S.load();
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showTab(btn.dataset.tab);
      });
    });
    // New/fresh saves (no GM team chosen, startup draft not finished yet)
    // open straight to the Startup Draft tab so it's the natural first step.
    var franchise = S.getFranchise();
    var startupDraft = S.getStartupDraft();
    var needsSetup = (!franchise || !franchise.teamId) || (startupDraft && startupDraft.status !== "complete");
    showTab(needsSetup ? "startup" : "dashboard");
  }

  window.PHLApp = { showTab: showTab, refresh: refresh, refreshAll: refreshAll, showTeamDetail: showTeamDetail };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
