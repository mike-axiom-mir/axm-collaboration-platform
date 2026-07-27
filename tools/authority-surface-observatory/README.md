# AXM Authority Surface Observatory

Status: `EXPERIMENTAL` detached candidate  
Installed: `false`  
Promoted: `false`  
CANON: unchanged

This module scans one explicit AXM Workshop root and maps static authority declarations across top-level Hub modules:

- manifest `permissions[]`;
- manifest `uses[]` as the declared capability envelope;
- contract `permissions[]`;
- contract `boundaries.writes[]`;
- contract `boundaries.refuses[]`;
- exact drift or missing declaration state.

Missing authority data remains `CONTRACT_AUTHORITY_UNKNOWN` or `INCOMPLETE_DECLARATION`. An empty permission array is not proof that a module is safe. A declared refusal is not proof that runtime enforcement exists.

## Why this is separate

- Module Contract Verifier validates one declared contract structurally.
- Module Seam Audit maps lifecycle declaration gaps.
- Module Contract Workbench edits one selected manifest/contract pair.
- Secrets & Permissions Console creates and revokes actual grants.
- Diagnostics & Operations Center combines operational health.

None owns a read-only Workshop-wide inventory that keeps manifest permissions, contract permissions, `uses`, declared writes, and refusals visible together without changing grants.

## Run

```bash
node authority-cli.js --root /path/to/axm-workshop
```

Write only by naming an output:

```bash
node authority-cli.js --root /path/to/axm-workshop --output current-authority-map.json --quiet
node authority-cli.js --root /path/to/axm-workshop --browser-output current-authority-map.js --quiet
```

## Evidence limits

- Declared write labels are not resolved, opened, or tested.
- No secret values, permission ledgers, or runtime grants are read.
- No risk score or module ranking is generated.
- No contract is repaired automatically.
- No grant, manifest, contract, source, rollback, promotion, or CANON state is changed.

Run `node selftest.js /path/to/axm-workshop` for fixtures plus a live bounded scan.
