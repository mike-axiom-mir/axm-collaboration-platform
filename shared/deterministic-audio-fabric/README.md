# Deterministic Audio Fabric

Status: `TEST`

This Node/CommonJS leaf composes existing Workshop audio capabilities. It uses
`shared/audio-sfx-bake` as the sole WAV renderer and
`shared/asset-hands/upgrade-program/audio-production.js` as a second local
decoder/analyzer. It does not replace either engine.

The leaf emits a canonical editable `axm.deterministic-audio-recipe/v1`, a
genuine mono 44100 Hz signed PCM16 RIFF/WAVE, deterministic technical analysis,
and a non-promoting verification receipt. Technical `PASS` means the recipe,
WAV structure, local decode, bounds, and repeat bytes passed. It does not mean
the sound was played, heard, accessible, aesthetically approved, externally
conformant, installed, promoted, or canonical.

The public Asset Hands route is:

```js
const Hands = require("../asset-hands/asset-hands");
const result = Hands.create("deterministic-audio-fabric", brief, { seed });
```

For edit/regeneration, set `brief.operation_mode` to `edit` and provide the
previous recipe artifact in `brief.source_artifacts`. Its
`metadata.schema: "axm.deterministic-audio-recipe/v1"` is normalized to the
input `content_schema`; the route regenerates the WAV, analysis, verification,
validation receipt, and result digest.

Focused checks:

```text
node shared/deterministic-audio-fabric/selftest.js
node shared/asset-hands/deterministic-audio-fabric-selftest.js
node shared/deterministic-audio-fabric/sensory-handoff-selftest.js
node shared/asset-hands/schema-contract-selftest.js
```

See `SENSORY_HANDOFF.md` for the exact machine-to-human boundary and
`EVIDENCE_ROUTE.md` for claim routing.
