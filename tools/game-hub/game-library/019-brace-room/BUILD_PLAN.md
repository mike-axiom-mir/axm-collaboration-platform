# Brace Room — Build Plan (for tomorrow's session)

All design decisions live in `DESIGN_BIBLE.md`. This file is the execution
checklist — no genre, mechanic, or control-scheme decisions should be needed
mid-build. Follows the lightweight house pattern used by
`012-pulse-choir` (plain Node + canvas, no framework, no external deps),
not the heavier Three.js pattern used by `018-last-stop-nebula`.

Game Hub auto-discovers any folder under `game-library/` that contains a
`game.manifest.json` (see `tools/game-hub/game-hub-server.js:289-298`), so
no registry edit is needed beyond adding the `game.manifest.json` already
drafted here — just keep it accurate as the build evolves.

## Build order

1. **Scaffold**
   - `runtime/server.js` — static file server + `/health`, same shape as
     012's `runtime/server.js`. Port `8819` (already reserved in the
     manifest, no collision with 002-018).
   - `package.json` (no external deps if avoidable — matches house
     `runtimePolicy.localOnly` norm).

2. **Core simulation — `runtime/game-core.js`**
   - Seeded RNG (deterministic per session, like Pulse Choir's
     `random_seed`) driving the fault spawner.
   - Station table: 6 stations, fixed positions, icon, color, verb type
     (mash / hold-in-zone / rhythm-tap / two-crew-hold).
   - Wave state machine driven by elapsed time against the chosen session
     length (6/9/12 min), per the wave table in DESIGN_BIBLE.md §6.
   - Hull Integrity number (0-100), damage on fault expiry, small regen on
     resolve, penalty on false-alarm misresolve.
   - Active-station count scaling by player count:
     `min(available_stations, players + 1)`.
   - Result summary object: resolved / missed / streak / false-alarm stats
     / final hull / pass-fail line.
   - This module should be UI-free and unit-testable in isolation.

3. **Client shell — `runtime/index.html` + `runtime/styles.css`**
   - Single canvas, six-station ring layout, central hull gauge.
   - HUD: session timer, wave indicator, hull bar.
   - Reduced-motion and high-contrast toggles wired to `M` / `C` (design
     bible §11) — build these in from the start, not bolted on later.

4. **Input + render loop — `runtime/app.js`**
   - Movement for up to 4 local players using the exact key clusters from
     DESIGN_BIBLE.md §10 (reuse verbatim from 012 for consistency).
   - Station proximity check → show interaction prompt.
   - Per-verb resolution mini-games: mash-bar, hold-in-zone, rhythm-tap,
     two-crew-hold (the last one needs two player-in-zone flags true at
     once — this is the one mechanic worth extra test coverage since it's
     the actual "force teamwork" beat of the whole game).
   - Wire `game-core.js` state into canvas draw calls.

5. **Controller (stretch, don't block MVP on it)**
   - `runtime/controller.html` — touch joystick + one ACTION button,
     mirrors Pulse Choir's PULSE button pattern.
   - If this slips past the session, mark `physical_phone_qa: pending` and
     `disconnect_recovery: pending` in the manifest (already scaffolded
     that way) rather than blocking the shared-screen build — shared
     screen + keyboard is the core experience; phone join is additive.

6. **Tests — `tests/`**
   - `brace-room-selftest.js`: fault spawn timing, wave transitions, hull
     damage/regen math, two-crew-hold requiring both flags, false-alarm
     penalty math, result-summary shape.
   - `server-http.test.js`: server boots, `/health` responds, static
     assets serve.

7. **Docs to fill in (stubs, not written yet — write from the real build,
   not before)**
   - `README_FIRST.md` — mirror 012's structure: promise line, 30-second
     truth (already drafted in DESIGN_BIBLE §2, reuse it), start commands,
     controls block (copy DESIGN_BIBLE §10 verbatim), one honest paragraph
     on what's proven vs. not.
   - `KNOWN_LIMITS.md` — call out phone controller status honestly,
     any balance numbers that are first-guess rather than playtested.
   - `ASSET_PROVENANCE.md` — **decided: zero third-party art.** All visuals
     (stations, player tokens, hull gauge, fault icons) are flat vector
     shapes drawn directly in canvas, not sprite sheets. No CC0 asset site
     pull needed for v1, no attribution tracking, no licensing review pass
     like the Kenney-asset games required. State this explicitly rather
     than leaving the file mostly empty. If a later polish pass wants
     richer art, the three CC0 sites Mike already sourced are the first
     stop then — not before.
   - `BUILD_RECEIPT.md` — fill in after the build with what was actually
     done, same convention as every other slot.

8. **Manual playtest pass**
   - Solo run first (sanity check station scaling and pacing alone).
   - Then simulate 2-4 "hands on one keyboard" if a second person isn't
     available yet — at minimum verify the two-crew Hull Breach fault is
     literally impossible to solo, since that's the mechanic the whole
     pitch depends on.
   - Adjust the wave table numbers in `game-core.js` based on feel; the
     table in DESIGN_BIBLE.md §6 is a first-guess starting point, not a
     locked spec.

9. **Manifest cleanup**
   - Bump `status` from `PLANNED - NOT YET BUILT` to whatever the real
     state is (`VERTICAL SLICE`, `WORKING TEST`, etc., matching the
     vocabulary other slots use in `GAME_MANIFEST_TEMPLATE.json`).
   - Fill in `required_paths` with any files that ended up different from
     the plan.
   - Decide whether to add `019-brace-room` to `featuredGames` in
     `tools/game-hub/GAME_NIGHT_CONTRACT.json` once it's actually playable
     — don't add it while still a planning stub.

## Explicitly deferred to a later session (not tomorrow)

- Evidence screenshot suite (`evidence/visual/*.png`) at the density other
  slots have — get it playable and correct first, then do one evidence
  pass once the visuals are stable, so screenshots aren't retaken after
  every balance tweak.
- Any AI-seat-specific behavior beyond "an AI seat can occupy a station
  like a human seat" — no bespoke AI logic is in scope for v1.
- Room-code / QR / LAN join hardening beyond what 012 already proved works.
