# Model Shadow Portable History Checkpoint Pin Transition v2.4

Status: `TEST` · installed: `false` · promoted: `false`

v2.4 adds a separately portable, self-digested pin above the v2.3 pairwise
gate. The pin commits to the exact anchored receipt and checkpoint, normalized
anchor and witness profiles, every ledger-identity dimension, snapshot binding,
and complete proposal and settlement histories.

```text
caller-retained presented pin
  + exact previous and candidate v2.2 packages
  -> compare every pin binding to the previous package
  -> compose the unchanged v2.3 pairwise classifier
  -> typed hold, replay, recheckpoint, or forward classification
  -> optional review-only successor-pin proposal
```

Exact anchored-package replay never creates new pin state. Only an exact-history
recheckpoint or a strict v2.3 forward candidate can produce a successor-pin
proposal, and that proposal binds its predecessor pin. No proposal is retained
or adopted by this module; every outcome requires review and authorizes zero
autonomous actions.

If the original pin is separately retained, jointly replacing both presented
checkpoint packages produces a typed pin mismatch. This is conditional relative
integrity, not authenticated origin or rollback prevention. Replacing the pin
together with both packages still produces another internally valid chain. A
self-digest cannot prove who made, authorized, retained, protected, or most
recently observed the pin.

The runtime performs no filesystem write, network call, signing, provider
invocation, experiment, evaluation, learning, installation, adoption,
promotion, merge, Foundation mutation, or `CANON`. Receipts retain references,
counts, booleans, typed drift dimensions, and domain-separated digests—not PEMs,
signatures, private keys, ledger paths, model output, or private context.

Run:

```powershell
node shared/model-shadow-history-checkpoint-pin-transition/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
