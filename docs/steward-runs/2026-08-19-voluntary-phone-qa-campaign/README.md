# Voluntary physical-phone QA campaign audit

Status: `TEST`

This additive lane composes the current Game Hub warning report with the exact
existing Browser, LAN & Hardware QA Lab contract. It creates a deterministic,
privacy-sanitized campaign and an optional human handoff without modifying the
Lab, games, manifests, report generator, or registry.

Build the current artifacts:

```powershell
node docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/build-current-campaign.js
```

Then run the independent capability comparator for the BEFORE and AFTER
inventories, followed by:

```powershell
node shared/voluntary-phone-qa-campaign/selftest.js
node docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/selftest.js
```

No physical-phone session, human review, candidate receipt, warning closure,
manifest mutation, permission grant, merge, promotion, CANON decision, model
training, or Foundation mutation is performed by this audit.

