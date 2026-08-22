# v0.2.0 change log

## Core

- Added `ControlRuntime` facade.
- Reworked `ActionBus` to retain raw source state and resolve through the active context.
- Added deterministic input behavior engine.
- Added required binding coverage and performance evidence probes.

## Adapters and UI

- Batched keyboard and gamepad updates.
- Made phone controls profile-driven.
- Added compatible control remapping and coverage warnings.
- Added explicit one-handed left/right layouts and visible stick-role switching.

## Network

- Added bounded protocol validation and registry allowlisting.
- Added private resume tokens and player-seat leases.
- Added stale-controller watchdog and neutral release.
- Hardened WebSocket frame parsing and size limits.

## Persistence

- Added v0.1-to-v0.2 migration and value clamping.
- Preserved the old storage key to avoid silent layout loss.

## Proof

- Expanded to 28 tests.
- Repaired the WebSocket test race with a buffered message inbox.
- Passed three consecutive full verification runs.
- Added static package validation and browser smoke harness.
- Browser smoke remained blocked by environment policy and is not claimed as passed.
