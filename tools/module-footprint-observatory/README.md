# AXM Module Footprint & Storage Pressure Observatory

Integrated `TEST` module. It preserves the original active-module footprint
map and adds a separate whole-root storage-pressure map for explicitly named
Workshop and Mirror roots.

## What it owns

- exact regular-file count and bytes below each `tools/<module>/`;
- each module's largest observed regular file;
- lowercase extension groups while preserving exact paths;
- explicit excluded-directory and skipped-symlink evidence;
- a metadata-only footprint fingerprint and freshness receipt.

The storage-pressure map additionally owns:

- exact logical bytes and a clearly labeled cluster-rounded allocation estimate;
- exact SHA-256 duplicate groups, hashing only files that first share a byte size;
- operational retention classes with `UNCLASSIFIED` protected by default;
- top directory fan-out pressure and file-count pressure;
- deltas between separately timed snapshots;
- review-only proposals with no selected deletion target.

## Preserved adjacent owners

Workshop Census retains named scope counts. Asset Filesystem retains asset
indexing, retrieval, and asset packs. Evidence Retention retains event-level
retention execution. Workshop Packager retains backup/public-safe packaging.
Technical Glasses retains readiness truth. This observatory reports pressure;
it does not clean, link, compress, or rewrite anything.

## Run

```text
node footprint-cli.js --root /path/to/axm-workshop
node footprint-cli.js --root /path/to/axm-workshop --output current-footprint-map.json --browser-output current-footprint-map.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop

node storage-pressure-cli.js --root workshop=/path/to/axm-workshop --root mirror=/path/to/mirror
node storage-pressure-cli.js --root workshop=/path/to/axm-workshop --root mirror=/path/to/mirror --output pressure.json --browser-output pressure.js --quiet
node storage-pressure-cli.js --root workshop=/path/to/axm-workshop --root mirror=/path/to/mirror --previous prior-pressure.json --output next-pressure.json --quiet
node storage-pressure-cli.js --root workshop=/path/to/axm-workshop --root mirror=/path/to/mirror --hash-classes SESSION_SEGMENT,REPETITIVE_TELEMETRY,TEMPORARY_CAPTURE --output pressure.json --quiet
```

No output is written unless an output path is explicit. The original module
footprint scan reads only manifest identity. The pressure scan reads file
content only for same-size SHA-256 candidates. Symlinks are never followed.
Paths are deterministically classified for review routing, not semantic truth.
Exact equal bytes do not prove that either copy is disposable.

Whole-root hashing is an explicit maintenance mode. On high-file-count HDD
roots, prefer a bounded interactive class scope and reserve `ALL_CLASSES` for
an overnight pass. The map distinguishes complete selected-scope coverage
from complete whole-root coverage.
