# PHL Franchise Simulator

A free, browser-based fantasy franchise simulator for **PHL** — a custom
league built around [Puck](https://store.steampowered.com/), the free
hockey-like game on Steam. Manage rosters, simulate seasons, run playoffs,
draft prospects, and juggle contracts under a salary cap — all client-side,
no server or account required. The simulation itself runs entirely offline;
the one exception is team logos, which are hotlinked from the real PHL's
site and need an internet connection to load (see **Interface** below) —
everything falls back gracefully to a plain badge without one.

Built as a static site (plain HTML/CSS/JS, no build step) so it's easy to
fork, host on GitHub Pages, or just double-click `index.html` and play.

## Quick start

**Option 1 — just open it.** Double-click `create-save.html` (not
`index.html` — see **Starting a save** below). Everything runs in your
browser; your league is saved to that browser's local storage as you play.

**Option 2 — host it.** Push this repo to GitHub and enable **GitHub
Pages** (Settings → Pages → Deploy from branch → `main` / root). No build
step needed — it's ready as-is.

**Option 3 — local server** (useful for development): from this folder run
`python3 -m http.server 8000` and open `http://localhost:8000`.

## Starting a save

`create-save.html` is a standalone wizard — separate from the main app —
where you make one decision up front, before anything else happens:

- **Manage an Existing Team** — pick a division, then a team already in the
  league. The Startup Draft runs **8 rounds per phase**.
- **Create an Expansion Franchise** — pick a division and give your brand-new
  team a name and abbreviation; it joins the league alongside the existing
  teams and becomes the team you manage. The Startup Draft runs **6 rounds
  per phase** instead of 8, since one extra team is now drawing from the
  same fixed-size real player pool.

Submitting the wizard writes that choice into your save and sends you to
`index.html` to actually play — the round count you picked applies for the
rest of that save's Startup Draft; it isn't something you can change
mid-save. If a save is already in progress, visiting `create-save.html`
again warns you first (Continue This Save / Start a Fresh Save Instead)
before it lets you overwrite anything. `index.html` itself will bounce you
back to `create-save.html` automatically any time it finds no franchise
team chosen yet (a brand-new save, or one wiped via **Data Tools → Reset**).

## What's included

- **Divisions & Teams** — the current PHL structure: **Pro** (top tier),
  **Contender** (mid tier), and **Prospect** (entry tier), pre-loaded with
  the real division/team names. (Room is left in the data model for the
  planned **IAPL** sub-division to slot in later.)
- **Player database** — add your own players by hand through the in-browser
  editor: Nametag, Position (Forward/Defense/Goalie), Archetype (playstyle —
  see below), Overall (1-99), and Potential (1-99, their ceiling). Puck is
  played 2 Forwards + 2 Defenders + 1 Goalie per side, and stats tracked are
  Goals, Assists, Points, +/-, Save %, and GAA, matching that format.
- **Archetypes** — a playstyle tag per player (Goal Scorer, Playmaker,
  Two-Way Forward, Power Forward for forwards; Offensive/Two-Way/Stalwart
  Defenseman for defense; The Wall, Hybrid, Puck-Handler for goalies). Each
  archetype nudges the hidden ratings the sim engine actually uses, so it's
  not just flavor — a Goal Scorer really does shoot more and defend less
  than a Power Forward with the same Overall.
- **Hidden age, decline & retirement** — PHL players never disclose an exact
  age (just that they're 16+), so age is never shown in the UI. Internally,
  every player gets a quietly-estimated starting age (skewed young — most
  players enter in their late teens), skill starts declining around 29, and
  each player retires 7-12 seasons after they entered the league — so the
  very first retirement in a fresh save won't happen before roughly **Season
  7**. All of this happens automatically — there's nothing to configure.
- **Player growth** — a young player below their Potential develops toward
  it every season, automatically (not tied to on-ice performance). Growth is
  fastest through the early-to-mid 20s, tapers off approaching the decline
  age, and closes bigger Overall-to-Potential gaps faster than small ones —
  so a high-Potential prospect reliably climbs most of the way to their
  ceiling over a handful of seasons instead of drifting up a point at a
  time. Once decline sets in, growth stops and Overall trends back down
  instead.
- **Breakout rookies** — each new season, a fresh batch of lower-overall,
  wide-potential rookies enters free agency directly (no draft — see
  below). They can only be signed by Prospect teams (occasionally
  Contender) at first — never straight to Pro. Once signed once, that
  restriction is gone for future free agency. Procedurally generated
  rookies and prospects use esports-style gamertags (e.g. `NeoFalcon`,
  `xXFrostReaperXx`) rather than real-person names, matching the real PHL
  roster's own naming convention — see **The real PHL player pool** below.
- **Only one draft per save** — the sole draft in a save is the one-time
  **Startup Draft** (see below). There's no recurring annual entry draft
  anymore; every new rookie class generated during the off-season lands
  straight in free agency instead, first-come-first-served for any team
  (subject to the Prospect/Contender-only breakout restriction above).
- **One button runs the whole season — "Advance Week"** — there's no more
  clicking separate "simulate," "start playoffs," or "start new season"
  buttons. A single **Advance Week** button lives in the top-right header at
  all times; clicking it moves the calendar forward exactly one week and
  simulates whatever that week calls for. See **The weekly calendar**
  below for the full season structure it drives.
- **Season simulation** — the schedule is generated so every team lands on
  an *exact* game count for its division (see below) and simulates games
  using a rating-based engine (team/goalie ratings + randomness decide the
  score; individual goals and assists are credited to specific players).
  Click any played game on the **Schedule** tab to expand a full per-game
  box score (skater G/A/PTS/+/-, goalie SV/SA/GA/SV%/GAA for both teams).
- **Standings** — live win/loss/OT/points tables per division.
- **Individual team pages** — click any team's name (from Teams, Standings,
  or anywhere else it appears as a link) to open a PHLstats-style team page:
  record and cap summary, full skater and goalie stat tables, and a recent
  results log — for any team in the league, not just the one you manage.
- **Playoffs** — best-of-7 series throughout (every round, including Wild
  Card), but the bracket format differs by
  division: **Pro** takes its top 4 straight into the bracket; **Contender**
  takes its top 8 straight into an 8-team bracket; **Prospect** gives its
  top 6 a bye while seeds 7-10 play a Wild Card round for the final 2
  bracket spots (mirroring the 8-team bracket size). A team that finishes
  outside a division's playoff line — including a freshly added expansion
  team — just misses the playoffs, no special-casing needed. It's a real
  tournament-bracket view: **Sim Game** resolves one game in a series,
  **Sim Series** finishes that matchup outright, or just hit **Advance
  Week** to simulate the whole current round for you — mix and match
  freely, since Advance Week only fills in whatever a round's series
  haven't already decided on their own.
- **Startup Draft** — a one-time draft at the start of every save, using
  the division/team (or Expansion Franchise) you chose on the **Create
  Save** page. The real PHL player pool (baked into the site — see below)
  is drafted in three cascading phases: **Pro** drafts first from the
  entire pool, snake order, then **Contender** drafts from whoever Pro left
  behind, then **Prospect** gets whatever's left after that. Each phase
  runs 8 rounds normally, or 6 if your save includes an Expansion
  Franchise (see **Starting a save** above). Draft order for every phase
  comes from a single random shuffle made once when you start.
  AI teams draft best-player-available while making sure they cover a
  viable lineup (at least 2F/2D/1G) before chasing extra depth, so a
  clearly elite player reliably goes in the first phase it's eligible
  for. Watch AI picks resolve one at a time (or fast-forward to your next
  turn), draft manually when it's your team's turn, and set your own
  starters/bench once it's done — the sim automatically falls back to
  best-available for any position you haven't manually set. Because the
  real player pool has a fixed number of players, it can run out before
  every team completes every round, especially deep into the Prospect
  phase — teams just end up with whatever roster size the pool allowed.
- **Promotions (off-season call-ups)** — during the off-season, a manager
  can permanently call up a rostered player from any strictly lower-tier
  division onto their own team from the **Promotions** tab. There's no
  negotiation: a league-set call-up fee (the same Overall/Potential-based
  valuation used for free-agent asking prices) has to fit in the acquiring
  team's cap space alongside the player's freshly recalculated salary, or
  the move is blocked. Every completed call-up is logged in a Promotion
  History table. This is separate from — and off-season-only, unlike —
  normal free-agent signings. The AI runs its own promotions too (see
  **AI proactivity** below) — and it can never call up a player off *your*
  roster, even if your team happens to sit in a division below an AI
  team's.
- **Trades** — propose a player-for-player trade with any other team from
  the **Trades** tab: pick a partner, check off who's coming from each
  side, and propose. Every player shows a transparent **trade value**
  (Overall + unrealized Potential, minus salary drag, plus years of
  contractual control) so it's clear going in whether an offer is
  reasonable. The other team's side is evaluated automatically — it won't
  accept giving up meaningfully more value than it receives — and a trade
  that would leave either side over the roster limit or the salary cap
  can't be proposed at all. Every completed trade is logged in a Trade
  History table.
- **Contracts & Cap** — salary cap is set **per division** (Prospect
  $1,000,000/yr, Contender $2,000,000/yr, Pro $4,000,000/yr team budgets),
  reflecting that top-tier orgs have bigger budgets. Every player has an
  **asking price** — Overall/Potential, adjusted for how they've actually
  performed *this season* and which division's paying — shown right in the
  Contracts tab for both your roster and the free-agent pool. Signing or
  re-signing opens a negotiation panel: pick a **contract length from 1 to
  5 years** and an offer amount. Offer at or above asking and it's almost
  always accepted; lowball it and there's a real, visible **chance the
  player turns you down** (a long deal at a steep discount is the riskiest
  combination) — a rejected offer changes nothing, so just try again with
  better terms. **Cap enforcement**: if your own team is over its
  division's cap, **Advance Week is blocked** with a banner explaining
  exactly how far over you are — fix it yourself in Contracts (release or
  trade a player) before you can continue. AI teams that go over cap are
  fixed automatically and silently (lowest-rated players released first)
  so the league never gets stuck on their account.
- **Stats leaderboards** — league leaders in Points, Goals, Assists, +/-,
  SV%, and GAA.
- **Data Tools** — export your whole league as a JSON file (for backup or
  to share/commit to GitHub), import someone else's league file, or reset
  to the starter data.

## The weekly calendar

The whole season runs on one clock, advanced one week at a time by the
**Advance Week** button in the header. Every season follows the same
21-week cycle:

1. **5-week off-season** — freeform. Free agency, Contracts, Trades, and
   Promotions are all open across every one of the 5 weeks, in any order
   you like. AI teams sign free agents and run promotions every off-season
   week. A new breakout-rookie class joins free agency and the
   regular-season schedule is generated right at the end of week 5.
2. **12-week regular season** — **Pro** plays 2 games/week (24 games total);
   **Contender** and **Prospect** play 3 games/week (36 games total each).
   Every team lands on that exact game count.
3. **Up to 4 weeks of playoffs** — a bracket round resolves per division
   per week by default, but you're not stuck waiting on the calendar: play
   through the current round yourself with Sim Game/Sim Series (see
   **Playoffs** above) as fast as you want, and Advance Week just picks up
   whatever's left. **Pro**'s 2-round bracket wraps up in 2 weeks (at
   most); **Contender**'s 3-round bracket in 3; **Prospect**'s 4-round
   bracket (including its Wild Card round) uses up to 4. Shorter brackets
   simply idle, already-crowned, until every division has a champion.
4. Back to a fresh 5-week off-season — ages/declines/retires players,
   generates a new breakout-rookie class, and repeats indefinitely.

Advance Week is disabled (with an on-screen reason) whenever it can't
safely proceed: the Startup Draft hasn't been finished yet, or your own
team is over the salary cap.

## The real PHL player pool

This site ships with the real PHL Season 4 player pool baked in (192
players pulled from every division's live rosters — including
inactive/limited/benched players — rated from their actual stats, using
their real in-game gamertags). Nobody starts on a team; they all seed the
**Startup Draft** described above. Replace or add to `startupPool` in
`js/starterData.js` any time the real rosters change.

## Adding your own teams & players

You don't need to touch any code. Open the site, go to **Teams** to add or
edit teams/divisions, and **Players** to build out rosters — or click
**Generate Sample Roster** on the Players tab to instantly fill every team
with randomized placeholder players so you can test-drive the simulator
before entering real data.

**+ Add Team** on the Teams tab is a plain commissioner/league-building
tool — add a bare, AI-controlled team to any division at any point. It
does **not** change who you manage (that's an Expansion Franchise's job —
see **Starting a save** above, since that's a save-creation-time choice
now, not something you do mid-save from this tab). A team added here joins
that division's standings/schedule the next time the schedule regenerates,
and playoff qualification is always "top N by standings," so it just
misses the postseason if it finishes outside the line, like anyone else.
Teams created as an Expansion Franchise at save creation show a small
**Expansion** badge on their team card here, purely informational.

## Restricted team management

You can only manage contracts, promotions, and starting lineups for the one
team you're the GM of (shown via a **GM** badge on the Teams tab). The
**Contracts** and **Promotions** tabs always operate on your team — there's
no team picker anymore. On the **Players** tab, other teams' rostered
players show an "AI-managed" label in place of the Starter/Bench toggle.
Browsing other teams' rosters and stats is unrestricted — see **Individual
team pages** above — only *changing* another team's roster is off-limits.
(The Teams tab's Add/Edit/Delete Team controls remain unrestricted, since
they're commissioner/league-setup tools rather than in-game GM actions.)

## AI proactivity

Every AI-controlled team signs free agents and runs promotions on its own,
every off-season week — no manager input required. Each AI team first
fills any hole below its minimum lineup requirements, then spends
remaining cap space on affordable depth/upgrades (capped at a handful of
moves per team per week so one team doesn't hoover up the whole free-agent
pool in one tick). Contract offers go through the same asking-price and
reject-chance system a human negotiation does — an AI signing isn't a sure
thing just because it's automatic, though the AI always offers a fair
price rather than lowballing. Promotions follow the same call-up rules a
human manager would use (a clear upgrade — +3 Overall or more over the
weakest player at that position — that the team can actually afford), and
each AI team attempts at most one call-up per week. Crucially, the AI's
candidate pool for promotions always excludes your own roster — no AI team
can call up a player away from the team you manage, even if your team sits
in a division below theirs.

## Interface

The app is a dark, glow-accented "command center" theme: a persistent left
sidebar (your franchise crest, GM info, and every tab) plus a header bar
with at-a-glance stat pills (season, phase, week, teams, your cap space)
and the Advance Week button, always in the same place regardless of which
tab you're on. On narrow screens the sidebar collapses into a
horizontally-scrolling top bar so everything still fits on mobile.

**Team logos** are hotlinked directly from the real PHL's own site,
[phlstats.com](https://phlstats.com) (its Season 4 team logo set) — every
team's `logoUrl` in `js/starterData.js` points straight at the image on
that site, so nothing is bundled into this repo. If a logo can't load (no
internet connection, that URL changes, phlstats.com is unreachable, etc.)
each team automatically falls back to a plain colored abbreviation badge —
see `U.crestHtml()` in `js/utils.js` — so the UI never shows a broken
image. A team with no logo on file at all (a fresh Expansion Franchise, or
a plain "+ Add Team" league-builder team) always uses that same fallback
badge. If you'd rather the logos be bundled locally instead of hotlinked
(e.g. for guaranteed offline play), drop the image files into an `assets/`
folder and point each team's `logoUrl` at the local path instead — no
other code changes needed.

For a real, full-league database (hundreds of players), typing them in one
at a time through the web form is slow. The easiest path is the
`PHL_Player_Database_Template.xlsx` spreadsheet — one row per player (Team,
Nametag, Position, Archetype, Overall, Potential, and two optional columns
for Contract Years / Salary), with dropdowns for Team/Position/Archetype and
a reference tab explaining each archetype. Fill it out (all at once, or a
few teams at a time), and whoever's maintaining the site's code converts it
straight into `js/starterData.js` — no manual re-typing.

## Sharing a league on GitHub

Your live save lives in the browser's local storage, which doesn't travel
with the repo. To ship a specific league (say, the real current PHL
rosters) with the site itself:

1. Build out your league in the browser (Teams + Players tabs).
2. Go to **Data Tools → Export League as JSON**.
3. Open the exported file and the `window.PHL_STARTER_DATA = { ... };`
   assignment in `js/starterData.js`, then replace the object literal in
   `starterData.js` with your exported data (keep the `window.PHL_STARTER_DATA =`
   wrapper and the file's `(function () { "use strict"; ... })();` shell).
4. Commit `js/starterData.js`. Anyone who clones the repo (or visits your
   GitHub Pages site) now starts from your league instead of an empty one.

Alternatively, just commit an exported `.json` save file to the repo and
tell people to load it via **Data Tools → Import League JSON** after
opening the site — no code edits required.

## Data model (for anyone extending this)

Everything lives in one JSON-serializable object (see `js/starterData.js`
for the shape, `js/state.js` for the accessors):

- `divisions` — `{ id, name, tier, salaryCap, playoff: { teams, byes } }`.
  Tier is a plain number (higher = better); there's nothing hardcoded to
  exactly three divisions, so a new one (e.g. IAPL) can be added the same
  way, with its own cap and playoff format. `playoff.teams` is how many
  teams by standings are playoff-eligible; `playoff.byes` is how many skip
  straight to the main bracket (the rest play a Wild Card round for the
  remaining spot(s)).
- `teams` — `{ id, name, abbr, division, wins, losses, otLosses, gf, ga, points,
  isExpansionTeam }`. `isExpansionTeam` is only ever set (`true`) on a team
  created through the Create Save wizard's Expansion Franchise path — it's
  purely informational (drives the "Expansion" badge on the Teams tab) and
  nothing else reads it.
- `players` — `{ id, name, position (F/D/G), archetype, overall, potential,
  attributes: { offense, defense, goaltending } (derived from overall +
  position + archetype, not hand-entered), age & retirementAge (hidden,
  never shown in the UI), retired, salary, contractYears, teamId, starter
  (manual lineup flag — see Startup Draft above), isDraftProspect,
  startupDraftPool (true until the Startup Draft assigns them a team),
  eligibleDivisions (breakout-rookie restriction, cleared after first
  signing), stats }`.
- `season` — `{ seasonNumber, phase, calendarWeek, schedule, playoffs }`.
  `phase` cycles `"offseason" -> "regular" -> "playoffs"`, then back to
  `"offseason"` — driven entirely by `js/calendar.js`'s `advanceWeek()`,
  the single state machine behind the header's Advance Week button.
  `calendarWeek` is 1-based *within* the current phase (resets to 1 at
  each phase transition); `seasonNumber` increments at the playoffs ->
  offseason transition. (Older saves may still carry a now-unused
  `entryDraftDoneThisCycle` flag from before the recurring Entry Draft was
  removed — harmless, safe to ignore.)
- `franchise` — `{ divisionId, teamId }`, the one team the human is
  currently GM of. Set exactly once, up front, by the Create Save wizard
  (`create-save.html` / `js/createSave.js`) — nothing in the main app
  changes it mid-save. `index.html` redirects to `create-save.html`
  whenever it finds `teamId` still `null`.
- `startupDraft` — `{ status, phase, phaseIndex, masterOrder,
  phaseTeamOrder, pickIndexInPhase, roundsPerPhase, picks }`, the one-time
  cascading draft's state (see js/startupDraft.js). `roundsPerPhase` is
  copied from `settings.startupDraftRounds` the moment the draft starts.
- `promotions` — array of `{ id, season, fromTeamId, toTeamId, playerId,
  fee }` log entries, one per completed off-season call-up (both
  human-initiated and AI-initiated — see js/promotions.js and
  js/aiManager.js).
- `trades` — array of `{ id, season, teamAId, teamBId, playersToA,
  playersToB }` log entries, one per completed trade (see js/trades.js).
- `settings` — roster max, active lineup shape, off-season/regular-season
  week counts, per-division games-per-week, `startupDraftRounds` (8 or 6 —
  set once by the Create Save wizard, see above), points for a win/OT
  loss, playoff teams per division, decline/retirement age range,
  rookies-per-season, rookie/Contender-eligibility odds.

## Notes on the simulation

This is a **lightweight, rating-based** simulator, not a physics or
play-by-play engine. Each team's effective offense/defense/goaltending is
derived from its best available players at each position, expected goals
are computed from the ratings matchup plus a home-ice/randomness factor,
and actual goals are drawn from a Poisson-style random distribution. It's
tuned to feel fair and give upsets a real chance, not to be a hyper-precise
model of Puck's actual physics.

## Browser support & data persistence

Works in any modern browser. Your league autosaves to `localStorage` as you
play, scoped to that browser + device. There are no accounts and nothing is
sent anywhere — export your league regularly if you want a portable backup.
