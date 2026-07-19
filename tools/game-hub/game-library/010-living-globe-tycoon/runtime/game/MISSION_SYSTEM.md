# Palace errands — v0.9 mission system retained in v0.10

`EXPERIMENTAL LOCAL GAMEPLAY SYSTEM`

Palace errands put a small funny objective on top of the living island without turning the globe into a checklist. The visible layer is a title, timer, progress bar and reward. Underneath, selection, scheduling, seat contributions and currency are deterministic and saved.

## Timing

- The first mission begins after the player enters the walkable world.
- Mission starts are scheduled 600 active-play seconds apart.
- A mission expires 300 active-play seconds after it starts.
- Completing early does not pull the next mission forward; the next start remains on its ten-minute schedule.
- Failure carries no treasury, ecology, approval or inventory penalty.
- The mission clock is separate from wall time and the strategic quarter clock. It cannot advance seasons, production, politics, dilemmas, edicts or proposals.

## Solo and co-op

Mission mode is copied from the AI-seat connection when the mission starts and stays fixed until that mission ends.

| Start mode | Goal | Reward | Counted seats |
|---|---:|---:|---|
| Solo | base | base | human |
| AI connected | base ×2 | base ×2 | human + AI |

Doubling the reward with the work keeps Laurel value per unit effort stable. Connecting during a solo mission affects the next mission. Disconnecting during a co-op mission does not shrink its promised goal; reconnecting remains available through the normal explicit connector flow.

The AI has no mission-completion command. Its progress comes only from the same bounded `MOVE`, tool-selection and `ACT` intents that change the walkable world.

## Mission catalog

The seeded selector avoids the immediately previous type and excludes missions that the current island clearly cannot support. Inspection and planting remain safe fallbacks.

| Mission | Counted action | Solo goal | Solo Laurels |
|---|---|---:|---:|
| Presidential Inspection Tour | real surface travel | 60 units | 1 |
| The Green Ribbon Decree | plant saplings/reeds or release fish | 3 acts | 1 |
| Ministry of Useful Lumber | wood actually gathered | 6 wood | 1 |
| Lake Lunch Audit | fish actually caught | 2 fish | 2 |
| Campfire Diplomacy | campfires actually built | 1 fire | 1 |
| Island Supper Service | fish actually cooked | 2 fish | 2 |

## Festival Laurels

Festival Laurels (`✦`) are a saved ceremonial mission currency. They are deliberately separate from public treasury funds, private business capital, typed products and trade lots.

v0.10 can earn and display Laurels but cannot spend, trade, buy or convert them. A later monument, festival or exceptional-edict system should add explicit costs, previews, receipts and authority rules rather than silently reading Laurels as ordinary money.

## Persistence and inspection

The local save stores the active-play clock, next schedule, seeded selector state, active mission, per-seat contributions, Laurel balance and the latest 40 results. Older saves receive a clean mission state and no fabricated awards.

Read-only inspection is available at:

```js
window.AXMLivingWorld.missions.describe();
window.AXMLivingWorld.missions.observe();
window.AXMLivingWorld.missions.history();
```

The selected-world snapshot and AI observation include the same current mission summary. No public API can force-start, complete or spend a mission reward.
