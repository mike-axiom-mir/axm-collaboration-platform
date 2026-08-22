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

## Build Receipt addendum — v0.6.0, same day, real analog joystick

`DESIGN_BIBLE.md` §10 originally specified "touch joystick + one large
ACTION button" for the phone controller. The first build shipped a
4-button d-pad instead, flagged in `KNOWN_LIMITS.md` as a deliberate
shortcut ("simpler to get right without a real device to test against
yet"). With more time available, built the real thing:

- `runtime/controller.html`'s d-pad grid is replaced with a draggable
  analog base+knob. Pointer events track one finger from down to up;
  the offset from the base's own center is clamped to the base's radius
  and converted to a `-1..1` vector, with a small dead zone near center
  so resting a thumb near the middle doesn't register as drift.
- No changes needed in `game-core.js`: `applyMovement()` already
  normalized the movement vector's magnitude only when it exceeded 1
  (`mag > 1 ? mx/mag : mx`), which means partial analog deflection was
  always going to produce proportionally slower movement — the joystick
  UI was the only piece actually missing, not new physics.
- The server's `clampAxis()` in `runtime/server.js` already accepted any
  finite float and clamped to `-1..1`, so it required no changes either;
  the input contract (`POST /api/input`, `moveX`/`moveY`/`action`/
  `actionEdge`) was already analog-ready even though nothing had sent
  analog values yet.
- Updated every "d-pad" reference across `README_FIRST.md`,
  `game.manifest.json`'s `controls.bindings`, `KNOWN_LIMITS.md`, and a
  code comment in `runtime/app.js` to say "joystick" instead, so the
  docs describe what's actually running.
- `npm test` unchanged at 35/35 — this was a controller-UI change with no
  simulation-logic surface, so no new unit tests were added; verification
  is `node -c`-clean JS plus the existing `/controller.html` static-serve
  test in `tests/server-http.test.js` still passing.

Still not done: no real device, so the actual feel of the joystick (dead
zone size, base diameter, thumb reach) is unverified. `physical_phone_qa`
stays `pending`.

## Build Receipt addendum — v0.6.1, same day, real frame-stepped rhythm tests

`KNOWN_LIMITS.md` flagged that the Radio station's rhythm verb had never
actually been resolution-tested — the existing false-alarm test happened
to use the `radio` station but with a `mash` verb, so `rhythm` itself had
zero dedicated coverage of either the success or failure path. Added two
tests to `tests/brace-room-selftest.js`:

- A well-timed tapper: steps `Core.tick()` in ~16ms increments (a real
  animation-frame cadence, not one lumped call) and sends a single
  discrete `actionEdge` tap per beat cycle timed inside
  `Core.RHYTHM_WINDOW_MS` of the beat, using `Core.nearestBeatDelta()` —
  the same function the live beat-dot rendering and `dev/balance-sim.js`
  already use. Confirms the fault actually resolves.
- An off-beat tapper: same frame-stepped harness, but every tap lands
  deliberately at the anti-phase point (325ms from the nearest beat,
  comfortably outside the 190ms window) once per cycle. Confirms it never
  resolves and times out as a miss — caught a real test-writing mistake
  in the process: the first draft asserted the fault was still present in
  `state.faults` after the loop, which is wrong for *either* outcome
  (resolved or expired both remove it from the array); fixed to check
  `state.stats.resolved`/`state.stats.missed` instead, which actually
  distinguishes the two.

`npm test` is now 37/37 (was 35/35). This closes the *logic* half of the
rhythm-tap gap — the timing math genuinely works under realistic
per-frame stepping. The *feel* half (does a 650ms beat / 190ms window
read as fair to an actual person) is unchanged and still needs a real
human playtest; see the updated `KNOWN_LIMITS.md`.

## Build Receipt addendum — v0.6.2, same day, real evidence screenshot suite

`KNOWN_LIMITS.md` flagged that the `evidence/visual/*.png` pass other
library entries carry had never happened for this slot. Closed the setup
and in-run half of that gap using the live `ai-seat-courier` (real headless
Edge over CDP, not generated images): launched a fresh session, walked the
lobby → crew size 1 → shift 6 min → start-shift flow, then captured four
real PNGs now in `evidence/visual/` — the setup screen, an active run
showing a live fault plus a false-alarm toast together, the same run with
high contrast toggled (confirms the canvas-level palette switch reaches
station outlines/rings/labels, not just page chrome), and the same run
with reduced motion toggled (confirms the countdown ring genuinely becomes
a static ring plus a numeric seconds readout, not a continuously shrinking
arc — visually proven now, not just claimed in prose). See
`evidence/visual/README.md` for exact per-file detail, including why hull
integrity visibly drops across the set (no controller was resolving
faults — that's the balance-sim-verified decay curve working as intended,
not a capture artifact).

Deliberately left out: a win/loss end-screen capture. The shortest
contract is 6 real minutes and there's no debug fast-forward hook in the
code, so reaching an end screen honestly costs several real minutes of an
idle headless session — left for a real playtest pass to pick up naturally
rather than spent here. `npm test` unaffected (no runtime code changed),
still 37/37.

## Build Receipt addendum — v0.6.3, same day, balance confirmation + ARIA fixes

Two independent pieces of remaining-budget work, neither touching core
gameplay math beyond what's noted below:

**Balance confirmation.** Re-ran `dev/balance-sim.js` at 300 seeds per
cell (was 40) to check whether the existing win-rate table was a real
curve or a lucky small sample. It held up closely (see `BALANCE_NOTES.md`
"Confirmation pass" section) — no new bug found this time, said plainly
rather than inventing one. Did surface one number worth knowing plainly:
1-player/12-minute sits at 64% even for a flawless bot, and checked the
raw per-seed losses for that cell specifically — they all happen late
(610-715s of a 720s max, after 125-147 successful resolves), so it's
genuine long-session solo attrition, not a spawn bug or an early unfair
spike.

**ARIA/accessibility fixes.** `KNOWN_LIMITS.md` flagged the accessibility
toggles as unverified against any actual screen reader. Found and fixed a
real structural gap in the meantime: the crew-size/shift-length pickers
were plain buttons inside a `role="radiogroup"`, missing `role="radio"`
and `aria-checked` on the children entirely — a genuine ARIA pattern
violation, not a style nitpick. Fixed in `runtime/index.html` and
`runtime/app.js`'s `setActiveChip()`; also gave the sound-mute button a
persistent `aria-label` instead of relying on `title` alone. Verified live
through a real `snapshot` (`ai-seat-courier`) against a running session —
Edge's own accessibility tree now reports `role: radio` inside a properly
named `role: radiogroup`, confirmed by the browser, not just asserted from
source. Full detail and honest scope (what's still visual-only, why
`controller.html` was deliberately left alone) in the updated
`KNOWN_LIMITS.md`. `npm test` still 37/37 — no gameplay logic touched.

## Build Receipt addendum — v0.6.4, same day, disconnected-seat signal

`KNOWN_LIMITS.md` said a dropped phone connection "just makes that seat
stop responding" with nothing telling the rest of the crew why. Closed
that: `GET /api/input` in `runtime/server.js` now reports a per-seat
`phoneStatus` (`'fresh'` / `'disconnected'`) for every seat that has ever
posted this session — not just currently-fresh ones, which is what the
endpoint returned before — so the client can tell "never had a phone"
apart from "had one, it just dropped." `app.js` tracks each seat's last
known status and fires a real toast on the actual transition in either
direction, reusing the existing `aria-live` toast feed rather than adding
new UI (a small bonus from the accessibility pass two versions ago —
connection events get announced the same way fault events already are).

Added two checks to `tests/server-http.test.js` (fresh vs. disconnected
reporting, absent-not-false-disconnected for a seat that never posted) —
both pass, 23/23 server checks, 37/37 total with `brace-room-selftest.js`
unchanged.

Honest gap on this one: tried twice to catch the toast live in a
screenshot through `ai-seat-courier`, both missed — the courier's own
round trip (multi-second, file-based) is longer than the toast's 1.6s
visible window, so timing a screenshot inside that window through this
particular bridge isn't reliable. That's a tooling limitation of
screenshotting something transient this way, not a claim the toast
doesn't fire — the server-side transition data is test-verified, and the
client trigger logic is simple, deterministic, and was read directly
rather than assumed.

## Build Receipt addendum — v0.6.5, same day, procedural visual polish

Mike asked to see the visuals move toward "finished," with steps visible
along the way. Stayed inside the zero-third-party-asset policy the whole
pass — see the updated `ASSET_PROVENANCE.md` for the exact canvas-API
techniques. Summary: a radial-gradient vignette behind the background
grid, a dim track ring plus glow on the hull gauge, a persistent soft glow
and subtle gradient fill on every station (previously only idle ones
pulsed), matching-color glow on the fault countdown/effort rings, and a
presence-glow halo on player tokens. All of it is gated off under high
contrast on purpose — that mode's whole point is flat maximum-contrast
shapes, and gradients/glow would undermine it.

Verified two ways, not just visually: `node -c runtime/app.js` for syntax,
full `npm test` (still 37/37, none of this touches simulation logic), and
two live courier screenshots — one in normal mode showing the glow/
gradient actually rendering (`evidence/visual/05-visual-polish-glow-
vignette-normal.png`), one in high contrast confirming it's correctly
suppressed there (`06-visual-polish-high-contrast-unaffected.png`). Not a
finished art pass — still flat vector shapes, just with real depth cues
instead of none — but a genuine step toward less "old paint," which is
exactly the gap Mike named after seeing the holodeck's own unfinished
skin layer earlier tonight.
