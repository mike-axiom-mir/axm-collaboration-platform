# 1. Current-system inspection report

Inspection date: 2026-08-05  
Repository inspected: `mike-axiom-mir/axm-local-game-hub`  
Primary target: `games/002-robo-pong/runtime/`

## Confirmed current design

The current Robo Pong path is not a useless prototype. It already contains several correct architectural roots:

- a local Node server;
- browser and phone clients;
- LAN links;
- host-authoritative game state and physics;
- keyboard fallback;
- one human phone player and an adapter/AI seat option;
- server-sent state updates;
- reconnection polling;
- a simple no-npm launch path.

The active phone client uses:

- `pointerdown`, `pointerup`, `pointercancel`, and pointer capture;
- separate left and right hold buttons;
- one power button;
- `POST /input?room=AXM1&player=p1|p2`;
- JSON `{ left, right, power }`;
- `EventSource` on `/events` for state;
- polling fallback on `/state`.

The server stores:

```text
room.inputs.p1.left
room.inputs.p1.right
room.inputs.p2.left
room.inputs.p2.right
```

and turns those booleans into a horizontal axis inside the simulation tick.

## Reusable components

1. **Host-authoritative game loop**  
   Keep it. Devices should send intent; the host should own truth.

2. **Local Node server and LAN address discovery**  
   Keep it. It matches AXM local-first access.

3. **Pointer-event handling and blur release**  
   Reuse the pattern, but move it into a shared phone adapter.

4. **Human versus adapter-controlled seat distinction**  
   Keep it and generalize controller assignment.

5. **State stream and fallback recovery**  
   Preserve during migration. The new reference transport uses WebSocket for input, while the old SSE route can remain for game state.

6. **Simple Windows launch path**  
   Preserve. The new reference build also starts from one `.cmd`.

## Current limitations

- Input names are game-specific: `left`, `right`, and `power`.
- Phone, keyboard, and future gamepad input are handled inside the game client rather than a reusable adapter layer.
- Movement is digital only, so analog precision and sensitivity are unavailable.
- No shared action definitions or game control profile.
- No per-device remapping.
- No left-handed layout or layout editor.
- No player-safe pairing code; a URL query decides `p1` or `p2`.
- No sequence numbers, dropped-frame detection, or measured RTT.
- No explicit controller identity persistence.
- HTTP POST per button transition works for simple hold buttons but does not scale well to continuous twin-stick samples.
- Context changes are game-specific and not declared visibly.
- Accessibility exists only indirectly through simple buttons, not as infrastructure.

## Compatibility decision

Do not remove `/input`. Add `/axm/input` beside it. Translate semantic actions into the old room input fields. After real-device proof, the old client may remain as a simple-mode fallback.
