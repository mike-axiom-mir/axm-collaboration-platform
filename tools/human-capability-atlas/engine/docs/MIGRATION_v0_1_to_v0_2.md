# Migration from v0.1.0 to v0.2.0

## Compatibility

- Shared contract remains `0.1.0`.
- Existing normalized source files remain valid.
- Existing `build` and `validate` commands remain available.
- Existing Capability Card, course-plan, and interface-recommendation schemas are unchanged.

## New behavior

- `detect` inspects heterogeneous source files.
- `ingest` normalizes files or directories and can build all outputs in batch.
- Generated cards prefer the original source hash and location recorded by an adapter rather than the normalized intermediate file's hash.
- Adapter inferences are appended to the Capability Card knowledge record.

## Safe local migration

1. Keep the v0.1.0 ZIP unchanged.
2. Unpack v0.2.0 beside it, not over it.
3. Run the v0.2.0 tests.
4. Copy a small manifest sample into a staging directory.
5. Run `detect` and inspect mappings.
6. Run `ingest` in normal, non-strict mode.
7. Review unrecognized, rejected, and duplicate reports.
8. Compare generated cards to original declarations.
9. Merge only after Merge Gate review.
