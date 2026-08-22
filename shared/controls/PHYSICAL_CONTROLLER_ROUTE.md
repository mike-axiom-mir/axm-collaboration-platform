# AXM Shared Physical Controller Route

Status: **DEFAULT POLICY ADOPTED - MIGRATION IN PROGRESS**  
Default: **Universal Xbox/Brawl gamepad for party co-op on one shared screen; keyboard and phone remain fallbacks where declared**

The Game Hub now applies `axm-universal-xbox-brawl-v0.2.1` as an inherited
platform requirement for qualifying shared-screen co-op games. Bloomvale and
Relaybound are integrated. Older qualifying games remain launchable but show a
visible `MAPPING NEEDED` status until their semantic action mapping is migrated.
This is a default policy and migration gate, not a false claim that every game
already consumes the adapter.

## Core decision

A gamepad is an input source, not a new controller identity.

```text
controllerType: human
inputSource: host-gamepad
```

The existing controller identities remain:

- `human` - a person using any supported input source;
- `adapter` - an explicitly connected external AI using the same semantic gate;
- `ai` - an optional game-local Host AI that cannot use the external gate.

Adding `gamepad` to `controllerType` would be incorrect because the host uses
that field to decide where authority belongs. Changing hardware must never
change the player's identity, party, progression, token, or permissions.

## Planned route

```text
USB / Bluetooth / receiver gamepad
  -> host-only AXM Gamepad Source Adapter
  -> AxmControllerRuntime generic vectors, buttons and pulses
  -> axm-semantic-input-v1 packet
  -> existing seat token and sequence gate
  -> authoritative game host
```

USB and Bluetooth require different operating-system setup, but no separate
gameplay protocol. Once a browser exposes normalized gamepad state, the adapter
must translate it into the same generic channels.

## Two profile layers

1. A **device binding profile** maps physical axes, buttons and triggers to
   generic controller channels. Its draft contract is
   `schemas/input-source-binding.schema.json`.
2. A **game semantic profile** maps those generic channels to the intentions a
   particular game accepts. Existing controller profiles continue to own this.

This keeps Xbox, PlayStation, accessibility and generic USB layouts out of
individual game code.

## Seat claiming

The first host version must not assume gamepad index 0 is Player 1. A local
Controller Dock should ask the player to press any button, then explicitly bind
that detected device to an available human seat for the current session.
Bindings are session-scoped until real hardware evidence justifies something
more durable. Claiming must happen only while a visible Controller Dock claim
window is armed, use a new button press rather than a continuously held button,
and require confirmation before replacing an already active input source.

## Exclusive input-source lease

A seat token identifies the seat, but it cannot distinguish two legitimate
hands that know the same token. Before mixed inputs are enabled, each human seat
therefore needs exactly one active input-source lease:

- an opaque, session-local `inputSourceBindingId`;
- a monotonically increasing `inputSourceEpoch`;
- the declared source kind, such as `phone-touch` or `host-gamepad`;
- host rejection of packets from a previous binding or epoch;
- neutralize and revoke the old source before activating the new one.

Switching sources may safely restart the packet sequence only after the epoch
changes. The host must never persist or expose a browser's raw gamepad device
identifier in party state, profiles, logs, or receipts. Raw identifiers can
contain vendor or product details and are not reliable player identity.

Only a `standard` browser mapping may receive a default binding. A missing or
non-standard mapping must pause for explicit calibration/remapping.

For qualifying shared-screen co-op games, the party screen may be the local
gameplay surface and poll explicitly assigned gamepads. Outside that case,
gamepad polling belongs only in:

- the host-only Controller Dock;
- an individual player's controller page; or
- a future optional native local controller service.

## Profile-specific behaviour

Touch and gamepad profiles may use different physical gestures while producing
the same semantic intention. For example:

```text
phone right-stick release -> fire pulse
gamepad right trigger press -> fire pulse
gamepad right-stick release -> no action
```

## Disconnect contract

On disconnect, blur, pause, reassignment, or session end the input source must:

1. immediately neutralize vectors and release held buttons;
2. mark the input source disconnected;
3. preserve the human seat for reconnection;
4. never silently transfer control to Host AI or an adapter;
5. allow the player to return to phone control.

Neutralization means sending a semantic zero/released packet through the normal
gate immediately. Clearing only the local controller object is insufficient.

Connected AI is not an item in a human input-source selector. Moving a seat
between `human` and `adapter` changes controller authority and remains a
separate explicit-consent operation.

## Phases and proof gates

### Phase 1 - Host-connected standard gamepads (partially implemented)

- USB, Bluetooth or manufacturer receiver connected to the host;
- Controller Dock discovery and press-to-claim assignment;
- one human seat using `host-gamepad` through `AxmControllerRuntime`;
- disconnect neutralization and return-to-phone proof.

### Phase 2 - Mixed local parties

- remapping, calibration and dead-zone controls;
- mixed phone, keyboard and gamepad seats;
- four and then eight simultaneous device proof;
- reconnect, fullscreen, focus and long-session evidence.

### Phase 3 - Player-device gamepads

- controller paired to an individual phone or tablet;
- existing QR join, seat token and network path retained;
- real Android and iOS browser tests before any compatibility claim.

### Phase 4 - Optional uncommon-device bridge

- explicit-consent native or WebHID fallback for unsupported devices;
- device-specific code isolated from the semantic and authority layers;
- never required for ordinary standard gamepads.

## Honest current boundary

The reusable adapter and the Bloomvale/Relaybound software paths exist, and the
Hub now publishes the inherited default plus migration status. Broad USB,
Bluetooth, receiver, accessibility-controller, mixed-party, reconnect,
fullscreen, background, four-device, and eight-device hardware proof is still
missing. Games marked `MAPPING NEEDED` do not yet have runtime capability.
