# Grounded-growth frontier audit

Status: `TEST`

## Audited frontier

v4.3 serialized cooperating single-host Review Inbox mutations with an
exclusive-create operation lease. That truthfully failed closed after a crash,
but it left no bounded mechanism for an operator to preserve and retire
abandoned lock evidence. The baseline reproduction executes the exact v4.3
lease Git blob from a temporary module copy: a child exits while holding the
lease, status remains `HELD`, and the next mutation returns
`REVIEW_OPERATION_BUSY`. The exact baseline exported neither a retirement plan
nor retirement method. This reproduces the operability gap, not production
crash frequency or proof that a real holder died.

## Implemented seam

v4.4 adds a read-only retirement plan and a separate explicit host-local CLI.
The plan binds an operator challenge to SHA-256 of the exact raw owner bytes.
Retirement accepts only the closed v1 request schema, exact
`HOLDER_TERMINATED_OR_ABANDONED` assertion, current digest, exact confirmation,
and a bounded reason. It refuses an owner attributed to the actual current
process or the same lease instance.

After validation, the implementation exclusively writes an intent, re-reads
and matches the exact owner digest, atomically renames those raw bytes into the
local retirement-evidence directory, verifies the quarantined digest, and
exclusively writes the result. A regression fixture proves that an evidence
filename collision cannot unlink pre-existing evidence. Another fixture proves
that changed owner bytes invalidate an earlier challenge.

The existing acquisition loop now retries transient Windows `EPERM` within the
same bounded contention window. Persistent `EPERM` with no readable lock is
reported as typed `LEASE_EVIDENCE_UNREADABLE` held state; it is never treated as
free and never triggers retirement.

## Evidence and counterevidence

The new retirement suite passed 79 assertions; the lease suite passed 54,
including eight-process preservation plus deterministic transient and
persistent `EPERM` cases. Review Inbox passed 117 assertions. The whole bounded
run passed 68/68 commands and 6,253 focused assertions, including all ten
AGENTS.md commands. A clean archive of the product commit passed 10/10 selected
commands across 590 tracked files and left them byte-unchanged.

No browser-facing HTML, JavaScript, or CSS changed. The native surface is the
local CLI and persistence path, so no new live browser run is claimed. Static
and runtime assertions confirm there is no API or browser retirement route.

`verify.js` reported the tools index structurally current with 211 tools and
1,853 capabilities, while preserving 39 warnings. Review Inbox v0.8 remains
`TEST`; its index promotion state is `BLOCKED` because the aggregate selftest
receipt is stale for the changed selftest digest. A full history-rewriting index
verification was not run or converted into a passing claim.

## Boundary

The explicit operator assertion does not prove termination, abandonment,
identity, participation, or retirement safety. This is not automatic stale
recovery, cross-file ACID, multi-host/network-filesystem safety, exclusion of
noncooperating writers, protected or rollback-resistant evidence custody, real
host policy, live signed review, trusted time, accessibility/usability evidence,
human benefit, learning, provider execution, reconciliation, adoption,
promotion, merge, Foundation mutation, or `CANON`. Mike Tobi / AXM remains the
merge and `CANON` gate. The broad grounded-growth objective remains active.
