# Review-outcome transition settlement ledger v3.7

Status: `TEST` · installed: `false` · promoted: `false`

This explicitly invoked adapter separates a v3.6 forward-entry proposal from
local settlement. The settlement root must already exist and be distinct and
nonnested from the caller-owned v3.6 source root.

`propose` exact-verifies the complete v3.6 caller package against the persisted
source entry, requires equal source snapshots bracketing that verification, and
exclusive-creates one pending proposal. A proposal never advances the derived
settled head.

`settle` separately exact-rebuilds the stored proposal package and observes the
v3.6 source again. An exact entry with equal bracketing source snapshots creates
an exact settlement and advances only this local settled head. Source absence,
invalidity, change during the check, or entry mismatch creates a typed held
settlement and preserves the prior head. Either result clears the pending
proposal, so uncertainty is retained rather than silently retried or erased.
Each minimized observation records both capture states (`PRESENT`, `ABSENT`, or
`INVALID`) separately from exact-entry verification and snapshot equality, so
the typed classification can be rederived without conflating those facts.

Manifest, proposal, and settlement files use canonical JSON, self-digests,
exclusive creation, file `fsync`, a fixed transient operation lock, bounded
storage, and exact postwrite local reload. Fresh-process `inspect` validates the
complete local proposal/settlement chain but does not recapture the live source
or rebuild upstream packages without caller input.

The last source observation occurs before the settlement write. It is not
atomic with that write, cannot exclude a transient source change and reversion,
and proves no postwrite or later currentness. File `fsync` proves neither
directory-entry nor hardware or power-loss durability; a reported fsync failure
may still leave an inspectable file.

Two independent source/settlement pairs can settle divergent candidates from
the same genesis. Deleting or jointly replacing caller-owned roots can reopen
sequence one. A distinct local directory is not independent external custody,
protected monotonic state, rollback prevention, withheld-branch exclusion, or
a globally consistent log.

Persisted artifacts contain source-entry references and minimized observation
facts only. They omit the v3.6 record input, v3.5 transition, v3.4 packages,
keys, signatures, paths, review material, complete outcomes, model output, and
private context. Confirmation strings authenticate no host, actor, human,
organization, or policy. The adapter invokes no provider, experiment,
evaluation, learning, execution, adoption, installation, promotion, merge,
Foundation mutation, or `CANON` action.

```js
const Settlement = require('./model-shadow-retention-audit-review-outcome-transition-settlement-ledger');

const service = Settlement.createService({
  stateRoot,
  settlementLogId,
  sourceServiceOptions
});

const pending = service.propose({
  proposalId,
  proposedAt,
  confirmation: Settlement.PROPOSE_CONFIRMATION,
  sourceRecordInput,
  sourceEntry
});
```

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-transition-settlement-ledger/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
