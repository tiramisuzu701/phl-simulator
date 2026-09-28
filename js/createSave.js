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
 * already does — see js/startupDraft.js.) This setting only ever governs
 * the Contender/Prospect phases — the Pro division always drafts a fixed
 * 6 rounds regardless of Expansion mode (see roundsForPhase in
 * js/startupDraft.js).
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var STARTER = window.PHL_STARTER_DATA;
  var root = null;

  // Which of the two independent save slots (see js/state.js GM_KEY /
  // PLAYER_KEY) this page is currently working with — null until the user
  // picks one from the top-level chooser (see renderTopChooser).
  var pageMode = null; // "gm" | "player"

  var state = {
    mode: "existing", // "existing" | "expansion"
    divisionId: null,
    teamId: null,
    expName: "",
    expAbbr: "",
    expColor: "#4f7cff",
    expLogoDataUrl: null,
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
    renderTopChooser();
  }

  // ---------------- Top-level fork: which save slot? ----------------------
  // GM Franchise and Be A Player are two entirely independent saves (see
  // js/state.js GM_KEY / PLAYER_KEY / ACTIVE_MODE_KEY) — this is the one
  // place that picks which of them the rest of this page (and the next
  // index.html load) works with.
  function renderTopChooser() {
    var html = '<div class="form-card"><h3>How do you want to play?</h3>';
    html += '<div class="mode-grid">';
    html += '<button type="button" class="mode-card" data-topmode="gm"><h3>GM Franchise</h3>' +
      "<p>Run a team: rosters, contracts, trades, and the Startup Draft are all yours to manage.</p></button>";
    html += '<button type="button" class="mode-card" data-topmode="player"><h3>Be A Player</h3>' +
      "<p>Create one player and live their career, game to game &mdash; an AI runs the rest of your team.</p></button>";
    html += "</div></div>";
    root.innerHTML = html;
    root.querySelectorAll("[data-topmode]").forEach(function (b) {
      b.addEventListener("click", function () {
        pageMode = b.dataset.topmode;
        S.setActiveMode(pageMode);
        enterMode();
      });
    });
  }

  function backLinkHtml() {
    return '<p><a href="#" data-action="back-to-modes" class="muted small">&laquo; Choose a different mode</a></p>';
  }
  function wireBackLink() {
    var back = root.querySelector('[data-action="back-to-modes"]');
    if (back) back.addEventListener("click", function (e) {
      e.preventDefault();
      pageMode = null;
      renderTopChooser();
    });
  }

  // Reads whichever slot S.setActiveMode() just pointed at (S.load() never
  // writes to storage by itself, so this is safe read-only inspection) and
  // branches into that mode's own flow.
  function enterMode() {
    var existing = S.load();
    if (pageMode === "gm") {
      if (existing && existing.franchise && existing.franchise.teamId) {
        renderExistingSaveWarning(existing);
      } else {
        renderWizard();
      }
    } else {
      var mp = existing && existing.myPlayer;
      if (mp && (mp.playerId || mp.pendingSendOff)) {
        renderExistingPlayerSaveWarning(existing);
      } else {
        renderPlayerWizard();
      }
    }
  }

  function renderExistingPlayerSaveWarning(data) {
    var mp = data.myPlayer || {};
    var p = mp.playerId ? (data.players || []).find(function (pl) { return pl.id === mp.playerId; }) : null;
    var html = backLinkHtml();
    html += '<div class="empty-state">';
    html += "<p>You already have a Be A Player career in progress" +
      (p ? " as <strong>" + U.escapeHtml(p.name) + "</strong> (" + p.overall + " OVR)" : mp.pendingSendOff ? " — a career send-off is waiting to be viewed" : "") +
      ".</p>";
    html += '<p class="muted small">Continuing keeps that player exactly as they are. To go through tryouts and the amateur draft with a brand-new player, choose <strong>Start a Fresh Save</strong> &mdash; that permanently erases this one (export it first from Data Tools if you want to keep it).</p>';
    html += '<div class="form-actions" style="justify-content:center">';
    html += '<a class="btn btn-primary" href="index.html">Continue This Save</a>';
    html += '<button class="btn btn-danger" data-action="start-fresh-player">Start a Fresh Save Instead</button>';
    html += "</div></div>";
    root.innerHTML = html;
    wireBackLink();
    root.querySelector('[data-action="start-fresh-player"]').addEventListener("click", function () {
      renderPlayerWizard();
    });
  }

  // ---------------- Be A Player wizard -------------------------------------
  // Builds a fresh league in the player slot, runs its Startup Draft
  // headlessly right away (so every team already has its real roster by
  // the time you're looking at tryout invitations and the amateur draft),
  // then mounts the shared career-creation flow from js/careerMode.js
  // (create -> invitations -> tryouts -> scouting report -> draft day).
  function renderPlayerWizard() {
    S.resetToStarter(); // active mode is already "player" — see enterMode
    var SD = window.PHLStartupDraft;
    if (SD) {
      SD.startDraft();
      SD.autoDraftRemaining();
    }
    var html = backLinkHtml();
    html += '<div id="mc-flow-root"></div>';
    root.innerHTML = html;
    wireBackLink();
    var flowRoot = root.querySelector("#mc-flow-root");
    window.PHLCareerMode.renderCareerCreationFlow(flowRoot, function () {
      window.location.href = "index.html";
    }, { fresh: true });
  }

  // ---------------- GM Franchise wizard (unchanged from before Be A Player
  // mode existed, aside from the back link) ---------------------------------
  function renderExistingSaveWarning(data) {
    var team = data.teams.find(function (t) {
      return t.id === data.franchise.teamId;
    });
    var div = data.divisions.find(function (d) {
      return d.id === data.franchise.divisionId;
    });
    var html = backLinkHtml();
    html += '<div class="empty-state">';
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
    wireBackLink();
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
    html +=
      '<label>Team color<input type="color" id="f-exp-color" value="' + U.escapeHtml(state.expColor) + '"></label>';
    html += "</div>";
    html += '<label>Team logo (optional)<input type="file" id="f-exp-logo" accept="image/*"></label>';
    html += '<div class="logo-upload-preview">' +
      (state.expLogoDataUrl
        ? '<img src="' + state.expLogoDataUrl + '" alt="Logo preview">'
        : '<span class="muted small">No logo uploaded — a colored badge with your abbreviation will be used instead.</span>') +
      "</div>";
    html += '<p class="muted small">Your new team joins the division you pick above, alongside its existing teams, and drafts its very first roster in the Startup Draft just like everyone else. The color and logo you pick here show up everywhere your team\'s crest appears.</p>';
    html += "</div>";
    return html;
  }

  function renderWizard() {
    var divisions = starterDivisions();
    if (!state.divisionId) state.divisionId = divisions[0].id;

    var html = backLinkHtml();
    html += '<div class="form-card">';
    html += "<h3>Which kind of team?</h3>";
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
    wireBackLink();
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
    var colorInput = root.querySelector("#f-exp-color");
    if (colorInput) {
      colorInput.addEventListener("input", function (e) {
        state.expColor = e.target.value;
      });
    }
    var logoInput = root.querySelector("#f-exp-logo");
    if (logoInput) {
      logoInput.addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert("That logo is a bit large (over 2MB) — pick a smaller image.");
          logoInput.value = "";
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          state.expLogoDataUrl = ev.target.result;
          renderWizard();
        };
        reader.readAsDataURL(file);
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
      var newTeam = S.addTeam({
        name: name,
        abbr: abbr,
        division: state.divisionId,
        isExpansionTeam: true,
        customColor: state.expColor || null,
        logoUrl: state.expLogoDataUrl || null,
      });
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
