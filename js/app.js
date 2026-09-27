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
    mycareer: window.PHLCareerMode,
    startup: window.PHLStartupDraft,
    office: window.PHLOffice,
    teams: window.PHLTeams,
    teamdetail: window.PHLTeamDetail,
    schedule: window.PHLSchedule,
    standings: window.PHLStandings,
    playoffs: window.PHLPlayoffs,
    trades: window.PHLTrades,
    promotions: window.PHLPromotions,
    scrims: window.PHLScrims,
    strategy: window.PHLStrategy,
    inbox: window.PHLInbox,
    stats: window.PHLStats,
    log: window.PHLLeagueLog,
    data: window.PHLDataTools,
  };

  var TAB_LABELS = {
    dashboard: "Dashboard",
    mycareer: "My Career",
    startup: "Startup Draft",
    office: "Office",
    teams: "Teams",
    teamdetail: "Team",
    schedule: "Schedule",
    standings: "Standings",
    playoffs: "Playoffs",
    trades: "Trades",
    promotions: "Promotions",
    scrims: "Scrims",
    strategy: "Strategy",
    inbox: "Inbox",
    stats: "Stats & Offseason",
    log: "League Log",
    data: "Data Tools",
  };

  // "Team Management" / "Players" / "Contracts & Cap" used to be their own
  // top-level tabs; they're now sub-tabs inside the merged "Office" tab
  // (see js/office.js). Rather than track down and rewrite every
  // data-goto="contracts" / data-goto="players" / data-goto="teammanagement"
  // button scattered across dashboard.js, teamManagement.js, etc., showTab()
  // recognizes those old names, points Office at the right sub-tab, and
  // shows "office" instead — every existing quick-link keeps working as-is.
  var OFFICE_ALIASES = { teammanagement: "roster", players: "players", contracts: "contracts" };

  function showTab(name) {
    if (OFFICE_ALIASES[name]) {
      if (window.PHLOffice) window.PHLOffice.goTo(OFFICE_ALIASES[name]);
      name = "office";
    }
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
  // its nav item disappears and "Office" (the day-to-day roster/contracts/
  // player-pool hub) takes its place. If the user happens to be sitting on
  // the Startup Draft tab the moment it finishes, bounce them over.
  function updateNavVisibility() {
    var sd = S.getStartupDraft();
    var draftDone = !!(sd && sd.status === "complete");
    var startupNav = document.querySelector('.nav-item[data-tab="startup"]');
    var officeNav = document.querySelector('.nav-item[data-tab="office"]');
    var dashboardNav = document.querySelector('.nav-item[data-tab="dashboard"]');
    var myCareerNav = document.querySelector('.nav-item[data-tab="mycareer"]');
    var tradesNav = document.querySelector('.nav-item[data-tab="trades"]');
    var promotionsNav = document.querySelector('.nav-item[data-tab="promotions"]');
    var strategyNav = document.querySelector('.nav-item[data-tab="strategy"]');
    var scrimsNav = document.querySelector('.nav-item[data-tab="scrims"]');

    if (S.isBeAPlayerMode()) {
      // Be A Player: zero GM control, so none of the roster/contract/
      // trade/strategy management tabs apply — the Startup Draft also runs
      // headless (see initBeAPlayer below), so it never shows either. "My
      // Career" replaces Dashboard as the mode's home tab.
      if (startupNav) startupNav.style.display = "none";
      if (officeNav) officeNav.style.display = "none";
      if (dashboardNav) dashboardNav.style.display = "none";
      if (tradesNav) tradesNav.style.display = "none";
      if (promotionsNav) promotionsNav.style.display = "none";
      if (strategyNav) strategyNav.style.display = "none";
      if (scrimsNav) scrimsNav.style.display = "none";
      if (myCareerNav) myCareerNav.style.display = "";
      var hiddenForPlayerMode = ["startup", "office", "dashboard", "trades", "promotions", "strategy", "scrims"];
      if (hiddenForPlayerMode.indexOf(currentTab) !== -1) {
        showTab("mycareer");
      }
    } else {
      if (myCareerNav) myCareerNav.style.display = "none";
      if (tradesNav) tradesNav.style.display = "";
      if (promotionsNav) promotionsNav.style.display = "";
      if (strategyNav) strategyNav.style.display = "";
      if (scrimsNav) scrimsNav.style.display = "";
      if (dashboardNav) dashboardNav.style.display = "";
      if (startupNav) startupNav.style.display = draftDone ? "none" : "";
      if (officeNav) officeNav.style.display = draftDone ? "" : "none";
      if (draftDone && currentTab === "startup") {
        showTab("office");
      }
      if (currentTab === "mycareer") showTab("dashboard");
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
    if (S.isBeAPlayerMode()) {
      var mp = S.getMyPlayer();
      var p = mp && mp.playerId ? S.getPlayer(mp.playerId) : null;
      if (!p) {
        el.innerHTML = '<div class="sidebar-franchise-empty muted small">Career over — visit My Career to start a new one.</div>';
        return;
      }
      var pTeam = p.teamId ? S.getTeam(p.teamId) : null;
      el.innerHTML =
        (pTeam ? '<div class="sidebar-team-badge">' + U.crestHtml(pTeam, "crest-lg") + "</div>" : "") +
        '<div class="sidebar-team-name">' + U.escapeHtml(p.name) + "</div>" +
        '<div class="sidebar-team-sub">' + U.escapeHtml(p.position) + (pTeam ? " &middot; " + U.escapeHtml(pTeam.name) : " &middot; Free Agent") + "</div>";
      return;
    }
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
    if (S.isBeAPlayerMode()) {
      initBeAPlayer();
      return;
    }
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

  // Be A Player mode's own boot path — no franchise.teamId is ever set (see
  // js/state.js myTeamId), and there's no pick-by-pick Startup Draft board
  // to show (zero GM control): the whole league's initial rosters get
  // filled automatically, once, the very first time this mode's save loads,
  // then every load after that just lands on My Career.
  function initBeAPlayer() {
    var mp = S.getMyPlayer();
    if (!mp || (!mp.playerId && !mp.pendingSendOff)) {
      // No active player and nothing pending review — this save never
      // finished being created (or was reset) — back to Create Save.
      window.location.href = "create-save.html";
      return;
    }
    var sd = S.getStartupDraft();
    if (!sd || sd.status !== "complete") {
      if (sd && sd.status === "not_started" && window.PHLStartupDraft) {
        window.PHLStartupDraft.startDraft();
      }
      if (window.PHLStartupDraft) window.PHLStartupDraft.autoDraftRemaining();
      if (window.PHLSchedule && !(S.getSchedule() || []).length) {
        window.PHLSchedule.generateSeasonSchedule();
      }
    }
    showTab("mycareer");
  }

  window.PHLApp = { showTab: showTab, refresh: refresh, refreshAll: refreshAll, showTeamDetail: showTeamDetail };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
