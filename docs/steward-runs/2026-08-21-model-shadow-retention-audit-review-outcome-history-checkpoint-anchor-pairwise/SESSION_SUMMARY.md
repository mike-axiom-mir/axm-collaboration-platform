# v3.5 anchored pairwise checkpoint session summary

Status: `TEST` / `DEGRADED` capability result  
Installed: `false`  
Promoted: `false`

## Outcome

An additive v3.5 adapter now exact-rebuilds two caller-presented v3.4 anchored
review-outcome history packages and emits one minimized, self-digesting pairwise
transition receipt. It compares stable witness and anchor policy profiles,
ledger identity, caller time, caller anchor epoch, checkpoint identity and
digest, snapshot binding, and every complete ordered v3.3 history entry.

The closed result has 19 classifications. Exact anchored-package replay is
recognized without requiring a new epoch. Exact-history recheckpoint and
forward full-history extension require exactly the next caller epoch. Policy,
identity, time, checkpoint-id, alternate-package, epoch, snapshot, rollback,
and fork anomalies are held for review with zero autonomous actions. Both
snapshot/history incoherence directions are held: changed snapshot without new
history, and new history without a changed snapshot.

History ancestry is classified before an epoch symptom. This matters when two
independently valid forward candidates both claim the same next epoch: each is a
relative extension of the previous package, while their co-presented comparison
is still `HOLD_HISTORY_REPLACEMENT_OR_FORK`.

## Verification

- v3.5 focused selftest: 200 assertions passed, including every classification,
  fresh-process exact rebuild, receipt minimization, closed schema topology,
  and same-next-epoch, withheld-branch, and joint-pair-replacement
  counterexamples.
- Full inherited verification: 53/53 commands passed with 4,829 focused
  assertions.
- All ten checks required by `AGENTS.md` passed.
- Origin-ledger tree bytes were unchanged across pairwise comparison.
- Browser verification: not applicable; no browser surface was added.
- Independent Draft 2020-12 schema meta-validation: unrun because no validator
  is installed. JSON parsing, runtime validation, exact enum agreement, and
  recursively closed object-shape checks passed.

One initial focused run exposed a real classifier-order bug in the new code:
equal histories are prefixes in both directions and were incorrectly reported
as strict rollback. The predicate was narrowed to strict, non-equal prefixes;
the acceptance criteria were unchanged, and the full focused and inherited
suites then passed.

A post-green audit then found that a self-valid redigested checkpoint could grow
its ordered history while retaining the previous snapshot binding. A nineteenth
typed hold and adversarial fixture now cover that inverse coherence failure; the
complete suite was rerun after the change.

The first evidence selftest also exposed a narrower matcher mistake: it expected
an unhyphenated phrase while the README uses `same-next-epoch`. A first
whitespace-only correction still failed; the matcher was then aligned to the
durable hyphenated wording without changing the README, product, or claim.
Another evidence assertion used a trust-root paraphrase where the frontier audit
says `no promoted release key`; that matcher was likewise aligned to the exact
durable wording.

## Capability result

The deterministic before report is `BLOCKED`: one committed upstream capability
was ready, 23 bounded v3.5 routes were blocked, and 12 broader routes were gaps.
The after report is `DEGRADED`: all 24 bounded routes are ready and the 12 broad
routes remain `OPTIONAL_UNKNOWN`.

The broad unknowns are deliberate. No promoted trust root exists in the audited
Workshop surface. The adapter does not authenticate checkpoint origin, policy
authority, key controller, actor, steward, clock, or epoch source; enforce
retention; prove global uniqueness; see withheld branches; prevent deletion or
rollback; resolve a hold; invoke a provider; run an experiment or evaluation;
or establish benefit, learning, execution, adoption, promotion, merge, or
`CANON` authority.

## Stewardship boundary

Work stayed on the isolated reviewable
`codex/grounded-growth-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-v3.5`
branch. The dirty shared main checkout, incoming specialist ZIP packages, other
active worktrees, and global tools index were not edited. Mike Tobi / AXM remains
the merge and `CANON` gate.
