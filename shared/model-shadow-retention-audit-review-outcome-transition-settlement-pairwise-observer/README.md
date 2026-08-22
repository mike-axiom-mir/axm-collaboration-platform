# Transition-settlement pairwise observer v3.8

Status: `TEST` · installed: `false` · promoted: `false`

This read-only adapter observes two caller-presented v3.7 local settlement
frontiers. For each side it brackets an exact `verifySettlementPersisted` call
with two `inspect` snapshots and requires the supplied receipt to be the current
last settlement with no pending proposal before admitting comparison.

For compatible v3.7 source identities it can distinguish:

- exact presented snapshot replay;
- matching settled heads in distinct local frontier snapshots;
- one presented last exact settlement directly extending the other head; and
- different settled heads at the same local epoch; and
- different local epochs whose relation is unresolved by the latest receipts.

Absent, invalid, changing, pending, nonexact, or noncurrent sides produce a
typed observation hold. A source-log, source-manifest, or genesis mismatch
produces an identity hold.

## Boundary

Only the two co-presented current snapshots and latest settlement receipts are
compared. The receipt does not compare complete proposal or settlement
histories. Matching heads therefore do not prove matching histories. A relative
one-receipt extension does not prove a global order, and different epochs are
not called a fork when the missing histories cannot establish their relation. Withheld frontiers remain
invisible, and jointly replacing both root pairs can yield another internally
valid observation.

The two roots and their controllers are not authenticated as independent. The
settlement-root observations are not atomic across roots and prove no later
currentness. v3.8 does not recapture either live v3.6 source or reverify source
entry currentness. It proves no external retention, custody, globally consistent
log, protected monotonic state, rollback prevention, trusted time, actual human participation, benefit,
learning, execution, adoption, promotion, merge, or `CANON`.

The receipt persists references, counts, heads, minimized observation facts,
classification, and explicit negative truth claims. It omits service options,
paths, caller packages, review material, model output, and private context. The
runtime performs no write, network call, provider invocation, signing,
experiment, or evaluation.

```js
const Observer = require('./model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer');

const receipt = Observer.buildObservation({
  observationId,
  observedAt,
  left: { serviceOptions, settlementInput, settlementEvidence, settlementReceipt },
  right: { serviceOptions, settlementInput, settlementEvidence, settlementReceipt }
});
```

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
