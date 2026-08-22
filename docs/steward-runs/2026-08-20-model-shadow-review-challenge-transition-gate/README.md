# Model Shadow review challenge transition gate evidence

Status: `TEST`

This folder is the bounded review evidence for the v0.7 pairwise transition
gate stacked on separation-gate commit
`2983942c7c960207da8746e7aa873e391dad3aac`.

The strongest claim is pairwise: two exact v0.6 separated chains are classified
as exact replay, forward ledger extension, or a typed hold for anchor, epoch,
ledger, checkpoint, time, or entry contradiction. No presented chain is used
without exact rebuild.

The comparison is not global. Two candidate forks independently extend the same
prior chain in the focused fixture; comparing them directly then exposes the
missing prior-branch entry. A withheld or never-presented branch remains
invisible. This is counterevidence against global uniqueness, global fork
exclusion, or a globally consistent transition-log claim.

The before/after reports were generated with the installed deterministic
`detect-capability-gaps` comparator. No specialist ZIP package was inspected.
No provider, browser, real identity, live review, protected storage, external
retention, trusted time, human-benefit, learning, merge, promotion, Foundation,
or `CANON` authority was exercised.

Regenerate repository-local derived evidence from the repository root:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-gate/build-source-snapshot.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-gate/run-verification-checks.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-gate/build-session-evidence.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-gate/verification-selftest.js
```
