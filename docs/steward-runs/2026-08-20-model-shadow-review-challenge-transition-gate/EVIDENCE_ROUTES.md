# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Recorded evidence | Boundary |
|---|---|---|---|
| Both presented chains are exact | v0.6 canonical rebuild | Previous and candidate must rebuild before comparison | Caller origin and retention remain unauthenticated |
| Exact replay differs from forward transition | Focused deterministic pair | Same receipt is consistent replay with forward admissibility false | No global replay authority |
| Forward checkpoint extension is pairwise consistent | Canonical entry-set comparison | Same ledger/anchor, no prior removal/replacement, later checkpoint, one exact added challenge | Pairwise admissibility is not adoption authority |
| Anchor identity drift is held | Exact anchor references | Different anchor id produces typed hold | Host anchor identity is unauthenticated |
| Self-declared epoch rollback is held | Exact integer comparison | Lower candidate epoch produces typed hold | Epoch is not protected monotonic state |
| Same-epoch anchor equivocation is held | Anchor digest comparison | Different digest at same anchor identity and epoch produces typed hold | Only presented policies are compared |
| Checkpoint equivocation is held | Checkpoint ids, digests and times | Reused id, alternate chain for same checkpoint, time collision and metadata-only change each hold | Caller time is not trusted time |
| Entry fork or replacement is held | Canonical challenge-entry maps | Missing and replaced prior entries retain exact digest evidence | Detection does not repair or prevent rollback |
| Withheld forks are not hidden | Three exact synthetic chains | Fork A and B each extend prior; A-to-B comparison holds | Unpresented branches remain invisible |
| Transition survives restart | Fresh independent Node process | Serialized pair and receipt rebuild exactly | Test file is not independent external retention |
| No consequential authority | Contract, schema, truth fields and tamper tests | Host/identity/human/execution/adoption/promotion/merge/CANON fields remain false | Mike remains merge and CANON gate |
| Source identity | Normalized byte digests | `SOURCE_SNAPSHOT.json` | Forty-four named inputs only |
| Required regressions | Process exit codes | `CHECK_RESULTS.json` | Passing stdout is not retained |
| Browser behavior | Browser render/click evidence | `NOT_RUN` | No browser surface exists |
| Human/provider benefit | Real review, execution, evaluation and held-out outcome | `UNKNOWN` / `NOT_RUN` | Synthetic fixtures cannot substitute |
