# Portable cold-history tier export and restore — implementation receipt

Date: 2026-08-10  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner can now prepare a deletion-free proposal for moving
one or more inactive, fully archived lease histories into a separate
user-selected tier root. Planning starts from complete lease discovery and
complete deep archive audit, creates no tier directory, and applies separate
released/expired age, minimum-history, per-package byte, aggregate selected-byte,
and candidate-count limits.

Exact approved application revalidates the complete source snapshots, copies the
sealed recovery anchor and every current archive file into a content-addressed
package, and writes the sealed manifest last. Each manifest binds sorted portable
relative paths, byte counts, and content digests; operation time stays in the
proposal/application receipts so identical history retains one package identity
across planning times. Exact partial packages resume;
conflicting, linked, or unclassified content is not overwritten. Export removes
no source file and grants no semantic-retention authority.

A separate read-only package audit rehashes the manifest and every payload. A
separate restore action requires the package digest as exact approval and accepts
only an absent, fresh, or exact-partial target cache. It writes archive payloads
before the recovery anchor, then requires full target archive audit and lease
discovery to reproduce the source anchor, tail, segment, event, rollup, file,
byte, and storage-snapshot summary. A fresh child process independently reopens
the package and deep-audits the restored cache.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 349 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 133 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 58
  contract/discovery checks.
- Native adversaries cover wrong and reshaped approval, copied source root,
  post-plan history, live segments, root overlap, history thresholds,
  per-package and aggregate byte ceilings, partial export, source preservation,
  same-size package corruption, wrong package approval, fresh and partial
  restore, unclassified target collision, idempotent replay, and fresh-process
  deep-audit equivalence.

## Workshop regression

- `node verify.js` — baseline preserved: 0 failures and 38 warnings.
- `node hub/hub-selftest.js` — exactly 3 pre-existing failures: incomplete
  radio station source map, unwired isolated incremental measurement reuse, and
  missing responsive command-bar polish.
- `node hub/route-selftest.js`, `node hub/graft-selftest.js`, and
  `node hub/skin-selftest.js` — PASS.
- `node hub/verify-plus.js` — PASS; workshop profile remains
  `VERIFIED_WITH_LIMITS` and both user checks pass.
- `node tests/html-script-syntax-test.js` — PASS, 53 checks.
- `node tests/tool-forge-package-test.js` — PASS.
- `node tools/agent-tool-forge/selftest.js` — PASS, 15 checks.
- `node tools/evidence-desk/selftest.js` — PASS, 36 checks.
- Changed JavaScript syntax, changed/new JSON parsing, `git diff --check`, exact
  recorded capability-comparison reproduction, and deterministic capability
  comparison — PASS; comparator reports `READY` with no missing capabilities or
  proposed Hands.

## Truth ceiling

- The package is content-addressed and tamper-evident. A user-selected local
  folder is not proof of external immutability, off-device durability, backup
  success, receiver acceptance, or authenticity.
- Export deliberately duplicates history and never deletes the source. Local
  durable event bytes and receipt lineage still grow until a user-owned semantic
  retention policy and external durable substrate are separately authorized and
  verified.
- Fresh-process restore proves the named local fixture and exact package, not a
  fresh machine, remote provider, arbitrary workload, or general throughput.
- Planning and audit are explicit heavy operations. No scheduler, daemon,
  background polling, install, promotion, CANON transition, native game
  execution, release, or engine comparison is claimed.

## Curation receipt

- `session_id`: `2026-08-10-lease-tier-portability`
- `sealed_segment`: not applicable; no raw implementation-session JSONL retained
- `seal_digest`: not applicable
- `durable_events_preserved`: source archive bytes, tier package manifest and
  payload contracts, exact approval and restore receipts, native adversarial
  assertions, capability comparison, evidence route, gap update, and this receipt
- `telemetry_aggregation`: focused pass counts and named bounded fixture only; no
  background telemetry
- `temporary_material_deleted`: disposable self-test cache, tier, tamper, and
  restore roots through the existing bounded temporary-root cleanup
- `explicit_retention_exceptions`: user source history, tier payloads outside
  disposable tests, corrupt or unclassified content, active/live history, and
  every package lacking exact approval
- `derived_views_updated`: CLI, schemas, contracts, manifest, READMEs, gap report,
  capability comparison, evidence route, and this receipt
- `unclassified_items`: none in valid fixtures; corrupt and collision fixtures
  remain `REVIEW_REQUIRED` until disposable cleanup
- `authority_used`: isolated-branch source edits and disposable self-test data only

No user cache, external tier, canonical state, live run ledger, or live-workshop
file was exported, restored, deleted, installed, or promoted.
