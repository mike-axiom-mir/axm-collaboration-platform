# Circuitseed test report

Build: **v0.2.0 local alpha candidate — director's cut**  
Status: **ALPHA CANDIDATE / WORKING**  
Final automated run: **2026-07-18**  
Rule: PASS means executed evidence. Nothing visually unrun is counted as a pass.

## Final command results

| Command or gate | Result | Evidence |
|---|---:|---|
| `npm test` in the Circuitseed package | PASS | 49/49 Node unit and integration tests; CLI lifecycle; actual Game Hub lifecycle; package verifier |
| Dependency-isolated UI DOM boot/action smoke | PASS | real local server and real client scripts; New Journey entered; 3 starter cards, 10 recipes, 10 journal slots, and 16 Field Requests rendered; Journal opened; session ended |
| Actual managed Game Hub lifecycle | PASS | slot 009 discovered; port 8799 launched; one selected player; game result returned; Hub reached `LOBBY`; child stopped |
| PR #14-compatible game-package verifier | PASS | slot 009; procedural assets 4; external assets 0 |
| Shared controls/AI-native port-kit `npm test` | PASS | 19/19 tests |
| Active Workshop `node verify.js` | PASS | 0 FAIL; 0 warn; Foundation spine `418f9ce4fb050602` intact |
| Supplied Hub/Route/Skin/Renderer/Graft/static self-tests | PASS | every invoked command exited 0 |
| Active Workshop root `npm test` | UNRUN | the active root `package.json` defines `dev`, `start`, and `alpha-local`; it has no `test` script |

The npm warning about the deprecated `http-proxy` environment spelling is an npm configuration warning, not a game failure. The shipped game still has zero dependencies. `jsdom` was installed only under `/tmp` for the isolated one-off UI smoke and is not part of the game or ZIP.

## Required 32-test matrix

| # | Required proof | Result | Executed evidence |
|---:|---|:---:|---|
| 1 | Manifest/package verifier | PASS | `manifest.test.js`; `scripts/verify-package.js`; exact PR #14 verifier |
| 2 | Server start/health/stop | PASS | CLI lifecycle and actual Game Hub managed lifecycle |
| 3 | Browser/static syntax | PASS | every first-party JS parsed; every JSON loaded; live HTML routes served; real client DOM boot/action smoke passed |
| 4 | One-seat solo start | PASS | one-seat layout and HTTP session start |
| 5 | All layouts from one to eight occupied seats | PASS | all eight counts created and validated |
| 6 | Empty seats remain empty | PASS | no omitted slot was materialized |
| 7 | No default AI fill | PASS | session rule and layout assertions |
| 8 | Human and adapter input parity | PASS | identical sanitizer/authority gate assertions |
| 9 | Machine-only action rejection | PASS | client-asserted reward/outcome fields refused |
| 10 | Wrong/stale seat, token, and sequence rejection | PASS | gate tests including Host AI external-packet refusal |
| 11 | Seat-visible observation rejects hidden state | PASS | tokens, world seed, hidden routes, future/offscreen state absent |
| 12 | Adapter consent revoke/pause | PASS | consent revoked; commands paused; no replacement created |
| 13 | Drop-in | PASS | real slot-7 join in CLI lifecycle |
| 14 | Drop-out | PASS | active actor stopped without control transfer |
| 15 | Disconnect autosave | PASS | last safe checkpoint and disconnect history persisted |
| 16 | Reconnect recovery | PASS | same profile/token binding restored inside window |
| 17 | Participant/world store separation | PASS | distinct schemas, owners, and files |
| 18 | Profile export/import | PASS | portable JSON, already-current path, UI import, and strict schema refusal |
| 19 | Duplicate receipt rejection | PASS | hash ledger and mission/order/Field Request dedupe assertions |
| 20 | Visible profile conflict | PASS | HTTP 409 plus preserved recovery copy; current profile not overwritten |
| 21 | Mission envelope commit | PASS | separate participant and host-world commits; replay deduped |
| 22 | Circuitkin collection/development/evolution | PASS | exact 20+10 catalog, 19 field signals, scan-before-connect, 30/30 reachable roster, focus branches, two-parent eligibility, parent preservation, active selection, live routes, and persisted histories |
| 23 | Tactical encounter resolution | PASS | Corewild, Rootsignal, friendly 1v1/2v2, support roles, recovery, base-role bonuses, Confluence signatures, and inherited compatibility |
| 24 | Inventory and crafting | PASS | host validates materials, spend, output, recipe access, Memory Echo keepsakes/unlocks, and referential integrity across 45 catalog entries |
| 25 | Trade validation | PASS | unknown, closed, unfunded, duplicate, and world-scoped order transactions tested |
| 26 | Shop order and reputation | PASS | open/closed stall, 9 orders, demand, pay, reputation, transaction, and no away decay |
| 27 | World-state mission generation | PASS | highest real instability selects a bounded authored template; resolution persists |
| 28 | Seeded replay consistency | PASS | same seed reproduces conditions and expedition modifier |
| 29 | Asset-manifest completeness | PASS | all declared runtime assets exist; no external entry |
| 30 | No remote runtime dependency | PASS | source scan plus empty dependency map |
| 31 | License-policy check | PASS | creator, license, method, provenance, and zero-third-party claims cross-checked |
| 32 | Result summary and clean return to lobby | PASS | game result callback reached Game Hub; Hub state became `LOBBY`; runtime child stopped |

