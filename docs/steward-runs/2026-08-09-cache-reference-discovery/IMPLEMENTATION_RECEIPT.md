# Terminal-ledger cache-reference discovery — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now has a bounded, read-only route from sealed
terminal run evidence to cache-retention protection. It scans only an explicit
external job root and does not run during candidates, on a timer, or in the
background.

A run contributes only after its terminal receipt and entire step ledger pass
the exact runtime contracts: supported and homogeneous receipt schema,
canonical digests, append-only previous-digest chain, exact run binding,
unique receipts, terminal state/verdict agreement, false installation and
promotion authority, and equality between the terminal receipt's verified-step
list and the whole verified ledger. Only verified cache states that name an
existing immutable entry digest become references.

The derived `axm.production-artifact-cache-reference-set/v1` receipt is
path-private. It keeps root, run, step, cache-key, and entry evidence as digests
and counts without disclosing local paths or run identifiers. The initial
directory read is streamed and capped at 20,000 direct entries; further scan
ceilings are 10,000 direct run directories, 100,000 receipts, 256 MiB aggregate
ledger bytes, 16 MiB per ledger, and 1 MiB per terminal receipt. Incomplete, linked,
tampered, mixed-schema, contradictory, or over-limit input holds authority for
the whole set.

Retention proposals now bind the discovered set, root fingerprint, original
scan budget/time, exact cache keys, and exact entry digests. A referenced key
whose current cache entry has a different sealed digest holds the proposal.
Application requires the same explicit proposal authority as before and
freshly rediscovers references before inventory or deletion. A missing or
changed reference root deletes nothing. A successful application seals the
fresh reference snapshot digest alongside exact invalidation receipts and
post-delete readback.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 216 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 90 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 32
  contract/discovery checks.
- Capability comparison — `READY`; no required capability is missing inside
  the declared terminal-ledger discovery scope.
- Final changed-artifact audit — 20 scoped artifacts; 10 JSON documents parsed,
  7 JavaScript files passed `node --check`, and `git diff --check` reported no
  whitespace errors.

## Workshop regression verification

- `node verify.js` — PASS, 0 failures and 38 existing warnings; 178 tools and
  1217 declared contract capabilities.
- Route, graft, skin, verify-plus, HTML script syntax, tool packaging, Agent
  Tool Forge, and Evidence Desk — PASS.
- Hub self-test — FOREIGN FAILURE, the same three clean-branch baseline checks:
  radio station source-map completeness, isolated incremental measurement
  reuse, and responsive command-bar polish. This slice edits no Hub, radio,
  growth, or visual-stewardship file.
- Browser interaction — not run and not claimed; this slice adds no UI.

## Truth ceiling

- Only fully sealed terminal receipts grant protection. Active or interrupted
  runs have no authoritative reference checkpoint yet.
- Discovery covers runner ledgers, not arbitrary project-state reachability.
- The cache and reference roots remain explicit human-owned local state.
- No policy is persisted or scheduled. There is no lease or automatic garbage
  collection.
- No native game, installation, promotion, CANON transition, or release is
  claimed.

## Curation receipt

- `session_id`: `2026-08-09-cache-reference-discovery`
- `durable_events_preserved`: runtime/schema contracts, executable adversarial
  assertions, capability comparison, evidence route, and this receipt
- `raw_logs_retained`: none
- `temporary_material_deleted`: disposable self-test roots only, using bounded
  cleanup owned by the tests
- `derived_view_privacy`: reference sets retain digests and counts but omit
  local paths and run identifiers
- `authority_used`: isolated-branch edits and disposable self-test data only

No user cache, project, canonical state, run ledger, or live-workspace file was
deleted by this implementation session.
