# TEST REPORT — AXM Visual Mold Foundry v0.9.1

**Date:** 2026-07-28  
**Package:** final AXM Visual Mold Foundry v0.9.1 release artifact

## Final release result

```text
FINAL EXTRACTED-PACKAGE RESULT: PASS
AUTOMATED PASS / FAIL / SKIP TOTALS: 59 PASS / 0 FAIL / 0 SKIP
SHA-256 MANIFEST ENTRIES VERIFIED: 149
```

These totals come from the rebuilt manifest and the exact cleanly extracted v0.9.1 artifact. The browser functional smoke ran read-only in headless Chromium.

## Required hardening coverage

- persistence failure throws, false-success prevention, and transactional rollback;
- malformed-storage preservation and explicit recovery;
- valid/missing/mismatched snapshot and project-revision restore fingerprints;
- required integrity on current workspace, family, project, batch, capsule, and rescue packets;
- archive lifecycle and inactive-dependency approval gates;
- batch row/column/cell caps, ragged CSV rejection, and collision-safe header preservation;
- safe quarantined-theme preview behavior;
- stable port 8765 reuse/refusal behavior and local Host allowlist;
- exact SHA-256 manifest coverage, including unlisted-file rejection;
- mobile navigation, light-theme contrast, focus preview, dialog, and keyboard behavior;
- protected registry, migration, project, batch, recovery, and intake-readiness regressions.

## Local visual validation

Final inspection in Windows Chrome or Edge remains **LOCAL VALIDATION REQUIRED** and must be recorded through the readiness interface. Check dark and light themes, mobile and desktop widths, keyboard navigation, focus preview, dialogs, canvases, and representative exports.

Downstream Blender, Godot, ComfyUI, Unity, Unreal, and MaterialX parity also remains **LOCAL VALIDATION REQUIRED**.

## Commands

```bash
python tests/run_tests.py
node tests/node_smoke.js
node tests/dialog_smoke.js
python start_server.py --diagnose
```

After rebuilding `FILE_MANIFEST_SHA256.txt`, run the same checks from a clean extraction before filling the final result fields.
