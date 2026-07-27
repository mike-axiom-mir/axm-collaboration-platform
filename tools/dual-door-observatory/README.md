# AXM Dual Door Observatory

Detached `EXPERIMENTAL` candidate. It maps the human workspace entry and the
optional machine action entry declared by each top-level module manifest.

## What it owns

- safe relative-path presence checks for manifest `entry`;
- optional `manifest.machine.entry` presence checks;
- exact machine status, API version, effect, forbidden identifiers, and action
  identifiers;
- distinct `STRING_ARRAY` and `OBJECT_MAP` action declaration shapes;
- freshness and source-scope receipts;
- one bounded `axm.door-review-request/v1` for an exact present human door, or
  an exact present machine door plus one declared action.

The request is a handoff, not an execution plan. A human-door request asks the
Browser/LAN/Hardware QA Lab or Hub owner to open one route and record its
visible result. A machine-door request asks Machine Host and the declaring
module owner to review and run one declared action with a separately approved
fixture. Neither request includes a command, arguments, environment values, or
input fixture.

## Preserved adjacent owners

Hub and Capability Index retain human routing. Machine Host retains machine
execution. Each declaring module retains its action semantics. Technical
Glasses retains readiness and permission owners retain grants. The other 79
current modules having no explicit machine door is an optional absence, not a
defect or failed parity claim.

## Run

```text
node dual-door-cli.js --root /path/to/axm-workshop
node dual-door-cli.js --root /path/to/axm-workshop --output current-dual-door-map.json --browser-output current-dual-door-map.js --quiet
node dual-door-cli.js --root /path/to/axm-workshop --request-module evidence-desk --request-door machine --request-action validate --review-output current-door-review-request.json --browser-review-output current-door-review-request.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No file is written unless an output path is explicit. Entry files are checked
with `lstat` and are never loaded or executed. A human request must not include
an action; a machine request must name one action already present in the map.
