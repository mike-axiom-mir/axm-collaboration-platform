# Authoritative combat rules

Phones request attacks; the host creates and advances every projectile, checks collisions, evaluates damage permission and applies health/shield changes.

Default player rules:

```json
{
  "enabled": true,
  "crossPartyDamage": true,
  "selfDamage": false,
  "partyFriendlyFire": { "party_a": false, "party_b": false },
  "neutralDamage": true,
  "environmentDamage": true
}
```

`server/damage-rules.js` is the central gate. Projectile and NPC melee channels are implemented. General explosion and vehicle-impact channels still fail closed. The specific car-destruction occupant event is an explicit host-owned `environmentDamage` event.

## Small-number balance

| Source | HP | Damage | Notes |
| --- | ---: | ---: | --- |
| Player | 100 + 1 shield | 5 | Pulse projectile, 10-tick cooldown |
| Rival Rusher | 10 | 2 | Melee, 9-tick visible windup |
| Rival Skirmisher | 10 | 2 | Slow 155 px/s projectile |
| Rival Blocker | 20 | 3 | Slower melee, 9-tick windup |
| Party crew | 10 (Rusher/Skirmisher) | 2 | Paid competitive reinforcement; same central party rules |
| Citizen | 20–50 | none | Flee/down/respawn |
| Car | 50 | 80 on occupant explosion | Full-health default-shield actor survives at 21 HP |

Hostile hits apply an approximately 0.37-second (11-tick) grace before another hostile hit can reduce that actor's health. This prevents simple overlaps from creating a stunlock/damage burst.

Same-party player shots with friendly fire OFF never reduce health, never down an ally and show a harmless blue shield spark. Configured LOW ally knockback may apply a short collision-safe push. Same-party shots also cannot damage an ally-owned car.

Safe zones block player/NPC combat damage. District Dominion uses mirrored party command safe zones; their regeneration is party-filtered, while damage protection is spatial for readability. Environment damage remains a distinct rule so an exploding occupied vehicle has its promised consequence.

Shield absorbs before HP. Health regenerates at 1 HP/s normally or 10 HP/s in the Party House, capped at 100. Shield does not regenerate by default.

Inventory-backed ranged items consume compatible equipped ammunition. Depletion automatically equips the lowest-index compatible stack in the 12-slot bag. The provisional pulse sidearm has no designed ammo item yet and displays **∞**.
