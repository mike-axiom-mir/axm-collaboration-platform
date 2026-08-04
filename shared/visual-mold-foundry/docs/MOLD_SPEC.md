# AXM VISUAL MOLD SPECIFICATION — package schema 0.2 / runtime v0.6

A visual mold is a controlled, regenerable visual recipe.

## Resolved required fields

- schema, stable ID, name, and version;
- lineage with parent, derivation, and change policy;
- protected paths;
- typed inputs and independent variants;
- reusable organs and dependencies;
- validation checks and provenance/rights;
- declared outputs, approval state, performance tier;
- renderer, composition level, and theme contract.

## Sparse child source

A protected child source may contain only identity, parent, lineage, provenance, preview, and `sparse_overrides`. It becomes a complete runtime mold only after deterministic inheritance resolution.

## Freedom levels

- **Protected:** change only through explicit derivation and review.
- **Constrained:** change within declared bounds.
- **Free:** replaceable content and optional instance data.

## Package approval states

- `EXPERIMENTAL`
- `APPROVED`
- `DEPRECATED`

A candidate never promotes or activates itself.

## v0.5 local extension fields

A local extension adds `source_kind: extension`, extension state, local-only provenance, release evidence, parent-baseline proof comparison, and activation/import metadata. These govern runtime availability and do not alter the protected package source schema.
