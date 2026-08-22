# Balance Notes — Brace Room

No browser or physical device was available in this build session, so a
real human playtest wasn't possible yet. What follows instead: a headless
bot playtest (`dev/balance-sim.js`) that plays real sessions through
`game-core.js`'s actual tick loop — no mocking, no shortcuts — and three
real bugs it found, in the order they were found. **This is not a
substitute for a human playtest** (see the caveats in the sim file itself
and in `KNOWN_LIMITS.md`); it's a floor-level sanity check that the rules
as written are winnable at all, run before asking a person to spend real
time on it.

## Run 1 — 0% win rate, every config

First run of the sim, 30 seeds x 4 player counts x 3 session lengths: every
single combination came back 0% win rate. `avgMissed` sat around 10-11
misses regardless of player count, which was the first tell — more crew
should mean fewer misses, not the same number.

Root cause: `maxConcurrentFaults` was `playerCount + (wave >= 3 ? 1 : 0)`.
That "+1" in wave 3 meant every crew size, from solo to a full four-player
room, faced strictly more simultaneous faults than there were people to
answer them, every single wave-3. Not harder — unwinnable, regardless of
skill. Fixed to cap at exactly crew size (with wave 1 giving one fewer slot
than full capacity as a soft on-ramp). See the comment above
`maxConcurrentFaults` in `runtime/game-core.js` for the exact before/after.

Also bumped the hull economy while investigating this run: v0.1.0 shipped
with `HULL_REGEN_ON_RESOLVE = 3` against `HULL_DAMAGE_ON_MISS = 12` — a 1:4
ratio that guarantees a slow bleed to zero even at a healthy resolve:miss
ratio. Rebalanced to `7` / `9`.

## Run 2 — still 0%, but for a different reason

Re-ran after the concurrency fix. Still 0% everywhere, and now `avgMissed`
and `avgResolved` were both dramatically higher (sessions were running much
longer before failing, not succeeding). This pointed at the simulator, not
the game: the bot's action logic pressed its action key once on arrival at
a station and then just held it forever. For `hold`-verb stations that's
correct. For `mash`-verb stations it's wrong — `game-core.js` requires
repeated discrete presses (an `actionEdge`, not a held `action`) to
accumulate mash effort, and a bot that presses once and holds never mashes
again. Fixed the bot to be verb-aware: pulse the action key every tick for
`mash`, time presses to the beat window for `rhythm` (using the newly
exported `nearestBeatDelta`), and hold continuously for `hold`/`crew2` as
before. This is logged here for the same reason the game bugs are — an
honest playtest harness has to admit when its own logic was the problem.

## Run 3 — winnable, but a strange shape

With both fixes in place: 1-player 63-93%, 4-player 98-100%, but 2-player
sitting at 3-40% and 3-player at 23-53%. A U-shaped curve like that — solo
fine, full crew fine, the middle sizes collapsing — doesn't look like
normal difficulty variance; it looks like something structural.

Root cause: the Bulkhead (crew2) fault occupies two entire players for its
whole duration, but the spawner was treating it as costing the same "one
slot" as any other fault. For a 2-player crew whose capacity cap is 2 from
wave 2 on, an active Bulkhead fault silently used the *entire* team,
leaving any other concurrently-spawned fault guaranteed to expire
untouched — nobody was structurally free to reach it. For a 3-player crew
the same problem existed with one player's worth of slack instead of zero,
still tight. For 4 players there was enough slack that the problem barely
showed.

Fixed by making the spawner treat Bulkhead as costing 2 capacity units
instead of 1 (`stationCapacityCost` / `usedCapacity` in
`runtime/game-core.js`), so it can only spawn when there's actually enough
free crew to both handle it *and* leave room for whatever it doesn't
starve.

## Result

| players | 6 min | 9 min | 12 min |
|---|---|---|---|
| 1 | 93% | 75% | 63% |
| 2 | 88% | 85% | 90% |
| 3 | 98% | 95% | 100% |
| 4 | 100% | 100% | 98% |

(40 seeds per cell, coordinated always-correct bot — treat as an upper
bound, not a human-accuracy prediction. Real play will land lower across
the board, especially for a first-time group.)

This is a coherent curve now: solo is hardest because there's no backup
(by design — see `DESIGN_BIBLE.md` §9), 2-4 players are all comfortably
winnable for a skilled/coordinated team, and there's real margin between
"bot upper bound" and "impossible" for human imperfection to live in.
Nobody should read this table as "human win rate" — it's "the rules are no
longer lying to you about being beatable." A real human playtest, ideally
with someone new to the game, is still the next real gate.

## Confirmation pass — 300 seeds, no new bug

Re-ran with 300 seeds per cell (7.5x the original 40) to check whether the
Result table above was a real curve or a lucky small sample. It held up:

| players | 6 min | 9 min | 12 min |
|---|---|---|---|
| 1 | 92% | 83% | 64% |
| 2 | 94% | 87% | 85% |
| 3 | 99% | 96% | 98% |
| 4 | 100% | 99% | 98% |

No new structural bug this time — unlike runs 1-3, this pass didn't
change anything in `game-core.js`. Worth saying plainly rather than
inventing a fix to justify the extra seeds.

The one cell worth a second look on purpose, not by accident, is 1-player
12-minute at 64%: even a flawless, zero-reaction-time bot loses over a
third of the time. Checked the raw per-seed losses for that cell
specifically — every loss happens late (610-715s into a 720s max session,
after 125-147 successful resolves), not early or suddenly, so this reads
as genuine long-session attrition for a solo crew rather than a spawn
bug or an unfair spike. That's consistent with "solo is hardest by
design," but it's a strong enough number that it's worth Mike knowing
plainly before a human playtest, not just accepting the design intent by
default — a real solo player experiencing a 64%-upper-bound mode should
probably know going in that a 12-minute solo shift is genuinely difficult,
not merely "harder than 4-player."
