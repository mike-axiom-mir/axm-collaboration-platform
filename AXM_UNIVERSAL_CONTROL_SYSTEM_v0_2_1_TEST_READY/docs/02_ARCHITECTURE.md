# 2. Proposed architecture

## Flow

```text
RAW DEVICE
  ↓
DEVICE ADAPTER
  ↓
SEMANTIC ACTION FRAME
  ↓
ACTION REGISTRY + NORMALIZATION
  ↓
VISIBLE INPUT CONTEXT
  ↓
ACTION BUS / SOURCE ARBITRATION
  ↓
GAME CONTROL PROFILE
  ↓
GAME BEHAVIOR
```

A game reads:

```js
const move = controls.get('MOVE');
const aim = controls.get('AIM');
const interact = controls.isPressed('INTERACT');
```

It does not read:

```js
event.key === 'e'
gamepad.buttons[2]
touch.clientX
```

## Modules

- `ActionRegistry`: validates and stores action definitions.
- `ActionBus`: combines device sources without letting games know which device produced them.
- `InputContextStack`: makes control contexts visible and remaps actions at the boundary.
- `KeyboardMouseAdapter`: raw keyboard input to semantic actions.
- `GamepadAdapter`: browser Gamepad API to semantic actions.
- `PhoneController`: twin-stick and button UI to semantic state.
- `ReconnectingJsonSocket`: local network transport with reconnect.
- `NetworkControllerAdapter`: incoming phone frames to the action bus.
- `SettingsStore`: global, device, and game scopes.
- `InputMetrics`: RTT, sequence gaps, sample rate, server transit, reconnects.
- `Game Control Profiles`: declare required actions and preferred layouts.

## Source arbitration

Multiple devices can be connected. Digital actions combine safely: one active source keeps the action active. Analog actions use priority, then magnitude, then recency. A game can therefore accept phone, keyboard, and gamepad without directly branching on device type.

## Context safety

A context requires a visible label. Example:

```text
Gameplay
Aiming
Driving
Menu controls
Dialogue
```

A context may remap `MOVE` to `NAVIGATE`, but the UI must display the current context. Context changes should occur at explicit game transitions, not silently because the player happens to stand near an object.

## Protocol

Semantic phone frame:

```json
{
  "protocol": "axm-input/0.1",
  "type": "input_frame",
  "deviceId": "persistent-local-id",
  "playerId": "p1",
  "sequence": 42,
  "clientSentAt": 1785900000000,
  "context": "gameplay",
  "fullState": true,
  "actions": [
    {"id": "MOVE", "value": {"x": 0.45, "y": -0.2}},
    {"id": "AIM", "value": {"x": 0.9, "y": 0.1}},
    {"id": "PRIMARY_ACTION", "value": 0}
  ]
}
```

The frame carries intent, not game state.
