# Model Shadow review challenge ledger evidence

Status: `TEST`

This folder is the bounded review evidence for the challenge-ledger leaf stacked
on `codex/grounded-growth-signed-review-evidence-v0.1` at `81f2e29d`.

The strongest verified claim is local: a valid signed-review challenge is
refused after restart and under two-process contention in one caller ledger
while its append-only state remains present and valid. The evidence also keeps
the counterexamples: another state root accepts the challenge, and deleting the
caller-owned namespace reopens it.

No specialist ZIP package was inspected. No provider, browser, live review,
protected storage, human-benefit, learning, merge, promotion, Foundation, or
`CANON` authority was exercised.

Regenerate derived evidence from the repository root:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-ledger/build-capability-reports.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-ledger/build-source-snapshot.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-ledger/run-verification-checks.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-ledger/build-session-evidence.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-ledger/verification-selftest.js
```
