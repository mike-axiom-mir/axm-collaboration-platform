# Shared Contract Notes

Contract ID: `axm.capability-interface-contract`  
Version: `0.1.0`

The Capability Card exported by this module is the handoff object for Human Interface Intelligence.

## Knowledge states

- `known`: copied from verified source data.
- `inferred`: derived by a deterministic rule and accompanied by its reason.
- `unknown`: missing or insufficiently verified.
- `conflicted`: multiple source claims disagree.
- `not_applicable`: the field genuinely does not apply.

## Backward-compatible extension

The original shared object was extended with an optional `knowledge` object. This does not alter existing required fields. It records field states, inferences, unknowns, and conflicts without wrapping every field in a more complex object.
