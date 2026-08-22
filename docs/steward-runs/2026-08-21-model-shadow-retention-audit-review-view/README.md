# Local retention-audit Review Inbox view evidence

Status: `TEST`

This folder records the bounded v3.0 frontier audit, capability comparisons,
claim routes, normalized source snapshot, exact command outcomes, live browser
receipt, semantic summary, and sealed session segment. It does not claim live
host submission, authenticated identity, actual human review, a vote, approval,
hold resolution, assistive-technology compatibility, provider execution,
evaluation, human benefit, learning, adoption, promotion, merge, Foundation
mutation, or `CANON`.

Rebuild the generated evidence:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/build-capability-after.js
python <capability-gap-skill>/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/build-session-segment.js
python <evidence-curation-skill>/scripts/seal_jsonl.py --input docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/SESSION_SEGMENT.jsonl --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/SESSION_SEGMENT.seal.json --source-label SESSION_SEGMENT.jsonl
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/verification-selftest.js
```

The browser journey is intentionally separate from script checks. Start
`visual-harness.js`, open its printed local URL in a browser, and repeat the
exact, mismatch, generic, rapid-selection, and 390×844 journeys described by
`VISUAL_RECEIPT.json`. Do not click the vote button; the harness rejects POST.

Resolve skill paths from the local Codex skill installation. No machine-specific
path is retained in the evidence package. A coordinated global tools-index
refresh is still open because the current generator produces broad unrelated
receipt churn.
