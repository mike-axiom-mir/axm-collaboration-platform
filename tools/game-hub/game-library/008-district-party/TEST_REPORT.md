# Test Report — AXM District Party v0.1.7

**Date:** 2026-07-14  
**Environment:** Linux container, Node.js v24.14.0, Europe/Amsterdam  
**Automated core:** **PASS**  
**Automated browser:** **UNRUN**  
**Physical devices/Workshop AI:** **UNTESTED**

## Executed checks

| Command/check | Actual result |
| --- | --- |
| `npm test` | **PASS — 127 tests; 127 passed; 0 failed/cancelled/skipped/todo.** |
| `node --test tests/adapter-control.test.js tests/server-smoke.test.js tests/territory-mode.test.js tests/static-runtime-contract.test.js` | **PASS — 27/27 adapter, HTTP, roster, territory and static-contract tests.** |
| `npm run test:cli` | **PASS — live child host completed health/start/token input/state/display/static-asset/wrong-room/end/clean-PID lifecycle.** |
| `npm run test:browser` | **UNRUN — Playwright exists, but Chromium is absent at `/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`; no browser download was attempted.** |
| `npm ls --offline --all` | **PASS — packaged dependency tree contains only `qrcode-generator@1.4.4`.** |
| Node VM grammar parse with `--experimental-vm-modules` | **PASS — 73 first-party JavaScript files parsed.** |
| Parse all project JSON | **PASS — 15 JSON files.** |
| `bash -n START_LOCAL_CITY.sh STOP_LOCAL_CITY.sh TEST_LOCAL_CITY.sh` | **PASS.** |
| Asset SHA-256/license audit | **PASS — 29 assertions: two official archives, two retained licenses and 25 selected runtime files.** |
| `unzip -t` on both official Kenney source archives | **PASS — no compressed-data errors.** |
| Private-LAN probe | **NOT FOUND — `privateLanAddresses()` returned `[]`; no LAN URL is claimed for this container.** |
| Git/no-write probe | **PASS — the separate project is not a Git repository; no GitHub write command was used.** |
| Candidate ZIP/member/path audit | **PASS — archive opens; 786 entries; 8/8 required release paths; zero absolute or parent-traversal paths.** |
| Fresh extracted-package `npm test` and CLI lifecycle | **PASS — 127/127 plus `CLI_LIFECYCLE_SMOKE: PASS` from a new extraction directory.** |
| Final `AXM_DISTRICT_PARTY_LOCAL_v0_1_7_COMPLETE.zip` integrity/member/path audit | **PASS — archive opens; 786 entries; zero absolute or parent-traversal paths.** |

## Capacity is not population — PASS

- The eight slot records remain structurally available, with Party A slots 1–4 and Party B slots 5–8.
- A selected P1/P5 1v1 creates exactly two actors and reports active-player count two.
- A selected 2v3 creates exactly five actors at their original sparse slot numbers.
- Records with `ready: false` do not create actors.
- A competitive session with no selected seat on one party is rejected with `INVALID_PARTY_ROSTER`/HTTP 400.
- Unequal parties are accepted as long as each has one through four ready seats.
- `hostAiFillEmptySeats` defaults false. An explicit true value fills the unused slots; no other path silently manufactures substitutes.
- Sparse all-Host-AI 1v1 and 2v3 simulations advance capture and score for 600 ticks without filling unused slots. A separate full-capacity simulation runs 900 ticks.

## Human, connected AI and Host AI separation — PASS

- `human` receives a named phone/controller link and local QR flow.
- `adapter` receives a private non-QR `adapterBinding` with semantic input endpoint, observation endpoint and reusable controller profile.
- `ai` receives neither external binding nor phone link and alone enters the built-in Host AI state machine.
- Human and adapter packets use the same room/session/seat token, increasing sequence, vector sanitation, pulse latching, timeout and host-owned actor path.
- A built-in Host AI seat rejects external packets with `seat-host-controlled`.
- Adapter movement is not overwritten by the Host AI update.

## Screen-bounded adapter observation — PASS at semantic-contract level

