# Grounded-growth frontier audit

Status: `TEST`

## Audited frontier

v4.7 supplied explicit, digest-bound recovery for an interrupted Review Inbox
lease retirement. Its authorization and evidence validation were exact, but
two callers could independently observe the same recoverable state. At the
lease-move checkpoint, one caller could move `operation.lock` before the other
called `rename`, leaving the latter with raw `ENOENT`. At exclusive result
publication, one caller could publish before the other opened the same path,
leaving the latter with raw `EEXIST`.

The exact v4.7 Git blob reproduced both interleavings. This establishes the two
bounded behaviors, not their production frequency, the operator assertion's
truth, or holder termination.

## Implemented seam

v4.8 observes a recognized competing checkpoint for at most a configured,
capped interval. A result counts as complete only when the original intent is
exact, the quarantined owner bytes match its SHA-256 digest, and the ordinary
retirement result is schema-valid and exactly bound to the intent. A caller may
continue finalization only while the exact quarantine exists and the result is
still missing. Anything else becomes a typed held refusal after the bound.

The default observation bound is 250 ms with 5 ms retries; caller-supplied
bounds are capped at 5,000 ms and 100 ms respectively. No new recovery lock was
added, avoiding another crash-residue owner. Recognized lease-move races are
`ENOENT`, `EEXIST`, and `EPERM`; unknown I/O errors still surface rather than
being mislabeled as convergence.

Review Inbox v1.0 declares cooperating single-host exact-checkpoint
convergence and typed collision holds. Its contract expressly refuses treating
that seam as general serialization, a cross-file transaction, or cancellation
safety. Runtime truth fields make the same limits machine-readable.

## Evidence and counterevidence

The reentrant adversarial suite passed 30 assertions and includes invalid
result plus corrupt quarantine collisions. The two-process suite passed 20
assertions at real filesystem checkpoints. Inherited recovery, retirement,
lease, Review Inbox, discovery, and operations suites bring the focused total
to 539 assertions and controls. All ten repository-required commands exited
zero. The clean archived product slice passed 7/7 commands across 97 tracked
files without modifying them.

`npm run test:operations` is not claimed as passing. It reached both new suites,
then stopped at `CURATED_VERIFICATION_INTAKE_MISSING`. The failing service and
selftest blobs and the modular-intake command are identical in parent and
product. The expected intake is present in neither Git tree nor this workspace,
and v4.8 touched none of that lane. The exact probe is therefore retained as a
`FOREIGN_FAILURE` without substitute data or a weakened check.

No HTML, CSS, or browser application file changed. Script compilation does not
substitute for browser rendering, so no new browser run is claimed.

## Boundary

This seam does not prove general recovery serialization, arbitrary concurrent
mutation safety, cancellation or withdrawal safety, cross-file ACID,
multi-host/network-filesystem behavior, external-writer exclusion, protected
or rollback-resistant custody, holder termination, real identity, actual human
participation, accessibility or usability, human benefit, learning, provider
execution, adoption, promotion, merge, Foundation mutation, or `CANON`.
Mike Tobi / AXM remains the merge and `CANON` gate. The specialist ZIP intake
lane remains untouched, and the broad grounded-growth objective remains active.
