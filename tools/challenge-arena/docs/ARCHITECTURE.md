# AXM Challenge Arena v0.6 Architecture

## Role

Challenge Arena is a coordination, evidence, and recommendation module. It is not the Asset Factory, Workshop, Game Builder, Mirror, verified library, deployment system, or final authority.

```text
Asset Factory ─┐
Workshop ──────┤
Game Builder ──┤── axm.module-job/0.1 ──> Challenge Arena v0.5
Video ─────────┤                                  │
Research ──────┘                                  ├─ locked challenge + roster
                                                  ├─ independent submissions
                                                  ├─ deterministic evidence
                                                  ├─ assigned blind review
                                                  ├─ recommendation + dissent
                                                  └─ proposed-only merge map
                                                           │
                                                           └─ axm.challenge-arena-return/0.4
```

Producer branches remain domain experts. Arena standardizes the challenge lifecycle and evidence boundary without taking ownership of downstream imports.

## State flow

```text
DRAFT
  create/edit packet
  seal declared local inputs
  register seats
    ↓ lock packet, rubric, roster, blind-seed commitment, BUILD task plan
BUILDING
  issue reviewer-neutral builder packets and equal locked task budgets
  optional claim / heartbeat / retry lease lifecycle
  accept immutable submission revisions and task receipts
    ↓ close submissions
SUBMISSIONS_CLOSED
    ↓ deterministic checks and external receipts
TESTED
    ↓ create blind map, assignment, diagnostics, review protocol, REVIEW task plan
REVIEW_OPEN
  issue exact reviewer-specific packet hashes and assignment-bound tasks
  optional claim / heartbeat / retry lease lifecycle
  accept evidence-linked scores, abstentions, ranking tiers, and task receipts
    ↓ close voting and reveal committed blind seed
VOTING_CLOSED
    ↓ synthesize locked-rubric evidence
SYNTHESIZED
  provisional recommendation + dissent + evidence gaps + proposed merge map
    ↓ explicit human authority only
FINALIZED
```

`ABORTED` is an explicit terminal path. Follow-up rounds create new child challenges rather than rewriting the parent.

## Main components

### `contracts.py`

Normalizes and validates editable challenge packets, including participant, review, execution, and orchestration policy. v0.4-v0.5 packets use evidence-grounded review behavior; older packets keep their historical interpretation.

### `store.py` and transaction/recovery layer

Provides challenge directories, re-entrant local locking, atomic JSON writes, write-ahead journals, canonical event files, checkpoints, and exact sidecar recovery.

The lock coordinates local processes only when the host filesystem honors advisory locking. It is not distributed consensus.

### `deterministic.py` and `validators/`

Run deterministic checks over sealed candidate evidence. Candidate command execution is disabled by default. External specialist systems can return hash-bound signed receipts.

### `diagnostics.py`

Builds private and blind non-punitive duplicate/convergence evidence. v0.4 reads verified manifests and artifacts, records scan limits/errors, hashes the semantic report, and supports full recomputation during integrity verification.

### `blindness.py`

Creates a random seed, commitment, and HMAC-based deterministic order over sealed submissions. The seed remains private during review and is revealed after voting.

### `orchestration.py`

Creates immutable BUILD and REVIEW task cores, equal phase budgets, task-plan hashes, optional bearer-token leases, heartbeat/retry/dead-letter state, completion receipts, private reports, and count-only observer reports. Availability and budget evidence cannot silently become candidate scores.

### `review_assignment.py`

Creates all-to-all or deterministic balanced reviewer assignments. Balanced mode uses a capacitated maximum-coverage matcher and records exact feasibility and coverage evidence.

### `review_safety.py`

Defines the hash-bound review authority protocol and a bounded non-punitive scanner for reviewer-directed candidate content. Integrity verification recomputes scanner output from artifacts.

### `review_evidence.py`

Validates score evidence references, criterion abstentions, and tied ranking tiers. References may point to declared artifacts, deterministic checks, manifest roots, or explicit reviewer observations.

### `voting.py`

Aggregates the locked rubric without silently dropping flagged reviews. It preserves score coverage, abstentions, evidence-ref counts, dispersion, dissent, pairwise preferences, and evidence gaps.

A one-candidate ballot produces no comparative preference signal. Ranking evidence can break a tie only when candidate opportunities are structurally comparable.

### `bridge.py`

Exports portable build/review/result bundles and imports returned artifacts idempotently. v0.4 preserves the exact canonical reviewer packet bytes and hash; paths are not rewritten after hashing.

Safe sync may advance ordinary phases but cannot finalize or approve a merge.

### `bundle.py` and `bundle_verify.py`

Stream byte-reproducible evidence ZIPs with fixed metadata, sorted members, manifest hashes, and source-mutation detection. The standalone verifier checks received bundles without extraction, execution, or source-workspace trust.

### `server.py`

Serves a local read-only observer. Public state strips private blind seed, ballots, receipt details, and unrevealed authorship information.

## Evidence layers

```text
source input bytes
  -> input receipt
locked packet/rubric/roster
  -> packet, rubric and roster hashes
candidate bytes
  -> submission manifest, artifact hashes, immutable revision record
deterministic measurements
  -> local results or signed specialist receipt
seat coordination
  -> immutable task core, equal budget hash, lease/attempt history, task receipt
review assignment
  -> assignment hash and coverage evidence
review packet
  -> reviewer-specific exact packet hash
peer judgment
  -> evidence references or explicit abstention
blind ordering
  -> pre-vote commitment + post-vote reveal
synthesis
  -> recommendation, dissent, gaps, proposed merge map
human authority
  -> explicit final-decision record
```

No lower evidence layer silently becomes a higher authority layer.

## Integrity model

Integrity verification checks both stored consistency and semantic reproduction where possible:

- canonical event chain, resumable legacy migration markers, and event-bound checkpoint agreement;
- packet, rubric, roster, task-plan, task-receipt, assignment, review, report, and sidecar hashes;
- candidate manifest/byte parity;
- deterministic-result parity;
- external receipt binding;
- candidate diagnostics recomputed from sealed bytes;
- content-safety diagnostics recomputed from sealed bytes;
- reviewer-specific packet hashes rebuilt from immutable task and evidence fields;
- blind map reproduced from committed/revealed seed and sealed submissions;
- reveal report self-hash and event binding;
- final decision and integration return agreement;
- standalone evidence-bundle tree, semantic state, event-chain, and integrity-report agreement.

A self-hash alone is never treated as proof that a report describes the real artifacts.

## Authority boundary

Arena may recommend. It may not:

- import a candidate into another branch;
- execute a proposed semantic merge;
- deploy or publish output;
- delete losing candidates;
- retroactively change the locked rubric;
- create or modify AXM canon;
- replace a human final decision.
