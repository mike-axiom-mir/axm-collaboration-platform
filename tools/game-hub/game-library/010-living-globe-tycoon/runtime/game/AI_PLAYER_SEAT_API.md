# AI player seat API — v0.4 API retained in the v0.10 host

`EXPERIMENTAL LOCAL CONTRACT · SAME BROWSER RUNTIME · NOT NETWORK AUTHENTICATION`

## What this is

The Hub contains two player seats:

| Seat | Role | Input | Screen |
|---|---|---|---|
| `hub-seat-human-steward` | `HUMAN_PLAYER` | phone touch, keyboard, mouse | human camera |
| `hub-seat-ai-steward` | `AI_PLAYER` | explicit allowlisted intents only | independent laptop camera |

The AI begins disconnected near the opposite side of the globe. It has no timer, policy, model call, background loop or strategic authority. Merely opening its screen changes nothing.

## Browser entry point

```js
const world = window.AXMLivingWorld;
const seat = world.aiPlayerSeat;

world.getPlayerSeats();          // both seat descriptors
world.getCooperativeProject();   // Two-Shores state
world.metrics.observe();         // same read-only five-domain Brief
seat.describe();                 // schemas, allowlists and boundaries
seat.observe();                  // bounded local observation
seat.getReceipts();              // at most 100 linked receipts
```

### Connection lifecycle

```js
seat.connect({
  connectorId: 'local-ai-v1',
  label: 'Local AI Steward',
  reason: 'Claim the second Hub player seat.'
});
```

`connectorId` is an ownership label, not a secret or security token. It must match every intent and disconnect request. A reload releases the connection and appends `AI_SEAT_RUNTIME_RELOAD`; the connector must explicitly reconnect.

```js
seat.disconnect({
  connectorId: 'local-ai-v1',
  reason: 'Release the seat before shutting down.'
});
```

## Submitting one intent

Always observe immediately before building a command. Use the returned `expectedSequence`.

```js
function submit(type, id, reason, payload = {}) {
  const view = seat.observe();
  return seat.submitIntent({
    schema: 'axm.living-world.player-intent/v0.1',
    seatId: view.seatId,
    connectorId: view.connection.connectorId,
    id,
    expectedSequence: view.expectedSequence,
    type,
    reason,
    payload
  });
}

submit('MOVE', 'move-0001', 'Walk toward the grove.', {
  forward: 1,
  strafe: 0.2,
  distance: 1.5
});
```

### Allowlist and limits

| Intent | Payload | Limits |
|---|---|---|
| `MOVE` | `forward`, `strafe`, `distance` | axes `-1..1`; distance `>0..2.5` surface units |
| `LOOK` | `yaw`, `pitchDelta` | yaw `±π/2`; pitch delta `±0.5` radians |
| `SET_TOOL` | `tool` | `chop`, `plant`, `campfire`, `fish`, `coop` |
| `ACT` | none | uses the selected tool and AI camera/position |
| `WAIT` | none | explicit no-op with a receipt |

Intent IDs and connector IDs use letters, digits, `.`, `_`, `:`, `-`, start with an alphanumeric character and contain at most 80 characters. Reasons contain 4–240 characters. Numbers must be finite.

Malformed, stale, replayed, wrong-seat, wrong-connector and unlisted commands are rejected before processing and do not consume the sequence. A well-formed command that the world cannot perform does consume one sequence and creates a `REFUSED` receipt. This prevents an old “build when we have wood” command from unexpectedly applying later.

## Observation boundary

`seat.observe()` returns `axm.living-world.ai-player-observation/v0.1` with:

- seat identity, connection and next sequence;
- unit-sphere position, tangent facing and pitch;
- selected tool and AI-screen descriptor;
- shared wood, rod and fish inventory;
- terrain underfoot;
- nearby trees, fires and animal counts within 12 surface units;
- nearest strategic district label/zone;
- Two-Shores project state;
- the current Palace errand, timer, progress, per-seat contribution and Festival Laurel summary;
- `stewardMetrics`, the same five-domain read-only report shown on the human Brief, including public account and supply evidence but no hidden decision or mutation method;
- world age, day/season and strategic revision;
- receipt head/count and declared limitations.

Observation never advances time or changes state.

The AI has no mission-specific completion intent. If a mission began while the seat was connected, successful ordinary movement and `ACT` results contribute to the shared doubled goal. A solo mission refuses AI contribution, and connecting mid-mission changes only the next mission.

## Player actions

Tool selection and action are intentionally separate:

```js
submit('SET_TOOL', 'tool-0001', 'Prepare the works flag.', { tool: 'coop' });
submit('ACT', 'act-0001', 'Place the AI end of the route.');
```

Chop, plant, campfire, fishing inventory and wood are shared with the human. The fishing line has one explicit owner at a time, so the other seat cannot silently steal a cast.

For Two-Shores, each seat spends two shared wood on its own endpoint. The second end must be on clear dry ground and at least 12 chord-surface units from the first. Completion draws the route but grants no hidden strategic bonus.

## Screens

```js
seat.showScreen('PIP');       // laptop: human full screen + AI monitor
seat.showScreen('AI_FOCUS');  // full AI camera, human controls disabled
seat.showScreen('HUMAN');     // human camera only
```

The URL `?seat=ai` opens AI focus; `?seat=human` opens human-only view. At phone widths the default is human-only and the AI panel is status, not a control transfer.

## Receipts

Accepted and refused processed intents produce `axm.living-world.player-intent-receipt/v0.1`. Each records intent ID/type, reason, before/after player state, result summary, declared world changes, sequence, prior hash and current SHA-256 hash. Connection, disconnection and runtime reload also enter this chain. The newest 100 receipts and intent IDs are retained.

These are gameplay audit receipts, not cryptographic proof against a malicious page owner.

## Later cross-device transport

This v0.4 API is the local endpoint a later transport may drive. A real phone/laptop or online co-op layer still needs:

- an authoritative shared world host;
- authenticated seat assignment and secret capability handling;
- ordered delivery, acknowledgements, reconnect and state resync;
- intent rate limits and payload size limits at the server boundary;
- conflict rules for shared inventory and fishing;
- explicit user visibility when an AI is connected;
- no direct exposure of this browser-local connector label as if it were authentication.

Until that layer exists, opening the package on two devices creates two independent local worlds.
