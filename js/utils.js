/* PHL Franchise Simulator — shared utilities
 * Global namespace: window.PHLUtil
 */
(function () {
  "use strict";

  // ---- Categorical palette (validated, see dataviz reference) --------
  var CATEGORICAL = [
    "#2a78d6", // blue
    "#eb6834", // orange
    "#1baf7a", // aqua
    "#eda100", // yellow
    "#e87ba4", // magenta
    "#008300", // green
    "#4a3aa7", // violet
    "#e34948", // red
  ];

  var STATUS = {
    good: "#0ca30c",
    warning: "#fab219",
    serious: "#ec835a",
    critical: "#d03b3b",
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

  // ---- Hidden age / decline / retirement ------------------------------
  // Ages are never shown in the UI (PHL only requires players to confirm
  // they're 16+); they exist purely to drive a quiet skill curve.
  function generateStartingAge() {
    // A mixed league: mostly 18-27 with a longer tail up to veteran ages.
    var roll = Math.random();
    if (roll < 0.55) return randInt(18, 24);
    if (roll < 0.88) return randInt(25, 29);
    return randInt(30, 33);
  }

  function generateRookieAge() {
    return randInt(16, 19);
  }

  // Randomized per-player so not everyone declines/retires in lockstep.
  function retirementAgeFor() {
    return randInt(32, 36);
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
    randomName: randomName,
    ARCHETYPES: ARCHETYPES,
    archetypesFor: archetypesFor,
    randomArchetype: randomArchetype,
    archetypeBias: archetypeBias,
    deriveAttributes: deriveAttributes,
    salaryAsking: salaryAsking,
    formatMoney: formatMoney,
    SALARY_MIN: SALARY_MIN,
    SALARY_MAX: SALARY_MAX,
    generateStartingAge: generateStartingAge,
    generateRookieAge: generateRookieAge,
    retirementAgeFor: retirementAgeFor,
  };
})();
