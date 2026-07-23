/* PHL Franchise Simulator — starter league data
 * Loaded as a plain <script> (not an ES module) so the site works from a
 * plain double-clicked index.html (file://) as well as from a web server.
 * Exposes a single global: window.PHL_STARTER_DATA
 *
 * Divisions are tiers, lowest to highest: Prospect -> Contender -> Pro.
 * (A future "IAPL" sub-division is expected to slot in under/alongside
 * Prospect later — the data model's `tier` field leaves room for that.)
 */
(function () {
  "use strict";

  function team(id, name, abbr, division) {
    return {
      id: id,
      name: name,
      abbr: abbr,
      division: division,
      // record + cap fields are (re)computed / stored by state.js at runtime
      wins: 0,
      losses: 0,
      otLosses: 0,
      gf: 0,
      ga: 0,
      points: 0,
    };
  }

  var divisions = [
    { id: "prospect", name: "Prospect", tier: 1 },
    { id: "contender", name: "Contender", tier: 2 },
    { id: "pro", name: "Pro", tier: 3 },
  ];

  var teams = [
    // Pro
    team("mtl-mist", "Montreal Mist", "MTL", "pro"),
    team("bri-rats", "Bridgeport Rats", "BRI", "pro"),
    team("alb-beavers", "Albany Beavers", "ALB", "pro"),
    team("min-mustangs", "Minnesota Mustangs", "MIN", "pro"),
    team("ott-sparks", "Ottawa Sparks", "OTT", "pro"),
    team("rmr-reapers", "Rocky Mountain Reapers", "RMR", "pro"),

    // Contender
    team("anc-icetitans", "Anchorage Ice Titans", "ANC", "contender"),
    team("arl-polarbears", "Arlington Polar Bears", "ARL", "contender"),
    team("stl-eagles", "St. Louis Eagles", "STL", "contender"),
    team("cam-haunt", "Cambridge Haunt", "CAM", "contender"),
    team("scc-channelcats", "Schuylkill Channel Cats", "SCC", "contender"),
    team("tor-penguins", "Toronto Penguins", "TOR", "contender"),
    team("kan-cadets", "Kanata Cadets", "KAN", "contender"),
    team("uta-raptors", "Utah Raptors", "UTA", "contender"),
    team("som-somebodies", "Somewhere Somebodies", "SOM", "contender"),
    team("oak-volts", "Oakland Volts", "OAK", "contender"),

    // Prospect
    team("hou-divers", "Houston Divers", "HOU", "prospect"),
    team("fer-foxes", "Fernie Foxes", "FER", "prospect"),
    team("slr-otters", "St. Lawrence River Otters", "SLR", "prospect"),
    team("hqm-mallard", "Hoboken Quacking Mallard", "HQM", "prospect"),
    team("phi-pyros", "Philadelphia Pyros", "PHI", "prospect"),
    team("clc-conspiracy", "Crystal Lake Conspiracy", "CLC", "prospect"),
    team("sbs-sentinels", "South Boston Sentinels", "SBS", "prospect"),
    team("spo-ravens", "Spokane Ravens", "SPO", "prospect"),
    team("hbc-caribou", "Hobart Bay Caribou", "HBC", "prospect"),
    team("pst-stachios", "Port Stanley Stachios", "PST", "prospect"),
  ];

  window.PHL_STARTER_DATA = {
    meta: {
      leagueName: "PHL",
      version: 1,
      generatedFor: "Puck (Steam)",
    },
    settings: {
      salaryCap: 100, // cap units per team
      rosterMax: 14, // max players a team may hold
      lineup: { F: 2, D: 2, G: 1 }, // active lineup per game (Puck is 2F+2D+1G)
      targetGamesPerTeam: 18,
      pointsForWin: 2,
      pointsForOtLoss: 1,
      playoffTeamsPerDivision: 4,
    },
    divisions: divisions,
    teams: teams,
    // Players start empty — the user builds their own database via the
    // in-browser editor. See the "Generate Sample Roster" tool in Data
    // Tools if you want placeholder players to test-drive the simulator.
    players: [],
    season: {
      seasonNumber: 1,
      phase: "offseason", // offseason -> regular -> playoffs -> complete
      schedule: [],
      currentWeekIndex: 0,
      playoffs: {}, // keyed by divisionId
    },
    draft: {
      active: false,
      year: 1,
      order: [],
      pickIndex: 0,
      pool: [],
      picks: [],
    },
  };
})();
