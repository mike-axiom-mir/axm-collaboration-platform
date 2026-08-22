# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Recorded evidence | Boundary |
|---|---|---|---|
| Current ledger snapshot is read-only | File-content fingerprint before/after plus source inspection | Focused test compares the exact namespace tree; runtime source contains no write APIs | Does not authenticate observer origin |
| Current entries are exact | Parsed manifest, names, files, receipt validators | Strict current-state capture and invalid-state fixtures | Current caller-owned files can still be altered |
| Checkpoint is internally consistent | Canonical rebuild and negative tamper tests | Summary, ordering, truth and digest tampering are refused | Self-digest is not authenticated authority |
| Exact continuity survives restart | Fresh independent process | Child process reloads state and returns `CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT` | Presented checkpoint only |
| Forward extension is distinct | Fresh independent process plus added challenge digest | Child process reports one exact added challenge | Not adoption or execution authority |
| Missing entry is detected | Fresh process after exact owned-file deletion | Missing checkpoint challenge produces relative rollback classification | Detection does not restore or prevent |
| Valid replacement is detected | Fresh process after valid same-challenge re-consumption | Changed consumption-receipt digest is retained | No actor or intent inference |
| Whole namespace deletion is detected | Fresh process after verified temporary namespace deletion | `HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT` | Checkpoint retention itself is unproven |
| Invalid or different state holds | Corrupt file, unexpected names, different valid manifest | Invalid-state and identity-drift classifications | No automatic repair |
| No path/signature/actor retention | Serialized artifact inspection | Checkpoint contains only bounded ids, timestamps and digests | Synthetic input remains in temporary test memory/files only |
| No consequential authority | Contract, schemas, truth fields, negative tests | All host/human/execution/adoption/promotion/merge/CANON fields remain false | Mike remains merge and CANON gate |
| Source identity | Normalized byte digests | `SOURCE_SNAPSHOT.json` | Fifteen named inputs only |
| Required regressions | Process exit codes | `CHECK_RESULTS.json` | Passing stdout is not retained |
| Browser behavior | Browser render/click evidence | `NOT_RUN` | No browser surface exists |
| Human/provider benefit | Real review, execution, evaluation, held-out outcome | `UNKNOWN` / `NOT_RUN` | Synthetic fixtures cannot substitute |
