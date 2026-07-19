# Mission replayability v0.2.5 port guide

## Important version boundary

This reference was built over the preserved v0.2.4 group-save package in the ChatGPT workspace. Mike reported that Local Codex has additional laptop-side bug fixes. Back up that newest project and merge this feature; do not replace newer mission, persistence or input files wholesale.

## Integration order

1. Add `data/mission-layouts.json` and load it beside `data/missions.json`.
2. Merge the host-only `missionDirector` state into world creation.
3. Merge layout reservation, safe placement, route-specific spawns and active delivery zones into `server/mission-system.js`.
4. Make Host AI use `activeDeliveryZones(world)` rather than the complete static delivery list.
5. Expose only the selected public layout through controller/shared state; never expose the host deck.
6. Merge main-canvas and city-map active dispatch/drop markers.
7. Preserve newer Local Codex mission fixes and persistence fields.
8. Run the newest project's complete suite plus `tests/mission-replayability.test.js`.

## Required invariants

- Four current mission modes each receive four layouts.
- A route deck consumes all layouts before reshuffling.
- No immediate repeat at a deck boundary.
- The host chooses final coordinates and owns every objective.
- Phones and adapters cannot submit a layout id through the input route.
- Active courier delivery zones are enforced by the host, not just highlighted by the client.
- Actors, objectives and enemies are collision-open for eight simulated seats.
- Results remain player-dismissed with no automatic timeout.
- Existing group-save, inventory, money, combat and vehicle behavior remains intact.

## Likely merge conflicts

`server/mission-system.js`, `server/world-state.js`, `server/display-state.js`, `server/ai-player-system.js`, `client/game/ui/hud.js` and `client/game/ui/city-map.js` are integration files. Compare functions rather than copying the whole file over a newer build.

`data/mission-layouts.json` and `tests/mission-replayability.test.js` are clean additions unless Local Codex independently created files with those names.

## Suggested physical check

Play one mission, select Replay three times, and confirm four distinct location names appear. For Courier Chaos, confirm an inactive old delivery marker neither appears as active nor accepts a carried package. Then return to the Party House and confirm the persistent results break and nine-slot save computer still behave normally.

