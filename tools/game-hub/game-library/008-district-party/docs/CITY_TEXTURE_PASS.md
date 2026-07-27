# Tilburg Streetscape Foundation — v0.3.0

Status: **AGENT VISUAL PASS — HUMAN VISUAL APPROVAL REQUIRED**

## Why v0.2.9 was rejected

The v0.2.9 city-texture pass treated reconstructed 16 × 16 BGT classifications as finished city art. In live close gameplay this produced anonymous reddish and grey masks over dark ground. Road topology, pavements, curbs, blocks, façades, markings, greenery and prop hierarchy were not readable. The official preview PNGs reproduced the same failure and should not have carried an unqualified visual `PASS`.

The retained live baseline is `docs/previews/city-presentation-before-v0.2.9.png` at 1870 × 1037.

## v0.3.0 presentation layer

`Tilburg Streetscape Foundation` keeps the topology and replaces the failed treatment with a deterministic Canvas presentation layer:

1. connected source roof cells become bounded building components with warm roof variation, façade-weight outlines, ridges, rooftop units and occasional skylights;
2. road masks receive a distinct asphalt surface, dark bed, light curb boundary and selective medial lane dashes on long 2–5-cell-wide corridors;
3. pavement masks receive warm paving, source-clipped joints and sparse deterministic street lamps;
4. park masks receive clipped canopies and ground variation;
5. water and rail masks receive source-clipped glints, rails and sleepers;
6. the existing Tilburg Central, Piushaven, Reeshof, Wandelbos, Moerenburg, Stappegoor and district wayfinding motifs remain above the cached city surface;
7. existing local prop and character images keep their recorded provenance and authority status.

All generated details use stable world-coordinate hashes. Chunk surfaces are cached once and no decorative element enters collision, pathfinding, mission, spawn, controller, save or multiplayer state.

## Truth and maturity boundary

- **PASS — authoritative map truth preserved:** no edits to `data/map.json`, `data/map-chunks/`, collision, player or vehicle spawns, mission layouts, NPC routes or territory data.
- **PASS — renderer-only runtime change:** the host still owns every gameplay state transition.
- **PASS — no new bitmap source:** the repair uses Canvas primitives and already-recorded local assets only.
- **PASS — actual live-browser observation:** repeated 1870 × 1037 gameplay frames were inspected with the real streamed chunks and no browser console errors.
- **PASS — functional regression suite:** 178/178 unit and integration tests plus the CLI lifecycle smoke pass; the optional packaged Playwright smoke remains `UNRUN` because that package is absent.
- **PASS — deterministic retained evidence:** all nine actual-renderer previews were byte-identical across two consecutive frozen-clock runs; checksums are in `docs/previews/preview-sha256.txt`.
- **PARTIAL — artistic maturity:** the result is a playable deterministic streetscape foundation, not bespoke building-by-building art, named-street navigation, furnished venues or final human-approved art direction.
- **PENDING — human visual approval:** agent inspection and tests cannot approve taste or release appearance.

## Evidence

- `docs/previews/city-presentation-before-v0.2.9.png` — live failure baseline.
- `docs/previews/city-presentation-after-v0.3.0.png` — same live session, camera state, exterior position and viewport after repair.
- `docs/previews/tilburg-centre-art-pass.png` — actual-renderer gameplay-scale centre.
- `docs/previews/party-house-art-pass.png` — actual-renderer Party House district.
- `docs/previews/tilburg-city-overview.png` — all 96 chunks, useful for seam inspection but not sufficient for gameplay approval.

The preview generator is `scripts/render-city-art-preview.js`. Visual evidence proves rendered appearance only; functional and authority claims are routed to tests and live input/state receipts.
