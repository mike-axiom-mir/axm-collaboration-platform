# Sonnet: playtest a local AXM game through the file courier

You are using this route because your sandbox can read/write `<AXM_WORKSHOP>` but cannot reach the Windows host's `127.0.0.1` directly.

Do not create a tunnel. Do not try remote URLs. Mike or a local agent starts `START_AI_SEAT_COURIER.cmd` once; afterward you operate only through files.

## Mailbox

- Write requests to `<AXM_WORKSHOP>\state\ai-seat-courier\inbox\<unique-id>.json`.
- Read the matching receipt from `<AXM_WORKSHOP>\state\ai-seat-courier\outbox\<unique-id>.json`.
- PNG paths returned by `launch`, `screenshot`, or `snapshot` are real local frames you can inspect with your image-reading capability.
- Check `status.json` first. Continue only when its `status` is `ready`.

Use a new safe ID for every command. Wait for the matching outbox receipt before sending a dependent command.

## Minimal Brace Room proof

Launch the registered game:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-launch-001","action":"launch","gameId":"019-brace-room","viewport":{"width":1280,"height":720}}
```

Select one crew member and the shortest shift:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-one-002","action":"click","selector":"button[data-players='1']"}
```

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-six-003","action":"click","selector":"button[data-minutes='6']"}
```

Start the actual game:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-start-004","action":"click","selector":"#start-button"}
```

Read the AI-native seat observation:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-see-005","action":"http","method":"GET","path":"/api/adapter-observation?seat=p1"}
```

Hold Player 1 right for 500 ms:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-move-006","action":"key","code":"KeyD","durationMs":500}
```

Capture pixels plus the accessible UI tree:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-proof-007","action":"snapshot","capture":true}
```

Then read observation again and compare `players.p1.x` plus the two screenshots. That sender receipt + receiver observation + visible frame is the minimum honest movement proof.

Stop only the active game/browser session while leaving the courier ready:

```json
{"schema":"axm.ai-seat-courier.request/v1","id":"sonnet-019-stop-008","action":"stop"}
```

## Allowed actions

`ping`, `status`, `launch`, `click`, `key`, `wait`, `screenshot`, `snapshot`, `http`, `stop`.

`http` is restricted to the active game's exact localhost origin. `key` accepts letters, digits, arrows, Space, Enter, Escape, and numpad digits, with a maximum five-second hold. Request files larger than 64 KiB are rejected.

## Honest limits

- A screenshot proves visible rendering, not hidden server correctness.
- An observation receipt proves semantic state, not visual quality.
- Headless Edge is a real browser but may differ slightly from Mike's visible Chrome/Edge window.
- The final proof that *your particular sandbox* can use this courier is one successful request written by you and a matching receipt read by you. Do not claim that step until you have done it.
