# Model Shadow Local History Checkpoint Retention Ledger v2.7

Status: `TEST` · installed: `false` · promoted: `false`

v2.7 is an explicitly invoked local persistence adapter over the v2.6 portable
pin-settlement history checkpoint. It requires a retention root that is distinct
and nonnested from the v2.5 source root, exact-rebuilds the complete v2.6
checkpoint origin package, and then stores the full minimized checkpoint in an
exclusive-created, file-fsynced proposal.

```text
exact v2.6 checkpoint + exact origin package + proposal confirmation
  -> durable local observation, pending retention settlement
exact original proposal package + separate settlement confirmation
  -> local settled retention head advances
latest stored observation + exact current v2.5 presentation
  -> v2.6 exact / forward / rollback / fork / identity / absent / invalid audit
```

Only one trailing proposal may remain pending. The latest persisted observation
is available for audit whether pending or settled, but its status is explicit and
a pending observation grants no settled authority. After the first settlement,
new checkpoint proposals must be strict v2.6 forward extensions of the settled
retention head; replay, rollback, fork, identity drift, absent, and invalid
origin packages fail closed.

Manifest, proposal, settlement, and snapshot records use strict canonical JSON,
contiguous 12-digit sequences, self-digests, exclusive file creation, and file
`fsync`. A fixed transient operation lock fails closed if stale. Retained files
are capped at 256 MiB in aggregate. Fresh processes reload the complete chain,
validate every embedded v2.6 checkpoint, derive the settled head only from
settlements, and audit without the caller re-presenting a checkpoint.

This closes checkpoint omission only while one caller-owned local retention root
survives. It is not independently operated external retention, protected
monotonic storage, rollback prevention, or a globally consistent log. Deleting
or replacing both source and retention roots can create another internally exact
pair. File `fsync` proves neither directory-entry nor hardware or power-loss
durability. Proposal and settlement confirmation strings authenticate no host,
actor, human, organization, or policy authority.

Public retained artifacts include the full minimized v2.6 checkpoint but not its
origin packages, configured paths, raw keys, signatures, private keys, model
output, or private context. Composed v2.6 checks may create and remove the v2.5
transient operation lock but leave durable source-ledger bytes unchanged. The
module invokes no provider, experiment, evaluation, learning, installation,
adoption, promotion, merge, Foundation mutation, or `CANON` action.

Run:

```powershell
node shared/model-shadow-history-checkpoint-retention-ledger/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
