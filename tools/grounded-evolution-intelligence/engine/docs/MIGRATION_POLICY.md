# Contract Migration Policy

- Semantic versioning applies to the contract.
- Patch: clarification or compatible validation repair.
- Minor: additive fields, states, or schemas that remain backward compatible.
- Major: incompatible meaning or required-field changes.
- Every migrated record preserves its original contract version.
- Migration scripts create new events; they do not rewrite old events.
- Unknown fields are preserved in migration sidecars or metadata.
- A migration must provide before/after counts, rejected records, and a rollback path.
