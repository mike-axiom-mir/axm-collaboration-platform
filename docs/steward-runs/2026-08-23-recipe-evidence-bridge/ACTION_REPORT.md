# AXM steward run — Recipe Foundry → Creation Fabric evidence bridge

Date: 2026-08-23  
Status: `TEST CANDIDATE`  
Branch: `steward/recipe-evidence-bridge-2026-08-23`  
Base main: `fd6ec98a6a98a6666a980c359730ccec57a8cbe9`

## Scope truth

This steward run assesses and changes the connected GitHub repository only. It does **not** claim to describe, upgrade, or equal the current local AXM runtime. Local may be materially further ahead. Treat this branch as a donor/test seam for later comparison, not as the local architecture baseline.

## Purpose

Grow from the already-existing shared Code Capability / Creation Fabric and the already-existing Code Recipe Foundry without creating a Waldo dependency or rebuilding either system.

## EXISTING

- Code Recipe Foundry normalized recipe packs, exact deduplication, family grouping, local search, visible holds, intake receipts and parse-only syntax audit.
- Installed `code-cheats-1000.code-recipes.json` catalog.
- Shared Code Capability Fabric v2 provider-neutral route planner.
- Declarative blueprint composer and schema compiler.

## PRESERVED UNCHANGED

The Foundry public manifest, module contract and discovery seam were initially extended, but CI correctly exposed generated city-map/discovery drift. Those three files were restored byte-for-byte to `main`.

Therefore this branch does **not** register a new public Foundry capability, change Foundry versioning, alter Foundry permissions, or require generated discovery/city-map regeneration. The bridge remains an explicitly detached donor/test seam.

## NEW

- `shared/code-capability-fabric/recipe-evidence-bridge-v1.js`
- `shared/code-capability-fabric/selftest-recipe-evidence-bridge-v1.js`
- `shared/code-capability-fabric/recipe-evidence-bridge-v1.contract.json`
- `shared/code-capability-fabric/recipe-evidence-query-v1.schema.json`
- `shared/code-capability-fabric/recipe-evidence-packet-v1.schema.json`
- `shared/code-capability-fabric/README-recipe-evidence-bridge-v1.md`
- `tools/code-recipe-foundry/creation-fabric-bridge.js`
- `tools/code-recipe-foundry/creation-fabric-bridge-selftest.js`
- `tools/code-recipe-foundry/CREATION_FABRIC_SEAM.md`

## Behavior

The bridge accepts an `axm.code-recipe-pack/v1`, an explicit bounded metadata query and optionally parse-only syntax evidence. It deterministically searches title, description, family key, language, domain, tags, platform and source id.

It does **not** search snippet code. Snippet bytes are replaced by SHA-256 references in the evidence packet. Structural holds remain visible under `heldMatches` and cannot enter normal candidates.

The packet cannot make a recipe a capability or provider and grants no authority. It explicitly refuses snippet execution, snippet-byte copying into the packet, dynamic code loading, process execution, network use, provider registration, automatic install, promotion and CANON.

The hardening pass also fails closed on unknown query fields, explicit wrong types, filters that normalize to empty, malformed recipe records, duplicate recipe IDs, wrong syntax-audit schemas, duplicate syntax identities and conflicting recipe/source identity bindings.

## Verification evidence and limits

Before repository hardening, an earlier detached bridge implementation passed a fixture selftest with `20 checks`, and the initial contract/schema JSON parsed successfully. That evidence applies to the **pre-hardening implementation only** and is retained as historical evidence rather than silently promoted to the current head.

The current branch contains additional fail-closed validation and negative tests. The connected GitHub interface available to this steward can inspect and mutate repository content but does not provide a repository shell checkout to execute the exact current files. A separate container attempt to fetch the public branch could not resolve external DNS, so it produced no execution evidence.

Current-head bridge-specific checks are therefore committed but not claimed as run by this chat runtime:

```text
node shared/code-capability-fabric/selftest-recipe-evidence-bridge-v1.js
node tools/code-recipe-foundry/creation-fabric-bridge-selftest.js
node tools/code-recipe-foundry/discovery-seam-review.js
node verify.js
```

The Foundry-side bridge selftest requires the actual installed 1,000-recipe pack, scans all 1,000 entries with a deterministic probe and asserts that snippet bytes never enter the evidence packet.

### CI evidence

A GitHub city-map workflow run on the intermediate branch failed with `CITY_GRAPH_DRIFT`, `GENERATED_VIEW_DRIFT` and `AUTHORITY_MAP_STALE` after the temporary Foundry manifest/contract edits. This was treated as valid counterevidence, not ignored. The public Foundry discovery files were then restored to `main`; later workflow runs should evaluate the repaired detached shape.

Unrelated workflow success must not be substituted for the bridge-specific selftests above.

## No silent authority change

- no provider execution added
- no network authority added
- no filesystem mutation authority added to the shared bridge
- no Foundry permission change retained
- no public Foundry capability registration retained
- no automatic install
- no automatic promotion
- no CANON write
- no Waldo dependency
- no recipe promoted into an executable capability

## Rollback

Drop or revert branch `steward/recipe-evidence-bridge-2026-08-23`. The existing Foundry catalog, recipe core, manifest/contract/discovery surface and existing Code Capability Fabric v1/v2 paths remain intact.

## Next smallest steward step

First compare this donor seam against the current local Creation Fabric. If local already has an equivalent or stronger evidence bridge, do not intake this implementation. Preserve only any missing tests or boundary ideas. If a genuine gap remains, run the bridge-specific checks in the real repository/local checkout before intake, then test one bounded change request through the evidence seam without granting new authority.
