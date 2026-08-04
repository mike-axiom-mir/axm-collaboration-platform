# Known Limits — Brace Room v0.2.0

Honest state as of the second build pass (first playtest + phone controller
added). Nothing here is hidden from the manifest; `game.manifest.json` marks
the matching fields `pending`.

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

- `runtime/controller.html` is a d-pad + one ACTION button (not an analog
  joystick — simpler to get right without a real device to test against
  yet; an analog stick is a reasonable later polish, not a functional gap).
- It posts to `POST /api/input` on this game's own server at ~20Hz;
  `runtime/app.js` polls `GET /api/input` at ~12.5Hz and merges any fresh
  seat's phone input with that seat's keyboard cluster (phone movement
  takes priority when present; `action` and `actionEdge` are OR'd so
  either input source can trigger a resolve).
- A phone entry goes stale and is dropped after 400ms of silence
  (`INPUT_TTL_MS` in `runtime/server.js`), so a dropped connection just
  makes that seat stop responding rather than freezing anything.
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

## Rhythm-tap feel is unverified outside unit tests

The `radio` station's beat-timing window (`RHYTHM_BEAT_MS`,
`RHYTHM_WINDOW_MS`) is exercised in tests only through direct effort-math
checks, not through a simulated human tapping against a real animation
frame. It may feel stricter or looser in the browser than the numbers
suggest.

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

## Evidence screenshot suite not done

Other library entries carry a large `evidence/visual/*.png` set. That pass
hasn't happened yet — get the visuals stable through a real playtest
first, then screenshot once, per `BUILD_PLAN.md`.

## Server exposes its own source over HTTP

`runtime/server.js` serves any file under `runtime/`, including itself and
`app.js`/`game-core.js` as plain text if requested by path. This is
consistent with `local_only_default: true` (binds to `127.0.0.1`, not a
public listener) and matches the lightweight pattern other slots use, but
is worth knowing if this game is ever exposed beyond localhost.
