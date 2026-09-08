# Code Capability Fabric — Recipe Evidence Bridge v1

Status: `TEST`

This bridge connects the existing Code Recipe Foundry to the shared Code Capability / Creation Fabric as a **knowledge-evidence donor only**. It does not turn a recipe into a capability provider and it never copies recipe snippet bytes into its output.

## Why this seam exists

The Code Recipe Foundry already owns normalized recipe intake, provenance, visible holds, the installed 1,000-entry catalog, and parse-only syntax evidence. The Code Capability Fabric already owns provider-neutral route planning and bounded declarative creation. Rebuilding either side would create parallel architecture.

The bridge instead accepts an `axm.code-recipe-pack/v1` plus optional `axm.code-recipe-syntax-audit/v1`, performs deterministic metadata-only matching, and emits `axm.code-recipe-evidence-packet/v1`.

Search uses only metadata fields: title, description, family key, language, domain, tags, platform, and source id. Recipe snippets are hashed for lineage but are not searched, copied, loaded, evaluated, or executed.

## Evidence states

- `SOURCE_REVIEW_REQUIRED` recipes may appear as evidence candidates, but remain source-unverified.
- `STRUCTURE_VALIDATED` means structure only; it is not correctness or source verification.
- `STRUCTURE_HOLD` and any recipe carrying hold reasons are kept out of candidates and surfaced separately under `heldMatches`.
- A parse-only `SYNTAX_PASS` remains syntax evidence only. It is never runtime, correctness, security, or suitability proof.

## Non-authority boundary

The packet explicitly states that recipes are not capabilities or providers, source URLs are not license proof, popularity is not correctness proof, semantic inference was not performed, and no install/promotion/CANON action is authorized.

The intended downstream use is review/context for humans or a separately authorized Creation Fabric step. A future code provider must still use the Code Capability Fabric's normal provider descriptor, host observation, authority, resource, reuse-rights, verification, and merge gates.

## Run

```powershell
node shared/code-capability-fabric/selftest-recipe-evidence-bridge-v1.js
```

Inside the AXM repository the selftest also loads the real installed `code-cheats-1000.code-recipes.json`, scans all 1,000 rows with a deterministic probe, and verifies that no snippet bytes enter the evidence packet.
