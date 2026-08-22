# Architecture

## Boundary 1 — source capability

The original manifest, registry, code, or test remains authoritative. A shared Capability Record points back to it and may explain it without expanding it.

## Boundary 2 — independent shared contract

`shared-contract/` is consumed by both paired modules. Neither module owns its field definitions. Equal version strings are insufficient: accepted schema bytes and serialization must also agree. Schema changes require a new version, migration rules, and compatibility review.

## Boundary 3 — Module One stable anchor

The Atlas stable anchor is an external package, not part of Module Two. `axm_hii.anchor` reads its ZIP safely, verifies inventory and stable claims, reproduces canonicalization vectors independently, and compares schema fingerprints. It does not import or execute producer code.

## Boundary 4 — paired pre-consumption gate

`axm_hii.paired` requires the stable anchor gate to pass before Capability Records are consumed. A schema, serialization, identity, or representability conflict returns `BLOCKED` and recommendation execution remains `NOT_RUN`.

## Boundary 5 — interface intelligence

After the paired boundary passes, `axm_hii/` reads a validated Capability Record plus context. It ranks every reusable pattern from `data/interface_patterns.json`, blocks unsafe or critically unknown cases, and emits a separate recommendation.

## Boundary 6 — rendering or implementation

This package does not render a front end. A future interface builder may consume the recommendation, but visual output is not treated as proof that the selection engine or underlying capability works.

## v0.4.0 intake evidence layer

The shared recommendation remains contract `0.1.0`. Module-specific evidence sits beside it rather than extending it:

`Capability Record + Context -> context preflight -> deterministic selection -> shared recommendation -> decision receipt -> batch health -> advisory evolution observations`

Dependency locking protects the accepted shared-contract and registry bytes before intake. Decision receipts support deterministic replay checks. Evolution observations have no execution or canon authority.
