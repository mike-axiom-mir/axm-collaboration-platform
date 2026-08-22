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
+ 4 default visible seats
+ optional second 4-seat team
+ hard max 8 swappable seats
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

The hub should show 4 seats by default.

A host can add a second team/group of 4 seats when needed.

```text
Default visible seats:
seat_1
seat_2
seat_3
seat_4

Optional added team:
seat_5
seat_6
seat_7
seat_8
```

This keeps the lobby clean for most games while still supporting up to 8 players.

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

## Play or skip rule

The hub should not require perfect lobby size matching.

If the lobby has more players than the selected game supports, the hub uses a simple play-or-skip rule.

Example:

```text
7 players are in the lobby.
Selected game supports 4 players.
First 4 eligible players to ready up become players.
Remaining 3 become skip / spectator / next-round queue.
```

This keeps game nights fast.

It avoids forcing everyone to leave, rejoin, or rebuild the lobby for each game.

## Seat selection priority

Default simple rule:

```text
1. Host selects game.
2. Hub reads game max_players.
3. Eligible humans/adapters/AI can ready up.
4. First ready players fill game seats until max_players is reached.
5. Extra ready players become skip / spectator / next-round queue.
6. After game ends, lobby seats remain available for the next game.
```

Later modes can add team balance, host-picked seats, rotation, winner-stays, or AI fill.

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
4. Hub shows 4 seats by default.
5. Host may add second 4-seat team if needed.
6. Players join visible seats.
7. Host can swap seat type: human / adapter / AI / spectator / closed.
8. Host selects a game from game-library.
9. Hub reads game min/max players.
10. First eligible players to ready up fill available game seats.
11. Extra lobby players skip, spectate, or wait for next round.
12. Hub launches that game module.
13. Selected seats are passed into the game session.
14. Game result returns to hub after round/session.
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
default_visible_seats: 4
optional_second_team: 4 seats
max_seats: 8
selection_rule: first eligible ready players fill game capacity
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
show 4 seats
allow add second 4-seat team
show join link / QR placeholder
load game-library index
show game max players
apply play-or-skip ready rule
launch one test game module
```

## Verification

Run the bounded module-level promotion suite from the Workshop root:

```powershell
node tools/game-hub/selftest.js
```

The entrypoint composes the Game Night, package verifier, reviewed asset
handoff, runtime-port, idle-lifecycle, universal-control, and experience
recovery suites. It is deterministic module evidence, not a physical-phone or
human playtest substitute.

## AXM rule

Game Hub is the shared local place.

Game modules are swappable.

Seats are visible.

AI participation is explicit.

Lobby stability matters more than perfect per-game lobby reshaping.

Connectivity first, canon later.
