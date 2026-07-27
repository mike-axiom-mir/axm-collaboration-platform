# AXM Physics Hash and Lineage Proposal

Status: partially implemented as additive evidence on 2026-07-24. It does not
redefine `checksum(world)` or alter v0.3.1 solver behavior. Configuration,
definition and identity digests plus a non-predecessor-bound lineage bundle now
exist; the stronger input/state/predecessor lineage design remains proposed.

## Problem

The legacy checksum is useful for detecting divergence in a narrow runtime
state: time, step index, sorted body IDs, position, velocity and sleep state.
It deliberately or historically ignores configuration, body definitions,
pending forces, contacts, engine version and provenance. Calling it a complete
replay or configuration hash would therefore overstate what it proves.

RFC 8785 is a useful candidate for canonical JSON-safe structure, but its
ECMAScript number serialization emits both positive and negative zero as `0`
and excludes NaN and Infinity. The local signed-zero canary likewise shows that
the legacy checksum collapses `+0` and `-0`. Configuration JSON and authoritative
numeric state therefore need different encoding rules; see source D11 in
`PHYSICS_POLICY_SOURCE_REGISTER.json`.

## Separated receipt roadmap

| Receipt | Status | Purpose | Contents or candidate contents |
| --- | --- | --- | --- |
| `legacyStateChecksum` | Preserved | Backward-compatible v0.3.1 divergence marker | Exactly today's `checksum(world)` bytes and algorithm |
| `configurationHash` | Implemented additive v1 | Establish which world model/policies were requested | World schema; engine/version; gravity; timestep, solver, substep, sleep, broadphase, warm-start and bounds policies |
| `definitionHash` | Implemented additive v1 | Bind normalized physical body definitions | Sorted IDs, shapes, mass, material, damping, gravity scale and filters |
| `identityHash` | Implemented additive v1 | Bind the current identity-relevant body roster | Sorted IDs, type, enabled/sensor and sleep-permission flags |
| `lineageHashes` | Implemented additive v1 bundle | Carry the three implemented digests together | Configuration, definition and identity digests; not an input trace or predecessor chain |
| `inputTraceHash` | Proposed | Establish external actions applied after configuration | Canonical ordered records of force, impulse, velocity, add/remove and step requests, with sequence number and normalized payload |
| `stateHashV2` | Proposed | Detect broader state divergence | Configuration hash reference plus time, accumulator, step/integration counts, IEEE-754-bit-preserving body state, pending force, active contacts/manifolds and migration state |
| `lineageHash` | Proposed | Bind an output to its inputs and predecessor | Domain tag, schema version, configuration hash, input-trace hash, predecessor lineage hash and state hash |

## Canonicalization requirements

- Use explicit schema and algorithm identifiers; never infer them from hash
  length.
- Encode strings as UTF-8 and numbers with a documented representation. Reject
  non-finite values before JSON hashing; preserve signed zero and other declared
  IEEE-754 distinctions in the authoritative numeric-state encoding.
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
result because IDs influence solver ordering. The additive `definitionHash` and
`identityHash` include IDs, but they do not claim to encode a separate solver
schedule. A future predecessor-bound lineage contract must bind the effective
schedule and its version. If semantic IDs are later decoupled from numerical
order, that migration needs its own behavior version and replay evidence.

## Compatibility path

1. **Done:** add configuration, definition and identity receipt fields alongside
   `diagnostics.checksum`.
2. Label the existing field `legacyStateChecksum` in documentation while
   keeping its value and algorithm byte-for-byte unchanged.
3. Keep the additive digests beside the legacy checksum; no deprecation is
   authorized by this pass.
4. **Partial:** mutation-sensitivity and stability tests exist; golden vectors,
   cross-runtime evidence and broader serialization tests remain.
5. Advance the engine/schema version only when consumers can distinguish the
   new contract.

Cryptographic algorithm selection is intentionally deferred. The first design
decision is what each receipt means; choosing an algorithm cannot repair an
underspecified evidence boundary.
