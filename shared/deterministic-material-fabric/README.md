# Deterministic Material Fabric

`TEST` machine-to-human handoff gate for the existing
`pbr-material-bake@1.1.0` Asset Hand. This leaf does not synthesize maps and is
not a second public creation route. It fail-closes whole Asset Hand results,
checks the exact eight-artifact contract, verifies per-map sampling semantics,
parses PNG envelopes, and computes full PNG byte SHA-256 values.

```js
const Hands = require("../asset-hands/asset-hands");
const Material = require(".");

const result = await Hands.createAsync("pbr-material-bake", brief, { seed });
const handoff = Material.gateResult(result);
```

Only `handoff.status === "PASS"` may enter the separate human material sensory
review surface. `HOLD`, `FAIL`, oversized, malformed, non-candidate, or sampling-
ambiguous results return a typed fail-closed handoff. Nothing here installs,
binds, promotes, canonizes, or aesthetically approves a material.

See `MATERIAL_SENSORY_HANDOFF.md` for the exact cross-lane contract and open
evidence seats.
