# AXM Living Globe + Tycoon Steward vNext v0.10 — Shared Island Brief

`EXPERIMENTAL · LOCAL TEST · NOT INSTALLED · NOT PROMOTED · NOT PRODUCTION READY`

This is a separate steward-infographic experiment rolled forward from the verified v0.9 local working tree and Mike's supplied `globe-walk (1).html` hardcopy. The immutable v0.9 ZIP and source hardcopy remain untouched; the single active tree was renamed to v0.10 instead of copied again.

The rule is **casual above, deep underneath**. The new Island Brief gives each player five glanceable truths, while every card opens into exact causes and existing steward levers. Palace Radio keeps the funny dictator surface; the collapsible books still reveal deposits, recipes, inventories, prices, shortages, firms, wages, taxes, construction bills and receipts. The economy is a deterministic game system, not a financial forecast.

## Start locally

The globe uses JavaScript modules, so serve the extracted folder instead of double-clicking `index.html`.

### Windows

1. Extract the ZIP.
2. Double-click `start-local.bat`.
3. Open `http://127.0.0.1:8765/` if it does not open automatically.
4. Keep the command window open; press `Ctrl+C` there to stop.

### macOS or Linux

```sh
sh start-local.sh
```

Then open `http://127.0.0.1:8765/`. Python 3 is the only server requirement. There is no package install, account, telemetry, cloud service or runtime internet dependency.

## What v0.10 adds

- a responsive **Brief** screen with five separate infographic cards: Living island, People & politics, Public books, Supply & industry, and Mission & co-op;
- no fabricated overall island score—strong money cannot hide weak ecology, and mission success cannot hide unemployment;
- rings, revision sparklines, exact treasury flows, sector contribution cards, public-reserve bars, typed-shortage evidence and cooperative contribution bars;
- each warning says **because…** using current authoritative state and names a real lever already present in the rules;
- one deterministic metric history record per strategic revision, replacing same-revision readings and retaining 24 revisions;
- the same report on both seats: a full human Brief, a compact AI laptop strip and the full causal report in the bounded AI observation;
- a read-only `window.AXMLivingWorld.metrics` API with describe, observe and history calls but no mutation or time authority;
- opening Brief or Palace suspends human movement and the two panels close each other, keeping phone and PC control recovery predictable;
- isolated V10/v11 persistence with read-only V9 through V1 and hardcopy fallbacks; older saves receive only a current metric reading, never invented past trends.

See `STEWARD_INFOGRAPHICS.md` for exact mappings, status bands, persistence and limits.

## v0.9 Palace Errands retained

- one deterministic random **Palace errand** begins when play starts and another is scheduled every 10 active-play minutes;
- each mission remains open for exactly five active-play minutes and failure has no penalty;
- six funny, legible mission types use real play: walk the island, plant life, gather lumber, catch fish, build a campfire or cook supper;
- if the AI seat is connected when a mission starts, its goal and Festival Laurel reward are doubled and both the human and AI player actions count toward the same progress bar;
- solo/co-op mode is locked for that mission so a mid-mission connection cannot rewrite the challenge;
- **Festival Laurels** (`✦`) are saved ceremonial currency reserved for later monuments, festivals or exceptional edicts. They are not treasury cash, cannot trade and currently have no spend action;
- the human HUD, AI laptop readout, bounded AI observation, selected snapshot and local save all expose the same mission truth;
- mission time advances only while the walkable world is actively being played. It never advances a strategic quarter, resolves a dilemma or approves governance.

See `MISSION_SYSTEM.md` for the catalog, timing rules and future reward seam.

## v0.8 tropical food web retained

