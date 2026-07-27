# Tilburg Authored City Alpha

Version: **v0.4.0 authored-city alpha**  
Visual status: **playable art alpha; human visual approval pending**

This is now **Map 1** and the launcher default. It is a new deterministic street plan with the same 12,288 x 8,192 target size as the preserved older map, not a replacement or redraw of that map. **Map 2 - Tilburg Streetscape Foundation** remains available as a separate selection.

## What is authored now

- A complete 12 x 8 streamable chunk grid with a new road, sidewalk, block, canal, rail, park, plaza and harbour layout.
- Varied procedural roof families, terraces, shops, industrial sheds, campus blocks, crossings, lane markings, trees and street lamps.
- New map-local mission coordinates, routes, vehicles, territory zones, spawns and authoritative collision data.
- A clean reusable environment raster and 96 exact-grid tiles under `exports/tilburg-authored-city-alpha-raster/`.

The map does not claim finished production art. Large quays and some outer blocks intentionally remain lightly dressed until the later asset pass. Human taste approval is still required even after technical and live-browser checks pass.

## Asset boundary

No new external asset was imported for this alpha. Poly Haven, ambientCG and Artaley3D are recorded only as candidate search locations for a later pass. A future builder must verify the exact source page, author, license terms and downloaded file for every selected asset; this document makes no blanket license claim for those sites or their catalogues.

## Authority and compatibility

Collision, mission state, party state and multiplayer authority remain server-owned. Map selection changes which complete data package is loaded before the session starts. It does not merge the maps or mutate the preserved Map 2 files.

Verification commands:

```text
npm run map:build:authored
npm run art:export:authored
npm run art:verify:authored
npm test
npm run test:cli
```

The preserved Map 2 visual regression is checked separately by regenerating its nine official previews and comparing them with `docs/previews/preview-sha256.txt`.
