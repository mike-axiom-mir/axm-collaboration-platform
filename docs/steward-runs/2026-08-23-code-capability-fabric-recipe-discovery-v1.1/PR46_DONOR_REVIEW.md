# PR46 donor review

Status: `TEST` donor / direct merge `HOLD`

Observed GitHub pull request: `#46`, `steward: connect 1000-recipe Foundry
evidence to Creation Fabric`.

Observed head: `08eff74b35a3ac19e76093bd53116038063199a5`.

The donor was read as source data through GitHub metadata and raw-file APIs. It
was not checked out, executed, installed, or merged.

## Useful ideas

- bounded metadata query rather than broad unbounded scan output;
- explicit mechanical-match evidence;
- held matches remain visible and separate;
- snippet digests may be emitted while snippet bytes remain absent;
- recipe evidence is not a capability, provider, correctness proof, or install
  decision.

## Direct-reuse holds

- duplicates the local bridge and schema surface;
- accepts arbitrary supplied packs rather than requiring exact installed
  pack/audit/Foundry-contract lineage;
- packet verification checks only its self-digest, not installed bytes;
- syntax status is not restricted to the installed audit vocabulary;
- `localeCompare` ordering may depend on host locale;
- mechanical scoring produces an ordered list without the local four-root
  request gate or explicit separation from exact selection;
- current PR-head tests were declared unrun by its authoring chat.

## Adaptation decision

Adapt the metadata-only discovery idea into a new local contract that consumes
the integrated v1.0 installed-lineage bridge. Use binary deterministic order,
strict closed records, bounded resources, exact four-root request decisions,
separate eligible/held evidence, and an explicit `selection: null` truth field.
The result may inform a later exact selection request but cannot create one.
