# AXM Archive Intake Cartographer

Archive Intake Cartographer is a detached, read-only `EXPERIMENTAL` candidate for the seam between “many ZIP checkpoints exist” and “the Merge Gate can review their actual relationship.”

It recursively inventories ZIP files below one explicitly selected root, hashes every accepted archive, reads ZIP central-directory metadata without extracting content, and emits path-overlap relations between every archive pair.

## Why this is separate

- Workshop Packager creates and restore-tests Workshop packages.
- Module Installer governs one exact `axm.module-bundle/v1` candidate after review.
- Foundation Intake Steward classifies the bounded numbered Foundation catalog.
- Detached Candidate Nursery checks module folders and exact folder-to-bundle parity.
- Research Deduplicator compares research claims without digest verification.

None of those owners maps a supply folder of cumulative and overlapping ZIP checkpoints before intake. This candidate fills only that gap.

## Labels

- `READY_FOR_CONTENT_REVIEW`: central structure and entry paths pass this mapper's bounded checks.
- `REVIEW_REQUIRED`: encrypted entries, archived symlinks, duplicate names, or legacy name encoding need a human decision.
- `NEEDS_REPAIR`: malformed structure, unsafe paths, unsupported ZIP64/multi-disk form, or size/entry limits block this path.

The relation map distinguishes:

- exact whole-archive duplicates;
- equal entry sets with different archive bytes;
- same paths with changed entry metadata;
- subset/superset relations with or without changed entries;
- partial path overlap;
- disjoint paths;
- unknown relations when parsing is held.

## What it does not prove

Central-directory metadata does not prove decompressed file integrity or semantic sameness. CRC-32 plus size is not cryptographic content proof. A path superset is not automatically newer, safer, accepted, or authoritative.

The module never extracts, executes, merges, deletes, stages, installs, grants permission, alters rollback state, promotes, or changes CANON.

## Local usage

```sh
node archive-cli.js --root /path/to/extracted/intake-supply
node archive-cli.js --root /path/to/supply --output archive-map.json --quiet
node archive-cli.js --root /path/to/supply --browser-output current-archive-map.js
node selftest.js /path/to/current/intake-supply
```

No files are written unless an output path is explicit.
