# AXM Challenge Arena v0.6 Contract Index

## Version boundary

The outer producer envelope intentionally remains `axm.module-job/0.1`. It is a small neutral seam shared by Asset Factory, Workshop, Game Builder, video, research, and future branches.

v0.5 uses mixed contract versions on purpose. A contract changes only when its wire shape changes materially. A version number identifies a data shape, not authority. No packet, receipt, score, recommendation, seed reveal, or merge map can authorize destructive import by itself.

## Shipped schemas

The source tree and wheel ship 30 JSON Schema Draft 2020-12 contracts.

| File | Contract | Role |
|---|---|---|
| `module-job.schema.json` | `axm.module-job/0.1` | Stable producer-to-Arena job envelope. |
| `challenge-packet.schema.json` | `axm.challenge-arena/0.4` | Editable brief that becomes locked challenge evidence; includes grounded review, blind ordering, and orchestration policy. |
| `build-packet.schema.json` | `axm.challenge-build-packet/0.4` | Portable per-participant build bundle and optional locked seat task. |
| `input-receipt.schema.json` | `axm.challenge-input-receipt/0.2` | Receipt for challenge-owned source inputs sealed before lock. |
| `submission.schema.json` | `axm.challenge-submission/0.2` | Candidate manifest and packet/rubric acknowledgement. |
| `seat-task.schema.json` | `axm.challenge-seat-task/0.4` | Immutable BUILD or REVIEW task core plus lease, attempt, completion, and failure state. |
| `seat-task-plan.schema.json` | `axm.challenge-seat-task-plan/0.4` | Hash-bound phase plan proving task identity and equal budget bindings. |
| `seat-task-receipt.schema.json` | `axm.challenge-seat-task-receipt/0.4` | Event-bound task outcome receipt; operational evidence only. |
| `seat-task-list.schema.json` | `axm.challenge-seat-task-list/0.4` | Machine-readable task listing and aggregate report. |
| `seat-lease.schema.json` | `axm.challenge-seat-lease/0.4` | One-time claim response containing the plaintext bearer token returned to a worker. |
| `orchestration-report.schema.json` | `axm.challenge-orchestration-report/0.4` | Private phase completion, failure, and budget-signal evidence. |
| `orchestration-public-report.schema.json` | `axm.challenge-orchestration-public-report/0.4` | Count-only observer report without participant/task mapping or failure detail. |
| `external-runner-job.schema.json` | `axm.external-runner-job/0.2` | Exact hash-bound specialist measurement request. |
| `deterministic-receipt.schema.json` | `axm.deterministic-receipt/0.2` | Specialist result receipt, optionally HMAC-signed. |
| `review-assignment.schema.json` | `axm.challenge-review-assignment/0.3` | Deterministic reviewer-to-candidate assignment and coverage evidence. |
| `review-protocol.schema.json` | `axm.challenge-review-protocol/0.4` | Hash-bound authority rules separating reviewer instructions from candidate evidence. |
| `review-content-safety.schema.json` | `axm.challenge-review-content-safety/0.4` | Bounded non-punitive scan evidence, recomputed during integrity verification. |
| `candidate-diagnostics.schema.json` | `axm.challenge-candidate-diagnostics/0.4` | Private artifact-bound duplicate/convergence evidence. |
| `candidate-diagnostics-blind.schema.json` | `axm.challenge-candidate-diagnostics-blind/0.4` | Reviewer-safe translation of diagnostic evidence. |
| `review-packet.schema.json` | `axm.challenge-review-packet/0.4` | Reviewer-specific assigned evidence, exact packet hash, protocol, and score-evidence contract. |
| `review.schema.json` | `axm.challenge-review/0.4` | Evidence-linked scores, abstentions, ranking tiers, and exact packet acknowledgement. |
| `blind-seed-reveal.schema.json` | `axm.challenge-blind-seed-reveal/0.4` | Post-vote reveal used to reproduce the blind label map. |
| `final-decision.schema.json` | `axm.challenge-final-decision/0.2` | Explicit human authority record. |
| `return.schema.json` | `axm.challenge-arena-return/0.4` | Evidence-rich return to the producer branch. |
| `checkpoint.schema.json` | `axm.challenge-arena-checkpoint/0.4` | Event-bound semantic state checkpoint. |
| `legacy-event-migration.schema.json` | `axm.challenge-legacy-event-migration/0.4` | Exact resumable marker for canonicalizing a historical JSONL event projection. |
| `bundle-manifest.schema.json` | `axm.challenge-bundle/0.4` | Reproducible evidence-ZIP manifest. |
| `bundle-verification.schema.json` | `axm.challenge-bundle-verification/0.4` | Standalone no-extraction verification report. |
| `lineage-input-receipt.schema.json` | `axm.challenge-lineage-input-receipt/0.2` | Copied parent evidence for follow-up rounds. |
| `capabilities.schema.json` | `axm.challenge-arena-capabilities/0.4` | Machine-readable features and authority boundaries. |

