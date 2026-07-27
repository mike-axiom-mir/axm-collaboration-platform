# AXM Physics Policy Observations

Target: `axm-physics-2d` v0.3.1. Status: observation-led; no solver policy was
changed by the 2026-07-19 intake or the additive 2026-07-24 evidence pass.

The later policy deep-dive is routed in `PHYSICS_POLICY_DEEP_DIVE.md`. Its
machine-readable target is now partially implemented for bounded evidence only;
unresolved product and solver choices remain proposals in
`PHYSICS_POLICY_CONTRACT_PROPOSAL.json`.

An observation records what the engine does today. It is not automatically a
recommended contract. Each row needs an explicit product decision, a versioned
migration story and appropriate regression evidence before implementation.

| Seam | Reproduced v0.3.1 behavior | Decision still needed |
| --- | --- | --- |
| Exact touch | Circle/circle and box/box require positive overlap; circle/box reports exact tangency with zero penetration. | Choose one canonical pair policy or explicitly version pair-specific semantics. |
| Point/ray boundaries | Point queries include boundaries; tangent circle rays hit; a ray starting inside a circle returns its exit while one inside a box reports distance zero. | Decide whether shape-specific origin-inside behavior is intentional. |
| Fast thin walls | One substep tunnels in the six-case probe; eight bounded substeps catch those cases. Diagnostics do not name the prevention method. | Keep the current result classified as `substep_mitigation`, or design and instrument a separate CCD capability. |
| ID rename | `SEQUENTIAL_SOLVER_ORDER_DEPENDS_ON_IDS`: renaming IDs bijectively changes a low-iteration stacked result because bodies/pairs are sorted by ID. | Decide whether IDs are permitted numerical ordering inputs; if not, introduce a stable non-semantic order key. |
| Body removal | `CLEAR_ALL_SILENTLY_THEN_REENTER`: `removeBody` clears every contact, key, event and manifold; an unrelated surviving pair emits `ENTER` next step; no terminal reason is emitted. | Preserve unaffected lineage and add `ended_by_removal`, or document global reset as intentional. |
| ID reuse | A removed ID can be added again and starts a fresh contact lineage; bodies have no generation or epoch. | Decide the generation/epoch contract for replay and external references. |
| World bounds | Boundary records have a zero normal and zero impulses. | Keep them typed as boundary events or add a separate physical-normal schema. |
| Decimal quantization | Post-step `Math.round(v*1e9)/1e9`; `+0.5e-9` rounds to `1e-9`, `-0.5e-9` to zero. | Version the current rule or choose a symmetric quantizer. |
| Checksum scope | Legacy `checksum` still changes for time, step, IDs, position, velocity and sleep state; it ignores engine/configuration, shapes, materials, filters, forces, bounds and user data, and collapses `+0` and `-0`. Additive `configurationHash`, `definitionHash` and `identityHash` digests now cover world config, shapes/materials/filters and body identity input without redefining the legacy field. | Keep the legacy state checksum; decide whether to add an authoritative signed-zero state hash and full input-trace/lineage binding. |
| Input normalization | Invalid and out-of-range values remain silently coerced, clamped or replaced; `createWorld`/`addBody` now emit a bounded typed `normalizationReceipt` (field, reason, serializable input, result). | Keep permissive fallback, add strict rejection mode, or version both. |
| Contact capacity | Contacts/manifolds still stop at 2,048; diagnostics now expose detected/retained/stored/truncated counts, limit, status and reason via `contactCapacity`. | Choose prioritization beyond first-detected unique keys if completeness guarantees are required. |
| Filter integers | Categories and masks support bits 0..30; the signed high bit is excluded; group clamps to -32768..32767. | Document this as the stable contract or introduce a versioned unsigned representation. |

## Promotion gate

A policy change is ready only when all of the following are true:

1. The intended behavior and compatibility impact are named.
2. Old and new behavior have executable counterexamples and acceptance oracles.
3. Replay/migration consequences are addressed, including old serialized worlds.
4. The core version is advanced when behavior changes.
5. The legacy default and checksum are not silently redefined.
6. Focused adversarial, micro-verification, self-test and discovery-seam checks pass.

The corresponding executable observation IDs are `exact-touch-matrix`,
`query-boundary-policy`, `bounded-tunnelling-map`,
`id-renaming-order-sensitivity`, `remove-body-lifecycle`, `body-id-reuse`,
`bounds-record-contract`, `decimal-quantization-threshold`,
`legacy-checksum-sensitivity-map`, `silent-normalization-map`,
`contact-capacity-visibility` and `collision-filter-bit-contract`.
