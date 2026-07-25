/* PHL Franchise Simulator — Player Messages
 * Global namespace: window.PHLPlayerMessages
 *
 * Once a week during the regular season (see js/calendar.js advanceWeek),
 * scans the user's OWN roster for two kinds of message triggers —
 * performance (well above or below what a player's Overall would suggest)
 * and playing time (a decent non-starter who's barely seeing the ice) —
 * and queues an Inbox entry (type "player-message") when one fires,
 * throttled by a per-player cooldown so nobody's mailbox gets spammed.
 *
 * This isn't just flavor text: p.unhappiness (0-100) accumulates from
 * negative messages, eases off from positive ones and a small constant
 * weekly decay, and feeds a real asking-price premium in js/contracts.js
 * (see effectiveAskingFor / unhappinessPremiumFactor) — an unhappy player
 * costs more to keep, and costs nothing extra to lose. At extreme
 * unhappiness a player can also send a trade-request message — a strong
 * nudge, not an automatic transaction; nothing forces the user's hand.
 *
 * Deliberately scoped to the user's own team only (same footprint as
 * js/scrims.js) — AI teams don't get inbox mail about their own locker
 * rooms.
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var U = window.PHLUtil;

  var MAX_UNHAPPINESS = 100;
  var COOLDOWN_WEEKS = 3; // minimum gap between messages for the same player
  var TRADE_REQUEST_THRESHOLD = 70;

  function bump(p, amount) {
    p.unhappiness = U.clamp((p.unhappiness || 0) + amount, 0, MAX_UNHAPPINESS);
  }

  // A single increasing counter across the whole save (season*1000+week) so
  // "weeks since last message" comparisons work even across a season
  // boundary, without needing to store season and week separately.
  function weekKey(season) {
    return (season.seasonNumber || 1) * 1000 + (season.calendarWeek || 0);
  }

  function offCooldown(p, currentKey) {
    return !p.lastMessageWeekKey || (currentKey - p.lastMessageWeekKey) >= COOLDOWN_WEEKS;
  }

  // A rough "what their Overall implies" points-per-game baseline —
  // deliberately soft, this is flavor logic driving message copy, not a
  // precision stat model.
  function expectedPtsPerGame(p) {
    return U.clamp((p.overall - 55) / 20, 0.1, 2.2);
  }

  function notify(p, team, kind, title, body) {
    if (!window.PHLInbox) return;
    window.PHLInbox.addNotification({
      type: "player-message",
      title: title,
      body: body,
      payload: { playerId: p.id, teamId: team.id, kind: kind },
    });
  }

  function checkPlayingTime(p, team, teamGamesPlayed) {
    if (p.starter) return false;
    if ((p.overall || 0) < 65) return false; // bench-caliber players don't expect to start
    if (teamGamesPlayed < 4) return false;
    var gp = (p.stats && p.stats.gp) || 0;
    if (gp / teamGamesPlayed >= 0.3) return false;
    if (Math.random() > 0.15) return false;
    bump(p, 15);
    notify(p, team, "playing-time",
      p.name + " is unhappy about playing time",
      p.name + " has played in only " + gp + " of the team's last " + teamGamesPlayed +
        " games and isn't happy about it. Keep them buried on the bench and they'll get harder — and pricier — to re-sign.");
    return true;
  }

  function checkPerformance(p, team) {
    var gp = (p.stats && p.stats.gp) || 0;
    if (gp < 4) return false;
    if (Math.random() > 0.12) return false;

    if (p.position === "G") {
      var svPct = p.stats.svPct || 0;
      if (svPct >= 0.915) {
        bump(p, -10);
        notify(p, team, "performance-hot", p.name + " is playing lights-out",
          p.name + " is stopping " + (svPct * 100).toFixed(1) + "% of shots this season and is feeling great about their game.");
        return true;
      }
      if (svPct > 0 && svPct <= 0.885) {
        bump(p, 10);
        notify(p, team, "performance-cold", p.name + " is in a slump",
          p.name + " is saving just " + (svPct * 100).toFixed(1) + "% of shots this season and is frustrated with how things are going.");
        return true;
      }
      return false;
    }

    var expected = expectedPtsPerGame(p);
    var actual = (p.stats.pts || 0) / gp;
    if (actual >= expected * 1.4) {
      bump(p, -10);
      notify(p, team, "performance-hot", p.name + " is on a heater",
        p.name + " is putting up " + actual.toFixed(2) + " points per game — well above expectations — and is feeling good about the season.");
      return true;
    }
    if (actual <= expected * 0.5) {
      bump(p, 10);
      notify(p, team, "performance-cold", p.name + " is in a slump",
        p.name + " is producing well below what's expected of them this season, and it's starting to show in their mood.");
      return true;
    }
    return false;
  }

  function checkTradeRequest(p, team) {
    if ((p.unhappiness || 0) < TRADE_REQUEST_THRESHOLD) return false;
    if (Math.random() > 0.1) return false;
    notify(p, team, "trade-request", p.name + " wants a change of scenery",
      p.name + " has grown frustrated enough to ask for a trade. Their asking price stays elevated for as long as they're this unhappy — a new contract is the only clean reset.");
    return true;
  }

  function weeklyCheck() {
    var franchise = S.getFranchise();
    if (!franchise || !franchise.teamId) return;
    var season = S.getSeason();
    if (season.phase !== "regular") return; // no messages during the offseason or playoffs
    var team = S.getTeam(franchise.teamId);
    if (!team) return;
    var teamGamesPlayed = (team.wins || 0) + (team.losses || 0) + (team.otLosses || 0);
    var currentKey = weekKey(season);

    S.getRoster(team.id).forEach(function (p) {
      bump(p, -1); // small constant decay every week, message or not
      if (!offCooldown(p, currentKey)) return;
      var fired = checkPlayingTime(p, team, teamGamesPlayed) || checkPerformance(p, team) || checkTradeRequest(p, team);
      if (fired) p.lastMessageWeekKey = currentKey;
    });
    S.save();
  }

  window.PHLPlayerMessages = {
    weeklyCheck: weeklyCheck,
  };
})();
