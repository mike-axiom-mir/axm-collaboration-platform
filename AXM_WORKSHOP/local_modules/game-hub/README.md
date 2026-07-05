# AXM Game Hub

Status: WORKING / TEST seed.

AXM Game Hub is the local place where human players and AI/adapters can meet, take seats, and launch swappable games from one shared lobby.

It is a side-by-side local module.

It is not inside Hermes.

It is not one game.

It is the lobby, launcher, seat table, and local game-session shell.

## Core goal

```text
one host machine
+ one local lobby
+ up to 8 swappable seats
+ human or adapter/AI players
+ QR/link join
+ game library
+ one-click game server launch
= AXM Game Nights base
```

## Module location

```text
AXM_WORKSHOP/local_modules/game-hub/
```

## Seat model

The hub should support up to 8 seats.

```text
seat_1
seat_2
seat_3
seat_4
seat_5
seat_6
seat_7
seat_8
```

Each seat can be assigned to:

```text
human
adapter
ai
spectator
closed
empty
```

Human seats connect by browser link, QR code, LAN URL, or later room code.

Adapter/AI seats connect through a visible adapter binding.

No hidden AI player.

No silent seat swap.

## Game library model

Games should be added like tools.

Each game gets its own folder in:

```text
game-library/
```

Example future layout:

```text
game-library/
  robo-pong/
  roguelite/
  rts/
  tower-defense/
  racing/
  survival/
```

The hub reads each game's manifest and shows it in the lobby launcher.

## First launch flow

```text
1. Host starts AXM Game Hub.
2. Hub starts local web server.
3. Hub shows LAN link and QR code.
4. Players join seats 1-8.
5. Host can swap seat type: human / adapter / AI / spectator / closed.
6. Host selects a game from game-library.
7. Hub launches that game module.
8. Seats are passed into the game session.
9. Game result returns to hub after round/session.
```

## Relationship to AI connectors

AI players should not be hidden inside the game.

They should be visible seat occupants.

AI/adapters can later come from:

```text
Hermes local
LM Studio local
ChatGPT connector
Claude connector
simple bot adapter
scripted test adapter
```

## Relationship to Agent Command Center

Agent Command Center can later prepare AI player packages.

Game Hub only assigns a visible seat to the selected adapter/package.

## Safe defaults

```text
max_seats: 8
network: local LAN by default
outside internet: off by default
host controls launch
seat swaps are visible
AI/adapters are visible
no background game launch
no hidden data upload
```

## First MVP target

Boring reliable base:

```text
Start server
show lobby
show 8 seats
show join link / QR placeholder
load game-library index
launch one test game module
```

## AXM rule

Game Hub is the shared local place.

Game modules are swappable.

Seats are visible.

AI participation is explicit.

Connectivity first, canon later.
