# PHL Franchise Simulator

A free, offline, browser-based fantasy franchise simulator for **PHL** — a
custom league built around [Puck](https://store.steampowered.com/), the free
hockey-like game on Steam. Manage rosters, simulate seasons, run playoffs,
draft prospects, and juggle contracts under a salary cap — all client-side,
no server or account required.

Built as a static site (plain HTML/CSS/JS, no build step) so it's easy to
fork, host on GitHub Pages, or just double-click `index.html` and play.

## Quick start

**Option 1 — just open it.** Double-click `index.html`. Everything runs in
your browser; your league is saved to that browser's local storage as you
play.

**Option 2 — host it.** Push this repo to GitHub and enable **GitHub
Pages** (Settings → Pages → Deploy from branch → `main` / root). No build
step needed — it's ready as-is.

**Option 3 — local server** (useful for development): from this folder run
`python3 -m http.server 8000` and open `http://localhost:8000`.

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
  every player gets a quietly-estimated age; skill starts declining around
  29, and each player retires at a randomized age in the low-to-mid 30s.
  Young players below their Potential can also quietly develop upward over
  time. All of this happens automatically — there's nothing to configure.
- **Breakout rookies** — each new season, a fresh batch of lower-overall,
  wide-potential rookies enters free agency. They can only be signed by
  Prospect teams (occasionally Contender) at first — never straight to Pro.
  Once signed once, that restriction is gone for future free agency.
- **Season simulation** — generates a round-robin schedule per division
  (~16–20 games per team) and simulates games using a rating-based engine
  (team/goalie ratings + randomness decide the score; individual goals and
  assists are credited to specific players).
- **Standings** — live win/loss/OT/points tables per division.
- **Playoffs** — best-of-7 series throughout (every round, including Wild
  Card), but the bracket format differs by
  division: **Pro** takes its top 4 straight into the bracket; **Contender**
  takes its top 8 straight into an 8-team bracket; **Prospect** gives its
  top 6 a bye while seeds 7-10 play a Wild Card round for the final 2
  bracket spots (mirroring the 8-team bracket size). A team that finishes
  outside a division's playoff line — including a freshly added expansion
  team — just misses the playoffs, no special-casing needed.
- **Startup Draft** — a one-time draft at the start of every save. Pick
  the division and team you want to GM, then the real PHL player pool
  (baked into the site — see below) is drafted in three cascading phases:
  **Pro** drafts first from the entire pool (8 rounds, snake order), then
  **Contender** drafts from whoever Pro left behind (8 rounds), then
  **Prospect** gets whatever's left after that (8 rounds). Draft order for
  every phase comes from a single random shuffle made once when you start.
  AI teams draft best-player-available while making sure they cover a
  viable lineup (at least 2F/2D/1G) before chasing extra depth, so a
  clearly elite player reliably goes in the first phase it's eligible
  for. Watch AI picks resolve one at a time (or fast-forward to your next
  turn), draft manually when it's your team's turn, and set your own
  starters/bench once it's done — the sim automatically falls back to
  best-available for any position you haven't manually set. Because the
  real player pool has a fixed number of players, it can run out before
  every team completes all 8 rounds, especially deep into the Prospect
  phase — teams just end up with whatever roster size the pool allowed.
- **Entry Draft** — a separate, *recurring* league-wide draft (run once
  per season from the Draft tab, snake order, worst record picks first)
  stocked with freshly generated breakout-rookie prospects. Draft manually
  or auto-draft. Unrelated to the one-time Startup Draft above.
- **Contracts & Cap** — salary cap is set **per division** (Prospect
  $1,000,000/yr, Contender $2,000,000/yr, Pro $4,000,000/yr team budgets),
  reflecting that top-tier orgs have bigger budgets. Sign free agents,
  release players, re-sign expiring contracts. Free-agent salaries are
  realistic esports-style figures — a $20,000/yr baseline up to $400,000/yr
  for elite prospects, based on Overall + Potential.
- **Stats leaderboards** — league leaders in Points, Goals, Assists, +/-,
  SV%, and GAA.
- **Offseason** — "Start New Season" quietly ages every player (some may
  retire), expires contracts, drops in a new breakout rookie class, resets
  stats/records, and builds a fresh schedule.
- **Data Tools** — export your whole league as a JSON file (for backup or
  to share/commit to GitHub), import someone else's league file, or reset
  to the starter data.

## The real PHL player pool

This site ships with the real PHL Season 4 player pool baked in (192
players pulled from every division's live rosters — including
inactive/limited/benched players — rated from their actual stats). Nobody
starts on a team; they all seed the **Startup Draft** described above.
Replace or add to `startupPool` in `js/starterData.js` any time the real
rosters change.

## Adding your own teams & players

You don't need to touch any code. Open the site, go to **Teams** to add or
edit teams/divisions, and **Players** to build out rosters — or click
**Generate Sample Roster** on the Players tab to instantly fill every team
with randomized placeholder players so you can test-drive the simulator
before entering real data.

The same **+ Add Team** button on the Teams tab is also your expansion-team
tool — add a team to any division at any point in a save. It joins that
division's standings/schedule the next time you (re)generate the schedule,
and playoff qualification is always "top N by standings," so an expansion
team that finishes outside the line just misses the postseason like anyone
else.

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
- `teams` — `{ id, name, abbr, division, wins, losses, otLosses, gf, ga, points }`.
- `players` — `{ id, name, position (F/D/G), archetype, overall, potential,
  attributes: { offense, defense, goaltending } (derived from overall +
  position + archetype, not hand-entered), age & retirementAge (hidden,
  never shown in the UI), retired, salary, contractYears, teamId, starter
  (manual lineup flag — see Startup Draft above), isDraftProspect,
  startupDraftPool (true until the Startup Draft assigns them a team),
  eligibleDivisions (breakout-rookie restriction, cleared after first
  signing), stats }`.
- `season` — `{ seasonNumber, phase, schedule, playoffs }`.
- `draft` — `{ active, year, order, pickIndex, pool, picks }` (the
  recurring annual Entry Draft).
- `franchise` — `{ divisionId, teamId }`, the GM's chosen team, set once
  via the Startup Draft tab.
- `startupDraft` — `{ status, phase, phaseIndex, masterOrder,
  phaseTeamOrder, pickIndexInPhase, roundsPerPhase, picks }`, the one-time
  cascading draft's state (see js/startupDraft.js).
- `settings` — roster max, active lineup shape, target games per team,
  points for a win/OT loss, playoff teams per division, decline/retirement
  age range, rookies-per-season, rookie/Contender-eligibility odds.

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
