# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Recorded evidence | Boundary |
|---|---|---|---|
| v0.4 witness is exact before anchoring | Canonical witness rebuild and validators | Stacked witness validator plus focused mutation cases | Caller witness policy is not authenticated host authority |
| Expected anchor digest matches exact anchor | Exact string and self-digest comparison | Wrong pin and repinned-policy cases fail | Both digest and anchor remain caller-presented |
| Anchor signatures bind exact chain | Ed25519 verification and payload mutation | Authorizations bind anchor, pin, witness, witness policy, checkpoint, manifest, and entries digests | Anchor policy itself is unauthenticated |
| Signature threshold uses distinct seats | Focused execution with duplicate-key and duplicate-steward counterchecks | Two-key fixture passes; duplicate fingerprints and steward digests fail | Steward digest and declared kind are not authenticated identity |
| Runtime refuses private keys | Parser boundary and negative key fixture | PKCS8 private-key PEM is refused before verification | Synthetic private keys exist only in selftest memory |
| Anchored receipt is privacy-bounded | Serialized receipt inspection | Raw keys, signatures, key ids, authorization ids, identity strings, and state paths are absent | Digested steward and key-linkage evidence remains |
| Witness-policy substitution is blocked under fixed pin | Independent valid v0.4 replacement policy and witness | Original anchor authorizations fail against replacement witness-policy chain | This is conditional on holding the presented anchor and pin fixed |
| Joint anchor-and-pin substitution is not hidden | Independent replacement anchor, pin, and signatures | Replacement chain verifies and has distinct anchor and witness digests | Proves why authenticated host trust remains false |
| Anchored chain survives restart | Fresh independent Node process | Serialized chain rebuilds before current-ledger comparison | Test file is not independent external retention |
| Exact and forward states remain distinct | Fresh process plus exact challenge digest | Exact match and one-entry extension classifications | No adoption or execution authority |
| Missing entry is detected against anchored checkpoint | Fresh process after exact owned-file deletion | Missing challenge produces rollback/replacement classification | Detection does not prevent or restore rollback |
| Invalid, absent and different state hold | Corrupt file, verified temporary namespace deletion, different manifest | Three bounded hold classifications | No automatic repair |
| No consequential authority | Contract, schemas, truth fields, negative tamper tests | Host/pin/identity/human/execution/adoption/promotion/merge/CANON fields remain false | Mike remains merge and CANON gate |
| Source identity | Normalized byte digests | `SOURCE_SNAPSHOT.json` | Twenty-nine named inputs only |
| Required regressions | Process exit codes | `CHECK_RESULTS.json` | Passing stdout is not retained |
| Browser behavior | Browser render/click evidence | `NOT_RUN` | No browser surface exists |
| Human/provider benefit | Real review, execution, evaluation and held-out outcome | `UNKNOWN` / `NOT_RUN` | Synthetic fixtures cannot substitute |
