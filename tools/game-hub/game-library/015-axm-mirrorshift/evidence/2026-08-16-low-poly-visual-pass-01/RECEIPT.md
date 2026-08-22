# Mirrorshift low-poly visual pass 01

Status: **WORKING · package remains PLAYABLE ALPHA · not CANON · Mike review required**

Sealed: 2026-08-16T09:48:35+02:00

## Scope

This pass upgrades slot 015, `AXM: MIRRORSHIFT`, from a Canvas-only race
presentation to a hybrid Canvas plus raw-WebGL presentation. The existing
Canvas keeps track readability, HUD, gameplay effects, result stages, and the
complete no-WebGL fallback. The new transparent surface is pointer-free and
presentation-only.

The accepted `mirrorshift-neon-depth-01` layer adds:

- real WebGL triangles with depth testing and an oblique low-poly projection;
- deterministic raised track beacons registered to each authored circuit;
- faceted core stacks and gate towers at authored landmarks;
- diamond hazard and item-pad geometry;
- raised four-sided kart canopies following interpolated presentation racers;
- flat limited-palette shading, disabled multisampling, and pixelated scaling;
- live DOM receipts for renderer, pass, primitive, triangle, frame, and motion
  state;
- a bounded `motion=reduced` verification route that complements the existing
  operating-system reduced-motion preference;
- a tested Canvas fallback when WebGL cannot be created.

No physics, collision, item, score, authority, track, or racer-stat rule was
changed. The module loads no remote asset.

## Visual evidence

Untouched baselines:

- `baseline/01-lobby.png` — existing polished roster/key-art lobby.
- `baseline/02-start-grid.png` — existing four-racer countdown presentation.
- `baseline/03-race.png` — Canvas-only Mirror Forge race before this pass.

Accepted after evidence:

- `after/01-result-depth.png` — result overlay remains readable and unchanged.
- `after/02-race-depth.png` — primary Mirror Forge comparison with 40 raised
  primitives and 530 WebGL triangles.
- `after/03-race-motion.png` — later live race frame, captured 360 ms after the
  primary frame with a different SHA-256 digest.
- `after/04-splitglass-depth.png` — Splitglass Gardens registered 39 primitives
  and 516 triangles, showing the layer follows authored circuit geometry rather
  than one fixed backdrop.
- `after/05-mirror-core-depth.png` — Mirror Core battle registered 16 primitives
  and 216 triangles while the battle HUD and authority-owned state continued.
- `after/06-reduced-motion.png` — live Mirror Core state with depth motion
  `reduced-static`; the existing kinetic and environment receipts both reported
  reduced motion `true`.

The browser console remained empty throughout the accepted runs. Visual
screenshots and SHA-256 digests are enumerated in `verification.json`.

## Verification

`npm test` passed after the final code and included:

- 29 low-poly WebGL/fallback/package checks;
- 36 core game checks;
- 45,504 interpolation poses and 864 teleport snaps;
- 108,000 bounded kinetic poses;
- 112 result-stage and 112 start-grid poses;
- 72,000 environment choreography poses;
- reflection, echo, target-recorder, four-phone contract, managed-LAN, 24-seed
  quality, three-track, nine-format, 32-seed battle, Signal Tour, virtual
  30-minute reliability, restart recovery, and HTTP traversal suites.

All ten required Workshop commands returned exit code 0 after the final code.
`verify.js` reported 0 failures and the Workshop's existing 39 warnings. These
checks do not prove physical phones, a physical gamepad, Steam readiness,
target-hardware frame pacing, or human visual acceptance.

The capability comparator reported `UNKNOWN` overall with no missing declared
capabilities. Combat remains degraded pending representative human attack-storm
measurement; balance, presentation approval, real four-phone LAN, target
hardware performance, long soak, and steward approval retain honest unknown or
degraded states.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `e1fa625ba94fe0a7e978b152396b64ba4a3f84b8154b5f72f1475298ab5e1493` | `ff7d3da60fc3b9d0262131a01e2c4b93c2ffe1454927cff534f859ad62e2f395` |
| `runtime/styles.css` | `3d6047ca84e45cdb6b2b94a2c6a74a6256d07b12287d2801152fbe4a9c035706` | `1116a8d2eb7c5a4b962a2d878f0f2a481afa90f02214c9eb894ac20595847b17` |
| `runtime/app.js` | `2efd50ffd76a70d4b7b693904918d87edf62b9390bca773042523adc07f873cf` | `74f958a841cc6fb93b2ba9e37b0bfe05c440e4eea6ffc83c57af099966d6d265` |
| `runtime/game-core.js` | `32e534a91b1cadfa05d360902db5bf0e7a22c3fcb03b5375691cd55679499d2c` | unchanged |
| `runtime/server.js` | `89508bedd369bf94a312f8815143cc5f4f5b9788e1d3c4a10f599032a0b25010` | unchanged |
| `runtime/mirror-depth.js` | absent | `15fcde2199e72fc382645d0de0ce350d4d2442c33b2f693d3644ed92ac80c7a4` |
| `tests/mirror-depth.test.js` | absent | `49f5a7e738ff99fa09193d0404eb2b5f2e80ca1408a109fc5454c0a8ce871e99` |
| `game.manifest.json` | `38aecc130fc27ab7797ddf3daafe9dc532ef4ceeccea7209b2674dd8f262a83d` | `a296593c3c7d55a9b0cbd713ebebc4123eaa004d91129b46b4d38059bc73b7c4` |
| `package.json` | `bdd01151f8b5f5fcc5ef046acea8e2fcc068269fcfc41b83d102c5072758e604` | `0ec622271c6a6b7046c4edc9ba87dca83b33db357919def5603dfbcc9b51755a` |

## Open limits

- Visual quality remains subjective and requires Mike's play/review.
- The new WebGL pass is deliberately additive; the circuit remains a hybrid
  top-down racer, not a free-camera fully modelled 3D world.
- Continuous rolling capture was unavailable; repeated screenshots are bounded
  observations and do not prove every intervening frame.
- Physical four-phone LAN, physical gamepad, Steam integration/store packaging,
  controller certification, external-profiler frame pacing, broad GPU coverage,
  and a real target-hardware long soak remain unverified.
- The full package is currently untracked in the shared worktree. This receipt
  does not claim review, acceptance, merge, or canonization.
