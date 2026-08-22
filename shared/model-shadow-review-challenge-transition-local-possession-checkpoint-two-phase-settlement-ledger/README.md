# Local-possession two-phase settlement ledger v2.0

Status: `TEST` · installed: `false` · promoted: `false`

This adapter separates local transition proposal from settlement. `propose` exact-rebuilds an eligible v1.8 forward transition, captures the configured source, requires a v1.7 exact candidate-checkpoint match, and exclusive-creates a proposal. A proposal never advances the derived settled head.

`settle` requires the original proposal package, recaptures the source, and exclusive-creates one matching settlement. An exact post-write match yields `SETTLED_POSTWRITE_SOURCE_MATCH` and advances only this caller-owned settled head. Extension, rollback/replacement, absence, invalidity, or identity drift becomes a typed held settlement and preserves the previous settled head.

A crash after proposal can leave exactly one trailing pending proposal. A fresh process can inspect it and settle it when the caller presents the original package. No later proposal is accepted until it is settled or held.

## Exact boundary

Neither capture is atomic with its following file write. Two observations cannot exclude a transient change that reverted between them. The source can change after settlement. Two independent roots can still settle divergent forks, and deleting a root can reopen sequence one. Local file `fsync` is not directory-entry, hardware, external-retention, or protected-monotonic durability.

The confirmations are not authentication. The module proves no real-world identity, independent controller custody, human participation, provider execution, evaluation, benefit, learning, execution/adoption authority, promotion, merge, or CANON status. Mike Tobi remains the merge/CANON gate.

```bash
node shared/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest.js
```
