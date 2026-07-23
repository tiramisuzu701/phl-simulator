/* PHL Franchise Simulator — shared utilities
 * Global namespace: window.PHLUtil
 */
(function () {
  "use strict";

  // ---- Categorical palette (validated, see dataviz reference) --------
  // Brightened for the dark "glow" theme (css/style.css) — these are the
  // same hues as that file's --series-* tokens, kept in sync so a team's
  // inline --accent (set from colorForId below) reads consistently with
  // the rest of the UI.
  var CATEGORICAL = [
    "#3987e5", // blue
    "#ff8a4c", // orange
    "#22c99a", // aqua
    "#f0b429", // yellow
    "#ef7fb0", // magenta
    "#3fbf3f", // green
    "#9f8ff0", // violet
    "#ef6360", // red
  ];

  var STATUS = {
    good: "#2fce6a",
    warning: "#f0b429",
    serious: "#ff8a63",
    critical: "#ff5c6c",
  };

  function colorForIndex(i) {
    return CATEGORICAL[i % CATEGORICAL.length];
  }

  // Simple deterministic string hash -> stable color per id (team badges etc.)
  function colorForId(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) {
      h = (h * 31 + id.charCodeAt(i)) >>> 0;
    }
    return colorForIndex(h);
  }

  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function randInt(min, max) {
    // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  // Weighted pick: items = [{item, weight}]
  function weightedPick(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += Math.max(0, items[i].weight);
    if (total <= 0) return items.length ? items[0].item : null;
    var r = Math.random() * total;
    for (var j = 0; j < items.length; j++) {
      r -= Math.max(0, items[j].weight);
      if (r <= 0) return items[j].item;
    }
    return items[items.length - 1].item;
  }

  // Knuth Poisson sampler, clamped to keep hockey scores sane (0-12)
  function poisson(lambda) {
    lambda = clamp(lambda, 0.05, 8);
    var L = Math.exp(-lambda);
    var k = 0;
    var p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return clamp(k - 1, 0, 12);
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }
  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  function avg(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function downloadJSON(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // ---- Team crests (real PHL logos, hotlinked from phlstats.com) --------
  // Renders an <img> for team.logoUrl with a graceful fallback to a plain
  // colored abbreviation badge (via CSS, triggered by the onerror handler
  // below) for teams with no logo on file yet — e.g. a brand-new Expansion
  // Franchise, or a plain "+ Add Team" league-builder team. sizeClass is
  // one of "crest-sm" (tables/bracket), "" (default, card badges), or
  // "crest-lg" (sidebar/team-detail header) — see css/style.css.
  function crestHtml(team, sizeClass) {
    if (!team) return "";
    var color = team.customColor || colorForId(team.id);
    var abbr = escapeHtml(team.abbr || "?");
    var classes = "team-crest " + (sizeClass || "");
    if (team.logoUrl) {
      return (
        '<span class="' + classes + '" style="--accent:' + color + '" data-abbr="' + abbr + '" title="' + abbr + '">' +
        '<img src="' + escapeHtml(team.logoUrl) + '" alt="' + abbr + ' logo" loading="lazy" ' +
        'onerror="this.parentElement.classList.add(\'crest-fallback\')">' +
        "</span>"
      );
    }
    return '<span class="' + classes + ' team-crest-plain" style="--accent:' + color + '" title="' + abbr + '">' + abbr + "</span>";
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- Fictional name pools (for sample rosters / draft prospects) ----
  var FIRST_NAMES = [
    "Jax", "Milo", "Rhys", "Dash", "Kai", "Remy", "Theo", "Ezra", "Finn",
    "Gus", "Otto", "Leo", "Max", "Nico", "Silas", "Wyatt", "Beau", "Cole",
    "Reid", "Asher", "Bodie", "Cassius", "Dane", "Emmett", "Flynn", "Gray",
    "Hollis", "Ira", "Jett", "Knox", "Lars", "Moss", "Nash", "Orion",
    "Percy", "Quill", "Roan", "Sten", "Tate", "Uri", "Vance", "West",
    "Yuri", "Zane", "Arlo", "Briar", "Colt", "Deacon", "Ellis", "Frost",
  ];
  var LAST_NAMES = [
    "Halloway", "Sterling", "Vasko", "Crane", "Brandt", "Kowalski", "Rourke",
    "Marsh", "Doyle", "Fenwick", "Larkspur", "Odom", "Prentiss", "Quill",
    "Rask", "Sabo", "Tomlin", "Ulrich", "Voss", "Wren", "Yates", "Zeller",
    "Ashford", "Blackwood", "Cordero", "Delgado", "Ekholm", "Farrow",
    "Gunnarsson", "Hollis", "Ivanov", "Jorgensen", "Kettering", "Lindqvist",
    "Moreau", "Novak", "Osei", "Petrov", "Quintero", "Rivard", "Salinger",
    "Thibault", "Underwood", "Valdez", "Whitlock", "Xu", "Yamada", "Zimmer",
  ];

  function randomName() {
    return pick(FIRST_NAMES) + " " + pick(LAST_NAMES);
  }

  // ---- Esports gamertags (for procedurally-generated rookies/prospects) --
  // The real baked-in PHL roster (starterData.js) keeps real names — this
  // pool is only for players the sim invents on its own (breakout rookie
  // classes, sample rosters), so they read like actual Puck player handles
  // rather than real-world names.
  var GAMERTAG_PREFIX = [
    "Neo", "Void", "Ghost", "Blitz", "Nova", "Zero", "Cyber", "Rogue",
    "Frost", "Toxic", "Shadow", "Static", "Crimson", "Obsidian", "Quantum",
    "Phantom", "Feral", "Glitch", "Savage", "Arctic", "Radiant", "Vortex",
    "Apex", "Turbo", "Sly", "Grim", "Iron", "Solar", "Lunar", "Venom",
    "Cryo", "Hex", "Nitro", "Onyx", "Pixel", "Vapor", "Wired", "Ashen",
    "Dusk", "Ember", "Fable", "Glacial", "Hollow", "Juno", "Karma",
    "Lucid", "Molten", "Night", "Omega", "Pulse", "Rift", "Steel",
  ];
  var GAMERTAG_SUFFIX = [
    "Wolf", "Hawk", "Reaper", "Fox", "Viper", "Phoenix", "Blade", "Storm",
    "Ronin", "Ninja", "Specter", "Falcon", "Panther", "Cobra", "Dagger",
    "Havoc", "Nomad", "Wraith", "Yeti", "Comet", "Bandit", "Rocket",
    "Pulse", "Drift", "Fang", "Crash", "Bolt", "Talon", "Reaver", "Scope",
    "Vandal", "Jinx", "Menace", "Byte", "Circuit", "Dagger", "Echo",
    "Flux", "Gambit", "Hex", "Ion", "Jolt", "Kernel", "Lynx", "Mirage",
    "Nexus", "Orbit", "Prowl", "Quake", "Reflex",
  ];

  function randomGamertag() {
    var prefix = pick(GAMERTAG_PREFIX);
    var suffix = pick(GAMERTAG_SUFFIX);
    // Avoid an accidental doubled word (a handful of words appear in both
    // lists), which would otherwise produce something like "HexHex".
    while (suffix === prefix) suffix = pick(GAMERTAG_SUFFIX);
    var base = prefix + suffix;
    var roll = Math.random();
    if (roll < 0.35) {
      base += String(randInt(1, 99));
    } else if (roll < 0.48) {
      base = "xX" + base + "Xx";
    }
    return base;
  }

  // ---- Archetypes (playstyle) ----------------------------------------
  // Each archetype nudges the hidden offense/defense/goaltending attributes
  // that actually drive the simulation, so picking one has a real effect
  // in-game even though the underlying numbers stay out of the UI.
  var ARCHETYPES = {
    F: [
      { name: "Goal Scorer", bias: { offense: 9, defense: -7 } },
      { name: "Playmaker", bias: { offense: 6, defense: -3 } },
      { name: "Two-Way Forward", bias: { offense: 1, defense: 3 } },
      { name: "Power Forward", bias: { offense: -3, defense: 6 } },
    ],
    D: [
      { name: "Offensive Defenseman", bias: { offense: 8, defense: -6 } },
      { name: "Two-Way Defenseman", bias: { offense: 1, defense: 2 } },
      { name: "Stalwart Defender", bias: { offense: -6, defense: 8 } },
    ],
    G: [
      { name: "The Wall", bias: { goaltending: 6, offense: -4 } },
      { name: "Hybrid", bias: { goaltending: 2, offense: 2 } },
      { name: "Puck-Handler", bias: { goaltending: -2, offense: 7 } },
    ],
  };

  function archetypesFor(position) {
    return ARCHETYPES[position] || ARCHETYPES.F;
  }

  function randomArchetype(position) {
    return pick(archetypesFor(position)).name;
  }

  function archetypeBias(position, archetypeName) {
    var list = archetypesFor(position);
    var found = list.find(function (a) {
      return a.name === archetypeName;
    });
    return found ? found.bias : {};
  }

  // Derive the hidden sim-engine attributes (offense/defense/goaltending)
  // from the visible fields (overall, position, archetype). Small random
  // noise keeps two players with identical overall/archetype from playing
  // as exact statistical clones.
  function deriveAttributes(overall, position, archetypeName) {
    var bias = archetypeBias(position, archetypeName);
    var noise = function () {
      return randInt(-3, 3);
    };
    var offense = clamp(overall + (bias.offense || 0) + noise(), 40, 99);
    var defense = clamp(overall + (bias.defense || 0) + noise(), 40, 99);
    var goaltending =
      position === "G" ? clamp(overall + (bias.goaltending || 0) + noise(), 40, 99) : 40;
    return { offense: offense, defense: defense, goaltending: goaltending };
  }

  // ---- Contracts (real-dollar asking price / salary) ------------------
  // Baseline reflects a modest esports salary; top-overall + high-potential
  // stars command up to the league max. Blends current ability (70%) with
  // upside (30%) since potential drives real-world asking prices too.
  var SALARY_MIN = 20000;
  var SALARY_MAX = 400000;

  function salaryAsking(overall, potential) {
    potential = potential == null ? overall : potential;
    var blended = overall * 0.7 + potential * 0.3;
    var norm = clamp((blended - 40) / (99 - 40), 0, 1);
    var curved = Math.pow(norm, 1.6);
    var salary = SALARY_MIN + curved * (SALARY_MAX - SALARY_MIN);
    return Math.round(salary / 500) * 500; // round to nearest $500
  }

  function formatMoney(n) {
    if (n == null) return "—";
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  // ---- Performance-aware contract pricing -----------------------------
  // How a player's ACTUAL play this season (not just their static
  // Overall/Potential) nudges their asking price up or down. Needs at
  // least a handful of games to matter — small samples fall back to the
  // Overall/Potential baseline (factor 1).
  function performanceFactor(player) {
    var stats = player.stats;
    if (!stats || !stats.gp || stats.gp < 3) return 1;
    var overall = player.overall || 60;
    if (player.position === "G") {
      var expectedSv = 0.85 + clamp((overall - 40) / 59, 0, 1) * 0.09;
      var diff = (stats.svPct || 0) - expectedSv;
      return clamp(1 + diff * 6, 0.7, 1.4);
    }
    var ppg = stats.pts / stats.gp;
    var expectedPpg = 0.15 + clamp((overall - 40) / 59, 0, 1) * 1.1;
    var ratio = ppg / Math.max(expectedPpg, 0.05);
    var factor = 1 + (ratio - 1) * 0.5;
    factor += clamp((stats.plusMinus || 0) / stats.gp, -1, 1) * 0.03;
    return clamp(factor, 0.7, 1.4);
  }

  // Higher-tier divisions command bigger price tags for the same
  // Overall/Potential/performance — mirrors the bigger per-division salary
  // caps (see starterData.js). Tier 1 (Prospect) ~0.85x, tier 3 (Pro) ~1.09x.
  function divisionTierFactor(tier) {
    if (tier == null) return 1;
    return clamp(0.85 + 0.12 * (tier - 1), 0.7, 1.5);
  }

  // Stable (non-random-per-render) hash of a string into [0, 1), used below
  // to give each player a fixed "negotiating personality" instead of their
  // asking price flickering every re-render.
  function hashUnit(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return (Math.abs(h) % 10000) / 10000;
  }

  // Most players ask close to their "true" computed value, but a real
  // negotiation has outliers — some players lowball themselves for
  // security, others swing for the fences. ~12% chance a player
  // undersells themselves (0.62-0.85x), ~12% oversells (1.15-1.50x), and
  // the rest fall in a mild 0.92-1.08x band. Deterministic per player.
  function askingQuirkFactor(player) {
    var u = hashUnit(String(player.id) + ":quirk");
    if (u < 0.12) return 0.62 + hashUnit(String(player.id) + ":quirk2") * 0.23;
    if (u < 0.24) return 1.15 + hashUnit(String(player.id) + ":quirk3") * 0.35;
    return 0.92 + hashUnit(String(player.id) + ":quirk4") * 0.16;
  }

  // A player's asking price to re-sign (or to sign as a free agent): the
  // Overall/Potential baseline, adjusted for how they've actually performed
  // this season, which division's paying, and the player's own fixed
  // negotiating quirk (see askingQuirkFactor — some players under/oversell
  // themselves). Allowed to run a bit above the normal salary ceiling for a
  // bona fide breakout performance or a confident overselling outlier.
  function contractAskingPrice(player, divisionTier) {
    var base = salaryAsking(player.overall, player.potential);
    var price = base * performanceFactor(player) * divisionTierFactor(divisionTier) * askingQuirkFactor(player);
    price = clamp(price, SALARY_MIN, SALARY_MAX * 1.8);
    return Math.round(price / 500) * 500;
  }

  // Chance (0-1) a player turns down a contract offer. Offers at/above
  // asking price are almost always accepted; offers below it get riskier
  // the further short they fall. Contract length nudges it further: a long
  // deal at a discount reads as an insult (more likely rejected), while a
  // long deal at a fair-or-better price reads as security (slightly more
  // likely accepted).
  function contractRejectChance(askingPrice, offerSalary, years) {
    var chance;
    if (offerSalary >= askingPrice) {
      var over = (askingPrice > 0) ? (offerSalary - askingPrice) / askingPrice : 0;
      chance = clamp(0.06 - over * 0.15, 0.01, 0.06);
      chance -= (years - 3) * 0.015;
    } else {
      var shortfall = (askingPrice > 0) ? (askingPrice - offerSalary) / askingPrice : 1;
      chance = clamp(0.08 + shortfall * 1.1, 0.08, 0.92);
      chance += (years - 3) * 0.03;
    }
    return clamp(chance, 0.01, 0.95);
  }

  // ---- Hidden age / decline / retirement ------------------------------
  // Ages are never shown in the UI (PHL only requires players to confirm
  // they're 16+); they exist purely to drive a quiet skill curve.
  function generateStartingAge() {
    // Skews younger league-wide: mostly 16-21 with a shorter tail up to
    // late-20s veterans (was 18-33 — pulled the whole curve down so a
    // fresh league feels like a young circuit, not a retirement home).
    var roll = Math.random();
    if (roll < 0.6) return randInt(16, 20);
    if (roll < 0.9) return randInt(21, 24);
    return randInt(25, 27);
  }

  function generateRookieAge() {
    return randInt(16, 18);
  }

  // Randomized per-player, but always anchored to THEIR starting age so a
  // full career is guaranteed no matter when someone enters the league —
  // every player gets at least 7 (up to 12) more seasons before their
  // hidden retirement age hits, so the very first retirement across a
  // fresh save reliably lands around Season 7, never sooner.
  function retirementAgeFor(startingAge) {
    var base = startingAge != null ? startingAge : generateStartingAge();
    return base + randInt(7, 12);
  }

  window.PHLUtil = {
    CATEGORICAL: CATEGORICAL,
    STATUS: STATUS,
    colorForIndex: colorForIndex,
    colorForId: colorForId,
    uid: uid,
    clamp: clamp,
    randInt: randInt,
    pick: pick,
    weightedPick: weightedPick,
    poisson: poisson,
    round1: round1,
    round3: round3,
    avg: avg,
    downloadJSON: downloadJSON,
    escapeHtml: escapeHtml,
    crestHtml: crestHtml,
    randomName: randomName,
    randomGamertag: randomGamertag,
    ARCHETYPES: ARCHETYPES,
    archetypesFor: archetypesFor,
    randomArchetype: randomArchetype,
    archetypeBias: archetypeBias,
    deriveAttributes: deriveAttributes,
    salaryAsking: salaryAsking,
    formatMoney: formatMoney,
    performanceFactor: performanceFactor,
    divisionTierFactor: divisionTierFactor,
    contractAskingPrice: contractAskingPrice,
    contractRejectChance: contractRejectChance,
    SALARY_MIN: SALARY_MIN,
    SALARY_MAX: SALARY_MAX,
    generateStartingAge: generateStartingAge,
    generateRookieAge: generateRookieAge,
    retirementAgeFor: retirementAgeFor,
  };
})();
