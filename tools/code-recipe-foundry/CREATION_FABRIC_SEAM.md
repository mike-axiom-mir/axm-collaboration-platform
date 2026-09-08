# Code Recipe Foundry → Creation Fabric seam

Status: `TEST`

This seam lets the existing Code Recipe Foundry contribute bounded knowledge evidence to the shared Code Capability / Creation Fabric without changing the Foundry into an executor or code provider.

## Flow

```text
explicit bounded query
  + axm.code-recipe-pack/v1
  + optional axm.code-recipe-syntax-audit/v1
    -> metadata-only deterministic matching
    -> held recipes separated visibly
    -> snippet bytes replaced by SHA-256 references
    -> axm.code-recipe-evidence-packet/v1
    -> human / Creation Fabric review
```

The bridge matches only declared metadata such as title, description, family key, language, domain, tags, platform and source id. It does not search recipe code. Snippet text is neither copied into the packet nor executed.

## Truth boundary

A recipe remains reference material. It is not a capability, provider descriptor, execution permission, correctness proof, safety proof or reuse-rights grant.

A parse-only `SYNTAX_PASS` remains syntax evidence only. `STRUCTURE_VALIDATED` remains structural evidence only. Held recipes are returned separately under `heldMatches` and cannot enter the candidate list.

Any later implementation still has to pass the normal Code Capability Fabric provider descriptor, host observation, authority, resource, workspace-boundary, reuse-rights, verification and merge gates.

## Checks

```powershell
node shared/code-capability-fabric/selftest-recipe-evidence-bridge-v1.js
node tools/code-recipe-foundry/creation-fabric-bridge-selftest.js
node tools/code-recipe-foundry/discovery-seam-review.js
node verify.js
```

The Foundry-side bridge selftest requires the installed 1,000-recipe catalog and proves that the catalog can be scanned while snippet bytes remain absent from the emitted evidence packet.

Passing these checks is evidence for a TEST candidate. It does not promote the bridge or make it CANON.
