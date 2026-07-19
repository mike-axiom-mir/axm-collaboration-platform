# NPC, mission and justice design

## Casual NPC roles

The first hostile vocabulary deliberately contains only three readable roles:

| Role | HP | Damage | Purpose |
| --- | ---: | ---: | --- |
| Rusher | 10 | 2 melee | Teaches movement and interception; two player shots defeat it. |
| Skirmisher | 10 | 2 projectile | Creates slow, visible lanes without large burst damage. |
| Blocker | 20 | 3 melee | A four-shot priority target that gives a wave shape. |

All attacks are host-owned. Melee uses a nine-tick windup and ranged shots travel at 155 pixels/second. No enemy-damage multiplier is applied for more players; party size changes counts only.

Party A count scale is 100%, 150%, 200%, 250% for one through four seats. Hold the Relay base waves are 2/3/4 units before scaling, capped at roughly 5/7/9/11 active mission units for one through four players. Cooperative mode uses the resulting 1P counts 2/3/4 and 4P counts 5/8/10.

The cooperative free city contains three Neon Rivals (one of each role). Its persistent rival-gang campaign remains saved/paused scaffolding only. District Dominion is a separate implemented session match for one through four ready seats per party: it uses hired party crews and 13 temporary control zones, not persistent gang ownership.

## Mission service

All first activities share one lifecycle:

`base → board → 10-second countdown → active → base teleport → results`

Results never auto-dismiss. After a two-second input guard, one controller may choose Continue, Replay or Mission List. The whole roster moves together; there are no separate city instances.

| Mission | Objective | Time | Equal reward |
| --- | --- | ---: | ---: |
| Supply Sweep | Collect 6 supply boxes | 120 s | DC 15,00 |
| Hold the Relay | Protect 30 HP through 3 waves | 150 s | DC 25,00 |
| Courier Chaos | Deliver 8 packages across the large city | 420 s | DC 20,00 |
| Call the Heat | Survive voluntary pursuit | 90 s | DC 0,00 |

An individual down during an active mission respawns after five seconds at that mission's group spawn. If all actors are down simultaneously, the mission fails and the party returns alive at 50 HP. Failure removes no money.

## District Credits

Each authoritative actor starts with `walletCents = 10000`. Values are integer cents clamped from 0 through 99,999,999 and rendered in Dutch-style decimal grouping (`DC 999.999,99` maximum). Successful mission payouts are equal for all selected actors. The wallet is session-only; no profile/save link exists yet.

## Forgiving justice

Justice is not a star counter and does not use a fixed number of kills. Civilian damage adds `damage × 0.5` heat; downing adds 10 additional heat. This keeps one accidental shot at caution and a single citizen down below the 45-point response threshold. Continued harm can cross response (45) and pursuit (75).

After ten quiet seconds, heat decays at 0.5/second normally or 4/second while the party is in its base. Response/pursuit spawn a bounded two/four justice units. The voluntary Call the Heat mission explicitly raises heat to pursuit. Safe zones still enforce damage permission.

Witnesses, arrest, fines, jail, roadblocks, NPC loot and a persistent rival-gang territory campaign are future systems, not hidden placeholders.
