# Game Hub Lobby Ready Rules

Status: WORKING / TEST seed.

The lobby should be easy for game nights.

It should not require perfect lobby reshaping for every game.

## Default lobby size

The hub shows 4 seats by default.

```text
seat_1
seat_2
seat_3
seat_4
```

The host can add a second 4-seat team/group.

```text
seat_5
seat_6
seat_7
seat_8
```

Hard maximum is 8 seats.

## Play or skip rule

If a selected game supports fewer players than the lobby contains, the hub uses ready order.

Example:

```text
Lobby: 7 players
Game: max 4 players
Result: first 4 eligible ready players play
Extra: 3 players skip, spectate, or wait next round
```

## Why this rule exists

This keeps game nights smooth.

Players should not have to leave, rejoin, rebuild teams, or open a new lobby for every game.

The lobby remains stable while games rotate underneath it.

## Default selection flow

```text
1. Host selects a game.
2. Hub reads game max_players.
3. Players ready up.
4. Hub fills game seats by ready order until max_players is reached.
5. Overflow players become skip / spectator / next-round.
6. Game launches.
7. After the game, everyone returns to the same lobby.
```

## Later optional modes

```text
host-picked seats
team balance
winner stays
loser rotates
AI fill empty seat
adapter replaces missing human
round-robin rotation
```

## AXM rule

Lobby stability first.

Visible seats always.

No hidden AI/adapters.

No forced rebuild for every game.
