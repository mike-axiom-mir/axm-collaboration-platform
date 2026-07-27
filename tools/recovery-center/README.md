# AXM Recovery & Rollback Center

This module governs private Workshop snapshots, selective restores, and reversal of a completed restore.

Restore is a two-stage operation. `axm.restore-preview/v2` binds the retained snapshot manifest, every selected snapshot file hash, and the current existence/hash of every selected Workshop target. The preview expires after 15 minutes. Apply rechecks all of those facts before it creates a pre-restore safety folder or writes any target.

Successful restore writes both a persistent lineage entry and `AXM_RESTORE_RECEIPT.json` beside `AXM_PRE_RESTORE.json`. A rollback begins with its own preview. It is held if current bytes drifted or if a later active restore overlaps the same file set. Eligible rollback requires the same `recovery.apply` permission plus exact `ROLL BACK RESTORE` confirmation, and it preserves the restored bytes in a second pre-rollback safety folder before restoring previous files or removing files created by that restore.

Read-only recovery status includes recent preview metadata with a derived effective state. Reloading the page resumes the newest still-valid preview; expired and legacy-unbound previews remain visible as evidence but cannot re-enable an apply button.

The service does not claim a filesystem-wide transaction. It preflights the complete selection before writing and attempts automatic repair from the safety copy if a mid-copy failure occurs; an incomplete repair remains explicit in the safety manifest and audit trail.

The optional daily schedule is only an in-process timer while the Workshop server is running. It does not install or modify an operating-system scheduled task. Nothing restores, rolls back, uploads, deletes absent files during restore, promotes itself, or grants permission automatically.

The module remains `TEST`, behind Mike's human promotion gate.

## Evidence

```powershell
node tools/recovery-center/selftest.js
node tools/recovery-center/discovery-seam-review.js
node shared/operations/selftest.js
node verify.js
```

The live route is `/tools/recovery-center/index.html`.
