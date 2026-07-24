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
    teammanagement: window.PHLTeamManagement,
    teams: window.PHLTeams,
    teamdetail: window.PHLTeamDetail,
    players: window.PHLPlayers,
    schedule: window.PHLSchedule,
    standings: window.PHLStandings,
    playoffs: window.PHLPlayoffs,
    trades: window.PHLTrades,
    promotions: window.PHLPromotions,
    contracts: window.PHLContracts,
    scrims: window.PHLScrims,
    inbox: window.PHLInbox,
    stats: window.PHLStats,
    log: window.PHLLeagueLog,
    data: window.PHLDataTools,
  };

  var TAB_LABELS = {
    dashboard: "Dashboard",
    startup: "Startup Draft",
    teammanagement: "Team Management",
    teams: "Teams",
    teamdetail: "Team",
    players: "Players",
    schedule: "Schedule",
    standings: "Standings",
    playoffs: "Playoffs",
    trades: "Trades",
    promotions: "Promotions",
    contracts: "Contracts & Cap",
    scrims: "Scrims",
    inbox: "Inbox",
    stats: "Stats & Offseason",
    log: "League Log",
    data: "Data Tools",
  };

  function showTab(name) {
    if (!modules[name]) return;
    currentTab = name;
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("nav-item-active", b.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.toggle("tab-panel-active", p.id === "tab-" + name);
    });
    var heading = document.getElementById("top-header-heading");
    if (heading) heading.textContent = TAB_LABELS[name] || capitalize(name);
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

  function statPill(label, value) {
    return '<span class="stat-pill"><span class="stat-pill-label">' + U.escapeHtml(label) + '</span><span class="stat-pill-value">' + U.escapeHtml(String(value)) + "</span></span>";
  }

  function updateHeaderMeta() {
    var meta = document.getElementById("header-meta");
    if (meta) {
      var season = S.getSeason();
      var Cal = window.PHLCalendar;
      var html = statPill("Season", season.seasonNumber || 1);
      html += statPill("Phase", capitalize(season.phase || "offseason"));
      // weekLabel() reads like "Off-season 1/5" / "Week 3/12" / "Playoffs 2/4"
      // — strip the leading phase word so the pill just shows "1/5" next to
      // the "Phase" pill above, which already says what it is.
      if (Cal && Cal.isSetupComplete()) html += statPill("Week", Cal.weekLabel().replace(/^\D*(\d.*)$/, "$1") || "—");
      html += statPill("Teams", S.getTeams().length);
      var franchise = S.getFranchise();
      if (franchise && franchise.teamId) {
        var space = S.capSpace(franchise.teamId);
        html += '<span class="stat-pill' + (space < 0 ? " stat-pill-warn" : "") + '"><span class="stat-pill-label">Cap Space</span><span class="stat-pill-value">' + U.escapeHtml(U.formatMoney(space)) + "</span></span>";
      }
      meta.innerHTML = html;
    }
    updateSidebarFranchise();
    updateAdvanceButton();
    updateNavVisibility();
    updateInboxBadge();
  }

  // "Startup Draft" is a one-time, save-opening flow — once it's complete
  // its nav item disappears and "Team Management" (the day-to-day roster
  // hub) takes its place. If the user happens to be sitting on the
  // Startup Draft tab the moment it finishes, bounce them over.
  function updateNavVisibility() {
    var sd = S.getStartupDraft();
    var draftDone = !!(sd && sd.status === "complete");
    var startupNav = document.querySelector('.nav-item[data-tab="startup"]');
    var teamMgmtNav = document.querySelector('.nav-item[data-tab="teammanagement"]');
    if (startupNav) startupNav.style.display = draftDone ? "none" : "";
    if (teamMgmtNav) teamMgmtNav.style.display = draftDone ? "" : "none";
    if (draftDone && currentTab === "startup") {
      showTab("teammanagement");
    }
  }

  function updateInboxBadge() {
    var btn = document.querySelector('.nav-item[data-tab="inbox"]');
    if (!btn || !S.unreadNotificationCount) return;
    var count = S.unreadNotificationCount();
    var badge = btn.querySelector(".nav-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nav-badge";
        btn.appendChild(badge);
      }
      badge.textContent = count > 99 ? "99+" : String(count);
    } else if (badge) {
      badge.remove();
    }
  }

  // Franchise block pinned near the top of the sidebar — mirrors the
  // "team crest + name + GM" block from the reference UI.
  function updateSidebarFranchise() {
    var el = document.getElementById("sidebar-franchise");
    if (!el) return;
    var franchise = S.getFranchise();
    var team = franchise && franchise.teamId ? S.getTeam(franchise.teamId) : null;
    if (!team) {
      el.innerHTML = '<div class="sidebar-franchise-empty muted small">No team selected yet — finish the Startup Draft to pick one.</div>';
      return;
    }
    var division = S.getDivision(team.division);
    el.innerHTML =
      '<div class="sidebar-team-badge">' + U.crestHtml(team, "crest-lg") + "</div>" +
      '<div class="sidebar-team-name">' + U.escapeHtml(team.name) + "</div>" +
      '<div class="sidebar-team-sub">GM &middot; ' + U.escapeHtml(division ? division.name : "") + "</div>";
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
      '<button class="btn btn-primary" id="btn-advance-week"' + (blocked ? " disabled" : "") + ">Advance Week &raquo;</button>";
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
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showTab(btn.dataset.tab);
      });
    });
    var saveExit = document.getElementById("btn-save-exit");
    if (saveExit) saveExit.addEventListener("click", function () {
      S.save();
      alert("Progress saved. Your league lives in this browser — use Data Tools to export a portable backup any time.");
    });
    // A save with no franchise team chosen yet (a brand-new save, or one
    // reset via Data Tools) has nothing for the app to show — division/team
    // (and, optionally, an Expansion Franchise) are picked once, up front,
    // on the standalone Create Save page. Redirect there immediately rather
    // than showing an empty in-app picker.
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      window.location.href = "create-save.html";
      return;
    }
    // Franchise is set but the one-time Startup Draft hasn't finished yet
    // (e.g. the user left mid-draft) — land back on that tab so it's the
    // natural next step.
    var startupDraft = S.getStartupDraft();
    var needsSetup = startupDraft && startupDraft.status !== "complete";
    showTab(needsSetup ? "startup" : "dashboard");
  }

  window.PHLApp = { showTab: showTab, refresh: refresh, refreshAll: refreshAll, showTeamDetail: showTeamDetail };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
