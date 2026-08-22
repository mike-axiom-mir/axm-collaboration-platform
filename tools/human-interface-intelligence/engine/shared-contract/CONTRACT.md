# AXM Capability Interface Shared Contract

- Contract ID: `axm.capability-interface-contract`
- Version: `0.1.0`
- Status: prepared for local intake; not yet integrated
- Owners: shared dependency of the Human Capability Atlas and Human Interface Intelligence

## Source-of-truth boundary

The machine capability declaration, registry, code, and tests remain the technical source of truth. A capability record may explain or classify that source. An interface recommendation may propose a human exposure method. Neither record may silently expand the source capability.

## Shared additions to the starting contract

Three fields were added because they support both modules without changing capability meaning:

1. `contract_id`: prevents similarly shaped records from being mistaken for this contract.
2. `record_kind`: enables deterministic schema routing.
3. `evidence_annotations`: attaches `KNOWN`, `INFERRED`, `UNKNOWN`, `CONFLICTED`, or `NOT_APPLICABLE` state to a JSON Pointer path without wrapping and destabilizing every field.

Compatibility impact: these fields are required in `0.1.0`; no earlier shared-contract release exists, so there is no prior consumer to break. Future removal or renaming is breaking.

## Record types

- `capability_record`: shared description and classification of a source capability.
- `interface_recommendation`: context-specific interface recommendation produced without altering the capability record.

## Required evidence behavior

Every inferred value must have an `evidence_annotations` entry containing a JSON Pointer path, reasoning, source basis, and confidence. Unknown values must be represented by the field's explicit `unknown` enum when available, an empty list/string only where the schema permits it, and an `UNKNOWN` annotation for material fields.
