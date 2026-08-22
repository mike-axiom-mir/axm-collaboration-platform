# Model Shadow Portable Pin Settlement Ledger v2.5

Status: `TEST` · installed: `false` · promoted: `false`

v2.5 is an explicitly invoked local storage adapter for v2.4 successor-pin
proposals. It exact-rebuilds the configured genesis pin package on every service
open and exact-rebuilds each eligible v2.4 transition before proposing it.

```text
exact v2.4 successor transition + explicit proposal confirmation
  -> exclusive-create pending proposal; settled pin head unchanged
exact original proposal package + separate settlement confirmation
  -> exclusive-create settlement; local derived pin head advances
```

Only one trailing proposal may remain pending. A fresh process can inspect it
and settle it when the caller presents the exact original package. Manifest,
proposal, and settlement receipts use strict canonical JSON, contiguous
12-digit sequences, self-digests, exclusive file creation, and file `fsync`.
Normal operations use one fixed transient exclusive lock; a crash can leave a
stale lock that fails closed and requires caller-owned recovery outside this
module.
Public artifacts retain references, counts, booleans, and digests—not raw keys,
signatures, private keys, configured paths, model output, or private context.
The large v2.4 rebuild packages are not written to the ledger.

This is real local persistence under one caller-owned root, but it is not
independent external retention or protected monotonic storage. Two roots can
settle divergent successors. Deleting or replacing a whole root can reopen or
replace local history. File `fsync` proves neither directory-entry nor hardware,
power-loss, remote-replication, or long-horizon durability.

The confirmation strings are declared intent, not authenticated host or human
review. Local settlement grants no provider execution, model adoption,
promotion, merge, Foundation mutation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-history-checkpoint-pin-settlement-ledger/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
