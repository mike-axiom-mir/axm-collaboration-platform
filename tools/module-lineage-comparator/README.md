# AXM Module Lineage Comparator

Status: integrated `TEST` module  
Installed: `true`  
Promoted: `TEST`  
CANON: unchanged

This module compares two explicit `axm.module-bundle/v1` JSON artifacts as inert data. It proves exact file-path additions, removals, changes, and unchanged bytes with SHA-256, then shows selected manifest and contract field deltas.

The words **baseline** and **candidate** describe comparison direction only. They do not mean old/new, trusted/untrusted, accepted/rejected, safe/unsafe, or CANON/non-CANON.

## Why this is separate

- Archive Intake Cartographer maps whole ZIP bytes and central-directory overlap without extraction.
- Detached Candidate Nursery proves whether one candidate folder still matches its own bundle.
- Graft plans an integration against a Workshop fingerprint.
- Module Installer validates, stages, installs, and rolls back one reviewed bundle.
- Module Contract Workbench edits and stages one installed module's manifest/contract pair.

None of those owns an exact, non-applying comparison between two already materialized module bundles.

## Run

```bash
node lineage-cli.js \
  --left examples/baseline.module-bundle.json \
  --right examples/candidate.module-bundle.json
```

Write JSON or a browser snapshot only by naming an output:

```bash
node lineage-cli.js --left LEFT.json --right RIGHT.json --output comparison.json --quiet
node lineage-cli.js --left LEFT.json --right RIGHT.json --browser-output current-comparison.js --quiet
```

No bundle file is executed. No archive is extracted. No input is changed.

## Evidence limits

- SHA-256 equality proves exact decoded file bytes at one path.
- A declared-field delta reports JSON differences; it does not prove behavioral meaning.
- Missing or invalid manifest/contract JSON remains a visible structural issue.
- Different module IDs are compared structurally but held as `DIFFERENT_MODULE_IDS`.
- The comparison never chooses a winner, merge direction, version precedence, installation action, or CANON state.

Run `node selftest.js` for the bounded fixture suite.
