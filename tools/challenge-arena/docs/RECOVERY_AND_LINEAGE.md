# Recovery and Lineage v0.6

## Local transaction model

Arena uses a local cross-process lock, atomic same-directory replacement, write-ahead transaction journals, canonical event files, a rebuildable JSONL projection, event-bound checkpoints, and semantic state hashes.

This assumes a local filesystem that correctly honors advisory locking and atomic replace. It is not distributed consensus and should not be treated as one on unreliable network storage.

## Recoverable evidence

Event-bound recovery covers major state and evidence transitions, including:

- locked packet and roster evidence;
- immutable submission and review revisions;
- deterministic result files and external receipts;
- BUILD/REVIEW task plans, task receipts, and orchestration reports;
- review assignment and protocol;
- private and blind diagnostics;
- content-safety reports;
- blind-seed reveal;
- synthesis and proposed merge-map reports;
- integration return;
- final human decision.

Recovery restores the exact bytes already recorded by the pending journal. It does not invent a replacement event from current state.

## Submission interruption

Two edge cases are separated:

- when candidate bytes were copied but no recoverable journal exists, the abandoned temporary/orphan copy is removed;
- when journal and sidecar evidence are sufficient, the exact candidate bytes remain available for recovery.

The Arena never silently converts an uncertain copy into an accepted submission.

## Diagnostic recovery

A recovered diagnostics or content-safety sidecar must still pass semantic recomputation from sealed candidate artifacts. Event binding and self-hash are necessary but not sufficient.

## Seat-task recovery

Task cores and plans are immutable evidence. Lease, heartbeat, failure, cancellation, and completion transitions are committed through the same event/journal boundary as other state changes. Plaintext lease tokens are never intentionally persisted; recovery relies on the stored contextual token hash and exact event-bound state.

Reaping an expired lease records operational evidence and may return a task to `READY` or move it to `DEAD_LETTER` according to the locked attempt policy. It does not create a candidate score.

## Checkpoints

Checkpoints are event-bound snapshots described by `axm.challenge-arena-checkpoint/0.4`. Integrity verification checks the checkpoint's sequence, event head, semantic state hash, reason, and self-hash against the canonical event/state evidence.

A checkpoint is an integrity and recovery aid. It is not a final decision, external signature, or permission to discard earlier events.

## Legacy event migration

A legacy workspace may contain only `events.jsonl` rather than canonical one-file-per-event evidence. v0.4 can reconstruct canonical event files through a resumable migration marker described by `axm.challenge-legacy-event-migration/0.4`.

The marker binds the source JSONL hash, expected event identities, already-written canonical files, and completion state. If migration is interrupted, recovery resumes the exact recorded plan. It does not renumber, reinterpret, or fabricate events.

Preserve the original workspace snapshot until the migrated copy verifies cleanly.

## Blind-seed recovery

The private seed is locked in challenge state and its commitment is included in lock evidence. After voting closes, the reveal report is an event-bound sidecar. Integrity checks commitment, reveal, map reproduction, and timestamps.

Do not fabricate a reveal for a legacy v0.3 round.

## Follow-up lineage

Follow-up modes create a child challenge:

```text
BEAT_WINNER
REPAIR_WINNER
MERGE_CHALLENGE
FINAL_SHOWDOWN
RERUN
```

Selected parent candidates and sealed inputs are reverified, copied into child-owned evidence, and given new child-bound receipts. The parent remains unchanged.

Parent indexing and child creation are separate durable operations rather than a distributed transaction. The child's lineage back-reference and receipts are authoritative. Reconciliation should repair an interrupted parent index, not create a duplicate child.

## Rollback

Keep v0.4 source/release artifacts and a pre-v0.5 workspace snapshot. Test v0.5 on a copy. Once a production workspace is mutated by v0.5, do not open it with v0.4 and assume equivalent interpretation.

Rollback restores preserved v0.4 code and its matching workspace snapshot; it does not delete or rewrite v0.5 evidence in place.
