# AXM Schema Identity Observatory

Detached `EXPERIMENTAL` candidate. It scans bounded active JSON as inert data and reports exact `$id`, `schema`, and `schema_version` identity evidence.

## What it owns

- exact local `$id` occurrence and definition digests;
- identical-definition reuse versus divergent same-ID definitions;
- exact local presence or absence of referenced identities;
- a deterministic source fingerprint and freshness TTL.

## What it does not own

It does not validate JSON Schema semantics, consult an external registry, infer compatibility, merge identities, generate adapters, repair source, stage, install, grant permissions, promote, or change CANON.

## Run

```text
node schema-cli.js --root /path/to/axm-workshop
node schema-cli.js --root /path/to/axm-workshop --output current-schema-map.json --browser-output current-schema-map.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
```

No output file is written unless an output path is explicit.
