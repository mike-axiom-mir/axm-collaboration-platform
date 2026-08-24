# Code Capability Fabric detached-candidate v0.9 scope

Status: `TEST`

Branch: `codex/code-capability-fabric-detached-candidate-v0.9`

Base: `6e3a014a08acb23614ff3a72eab1ce8d266f1b99`

Technical commit: `1cc64239b4a88e50c9ac52f95d0a36f9376ccfdb`

## Requested outcome

Take one slow, grounded step from pure semantic generation toward useful
creation: allow an exact native candidate to be written into the Detached
Candidate Nursery only after a bounded human decision, while keeping the
candidate inert and unable to install itself.

## Bounded rung

Compose the existing semantic candidate generator, deterministic JSON core,
trust-key verification, Detached Candidate Nursery inspection, Review Inbox
semantics, and resource declarations into a two-phase Tier-1 materializer:

1. prepare an exact materialization subject without writing candidate bytes;
2. verify a host-selected trust policy, signed human decision, signed current
   revocation snapshot, four-root PASS decisions, and one unused nonce;
3. exclusively write one new direct-child candidate root;
4. read every byte back, inspect the inert bundle, and emit a path-free receipt.

## Lane

The implementation changes only additive contracts, schemas, documentation,
source, and tests under `shared/code-capability-fabric/`, plus this steward-run
receipt. It does not modify Foundation, Atlas, registries, providers, executors,
the canonical checkout, or a pre-existing Nursery child.

## Explicit non-goals

- natural-person identity proof or proof of informed understanding;
- an independently trusted clock or cross-host/global replay ledger;
- arbitrary-domain recipes or a typed-program-to-semantic-request bridge;
- AI challenger materialization;
- candidate execution or behavioral, visual, or quality proof;
- sandbox, installation, integration, publication, learning, training,
  physical actuation, promotion, or `CANON` authority;
- direct-reuse authorization for generated source.

Mike remains the final merge gate.
