# Model Shadow retention-audit review outcome v3.1 evidence

Status: `TEST`

This folder records the bounded capability and evidence case for the additive
v3.1 data-only outcome leaf. It begins with the exact v3.0 frontier, freezes the
capability and claim routes, records deterministic command outcomes, binds the
normalized source set, and seals compact ordered session events.

The leaf can build or exact-rebuild minimized `APPROVED`, `HOLD`, and `REJECTED`
observations from an exact v2.9 request/handoff package plus one caller-presented
persisted Review Inbox item. It does not observe a live host, mutate Review
Inbox, authenticate actors, prove actual human review, resolve the retention
hold, or authorize remediation or execution.

The focused suite discovered and preserves an important evidence boundary:
standalone validation accepts a self-consistent pseudonymous actor-digest
rewrite. Only exact rebuild from the raw caller package proves actor-digest
derivation. The output truth, contract, README, route, and corruption tests all
state that limit.

`CHECK_RESULTS.json` retains one bounded row per command, its exit code, focused
assertion count, and canonical digest. Raw stdout, synthetic votes, raw actor
strings, paths, test-state files, and repetitive polling are not retained.

No browser evidence is claimed because v3.1 adds no browser surface. Browser
render/click verification is therefore not applicable, not silently passed.
No independent Draft 2020-12 schema validator is installed; schema evidence is
limited to runtime validation and static closure/constant checks.

Rebuild the receipts from repository root with:

```text
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/build-capability-after.js
python C:/Users/miket/.codex/skills/detect-capability-gaps/scripts/compare_capabilities.py --requirements docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/CAPABILITY_REQUIREMENTS.json --capabilities docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/CAPABILITY_INVENTORY_AFTER.json --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/CAPABILITY_GAP_AFTER.json
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/run-verification-checks.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/build-source-snapshot.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/build-session-segment.js
python C:/Users/miket/.codex/skills/curate-session-evidence/scripts/seal_jsonl.py --input docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/SESSION_SEGMENT.jsonl --output docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/SESSION_SEGMENT.seal.json
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/build-session-evidence.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome/verification-selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
