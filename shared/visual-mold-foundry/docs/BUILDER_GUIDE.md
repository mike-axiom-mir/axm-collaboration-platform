# Builder Guide

## Preserve the parent

Do not edit a parent mold to create a special case. Create a preset when only
control values differ. Create a derived mold when structure, protected fields,
or the organ graph genuinely differs.

## Add a token

1. Choose a semantic category such as `palette`, `glow`, or `performance`.
2. Add a stable ID to `registry/tokens/tokens.json`.
3. Keep the value human-readable.
4. Regenerate `app/js/registry.bundle.js` with
   `python tools/rebuild_registry_bundle.py`.
5. Run `python tests/run_tests.py`.

## Add an organ

An organ contract must name its inputs, outputs, dependencies, compatible
runtimes, performance cost, fallback, validators, and status. A metadata-only
organ must not be labeled as engine-validated.

## Add a mold

1. Copy the mold specification, not a rendered export.
2. Give it a unique `axm.*` ID.
3. Declare protected paths.
4. Use typed input limits.
5. Keep variant axes independent.
6. Reference existing organs.
7. Record provenance and outputs.
8. Add a preview.
9. Generate proof cases.
10. Keep it `EXPERIMENTAL` until explicit review.

## Add a renderer

Browser renderers live in `app/js/renderers.js`. Exporters live in
`app/js/exporters.js`. A new export must be implemented before its button is
shown.

## Regenerate the direct-file registry bundle

```text
python tools/rebuild_registry_bundle.py
```

## Regenerate hashes

```text
python tools/build_hash_manifest.py
```

Then run the full test suite.

## Build a visual project

Use Project Composer when the output needs more than one governed visual. Keep each item as a mold instance with its own controls and variants. Approve only after project validation passes. Any later edit should return the project to draft rather than silently preserving an outdated approval.

## Build from local data

Use Data Batch Builder for repeatable row-driven visuals. Keep the source local and declarative. Prefer column names that match semantic inputs (`title`, `message`, `badge`, `metric`, `cta`) and variant axes (`theme`, `format`, `state`). Sources above 100 rows must be split; do not bypass the explicit truncation gate.
