# Deterministic UI Fabric

`TEST` fail-closed machine-to-human handoff for `ui-component@1.2.0`.
The provider now supports a bounded public create/edit route and emits a strict
editable recipe master. This leaf does not register another hand, render an
interactive UI, or claim human approval.

```js
const Hands = require("../asset-hands/asset-hands");
const UiFabric = require(".");

const result = Hands.create("ui-component", brief, { seed, createdAt, host });
const handoff = UiFabric.gateResult(result);
```

Only `handoff.status === "PASS"` may enter the separate human sensory lane. The
gate requires a whole READY/PASS candidate result, the exact SVG/spec/recipe
artifact transaction, candidate-only authority, strict recipe/source lineage,
safe inert SVG structure, recipe/spec/SVG cross-binding, and a serialized
response below 2 MiB. Full SHA-256 values are reported separately from Asset
Hands' short transport digests.

`ui-source` remains a static visual. The human workbench must decode it as an
image and draw it to canvas; it must not inject the SVG markup into executable
DOM. State, nine-slice, focus, responsive, zoom and input journeys require the
trusted local human wrapper and real observation.

See `UI_SENSORY_HANDOFF.md` for the exact cross-lane contract and open evidence
seats.
