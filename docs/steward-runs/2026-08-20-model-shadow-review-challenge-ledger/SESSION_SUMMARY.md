# Model Shadow review challenge ledger session summary

Status: `TEST`

## Outcome

This session adds a caller-scoped, append-only challenge ledger after the
stacked Model Shadow signed-review leaf. An exact confirmation and exact-rebuild
signed-review receipt can create one challenge-digest entry with filesystem
exclusive-create semantics and file fsync. Fresh-process and concurrent tests
demonstrate replay refusal while that state is preserved.

## Truth and authority decisions

- An immutable manifest binds one caller ledger id to one state root, but
  authenticates no host or authorization authority.
- Existing entries survive a new service instance and a new Node process.
- Two concurrent processes produce one winner and one typed replay loser.
- Corrupt or boundary-invalid persistent state fails closed for steward repair.
- A second state root can accept the same challenge, and deletion of the first
  namespace can reopen it. Global single-use, rollback resistance, and protected
  storage are not claimed.
- Caller time remains untrusted. Generated keys and approvals prove no actual
  human review.
- Challenge consumption grants no provider, execution, evaluation, adoption,
  training, promotion, merge, Foundation, or `CANON` authority.

## Evidence

- `SOURCE_SNAPSHOT.json` binds fifteen normalized implementation and upstream
  contract inputs.
- `CHECK_RESULTS.json` records focused and AGENTS.md commands without retaining
  passing stdout.
- Before/after inventories and comparator-built gap reports preserve the exact
  bounded transition and unresolved protected/external capabilities.
- `SESSION_SEGMENT.jsonl` plus its seal preserves durable decisions and the
  deletion counterexample.

## Open seams

Protected storage, deletion/rollback resistance, global challenge authority,
host trust and authorization, actual human review, provider execution,
challenger evaluation, held-out human benefit, and learning remain `UNKNOWN` /
`NOT_RUN`. Mike remains the merge and `CANON` gate.
