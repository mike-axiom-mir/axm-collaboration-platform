# Local ChatGPT intake — CIRCUITSEED: THE PROTOCOL WILDS

This file is the handoff entry point for a later local ChatGPT/Codex session. Read it before changing the game.

## Current truth

- Product: **CIRCUITSEED — THE PROTOCOL WILDS**
- Descriptor: **A local-first agent-world adventure**
- Build: **v0.2.0 local alpha candidate — director's cut**
- Honest label: **ALPHA CANDIDATE / WORKING**
- Game Hub slot: `009`
- Preferred game port: `8799`
- Runtime dependencies: **none beyond Node.js 20+**
- Runtime internet requirement: **none**
- External AI requirement: **none**
- GitHub writes made by this build: **none**
- Automated package command: **PASS**
- Rendered desktop/phone eyes-loop: **UNRUN**

Do not promote the status to `LOCAL ALPHA TEST` until a person has actually inspected the rendered desktop and phone experience.

## Read order

1. `README_FIRST.md` — player launch and controls.
2. `DIRECTORS_CUT_CHANGELOG.md` — latest player-facing and systemic additions.
3. `BUILD_MANIFEST.json` — machine-readable counts and gates.
4. `TEST_REPORT.md` — executed evidence and honest non-passes.
5. `KNOWN_LIMITS.md` — boundaries and unverified claims.
6. `ACTION_REPORT.md` — build history and local/GitHub boundary.
7. `docs/AI_NATIVE_SEAT_CONTRACT.md` and `docs/PERSISTENCE_BOUNDARY.md` — authority and ownership.
8. `data/*.json` — authored game content.
9. `server/*.js`, then `client/*.js` — authoritative systems before presentation.

## Launch and verify

From this game folder:

```sh
npm test
./START_CIRCUITSEED_VIA_GAME_HUB.sh
```

Windows:

```text
TEST_CIRCUITSEED.bat
START_CIRCUITSEED_VIA_GAME_HUB.bat
```

Open the exact local address printed by the launcher, normally:

```text
http://127.0.0.1:8799/games/009/
```

The package command must continue to prove unit/integration behavior, CLI lifecycle, actual managed Game Hub lifecycle, result return to lobby, stopped child runtime, and package verification.

## Architecture map

```text
client/
  index.html + styles.css + app.js   shared-screen adventure UI and Canvas world
  audio.js                           local procedural WebAudio
  controller/                        intention-only phone controller
  party/                             render-only party screen; occupies no seat

data/
  circuitkin.json                    20 individuals + 10 Confluences
  world.json                         regions, routes, 41 points, 34 resource nodes
  missions.json                      ten-stage first chapter
  lore.json                          ten Memory Echoes
  field-requests.json                sixteen optional persistent requests
  items.json                         forty-five material/object/keepsake definitions
  recipes.json                       ten recipes, nine orders, three business paths

server/
  server.js                          HTTP surface and authoritative action routing
  session-manager.js                 one-to-eight visible seats and lifecycle
  input-gate.js                      shared human/adapter intention validation
  observation.js                     seat-bounded screen semantics
  circuitkin-system.js               trust, training, focus and Confluence rules
  encounter-system.js                authoritative tactical containment
  mission-system.js                  sequential chapter and mission envelopes
  request-system.js                  optional request eligibility and rewards
  economy-system.js                  crafting, demand, orders and stall state
  profile-store.js                   participant-owned portable state
  world-store.js                     host-owned world consequences
  ledger.js                          append-only hash chain and dedupe evidence
```

## Player-facing content inventory

- 5 named map regions including the settlement and finale convergence.
- 30 Circuitkin designs: 20 individual agents and 10 Confluence specialists.
- 3 opening choices and 6 starter focus branches.
- 19 authored field-signal sites plus encounter-earned Aegis.
- 10 Memory Echo sites and archive keepsakes.
- 16 optional Field Requests.
- 10 sequential chapter stages.
- 34 resource nodes, 9 material families, 10 craft recipes, and 9 local orders.
- 45 cataloged materials, crafted items, keepsakes, and commendations.
- 8 tactical actions, 2 friendly simulation modes, and 4 expedition modifiers.
- 1–8 visible occupied seats with no default AI fill.

## Design invariants

- Circuitkin are **not captured**. Field bonding is Scan → understand unfinished need → help/repair → Connect by consent.
- A Confluence is a specialist practice formed from two trained parents. Both parents remain separate, visible, and deployable.
- Specialization is an explicit player choice. Never silently auto-evolve or destructively fuse.
- Empty seats remain empty. Never invent agreement or hide an AI substitute.
- Human and connected-adapter inputs use the same semantic gate.
- Clients send intentions, never rewards, hits, outcomes, inventory, currency, position, or world state.
- Adapter observation is bounded to the bound seat's visible shared-screen semantics.
- Participant profiles and host worlds remain separate stores.
- Profile conflicts preserve a recovery copy; they are not silently overwritten.
- No central economy, public market, account system, Living Globe live integration, or Mirror live loop is claimed.
- Keep the game original. Do not copy protected creatures, maps, terms, music, battle layout, UI, or identity from Pokémon, Temtem, or another franchise.

## Persistence

Ignored runtime data lives under `local-data/`:

- `profiles/` — participant-owned roster, active kin, training, evolution, archive, items, requests, business, receipts, and history;
- `worlds/` — host-owned chapter stage, instability, demand, resource recovery, and consequences;
- `ledgers/` — per-session append-only event evidence.

New Memory Echoes and Field Requests intentionally reuse the existing portable profile schema fields. No migration is required for an older v1 profile; absent progress appears as uncollected/unclaimed.

## Latest presentation systems

- procedural title sculpture;
- full-field minimap and coordinates;
- nearby action/distance guidance;
- region-entry cards;
- deterministic design-specific kin emblems and field forms;
- five region-specific texture languages;
- ambient motes, signal trails, colored resource glyphs, scan/connect/action effects, and vignette;
- journal, inventory, milestone, recipe-state, and optional-request surfaces;
- desktop, shared-party, and phone-controller archive/request readouts;
- reduced motion, scalable text, high contrast, local-only status, and no remote assets.

## Safe next pass

The next highest-value task is a real local eyes-loop, not another hidden architecture expansion:

1. launch through the Game Hub;
2. inspect title and every responsive breakpoint;
3. traverse all regions;
4. recover at least two Memory Echoes;
5. claim one Field Request;
6. inspect all 30 codex emblems and several active companion forms;
7. craft, trade, evolve one Confluence, and resolve both major encounters;
8. test phone portrait/landscape and the party screen;
9. verify disconnect/reconnect and Hub result return;
10. repair observed problems and rerun `npm test` after every material change.

Keep screenshots and play notes local. Preserve the current build label until that evidence exists.
