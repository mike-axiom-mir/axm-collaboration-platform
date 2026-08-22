# LEGO City Schema Registry v0.1 implementation receipt

Status: **EXPERIMENTAL — WORKING IN FOCUSED TESTS**

Phase 1 adds a read-only city-wide schema identity and compatibility registry.
It observes existing modules without rewriting or migrating them.

- City graph: `592b1bff640ed6c7e1e88d4162e99b6207486cd333806129c93500a0a6b31d3b`.
- Registry: `08f5bacd7e7e31cc2cccc9d19c6e81c4cac4694d21073315c5c314d629b40d1c`.
- Schema identities: 397.
- Unresolved schema sockets retained: 623.
- Focused assertions: 14 passed.
- Repository verifier: PASS with pre-existing warnings retained.

Proven here: exact resolution, annotation-free structural equivalence,
explicit adapter routing with retained loss declarations, duplicate-schema
refusal, unresolved-adapter refusal, and visible unresolved sockets.

Not claimed here: complete JSON Schema 2020-12 validation, automatic schema
migration, adapter correctness, adapter execution, semantic compatibility from
version numbers, install, promotion, merge, or CANON.
