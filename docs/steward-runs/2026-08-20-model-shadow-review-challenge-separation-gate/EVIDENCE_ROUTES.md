# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Recorded evidence | Boundary |
|---|---|---|---|
| v0.5 anchored chain is exact before separation | Canonical rebuild and structural validators | Exact anchored-witness rebuild precedes every set comparison | Anchor and pin remain caller-presented |
| v0.5 permits cross-layer key reuse | Valid synthetic Ed25519 chain | One witness key is reused by an anchor authorization and v0.5 verifies | Synthetic proof only |
| v0.6 refuses cross-layer key reuse | Focused execution on the same valid v0.5 chain | Shared fingerprint produces a typed refusal | Different fingerprints may share custody |
| v0.5 permits cross-layer declared-principal reuse | Valid synthetic chain with distinct keys | One actor digest is reused as an anchor steward digest and v0.5 verifies | Digests are caller declarations |
| v0.6 refuses declared-principal reuse | Focused execution on the same valid v0.5 chain | Shared declared digest produces a typed refusal | Different digests may name one controller |
| Separation receipt is privacy-bounded | Serialized receipt inspection | Only domain-separated set digests and counts are retained | Upstream caller package still contains its own verified evidence |
| Separation receipt rebuilds exactly | Canonical rebuild plus receipt mutation | Deterministic copy passes; authority tamper fails with recomputed digest | Caller time is not trusted time |
| Non-overlap does not prove independent controllers | Single synthetic process owns all distinct fixture keys | Valid passing counterexample plus explicit false truth fields | No real identity or custody attestation |
| Separation survives restart | Fresh independent Node process | Serialized package rebuilds before current-ledger comparison | Test file is not independent external retention |
| Exact and forward states remain distinct | Fresh process plus exact challenge digest | Exact match and one-entry extension classifications | No adoption or execution authority |
| Missing entry is detected against separated checkpoint | Fresh process after exact owned-file deletion | Missing challenge produces rollback/replacement classification | Detection does not prevent or restore rollback |
| Invalid, absent and different state hold | Corrupt file, verified temporary namespace deletion, different manifest | Three bounded hold classifications | No automatic repair |
| No consequential authority | Contract, schemas, truth fields, negative tamper tests | Host/custody/identity/human/execution/promotion/merge/CANON fields remain false | Mike remains merge and CANON gate |
| Source identity | Normalized byte digests | `SOURCE_SNAPSHOT.json` | Thirty-seven named inputs only |
| Required regressions | Process exit codes | `CHECK_RESULTS.json` | Passing stdout is not retained |
| Browser behavior | Browser render/click evidence | `NOT_RUN` | No browser surface exists |
| Human/provider benefit | Real review, execution, evaluation and held-out outcome | `UNKNOWN` / `NOT_RUN` | Synthetic fixtures cannot substitute |
