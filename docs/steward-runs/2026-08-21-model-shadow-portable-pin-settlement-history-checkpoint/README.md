# Portable pin-settlement history-checkpoint evidence

Status: `TEST`

This folder records the bounded v2.6 capability comparison, normalized source
snapshot, exact command outcomes, claim routes, semantic summary, and sealed
session segment. It does not claim authenticated checkpoint origin, external
retention, protected monotonic state, rollback prevention, atomic observation,
global consistency, provider execution, evaluation, human benefit, learning,
adoption, promotion, merge, or `CANON`.

Rebuild the generated evidence:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/build-capability-after.js
python <capability-gap-skill>/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-portable-pin-settlement-history-checkpoint/verification-selftest.js
```

Resolve `<capability-gap-skill>` from the local Codex skill installation. No
machine-specific path is retained in the evidence package.
