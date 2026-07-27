# AXM Secrets & Permissions Console

This module is the Workshop's local control plane for two related but separate things:

- encrypted secret values, which are write-only from the browser and readable only by a matching internal consumer scope while the vault is unlocked;
- module permissions, which are denied by default and can only be decided when the exact permission appears in the module's `manifest.permissions` array.

A module's `uses` array is dependency context, not authority. Entries such as `storage`, `gate`, `review-inbox`, or another service name are shown to the operator but cannot be granted by this console unless the module separately declares the same identifier as a permission.

Permission decisions require a reason, an explicit request header, and the exact typed confirmation `SET MODULE PERMISSION`. Optional expiries must be valid future timestamps. The effective view distinguishes `ALLOWED`, `DENIED`, `EXPIRED`, `UNDECIDED`, `UNDECLARED`, and invalid legacy entries; anything except `ALLOWED` is ineffective.

Secret metadata distinguishes `ACTIVE`, `EXPIRED`, `REVOKED`, and invalid legacy expiry. Stored values are absent from all browser responses and audit events. Revocation permanently removes the encrypted value and therefore requires selecting the secret plus the exact typed confirmation `REVOKE SECRET`.

Links may preselect a declared permission with `?module=<module-id>&permission=<permission-id>`. This changes visual context only and never records a decision.

The module remains `TEST`. It does not auto-grant, auto-unlock, reveal values, promote itself, or bypass Mike's merge gate.

## Evidence

```powershell
node tools/secrets-permissions-console/selftest.js
node tools/secrets-permissions-console/discovery-seam-review.js
node shared/operations/selftest.js
node verify.js
```

The live route is `/tools/secrets-permissions-console/index.html`.
