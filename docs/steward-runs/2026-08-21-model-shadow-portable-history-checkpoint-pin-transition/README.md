# Portable history checkpoint pin-transition evidence

Status: `TEST`

This folder records the bounded v2.4 capability comparison, normalized source
snapshot, exact command outcomes, claim routes, semantic summary, and sealed
session segment. It does not claim authenticated pin origin, external
retention, protected monotonic state, rollback prevention, global consistency,
provider execution, evaluation, human benefit, learning, adoption, promotion,
merge, or `CANON`.

Rebuild the generated evidence:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/build-capability-after.js
python <capability-gap-skill>/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/CAPABILITY_INVENTORY_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-portable-history-checkpoint-pin-transition/verification-selftest.js
```

Resolve `<capability-gap-skill>` from the local Codex skill installation. No
machine-specific path is retained in the evidence package.
