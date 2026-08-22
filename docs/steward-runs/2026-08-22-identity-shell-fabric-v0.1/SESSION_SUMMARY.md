# Sealed steward-run summary

Status: `EXPERIMENTAL`

## Outcome

The branch now contains a dependency-free, provider-independent AXM Identity Shell Fabric v0.1. It strictly compiles user-authored blueprints plus exact inert component and receipt inputs into deterministic canonical manifests, lineage receipts, and build/gap receipts. It also reconstructs accepted continuity from exact hash-chained receipts, keeps generated memory candidate-only until a separate human acceptance event, distinguishes fork/migration/reconstruction/succession/retirement, and exports only policy-conforming canonical JSON.

The implementation remains an inert compiler. It does not create or imitate an identity, authenticate a human, invoke a model, load an adapter, use a network, mutate a filesystem, actuate a body, make inheritance effective, install, promote, merge, or claim `CANON`.

## Decisions and preserved boundaries

- Reused the Workshop deterministic JSON core instead of duplicating canonicalization.
- Kept identity, neural model, capability, and body as distinct contracts.
- Required every component and parent input to match exact ids, versions, and digests.
- Treated `UNKNOWN` resource ceilings and missing evidence/authority as `HOLD`, never unlimited.
- Required a new shell id for forks and disclosed neural adapter changes for migration.
- Allowed succession and retirement only as non-effective proposals bound to declarative human decision receipts; compiler truth states that human authorship is not authenticated.
- Kept the visual editor, live adapter host, OS isolation, authenticated human gate, robotic actuation, and live robotic safety verification as explicit optional gaps.
- Left all registries, Hub surfaces, Foundation, identity bindings, parent fabrics, return gates, and garden experiments unchanged.

## Evidence

- Product inventory: `PRODUCT_FILE_HASHES.json` (23 exact files).
- Focused and broad results: `CHECK_RESULTS.json`.
- Preserved broad warnings: `WORKSHOP_WARNINGS.json` (0 failures, 41 warnings).
- Capability comparison: `BLOCKED` before; `DEGRADED` after with all required v0.1 groups `READY` and six optional future capabilities missing.
- Claim routing: `EVIDENCE_ROUTES.md`.
- Append-only structural seal: `SESSION_SEGMENT.seal.json`.

All ten required repository checks exited 0. The focused suite passed 62 assertions. Browser render/click, model/provider execution, human-authentication, operating-system isolation, robotic actuation, and live robotic safety verification were not run and are not claimed.

## Curation

- Branch product source and contracts are retained as the reviewable candidate artifact. Workshop status remains `EXPERIMENTAL`; this use of source-of-truth language is not canonization.
- Eight consequential work events are retained exactly in `SESSION_SEGMENT.jsonl` and sealed structurally.
- Repetitive command output was not persisted; exact command verdicts and the complete warning set were compacted into durable receipts.
- No screenshots, recordings, caches, private user sources, chat transcripts, raw prompts, hidden reasoning, verifier histories, route histories, or temporary captures were committed or deleted.
- No retention exception or governed deletion was needed.

## Open seams

The six optional gaps in `CAPABILITY_GAP_AFTER.json` remain open. Any future integration must keep compilation authoritative, place execution behind a separate host and verifier, authenticate human decisions outside the compiler, and require an explicit human merge decision. Passing tests do not make this `CANON`.
