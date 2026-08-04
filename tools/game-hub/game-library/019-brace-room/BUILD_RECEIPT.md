# Build Receipt — Brace Room v0.1.0

Date: 2026-08-01
Slot: `019-brace-room` (auto-discovered by Game Hub via `game.manifest.json`
in `game-library/`, port `8819` — no collision with 002-018).

## What this pass built

- `runtime/game-core.js` — pure, DOM-free simulation: seeded RNG, six-station
  ring, time-based three-wave difficulty curve, four resolve verbs (mash,
  hold, rhythm-tap, two-crew-hold), false-alarm faults from wave 3, Hull
  Integrity math, streak tracking, and a result-summary builder. Exposed as
  both a CommonJS module (Node/tests) and a `window.BraceRoomCore` global
  (browser client), no bundler.
- `runtime/server.js` — plain Node `http` static file server + `/health`,
  path-traversal-safe file resolution, port `8819` default, exports
  `createServer()` for isolated test use.
- `runtime/index.html`, `runtime/app.js`, `runtime/styles.css` — shared-screen
  client: start screen (crew size + shift length pickers), canvas render loop
  driven by `Core.tick`, four independent keyboard clusters (P1-P4), toast
  feed for round events, pause/help overlays, high-contrast and
  reduced-motion toggles, end screen with a co-op result summary.
- `tests/brace-room-selftest.js` — 14 checks against `game-core.js`: RNG
  determinism, player-count clamping, wave transitions, concurrency scaling,
  spawn timing, miss damage, mash-resolve regen, the two-crew-hold
  can't-be-soloed guarantee (both the failure and success paths), false-alarm
  scoring in both directions, win/lose transitions, and result-summary shape.
- `tests/server-http.test.js` — 7 checks against `server.js`: health payload,
  static file serving (`index.html`, `styles.css`, `app.js`, `game-core.js`),
  404 on unknown paths, and percent-encoded path-traversal containment.
- `package.json` with `npm test` wired to both suites (`npm test` → 21/21
  passing at time of this receipt).
- `README_FIRST.md`, `KNOWN_LIMITS.md`, `ASSET_PROVENANCE.md` — see those
  files directly rather than duplicating them here.

## What this pass did not build (see KNOWN_LIMITS.md)

- Phone controller / networked join (`controller.html` does not exist yet).
- Any persistence, reconnect, or host-reload recovery — the server holds no
  session state.
- Evidence screenshot suite.
- Human playtest of the wave-table balance numbers.

## Verification performed

- `node --check` on all three runtime `.js` files (syntax only).
- `npm test` run to completion, 21/21 checks passing, in the sandbox.
- Manual `fetch()` smoke check of `/`, `/styles.css`, `/app.js`,
  `/game-core.js`, `/health` against a live `createServer()` instance,
  confirming status codes and content-types.

Not yet performed: an actual browser render/interaction pass (no browser
tool was used in this build session), and no physical multi-hand keyboard
playtest. Both are the next gate before promoting the manifest `status`
field past a first-build label.

## Build Receipt addendum — v0.2.0, same day, after first human playtest

Mike tested v0.1.0 directly (first real browser + keyboard playtest of this
game). Findings and fixes:

- **Bug: Breaker (and every `hold`-verb station) was impossible to
  complete.** Root cause: the "Start shift" button retained keyboard focus
  after being clicked; releasing Space (the P1 action key) while a
  `<button>` is focused makes the browser fire its own click on that
  button, which called `startRun()` again and silently restarted the whole
  session — wiping any in-progress fault effort — every time. Fixed in
  `runtime/app.js` with `preventDefault()` on all reserved gameplay/global
  key codes plus an explicit blur of the active element after every
  overlay button interaction. See `KNOWN_LIMITS.md` for the full writeup.
- **UX: fault progress was nearly invisible** (an 18px, 35%-opacity dot).
  Replaced with a full inner progress ring on the station plus a live
  percentage label.
