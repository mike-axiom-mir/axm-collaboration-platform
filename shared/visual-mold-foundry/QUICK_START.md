# QUICK START — AXM Visual Mold Foundry v0.9.1

## 1. Extract the full folder

Keep the complete extracted AXM package folder together in a normal writable location.

## 2. Run diagnostics

Double-click:

```text
RUN_DIAGNOSTICS.bat
```

This verifies critical files, registry JSON, JavaScript behavior, local-server assumptions, SHA-256 hashes, and exact release-manifest coverage. Missing, changed, duplicate, unsafe, symlinked, or unlisted in-scope package files fail diagnostics.

## 3. Launch

Double-click:

```text
START_HERE.bat
```

The normal workspace is `http://127.0.0.1:8765/app/index.html`. If AXM already owns port 8765, the launcher reuses it. If another process owns the port, the launcher refuses to switch silently because a different port would create a different browser-storage origin.

## 4. First useful flow

1. Open **Mold Editor**.
2. Change a title, message, or theme.
3. Open **Proof + Validation**.
4. Generate proof.
5. Open **Recovery + Intake**.
6. Export a safety capsule.
7. Run the Intake Readiness Gate.

## 5. Before importing or restoring

- Current workspace, family, project, batch, safety-capsule, and rescue packets need a valid integrity fingerprint.
- CSV/JSON batches are limited to 100 rows, 100 columns, and 4,000 characters per cell. Ragged CSV rows are rejected; explicit header renames must be reviewed before mapping.
- Missing or inactive dependencies block project and batch approval.
- Export a safety capsule before destructive repair. Browser storage is working state, not a durable backup.

## 6. Destructive actions

Reset, restore, and rescue deletion now use the Studio’s in-app action dialog. The confirm button stays disabled until the required word is typed exactly.

## 7. Direct-file fallback

`OPEN_DIRECT_FALLBACK.bat` opens the Studio without Python. It uses a separate, origin-specific browser workspace and does not receive the localhost response headers. Localhost mode on port 8765 remains recommended.
