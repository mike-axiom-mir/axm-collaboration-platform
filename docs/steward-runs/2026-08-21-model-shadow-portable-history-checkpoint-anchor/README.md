# Model Shadow Portable History Checkpoint Anchor v2.2 evidence

Status: `TEST`

This bounded evidence folder records the v2.2 two-layer portable-checkpoint
anchor seam above the verified v2.1 settlement-history checkpoint.

Rebuild capability reports and normalized source evidence:

```bash
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/build-capability-after.js
python <skill-root>/detect-capability-gaps/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/build-source-snapshot.js
```

Run implementation plus inherited verification:

```bash
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-anchor/verification-selftest.js
```

No browser claim applies because the module has no visual surface. Mike Tobi /
AXM remains the merge and `CANON` gate.
