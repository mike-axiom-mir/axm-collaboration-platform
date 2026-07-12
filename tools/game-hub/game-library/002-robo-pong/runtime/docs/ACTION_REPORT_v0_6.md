# ACTION REPORT v0.6

## Goal

Make Robo Pong playable by two human phone players quickly for Michaela/local test.

## Done

- P1 = human bottom paddle.
- P2 = human top paddle.
- Server accepts input from both `player=p1` and `player=p2`.
- Either player can press READY to start.
- Server console prints P1 link, P2 link, and Screen link.
- Kept simple BAT path.
- Kept current asset visuals.
- Parked AI backend slot for later.

## How to test

Start:

```text
START_ROBO_PONG_SIMPLE_BAT_WINDOWS.bat
```

Use links:

```text
P1 phone: http://YOUR-LAN-IP:8787/?room=AXM1&player=p1
P2 phone: http://YOUR-LAN-IP:8787/?room=AXM1&player=p2
Screen:   http://YOUR-LAN-IP:8787/?room=AXM1&player=screen
```

## Not done

- No lobby.
- No QR screen.
- No player names UI.
- No final balance.
- No human P2 polish.
