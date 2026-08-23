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

The reviewed catalog contains four executable `HAND` recipes—a closed JSON
Schema validator, a pure JSON transform, an SVG status-badge creation hand,
and a Workshop Direction hand-request adapter—plus one host-mediated portable
`SKILL` for bounded evidence-first capability review.

Builder implementations now live behind a digest-bound modular registry.
Recipes, plans, candidate packages, and verification all bind the exact active
builder digest. The Foundry validator HAND entered the active registry through
the deterministic admission gate after exact packet inspection, trusted tests,
nine-case source review, and Mike's merge decision. The portable review SKILL
entered through the same route and remains instruction material: its authorized
host must re-check every capability and permission at use time. No review
candidates remain. `tools/capability-recipe-admission-gate` stays available for
future Foundry candidates and has no apply or activation action.
