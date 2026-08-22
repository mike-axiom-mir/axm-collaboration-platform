# 11. Exact files and modules created

## Core

- `src/core/action-registry.js`
- `src/core/action-bus.js`
- `src/core/context-stack.js`
- `src/core/normalization.js`
- `src/core/metrics.js`
- `src/core/profile.js`

## Device adapters

- `src/adapters/keyboard-mouse-adapter.js`
- `src/adapters/gamepad-adapter.js`
- `src/adapters/network-controller-adapter.js`

## Phone UI

- `src/ui/virtual-stick.js`
- `src/ui/layout-editor.js`
- `src/ui/phone-controller.js`
- `src/ui/phone-controller.css`

## Network and persistence

- `src/network/protocol.js`
- `src/network/reconnecting-websocket.js`
- `src/persistence/settings-store.js`
- `server/websocket-lite.cjs`
- `server/reference-server.cjs`

## Schemas and profiles

- `schemas/action-schema.json`
- `schemas/game-control-profile.schema.json`
- `schemas/settings.schema.json`
- `profiles/core-actions.json`
- `profiles/reference-twin-stick.profile.json`
- `profiles/robo-pong.profile.json`
- `profiles/scenarios/*.profile.json`

## Working reference

- `demo/host.html`
- `demo/host.js`
- `demo/phone.html`
- `demo/phone.js`
- `demo/shared-ui.css`

## Robo Pong migration

- `migrations/robo-pong/legacy-robo-pong-bridge.cjs`
- `migrations/robo-pong/robo-pong-semantic-phone.html`
- `migrations/robo-pong/neon-pong-duet-server.patch`
- `migrations/robo-pong/MIGRATION_NOTES.md`

## Tests and launchers

- `tests/*.test.js`
- `tests/robo-pong-bridge.test.cjs`
- `tools/START_REFERENCE_WINDOWS.cmd`
- `tools/RUN_TESTS_WINDOWS.cmd`
- `tools/start-reference.sh`
- `tools/run-tests.sh`
