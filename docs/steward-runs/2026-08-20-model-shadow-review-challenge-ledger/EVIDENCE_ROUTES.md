# Evidence routes

Status: `TEST`

| Claim | Required proof surface | Recorded route | Boundary |
|---|---|---|---|
| Signed-review input remains exact | Deterministic exact rebuild | Upstream verifier is called before any state directory or entry write; invalid receipt test leaves entry count unchanged | Caller policy still unauthenticated |
| Explicit write intent | Refusal plus filesystem observation | Wrong confirmation throws `CONFIRMATION_REQUIRED`; the namespace is absent afterward | Phrase and library call are not a host-authorized trusted entry point |
| Ledger identity persists | Restarted state read | Create-once `ledger.json` is reloaded; a conflicting id is refused | Caller id/root are unauthenticated |
| Same-ledger replay is refused | Fresh process and persisted state | First child exits 0; second fresh child exits 17 with `CHALLENGE_ALREADY_CONSUMED` | Only while state is preserved |
| Concurrent replay is serialized | Concurrent independent processes | Two child processes yield one exclusive-create winner and one typed replay loser | Tested on the current filesystem only |
| Corruption fails closed | Negative persisted-state tests | Invalid JSON, recomputed-digest truth tamper, missing manifest with entries, and conflicting id are refused | Recovery remains a steward action |
| Persistence is not protected | Destructive counterexample in owned temp state | Deleting the verified temporary namespace permits the same challenge again | No deletion/rollback resistance claim |
| Single-use is not global | Independent state-root counterexample | The same signed challenge is consumed in a second caller state root | No global authority or shared store |
| Receipt integrity | Deterministic exact rebuild plus persisted comparison | Detached receipt rebuild and new-instance `verifyPersisted` pass; authority tamper fails | Caller timestamps are untrusted |
| No execution/CANON authority | Contract, schema, receipt truth, negative tests | All consequential truth fields remain false | Mike remains merge and CANON gate |
| Source identity | Normalized byte digests | `SOURCE_SNAPSHOT.json` | Fifteen named inputs only |
| Required repository regression checks | Process exit codes | `CHECK_RESULTS.json` | Passing stdout is not retained |
| Browser behavior | Browser render/click evidence | `NOT_RUN` | No browser surface exists in this leaf |
| Human/provider benefit | Real review, execution, evaluation, held-out outcome | `UNKNOWN` / `NOT_RUN` | Synthetic fixtures cannot substitute |