- four habitat-linked tropical guilds: island geckos, canopy parrots/fruit doves, shoreline land crabs and island iguanas;
- original local low-poly animals with day, night, rain, shore, canopy, basking, hopping, flying and scuttling behavior—no downloaded models or runtime network;
- a deeper food web: geckos share insect control, canopy birds and iguanas disperse seeds, crabs recycle shoreline litter, browsing can pressure farms, and introduced predators suppress native ground life;
- delayed ecological feedback: seed dispersal improves later woodland recovery, wetland condition governs frogs/fish/crabs, and native prey availability helps determine predator capacity;
- a warm wet/dry strategic climate with visible `wet`, `dry` and `trade wind` rainfall regimes;
- a casual HUD wildlife pulse plus one Palace food-web summary; species roles remain available underneath;
- bounded deterministic populations, explicit v0.7 strategic-save migration and no fabricated ecological history.

There are now 11 modeled guilds, eight dedicated procedural visual guilds, and the original birds, fish, hares, foxes and fireflies. This is enough variety for a small living-island game, not a claim of complete tropical biodiversity. See `TROPICAL_ECOLOGY.md` for the causal map and limits.

## v0.7 palace polish retained

- a brighter tropical day palette, ACES filmic tone mapping, richer ground and warmer sun/moon lighting;
- a readable island-ledger HUD, numbered tool cards, palace welcome screen and restyled AI monitor;
- one action per PC click instead of the prior pointer-up plus click duplication;
- predictable mouse recovery: after `Esc`, the first globe click only restores pointer lock;
- normalized diagonal movement, so `W+D` is not faster than walking straight;
- interpolated AI body/camera presentation and an exact bounded `aim` observation for its connector;
- a warm parchment-and-turquoise Tycoon desk with terrain textures, structure glyphs, clearer hierarchy and reduced-motion support;
- presentation-only palace notices for accepted decisions and genuinely emerged construction. These notices use UI timers only and cannot advance or mutate the simulation.

The tone is original tropical palace satire. No Tropico code, art, audio, UI, characters or dialogue is included.

## v0.6 emergence memory retained

### Remember what actually emerged

In Tycoon Steward, a healthy or strained district with at least one genuine post-starter structure can be captured as an emergence pattern. The pattern stores causal evidence—functional structure mix, density, zones, terrain, deposits, access, supply inputs/outputs and baseline complexity—not copied buildings, inventory, money or funds.

Applying a captured pattern to 1–20 selected cells costs steward attention but builds and paints nothing. It only adds a disclosed candidate preference. Ordinary zone, terrain, deposit, labor, allocation, product-bill and affordability gates remain authoritative.

- **Preserve here** stops new growth after the captured functional baseline is reached. Empty cells stay empty.
- **Evolve beyond** first guides toward the baseline, then favors compatible higher-tier development without guaranteeing it.

Capture, apply, mode changes and retirement are explicit decisions with receipts. Older Tycoon saves gain empty memory through one visible migration; the game never invents patterns from history it did not observe.

## v0.5 economy retained underneath

### Real product chains, compact enough to play

The strategic island now conserves 16 named goods:

- raw: crops, fish, timber, clay, stone and ore;
- intermediate: lumber, bricks, metal parts, textiles and preserved food;
- finished: tools, machinery, furniture, household goods and construction kits.

Districts have seeded deposits with quality and remaining availability. Renewable deposits respond to island conditions; finite stone, clay and ore can become poor extraction sites. Extractors, workshops and stores exchange exact typed quantities through a bounded ledger. A sawmill needs timber, a cannery needs fish, crops and metal parts, and a construction yard needs lumber, bricks and metal parts. Missing inputs idle a workshop instead of creating invisible output.

Households and firms create store demand. Stock relative to a stage-specific target and real unfilled orders move each product price within bounded limits. Private sales, input costs, profit and business capital remain separate from the public treasury.

### Supply shapes what emerges

At most one private enterprise may emerge during an explicit quarter. A zone grants permission; it is not a building blueprint. Each candidate discloses a 100-point selector:

- demand/profit opportunity 25%;
- input or deposit supply 25%;
- logistics 15%;
- workforce 10%;
- zone fit 10%;
- terrain/ecology 10%;
- deterministic local-founder variation 5%.

Startup capital and goods must exist and are consumed exactly. Strong clay can invite a pit and brickworks; timber plus demand can favour a sawmill or furniture shop. The score keeps supply influential without forcing every island into one inevitable monoculture.

