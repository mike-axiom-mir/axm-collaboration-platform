# Architecture — Living Globe Steward vNext v0.10

`EXPERIMENTAL LOCAL TEST`

## Authority and clocks

The Living Globe owns canonical browser-local state. Tycoon Steward is a deterministic read/proposal ruleset: it may never own, reset, advance or directly mutate the globe.

```text
walkable globe                         strategic state v0.5
trees · lake · visible fauna           districts · ecology · society
continuous visual clocks               explicit quarter clock only
          │                                      │
          └── declared observation seam ─────────┤
                                                 ▼
 deposits → typed goods → firms/stores → causal public economy
                                                 │
                                      state/revision/receipt
                                                 │
                                      versioned host snapshot
                                                 ▼
                                  Tycoon proposal-only ruleset
                                                 │
                              preview → review → approve → apply

human seat ─────────────── shared walkable world ─────────────── AI seat
phone / keyboard / mouse      wood · life · co-op works          connector only
human camera                                                     laptop camera
       └──────────── same read-only five-domain Brief ───────────────┘
```

Walking, animation, growth and day/night retain the hardcopy clocks. Strategic ecology, products, companies, prices, factions and treasury move only in `advanceQuarter()`. Edicts, dilemmas and proposals also require explicit human actions.

## Shared steward metrics

`core/steward-metrics.js` is a pure projection over authoritative strategic state plus the public mission and declared player-seat context. It owns no strategic values. It emits five separate cards—ecology, people, economy, supply and mission—plus threshold warnings, exact evidence and existing steward levers. There is no composite island score.

The module captures one bounded trend record per strategic revision and retains 24. A repeated capture at the same revision replaces that reading. Mission-clock changes update the live report but do not fabricate strategic trend points. The module uses no DOM, wall clock, runtime network or unseeded randomness.

`core/steward-infographics.js` renders the same report into:

- the human full-screen **Brief** with rings, sparklines, public-money flows, public-reserve bars and co-op contributions;
- the AI laptop five-reading strip;
- the bounded AI observation under `stewardMetrics`;
- the read-only `window.AXMLivingWorld.metrics` API.

The UI is presentation only. Opening Brief or Palace suspends walk controls, the panels close each other, and neither has a route to strategic mutation. Dynamic report text is assigned through `textContent`.

## Walkable mission clock

`core/walkable-missions.js` owns a separate deterministic active-play clock. The first mission starts after entry; later starts are scheduled 600 active seconds apart and expire after 300 active seconds. This clock has no call path to `advanceQuarter()`, governance or treasury state.

The module selects among six feasible action missions with seeded randomness, avoids immediate repeats, locks solo/co-op mode at mission start, accepts typed progress events and keeps a bounded 40-result history. In co-op, goal and reward are doubled and the human and AI contribution buckets add to one target. Solo missions reject AI progress.

Festival Laurels are a mission-owned ceremonial balance. They are neither treasury funds nor private capital, have no exchange rate, and expose no spend method in v0.10. The browser integration records only successful world actions and actual spherical travel. UI animation and journal messages present mission events but do not decide them.

## Deterministic strategic modules

### `core/living-state.js`

Owns world identity, revision, quarter, weather, districts, civic resources, proposals, receipts, save migration and transaction ordering. It composes ecology, society, typed supply and public economy. No child module owns time.

### `core/island-goods.js`

Owns the private product layer:

- six district deposits: crops, fish, timber, clay, stone and ore;
- 16 typed inventories and bounded prices;
- six extractor, ten processor and three store definitions;
- seven declared starter firms and deterministic private-enterprise emergence;
- exact production, process-input, sale, startup and construction-supply transactions;
- store demand, shortfalls, private sales/profit/capital and protected trade-ready lots;
- bounded 600-entry product ledger plus price/quarter histories.

Private goods are neither civic material reserve nor treasury money. An old save receives declared starter conditions but no invented past sales or production.

### `core/island-economy.js`

Owns the public accounting view:

- six casual living-cost prices, informed by both civic stocks and typed product prices;
- labor force, enterprise-linked job capacity, employment, productivity and wage;
- agriculture, industry, entertainment, commerce and public-service books;
- named taxes, duties, public shares and operating expenses;
- typed procurement plus civic resource requirements for construction;
- bounded 24-quarter price and public-ledger histories.

