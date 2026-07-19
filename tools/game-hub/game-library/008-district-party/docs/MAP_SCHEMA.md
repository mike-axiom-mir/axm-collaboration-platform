# Chunked Tilburg city-map schema

`data/map.json` is the lightweight manifest for an `AXM_CHUNKED_CITY_MAP`. It was generated programmatically and was **not** made in Tiled.

The authoritative world is 12,288 × 8,192 pixels: a 768 × 512 source grid at 16 pixels per tile. That is 96 times the ground area of the 1,024 × 1,024 v0.1.7 proof. It remains one world—there is no Party A copy and Party B copy.

## Runtime chunks

The manifest declares a 12 × 8 grid of 1,024-pixel chunks under `data/map-chunks/`. Each `AXM_MAP_CHUNK_V1` file carries only local static geometry:

- `ground`
- `roads`
- `sidewalks`
- `buildings`
- `details_below`, including water
- `details_above`, including rail
- `collision`

The party client calculates its camera bounds, requests the visible chunks plus one chunk of margin, caches at most 32, and pre-renders each loaded chunk to a local canvas surface. It never loops across all 96 chunks each frame. The debug overlay reports loaded, loading, and nearby chunk counts.

`data/city-art.json` is a presentation-only profile layered over those same chunks. It supplies the v0.2.1 palette, district seals, landmark ground motifs, street paint and schematic overview lines. It does not add collision, spawns, mission state or host authority. The chunk renderer builds the ground, pavement, roads, water, buildings and rail into each cached surface once; party-specific entities and authoritative objectives remain dynamic overlays.

The host loads static collision metadata once, indexes it into local 1,024-pixel buckets, and asks only nearby buckets for movement, vehicles, projectiles, NPCs, AI path cells, and adapter observations. Static map geometry is not broadcast in the 30 Hz state packet.

## Gameplay layers

Global gameplay objects remain in `data/map.json` because they are few and session-relevant:

- `player_spawns` for all eight reserved slots
- `vehicle_spawns`
- `npc_spawns` and `rival_spawns`
- `mission_zones`
- `safe_zones`
- `base_zones`
- `save_terminals`
- `interior_zones`
- `party_regroup_zones`
- the walkable Party House, depot, and their collision walls

The larger cooperative Party House has a working doorway, four Party A interior starts, 10 HP/second interior regeneration, a 100 HP default regeneration ceiling, zero default shield regeneration, and one collision-clear `group_save_terminal` advertising nine local slots. Normal outside regeneration remains 1 HP/second.

Two additional city-centre buildings are now open at ground level: one 312 × 216 usable-pixel compact shell and one 744 × 456 large hall. They use stable `interior_zones`, visible north doors and host collision walls but intentionally contain no activity module. They are ordinary world space—not bases, safe zones or separate interior instances. See `docs/OPEN_INTERIORS.md`.

`data/territory-zones.json` is the competitive overlay. It defines 13 capture districts distributed across the same Tilburg world, mirrored command bases, eight optional seat spawns, six vehicles, and reinforcement rules. Sparse 1v1, asymmetric teams, and up to 4v4 still use this one city.

## Source compilation

Official PDOK BGT geometry is transformed from the recorded WGS84 bounding box into world coordinates. Outer polygon rings are simplified, indexed onto the declared 16-pixel game grid, and contiguous cells are merged into rectangles. Collision uses a separate safe raster that preserves mapped road and footpath cells so dense blocks do not close narrow streets.

The compiler removes source collision from explicit base/mission clearings and snaps player, vehicle, NPC, mission, command, reinforcement, and territory anchors to open authoritative cells. Exact acquisition and transformation facts are in `data/tilburg-source-index.json` and `GEODATA_PROVENANCE.md`.

## Mission layout overlay

`data/mission-layouts.json` is a map-specific gameplay overlay, not another map or city instance. It gives each cooperative mission four stable location records with a label, start coordinate, honest twist and optional mode-specific package/enemy/drop-zone fields. The host loads those records into the existing mission catalog, selects from a no-immediate-repeat route deck and collision-checks every dynamic actor/objective placement. Static Tilburg geometry remains loaded once; mission layouts only choose anchors inside it.

This narrow overlay is the future import seam for another generated/emerged city: provide compatible open anchors and zone ids without rewriting the mission director or splitting the authoritative world.

This is a stylized game foundation, not a navigation product. The v0.2.1 Afterglow pass gives the complete city a coherent first art treatment, but most source buildings still use a generated roof vocabulary. Future Tiled import or bespoke landmark art must preserve stable chunk IDs, semantic gameplay layers, one-world authority, and host-owned collision.
