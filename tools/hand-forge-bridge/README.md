# AXM Hand Forge Bridge

Status: TEST. Output status: EXPERIMENTAL review package.

This adapter closes a contract gap between the hand-definition chain and the
existing Agent Tool Forge. It consumes an exact pair:

- `axm.missing-hand-specification/v1`; and
- `axm.hand-verification-plan/v1` whose source fingerprint matches that exact
  specification.

It maps the pair into `axm.forge-draft/v1`, delegates package construction and
SHA-256 fingerprinting to `tools/agent-tool-forge/forge-core.js`, adds the source
specification and verification plan to the package, recalculates the package
fingerprint, and emits `axm.hand-forge-bridge-receipt/v1`.

## Supported routes

The Bridge supports Agent Tool Forge package kinds that do not need a copied
Foundation runtime:

- machine capability;
- Hub module; and
- proposal-only analyzer.

Foundation tool and dual-door routes are intentionally refused. Those require
an explicit Foundation source intake and belong in a separate authorized step.

## Truth boundary

The Bridge creates review material only. Its receipt records:

```text
installed: false
executed: false
authorityGranted: false
promoted: false
released: false
canon: false
```

The UI performs no fetch, persistent storage, implicit write or background
action. Review JSON, receipt JSON and the deterministic STORE-method ZIP are
created only through explicit download buttons.

## Checks

```powershell
node tools\hand-forge-bridge\selftest.js
node tools\hand-forge-bridge\discovery-seam-review.js
```
