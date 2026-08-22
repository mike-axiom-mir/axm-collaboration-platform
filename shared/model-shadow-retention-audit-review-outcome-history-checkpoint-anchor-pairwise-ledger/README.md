# Anchored Review-Outcome History Pairwise Ledger v3.6

Status: `TEST` · installed: `false` · promoted: `false`

This explicitly invoked local adapter serializes exact v3.5 forward transition
receipts beneath one caller-owned state root. A record is eligible only when the
complete caller package exact-rebuilds to
`CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY`, retains the pinned witness and
anchor continuity profiles, and consumes the exact current anchored-package,
checkpoint, and caller-epoch head.

The exact confirmation phrase and an exclusive create for the next contiguous
12-digit sequence file are both required. Manifest and entry files are canonical
JSON with self-digests and file `fsync`. Reload validates the fixed namespace,
manifest, contiguous filenames, entry digest chain, minimized v3.5 receipt
self-digests, pinned profiles, exact head succession, unique entry/transition
ids, and aggregate resource bounds. A fresh process can inspect the derived
head; exact upstream rebuild of an entry still requires the caller package.

A successful `record` return requires exclusive create, file `fsync`, and an
exact postwrite reload. Those completions are not asserted inside bytes built
before the write. If a write or `fsync` reports failure, the call is typed as
durability-uncertain because an inspectable file may still remain.

This makes a useful local fact true: while this exact root survives, a second
candidate cannot silently consume an earlier local head. It does **not** make
that fact global. Independent roots may accept different candidates from the
same genesis. Deleting, replacing, or rolling back a root can reopen an earlier
branch. File `fsync` proves neither directory-entry nor hardware durability.
The confirmation phrase authenticates no host, person, organization, or policy.

Persisted entries contain the minimized v3.5 receipt and references only. They
omit v3.4 rebuild inputs, public keys, signatures, private keys, paths, complete
review outcomes, raw review material, model output, and private context. The
module invokes no provider, experiment, evaluation, learning, execution,
adoption, installation, promotion, merge, Foundation mutation, or `CANON`
action.

```js
const Ledger = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');

const service = Ledger.createService({
  stateRoot,
  logId,
  genesisAnchoredCheckpointRef,
  genesisCheckpointRef,
  genesisAnchorEpoch
});

const entry = service.record({
  entryId,
  recordedAt,
  confirmation: Ledger.CONFIRMATION,
  transitionInput,
  transitionReceipt
});
```

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
