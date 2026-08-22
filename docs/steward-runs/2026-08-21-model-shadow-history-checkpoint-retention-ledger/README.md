# Local history-checkpoint retention-ledger evidence

Status: `TEST`

This folder records the bounded v2.7 capability comparison, normalized source
snapshot, exact command outcomes, claim routes, semantic summary, and sealed
session segment. It does not claim authenticated origin, independent external
retention, protected monotonic state, rollback prevention, directory-entry or
hardware durability, global consistency, provider execution, evaluation, human
benefit, learning, adoption, promotion, merge, or `CANON`.

Rebuild the generated evidence:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/build-capability-after.js
python <capability-gap-skill>/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/build-session-segment.js
python <evidence-curation-skill>/scripts/seal_jsonl.py --input docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/SESSION_SEGMENT.jsonl --output docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/SESSION_SEGMENT.seal.json --source-label SESSION_SEGMENT.jsonl
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/verification-selftest.js
```

Resolve skill paths from the local Codex skill installation. No machine-specific
path is retained in the evidence package.
