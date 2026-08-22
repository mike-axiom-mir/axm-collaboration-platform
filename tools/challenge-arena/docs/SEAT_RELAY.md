# AXM Challenge Arena v0.6 Seat Relay

## Purpose

The Seat Relay coordinates multiple AI or human workers without turning availability, speed, or vendor-specific usage into hidden quality scores.

Every eligible participant receives an immutable task core bound to the same locked challenge evidence. BUILD tasks are bound to the packet, rubric, and lock-time roster. REVIEW tasks are additionally bound to the exact review-assignment hash and the labels assigned to that reviewer.

The relay is an orchestration layer. It is not a model host, cloud scheduler, security sandbox, quality judge, merge authority, or replacement for the producer branch.

## Evidence objects

```text
locked challenge
  -> seat-task-plan.json
       -> one immutable task core per eligible seat
            -> optional lease / heartbeat / retry history
            -> submission or review completion
            -> seat-task-receipt.json
  -> orchestration report
       -> aggregate completion, failures, and budget signals
       -> no automatic candidate score
```

Shipped contracts:

- `seat-task.schema.json`
- `seat-task-plan.schema.json`
- `seat-task-receipt.schema.json`
- `seat-task-list.schema.json`
- `seat-lease.schema.json`
- `orchestration-report.schema.json`
- `orchestration-public-report.schema.json`

## Equal locked budgets

The challenge packet contains one BUILD budget and one REVIEW budget. Every task in the same phase receives the same budget object and a recorded budget hash.

Supported evidence fields include:

- wall-clock seconds;
- input and output bytes;
- token units;
- tool calls;
- measurement source and notes.

Cross-vendor token and tool accounting may be self-reported unless a trusted runner measures it. An overrun becomes a visible operational signal. It does not automatically fail, disqualify, down-rank, or score a candidate unless a separately locked rubric check explicitly evaluates that fact.

## Lease lifecycle

Leases are optional. Simple local/manual seats can complete directly. A packet can require leases when several workers or machines need to claim tasks safely.

```text
READY
  -> claim
LEASED
  -> heartbeat within locked cap
  -> complete -> COMPLETED
  -> retryable failure / expiry -> READY
  -> terminal failure / attempts exhausted -> DEAD_LETTER
  -> explicit operator cancellation -> CANCELLED
```

A claim returns a high-entropy bearer token once. The Arena stores only a contextual SHA-256 token hash. The plaintext token must remain with the assigned worker and is required for heartbeat, failure, or completion of that lease.

By default, only the participant that owns a task may claim it. Delegate workers require an explicit locked policy.

## CLI workflow

List tasks:

```bash
python -m axm_challenge_arena --root ./workspace tasks <challenge-id> --phase BUILD
```

Claim a task:

```bash
python -m axm_challenge_arena --root ./workspace claim-task \
  <challenge-id> <task-id> --worker <participant-id>
```

The returned `lease_token` is secret operational material. Do not paste it into reports, public observer notes, or version control.

Heartbeat:

```bash
python -m axm_challenge_arena --root ./workspace heartbeat-task \
  <challenge-id> <task-id> <lease-token> --extend 900
```

Record a retryable failure:

```bash
python -m axm_challenge_arena --root ./workspace fail-task \
  <challenge-id> <task-id> <lease-token> \
  --class MODEL_UNAVAILABLE --detail "local model offline"
```

Use `--no-retry` for a terminal operational failure. Operators may also run `reap-tasks` to expire stale leases or `cancel-task` for an explicit non-completed cancellation.

## FileBridge use

Portable build and review folders may include:

```text
seat-task.json
seat-receipt.template.json
```

A returning worker may add `seat-receipt.json` with its task ID, phase, participant, token, and usage evidence. FileBridge verifies that the receipt belongs to the exact locked task before importing the submission or review. A receipt for another participant, phase, or task is rejected.

The task receipt generated after successful import is event-bound evidence. Repeating an unchanged import is idempotent; revisions remain explicit.

## Privacy and observer behavior

Before the configured authorship reveal point, public state exposes only aggregate task counts and status evidence. Participant-to-task mapping, failure detail, lease hashes, and bearer tokens remain hidden.

After voting closes, authorship may be revealed only according to the locked participant policy. Bearer tokens are never intentionally persisted or exposed by public APIs.

## Recommendation boundary

A missing, expired, failed, cancelled, or over-budget seat is not silently translated into a poor candidate score. A locked minimum BUILD completion ratio can withhold the overall recommendation because the tournament lacks enough participation, but it does not rewrite the scores of candidates that actually submitted.

Task completion proves that a recorded output was attached to the task. It does not prove quality, correctness, safety, licensing, acceptance, merge readiness, or AXM canon.
