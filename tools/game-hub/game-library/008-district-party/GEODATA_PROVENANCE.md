# Geodata provenance — Tilburg foundation

Status: **PASS — official source queried, current snapshot recorded, locally transformed, runtime made offline**

## Source

- Publisher/access point: PDOK, the Dutch government geodata platform
- Dataset: Basisregistratie Grootschalige Topografie (BGT)
- Official OGC API: `https://api.pdok.nl/lv/bgt/ogc/v1/`
- Official documentation: `https://www.pdok.nl/ogc-apis/-/article/basisregistratie-grootschalige-topografie-bgt-`
- License exposed by the API: Creative Commons Zero 1.0 Universal (CC0-1.0)
- Snapshot query time: `2026-07-18T00:00:00Z`
- WGS84 query bounds: west 5.0028, south 51.5186, east 5.1798, north 51.5924

No Google Maps tile, screenshot, label layer, route, or proprietary imagery was copied. Google was considered only as a visual research suggestion; the build uses an official reusable geometry source instead.

## Acquired collections

| BGT collection | Source records returned |
|---|---:|
| `pand` (buildings) | 132,560 |
| `wegdeel` (road/footway areas) | 79,695 |
| `begroeidterreindeel` (green/vegetated terrain) | 71,916 |
| `waterdeel` | 4,491 |
| `spoor` (rail) | 469 |

The compiler records every initial query URL, cursor page count, source count, output counts, bounding box, snapshot, transform description, and final SHA-256 in `data/tilburg-source-index.json`.

## Transformation

- Coordinates are linearly mapped from the recorded geographic bounds into a 12,288 × 8,192 local world.
- Polygon precision is simplified for an arcade-scale source grid.
- Geometry is indexed onto 16 × 16 game tiles; contiguous cells are merged.
- Road and footpath occupancy is subtracted from collision occupancy to keep the stylized street network navigable.
- AXM base, mission, and command clearings are original gameplay overlays.
- Gameplay anchors are snapped to locally open cells by the build compiler.
- Colours, gameplay labels, capture zones, mission placement, and Party House geometry are original AXM work.
- Raw API responses are not redistributed. The derived local chunks and reproducible query/index record are included.

## Runtime boundary

The generated chunks are ordinary local JSON. Starting or playing the game performs no PDOK, Google, OpenStreetMap, CDN, or other external map request. Internet access is required only if a developer deliberately runs `npm run map:build` to regenerate the source-derived foundation.

## Accuracy limit

This map is deliberately stylized, omits polygon interior rings in the first pass, and contains gameplay clearings. It must not be used for navigation, surveying, address lookup, or claims about current real-world accessibility.