### Trade is prepared, not faked

Stock above protected reserves becomes a typed `READY_NOT_EXPORTED` lot with quantity and value. v0.7 does not invent buyers, ships, foreign prices or export income. Those lots are the honest seam for a later trade system.

### Construction has a real bill

Public projects still require civic material, energy and water reservations, but now also purchase exact private goods such as bricks, lumber, metal parts, tools, furniture and construction kits. The preview explains:

- each typed quantity and current price;
- local crews at the current wage;
- equipment and fixtures;
- terrain-, erosion- and wetness-sensitive site preparation;
- permits/design and contingency.

Approval revalidates the bill and application consumes the goods atomically. Supplier revenue enters private business capital; it never becomes treasury cash. Undo restores the complete strategic and supply state when the normal revision rule permits it.

## Casual stewardship loop

1. Walk with `W A S D`; look with the mouse.
2. Use `1`–`5` for chop, plant, campfire, fishing and the human works flag.
3. Follow or ignore the current five-minute Palace errand; failure costs nothing.
4. Open **Brief** and scan five separate readings; expand a card only when you need the cause and lever.
5. Open **Palace** to deal with one dilemma, issue an optional edict or inspect a proposal.
6. Click **Advance one quarter** only when ready.
7. Reopen **Brief** and watch shortages, prices, firms, visitors, public books, factions and ecology react.
8. Open **Product chains · deep ledger** only when you want the machinery underneath.

Nothing strategic advances by itself and no dilemma resolves itself.

## Human phone + AI laptop seat

The v0.4 two-seat work remains intact:

- the human steward is the only player controlled by touch, keyboard or mouse;
- the AI seat has an opposite-side landfall, body, transform, tool, camera and receipt history;
- laptop layouts show a live AI monitor; click its header for full AI focus;
- `?seat=ai` opens the dedicated AI screen and `?seat=human` the human-only screen;
- phone layouts collapse the AI view to connection status and keep all controls human-only;
- both seats receive the same five-domain Island Brief; the laptop monitor adds a compact metric strip while the AI observation receives the full read-only report;
- the Two-Shores route still requires one explicit endpoint and two shared wood from each seat.
- a connected AI observes the live mission and earns progress through the same ordinary movement and tool actions as the human.

`window.AXMLivingWorld.aiPlayerSeat` exposes the bounded connector API described in `AI_PLAYER_SEAT_API.md`. There is no AI model or autonomous loop in this package, and separate devices do not synchronize without a future transport/server layer.

## Tycoon Steward map

Open `http://127.0.0.1:8765/game/tycoon-steward/` for the deeper 8×8 ruleset. Every cell shows a strongest underlying deposit. Broad zoning and resource envelopes remain the steward's tools; the simulation selects exact structures.

Its 13-product economy adds extractors, sawmills, brickworks, metalworks, canneries, furniture workshops, construction yards, market rows and food halls. Supply is a major candidate score, every build has a typed bill, processors can idle, and surpluses are only marked trade-ready. The map remains proposal-only relative to the living globe.

The **Remember what worked** panel captures a successful district and applies a visible Preserve/Evolve goal overlay to selected cells. Inspectable cards show the source evidence, target count, exact/adapted role progress and current mode. A goal is a preference layer, never a blueprint or free-build permission.

Handoff remains explicit:

1. export a bridge packet from the Palace;
2. load it under **Host-world proposal** in Tycoon Steward;
3. export a proposal;
4. import, review and separately apply it in the globe.

The globe revalidates world identity, revision, operation, cost and approval. The Tycoon ruleset never owns or resets the living world.

## Saves and migration

