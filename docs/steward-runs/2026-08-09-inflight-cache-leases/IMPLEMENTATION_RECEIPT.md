# In-flight artifact-cache leases — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now protects optional cache reuse material while a
candidate is actively advancing between immutable evidence anchors. Every
cache-enabled run acquires a bounded cache-local lease before cache use. The
append-only JSONL history records sealed `ACQUIRED`, `RENEWED`, `PROTECTED`, and
`RELEASED` events with exact owner, session, generation, key-set, expiry, and
previous-event binding. Owner fields contain only digests of the cache root,
job root, run id, plan, and run start. They establish local continuity, not
cryptographic authentication.

Before a deterministic executor can load or publish an exact cache key, the
runner appends that key under cache-local coordination. A newer same-run
session fences older handles. Lease duration covers, for every remaining
attempt, cache-hit verification plus executor and verifier fallback, with a
fixed margin. It cannot exceed seven days. Verifier calls are now subject to
the same cooperative timeout already applied to executors, and a deliberately
non-resolving verifier proves that boundary.

There is no daemon, heartbeat, polling loop, or background renewal. A terminal
receipt or graceful checkpoint is persisted before the runner appends release.
An abrupt child-process exit leaves the last protection event intact only until
its deadline; expiry changes authority without rewriting history, and the same
owner can append a recovery session.

Bounded read-only discovery emits a sealed path-private lease set. Retention
inventory embeds it, planning excludes every active leased key, and application
freshly rescans its stable evidence snapshot. The final check and exact deletion
run under the same per-key lock used by runner protection. A lease created after
planning returns `LEASES_STALE`; a held key lock returns
`LEASE_COORDINATION_BUSY`; both leave the entry intact. Once a graceful
checkpoint releases its lease, the exact checkpoint-derived cache reference
takes over protection as immutable evidence.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 267 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 97 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 41
  contract/discovery checks.
- Deterministic capability comparison — `READY`, with no required capability
  missing inside the declared local in-flight lease scope.
- Native adversaries include a separate process that exits without release, an
  expired/recovered lease, superseded session, malformed ledger, scan ceilings,
  post-plan acquisition, held per-key lock, checkpoint handoff, and a verifier
  promise that never resolves.

## Full regression and artifact audit

- `node verify.js` — PASS with 0 failures and the existing 38 warnings.
- `node hub/hub-selftest.js` — the same three pre-existing workspace failures:
  incomplete radio station source map, unwired isolated incremental measurement
  reuse, and missing responsive command-bar polish. This slice owns none of
  those surfaces.
- Route, Graft, Skin, Verify Plus, HTML script syntax, Tool Forge package,
  Agent Tool Forge, and Evidence Desk required checks — PASS.
- Final changed-artifact audit — 25 scoped files: 13 JSON documents parse and 9
  JavaScript files pass `node --check`; the remaining 3 are Markdown.
- `git diff --check` — PASS; only line-ending conversion notices are present.

## Truth ceiling

- The lease is local filesystem coordination, not a cross-host or distributed
  lease and not a malicious-code security boundary.
- Digest-bound owner identity is not authentication. Code with direct write
  access to the cache can still damage evidence, which then holds governed
  retention when discovered.
- The coordinated deletion guarantee covers the retention governor. Direct
  `invalidate-cache --explicit-invalidate` remains a distinct human override.
- Released and expired lease ledgers grant no protection but remain append-only.
  They can eventually reach the bounded scan ceiling; governed compaction or
  archival is the next declared cache capability gap.
- No throughput, latency, or storage improvement was measured or claimed. The
  load claim is limited to explicit bounded scans and absence of background
  work.
- No native game, installation, Game Hub copy, promotion, CANON transition,
  release, or comparison with Unreal is claimed.

## Curation receipt

- `session_id`: `2026-08-09-inflight-cache-leases`
- `sealed_segment`: not applicable; no raw session JSONL was retained
- `seal_digest`: not applicable
- `durable_events_preserved`: runtime and schema contracts, executable
  adversarial assertions, capability comparison, evidence route, known-gap
  update, and this receipt
- `telemetry_aggregation`: none; no performance telemetry was collected
- `temporary_material_deleted`: disposable self-test roots only, by their
  existing bounded cleanup
- `explicit_retention_exceptions`: cache entries protected by an active lease or
  sealed run evidence; no user cache was inspected or changed
- `derived_views_updated`: module contracts, manifest, READMEs, capability gap
  report, capability comparison, and evidence route
- `unclassified_items`: none
- `authority_used`: isolated-branch source edits and disposable self-test data
  only

No user cache, project, canonical state, run ledger, or live-workshop file was
deleted by this implementation session.
