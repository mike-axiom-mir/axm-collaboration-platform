# AXM Visual Mold Foundry v0.9.1 — Local Intake Hardening Patch

A local-first visual-system workshop for reusable molds, governed themes, proof, lineage, project composition, data-driven batches, recovery, and deliberate local intake.

## Preserved foundation

- 32 protected molds
- 24 distinct card-layout recipes
- 38 starter presets
- 148 semantic tokens
- 58 organ contracts
- 6 protected themes
- Theme Foundry with quarantine, approval, activation, deprecation, and archive states
- local extension registry with a full release gate
- Project Composer and Data Batch Builder
- proof matrices, snapshots, rollback, workspace packages, and family packages
- Recovery Center, safety capsules, rescue points, and transactional imports
- Intake Readiness Gate and local-intake handoff packets
- Blender, Godot, ComfyUI, Unity, Unreal, and MaterialX bridge scaffolds

## v0.9.1 hardening

### Persistence and recovery

- A failed browser-storage write now throws. Governed saves and imports no longer continue with a false success log; transactional operations roll back.
- Rollback snapshots and Project Composer revisions verify their recorded fingerprint before restore. A missing or mismatched fingerprint blocks the restore.
- Archiving an approved project or batch now preserves the explicit `ARCHIVED` lifecycle state.
- Missing or inactive mold/theme dependencies block project and batch approval. Archived records can remain inspectable without becoming silently release-ready.
- Browser storage remains origin-specific working state, not a durable backup. Export safety capsules for independent copies.

### Packet and batch intake

- Current workspace, family, project, batch, safety-capsule, and rescue packets require a valid FNV-1a-32 integrity fingerprint before import or restore.
- FNV-1a-32 is non-cryptographic and collision-prone. It is evidence for accidental corruption only—not a signature, identity proof, or adversarial trust boundary.
- CSV and JSON batch sources reject more than 100 rows or 100 columns, cells longer than 4,000 characters, and ragged CSV rows. Header normalization and collision renames are preserved explicitly so values are not silently overwritten or dropped.
- Quarantined theme previews render only after the declarative theme record passes validation; unsafe preview values are shown as blocked rather than injected into the DOM.

### Local launch and package verification

- The default workspace origin is stable at `http://127.0.0.1:8765/`.
- If AXM already owns port 8765, the launcher reuses it. If another process owns it, launch is refused instead of silently changing the browser-storage origin.
- The local server accepts only local Host names, binds only to `127.0.0.1`, disables directory listing, and retains restrictive local security headers.
- Launch diagnostics verify hashes and exact manifest coverage: a missing, changed, duplicate, unsafe, symlinked, or unlisted file in the release-manifest scope fails diagnostics. Runtime output areas are intentionally outside that scope.

### Mobile, light-theme, and accessibility polish

- improved light-theme semantic contrast;
- mobile navigation and action wrapping;
- clearer current-view state;
- keyboard-contained focus preview with an explicit exit, Escape handling, scroll restoration, and focus return;
- better dialog labels, live hints, and invalid-field feedback;
- exact `RESET`, `RESTORE`, and `DELETE` confirmation remains required.

## Launch

Windows:

```text
START_HERE.bat
```

Full diagnostics:

```text
RUN_DIAGNOSTICS.bat
```

Cross-platform:

```bash
python start_server.py
```

The default launch uses port `8765`. A non-default `--port` is an explicit separate browser-storage origin.

Manual launch diagnostics:

```bash
python start_server.py --diagnose
```

## Recommended final intake sequence

1. Preserve the ZIP unchanged.
2. Verify the ZIP SHA-256 shown in the handoff message.
3. Extract to a new writable folder.
4. Run `RUN_DIAGNOSTICS.bat`.
5. Launch with `START_HERE.bat`.
6. Confirm the browser opened `http://127.0.0.1:8765/app/index.html`.
7. Inspect the main views, mobile layout, light theme, keyboard flow, and exports in Windows Chrome or Edge.
8. Record the browser visual check in **Recovery + Intake**.
9. Export a safety capsule to an independent location.
10. Run the Intake Readiness Gate.
11. Export the Local-Intake Handoff packet.

## Honest boundary

This is a hardened local-intake checkpoint, not a claim of universal engine parity or cryptographic authenticity. Final Windows Chrome or Edge visual inspection and every downstream adapter’s target-engine parity remain **LOCAL VALIDATION REQUIRED**. Direct-file mode has a separate browser-storage origin and does not receive the localhost server’s response headers.
