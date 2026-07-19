# Circuitseed AI-native seat contract

Protocol: `axm-semantic-input-v1`  
Observation: `axm-seat-screen-semantics-v1`  
Game profile: `axm-circuitseed-field-v1`

`human`, `adapter` and `ai` are distinct:

| Seat type | Chooses actions | External input | Observation binding |
| --- | --- | --- | --- |
| `human` | Human through keyboard, host UI or phone controller | Same semantic gate | Token-bound seat view |
| `adapter` | Explicitly connected Workshop AI | Same semantic gate | Token-bound seat-visible semantics only |
| `ai` | Deliberately selected game-local Host AI | Rejected | No external binding |

No empty seat becomes any of these. Revoking adapter consent clears its inputs and pauses it without replacement.

## Allowed player intentions

Movement is a normalized vector. Field pulses are Scan, Connect, Deploy, Assist, Recover, Return, Build and Interact. Tactical actions are Scan, Anchor, Shield, Patch, Reroute, Challenge, Isolate and Synchronize. The game rejects unknown keys and client-asserted damage, rewards, inventory, ownership, mission completion, positions or world state.

Every external packet binds room, session, seat, private token and an increasing sequence. Human and adapter packets share the same rate limit, sanitation, pulse latch, timeout and server authority.

## Observation boundary

An adapter sees:

- its own actor state;
- the ally cards visible on the shared party screen;
- public mission, encounter, conditions, business and currency HUD;
- the current shared camera target and bounds;
- actors, points, resources, regions and settlement figures inside those bounds;
- already-discovered hidden routes only;
- its next minimum input sequence.

It does not see tokens, world seed, RNG state, input buffers, pending pulses, Host AI plans, future state, off-camera actors or undiscovered hidden paths. It never receives the in-process world object.
