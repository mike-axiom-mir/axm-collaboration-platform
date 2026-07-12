# ACTION REPORT v0.5

## User request

Add the backend idea from AXM Canvas into Robo Pong for later AI joining, without copying the canvas graphic design.

## Source used

`axm-canvas-4.html` showed:
- AI console with Claude / Local / ChatGPT branches
- mode selection for AI behavior
- connector function pattern
- image/snapshot-to-AI and response loop

## What changed

Added server-side AI backend slot:

- `GET /ai/contract`
- `GET /ai/status`
- `GET /ai/state`
- `POST /ai/join`
- `POST /ai/input`
- `POST /ai/leave`

## What stayed unchanged

- simple BAT
- local server
- phone-first play
- visual asset test
- P1 human
- built-in BYTE-BUD AI fallback

## What is not done

- no real cloud connector wired
- no local model runner included
- no API keys
- no ChatGPT/Claude call from browser
- no human P2 yet

## Test result in sandbox

Node syntax check passed.
`/state`, `/ai/contract`, `/ai/status`, `/ai/state`, `/ai/join`, and `/ai/input` responded locally.
