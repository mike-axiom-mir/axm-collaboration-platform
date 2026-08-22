# Known Limits — Brace Room v0.7.0

Honest state as of the second build pass (first playtest + phone controller
added). Nothing here is hidden from the manifest; `game.manifest.json` marks
the matching fields `pending`.

## Universal gamepad — integrated, physical-device QA pending

- The shared screen now maps up to four standard browser gamepads to stable
  P1-P4 seats under `axm-universal-xbox-brawl-v0.2.1`. Left stick/D-pad is
  movement, `A`/right trigger is the single station action plus start/replay,
  and Menu pauses. Neutral pads do not suppress keyboard or phone input; the
  strongest movement axis wins and action edges are merged once per press.
- `tests/universal-gamepad.test.js` exercises dead zones, analog axes, D-pad,
  A, right trigger, Menu edge behavior, unsupported mappings, manifest/runtime
  agreement, and four-seat integration. The visibly labeled `?gamepadQa=1`
  harness can verify the browser-side adapter with a simulated standard pad,
  but that is not evidence of USB/Bluetooth enumeration, reconnect behavior,
  or physical button feel; the panel literally says so while it is active.
- **Still pending:** run at least one real controller through connect, P1 move,
  A/RT action, Menu pause/resume, disconnect fallback, reconnect, and a second
  controller taking P2. `physical_gamepad_qa: pending` remains in the manifest
  until that human/device pass happens.

## Fixed since the first pass

- **"Breaker always fails" (real bug, not a balance issue).** Clicking
  "Start shift" left the button focused. Releasing the Space key while
  focused on a `<button>` makes the browser fire its own click on that
  button — which called `startRun()` again and silently wiped the whole
  session, including any in-progress fault effort, every time an action
  key was released. Fixed by calling `preventDefault()` on every reserved
  gameplay/global key in `runtime/app.js`, plus explicitly blurring the
  active element after every overlay button click as a second layer of
  protection. This was the actual cause of Breaker (and every other `hold`
  station) appearing impossible to complete.
- **Effort progress was nearly invisible.** The old feedback was an 18px,
  35%-opacity dot. Replaced with a full progress ring on the station itself
  plus a live percentage readout, so "am I making progress" is obvious at a
  glance.

## Phone controller — built, not yet physically verified

Game Hub's existing QR/lobby seam (`lobby-controller.html`, one directory
up) already handles seat assignment, ready-up, and redirecting a joined
phone to `launch.controller_path` once the host launches — Brace Room now
plugs into that instead of reinventing it:

- `runtime/controller.html` is a real analog joystick (drag anywhere on the
  base circle, clamped to its radius, small dead zone near center) plus one
  ACTION button — matching `DESIGN_BIBLE.md`'s original spec. The first
  build shipped a 4-button d-pad instead as a known shortcut; that's been
  replaced now that there's time to do it properly. `game-core.js`'s
  `applyMovement()` already only normalizes the input vector when its
  magnitude exceeds 1, so partial stick deflection gives proportionally
  slower movement with no core-logic changes required — the joystick UI
  was the only missing piece.
- It posts to `POST /api/input` on this game's own server at ~20Hz;
  `runtime/app.js` polls `GET /api/input` at ~12.5Hz and merges any fresh
  seat's phone input with that seat's keyboard cluster (phone movement
  takes priority when present; `action` and `actionEdge` are OR'd so
  either input source can trigger a resolve).
