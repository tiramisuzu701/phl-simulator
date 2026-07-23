/* PHL Franchise Simulator — state management
 * Global namespace: window.PHLState
 * Backed by localStorage; import/export as JSON so saves are shareable
 * and the whole league can be committed to a GitHub repo as a data file.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "phl_simulator_save_v1";
  var U = window.PHLUtil;
  var data = null;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("localStorage unavailable:", e);
    }
    if (raw) {
      try {
        data = JSON.parse(raw);
        migrate(data);
        return data;
      } catch (e) {
        console.warn("Save data was corrupt, falling back to starter data.", e);
      }
    }
    data = deepClone(window.PHL_STARTER_DATA);
    migrate(data);
    return data;
  }

  // Fill in any fields older saves might be missing (forward-compatible).
  function migrate(d) {
    var starter = window.PHL_STARTER_DATA;
    if (!d.settings) d.settings = deepClone(starter.settings);
    if (!d.season) d.season = deepClone(starter.season);
    if (!d.draft) d.draft = deepClone(starter.draft);
    if (!d.players) d.players = [];
    if (!d.teams) d.teams = [];
    if (!d.divisions) d.divisions = deepClone(starter.divisions);
    if (!d.franchise) d.franchise = deepClone(starter.franchise);
    if (!d.startupDraft) d.startupDraft = deepClone(starter.startupDraft);
    if (!d.promotions) d.promotions = [];
    if (d.expansionDraft === undefined) d.expansionDraft = null;
    for (var key in starter.settings) {
      if (!(key in d.settings)) d.settings[key] = starter.settings[key];
    }
    // Older saves used a terminal "complete" phase once every division's
    // bracket crowned a champion. The weekly calendar (js/calendar.js) now
    // drives that transition itself via calendarWeek, so fold "complete"
    // straight back into "offseason" on load.
    if (d.season.phase === "complete") d.season.phase = "offseason";
    if (d.season.calendarWeek == null) d.season.calendarWeek = 1;
    if (d.season.entryDraftDoneThisCycle == null) d.season.entryDraftDoneThisCycle = false;
    if (!d.season.playoffs) d.season.playoffs = {};
    d.divisions.forEach(function (div) {
      if (div.gamesPerWeek == null) {
        var starterDiv = starter.divisions.find(function (sd) { return sd.id === div.id; });
        div.gamesPerWeek = starterDiv ? starterDiv.gamesPerWeek : 2;
      }
    });
    d.players.forEach(function (p) {
      if (!p.attributes) p.attributes = U.deriveAttributes(p.overall, p.position, p.archetype);
      if (p.age == null) p.age = U.generateStartingAge();
      if (p.retirementAge == null) p.retirementAge = U.retirementAgeFor(p.age);
      if (!p.stats) p.stats = freshStatLine();
      if (p.starter == null) p.starter = false;
    });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  function resetToStarter() {
    data = deepClone(window.PHL_STARTER_DATA);
    migrate(data);
    save();
  }

  function exportJSON() {
    var stamp = new Date().toISOString().slice(0, 10);
    U.downloadJSON("phl-league-save-" + stamp + ".json", data);
  }

  function importFromObject(obj) {
    if (!obj || !obj.teams || !obj.divisions) {
      throw new Error("That file doesn't look like a PHL league save.");
    }
    data = obj;
    migrate(data);
    save();
  }

  // ---------------- Getters ----------------
  function getData() {
    return data;
  }
  function getSettings() {
    return data.settings;
  }
  function getDivisions() {
    return data.divisions;
  }
  function getDivision(id) {
    return data.divisions.find(function (d) {
      return d.id === id;
    });
  }
  function getTeams(divisionId) {
    if (!divisionId) return data.teams;
    return data.teams.filter(function (t) {
      return t.division === divisionId;
    });
  }
  function getTeam(id) {
    return data.teams.find(function (t) {
      return t.id === id;
    });
  }
  function getPlayers() {
    return data.players;
  }
  function getPlayer(id) {
    return data.players.find(function (p) {
      return p.id === id;
    });
  }
  function getRoster(teamId) {
    return data.players.filter(function (p) {
      return p.teamId === teamId && !p.retired;
    });
  }
  function getFreeAgents() {
    // Rostered = has a teamId. Draft pool players also have no teamId but
    // are flagged isDraftProspect while draft.active is true; once the
    // draft ends prospects left undrafted become free agents automatically.
    // Startup draft pool players (see startupDraft.js) are excluded the
    // same way until that one-time draft finishes with them.
    return data.players.filter(function (p) {
      return !p.teamId && !p.isDraftProspect && !p.startupDraftPool && !p.retired;
    });
  }
  function getRetiredPlayers() {
    return data.players.filter(function (p) {
      return !!p.retired;
    });
  }
  function getDraftPool() {
    return data.players.filter(function (p) {
      return p.isDraftProspect;
    });
  }
  function getStartupPool() {
    return data.players.filter(function (p) {
      return !!p.startupDraftPool;
    });
  }

  // ---------------- Team mutators ----------------
  function addTeam(team) {
    team.id = team.id || U.uid("team");
    team.wins = team.wins || 0;
    team.losses = team.losses || 0;
    team.otLosses = team.otLosses || 0;
    team.gf = team.gf || 0;
    team.ga = team.ga || 0;
    team.points = team.points || 0;
    data.teams.push(team);
    save();
    return team;
  }
  function updateTeam(id, patch) {
    var t = getTeam(id);
    if (!t) return null;
    Object.assign(t, patch);
    save();
    return t;
  }
  function deleteTeam(id) {
    data.teams = data.teams.filter(function (t) {
      return t.id !== id;
    });
    data.players.forEach(function (p) {
      if (p.teamId === id) p.teamId = null;
    });
    save();
  }

  // ---------------- Player mutators ----------------
  function addPlayer(player) {
    player.id = player.id || U.uid("player");
    if (player.stats == null) player.stats = freshStatLine();
    if (player.salary == null) player.salary = U.salaryAsking(player.overall || 60, player.potential || player.overall || 60);
    if (player.age == null) player.age = U.generateStartingAge();
    if (player.retirementAge == null) player.retirementAge = U.retirementAgeFor(player.age);
    data.players.push(player);
    save();
    return player;
  }
  function updatePlayer(id, patch) {
    var p = getPlayer(id);
    if (!p) return null;
    Object.assign(p, patch);
    save();
    return p;
  }
  function deletePlayer(id) {
    data.players = data.players.filter(function (p) {
      return p.id !== id;
    });
    save();
  }
  function freshStatLine() {
    return {
      gp: 0,
      g: 0,
      a: 0,
      pts: 0,
      plusMinus: 0,
      shotsAgainst: 0,
      saves: 0,
      svPct: 0,
      goalsAgainst: 0,
      gaa: 0,
    };
  }

  // ---------------- Season / schedule ----------------
  function getSeason() {
    return data.season;
  }
  function getSchedule(divisionId) {
    var sched = data.season.schedule || [];
    if (!divisionId) return sched;
    return sched.filter(function (g) {
      return g.divisionId === divisionId;
    });
  }
  function setSchedule(games) {
    data.season.schedule = games;
    save();
  }
  function updateSeason(patch) {
    Object.assign(data.season, patch);
    save();
  }
  function resetTeamRecords() {
    data.teams.forEach(function (t) {
      t.wins = 0;
      t.losses = 0;
      t.otLosses = 0;
      t.gf = 0;
      t.ga = 0;
      t.points = 0;
    });
    save();
  }
  function resetPlayerSeasonStats() {
    data.players.forEach(function (p) {
      p.stats = freshStatLine();
    });
    save();
  }

  // ---------------- Draft ----------------
  function getDraft() {
    return data.draft;
  }
  function updateDraft(patch) {
    Object.assign(data.draft, patch);
    save();
  }

  // ---------------- Franchise (GM's chosen division/team) ----------------
  function getFranchise() {
    return data.franchise;
  }
  function setFranchise(divisionId, teamId) {
    data.franchise.divisionId = divisionId;
    data.franchise.teamId = teamId;
    save();
  }

  // ---------------- Startup Draft (one-time, save-start) ----------------
  function getStartupDraft() {
    return data.startupDraft;
  }
  function updateStartupDraft(patch) {
    Object.assign(data.startupDraft, patch);
    save();
  }

  // ---------------- Promotions (off-season inter-division call-ups) ----
  function getPromotions() {
    return data.promotions;
  }
  function addPromotion(entry) {
    entry.id = entry.id || U.uid("promo");
    data.promotions.push(entry);
    save();
    return entry;
  }

  // ---------------- Expansion Draft (one-time per new expansion team) --
  function getExpansionDraft() {
    return data.expansionDraft;
  }
  function setExpansionDraft(ed) {
    data.expansionDraft = ed;
    save();
  }
  function updateExpansionDraft(patch) {
    if (!data.expansionDraft) return null;
    Object.assign(data.expansionDraft, patch);
    save();
    return data.expansionDraft;
  }

  // Is this the team the human GM currently manages? Every action that
  // touches a roster/contract (sign, release, re-sign, lineup, promote)
  // should gate on this — other teams are AI-managed and read-only to the
  // user (see js/aiManager.js for their automated behavior).
  function isManagedTeam(teamId) {
    return !!teamId && data.franchise.teamId === teamId;
  }

  // ---------------- Cap helpers ----------------
  // Salary cap is per-division (top divisions have bigger budgets), not a
  // single league-wide number.
  function capForTeam(teamId) {
    var t = getTeam(teamId);
    if (!t) return 0;
    var div = getDivision(t.division);
    return div && div.salaryCap != null ? div.salaryCap : 1000000;
  }
  function capUsed(teamId) {
    return getRoster(teamId).reduce(function (sum, p) {
      return sum + (p.salary || 0);
    }, 0);
  }
  function capSpace(teamId) {
    return capForTeam(teamId) - capUsed(teamId);
  }

  window.PHLState = {
    load: load,
    save: save,
    resetToStarter: resetToStarter,
    exportJSON: exportJSON,
    importFromObject: importFromObject,
    getData: getData,
    getSettings: getSettings,
    getDivisions: getDivisions,
    getDivision: getDivision,
    getTeams: getTeams,
    getTeam: getTeam,
    getPlayers: getPlayers,
    getPlayer: getPlayer,
    getRoster: getRoster,
    getFreeAgents: getFreeAgents,
    getDraftPool: getDraftPool,
    getStartupPool: getStartupPool,
    getRetiredPlayers: getRetiredPlayers,
    addTeam: addTeam,
    updateTeam: updateTeam,
    deleteTeam: deleteTeam,
    addPlayer: addPlayer,
    updatePlayer: updatePlayer,
    deletePlayer: deletePlayer,
    freshStatLine: freshStatLine,
    capForTeam: capForTeam,
    capUsed: capUsed,
    capSpace: capSpace,
    getSeason: getSeason,
    getSchedule: getSchedule,
    setSchedule: setSchedule,
    updateSeason: updateSeason,
    resetTeamRecords: resetTeamRecords,
    resetPlayerSeasonStats: resetPlayerSeasonStats,
    getDraft: getDraft,
    updateDraft: updateDraft,
    getFranchise: getFranchise,
    setFranchise: setFranchise,
    getStartupDraft: getStartupDraft,
    updateStartupDraft: updateStartupDraft,
    getPromotions: getPromotions,
    addPromotion: addPromotion,
    getExpansionDraft: getExpansionDraft,
    setExpansionDraft: setExpansionDraft,
    updateExpansionDraft: updateExpansionDraft,
    isManagedTeam: isManagedTeam,
  };
})();
