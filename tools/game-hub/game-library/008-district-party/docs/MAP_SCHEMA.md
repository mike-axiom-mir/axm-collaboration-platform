# Structured city-map schema

`data/map.json` is an original, programmatically authored `AXM_STRUCTURED_CITY_MAP`. It was **not** made in Tiled.

The world is 1024 × 1024 pixels, corresponding to a 64 × 64 source grid at 16 pixels per tile. Geometry and gameplay markers are data, not scattered constants.

Layers:

- `ground`, `roads`, `sidewalks`, `buildings`, `details_below`, `details_above`
- `collision`
- `player_spawns` with all eight reserved slots
- `vehicle_spawns`
- `npc_spawns`, linked to `data/npc-routes.json`
- `mission_zones` for the Party House mission board, depot and delivery points
- `safe_zones`
- `base_zones` for authoritative party-base membership and regeneration values
- `party_regroup_zones`

The first district contains a central crossing, main road loop, side street, south alley, park/pond, courier depot, garage/workshop area, spawn plaza, three delivery zones and collision boundaries.

In cooperative mode, the south-east block contains `party-base-house`, a 250 × 122 walkable Party A house with a 48-pixel south doorway. `party-base-interior` defines the traversable 226 × 98 regeneration area and stores its 10 HP/second rate, 100 HP default regeneration ceiling and zero shield regeneration. Party A spawns 1–4 reference that base zone and begin inside it. Five collision rectangles describe the walls while leaving the doorway open. District Dominion instead uses mirrored west/east command-post spawns and safe zones from `data/territory-zones.json`.

`data/territory-zones.json` is the separate competitive overlay. It defines five circular capture districts, exact eight-seat west/east staging positions, two party-filtered command safe/base zones, two mirrored 50-HP vehicle spawns and all score/capture/reinforcement tuning. District Dominion replaces the co-op safe/base list in its in-memory static map with the two mirrored command zones; it does not change `data/map.json` or create a second city instance.

Future Tiled import should preserve these semantic layer names and stable object IDs. It must not replace server-owned collision/mission truth with decorative client-only tiles.
