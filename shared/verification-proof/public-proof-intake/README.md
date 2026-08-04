# Public Proof local intake contracts

This implementation routes the complete 100-seed Runs 01–39 registry through
one bounded local contract service:

- 52 Run 39-eligible seeds can be schema-validated locally;
- 48 research/dependency-held seeds fail closed with explicit hold receipts;
- all 100 supplied schemas are preserved byte-for-byte;
- all 160 supplied P0 fixtures are preserved byte-for-byte;
- eligible P1 seeds receive deterministic in-memory valid and required-field
  blocked fixtures without inventing runtime evidence;
- metadata-only overlap candidates point at existing Workshop modules, while
  leaving weak or absent ownership matches visible.

The service has no public HTTP route and performs no writes, network access,
publication, automatic promotion, CANON change, or runtime-proof upgrade.

Run the integrated suite with:

```powershell
node tools/verification-proof-lab/selftest.js
```
