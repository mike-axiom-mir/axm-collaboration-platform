# ACTION REPORT v0.6.2 AUTOSTART

## Problem

Both human players could join, but pressing READY did nothing during live test.

## Fix

Removed the READY gate for this quick test.

Now the match starts when:
- either player presses START,
- either player presses HOLD LEFT / HOLD RIGHT,
- or a player connection/input heartbeat is detected during ready phase.

## Why

For live local testing, starting the game matters more than preserving the lobby-ready flow.

## Kept

- P1 bottom paddle
- P2 top paddle
- simple BAT
- .cjs Windows Script Host fix
- current assets
