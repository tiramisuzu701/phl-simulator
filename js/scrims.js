/* PHL Franchise Simulator — Scrims (team chemistry)
 * Global namespace: window.PHLScrims
 *
 * Run scrims with your playing roster to slowly build team chemistry
 * (0-100, baseline 50) — chemistry gives a small but real boost to both
 * offense and defense in the sim (see js/sim.js chemistryRatingBonus).
 * Capped at a few scrims per calendar week so it can't be spammed to an
 * instant max; chemistry also decays a little each week if you skip it
 * (see js/calendar.js weeklyChemistryUpkeep).
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;

  var SCRIMS_PER_WEEK = 4;

  function runScrim(teamId) {
    var team = S.getTeam(teamId);
    if (!team) return null;
    if ((team.scrimsThisWeek || 0) >= SCRIMS_PER_WEEK) return null;
    var chem = team.chemistry == null ? 50 : team.chemistry;
    // Diminishing returns as chemistry climbs toward 100.
    var gain = U.randInt(3, 8) * (1 - chem / 130);
    gain = Math.max(1, Math.round(gain));
    S.addChemistry(teamId, gain);
    S.updateTeam(teamId, { scrimsThisWeek: (team.scrimsThisWeek || 0) + 1 });
    return gain;
  }

  function resetWeeklyUsage() {
    S.getTeams().forEach(function (t) {
      S.updateTeam(t.id, { scrimsThisWeek: 0 });
    });
  }

  // Small weekly decay toward the 50 baseline for teams that skip scrims —
  // chemistry needs upkeep, not a one-time grind to 100.
  function weeklyChemistryUpkeep() {
    S.getTeams().forEach(function (t) {
      var chem = t.chemistry == null ? 50 : t.chemistry;
      if (chem > 50) S.addChemistry(t.id, -1);
    });
  }

  function chemistryLabel(chem) {
    if (chem >= 85) return "Elite";
    if (chem >= 70) return "Great";
    if (chem >= 55) return "Good";
    if (chem >= 40) return "Average";
    if (chem >= 25) return "Shaky";
    return "Poor";
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Scrims</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first.</p>';
      return;
    }
    var team = S.getTeam(franchise.teamId);
    if (!team) return;
    var chem = team.chemistry == null ? 50 : team.chemistry;
    var used = team.scrimsThisWeek || 0;
    var remaining = Math.max(0, SCRIMS_PER_WEEK - used);
    var lineup = window.PHLSim ? window.PHLSim.getActiveLineup(team.id) : null;

    var html = '<div class="panel-header"><h2>Scrims</h2></div>';
    html += '<p class="muted small">Run practice scrims with your playing roster to build team chemistry — a small but real boost to how your team performs in every game. Chemistry decays a little each week if you skip it, so keep it up.</p>';

    html += '<div class="form-card chemistry-card">';
    html += '<div class="chemistry-header"><h3>' + U.escapeHtml(team.name) + ' Chemistry</h3><span class="pill pill-accent">' + chemistryLabel(chem) + "</span></div>";
    html += '<div class="chemistry-bar"><div class="chemistry-bar-fill" style="width:' + chem + '%"></div></div>';
    html += '<div class="muted small" style="margin-top:0.4rem">' + chem + " / 100 &middot; " + remaining + " of " + SCRIMS_PER_WEEK + " scrims left this week</div>";
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary" data-action="run-scrim"' + (remaining <= 0 ? " disabled" : "") + '>Run a Scrim</button>';
    html += "</div></div>";

    if (lineup) {
      html += '<div class="form-card"><h3>Scrimmaging Lineup</h3>';
      html += '<p class="muted small">Whoever\'s currently set as your starters (Players tab) is who shows up to scrims.</p>';
      html += '<div class="scrim-lineup">';
      var all = lineup.forwards.concat(lineup.defenders).concat(lineup.goalie ? [lineup.goalie] : []);
      if (!all.length) {
        html += '<p class="muted small">No starters set yet — the sim falls back to your best available players automatically.</p>';
      } else {
        all.forEach(function (p) {
          html += '<span class="pill">' + U.escapeHtml(p.name) + ' <span class="muted">(' + p.position + ")</span></span>";
        });
      }
      html += "</div></div>";
    }

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    var btn = container.querySelector('[data-action="run-scrim"]');
    if (btn) btn.addEventListener("click", function () {
      var franchise = S.getFranchise();
      var gain = runScrim(franchise.teamId);
      if (gain == null) {
        alert("No scrims left this week — check back after Advance Week.");
        return;
      }
      var team = S.getTeam(franchise.teamId);
      alert("Scrim complete — chemistry +" + gain + " (now " + team.chemistry + "/100).");
      render();
      if (window.PHLApp) window.PHLApp.refresh();
    });
  }

  window.PHLScrims = {
    render: render,
    runScrim: runScrim,
    resetWeeklyUsage: resetWeeklyUsage,
    weeklyChemistryUpkeep: weeklyChemistryUpkeep,
  };
})();
