# Workshop Updater foundation

This is the local-first receiving half of a future AXM release loop. The Workshop remains independent and makes no network request while the updater is off. A user may explicitly enable canonical GitHub checks; the Platform Heartbeat then decides when a due check may occur.

## What works now

- `OFF_ZERO_NETWORK` is the default persisted state.
- The repository and branch are pinned to `mike-axiom-mir/axm-collaboration-platform` and `main`.
- Enabling requires the exact phrase `ENABLE WORKSHOP UPDATE CHECKS`.
- `CHECK_ONLY` reads the GitHub commit receipt and the commit-pinned `AXM_UPDATE_MANIFEST.json`.
- `AUTO_STAGE` additionally requires `ALLOW VERIFIED UPDATE DOWNLOADS`.
- Archives must be commit-pinned `codeload.github.com` URLs, no larger than 512 MiB, signed with Ed25519 by a pinned release key, and byte-for-byte equal to the signed SHA-256 and size.
- A verified archive is written only under `state/workshop-updater/staging` and receives a digest-bound staging-evidence file, candidate, and check receipt.
- Scheduled checks are driven by scheduled Platform Heartbeats. A due check must then receive one bounded Body Pulse lease before any network adapter is called. Manual beats do not spend updater network authority.

## Deliberate hold

The module has no whole-Workshop install authority. It does not extract, overlay, delete, restart, promote, merge, or roll back the live Workshop. A safe automatic install still needs a separate restart-safe hand that can:

1. compare the installed release ledger with current local files;
2. hold local modifications instead of overwriting them;
3. stage and verify a complete bootable public-safe Workshop;
4. preserve one complete rollback generation outside the live tree;
5. apply while the Hub is stopped and recover after interruption; and
6. boot, run the public verification profile, then expose an explicit rollback path.

`trusted-release-keys.json` is intentionally empty until a release key is generated, stored safely, and promoted by explicit stewardship. Therefore enabling `AUTO_STAGE` today still cannot download an untrusted release.

The exact contracts for the two missing hands are recorded in `future-hands.json`; the gap is specified rather than hidden.

## Release manifest

GitHub must publish `AXM_UPDATE_MANIFEST.json` at the exact commit returned for `main`. Its schema is `update-manifest.schema.json`. Signatures cover the stable-key-order JSON payload with the `signatures` field removed.

## Evidence

```powershell
npm.cmd run test:updater
python %USERPROFILE%\.codex\skills\detect-capability-gaps\scripts\compare_capabilities.py --requirements shared\workshop-updater\capability-requirements.json --capabilities shared\workshop-updater\capability-inventory.json
```

The tests use an in-memory GitHub fixture and a temporary archive. They perform no real network request and never touch the live Workshop.
