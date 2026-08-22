# Bonk & Bolt universal gamepad verification

Status: **TEST / LOGIC + LIVE SIMULATION PASS / PHYSICAL DEVICE HOLD**

Date: 16 August 2026

Profile: `axm-universal-xbox-brawl-v0.2.1`

## Implemented contract

- Standard-mapping pads only; unsupported mappings remain visible and produce no
  movement or action.
- Stable pad index 0 controls P1 and index 1 controls P2. A pad for an inactive
  P2 seat is reported as unassigned rather than silently controlling P1.
- Left stick or D-pad moves. A or right trigger attacks, B dodges, X uses the
  class special, and Menu pauses/resumes or closes a non-final activity.
- P1 additionally maps Y to interact, left bumper to the partner action, and
  View to the world map.
- Keyboard and mouse controls remain available. Disconnecting a pad restores
  that fallback without changing the save or seat map.
- `?testSteward=gamepad&testCoop=1&gamepadQa=1` exposes a visible, explicitly
  labeled simulated-standard-pad harness. It is browser/logic evidence only and
  never counts as physical-device evidence.

## Scripted evidence

- `node tests/package-selftest.js`: PASS · 138 checks, including the pure
  standard-pad mapper, dead zone, D-pad override, button edges, right-trigger
  primary action, manifest/runtime wiring and labeled QA boundary.
  The runtime wiring also clears a held fishing action on disconnect.
- `node --test --test-concurrency=1 tests/*.test.js`: PASS · 31 tests, including
  253 systems checks, 25 visual-polish checks and HTTP delivery of
  `universal-gamepad.js`.
- `node tools/game-hub/game-package-verifier.js`: PASS · 19 packages · 0
  failures · 38 preserved warnings. Bonk & Bolt's adapter-migration warning is
  closed.
- `node tools/game-hub/universal-control-policy-selftest.js`: PASS · all 19
  installed manifests inspected.

## Live browser evidence

Visual backend: **BROWSER_PRIMARY** · 1280×720 local route.

- The first baseline found the labeled QA panel semantically present but hidden
  behind the title screen. Its test-only layer was raised above screen layers;
  the replay visibly showed `TEST GAMEPAD SIMULATION` and
  `not physical-device evidence`.
- In the staged co-op world, two simulated standard pads reported `P1 / P2
  READY`, profile `axm-universal-xbox-brawl-v0.2.1`, 0 unsupported and 0 blocked.
- P1 left-stick-right moved hero x `0.000 → 4.348` while P2 remained at x
  `2.000`. In a fresh bounded pass, P2 left-stick-left moved x `2.000 → -2.302`
  while P1 remained at x `0.000`; release returned both movement datasets to
  `0.00,0.00`.
- P1 A entered the tested attack motion at `anticipation`; P2 A independently
  entered attack recovery. P1 B entered dodge recovery with the visible cooldown,
  and P1 X entered special impact with the visible cooldown.
- Menu opened the visible pause screen and a second Menu press returned to the
  world. The QA status named both transitions.
- A non-standard P1 pad produced no movement and visibly reported `1 NEEDS
  STANDARD MAPPING · KEYBOARD READY`. Disconnect returned to `NO PADS · KEYBOARD
  READY` with both seats marked disconnected.
- In a solo route, pad 1 remained P1 and pad 2 was visibly `UNASSIGNED`: 1 ready,
  1 blocked, no P2 actor. It did not silently take another seat.
- The query-free route hid the QA panel, reported QA mode `off`, kept the compact
  no-pad fallback inside the world card, and rendered the expanded controller
  guide without clipping or HUD collision.
- Browser warning/error logs were exactly `[]`.
- A post-merge replay after the concurrent low-poly visual pass settled booted
  `patchwork-vale-dressing-01` with 1,048 terrain-detail instances and five
  detail draw calls. P1 moved x `0.000 → 4.134`, attack reached impact, Menu
  opened the pause screen, the query-free route hid the QA panel, and browser
  warning/error logs remained `[]`.

No raw video or rolling-buffer files were created. The selected proof frames
were emitted inline, so there are no temporary capture paths to delete.

## Boundary

Physical Xbox/Steam-compatible controller testing is **UNRUN**. This receipt
must remain `PHYSICAL DEVICE HOLD` until a human or hardware-capable verifier
observes real devices.
