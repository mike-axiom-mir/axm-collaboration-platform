# Evidence routes

Status: `TEST`

## `local_forward_append`

Claim: only an exact v0.7 forward extension of the exact current local head can
append the next entry.

Kind: deterministic behavior and local persistence. Risk: medium.

Pass condition: exact forward packages append in sequence; replay, HOLD,
tampering, and stale previous heads perform no append.

Primary surface: focused runtime assertions plus persisted entry inspection.
Counterevidence: any refused class appends, a stale branch advances the local
head, or sequence/count changes after refusal.

Observed evidence: focused selftest passes the two valid advances and typed
refusals. Verdict: `PASS` for one preserved caller-owned root.

Named seam: no authenticated host entrypoint.

## `local_restart_persistence`

Claim: a fresh process reloads the same local chain and derives the same head.

Kind: persistence. Risk: medium.

Pass condition: fresh-process snapshot digest matches; re-presented caller
package exact-rebuilds the persisted entry.

Primary surface: child Node process after the writer returns.
Counterevidence: missing/different snapshot, derived head mismatch, or failed
caller-package verification.

Observed evidence: both fresh-process checks pass. Verdict: `PASS` for the
preserved local filesystem state.

Named seam: reload without caller package does not reverify upstream
signatures.

## `local_concurrent_sibling_exclusion`

Claim: two processes extending the same local head cannot both occupy the next
sequence position.

Kind: deterministic behavior and persistence. Risk: medium.

Pass condition: exactly one child succeeds, one receives a typed local refusal,
and only one next sequence entry exists.

Primary surface: concurrent fresh-process contention.
Counterevidence: two winners, two entries, or an untyped success path.

Observed evidence: one winner, one typed loser, two total entries including the
seed. Verdict: `PASS` for one state root.

Named seam: filesystem and operating-system guarantees beyond reported file
`fsync` are not proven.

## `global_fork_exclusion`

Claim: the local ledger excludes all alternate branches globally.

Kind: persistence and transport. Risk: high.

Pass condition: all writers share an authenticated, externally retained,
globally consistent ordering authority.

Primary surface: independent receiver receipts or protected global-state
evidence. Counterevidence: two independent roots accept different candidates.

Observed evidence: the counterexample occurs. Verdict: `FAIL` as a global
claim; it is intentionally not a v0.8 acceptance condition.

Named seam: globally consistent external transition log.

## `rollback_resistance`

Claim: accepted local history cannot be deleted or rolled back.

Kind: persistence and authorization. Risk: high.

Pass condition: protected monotonic substrate rejects rollback after restart
and under denied identity.

Primary surface: protected-store recovery and authorization boundary tests.
Counterevidence: delete the namespace, reinitialize at genesis, accept another
branch.

Observed evidence: the counterexample occurs. Verdict: `FAIL` as a protected
state claim; intentionally not a v0.8 acceptance condition.

Named seam: caller-owned files are replaceable.

## `authority_and_human_outcomes`

Claim: recording authenticates a host or human and improves outcomes.

Kind: authorization, human participation, learning improvement, and quality.
Risk: high.

Pass condition: independent allowed/denied identity evidence, actual steward
review, held-out evaluation, and voluntary human outcome evidence.

Primary surface: host audit trail, real review receipt, provider evaluation,
and human outcome evidence. Counterevidence: synthetic fixtures and no external
actors.

Observed evidence: none was supplied or invoked. Verdict: `UNKNOWN`.

Named seam: Mike Tobi remains merge and `CANON` gate.

