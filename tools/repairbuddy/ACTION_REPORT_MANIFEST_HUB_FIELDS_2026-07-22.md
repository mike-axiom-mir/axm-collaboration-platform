# Verified repair: missing Hub manifest fields

Date: 2026-07-22

## Observed failure

`node verify.js` reported the same two exact failures for two Hub modules:

- `hub-module missing hubApiVersion`
- `hub-module permissions must be an array`

The affected manifests already declared `type: "hub-module"` and carried `export` in their `uses` arrays.

## Repair performed by the builder

The builder copied the established Hub-manifest fields used by healthy sibling modules:

```json
"hubApiVersion": "1.0",
"permissions": ["export"]
```

No other manifest values were intentionally changed.

## Replay boundary

Repair Buddy may replay this repair only when all of these preconditions are true:

1. the target is exactly a `tools/<module>/manifest.json` file inside the Workshop;
2. the parsed manifest declares `type: "hub-module"`;
3. `hubApiVersion` is absent;
4. `permissions` is absent;
5. `uses` is an array containing `export`;
6. the verifier reports both exact failure messages for that same manifest;
7. a human explicitly invokes replay after seeing a preview.

If one condition differs, the recipe does not adapt or write code. It stops and escalates.

## Verification

- `node verify.js`
- Repair Buddy isolated replay fixture, including refusal, idempotence, verification and rollback cases.

