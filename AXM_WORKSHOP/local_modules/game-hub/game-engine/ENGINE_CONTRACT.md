# Game Engine Contract

Status: WORKING / TEST seed.

The engine is the shared runtime contract between the lobby and game modules.

## Contract boundary

```text
Lobby owns:
- visible seats
- join links / QR
- player names
- ready state
- host game selection

Engine owns:
- selected game session
- play-or-skip selection
- tick loop
- input routing
- state snapshots
- result summary

Game module owns:
- game rules
- game world
- win/loss conditions
- per-game rendering/client needs
```

## Engine inputs

```text
seat_table
selected_game_manifest
ready_events
player_inputs
adapter_inputs
host_commands
```

## Engine outputs

```text
session_state
selected_players
skipped_players
state_snapshot
result_summary
return_to_lobby_signal
```

## Seat-to-player selection

Default rule:

```text
selected_players = first eligible ready seats up to game.max_players
skipped_players = eligible ready seats after game.max_players
```

Example:

```text
lobby players: 7
game max_players: 4
selected_players: first 4 ready eligible seats
skipped_players: remaining 3 ready eligible seats
```

## Tick rule

The default engine tick is 30 TPS.

Games may request a different tick rate in their manifest, but the hub should default to 30 TPS until tested.

## State rule

The engine should keep one authoritative local session state.

Clients should send input intentions.

Clients should not become the authority for game state.

## Adapter/AI rule

Adapters and AI players are treated as visible seat occupants.

They send input through the same engine input path as human seats where possible.

No hidden adapter may control a player.

## Done rule

A game module is compatible when it can:

```text
load from manifest
accept selected seat map
accept player inputs
return state snapshots
return result summary
end cleanly back to lobby
```