## Integrated chapter proof

PASS — `chapter-flow.test.js` runs the ten authored stages in order from First Light through the Rootsignal return. It exercises starter connection, material/crafting/business state, Corewild and Rootsignal encounters, the dynamic world intervention, solo cooperative synchronization through a trusted Circuitkin, ten separate mission envelopes, ten participant receipts, ten host-world consequences, achievement persistence, ledger validation, and a final session result.

PASS — `game-systems.test.js` separately proves the expanded collection path: every individual maps to an authored source, every individual appears in exactly one Confluence pairing, a field bond refuses Connect before Scan, one persistent profile reaches all 30 unique designs, all 10 evolutions preserve both parents, and a specialist signature changes authoritative encounter output.

PASS — `directors-cut.test.js` proves the new content layer is referentially complete: 10 lore records map one-to-one to 10 world sites; every artifact, resource material, recipe input/output, unlock, and request reward resolves to the item/recipe catalog; the authoritative Scan path grants one provenance-bearing keepsake and recipe; the seat observation derives the journal and Signal Board from the real profile; and a completed optional request pays exactly once while incomplete and duplicate claims refuse.

PASS — the authenticated live HTTP suite proves bootstrap counts, journal/request/inventory observation, and a server-side Field Request claim through the ordinary session/seat/token boundary.

This is systems-level automated proof. It is not a claim that a human completed or timed the rendered chapter.

## Rendered eyes-loop matrix

No Chromium, Chrome, Firefox, WebKit, Electron, or approved private preview URL was available in the execution environment. The cloud-browser rule forbids handing `127.0.0.1` to a cloud browser. Therefore:

| Screen or device | Result | Reason |
|---|:---:|---|
| Animated title | UNRUN | no browser pixels available |
| Lumen Yard settlement | UNRUN | no browser pixels available |
| Relayborn/Threadwild/Corewild exploration | UNRUN | no browser pixels available |
| Tactical encounter | UNRUN | no browser pixels available |
| Workbench, 30-entry codex, evolution, shop, and order UI | UNRUN | no browser pixels available |
| Minimap, proximity cue, region reveal, Memory Echo discovery card, journal, inventory, and Signal Board | UNRUN | DOM boot passed; no browser pixels available |
| Profile create/export/import/conflict UI | UNRUN | no browser pixels available |
| Game Hub lobby presentation | UNRUN | no browser pixels available |
| Phone controller portrait/landscape | UNRUN | no browser pixels or physical handset |
| Disconnect/reconnect presentation | UNRUN | no browser pixels available |
| Result/return presentation | UNRUN | no browser pixels available |
| Eight simultaneous physical devices | UNRUN | no physical multi-device setup |
| Windows batch/firewall path | UNRUN | Windows unavailable |

Because this visual matrix is UNRUN, the package is not labeled `LOCAL ALPHA TEST` despite the automated passes.

## Failure/repair history

No failing assertion was removed or weakened.

- The verifier rejected the first spectator route; it was repaired to the required game-route prefix and rerun.
- The first Hub smoke used a grandchild runtime that the harness terminated. The real Hub server was made explicitly startable/closable in-process; the managed child assertion remained intact.
- Hub `/health` failed when the sandbox denied network-interface enumeration. LAN discovery now safely returns an empty list while loopback remains operational.
- Dynamic instability initially changed only session memory and could be overwritten by its mission envelope. It now commits to the world store first; a regression test proves survival.
- Session results initially validated the ledger before appending `session-end`. The append now precedes validation.
- The polish pass repaired lost-world Continue selection, returning-profile starter replay, cross-world order replay, incompatible profile/world refusal, playable specialization/simulations, Canvas rounded-rectangle fallback, and managed result return.
- The roster expansion's first integration run exposed a Confluence specialist falling back to generic compatibility. Specialists now inherit the best compatible pairing from their parent families, and the original HTTP assertion passes unchanged.
- The director's cut first UI check could not use a separately launched localhost process in the tool network boundary. The smoke was moved into one Node process with the real HTTP server rather than weakening it to static HTML inspection; the full client boot and actions passed.

## Final test status

- Automated failures: **0**
- UI DOM boot/action smoke: **PASS**
- Rendered visual passes: **0**
- Rendered visual tests: **UNRUN**
- Honest build label: **ALPHA CANDIDATE / WORKING**
