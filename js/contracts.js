/* PHL Franchise Simulator — contracts & salary cap management
 * Global namespace: window.PHLContracts
 *
 * Negotiation model: every player (rostered or free agent) has an Asking
 * Price computed from their Overall/Potential, how they've actually
 * performed this season, and the paying division's tier (see
 * U.contractAskingPrice). You choose a contract length (1-5 years) and an
 * offer amount; players almost always accept a fair-or-better offer, but
 * the further you lowball them the more likely they turn it down (see
 * U.contractRejectChance). A rejected offer changes nothing — try again
 * with better terms, or move on.
 *
 * Three negotiation modes, all sharing the machinery above:
 *  - "sign": a free agent joining the team fresh.
 *  - "resign": a player whose deal is down to its final year (or already
 *    expired) — negotiate a brand-new term that replaces it outright.
 *  - "extend": a player who ISN'T yet up for renewal (2+ years still on
 *    the books) — negotiate ADDITIONAL years on top of what's left, at a
 *    premium (see extensionPremiumFactor), capped at MAX_CONTRACT_YEARS
 *    total. This is the actual "lock them up early" lever.
 *
 * A No-Movement Clause is now something you negotiate INTO a deal (sign,
 * resign, or extend) rather than a free toggle — it costs a real premium
 * on top of asking price (see NMC_PREMIUM_FACTOR) and lasts exactly as
 * long as the contract it's part of. See effectiveAskingFor.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;
  var container = null;
  var selectedTeamId = null;
  // Transient negotiation UI state — which player's offer panel is open,
  // the length/amount currently dialed in, and whether a No-Movement
  // Clause is on the table. Reset whenever a panel closes or a deal
  // resolves (see resetOffer()).
  var offer = { playerId: null, years: 2, amount: 0, nmc: false };
  function resetOffer() {
    offer = { playerId: null, years: 2, amount: 0, nmc: false };
  }
  var faSearch = "";
  // Positional/column sorting for the Free Agents table — click a header to
  // sort by it, click again to flip direction. Mirrors the sortable-column
  // pattern already used for roster stats in js/teamManagement.js.
  var faSort = { key: "overall", dir: "desc" };
  var FA_COLS = [
    { key: "name", label: "Name" },
    { key: "position", label: "Pos" },
    { key: "overall", label: "OVR" },
    { key: "potential", label: "POT" },
    { key: "asking", label: "Asking Price" },
  ];

  function isEligible(player, divisionId) {
    if (!player.eligibleDivisions || !player.eligibleDivisions.length) return true;
    return player.eligibleDivisions.indexOf(divisionId) !== -1;
  }

  function askingPriceFor(player, team) {
    var division = S.getDivision(team.division);
    return U.contractAskingPrice(player, division ? division.tier : null);
  }

  // A No-Movement Clause costs a real premium — you're asking a player to
  // give up any say in being released, traded, or promoted away for the
  // life of the deal, and they want to be paid for that security.
  var NMC_PREMIUM_FACTOR = 1.15;

  // Contracts top out at 5 years total, same ceiling a fresh signing
  // already respects — an extension can only add up to whatever's left of
  // that ceiling on top of the player's CURRENT remaining term.
  var MAX_CONTRACT_YEARS = 5;
  function maxExtendYearsFor(p) {
    return Math.max(0, MAX_CONTRACT_YEARS - (p.contractYears || 0));
  }
  // Extending someone who isn't yet a free agent means buying out their
  // (and the market's) future leverage before either of you has to test
  // it — that costs extra, and the more years they'd already have played
  // out before hitting the market, the bigger that premium is.
  function extensionPremiumFactor(contractYearsRemaining) {
    return 1 + U.clamp((contractYearsRemaining || 0) * 0.03, 0, 0.15);
  }

  // The number actually driving reject-chance/lowball/counter-offer math —
  // base asking price, bumped for an early extension's premium and/or a
  // requested No-Movement Clause. askingPriceFor() above stays the honest,
  // un-bumped baseline shown everywhere else, so the user can always see
  // exactly what each premium is adding on top of plain market value.
  function effectiveAskingFor(p, team, mode, includeNmc) {
    var asking = askingPriceFor(p, team);
    if (mode === "extend") asking = Math.round(asking * extensionPremiumFactor(p.contractYears));
    if (includeNmc) asking = Math.round(asking * NMC_PREMIUM_FACTOR);
    return asking;
  }

  // Quick "how's this deal aging" read on a rostered player — not used for
  // any negotiation math, just a hint for deciding whether they're worth
  // locking up early (a team-friendly deal) or worth letting walk once
  // their contract is up (an overpaid one already eating more cap than
  // their current asking price justifies).
  function contractValueOutlook(p, asking) {
    if (!p.salary || !asking) return null;
    if (p.salary < asking * 0.85) return { label: "Team-Friendly", cls: "pill-clinch" };
    if (p.salary > asking * 1.15) return { label: "Overpaid", cls: "pill-warn" };
    return null;
  }

  function render(el) {
    container = el || container;
    if (!container) return;
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) {
      container.innerHTML = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div><p class="muted">Set up your franchise on the <a href="create-save.html">Create Save</a> page first — you can only manage contracts for the team you GM. (Want to browse another team\'s roster? See the Teams tab.)</p>';
      return;
    }
    selectedTeamId = franchise.teamId;
    var team = S.getTeam(selectedTeamId);
    if (!team) {
      container.innerHTML = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div><p class="muted">Your managed team couldn\'t be found.</p>';
      return;
    }
    var cap = S.capForTeam(selectedTeamId);
    var used = S.capUsed(selectedTeamId);
    var space = S.capSpace(selectedTeamId);
    var pct = U.clamp((used / cap) * 100, 0, 100);
    var roster = S.getRoster(selectedTeamId).slice().sort(function (a, b) { return b.overall - a.overall; });

    var html = '<div class="panel-header"><h2>Contracts &amp; Cap</h2></div>';
    html += '<p class="muted small">You can only manage contracts for the team you GM. Every other team signs, releases and re-signs on its own — and can never touch your roster. ' +
      'Asking price reflects Overall/Potential, this season\'s actual performance, and the division\'s pay scale. Offer below it and there\'s a real chance the player says no. ' +
      'A player with 2+ years left on their deal can be Extended early (added years on top of what\'s left, at a premium); one down to their final year can be Re-signed outright. ' +
      'A No-Movement Clause is now something you negotiate INTO a deal, not a free toggle — see the offer panel.</p>';

    html += '<div class="cap-summary-card" style="--accent:' + U.colorForId(team.id) + '">';
    html += '<div class="team-card-head">' + U.crestHtml(team) + '<span class="team-name">' + U.escapeHtml(team.name) +
      '</span><span class="pill">' + U.escapeHtml(S.getDivision(team.division).name) + " budget</span></div>";
    html += '<div class="cap-bar cap-bar-lg' + (space < 0 ? " cap-over" : "") + '"><div class="cap-bar-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="muted">Cap Used: ' + U.formatMoney(used) + " / " + U.formatMoney(cap) + " &middot; Space: " + U.formatMoney(space) + "</div>";
    if (space < 0) html += '<div class="warning-banner">Over the cap by ' + U.formatMoney(Math.abs(space)) + ". Release players to get compliant.</div>";
    if (!S.isTransactionWindowOpen()) html += '<div class="warning-banner">The trade deadline has passed — signings and releases are locked league-wide until the next off-season.</div>';
    html += "</div>";

    var nmcUsed = S.nmcCountForTeam(selectedTeamId);
    html += "<h3>Roster (" + roster.length + " / " + S.getSettings().rosterMax + ")</h3>";
    html += '<p class="muted small">No-Movement Clauses active: ' + nmcUsed + ' / ' + S.NMC_MAX_PER_TEAM + ' — negotiated into a deal at signing/extension time (see the offer panel), an NMC\'d player can\'t be released, traded, or promoted away for the rest of that contract.</p>';
    if (!roster.length) {
      html += '<p class="muted">No players on this roster yet.</p>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Archetype</th><th>OVR</th><th>POT</th><th>Salary</th><th>Years Left</th><th>Asking Price</th><th>NMC</th><th></th></tr></thead><tbody>';
      roster.forEach(function (p) {
        var asking = askingPriceFor(p, team);
        var outlook = contractValueOutlook(p, asking);
        var rowMode = p.contractYears <= 1 ? "resign" : "extend";
        var canAct = rowMode === "resign" || maxExtendYearsFor(p) >= 1;
        html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td><td>" + p.overall + "</td><td>" + p.potential + "</td><td>" + U.formatMoney(p.salary) + "</td>";
        html += "<td>" + (p.contractYears <= 1 ? '<span class="pill pill-warn">' + p.contractYears + " (expiring)</span>" : p.contractYears) + "</td>";
        html += "<td>" + U.formatMoney(asking) + (outlook ? ' <span class="pill ' + outlook.cls + ' small" title="Current salary vs. their true asking price">' + outlook.label + "</span>" : "") + "</td>";
        html += '<td>' + (p.nmc ? '<span class="pill pill-accent small" title="No-Movement Clause — locked for the life of this contract">NMC</span>' : '<span class="muted">—</span>') + '</td>';
        html += '<td class="row-actions">';
        if (canAct) {
          html += '<button class="btn btn-sm" data-action="toggle-offer" data-mode="' + rowMode + '" data-id="' + p.id + '">' + (rowMode === "resign" ? "Re-sign" : "Extend") + '</button>';
        } else {
          html += '<span class="pill small" title="Already at the 5-year contract-length ceiling — check back once their term is closer to expiring">Fully committed</span>';
        }
        html += '<button class="btn btn-sm btn-danger" data-action="release" data-id="' + p.id + '">Release</button></td></tr>';
        if (offer.playerId === p.id) html += offerRow(p, team, rowMode, 10);
      });
      html += "</tbody></table>";
    }

    var allFreeAgents = S.getFreeAgents();
    html += '<div class="panel-header"><h3>Free Agents (' + allFreeAgents.length + ')</h3>' +
      '<div class="header-actions"><input type="search" id="fa-search" class="fa-search-input" placeholder="Search free agents by name&hellip;" value="' + U.escapeHtml(faSearch) + '"></div></div>';
    html += '<div id="fa-table-wrap">' + renderFreeAgentsTable(team) + "</div>";

    container.innerHTML = html;
    wireEvents();
  }

  function freeAgentsMatchingSearch(team) {
    var freeAgents = S.getFreeAgents().slice();
    if (faSearch.trim()) {
      var q = faSearch.trim().toLowerCase();
      freeAgents = freeAgents.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
    }
    freeAgents.sort(function (a, b) {
      var av, bv;
      if (faSort.key === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (faSort.key === "position") { av = a.position; bv = b.position; }
      else if (faSort.key === "asking") { av = team ? askingPriceFor(a, team) : 0; bv = team ? askingPriceFor(b, team) : 0; }
      else { av = a[faSort.key] || 0; bv = b[faSort.key] || 0; }
      if (av < bv) return faSort.dir === "asc" ? -1 : 1;
      if (av > bv) return faSort.dir === "asc" ? 1 : -1;
      return a.name.localeCompare(b.name); // stable tie-break
    });
    return freeAgents;
  }

  function renderFreeAgentsTable(team) {
    var freeAgents = freeAgentsMatchingSearch(team);
    if (!freeAgents.length) {
      return '<p class="muted">' +
        (faSearch.trim() ? 'No free agents match "' + U.escapeHtml(faSearch.trim()) + '".' :
          "No free agents available. Release players or wait for the next breakout rookie class to populate the pool.") +
        "</p>";
    }
    var html = '<table class="data-table"><thead><tr>';
    FA_COLS.forEach(function (c) {
      var active = faSort.key === c.key;
      html += '<th class="stats-sortable' + (active ? " stats-sort-active" : "") + '" data-action="sort-fa" data-key="' + c.key + '">' +
        c.label + (active ? (faSort.dir === "asc" ? " &#9650;" : " &#9660;") : "") + "</th>";
    });
    html += '<th>Archetype</th><th></th></tr></thead><tbody>';
    freeAgents.forEach(function (p) {
      var eligible = isEligible(p, team.division);
      var asking = askingPriceFor(p, team);
      html += "<tr><td>" + U.escapeHtml(p.name) + "</td><td>" + p.position + "</td><td>" + p.overall + "</td><td>" + p.potential + "</td><td>" + U.formatMoney(asking) + "</td><td>" + U.escapeHtml(p.archetype || "") + "</td>";
      if (eligible) {
        html += '<td><button class="btn btn-sm btn-primary" data-action="toggle-offer" data-mode="sign" data-id="' + p.id + '">Sign</button></td></tr>';
      } else {
        html += '<td><span class="pill pill-warn" title="Breakout rookies cannot jump straight to this division">Not eligible here</span></td></tr>';
      }
      if (offer.playerId === p.id) html += offerRow(p, team, "sign", 7);
    });
    html += "</tbody></table>";
    return html;
  }

  // Re-wires just the buttons inside a freshly-replaced Free Agents table
  // wrap (see the search input's "input" handler in wireEvents, which only
  // swaps #fa-table-wrap's innerHTML rather than calling the full render()
  // — doing a full re-render on every keystroke would tear down and
  // recreate the search input itself, kicking focus out of it mid-type).
  function wireFreeAgentTableEvents(wrap, team) {
    wrap.querySelectorAll('[data-action="toggle-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        if (offer.playerId === p.id) {
          resetOffer();
        } else {
          offer = { playerId: p.id, years: 2, amount: effectiveAskingFor(p, team, "sign", false), nmc: false };
        }
        render();
      });
    });
    wrap.querySelectorAll('[data-action="send-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        sendOffer(b.dataset.id, b.dataset.mode);
      });
    });
    wrap.querySelectorAll('[data-action="sort-fa"]').forEach(function (b) {
      b.addEventListener("click", function () {
        if (faSort.key === b.dataset.key) {
          faSort.dir = faSort.dir === "asc" ? "desc" : "asc";
        } else {
          faSort.key = b.dataset.key;
          faSort.dir = b.dataset.key === "name" || b.dataset.key === "position" ? "asc" : "desc";
        }
        render();
      });
    });
  }

  // Inline negotiation panel rendered directly under a player's row.
  function offerRow(p, team, mode, colspan) {
    var baseAsking = askingPriceFor(p, team);
    var maxExtend = mode === "extend" ? Math.max(1, maxExtendYearsFor(p)) : 5;
    if (offer.nmc == null) offer.nmc = false;
    if (mode === "extend" && offer.years > maxExtend) offer.years = maxExtend;
    var nmcAvailable = !!p.nmc || S.nmcCountForTeam(selectedTeamId) < S.NMC_MAX_PER_TEAM;
    if (offer.nmc && !nmcAvailable) offer.nmc = false; // e.g. another NMC got negotiated elsewhere while this panel was open
    var asking = effectiveAskingFor(p, team, mode, offer.nmc);
    if (offer.amount == null || !offer.amount) offer.amount = asking;
    var rejectChance = U.contractRejectChance(asking, offer.amount, offer.years);
    var riskLabel = rejectChance >= 0.5 ? "pill-warn" : rejectChance >= 0.2 ? "" : "pill-clinch";
    var html = '<tr class="offer-row"><td colspan="' + (colspan || 9) + '"><div class="offer-panel">';
    var titleVerb = mode === "sign" ? "Offer a contract to " : mode === "extend" ? "Extend " : "Re-sign ";
    html += '<div class="offer-panel-title">' + titleVerb + U.escapeHtml(p.name) +
      (mode === "extend" ? ' <span class="muted small">(' + p.contractYears + " yr" + (p.contractYears === 1 ? "" : "s") + " left on their current deal)</span>" : "") +
      "</div>";
    html += '<div class="offer-panel-grid">';
    html += "<label>" + (mode === "extend" ? "Extra Years" : "Years") + '<select id="offer-years">';
    for (var y = 1; y <= maxExtend; y++) {
      html += '<option value="' + y + '"' + (offer.years === y ? " selected" : "") + ">" + y + " yr" + (y > 1 ? "s" : "") + "</option>";
    }
    html += "</select></label>";
    html += '<label>Offer Salary<input type="number" id="offer-amount" step="500" min="' + U.SALARY_MIN + '" value="' + offer.amount + '"></label>';
    html += "</div>";
    if (mode === "extend") {
      html += '<p class="muted small">Locking in ' + offer.years + " extra year" + (offer.years > 1 ? "s" : "") + " now — before " + U.escapeHtml(p.name) +
        " ever hits free agency — would run " + (p.contractYears + offer.years) + " total years from today, but costs an early-extension premium: " +
        U.formatMoney(Math.round(baseAsking * extensionPremiumFactor(p.contractYears))) + " vs. " + U.formatMoney(baseAsking) + " at plain market value.</p>";
    }
    html += '<label class="offer-nmc-row"><input type="checkbox" id="offer-nmc"' + (offer.nmc ? " checked" : "") + (nmcAvailable ? "" : " disabled") + '> ' +
      "Include a No-Movement Clause " +
      '<span class="muted small">(+' + Math.round((NMC_PREMIUM_FACTOR - 1) * 100) + "% asking — can't be released, traded, or promoted away for the life of this deal)</span></label>";
    if (!nmcAvailable) html += '<p class="muted small">You\'re already carrying ' + S.NMC_MAX_PER_TEAM + " No-Movement Clauses — one has to expire or its player has to leave before you can negotiate another.</p>";
    html += '<div class="offer-panel-info"><span class="muted small">Asking' + (mode === "extend" || offer.nmc ? " (with the above)" : "") + ": " + U.formatMoney(asking) + '</span>' +
      '<span class="pill ' + riskLabel + ' small">Reject risk: ' + Math.round(rejectChance * 100) + '%</span></div>';
    html += '<div class="form-actions">';
    html += '<button class="btn btn-primary btn-sm" data-action="send-offer" data-mode="' + mode + '" data-id="' + p.id + '">Send Offer</button>';
    html += '<button class="btn btn-sm" data-action="cancel-offer">Cancel</button>';
    html += "</div></div></td></tr>";
    return html;
  }

  function wireEvents() {
    container.querySelectorAll('[data-action="release"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        if (!S.isTransactionWindowOpen()) {
          alert("The trade deadline has passed — releases are locked league-wide until the next off-season.");
          return;
        }
        if (p.nmc) {
          alert(p.name + " has a No-Movement Clause and can't be released — it runs for the life of their current contract. Wait it out, or trade/promote once it expires.");
          return;
        }
        if (!S.wouldMeetRosterMinimum(selectedTeamId, [p.id])) {
          alert("Can't release " + p.name + " — every team must carry at least " + S.ROSTER_MIN.total + " players with a legal " +
            S.ROSTER_MIN.F + "F/" + S.ROSTER_MIN.D + "D/" + S.ROSTER_MIN.G + "G lineup, and releasing them would drop you below it.");
          return;
        }
        if (confirm('Release "' + p.name + '" to free agency?')) {
          S.addRelease({ teamId: selectedTeamId, playerId: p.id, playerName: p.name, reason: "manual" });
          S.updatePlayer(p.id, { teamId: null });
          render();
          if (window.PHLApp) window.PHLApp.refresh();
        }
      });
    });
    container.querySelectorAll('[data-action="toggle-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getPlayer(b.dataset.id);
        if (!p) return;
        if (offer.playerId === p.id) {
          resetOffer();
        } else {
          var team = S.getTeam(selectedTeamId);
          var mode = b.dataset.mode;
          var years, nmc;
          if (mode === "resign") {
            years = Math.max(1, Math.min(5, (p.contractYears || 2)));
            nmc = !!p.nmc; // default to "keep what they already have" — an explicit uncheck drops it
          } else if (mode === "extend") {
            years = Math.max(1, Math.min(2, maxExtendYearsFor(p)));
            nmc = !!p.nmc;
          } else {
            years = 2;
            nmc = false;
          }
          offer = { playerId: p.id, years: years, amount: effectiveAskingFor(p, team, mode, nmc), nmc: nmc };
        }
        render();
      });
    });
    var cancelBtn = container.querySelector('[data-action="cancel-offer"]');
    if (cancelBtn) cancelBtn.addEventListener("click", function () {
      resetOffer();
      render();
    });
    var yearsSel = container.querySelector("#offer-years");
    if (yearsSel) yearsSel.addEventListener("change", function (e) {
      offer.years = parseInt(e.target.value, 10) || 2;
      render();
    });
    var amountInput = container.querySelector("#offer-amount");
    if (amountInput) amountInput.addEventListener("change", function (e) {
      offer.amount = Math.max(U.SALARY_MIN, parseInt(e.target.value, 10) || U.SALARY_MIN);
      render();
    });
    var nmcCheckbox = container.querySelector("#offer-nmc");
    if (nmcCheckbox) nmcCheckbox.addEventListener("change", function (e) {
      offer.nmc = !!e.target.checked;
      render();
    });
    container.querySelectorAll('[data-action="send-offer"]').forEach(function (b) {
      b.addEventListener("click", function () {
        sendOffer(b.dataset.id, b.dataset.mode);
      });
    });
    container.querySelectorAll('[data-action="sort-fa"]').forEach(function (b) {
      b.addEventListener("click", function () {
        if (faSort.key === b.dataset.key) {
          faSort.dir = faSort.dir === "asc" ? "desc" : "asc";
        } else {
          faSort.key = b.dataset.key;
          faSort.dir = b.dataset.key === "name" || b.dataset.key === "position" ? "asc" : "desc";
        }
        render();
      });
    });
    var faSearchInput = container.querySelector("#fa-search");
    if (faSearchInput) {
      faSearchInput.addEventListener("input", function (e) {
        faSearch = e.target.value;
        var team = S.getTeam(selectedTeamId);
        var wrap = container.querySelector("#fa-table-wrap");
        if (!wrap || !team) return;
        wrap.innerHTML = renderFreeAgentsTable(team);
        wireFreeAgentTableEvents(wrap, team);
      });
    }
  }

  function sendOffer(playerId, mode) {
    var p = S.getPlayer(playerId);
    var team = S.getTeam(selectedTeamId);
    if (!p || !team) return;
    if (!S.isTransactionWindowOpen()) {
      alert("The trade deadline has passed — signings are locked league-wide until the next off-season.");
      return;
    }
    if (mode === "sign" && !S.meetsOverallCap(p.overall, team.division)) {
      alert(p.name + " (" + p.overall + " OVR) is above the " + S.getDivision(team.division).name + " division's " +
        S.overallCapForDivision(team.division) + " overall cutoff and can't be signed here.");
      return;
    }
    if (mode === "sign" && !S.meetsOverallFloor(p.overall, team.division)) {
      alert(p.name + " (" + p.overall + " OVR) is below the " + S.getDivision(team.division).name + " division's " +
        S.overallFloorForDivision(team.division) + " overall floor and can't be signed here.");
      return;
    }
    var offersThisSeason = S.contractOffersThisSeason(p.id);
    if (offersThisSeason.length >= 3) {
      alert("You've already made 3 contract offers to " + p.name + " this season — that's the maximum allowed.");
      return;
    }
    if (offersThisSeason.some(function (o) { return o.amount === offer.amount; })) {
      alert("Your offer amount must be different from an offer you've already made " + p.name + " this season. Try a different salary.");
      return;
    }
    if (mode === "sign" && !isEligible(p, team.division)) {
      alert(p.name + " is a breakout rookie not yet eligible to sign with a " + S.getDivision(team.division).name + " team.");
      return;
    }
    var roster = S.getRoster(selectedTeamId);
    if (mode === "sign" && roster.length >= S.getSettings().rosterMax) {
      alert("Roster is full (" + S.getSettings().rosterMax + " players). Release someone first.");
      return;
    }
    if (mode === "sign" && p.position === "G" && !S.wouldMeetGoalieMax(selectedTeamId, [], [p])) {
      alert("You already carry " + S.GOALIE_MAX + " goalies — the most a team can hold. Release one first.");
      return;
    }
    // A No-Movement Clause is now negotiated INTO a deal, not toggled for
    // free afterward — so it has to clear the same per-team cap right here,
    // before anything else about this offer gets committed. Re-checked
    // again in finalizeContract() since a counter-offer round happens
    // asynchronously and someone else's negotiation could close a slot in
    // between (extremely unlikely for a single-player game, but cheap to
    // guard anyway).
    if (offer.nmc && !p.nmc && S.nmcCountForTeam(selectedTeamId) >= S.NMC_MAX_PER_TEAM) {
      alert("You're already carrying " + S.NMC_MAX_PER_TEAM + " No-Movement Clauses — drop the checkbox on this offer, or wait for one of the others to expire.");
      return;
    }
    var space = S.capSpace(selectedTeamId);
    var currentSalary = (mode === "resign" || mode === "extend") ? p.salary : 0;
    var spaceAfterRelease = space + currentSalary; // re-signing/extending frees up their old cap hit first
    if (offer.amount > spaceAfterRelease) {
      alert("Not enough cap space for that offer (needs " + U.formatMoney(offer.amount) + ", have " + U.formatMoney(spaceAfterRelease) + ").");
      return;
    }
    // The number this offer is actually judged against — plain asking
    // price bumped for an early extension's premium and/or a requested
    // No-Movement Clause (see effectiveAskingFor). askingPriceFor() alone
    // stays the honest baseline shown in the roster/free-agent tables.
    var asking = effectiveAskingFor(p, team, mode, offer.nmc);
    // Every offer counts toward the 3-per-season limit, and its amount is
    // remembered so a later fresh offer this season must differ. One record
    // covers the whole negotiation below, including any counter-offer round
    // — those aren't a separate "offer" from the player's point of view.
    S.recordContractOffer(p.id, offer.amount);

    var lowballFloor = asking * 0.6;
    if (offer.amount < lowballFloor) {
      // Too far under asking to even negotiate — flat reject, no counter.
      alert(p.name + " turned down your offer outright (" + U.formatMoney(offer.amount) + " over " + offer.years + " yr" +
        (offer.years > 1 ? "s" : "") + ", asking " + U.formatMoney(asking) + "). That's too far under asking price to negotiate — try a much stronger offer.");
      resetOffer();
      render();
      return;
    }
    if (offer.amount < asking) {
      // Negotiation zone (60%-100% of asking): the AI always counters
      // instead of rolling a flat reject chance — see the forced
      // js/negotiationModal.js pop-up this triggers.
      var counterAmount = Math.round(offer.amount + (asking - offer.amount) * (0.55 + Math.random() * 0.25));
      openContractCounter(p, team, mode, asking, offer.amount, offer.years, counterAmount, offer.nmc);
      return;
    }

    // At or above asking price: same small flat-reject chance as before.
    var rejectChance = U.contractRejectChance(asking, offer.amount, offer.years);
    var rejected = Math.random() < rejectChance;
    if (rejected) {
      alert(p.name + " turned down your offer (" + U.formatMoney(offer.amount) + " over " + offer.years + " yr" + (offer.years > 1 ? "s" : "") +
        ", asking " + U.formatMoney(asking) + "). Try sweetening the deal.");
      resetOffer();
      render();
      return;
    }
    finalizeContract(p, team, mode, offer.amount, offer.years, offer.nmc);
  }

  // Applies an agreed-upon contract, whether reached directly or after a
  // counter-offer round — the one place that actually signs/re-signs/
  // extends the player. Re-checks cap space against the FINAL amount,
  // since a counter-offer round can land on a higher number than what
  // originally passed the cap check in sendOffer() — and re-checks the NMC
  // cap for the same reason (see the note in sendOffer()).
  function finalizeContract(p, team, mode, amount, years, nmc) {
    var space = S.capSpace(selectedTeamId) + ((mode === "resign" || mode === "extend") ? (p.salary || 0) : 0);
    if (amount > space) {
      alert("Not enough cap space to close that deal (needs " + U.formatMoney(amount) + ", have " + U.formatMoney(space) + "). The offer falls through.");
      resetOffer();
      render();
      return;
    }
    if (nmc && !p.nmc && S.nmcCountForTeam(selectedTeamId) >= S.NMC_MAX_PER_TEAM) {
      alert(p.name + " agreed to terms, but you're already carrying " + S.NMC_MAX_PER_TEAM + " No-Movement Clauses — the deal falls through. Negotiate again without the No-Movement Clause, or free up a slot first.");
      resetOffer();
      render();
      return;
    }
    var patch = { salary: amount, nmc: !!nmc };
    patch.contractYears = mode === "extend" ? (p.contractYears || 0) + years : years;
    if (mode === "sign") {
      patch.teamId = selectedTeamId;
      patch.eligibleDivisions = null; // once signed, a breakout rookie's division restriction is lifted permanently
    }
    S.updatePlayer(p.id, patch);
    S.addSigning({ teamId: selectedTeamId, playerId: p.id, playerName: p.name, mode: mode, salary: patch.salary, years: patch.contractYears, nmc: patch.nmc });
    resetOffer();
    var summary = mode === "extend" ?
      p.name + " agreed to a " + years + "-year extension at " + U.formatMoney(amount) + " (" + patch.contractYears + " total years remaining)" :
      p.name + " agreed to " + U.formatMoney(amount) + " over " + years + " yr" + (years > 1 ? "s" : "");
    alert(summary + (patch.nmc ? ", including a No-Movement Clause" : "") + "!");
    render();
    if (window.PHLApp) window.PHLApp.refresh();
  }

  // Opens the forced counter-offer modal (js/negotiationModal.js) and wires
  // up the three choices the user has: counter back with a new number,
  // resubmit the original offer as a final take-it-or-leave-it, or drop the
  // offer entirely.
  function openContractCounter(p, team, mode, asking, originalOffer, years, counterAmount, nmc) {
    window.PHLNegotiationModal.showContractCounter({
      playerName: p.name,
      asking: asking,
      originalOffer: originalOffer,
      counterOffer: counterAmount,
      years: years,
      nmc: nmc,
      onCounterBack: function (finalAmount) {
        resolveContractRound2(p, team, mode, counterAmount, finalAmount, years, nmc);
      },
      onKeepOriginal: function () {
        resolveContractRound2(p, team, mode, counterAmount, originalOffer, years, nmc);
      },
      onDrop: function () {
        resetOffer();
        render();
      },
    });
  }

  // Bounded round-2 resolution: meet or beat the AI's counter and the deal
  // is automatically done; come in under it and it's one final reject-chance
  // roll (using the counter amount as the new reference asking price) — no
  // further rounds after this either way.
  function resolveContractRound2(p, team, mode, counterAmount, finalAmount, years, nmc) {
    if (finalAmount >= counterAmount) {
      finalizeContract(p, team, mode, finalAmount, years, nmc);
      return;
    }
    var rejectChance = U.contractRejectChance(counterAmount, finalAmount, years);
    var rejected = Math.random() < rejectChance;
    if (rejected) {
      alert(p.name + " turned down your final offer (" + U.formatMoney(finalAmount) + " over " + years + " yr" + (years > 1 ? "s" : "") +
        ", they'd countered at " + U.formatMoney(counterAmount) + "). Negotiations end here for now.");
      resetOffer();
      render();
      return;
    }
    finalizeContract(p, team, mode, finalAmount, years, nmc);
  }

  window.PHLContracts = { render: render, askingPriceFor: askingPriceFor };
})();
