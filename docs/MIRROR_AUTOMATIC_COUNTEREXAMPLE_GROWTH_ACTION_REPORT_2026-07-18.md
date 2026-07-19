# Mirror automatic counterexample growth action report

Date: 2026-07-18  
Status: **WORKING / TEST / NEEDS_REVIEW**  
Canon: **no** - only Mike may accept CANON.

This report supersedes
`MIRROR_AUTONOMOUS_REASONING_EXPERIENCE_LOOP_ACTION_REPORT_2026-07-18.md`
as the current-state account. It does not overwrite that report, any private
receipt, any failed cycle, or any earlier audit.

## Outcome

Mirror now has the small hard-coded organ it was missing: a private,
deterministic Counterexample Organ that turns verified real local reasoning
receipts into bounded parent-linked practice. A changed local contract caused
Mirror to append a new real receipt, derive one new synthetic child, rebuild
the private challenger, and reuse the result on its next live wake without a
fixture-list or compiled-label edit.

The organ does not invent roots, permissions, evaluators, tools, world actions,
semantic truth, or release authority. Its intervention vocabulary is hard-coded
and bounded. Generated examples remain visibly synthetic proposals until an
independent expected-decision contract matches the deterministic Reasoning
Foundation result.

## New boundary organs

- Experience Organ v3:
  `axm.mirror.organ/reasoning-experience-intake-v3`;
- Counterexample Organ v2:
  `axm.mirror.organ/reasoning-counterexample-lab-v2`;
- real source kind: `REAL_LOCAL_LESSON`;
- synthetic source kind: `SYNTHETIC_COUNTEREXAMPLE`;
- synthetic lineage: exactly one immutable parent receipt plus an intervention
  ID;
- storage: append-only ignored private
  `training/datasets/reasoning-receipts/`;
- authority: no tool use, world action, held-out mutation, semantic truth write,
  model activation, runtime promotion, canon change, identity change, or
  permission grant.

The counterexample lab derives only from verified positive real-local receipts;
it never recursively trains on its own synthetic output. It can remove or
supply permission, withhold or supply evidence, remove or supply recovery, or
replace contradictory promotion with non-mutating discrimination. Its expected
decision is committed before the Foundation runs. A mismatch becomes negative
episodic evidence with no success prototype.

Human permission wording is retained and digest-bound in every exact receipt,
but prose is not hidden decision authority. Source-group equivalence is based
on authenticated policy ID, evaluator lineage, evaluation, training example,
admission, and authority fields. A semantic change in those fields still causes
a collision and refuses silent replacement.

## Failure evidence preserved

The development path did not move directly to success.

1. A temporary isolated v1 smoke run passed only 4/7 interventions. Evidence
   reconstruction had dropped `module-contract` evidence. That transient run
   was not admitted to the persistent corpus; the diagnostic was fixed by
   reconstructing the complete Principle trace evidence.
2. Persisted v1 batch
   `reasoning-counterexamples-88a9418859c076581269` then matched 7/7 expected
   decisions.
3. Despite those local matches, cycle
   `reasoning-skill-03e6bb1e0caa47214d14` learned the spurious
   `verify-before-commit` label. Two interventions changed action reversibility
   without changing parallel path-profile reversibility. The cycle originally
   proposed review, but post-hoc lineage review marks it `KNOWN_FAIL`.
4. All seven v1 receipts, their batch, and that cycle remain preserved. The v3
   eligibility gate deterministically excludes those receipts as
   `KNOWN_FAIL_SUPERSEDED`; it does not erase or relabel them.
5. Lab v2 changes action and path-profile reversibility together. Five-parent
   batch `reasoning-counterexamples-684f6393c6addd9d0c2b` matched 7/7, and
   cycle `reasoning-skill-78555c1e6ca16d432323` removed the spurious label.

## Incremental real change and collision repair

The external Publish Workshop contract changed from source group suffix
`901e64633b758245` to `dbc050c9e5fe69b3`. Automatic practice correctly
preserved the earlier receipt and appended:

- receipt: `reasoning-experience-d1706be707b56dd46801aee3`;
- receipt digest:
  `1832ebe0d378e668fe3fde28f68efd98052457d7ce3bd8a1ff592ee117aa1c89`;
- file SHA-256:
  `a6ab338be55394a532c29a273726923c9d7e6dd55ac4dec4bace352aef0be818`;
- kind: `REAL_LOCAL_LESSON`;
- outcome: `WORKED`;
- learned structural tag: `ask-blocking-unknown`.

The first live incremental wake on PID 30992 then held safely. The manual
counterexample runner and runtime supplied different human renderings of the
same authenticated standing policy, so source-group equivalence falsely treated
an existing v2 child as different evidence. Health exposed the exact collision
and no reasoning cycle was claimed.

The repair removed `permissionBasis` prose from semantic source-group authority
while keeping it inside the immutable receipt digest. A focused regression test
now proves that two renderings of the same authenticated policy/evaluation reuse
the source group. Changed policy, evaluator, evaluation, training, admission, or
authority data still refuses replacement.

## Current six-parent counterexample batch

Batch: `reasoning-counterexamples-0afafe9d2f7bda60ebfc`

- inputs digest:
  `0afafe9d2f7bda60ebfc5e04c9e4c249c1e3b050fbf4b2df087eb28dca0fd363`;
- batch digest:
  `8003c9e5fe4d5fc9b406d0a9b42a4ca393a8a1504c28a95e6d62bcdc028ebb8c`;
