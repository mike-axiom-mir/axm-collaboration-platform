# AXM Dependency Declaration Observatory

Integrated `TEST` module. It maps exact module dependency declarations from the live Workshop without becoming an activation resolver.

## What it owns

- exact installed module-ID edges;
- explicit `service:`, `module:`, and `tool:` target visibility;
- strongly connected declared module sets;
- one exact, question-only review packet for a selected declared cycle;
- explicit namespaced targets not observed as top-level modules, without calling shared services missing;
- generic capability tokens preserved without guessing.

## Preserved adjacent owners

The Activation & Recovery dependency resolver remains the owner of bounded candidate version resolution and activation planning. Technical Glasses remains the live readiness owner. Handoff Wiring Observatory remains the exact `accepts`/`produces` owner.

## Run

```text
node dependency-cli.js --root /path/to/axm-workshop
node dependency-cli.js --root /path/to/axm-workshop --output current-dependency-map.json --browser-output current-dependency-map.js --quiet
node dependency-cli.js --root /path/to/axm-workshop --cycle-member game-hub --review-output current-cycle-review.json --browser-review-output current-cycle-review.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No output file is written unless an output path is explicit.

The review packet asks what each exact edge means and keeps runtime behavior,
optionality, startup order, degraded behavior, deadlock, and possible edge
changes `UNKNOWN` until a human and runtime evidence decide them.
