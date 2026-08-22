# Xbox/Brawl controller trial

This patch turns the existing browser gamepad support into a profile-driven physical-controller layer. A game may run with an Xbox-style controller and no phone UI while keeping phone, keyboard, accessibility, and future devices on the same semantic action bus.

## Reference mapping

| Physical control | Semantic action | Trial behavior |
|---|---|---|
| Left stick | `MOVE` | Move the player |
| Right stick | `AIM` | Aim continuously |
| Release right stick after aiming | `PRIMARY_ACTION` | One Brawl-style fire pulse |
| Right trigger | `PRIMARY_ACTION` | Fire; hold for the demo's repeat behavior |
| Left bumper | `SECONDARY_ACTION` | Super pulse |
| A / south | `DODGE` | Dash; confirm in menus |
| X / west | `INTERACT` | Interact |
| Y / north | `USE_ITEM` | Gadget/item |
| Menu | `OPEN_MENU` | Enter or leave the menu context |
| D-pad | `NAVIGATE` | Menu navigation |
| B / east | `CANCEL` | Menu cancel |

The names follow the browser's standard gamepad mapping, so they are position-based and work for standard-mapped Xbox-style and compatible controllers. A browser-reported non-standard controller is rejected unless a developer explicitly opts into a calibrated mapping; this prevents silently guessing dangerous button numbers.

## Deeper-layer contract

Games declare device bindings in `profile.controllerLayout`, attach the `GamepadAdapter` with that layout, and consume only semantic actions from `ControlRuntime`. The adapter owns raw axes, buttons, dead zones, triggers, D-pad composition, disconnect release, and input gestures.

```js
const gamepad = new GamepadAdapter(runtime.bus, {
  controllerLayout: profile.controllerLayout,
  onStatus: status => showControllerStatus(status)
});
runtime.addAdapter(gamepad).start();
```

Use one adapter per local seat by assigning a distinct `index` and `sourceId`.

## Five-minute game-test card

1. Plug in or pair the controller and press a button so the browser exposes it.
2. Start `tools\START_REFERENCE_WINDOWS.cmd` and open the printed host URL.
3. Confirm the controller status reads `ready`; an explicit unsupported message is a fail, not a hidden fallback.
4. Move with LS while aiming with RS. Release RS after a deliberate aim and confirm exactly one cyan pulse appears.
5. Hold RT and confirm repeated cyan pulses. Press LB and confirm a larger gold super pulse.
6. Press Menu. Confirm gameplay movement stops affecting the player and LS/D-pad are available as `NAVIGATE`; A is `CONFIRM`, B is `CANCEL`.
7. Disconnect the controller while holding a direction. Confirm movement neutralizes rather than sticking.

## Honest limits

Automated tests prove binding translation, D-pad output, trigger coercion, a one-frame release-to-fire pulse, unsupported-device rejection, and package regressions. The browser surface can prove the demo renders and keyboard interaction works. Only the live test with the actual controller can prove that controller's browser mapping, wireless behavior, ergonomics, and real-device latency.
