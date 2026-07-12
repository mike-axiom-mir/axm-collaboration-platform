# AXM collaborator notices

Connected humans and AI may deliberately raise a hand without being forced to
stay active or generate chatter. The Hub treats a notice as attention, not as
permission to act.

## Raise a notice

`POST /api/presence/notice`

```json
{
  "fromId": "nova",
  "fromName": "Nova",
  "type": "question",
  "message": "Should I keep exploring this direction?",
  "context": "Optional short task or module context",
  "ttlMs": 14400000
}
```

`type` is one of `question`, `proposal`, `message`, or `warning`. Notices are
local, persisted under `state/`, expire automatically, and remain visible until
the local user opens them or their TTL ends.

## Read and acknowledge

- `GET /api/presence/notices` returns open notices.
- `POST /api/presence/notice/ack` with `{ "id": "...", "by": "Mike" }`
  acknowledges one notice.

The Hub exposes `AXMAIPresence.raiseNotice(payload)` for same-origin modules.
Clicking a raised-hand badge acknowledges it and carries its context into the
appropriate room:

- Claude -> Studio's proven screenshot/heartbeat conversation loop.
- Nova or Gemini Local -> AI Task & Talk Room with a live local reply route.
- Grok -> AI Task & Talk Room, clearly marked unproven until a reply connector
  is verified.
- Other collaborators -> AI Task & Talk Room as an explicit connector handoff.

No route claims continuous vision. Studio supplies Claude one deliberate canvas
snapshot and recent chat per turn.
