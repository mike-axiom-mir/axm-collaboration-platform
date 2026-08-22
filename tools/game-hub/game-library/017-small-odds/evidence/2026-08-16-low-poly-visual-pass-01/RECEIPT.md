# Small Odds low-poly visual pass 01

Status: **WORKING · package remains v0.11.0 local pre-alpha · not CANON · Mike review required**

Sealed: 2026-08-16T10:11:32+02:00

## Scope

This bounded pass strengthens the existing dependency-free WebGL presentation
in slot 017, `SMALL ODDS: A Random Item Life`. It does not replace the authored
Canvas interaction layer or the earlier hybrid renderer. The accepted
`small-odds-faceted-world-01` pass adds:

- an original octahedron mesh for visibly faceted creatures, lamps, goods, and
  environmental organisms;
- a more expressive low-poly Pip rig with faceted head, ears, eyes, arms,
  hands, backpack, legs, contact shadow, idle sway, and bounded stride;
- stronger scene-specific depth props across shore, room, kitchen, district,
  market, and the ticket-gated Starspite scene;
- live DOM receipts for pass, draw calls, triangles, frame, authority, and
  collision boundaries;
- a better visual balance between the WebGL world and the Canvas interaction
  art by changing the Canvas blend opacity from 0.67 to 0.5.

WebGL remains at 480x270, 16-step palette lighting, depth testing, disabled
multisampling, and pixelated scaling. The existing Canvas fallback remains.
No RNG, save, economy, life simulation, input, collision, or interaction
authority changed, and no remote asset was added.

## Visual evidence

Baseline evidence includes the current title, the intact opening/tutorial
overlays, portal help, and the earlier playable shore blend. These screenshots
also verify that the blocking story sequence remained traversable before the
pass.

Accepted after evidence:

- `after/01-shore-faceted-world.png` — 67 draw calls and 744 triangles, including
  faceted Glimmer organisms and the expanded portal-creature shell.
- `after/02-room-faceted-world.png` — 30 draw calls and 332 triangles with the
  room lamp, boxes, and WebGL furniture remaining legible beneath interactions.
- `after/03-kitchen-faceted-world.png` — 33 draw calls and 346 triangles with a
  distinct table, shelving, heating form, and orbiting table details.
- `after/04-district-faceted-world.png` — 63 draw calls and 672 triangles; house
  depth, roofs, road, street lamps, residents, and hotspots remained readable.
- `after/05-market-faceted-world.png` — 49 draw calls and 432 triangles with
  faceted stalls and suspended goods.
- `after/06-market-motion.png` — a later market frame with a distinct digest;
  the live WebGL frame receipt advanced from 11,806 to 11,870 over 420 ms.

The live browser exercised title/continue, the opening sequence, portal help,
and all five locations accessible from the fresh save. The browser diagnostic
log stayed empty. Starspite remained ticket-gated in this fresh-save run; its
updated geometry was parser/static-test covered but not claimed as a new live
screenshot observation.

## Verification

The complete package suite passed **102/102** after the final code, including
RNG/replay firewalls, save migration, economy, life situations, district,
business, work, commons, debt aftermath, HTTP traversal, package verification,
and the updated WebGL visual contract.

All ten required Workshop commands returned exit code 0 after the final code.
`verify.js` reported 0 failures and the Workshop's existing 38 warnings. Browser
render/click verification was performed separately from these script checks.

The current capability report remains honestly `BLOCKED` for goals much broader
than this pass: production character 3D, planetary-scale content, multiplatform
distribution, longitudinal balance, external comparative quality, and rolling
capture are missing or unknown. This visual pass does not change those claims.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `3ccf87ef6fae6aae034d81d78bf8997fc39e241ef44def5ead700c2b6f31711f` | unchanged |
| `runtime/styles.css` | `7293a569e590743165fb4ffa0bdbc92f1b56f542545ee41c44682bcf50c9fd6f` | `1155ad07d026d6e973935c4931f86d5174fc87d1349283705480a810bf74fe93` |
| `runtime/app.js` | `5b3e2fb7a62efb2aee427fb949df18499e07a124bd310e6a4dca0eaf6f5dce01` | unchanged |
| `runtime/renderer.js` | `0216a5aa471210e46fa9d6a6cd4e04d52a3e017bce868d175d0b2a05b47dfd1` | unchanged |
| `runtime/world-three.js` | `308532498cbfe315320a933914edc9316433c37af64a9529767286a29261a6a6` | `b759990c53a0d4cbb609b3d72dc08fed3a18e8307028d57112e941de781f61bd` |
| `tests/world-three.test.js` | `6336b75a29c9f9c72858a888ed4a0844372d464f186ca9256b44c06286b1e3cc` | `7cb3bbf6f32ee39089c677ba334fe7da1768642021be3d7c96fd8dd0a1660d16` |
| `game.manifest.json` | `a5e8b073877912a9a39826dd465091f0e69b4eda6e02401b1a4e1ccfd2dab9e5` | unchanged |

## Open limits

- Visual quality is subjective and needs Mike's play/review.
- This remains a hybrid low-poly WebGL plus Canvas game, not a production model,
  rigging, animation, LOD, cinematic, or asset pipeline.
- The ticket-gated Starspite scene was not freshly screenshot-verified after
  this pass.
- Continuous rolling capture was unavailable; repeated screenshots prove only
  bounded observations.
- Context-loss recovery, broad GPU/performance coverage, physical gamepad,
  Steamworks/depot/store integration, install/update/uninstall, certification,
  and independent long-session play remain unverified.
- The full slot is untracked in the shared worktree. This receipt does not claim
  review, acceptance, merge, release, or canonization.
