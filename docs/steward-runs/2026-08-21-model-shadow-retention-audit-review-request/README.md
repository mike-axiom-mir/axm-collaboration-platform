# Local retention-audit review-request evidence

Status: `TEST`

This folder records the bounded v2.9 frontier audit, capability comparisons,
claim routes, normalized source snapshot, exact command outcomes, semantic
summary, and sealed session segment. It does not claim live host submission,
host mutation authorization, authenticated identity, actual human review,
receiver durability, independent custody, review approval, hold resolution,
provider execution, evaluation, human benefit, learning, adoption, promotion,
merge, Foundation mutation, or `CANON`.

Rebuild the generated evidence:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/build-capability-after.js
python <capability-gap-skill>/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/build-session-segment.js
python <evidence-curation-skill>/scripts/seal_jsonl.py --input docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/SESSION_SEGMENT.jsonl --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/SESSION_SEGMENT.seal.json --source-label SESSION_SEGMENT.jsonl
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/verification-selftest.js
```

Resolve skill paths from the local Codex skill installation. No machine-specific
path is retained in the evidence package.