Commerce values goods actually supplied to stores. Industry values actual typed production and input cost. Private revenue does not flow wholesale into treasury funds.

### Ecology, society and visuals

- `core/island-ecology.js` owns six habitats, 11 inhabitant guilds, pollination, three-way insect control, seed dispersal, shoreline recycling, browsing, invasive pressure and bounded food-web effects. The four v0.8 tropical additions are geckos, canopy birds, land crabs and iguanas.
- `core/island-society.js` owns fictional factions, approval, legitimacy, edicts, dilemmas, promises, elections and Palace Radio.
- `core/island-inhabitants-visuals.js` projects eight strategic guilds into bounded local procedural meshes with habitat and day/night/rain behavior but cannot mutate strategic truth.

No strategic module uses wall time, locale, network, DOM, canvas or unseeded randomness.

## Explicit-quarter transaction

One accepted quarter:

1. validates expected revision and a visible reason;
2. advances the deterministic calendar/weather;
3. reads current edict modifiers;
4. advances habitats, ecological services and inhabitant pressure;
5. produces and consumes civic water, food, energy, materials and attention;
6. refreshes deposit conditions;
7. runs existing extractors, processors and stores with exact typed inputs/outputs;
8. records shelf shortages, recalculates product prices and marks protected surplus lots;
9. scores private-enterprise candidates and permits at most one viable startup;
10. recalculates labor, living costs and sector books from the resulting real activity;
11. applies named public income/expenses to treasury funds;
12. updates factions, promises, election state, edict expiry and at most one dilemma;
13. validates invariants and appends one hash-linked receipt.

Missing inputs create shortfalls or idle firms. They never create negative stock or a partial batch. The enterprise selector runs only inside this explicit transaction.

## Supply-aware emergence

```text
deposit quality / input stock ──┐
store shortfall / output price ─┤
roads / nearby activity ────────┤
available workforce ────────────┼─→ disclosed candidate score
zone + terrain/ecology ─────────┤             │
seeded founder variation ───────┘             ▼
                                  capital + startup-goods gate
                                               │
                                     at most one firm / quarter
```

Weights are demand/profit 25%, input supply 25%, logistics 15%, workforce 10%, zone fit 10%, terrain/ecology 10% and deterministic founder variation 5%. A zone is permission, not an exact building command.

## Prices and money boundaries

Each typed good has a reference price, capacity and stock target determined by its production stage. Scarcity and fulfilled/unfulfilled demand move the price inside a fixed bound. Product sales pay private firms. Positive private profits modify private business capital. The treasury receives only named taxes, fees, duties and declared public shares.

There are intentionally two physical layers:

- civic reserves (`materials`, `energy`, `water`) preserve the earlier public-capacity game;
- typed private goods represent purchasable supply chains.

Construction previews disclose both. Application deducts each exactly once and pays typed procurement from treasury funds into private capital. Atomic validation prevents a partial spend.

## Construction lifecycle

```text
PROPOSAL_ONLY
   ├─ REJECTED
   └─ APPROVED_NOT_APPLIED
            └─ APPLIED
                 └─ UNDONE (latest revision only)
```

Supported operations remain `PROPOSE_DISTRICT`, `PROPOSE_ROAD`, `PROPOSE_SERVICE` and `PROPOSE_ECO_BUFFER`. Preview is pure. Create reserves civic resources only. Approval does not apply. Apply revalidates revision, civic resources, treasury cash and typed goods, then commits all effects together. Undo restores the pre-apply state, including goods and private finance.

## Tycoon cell engine

`game/tycoon-steward/core/supply-chain.js` adds six deterministic deposits to every 8×8 cell and conserves 13 products. `core/emergence-engine.js` uses the product system to score extractors, processors, markets and food halls alongside the original zoning candidates.

Its selector weights are need 15%, product demand 20%, input/deposit supply 25%, logistics 15%, workforce 10%, terrain/resource 10% and seeded founder variation 5%. Build bills are consumed atomically. Operating recipes can idle. Surplus is marked `READY_NOT_EXPORTED`; no external trade occurs.

