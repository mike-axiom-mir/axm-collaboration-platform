# AXM Evidence Chain Recovery Snapshot Staging Foundry

Status: `TEST`

This Foundry closes `capability.stage.evidence-chain-recovery-snapshot/v1`. It does not close `capability.place.evidence-chain-recovery-snapshot/v1` or `capability.apply.evidence-chain-reviewed-recovery/v1`.

It converts an exact reviewed evidence-chain candidate into the directory and manifest layout Recovery Center reads:

```text
axm-evidence-chain-recovery-stage-*/
  STAGING_RECEIPT.json
  axm-workshop-full-evidence-repair-*/
    PACKAGE_MANIFEST.json
    state/evidence-retention/.../*.jsonl
```

The package manifest uses `axm.workshop-package/v1`, `mode: full`, a one-file SHA-256 ledger, exact UTF-8 byte count, and digest lineage back to the integration packet, application plan, conformance run, broken source, and reviewed candidate.

## Safety boundary

- Output must be one explicit absolute root whose basename begins `axm-evidence-chain-recovery-stage-`.
- The root must not exist.
- Its existing parent must be canonical, non-symlink, and a directory.
- Target paths are limited to a JSONL file beneath `state/evidence-retention/<subfolder>/`.
- Source and candidate input files are read only.
- Partial roots are deleted after any validation, write, readback, or injected failure.
- A successful root is intentionally retained only after the operator passes `--retain-staging` and `--no-live-placement`.

## CLI

```powershell
node tools/evidence-chain-recovery-snapshot-staging-foundry/cli.js `
  --source broken.jsonl `
  --candidate candidate.jsonl `
  --plan plan.json `
  --conformance conformance.json `
  --integration integration.json `
  --target-relative state/evidence-retention/session/events.jsonl `
  --output-root C:\tmp\axm-evidence-chain-recovery-stage-review `
  --confirm PACKET_ID `
  --target-path-private `
  --retain-staging `
  --no-live-placement `
  --no-authority
```

The CLI prints a digest-only receipt. The target path remains inside the private request and package manifest, but is omitted from stdout and `STAGING_RECEIPT.json`.

## Limits preserved

- The staging root is not written beneath `exports/workshop-packages`.
- No trusted placement, restore test, Recovery Center preview, permission check, apply, inspection, or rollback occurs.
- A compatible directory layout is not proof that Recovery Center will accept or safely use it.
- No identity, secret, source payload, candidate payload, output-root path, or target path enters the receipt.
- Nothing is installed, promoted, or made CANON.
