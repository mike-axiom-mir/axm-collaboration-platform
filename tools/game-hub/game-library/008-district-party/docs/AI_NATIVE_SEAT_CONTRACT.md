# AI-native seat contract

Status: **LOCAL CONTRACT IMPLEMENTED · REAL WORKSHOP ADAPTER LAUNCH UNTESTED**

AXM District Party keeps three controller identities distinct:

| Type | Who chooses actions | Phone QR | Host AI loop |
| --- | --- | --- | --- |
| `human` | Human touch/keyboard client | Yes | Never |
| `adapter` | Connected Workshop AI | No | Never |
| `ai` | Optional built-in game state machine | No | Yes |

No empty slot becomes an actor. District Dominion accepts one through four ready seats per party, with unequal parties allowed. `hostAiFillEmptySeats` is `false` unless the host deliberately enables the launcher option.

## Launch binding

Each selected `adapter` record retains its `adapterId`. The local launch response contains an `adapterBindings` entry with:

```json
{
  "seatId": "seat_2",
  "slot": 2,
  "partyId": "party_a",
  "adapterId": "foundation-ai-alpha",
  "protocol": "axm-semantic-input-v1",
  "inputEndpoint": "/api/input",
  "observationEndpoint": "/api/adapter-observation",
  "tokenHeader": "X-AXM-Seat-Token",
  "controllerProfile": "/data/controller-profile.json"
}
```

The actual launch response also carries the private seat token to the local Foundation host. It is not a phone URL and must not be rendered as a QR.

## Semantic actions

The adapter sends the same packet shape as a human controller:

```json
{
  "roomCode": "AXM1",
  "sessionId": "session-local-id",
  "seatId": "seat_2",
  "token": "seat-private-token",
  "seq": 42,
  "input": {
    "moveX": 0.7,
    "moveY": -0.2,
    "aimX": 0,
    "aimY": -1,
    "aimActive": true,
    "action": false,
    "fire": true,
    "sprint": false,
    "brake": false
  }
}
```

`routeInput()` applies the same room/session/seat/token binding, increasing sequence requirement, vector normalization, rising-edge pulses, timeouts and actor rules for humans and adapters. The adapter cannot submit final position, projectile hits, damage, vehicle ownership, inventory objects, money, capture ownership or mission results.

## Screen-bounded observation

An adapter requests:

`GET /api/adapter-observation?room=AXM1&session=…&seat=seat_2&width=1280&height=720`

and supplies its token through `X-AXM-Seat-Token`.

The response contains:

- the adapter's own health, shield, state, equipment/ammo summary, vehicle and funds;
- the ally status cards visible on that party's shared screen;
- public mission, result, friendly-fire, justice and territory HUD indicators;
- the same party-camera target/bounds calculated from living party actors and occupied vehicles;
- actors, NPCs, vehicles, projectiles, effects, zones and map features currently inside those bounds;
- the minimum next input sequence and reusable controller profile path.

It deliberately omits:

- off-screen opposing actors and NPCs;
- the other party's private controller state;
- input buffers and pending pulses;
- Host AI paths or target choices;
- hidden cooldown/respawn internals and random seed;
- authority to mutate anything through the observation call.

The observation is semantic rather than video pixels. Its camera value is the current target projection for the requested viewport; a human display may be partway through a short visual smoothing transition. This is the known honest difference between the data observation and a captured video frame.

## Workshop integration seam

The real Game Hub should:

1. pass only its selected ready player records through `AXM_PLAYERS_JSON`;
2. retain `human`, `adapter` and `ai` without converting types;
3. deliver each adapter only its own binding/token;
4. let the adapter observe, reason and send semantic intentions repeatedly;
5. never give an adapter the host token or unfiltered in-process world object;
6. remove or pause that seat's intentions when its connected AI disconnects.

This local package proves the child-runtime seam and authority behavior. Launch from the actual Workshop connector remains **UNTESTED**.
