# AXM retention and recovery boundary

As of 2026-07-23, Sensorium has executable flat-cost retention controls, but the Workshop-wide `saves/`, `state/`, `logs/`, `exports/`, and `backups/` trees do not yet share one automatic rotation policy. This document makes that gap explicit; it does not delete user data.

- `saves/` and durable project state are user-owned. No automatic expiry is authorized.
- `state/` contains live service state and generated indexes. State formats should carry schema identifiers and migrations before a no-cliff claim is made.
- `logs/` may contain operational evidence. Redaction and compaction must precede sharing.
- `exports/` contains reviewable outputs and historical packages. Generated bulk is excluded from Git by default, but age/size deletion is not automatic.
- `backups/` contains recovery material. Restore must be tested against an exact package digest before older copies are pruned.

The next implementation step is a read-only retention inventory and proposal receipt. Automatic rotation, archive, or deletion requires explicit user policy for size, age, protected labels, and recovery guarantees.
