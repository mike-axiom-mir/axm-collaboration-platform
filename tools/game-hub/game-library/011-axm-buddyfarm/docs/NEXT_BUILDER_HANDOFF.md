# AXM BuddyFarm next-builder handoff

Handoff status: **PLAYTEST RECOVERY IMPLEMENTED · WORKING TEST**

Date: 2026-07-24  
Lane: `tools/game-hub/game-library/011-axm-buddyfarm` only  
Promotion: **not promoted to CANON; no GitHub push**

## Critical world-source correction

“Clean Tilburg city raster” means city artwork without runtime state. It does
**not** mean an empty transparent world. BuddyFarm must never import or display
that city raster or seed itself with the source buildings, roads, sidewalks,
water, rail or parks unless Mike later selects individual pieces explicitly.

This build reuses only:

- 12,288 × 8,192 dimensions;
- north-west origin and stable coordinates;
- 1,024 × 1,024 tiles in a 12 × 8 / 96-chunk grid;
- digest discipline and view-reach streaming structure.

The local BuddyFarm substrate is 96 fully transparent RGBA PNGs. Grass, the
starter farm, house, plots and future terrain are separate reversible game
layers above it.

## Implemented recovery

### Large blank world

- `scripts/generate-blank-world.js` creates the 96 aligned transparent tiles.
- `runtime/world/blank-world-source.json` indexes exact bounds and SHA-256
  values.
- `runtime/world/blank-world-verification.json` records:
  - 12,288 × 8,192 exact coverage;
  - 12 columns × 8 rows;
  - no gaps or overlaps;
  - `alphaNonZeroPerTile: 0`;
  - `rgbNonZeroPerTile: 0`;
  - tile SHA-256
    `f12ddfea20dcca2fa350d75d5ed2ae76a4fffbcdfd2b8f2357558b90072dab9f`;
  - coverage SHA-256
    `efd36ade32109fd715a6d23264ec3e434e073697dad54d3ac7c2828c9627a4e6`.
- `runtime/world-adapter.js` converts the source coordinate contract into a
  384 × 256 authoritative grid at 32 source pixels per game cell.
- Existing starter coordinates remain unchanged. The authored 40 × 28 farm is
  an overlay spanning starter chunks `0,0` and `1,0`.
- World packets include only a one-chunk reach around farm actors. At the
  north-west spawn this is four active chunks, not all 96.
- Shared explored-chunk state persists through refresh and JSON export.
- The full map uses the bounded 12 × 8 overview and labels unexplored chunks
  `BLANK`; it never loads or reveals a baked city.

### Shared farm and seats

- One server-owned state still contains every actor, shared farm cell, seed,
  crop, token and exploration value.
- One host camera renders all buddies in the focused room/world.
- Direct start now creates P1 and P2 as human seats. P3 is never created
  silently.
- An explicit human P3 remains human.
- An explicit AI P3 remains idle unless `BUDDYFARM_AI_ENABLED=1` is also set.

### Movement, characters and work feel

- Each successful grid move writes a deterministic 150 ms `walkState` with
  from/to coordinates, direction, sequence and 75 ms footfall contact.
- The client renders short eased interpolation, four directional faces/poses,
  boot stride, dust contact and a quiet procedural local footstep cue.
- Travel now atomically resets the movement state at the destination; this
  fixed a live-found camera seam where stale farm coordinates briefly placed an
  actor outside the house floor.
- P1/P2/P3 use original mint, sun and violet modular palettes.
- Work writes explicit `prepare`, `plant`, `water` or `harvest` feedback with a
  short target pulse.
- WORK owns harvesting directly. It no longer calls the Action interaction
  lane.
- External `choose-tool`/`use-tool` intents are refused; the contextual field
  kit remains the routine farm interface.

### Travel and aligned targets

- Every travel threshold and visible copy now says **200 ms / 0.2 sec**.
- The authoritative boundary is exact: 199 ms refuses; 200 ms travels.
- Farm door, house exit, house cellar stairs and cellar return stairs declare
  explicit approach cells.
- Door/stair target cells block movement so an approach input turns the actor
  toward the visible surface instead of stepping through it.
