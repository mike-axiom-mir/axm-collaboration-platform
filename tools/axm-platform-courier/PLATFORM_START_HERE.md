# AXM Platform Connect — client start

This module is provider-neutral. A compatible AI surface needs read/write access only to the mounted courier folders; it does not need a browser extension, localhost networking, a shell, or AXM credentials.

1. Confirm the local AXM Hub is running.
2. Ask the local user to open Platform Connect, choose the profile, enable only the needed capabilities, and grant the exact scopes.
3. Write one JSON file named `<id>.json` into `state/axm-platform-courier/inbox`.
4. Wait for `state/axm-platform-courier/outbox/<id>.response.json`.
5. Verify `requestSha256` and retain the bounded receipt instead of repeating raw logs.

Minimal request:

```json
{
  "schema": "axm.platform-courier.request/v1",
  "id": "unique-safe-id",
  "createdAt": "2026-08-04T12:00:00.000Z",
  "action": "catalog",
  "client": {
    "id": "stable-client-id",
    "provider": "provider-name",
    "surface": "surface-name",
    "session_id": "bounded-session-label",
    "label": "Human-readable connection label"
  },
  "payload": {}
}
```

The `client` block is optional and bounded. It is used only for provider/surface/session labels, action counts, outcomes and timestamps in the local connection ledger. Never put prompts, credentials, personal data or request payloads in it.

Start with `catalog`, then `discover` or `hands.catalog`. Invoke a hand only after diagnosis/planning and only if the local user granted `platform.hands.invoke`. If the user separately enables Heartbeat observation or Holodeck access in Platform Connect, the catalog will expose their exact actions without adding another consent scope. Refusals are contract behavior: never work around a missing scope, disabled setting, rejected route, or unavailable capability.

Heartbeat is observation-only through `heartbeat.status`. Holodeck is limited to the built-in Echo Atrium: use `holodeck.catalog`, `holodeck.session.start`, `holodeck.observe`, `holodeck.capture`, `holodeck.intent.dispatch`, `holodeck.snapshot`, and explicit `holodeck.session.reset`. Structured proximity is not camera vision. `holodeck.capture` is the separate, consented `platform.hands.invoke` route for a real local Edge/Three.js PNG bound to the session's exact state digest; it does not accept a URL.

Current truth labels:

- `anthropic-platform`: live-proven with Claude Platform / Cowork.
- `generic-sandbox`: contract-ready, not automatically live-proven.
- `local-agent`: contract-ready, not automatically live-proven.
