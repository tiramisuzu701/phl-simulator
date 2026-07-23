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
    // division plays a fixed 12-week regular season, so gamesPerWeek sets
    // its total game count too (Pro: 2/wk x 12wk = 24 games; Contender &
    // Prospect: 3/wk x 12wk = 36 games).
    { id: "prospect", name: "Prospect", tier: 1, salaryCap: 1000000, gamesPerWeek: 3, playoff: { teams: 10, byes: 6 } },
    { id: "contender", name: "Contender", tier: 2, salaryCap: 2000000, gamesPerWeek: 3, playoff: { teams: 8, byes: 8 } },
    { id: "pro", name: "Pro", tier: 3, salaryCap: 4000000, gamesPerWeek: 2, playoff: { teams: 4, byes: 4 } },
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
    { id: "sp_099", name: "Howie", position: "D", archetype: "Two-Way Defenseman", overall: 75, potential: 87, salary: 212500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_100", name: "pikemin", position: "D", archetype: "Two-Way Defenseman", overall: 74, potential: 86, salary: 205000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_101", name: "Log", position: "D", archetype: "Stalwart Defender", overall: 72, potential: 86, salary: 194000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
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
    { id: "sp_119", name: "Alicat", position: "G", archetype: "Hybrid", overall: 70, potential: 87, salary: 185500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_120", name: "Ironic", position: "G", archetype: "Hybrid", overall: 70, potential: 87, salary: 185500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_121", name: "Leo", position: "G", archetype: "Hybrid", overall: 70, potential: 87, salary: 185500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_122", name: "Luke", position: "G", archetype: "Hybrid", overall: 70, potential: 87, salary: 185500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_123", name: "Bob", position: "G", archetype: "Hybrid", overall: 69, potential: 87, salary: 180500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_124", name: "Guap", position: "F", archetype: "Two-Way Forward", overall: 69, potential: 87, salary: 180500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_125", name: "JamalDDown", position: "F", archetype: "Playmaker", overall: 69, potential: 87, salary: 180500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_126", name: "하나", position: "F", archetype: "Two-Way Forward", overall: 69, potential: 87, salary: 180500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_127", name: "Chuk", position: "F", archetype: "Playmaker", overall: 68, potential: 87, salary: 175000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_128", name: "Serbane", position: "F", archetype: "Playmaker", overall: 68, potential: 87, salary: 175000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_129", name: "Will", position: "F", archetype: "Two-Way Forward", overall: 68, potential: 87, salary: 175000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_130", name: "Liability", position: "G", archetype: "Hybrid", overall: 67, potential: 86, salary: 168000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_131", name: "AIC", position: "D", archetype: "Offensive Defenseman", overall: 66, potential: 86, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_132", name: "Clash", position: "F", archetype: "Two-Way Forward", overall: 66, potential: 86, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_133", name: "Deelan", position: "F", archetype: "Playmaker", overall: 66, potential: 86, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_134", name: "ThatGuy", position: "D", archetype: "Offensive Defenseman", overall: 66, potential: 86, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_135", name: "Totalage", position: "F", archetype: "Two-Way Forward", overall: 66, potential: 86, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_136", name: "[HQM] Jaxn", position: "F", archetype: "Goal Scorer", overall: 65, potential: 85, salary: 155500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_137", name: "Draisaitl", position: "F", archetype: "Playmaker", overall: 65, potential: 85, salary: 155500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_138", name: "lain", position: "D", archetype: "Offensive Defenseman", overall: 65, potential: 85, salary: 155500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_139", name: "qslvr", position: "F", archetype: "Playmaker", overall: 65, potential: 85, salary: 155500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_140", name: "TheHairyWookie", position: "D", archetype: "Offensive Defenseman", overall: 65, potential: 85, salary: 155500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_141", name: "Toemas", position: "D", archetype: "Offensive Defenseman", overall: 65, potential: 85, salary: 155500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_142", name: "donut", position: "G", archetype: "Hybrid", overall: 64, potential: 95, salary: 172000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_143", name: "Hotdogman", position: "D", archetype: "Offensive Defenseman", overall: 64, potential: 85, salary: 151000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_144", name: "Mango", position: "F", archetype: "Playmaker", overall: 64, potential: 85, salary: 151000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_145", name: "P", position: "D", archetype: "Two-Way Defenseman", overall: 64, potential: 85, salary: 151000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_146", name: "Poppanut", position: "F", archetype: "Playmaker", overall: 64, potential: 85, salary: 151000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_147", name: "amp", position: "F", archetype: "Two-Way Forward", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_148", name: "Bagginz", position: "F", archetype: "Playmaker", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_149", name: "Buzz Flibbet", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_150", name: "Caufield", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_151", name: "Cave", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_152", name: "Dorofeyev", position: "F", archetype: "Two-Way Forward", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_153", name: "Dyson", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_154", name: "FORD", position: "F", archetype: "Goal Scorer", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_155", name: "Gdylan", position: "F", archetype: "Goal Scorer", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_156", name: "Get Woke", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_157", name: "JackMehoff", position: "F", archetype: "Goal Scorer", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_158", name: "KNODEL", position: "F", archetype: "Playmaker", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_159", name: "Lettinin", position: "G", archetype: "Hybrid", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_160", name: "Rogue", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_161", name: "Sunless", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 93, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_162", name: "UnionJack", position: "F", archetype: "Playmaker", overall: 63, potential: 93, salary: 163000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_163", name: "Vorime", position: "D", archetype: "Two-Way Defenseman", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_164", name: "YODEADGUY", position: "F", archetype: "Two-Way Forward", overall: 63, potential: 85, salary: 146000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_165", name: "Cosmetic_Kat", position: "G", archetype: "Hybrid", overall: 62, potential: 84, salary: 139500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_166", name: "Blomeno", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_167", name: "DankyD", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_168", name: "Fluff", position: "F", archetype: "Goal Scorer", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_169", name: "jyfrl", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_170", name: "Jyler", position: "F", archetype: "Power Forward", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_171", name: "Mickster", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_172", name: "Neko", position: "F", archetype: "Goal Scorer", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_173", name: "qapple", position: "F", archetype: "Playmaker", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_174", name: "Rhubarb", position: "D", archetype: "Two-Way Defenseman", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_175", name: "stqfe", position: "F", archetype: "Two-Way Forward", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_176", name: "tensionSMF", position: "F", archetype: "Playmaker", overall: 61, potential: 84, salary: 134500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_177", name: "Bad Santa", position: "F", archetype: "Two-Way Forward", overall: 60, potential: 83, salary: 128000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_178", name: "Wrandy", position: "F", archetype: "Two-Way Forward", overall: 60, potential: 83, salary: 128000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_179", name: "GregMiller", position: "D", archetype: "Stalwart Defender", overall: 59, potential: 83, salary: 123500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_180", name: "hotpocket", position: "F", archetype: "Power Forward", overall: 59, potential: 83, salary: 123500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_181", name: "Saveoh", position: "F", archetype: "Goal Scorer", overall: 59, potential: 83, salary: 123500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_182", name: "Sky", position: "D", archetype: "Stalwart Defender", overall: 59, potential: 83, salary: 123500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_183", name: "SPACEBALLS", position: "D", archetype: "Stalwart Defender", overall: 59, potential: 83, salary: 123500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_184", name: "BeastlyItalian", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 83, salary: 119500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_185", name: "PixelHaunts", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 83, salary: 119500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_186", name: "Price", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 83, salary: 119500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_187", name: "whitehousetech", position: "D", archetype: "Stalwart Defender", overall: 58, potential: 83, salary: 119500, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_188", name: "CanadienGamer", position: "D", archetype: "Stalwart Defender", overall: 57, potential: 82, salary: 113000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_189", name: "henton", position: "F", archetype: "Power Forward", overall: 57, potential: 82, salary: 113000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_190", name: "Cook", position: "D", archetype: "Stalwart Defender", overall: 55, potential: 81, salary: 103000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_191", name: "TV #11", position: "D", archetype: "Stalwart Defender", overall: 55, potential: 81, salary: 103000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
    { id: "sp_192", name: "Bransk", position: "D", archetype: "Stalwart Defender", overall: 53, potential: 81, salary: 95000, contractYears: null, teamId: null, startupDraftPool: true, isDraftProspect: false, retired: false, stats: null },
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
      version: 2,
      generatedFor: "Puck (Steam)",
    },
    settings: {
      rosterMax: 14, // max players a team may hold
      lineup: { F: 2, D: 2, G: 1 }, // active lineup per game (Puck is 2F+2D+1G)
      targetGamesPerTeam: 18, // legacy fallback only — see division.gamesPerWeek
      offseasonWeeks: 5,
      regularSeasonWeeks: 12,
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
      // Startup Draft rounds vs. a later Expansion Draft's rounds.
      startupDraftRounds: 8,
      expansionDraftRounds: 6,
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
    // season cycles offseason(5wk, freeform) -> regular(12wk) ->
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
    // start, via the Startup Draft tab.
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
    // A solo, single-team draft run whenever an Expansion Franchise is
    // added mid-save (see js/expansion.js) — 6 rounds (vs. the Startup
    // Draft's 8) picking from the current free-agent pool to build that
    // one new team's roster from scratch. Null when no expansion draft is
    // in progress.
    expansionDraft: null, // { status, teamId, round, totalRounds, pool, picks }
  };
})();
