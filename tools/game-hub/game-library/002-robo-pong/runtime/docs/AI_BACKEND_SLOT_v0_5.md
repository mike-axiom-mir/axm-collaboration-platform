# AI BACKEND SLOT v0.5

AXM / Axiom-Mir — Robo Pong  
Status: BACKEND HOOK / NOT ACTIVE CLOUD AI / SAFE LOCAL TEST

## Why this exists

Mike found a working direction in the AXM Canvas branch: an AI console can choose between a live cloud/session brain, a local model, or ChatGPT/key-backed branch later. Robo Pong should not copy the canvas graphics, but it can keep the underlying connector pattern.

## What was added

The simple BAT Robo Pong server now has an AI backend slot for Player 2.

Current live behavior:

- P1 = human
- P2 = built-in BYTE-BUD AI
- external AI slot = available but off by default

Later behavior:

- local AI or connector joins as P2
- game server keeps truth
- AI receives game state only
- AI sends paddle intent only

## AI endpoints

Open in browser:

```text
http://localhost:8787/ai/contract
http://localhost:8787/ai/status?room=AXM1
http://localhost:8787/ai/state?room=AXM1
```

Join as external AI:

```bash
curl -X POST http://localhost:8787/ai/join?room=AXM1 ^
  -H "Content-Type: application/json" ^
  -d "{\"provider\":\"local\",\"mode\":\"control\"}"
```

Send paddle input:

```bash
curl -X POST http://localhost:8787/ai/input?room=AXM1 ^
  -H "Content-Type: application/json" ^
  -d "{\"left\":false,\"right\":true,\"ready\":true,\"source\":\"local-test\",\"note\":\"move right\"}"
```

Leave AI slot:

```bash
curl -X POST http://localhost:8787/ai/leave?room=AXM1
```

## Safety / source-of-truth rule

The AI backend does not get shell access.
The AI backend does not write files.
The AI backend does not receive secrets.
The browser does not store cloud API keys.

The AI can only send:

```json
{
  "left": false,
  "right": true,
  "ready": true,
  "note": "optional short reason"
}
```

If external AI stops sending input for about 750ms, built-in BYTE-BUD AI resumes.

## Connector idea for later

A ChatGPT/Claude/local connector can:

1. Poll `/ai/state`.
2. Decide left/right.
3. POST `/ai/input`.
4. Repeat at a low rate.

This lets Mike play locally with:
- built-in test AI now
- local AI later
- cloud/connector AI later

## Important boundary

This build does not directly call Claude, ChatGPT, or any cloud model.
It only adds the backend slot/contract so that later tools can connect cleanly.
