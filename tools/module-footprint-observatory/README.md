# AXM Module Footprint Observatory

Integrated `TEST` module. It measures the active file footprint of
each top-level Workshop module without turning size into a score.

## What it owns

- exact regular-file count and bytes below each `tools/<module>/`;
- each module's largest observed regular file;
- lowercase extension groups while preserving exact paths;
- explicit excluded-directory and skipped-symlink evidence;
- a metadata-only footprint fingerprint and freshness receipt.

## Preserved adjacent owners

Workshop Census retains named scope counts. Asset Filesystem retains asset
indexing, content hashes, duplicate detection, retrieval, and asset packs.
Workshop Packager retains backup/public-safe packaging. Technical Glasses
retains readiness truth.

## Run

```text
node footprint-cli.js --root /path/to/axm-workshop
node footprint-cli.js --root /path/to/axm-workshop --output current-footprint-map.json --browser-output current-footprint-map.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No output is written unless an output path is explicit. File content is not
read except for each top-level module's `manifest.json` identity.
