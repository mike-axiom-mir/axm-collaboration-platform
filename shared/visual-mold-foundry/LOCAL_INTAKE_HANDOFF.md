# LOCAL INTAKE HANDOFF — AXM Visual Mold Foundry v0.9.1

## Recommended intake order

1. Preserve the final ZIP unchanged.
2. Verify its SHA-256 checksum.
3. Extract to a new folder.
4. Read `RELEASE_SEAL.json` and `FINAL_INTAKE_CHECKLIST.md`.
5. Run `RUN_DIAGNOSTICS.bat`.
6. Launch with `START_HERE.bat`.
7. Confirm the stable URL is `http://127.0.0.1:8765/app/index.html`.
8. Inspect main views, mobile layout, dark/light themes, keyboard flow, and preview output in Windows Chrome or Edge.
9. Record the visual check in **Recovery + Intake**.
10. Export a safety capsule to an independent location.
11. Run the Intake Readiness Gate.
12. Repair all `BLOCKED` findings.
13. Export the Local-Intake Handoff packet.
14. Intake local themes, extensions, projects, batches, and presets as local records—not protected canon.

## v0.9.1 hardening behavior

- Persistence failures throw and governed transactions roll back; a failed write must not be followed by a success claim.
- Current workspace, family, project, batch, safety-capsule, and rescue packets require a valid FNV-1a-32 fingerprint.
- Snapshots and project revisions verify their fingerprint before restore.
- Approved project/batch archives remain `ARCHIVED`; inactive dependencies block approval.
- CSV/JSON batches reject more than 100 rows or columns, cells longer than 4,000 characters, and ragged CSV. Header changes and collision renames are explicit.
- Quarantined themes are previewed only through validated declarative values.
- Diagnostics require exact manifest coverage for the release-file scope.

## Migration

v0.9.1 continues to use the v0.9 browser-storage generation and can copy recognized v0.8 and older records into v0.9 storage keys without deleting the originals.

## Local origin and backup boundary

Port 8765 is the stable default origin. The launcher reuses that port only when it identifies an existing AXM server; it refuses an unrelated occupant rather than silently creating a new workspace on another port. A manually selected port and direct-file mode each use a separate browser-storage origin.

Browser storage and its rescue ring live in the active browser profile. They are working state, not a durable or independent backup; retain exported safety capsules separately.

## Protected baseline

- 32 protected molds;
- 6 protected themes;
- 148 tokens;
- 58 organ contracts;
- 38 starter presets.

## Gate interpretation

- `READY`: no current warnings or failures.
- `READY_WITH_LOCAL_VALIDATION`: no blocking failures, but honest local-validation items remain.
- `BLOCKED`: at least one failure must be repaired before a clean intake claim.

## Non-claims

- no automatic canon merge;
- no hidden repair;
- no target-engine parity claim;
- no replacement for human visual review;
- no cryptographic signature or identity claim from FNV-1a-32 integrity;
- no durable-backup claim for browser storage.
