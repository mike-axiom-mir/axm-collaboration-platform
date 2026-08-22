# Model Shadow Portable Pin-Settlement History Checkpoint v2.6

Status: `TEST` · installed: `false` · promoted: `false`

v2.6 is a no-durable-change adapter over the v2.5 local pin-settlement ledger. It
requires one deduplicated caller package per proposal, reconstructs each
settlement input from that proposal package, exact-verifies every persisted
receipt, and requires equal v2.5 snapshots before and after verification.

```text
exact complete v2.5 package sequence + equal bracketing snapshots
  -> portable self-digested checkpoint of every proposal, settlement,
     settled-pin reference, and derived local head
later exact complete v2.5 package sequence + caller-presented checkpoint
  -> exact / forward / relative rollback / replacement-or-fork /
     identity-drift / absent / invalid audit
```

One trailing pending proposal is checkpointable without moving the settled
head. Settling that proposal later is a forward history extension. Checkpoint
and audit packages exact-rebuild in a fresh process. Its source has no direct
filesystem API, but composed v2.5 inspect and verification calls create, fsync,
and remove the fixed transient operation lock. No durable receipt is written and
the v2.5 ledger is byte-identical after each normal completed call.

This is relative detection, not protection. Equal bracketing snapshots are not
an atomic filesystem snapshot and cannot exclude an intermediate change that
reverts. A caller may omit the checkpoint, or replace the checkpoint and ledger
together with another internally exact pair. Portable data is not proof of
external retention, protected monotonic state, rollback prevention, independent
custody, global uniqueness, or a globally consistent log.

Public checkpoint and audit receipts retain bounded references, counts,
classification flags, and digests. They do not retain the v2.5 rebuild packages,
raw public keys, signatures, private keys, configured paths, model output, or
private context. Caller times are untrusted. The module grants no host, identity,
human-review, provider, evaluation, execution, adoption, promotion, merge,
Foundation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-portable-pin-settlement-history-checkpoint/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
