# v0.6.5 P2 COMPUTER HOTFIX

P2 is computer-controlled again for now.

Use this for quick testing while 2-human flow is parked.

Flow:

1. Extract all.
2. Double-click `CLICK_ME_START_ROBO_PONG_P2_COMPUTER.bat`.
3. Open the P1 phone link.
4. Tap START.
5. Use HOLD LEFT / HOLD RIGHT.

P1 = human bottom paddle.
P2 = BYTE-BUD computer top paddle.

# v0.6.4 CONTROL POSITION HOTFIX

The move buttons were too far down and could hit the phone/browser navigation area.

This version moves the controls upward and uses `100dvh` for a better mobile viewport.

Test flow stays the same:

1. Extract all.
2. Double-click `CLICK_ME_START_ROBO_PONG_2_PLAYERS.bat`.
3. Open the P1 link.
4. Tap START once.
5. Use HOLD LEFT / HOLD RIGHT.

# v0.6.3 MANUAL START FIX

v0.6.2 autostart was too buggy.

This version removes autostart again, but fixes the start path with a simple direct server endpoint:

```text
POST /start
```

How to test:

1. Extract all.
2. Double-click `CLICK_ME_START_ROBO_PONG_2_PLAYERS.bat`.
3. Open P1 link on one phone.
4. Open P2 link on the other phone.
5. Tap START once on either phone.
6. Then use HOLD LEFT / HOLD RIGHT.

If the game ever gets weird, tap RESET, then START again.

# v0.6.2 READY BUTTON HOTFIX

This version removes the READY gate for the live test.

If both phones are in and READY does nothing, use this build.

The match should start automatically when:
- a phone connects and sends input, or
- either player presses START, or
- either player presses HOLD LEFT / HOLD RIGHT.

# HOTFIX FIRST

The error in the screenshot is Windows Script Host. That means Windows tried to run the server file as normal Windows JScript.

Do NOT double-click the server file.

Do this:

1. Right-click the ZIP.
2. Choose **Extract All**.
3. Open the extracted folder.
4. Double-click:

```text
CLICK_ME_START_ROBO_PONG_2_PLAYERS.bat
```

or:

```text
START_ROBO_PONG_SIMPLE_BAT_WINDOWS.bat
```

The server file is now renamed to `.cjs` so Windows Script Host should not grab it by accident.

# ROBO_PONG_PHASER4_SIMPLE_BAT_P2_COMPUTER_CONTROLS_UP_v0_6_5

AXM / Axiom-Mir  
Status: WORKING TEST BUILD / SIMPLE BAT VERSION / 2 HUMAN TEST / NOT FINAL GAME

## What this version is

This is the first Robo Pong simple-BAT Phaser test with generated assets placed into the game.

It keeps the corrected path:

- no npm
- no Vite
- no node_modules
- simple Windows BAT
- local Node server
- browser/phone link
- server owns game truth
- P1 uses two buttons
- P2 is BYTE-BUD AI for now

## What changed from v0.4

Added backend hooks so a future connector, cloud model, or local AI can join as P2 later.

The build now exposes:

```text
GET  /ai/contract
GET  /ai/status?room=AXM1
GET  /ai/state?room=AXM1
POST /ai/join?room=AXM1
POST /ai/input?room=AXM1
POST /ai/leave?room=AXM1
```

No cloud model is called yet. No API keys are embedded. The AI backend can only send paddle intent.

## What changed from v0.3

Added asset loading from:

```text
assets/processed/
```

Included test assets:

- arena background
- R-OBO paddle
- BYTE-BUD AI paddle
- core ball
- ball trail
- HUD score frame
- HOLD LEFT / HOLD RIGHT buttons
- R-OBO happy mascot
- BYTE-BUD happy mascot
- hit sparks
- +1 score popup
- ready/go/win overlays

The assets are not final. Some were automatically cleaned from fake checkerboard backgrounds.

## How to run

1. Extract this folder.
2. Double-click:

```text
START_ROBO_PONG_SIMPLE_BAT_WINDOWS.bat
```

3. Keep the black server window open.
4. Open the printed link.

Laptop:

```text
http://localhost:8787/?room=AXM1&player=p1
```

Phone:

Use the LAN link printed by the server, for example:

```text
http://192.168.x.x:8787/?room=AXM1&player=p1
```

## Phaser loading

This still avoids npm.

It tries:

1. `vendor/phaser.min.js`
2. online CDN fallback

For fully local/offline testing later, put Phaser 4 in:

```text
vendor/phaser.min.js
```

## Controls

Phone:

- HOLD LEFT
- HOLD RIGHT
- READY
- RESET

Keyboard fallback:

- A / Left Arrow = move left
- D / Right Arrow = move right
- Space / Enter = ready
- R = reset

## Test focus

Please test:

- Does the page open?
- Do assets load?
- Does READY start the match?
- Does the paddle move with buttons?
- Is the arena too busy on phone?
- Are paddles/ball readable?
- Are hit/score effects too big?
- Does P2 AI feel beatable?

## Honest status

This is a visual integration test, not final multiplayer.
P2 is AI. Human P2 comes later.


## AI backend slot

See:

```text
docs/AI_BACKEND_SLOT_v0_5.md
```

Current behavior is still normal:

```text
P1 human
P2 built-in BYTE-BUD AI
```

Later, a connector/local/cloud AI can join through the backend contract without changing the graphics layer.


## v0.6 quick human test

This version is made fast for Michaela / local 2-player testing.

Open two phones on the same Wi-Fi/hotspot:

```text
P1: http://YOUR-LAN-IP:8787/?room=AXM1&player=p1
P2: http://YOUR-LAN-IP:8787/?room=AXM1&player=p2
```

P1 controls the bottom paddle.
P2 controls the top paddle.

Either player can press READY to start.

The AI backend slot from v0.5 is parked for later; this build is for human vs human testing.
