# Lumenwake adapter seat contract

`EXPERIMENTAL · SOFTWARE-VERIFIED LOCAL INTERFACE · NOT CANON`

Lumenwake distinguishes three controller types:

- `human`: an ordinary keyboard, gamepad, or phone seat;
- `adapter`: an explicitly assigned external collaborator seat;
- `ai`: Lumenwake's built-in server decision loop.

An adapter is never inferred from a missing human and never runs the built-in AI
loop. The host must explicitly pass `type: "adapter"` in `AXM_PLAYERS_JSON`.
That assignment is the consent act for this local session.

## Binding and transport

The trusted local host reads `GET /api/host/bootstrap` over loopback. Each
adapter seat receives an ephemeral 192-bit token bound to its room, seat, and
player. Tokens are created in memory, are not written to disk, and are not
present in public game state or adapter observations.

The adapter reads `GET /api/adapter-observation?room=AXM1&seat=<seat-id>` with
the token in `X-AXM-Seat-Token` or `Authorization: Bearer`. It sends intentions
to `POST /api/input` using `axm-semantic-input-v1`:

```json
{
  "roomCode": "AXM1",
  "seatId": "seat_2",
  "sequence": 0,
  "intent": {"moveX": 0.2, "moveY": -0.5, "action": false, "dash": true}
}
```

Only `moveX`, `moveY`, `action`, and `dash` are accepted. Human and adapter
packets enter `lumenwake-seat-authority-v1`, use the same strict sanitizer, and
only update the server's input buffer. `Core.step` remains the only position,
health, charge, phase, achievement, and result authority. Replayed sequences,
wrong-room packets, wrong tokens, non-adapter seats, values outside `-1..1`,
unknown fields, and outcome claims are rejected. The gate permits at most 40
accepted packets per seat in a rolling second.

## Observation boundary

`axm-seat-screen-semantics-v1`, with the Lumenwake profile
`axm.lumenwake-adapter-observation/v1`, contains the assigned seat, visible
players and world objects, shared HUD state, cooldowns, and the next accepted
sequence. It omits the token, random seed, next spawn schedule, raw timeline,
input buffers, and rate ledger.

This is a bounded adapter contract, not a process sandbox. Lumenwake's existing
LAN shared-screen and human-controller routes remain ordinary local HTTP routes
and are not identity-isolated from a hostile process on the same machine or
network. Network-wide controller-session authentication is a separate design
gap and is not claimed here.

## Evidence route

| Claim | Native proof and pass condition | Counterevidence |
| --- | --- | --- |
| Seat types remain distinct | Core assertion plus live state show `human`, `adapter`, and `ai` unchanged | An adapter appears as `ai` or runs the AI loop |
| Human and adapter share one input gate | Live requests return the same gate and sanitized packet | Separate mutation paths or unequal sanitization |
| Adapter binding is enforced | Correct token succeeds; wrong token, wrong room, replay, cross-seat, and AI-seat attempts fail | Any denied identity changes an input buffer |
| Observation is bounded | Parsed live payload contains visible semantics and excludes tokens, seed, spawn schedule, and input ledgers | A forbidden field appears in the payload |
| Simulation remains authoritative | Accepted intentions move players only after live server ticks; outcome fields are rejected | A packet directly sets position, health, charge, phase, or result |

The executable evidence is `adapter-seat-selftest.cjs`. Physical phone behavior,
disconnect recovery, blocking-overlay escape, hostile-process isolation, and
human acceptance remain separate evidence or design gates.
