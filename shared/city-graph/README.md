# AXM LEGO City Map Compiler

Status: **EXPERIMENTAL**

This is the read-only foundation of the LEGO Software City. It discovers every
directly declared module in the configured roots and compiles one deterministic
`axm.city-graph/v1` snapshot. Machine registries, authority/proof/dependency
views, unresolved edges, and the human map are rendered from that graph.

The compiler does not install or execute discovered modules. Capability,
classification, and permission declarations do not grant authority. Inferred
LEGO kinds remain `INFERRED_UNCONFIRMED` until a module explicitly declares and
proves its block contract.

Run a read-only drift check:

```powershell
node scripts/compile-city-graph.js --check
```

Explicitly rebuild only the named generated views:

```powershell
node scripts/compile-city-graph.js --write
```

Focused verification:

```powershell
node tests/city-map-gate-test.js
```

The negative suite covers `UNINDEXED_MODULE`, `CITY_GRAPH_DRIFT`,
`DUPLICATE_BLOCK_ID`, `UNRESOLVED_SCHEMA`, `EFFECT_PERMISSION_DRIFT`,
`AUTHORITY_MAP_STALE`, semantic timestamp/path stability, and
`HUMAN_VIEW_DRIFT`.

Generated files are not deleted automatically. Root discovery changes require
an explicit edit to `city-roots.json` and normal human review.

The committed graph is identified by its deterministic declaration digest.
It deliberately leaves `source.commit` unbound because a generated file cannot
name the commit that contains itself without permanent one-commit drift. Each
live compiler command reports the actually observed `HEAD` separately. An
external immutable snapshot may pass an explicit source commit to the host API.
Text source hashes normalize CRLF and CR line endings to LF so Windows and
Linux checkouts describe the same logical source snapshot.
