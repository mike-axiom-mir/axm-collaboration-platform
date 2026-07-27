# AXM Governed Installer & Update Manager

Module Installer is the Workshop's bounded write path for returned build-on ZIPs and local module bundles. It stages files outside `tools`, validates the manifest and contract, opens an exact-digest Review Inbox item, and keeps the candidate held until that same digest is approved.

## Simple build-on return

1. Create a **Current build-on ZIP** in Workshop Packager.
2. Give that ZIP to a platform, another AI, or a human. `BUILD_ON_GUIDE.md` tells them what may change and how to return it.
3. Take their ZIP into **Returned build-on ZIP** here.
4. The installer checks that the ZIP came from the packager, that the exported base still exactly matches the live module, that only the chosen module changed, and that the return contains a real change.
5. Review and explicitly install the exact candidate through the existing gates.
6. The installer keeps exactly one previous generation and launches the installed module's `selftest.js` through the allowlisted machine host when available.
7. A failed self-test shows **Roll back previous**. Rollback remains explicit and is refused if the installed bytes changed after apply.

This is a current-local-build round trip. The collaborator does not need GitHub, and the receiver never overlays a stale export or silently changes context files.

Review approval is evidence, not install authority. An install request still needs:

1. the linked Review Inbox item to be `APPROVED` for the exact staged SHA-256 digest;
2. a current `module.install` permission grant;
3. the exact typed confirmation `INSTALL REVIEWED MODULE`;
4. a fresh server-side digest, contract, and exported-base recheck; and
5. a single retained previous generation before an existing module is replaced.

`GET /api/installer` joins the candidate and Review Inbox record into a read-only `axm.module-install-governance-view/v1`. Reading that view never changes either ledger and never grants apply authority. Missing, held, rejected, superseded, cancelled, repair, or digest-mismatched reviews stay visibly held.

The installer does not download modules, auto-install, auto-roll back, auto-promote, treat structural readiness as install approval, or bypass Mike's merge gate. It remains `TEST` until human promotion.

## Evidence

```powershell
node tools/module-installer/selftest.js
node tools/module-installer/discovery-seam-review.js
node shared/operations/selftest.js
node verify.js
```

The live route is `/tools/module-installer/index.html`.
