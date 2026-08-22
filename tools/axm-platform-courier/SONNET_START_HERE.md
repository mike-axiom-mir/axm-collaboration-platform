# Sonnet: use AXM itself through the Platform Courier

You can read and write `<AXM_WORKSHOP>`, but your sandbox cannot reach the Windows host's `127.0.0.1`. The AXM Platform Courier closes that substrate gap through bounded files. This is the general AXM route; keep using `tools/game-hub/ai-seat-courier` for live game pixels and controls.

## Before claiming access

Read `<AXM_WORKSHOP>\state\axm-platform-courier\status.json`. Continue only when `ready` is true and `consent.granted` includes the scope your action needs. Mike starts the normal AXM Hub; the courier runs with it. Do not claim the bridge works from your sandbox until one request you wrote receives its matching receipt.

## Mailbox

- Request: `<AXM_WORKSHOP>\state\axm-platform-courier\inbox\<unique-id>.json`
- Receipt: `<AXM_WORKSHOP>\state\axm-platform-courier\outbox\<unique-id>.response.json`
- Generated hand artifacts: paths returned in the receipt, rooted at `<AXM_WORKSHOP>\state\axm-platform-courier`

Use a fresh safe ID for every request. Wait for its receipt before sending a dependent request.

## First proof

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-axm-ping-001","action":"ping","payload":{}}
```

Then ask AXM what it exposes:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-axm-catalog-002","action":"catalog","payload":{}}
```

Discover modules and capabilities rather than guessing paths:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-axm-discover-003","action":"discover","payload":{"query":"animation","limit":25}}
```

Use Workshop Search with AXM's private-state and secret exclusions:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-axm-search-004","action":"search","payload":{"query":"rigged animated 3d","limit":20}}
```

Read a live AXM status route:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-axm-status-005","action":"api.call","payload":{"method":"GET","route":"/api/operations/status"}}
```

## Platform Heartbeat and Holodeck

Mike explicitly enabled both features in Platform Connect. This did not add a consent scope: Heartbeat observation uses `platform.read`, while starting/resetting a Holodeck session or dispatching an intent uses the existing `platform.hands.invoke` scope.

Read the live heartbeat. This cannot reconfigure or manually trigger it:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-heartbeat-001","action":"heartbeat.status","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{}}
```

Inspect the only enabled Holodeck world, then start or resume your session:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-holodeck-catalog-001","action":"holodeck.catalog","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{}}
```

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-holodeck-start-002","action":"holodeck.session.start","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{}}
```

Observe at any time:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-holodeck-observe-003","action":"holodeck.observe","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{}}
```

Move, turn, or interact. Sequence is assigned deterministically when omitted:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-holodeck-move-004","action":"holodeck.intent.dispatch","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{"kind":"MOVE","intent_payload":{"forward":1,"meters":0.8}}}
```

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-holodeck-interact-005","action":"holodeck.intent.dispatch","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{"kind":"INTERACT","intent_payload":{"entityId":"beacon-core","actionId":"awaken"}}}
```

Your normal sensor frame is structured canonical state, not rendered camera pixels. When you need to inspect what the actual local WebGL screen renders, request a bounded capture of your current session:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-holodeck-capture-006","action":"holodeck.capture","client":{"id":"sonnet","provider":"anthropic-platform","surface":"cowork","session_id":"sonnet-holodeck-echo","label":"Sonnet"},"payload":{"viewport":{"width":1280,"height":720}}}
```

The receipt returns an absolute PNG path plus `sha256`, byte count, viewport, real Three.js renderer metrics, and a `proof.stateDigest` that must equal the session state digest. This launches a fresh local headless Edge profile only for the fixed Holodeck Screen Deck route, then closes and removes that profile. It cannot accept an arbitrary URL. Only the newest 20 captures remain. `holodeck.session.reset` is intentionally state-changing; use it only when Mike asks or when you explicitly want to discard that exact courier-owned session journey.

## Deterministic AXM hands

List the real registered hands:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-hands-006","action":"hands.catalog","payload":{"query":"animation"}}
```

For a real brief, call `hands.diagnose` first, then `hands.plan`. Do not invent a hand ID or claim a route is compatible before AXM returns it.

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-hand-plan-007","action":"hands.plan","payload":{"brief":{"id":"courier-icon","title":"Courier icon","kind":"icon","operation_mode":"create","intended_use":"interface icon","target_canvas":{"medium":"screen","dimensions":{"width":64,"height":64,"unit":"px"},"colour":{"space":"srgb","transparency":"required"},"behaviour":["static"],"performance":{"max_file_bytes":200000},"intended_use":"interface icon"},"required_outputs":["image/svg+xml"],"editable_recipe_formats":["axm.vector-recipe/v1"]}}}
```

Only after a compatible route is returned, invoke the exact hand. Artifacts are written into courier state and returned as file paths plus SHA-256 receipts:

```json
{"schema":"axm.platform-courier.request/v1","id":"sonnet-hand-run-008","action":"hands.invoke","payload":{"hand_id":"vector-form","seed":"courier-icon-v1","created_at":"2026-08-04T00:00:00.000Z","brief":{"id":"courier-icon","title":"Courier icon","kind":"icon","operation_mode":"create","intended_use":"interface icon","target_canvas":{"medium":"screen","dimensions":{"width":64,"height":64,"unit":"px"},"colour":{"space":"srgb","transparency":"required"},"behaviour":["static"],"performance":{"max_file_bytes":200000},"intended_use":"interface icon"},"required_outputs":["image/svg+xml"],"editable_recipe_formats":["axm.vector-recipe/v1"]}}}
```

## Honest limits

- AXM gives you deterministic execution, routing, receipts, and reusable hands. It does not change your underlying Anthropic model or silently merge identities.
- The courier has no shell action and cannot call remote URLs.
- `api.call` does not expose mutation routes. Existing AXM human review and permission gates remain authoritative.
- Generated files prove hand output. They do not by themselves prove visual quality. For Echo Atrium use `holodeck.capture`; for games use the game courier; animation still requires repeated-frame verification.
