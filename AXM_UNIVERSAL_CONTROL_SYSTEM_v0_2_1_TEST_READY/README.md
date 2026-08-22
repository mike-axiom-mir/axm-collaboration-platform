# AXM Universal Control System v0.2.1 — Xbox/Brawl Test Patch

Status: **WORKING REFERENCE BUILD / MIGRATION FOUNDATION / NOT YET UNIVERSAL**

This package provides one shared semantic action layer for phone touch controls, keyboard and mouse, Xbox-style and generic gamepads, handheld controls exposed through the browser Gamepad API, and future accessibility or unusual AXM input adapters.

It deliberately does **not** replace the existing Robo Pong controls. The legacy `left` / `right` / `power` route remains preserved through a compatibility bridge and optional patch. The connected AXM Game Hub repository was inspected but not modified.

## What works

- Games consume semantic actions such as `MOVE`, `AIM`, `PRIMARY_ACTION`, `INTERACT`, and `PAUSE`, rather than device-specific keys or touch positions.
- `ControlRuntime` gives a game one integration surface for actions, contexts, timing behavior, adapters, and cleanup.
- Keyboard and gamepad adapters publish complete batched action frames.
- The gamepad adapter now consumes each game's `controllerLayout`; Xbox-style names, analog triggers, D-pad navigation, and legacy numeric bindings share one validated contract.
- The reference profile includes a Brawl-style trial: move with the left stick, aim with the right stick, and fire either with RT or by releasing the right stick after aiming.
- A physical controller can play the host directly; a phone is optional rather than a required screen.
- The phone controller is profile-driven: controls can be shown, hidden, relabelled, repositioned, resized, and remapped without rebuilding its UI.
- Simple, Standard, Advanced, left-handed, and explicit one-handed control paths exist.
- Required phone actions are validated so a layout cannot silently claim support while orphaning a required action.
- Local WebSocket pairing supports player assignment, private resume tokens, genuine same-seat reconnection, malformed-frame rejection, stale-controller watchdog release, and disconnect neutralization.
- Reconnect queues retain only the newest full semantic state, preventing old held movement from replaying after a disruption.
- Phone wake/visibility/online recovery and a deliberate stall simulator make the risky path testable on real hardware.
- Host and phone diagnostics expose failure reasons and export a live-test JSON log.
- Settings preserve global, device, and game scopes and migrate v0.1 layouts without silently deleting them.
- The performance probe records evidence such as frame duration, bytes, sequence gaps, analog transformation error, controller samples, marked accidental touches, and battery snapshots without converting them into unsupported claims.
- Robo Pong semantic translation preserves the existing left/right/power behavior and edge-triggers the special action once per press.

## Saturday live test

Windows:

```text
tools\START_SATURDAY_TEST_WINDOWS.cmd
```

The host opens automatically. Use the LAN phone link printed by the server and follow `docs/16_SATURDAY_LIVE_TEST_CARD.md`. After the test, use **DOWNLOAD TEST LOG** on the host page.

## Fast Xbox/Brawl game test

1. Connect the controller before or after opening the host.
2. Run `tools\START_REFERENCE_WINDOWS.cmd`.
3. Confirm **Physical controller** changes to `ready`.
4. Try LS move, RS aim, release RS to fire, RT fire, LB super, A dash, and Menu.
5. In the menu, confirm LS or D-pad navigates, A confirms, and B cancels.

See `docs/18_XBOX_BRAWL_CONTROLLER_TRIAL.md` for the integration contract and honest test limits.

## Start the reference build

Windows:

```text
tools\START_REFERENCE_WINDOWS.cmd
```

Linux/macOS:

```text
sh tools/start-reference.sh
```

Open the host URL printed by the server. On a phone connected to the same local network, open the printed phone URL and enter the six-digit pairing code.

## Verify

```text
npm run verify
```

No `npm install` is required. The package has no runtime dependencies.

For a browser smoke check on a local computer with Chromium or Chrome available:

```text
npm run test:browser
```

The browser smoke check could not be completed inside the build environment because its Chromium policy blocks localhost pages. That check is therefore recorded as blocked, not passed.

## Merge gate

Do not call this universal yet. The package is a serious reusable reference implementation, but real AXM game migrations, hardware tests, and measured LAN performance still remain. See `docs/09_ACCEPTANCE_STATUS.md`.
