# BuddyFarm universal gamepad verification

Status: **TEST / LOGIC + LIVE SIMULATION PASS / PHYSICAL DEVICE HOLD**

Date: 16 August 2026

Profile: `axm-universal-xbox-brawl-v0.2.1`

## Implemented contract

- Standard-mapping pads only; unsupported mappings produce no game intention.
- Stable pad index 0–2 binds to ordered human seats only. A missing pad does not
  shift another pad into a different seat, and AI seats remain unassigned.
- Left stick/D-pad moves, A or right trigger owns the existing Action tap/hold
  lane, X owns Work, View toggles the map and Menu toggles the controls guide.
- Disconnect cancels any incomplete local Action hold and preserves keyboard and
  phone fallback.
- `?gamepadQa=1` exposes a visible simulated-pad harness labeled as logic/browser
  QA and not physical-device evidence.

## Scripted evidence

- `node tests/buddyfarm-selftest.js`: PASS, including stable human-only pad
  ownership, runtime delivery of the adapter and launcher-state disclosure.
- `node tests/buddyfarm-three-selftest.js`: PASS; the preserved low-poly Three.js
  presentation contract remains intact.
- `node --test --test-concurrency=1 tests/universal-gamepad.test.js`: PASS · 7
  tests covering profile identity, empty/unsupported states, dead zone, axis
  clamp, D-pad priority, A/right-trigger Action, X Work, View/Menu edges, static
  runtime wiring and the physical-evidence boundary.
- Universal control policy selftest: PASS · all 19 installed manifests
  inspected.
- Game-package verification closed BuddyFarm's adapter-migration warning. The
  library warning count moved from 38 to 37. The first run caught a concurrent
  Small Odds 017 manifest before its two new documents arrived; once that
  foreign lane settled, the rerun passed all 19 packages with 0 failures.
- `npm run test:workspaces`: PASS, including the 19-package verifier, GameHub
  checks, District Party's 225 focused tests and 55/55 HTML script checks.
- All ten repository-required commands from `AGENTS.md`: PASS. The latest
  `node verify.js` checkpoint reported 0 failures and 38 warnings; RepairBuddy
  preserved the distinct 37-item game-package warning route.

## Live browser evidence

Visual backend: **BROWSER_PRIMARY** · 1280 × 720 local route.

- The labeled QA route visibly rendered the existing low-poly starter farm plus
  `TEST GAMEPAD SIMULATION` and `not physical-device evidence`.
- Two simulated standard pads reported `P1 / P2 READY`, profile
  `axm-universal-xbox-brawl-v0.2.1`, 2 ready, 0 unsupported and 0 blocked.
- Bounded P1 left-stick-right moved x `18 → 22` while P2 stayed at x `19`.
  Bounded P2 left-stick-left then moved x `19 → 14` while P1 stayed at x `22`.
- After a controlled local reset, P1 X prepared the targeted grass tile; the
  visible message changed to `Mike prepared a grass tile for planting.`
- P1 A tap produced the contextual no-target response without travel. At the
  visibly staged farmhouse approach, P1 A held for 260 ms changed the scene from
  farm to Buddy House and reported `Mike entered the farmhouse.`
- View toggled `Full map` to `Close full map` with `aria-pressed=true`. Menu
  opened a readable five-binding controls overlay and a second Menu press closed
  it.
- A non-standard P1 pad reported `P2 READY · 1 NEEDS STANDARD MAPPING`; P1
  position and step count stayed unchanged. Three connected pads with only two
  human seats reported `P1 / P2 READY · 1 UNASSIGNED`.
- Disconnect returned to `NO PADS · KEYBOARD + PHONE READY`, 0 ready, 0
  unsupported and 0 blocked. The query-free route hid the QA panel, exposed QA
  mode `off` and kept the controls entry visible.
- Browser warning/error logs were exactly `[]`.

No raw recording or temporary screenshot files were created. Selected proof
frames were emitted inline.

## Boundary

Physical Bluetooth/USB gamepad testing remains **UNRUN** and cannot be satisfied
by the simulated harness. Exact hardware stick feel, trigger thresholds,
Bluetooth reconnect and three simultaneous physical pads remain pending.
