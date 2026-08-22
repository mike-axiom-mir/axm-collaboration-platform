# v3.7 transition-settlement session summary

Status: `TEST` · installed: `false` · promoted: `false`

## Outcome

Implemented a bounded two-phase local settlement adapter over committed v3.6.
Proposal exact-verifies one persisted v3.6 forward entry and records a pending
candidate without advancing the settled head. A separately confirmed settlement
rebuilds the exact proposal package, rechecks the source, and records either an
exact local head advance or a typed held result that preserves the prior head.

The final focused suite covers all five source-observation classifications and
all five resulting settlement classifications. It also proves that exact-entry
verification and bracketing-snapshot equality remain separate facts: a source
can change during the check even when the entry verification itself succeeds.

## Verification

- 55/55 commands passed.
- 5,134 focused assertions passed across 45 focused commands.
- All 10 required AGENTS checks passed.
- Normalized source snapshot: 312 files.
- Capability result: before `BLOCKED` (1 required ready, 27 blocked, 12 optional
  gaps); after `DEGRADED` (28 required ready, 12 optional unknown).
- Browser verification: not applicable.
- Independent Draft 2020-12 schema meta-validation: unrun.

## Failures and corrections retained

Four early focused failures were fixture defects, not product passes: the wrong
pending-result shape, a source-entry time preceding its upstream comparison, a
rollback fixture that first violated the entry-time bound, and a v3.7 namespace
helper mistakenly used against a v3.6 source root. Each was corrected without
relaxing a runtime gate.

After the first 151-assertion green run, a truth audit found that successful
entry verification was discarded when bracketing snapshots differed and that a
snapshot field overstated a settlement digest chain. The fields were narrowed.
A second audit found snapshot-null values could not distinguish absence from
invalidity and validation conflated capture health with entry verification. The
observation now stores explicit capture states and rederives classification.
The final focused suite passed 176 assertions.

The first capability-comparator command used an outdated script filename and
failed before replacing generated reports. The declared `compare_capabilities.py`
entry point then produced the deterministic before and after results.

## Exact boundaries

The last source check precedes the settlement write. It is not atomic, excludes
no transient change and reversion, and proves no postwrite currentness. File
`fsync` proves neither directory-entry nor hardware durability, and an injected
failure may leave inspectable bytes.

Independent caller-owned root pairs can settle divergent candidates. Jointly
replacing source and settlement state can reopen sequence one. Confirmation
strings authenticate no host, actor, human, organization, or policy. The module
invokes no provider or experiment and grants no evaluation, benefit, learning,
execution, adoption, installation, promotion, merge, Foundation mutation, or
CANON authority.

No incoming specialist ZIP package was inspected or modified. The dirty shared
main checkout, foreign worktrees, and global tools-index lane were not edited.
Mike Tobi / AXM remains the merge and `CANON` gate.
