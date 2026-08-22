# 13. Device adapter specification

Every adapter is a boundary translator. It may understand raw device details; the game may not.

## Required adapter contract

An adapter must:

- have a stable `sourceId`;
- emit only registered semantic action IDs;
- normalize analog values to the action's declared range;
- apply dead zones before emission or declare that the action bus will do so;
- release all active state when stopped, disconnected, hidden, or blurred;
- identify its device type in metadata;
- avoid inventing game state;
- never assign itself to another player silently;
- expose calibration and diagnostic information where relevant.

Example emission:

```js
controls.setSourceAction('phone:device-42', 'MOVE', { x: 0.4, y: -0.2 }, {
  deviceType: 'phone',
  priority: 5,
  timestamp: Date.now()
});
```

## Keyboard and mouse

- Key codes map to actions in the adapter.
- Multiple keys may form one `axis2` value.
- Blur releases all keys.
- Mouse deltas should be accumulated per frame and then cleared.

## Standard/gamepad

- Use the browser's standard mapping when available.
- Left stick normally maps to `MOVE`; right stick to `AIM` or `LOOK` according to the profile.
- Triggers remain analog where the game supports it.
- Disconnect releases the source.
- Non-standard pads require a calibration/binding profile rather than guessed button numbers.

## Phone touch

- Pointer IDs must keep simultaneous touches separate.
- Pointer cancel and lost capture must neutralize the affected control.
- Stick values are normalized before transport.
- Full-state frames are periodically resent so a lost release packet cannot leave stuck input.
- UI layout and sensitivity belong to persisted device/game settings.

## Future accessibility and unusual devices

A future adapter may emit the same actions from:

- switch access;
- eye tracking;
- voice commands;
- sip-and-puff controls;
- motion tracking;
- custom AXM physical interfaces.

Adding the adapter must not require changes to game behavior when the required semantic actions already exist.
