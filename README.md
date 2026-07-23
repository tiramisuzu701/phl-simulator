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
  editor (name, position, age, ratings, salary, contract). Puck is played
  2 Forwards + 2 Defenders + 1 Goalie per side, and stats tracked are
  Goals, Assists, Points, +/-, Save %, and GAA, matching that format.
- **Season simulation** — generates a round-robin schedule per division
  (~16–20 games per team) and simulates games using a rating-based engine
  (team/goalie ratings + randomness decide the score; individual goals and
  assists are credited to specific players).
- **Standings** — live win/loss/OT/points tables per division.
- **Playoffs** — top 4 teams per division, best-of-3 bracket, crowns a
  Division Champion.
- **Entry Draft** — a league-wide, snake-order draft (worst record picks
  first) stocked with generated prospects. Draft manually or auto-draft.
- **Contracts & Cap** — every team has a salary cap; sign free agents,
  release players, re-sign expiring contracts.
- **Stats leaderboards** — league leaders in Points, Goals, Assists, +/-,
  SV%, and GAA.
- **Offseason** — "Start New Season" ages every player a year, expires
  contracts, resets stats/records, and builds a fresh schedule.
- **Data Tools** — export your whole league as a JSON file (for backup or
  to share/commit to GitHub), import someone else's league file, or reset
  to the starter data.

## Adding your own teams & players

You don't need to touch any code. Open the site, go to **Teams** to add or
edit teams/divisions, and **Players** to build out rosters — or click
**Generate Sample Roster** on the Players tab to instantly fill every team
with randomized placeholder players so you can test-drive the simulator
before entering real data.

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

- `divisions` — `{ id, name, tier }`. Tier is a plain number (higher =
  better); there's nothing hardcoded to exactly three divisions, so a new
  one (e.g. IAPL) can be added the same way.
- `teams` — `{ id, name, abbr, division, wins, losses, otLosses, gf, ga, points }`.
- `players` — `{ id, name, position (F/D/G), age, overall, attributes: { offense, defense, goaltending }, salary, contractYears, teamId, isDraftProspect, stats }`.
- `season` — `{ seasonNumber, phase, schedule, playoffs }`.
- `draft` — `{ active, year, order, pickIndex, pool, picks }`.
- `settings` — salary cap, roster max, active lineup shape, target games
  per team, points for a win/OT loss, playoff teams per division.

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
