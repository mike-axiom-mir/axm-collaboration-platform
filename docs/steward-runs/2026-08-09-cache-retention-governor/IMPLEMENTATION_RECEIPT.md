# On-demand artifact-cache retention governor — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now has a separate, on-demand retention governor
for its verified external artifact cache. It is not invoked by candidate runs
and it persists no policy or schedule.

The governor exposes three authority-separated operations:

1. Inventory reads an explicit cache without creating an absent root. It stops
   at declared entry/file scan ceilings, discloses logical file bytes, hashes
   the root identity without exposing its path, and classifies only exact
   sealed cache layouts as `TEMPORARY_CAPTURE`.
2. Plan applies independent entry-count, logical-byte, and observed
   filesystem-age budgets. Exact supplied reference keys are protected. The
   sealed proposal is oldest-first, deterministic for its inventory, and
   performs no deletion.
3. Apply requires a saved plain proposal, an explicit apply action, and the
   proposal's exact digest. It binds the cache root, rechecks the complete
   inventory snapshot, reproduces the official planner, invokes only exact
   selective invalidations, inventories again, and seals observed post-delete
   usage and policy satisfaction.

Observed three-entry route:

- absent-root inventory: `COMPLETE`, zero entries, no directory created;
- populated inventory: three eligible entries, exact logical-byte usage;
- protected policy: two candidates and one protected exact key;
- no explicit authority: `NOT_APPROVED`, nothing deleted;
- wrong digest: `APPROVAL_MISMATCH`, nothing deleted;
- validly resealed arbitrary candidate substitution:
  `PROPOSAL_NOT_REPRODUCIBLE`, nothing deleted;
- separate-process publication after planning: `STALE`, nothing deleted;
- exact approved fresh proposal: two `REMOVED`, one protected entry observed,
  policy satisfied;
- undeclared file or active publisher: `REVIEW_REQUIRED` inventory and `HELD`
  planning;
- redirected `entries/` or digest-prefix junction: refused without traversal.

## Evidence and truth ceiling

- Logical bytes are regular-file byte lengths, not allocated disk blocks.
- Filesystem age is the latest observed modification time across an entry, not
  a claim about original publication time or last cache use.
- Inventory validates the sealed manifest, exact layout, authority fields, and
  declared sizes. It deliberately does not hash all artifact content; cache
  hits still perform the stronger artifact-byte integrity check and current
  verifier pass.
- Scan work has fixed structural ceilings, but no representative large-cache
  wall-time or memory benchmark was run.
- Protected references are exact keys supplied by the caller. Automatic
  discovery from validated run ledgers remains a missing adapter.
- No policy is persisted or scheduled. The cache can grow until an authorized
  caller explicitly inventories, plans, approves, and applies retention.
- There is no lease, automatic garbage collection, native execution,
  installation, promotion, CANON transition, release, or external-network
  authority.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 190 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 84 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 29
  contract/discovery checks.
- Deterministic capability comparison — `READY`, no required missing
  capabilities inside the declared on-demand governor scope.
- Eleven changed evidence/contract/schema JSON files parsed successfully.
- Seven changed JavaScript files passed `node --check`.

## Workshop regression verification

- `node verify.js` — PASS, 0 failures and 38 existing warnings; 178 tools and
  1215 declared contract capabilities.
- Route, graft, skin, verify-plus, HTML script syntax, tool packaging, Agent
  Tool Forge, and Evidence Desk — PASS.
- Hub self-test — FOREIGN FAILURE, the same three clean-branch baseline checks:
  radio source-map completeness, isolated incremental measurement reuse, and
  responsive command-bar polish. This slice edits no Hub, radio, growth, or
  visual-stewardship file.
- Browser interaction — not run and not claimed; this slice adds no UI.

## Curation receipt

- `session_id`: `2026-08-09-cache-retention-governor`
- `sealed_segment`: not applicable; no user session log was curated
- `seal_digest`: not applicable
- `durable_events_preserved`: sealed inventory, proposal, selective
  invalidation, and application receipt contracts plus executable assertions
- `telemetry_aggregation`: none; no performance telemetry was collected
- `temporary_material_deleted`: all disposable self-test cache roots removed by
  bounded test cleanup
- `explicit_retention_exceptions`: protected exact keys, unclassified layouts,
  active publishers, and stale snapshots
- `derived_views_updated`: module contracts, tool manifest, READMEs, capability
  gap report, capability comparison, and evidence route
- `unclassified_items`: none retained by the test; malformed fixtures were
  removed only inside the disposable test root
- `authority_used`: isolated-branch source edits and deletion of self-created
  operating-system temporary test data only

No user cache, project, canonical state, run ledger, or live-workspace file was
deleted by this implementation session.
