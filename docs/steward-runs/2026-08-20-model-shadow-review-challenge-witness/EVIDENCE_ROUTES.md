# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Recorded evidence | Boundary |
|---|---|---|---|
| Checkpoint is exact before witnessing | Canonical rebuild and structural validators | v0.3 checkpoint validator plus focused mutation cases | Self-digest alone is not authenticated origin |
| Signatures bind exact checkpoint state | Ed25519 verification and negative payload mutation | Policy and attestations bind checkpoint, ledger-manifest and entries digests | The policy itself is caller-supplied |
| Signature threshold uses distinct seats | Focused execution with duplicate-key and duplicate-actor counterchecks | Two-key fixture passes; duplicate fingerprints and actor digests fail | Declared actor kind is not authenticated identity |
| Runtime refuses private keys | Parser boundary and negative key fixture | PKCS8 private-key PEM is refused before verification | Synthetic private key exists only in selftest memory |
| Witness receipt is privacy-bounded | Serialized receipt inspection | Raw keys, signatures, key ids, attestation ids and state paths are absent | Digested actor and key-linkage evidence remains |
| Witness survives restart | Fresh independent Node process | Serialized witness package rebuilds before current-ledger comparison | Test file is not independent external retention |
| Exact and forward states remain distinct | Fresh process plus exact challenge digest | Exact match and one-entry extension classifications | No adoption or execution authority |
| Missing entry is detected against signed checkpoint | Fresh process after exact owned-file deletion | Missing checkpoint challenge produces rollback/replacement classification | Detection does not prevent or restore rollback |
| Invalid, absent and different state hold | Corrupt file, verified temporary namespace deletion, different manifest | Three bounded hold classifications | No automatic repair |
| Caller-policy substitution is not hidden | Independent valid key-policy fixture | Replacement policy and keys produce a distinct valid witness | Proves why host trust remains false |
| No consequential authority | Contract, schemas, truth fields, negative tamper tests | Host/identity/human/execution/adoption/promotion/merge/CANON fields remain false | Mike remains merge and CANON gate |
| Source identity | Normalized byte digests | `SOURCE_SNAPSHOT.json` | Twenty named inputs only |
| Required regressions | Process exit codes | `CHECK_RESULTS.json` | Passing stdout is not retained |
| Browser behavior | Browser render/click evidence | `NOT_RUN` | No browser surface exists |
| Human/provider benefit | Real review, execution, evaluation and held-out outcome | `UNKNOWN` / `NOT_RUN` | Synthetic fixtures cannot substitute |