- A phone entry goes stale and is dropped after 400ms of silence
  (`INPUT_TTL_MS` in `runtime/server.js`). Previously a dropped connection
  just made that seat stop responding with zero explanation on the shared
  screen — now `GET /api/input` also reports a per-seat `phoneStatus`
  (`'fresh'` / `'disconnected'`) for every seat that has ever posted phone
  input this session, not just the currently-fresh ones, and `app.js`
  fires a real toast ("P2 phone controller lost connection — keyboard
  still works" / "...reconnected") on the actual fresh→disconnected and
  disconnected→fresh transitions, reusing the existing `aria-live` toast
  feed so it's announced the same way fault events already are. Server
  side is covered by two new checks in `tests/server-http.test.js`
  (fresh-vs-disconnected reporting, and that a never-connected seat is
  absent rather than falsely "disconnected"). The client-side transition
  logic was verified by direct code reading, not by an independent live
  screenshot: two attempts to catch the 1.6s toast in a screenshot through
  the `ai-seat-courier` both missed, because each courier round trip took
  longer than the toast's own visible window — an honest tooling
  limitation of screenshotting something transient through an
  asynchronous file-based bridge, not evidence the toast doesn't fire.
- **Not yet done:** an actual physical phone was never used against this
  build — no device was available in any build session so far. The
  relay is exercised by `tests/server-http.test.js` (POST/GET round trip,
  stale-entry expiry logic, unknown-seat rejection) but not by a real
  human tapping a real touchscreen. `physical_phone_qa: pending` in the
  manifest reflects exactly that gap. In anticipation of that eventual
  test, `runtime/controller.html` now also sets `touch-action: none` /
  `overscroll-behavior: none` and prevents `touchmove` at the document
  level (stops page scroll/pinch-zoom from stealing a touch mid-hold),
  requests a Wake Lock so the phone's screen doesn't dim/lock mid-session
  (a real risk for a co-op game where a session can run 6-12 minutes),
  and gives the ACTION button a short `navigator.vibrate` buzz. All three
  are progressive enhancements guarded by feature detection — none of
  them can break input on a device that doesn't support them, and none
  of them have been confirmed against a real device either. They're a
  best-effort reduction of *known* failure classes, not proof the
  physical-phone gap is closed.
- Polling mismatch between the phone's 20Hz post rate and the screen's
  12.5Hz poll rate means a single physical tap could in rare cases be
  read as an edge across two consecutive polls, slightly over-crediting a
  `mash` station. Minor, not gameplay-breaking, worth revisiting after a
  real playtest confirms whether it's even noticeable.

## Balance is bot-sim-verified, not human-playtested

A headless bot playtest (`dev/balance-sim.js`) found and fixed three real
bugs — a wave-3 concurrency cap that made every session mathematically
unwinnable, a hull-economy ratio that guaranteed a slow bleed to zero, and
a Bulkhead fault that silently consumed a 2-3 player crew's entire
capacity. Full writeup in `BALANCE_NOTES.md`, including the resulting
win-rate table. That table is a **coordinated, always-correct bot's upper
bound**, not a human-accuracy prediction — treat it as "the rules are
provably winnable," not "this is how hard it'll actually feel." The
effort-gain constants (`MASH_GAIN`, `HOLD_RATE`, `RHYTHM_GAIN`,
`CREW_RATE`, `DECAY_RATE` in `runtime/game-core.js`) are still first-guess
numbers for individual station *feel*, not tuned against a real human
playtest — a real playtest, ideally with someone new to the game, is still
the next real gate.

## Rhythm-tap timing is now frame-simulated, feel is still unverified

The `radio` station's beat-timing window (`RHYTHM_BEAT_MS`,
`RHYTHM_WINDOW_MS`) previously had no dedicated resolution test at all —
only a false-alarm test happened to use the `radio` station with a `mash`
verb. Two new tests in `tests/brace-room-selftest.js` step the simulation
in ~16ms frames (matching a real animation-frame cadence) and send a
single discrete tap per beat cycle: one lands on-beat every cycle and
resolves the fault, the other lands deliberately at the anti-phase point
(325ms off, well outside the 190ms window) every cycle and never resolves,
timing out as a miss instead. That confirms the *logic* behaves as
designed under realistic per-frame stepping, not just under a single
lumped `tick()` call. What it still can't confirm is *feel* — whether a
650ms beat with a 190ms window reads as fair or frustrating to an actual
person watching the beat dot and tapping along. That's still a real human
playtest question, not a test-suite one.

## Accessibility toggles

`M` (reduced motion) now genuinely changes canvas rendering, not just CSS:
the per-fault countdown ring becomes a static ring plus a plain numeric
seconds-left readout instead of a continuously shrinking arc, and the
Radio station's orbiting beat dot is replaced with a static ring that just
flashes on-beat instead of rotating every frame.

