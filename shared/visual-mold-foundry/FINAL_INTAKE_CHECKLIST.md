# FINAL INTAKE CHECKLIST — v0.9.1

## Package integrity

- [ ] Preserve the ZIP unchanged.
- [ ] Verify the published ZIP SHA-256.
- [ ] Extract to a new writable folder.
- [ ] Confirm `RELEASE_SEAL.json` is present.
- [ ] Run `RUN_DIAGNOSTICS.bat` and require zero failures, including exact SHA-256 manifest coverage.
- [ ] Confirm diagnostics report no missing, changed, duplicate, unsafe, symlinked, or unlisted in-scope package files.

## Browser validation

- [ ] Launch with `START_HERE.bat`.
- [ ] Confirm the normal URL is `http://127.0.0.1:8765/app/index.html`.
- [ ] If port 8765 is occupied, confirm AXM reuses only an existing AXM server and refuses an unrelated process.
- [ ] Open Overview, Atlas, Editor, Proof, Projects, Batches, Recovery, and Status.
- [ ] Check at least one card, one skin, and one portal preview.
- [ ] Check desktop and mobile widths in dark and light themes.
- [ ] Check keyboard navigation, current-view indication, focus preview exit/restoration, and the in-app action dialog.
- [ ] Confirm an invalid or quarantined theme cannot inject an unsafe preview.
- [ ] Check one HTML or PNG export.
- [ ] Record the visual check in Recovery + Intake.

## Recovery readiness

- [ ] Export a safety capsule to an independent location; do not treat browser storage as a backup.
- [ ] Create one rescue point.
- [ ] Run the storage audit.
- [ ] Confirm there are no unresolved `FAIL` entries.
- [ ] Confirm a failed persistence operation reports failure and rolls back rather than logging success.
- [ ] Confirm missing or mismatched snapshot/revision fingerprints block restore.
- [ ] Confirm current capsule and rescue restores reject missing or mismatched integrity.

## Project and batch boundaries

- [ ] Confirm archiving an approved project and batch leaves each record `ARCHIVED`.
- [ ] Confirm missing or inactive dependencies block project/batch approval.
- [ ] Confirm CSV/JSON batch intake rejects more than 100 rows or columns and cells over 4,000 characters.
- [ ] Confirm ragged CSV is rejected and header normalization/collision renames are shown explicitly.

## Intake decision

- [ ] Run the Intake Readiness Gate.
- [ ] Repair every `BLOCKED` finding.
- [ ] Accept `READY_WITH_LOCAL_VALIDATION` only with the warnings understood.
- [ ] Export the Local-Intake Handoff packet.

## Governance

- [ ] Keep protected molds and protected themes authoritative.
- [ ] Keep imported growth quarantined until explicitly reviewed.
- [ ] Treat FNV-1a-32 fingerprints as accidental-corruption evidence only, not signatures.
- [ ] Remember localhost, a non-default port, and direct-file mode are separate browser-storage origins.
- [ ] Do not treat adapter scaffolds as validated engine parity.
- [ ] Preserve the original handoff source under `docs/handoff_source/`.
