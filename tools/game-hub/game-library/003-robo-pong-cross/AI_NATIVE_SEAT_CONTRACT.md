# AXM Pong: Cross AI-native seat contract

Protocols:

- Input: `axm-semantic-input-v1`
- Observation: `axm-seat-screen-semantics-v1`
- Authority gate: `cross-seat-authority-v1`

## Seat truth

`human`, `adapter`, and `ai` remain different runtime types.

| Type | Controller | Runtime movement | Observation |
| --- | --- | --- | --- |
| `human` | Phone or shared keyboard | Same semantic authority gate | Public shared state |
| `adapter` | Explicit external AXM collaborator | Same semantic authority gate; never Host AI | Token-bound shared-arena view |
| `ai` | Deliberately selected game-local Host AI | Server AI paddle | No external binding |

The three-seat co-op Warden is game-local `ai`, not an external adapter. An adapter with no accepted input remains still; it is never silently replaced by Host AI.

## Binding and input

The host-local `GET /api/host/bootstrap` response issues random per-seat capabilities. Human phone links carry their capability in the URL fragment so it is not sent in the initial HTTP request. Adapter bindings declare:

```json
{
  "seatId": "seat_2",
  "controllerType": "adapter",
  "protocol": "axm-semantic-input-v1",
  "inputEndpoint": "/api/input",
  "observationEndpoint": "/api/adapter-observation"
}
```

The private `token` is returned only by the loopback host-bootstrap route. Every external semantic packet binds `roomCode`, `seatId`, `token`, and a monotonically increasing `sequence`. The allowlisted intent is only `{ "axis": -1..1, "power": boolean }`. Position, damage, lives, winner, mission, ball, paddle, and state assertions are rejected.

Human phone packets and adapter packets converge on `cross-seat-authority-v1`, which owns sanitization, rate limiting, sequence advancement, input lease renewal, and server-side power activation. The direct legacy human route remains a compatibility wrapper but converts its buttons to the same semantic intent before that gate.

## Observation boundary

`GET /api/adapter-observation?room=AXM1&seat=seat_2` requires `X-AXM-Seat-Token`. It returns the semantic equivalent of the shared Cross arena plus that seat's controller HUD:

- own seat, side, lives, paddle, power, and connection state;
- public match phase, event, outcome, mission, and effects;
- all players, paddles, balls, and the central prism already visible on the shared screen;
- the next accepted input sequence.

It excludes seat capabilities, raw input buffers, lease timestamps, rate windows, random state, and client mutation of authoritative outcomes.

## Evidence boundary

`neon-cross-selftest.cjs` proves distinct seat types, Host-AI-only automation, token rejection, monotonic sequence rejection, outcome-field rejection, equal human/adapter authority-gate results, bounded observation, and accepted adapter movement. Physical device and same-Wi-Fi QA remain separate and pending.
