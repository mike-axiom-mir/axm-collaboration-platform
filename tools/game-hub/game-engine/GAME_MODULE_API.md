# Game Module API

Status: WORKING / TEST seed.

Game modules plug into AXM Game Engine through a small common contract.

This keeps the hub stable while games can be swapped like tools.

## Game folder rule

Each game lives in:

```text
game-library/<game-id>/
```

Each game needs a manifest:

```text
game.manifest.json
```

## Minimum game manifest fields

```text
game_id
name
status
version
min_players
max_players
allowed_seat_types
server_entry
client_entry
start_command
local_only_default
```

## Engine-to-game start packet

When the hub launches a game, the engine sends a start packet.

```json
{
  "session_id": "session-001",
  "game_id": "example-game",
  "tick_rate": 30,
  "selected_players": [
    { "seat_id": "seat_1", "type": "human", "display_name": "Player 1" },
    { "seat_id": "seat_2", "type": "adapter", "display_name": "Adapter 1" }
  ],
  "skipped_players": [],
  "rules": {
    "local_only": true,
    "no_hidden_ai": true,
    "return_to_lobby": true
  }
}
```

## Input packet

Players and adapters send input packets.

```json
{
  "session_id": "session-001",
  "seat_id": "seat_1",
  "tick": 123,
  "input": {
    "move_x": 0,
    "move_y": 1,
    "action_1": false,
    "action_2": true
  }
}
```

## State snapshot

The game returns state snapshots.

```json
{
  "session_id": "session-001",
  "tick": 123,
  "phase": "running",
  "players": [],
  "world": {},
  "events": []
}
```

## External collaborator seat (adapter)

`adapter` means a Hub-connected collaborator such as Codex, Claude, a local
model, or another declared machine participant. It is not a renamed built-in
game bot. Built-in game automation uses the `ai` seat type.

An external collaborator does not need a second rendered video surface, but it
does need a complete decision-relevant view. The game projects its authoritative
world into `axm-seat-screen-semantics-v1` for that seat. The projection includes
what the seat could learn from its own screen, HUD and public game information,
and excludes hidden opponents, private player state and omniscient world truth.

```json
{
  "schema": "axm-seat-screen-semantics-v1",
  "session_id": "session-001",
  "seat_id": "seat_2",
  "tick": 123,
  "visible_world": {},
  "own_state": {},
  "public_state": {},
  "available_actions": [],
  "uncertainty": []
}
```

Human controller packets and external collaborator packets pass through the
same server-authoritative semantic action gate. A game must never hand an
adapter its host token, raw in-process world object, or an action shortcut that
a human seat cannot use.

## Result summary

At the end, the game returns a result summary.

```json
{
  "session_id": "session-001",
  "game_id": "example-game",
  "status": "ended",
  "winner": null,
  "players": [],
  "duration_ticks": 0,
  "notes": []
}
```

## Compatibility rule

A game is hub-compatible when it can:

```text
load by manifest
accept start packet
accept input packets
return state snapshots
return result summary
end back to lobby
```
