# Local retention-audit observation-ledger evidence

Status: `TEST`

This folder records the bounded v2.8 frontier audit, capability comparisons,
claim routes, normalized source snapshot, exact command outcomes, semantic
summary, and sealed session segment. It does not claim authenticated origin,
independent external retention, continuous monitoring, protected monotonic
storage, deletion or rollback prevention, directory-entry or hardware durability,
global consistency, provider execution, evaluation, human benefit, learning,
adoption, promotion, merge, or `CANON`.

Rebuild the generated evidence:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/build-capability-after.js
python <capability-gap-skill>/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/build-session-segment.js
python <evidence-curation-skill>/scripts/seal_jsonl.py --input docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/SESSION_SEGMENT.jsonl --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/SESSION_SEGMENT.seal.json --source-label SESSION_SEGMENT.jsonl
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-observation-ledger/verification-selftest.js
```

Resolve skill paths from the local Codex skill installation. No machine-specific
path is retained in the evidence package.
