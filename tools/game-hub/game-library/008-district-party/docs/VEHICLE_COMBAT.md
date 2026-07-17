# Vehicle occupancy and combat

Every car is a host-owned four-seat entity:

- one driver;
- three exclusive passenger slots;
- simultaneous claims resolved by the host;
- driver controls steering/acceleration/brake;
- passengers use their movement stick as an aim direction and may fire their own sidearm;
- the driver may fire forward;
- all occupants remain ordinary player actors under the same health, inventory, cooldown and damage rules.

Cars start at 50/50 HP. A projectile colliding with a car damages the car before an occupant. A projectile fired from inside ignores its source car and fellow occupants at the muzzle. Same-party players cannot damage an ally-owned car.

At 0 HP the host:

1. marks the car destroyed and stops movement;
2. clears driver/passenger ownership;
3. places every occupant at a collision-safe exit, falling back to that actor's safe spawn only if all exits are blocked;
4. applies exactly 80 environment damage to each former occupant;
5. emits a visible explosion effect;
6. rejects new entry until the car respawns at its original spawn after 900 ticks/30 seconds.

At default 100 HP plus 1 shield, 80 damage consumes the shield and 79 HP, leaving 21 HP. A previously damaged actor may still be downed; the promise is deliberately not invulnerability.

Vehicle-to-actor impact damage, repair, vehicle weapons, deformation and territorial ownership are not implemented.
