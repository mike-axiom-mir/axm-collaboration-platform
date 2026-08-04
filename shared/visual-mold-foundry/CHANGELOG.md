# CHANGELOG

## v0.9.1 — 2026-07-28

### Reliability and recovery

- browser-storage write failures now throw; governed mutations no longer log false success;
- transactional imports and restores roll back when persistence or post-restore health checks fail;
- rollback snapshots and project revisions require a matching fingerprint before restore;
- approved projects and batches retain `ARCHIVED` when archived;
- missing or inactive dependencies block project and batch approval.

### Integrity and intake

- current workspace, family, project, batch, safety-capsule, and rescue imports/restores now require a valid FNV-1a-32 fingerprint;
- documented FNV-1a-32 as non-cryptographic, collision-prone accidental-corruption evidence—not a signature or adversarial trust system;
- batch sources now reject more than 100 rows or columns, cells over 4,000 characters, and ragged CSV;
- header normalization and collision renames remain explicit and preserve distinct values;
- quarantined theme previews render only after safe declarative validation.

### Launcher and package

- standardized the default origin on port 8765 with reuse-if-AXM / refuse-if-other-process behavior;
- added a local Host allowlist and kept the server bound to `127.0.0.1`;
- tightened SHA-256 diagnostics to require exact in-scope manifest coverage.

### Interface and accessibility

- improved mobile navigation and responsive action wrapping;
- improved light-theme semantic contrast;
- added clearer current-view semantics and safer keyboard-contained focus preview behavior;
- improved dialog labeling, live hints, invalid states, and focus restoration.

### Honest limits retained

- Windows Chrome/Edge visual inspection and downstream engine parity remain **LOCAL VALIDATION REQUIRED**;
- browser storage remains origin-specific and is not a durable backup;
- direct-file mode remains a separate origin without localhost response headers.

## v0.9.0 — 2026-07-28

### Final polish

- replaced governed browser `prompt()` interactions with one accessible in-app action dialog;
- added exact-word confirmation gating inside the Studio;
- added preset action selection without free-text command parsing;
- added v0.8 to v0.9 local-storage migration;
- added `RELEASE_SEAL.json`;
- added `FINAL_INTAKE_CHECKLIST.md`;
- refreshed diagnostics, tests, documentation, and release manifest.

### Preserved

- protected 32-mold library;
- recovery and rescue boundaries;
- explicit approval and release gates;
- Project Composer and Data Batch Builder;
- no telemetry and no remote core assets.

## v0.8.0 — 2026-07-28

### Added

- staged safety-capsule inspection and comparison;
- merge and replacement restore modes;
- exact `RESTORE` confirmation;
- five-point compact rescue ring;
- rescue export, restore, and explicit delete;
- Intake Readiness Gate;
- Windows Chrome/Edge visual-check record;
- local-intake handoff packet;
- intake and capsule exports in Export Center;
- v0.7 to v0.8 local-storage migration.

### Hardened

- launcher now verifies registry JSON and SHA-256 manifest;
- local HTTP server sends stricter CSP and permissions headers;
- restore health failures trigger transaction rollback;
- rescue points avoid recursive ledger growth;
- package ZIP excludes Python cache files.

### Preserved

- protected 32-mold library;
- sparse inheritance;
- theme and extension quarantine;
- explicit approval and release gates;
- Project Composer and Data Batch Builder;
- no telemetry and no remote core assets.

## v0.7.0 — 2026-07-28

- Recovery Center, raw-value preservation, safety-capsule export, package inspector, first-run guide, transactional imports, and launch diagnostics.
