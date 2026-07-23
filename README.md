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
  wide-potential rookies enters free agency. They can only be signed by
  Prospect teams (occasionally Contender) at first — never straight to Pro.
  Once signed once, that restriction is gone for future free agency.
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
  team — just misses the playoffs, no special-casing needed. Playoffs run
  one round per Advance Week click; divisions with shorter brackets simply
  sit idle (already crowned) while longer brackets keep playing.
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
- **Entry Draft** — a separate, *recurring* league-wide draft (snake order,
  worst record picks first) stocked with freshly generated breakout-rookie
  prospects. It's available any time during the 5-week off-season — run it
  manually (whole or auto-draft) whenever you like. If you never get to it,
  it auto-completes (fully auto-drafted) right before the regular season
  starts, so the league is never left without a draft class. Unrelated to
  the one-time Startup Draft above.
- **Promotions (off-season call-ups)** — during the off-season, a manager
  can permanently call up a rostered player from any strictly lower-tier
  division onto their own team from the **Promotions** tab. There's no
  negotiation: a league-set call-up fee (the same Overall/Potential-based
  valuation used for free-agent asking prices) has to fit in the acquiring
  team's cap space alongside the player's freshly recalculated salary, or
  the move is blocked. Every completed call-up is logged in a Promotion
  History table. This is separate from — and off-season-only, unlike —
  normal free-agent signings. The AI runs its own promotions too — see
  **AI proactivity** below.
- **Contracts & Cap** — salary cap is set **per division** (Prospect
  $1,000,000/yr, Contender $2,000,000/yr, Pro $4,000,000/yr team budgets),
  reflecting that top-tier orgs have bigger budgets. Sign free agents,
  release players, re-sign expiring contracts. Free-agent salaries are
  realistic esports-style figures — a $20,000/yr baseline up to $400,000/yr
  for elite prospects, based on Overall + Potential. **Cap enforcement**: if
  your own team is over its division's cap, **Advance Week is blocked**
  with a banner explaining exactly how far over you are — fix it yourself
  in Contracts (release or trade a player) before you can continue. AI
  teams that go over cap are fixed automatically and silently (lowest-rated
  players released first) so the league never gets stuck on their account.
- **Stats leaderboards** — league leaders in Points, Goals, Assists, +/-,
  SV%, and GAA.
- **Data Tools** — export your whole league as a JSON file (for backup or
  to share/commit to GitHub), import someone else's league file, or reset
  to the starter data.

## The weekly calendar

The whole season runs on one clock, advanced one week at a time by the
**Advance Week** button in the header. Every season follows the same
21-week cycle:

1. **5-week off-season** — freeform. All off-season tools (Entry Draft,
   free agency, Promotions) are open across all 5 weeks, in any order you
   like. If the Entry Draft hasn't been run manually by the end of week 5,
   it auto-completes. AI teams sign free agents and run promotions every
   off-season week. The regular-season schedule is generated right at the
   end of week 5.
2. **12-week regular season** — **Pro** plays 2 games/week (24 games total);
   **Contender** and **Prospect** play 3 games/week (36 games total each).
   Every team lands on that exact game count.
3. **Up to 4 weeks of playoffs** — one bracket round resolves per division
   per week. **Pro**'s 2-round bracket wraps up in 2 weeks; **Contender**'s
   3-round bracket in 3; **Prospect**'s 4-round bracket (including its
   Wild Card round) uses the full 4 weeks. Shorter brackets simply idle,
   already-crowned, until every division has a champion.
4. Back to a fresh 5-week off-season — ages/declines/retires players,
   generates a new breakout-rookie class, and repeats indefinitely.

Advance Week is disabled (with an on-screen reason) whenever it can't
safely proceed: the Startup Draft hasn't been finished yet, an Expansion
Draft is currently active, or your own team is over the salary cap.

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

**+ Add Team** on the Teams tab is a plain commissioner/league-building
tool — add a bare team to any division at any point, with no draft and no
franchise switch. It joins that division's standings/schedule the next
time the schedule regenerates, and playoff qualification is always "top N
by standings," so it just misses the postseason if it finishes outside the
line, like anyone else.

## Expansion Franchise

**+ Add Expansion Franchise** (next to + Add Team on the Teams tab) is the
in-game way to grow the league: give it a name, abbreviation, and division,
and it immediately becomes **your new managed team** — the team you were
managing before switches to AI control. (A save only ever has one
user-managed team at a time.)

Creating an expansion franchise kicks off an **Expansion Draft**: a
scaled-down, 6-round version of the Startup Draft (vs. 8 rounds normally),
drafting from the league's current free-agent pool rather than the
one-time startup pool. Advance Week is blocked while an Expansion Draft is
active. If the free-agent pool is too thin to fill all 6 rounds (most
likely if you expand very early in a save, right after the Startup Draft
has just exhausted the player pool), an **End Draft Now** button lets you
stop early with whatever roster you've drafted so far and unblock Advance
Week.

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
pool in one tick). Promotions follow the same call-up rules a human
manager would use (a clear upgrade — +3 Overall or more over the weakest
player at that position — that the team can actually afford), and each AI
team attempts at most one call-up per week.

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
- `season` — `{ seasonNumber, phase, calendarWeek, schedule, playoffs,
  entryDraftDoneThisCycle }`. `phase` cycles `"offseason" -> "regular" ->
  "playoffs"`, then back to `"offseason"` — driven entirely by
  `js/calendar.js`'s `advanceWeek()`, the single state machine behind the
  header's Advance Week button. `calendarWeek` is 1-based *within* the
  current phase (resets to 1 at each phase transition); `seasonNumber`
  increments at the playoffs -> offseason transition.
  `entryDraftDoneThisCycle` tracks whether this off-season's Entry Draft
  has been run yet (manually or auto-completed).
- `draft` — `{ active, year, order, pickIndex, pool, picks }` (the
  recurring annual Entry Draft).
- `franchise` — `{ divisionId, teamId }`, the one team the human is
  currently GM of. Set via the Startup Draft tab initially; can change
  later if an Expansion Franchise is created (see above), which always
  switches management to the new team.
- `startupDraft` — `{ status, phase, phaseIndex, masterOrder,
  phaseTeamOrder, pickIndexInPhase, roundsPerPhase, picks }`, the one-time
  cascading draft's state (see js/startupDraft.js).
- `expansionDraft` — `null` normally; while an Expansion Franchise is being
  drafted, `{ status, teamId, round, totalRounds, picks }` (see
  js/expansion.js). Advance Week is blocked whenever `status === "active"`.
- `promotions` — array of `{ id, season, fromTeamId, toTeamId, playerId,
  fee }` log entries, one per completed off-season call-up (both
  human-initiated and AI-initiated — see js/promotions.js and
  js/aiManager.js).
- `settings` — roster max, active lineup shape, off-season/regular-season
  week counts, per-division games-per-week, startup/expansion draft round
  counts, points for a win/OT loss, playoff teams per division,
  decline/retirement age range, rookies-per-season, rookie/Contender-
  eligibility odds.

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
