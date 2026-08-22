# Grounded-growth frontier audit

Status: `TEST`

## Audited frontier

v4.4 made abandoned Review Inbox lease evidence explicitly retireable, while
truthfully denying cross-file atomicity. Its order is intent write, raw-lock
rename, then result write. The exact v4.4 Git blob was interrupted after intent
and after rename. The first state had one intent, the unchanged matching lock,
and no evidence/result. The second had one intent and exact quarantined bytes,
no lock, and no result. The ordinary retirement plan reported the second state
as `FREE`; no recovery status or method existed. This proves the two bounded
interleavings, not their production frequency or holder death.

## Implemented seam

v4.5 adds `retirementRecoveryStatus()`. It opens the local retirement directory
and reads at most 201 entries to classify and emit at most 200 records. Intent,
owner-evidence, and result files are each capped at 64 KiB. Runtime validation
is closed and semantic rather than dependent on JSON property order. Valid
complete, superseded, intent-only, quarantined-without-result, missing, changed,
ambiguous, current-process, invalid, oversized, non-file, unrecognized, and
digest-mismatched states receive explicit reason codes.

`recoverRetirement()` accepts only a closed v1 request containing the exact
action, retirement id, owner digest, `HOLDER_TERMINATED_OR_ABANDONED`
assertion, action/id/digest-bound confirmation, and 20–500-character reason.
`RESUME_RETIREMENT` rechecks the exact current lock bytes before quarantine.
`FINALIZE_RESULT` rechecks exact quarantined bytes before writing the missing
ordinary retirement result. Complete evidence returns `ALREADY_COMPLETE`
without adding files. A fresh ReviewService mutation after an exact resumed
fixture proves restart continuity at this synthetic scope.

The only entry point is the local administration CLI. There is no automatic,
API, or browser recovery route. Review Inbox remains `TEST` at v0.9 and its
tools-index promotion state remains `BLOCKED` because the aggregate selftest
receipt is stale for the changed selftest digest.

## Evidence and counterevidence

The new suite passed 105 assertions across both interruption windows, exact
resume/finalize, wrong/open requests, idempotency, restart, corruption, bounds,
CLI behavior, and route absence. Inherited retirement, lease, Review Inbox, and
discovery suites passed 79, 54, 134, and 24 assertions/controls. The complete
bounded receipt passed 69/69 commands with 6,378 focused assertions, including
all ten AGENTS.md commands. A clean 594-file product archive passed 11/11
selected commands and remained byte-unchanged.

`npm run test:operations` is not claimed as passing. It passed the v4.5 and
operations/roadmap portions, then the inherited verification-proof-lab failed
with `CURATED_VERIFICATION_INTAKE_MISSING`. Its service blob is identical at
baseline and product commits; the expected intake directory is tracked in
neither tree and is absent from this workspace; v4.5 touched none of that lane.
The receipt therefore classifies this exact probe as `FOREIGN_FAILURE` without
creating substitute intake data or weakening the test.

No browser-facing HTML, JavaScript, or CSS changed. The native surface is the
local CLI and filesystem persistence path, so no new browser run is claimed.

## Boundary

The repeated operator assertion is not authenticated fact and proves neither
termination nor safety. This is not automatic stale recovery, crash-atomic
storage, cross-file ACID, multi-host/network-filesystem safety, exclusion of
noncooperating writers, protected or rollback-resistant custody, real identity,
human participation, trusted time, live host policy, accessibility/usability,
human benefit, learning, provider execution, reconciliation, adoption,
promotion, merge, Foundation mutation, or `CANON`. Mike Tobi / AXM remains the
merge and `CANON` gate. The broad grounded-growth objective remains active.
