# Mirror immutable batch concurrent-commit repair — WORKING action report

Date: 2026-07-18  
Status: WORKING infrastructure, not CANON

## Preserved failure

During a real concurrent automatic-practice run on Windows, a Route Readiness
writer completed an identical content-addressed destination after another
process passed its initial existence check. The losing rename returned
`EPERM`. The failure and losing stage were preserved; no claim was made that
the batch system already handled the race.

A later settled-Workshop practice run exposed a second Windows schedule:
`EPERM` was returned while the destination did not exist. No identical winner
was available to reuse. The complete provider-declaration-hand stage remained
preserved at
`state/provider-declaration-hand-runs/.stage-reasoning-provider-declaration-hands-78a42e22a96ad868d07d-27924`.
This was a transient rename-lock seam, not the earlier losing-writer seam.

## Repair

`kernel/immutable-batch-store.js` is a dependency-free hard-coded cell shared
by twenty-five active immutable batch, learning-cycle, language shadow,
independent language-exam, longitudinal development-observatory evaluation,
Foundation observation-request, observation-execution, development-frontier,
evidence-hand-planner, capability-survey, and capability-affordance-exam-planner
writers. It requires the
stage and final directory to be distinct bounded children of one resolved
parent and requires the stage to be hidden.

The cell has three outcomes:

1. no destination exists: atomically rename the complete staged directory;
2. an identical destination exists or appears during `EPERM`, `EEXIST`,
   `ENOTEMPTY`, or `EACCES`: hash a sorted inventory of every directory and
   file path, byte length, and file SHA-256; reuse only an exact match;
3. destination bytes differ: throw `IMMUTABLE_BATCH_DIVERGENCE`, never mutate
   the winner, and retain the losing stage as evidence.

When Windows returns `EPERM`, `EACCES`, `EEXIST`, or `ENOTEMPTY` and no
destination exists, the cell now retries the identical
stage-to-absent-destination rename at most four times. Before each retry the
stage and destination are rechecked. An appearing winner enters the verified
identical-winner path. Persistent failure throws and preserves the stage.
Retries add no destination overwrite or delete authority.

Symlinks and special files are refused. The cell never deletes the destination,
never overwrites divergent bytes, and never treats a matching filename as
matching content.

The preserved `reasoning-handoff-graph-organ-v1-known-fail.js` was deliberately
not edited. It remains historical evidence and is not an active writer.

## Verification

Direct cell tests passed 6/6:

- normal new commit followed by identical reuse;
- simulated Windows loser that creates an identical winner and throws EPERM;
- transient Windows EPERM without a winner succeeds on the same bounded retry;
- persistent Windows EPERM without a winner preserves the complete stage;
- divergent winner/loser bytes preserve both and refuse the commit;
- cross-parent and visible-stage targets are refused.

Sixty-three focused regressions passed across every migrated organ and cycle.
Existing reuse and tamper tests prove that each writer still verifies its own
batch semantics in addition to the shared byte-level commit gate.

The real settled-Workshop practice rerun completed through the repaired
provider-declaration-hand commit with zero Workshop writes and no runtime,
permission, or authority promotion.

## Limits

- This is single-host filesystem coordination, not a distributed transaction.
- It assumes normal same-volume directory rename semantics.
- If cleanup of a verified identical losing stage is denied, the result records
  that the loser remains instead of deleting more broadly.
- File-level appenders use separate immutable receipt logic and were not
  silently routed through this directory cell.
- The settled-Workshop replay exercised one real transient schedule, but one
  success is not a substitute for repeated operational stress.

## Bound implementation

- Current cell and test byte sizes and SHA-256 values are bound in
  `STATUS.json` after the second repair.

Later changes must supersede these hashes rather than reuse this report's
evidence silently.
