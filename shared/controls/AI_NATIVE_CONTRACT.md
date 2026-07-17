# AI-native seat contract

Protocol: `axm-semantic-input-v1`  
Observation: `axm-seat-screen-semantics-v1`

## Core rule

A connected AI controls a selected `adapter` seat through the same semantic intention gate as a human. It receives the semantic equivalent of what that seat can perceive on its game display and HUD, never the raw authoritative world.

## Binding

```json
{
  "roomCode": "AXM1",
  "sessionId": "session-local-id",
  "seatId": "seat_2",
  "partyId": "party_a",
  "adapterId": "foundation-ai-alpha",
  "token": "private-seat-token",
  "protocol": "axm-semantic-input-v1",
  "inputEndpoint": "/api/input",
  "observationEndpoint": "/api/adapter-observation",
  "controllerProfile": "/profiles/top-down-twin-stick.json"
}
```

The token goes only to the local seat owner. It must never appear in a QR, shared screen, observation payload, or log.

## Input packet

```json
{
  "roomCode": "AXM1",
  "sessionId": "session-local-id",
  "seatId": "seat_2",
  "token": "private-seat-token",
  "seq": 42,
  "input": {
    "moveX": 0.7,
    "moveY": -0.2,
    "aimX": 0,
    "aimY": -1,
    "aimActive": true,
    "action": false,
    "fire": true
  }
}
```

The host:

- validates room, running session, active seat, controller type, token, and increasing sequence;
- clamps and normalizes independent vectors;
- keeps only fields allowed by the selected profile;
- latches configured pulse edges until the simulation consumes them;
- applies ordinary timeout and gameplay rules;
- owns every outcome.

## Observation budget

An observation may include:

- the seat’s own public state;
- ally HUD cards available on the same party screen;
- public mission or match HUD;
- camera bounds for the requested viewport;
- actors, vehicles, objects, effects, and public map features inside those bounds;
- the minimum next sequence number.

It must omit:

- off-screen opponents;
- another seat’s private inputs;
- tokens and bindings;
- bot paths, hidden target selection, random seeds, pending pulses, and cooldown internals;
- authority-only decisions or future state.

Semantic observation is not claimed to be pixel-identical to a rendered frame. A target game may provide image frames instead, but it must preserve the same visibility and seat-identity boundary.

## Human parity does not mean hidden advantage

The same gate means equal action vocabulary and authority checks. The AI may reason differently from a human, but it cannot teleport, claim hits, read hidden opponents, own a vehicle by assertion, or skip the game’s cooldown and damage logic.

