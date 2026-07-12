# ACTION REPORT v0.6.3 MANUAL START FIX

## Problem

v0.6.2 autostart started too early when one player joined.
Then when the second player joined, the game flow became confusing:
ready disappeared, start appeared, but no stable playable match.

## Fix

Replaced autostart with a direct manual start endpoint.

```text
POST /start
```

The START button calls `/start` directly.

Movement buttons only move.
They do not start the game.

RESET calls `/reset` directly.

## Test focus

- Both phones join.
- Tap START once.
- Ball begins moving.
- P1 bottom controls bottom paddle.
- P2 top controls top paddle.
