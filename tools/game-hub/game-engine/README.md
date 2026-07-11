# AXM Game Engine

Status: WORKING / TEST seed.

The Game Hub lobby is the door.

The Game Engine is the shared body underneath it.

The Game Library contains swappable games that plug into the engine.

## Core shape

```text
Game Hub Lobby
  -> seats, QR/link, ready state, game selection

Game Engine
  -> session state, game loop, input routing, player mapping, launch rules

Game Library
  -> individual games loaded by manifest
```

## Responsibilities

The engine should handle:

```text
seat map
ready order
play-or-skip selection
game session lifecycle
fixed tick loop
input routing
adapter/AI player routing
state snapshots
result summary
return to lobby
```

## What the engine should not do

```text
It should not decide AXM canon.
It should not hide AI/adapters.
It should not override lobby seats silently.
It should not require games to rebuild the lobby.
It should not upload data by default.
```

## First engine defaults

```text
default_tick_rate: 30 TPS
max_lobby_seats: 8
default_visible_seats: 4
optional_extra_seats: 4
network: local LAN by default
transport_v0: browser HTTP polling / simple local state
future_transport: WebSocket
```

## Engine lifecycle

```text
LOBBY
  players/adapters join seats

SELECT_GAME
  host selects game from game-library

READY_CHECK
  eligible seats ready up

BUILD_SESSION
  engine selects players by ready order and game capacity

RUNNING
  fixed tick loop runs selected game module

ENDING
  result summary is created

RETURN_TO_LOBBY
  lobby remains stable for next game
```

## AXM rule

Lobby stability first.

Engine consistency second.

Game-specific logic third.

Connectivity first, canon later.
