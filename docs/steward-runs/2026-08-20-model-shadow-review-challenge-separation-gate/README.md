# Model Shadow review challenge separation gate evidence

Status: `TEST`

This folder is the bounded review evidence for the v0.6 observable separation
gate stacked on anchor-gate commit
`8838d4eb2e7a013ccab8173e15391e3be9e8c881`.

The strongest claim is exact and negative: after rebuilding the full v0.5
anchored chain, the leaf refuses a public-key fingerprint or caller-declared
principal digest that appears in both the witness and anchor thresholds. A
fresh process must rebuild that separation receipt before the checkpoint can
drive continuity comparison.

Non-overlap is not controller independence. One synthetic process controls all
distinct keys and declarations in a passing counterexample. Distinct keys do
not prove independent custody, distinct digests do not authenticate different
people, and observable separation does not exclude collusion.

The before/after reports were generated with the installed deterministic
`detect-capability-gaps` comparator. No specialist ZIP package was inspected.
No provider, browser, real identity, independent custody, live review,
protected storage, external retention, trusted time, human-benefit, learning,
merge, promotion, Foundation, or `CANON` authority was exercised.

Regenerate repository-local derived evidence from the repository root:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-separation-gate/build-source-snapshot.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-separation-gate/run-verification-checks.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-separation-gate/build-session-evidence.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-separation-gate/verification-selftest.js
```
