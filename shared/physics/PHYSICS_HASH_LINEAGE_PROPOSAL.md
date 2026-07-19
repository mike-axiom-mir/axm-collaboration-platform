# AXM Physics Hash and Lineage Proposal

Status: design proposal only. It does not redefine `checksum(world)`, change
serialization or alter v0.3.1 behavior.

## Problem

The legacy checksum is useful for detecting divergence in a narrow runtime
state: time, step index, sorted body IDs, position, velocity and sleep state.
It deliberately or historically ignores configuration, body definitions,
pending forces, contacts, engine version and provenance. Calling it a complete
replay or configuration hash would therefore overstate what it proves.

## Proposed separated receipts

| Receipt | Purpose | Candidate contents |
| --- | --- | --- |
| `legacyStateChecksum` | Backward-compatible v0.3.1 divergence marker | Exactly today's `checksum(world)` bytes and algorithm |
| `configurationHash` | Establish which model/policies were requested | World schema; engine/version; gravity; timestep, solver, substep, sleep, broadphase, warm-start and bounds policies; ordered normalized body definitions including IDs, order keys, type, shape, mass, material, damping, gravity scale, filters, sensor/enabled/sleep flags |
| `inputTraceHash` | Establish external actions applied after configuration | Canonical ordered records of force, impulse, velocity, add/remove and step requests, with sequence number and normalized payload |
| `stateHashV2` | Detect broader state divergence | Configuration hash reference plus time, accumulator, step/integration counts, body state, pending force, active contacts/manifolds and migration state |
| `lineageHash` | Bind an output to its inputs and predecessor | Domain tag, schema version, configuration hash, input-trace hash, predecessor lineage hash and state hash |

## Canonicalization requirements

- Use explicit schema and algorithm identifiers; never infer them from hash
  length.
- Encode strings as UTF-8 and numbers with a documented representation. Reject
  non-finite values before hashing.
- Sort only fields declared order-insensitive. Preserve action sequence and any
  solver order that can affect results.
- Distinguish absent, `null`, false and zero.
- Include normalization receipts or hash the normalized form while retaining a
  link to the submitted form.
- Domain-separate every receipt, for example `axm.physics/configuration/v1`.
- Record the JavaScript runtime/engine when claiming replay equivalence beyond
  same-runtime execution.
- Keep user data out of physical state unless the contract explicitly promotes
  it; if excluded, state that exclusion in the schema.

## ID-order implication

The micro suite shows that a pure ID rename can change a low-iteration stacked
result because IDs influence solver ordering. A future `configurationHash`
must therefore include IDs and the effective solver order. If semantic IDs are
later decoupled from numerical order, that migration needs its own behavior
version and replay evidence.

## Compatibility path

1. Add new receipt fields alongside `diagnostics.checksum`.
2. Label the existing field `legacyStateChecksum` in documentation while
   keeping its value and algorithm byte-for-byte unchanged.
3. Produce both receipts during a deprecation window.
4. Add golden vectors, mutation-sensitivity tables and serialization tests.
5. Advance the engine/schema version only when consumers can distinguish the
   new contract.

Cryptographic algorithm selection is intentionally deferred. The first design
decision is what each receipt means; choosing an algorithm cannot repair an
underspecified evidence boundary.
