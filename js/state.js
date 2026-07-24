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
    if (!d.trades) d.trades = [];
    if (!d.signings) d.signings = [];
    if (!d.releases) d.releases = [];
    if (d.logSeq == null) d.logSeq = 0;
    if (!d.notifications) d.notifications = [];
    if (!d.mvpAwards) d.mvpAwards = [];
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
    if (!d.season.pendingGrowthPicks) d.season.pendingGrowthPicks = [];
    d.divisions.forEach(function (div) {
      var starterDiv = starter.divisions.find(function (sd) { return sd.id === div.id; });
      if (div.gamesPerWeek == null) {
        div.gamesPerWeek = starterDiv ? starterDiv.gamesPerWeek : 2;
      }
      if (div.overallCap === undefined) div.overallCap = starterDiv ? starterDiv.overallCap : null;
      if (div.salaryCapMax == null) div.salaryCapMax = starterDiv ? starterDiv.salaryCapMax : div.salaryCap;
    });
    // Backfill logoUrl on older saves (from before real PHL logos were
    // wired in) for any of the 26 built-in teams — matched by id, since
    // those ids are stable across starterData.js revisions. Teams with no
    // starter match (a "+ Add Team" or Expansion Franchise team) are left
    // alone and just render the plain colored-abbreviation fallback badge.
    d.teams.forEach(function (t) {
      if (t.logoUrl === undefined) t.logoUrl = null;
      if (!t.logoUrl) {
        var starterTeam = starter.teams.find(function (st) { return st.id === t.id; });
        if (starterTeam && starterTeam.logoUrl) t.logoUrl = starterTeam.logoUrl;
      }
      if (t.customColor === undefined) t.customColor = null;
      if (t.chemistry == null) t.chemistry = 50;
      if (t.scrimsThisWeek == null) t.scrimsThisWeek = 0;
    });
    d.players.forEach(function (p) {
      if (!p.attributes) p.attributes = U.deriveAttributes(p.overall, p.position, p.archetype);
      if (p.age == null) p.age = U.generateStartingAge();
      if (p.retirementAge == null) p.retirementAge = U.retirementAgeFor(p.age);
      if (!p.stats) p.stats = freshStatLine();
      if (!p.playoffStats) p.playoffStats = freshStatLine();
      if (p.statsAtHalf === undefined) p.statsAtHalf = null;
      if (p.starter == null) p.starter = false;
      if (p.nmc == null) p.nmc = false;
      if (!p.contractOfferHistory) p.contractOfferHistory = [];
    });
    d.teams.forEach(function (t) {
      if (t.lastSeasonWins == null) t.lastSeasonWins = 0;
      if (t.lastSeasonGames == null) t.lastSeasonGames = 0;
    });
    // Backfill logSeq (see nextLogSeq above) on any trade/promotion entry
    // from before the League Log tab existed, so older saves' history still
    // shows up there — best-effort ordering only (per-array insertion
    // order), since old entries predate the single shared counter.
    [d.promotions, d.trades, d.signings, d.releases].forEach(function (list) {
      list.forEach(function (entry) {
        if (entry.logSeq == null) {
          d.logSeq = (d.logSeq || 0) + 1;
          entry.logSeq = d.logSeq;
        }
      });
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
  function updateSettings(patch) {
    Object.assign(data.settings, patch);
    save();
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

  // ---------------- League Log ordering -----------------------------------
  // A single monotonic counter stamped on every trade/signing/release/
  // promotion entry (see below) so the League Log tab (js/leagueLog.js) can
  // merge all four event types into one true chronological feed just by
  // sorting on logSeq — real timestamps aren't reliable here since several
  // events can happen within the same Advance Week tick.
  function nextLogSeq() {
    data.logSeq = (data.logSeq || 0) + 1;
    return data.logSeq;
  }

  // ---------------- Promotions (off-season inter-division call-ups) ----
  function getPromotions() {
    return data.promotions;
  }
  function addPromotion(entry) {
    entry.id = entry.id || U.uid("promo");
    entry.logSeq = nextLogSeq();
    data.promotions.push(entry);
    save();
    return entry;
  }

  // ---------------- Trades (player-for-player between two teams) -------
  function getTrades() {
    return data.trades;
  }
  function addTrade(entry) {
    entry.id = entry.id || U.uid("trade");
    entry.logSeq = nextLogSeq();
    data.trades.push(entry);
    save();
    return entry;
  }

  // ---------------- Signings (free-agent + re-signs, league-wide) -------
  function getSignings() {
    return data.signings;
  }
  function addSigning(entry) {
    entry.id = entry.id || U.uid("sign");
    entry.season = entry.season || (data.season ? data.season.seasonNumber || 1 : 1);
    entry.logSeq = nextLogSeq();
    data.signings.push(entry);
    save();
    return entry;
  }

  // ---------------- Releases (league-wide) -------------------------------
  function getReleases() {
    return data.releases;
  }
  function addRelease(entry) {
    entry.id = entry.id || U.uid("release");
    entry.season = entry.season || (data.season ? data.season.seasonNumber || 1 : 1);
    entry.logSeq = nextLogSeq();
    data.releases.push(entry);
    save();
    return entry;
  }

  // ---------------- Roster minimum (2F / 2D / 1G, 5 players min) --------
  // Enforced for EVERY team (AI included) — see js/contracts.js (release),
  // js/trades.js (both sides of any trade), js/promotions.js (donor side
  // of a call-up), and js/aiManager.js (AI cap-compliance releases). Only
  // enforced OUTSIDE the off-season — the off-season is a rebuilding
  // window where a roster is allowed to dip below the minimum (see
  // wouldMeetRosterMinimum below); it's a hard block again the moment the
  // regular season starts.
  var ROSTER_MIN = { F: 2, D: 2, G: 1, total: 5 };
  function rosterMeetsMinimum(players) {
    var counts = { F: 0, D: 0, G: 0 };
    players.forEach(function (p) { if (counts[p.position] != null) counts[p.position] += 1; });
    return players.length >= ROSTER_MIN.total && counts.F >= ROSTER_MIN.F && counts.D >= ROSTER_MIN.D && counts.G >= ROSTER_MIN.G;
  }
  // Would `teamId`'s roster still meet the hard minimum if `removeIds` left
  // and `addPlayers` (full player objects, e.g. an incoming trade piece)
  // joined? Pass no removeIds/addPlayers to just check the current roster.
  // Always true during the off-season — see the note above.
  function wouldMeetRosterMinimum(teamId, removeIds, addPlayers) {
    if (data.season && data.season.phase === "offseason") return true;
    removeIds = removeIds || [];
    addPlayers = addPlayers || [];
    var roster = getRoster(teamId)
      .filter(function (p) { return removeIds.indexOf(p.id) === -1; })
      .concat(addPlayers);
    return rosterMeetsMinimum(roster);
  }

  // ---------------- Goalie sub-cap (max 3 per team) -----------------------
  // Enforced anywhere a goalie can join a roster (signing, trading,
  // promoting, the Startup Draft) — see js/contracts.js, js/trades.js,
  // js/promotions.js, js/aiManager.js, js/startupDraft.js.
  var GOALIE_MAX = 3;
  function goalieCountForTeam(teamId) {
    return getRoster(teamId).filter(function (p) { return p.position === "G"; }).length;
  }
  // Would `teamId`'s roster still be at/under the goalie sub-cap if
  // `removeIds` left and `addPlayers` joined?
  function wouldMeetGoalieMax(teamId, removeIds, addPlayers) {
    removeIds = removeIds || [];
    addPlayers = addPlayers || [];
    var goalieCount = getRoster(teamId)
      .filter(function (p) { return removeIds.indexOf(p.id) === -1; })
      .concat(addPlayers)
      .filter(function (p) { return p.position === "G"; }).length;
    return goalieCount <= GOALIE_MAX;
  }

  // ---------------- Notifications (Inbox) --------------------------------
  function getNotifications() {
    return data.notifications;
  }
  function addNotification(entry) {
    entry.id = entry.id || U.uid("notif");
    entry.read = !!entry.read;
    if (entry.createdSeason == null) entry.createdSeason = (data.season && data.season.seasonNumber) || 1;
    data.notifications.unshift(entry);
    // Keep the log from growing unbounded across a long save.
    if (data.notifications.length > 300) data.notifications.length = 300;
    save();
    return entry;
  }
  function markNotificationRead(id) {
    var n = data.notifications.find(function (x) { return x.id === id; });
    if (n) { n.read = true; save(); }
    return n;
  }
  function markAllNotificationsRead() {
    data.notifications.forEach(function (n) { n.read = true; });
    save();
  }
  function unreadNotificationCount() {
    return data.notifications.filter(function (n) { return !n.read; }).length;
  }
  function removeNotification(id) {
    data.notifications = data.notifications.filter(function (n) { return n.id !== id; });
    save();
  }

  // ---------------- MVP Awards -------------------------------------------
  function getMvpAwards() {
    return data.mvpAwards;
  }
  function addMvpAward(entry) {
    entry.id = entry.id || U.uid("mvp");
    data.mvpAwards.push(entry);
    save();
    return entry;
  }

  // ---------------- Playoff stat tracking ---------------------------------
  // Wiped for a division's currently-rostered players each time that
  // division's bracket starts (see js/playoffs.js startPlayoffs) so playoff
  // stats/leaderboards reflect only the playoffs currently underway.
  function resetPlayoffStatsForDivision(divisionId) {
    var teamIds = getTeams(divisionId).map(function (t) { return t.id; });
    data.players.forEach(function (p) {
      if (p.teamId && teamIds.indexOf(p.teamId) !== -1) p.playoffStats = freshStatLine();
    });
    save();
  }

  // ---------------- Team chemistry (Scrims) --------------------------------
  function addChemistry(teamId, amount) {
    var t = getTeam(teamId);
    if (!t) return null;
    t.chemistry = U.clamp((t.chemistry == null ? 50 : t.chemistry) + amount, 0, 100);
    save();
    return t.chemistry;
  }

  // Is this the team the human GM currently manages? Every action that
  // touches a roster/contract (sign, release, re-sign, lineup, promote)
  // should gate on this — other teams are AI-managed and read-only to the
  // user (see js/aiManager.js for their automated behavior).
  function isManagedTeam(teamId) {
    return !!teamId && data.franchise.teamId === teamId;
  }

  // Is `teamId` the user's own team, or another team in the user's own
  // division? Used to scope league-wide push notifications (Inbox entries
  // for AI trades, MVP awards, division championships, etc. — see
  // js/aiManager.js, js/calendar.js, js/mvp.js, js/playoffs.js) down to
  // "your team + your division" instead of firing for the whole league.
  // Trade History / Promotion History and similar log tables are NOT
  // affected by this — they keep showing every event league-wide.
  function isUserRelevantTeam(teamId) {
    if (!teamId) return false;
    if (isManagedTeam(teamId)) return true;
    var myTeam = getTeam(data.franchise.teamId);
    var t = getTeam(teamId);
    return !!(myTeam && t && myTeam.division === t.division);
  }

  // ---------------- Cap helpers ----------------
  // Salary cap is per-division (top divisions have bigger budgets), not a
  // single league-wide number. Each team's effective cap also scales up
  // from the division base toward the division max based on how many of
  // their games they won last season (see snapshotTeamRecordsForCap) —
  // winning more games this season raises next season's cap faster.
  function capForTeam(teamId) {
    var t = getTeam(teamId);
    if (!t) return 0;
    var div = getDivision(t.division);
    var base = div && div.salaryCap != null ? div.salaryCap : 1000000;
    var max = div && div.salaryCapMax != null ? div.salaryCapMax : base;
    var games = t.lastSeasonGames || 0;
    if (games <= 0) return base;
    var winPct = U.clamp((t.lastSeasonWins || 0) / games, 0, 1);
    return Math.round(base + winPct * (max - base));
  }
  function capUsed(teamId) {
    return getRoster(teamId).reduce(function (sum, p) {
      return sum + (p.salary || 0);
    }, 0);
  }
  function capSpace(teamId) {
    return capForTeam(teamId) - capUsed(teamId);
  }
  // Snapshot each team's just-concluded regular season W-L-OTL record onto
  // lastSeasonWins/lastSeasonGames so capForTeam(...) can keep scaling off
  // it after resetTeamRecords() wipes the live record for the new season.
  // Must be called BEFORE resetTeamRecords() each new season.
  function snapshotTeamRecordsForCap() {
    data.teams.forEach(function (t) {
      var games = (t.wins || 0) + (t.losses || 0) + (t.otLosses || 0);
      if (games > 0) {
        t.lastSeasonWins = t.wins || 0;
        t.lastSeasonGames = games;
      }
    });
    save();
  }

  // ---------------- Overall cutoffs (division ceilings) ------------------
  // A division's overallCap (see js/starterData.js) is the highest overall
  // a player may have while rostered/drafted there — null means uncapped
  // (Pro division). Enforced as a blocking guard at every division-entry
  // point: Startup Draft picks, trades, promotions/call-ups, and free-agent
  // signings, for both the user and AI teams (see js/trades.js,
  // js/contracts.js, js/promotions.js, js/aiManager.js, js/startupDraft.js).
  // Growth (js/stats.js developPlayer, js/playoffs.js series-win bumps) is
  // NOT capped — a player who crosses the cutoff mid-season finishes that
  // season on the roster; see releasePlayersAboveOverallCutoff below for
  // what happens to them once the off-season begins.
  function overallCapForDivision(divisionId) {
    var div = getDivision(divisionId);
    return div && div.overallCap != null ? div.overallCap : null;
  }
  function meetsOverallCap(overall, divisionId) {
    var cap = overallCapForDivision(divisionId);
    if (cap == null) return true;
    return overall <= cap;
  }
  // Force-releases any rostered player who's currently above their
  // division's overall cutoff — called once each time the off-season
  // begins (see js/calendar.js runPlayoffsWeek). A player can grow past
  // the cutoff mid-season and keep playing (see developPlayer/onSeriesWon),
  // but a team has to let them walk once the season that happened in ends.
  // NMC does NOT protect against this — it's a forced compliance cut, not
  // a voluntary roster move. Returns the list of released players.
  function releasePlayersAboveOverallCutoff() {
    var released = [];
    data.players.forEach(function (p) {
      if (!p.teamId || p.retired) return;
      var team = getTeam(p.teamId);
      if (!team) return;
      if (!meetsOverallCap(p.overall, team.division)) {
        released.push({ player: p, teamId: p.teamId });
        addRelease({ teamId: p.teamId, playerId: p.id, playerName: p.name, reason: "overall-cutoff" });
        p.teamId = null;
      }
    });
    if (released.length) save();
    return released;
  }

  // ---------------- No-Movement Clause (NMC) ------------------------------
  // A manually-toggled flag (p.nmc) the user sets from Team Management to
  // protect up to NMC_MAX_PER_TEAM players from being released, traded, or
  // promoted away. AI teams don't self-assign NMCs.
  var NMC_MAX_PER_TEAM = 2;
  function nmcCountForTeam(teamId) {
    return getRoster(teamId).filter(function (p) { return !!p.nmc; }).length;
  }

  // ---------------- Trade deadline / transaction window -------------------
  // True while trades, free-agent signings, and releases are allowed. The
  // window is open all offseason and through the first 11 calendar weeks of
  // the regular season (weeks 1-9 play games, 10-11 are the trade-deadline
  // break) and closes league-wide from week 12 through the end of playoffs,
  // reopening again once the next offseason begins. Note: this deliberately
  // does NOT gate js/aiManager.js's autoReleaseToCompliance() — that's a
  // forced cap-compliance safety valve, not a voluntary roster move.
  function isTransactionWindowOpen() {
    var season = data.season;
    if (!season) return true;
    if (season.phase === "offseason") return true;
    if (season.phase === "regular") return (season.calendarWeek || 1) <= 11;
    return false; // playoffs
  }

  // ---------------- Contract offer history ---------------------------------
  // Tracks sign + re-sign offers made to a player, by season, so
  // js/contracts.js can enforce "at most 3 offers per player per season,
  // and each offer amount must differ from the player's prior offers this
  // season" (years may repeat).
  function getSeasonNumber() {
    return (data.season && data.season.seasonNumber) || 1;
  }
  function contractOffersThisSeason(playerId) {
    var p = getPlayer(playerId);
    if (!p || !p.contractOfferHistory) return [];
    var sn = getSeasonNumber();
    return p.contractOfferHistory.filter(function (o) { return o.season === sn; });
  }
  function recordContractOffer(playerId, amount) {
    var p = getPlayer(playerId);
    if (!p) return;
    if (!p.contractOfferHistory) p.contractOfferHistory = [];
    p.contractOfferHistory.push({ season: getSeasonNumber(), amount: amount });
    save();
  }

  window.PHLState = {
    load: load,
    save: save,
    resetToStarter: resetToStarter,
    exportJSON: exportJSON,
    importFromObject: importFromObject,
    getData: getData,
    getSettings: getSettings,
    updateSettings: updateSettings,
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
    snapshotTeamRecordsForCap: snapshotTeamRecordsForCap,
    overallCapForDivision: overallCapForDivision,
    meetsOverallCap: meetsOverallCap,
    releasePlayersAboveOverallCutoff: releasePlayersAboveOverallCutoff,
    NMC_MAX_PER_TEAM: NMC_MAX_PER_TEAM,
    nmcCountForTeam: nmcCountForTeam,
    isTransactionWindowOpen: isTransactionWindowOpen,
    contractOffersThisSeason: contractOffersThisSeason,
    recordContractOffer: recordContractOffer,
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
    getTrades: getTrades,
    addTrade: addTrade,
    getSignings: getSignings,
    addSigning: addSigning,
    getReleases: getReleases,
    addRelease: addRelease,
    isManagedTeam: isManagedTeam,
    isUserRelevantTeam: isUserRelevantTeam,
    ROSTER_MIN: ROSTER_MIN,
    rosterMeetsMinimum: rosterMeetsMinimum,
    wouldMeetRosterMinimum: wouldMeetRosterMinimum,
    GOALIE_MAX: GOALIE_MAX,
    goalieCountForTeam: goalieCountForTeam,
    wouldMeetGoalieMax: wouldMeetGoalieMax,
    getNotifications: getNotifications,
    addNotification: addNotification,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    unreadNotificationCount: unreadNotificationCount,
    removeNotification: removeNotification,
    getMvpAwards: getMvpAwards,
    addMvpAward: addMvpAward,
    resetPlayoffStatsForDivision: resetPlayoffStatsForDivision,
    addChemistry: addChemistry,
  };
})();
