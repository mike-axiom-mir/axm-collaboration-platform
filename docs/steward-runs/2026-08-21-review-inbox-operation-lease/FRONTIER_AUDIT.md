# Grounded-growth frontier audit

Status: `TEST`

## Audited frontier

v4.2 made signed Review Inbox operations intent-first and recoverable through an
exact-confirmed host-only service method, but the ordinary review projection,
signed intent ledger, and related mutations still used independent read/modify/
write cycles without one cooperating-host operation boundary.

An initially natural concurrent probe was inconclusive. A deterministic barrier
then executed the exact v4.2 `review-service.js` source, with loader substitution
only and the same normalized `operations-utils.js`. Eight children read before
any write; the final readable state contained one item, so seven writes were
lost and four children failed during competing atomic replacement. This proves
the bounded interleaving, not its production frequency.

## Implemented seam

v4.3 adds a fixed `state/review-inbox/operation.lock` using exclusive creation.
All ordinary Review Inbox mutations and the complete signed submit, vote, and
recovery paths enter that same service-local lease. Reentrancy is limited to one
service instance. Callbacks must be synchronous. Wait duration is bounded by a
monotonic process clock.

Owner metadata is evidence, not a liveness oracle. Active contention returns
typed `REVIEW_OPERATION_BUSY` without mutation. Missing release evidence,
crash residue, malformed content, or token alteration remains held. There is no
automatic stale-owner theft and no browser unlock or recovery route.

## Evidence and counterevidence

The focused lease selftest has 48 assertions, including eight synchronized
writers, active contention, crash residue, invalid and altered evidence, and no
automatic theft. The bounded broad run passed 66/66 commands with 6,152 focused
assertions. A clean 583-file archived product slice passed 9/9 selected inherited
review commands and remained byte-clean. Live browser checks covered free and
held behavior at 1280×720 and held wrapping at 390×844 with zero observed console
warnings or errors.

The optional `npm run index:tools:verify` probe did not pass: existing failures
outside this seam remained in accessibility-adaptation-lab,
adapter-translation-garden, aetherfx, ai-habitat, memory-continuity-garden,
repair-resilience-library, text-fabric, universal-object-fabric,
verification-proof-lab, visual-mirror-platform-clone, visual-mold-foundry, and
workshop-command-center. Three mechanically touched world-tile fixture files
were verified normalization-identical and restored to their original CRLF bytes.

Two clean-replay approaches also failed before the selected slice passed: a
normal worktree checkout exceeded a Windows filename limit, and a full archive
extraction exceeded 180 seconds. Their exact temporary paths and registrations
were removed. These failures are not converted into product failures or hidden
as successes.

## Boundary

This is not cross-file ACID, multi-host or network-filesystem safety,
noncooperating writer exclusion, protected monotonic storage, rollback
prevention, real identity, human participation, trusted time, live host policy,
live signed review, accessibility/usability evidence, benefit, learning,
provider execution, reconciliation, adoption, promotion, merge, Foundation
mutation, or `CANON`. Mike Tobi / AXM remains the merge and `CANON` gate. The
broad grounded-growth objective remains active.
