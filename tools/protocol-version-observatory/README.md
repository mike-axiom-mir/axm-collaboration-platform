# AXM Protocol Version Observatory

Integrated `TEST` module. It maps exact manifest and contract protocol declarations by role and groups only AXM's explicit trailing `/v...` convention.

## What it owns

- exact declared tokens and declaration roles;
- exact AXM slash-version family grouping;
- multiple-version and mixed unparsed-family visibility;
- future-prefixed declaration visibility;
- deterministic source fingerprint and freshness TTL.

## Preserved adjacent owners

Handoff Wiring Observatory owns exact producer/consumer wiring. Schema Identity Observatory owns `$id` definition identity. Compatibility Check and adapters retain compatibility and transformation authority.

## Run

```text
node protocol-cli.js --root /path/to/axm-workshop
node protocol-cli.js --root /path/to/axm-workshop --output current-protocol-surface.json --browser-output current-protocol-surface.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No output file is written unless an output path is explicit.
