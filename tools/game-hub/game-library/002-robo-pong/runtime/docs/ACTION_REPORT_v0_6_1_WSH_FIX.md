# ACTION REPORT v0.6.1 WSH FIX

## Problem

Windows showed a Windows Script Host syntax error for:

```text
robo-pong-simple-bat-server.js
```

That means the `.js` file was run by Windows Script Host instead of Node.js.

## Fix

- Renamed server file to `.cjs`.
- Updated BAT files to start the server with Node.
- Added an obvious start file:

```text
CLICK_ME_START_ROBO_PONG_2_PLAYERS.bat
```

## Correct use

Extract the ZIP first, then double-click the BAT.

Do not double-click the server file.
