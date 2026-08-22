# Evidence routes

Status: `TEST`

| Claim | Kind and native verifier | Preserved counterevidence |
|---|---|---|
| Checkpoint creation binds the complete exact v2.0 history | Deterministic behavior: every persisted proposal and settlement exact-rebuilds from its caller package; checkpoint endpoints and full reference arrays are asserted | A checkpoint self-digest does not authenticate its later presenter or prove retention |
| Movement during presentation is refused | Temporal behavior: an adversarial wrapper appends a real pending proposal between bracketing snapshots and creation fails with `LEDGER_MOVED_DURING_PRESENTATION` | Equal bracketing reads are not atomic and cannot exclude a transient change that reverts |
| Exact and forward histories are distinguished | Deterministic behavior: exact complete sequence and pending-then-settled extension fixtures | The ledger can change immediately after the final read |
| Strict rollback is detected relative to the checkpoint | Persistence comparison: a separately retained older valid root exact-rebuilds as a strict prefix of a later checkpoint | Detection depends on presenting that checkpoint and prevents no rollback |
| Replacement or fork is detected relative to the checkpoint | Deterministic counterexample: another valid same-identity root starts from genesis with a different first proposal | Jointly replacing checkpoint and root produces another exact relative chain |
| Identity drift, absence, and ledger-or-configuration invalidity are typed separately | Valid different-log root, empty root, corrupt canonical proposal fixture, and unconstructable-configuration refusal | Absence does not prove deletion cause; later reload failure cannot always separate state corruption from configuration mismatch and retains only a bounded error code |
| Checkpoint and audit rebuild across restart | Fresh-process child execution with exact caller packages | Fresh process is local and proves no external retention or independent controller |
| Audit is read-only | Before/after recursive content digest of the complete current ledger root plus runtime write-surface inspection | Read-only observation proves no protected monotonic storage or prevention |
| Repository compatibility | `CHECK_RESULTS.json` lineage checks and all AGENTS.md commands | No browser claim: the leaf has no visual surface |

No route proves atomic snapshotting, intermediate-change exclusion, later currentness, authenticated checkpoint origin or pin, external retention, protected monotonicity, deletion or rollback prevention, global uniqueness, global consistency, authenticated authority or identity, independent controllers, trusted time, provider execution, real review, benefit, learning, adoption, promotion, merge, or `CANON`.
