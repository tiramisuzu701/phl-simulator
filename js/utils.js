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

  // Overall rating -> salary in cap units. Curved so stars cost disproportionately more.
  function salaryForOverall(overall) {
    var norm = clamp((overall - 40) / (99 - 40), 0, 1); // 0..1
    var salary = 1 + Math.pow(norm, 1.7) * 24; // 1..25
    return Math.round(salary * 2) / 2; // nearest 0.5
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
    salaryForOverall: salaryForOverall,
  };
})();