## Strict JSON boundary

Arena JSON intake rejects:

- duplicate object keys;
- `NaN`, `Infinity`, and `-Infinity`;
- malformed UTF-8;
- hidden trailing JSON material;
- non-finite values during output.

An older file that relied on permissive parsing must be repaired explicitly rather than silently reinterpreted.

## Portable identity boundary

IDs and artifact paths are checked for cross-platform ambiguity. The runtime rejects traversal, drive-qualified paths, alternate data streams, Windows device names, forbidden/control/bidirectional characters, non-NFC forms, trailing dots/spaces, overlong components, and case-fold or normalization collisions.

Passing this check is not a malware, content, rights, or licensing judgment.

## Orchestration contract boundary

BUILD and REVIEW task cores bind participant identity, packet/rubric hashes, roster or assignment evidence, equal phase budgets, and lease policy before work is accepted. A claim returns a bearer token once; persisted state contains only its contextual hash.

Task status, retry, expiry, cancellation, or budget signals are operational evidence. They do not automatically alter candidate scores. Public orchestration reports intentionally remove task IDs, participant mappings, lease evidence, and failure detail before the configured authorship reveal point.

See `SEAT_RELAY.md` for the worker protocol and authority boundary.

## Review contract boundary

A v0.4 reviewer packet contains:

- `rubric_hash`;
- `assignment_hash`;
- reviewer-specific `review_packet_hash`;
- only the labels assigned to that reviewer;
- the locked peer criteria;
- a hash-bound authority protocol;
- non-punitive content-safety and convergence evidence;
- deterministic results and declared artifact paths;
- the locked score-evidence contract.

A v0.4 review must acknowledge the exact packet. Numeric peer scores must carry the configured minimum evidence references. An unjudgeable criterion should use an explicit abstention. Ranking tiers can preserve ties.

The runtime validates reference targets against the candidate manifest and deterministic results. It does not prove that the reviewer interpreted the evidence correctly.

## Diagnostic contract boundary

`diagnostics_hash` and `report_hash` prove internal report consistency. v0.4 does not stop there: integrity verification recomputes diagnostics and content-safety evidence from verified sealed artifacts and compares the semantic result.

This closes the inherited failure mode where a report could self-hash while representing no actual scan.

## Blind ordering boundary

A commitment is created at lock. The seed is revealed only after voting closes. The reveal binds:

- challenge ID;
- algorithm;
- seed;
- original commitment;
- blind-map hash;
- reveal timestamp;
- reveal self-hash.

Integrity verification rebuilds the label map from sealed submissions. This makes ordering auditable, not secret from a local administrator with direct private-file access.

## Bundle, checkpoint, and migration boundary

A v0.4 evidence bundle binds its complete declared challenge tree, integrity report, semantic state hash, and canonical event chain. `bundle-verification.schema.json` describes the report produced by the standalone no-extraction verifier. Internal consistency is not an external identity signature.

Checkpoints bind one semantic state snapshot to a checkpoint-worthy event. The legacy migration marker binds the exact historical JSONL projection while canonical event files are created, allowing interruption-safe resumption without authorizing event invention or rewriting.

See `BUNDLE_VERIFICATION.md` and `RECOVERY_AND_LINEAGE.md`.

## Installed access

```python
from axm_challenge_arena import schema_names, load_schema

for name in schema_names():
    schema = load_schema(name)
    print(name, schema.get("$id"))
```

`load_schema()` accepts one plain `.json` filename and rejects path traversal.

## Source synchronization

Editable copies live in top-level `schemas/`. Wheel-bundled copies live in `axm_challenge_arena/schemas/`.

```bash
python tools/sync_contract_resources.py
python tools/sync_contract_resources.py --check
```

The release audit checks byte identity, JSON parsing, Draft 2020-12 meta-schema validity, and one runtime-produced specimen per schema.

## Compatibility

The runtime accepts earlier challenge and review envelopes only where code explicitly declares compatibility. New presets and new rounds use the v0.5 challenge contract while unchanged wire shapes retain their existing contract versions. Existing v0.3 rounds do not receive a fabricated blind-seed commitment or retroactive evidence-grounding history.

Compatibility intake never means silent rewrite of preserved source evidence. Stricter JSON, path, review, and integrity rules may reject inputs that older versions tolerated; that is an explicit safety boundary.
