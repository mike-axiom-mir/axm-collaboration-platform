# Shared city map UI

Version 0.2.3 introduced two views over the existing 12,288 × 8,192 Tilburg world. The current 0.4.0 presentation does not create another world, fetch all 96 map chunks or split the shared gameplay view.

## Compact minimap

- Visible by default at the bottom centre between the four player-status corners.
- Shows the schematic arterial and water network, chunk grid, landmarks, public mission points, venue shells, territory state and living actors belonging to the displayed party.
- Shows the shared party camera as a white rectangle.
- Uses a 25%-opaque backing (75% transparency) while keeping roads, markers, labels and the border at their normal strength.
- Stays small enough to preserve the shared action area and leaves space beneath it for the map button.

## Full city map

- Open or close with the visible **FULL MAP** button or the `M` key.
- On the temporary phone controller, tap **INVENTORY** for inventory or hold it for 650 ms to open/close the displayed party map. Holding is disabled while inventory or the group-save computer is already open.
- `Escape` closes the full map and returns to the minimap.
- Shows district names, the Party House, open venues, mission pickup/delivery points, territory ownership, vehicles and party players.
- The authoritative world keeps running while the map is open. This is important for a local multiplayer world where one display must not pause every controller.

## Fairness and authority

The map drawing is a read-only party-screen presentation. The authenticated `mapToggle` controller pulse only advances a party-scoped presentation sequence; it does not change actor, mission, collision, inventory or multiplayer state. Party A sees Party A actor markers; Party B sees Party B actor markers. The permitted development `party=all` screen may show both. Dead actors are hidden during their respawn delay. Public territory, vehicle and mission markers are shared city information; hidden NPC state, input buffers, AI intentions and off-screen opposing actors are not exposed by this UI.

## Performance

`data/map.json` and `data/city-art.json` contain the small overview network used by both views. Opening the full map does not request distant chunk geometry. Ordinary gameplay remains camera-chunked and the host remains one complete authoritative simulation.

## Deliberately deferred

- Player-created waypoints and pings
- Street-by-street labels
- Route planning or GPS guidance
- Full-map pan and zoom
- Shop markers, until actual shop zones exist
- Per-player private maps; the temporary phone hold controls only that party's shared display

These are presentation additions and do not require changing the central world or controller authority model.
