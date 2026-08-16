# Graceful interruption checkpoint references — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now preserves a sealed nonterminal evidence anchor
at every graceful interruption. `run-checkpoints.jsonl` is append-only. Each
`axm.production-run-checkpoint/v1` record binds the internal plan and source
references, run identity, pinned game or production step schema, exact current
step-ledger count and tail, complete verified-receipt prefix, previous
checkpoint digest, timestamps, and a wholly false authority boundary.

Repeated interruption extends that checkpoint chain. On resume, every historic
checkpoint must still match its exact prefix of the independently validated
step ledger. A validly resealed rollback, binding drift, broken chain, or
tampered checkpoint blocks the checkpoint history. Pre-checkpoint interrupted
runs remain resumable for compatibility, but mutable state alone never grants
cache-protection authority.

Bounded read-only cache-reference discovery now accepts two explicit evidence
kinds: `TERMINAL_RUN_RECEIPT` and `NONTERMINAL_CHECKPOINT`. For a checkpoint,
the entire checkpoint chain must validate and its latest record must equal the
whole current step-ledger count, tail, and verified list. Uncheckpointed appended
receipts, stale tails, truncation, tamper, rollback, links, schema mixing, and
limits hold the aggregate set. If a terminal receipt exists, it takes
precedence; an invalid terminal receipt cannot fall back to older checkpoint
evidence.

Checkpoint scanning adds independent limits: 10,000 checkpoints and 16 MiB per
run checkpoint ledger, plus 100,000 checkpoints and 64 MiB across one discovery
pass. Derived reference sets remain path-free and run-id-free. Retention binds
the exact checkpoint-derived cache key and entry digest and preserves the
existing fresh apply-time reference rescan.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 242 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 93 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 35
  contract/discovery checks.
- Deterministic capability comparison — `READY`, with no required capability
  missing inside the declared graceful-checkpoint scope.

## Full regression and artifact audit

- `node verify.js` - PASS with 0 failures and the existing 38 warnings.
- `node hub/hub-selftest.js` - the same three pre-existing workspace failures:
  incomplete radio station source map, unwired isolated incremental measurement
  reuse, and missing responsive command-bar polish. No changed file in this
  slice owns those surfaces.
- Route, Graft, Skin, Verify Plus, HTML script syntax, Tool Forge package,
  Agent Tool Forge, and Evidence Desk required checks - PASS.
- Final changed-artifact audit - 22 scoped files: 9 JSON documents parsed and
  10 JavaScript files passed `node --check`; the remaining 3 are Markdown.
- `git diff --check` - PASS.

## Truth ceiling

- Checkpoints occur only at explicit graceful package boundaries. Sudden crash
  state without a matching checkpoint grants no reference authority.
- A checkpoint protects completed verified receipts through its exact tail. No
  lease protects optional cache reuse material produced while an active run
  advances after that checkpoint.
- No checkpoint timer, policy scheduler, automatic retention, native game,
  installation, promotion, CANON transition, or release is claimed.

## Curation receipt

- `session_id`: `2026-08-09-run-checkpoint-references`
- `sealed_segment`: not applicable; no raw session JSONL was retained
- `seal_digest`: not applicable
- `durable_events_preserved`: checkpoint/schema contracts, executable
  adversarial assertions, capability comparison, evidence route, and this
  implementation receipt
- `telemetry_aggregation`: none; no performance telemetry was collected
- `temporary_material_deleted`: disposable self-test roots only, using bounded
  cleanup owned by the tests
- `explicit_retention_exceptions`: terminal receipts, exact checkpoint chains,
  and protected cache entries
- `derived_views_updated`: module contracts, tool manifest, READMEs, capability
  gap report, comparison, and evidence route
- `unclassified_items`: none
- `authority_used`: isolated-branch edits and disposable self-test data only

No user cache, project, canonical state, run ledger, or live-workspace file was
deleted by this implementation session.
