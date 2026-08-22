# AXM Action Report — Universal Control System v0.2.1 Test-Ready

## Preserved

- Existing local-first and host-authoritative browser/phone direction.
- Current Robo Pong left/right/power controls and rollback path.
- No-npm, simple local Node-server route.
- Keyboard fallback.
- Phone access as a first-class input path.
- v0.1 local settings key so previous layouts can migrate rather than disappear.

## Strengthened in v0.2

- Held input now transfers safely across visible context changes; the previous action is released instead of becoming stuck.
- Added deterministic tap, double-tap, hold, toggle, and repeat behavior handling.
- Added `ControlRuntime`, a single developer-facing integration surface.
- Keyboard and gamepad adapters now batch a complete semantic frame per update.
- Phone UI is driven by each game profile and hides unused controls.
- Users can remap compatible sticks and buttons; required-action coverage is checked visibly.
- Added explicit one-handed left/right layouts with a visible MOVE/AIM stick-role switch.
- Added profile, action-registry, settings, and network-frame validation.
- Server rejects duplicate, oversized, non-finite, malformed, or unknown semantic actions.
- Reconnection uses a private resume token and preserves the controller's previous player seat.
- A stale-controller watchdog neutralizes input and disconnects dead sessions safely.
- WebSocket parsing is bounded and invalid frames close safely instead of crashing the host.
- Performance probe records measurable evidence and lists what it cannot prove.
- Network test harness now buffers messages so fast safety events cannot be lost between listeners.

## Strengthened for the Saturday live test

- Reconnect queues coalesce full-state frames, retaining the newest state instead of replaying stale held movement.
- Added client heartbeat timeout, open timeout, bounded reconnect backoff, and explicit wake handling.
- Added phone lifecycle recovery for visibility, page return, online, and offline transitions.
- Added a real five-second stall simulator that exercises the server watchdog rather than faking a success screen.
- Added host diagnostics and downloadable live-test evidence.
- Added a one-page two-person Saturday test card and one-click Windows test launcher.

## Proof completed

- Static package validation passes.
- JavaScript/CommonJS syntax and all JSON files validate.
- 32 automated tests pass, including a live deliberate-stall and same-seat-resume test.
- Three consecutive full `npm run verify` runs passed after repairing the network-test race.
- Live local server tests prove pairing, semantic forwarding, poison-frame rejection, same-seat resume, disconnect release, and stale-timeout release.

## Not claimed

- No phone-to-PC latency number is claimed until measured on Mike's actual LAN and devices.
- QR pairing is designed but not yet rendered; six-digit local pairing works.
- Scenario profiles prove architectural fit, not eight migrated production games.
- Battery snapshots do not prove the controller caused a battery change.
- Browser visual runtime was blocked by the build environment's localhost policy and is not marked passed.
- The AXM Game Hub repository has not been silently modified.
