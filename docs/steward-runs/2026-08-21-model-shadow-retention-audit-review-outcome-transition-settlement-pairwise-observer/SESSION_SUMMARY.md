# v3.8 pairwise-observer session summary

Status: `TEST` · installed: `false` · promoted: `false`

## Outcome

Implemented a read-only observer for two caller-presented current v3.7 local
settlement frontiers. Each side must have equal bracketing snapshots, an exact
caller-package rebuild, no pending proposal, and a supplied receipt matching the
current last settlement and head. The receipt persists minimized references,
heads, counts, classification, and explicit negative truth claims only.

The observer distinguishes exact replay, matching heads, either direction of one
latest-receipt extension, same-local-epoch different heads, different-epoch
relation unresolved, identity mismatch, and held observation. All seven side
observations and all eight pairwise classifications execute.

## Verification

- 56/56 commands passed.
- 5,237 focused assertions passed across 46 focused commands.
- All 10 required AGENTS checks passed.
- Normalized source snapshot: 319 files.
- Capability result: before `BLOCKED` (1 required ready, 20 blocked, 13 optional
  gaps); after `DEGRADED` (21 required ready, 13 optional unknown).
- Browser verification: not applicable.
- Independent Draft 2020-12 schema meta-validation: unrun; no validator was
  installed because none was already available.

## Post-green corrections retained

The first full focused suite passed 93 assertions. A truth audit then found that
an exact-but-older package would lose its independent exact-rebuild fact and that
v3.7 settlement-root snapshots were mislabeled as live source observations.
Exactness and current-receipt matching are now separate, and the receipt
explicitly denies live v3.6 source recapture and source-entry currentness.

The corrected suite passed 97 assertions. A second audit found that one broad
different-head classification could call different epochs a fork despite
missing complete histories. It was split into same-epoch different heads and
different-epoch relation unresolved; time ordering now applies independently to
each exact-rebuilt package. The final suite passed 103 assertions.

## Exact boundaries

The observer reads but never writes the two roots. It compares only current
snapshots and latest settlement receipts, not complete histories. Matching heads
do not prove matching histories, different epochs do not prove a fork, and a
one-receipt extension proves no global order. Withheld frontiers remain invisible
and jointly replacing both pairs can produce another exact replay.

The observer authenticates no root, controller, host, actor, human, policy, or
origin and grants no external custody, retention, globality, benefit, learning,
execution, adoption, installation, promotion, merge, Foundation mutation, or
CANON authority.

No incoming specialist ZIP package was inspected or modified. The dirty shared
main checkout, foreign worktrees, and global tools-index lane were not edited.
Mike Tobi / AXM remains the merge and `CANON` gate.
