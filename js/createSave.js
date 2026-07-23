/* PHL Franchise Simulator — Create Save wizard (create-save.html only)
 * Not a global module other code depends on — this page is a one-shot
 * flow: pick who to manage, write the choice into the shared save, then
 * redirect to index.html to actually play. See js/app.js's init(), which
 * redirects BACK here whenever a save has no franchise team chosen yet.
 *
 * Startup Draft rounds are decided right here, once:
 *   - Manage an Existing Team -> settings.startupDraftRounds = 8
 *   - Create an Expansion Franchise -> settings.startupDraftRounds = 6
 * (one extra team drafting from the same fixed-size real player pool, so
 * fewer rounds keeps the draft from running dry even faster than it
 * already does — see js/startupDraft.js.)
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var STARTER = window.PHL_STARTER_DATA;
  var root = null;

  var state = {
    mode: "existing", // "existing" | "expansion"
    divisionId: null,
    teamId: null,
    expName: "",
    expAbbr: "",
  };

  function starterDivisions() {
    return STARTER.divisions.slice().sort(function (a, b) {
      return b.tier - a.tier;
    });
  }
  function starterTeamsFor(divisionId) {
    return STARTER.teams
      .filter(function (t) {
        return t.division === divisionId;
      })
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  function init() {
    root = document.getElementById("wizard-root");
    if (!root) return;
    // Read-only inspection of whatever's currently saved (S.load() never
    // writes to storage by itself) so we can warn before clobbering it.
    var existing = S.load();
    if (existing && existing.franchise && existing.franchise.teamId) {
      renderExistingSaveWarning(existing);
    } else {
      renderWizard();
    }
  }

  function renderExistingSaveWarning(data) {
    var team = data.teams.find(function (t) {
      return t.id === data.franchise.teamId;
    });
    var div = data.divisions.find(function (d) {
      return d.id === data.franchise.divisionId;
    });
    var html = '<div class="empty-state">';
    html +=
      "<p>You already have a save in progress &mdash; you're GM of <strong>" +
      U.escapeHtml(team ? team.name : "your team") +
      "</strong>" +
      (div ? " (" + U.escapeHtml(div.name) + ")" : "") +
      ".</p>";
    html +=
      '<p class="muted small">Starting a new save below will permanently erase this one. Export it first from Data Tools if you want to keep it.</p>';
    html += '<div class="form-actions" style="justify-content:center">';
    html += '<a class="btn btn-primary" href="index.html">Continue This Save</a>';
    html += '<button class="btn btn-danger" data-action="start-fresh">Start a Fresh Save Instead</button>';
    html += "</div></div>";
    root.innerHTML = html;
    root.querySelector('[data-action="start-fresh"]').addEventListener("click", function () {
      renderWizard();
    });
  }

  function modeCard(mode, title, desc) {
    return (
      '<button type="button" class="mode-card' +
      (state.mode === mode ? " mode-card-selected" : "") +
      '" data-mode="' +
      mode +
      '"><h3>' +
      U.escapeHtml(title) +
      "</h3><p>" +
      U.escapeHtml(desc) +
      "</p></button>"
    );
  }

  function renderExistingTeamPicker() {
    var teams = starterTeamsFor(state.divisionId);
    if (!teams.some(function (t) { return t.id === state.teamId; })) {
      state.teamId = teams.length ? teams[0].id : null;
    }
    var html = '<div class="form-card">';
    html += "<h3>Team</h3>";
    html += '<label>Choose a team<select id="f-team">';
    teams.forEach(function (t) {
      html +=
        '<option value="' + t.id + '"' + (state.teamId === t.id ? " selected" : "") + ">" +
        U.escapeHtml(t.name) + " (" + t.abbr + ")</option>";
    });
    html += "</select></label>";
    html += "</div>";
    return html;
  }

  function renderExpansionForm() {
    var html = '<div class="form-card">';
    html += "<h3>New Team Details</h3>";
    html += '<div class="form-grid">';
    html +=
      '<label>Team name<input type="text" id="f-exp-name" value="' +
      U.escapeHtml(state.expName) +
      '" placeholder="e.g. Denver Drift"></label>';
    html +=
      '<label>Abbreviation<input type="text" id="f-exp-abbr" maxlength="4" value="' +
      U.escapeHtml(state.expAbbr) +
      '" placeholder="DEN"></label>';
    html += "</div>";
    html += '<p class="muted small">Your new team joins the division you pick above, alongside its existing teams, and drafts its very first roster in the Startup Draft just like everyone else.</p>';
    html += "</div>";
    return html;
  }

  function renderWizard() {
    var divisions = starterDivisions();
    if (!state.divisionId) state.divisionId = divisions[0].id;

    var html = '<div class="form-card">';
    html += "<h3>How do you want to play?</h3>";
    html += '<div class="mode-grid">';
    html += modeCard("existing", "Manage an Existing Team", "Take over one of the league's existing teams. Startup Draft: 8 rounds per phase.");
    html += modeCard("expansion", "Create an Expansion Franchise", "Found a brand-new team that joins the league from scratch. Startup Draft: 6 rounds per phase.");
    html += "</div></div>";

    html += '<div class="form-card">';
    html += "<h3>Division</h3>";
    html += '<div class="chip-row" id="division-chips">';
    divisions.forEach(function (d) {
      html +=
        '<button type="button" class="chip' +
        (state.divisionId === d.id ? " chip-active" : "") +
        '" data-division="' +
        d.id +
        '">' +
        U.escapeHtml(d.name) +
        "</button>";
    });
    html += "</div>";
    html += '<p class="muted small">' + (state.mode === "expansion" ? "The division your new franchise joins." : "The division your team plays in.") + "</p>";
    html += "</div>";

    html += state.mode === "existing" ? renderExistingTeamPicker() : renderExpansionForm();

    var rounds = state.mode === "expansion" ? 6 : 8;
    html +=
      '<div class="draft-rounds-note">&#9873; <span>This save\'s Startup Draft will run <strong>' +
      rounds +
      " rounds per phase</strong> (Pro &rarr; Contender &rarr; Prospect), " +
      (state.mode === "expansion"
        ? "6 instead of 8 since an Expansion Franchise means one extra team is drawing from the same fixed real-player pool."
        : "the standard pace for a save with no Expansion Franchise.") +
      "</span></div>";

    html += '<div class="wizard-footer">';
    html += '<button class="btn btn-primary" data-action="submit">Start This Save &raquo;</button>';
    html += "</div>";

    root.innerHTML = html;
    wireWizardEvents();
  }

  function wireWizardEvents() {
    root.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.mode = b.dataset.mode;
        renderWizard();
      });
    });
    root.querySelectorAll("[data-division]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.divisionId = b.dataset.division;
        renderWizard();
      });
    });
    var teamSel = root.querySelector("#f-team");
    if (teamSel) {
      teamSel.addEventListener("change", function (e) {
        state.teamId = e.target.value;
      });
    }
    var nameInput = root.querySelector("#f-exp-name");
    if (nameInput) {
      nameInput.addEventListener("input", function (e) {
        state.expName = e.target.value;
      });
    }
    var abbrInput = root.querySelector("#f-exp-abbr");
    if (abbrInput) {
      abbrInput.addEventListener("input", function (e) {
        state.expAbbr = e.target.value;
      });
    }
    root.querySelector('[data-action="submit"]').addEventListener("click", submitWizard);
  }

  function submitWizard() {
    if (state.mode === "existing") {
      if (!state.teamId) {
        alert("Pick a team first.");
        return;
      }
      S.resetToStarter();
      S.setFranchise(state.divisionId, state.teamId);
      S.updateSettings({ startupDraftRounds: 8 });
    } else {
      var name = (state.expName || "").trim();
      var abbr = (state.expAbbr || "").trim().toUpperCase();
      if (!name) {
        alert("Give your Expansion Franchise a name first.");
        return;
      }
      if (!abbr) abbr = name.slice(0, 3).toUpperCase();
      S.resetToStarter();
      var newTeam = S.addTeam({ name: name, abbr: abbr, division: state.divisionId, isExpansionTeam: true });
      S.setFranchise(state.divisionId, newTeam.id);
      S.updateSettings({ startupDraftRounds: 6 });
    }
    window.location.href = "index.html";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
