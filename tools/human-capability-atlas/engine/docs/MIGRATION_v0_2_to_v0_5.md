# Migration from v0.2.0 to v0.5.0

1. Preserve the v0.2.0 ZIP and checksum.
2. Unpack v0.5.0 beside it; do not overwrite the older package.
3. Run `python -m pytest -q` in v0.5.0.
4. Confirm the shared contract remains `0.1.0`.
5. Run v0.5.0 ingestion against a copied test registry.
6. Review `analysis/identity_report.json` before accepting canonical proposals.
7. Review graph integrity, quality coverage, and rejected records.
8. Preserve the first `registry_snapshot.json` as the baseline.
9. Compare later pushes with the `diff` command.
10. Do not merge locally until Module Two contract compatibility and shared fixtures pass.

No v0.2 source declaration must be rewritten merely to use v0.5. The new analysis artifacts are additive.
