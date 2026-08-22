# Living Globe Tycoon disconnect-boundary receipt

Date: 2026-08-16  
Status: `TEST`  
Classification: `disconnect_recovery: not-applicable` for in-session gameplay transport  
Scope: slot 010 production package, with a live 1280x720 walkable-route outage countercheck  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

Slot 010 has no in-session controller, room, SSE, WebSocket, or gameplay API
transport to disconnect and reconnect. Its managed server owns local launch
metadata and static file delivery only; the walkable world, rules lab, saves,
missions, ecology, economy, and same-browser AI seat execute inside the browser.
The manifest therefore records disconnect recovery as `not-applicable`, not as
an untested network promise.

The harder countercheck also passed. With the isolated production server
stopped and port 18961 confirmed to have zero listeners, the already-loaded
walkable world kept running. Restarting the same server and reloading the same
isolated browser origin visibly restored the saved world and active mission.
This proves a bounded static-delivery outage/reload journey; it does not invent
or imply a network gameplay transport.

## Claim routing

| Atomic claim | Native proof surface | Result |
| --- | --- | --- |
| No first-party in-session gameplay transport exists | Recursive first-party source inspection, parsed manifest and launcher-state response | Pass |
| Managed server owns launch/static delivery only | Executed production server, launcher-state authority packet and route responses | Pass |
| A loaded world is independent of a later server outage | Zero-listener process check plus repeated browser DOM and pixel observations | Pass |
| Same-port restart restores production delivery | Deterministic stop/restart test with byte-identical entry response | Pass |
| Same-origin reload restores browser-local world state | Browser reload and visible continue/journal/world state; storage was not inspected | Pass |
| Exact animation cadence or network-loss latency | Requires rolling frame/transport telemetry | Not claimed |

## Static and executable boundary evidence

- `max_players: 1`, only the human seat is advertised, and QR, LAN link, room
  code, and phone-controller delivery are all disabled.
- `/api/launcher-state` returns an empty `controllerLinks` array and declares
  `session: managed-server`, `world: browser-local-game-package`.
- Recursive first-party `.html`/`.js` inspection (excluding the preserved
  vendor and source-copy directories) found no WebSocket, EventSource,
  XMLHttpRequest, `sendBeacon`, or `fetch()` gameplay transport.
- The preserved Three.js vendor contains generic loaders capable of `fetch`,
  but slot 010 first-party code does not create a live gameplay channel with
  them.
- The walkable route declares browser-local save, five-second autosave,
  `pagehide` save, restore, and visible `continue · world age ...` handling.
- `tests/disconnect-recovery.test.js` starts the production server on an
  ephemeral port, checks its launcher authority, stops it, observes transport
  failure, restarts on the same port, and verifies byte-identical production
  entry delivery.

The test's first run failed because its outage assertion accepted only a
narrow list of socket error messages. Windows returned a different transport
error even though the request was rejected. The assertion was corrected to
accept any rejected request while the server is stopped; the product and
server code were not changed.

## Native browser outage and recovery

Visual backend: `BROWSER_PRIMARY`  
Route: `http://127.0.0.1:18961/games/010/`  
Viewport: 1280x720 desktop Chromium  
Origin: isolated for this verification; browser storage was exercised only
through production UI and lifecycle behavior and was never inspected directly.

Screenshots were inspected live and released after verification. This receipt
retains their SHA-256 identities rather than the pixel files.

| State | Screenshot SHA-256 | Typed observation |
| --- | --- | --- |
| Fresh entry | `338fdb44c5c32909182fa018e219ad922b77fb7e892bff6877800c94cadf0b06` | Entry dialog visible; ledger age `0`; entry control focused. |
| Live before outage | `5582830336c92d78da528c37afd3a0641ef9cbddd6af7f95a678a372ff6ded39` | World age `16`, trees `21`, day; Presidential Inspection Tour at `0/60`, `5:54` left. |
| Live with server stopped | `ab3d0399d3907a574c888a02d8aeecf730767da35a8a8ace07c7b4d0d65d2719` | Port had zero listeners; world reached age `42`, trees `27`; same mission at `0/60`, `5:26` left. |
| Entry after server restart and reload | `02b025c36fcb19e0ab6e11e501e136021a43d09d3a817c96de2849bdb0532667` | Focused control read `continue · world age 74`; journal read `the world kept turning — age 74`; same mission remained active. |
| Resumed world | `acfe2784ba9200d53b1bb151a1c5e663026ece8fc60553525b2f58b176678d58` | World resumed at age `84`, trees `31`, dusk; same mission at `0/60`, `4:55` left. |

