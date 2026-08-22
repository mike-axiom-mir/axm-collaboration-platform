# AXM Local GameHub live visual receipt

Status: **TEST**

Date: 16 August 2026  
Visual backend: `BROWSER_PRIMARY`  
Target: local Steam launch route and one shortest complete GameHub journey  
Raw recording: none  
Temporary capture paths: none  
Temporary services after test: ports `8789`, `8790`, and `8798` confirmed closed

## Claim 1 — Steam launch route reaches a usable GameHub lobby

- Surface: `start-steam-gamehub.js` →
  `http://127.0.0.1:8790/tools/game-hub/index.html`
- Observed viewport: 1280 × 720 CSS pixels at device scale 1.25.
- Baseline: the page visibly reported `ONLINE · 19 GAMES`, showed four default
  seats, named ready state, the complete 19-game selector, two world routes,
  GameHub truth copy, and a disabled/enabled launch state tied to seat readiness.
- Action: launched `008-district-party` with one ready human seat.
- Settled state: the header changed to `ROOM AXM1 · LIVE`; a live room appeared
  with named player, local controller route, playable/shared-screen controls,
  reflection action, and stop action.
- Counterevidence sought: blank page, stale game list, hidden party, disabled
  valid launch, ambiguous player identity, or missing live-room controls.
- Verdict: `PASS` for this one-seat route.

## Claim 2 — the launched game reaches active play and an overlay recovers

- Surface: District Party local launcher and Party A shared screen.
- Baseline: the local launcher visibly showed local-only/network truth, map and
  mode choices, one enabled seat, combat rules, and a start action.
- Action sequence: start local city session → open the Party A route → open
  `FULL MAP` → close `CLOSE MAP`.
- Observed transition: the active city HUD and player appeared; the full Tilburg
  city map replaced the camera with a clear close action; closing restored the
  same player, four-corner HUD, mission status, minimap, and safe-zone state.
- Counterevidence sought: stuck overlay, missing close control, blank camera,
  clipped map, changed player ownership, or stale HUD.
- Verdict: `PASS` for the map overlay open/close recovery at the observed
  desktop viewport.

## Claim 3 — controller ACTION reaches the authoritative shared game

- Sender evidence: the connected controller visibly identified Party A,
  `seat_1`, `ACTIVE`, health `100/100`, and exposed a named `ACTION` button.
- Action: clicked `ACTION` once.
- Receiver evidence: the Party A shared screen changed from `PARTY HOUSE` to
  `PARTY HOUSE MISSION BOARD` and displayed the four mission choices plus a
  close choice.
- Counterevidence sought: no receiver change, another seat changing, stale
  connection, duplicated action, or an unrelated overlay.
- Verdict: `PASS` for one bounded sender-to-receiver action. This does not prove
  sustained touch latency, disconnect recovery, or multi-phone behavior.

## Claim 4 — portrait phone layout is usable at 390 × 844

- Requested viewport: 390 × 844.
- Observed capability seam: the browser's viewport override returned without an
  error, but the page still reported 1280 × 720 CSS pixels. The controller was
  therefore observed only as a desktop render.
- Verdict: `UNKNOWN`.
- Named gap: `visual.browser.viewport.override.effective` / physical phone
  capture is unavailable in this receipt.
- Next cheapest test: open the QR route on a real portrait phone on the same
  private Wi-Fi, verify no vertical or horizontal clipping, operate both sticks
  and every button, then disconnect/rejoin during play.

## Additional observations

- Captured browser console warnings/errors: none on GameHub, District Party
  launcher, Party A screen, or controller.
- GameHub and District Party use `window.open` for player/shared-screen routes.
  The in-app verifier could not claim those external popup windows, so the
  target routes were opened directly. This proves their render, not the
  operating-system default-browser handoff.
- Motion cadence was not judged. No rolling video buffer was used; conclusions
  are based on bounded before/action/settled screenshots and semantic state.
- No screenshots containing controller session tokens were saved to the
  repository.

## Dedicated Steam shell follow-up

- Steam-mode route: the document title changed to `AXM Local GameHub`; the
  visible `TEST BUILD` notice named one local collection containing 19 game
  packages; Workshop back-navigation, world shelf, and asset-authoring inbox
  were absent; the selector contained 19 game choices and zero world choices.
- Normal Workshop route: the original `AXM Game Night` title, world shelf,
  asset inbox, Workshop back-navigation, 19 games, and two world choices stayed
  visible. This countercheck guards against unintentionally replacing the
  local Workshop experience with the Steam shell.
- Browser console warnings/errors: none on either shell route.
- Final dedicated-shell recheck: the actual Steam launcher started the isolated
  shell and GameHub service, then the Steam route rendered at `ONLINE · 19
  GAMES` with the same visible TEST notice and 19/0 game/world option split.
  The Steam shell returned 404 for `/hub/index.html`, `/server.js`, and
  `/api/profile`; it returned 403 for asset acceptance. The GameHub service
  itself also returned 403 for direct asset acceptance in Steam mode.
- Verdict: `PASS` for the conditional Steam presentation and dedicated route
  boundary at the observed desktop viewport. This does not prove default-
  browser OS handoff, clean-machine packaging, physical controllers, or phone
  portrait behavior.