- v0.10 writes only `AXM_LIVING_GLOBE_STEWARD_VNEXT_V10` using `axm.living-globe.local-save/v11`;
- it may read V9, V8, V7, V6, V5, V4, V3, V2, V1 and hardcopy fallbacks;
- a v0.9 save retains its mission clock, history and Laurel balance and starts metric history with the current strategic revision only;
- v0.4 strategic state migrates once to `axm.living-world.strategic-state/v0.5` with a visible tropical-food-web receipt;
- older strategic states migrate directly and visibly to v0.5, retaining the earlier typed-supply migration boundary;
- current deposits, starter firms and inventories are initialized, but no past production, sales, trade or AI history is invented;
- pending old proposals keep their old target revision and therefore become safely stale when appropriate;
- the Tycoon UI writes only `axm.tycoon-steward.v0.1.palace-polish-v1` and may explicitly load the v0.6 or older key;
- **new world** clears only v0.10 and opts out of immediately re-importing older saves.

The supplied hardcopy remains byte-identical at `source/globe-walk-1-original.html`:

`SHA-256 bf14582156717f660efd09289aa26d65a6f5641ba116a99627330d29548582fc`

## Verification

```sh
node tests/run-tests.js
node game/tycoon-steward/tests/run-tests.js
```

- Living Globe Steward v0.10: `99 PASS · 0 FAIL`;
- included Tycoon Steward: `47 PASS · 0 FAIL`;
- JavaScript syntax, DOM IDs, contracts and manifest parsing: pass;
- v0.10 browser/screenshot gate: not run because no disposable Chromium binary is available in this workspace;
- unchanged v0.6 browser baseline: previously passed WebGL, captured pattern/Preserve/Evolve, typed economy, AI PIP/focus/intents, Two-Shores and phone human-only controls.

See `TEST_REPORT.md` for exact evidence and limits.

## Key files

- `core/island-goods.js` — deposits, 16 goods, recipes, enterprises, stores, pricing, private finance and trade-ready lots;
- `core/island-economy.js` — labor, sectors, public books and typed construction pricing;
- `core/island-ecology.js` — 11 guilds, habitat capacities and causal food-web services;
- `core/island-inhabitants-visuals.js` — eight bounded local procedural wildlife projections;
- `core/walkable-missions.js` — deterministic schedules, six errands, shared co-op progress, Festival Laurels and bounded history;
- `core/steward-metrics.js` — five-domain causal report, thresholds, warnings and bounded strategic-revision history;
- `core/steward-infographics.js` / `steward-infographics.css` — responsive human Brief, AI quick strip, flows, rings, bars and sparklines;
- `core/living-state.js` — deterministic quarter pipeline, migration, proposals, application and undo;
- `core/steward-panel.js` / `steward-panel.css` — casual surface and deep product ledger;
- `game/tycoon-steward/core/supply-chain.js` — cell deposits, 13 goods, structure recipes and supply scoring;
- `game/tycoon-steward/core/emergence-patterns.js` — causal capture, goal overlays, Preserve/Evolve progress and no-bypass influence;
- `game/tycoon-steward/core/emergence-engine.js` — broad-zone candidate selection and atomic typed builds;
- `ECONOMY_MODEL.md` — formulas, accounting boundaries and tuning assumptions;
- `TROPICAL_ECOLOGY.md` — animal roles, causal web, migration and honest biodiversity limit;
- `MISSION_SYSTEM.md` — mission rules, co-op semantics, reward boundary and future extension seam;
- `STEWARD_INFOGRAPHICS.md` — metric sources, status bands, shared-seat semantics, API and honest limits;
- `ARCHITECTURE.md`, `SOURCE_TRACE.md`, `TEST_REPORT.md` — implementation and evidence.

## Honest boundaries

- This is an original fictional gameplay economy, not a real market, geology, ecology, culture, government or population model.
- Trade partners, shipping, contracts, tariffs, foreign demand and exchange rates are not connected yet.
- Browser-local persistence is not shared or authoritative multiplayer state.
- The AI screen is a real second camera in one runtime, not proof of cross-device networking.
- Festival Laurels cannot be bought, sold, exchanged for treasury funds or spent yet; future rewards require an explicit versioned rule.
- The package is independent and unaffiliated with Tropico, Kalypso Media or Limbic Entertainment; it copies no Tropico code, art, audio, characters or dialogue.
- Fun, balance, comedy timing, accessibility, touch feel and low-end-device performance still require Mike's local human playtest.
