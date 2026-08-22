# Two-phase settlement portable history checkpoint v2.1

Status: `TEST` · installed: `false` · promoted: `false`

This read-only leaf follows the v2.0 local two-phase settlement ledger. It exact-verifies every persisted proposal and settlement from caller-retained packages, brackets that verification with equal v2.0 snapshots, and emits a portable full-sequence reference checkpoint. A later audit compares an exactly verified current history with that caller-presented checkpoint.

The audit classifies exact match, forward extension, strict rollback, replacement or fork, ledger identity drift, absence, or ledger-or-configuration invalidity. Service configurations that cannot be constructed produce no audit receipt; later reload failures cannot always distinguish corrupt ledger state from a configuration that does not match that state. Rollback and replacement findings are relative to the exact checkpoint supplied to the audit. Replacing the checkpoint and ledger together can establish a different internally valid chain, while omitting the prior checkpoint removes its comparison boundary.

The checkpoint is portable data, not proof that anybody retained it. It is not an authenticated pin, external retention, protected monotonic state, deletion prevention, global fork exclusion, or host authorization. Equal reads before and after package verification are not an atomic filesystem snapshot and cannot exclude a transient change that reverts; the ledger can also change after the final read. The audit does not recapture the upstream local-possession source.

Public receipts contain ledger and sequence references, counts, classifications, and digests. They do not contain raw public keys, signatures, private keys, configured labels, source or ledger paths, model output, or private context. No execution, evaluation, adoption, learning, promotion, merge, Foundation mutation, or `CANON` authority is granted. Mike Tobi remains the merge/CANON gate.

Run:

```powershell
node shared/model-shadow-two-phase-history-checkpoint/selftest.js
```
