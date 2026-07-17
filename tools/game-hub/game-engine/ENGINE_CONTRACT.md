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

## Shared controls and player-view rule

The default reusable implementation lives at `/shared/controls`.

```text
Human phone/controller -> semantic input packet -> seat token + sequence gate
Connected AI adapter   -> semantic input packet -> the same gate
Built-in host AI       -> host state machine; it cannot accept external packets
```

Games select a versioned controller profile instead of inventing a new phone
layout. The current defaults are `axm-top-down-twin-stick-v1` and
`axm-first-person-explore-v1`. A game may add a profile, but it must keep the
same intention, token, sequence and host-authority boundaries.

Connected AI receives `axm-seat-screen-semantics-v1`: a bounded projection of
what its assigned player/party screen can reveal. It does not receive raw world
state, hidden opponents, random seeds, private tokens or host decision state.
The projection may later be wrapped by Mirror's generic observation envelope;
live control remains ephemeral and never becomes a durable change packet.

## Done rule

A game module is compatible when it can:

```text
load from manifest
accept selected seat map
accept player inputs
declare a shared control profile
produce a seat-visible observation for adapter seats
return state snapshots
return result summary
end cleanly back to lobby
```
