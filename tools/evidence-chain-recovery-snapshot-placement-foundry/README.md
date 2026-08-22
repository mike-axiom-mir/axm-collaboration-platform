# AXM Evidence Chain Recovery Snapshot Placement Foundry

Status: **TEST**. This is a local, high-risk, explicit placement hand. It closes `capability.place.evidence-chain-recovery-snapshot/v1`; it does not close `capability.apply.evidence-chain-reviewed-recovery/v1`.

The Foundry consumes the retained root produced by the Recovery Snapshot Staging Foundry. It re-reads `STAGING_RECEIPT.json`, the exact `PACKAGE_MANIFEST.json`, and the one reviewed JSONL candidate. It refuses any extra package file, symlink, special file, unsafe path, ledger mismatch, stale manifest, prior placement receipt, output collision, or orphan scratch folder.

The destination must already exist and resolve canonically as an `exports/workshop-packages` directory. Placement copies the two package files into a private scratch directory beneath that destination, verifies both files, and renames the scratch directory to the exact `axm-workshop-full-evidence-repair-*` snapshot ID. It then verifies the receiver-visible copy and writes `PLACEMENT_RECEIPT.json` back to the retained staging root. Request and receipt artifacts include only destination-path SHA-256, never the local path.

On a handled failure, the hand removes only the scratch/final folder it created and only its own just-written receipt. The original staging receipt, manifest, and candidate remain untouched. A process crash can leave a hidden scratch folder; a later run refuses that evidence instead of deleting it automatically.

## Node placement

```powershell
node tools/evidence-chain-recovery-snapshot-placement-foundry/cli.js `
  --staging-root "<private-retained-stage>" `
  --packager-output "<workshop-root>\exports\workshop-packages" `
  --confirm-snapshot "<snapshot-id-from-STAGING_RECEIPT>" `
  --place-in-packager-output `
  --private-local-data `
  --retain-staging `
  --no-restore-authority
```

The browser page prepares a placement request only. Browser file selection never writes the destination.

## Verification

```powershell
node tools/evidence-chain-recovery-snapshot-placement-foundry/selftest.js
node tools/evidence-chain-recovery-snapshot-placement-foundry/discovery-seam-review.js
```

The selftest builds a real upstream staging fixture, runs every handled fault boundary, checks collision and tamper refusal, invokes the real Recovery Center receiver in an isolated root to prove list/preview compatibility, and confirms that no apply occurred.

## Truth boundary

Placement means the private snapshot folder is discoverable by the Recovery Center layout contract. It does **not** mean the live server observed it, a restore test passed, a preview exists, `recovery.apply` was checked or granted, the current target still matches the reviewed source, any candidate was applied, or rollback was exercised. Those remain separate evidence and authority gates.