`C` (high contrast) now also reaches the canvas, not just CSS-level page
chrome: station outlines/fill, fault rings (both the time-remaining ring
and the resolve-progress ring), the Radio beat dot, station labels, and
the hull-gauge background all switch to a near-maximum-contrast palette
(pure white/black plus a bright cyan-vs-yellow split so real faults and
false alarms stay visually distinct) via a `palette` object chosen once
per frame in `render()` (`runtime/app.js`). Player colors and particle
colors are intentionally left alone — they're already highly saturated
and weren't the reported gap. Neither toggle has been checked against an
actual screen reader or verified with anyone who uses these settings day
to day; treat both as a first pass, not a compliance claim.

### Setup-screen ARIA structure fixed; live gameplay still visual-only

A separate, structural gap: the crew-size and shift-length pickers were
plain `<button class="chip">` elements inside a `role="radiogroup"`
container — a real ARIA pattern violation, since a radiogroup's children
need `role="radio"` and `aria-checked` for a screen reader to announce
selection state at all. Fixed in `runtime/index.html` (`role="radio"` +
initial `aria-checked` on each chip) and `runtime/app.js`'s
`setActiveChip()` (keeps `aria-checked` in sync on every click). Also
added a persistent `aria-label` to the sound-mute button rather than
relying on `title` alone, which isn't reliably exposed as an accessible
name by every screen reader. Verified live, not just by reading the
source: a real `snapshot` through the `ai-seat-courier` against a running
session shows Edge's own accessibility tree now reporting `role: radio`
inside a named `role: radiogroup` ("Crew size" / "Shift length"), and
`role: button, name: "Mute sound"` — confirming the browser actually
computes it this way, not just that the markup looks right. The
`aria-checked` toggle itself was verified by reading `setActiveChip()`
directly rather than an independent live check, since the snapshot
action's accessibility dump didn't include a `checked` field to confirm
against.

Deliberately not touched: `runtime/controller.html`'s joystick and
ACTION button. Both require real-time analog touch-drag input, which has
no meaningful screen-reader equivalent — this is a modality mismatch, not
an ARIA gap, so markup changes there wouldn't move real accessibility.
Also still open: live in-run gameplay state (hull, wave, active faults)
is canvas-only and only reaches a screen reader through the existing
`aria-live="polite"` toast feed for discrete events — continuous state
like "Hull now 64" is never announced. Making that genuinely usable
non-visually is a real design question (how much to announce without
being overwhelming), not a quick markup fix, and needs real input from
someone who'd actually use it, not a guess made in isolation.

## Sound is procedural, unmuted by default, and resets every load

All audio is synthesized with WebAudio oscillators — no audio files, same
zero-third-party-asset policy as the visuals (`ASSET_PROVENANCE.md`). The
mute toggle (top-right of the HUD) works but the preference isn't saved
anywhere; it resets to unmuted on every reload, consistent with this
build's "no persistence in v1" decision. Autoplay policies mean the
AudioContext only unlocks on the Start-shift click (a real user gesture);
sound before that point is silent by design, not a bug. None of the actual
tones have been checked against a real speaker in a real room — volumes
were chosen by ear from source code, not tested in the environment they're
meant for.

## No persistence / reconnect for the game session itself

The server still holds no game-simulation state — only the short-lived
phone-input relay buffer described above. A page reload on the shared
screen restarts the run from the start screen. `host_reload_recovery` is
`pending`.

## Evidence screenshot suite — setup and in-run states done, win/loss still missing

`evidence/visual/` now has four real captures taken through the live
`ai-seat-courier` (a real headless Edge session, not generated images): the
setup screen, an active run showing a live fault plus a false-alarm toast,
the same run with high contrast on, and the same run with reduced motion
on — the last one directly confirms the countdown ring really does become
a static ring plus a numeric seconds readout under reduced motion, not just
the code comment claiming it. See `evidence/visual/README.md` for exactly
what each file proves.

Still missing: an actual win or loss end-screen capture. Reaching one
honestly needs several real minutes of elapsed session time (shortest
contract is 6 minutes) with no debug fast-forward hook in the code, so it
was left for whenever a real playtest session reaches one naturally rather
than burning minutes on an idle headless session just for a screenshot.

## Server exposes its own source over HTTP

`runtime/server.js` serves any file under `runtime/`, including itself and
`app.js`/`game-core.js` as plain text if requested by path. This is
consistent with `local_only_default: true` (binds to `127.0.0.1`, not a
public listener) and matches the lightweight pattern other slots use, but
is worth knowing if this game is ever exposed beyond localhost.
