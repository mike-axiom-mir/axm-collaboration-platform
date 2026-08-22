# Model Shadow portable retention-audit review-outcome history checkpoint

Status: `TEST` · installed: `false` · promoted: `false`

This read-only adapter adds a caller-portable relative-history boundary above
the v3.2 local review-outcome ledger:

```text
exact configured v3.2 ledger
  -> equal snapshot + one complete validated chain read + equal snapshot
  -> minimized full-history checkpoint
caller-retained checkpoint + later configured v3.2 ledger
  -> exact | forward | rollback | replacement/fork | identity | absent | invalid
```

The checkpoint commits the manifest and snapshot bindings, counts, endpoints,
and every ordered record/outcome reference, record time, and minimized
APPROVED/HOLD/REJECTED classification. It does not contain complete v3.2
records, complete v3.1 outcomes, actor digests, votes, raw actors, notes,
discussion, configured paths, model output, or private context. A fresh process
can self-validate the checkpoint after the origin ledger is gone, but origin
exact-rebuild still requires the configured ledger.

If an original checkpoint is separately retained, a later whole-ledger rewrite
is classified relative to it instead of being accepted as exact history. That
is conditional relative integrity, not proof that the checkpoint was retained,
authenticated, externally held, or original. Replacing or withholding the
checkpoint together with the ledger can establish another internally exact
pair. The audit excludes neither withheld branches nor global forks.

The before/after snapshots bound one complete v3.2 `readAll()` call but do not
form an atomic filesystem snapshot. They cannot exclude an intermediate change
that reverts or a change after the final read. The module writes no durable
state; the inherited v3.2 verifier may create and remove its declared transient
operation lock.

Every result remains review-only. An observed approval still does not resolve
the retention hold, authenticate a reviewer, choose remediation, authorize
execution or adoption, invoke a provider, perform an evaluation, prove benefit
or learning, install, promote, merge, mutate the Foundation, or grant `CANON`.

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-history-checkpoint/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
