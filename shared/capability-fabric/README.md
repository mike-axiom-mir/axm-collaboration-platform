# AXM Capability Fabric v1

Capability Fabric is the Workshop's deterministic **how** layer. It compiles a
reviewed, digest-bound build request through one exact source-reviewed recipe
into a detached capability candidate. Ordinary builds require no provider,
model, API key, network request, or repeated reasoning compute.

The existing Deterministic Organ Fabric remains the reused declarative kernel
and specialized compatibility surface. This layer adds a generic recipe
catalog and complete candidate materialization for modular capabilities.
`HAND` recipes bind executable `capability.js`; `SKILL` recipes bind portable
`SKILL.md` plus an explicit instruction-only, host-mediated, or executable
runtime. Kind is digest-bound from recipe through plan, compilation, candidate,
module contract, and receipt.

## Truth boundary

- One candidate is built by default. A recipe contract can explicitly declare
  variants and must name its default variant without turning ranking into
  authority. Variant overrides are resolved and validated during planning.
- Missing, ambiguous, inactive, invalid, unreviewed, or resource-exceeding work
  returns a typed hold.
- Imported Mirror, Code Fabric, AI, or external recipes remain inactive
  proposals until source review and Mike's merge decision. Proposal drafts use
  a separate inactive schema and cannot claim active-recipe status.
- Generated tests are files in the candidate. Capability Fabric does not
  execute generated code.
- Candidates remain `EXPERIMENTAL`, detached, uninstalled, unregistered,
  unstaged, unpromoted, and non-CANON.
- The Detached Candidate Nursery may prove structural readiness for later
  intake. That is not runtime, visual, safety, installation, or CANON proof.
- Candidate verification checks byte lineage and the authority-bearing package,
  manifest, compilation receipt, candidate receipt, and module contract. A
  self-consistent rehash cannot convert detached material into authority.

## Core contracts

- `axm.capability-fabric.build-request/v1`
- `axm.capability-recipe/v1`
- `axm.capability-build-plan/v1`
- `axm.capability-candidate-package/v1`
- `axm.capability-build-receipt/v1`
- `axm.capability-recipe-proposal/v1`
- `axm.capability-recipe-draft/v1`
- `axm.modular-capability-recipe-contract/v1`
- `axm.modular-capability-contract/v1`

The initial reviewed catalog contains three executable `HAND` recipes: a pure
JSON transform, an SVG status-badge creation hand, and a Workshop Direction
hand-request adapter. Portable `SKILL` support is proven by an inactive Recipe
Foundry pilot; it is not silently added to the active catalog.
