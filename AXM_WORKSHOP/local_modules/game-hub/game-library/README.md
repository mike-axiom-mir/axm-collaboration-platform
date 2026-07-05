# Game Library

Status: WORKING / TEST seed.

This folder is where AXM Game Hub discovers swappable games.

Each game should live in its own folder with a manifest.

## Future layout

```text
game-library/
  robo-pong/
    game.manifest.json
  roguelite/
    game.manifest.json
  rts/
    game.manifest.json
  tower-defense/
    game.manifest.json
  racing/
    game.manifest.json
```

## Game manifest purpose

A game manifest tells the hub:

```text
what game this is
how many players it supports
which seat types are allowed
how to launch it
which client page to show
which server entry to run
which controls are needed
```

## Hub rule

The hub should load games like tools.

Adding a game should not require rewriting the hub.

A new game folder plus manifest should be enough for discovery later.
