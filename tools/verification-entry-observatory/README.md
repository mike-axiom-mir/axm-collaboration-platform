# AXM Verification Entry Observatory

Detached `EXPERIMENTAL` candidate. It maps where verification-shaped entry
files and declared package scripts appear without running or approving them.

## What it owns

- exact relative paths whose filenames match an explicit test, selftest,
  spec, verify, verification, or discovery-seam-review pattern;
- separate labels for conventional root `selftest.js`, root
  `discovery-seam-review.js`, other module-local matches, and nested matches;
- matching `package.json` script declarations in `DECLARED_NOT_RUN` state;
- freshness and source-scope receipts;
- one exact mapped entry's `axm.verification-run-request/v1`, with every
  requested check still `REQUEST_NOT_RUN`.

## Preserved adjacent owners

Machine Host and module owners retain execution. Evidence Desk retains
execution receipts. Technical Glasses retains readiness. Root Workshop and
Hub verification programs retain their gates. A name match is not executable,
passing, covered, ready, or high-quality proof. The bounded request supplies
no command, arguments, environment values, or invented fixture.

## Run

```text
node verification-entry-cli.js --root /path/to/axm-workshop
node verification-entry-cli.js --root /path/to/axm-workshop --output current-verification-entry-map.json --browser-output current-verification-entry-map.js --quiet
node verification-entry-cli.js --root /path/to/axm-workshop --request-module technical-glasses --request-entry selftest.js --request-output current-verification-run-request.json --browser-request-output current-verification-run-request.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No file is written unless an output path is explicit. Source bodies and
excluded generated, state, dependency, vendor, asset, and local-data trees
remain outside scope.
