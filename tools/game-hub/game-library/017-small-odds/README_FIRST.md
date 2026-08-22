# SMALL ODDS: A Random Item Life

Status: **WORKING / Neighborhood Debt Aftermath + hybrid low-poly 3D milestone**.

Run `START_SMALL_ODDS.cmd` or:

```powershell
node runtime/server.cjs
```

Then open `http://127.0.0.1:8817/games/017/`.

## What is playable

- An interactive opening at the Glimmer with Pip, the machine-shell creature, and the banknote that gets away.
- Six living places: Pip's childhood room, the family kitchen, Lopsided Lane, the Glimmer shore, Ragpicker Market, and the ticket-gated Starspite casino ship.
- All six places now combine the established animated Canvas interaction layer with an original dependency-free WebGL low-poly scene at 480x270, depth-tested and quantized to 16 lighting steps. Canvas remains authority and fallback.
- A Random Item Portal Device with a fresh 256-bit Web Crypto seed per draw, unbiased rejection-sampled integer mapping, fixed public rarity weights, an independent exact 1-in-1,000,000 casino-ticket roll, and an inspectable receipt.
- Combinatorial reactive objects, explicit cosmetic style families, contextual use, gifts, sale/install/store-equipment/recycle/hatch actions, reversible storefront escrow, and delayed reactions.
- Parent activities, visible home growth, stack-trait pets, portal upgrades, market events, day/night state, persistent save/export/import, and no real-time absence pressure.
- A bedroom alien-web storefront with five authored buyers, deterministic routing, fully factored offers, posted asks, disclosed counter ceilings, reversible listings, reusable equipment, four upgrades, six permanent specialty branches, literal assigned-pet contributions, daily service income, and delayed callbacks.
- Four Lopsided Lane residents with public authored schedules and distinct reactions to carried, listed, gifted, and sold-and-delivered objects. Gifts and fixed deliveries change relationships/home and carry exact non-random receipts.
- Four repeatable resident arcs with two authored choices each. Availability is a relationship prerequisite plus a public day cooldown; each choice has known costs, supplier standing change, due day, exact return, and unchanged RNG boundary.
- The Crooked Kettle Cooperative as a persistent supplier household. `STRAINED`, `BALANCING`, `STOCKED`, and `FLOURISHING` bands select authored resident schedule overrides and a disclosed daily business factor of x0.90/x1.00/x1.06/x1.12.
- The Long Table Works as one persistent employer and competitor. Three authored work orders rotate by day; cooperative and rush approaches publish their time, energy, wage, standing, and pressure consequences before commitment.
- Paid production with owned matching tools, one declared durability cost, literal pet species/trait labor, a public wage formula, scheduled exact-once returns, and visible consequences across credits, pet, resident, supplier, business, and home.
- Hushglass House as a second persistent neighborhood household. Warmth, trust, agreements, and four public bands drive authored schedule overrides and visible heat-sharing changes without touching probability.
- Recurring Hushglass maintenance with four integrity bands, a public four-day calendar, due/active/overdue schedule precedence, accord/retained-asset/prior-pet routes, one declared Long Table work-order conflict, exact returns, repairable overdue consequences, and visible service marks.
- Six persistent Life Thread families with 31 authored approaches. The Hushglass hearing adds supplier-, employer-, resident-, object-, and literal-pet-routed choices to the existing relationship/work routes; delayed and unattended consequences continue without accepted quests.
- Starspite ticket redemption, Vesper Coil, three transparent fixed-rule casino games, item insurance that cannot change outcomes, authored artifacts labeled non-random, and a one-time probability-crime consequence.
- Three repeatable Starspite-loss aftermath routes. Only an unhandled replay-valid losing receipt qualifies; Lane solidarity, Long Table repayment work, and Hushglass breathing room publish distinct gates, commitments, capped recovery, delayed cross-system returns, and durable 3D district memories without changing casino net or future odds.
- Exact receipts for item draws, casino plays, debt-aftermath starts/returns, Life choices, storefront actions, district observation/gift/delivery, resident arc choices/returns, paid work starts/returns, household accords/returns, recurring maintenance starts/returns/overdue effects, and service income.

## Controls

- Click or tap locations, people, hotspots, items, and actions.
- `A` / `D` or arrow keys move Pip between focus points; `E` activates the nearest hotspot.
- `I` inventory, `R` Randomizer, `H` home, `P` pets, `B` business.
- `Escape` closes the uppermost panel. Every blocking overlay has a visible close or continue action.

## Honest-randomness boundary

The game never reads wealth, inventory, failure history, play time, relationships, supplier standing, business history, or prior rarity when choosing an outcome. A fresh entropy seed comes from Web Crypto. `xoshiro128ss-v2-full-seed-mix` avalanches every 32-bit word of the 256-bit seed; rejection sampling avoids modulo bias. Version-one receipts retain their `xoshiro128ss-v1` replay path. Seed, algorithm, raw rolls, fixed odds, and no-adaptation flags remain visible.

Resident arcs, debt aftermath, supplier/Hushglass/maintenance schedules, work-order rotation and declared due-state override, wages/returns, household and recurring-service routes/returns, Life Thread emergence, buyers, counters, deliveries, and callbacks are deterministic authored simulation. Their receipts say `random:false`; they do not manufacture seeds or probability language.

The honest claim is **OS-seeded cryptographic entropy with fixed, non-adaptive mathematics**, not a physical quantum-random source.

## Save location

The world is stored locally in the browser under `axm.small-odds.save.v1`. Save version 11 migrates v1-v10 lives. It preserves prior continuity while adding neutral aftermath state: no route or recovery history is invented. Prior-pet eligibility still derives only from real Hushglass receipt evidence. Export from Settings before clearing browser data.

## Verification and scope

The current milestone passes 102 package tests. A live 1280x720 browser journey compiled WebGL, visited all six distinct scenes, showed all three routes OPEN from saved facts, published a Long Table response, crossed Day 31→32, and preserved the exact 39-credit storefront + 1-credit recovery separation through reload. The district retained a `repayment-stamp` 3D marker; all route buttons measured 44px; there were no duplicate ids, unnamed visible buttons, horizontal document overflow, or browser diagnostic logs. Two room frames 650 ms apart had different hashes. Compact-viewport, WebGL-context-loss, physical-device, continuous-frame-pacing, and Steam packaging checks remain unrun. See `BUILD_RECEIPT.md` and `evidence/NEIGHBORHOOD_DEBT_AFTERMATH_3D_EVIDENCE_ROUTE.md`.

The huge product objective remains open. A citywide labor market, independent employees, broad competitor ecology, planetary content, production 3D assets/animation, continuous frame-pacing proof, longitudinal balance, compact and physical accessibility audits, Steam build/depot/controller/certification work, and external comparative quality evidence are not claimed.
