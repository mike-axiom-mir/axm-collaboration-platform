# Brace Room low-poly visual pass 01

Status: **WORKING · package remains TEST 0.7.0 · not CANON · Mike and physical co-op QA pending**

Sealed: 2026-08-16T10:28:32+02:00

## Scope

This pass upgrades slot 019, `Brace Room`, from a Canvas-only arena to a
hybrid Canvas plus transparent raw-WebGL presentation. Canvas remains the full
gameplay, input, label, accessibility, fallback, and simulation-authority
surface. The new pointer-free `brace-room-station-depth-01` layer adds:

- real depth-tested WebGL triangles with pixelated low-poly scaling;
- raised, verb-shaped console prisms at all six authored station coordinates;
- an extruded hull reactor and hull-state annulus registered to the existing
  Canvas gauge;
- fault-height pulses and raised fault annuli registered to authoritative fault
  state;
- two-part faceted crew markers registered to all active player coordinates;
- live renderer, pass, station, player, fault, primitive, triangle, frame,
  motion, High Contrast, authority, collision, and fallback receipts;
- a tested no-WebGL route that hides the additive surface and leaves the Canvas
  game intact.

High Contrast explicitly hides the 3D layer and retains the package's original
maximum-contrast Canvas presentation. Reduced Motion uses static heights and
phases. No hull, fault, spawn, rhythm, effort, collision, movement, input,
phone, gamepad, score, timing, or authority rule changed. No remote asset was
added.

## Visual evidence

Untouched baselines:

- `baseline/01-setup.png` — existing four-seat setup.
- `baseline/02-gameplay.png` — Canvas-only arena before this pass.

Accepted after evidence:

- `after/01-station-depth.png` — live single-player hybrid arena with all six
  stations, hull relief, crew prism, and one registered fault; 18 primitives
  and 412 triangles.
- `after/02-high-contrast-canvas-only.png` — live `C` toggle with the depth
  surface CSS-hidden and diagnostics reduced to zero geometry.
- `after/03-reduced-static-depth.png` — live `M` toggle with
  `motion=reduced-static`, while the Canvas retains the fault's numeric seconds.
- `after/04-four-crew-depth.png` — all four authoritative crew seats registered
  into 23 primitives and 446 triangles.
- `after/05-four-crew-motion.png` — later four-crew state with two faults, 25
  primitives, and 606 triangles; the depth frame advanced from 2,389 to 2,453
  over 420 ms.

The live browser exercised one- and four-player starts, six-minute selection,
normal presentation, High Contrast, Reduced Motion, and repeated frames. The
browser log remained empty.

## Verification

The final package command passed all **91** declared checks:

- 18 core gameplay/balance checks;
- 24 WebGL, fallback, accessibility-policy, authority, package, and integration
  checks;
- 24 universal-gamepad mapping checks;
- 25 server/HTTP/relay checks.

All ten required Workshop commands returned exit code 0 after the final code.
`verify.js` reported 0 failures and 38 warnings. Browser render/click checks
were performed separately from compilation and HTTP checks.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `73ad16e640851d1e64afa73792451013b36ae7a761d176f2beffec80b5e505ef` | `c87c63d1dff9c01e608c9a7e49b3526a42fb7902e06d18a0c22061916f57a47f` |
| `runtime/styles.css` | `386a2dc731df014683dbe28bb7709256e85d9261038eeb77c462065818dd6687` | `9d0589d1e347f804e3e52425333959b7e0b606e7122591877063e89257f8ffc4` |
| `runtime/app.js` | `3f79e1aa28b1a356d0b8102ae3109e0e480843195ffe612892b3b6224df3702c` | `898f08467bc3d4d20fb06ab884c7d88d259131dac280ca627955071e830e8ac5` |
| `runtime/game-core.js` | `6652334b76b47dd628fbb9eba7caf735a20e86b0e9a4c9c134e3a2edf12767b3` | unchanged |
| `runtime/server.js` | `4e65371960dde4cf10a446fb2847d09b91297eedd6560114b1ff2b4430aeb1b5` | unchanged |
| `runtime/brace-depth.js` | absent | `dc93c40c9b6b4bd1401e421ee8deee9165e612788896c265222cdc3008a0525a` |
| `tests/brace-room-selftest.js` | `99cbfae2bc61b057d037518b5685416fed5f978facb2d2041f08ae44aced372b` | unchanged |
| `tests/brace-depth.test.js` | absent | `11e8238f7985dd1d40cfb082cd328ef7f2eadf8e5f4fbb7fc17b52a8525c3b9a` |
| `game.manifest.json` | `55416733b7b2074bb005ef53588ea2064f5b5a0c82c1c2f776ca1b52d0c2ca4c` | `c7c1a18558668cf9ae78973aedfecc7d3e3594c19da73b4c8283c0d52b63867c` |
| `package.json` | `a7a78c15a40d443813ad77dacdd858b87c484eee0ef6b768d3249221b15956ec` | `8810c66e94d5e05d8879ac2ed8aa60a61b2fdbc52d2915d75f3db3e2b5fabdaf` |

## Open limits

- Visual quality and the additive relief balance require Mike's review.
- This is a registered low-poly relief layer, not a free-camera fully modelled
  3D room, character rig, animation, LOD, or production asset pipeline.
- High Contrast intentionally remains Canvas-only.
- Continuous rolling capture was unavailable; repeated screenshots are bounded
  observations.
- Physical four-person play, physical phones, physical gamepads, reconnect on
  real devices, human fun/balance, representative GPU performance, and a long
  target-hardware soak remain unverified.
- Steamworks, depots, store package, achievements, Cloud, controller
  certification, install/update/remove, and release authority remain outside
  this pass.
- The full slot is untracked in the shared worktree. This receipt does not claim
  review, acceptance, merge, release, or canonization.