- The observation endpoint requires the exact adapter seat token and rejects human/Host AI seats.
- It includes own status, ally corner HUD, public mission/territory indicators, controller profile, camera target/bounds and in-bounds map/entities.
- A test places Party B outside Party A's camera and verifies that the opponent actor identifier is absent from the complete serialized response.
- Moving that opponent inside the camera makes it visible on the next observation.
- Host-only names such as `randomSeed`, `aiPath`, `nextAttackTick` and `pendingPulses` are absent.
- The observation is semantic. It does not prove pixel/video equivalence during a visual camera smoothing transition.

## Live asymmetric HTTP smoke — PASS

The live server test starts a five-actor 2v3 session:

- Party A: one human and one Foundation adapter.
- Party B: two humans and one deliberately selected Host AI.
- Human controller links: three.
- Adapter bindings: one.
- Empty slots: three, with no actors generated.
- Adapter `/api/input`: accepted.
- Token-header adapter observation: accepted and scoped `same-party-shared-screen-only`.
- Party A and Party B command-post purchases: accepted and isolated.
- Static world reports active count five and maximum capacity eight.
- One-sided competitive HTTP launch: rejected with HTTP 400.

## Retained game-system coverage — PASS

- Five-zone host capture, contest, scoring, timer, results, group income and reinforcement limits.
- Per-party friendly fire, cross-party/self/safe-zone/environment rules and server-created projectiles.
- Four-seat vehicles, passenger shooting, 50 HP, explosion/ejection, 80 occupant damage and respawn.
- Six equipment slots, 12 bag slots, auto-equip and automatic compatible reserve-ammo replacement.
- Party House health/shield regeneration and persistent co-op results break.
- Supply Sweep, Hold the Relay, Courier Chaos, Call the Heat, civilians, Neon Rivals and forgiving justice.
- Internal display routing, traversal/body-size rejection, local assets and no external runtime request literal.

## CLI lifecycle output

```text
CLI_LIFECYCLE_SMOKE: PASS
health=true
sessionPlayers=4
controllerLinks=4
inputActorId=actor-seat-1
acceptedSeq=1
actorCount=4
npcCount=11
civilianCount=8
rivalCount=3
vehicleCount=2
displayStatus=running
displayRouteIsLocal=true
assetStatus=200
wrongRoomStatus=403
endStatus=ended
CLEAN_SHUTDOWN_PID_FILE_REMOVED=true
```

The CLI lifecycle intentionally retains a four-human cooperative launch. The separate live HTTP test covers the mixed five-seat competitive path.

## Explicit non-passes

- **AUTOMATED BROWSER TEST: UNRUN** — Chromium executable unavailable.
- **REAL WORKSHOP ADAPTER AI: UNTESTED** — packets were simulated locally; no actual local/cloud AI consumed the binding.
- **PIXEL/VIDEO AI VISION: NOT IMPLEMENTED** — observation is bounded structured screen semantics.
- **PHYSICAL PHONE QR JOIN: UNTESTED**.
- **FOUR/EIGHT SIMULTANEOUS PHONES: UNTESTED**.
- **TWO PHYSICAL PARTY DISPLAYS: UNTESTED**.
- **PHYSICAL EIGHT-HUMAN/DESYNC STRESS: UNTESTED**.
- **PRIVATE-LAN REACHABILITY: UNTESTED** — no private IPv4 found.
- **WINDOWS BATCH/FIREWALL FLOW: UNTESTED**.
- **TARGET-HARDWARE FPS/BANDWIDTH/LONG-SESSION PERFORMANCE: UNTESTED**.
- **REAL AXM GAME HUB LAUNCH: UNTESTED**.
- **UNEQUAL-TEAM HUMAN BALANCE: UNTESTED**.

## Repeat locally

```sh
npm test
npm run test:cli
npm run test:browser
```

`./TEST_LOCAL_CITY.sh` runs all three on Linux/macOS. The browser command deliberately prints **UNRUN** and exits zero when its executable is unavailable, so its textual status—not exit code alone—is authoritative.
