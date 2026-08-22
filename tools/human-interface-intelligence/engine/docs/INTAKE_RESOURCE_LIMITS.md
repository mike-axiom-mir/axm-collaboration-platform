# Intake resource limits

The Module 1 stable-anchor reader never imports or executes producer code. v0.6.0 also bounds archive resource consumption before reading members into memory.

Current limits:

- compressed ZIP: 32 MiB;
- members: 512;
- one uncompressed member: 8 MiB;
- total uncompressed content: 64 MiB;
- compression ratio per member: 200:1;
- member-name length: 512 characters.

The reader also rejects absolute/traversal paths, encrypted members, symbolic links, duplicate names, duplicate relative paths, multiple package roots, and files outside the single package root.

These values are module intake limits, not shared-contract fields. A legitimate future anchor that exceeds them should trigger an explicit reviewed limit change rather than silent bypass.
