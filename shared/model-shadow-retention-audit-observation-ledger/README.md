# Model Shadow Local Retention Audit Observation Ledger v2.8

Status: `TEST` · installed: `false` · promoted: `false`

v2.8 is an explicitly invoked local persistence adapter over the v2.7 history
checkpoint retention audit. Before writing, it requires the complete live v2.7
audit input and receipt and exact-rebuilds them through the unchanged v2.7 API.
It then stores the complete minimized audit in a third caller-owned local root
that is distinct and nonnested from both compared roots.

```text
exact live v2.7 audit package + explicit unauthenticated confirmation
  -> canonical full-audit observation + exclusive create + file fsync
fresh process + observation root only
  -> complete chain validation + exact stored audit and summary reload
```

Observations use contiguous 12-digit names, a manifest reference, previous-record
references, self-digests, canonical JSON, exclusive file creation, and file
`fsync`. Duplicate audit digests, duplicate ids, non-forward caller times,
retention-manifest identity movement, corruption, gaps, extras, stale locks,
overlapping roots, oversized inputs, and concurrent duplicate writers fail
closed. Both held rollback/absence audits and non-held exact/forward audits are
preserved as observations; neither classification performs adjudication.

After capture, a fresh process can reload the exact observation when the source
and retention roots are unavailable because neither the audit input nor those
paths is retained. That is historical local evidence, not continuous monitoring
of later state. The same controller may own all three roots and caller times.
Joint deletion or replacement of all three roots defeats the original boundary
and can create another internally exact local triple.

File `fsync` proves neither directory-entry nor device, hardware, or power-loss
durability. The root is not independently operated external retention or
protected monotonic storage. Confirmation authenticates no host, actor, human,
organization, or policy. The module invokes no provider, experiment, evaluation,
learning, installation, adoption, promotion, merge, Foundation mutation, or
`CANON` action.

Run:

```powershell
node shared/model-shadow-retention-audit-observation-ledger/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
