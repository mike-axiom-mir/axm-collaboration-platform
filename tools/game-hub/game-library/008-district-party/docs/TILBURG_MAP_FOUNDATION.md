# Tilburg map foundation v0.2

## Outcome

The v0.1.7 one-block proof is preserved separately. This v0.2 copy replaces its 1,024 × 1,024 playfield with a 12,288 × 8,192 Tilburg foundation—12 times wider, 8 times taller, and 96 times the ground area.

The city is not loaded as one giant frame. Party screens stream a camera-local neighborhood from 96 files and keep a bounded cache. The host owns the entire world and keeps territory, actors, vehicles, NPCs, projectiles, missions, and funds authoritative even when their chunk is not being drawn.

## Playable placement

- Large Party House and safe courtyard in the south-central district
- Eight cooperative vehicle spawns distributed across the city
- Twenty-four authored civilian spawn records on twelve routes; v0.2 still activates a deliberately bounded civilian subset per session
- Courier depot and five widely distributed delivery areas
- Thirteen District Dominion capture zones
- Mirrored west/east command bases and six competitive vehicle spawns
- Persistent compact minimap on each party screen; press `M` or the visible button for the full city map
- Debug overlay on `D`, including chunk cache counts

## v0.2.1 Afterglow presentation

`data/city-art.json` adds one local presentation profile without changing map authority or collision. Cached chunk surfaces now include deterministic ground variation, tiled pavement, road edges/markings, water waves, rail sleepers, connected roof masses and bounded green dressing. Thirteen district seals, eight original landmark ground motifs and eight street-paint details improve wayfinding. The overview also draws a schematic arterial/waterway network and landmark points.

Three PNGs in `docs/previews/` were generated through the actual runtime renderer and visually inspected. They are release evidence, not replacement runtime textures.

## v0.2.2 open-interior foundation

Two handcrafted City Centre clearings now contain ordinary world-space walkable shells: one compact floor and one large future-venue hall. Their stable attachment zones, dimensions and intentionally empty content state are documented in `docs/OPEN_INTERIORS.md`. This does not add a casino or create instanced indoor worlds. A fourth actual-renderer PNG records the new floors and doorway scale.

## v0.2.3 minimap and full map

The old compact overview is now a persistent minimap with a shared-camera viewport box. A visible screen button or `M` opens a full-city overlay with district labels, Party House, venue, mission, vehicle, territory and party markers; `Escape` closes it. The map uses the lightweight overview network and does not force the client to fetch all 96 gameplay chunks. See `docs/CITY_MAP_UI.md`.

## Performance model

1. `data/map.json` is fetched once.
2. The camera calculates visible world bounds.
3. `MapChunkLoader` requests visible chunks plus one margin.
4. A loaded chunk is pre-rendered once to a local surface.
5. Later frames draw that surface rather than thousands of source shapes.
6. The server queries local spatial buckets for collision.
7. Large-city AI requests bounded route legs instead of allocating a full-city search grid.

The whole map continues to exist; only presentation and local collision queries are culled.

## Honest boundary

This is a coherent first city-art pass over the ground and systems foundation. Bespoke address-level buildings, exhaustive street furniture, furnished/activity-driven interiors beyond the two empty shells, traffic streaming, named streets, a proper road graph and territory campaign persistence remain later work. The source-derived layout resembles Tilburg at arcade scale but is not a finished artistic or navigational recreation.
