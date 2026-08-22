# Interface pattern registry

The module-owned registry currently contains 27 reusable interface patterns. It remains separate from the shared contract.

On load, Module 2 validates required fields, enums, list shapes, duplicate list values, duplicate pattern identifiers, booleans, and the shared-contract version. Invalid registries are rejected rather than repaired silently.

The active registry is copied into an internal snapshot. Public `data`, `patterns`, and `get()` accessors return copies so external mutation cannot change selection behavior after a fingerprint has been issued.

The registry fingerprint is calculated from canonical JSON bytes of the exact registry instance used. Custom registries therefore receive their own fingerprint, and traces/receipts cannot silently claim the default registry.

Schema: `integration/schemas/interface-pattern-registry.schema.json`.
