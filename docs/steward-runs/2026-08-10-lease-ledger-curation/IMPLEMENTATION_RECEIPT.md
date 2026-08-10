# Governed inactive lease-ledger curation — implementation receipt

Date: 2026-08-10  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner can now move policy-aged inactive lease history out
of routine hot discovery without discarding its original evidence. A distinct
dry-run command considers only released and expired live segments, enforces
explicit age and candidate ceilings, and seals every selected source digest
into a proposal that has no deletion authority. Application requires the exact
proposal digest, explicit authority, and the same cache-root fingerprint.

Each candidate is rechecked under the per-lease lifecycle lock shared with
acquire, protect, and release. Active leases are never candidates; a held lock
or changed tail removes nothing. Successful application writes the complete
original JSONL bytes as deterministic gzip, seals a chained archive receipt,
publishes one compact recovery anchor, and only then removes that exact hot
source segment. Cold archive segments are not deletion candidates.

The hot anchor retains the exact owner, tail event, history count, archive
count, and latest receipt link. Routine discovery therefore reads one anchor,
the latest small receipt, and the named blob's shape instead of replaying every
historical event. It preserves the exact tail digest, generation, state, and
key-set semantics. Full historical integrity is a separate explicit operation:
the bounded archive audit rehashes and decompresses every segment, validates
the complete event chain, and reconstructs every predecessor anchor.

The publication order has one deliberately recognized interruption window: a
new anchor may coexist with the exact source segment before unlink completes.
Ordinary discovery marks that state `REVIEW_REQUIRED`; reapplying the same
approved proposal completes only the pending source removal and returns
`RECOVERED`. A fresh process can continue a released anchor with a new
generation, or renew an expired anchor while restoring its prior key set.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 287 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 108 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 47
  contract/discovery checks.
- Native adversaries cover wrong and reshaped approvals, copied cache root,
  active/busy/stale leases, interrupted application, released and expired
  fresh-process recovery, multi-segment replay, bounded audit, missing blob,
  same-size blob corruption, and a separately resealed false predecessor link.
- One concurrent cache-publisher harness invocation encountered its existing
  `mkdir entries` race when tests were started in parallel. The isolated core
  rerun passed all 287 checks; final required verification is run sequentially.

## Full regression and artifact audit

- `node verify.js` — PASS with 0 failures and the existing 38 warnings.
- `node hub/hub-selftest.js` — the same three pre-existing workshop failures:
  incomplete radio station source map, unwired isolated incremental measurement
  reuse, and missing responsive command-bar polish. This slice owns none of
  those surfaces.
- Route, Graft, Skin, Verify Plus, HTML script syntax, Tool Forge package,
  Agent Tool Forge, and Evidence Desk required checks — PASS.
- Deterministic capability comparison — `READY`, with no required capability
  missing inside the declared local inactive-lease curation scope.
- Final changed-artifact audit — 23 scoped files: 13 JSON documents parse and 7
  JavaScript files pass `node --check`; the remaining 3 are Markdown.
- `git diff --check` — PASS; only line-ending conversion notices are present.

## Truth ceiling

- Normal hot discovery checks the anchor, latest receipt, and blob shape. It
  does not claim that every cold byte remains intact; use the explicit archive
  audit for that stronger claim.
- No throughput or latency improvement was measured. The load claim is limited
  to fewer stored records in hot discovery, explicit scan ceilings, and absence
  of background work.
- Cold segments remain append-only. Their storage and complete-audit cost can
  grow until audit ceilings hold; governed retention or chained rollup is the
  next declared cache capability gap.
- The system is local filesystem coordination, not a distributed lease,
  authenticated principal boundary, or malicious-code sandbox.
- No schedule, daemon, install, Game Hub copy, promotion, CANON transition,
  native game execution, release, or Unreal comparison is claimed.

## Curation receipt

- `session_id`: `2026-08-10-lease-ledger-curation`
- `sealed_segment`: not applicable; no raw implementation-session JSONL was
  retained
- `seal_digest`: not applicable
- `durable_events_preserved`: complete original runtime lease-event bytes in
  cold segments; source/runtime/schema contracts; adversarial assertions;
  capability comparison; evidence route; known-gap update; and this receipt
- `telemetry_aggregation`: none; no performance telemetry was collected
- `temporary_material_deleted`: disposable self-test roots only, by their
  existing bounded cleanup
- `explicit_retention_exceptions`: all cold archive segments and any active,
  busy, stale, malformed, or unapproved hot segment
- `derived_views_updated`: hot archive anchors, chained receipts, module
  contracts, manifest, READMEs, schemas, CLI, capability gap report, comparison,
  and evidence route
- `unclassified_items`: none
- `authority_used`: isolated-branch source edits and disposable self-test data
  only

No user cache, project, canonical state, live run ledger, or live-workshop file
was inspected, curated, or deleted by this implementation session.
