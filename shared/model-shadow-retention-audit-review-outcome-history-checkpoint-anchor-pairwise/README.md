# Model Shadow Retention Audit Review-Outcome History Checkpoint Anchor Pairwise v3.5

Status: `TEST`  
Installed: `false`  
Promoted: `false`  
Merge / `CANON` gate: Mike Tobi / AXM

This bounded, stateless adapter compares two caller-presented v3.4 anchored
checkpoint packages. It exact-rebuilds both packages, self-validates their v3.3
checkpoints, normalizes the two caller policy profiles, and compares the full
ordered review-outcome history plus the caller-declared anchor epochs.

It can distinguish an exact anchored-package replay, a sequential recheckpoint
of unchanged history, and a forward full-history prefix. Policy or identity
drift, checkpoint-id equivocation, time rollback/collision, missing/gapped
epochs, snapshot drift, strict rollback, and replacement/forks remain held for
review. A history extension whose snapshot binding does not change is also held.
History ancestry outranks an epoch symptom, so two independently valid
same-next-epoch candidates still compare as a fork when their histories diverge.

## Boundary

The result is relative only to the two packages the caller supplied. The module
does not authenticate either policy, key controller, actor, steward, checkpoint
origin, clock, epoch source, or host. It cannot see withheld branches, exclude a
joint replacement of both packages, prove global transition uniqueness, enforce
retention, prevent deletion or rollback, resolve a retention hold, or authorize
execution, adoption, installation, promotion, merge, or `CANON`.

Receipts contain references, normalized-profile digests, counts, relation flags,
classification, and explicit negative truth claims. They omit raw keys,
signatures, paths, review material, model output, and private context. The
runtime performs no file or network writes, signing, key generation, provider
invocation, experiment, or evaluation.

## API

```js
const Pairwise = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise');

const receipt = Pairwise.buildTransition({
  transitionId,
  comparedAt,
  previousAnchoredInput,
  previousAnchoredReceipt,
  candidateAnchoredInput,
  candidateAnchoredReceipt
});

const verification = Pairwise.verifyTransition(input, receipt);
```

Run the focused checks with:

```bash
node shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest.js
```
