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
    teams: window.PHLTeams,
    players: window.PHLPlayers,
    schedule: window.PHLSchedule,
    standings: window.PHLStandings,
    playoffs: window.PHLPlayoffs,
    draft: window.PHLDraft,
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
    showTab("dashboard");
  }

  window.PHLApp = { showTab: showTab, refresh: refresh, refreshAll: refreshAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