- Cellar return places the actor at the valid house-stair approach
  `(11,3)`, not the previously blocked furniture tile `(10,2)`.

### Controllers and rewards

- Keyboard, phone and gamepad paths still emit only `move`, `action`, `work`.
- Deterministic routing proves:
  - keyboard P1 + one pad → P2;
  - two pads → P1 and P2;
  - no pad is silently assigned to AI.
- Phone Action measures pointer hold duration and displays `0.2 sec`.
- Sparse shared seed/carrot/growth-token rewards are unchanged. No filler
  inventory or random loot was added.

## Verification evidence

Commands run from the game directory:

```powershell
node runtime/app.js --check
node tests/buddyfarm-selftest.js
node -e "const v=require('../../game-package-verifier'); const r=v.verifyGameDir(process.cwd()); console.log(r)"
node ..\..\game-package-verifier.js
```

Final command verdicts:

- `node runtime/app.js --check`: **PASS**, exit 0.
- BuddyFarm selftest: **PASS**.
- Focused game 011 package verifier: **PASS** with expected pending warnings
  for disconnect recovery and physical phone QA.
- Full game-library verifier: **PASS**, 0 failures, 31 warnings across 10 game
  folders.

The selftest now covers:

- transparent alpha and RGB-zero inspection;
- 96-tile no-gap/no-overlap coverage and digests;
- view-reach chunk bounds and no city semantic layers;
- fog persistence in snapshots;
- one shared farm modified by P1 then P2;
- exact 199/200 ms travel boundary;
- natural complete door/stair round trip;
- four-direction interpolation and footfall timing;
- work-state feedback;
- optional AI and explicit human P3;
- mixed keyboard/pad and two-pad routing;
- runtime world receipt, phone copy and active-chunk responses.

## Workshop steward stress receipt

Date: 2026-07-24. The run was read-only outside this BuddyFarm lane.

- Opening steward snapshot: 5,088 files scanned, 205 files active in the
  five-minute window, and four active shared seams. Most activity belonged to
  another builder generating the World Tile Foundry blank source and refreshing
  `tools-index.json`.
- BuddyFarm syntax, recovery selftest, focused package verification, full Game
  Hub package verification, game-night, recovery, asset-handoff and verifier
  selftests all passed. The full package result remained 0 failures / 31
  documented warnings / 10 games.
- The declared root suites for elements, readiness, raster composition, neural
  visual work, animation, audio, game organism, operations, workshop,
  foundation, Asset Hands completion and Asset Hands upgrades passed.
- The remaining Game Forge, game library, world, museum, knowledge, engine,
  studio and production-tool selftests were run directly. Foundation Planet
  passed its 2,500+ assertions; District Party passed all 188 tests.
- The root verifier passed in a read-only steward wrapper. Only its Workshop
  `exports/` report writes were suppressed; no verification control was
  suppressed. It reported that `tools-index.json` matched the current
  structural source digest.
- `tools/world-tile-foundry/discovery-seam-review.js` passed. Its main selftest
  was not run because it deliberately regenerates all 96 source tiles and
  manifests while another builder owned that actively changing lane.
- `test:substrates-live` is unavailable without an explicitly installed
  substrate root (`--root`); it did not reach a live runtime test.
- One stable failure remains outside BuddyFarm ownership and was not edited:
  `tests/html-script-syntax-test.js` stops at Evidence Desk because that page
  now uses external JavaScript only, but the test does not route Evidence Desk
  through its external-script compilation branch.
- Studio's discovery seam also failed once while its test was moving. The
  concurrent owner updated that test, and the settled rerun passed all 16
  controls with zero open seams. It is classified `MOVING_WORKSPACE`, not a
  remaining failure.
- A first `test:workshop` and Knowledge Canvas seam run failed while their
  capability metadata/test bytes were being changed by another lane. Both
  passed on the settled rerun and are classified `MOVING_WORKSPACE`, not
  regressions.
- The BuddyFarm runtime was restored after the stress pass. `/health` reports
  `ok: true`, two seats, 12,288 x 8,192, 96 chunks, and a fully transparent
  substrate.
