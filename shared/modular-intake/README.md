# Neutral Modular Intake

This subsystem lets the Workshop accept pieces it knows, pieces it does not know yet, and future categories without pretending that recognition grants authority.

## Non-negotiable boundary

Modularity does not own direction. A family contract declares how to identify and store a piece, not what creators must use it for. Unknown families are preserved as `FAMILY_CONTRACT_REQUIRED`; they are never coerced into the nearest current category.

The intake flow is:

`inspect -> quarantine -> family compatibility -> exact-digest review -> explicit permission -> inert promotion`

- Inspection is read-only.
- Quarantine cannot execute package files.
- Default promotion review requires two independently attributed seats.
- A changed package has a changed digest and loses the old approval.
- Modules are routed into the existing Governed Installer and are not installed by this layer.
- Other pieces enter `intakes/modular-pieces/promoted/<family>/<id>/<version>/` with execution authority `none`.
- Promotion emits `axm.component-backup-request/v1`. Until an external drive adapter is configured, the request honestly remains `AWAITING_CONFIGURED_TARGET`.

## Portable package

```json
{
  "schema": "axm.modular-piece-package/v1",
  "piece": {
    "id": "example-piece",
    "family": "schema",
    "version": "1.0.0",
    "title": "Example piece",
    "capabilities": {"provides": ["example.capability"], "requires": []},
    "protocols": []
  },
  "files": [
    {"path": "schema.json", "encoding": "utf8", "content": "{\"schema\":\"example/v1\",\"id\":\"example-piece\"}"}
  ],
  "requiredSeats": "dual"
}
```

File paths are relative, bounded and traversal-safe. Files may use `utf8` or `base64`; an optional per-file `sha256` is checked. The complete normalized envelope also receives an exact package digest.

## Known families

Built-ins are `module`, `universal-component`, `hand`, `organ`, `schema`, `protocol`, and `verifier`. Custom families can be proposed through `axm.modular-family-contract/v1`, but reviewed custom contracts are restricted to neutral-library storage and `executionAuthority: none`.

## Needs loop

The Workshop Needs Observatory inventories module contracts and promoted pieces, records exact required capability IDs, and lets a candidate be matched only when its declared provides-set covers the need. A staged candidate produces `MATCHED`; a promoted candidate produces `READY_TO_CLOSE`; only the explicit phrase `ACCEPT BUILT CAPABILITY` records `SATISFIED`.

This avoids both fake completion and endless automatic building.
