# World Tile Foundry

World Tile Foundry is AXM's non-destructive editor for reusable game-world geometry. The default source is genuinely empty: a transparent 10 km × 10 km metric world with zero inherited city features. The older Tilburg city remains available only as an explicit reference.

## Dual canvas and scale

One coordinate truth supports two authoring profiles:

- **2D flat:** a normal art cell is 128 × 128 px and represents a 1 m × 1 m footprint. Art resolution is independent from total world size and should be streamed around the camera.
- **3D spatial:** placement snaps use 1 m × 1 m footprints and 0.5 m vertical steps. One underground layer (to −0.5 m) and 0–20 m above ground are playable now. Another 19 underground layers (to −10 m) and height through 50 m remain explicitly reserved.
- **Interchange:** AXM stores metres. Godot and glTF remain 1:1; Unreal adapters multiply spatial coordinates by 100 for centimetres.
- **Scale references:** a 1 m crate and a 0.6 m-footprint/1.8 m-tall adult are available in the viewport so authors can see whether objects are plausible.

The world contains 100 × 100 authoring sectors and 10 × 10 technical loading chunks. Each loading chunk covers 1 km × 1 km. The playable region is a true 9.8 km-diameter circle inside the 10 × 10 km source. Its 100 m boundary and outer square corners are non-buildable scene-frame space. Fog of war and visibility streaming hide unloaded chunks without deleting world truth.

## Presentation is not terrain

Nature, waterfall, volcano, stone and holographic scene frames can make the flat world feel like a tabletop, floating island or future simulation. These frames are editor presentation recipes. They never become canonical terrain or collision.

## The important separation

- **Semantic source = authority.** Ground, roads, sidewalks, buildings, parks, water and rail retain metric world coordinates, navigation flags and source digests.
- **Raster = replaceable backdrop.** Pixels help a human see a draft; they never become gameplay authority.
- **Project = non-destructive patch.** Remaps, feature overrides, removals and additions bind to exact source/raster digests.
- **Handoff = explicit next step.** Export prepares data for a game builder. It does not modify, install or promote a game.
- **Component = reusable self-made piece.** Only a source explicitly declared locally authored/generated with `AXM-LOCAL` provenance may use the Universal Component Protocol export. Unknown and imported work remains usable as an ordinary experiment but cannot be relabelled as self-made.

## Multiple game builds

**New game build in another tab** creates a separate workspace ID and browser-local draft key. Existing games stay open and unchanged. Projects share the reusable component vocabulary, never unsaved project state.

## Human flow

1. Open the verified blank world or explicitly choose a reference package.
2. Choose the 2D or 3D canvas profile and a truthful scale reference.
3. Toggle semantic layers, remap materials, or draw bounded patch geometry.
4. Save the isolated local draft or download project/handoff JSON.
5. Export locally authored work as a reviewable UCP component when its provenance gate passes.

## Boundaries

The Foundry never imports players, missions, saves, vehicles, controllers or session state. It never claims visual quality, changes a base raster, writes a canonical map, relabels unknown work as self-made, installs a game, or silently repairs a digest mismatch. Planet projection is a future-compatible coordinate route, not a currently implemented globe deployment.

## Contracts

- Input: `axm-neutral-world-tile-source/v1`, `axm-neutral-world-chunk/v1`
- Optional visual input: `axm-transparent-world-raster/v1`, `axm-clean-city-raster/v1`
- Editable draft: `axm.world-tile-edit-project/v1`
- Builder handoff: `axm.world-tile-remap/v1`
- Local reusable export: `axm.universal-component/v1`

Run `node selftest.js` and `node discovery-seam-review.js` for deterministic contract checks.
