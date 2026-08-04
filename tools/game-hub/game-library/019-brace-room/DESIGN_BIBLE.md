# BRACE ROOM — Design Bible

Slot: `019-brace-room`
Status: **PLANNING — not yet built.** This document is the frozen design so the
build session can go straight to implementation with no open decisions.

Player promise: **one hull, four crew, nothing fixes itself — run to the fire,
not away from it.**

## 1. Why this game, why now

The library (002–018) is strong on solo management runs (013, 017, 018),
versus/competitive arcade (002, 003, 014), and one adaptive-rhythm co-op
(012 Pulse Choir). What it does not have yet is a **true fail-together,
station-tag emergency co-op** in the Spaceteam/Overcooked family — the genre
that reads best at an actual game night with 3–4 people talking over each
other. Brace Room fills that gap. It reuses the house control scheme from
012 (WASD / Arrows / IJKL / Numpad) so muscle memory carries across an AXM
game night, but the loop, art, and mechanics are original.

## 2. The 30-second truth

`fault appears at a station → someone runs to it → resolve the correct
action before the ring empties → hull holds → repeat, faster, until the
crew's shift timer runs out`

## 3. Setting

A cargo-research vessel mid-shift takes structural stress from a debris
field. No lore-heavy sci-fi — the vessel and crew are unnamed, generic
enough to re-skin later. Tone is tense-but-fun, closer to a submarine-movie
montage than horror.

## 4. The room

Shared screen, single scene: six stations arranged in a ring around a
central **Hull Integrity** gauge (0–100). Each station has a fixed icon and
color. Players are colored dots that walk the ring (collision-free, no
combat) using their key cluster. There is no scrolling or second room —
legibility at couch distance matters more than scale.

Stations (fixed positions, always visible, only some "hot" at a time):

1. **Engine Bay** — coolant leak faults
2. **Breaker** — power surge faults
3. **Bulkhead** — hull breach faults (two-crew only)
4. **Radio** — comms static faults
5. **Vent** — smoke faults
6. **Ballast** — trim faults

## 5. Fault types

Every fault spawns at one station with a visible countdown ring (starts
generous, shrinks with wave). A player must be standing inside that
station's zone and hold/press their **action key** to resolve it. Four
distinct resolution feels so no two stations play identically:

- **Coolant Leak** (Engine Bay) — mash action key to fill a bar before the
  ring empties.
- **Power Surge** (Breaker) — hold action key steady while a marker drifts;
  keep it inside a moving green zone.
- **Comms Static** (Radio) — tap action key on the beat of a visible pulse
  (3–4 taps in rhythm).
- **Hull Breach** (Bulkhead) — the one true co-op-only fault. Requires two
  players standing in the zone at the same time, both holding action
  together for a beat. Cannot be soloed. Present from wave 2 onward.
- **Smoke** (Vent) and **Trim** (Ballast) reuse the mash/hold verbs above
  with different pacing so all six stations are covered by four verbs.

**False alarm** (wave 3+, rare): a fault that looks identical but its ring
is grey, not amber. Resolving a grey ring costs a small integrity penalty
instead of granting one — teaches players to glance, not just react, without
punishing early rounds.

## 6. Difficulty curve / waves

Three waves inside whichever session length is chosen (see §8). Wave
transitions are time-based, not score-based, so every session has a known
shape:

| Wave | Approx. share of session | Spawn interval | Ring length | Hull Breach faults | False alarms |
|---|---|---|---|---|---|
| 1 | first 40% | 3.5–4.5s | long | none | none |
| 2 | next 35% | 2–3s | medium | yes | none |
| 3 | final 25% | 1–1.5s | short | yes, more frequent | occasional |

Number of simultaneous active stations scales with player count (roughly
`min(active_stations, players + 1)`), so a solo run stays fair and a 4-player
run has genuine overlap that forces triage and callouts.

## 7. Scoring & result (co-op, not PvP)

No player-vs-player score. The result summary at the end is about the crew:

- Faults resolved / faults missed
- Longest streak without a hull hit
- False alarms avoided vs. mis-resolved
- Final Hull Integrity and a pass/fail line ("Hull held" / "Hull breached")

This matches the game-night contract's `returns_result_summary: true` and
`confirmedFinishCreatesResult: true` truths — the room gets one shared
outcome, not a leaderboard.

## 8. Session length & win/lose

Contract-minute pattern reused from 018 (Last Stop: Nebula): host picks
**6 / 9 / 12 minutes** before start. Win = survive the full timer with Hull
Integrity > 0. Lose = Hull Integrity hits 0 early (immediate end, no
sudden-death grace — losing together should feel clean, not tedious).

## 9. Players & seats

- `min_players: 1`, `max_players: 4`.
- Screen never counts as a seat (`screen_occupies_seat: false`), consistent
  with the game-night contract.
- Solo play is legitimate (fewer active stations, no Hull Breach faults
  until 2+ players are present) but the game is designed to peak at 3–4.
- AI seats may occupy a station like a human seat (no special-cased AI
  behavior beyond the existing seat model); no voting mechanic exists in
  this game, unlike 012 Pulse Choir.

## 10. Controls (reused house scheme)

Shared screen, shared keyboard, same clusters as 012 Pulse Choir so a game
night doesn't require re-learning controls between titles:

- P1: `WASD` + `Space` (action)
- P2: Arrow keys + `Enter` (action)
- P3: `IJKL` + `O` (action)
- P4: Numpad `8456` + Numpad `0` (action)
- `H` help, `M` reduced motion, `C` high contrast, `Esc` close overlay

Phone controller (stretch goal, mark pending like other titles if it slips):
touch joystick + one large ACTION button, same shape as Pulse Choir's PULSE
button.

## 11. Accessibility notes carried into build

- Reduced-motion mode swaps ring animation for a numeric countdown.
- High-contrast mode swaps the color-coded station icons for icon+shape
  redundancy (color is never the only signal).
- All faults are readable by icon shape, not color alone, for colorblind
  players.

## 12. Explicit non-goals for v1

- No combat, no enemies, no narrative branching.
- No persistent meta-progression between runs (each session is standalone,
  matching the "no away pressure" spirit of 018 but without its save file).
- No procedurally generated room layout — one fixed six-station ring keeps
  spatial memory consistent night to night.
