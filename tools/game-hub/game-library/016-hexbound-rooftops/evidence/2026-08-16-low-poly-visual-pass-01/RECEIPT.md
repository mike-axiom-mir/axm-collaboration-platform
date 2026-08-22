# Hexbound Rooftops low-poly visual pass 01

Status: **WORKING · package remains PLAYABLE LOCAL ALPHA · not CANON · Mike review required**

Sealed: 2026-08-16T10:02:46+02:00

## Scope

This pass upgrades slot 016, `NEVERAFTER: HEXBOUND ROOFTOPS`, from a
Canvas-only battlefield to a hybrid Canvas plus raw-WebGL presentation. The
existing Canvas remains authoritative for input, rules, fog, HUD, and fallback.
The new transparent, pointer-free surface is presentation-only.

The accepted `neverafter-rooftop-depth-01` layer adds:

- depth-tested, extruded nine-sided roof facets for currently visible territory;
- raised bridge rails, roof-corner spires, building prisms, and formation prisms;
- deterministic registration to the Canvas camera, zoom, and shake;
- limited-palette flat shading, disabled multisampling, and pixelated scaling;
- live diagnostics for renderer, pass, fog policy, visible anchors, primitive
  count, triangle count, and frame number;
- a tested Canvas fallback when WebGL cannot be created.

The visibility boundary is intentionally strict: only territory already marked
visible by the existing systems is admitted, and a link is drawn only when both
endpoints are visible. No rules, authority, AI, collision, pathing, fog source,
or co-op transport changed. The module loads no remote asset.

## Visual evidence

Untouched baselines:

- `baseline/01-title.png` — existing title art.
- `baseline/02-setup.png` — existing setup flow.
- `baseline/03-battle-entry.png` — Canvas-only first battlefield frame.

The first technically correct WebGL setting was rejected after screenshot
inspection because 18 primitives and 273 triangles made the added depth too
timid. The accepted settings strengthen rails, roof spires, structures, and
formation facets without changing gameplay.

Accepted after evidence:

- `after/01-battle-entry-depth.png` — three visible anchors, 27 primitives, 408
  triangles.
- `after/02-expanded-depth.png` — four visible anchors, 37 primitives, 554
  triangles.
- `after/03-selected-army.png` — whole-army selection confirmed by the live UI
  as four squads and 31 fighters.
- `after/04-camera-zoom.png` — camera zoom registration with five visible
  anchors, 43 primitives, and 662 triangles.
- `after/05-pause.png` and `after/06-resumed.png` — pause/help overlay and resume
  remain readable and functional.
- `after/07-motion.png` — a later live frame; the depth-frame receipt advanced
  from 4708 to 4733 over 360 ms.
- `after/08-cloud-annex-depth.png` — the alternate Cloud Nine Budget Annex map
  registered its distinct topology with three anchors, 25 primitives, and 388
  triangles.

The browser console remained empty throughout the accepted runs. Screenshot
sizes and SHA-256 digests are enumerated in `verification.json`.

## Verification

The final focused suite passed:

- 23 WebGL/fallback/fog/authority/package checks;
- 4 bridge-routing, 1 co-op-relay, 3 district-charter, 20 faction-district, 5
  doctrine, 5 formation, 3 signature, 5 wonderwork, 4 map-mechanic, 4
  map-topology, 5 rival-strategy, 4 HTTP, 5 systems, and 4 tactical-atlas checks;
- 69 package self-test checks.

All ten required Workshop commands returned exit code 0 after the final code.
`verify.js` reported 0 failures and the Workshop's then-current 38 warnings. A
first combined invocation transiently reported one failure and aborted; without
any code change, the immediate isolated rerun and the complete ten-command rerun
both returned zero failures. This receipt preserves that observation rather
than treating the first result as if it never happened.

The capability comparator reported `DEGRADED`: all declared required
capabilities were ready except human networked co-op, whose relay is asymmetric
and does not prove a synchronized second game world. The checks do not prove a
physical second player, physical gamepad, Steam readiness, broad hardware
performance, a long soak, or human visual acceptance.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `9b98f621874117c1d0b8d18e534f81741ef78f03d5529ef31d7640919ccfd2dd` | `a8ebc92d973793cc8af349b0ff12040c129eca4b691c32d9e703dca35b9f46de` |
| `runtime/styles.css` | `ab8ea9d2f649c8dd6270101a6056ae5fa79ad8e9ecd1379521ddb4707abced66` | `3856545005414c4698d25e890ed767812f1378d1db5a1b12e5963046ee6d9d2d` |
| `runtime/app.js` | `5fb141e17e8e1bbb736072661fd66d5a3e5431d51a3cd64bba9c9a5819b14be0` | `e222dbef813c9b4cee67096c122b407e00d0d4187d05570484760d6f0a4ccfd3` |
| `runtime/game-data.js` | `56b5b12a7f3b7d763a83286925510d30102783a5e106c4dcd8a0c26b92f53fcb` | unchanged |
| `runtime/systems.js` | `a99ed0528b0ad6f9cb0992d5fa7aec4771400c4b79e93d98be0511d1def094d8` | unchanged |
| `runtime/server.js` | `d476b52b1bd5fc3e33b678b99c88f5d39fc35b0ba97c1fa7a37eeb9b79277641` | unchanged |
| `runtime/hexbound-depth.js` | absent | `57e129a166e2ac3af8250dbc15aee782e7442e2b523a4bec5a70d2a8ac7ab185` |
| `tests/hexbound-depth.test.js` | absent | `d86e4075ae3b80ad86169d9211eead5f830626f60613b4978886e9db8bb1c70b` |
| `game.manifest.json` | `7623afa9219c557417e3900912536870bd5cbee2b2ab16de1fe2ab2ad1f352d5` | `b2de3f38d0b03772b09bbb46bd0f69237dcc8b4086466f4508b2dca00a5aa1fd` |

## Open limits

- Visual quality remains subjective and requires Mike's play/review.
- The pass is an additive depth layer, not a free-camera fully modelled 3D world.
- Human co-op remains an asymmetric relay rather than a synchronized second
  simulation.
- Continuous rolling capture was unavailable; repeated screenshots are bounded
  observations and do not prove every intervening frame.
- Physical co-op/phone, physical gamepad, Steam integration and packaging,
  broad GPU coverage, external-profiler frame pacing, and a target-hardware long
  soak remain unverified.
- Historical `visual-temp-*` evidence folders were left untouched.
- The package is currently untracked in the shared worktree. This receipt does
  not claim review, acceptance, merge, or canonization.
