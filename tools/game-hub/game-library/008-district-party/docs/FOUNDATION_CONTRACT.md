# Foundation contract

Status: **LOCAL COMPATIBILITY CONTRACT IMPLEMENTED · REAL GAME HUB LAUNCH UNTESTED**

## Inherited direction

The exact PR 13 head inspection verifies that the AXM Game Hub/Foundation:

- shows four party slots while its engine reserves eight seats;
- supports `human`, `adapter` and `ai` types;
- selects participants by ready order;
- passes the complete selection through `AXM_PLAYERS_JSON`;
- returns individual human controller URLs and a distinct non-seat spectator URL;
- generates named QR cards locally;
- uses room `AXM1` and local authoritative/input-intention rules.

See `PR13_SOURCE_TRACE.md` for exact-SHA evidence and important limitations.

## Local adapter input

The adapter accepts either a selected-player array or `AXM_PLAYERS_JSON`. Every record is normalized to:

```json
{
  "actorId": "actor-seat-1",
  "seatId": "seat_1",
  "slot": 1,
  "displayName": "Player 1",
  "controllerType": "human",
  "adapterId": null,
  "partyId": "party_a",
  "connected": false,
  "ready": true
}
```

Source-field aliases (`seat_id`, `display_name`, `type`, `adapter_id`) are preserved through normalization. Duplicate seats, invalid slots/types and malformed JSON are rejected. Records with `ready: false` do not become active actors. Convenience variables `AXM_P1_NAME`…`AXM_P4_NAME` are not used to reconstruct the complete roster.

## Central party mapping

Only `foundation-adapter/party-mapper.js` owns the slot boundary:

- slots 1–4 → `party_a`
- slots 5–8 → `party_b`
- every other slot → invalid/null

Gameplay systems consume `actor.partyId`; they do not repeat slot boundaries.

## Launch seam

`POST /api/session/start` accepts a Foundation-shaped array and returns:

- normalized public participants;
- local session and host token;
- a controller link/token only for each human seat;
- a non-QR `adapterBinding` for each connected Foundation AI seat;
- Party A, Party B and `all` screen routes;
- persistent receiver routes.

District Dominion accepts any selected ready roster containing at least one Party A seat and one Party B seat: 1v1 through 4v4, including unequal teams. It does not create actors for unselected slots. `hostAiFillEmptySeats` is an explicit optional setting and defaults to `false`.

The real Game Hub adapter later needs to launch this host with `AXM_PLAYERS_JSON` and consume the returned join/screen records. That full Workshop path is outside this build and is **UNTESTED**.

## Authority boundary

Human and Foundation adapter controllers send only `{moveX, moveY, aimX, aimY, aimActive, action, attack, fire, sprint, brake, inventoryToggle, inventoryPrev, inventoryNext, inventoryActivate}` intentions with room, session, seat, token and increasing sequence. Both types pass through the same `routeInput()` token, sequence and sanitation gate. Inventory fields are rising-edge pulses: the host advances the server cursor and performs the legal equip/unequip operation. No controller packet can contain an item definition, slot contents, ammunition quantity or equipment ability.

The host rejects a mismatched room/session/seat association and returns its accepted sequence to support safe controller reloads. Input motion is cleared after a short timeout and connection presence expires after five seconds without accepted input. An open inventory suppresses gameplay input only for its owning actor and closes when that external human/adapter controller disconnects. The party screen renders inventory panels but sends no actor or inventory input.

`adapter` and `ai` are intentionally different. `adapter` means an externally connected local/cloud AI supplied by the Workshop; it is never advanced by the built-in AI state machine. `ai` means the optional game-local Host AI. The launcher never fills empty seats with Host AI unless the host selects the explicit option.

An adapter reads `GET /api/adapter-observation` with its seat token in `X-AXM-Seat-Token`. The response is a semantic projection of that seat's shared party screen: its own HUD, ally corner HUD, public mission/territory indicators, current party-camera bounds and only entities/map features inside those bounds. It omits off-screen opponents, host input buffers, AI paths, cooldown internals and random state. The adapter does not receive raw authoritative world state through its binding.

The host owns tick progression, positions, collisions, health, shield, regeneration, inventories, ammunition consumption, projectiles, vehicle seats, AI, package ownership, delivery scoring, damage permissions and respawn. The shared-screen display projection derives each actor's current/maximum vitals and a read-only ammo summary: loaded compatible equipped ammo plus compatible reserve stacks from the 12-slot pack. Controllers cannot submit that summary.

Every selected actor, up to eight, initializes the same independent six-equipment-plus-12-pack inventory and personal-fund shape. Party A and Party B receive isolated host-owned treasuries. Party A seats 1–4 map to shared-screen corners top-left, top-right, bottom-left and bottom-right; Party B seats 5–8 use those same four relative corners. Unselected corners stay unassigned. The permitted `party=all` route stacks both parties in each matching corner. The v0.2 fallback launcher begins with one ready human per competitive party, while the real Game Hub remains the intended source of the ready roster.
