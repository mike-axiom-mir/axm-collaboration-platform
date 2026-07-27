# AXM Handoff Wiring Observatory

Status: `EXPERIMENTAL` detached candidate  
Installed: `false`  
Promoted: `false`  
CANON: unchanged

This module scans an explicit AXM Workshop root and builds an exact-string graph from module `accepts[]` and `produces[]` declarations. When older manifests omit those arrays, it may use the existing `shared/capabilities/capability-metadata.json` record and labels that source as fallback.

It distinguishes:

- `EXACTLY_WIRED` — at least one exact producer and exact consumer;
- `PRODUCER_ONLY` — declared output with no exact consumer;
- `CONSUMER_ONLY` — declared input with no exact producer;
- `SELF_LOOP_ONLY` — one module is the only exact producer and consumer.

These are structural observations, not health verdicts. A producer-only public export can be intentional. A consumer-only external input can be correct. Multiple providers are not automatically collisions.

## Why this is separate

- Workshop Capability Index routes human requests to modules.
- Capability Gap Hand compares an explicit requirement set with an explicit availability inventory.
- Technical Glasses reports missing declaration envelopes and readiness seams.
- Module Contract Workbench edits one module's manifest/contract pair.

None owns a read-only Workshop-wide producer→consumer wiring map with exact artifact identity and source attribution.

## Run

```bash
node wiring-cli.js --root /path/to/axm-workshop
```

Write only by naming an output:

```bash
node wiring-cli.js --root /path/to/axm-workshop --output current-wiring-map.json --quiet
node wiring-cli.js --root /path/to/axm-workshop --browser-output current-wiring-map.js --quiet
```

## Evidence limits

- Artifact names are opaque exact strings.
- `image/*` is not silently joined to `image/png`.
- Similar schema names are not normalized or called compatible.
- No adapter is generated.
- No module, manifest, contract, route, permission, rollback, promotion, or CANON state is changed.

Run `node selftest.js /path/to/axm-workshop` for fixtures plus a live bounded scan.
