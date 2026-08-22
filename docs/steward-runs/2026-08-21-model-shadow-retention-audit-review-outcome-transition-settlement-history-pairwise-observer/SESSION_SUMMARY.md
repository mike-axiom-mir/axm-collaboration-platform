# v3.9 complete-history pairwise-observer session summary

Status: `TEST` · installed: `false` · promoted: `false`

## Outcome

Implemented a read-only comparison over two complete caller-presented v3.7
local proposal/settlement histories. It retains minimized artifact commitments,
normalized event-history digests, common-prefix length, and only the first
divergent event descriptors.

The observer distinguishes exact artifact replay, matching normalized history,
either complete prefix direction, earliest divergence, source mismatch, and
held observation. All six side observations and all seven pairwise
classifications execute.

## Verification

- 57/57 commands passed.
- 5,405 focused assertions passed across 47 focused commands.
- All 10 required AGENTS checks passed.
- Normalized source snapshot: 326 files.
- Capability result: before `BLOCKED` (1 required ready, 21 blocked, 12 optional
  gaps); after `DEGRADED` (22 required ready, 12 optional unknown).
- Browser verification: not applicable.
- Independent Draft 2020-12 schema meta-validation: unrun; no validator was
  installed because none was already available.

## Corrections and counterexamples retained

Two test-harness failures were preserved and fixed: one minimization assertion
matched an explicit negative truth field instead of a payload field, and one
nonexport assertion tried to canonicalize JavaScript `undefined`. The first
complete focused green then passed 164 assertions.

The first capability-evidence selftest later searched a shortened form of the
read-only focused assertion label. Its exact-label check was corrected without
weakening the read-only condition, and the failed evidence run remains in the
sealed session events.

The next evidence run also exposed a prose-check mismatch between “exact replay”
and “exact snapshot replay.” The checker now follows the frontier's exact wording;
the required complete-history counterevidence did not change.

A post-green audit strengthened the central counterexample. Two valid histories
can share the exact same v3.7 snapshot reference, final head, counts, local ids,
and latest settlement while differing in their first held settlement. v3.8
reports exact snapshot replay; v3.9 locates the first settlement divergence.
The strengthened final suite passed 168 assertions.

## Exact boundaries

The observer reads but never writes the two roots. It performs sequential
inspections and captures, not an atomic filesystem snapshot. Equal observations
do not exclude transient mutation/reversion or prove later currentness.

It rebuilds no caller package, recaptures no live v3.6 source, authenticates no
root/controller/host/actor/human/policy/origin, and grants no external custody,
globality, benefit, learning, reconciliation, execution, adoption, installation,
promotion, merge, Foundation mutation, or CANON authority.

No incoming specialist ZIP package was inspected or modified. The dirty shared
main checkout, foreign worktrees, and global tools-index lane were not edited.
Mike Tobi / AXM remains the merge and `CANON` gate.
