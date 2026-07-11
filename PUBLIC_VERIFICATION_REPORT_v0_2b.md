# AXM Workshop v0.2b verification report

Generated: 2026-07-11

## Build

- Edition: **PUBLIC-SAFE**
- Root: `AXM_WORKSHOP/`
- Fix: one-click direct Hub startup
- Lifecycle: **EXPERIMENTAL · NOT CANON**

## Verified in the build environment

- ZIP integrity: **PASS**
- Node syntax for `server.js`: **PASS**
- JSON parse scan: **PASS**
- JavaScript syntax scan: **PASS**
- Workshop verifier: **PASS**
- Hub selftest: **PASS**
- Route selftest: **PASS**
- Graft selftest: **PASS**
- Skin selftest: **PASS**
- Agent Tool Forge selftest: **PASS**
- Evidence Desk selftest: **PASS**
- Library route `/`: **HTTP 200**
- Hub route `/hub`: **HTTP 200**
- Hub route `/hub/`: **HTTP 200**
- Hub route `/hub/index.html`: **HTTP 200**
- API health: **HTTP 200**
- API tools: **HTTP 200**
- Busy-port fallback: **PASS**; server selected the next free local port

## Windows boundary

The startup logic is now one-click and does not require a manual URL or patch application. The Node/server path was executed and verified here. The final Windows double-click confirmation remains a platform test on Mike Tobi's machine.
