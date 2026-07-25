/* PHL Franchise Simulator — Office (merged Roster / Players / Contracts hub)
 * Global namespace: window.PHLOffice
 *
 * Team Management, Players, and Contracts & Cap used to each get their own
 * top-level sidebar item. They're merged here into a single "Office" tab
 * with a sub-tab strip, since all three are day-to-day roster/front-office
 * tasks a GM bounces between constantly. This is a thin delegating router,
 * not a rewrite: js/teamManagement.js, js/players.js, and js/contracts.js
 * are all already container-agnostic (render(el) accepts any DOM node), so
 * Office just owns the sub-nav and hands each module a shared sub-panel
 * element — their internal logic, DOM structure and event wiring are
 * untouched.
 *
 * goTo(key) lets other modules deep-link into a specific sub-tab (e.g. a
 * "Contracts & Cap" quick-link button elsewhere in the app) — see
 * js/app.js's showTab() legacy-alias handling, which maps the old
 * "teammanagement" / "players" / "contracts" data-goto targets onto
 * PHLOffice.goTo(...) + showTab("office") so none of the existing
 * data-goto buttons scattered around the app had to change.
 */
(function () {
  "use strict";
  var container = null;
  var subTab = "roster";

  var SUBTABS = [
    { key: "roster", label: "Roster", module: function () { return window.PHLTeamManagement; } },
    { key: "players", label: "Players", module: function () { return window.PHLPlayers; } },
    { key: "contracts", label: "Contracts & Cap", module: function () { return window.PHLContracts; } },
  ];

  function goTo(key) {
    if (SUBTABS.some(function (t) { return t.key === key; })) subTab = key;
  }

  function render(el) {
    container = el || container;
    if (!container) return;

    var html = '<div class="panel-header"><h2>Office</h2></div>';
    html += '<p class="muted small">Your front-office hub — manage the roster and lineup, browse the league player pool, and handle contracts &amp; cap space, all in one place.</p>';
    html += '<div class="tab-strip">';
    SUBTABS.forEach(function (t) {
      html += '<button class="chip' + (subTab === t.key ? " chip-active" : "") + '" data-office-tab="' + t.key + '">' + t.label + "</button>";
    });
    html += "</div>";
    html += '<div id="office-subpanel"></div>';
    container.innerHTML = html;

    container.querySelectorAll("[data-office-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        subTab = b.dataset.officeTab;
        render();
      });
    });

    var active = SUBTABS.filter(function (t) { return t.key === subTab; })[0] || SUBTABS[0];
    var mod = active.module();
    var subpanel = container.querySelector("#office-subpanel");
    if (mod && subpanel) mod.render(subpanel);
  }

  window.PHLOffice = { render: render, goTo: goTo };
})();
