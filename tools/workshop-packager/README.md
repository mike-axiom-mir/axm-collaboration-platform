# Workshop Packager

Creates timestamped archives under `exports/workshop-packages`.

## Full local backup

Copies the current Workshop except the `exports` folder, adds a SHA-256 package manifest, and creates a ZIP. Treat this archive as private: it may contain local logs, backups, or access tokens.

## Public-safe package

Excludes exports, backups, logs, saves, sessions, caches, temporary files, private
projects/intakes, live runtime state, local AI settings, repository metadata,
dependency folders, `bridge-token.txt`, environment files, private-key formats,
private preview files, and private-labelled reports. Runtime state includes
guardian events, collaboration notices, and shared-vision captures. The
redundant nested District Party source ZIP is omitted while its unpacked,
hashed, rights-recorded art stays included. The packager then scans remaining
text for common private-key/API-key patterns, Discord webhooks, and private
Windows user paths. A finding refuses and removes the ZIP; its report contains
only paths and rule names, never secret values.

Neither mode uploads, publishes, or modifies the source Workshop. An unpacked copy can optionally be retained beside the ZIP.

## AI-native restore maintenance

Every newly created archive is restored into a temporary folder under
`exports/workshop-packages/.restore-tests`, checked against its SHA-256 manifest,
run through the AXM verifier, and started briefly on a temporary local port. A
`*.RESTORE_TEST.json` evidence file is saved beside the ZIP and the temporary
copy is removed. This maintenance is automatic; it adds no extra user step.

The restored copy also runs `tests/beginner-launch-selftest.js`. This keeps the
GitHub/download front door honest: `OPEN_AXM_WORKSHOP.cmd`, its portable Node
fallback, the `RUN_AXM_ALL.bat` compatibility name, extraction guidance and the
Windows browser-opening route must all be present before a package passes.
