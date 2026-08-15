# AXM LEGO City Schema Registry

Status: **EXPERIMENTAL**

This block compiles the schema files already discovered by the City Map into a
single deterministic identity registry. It resolves exact IDs and digests,
keeps unresolved sockets visible, and provides a deliberately conservative
compatibility function.

Compatibility is reported only as:

- `EXACT` for the same ID and content digest;
- `STRUCTURALLY_EQUIVALENT` when annotation-free structures are identical;
- `ADAPTER_REQUIRED` for an explicit adapter whose loss list is present;
- `INCOMPATIBLE` for distinct schema families without an adapter;
- `UNKNOWN` otherwise.

It is not a complete JSON Schema 2020-12 validator. A major-version label is
not compatibility proof. Adapter declarations are data and are never executed
by this registry.
