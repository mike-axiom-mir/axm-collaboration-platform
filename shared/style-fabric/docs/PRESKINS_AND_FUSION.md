# Preskins and deterministic fusion

## Why preskins exist

Preskins make Style Fabric useful before AXM has a large community skin library.
They are editable starting points, not privileged or locked themes.

All 25 built-ins use the same `axm.style-intent` route as a human-made or
machine-made recipe. There is no hidden renderer path for official presets.

## Catalog

The source catalog lives in `src/core/presets.mjs`.

The portable index lives in `preskin-catalog.json`.

Precompiled share files live in `examples/preskins/`.

Each catalog item declares:

- stable preset ID;
- visible name and family;
- short design intention;
- three preview swatches;
- complete editable structured intent;
- portable pack filename and integrity digest.

## Fusion

`blendPreskins(base, primaryId, secondaryId, amount)` deterministically blends:

- primary, secondary, and accent colors;
- numeric material parameters;
- geometry controls;
- pattern strength and scale;
- character proportion;
- style intensity.

Discrete choices such as pattern kind, outfit, accessory, silhouette, and head
shape switch at the midpoint. Keywords are combined. Safety declarations are
conservative: high contrast and reduced motion remain enabled if either source
requires them, and the higher minimum contrast wins.

The output records:

```json
{
  "preset": {
    "catalog": "axm.preskins.v1",
    "primary": "axm-balanced",
    "secondary": "world-ember-foundry",
    "blend": 0.5
  }
}
```

The recorded seed, source IDs, and blend amount make the fusion reproducible.

## Machine-native use

```js
import {
  applyPreskin,
  blendPreskins,
  chooseDeterministicPreskin,
  compileStyleIntent
} from "./src/index.mjs";

const base = {
  seed: "player-chosen-seed",
  scope: ["global", "character.player"],
  sharing: {
    attribution: "Creator name",
    remixAllowed: true
  }
};

const presetIntent = applyPreskin(base, "world-paper-kingdom");
const fusedIntent = blendPreskins(
  base,
  "world-paper-kingdom",
  "arcade-neon-circuit",
  0.35
);
const deterministicSuggestion = chooseDeterministicPreskin(
  "player-chosen-seed",
  "Worlds"
);

const pack = compileStyleIntent(fusedIntent);
```

Machine users receive no extra authority. Resulting packs still pass through
validation, game capability resolution, preview, approval, apply, and rollback.

## Rebuild

```bash
npm run preskins:build
```

This regenerates every portable preskin and its SHA-256 integrity receipt from
the source catalog.
