# Bonk and Bolt low-poly visual pass 01

Status: **WORKING · package remains TEST · not CANON · Mike review required**

Sealed: 2026-08-16T09:36:08+02:00

## Scope

This pass improves slot 014, `Bonk & Bolt`, without changing authoritative
movement, combat, camera, collision, save, or co-op rules. The existing local
Three.js r160 world and its production Human rig remain intact.

The accepted pass adds a deterministic `patchwork-vale-dressing-01` layer:

- five instanced low-poly detail layers: village cobbles, field grass, low
  shrubs, gem flowers, and horizon ridges;
- 1,048 terrain-detail instances in five additional draw calls;
- faceted windows, crossbars, shutters, roof trim, steps, and chimneys for the
  Human and Toon houses;
- portholes, rivets, antennae, and beacons for robot houses;
- live canvas receipts for pass id, instance count, and detail draw calls.

An early material configuration rendered the instanced dressing black. Live
screenshots exposed the defect. That attempt was rejected, the color path was
corrected, and a regression check now refuses `vertexColors: true` on these
materials. No black-instance screenshot is part of the accepted after set.

## Visual evidence

Untouched baselines:

- `baseline/01-title.png`
- `baseline/02-setup.png`
- `baseline/03-world-entry.png`
- `baseline/04-movement.png`
- `baseline/05-attack.png`
- `baseline/06-pause.png`

Accepted after evidence:

- `after/01-world-entry.png` — restored world with the new dressing active;
  the save-restored toast is still visible.
- `after/02-world-settled.png` — primary comparison: colored cobble plazas,
  dressed houses, denser fields, and unchanged HUD readability.
- `after/03-movement.png` — keyboard movement through the dressed plaza.
- `after/04-attack.png` — live `attack:slash` rig action during an incoming
  encounter.
- `after/05-pause.png` and `after/06-resumed.png` — pause overlay and recovery.
- `after/07-motion.png` — a later live frame; its digest differs from the
  resumed frame captured 360 ms earlier.
- `after/08-reduced-motion.png` — the runtime reported `reduced-static` after
  the visible accessibility toggle.
- `after/09-field-dressing.png` — field-scale shrubs, flowers, grass, and
  horizon dressing beyond the village plaza.

The canvas reported `patchwork-vale-dressing-01`, 1,048 detail instances, and
five detail draw calls. During interaction testing the hero could move, attack,
pause, resume, lose an encounter, respawn, and continue. The accessible defeat
announcement and recovered playable world were observed. Screenshot inventory
and SHA-256 digests are in `verification.json`.

## Verification

Focused package checks after the final color fix:

- `node tests/systems.test.js` — PASS, 253 checks.
- `node tests/hero-motion.test.js` — PASS, 8 tests.
- `node tests/coop-camera.test.js` — PASS, 10 tests.
- `node tests/hero-rig-contract.test.js` — PASS, 7 tests.
- `node tests/visual-polish.test.js` — PASS, 25 checks.
- `node tests/package-selftest.js` — PASS, 138 checks.
- `node tests/server-http.test.js` — PASS, 4 tests.

All ten required Workshop commands returned exit code 0 after the final code.
`verify.js` reported 0 failures and the Workshop's existing 39 warnings. A
passing script suite is not a browser claim, a Steam claim, or canonization.

The capability comparator reported `DEGRADED` overall while every required
capability was `READY`. Optional networked co-op, authored-audio depth,
commercial-scale proof, and long-session human proof remain degraded or
unknown.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `f5edb5e8cb4acbafb2ab2d469e83985be853ce343d07db49dc9586e7d17ee1f` | unchanged |
| `runtime/styles.css` | `22f88af04db3dd7ad2964f35aa29b26f0a9ab80acb740cbac56de225cd18d658` | unchanged |
| `runtime/app.js` | `2dba3ef1440a334b071e55f1fcaf3caa7a84450d8dc4b047b3e80ae34d9102df` | `db4f3180ba1bb9a9c26ebeea2db76ddd230294df8075cb67076521ec197b86f9` |
| `runtime/visual-polish.js` | absent | `52d443674e644f9218538b5783103372b99ce4417660b5ab80267df8b0ca48b0` |
| `tests/visual-polish.test.js` | absent | `1a417913b99d861b9cd909869031553be2dfded83a48eab7ecf87b366121f8cf` |
| `game.manifest.json` | `ef30a2fb7dbd24f9e2f24e81106cb295db45653829c1b9adf0dca4a3c0cccefe` | unchanged |

`index.html`, `styles.css`, and `game.manifest.json` were active shared seams
before this pass. Their pre-pass contents were preserved. The pass used an
isolated server on port 28814 because port 18814 was already occupied; the
other process was left untouched.

## Open limits

- Physical gamepad behavior, Steam integration, store packaging, controller
  certification, long soak, and broad GPU performance remain unverified.
- Continuous rolling capture was unavailable; repeated screenshots are bounded
  observations and do not prove every intervening frame.
- The pass adds five draw calls and 1,048 instances, but no broad hardware
  benchmark was run.
- Blender was unavailable for a broader bespoke cast pass; the existing local
  CC0 Human asset and code-native Toon remain the character routes.
- Visual quality is subjective and still requires Mike's play/review.

