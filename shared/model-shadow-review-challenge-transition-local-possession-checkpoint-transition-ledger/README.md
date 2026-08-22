# Local-possession checkpoint transition ledger v1.9

Status: `TEST` · installed: `false` · promoted: `false`

This bounded adapter serializes exact v1.8 forward transitions inside one caller-owned local root. Before any ledger namespace is created, it captures the configured v1.4 local-possession source and exact-rebuilds a v1.7 separated continuity audit. A write is eligible only when that audit reports `CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT` for the v1.8 candidate chain.

An eligible write still requires the exact confirmation phrase and must win an exclusive create for the next contiguous sequence file. Reload validates the manifest, entry sequence, digest chain, stored receipt self-digests, and derived local head. A caller that retains the original transition package and returned currentness evidence can exact-rebuild a persisted entry in a fresh process.

## Exact boundary

The source capture happens before the ledger append; those operations are not atomic. The source can change after capture or during the append. Inspecting the ledger does not recapture the source and does not prove the candidate remains current.

Two independent roots can record different forks from the same genesis. Deleting or rolling back a root can reopen an earlier branch. Local file `fsync` does not prove directory-entry, hardware, external-retention, or protected-monotonic durability.

The confirmation phrase is not authentication. The module proves no real-world identity, independent controller custody, human participation, provider execution, evaluation, benefit, learning, execution/adoption authority, promotion, merge, or CANON status. Mike Tobi remains the merge/CANON gate.

## Test

```bash
node shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/selftest.js
```

The self-test includes exact writes and reloads, source-extension and rollback refusals before namespace creation, stale-head and concurrent-writer contention, persisted-package tamper checks, fresh-process verification, divergent independent roots, deletion reopening, and corrupt-entry fail-closed behavior.
