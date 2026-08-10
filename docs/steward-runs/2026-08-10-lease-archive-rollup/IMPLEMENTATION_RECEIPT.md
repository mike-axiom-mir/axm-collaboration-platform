# Lossless cold lease-archive rollup — implementation receipt

Date: 2026-08-10  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now has a governed way to reduce inactive cold
archive container overhead without summarizing away its durable history. A
separate dry run starts from complete lease discovery and complete deep audit,
enforces released/expired age, reclaim-byte, and candidate ceilings, builds the
deterministic target in memory, and selects it only when the exact target files
are smaller than the exact source files. Planning removes nothing.

Application requires the exact structurally validated proposal digest, explicit
authority, and the same observed cache root. Under the per-lease lifecycle lock
it reproduces the target, publishes one gzip containing the exact concatenated
JSONL event bytes, one gzip containing every original archive receipt and every
prior rollup receipt, and one small rollup head receipt. It then replaces the
hot recovery anchor and removes only source files whose names, byte counts, and
content digests were sealed into the proposal.

The old individual gzip and receipt files are classified as derived storage
containers. They become removable only after the durable event bytes and exact
receipt objects exist in the verified target. This is not semantic history
deletion. Deep audit rehashes and decompresses the current event and lineage
blobs, proves every retained receipt against its exact source-byte boundary and
event transition chain, reconstructs prior rollup coverage, and then rebuilds
the current anchor digest.

Replay handles both interruption sides. If only part of the target exists before
anchor replacement, exact writes reuse it and finish publication. If the anchor
exists while old source files remain, deep audit returns `REVIEW_REQUIRED` and
the same proposal removes only those already covered sources. That cleanup can
finish after a new live segment begins without modifying the live segment.

Regression also exposed a fresh-cache initialization race: concurrent processes
could both observe a missing directory and one would lose the following create.
Cache, lease, archive, and coordination directory creation now treats only
`EEXIST` as a concurrent-create result and then runs the existing plain-directory
and link checks. Eight fresh child processes now race through initialization and
publication in the native self-test; they converge on one immutable entry.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 320 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 121 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 53
  contract/discovery checks.
- Native adversaries cover wrong and reshaped approval, copied root, held owner
  lock, post-plan active session, measured nonzero reduction, partial target
  publication, post-anchor source cleanup after live resume, fresh-process
  continuation, repeated rollup, receipt-set preservation, missing lineage,
  same-size lineage corruption, raw-byte audit ceilings, and eight-process fresh
  cache initialization/publication.

## Workshop regression

- `node verify.js` — baseline preserved: 0 failures and 38 warnings.
- `node hub/hub-selftest.js` — exactly 3 pre-existing failures: incomplete
  radio station source map, unwired isolated incremental measurement reuse, and
  missing responsive command-bar polish.
- `node hub/route-selftest.js`, `node hub/graft-selftest.js`, and
  `node hub/skin-selftest.js` — PASS.
- `node hub/verify-plus.js` — PASS; core verification and user checks remain
  clean within their declared warning limits.
- `node tests/html-script-syntax-test.js` — PASS, 53 checks.
- `node tests/tool-forge-package-test.js` — PASS.
- `node tools/agent-tool-forge/selftest.js` — PASS, 15 checks.
- `node tools/evidence-desk/selftest.js` — PASS, 36 checks.
- Changed JavaScript syntax, changed/new JSON parsing, `git diff --check`, and
  capability comparison — PASS; comparator reports `READY` with no missing
  capabilities or proposed Hands.

## Truth ceiling

- The measured storage result is for the named disposable five-segment fixture.
  No general latency, throughput, compression-ratio, or workload claim is made.
- Rollup bounds current inactive container count and removes duplicated
  container overhead, but exact durable event bytes and receipt lineage still
  grow with real history until independent raw-byte and lineage ceilings hold.
- Long-horizon tiering or semantic retention requires a separate user-owned
  policy, explicit authority, and restore/full-audit equivalence. It is not
  inferred from rollup authority.
- Routine discovery checks the current head and named blob shapes. Only explicit
  deep audit claims complete event and lineage integrity.
- The system remains local filesystem coordination, not authenticated,
  distributed, or a malicious-code sandbox.
- No scheduler, install, Game Hub copy, promotion, CANON transition, native game
  execution, release, or Unreal comparison is claimed.

## Curation receipt

- `session_id`: `2026-08-10-lease-archive-rollup`
- `sealed_segment`: not applicable; no raw implementation-session JSONL was
  retained
- `seal_digest`: not applicable
- `durable_events_preserved`: every original lease-event byte, every original
  archive receipt, prior rollup receipts, runtime/schema/authority contracts,
  native adversarial assertions, capability comparison, evidence route, gap
  update, and this receipt
- `telemetry_aggregation`: only exact before/after file and storage-byte counts
  for the named disposable fixture; no background telemetry
- `temporary_material_deleted`: exact derived archive containers inside
  disposable self-test roots after their verified rollup targets existed; all
  disposable roots then used their existing bounded cleanup
- `explicit_retention_exceptions`: event bytes, archive receipts, rollup
  receipts, active/live/stale/busy history, unmeasured targets, corrupt files,
  and every user-owned source
- `derived_views_updated`: rollup event and lineage containers, hot anchor,
  audit counters, schemas, CLI, contracts, manifest, READMEs, gap report,
  capability comparison, evidence route, and this receipt
- `unclassified_items`: none in valid fixtures; interrupted extra source files
  remain classified as `REVIEW_REQUIRED` until exact recovery
- `authority_used`: isolated-branch source edits and disposable self-test data
  only

No user cache, project, canonical state, live run ledger, or live-workshop file
was inspected, rolled up, or deleted by this implementation session.
