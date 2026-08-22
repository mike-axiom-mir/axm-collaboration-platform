# Evidence routes

Status: `TEST`

| Claim | Native verifier | Preserved counterevidence |
|---|---|---|
| Only an exact v1.8 forward extension is eligible | v1.9 self-test exact receipt plus non-forward rejection path; v1.8 self-test | No source currentness follows from v1.8 alone |
| Candidate source matched the candidate checkpoint before write | v1.9 source-extension and rollback refusals plus accepted v1.7 exact-match audit | Capture and append are not atomic; later currentness is false |
| One local root serializes winning appends | v1.9 two-entry chain, concurrent writers, canonical reload, corrupt-entry fail closed | Two roots accept divergent forks; deletion reopens sequence one |
| Persisted entry can exact-rebuild | v1.9 caller-package verification in current and fresh processes | Reload alone cannot reverify upstream signatures because rebuild inputs are not persisted |
| Stored artifact is bounded and minimized | v1.9 byte bound and stored-text assertions; entry schema and contract | Receipt summaries remain local data; no privacy or authority claim follows |
| Authority remains absent | v1.9 truth object, contract, independent-root/deletion tests | Confirmation is not authentication; Mike Tobi remains merge/CANON gate |
| Repository compatibility | `CHECK_RESULTS.json` focused lineage and required AGENTS commands | No browser claim: module has no visual surface |

The evidence does not route any claim to provider execution, real review, authenticated identity, independent custody/controllers, anti-collusion, trusted time, external retention, protected monotonicity, rollback prevention, benefit, learning, adoption, promotion, merge, or `CANON`.
