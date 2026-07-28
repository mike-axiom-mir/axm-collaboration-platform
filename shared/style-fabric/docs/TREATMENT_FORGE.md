# Treatment Forge

Status: **WORKING / TEST**

Treatment Forge is a bounded visual-treatment organ for Style Fabric. It adds
ordered effects and semantic lighting without replacing the portable v1 skin
format or pretending that every renderer supports the same effects.

It does not save, apply, publish, promote, or mark anything CANON
automatically.

## Why it is separate from semantic game molds

The existing game molds answer:

> Which presentation surfaces does this game expose?

A treatment mold answers:

> How should a selected surface be visually constructed?

Keeping these contracts separate prevents a visual recipe from quietly changing
a game's adapter surface.

## Built-in treatment molds

Three editable examples live under `examples/treatments/`:

- **Aetherglass Cinematic** — glass fill, inner highlight, cyan rim, violet
  aura, selective bloom, haze, and a key/fill/rim lighting rig.
- **Neon Paper Selective** — tactile paper, ink shadow, and neon only on
  selected trim and signal edges.
- **Accessible Night Edge** — high-contrast, crisp edge light without bloom or
  motion dependency.

The source catalog is exported as `TREATMENT_MOLDS`.

## Deterministic API

Import the public Treatment Forge API from the package index:

```js
import {
  TREATMENT_MOLDS,
  listTreatmentMolds,
  getTreatmentMold,
  validateTreatmentMold,
  instantiateTreatmentMold,
  generateTreatmentDirections,
  applyTreatmentToPack
} from "./src/index.mjs";
```

### Inspect and validate

```js
const molds = listTreatmentMolds();
const mold = getTreatmentMold("aetherglass-cinematic");
const report = validateTreatmentMold(mold);
```

Catalog reads return clones. Validation rejects unknown fields, non-finite or
out-of-range values, executable keys, remote/data/file URLs, and authoritative
or gameplay targets.

### Instantiate one treatment

```js
const { treatment, receipt } = instantiateTreatmentMold(
  "aetherglass-cinematic",
  {
    seed: "reactor-001",
    profile: "balanced",
    targets: ["world.lighting", "ui.panel"]
  }
);
```

The result is an ordinary `axm.treatment` draft. Each target receives:

- legacy flat material fields;
- an optional bounded `effectStack`;
- an optional `lightingRig` on `world.lighting`;
- a deterministic profile receipt.

### Generate the local three-direction comparison

```js
const { directions, receipt } = generateTreatmentDirections(
  "neon-paper-selective",
  { seed: "paper-district-001" }
);
```

`directions` always contains exactly three ordinary `axm.treatment` drafts:

1. Foundation;
2. Prism Shift;
3. Accent Inversion.

The same mold, seed, options, and profile produce the same data. The function
records no selected direction and performs no save or apply action.

### Apply the chosen treatment to a pack

```js
const result = applyTreatmentToPack(
  sourcePack,
  directions[1],
  { targets: ["ui.panel"] }
);
```

This is a data composition operation, not a runtime apply. It:

- changes only explicitly requested matching bindings;
- creates a target-specific material so shared source materials cannot leak
  into other targets;
- keeps the pack's status;
- clears stale integrity;
- merges accessibility requirements monotonically;
- adds the `treatment-stack.v1` capability;
- returns `{ pack, receipt }` with `runtimeApplied: false`,
  `saved: false`, `promoted: false`, and `automaticWrites: 0`.

Missing bindings remain untouched and appear in the receipt as skipped.

## Backward-compatible fallback

Enhanced materials retain ordinary fields such as:

- `baseColor`;
- `accentColor`;
- `emissiveColor`;
- `emissiveStrength`;
- `glowIntensity`;
- `glowRadius`;
- `roughness`;
- `gloss`;
- `opacity`;
- `pulseSpeed`;
- `shimmerSpeed`.

The enhanced `effectStack` declares
`fallback: "legacy-material-fields"`. An older or simpler adapter can ignore
the ordered layers and render the flattened material. A capable adapter opts in
to `effectStack` or `lightingRig` through its supported-property declaration.

## Bounded effect language

Effect layers use finite declarative enums:

- kinds: fill, texture, inner glow, outer glow, rim light, shadow, highlight,
  bloom, haze, and gradient;
- blends: normal, screen, add, multiply, and soft light;
- masks: full, inside, outside, edge, top, bottom, and radial;
- motion: none, pulse, shimmer, or drift.

There is no shader source, executable expression, arbitrary URL, network
request, or renderer mutation in a treatment mold.

## Performance and reduced motion

Four profiles cap both the legacy fallback and enhanced layers:

- **legacy** — at most 3 layers, no bloom, no animated layers;
- **balanced** — at most 6 layers and one animated layer;
- **showcase** — at most 8 layers and two animated layers;
- **reduced-motion** — balanced visual budget with every motion source stopped.

Caps include layer count, effect cost, glow radius, glow intensity, emissive
strength, bloom, haze, light intensity, and animation count. Every degraded or
omitted value appears in the instantiation receipt.

## Local Product Design loop

Treatment Forge supports one small, honest offline design loop:

1. Select a semantic target or organ.
2. Choose a treatment mold and visible seed.
3. Generate three deterministic directions.
4. Compare the directions in relevant specimen scenes.
5. Explicitly select one.
6. Tune its bounded layers or palette.
7. Check performance, motion, contrast, fallback, and adapter coverage.
8. Save an immutable version or export only after a human action.

The deterministic generator produces visual treatment data, not finished
sprites, meshes, illustrations, or proof of aesthetic quality.

The Studio exposes this loop directly: choose a treatment mold, forge exactly
three directions, inspect their palettes and bounded layer budget, select one,
then apply it explicitly. Changing the game mold or performance profile clears
stale directions so they cannot be mistaken for a current match.
