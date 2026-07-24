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

  // logoUrl is optional — hotlinked straight from the real PHL's own site
  // (phlstats.com) rather than bundled with the site, so no logo files
  // ship in this repo. Teams with no logo (a fresh Expansion Franchise, or
  // a plain "+ Add Team" league-builder team) fall back to a plain colored
  // abbreviation badge automatically — see U.crestHtml() in js/utils.js.
  function team(id, name, abbr, division, logoUrl) {
    return {
      id: id,
      name: name,
      abbr: abbr,
      division: division,
      logoUrl: logoUrl || null,
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
    // salaryCap is per-team, per-season, in real dollars — top-tier orgs
    // simply have bigger budgets than entry-level ones.
    //
    // playoff.teams = how many teams (by standings) are playoff-eligible at
    // all; playoff.byes = how many of those skip straight to the main
    // bracket. When teams > byes, the remaining (teams - byes) seeds play a
    // Wild Card round for the last bracket spot(s). Any team that finishes
    // below `teams` in the standings (e.g. an added expansion team landing
    // in last place) simply misses the playoffs — no extra round is added
    // for it.
    // gamesPerWeek drives the weekly calendar (see js/calendar.js): each
    // division plays a fixed 12 game-weeks of regular season (now spread
    // across a 14 calendar-week span — weeks 1-9 and 12-14 — to make room
    // for the week 10-11 trade-deadline break), so gamesPerWeek sets its
    // total game count too (Pro: 2/wk x 12wk = 24 games; Contender &
    // Prospect: 3/wk x 12wk = 36 games).
    //
    // overallCap is the highest player overall allowed while rostered in
    // that division (enforced at every draft/trade/promotion/signing —
    // see js/state.js meetsOverallCap); null means uncapped (Pro).
    // salaryCapMax is the ceiling a team's effective cap can scale up to
    // based on last season's win rate (see js/state.js capForTeam) — the
    // salaryCap value below stays the fixed base a team starts a fresh
    // save (or a losing season) at.
    { id: "prospect", name: "Prospect", tier: 1, salaryCap: 1000000, salaryCapMax: 1500000, overallCap: 79, gamesPerWeek: 3, playoff: { teams: 10, byes: 6 } },
    { id: "contender", name: "Contender", tier: 2, salaryCap: 2000000, salaryCapMax: 3200000, overallCap: 91, gamesPerWeek: 3, playoff: { teams: 8, byes: 8 } },
    { id: "pro", name: "Pro", tier: 3, salaryCap: 4000000, salaryCapMax: 5400000, overallCap: null, gamesPerWeek: 2, playoff: { teams: 4, byes: 4 } },
  ];

  // Real PHL Season 4 roster sweep (Pro + Contender + Prospect, every
  // active/inactive/limited/benched player), rated from actual stats and
  // hand-corrected by the league admin. No team is attached to any of
  // them — they all seed the one-time startup draft pool (see
  // js/startupDraft.js) that runs when a new save's GM picks their
  // division/team. Anything left over once that draft finishes becomes a
  // normal free agent.
  var startupPool = [
    { id: "sp_001", name: "Bubba", position: "F", archetype: "Two-Way Forward", overall: 95, potential: 98, salary: 368500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_002", name: "meatsale", position: "F", archetype: "Playmaker", overall: 94, potential: 97, salary: 358500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_003", name: "Hljnx", position: "F", archetype: "Playmaker", overall: 93, potential: 97, salary: 352000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_004", name: "Jackk", position: "F", archetype: "Playmaker", overall: 93, potential: 97, salary: 352000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_005", name: "ratty", position: "F", archetype: "Two-Way Forward", overall: 93, potential: 97, salary: 352000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_006", name: "Smasher", position: "F", archetype: "Goal Scorer", overall: 93, potential: 97, salary: 352000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_007", name: "Demidov", position: "D", archetype: "Offensive Defenseman", overall: 92, potential: 97, salary: 345000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_008", name: "Lums", position: "G", archetype: "Hybrid", overall: 92, potential: 97, salary: 345000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_009", name: "Orangutan", position: "F", archetype: "Playmaker", overall: 92, potential: 97, salary: 345000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_010", name: "Chief Keef", position: "F", archetype: "Playmaker", overall: 91, potential: 96, salary: 335500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_011", name: "nick", position: "F", archetype: "Goal Scorer", overall: 91, potential: 96, salary: 335500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_012", name: "Baygull", position: "D", archetype: "Offensive Defenseman", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_013", name: "BeeGeePi", position: "D", archetype: "Two-Way Defenseman", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_014", name: "grab", position: "D", archetype: "Offensive Defenseman", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_015", name: "Grizz", position: "G", archetype: "Hybrid", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_016", name: "milk", position: "G", archetype: "Hybrid", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_017", name: "Owen", position: "F", archetype: "Two-Way Forward", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_018", name: "Sleepy", position: "G", archetype: "Hybrid", overall: 90, potential: 96, salary: 328500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_019", name: "Dalf", position: "D", archetype: "Two-Way Defenseman", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_020", name: "emma", position: "G", archetype: "Hybrid", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_021", name: "Fizzz", position: "D", archetype: "Offensive Defenseman", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_022", name: "Fly", position: "D", archetype: "Offensive Defenseman", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_023", name: "Grip", position: "G", archetype: "Hybrid", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_024", name: "Karl", position: "F", archetype: "Two-Way Forward", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_025", name: "Kiwi", position: "F", archetype: "Playmaker", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_026", name: "Maus", position: "F", archetype: "Two-Way Forward", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_027", name: "Radioheadlover", position: "F", archetype: "Two-Way Forward", overall: 89, potential: 96, salary: 322000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_028", name: "act", position: "F", archetype: "Playmaker", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_029", name: "chad", position: "D", archetype: "Two-Way Defenseman", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_030", name: "jurkey", position: "D", archetype: "Two-Way Defenseman", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_031", name: "SKULL", position: "G", archetype: "Hybrid", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_032", name: "TheLittleOwl", position: "D", archetype: "Two-Way Defenseman", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_033", name: "Tony Flow", position: "D", archetype: "Two-Way Defenseman", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_034", name: "v", position: "D", archetype: "Two-Way Defenseman", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_035", name: "Ze", position: "G", archetype: "Hybrid", overall: 88, potential: 95, salary: 312500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_036", name: "frogtea", position: "D", archetype: "Two-Way Defenseman", overall: 87, potential: 95, salary: 306000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_037", name: "Glensky", position: "F", archetype: "Two-Way Forward", overall: 87, potential: 95, salary: 306000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_038", name: "HOLLY", position: "G", archetype: "Hybrid", overall: 87, potential: 95, salary: 306000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_039", name: "walls", position: "G", archetype: "Hybrid", overall: 87, potential: 95, salary: 306000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_040", name: "DickiePecker", position: "D", archetype: "Two-Way Defenseman", overall: 86, potential: 95, salary: 299500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_041", name: "pretty", position: "D", archetype: "Two-Way Defenseman", overall: 86, potential: 95, salary: 299500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_042", name: "The Specialty", position: "G", archetype: "Hybrid", overall: 86, potential: 95, salary: 299500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_043", name: "Average", position: "G", archetype: "Hybrid", overall: 87, potential: 93, salary: 300500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_044", name: "LeeJenkins", position: "G", archetype: "Hybrid", overall: 86, potential: 92, salary: 291500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_045", name: "balakey", position: "F", archetype: "Two-Way Forward", overall: 85, potential: 92, salary: 285000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_046", name: "LaVerne", position: "F", archetype: "Two-Way Forward", overall: 85, potential: 92, salary: 285000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_047", name: "Brodeur", position: "G", archetype: "Hybrid", overall: 84, potential: 92, salary: 278500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_048", name: "chino", position: "D", archetype: "Offensive Defenseman", overall: 84, potential: 92, salary: 278500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_049", name: "Damocles", position: "G", archetype: "Hybrid", overall: 84, potential: 92, salary: 278500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_050", name: "fightlash", position: "G", archetype: "Hybrid", overall: 84, potential: 92, salary: 278500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_051", name: "Marsamune", position: "G", archetype: "Hybrid", overall: 84, potential: 92, salary: 278500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_052", name: "Coppinwood", position: "G", archetype: "Hybrid", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_053", name: "Jack", position: "F", archetype: "Two-Way Forward", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_054", name: "Kap", position: "F", archetype: "Two-Way Forward", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_055", name: "marcus", position: "F", archetype: "Playmaker", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_056", name: "Panther", position: "F", archetype: "Goal Scorer", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_057", name: "Prince", position: "D", archetype: "Offensive Defenseman", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_058", name: "s", position: "F", archetype: "Two-Way Forward", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_059", name: "Shrews", position: "F", archetype: "Playmaker", overall: 83, potential: 91, salary: 270000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_060", name: "Koochie", position: "G", archetype: "Hybrid", overall: 82, potential: 90, salary: 261000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_061", name: "Midnight", position: "D", archetype: "Offensive Defenseman", overall: 82, potential: 90, salary: 261000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_062", name: "Treason", position: "G", archetype: "Hybrid", overall: 82, potential: 90, salary: 261000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_063", name: "Marc Andre Pinky", position: "F", archetype: "Playmaker", overall: 81, potential: 90, salary: 255000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_064", name: "Sonyc", position: "F", archetype: "Two-Way Forward", overall: 81, potential: 90, salary: 255000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_065", name: "Danimals", position: "F", archetype: "Goal Scorer", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_066", name: "Hecow", position: "G", archetype: "Hybrid", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_067", name: "HoodLegend", position: "F", archetype: "Playmaker", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_068", name: "richardp", position: "F", archetype: "Two-Way Forward", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_069", name: "sndrsn", position: "D", archetype: "Offensive Defenseman", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_070", name: "Tara", position: "D", archetype: "Offensive Defenseman", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_071", name: "ThrockMorton", position: "G", archetype: "Hybrid", overall: 80, potential: 90, salary: 249000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_072", name: "DyslexicWarlus", position: "F", archetype: "Two-Way Forward", overall: 79, potential: 89, salary: 240500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_073", name: "galactian", position: "D", archetype: "Offensive Defenseman", overall: 79, potential: 89, salary: 240500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_074", name: "notlad", position: "D", archetype: "Offensive Defenseman", overall: 79, potential: 89, salary: 240500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_075", name: "Oddz", position: "G", archetype: "Hybrid", overall: 79, potential: 89, salary: 240500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_076", name: "SCOOSH", position: "F", archetype: "Playmaker", overall: 79, potential: 89, salary: 240500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_077", name: "sillywinker", position: "D", archetype: "Two-Way Defenseman", overall: 79, potential: 89, salary: 240500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_078", name: "BigDiz", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_079", name: "Blast", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_080", name: "Can00dle", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_081", name: "echo", position: "F", archetype: "Playmaker", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_082", name: "fib", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_083", name: "Lawly", position: "F", archetype: "Playmaker", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_084", name: "Lumalee", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_085", name: "Myst", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_086", name: "reno", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_087", name: "Sully", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_088", name: "Wren", position: "D", archetype: "Two-Way Defenseman", overall: 78, potential: 88, salary: 232500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_089", name: "Kip", position: "D", archetype: "Two-Way Defenseman", overall: 77, potential: 88, salary: 226500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_090", name: "Madan", position: "F", archetype: "Two-Way Forward", overall: 77, potential: 88, salary: 226500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_091", name: "TimJim", position: "D", archetype: "Two-Way Defenseman", overall: 77, potential: 88, salary: 226500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_092", name: "Zam", position: "D", archetype: "Two-Way Defenseman", overall: 77, potential: 88, salary: 226500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_093", name: "blurker", position: "D", archetype: "Two-Way Defenseman", overall: 76, potential: 88, salary: 221000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_094", name: "dabz", position: "F", archetype: "Two-Way Forward", overall: 76, potential: 88, salary: 221000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_095", name: "pylonking", position: "D", archetype: "Two-Way Defenseman", overall: 76, potential: 88, salary: 221000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_096", name: "Spork", position: "D", archetype: "Two-Way Defenseman", overall: 76, potential: 88, salary: 221000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_097", name: "Tee", position: "F", archetype: "Power Forward", overall: 76, potential: 88, salary: 221000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_098", name: "Thug", position: "F", archetype: "Power Forward", overall: 76, potential: 88, salary: 221000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_099", name: "Howie", position: "D", archetype: "Two-Way Defenseman", overall: 75, potential: 99, salary: 242500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_100", name: "pikemin", position: "D", archetype: "Two-Way Defenseman", overall: 74, potential: 95, salary: 226500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_101", name: "Log", position: "D", archetype: "Stalwart Defender", overall: 72, potential: 96, salary: 217500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_102", name: "Mal", position: "G", archetype: "Hybrid", overall: 76, potential: 90, salary: 225500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_103", name: "Pigeon", position: "G", archetype: "Hybrid", overall: 76, potential: 90, salary: 225500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_104", name: "Jayjee", position: "F", archetype: "Two-Way Forward", overall: 75, potential: 89, salary: 217500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_105", name: "vxpr", position: "F", archetype: "Goal Scorer", overall: 74, potential: 89, salary: 212000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_106", name: "Bloodscars", position: "G", archetype: "Hybrid", overall: 73, potential: 89, salary: 206500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_107", name: "Miku", position: "G", archetype: "Hybrid", overall: 73, potential: 89, salary: 206500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_108", name: "farf", position: "G", archetype: "Hybrid", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_109", name: "geefsneef", position: "F", archetype: "Playmaker", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_110", name: "House", position: "F", archetype: "Playmaker", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_111", name: "JoDogg", position: "G", archetype: "Hybrid", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_112", name: "Prada", position: "D", archetype: "Offensive Defenseman", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_113", name: "Snowcone", position: "F", archetype: "Two-Way Forward", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_114", name: "sun", position: "G", archetype: "Hybrid", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_115", name: "tov", position: "G", archetype: "Hybrid", overall: 72, potential: 88, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_116", name: "BOESER", position: "F", archetype: "Playmaker", overall: 71, potential: 88, salary: 193000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_117", name: "Julzes", position: "D", archetype: "Offensive Defenseman", overall: 71, potential: 88, salary: 193000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_118", name: "Kai", position: "G", archetype: "Hybrid", overall: 71, potential: 88, salary: 193000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_119", name: "Alicat", position: "G", archetype: "Hybrid", overall: 70, potential: 94, salary: 201500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_120", name: "Ironic", position: "G", archetype: "Hybrid", overall: 70, potential: 91, salary: 194500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_121", name: "Leo", position: "G", archetype: "Hybrid", overall: 70, potential: 97, salary: 209000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_122", name: "Luke", position: "G", archetype: "Hybrid", overall: 70, potential: 98, salary: 211000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_123", name: "Bob", position: "G", archetype: "Hybrid", overall: 69, potential: 96, salary: 201000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_124", name: "Guap", position: "F", archetype: "Two-Way Forward", overall: 69, potential: 98, salary: 205500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_125", name: "JamalDDown", position: "F", archetype: "Playmaker", overall: 69, potential: 91, salary: 189500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_126", name: "하나", position: "F", archetype: "Two-Way Forward", overall: 69, potential: 95, salary: 198500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_127", name: "Chuk", position: "F", archetype: "Playmaker", overall: 68, potential: 98, salary: 200000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_128", name: "Serbane", position: "F", archetype: "Playmaker", overall: 68, potential: 93, salary: 188500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_129", name: "Will", position: "F", archetype: "Two-Way Forward", overall: 68, potential: 99, salary: 202500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_130", name: "Liability", position: "G", archetype: "Hybrid", overall: 67, potential: 96, salary: 190000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_131", name: "AIC", position: "D", archetype: "Offensive Defenseman", overall: 66, potential: 96, salary: 185000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_132", name: "Clash", position: "F", archetype: "Two-Way Forward", overall: 66, potential: 97, salary: 187000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_133", name: "Deelan", position: "F", archetype: "Playmaker", overall: 66, potential: 90, salary: 171500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_134", name: "ThatGuy", position: "D", archetype: "Offensive Defenseman", overall: 66, potential: 95, salary: 182500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_135", name: "Totalage", position: "F", archetype: "Two-Way Forward", overall: 66, potential: 94, salary: 180500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_136", name: "[HQM] Jaxn", position: "F", archetype: "Goal Scorer", overall: 65, potential: 91, salary: 168500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_137", name: "Draisaitl", position: "F", archetype: "Playmaker", overall: 65, potential: 93, salary: 173000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_138", name: "lain", position: "D", archetype: "Offensive Defenseman", overall: 65, potential: 94, salary: 175000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_139", name: "qslvr", position: "F", archetype: "Playmaker", overall: 65, potential: 94, salary: 175000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_140", name: "TheHairyWookie", position: "D", archetype: "Offensive Defenseman", overall: 65, potential: 98, salary: 184000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_141", name: "Toemas", position: "D", archetype: "Offensive Defenseman", overall: 65, potential: 90, salary: 166500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_142", name: "donut", position: "G", archetype: "Hybrid", overall: 64, potential: 95, salary: 172000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_143", name: "Hotdogman", position: "D", archetype: "Offensive Defenseman", overall: 64, potential: 97, salary: 176500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_144", name: "Mango", position: "F", archetype: "Playmaker", overall: 64, potential: 92, salary: 165500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_145", name: "P", position: "D", archetype: "Two-Way Defenseman", overall: 64, potential: 97, salary: 176500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_146", name: "Poppanut", position: "F", archetype: "Playmaker", overall: 64, potential: 92, salary: 165500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_147", name: "amp", position: "F", archetype: "Two-Way Forward", overall: 63, potential: 95, salary: 167000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_148", name: "Bagginz", position: "F", archetype: "Playmaker", overall: 63, potential: 99, salary: 176000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_149", name: "Buzz Flibbet", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 96, salary: 169500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_150", name: "Caufield", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 96, salary: 169500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_151", name: "Cave", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 89, salary: 154500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_152", name: "Dorofeyev", position: "F", archetype: "Two-Way Forward", overall: 63, potential: 98, salary: 173500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_153", name: "Dyson", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 98, salary: 173500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_154", name: "FORD", position: "F", archetype: "Goal Scorer", overall: 63, potential: 99, salary: 176000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_155", name: "Gdylan", position: "F", archetype: "Goal Scorer", overall: 63, potential: 90, salary: 156500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_156", name: "Get Woke", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 99, salary: 176000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_157", name: "JackMehoff", position: "F", archetype: "Goal Scorer", overall: 63, potential: 98, salary: 173500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_158", name: "KNODEL", position: "F", archetype: "Playmaker", overall: 63, potential: 95, salary: 167000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_159", name: "Lettinin", position: "G", archetype: "Hybrid", overall: 63, potential: 94, salary: 165000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_160", name: "Rogue", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 97, salary: 171500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_161", name: "Sunless", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 93, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_162", name: "UnionJack", position: "F", archetype: "Playmaker", overall: 63, potential: 93, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_163", name: "Vorime", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 94, salary: 165000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_164", name: "YODEADGUY", position: "F", archetype: "Two-Way Forward", overall: 63, potential: 93, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_165", name: "Cosmetic_Kat", position: "G", archetype: "Hybrid", overall: 62, potential: 96, salary: 164000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_166", name: "Blomeno", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 91, salary: 149000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_167", name: "DankyD", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 99, salary: 165500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_168", name: "Fluff", position: "F", archetype: "Goal Scorer", overall: 61, potential: 98, salary: 163500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_169", name: "jyfrl", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 99, salary: 165500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_170", name: "Jyler", position: "F", archetype: "Power Forward", overall: 61, potential: 96, salary: 159000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_171", name: "Mickster", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 92, salary: 151000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_172", name: "Neko", position: "F", archetype: "Goal Scorer", overall: 61, potential: 98, salary: 163500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_173", name: "qapple", position: "F", archetype: "Playmaker", overall: 61, potential: 92, salary: 151000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_174", name: "Rhubarb", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 98, salary: 163500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_175", name: "stqfe", position: "F", archetype: "Two-Way Forward", overall: 61, potential: 94, salary: 155000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_176", name: "tensionSMF", position: "F", archetype: "Playmaker", overall: 61, potential: 95, salary: 157000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_177", name: "Bad Santa", position: "F", archetype: "Two-Way Forward", overall: 60, potential: 95, salary: 152000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_178", name: "Wrandy", position: "F", archetype: "Two-Way Forward", overall: 60, potential: 96, salary: 154500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_179", name: "GregMiller", position: "D", archetype: "Stalwart Defender", overall: 59, potential: 96, salary: 149500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_180", name: "hotpocket", position: "F", archetype: "Power Forward", overall: 59, potential: 98, salary: 153500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_181", name: "Saveoh", position: "F", archetype: "Goal Scorer", overall: 59, potential: 96, salary: 149500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_182", name: "Sky", position: "D", archetype: "Stalwart Defender", overall: 59, potential: 96, salary: 149500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_183", name: "SPACEBALLS", position: "D", archetype: "Stalwart Defender", overall: 59, potential: 96, salary: 149500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_184", name: "BeastlyItalian", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 93, salary: 138500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_185", name: "PixelHaunts", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 95, salary: 142500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_186", name: "Price", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 94, salary: 140500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_187", name: "whitehousetech", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 92, salary: 136500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_188", name: "CanadienGamer", position: "D", archetype: "Stalwart Defender", overall: 57, potential: 94, salary: 136000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_189", name: "henton", position: "F", archetype: "Power Forward", overall: 57, potential: 91, salary: 130000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_190", name: "Cook", position: "D", archetype: "Stalwart Defender", overall: 55, potential: 96, salary: 130500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_191", name: "TV #11", position: "D", archetype: "Stalwart Defender", overall: 55, potential: 93, salary: 125000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_192", name: "Bransk", position: "D", archetype: "Stalwart Defender", overall: 53, potential: 90, salary: 110500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },

    // ---- Supplemental depth (added on top of the real PHL Season 4 sweep
    // above) — the real pool is goalie-thin relative to 26 teams each
    // needing at least 1G for a legal 2F/2D/1G lineup, so cascading phases
    // (Pro -> Contender -> Prospect) could run the goalie pool dry before
    // every Prospect team got one. These are clearly fictional
    // (gamertag-style names, matching the sim's own procedurally-generated
    // players) rather than real PHL roster entries.
    { id: "sp_193", name: "VoidReaper77", position: "G", archetype: "Hybrid", overall: 74, potential: 93, salary: 221500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_194", name: "GhostFalcon", position: "G", archetype: "Hybrid", overall: 73, potential: 96, salary: 223000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_195", name: "NovaWraith", position: "G", archetype: "The Wall", overall: 72, potential: 91, salary: 205500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_196", name: "ZeroComet", position: "G", archetype: "Hybrid", overall: 71, potential: 99, salary: 219000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_197", name: "CyberBandit", position: "G", archetype: "Puck-Handler", overall: 70, potential: 94, salary: 201500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_198", name: "RogueYeti", position: "G", archetype: "Hybrid", overall: 70, potential: 94, salary: 201500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_199", name: "FrostViper", position: "G", archetype: "The Wall", overall: 69, potential: 92, salary: 191500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_200", name: "ToxicPhoenix", position: "G", archetype: "Hybrid", overall: 69, potential: 90, salary: 187000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_201", name: "ShadowBlade", position: "G", archetype: "Hybrid", overall: 68, potential: 89, salary: 179500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_202", name: "StaticStorm", position: "G", archetype: "Puck-Handler", overall: 68, potential: 93, salary: 188500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_203", name: "CrimsonRonin", position: "G", archetype: "The Wall", overall: 67, potential: 97, salary: 192500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_204", name: "ObsidianNinja", position: "G", archetype: "Hybrid", overall: 67, potential: 98, salary: 194500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_205", name: "QuantumSpecter", position: "G", archetype: "Hybrid", overall: 66, potential: 98, salary: 189500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_206", name: "PhantomFalcon", position: "G", archetype: "The Wall", overall: 66, potential: 93, salary: 178000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_207", name: "FeralCobra", position: "G", archetype: "Hybrid", overall: 65, potential: 97, salary: 182000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_208", name: "GlitchDagger", position: "G", archetype: "Puck-Handler", overall: 65, potential: 98, salary: 184000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_209", name: "SavageHavoc", position: "G", archetype: "Hybrid", overall: 64, potential: 97, salary: 176500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_210", name: "ArcticNomad", position: "G", archetype: "The Wall", overall: 64, potential: 96, salary: 174500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_211", name: "RadiantWraith92", position: "G", archetype: "Hybrid", overall: 63, potential: 95, salary: 167000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_212", name: "VortexYeti", position: "G", archetype: "Hybrid", overall: 63, potential: 96, salary: 169500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_213", name: "ApexComet", position: "G", archetype: "The Wall", overall: 62, potential: 95, salary: 162000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_214", name: "TurboBandit", position: "G", archetype: "Hybrid", overall: 62, potential: 98, salary: 168500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_215", name: "SlyReaper", position: "G", archetype: "Puck-Handler", overall: 61, potential: 98, salary: 163500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_216", name: "GrimFox", position: "G", archetype: "Hybrid", overall: 61, potential: 98, salary: 163500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_217", name: "IronViper", position: "G", archetype: "The Wall", overall: 60, potential: 91, salary: 144000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_218", name: "SolarPhoenix", position: "G", archetype: "Hybrid", overall: 59, potential: 98, salary: 153500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_219", name: "LunarBlade", position: "G", archetype: "Hybrid", overall: 58, potential: 96, salary: 144500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_220", name: "VenomStorm", position: "G", archetype: "The Wall", overall: 57, potential: 98, salary: 144000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_221", name: "CryoRonin", position: "D", archetype: "Two-Way Defenseman", overall: 68, potential: 97, salary: 198000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_222", name: "HexNinja", position: "D", archetype: "Offensive Defenseman", overall: 66, potential: 97, salary: 187000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_223", name: "NitroSpecter", position: "D", archetype: "Stalwart Defender", overall: 65, potential: 94, salary: 175000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_224", name: "OnyxFalcon", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 96, salary: 169500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_225", name: "PixelWolf", position: "D", archetype: "Offensive Defenseman", overall: 61, potential: 93, salary: 153000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_226", name: "VaporHawk", position: "D", archetype: "Two-Way Defenseman", overall: 60, potential: 97, salary: 156500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_227", name: "WiredJinx", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 96, salary: 144500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_228", name: "AshenMenace", position: "D", archetype: "Two-Way Defenseman", overall: 56, potential: 94, salary: 131500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_229", name: "DuskByte", position: "F", archetype: "Two-Way Forward", overall: 67, potential: 91, salary: 179000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_230", name: "EmberCircuit", position: "F", archetype: "Playmaker", overall: 65, potential: 96, salary: 179500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_231", name: "FableFlux", position: "F", archetype: "Goal Scorer", overall: 63, potential: 95, salary: 167000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_232", name: "GlacialGambit", position: "F", archetype: "Power Forward", overall: 61, potential: 97, salary: 161500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_233", name: "HollowIon", position: "F", archetype: "Two-Way Forward", overall: 59, potential: 97, salary: 151500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_234", name: "JunoJolt", position: "F", archetype: "Playmaker", overall: 57, potential: 97, salary: 142000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_235", name: "KarmaKernel", position: "F", archetype: "Goal Scorer", overall: 55, potential: 93, salary: 125000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    // Filler players sp_236-sp_253 — added to give the Startup Draft pool a
    // little more depth (same schema/salary formula as the rest of the pool).
    { id: "sp_236", name: "LumenWraith", position: "F", archetype: "Playmaker", overall: 64, potential: 96, salary: 174500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_237", name: "MirageVolt", position: "F", archetype: "Two-Way Forward", overall: 62, potential: 95, salary: 162000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_238", name: "NebulaSprint", position: "F", archetype: "Grinder", overall: 58, potential: 98, salary: 149000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_239", name: "OrbitFlicker", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 94, salary: 165000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_240", name: "PulseWard", position: "D", archetype: "Offensive Defenseman", overall: 60, potential: 97, salary: 156500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_241", name: "QuartzHollow", position: "D", archetype: "Stay-at-Home Defenseman", overall: 57, potential: 96, salary: 140000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_242", name: "RiftEmber", position: "D", archetype: "Two-Way Defenseman", overall: 65, potential: 98, salary: 184000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_243", name: "SolsticeDrift", position: "F", archetype: "Goal Scorer", overall: 66, potential: 97, salary: 187000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_244", name: "TremorLatch", position: "F", archetype: "Power Forward", overall: 60, potential: 98, salary: 158500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_245", name: "UmbraCascade", position: "G", archetype: "Butterfly", overall: 64, potential: 95, salary: 172000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_246", name: "VaporSteel", position: "G", archetype: "Hybrid", overall: 61, potential: 94, salary: 155000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_247", name: "WhorlBastion", position: "G", archetype: "Standup", overall: 58, potential: 95, salary: 142500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_248", name: "XenonRelay", position: "G", archetype: "Butterfly", overall: 56, potential: 95, salary: 133500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_249", name: "YonderPrism", position: "D", archetype: "Offensive Defenseman", overall: 54, potential: 98, salary: 130000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_250", name: "ZephyrLatch", position: "F", archetype: "Playmaker", overall: 53, potential: 92, salary: 114500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_251", name: "AshfallVector", position: "F", archetype: "Two-Way Forward", overall: 51, potential: 98, salary: 117000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_252", name: "BrindleOrbit", position: "D", archetype: "Stay-at-Home Defenseman", overall: 50, potential: 97, salary: 110500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_253", name: "CinderQuartz", position: "G", archetype: "Hybrid", overall: 52, potential: 98, salary: 121000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
  ];

  // Logo URLs are hotlinked directly from the real PHL's own site,
  // phlstats.com (Season 4 team logos) — see the team() comment above.
  var teams = [
    // Pro
    team("mtl-mist", "Montreal Mist", "MTL", "pro", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Pro/Mist%20-%20Demi.png?v=1780569301"),
    team("bri-rats", "Bridgeport Rats", "BRI", "pro", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Pro/Rats%20-%20Ratty.png?v=1780050585"),
    team("alb-beavers", "Albany Beavers", "ALB", "pro", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Pro/Beavers%20-%20Meatsale.png?v=1779253589"),
    team("min-mustangs", "Minnesota Mustangs", "MIN", "pro", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Pro/Mustangs%20-%20Smasher.png?v=1780569309"),
    team("ott-sparks", "Ottawa Sparks", "OTT", "pro", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Pro/Sparks%20-%20Baygull.png?v=1779253606"),
    team("rmr-reapers", "Rocky Mountain Reapers", "RMR", "pro", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Pro/Reapers%20-%20pretty.png?v=1779253597"),

    // Contender
    team("anc-icetitans", "Anchorage Ice Titans", "ANC", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Ice%20Titans%20-%20Average.png?v=1780010087"),
    team("arl-polarbears", "Arlington Polar Bears", "ARL", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Polar%20Bears%20-%20Spork.png?v=1780010087"),
    team("stl-eagles", "St. Louis Eagles", "STL", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Eagles%20-%20Jackk.png?v=1780010087"),
    team("cam-haunt", "Cambridge Haunt", "CAM", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Haunt%20-%20Wren.png?v=1780010087"),
    team("scc-channelcats", "Schuylkill Channel Cats", "SCC", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Channel%20Cats%20-%20Notlad.png?v=1780010087"),
    team("tor-penguins", "Toronto Penguins", "TOR", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Penguins%20-%20Panther.png?v=1780010087"),
    team("kan-cadets", "Kanata Cadets", "KAN", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Cadets%20-%20Echo.png?v=1780010087"),
    team("uta-raptors", "Utah Raptors", "UTA", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Raptors%20-%20Fib.png?v=1780010087"),
    team("som-somebodies", "Somewhere Somebodies", "SOM", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Somebodies%20-%20Lawly.png?v=1780010087"),
    team("oak-volts", "Oakland Volts", "OAK", "contender", "https://phlstats.com/teamlogo/Contender%20S4/Volts%20-%20Pikemin.png?v=1780010087"),

    // Prospect
    team("hou-divers", "Houston Divers", "HOU", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Divers%20-%20ThatGuy_No%20BG.png?v=1780175543"),
    team("fer-foxes", "Fernie Foxes", "FER", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Foxes%20-%20Midnight.png?v=1780175543"),
    team("slr-otters", "St. Lawrence River Otters", "SLR", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/River%20Otters%20-%20Mango.png?v=1780175543"),
    team("hqm-mallard", "Hoboken Quacking Mallard", "HQM", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Mallards%20-%20Bagginz.png?v=1780175543"),
    team("phi-pyros", "Philadelphia Pyros", "PHI", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Pyros%20-%20Dyson.png?v=1780175543"),
    team("clc-conspiracy", "Crystal Lake Conspiracy", "CLC", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Conspiracy%20-%20geefsneef.png?v=1780175543"),
    team("sbs-sentinels", "South Boston Sentinels", "SBS", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Sentinels%20-%20Nem,%20Hotpocket.png?v=1780175543"),
    team("spo-ravens", "Spokane Ravens", "SPO", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Ravens%20-%20Jyler.png?v=1780175543"),
    team("hbc-caribou", "Hobart Bay Caribou", "HBC", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Hobart%20Bay%20Carribou%20-%20Wrandy.png?v=1780175543"),
    team("pst-stachios", "Port Stanley Stachios", "PST", "prospect", "https://phlstats.com/teamlogo/Season%204%20Team%20Logos/Prospect/Stachios%20-%20Saveoh.png?v=1780175543"),
  ];

  window.PHL_STARTER_DATA = {
    meta: {
      leagueName: "PHL",
      version: 2,
      generatedFor: "Puck (Steam)",
    },
    settings: {
      rosterMax: 10, // max players a team may hold (of which at most GOALIE_MAX are goalies — see js/state.js)
      lineup: { F: 2, D: 2, G: 1 }, // active lineup per game (Puck is 2F+2D+1G)
      targetGamesPerTeam: 18, // legacy fallback only — see division.gamesPerWeek
      offseasonWeeks: 5,
      // Calendar-week span of the regular season. Games are only played on
      // 12 of these 14 weeks — weeks 10-11 are the trade-deadline break
      // (see js/schedule.js PLAYING_WEEKS/BREAK_WEEKS) — but calendarWeek
      // still counts through all 14 before playoffs begin.
      regularSeasonWeeks: 14,
      pointsForWin: 2,
      pointsForOtLoss: 1,
      playoffTeamsPerDivision: 4,
      // Hidden aging curve — never shown in the UI. PHL only requires
      // players to confirm they're 16+; nobody discloses an exact age.
      declineStartAge: 29,
      retirementAgeMin: 32,
      retirementAgeMax: 36,
      // Breakout rookie class generated each new season (free agents,
      // restricted to Prospect/Contender — see settings.rookieDivisionOdds).
      rookiesPerSeason: 10,
      // Chance a given breakout rookie is eligible for Contender (instead
      // of Prospect-only). Never eligible for Pro straight out of the gate.
      rookieContenderChance: 0.25,
      // Startup Draft rounds — the Create Save wizard sets this to 6
      // instead of 8 for a save that includes an Expansion Franchise (one
      // extra team drafting from the same fixed real-player pool).
      startupDraftRounds: 8,
    },
    divisions: divisions,
    teams: teams,
    // The real PHL Season 4 player pool (see `startupPool` above) — nobody
    // has a team yet. New saves consume this pool via the one-time
    // Startup Draft (js/startupDraft.js). Add more players any time
    // through the in-browser editor, or use "Generate Sample Roster" in
    // the Players tab for quick placeholder testing.
    players: startupPool,
    // Single "Advance Week" button (js/calendar.js) drives everything —
    // no more separate sim/draft/playoff buttons to click through. Every
    // season cycles offseason(5wk, freeform) -> regular(14 calendar wks,
    // 12 of which play games, wks 10-11 are the trade-deadline break) ->
    // playoffs(up to 4wk, per-division) -> back to offseason.
    season: {
      seasonNumber: 1,
      phase: "offseason", // offseason -> regular -> playoffs -> offseason (repeats)
      calendarWeek: 1, // 1-based position within the current phase
      entryDraftDoneThisCycle: false,
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
    // The GM's chosen division/team for this save. Set once, at the very
    // start, on the standalone Create Save page (create-save.html) before
    // the Startup Draft ever runs.
    franchise: {
      divisionId: null,
      teamId: null,
    },
    // One-time cascading draft that seeds every team's initial roster from
    // `startupPool` above. Runs Pro -> Contender -> Prospect, each an
    // 8-round snake draft; each phase drafts from whatever the previous
    // phase left behind. See js/startupDraft.js for the full engine.
    startupDraft: {
      status: "not_started", // not_started -> active -> complete
      phase: null, // "pro" | "contender" | "prospect" | null
      phaseIndex: -1,
      masterOrder: [], // full team-id shuffle, set once when the draft begins
      phaseTeamOrder: [], // current phase's teams, in master-relative order
      pickIndexInPhase: 0,
      roundsPerPhase: 8,
      picks: [], // full log across all phases: {pickNumber, phase, round, teamId, playerId}
    },
    // Off-season call-ups: a higher-division team may pull a rostered
    // player up from any strictly-lower-tier division. Automatic, no
    // negotiation — see js/promotions.js. Full history logged here.
    promotions: [], // { id, season, fromTeamId, toTeamId, playerId, fee }
    // Player-for-player trades between two teams, initiated from the
    // Trades tab (see js/trades.js). Full history logged here.
    trades: [], // { id, season, teamAId, teamBId, playersToA, playersToB }
  };
})();