- A concurrent Workshop steward receipt reported RED body pressure (90.6%
  memory used, about 1.4 GB available) and stopped further escalation. No
  duplicate heavy root run should start until Body Pulse and memory headroom
  recover.

## Live visual receipt

Visual backend: **BROWSER_PRIMARY** (Codex in-app browser).  
No rolling-buffer capability was exposed, so motion used bounded repeated
screenshots rather than continuous video. No temporary video paths were
created.

### Desktop host

- Route: `http://127.0.0.1:8801/games/011/?room=AXM1&player=p1`
- Viewport: 1280 × 720.
- Full map: **PASS**. It visibly showed `12,288×8,192`, `2/96 CHUNKS
  EXPLORED`, a starter-farm marker and blank/fogged remaining chunks.
- Shared world: **PASS**. P1 and P2 were visible in one scene/camera.
- Walk presentation: **PASS at bounded screenshot cadence**. Frames sampled
  before input and around 30, 95 and 200 ms showed directional response,
  interpolation and settled position. Exact audio output was not captured.
- Work feedback: **PASS**. Prepare produced the target ring, changed soil and
  advanced the hint to planting.
- Journey: **PASS visually** for farm → house → cellar → house → farm.
  Door/stair approach highlights and actors aligned in every observed room.
- Browser console warnings/errors: none.

The browser controller could not hold a key/pointer for an exact duration.
Movement used real keyboard-equivalent browser inputs; the 200 ms transitions
used the authoritative live API while the same rendered session was observed.
Physical keyboard/gamepad/phone hold feel therefore remains unclaimed.

### Phone controller

- Route: `http://127.0.0.1:8801/controller.html?room=AXM1&player=p2`
- Viewport: 390 × 844.
- Layout: **PASS**; document size remained exactly 390 × 844 with no scroll
  overflow, and d-pad, Action and Work were all visible.
- Phone movement: **PASS**; one visible Move Left press changed P2 from
  `(19,13)` to `(18,13)` and wrote the correct left-facing walk state.
- Physical phone and multi-phone testing: **UNAVAILABLE / still pending**.

## Remaining honest limits

- The blank world beyond the starter farm has only a procedural meadow
  foundation and outer-bound collision. It needs modular authored terrain.
- Save import, runtime-shutdown persistence and cross-device save bridge remain
  absent.
- Physical Bluetooth/USB gamepads, mixed keyboard + pad hardware, two-pad
  hardware and exact controller hold feel remain unverified.
- Physical phone and two-phone tests remain pending.
- Cellar storage/crafting, NPCs, dialogue, fishing, combat, animals, shops and
  equipment upgrades remain absent.
- Disconnect recovery remains pending.
- Character/art/audio quality remains a Mike playtest judgment.

## What Mike can test next

1. Open the host URL and press `M`; confirm the large overview reads as a blank
   world with fog, never a Tilburg city.
2. Walk P1 around the starter house and garden; judge the 150 ms step,
   directional body/boots and footstep level.
3. Hold `E` for roughly 0.2 sec at the visibly highlighted farm door, cellar
   stairs, return stairs and exit.
4. Open the phone URL for P2 and try movement, Work and a 0.2 sec Action hold.
5. Pair one gamepad, then two, and confirm stable routing:
   `P1 READY`, then `P1 / P2 READY`. Also test A/RT Action hold, X Work, View
   map, Menu controls, disconnect fallback and a deliberately non-standard pad.
6. If desired, explicitly add a third human seat. Test AI only in a separate
   launch with an explicit AI roster and `BUDDYFARM_AI_ENABLED=1`.

Keep the runtime playable at:

- Host: `http://127.0.0.1:8801/games/011/?room=AXM1&player=p1`
- P2 phone: `http://127.0.0.1:8801/controller.html?room=AXM1&player=p2`
- Health: `http://127.0.0.1:8801/health`

## 2026-08-16 universal gamepad handoff

- Profile: `axm-universal-xbox-brawl-v0.2.1`.
- Logic and labeled browser simulation are TEST evidence only.
- Physical Bluetooth/USB gamepads and exact A/RT hold feel remain pending.
- The prior low-poly Three.js pass and its evidence were preserved unchanged.
