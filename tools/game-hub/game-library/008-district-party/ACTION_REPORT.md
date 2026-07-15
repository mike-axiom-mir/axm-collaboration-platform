# ACTION REPORT

Build name: AXM District Party  
Version: 0.1.7-local-prototype  
Date: 2026-07-14  
Local build path: `/workspace/scratch/baf602bc61cd/AXM_DISTRICT_PARTY_LOCAL_v0_1`  
ZIP path: `/workspace/scratch/baf602bc61cd/AXM_DISTRICT_PARTY_LOCAL_v0_1_7_COMPLETE.zip`

## SOURCE USED

Repository: `mike-axiom-mir/axm-collaboration-platform`  
PR: 13 — Stage consolidated AXM workspaces for next milestone  
PR head SHA: `33a87549259d8b4a7ce4753ee1fab49e0ee8091d`  
Source use: exact-SHA, read-only direction only  
Files inspected: all ten originally requested paths plus supporting QR runtime; see `docs/PR13_SOURCE_TRACE.md`.

This update builds on v0.1.6. The prior v0.1.5 and v0.1.6 ZIPs remain separate and were not overwritten.

## FILES CREATED

- `server/seat-observation.js` — token-bound semantic party-screen projection for Foundation adapter seats.
- `tests/adapter-control.test.js` — adapter binding, shared input gate, Host AI separation, observation filtering and token tests.
- `docs/AI_NATIVE_SEAT_CONTRACT.md` — integration contract for connected AI and reusable semantic controls.

## FILES MODIFIED

Local project only:

- Launcher readiness defaults, flexible team validation, optional Host AI fill and distinct Human/Foundation AI/Host AI join cards.
- Session roster preparation, ready filtering, asymmetric-party validation and opt-in empty-seat filling.
- Launch contract, adapter bindings, input routing, disconnect handling and controller metrics.
- Built-in AI dispatch so only controller type `ai` enters the Host AI state machine; `adapter` remains externally controlled.
- Adapter observation HTTP route and live server smoke coverage.
- Static-world active player count, machine-readable controller/Foundation contracts, manifests and documentation.
- Territory simulations for exact sparse 1v1, asymmetric 2v3 and full-capacity 4v4.

No GitHub working tree was used as the active build directory.

## GITHUB WRITE CHECK

Branch created: **NO**  
Commit created: **NO**  
Push performed: **NO**  
PR changed: **NO**  
Repository working tree altered: **NO — this update stayed inside the separate local project and made no GitHub mutation call**  
Local project Git metadata: **NONE — the project is not a Git working tree**

This statement covers actions performed by this build only; it does not claim control over unrelated external activity.

## ASSETS

Downloaded: **UNCHANGED — official Kenney archives retained from the initial build.**  
Selected: **UNCHANGED — 25 curated RPG Urban files; 10 currently referenced by the renderer.**  
Transformed: **UNCHANGED — prior documented composites/transforms retained.**  
Licenses preserved: **PASS — source ZIPs, included licenses, official URLs and SHA-256 records remain.**  
New v0.1.7 third-party art: **NONE.**

## IMPLEMENTED

- District Dominion now activates only selected ready records. Capacity remains eight, but population is not forced to eight.
- Party A and Party B each accept one through four seats; unequal 1v2, 2v3, 4v1 and other valid combinations are allowed.
- A competitive roster with only one represented party is rejected clearly instead of starting a broken match.
- Local fallback default is P1 versus P5 with no substitute actors.
- **Fill unused seats with Host AI** exists as one explicit setting and defaults OFF. When enabled, only then are remaining slots created as built-in Host AI.
- `human`, `adapter` and `ai` remain distinct identities:
  - `human` receives a named controller URL/QR;
  - `adapter` receives a non-QR semantic binding for the connected Workshop AI;
  - `ai` runs the optional built-in host state machine.
- Human and adapter intentions use the same `/api/input` room/session/seat/token/sequence/sanitation path.
- Adapter actors are excluded from the Host AI loop and can time out/disconnect like human controllers.
- `/api/adapter-observation` requires the adapter seat token and exposes only its party-screen information budget: own/ally HUD, public match indicators, current party-camera target and in-bounds entities/map features.
- Off-screen opponents, input buffers, AI routes, cooldown internals and host random state are omitted from adapter observations.
- Existing five-zone capture, group funds, crews, cars, passenger shooting, combat, inventory, co-op missions and two party displays continue to work with sparse rosters.

## PARTIAL

- **FOUNDATION INTEGRATION: PARTIAL** — the selected-ready roster and adapter child-runtime contract are implemented, but the real Workshop has not launched this package.
- **AI SCREEN PARITY: PARTIAL** — semantic observation follows the party camera's current target and information budget. It is not a video frame, and a human display may be midway through a brief camera smoothing transition.
- **ASYMMETRIC BALANCE: PARTIAL** — 1v1 and 2v3 simulations pass, but score/capture/crew values have not been balanced by humans for every team ratio.
- **BROWSER PRESENTATION: UNRUN** — Playwright is present but its Chromium executable is unavailable.
- **PHYSICAL MULTIPLAYER: UNTESTED** — physical phones, two laptops and long LAN sessions were unavailable.

## NOT IMPLEMENTED

- Real Workshop delivery of an adapter binding to a local/cloud AI.
- Pixel/video streaming to AI; the implemented contract is a bounded semantic screen observation.
- Saved player profiles, persistent rival territory, public matchmaking, cloud state, accounts or telemetry.
- Automatic skill balancing or compensation for unequal party sizes.
- Advanced Host AI formations, player pings, selected crew destinations or crew vehicle use.

## TESTS

PASS: **127/127 automated unit/integration tests.**  
PASS: **exact sparse 1v1 roster and simulation without substitute actors.**  
PASS: **asymmetric 2v3 roster and simulation without substitute actors.**  
PASS: **optional full eight-Host-AI match simulation.**  
PASS: **adapter same-gate input, Host AI exclusion, token binding and off-screen filtering.**  
PASS: **live HTTP smoke uses a five-seat 2v3 session with human, adapter and Host AI identities.**  
PASS: **live CLI lifecycle, syntax, asset and clean-package checks.**  
UNRUN: **automated browser smoke — Chromium executable unavailable.**  
UNTESTED: **physical QR phones, two physical displays, Windows/firewall flow, real Workshop launch and measured LAN stress.**

Full executed commands and package audits are in `TEST_REPORT.md`.

## KNOWN RISKS

- A LAN user can manually open local party display routes; the Workshop integration must hand an adapter only its bounded binding rather than the host token or in-process world object.
- Unequal teams are intentionally allowed and may be unfair; that is a host choice until later balancing options exist.
- HTTP polling with eight external controllers and two displays has not been bandwidth-stressed on target hardware.
- Adapter observation uses semantic data, so a connected AI still needs its own reasoning loop and must send intentions frequently enough to avoid timeout.
- All seats, scores, funds and territory remain memory-only.

## NEXT SAFEST STEP

In the real local Workshop, launch a 1v1 selected-ready roster first: one human and one connected adapter AI, with Host AI fill left OFF. Confirm the adapter receives only its binding, moves through `/api/input`, loses off-screen opponents from observation and cannot control another seat. Then test 2v3 with mixed humans/adapters before enabling optional Host AI or attempting eight physical devices.
