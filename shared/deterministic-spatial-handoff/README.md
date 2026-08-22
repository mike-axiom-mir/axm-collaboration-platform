# Deterministic Spatial Handoff

`TEST` fail-closed machine-to-human gate for the existing
`parametric-mesh@1.1.0` Asset Hand. This leaf does not generate geometry,
register a hand, mutate the provider, or provide a second creation route.

```js
const Hands = require("../asset-hands/asset-hands");
const SpatialHandoff = require(".");

const result = Hands.create("parametric-mesh", brief, { seed, createdAt, host });
const handoff = SpatialHandoff.gateResult(result);
```

Only `handoff.status === "PASS"` may enter the separate human spatial sensory
workbench. The gate requires the exact four-artifact, one-object/one-material
profile; reconstructs the expected OBJ and GLB geometry from the editable
project; validates accessors, bounds, baked transforms, normals, triangle and
material projection; and computes full SHA-256 values separately from Asset
Hands transport digests.

The SVG is always static sampled proof. The GLB intentionally omits authoring
camera, emissive, shadow flags, lights, hierarchy, motion, rigs, UVs and
textures. Neither artifact proves a dynamic browser journey, target-renderer
parity, physical scale, controller/XR behavior, accessibility, conformance, or
human aesthetic approval.

See `SPATIAL_SENSORY_HANDOFF.md` for the exact cross-lane contract.
