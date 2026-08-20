# Grounded Growth current-state portability

Status: `TEST`

This audit closes a bounded portability gap in the current-state leaf. The full
native verifier still rebuilds the complete source graph. The new detached
route can inspect one copied receipt for strict structure, self-integrity,
internal coherence, and authority-boundary violations without writes or
network access.

The improvement is deliberately limited. A coherent receipt with forged source
references—or even coherently substituted human-benefit fields—can still pass
portable integrity after its self-digest is recomputed. Such a pass therefore
holds at `SOURCE_TRUTH=UNKNOWN`; it is never evidence that the referenced
sources are authentic, current, or that a person benefited.

The recorded adversarial evaluation compares a digest-only checker with the
detached guard across eleven cases. Seven recomputed manipulations that a digest
check accepts are refused by the guard. Three coherent receipts remain portable
passes, and all three are held for native source verification. No human test was
performed.

The preceding convergence verification receipt is preserved unchanged. Its
exact source verification now fails as expected because five tracked module
files evolved, while its recorded current-state behavior receipt still rebuilds
to the same digest. `PRIOR_RECEIPT_EVOLUTION.json` records that distinction
instead of silently rewriting history.

Run:

```powershell
node docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/build-current-portability.js --check-recorded
node docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/selftest.js
```

Nothing in this audit installs, promotes, merges, grants permission, makes a
`CANON` decision, or changes the Foundation.
