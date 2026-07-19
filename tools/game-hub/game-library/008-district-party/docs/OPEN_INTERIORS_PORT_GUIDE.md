# Open-interiors v0.2.2 port guide

This kit is for applying the two empty Tilburg venue shells to a **copy** of a separately bug-fixed AXM District Party v0.2.1 build. It is not a Git patch, does not touch GitHub, and must not be unpacked blindly over the only copy of Mike's working project.

## Safest integration

1. Duplicate the target project.
2. Compare target files with this kit before replacing them, especially `entity-renderer.js`, `world-state.js`, `map.json`, version files and tests.
3. Preserve any target-only bug fixes while bringing across the venue-specific sections.
4. Copy the included changed chunk files as one set with `data/map.json` and `data/tilburg-source-index.json`; the recorded combined hash assumes those bytes remain together.
5. Run `npm test`, `npm run test:cli` and `npm run art:preview`.
6. Start a local session and physically walk through both north doors before promoting the merge.

## Stable attachment contract

- Compact shell building: `small-venue-shell`
- Compact floor zone: `small-venue-interior`
- Large shell building: `large-venue-shell`
- Large floor zone: `large-venue-interior`
- Current status: `floor_ready`
- Current content module: `null`

Later casino logic should attach to `large-venue-interior` through host-owned interaction/NPC/activity data. It should not rename the zone, convert it into a separate world, trust a phone for economy state, or silently change the small shell.

## Honest boundary

This kit opens and renders two floors. It does **not** implement the casino, NPC gambling, chip systems, zone-control finance, ownership or persistence discussed for later work.