Tycoon state remains graphics-independent and versioned as its experimental v0.1 ruleset. The v0.10 host packages the unchanged extended ruleset and presentation layer but does not silently promote its module identity.

## Captured emergence memory

`game/tycoon-steward/core/emergence-patterns.js` owns a nested `axm.tycoon-steward.emergence-memory/v0.1` state. It can capture only post-starter structures from an operating district after an explicit decision. Captured evidence stores roles, density, terrain/zone/deposit context, access, operating inputs/outputs and baseline tier. It deliberately excludes buildings, inventories, reservations, money and treasury funds.

```text
observed post-starter district
        │ explicit capture · 1 attention
        ▼
causal pattern evidence
        │ explicit apply · 2 attention · selected foreign cells
        ▼
goal preference ──→ normal candidate scorer
                         │
               zone + terrain + deposit
               labor + allocation + exact goods bill
                         │
                 emerge or honestly refuse
```

An active goal contributes a bounded, disclosed additive score: an exact missing role is strongest, a same-category substitute is weaker, and compatible supply context is small. It never disables ordinary feasibility checks. `PRESERVE` blocks further new emergence after the functional baseline is met; `EVOLVE` reopens growth and gives a modest bonus to compatible candidates above the captured tier. Mode changes and retirement are explicit, receipt-linked decisions.

Progress distinguishes exact and adapted functional matches. Pattern, goal and history counts are capped. Old v0.1 Tycoon states receive empty memory plus one visible migration receipt; no past pattern is inferred.

## Two Hub player seats

The human and AI are first-class walkable seats in one WebGL runtime. Each has a stable ID, spherical transform and camera. The AI receives an opposite-side dry landfall and an explicit connection/intent seam. Phone input is hard-bound to the human. Laptop layouts render an AI picture-in-picture or dedicated AI focus. v0.7 interpolates the visible AI transform and adds bounded center-aim evidence; authority remains unchanged.

The AI port allows only bounded `MOVE`, `LOOK`, `SET_TOOL`, `ACT` and `WAIT` intents. It cannot advance strategic time, choose dilemmas, issue edicts, approve proposals, access hidden state or create a network connection. AI intent receipts form their own bounded hash chain because walkable commands do not advance strategic revision.

The AI observation includes the public mission summary and the same shared steward report shown to the human. Metrics are not a new authority: they expose only bounded causal evidence. Mission contribution still passes through the same world action path and is counted only when the active mission began in co-op mode.

The Two-Shores project requires a human endpoint and an AI endpoint, two shared wood each, dry clear terrain and adequate separation. It has no hidden strategic bonus.

## Schemas and persistence

- browser world contract: `axm.living-world.contract/v10`, version `0.10.0`;
- package manifest: `axm.living-world-manifest/v10`;
- selected snapshot: `axm.living-world.selected-snapshot/v10`;
- strategic state: `axm.living-world.strategic-state/v0.5`;
- product layer: `axm.living-world.island-goods/v0.1`;
- bridge: `axm.living-world.steward-bridge/v0.4`;
- captured memory: `axm.tycoon-steward.emergence-memory/v0.1` inside the experimental Tycoon v0.1 state;
- walkable missions: `axm.living-world.walkable-missions/v0.1`;
- steward infographic: `axm.living-world.steward-infographic/v0.1`;
- metric history: `axm.living-world.steward-metric-history/v0.1`;
- local save: `axm.living-globe.local-save/v11` at `AXM_LIVING_GLOBE_STEWARD_VNEXT_V10`.

V9/V8/V7/V6/V5/V4/V3/V2/V1/hardcopy reads are fallbacks only. Migration is visible, deterministic and does not fabricate historical commerce, ecological sightings, mission rewards, metric trends or emergence memory. Runtime connector ownership is released on reload.

## Runtime boundary

- local Three.js r160 and no runtime network/telemetry;
- browser-local state only; no authoritative cross-device multiplayer;
- user-initiated JSON import/export capped at 1 MB;
- dynamic imported text is rendered as text, not injected HTML;
- no automatic strategic turn, choice, approval, application, external product export or AI loop;
- no Festival Laurel spending, trading or conversion in v0.10;
- no scientific, financial, ecological, political or real-population claim.
