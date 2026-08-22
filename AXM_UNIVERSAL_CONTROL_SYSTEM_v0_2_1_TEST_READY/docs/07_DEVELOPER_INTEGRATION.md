# 7. Developer integration guide

## Minimal integration with `ControlRuntime`

```js
import { ControlRuntime } from '../src/core/control-runtime.js';
import { KeyboardMouseAdapter } from '../src/adapters/keyboard-mouse-adapter.js';
import { GamepadAdapter } from '../src/adapters/gamepad-adapter.js';

const runtime = new ControlRuntime({
  actionsDocument: coreActions,
  profile,
  initialContext: 'gameplay'
});

runtime.addAdapter(new KeyboardMouseAdapter(runtime.bus));
runtime.addAdapter(new GamepadAdapter(runtime.bus, {
  controllerLayout: profile.controllerLayout
}));
runtime.start();
```

Game loop:

```js
const move = runtime.get('MOVE');
player.x += move.x * speed * delta;
player.y += move.y * speed * delta;

if (runtime.isPressed('PRIMARY_ACTION')) {
  usePrimaryAction();
}

runtime.tick(performance.now());
```

Visible context change:

```js
runtime.setContext('menu');
```

Cleanup:

```js
runtime.destroy();
```

The `controllerLayout` is the physical-device boundary. A profile may use standard names such as `leftStick`, `rightStick`, `south`, `rightTrigger`, `menu`, and `dpad`; the game still reads only semantic actions. A release gesture is also available for aim-stick combat:

```js
controllerLayout: {
  MOVE: 'leftStick',
  AIM: 'rightStick',
  PRIMARY_ACTION: [
    'rightTrigger',
    { control: 'rightStick', gesture: 'release', threshold: 0.55 }
  ]
}
```

## Five integration steps

1. Declare required and optional semantic actions.
2. Choose or create a validated control profile.
3. Bind game behavior only to semantic actions.
4. Attach supported device adapters.
5. Test every device, context, disconnect path, and required-action coverage.

## Rules

- Game behavior must not inspect raw keys, touch coordinates, Gamepad API buttons, WebSocket packets, or controller brand.
- Device-specific logic belongs in adapters.
- Context changes must use the context system so held actions transfer and release safely.
- Phone support must pass required-action coverage validation.
- Network input must pass host validation before reaching the runtime.