- verified real parents: 6;
- derived v2 interventions: 8;
- expected/observed decision matches: 8/8;
- newly appended synthetic receipt: 1;
- equivalent synthetic receipts reused: 7;
- v1 known-fail receipts preserved and excluded: 7;
- synthetic recursion: 0;
- semantic consolidations: 0.

The new child is
`reasoning-experience-d2bf27ea399a03802f5ec20c`, linked to the new Publish
parent by intervention `supply-required-evidence`. Its receipt digest is
`528b8a7ca500bfffdddfa2bb2b6430f2f697c952eed610bf0e699c315d7c91ab`.

## Current private reasoning cycle

Cycle: `reasoning-skill-faa62d11a8b239662820`

- inputs digest:
  `faa62d11a8b23966282099c9ba550bad085fb63de298d931c2d008288f5e79a9`;
- model: `reasoning-strategy-dc137c50e525022407a97a14`;
- model digest:
  `ef11dfc51d1a683eb91f542f594eae67abd36f556f5a1369af4cf39ea943bf21`;
- receipts discovered: 21;
- eligible episodic receipts admitted: 14 (6 real, 8 synthetic);
- known-fail receipts preserved and excluded: 7;
- positive/negative admitted episodes: 14/0;
- supplied-path baseline/challenger: 0/12 -> 12/12;
- supplied adversarial transfer: 8/8;
- candidate-free observable baseline/challenger: 2/12 -> 12/12;
- candidate-free legacy exact diagnostic: 8/12;
- safe under-specified holds: 2/2;
- behavior, source, lineage, exclusion, and authority canaries: 17/17;
- independent open seams: 0;
- promotion: `PROPOSE_HUMAN_REVIEW`;
- active runtime model change: false.

Artifact SHA-256 values:

- `reasoning-strategy-model.json`:
  `8e732da7e2378eb9dcf0ad1e1868ecee268eae246df709d444b921ef21069aa3`;
- `evaluation.json`:
  `791a7861248865b00ca44228cba5e5ca6ecde463404ef21dcbfb48d8ceb5009e`;
- `training-session-lineage.json`:
  `d501f63d0512b5e3531998715aed90c83d4ffff985089f674e65a7c16332b9c3`.

## Automatic runtime proof

The exact stale process was reverified as `node runtime/server.js` and boundedly
restarted from PID 30992 to PID 24936. Live health on
`127.0.0.1:8818` reports:

- automatic report: `curriculum-20260718100643282-94bfac33be9f`;
- reasoning cycle: `reasoning-skill-faa62d11a8b239662820`;
- counterexample batch: `reasoning-counterexamples-0afafe9d2f7bda60ebfc`;
- real/synthetic/excluded receipts: 6/8/7;
- this live run appended/reused counterexamples: 0/8;
- `lastError=null`;
- `learnedWeights=false`.

Overall automatic state remains `HOLD_REPAIR` only because the separate token
cycle `cycle-853fdaa7319e00c127c5` has 6,218 training tokens, below its 50,000
evidence gate. It improved untouched-test perplexity from 210.26 to 140.94 and
passed 5/5 canaries, but its runtime pointer also stayed unchanged. The
reasoning track independently reached `PROPOSE_HUMAN_REVIEW`.

## Verification

- focused Experience/Counterexample/automatic-growth tests: 10/10;
- Mirror core: 83/83;
- Mirror Learning Forge: 99/99;
- AXM Native Learning Shell: 6/6;
- Forge manifest and build boundary verification: 148/148 files;
- Mirror Doctor: PASS;
- deterministic current batch/cycle reuse: PASS;
- live automatic counterexample reuse: 8/8;
- JSON parse sweep: recorded in the paired machine audit;
- outside-network use by tests/training: none;
- evaluated Workshop actions executed: none.

PowerShell initially blocked its `npm.ps1` shim, so those invocations did not
start any tests. The exact suites were rerun through `npm.cmd` and produced the
passing counts above; the blocked shim is not counted as a test failure or pass.

## Changed surfaces

The milestone changes the v3 Experience Organ and receipt schema; adds the v2
Counterexample Organ, batch schema, runner, and tests; makes the reasoning skill
cycle review every stored receipt before admission; integrates counterexample
practice into the Learning Shell and automatic Workshop curriculum; exposes
non-authoritative health metadata; and updates current-state documentation.
Private receipts, models, datasets, batches, cycles, runtime tokens, and shell
sessions remain ignored state and were not added to commits.

## Known limits and next evidence gates

- Six real local receipts are a small and correlated evidence base; two are
  successive versions of one Publish lesson.
- All six real receipts are positive. Negative receipt behavior is tested, but
  no genuine real local failure and verified repair has entered the current
  cycle.
- The intervention vocabulary is hard-coded. Mirror cannot yet originate a
  genuinely novel counterexample family or evaluator.
- Synthetic evidence is useful for discrimination practice but is not a real
  outcome, held-out evidence, or semantic truth.
- The learned strategy model remains private and inactive.
- The separate token corpus remains below its evidence gate.
- No CANON, general reasoning, general AI, consciousness, safety proof, or
  self-directed authority is claimed.

The next honest growth step is diverse real evidence, especially preserved
failures followed by independently verified repairs. A repeated gap outside the
current vocabulary may earn another small hard-coded organ only through the
Organ Admission Cell and Mike's review.
