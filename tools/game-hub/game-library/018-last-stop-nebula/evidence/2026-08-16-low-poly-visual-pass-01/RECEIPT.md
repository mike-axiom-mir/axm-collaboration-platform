# Last Stop: Nebula low-poly visual pass 01

Status: **WORKING · package remains TEST beta 0.26.0 · not CANON · human balance and Mike review pending**

Sealed: 2026-08-16T10:20:15+02:00

## Scope

Slot 018 already had the strongest full Three.js world reached in this sequence.
This bounded `last-stop-retiree-service-detail-01` pass therefore improves its
weaker model families instead of replacing the station:

- customer and ambient craft now use faceted dodecahedral noses and cabins,
  authored fins, landing hardware, headlights, engine pods, and visible
  low-poly occupants;
- the retiree operator now has a faceted head, eye highlights, octahedral
  antenna lights, articulated arms and hands, legs, boots, belt, badge, wrench,
  and contact shadow;
- the operator idle adds bounded head, arm, antenna, body, and wrench motion;
  Reduced Motion produces a static pose;
- live canvas receipts expose pass, model rigs, presentation authority,
  simulation/collision boundaries, active customer-model count, frame, draw
  calls, and triangles.

No balance, service, dispatch, queue, debt, review, upgrade, customer, collision,
save, score, or input rule changed. All geometry is local and procedural; no
remote asset was added.

## Visual evidence

Untouched baselines:

- `baseline/01-title.png` — existing station/title composition.
- `baseline/02-contract.png` — existing contract dialog.
- `baseline/03-opening.png` — existing cinematic scene.
- `baseline/04-gameplay.png` — station gameplay before the model-detail pass.

Accepted after evidence:

- `after/01-event-overlay-intact.png` — a live seeded choice dialog remained
  readable and reversible after the model change.
- `after/02-gameplay-faceted-craft.png` — five live customer craft visibly use
  the new faceted cabins, noses, fins, lamps, gear, and occupants; the WebGL
  receipt reported 407 draw calls and 35,134 triangles in that live state.
- `after/03-mart-operator-detail.png` — the closer Mart view shows the retiree's
  new faceted head, eyes, antenna lights, arms, belt/badge, boots, and wrench.
- `after/04-operator-full-motion.png` and
  `after/05-operator-motion-later.png` — two full-motion frames with distinct
  digests; the render receipt advanced from frame 6,990 to 7,029 over 420 ms.

The live browser also exercised title/continue, contract selection, opening
skip, a real seeded event choice, pause, Reduced Motion, full motion, and camera
focus. Reduced mode reported `operatorMotion=reduced-static`; after the player
toggle, full mode reported `operatorMotion=animated`. Browser logs were empty.

## Verification

The final focused slot suite passed **53/53**:

- 19 package, syntax, local-runtime, accessibility, rendering, choreography,
  and presentation-contract checks;
- 34 core, balance, telemetry, HTTP, migration, dispatch, consequence, debt,
  arrival, queue, and atmosphere checks.

All ten required Workshop commands returned exit code 0 after the final code.
`verify.js` reported 0 failures and 38 warnings. Browser render/click evidence
was collected separately from these script checks.

The capability receipt remains ready for the local 3D beta but degraded or
unavailable for representative human balance/usability, physical screen reader,
representative GPU performance, physical phone proof, and rolling capture. This
pass does not broaden those claims.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `e8577ea7d6797a75966f5c90b0b1899d1bd3a14c9bb4e7bc6ec767916fe2037b` | unchanged |
| `runtime/styles.css` | `0e18dc24a4c2136a18e4fb1896441646ac7770cf0bfacf75d2736b0c04ccc0aa` | unchanged |
| `runtime/app.mjs` | `450ecc5e1d19b5bb8033c1c06227b7f4d20659d369bc40a58d29248b48896790` | unchanged |
| `runtime/game-core.mjs` | `f35b2b2e6b67dc70cfeaee872973a08832831e0bb79decf733b5b74d5715ea24` | unchanged |
| `runtime/scene.mjs` | `71579050ef72427fdcbe824bea5115c1b624277f89f732db3ac6d729921a6191` | `1dacf91947e1cb4d5ad337e0aa1faf25da57c338230a8d15c6cb80b8ca4a8894` |
| `tests/package-selftest.cjs` | `9c0e5b3c18f9bf6956f5fb5574bb2ae8a155a0277659eb1b2a86b8e425e28f2c` | `a5da9cabc83c26e5ffc27529cad294299d45e6f9ab8cd4a06be9c916104b6841` |
| `game.manifest.json` | `68f14f4d294d708a0f2486be9d0f416b0edc07e5e79fde0be4128a7567a7060d` | unchanged |

## Open limits

- Visual quality and model character remain subjective and need Mike's review.
- Human fun, dispatch comprehension, and balance remain unestablished.
- This is still procedural low-poly beta art, not a production character/vehicle
  modelling, rigging, skinning, animation, LOD, or cinematic asset pipeline.
- Continuous rolling capture was unavailable; repeated screenshots are bounded
  observations only.
- Physical phone, physical controller/gamepad, physical screen reader,
  representative low-end GPU/performance, and a human long-run matrix remain
  unverified.
- Steamworks, depots, store package, achievements, Cloud, install/update/remove,
  certification, multiplayer, and additional locations remain outside this pass.
- The full slot is untracked in the shared worktree. This receipt does not claim
  review, acceptance, merge, release, or canonization.
