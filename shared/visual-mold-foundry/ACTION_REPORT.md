# ACTION REPORT — AXM Visual Mold Foundry v0.9.1

## Steward decision

The useful next step was a hardening patch, not another architecture or mold expansion. v0.9.1 focuses on truthful persistence, restore integrity, bounded intake, a stable local origin, and accessible operation while preserving the protected library.

## Work completed

### 1. Truthful persistence and rollback

- failed storage writes throw instead of being followed by a success log;
- transactional saves, imports, and restores roll back on persistence failure;
- malformed stored values remain available for explicit inspection and repair;
- browser storage is documented as origin-specific working state, not a backup.

### 2. Restore and packet integrity

- snapshots and project revisions verify their fingerprint before rollback;
- current workspace, family, project, batch, safety-capsule, and rescue packets require a valid FNV-1a-32 fingerprint;
- missing or mismatched integrity blocks import/restore before mutation;
- FNV-1a-32 remains explicitly non-cryptographic and collision-prone: it detects accidental change but is not a digital signature.

### 3. Lifecycle and bounded assembly

- archiving an approved project or batch now leaves it `ARCHIVED`;
- project and batch approval is blocked by missing or inactive dependencies;
- batch intake rejects more than 100 rows or 100 columns, ragged CSV, and cells longer than 4,000 characters;
- sanitized or duplicate headers receive explicit collision-safe names, and distinct source values are preserved;
- project and batch mutations reject oversize input rather than slicing it.

### 4. Local launch and package verification

- port 8765 is the stable default browser-storage origin;
- an existing AXM server on that port is reused, while an unrelated process causes a clear refusal;
- the server binds only to `127.0.0.1` and applies a local Host allowlist;
- diagnostics verify exact SHA-256 manifest coverage for the defined release scope.

### 5. Safer and more accessible presentation

- quarantined theme previews render only after safe declarative validation;
- light-theme contrast and responsive action layout were improved;
- mobile navigation exposes the active view;
- focus preview now has explicit keyboard exit, focus containment, scroll handling, and focus restoration;
- dialog labels, live hints, and invalid states were strengthened.

## Direction preserved

- 32 protected molds remain unchanged;
- no silent approval, activation, reset, or restore;
- local growth remains separate from protected canon;
- Windows Chrome/Edge visual inspection remains **LOCAL VALIDATION REQUIRED**;
- no downstream-engine parity or cryptographic-authenticity claim;
- no feature-count inflation.

## Release verification handoff

Final pass/hash totals belong to the final manifest and extracted-package verification run. This report intentionally does not freeze counts before that release step.
