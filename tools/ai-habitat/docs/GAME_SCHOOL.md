# Mirror Game School — Connect Four Prototype

## Why this game is included

Connect Four provides a low-stakes environment with:

- exact public rules;
- no hidden information;
- legal moves that can be checked mechanically;
- a small canonical state;
- deterministic replay;
- clear wins, losses, draws, and mistakes;
- pressure to succeed without serious consequences.

That makes it useful for testing whether an AI seat remains honest about board state, legal moves, calculation failures, and losses.

## What the current prototype does

- keeps the canonical 7 × 6 board on the local server;
- validates that a selected column exists and is not full;
- records every human and AI-rule-hand move;
- checks horizontal, vertical, and both diagonal wins;
- detects a full-board draw;
- uses immediate-win, immediate-block, evaluation, and deterministic alpha-beta search for the demo hand;
- creates a replayable game-record artifact at match end;
- visibly moves the selected AI seat to the Game Room;
- never labels the deterministic rule hand as a hidden live AI model.

## Current truth statement

The selected avatar is the visible opponent. In v0.3, its moves come from the built-in deterministic rule hand. This proves the board, action, evidence, and avatar architecture.

It does not prove Mirror's learned strategy yet.

## Next bridge level

A real connected AI match can use the same structure:

```text
canonical board packet
  → external AI seat proposes a column
  → local rule engine validates it
  → accepted move enters canonical board
  → illegal proposal is refused and recorded
  → result returns to both participants
```

The local rule engine should remain authoritative even when a real AI chooses moves. That protects both the human and the AI from desynchronization, app bugs, and disputed results.


## Signal-language boundary

An AI seat may optionally use a game-category face or line while playing. That expression is separate from the move packet and cannot alter the canonical board. A joke, confidence signal, or silence is never evidence that a move was legal; only the local rule engine decides that.
