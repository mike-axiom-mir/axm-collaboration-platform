# AXM Runtime Channel Observatory

Integrated `TEST` module. It consumes `axm.entry-resource-graph/v1`, rechecks source hashes, and inventories explicit communication declarations without running them.

It observes named `BroadcastChannel` and `CustomEvent` patterns, selected consumers, unnamed `postMessage` / `MessageChannel` patterns, and textual WebSocket/EventSource endpoints. Static producer/consumer pairing and multi-owner reuse become evidence states. A review request asks existing owners four questions about one named seam.

```bash
node selftest.js
node runtime-channel-cli.js --root /path/to/workshop --graph /path/to/current-entry-resource-graph.json
node build-bundle.js
```

No browser, network connection, event dispatch, message delivery, protocol edit, permission, installation, promotion, or CANON change. Handoff Wiring keeps declared delivery ownership; Browser QA keeps runtime proof.
