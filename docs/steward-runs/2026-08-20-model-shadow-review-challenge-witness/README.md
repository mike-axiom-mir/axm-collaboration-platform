# Model Shadow review challenge checkpoint witness evidence

Status: `TEST`

This folder is the bounded review evidence for the checkpoint witness leaf
stacked on continuity commit `41c872d5`.

The strongest claim is cryptographic and relative: detached Ed25519 signatures
prove possession of distinct keys allowed by one exact caller policy, bind one
exact checkpoint, and must rebuild before that checkpoint can drive a later
continuity comparison.

The policy is not a host trust root. A replacement caller policy with its own
keys can produce a different valid witness, and the selftest preserves that
counterexample. The witness is not externally retained or protected merely
because a temporary test file survives a child-process restart.

The before/after reports were generated with the installed deterministic
`detect-capability-gaps` comparator. No specialist ZIP package was inspected.
No provider, browser, live review, protected storage, external retention,
trusted time, human-benefit, learning, merge, promotion, Foundation, or `CANON`
authority was exercised.

Regenerate repository-local derived evidence from the repository root:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-witness/build-source-snapshot.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-witness/run-verification-checks.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-witness/build-session-evidence.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-witness/verification-selftest.js
```
