# Model Shadow review challenge anchor gate evidence

Status: `TEST`

This folder is the bounded review evidence for the v0.5 caller-presented anchor
gate stacked on checkpoint-witness commit
`cb4d5aadabd4d46475ccbe0cef61031419a18b38`.

The strongest claim is cryptographic and relative to an exact presented pin: a
separate threshold of Ed25519 keys signs the exact v0.4 witness, witness policy,
checkpoint, ledger manifest, entries digest, anchor, and expected anchor digest.
A replacement witness policy cannot reuse those signatures while the anchor and
expected digest remain fixed.

The anchor and expected digest are not a host trust root. Replacing both with a
new anchor and matching signatures creates a distinct valid chain, and the
selftest preserves that counterexample. The self-declared anchor epoch is not
monotonic state, and the temporary fresh-process package is not independently
retained or protected.

The before/after reports were generated with the installed deterministic
`detect-capability-gaps` comparator. No specialist ZIP package was inspected.
No provider, browser, live review, protected storage, external retention,
trusted time, human-benefit, learning, merge, promotion, Foundation, or `CANON`
authority was exercised.

Regenerate repository-local derived evidence from the repository root:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-anchor-gate/build-source-snapshot.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-anchor-gate/run-verification-checks.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-anchor-gate/build-session-evidence.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-anchor-gate/verification-selftest.js
```
