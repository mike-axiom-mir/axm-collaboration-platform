# Registry Snapshots and Change Impact

A snapshot records one canonical analysis entry per capability ID while retaining the identity classification and source-set fingerprint.

The diff separates:

- added and removed IDs;
- semantic changes;
- human explanation changes;
- interface-contract changes;
- relationship changes;
- lifecycle changes;
- alias changes;
- quality changes;
- source-only movement or provenance changes.

If semantic content changes while the revision remains the same, the diff reports a stable-ID reuse or missing-version warning.

The rebuild plan is advisory. It never deletes or modifies files. It identifies cards, learning outputs, graph analysis, identity analysis, and Module Two recommendations that should be rechecked.
