# Phase 0 Acceptance Gates

Phase 0 passes only when:

1. Every schema is itself valid Draft 2020-12 JSON Schema.
2. Every example validates against its declared schema.
3. Three module passports use stable shared identifiers.
4. Capability and interface examples reference the same capability ID.
5. Evidence references resolve to retained evidence records.
6. The event stream has a valid sequence and SHA-256 hash chain.
7. Rebuilding the same event stream twice produces byte-identical canonical state.
8. Generated state can be deleted without losing the source event history.
9. Unknown-field preservation is explicitly required in exchange packets.
10. The validation report records limitations and does not claim later phases are complete.
