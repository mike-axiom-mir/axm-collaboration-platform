# Shadow Clone Learning Steward

Status: **EXPERIMENTAL**

This Workshop module turns small, Mike-authorized summaries from active AXM
Codex tasks into bounded evidence that another connected AI can explicitly pick
up for anti-drift. It integrates the learning route proven in the detached
Grand Mirror + Code Mirror Garden without importing raw task histories or
depending on the Garden worktree at runtime.

The module keeps six things separate: observations, declared user-side
feedback, candidate lessons, contradictions/dissent, proposed improvements,
and replay-bound verification. Inheritance remains a seventh, external human
decision. Repeated text alone is not called learning.

## What a “shadow clone” is here

An `axm.shadow-clone.anti-drift-pickup/v1` artifact is an ephemeral,
content-addressed evidence profile. It binds a connected AI's declared base
context digest to fresh verified lesson candidates and to the disagreements it
must not erase. A host must show or apply the profile explicitly.

It is not an identity copy, autonomous provider, person, consciousness, soul,
silent prompt rewrite, permission grant, or model-weight update.

The module also accepts the compact
`axm.grand-garden.instance-learning-steward-ledger/v1` artifact already emitted
by the detached Garden. Its digest is recomputed before import. Because the
compacted ledger does not carry full detached verification bodies, imported
candidates enter `HOLD_CANDIDATES_AWAIT_VERIFICATION`; they may travel as
proposal-only context but cannot become active anti-drift instructions or a
Mirror lesson until replay evidence is supplied.

## Periodic adapter

`lib/periodic-compact-snapshot-adapter.js` is inert when imported. It starts
only through an explicit `start()` call carrying Mike's authorization, a
15-1440 minute interval, and a 1-32 cycle cap. It requires a separately
authorized provider implementing the proposal in
`CODE_CAPABILITY_FABRIC_INTERFACE_PROPOSAL.json`.

This frozen Workshop source has no such live task provider. `capability`
therefore returns `MISSING_CAPABILITY_OR_AUTHORIZATION` instead of pretending
to enumerate Codex tasks. A host can still call `runOnce()` with a conforming
provider and receive an in-memory ledger. Nothing persists unless the caller
explicitly exports it to a new directory.

## Mirror route

The Mirror output is `axm.mirror.private-lesson-proposal/v1`. It requires one
fresh candidate with a replay-matching verification receipt and remains
`REVIEW_REQUIRED`. “Train Mirror” means private, reviewed lesson intake in this
module. It does not train weights or change the Mirror parent, Foundation,
Workshop, prompt, or CANON state.

The existing Workshop HEAD does not expose an installed private Mirror lesson
provider. The proposal is a compatible external handoff only; it does not
depend on an in-progress Body Pulse or Code Capability Fabric branch.

## Scored second-value trial

The receipt-bound route composes the existing Workshop
`axm.review-receipt/v1` constitution rather than creating a second human-review
system. `review-decision` verifies the shared Mike review seat, authenticated
identity digest, exact ledger, candidate, review packet, prospective plan, and
one proposed assignment request. It then emits a
`candidate-review-decision/v2`; it never decides on Mike's behalf.

Before scoring, `trial-assignment` prepares one paired held-out case. V2
requires a fresh current replay-bound candidate, that exact one-case decision,
and two digest-valid, active participation receipts from distinct non-source
recipients. Missing authority, evidence, or consent returns
`HOLD_TRIAL_ASSIGNMENT` with typed blockers and does not reveal the lesson
pattern. The v1 boolean-bound route remains readable for compatibility but is
not sufficient for a real value claim.

Even `READY_RECIPIENT_INITIATED_PAIRED_TRIAL` is preparation only. The packet
keeps `presented: false` and `applied: false`; the host must separately present
the lesson to the learning-route seat, preserve the baseline seat, collect both
outcome and test receipts, and obtain independent evaluator scores. The module
does not message either task.

`score-evidence-trial` is the real measurement seam. Each case must carry the
v2 assignment, sender and recipient presentation acknowledgement, separate
baseline and learning-route final/outcome/test receipts, and at least two
host-authenticated evaluator receipts independent from both recipients and
lesson sources. The scorer keeps every score and statement. It never averages
incompatible judgment: different target classifications produce
`CONTESTED_EVALUATION`; compatible variation uses the lowest observed ratio.

A claimable result still needs three unique held-out cases, unique one-case
Mike decisions and participation receipts, at least two evaluator aliases,
the unchanged prospective plan and rubric, and no missing or contradictory
evidence. The older `score-trial` command remains a deterministic direct
scorer for synthetic fixtures and compatibility, not a real-world value proof.
Neither route generalizes beyond its declared trial or proves broad 2x value.

## CLI

All output commands require a caller-selected path that does not yet exist.
Replay output must be separate from its source.

```powershell
node tools/shadow-clone-learning-steward/cli.js capability --as-of 2026-08-22T12:00:00.000Z
node tools/shadow-clone-learning-steward/cli.js compile --input <redacted-snapshot-set.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js compile --input <next-redacted-snapshot-set.json> --previous-ledger <prior-run/LEARNING_LEDGER.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js replay --run <learning-run> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js import-garden --ledger <garden-ledger.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js pickup --ledger <ledger.json> --request <pickup-request.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js mirror-proposal --ledger <ledger.json> --request <review-request.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js review-decision --ledger <ledger.json> --request <receipt-bound-review-request.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js trial-assignment --ledger <ledger.json> --request <trial-assignment-request.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js score-evidence-trial --input <evidence-bound-trial.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js replay-evidence-trial --run <evidence-trial-run> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js score-trial --input <trial.json> --output <new-directory>
node tools/shadow-clone-learning-steward/cli.js replay-trial --run <trial-run> --output <new-directory>
```

The optional `--previous-ledger` route validates the prior ledger digest,
requires the new compact input to carry `previousLedger: null`, and seals the
combined replay input into the new run. The periodic adapter applies the same
rule in memory: the provider supplies only the new compact cycle and cannot
replace adapter-owned continuity.

Cumulative compilation also retains a bounded source-digest history. Exact
source receipts already seen by the predecessor are removed before lesson
derivation. Fewer than two novel compact sources returns
`INSUFFICIENT_NOVEL_EVIDENCE`; it does not consume a learning cycle, refresh a
candidate, or convert a healthy repeated poll into apparent learning.

The cumulative ledger keeps one current `lessons` entry per lesson key and a
digest-deduplicated `lessonVersions` history. A later observation may supersede
the current version, but it cannot erase an earlier contested or refresh-
required version. Anti-drift pickups carry every preserved dissent version;
only the current candidate version can be selected for application review.
Both current lessons and historical versions remain capacity-bounded.

Local run owners must delete expired run directories themselves. Automatic
deletion is intentionally not claimed.
