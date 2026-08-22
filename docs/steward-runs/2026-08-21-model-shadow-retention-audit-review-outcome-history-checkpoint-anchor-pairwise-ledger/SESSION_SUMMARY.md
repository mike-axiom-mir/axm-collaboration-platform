# v3.6 anchored pairwise transition-ledger session summary

Status: `TEST` / `DEGRADED` capability result  
Installed: `false`  
Promoted: `false`

## Outcome

An additive v3.6 adapter now serializes exact v3.5 forward anchored-history
transition receipts beneath one explicit caller-owned local state root. The
configured genesis and every subsequent head bind the exact anchored-package
reference, checkpoint reference, and caller epoch. The first exact transition
also pins stable anchor and witness policy identities and continuity profiles.

Each successful `record` return requires the exact confirmation phrase, exact
v3.5 rebuild, exclusive creation of the next 12-digit sequence file, file
`fsync`, and an exact postwrite reload. Fresh-process inspection validates the
canonical manifest, contiguous entry filenames, entry digest chain, minimized
v3.5 receipt self-digests, policy pins, unique entry and transition ids, exact
head succession, nondecreasing untrusted recording time, and aggregate resource
bounds.

The useful fact is local and conditional: while the exact caller-owned root is
preserved, a second candidate cannot consume an earlier local head. This does
not become global continuity or retention evidence.

## Verification

- v3.6 focused selftest: 129 assertions passed, including exact consecutive
  transitions, stale local head and id-reuse refusals, concurrent writers,
  fresh-process inspect and rebuild, corruption and resource failures,
  minimization, and independent-root, deletion, rollback, and fsync-failure
  counterexamples.
- Full inherited verification: 54/54 commands passed with 4,958 focused
  assertions.
- All ten checks required by `AGENTS.md` passed.
- Browser verification: not applicable; no browser surface changed.
- Independent Draft 2020-12 schema meta-validation: unrun because no validator
  is installed. Exact runtime validation and recursively closed local shape
  checks passed.

The first focused v3.6 run failed because its test recorded the first local
entry too early for the later transition used by the rollback-time case. The
fixture timestamps were ordered explicitly; no acceptance criterion changed.

After the focused suite first went green, a code audit found that persisted
entry bytes claimed exclusive-create, file-fsync, and postwrite-reload
completion even though those bytes are constructed before the operations. The
truth fields now state only what a successful return requires and explicitly
say completion is not persisted separately. An injected entry-fsync failure
proves the reason: the call returns
`TRANSITION_LEDGER_ENTRY_DURABILITY_UNCERTAIN`, while a complete inspectable
entry may remain. The entry itself does not claim the failed fsync or later
reload completed.

The first inherited verification run then exposed a pre-existing v3.4 selftest
clock defect. That test mixed live review-service timestamps with a fixed
2026-08-21 09:30 UTC checkpoint timeline, so it failed after wall time crossed
the fixture time. Only that selftest now pins the review-service clock to its
declared synthetic timeline; runtime behavior and validation criteria are
unchanged. Its 109 assertions and the full inherited run pass afterward.

The first evidence selftest also found a narrower matcher defect: it expected
the README's fsync warning on one physical line although normal Markdown
wrapping splits the phrase. The matcher now accepts whitespace at that boundary;
the README, product behavior, and evidence criterion did not change.

On reseal, the curation utility correctly refused to overwrite its existing
output; only that exact generated seal target was replaced. The next evidence
selftest then exposed a schema-inspection bug in the evidence code: it looked
for truth properties directly instead of following the schemas' local `$ref`.
The assertion now reads the declared definition; no product schema or criterion
changed.

A later evidence matcher repeated the Markdown-wrap mistake around the recorded
v3.4 selftest clock defect. It too now accepts whitespace without changing the
session fact or repair claim.

The first detached replay checkout failed before testing because the selected
Windows path was still too long for inherited schema filenames. It left no
registered worktree or directory. Replay was redirected to the explicit shorter
path `C:\AXM_MIRROR_LOCAL\v36r`; this is an environmental path-length result,
not a passed or failed product test.

## Capability result

The deterministic before report is `BLOCKED`: one committed upstream route was
ready, 24 bounded v3.6 routes were blocked, and 12 broader routes were gaps. The
after report is `DEGRADED`: all 25 bounded required routes are ready and all 12
broader routes remain `OPTIONAL_UNKNOWN`.

The adapter authenticates no host, actor, person, organization, policy
authority, checkpoint origin, clock, or epoch source. It proves no external
retention, independent custody, directory or hardware durability, protected
monotonic state, rollback prevention, withheld-branch exclusion, globally
consistent log, benefit, learning, execution, adoption, promotion, merge, or
`CANON` authority. It invokes no provider, experiment, or evaluation.

## Stewardship boundary

Work stayed on the isolated reviewable
`codex/grounded-growth-retention-audit-review-outcome-anchor-pairwise-ledger-v3.6`
branch. The dirty shared main checkout, incoming specialist ZIP packages, other
active worktrees, and global tools index were not edited. Mike Tobi / AXM
remains the merge and `CANON` gate.
