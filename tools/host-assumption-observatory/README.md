# AXM Host Assumption Observatory

Integrated `TEST` module. It inventory-checks machine-declared host
assumption syntax without pretending to inspect the machine itself.

## What it owns

- exact assumption tokens from selected manifest and contract fields;
- separate filesystem, host-resource, browser, network, runtime/tool,
  operating-system, absolute-path, backslash-path, and environment-variable
  syntax labels;
- module and declaration-role attribution;
- an explicit `DECLARED_NOT_PROBED` state and freshness receipt;
- one selected module's deterministic `axm.environment-probe-request/v1`
  handoff, with every requested check still `REQUEST_NOT_RUN`.

## Preserved adjacent owners

Touch Environment Probe remains the runtime skill that compares declared
assumptions with an actual host. Technical Glasses remains readiness truth.
Dependency Declaration Observatory retains module topology. Permissions
Console retains real grants. This candidate prepares a request for Touch; it
does not run the request or capture environment values.

## Run

```text
node host-assumption-cli.js --root /path/to/axm-workshop
node host-assumption-cli.js --root /path/to/axm-workshop --output current-host-assumption-map.json --browser-output current-host-assumption-map.js --quiet
node host-assumption-cli.js --root /path/to/axm-workshop --probe-module body-pulse --probe-output current-environment-probe-request.json --browser-probe-output current-environment-probe-request.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No output is written unless an output path is explicit. Natural-language
README, action, note, and source-code text are deliberately outside scope.