- **Feature: phone controller, wired to Game Hub's existing QR/lobby
  seam** rather than building a new one. `game.manifest.json` now sets
  `launch.controller_path` and `controls.phone_controller: true`;
  `runtime/controller.html` (d-pad + ACTION button) posts to a new
  `POST /api/input` on this game's own server, and `runtime/app.js` polls
  `GET /api/input` and merges per-seat phone input with the keyboard.
  `runtime/server.js` still owns no game-simulation state — only a
  400ms-TTL input relay buffer.
- Added 6 more checks to `tests/server-http.test.js` covering the input
  relay (round trip, staleness, unknown-seat rejection) and the new
  `controller.html` route. `npm test` is now 27/27 passing (was 21/21).

Still not done: a real phone was never used against this build (no device
available in this session) — `physical_phone_qa` stays `pending` in the
manifest on purpose.

## Build Receipt addendum — v0.4.0, same day, open-ended improvement pass

Mike gave explicit open-ended room to keep improving without asking after
each step. Used it for a real balance investigation plus a visual/audio
pass, rather than just cosmetic tweaks:

- **Solo-play fairness bug:** `eligibleStationsForSpawn` could spawn a
  Bulkhead (crew2) fault for a 1-player crew even though a crew2 fault is
  mathematically unresolvable alone — contradicting what README_FIRST.md
  already promised. Fixed, regression-tested across 8 seeds x a full
  12-minute session.
- **Built `dev/balance-sim.js`,** a headless bot playtest harness (no
  browser available), and used it to find and fix two real balance bugs:
  a wave-3 concurrency cap that made every session mathematically
  unwinnable regardless of skill, and a hull-economy ratio that guaranteed
  a slow bleed to zero. A third pass caught a Bulkhead fault silently
  costing 2-3 player crews their entire team's capacity, collapsing their
  win rate relative to solo and full-crew play. All three are written up
  in the new `BALANCE_NOTES.md` with the actual before/after data — not
  just "trust me, I tuned it."
- **Radio's rhythm verb got an actual metronome** — an orbiting dot that
  flashes on the pressable beat window, replacing a mechanic that had zero
  visual affordance before.
- **Reduced-motion (`M`) now changes real canvas rendering,** not just
  CSS: the shrinking countdown ring becomes a static ring plus a plain
  number, and the rhythm dot's orbit is replaced with a flash-only ring.
- **Visual polish:** particle bursts on resolve/miss, a brief screen
  shake + color flash on hull damage (shake skipped under reduced motion),
  a subtle background engineering grid, idle station breathing glow,
  animated toasts, and a pulsing hull bar under 30%.
- **Procedural sound**, added via WebAudio oscillators (no audio files):
  distinct tones for resolve, miss, false-alarm mistake, false-alarm
  dodge, wave transitions, a low-hull heartbeat that speeds up as hull
  drops, and win/lose stingers. Mute toggle in the HUD; AudioContext
  unlocks on the Start-shift click per browser autoplay rules.
- Test count grew from 21 to 29 (16 core-logic + 13 server checks) to
  cover the new fairness/capacity fixes; all passing.

Still not done, on purpose: no real human or physical device has touched
any of this. The bot-sim win-rate table in `BALANCE_NOTES.md` is an upper
bound, not a promise of how it'll actually feel in a room.

## Build Receipt addendum — v0.5.0, same day, AI seat contract + first live browser verification

Mike pointed out that a sandboxed Claude instance genuinely could not
previously verify any of this in a real browser — no network route from
this sandbox to `127.0.0.1` on the machine the game runs on. Two things
closed that gap:

- **Built `docs/AI_NATIVE_SEAT_CONTRACT.md`** and the matching server
  endpoints (`POST /api/state`, `GET /api/adapter-observation` in
  `runtime/server.js`; `buildObservationSnapshot()` / `pushObservation()`
  in `runtime/app.js`, pushed ~8x/sec). This gives any external agent —
  not just a human at the keyboard — a way to see the running session and
  act on it through the same `POST /api/input` channel the phone
  controller already uses. Added to `game.manifest.json`
  `package.required_paths` (it existed but had never actually been
  registered there). 6 new checks in `tests/server-http.test.js`.
