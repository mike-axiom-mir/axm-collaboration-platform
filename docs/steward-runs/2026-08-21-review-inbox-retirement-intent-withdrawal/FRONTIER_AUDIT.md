# Grounded-growth frontier audit: retirement-intent withdrawal

Status: `TEST`

## Exact starting frontier

The starting commit is v4.8
`5087e5dc6d7744b9814d6b4697a1ae299e44b773`. Its retirement recovery can
explicitly resume intent-only evidence or finalize exact quarantined evidence,
including bounded convergence at two recovery checkpoints. The baseline audit
loads the exact parent runtime blob and records that it exports no withdrawal
method, decision schema, withdrawal schema, CLI command, or Review Inbox
withdrawal contract.

That left an operator with no append-only way to say “do not continue this exact
interrupted intent.” Simply adding withdrawal beside recovery would have allowed
proceed and withdrawal to race without a shared durable choice.

## Bounded seam selected

The selected seam is an exclusive per-intent decision file with exactly two
states: `PROCEED_RETIREMENT` and `WITHDRAW_RETIREMENT_INTENT`. It is bound to the
exact intent-byte digest and owner digest. Direct retirement and resume claim
proceed before owner quarantine; explicit host-local withdrawal claims withdraw.
Exclusive create arbitrates cooperating callers on one host.

Withdrawal is available only for exact undecided intent-only evidence while the
current owner bytes match the intent digest. It uses a closed request schema,
separate assertion, id/digest-bound confirmation, and bounded reason. It retains
the intent and decision, mutates no owner-lock bytes, creates no quarantine or
retirement result, and exposes no API or browser route.

## Evidence and remaining limits

The focused suites cover deterministic interleavings and two real processes in
both winner orders. They also cover duplicate withdrawal, changed owner evidence,
corrupt decision evidence, ambiguity repair, inherited recovery behavior, and
public refusal boundaries. A clean exact product slice repeats the same results.

The evidence supports a cooperating-single-host arbitration point only. It does
not establish general cancellation safety, a cross-file transaction, authenticated
holder liveness or termination, multi-host/network-filesystem behavior, external-
writer exclusion, protected storage, actual human participation, benefit,
learning, execution, adoption, promotion, merge, Foundation mutation, or CANON.
The broad grounded-growth objective remains active.
