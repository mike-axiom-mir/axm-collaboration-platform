# Tilburg Afterglow art pass

Status: **PASS — actual Canvas renderer output generated and visually inspected**

This v0.2.1 pass changes presentation only. The authoritative map dimensions, chunk boundaries, collision, spawns, missions, vehicles, NPC routing, combat and territory state remain the tested v0.2 foundation.

## Runtime changes

- Every streamed chunk receives a deterministic ground texture before it is cached as a local surface.
- Footpaths render as tiled pavement with curb edges.
- Roads render above footpaths, with contrasting edges and selective dashed centre markings on readable major segments.
- Water receives a distinct blue treatment and small wave marks.
- Rail receives ballast, twin rails and sleepers.
- Source-derived building rectangles are drawn as one connected roof mass per chunk, with block-scale colour variation and occasional rooftop units. They are no longer misrepresented as hundreds of separately named buildings.
- Larger vegetation areas receive deterministic small ground variation and bounded decorative trees.
- Eight original AXM ground-motif landmarks provide local identity without adding fake collision.
- Thirteen district seals supply wayfinding in co-op; District Dominion's authoritative capture overlay still renders above them.
- Eight key crosswalk/wayfinder paint details clarify central and mission travel points.
- The shared-screen overview now includes chunk boundaries, schematic arterial links, waterways and landmarks in addition to actors/objectives.

## Original landmark vocabulary

- Reeshof Market
- Wandelbos Grove
- Tilburg Central ground motif
- AXM Central Plaza
- Piushaven Docks
- District Arena
- Moerenburg Green
- Courier Yard

These are original stylized game motifs and labels. They do not copy map imagery, logos, building artwork or proprietary presentation.

## Visual evidence

The preview PNGs under `docs/previews/` were generated from `client/game/rendering/entity-renderer.js` using the same map JSON, chunk files, palette and selected local assets as the game:

- `tilburg-city-overview.png`
- `tilburg-centre-art-pass.png`
- `party-house-art-pass.png`

The preview generator is `scripts/render-city-art-preview.js`. It is a build-time QA tool and is not loaded during play.

## Honest boundary

This is a coherent first complete city-art treatment, not a claim that every Tilburg building or landmark has bespoke art. The source-derived ground remains stylized and non-navigational. Browser automation remains **UNRUN** because Chromium is absent, while the actual renderer was executed headlessly to produce and inspect the retained PNGs. Physical shared-screen presentation remains **UNTESTED** until Mike runs it on target displays.