- **A separate local file-based bridge** (`tools/game-hub/ai-seat-courier/`,
  built by a local Codex session, not part of this game's own code) let
  this sandboxed Claude instance drive a real headless Edge browser
  against a live `019-brace-room` session for the first time: launch,
  crew/session selection, movement via `POST /api/input`, position
  confirmed via `GET /api/adapter-observation`, and — because real
  wall-clock time passes between each round-trip file exchange — an
  honestly-earned live "Hull breached" end screen. `AI_NATIVE_SEAT_CONTRACT.md`
  is updated to say so instead of the earlier "no live adapter has
  connected yet."

Two real improvements came out of the same session, verified live
through that same courier bridge (not just unit tests):

- **Canvas-level high contrast.** `C` previously only changed CSS
  variables (page chrome); station shapes, fault rings, the Radio beat
  dot, station labels, and the hull-gauge background drawn on `<canvas>`
  ignored it entirely — a real accessibility gap noted in
  `KNOWN_LIMITS.md`. `render()` in `runtime/app.js` now picks a `palette`
  object once per frame based on the `theme-high-contrast` class, pushing
  those elements to a near-maximum-contrast white/black/cyan/yellow
  scheme. Confirmed live: a screenshot taken mid-session shows every
  station outline rendering pure white against pure black.
- **Quick restart.** The end screen's single "Run it back" button forced
  a trip back through the start screen even to replay identical settings.
  Split into two buttons: "Go again (N players, M min)" calls `startRun()`
  directly with whatever crew/session settings the last run already had
  (`selectedPlayers`/`selectedMinutes` persist across runs by design —
  they only change when a chip is clicked), and "Change crew" keeps the
  old behavior for anyone who actually wants different settings.
  Confirmed live: clicking "Go again" from a real end screen dropped
  straight into a fresh running session with the same crew size, no
  start-screen detour.

Test count unchanged at 35 (16 core-logic + 19 server checks) — this pass
added server-side coverage in the prior v0.4→adapter work, not new checks
here; the two UI changes were verified live via the courier and by eye
rather than with new unit tests, since they're rendering/DOM-wiring
changes, not simulation logic.

Still not done: a real human still hasn't touched this build. Physical
phone QA is still pending. The AI-seat courier's `key`-action reports are
sometimes unreliable for very short (<100ms) key taps — several attempts
came back `"Unexpected end of JSON input"` even though the underlying
keypress had in fact landed (confirmed by screenshot); a duration of
≥300ms was reliable in this session. That looks like a courier-side
verification-step flake, not a game bug, but it's worth knowing if a
future session leans on that bridge again.

## Build Receipt addendum — v0.5.1, same day, phone-controller hardening

Still working toward `physical_phone_qa`, which stays `pending` because
no physical device has actually touched this build yet. Used the
remaining time budget to close known failure classes ahead of that test
rather than guess at new features:

- `runtime/controller.html` now sets `touch-action: none` and
  `overscroll-behavior: none` in CSS, plus a document-level
  `touchmove` → `preventDefault()` as a fallback for older/quirkier
  mobile browsers, so a stray scroll or pinch-zoom gesture can't steal a
  touch away from a held d-pad or ACTION button mid-fault.
- Added a Wake Lock API request (re-acquired on `visibilitychange`) so a
  phone's screen doesn't dim or lock during a 6-12 minute session and
  strand that seat's input. Feature-detected — silently does nothing on
  browsers without it (older iOS Safari, at the time of writing).
- Added a short `navigator.vibrate` buzz on the ACTION button specifically
  (not the d-pad), also feature-detected.
- All three are wrapped so their absence or failure never breaks input —
  confirmed via `npm test` (still 35/35) and a live courier check that
  `GET /controller.html` still serves the exact edited file with no
  syntax errors. None of the three claims to be *proven* on a real
  device — see the updated `KNOWN_LIMITS.md` for the honest version of
  that distinction.
