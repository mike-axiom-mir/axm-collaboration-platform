# Evidence routes

## primary-manifest-semantic-gate

- claim: The primary verifier, import gate, and export gate reject compiler-boundary drift even when nested and top-level digests are recomputed.
- kind: deterministic behavior and authorization boundary
- risk: high
- pass condition: Every held-out permission, resource, component-class, continuity, lineage, identity-alias, contract, and canonical-order mutation is rejected.
- primary surface: `adversarial-corpus-selftest.js` against `verifyManifest`, `exportManifest`, and `importManifest`.
- counterevidence: Eight of the initial eleven mutations were accepted by the primary verifier before hardening.
- secondary surface: Exact product-commit replay in fresh Node processes.
- verdict: PASS
- named seam: Static inert manifest only.

## independent-verifier-convergence

- claim: The verifier that does not import the compiler independently rejects the same held-out corpus.
- kind: deterministic behavior with independent implementation
- risk: high
- pass condition: All 26 re-signed attacks return `FAIL`; valid committed manifests return `PASS`.
- primary surface: `adversarial-corpus-selftest.js`.
- counterevidence: Five of the initial eleven mutations were accepted before hardening.
- secondary surface: Twenty fresh corpus processes plus `fresh-process-verifier.js`.
- verdict: PASS
- named seam: Independence is implementation/import separation, not organizational independence or runtime proof.

## published-schema-boundaries

- claim: The versioned schema set publishes component-class, continuity-state, lifecycle/lineage, finite-retention, uniqueness, and local reference topology clauses.
- kind: static structure
- risk: medium
- pass condition: All local references resolve and all named clauses are present across parseable draft 2020-12 schemas.
- primary surface: `schema-selftest.js` with 155 assertions across 12 schemas.
- counterevidence: A missing local reference, duplicate schema id, absent conditional, or unparseable schema.
- verdict: PASS
- named seam: No general-purpose JSON Schema engine was available; runtime behavior is proved separately by both verifier implementations.

## keel-shell-compatibility

- claim: Hardening does not change the committed inert Keel collaborator shell.
- kind: deterministic behavior and persistence
- risk: medium
- pass condition: Twenty fresh rebuilds produce one digest equal to the committed manifest; origin, fork, memory acceptance, and disclosed migration tests pass.
- primary surface: `trial-selftest.js` in twenty fresh processes.
- secondary surface: independent fresh-process verifier.
- verdict: PASS
- named seam: `continuityState` remains `EMPTY`; no identity continuity or runtime claim follows.

## workshop-regression-checkpoint

- claim: The exact product commit does not break the required Workshop verification surface.
- kind: deterministic repository behavior
- risk: medium
- pass condition: All ten required commands exit zero.
- primary surface: Required AGENTS.md commands at product commit `e5a62f6103c8258e23ab5dc6dbd2c59eeabc4293`.
- observed evidence: All exited zero; `verify.js` reported 0 failures and 41 warnings; `verify-plus` reported `VERIFIED_WITH_LIMITS`.
- verdict: PASS_WITH_LIMITS
- named seam: Existing warnings remain warnings; no browser claim.

## live-shell-enforcement

- claim: A live adapter host authenticates a human, binds a provider, persists continuity, or enforces a shell at runtime.
- kind: runtime, authorization, persistence, and transport
- risk: high
- pass condition: Real allowed/denied identities, restart recovery, provider binding, and host receipts are observed.
- primary surface: Not available in v0.1.
- verdict: UNKNOWN/HOLD
- named seam: `identity.shell.host.bind`, `identity.shell.human.authenticate`, and `identity.shell.runtime.continuity.observe` remain optional capability gaps.
