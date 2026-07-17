# Party base and default regeneration

Status: **IMPLEMENTED IN THE AUTHORITATIVE WORLD LOOP**

`data/map.json` defines one large, walkable Party A starting house in the south-east block.

- Building: `party-base-house`
- Interior gameplay zone: `party-base-interior`
- Party A seats 1–4 spawn inside the interior.
- Five narrow collision rectangles form the four exterior walls.
- The south wall has a 48-pixel open doorway, wide enough for players and the host AI navigation grid.
- The existing safe-spawn rule covers the house and immediate entrance.
- The former solid `apartments-building` collision rectangle was removed. The house is not a decorative solid obstacle.

The client renders the interior floor, boundary walls, open doorway and `BASE REGEN · 10 HP/S` label without painting a solid roof over active actors. The shared-screen HUD shows a base-regeneration banner while at least one viewed party actor is inside. The controller identifies the same state for its assigned actor. The base is deliberately data-driven so a later home/base upgrade system does not need coordinates embedded in gameplay code.

## Authoritative health rules

`server/base-system.js` owns the default regeneration calculation:

| Rule | Value |
|---|---:|
| Starting health | 100 HP |
| Starting shield | 1 |
| Normal health regeneration | 1 HP/second |
| Party-base health regeneration | 10 HP/second |
| Default regeneration ceiling | 100 HP |
| Default shield regeneration | 0 |

The 100 HP regeneration ceiling is independent of `maxHealth`. Future body, hat, shoe or rare/quest equipment may raise `maxHealth`, but the free default regeneration must still stop at 100. For example, an actor at 125/150 HP stays at 125; an actor at 80/150 HP regenerates only to 100.

Shield is represented from the start, but the default system never restores it. Later equipment or abilities must use a separate explicit shield-recharge rule.

`updateBaseRegeneration(world, deltaSeconds)`:

- runs on the authoritative host;
- applies only to living, non-downed, non-respawning actors;
- locates actors against map base zones;
- uses a per-actor fractional accumulator so 30 simulation ticks produce the same integer HP restoration as one second;
- clamps a single update to one second to avoid a long host stall granting a large heal burst;
- returns a compact list of actual health changes for optional effects or diagnostics.

World creation initializes each player actor's vitals. The authoritative 30 Hz world loop calls `updateBaseRegeneration(world, deltaSeconds)` after player/vehicle movement and combat, using the actor's authoritative position. The shield is consumed before health on an approved hit, but this default regeneration loop never restores shield.

The house also contains the mapped mission board. One controller selects a mission, the host runs a 10-second countdown, then all actors teleport together. Mission success/failure returns the roster to the house before a persistent results break; living damage is preserved and continues healing at 10 HP/s during results. Base upgrading, furnishing, storage, persistence and equipment-driven regeneration are not implemented in v0.1.7. District Dominion uses mirrored command posts instead of the cooperative house lifecycle.