The changing ages, tree counts, daylight, and mission timer are intentionally
reported rather than normalized away. They show the browser-local simulation
continued. No strategic action, mission contribution, treasury action, or AI
connector action was issued during the journey.

## Capability gate and cleanup

The capability comparator returned `DEGRADED`:

- Required live-outage continuity: ready through screenshots, DOM inspection,
  and an isolated server stop/start.
- Required restart/reload persistence: ready through browser reload and the
  isolated server stop/start.
- Optional animation cadence: unavailable because no
  `visual.capture.ephemeral-rolling-buffer/v1` capability is exposed.

Accordingly, no exact frame cadence, smoothness, request latency, or dropped-
frame claim is made. The exact comparator directory under the Windows temp
root was validated, deleted, and confirmed absent. The browser tab was closed,
screenshot buffers were released, the restarted server was stopped, and port
18961 had zero listeners.

## Focused verification

- `node tests/disconnect-recovery.test.js`: pass after the matcher correction
- `node tests/hub-wrapper-selftest.js`: pass
- Living Globe honest exam: `103 PASS`, `0 FAIL`
- Existing blocking-overlay Escape contract: pass
- Native browser outage, restart, reload, and resume journey: pass within the
  scope above

The post-seal game-library verifier reported `0 failure(s) · 18 warning(s) ·
19 game folder(s) checked`, with no warning for slot 010. The library moved
from 20 to 18 warnings during this interval; this lane claims one closure, and
the concurrent slot 011 disconnect change is not attributed here.

All ten required Workshop checks exited successfully after the manifest and
receipt were added:

- `node verify.js` (`0 FAIL`, 18 extant warnings)
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js` (`VERIFIED_WITH_LIMITS`)
- `node tests/html-script-syntax-test.js` (`55 PASS`, `0 FAIL`)
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` (`17 PASS`, `0 FAIL`)
- `node tools/evidence-desk/selftest.js` (`36 PASS`, `0 FAIL`)

Passing tests do not canonize this boundary.

## Source boundaries

The slot 010 package and Workshop were already heavily modified. Foreign work
was not reset, reformatted, or claimed. Production runtime and game code were
read as evidence but not changed in this lane.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `runtime/server.js` | `362aeac06f0a7b563e15f87168ee3b3caf24207ed2fcf0433a2cb15d4f0c0451` | unchanged |
| `runtime/game/index.html` | `0c7444c065e2021d14763da6dbdde22a369112b5c733bd5b2c4d95b79d9fc1ec` | unchanged |
| `KNOWN_LIMITS.md` | `bd6df62729412f4571bf7f773a69cfeb818a5e764c484d2483ae62d1de5f0cfa` | unchanged |
| `game.manifest.json` | `add914c9e841d91832e71a34fc8e15496ccd0d2cb5d764bdbfc28b46b4e3f14e` | updated only with the classification and evidence paths |
| `tests/disconnect-recovery.test.js` | absent | `933947d8bd2dbe7b33e4e7ffb59f09b74b229228eaae4f20e4d3b2f996fe89e6` |

## Still unrun / not claimed

- External AI adapter transport, which Game Hub does not expose for this slot
- Physical network interruption, controller/phone reconnect, multi-device,
  LAN, QR, and room recovery, none of which this integration advertises
- Cross-browser, cross-origin, cross-machine, cleared-storage, disabled-storage,
  or private-window save roaming
- Browser/OS matrix, process crash during a write, and power-loss recovery
- Live outage testing on the separate rules-lab route; the static no-transport
  inspection covers its first-party source
- Exact frame cadence, sustained performance, GPU/thermal behavior, and
  long-run soak behavior

This is a bounded `TEST` classification, not network certification, Steam
acceptance, or canonization.
