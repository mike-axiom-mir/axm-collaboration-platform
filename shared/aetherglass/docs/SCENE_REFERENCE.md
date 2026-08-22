# AXM Aetherglass 7.1 — Scene Reference

A scene explicitly coordinates the core engine, Aetherfield, and Lighting Director. Scene application is reversible.

## Built-in composed scenes

| Scene | Purpose | World / atmosphere / material | Field | Lighting |
|---|---|---|---|---|
| `aether-command` | Balanced command state | Aether / Cosmos / Crystal | Constellation | Aether |
| `royal-void` | Premium command and leadership | Royal / Cathedral / Obsidian | Stardust | Royal |
| `arcane-dream` | Ideation and exploratory creation | Arcane / Dream / Holographic | Nebula | Dream |
| `eclipse-focus` | Concentrated low-distraction work | Eclipse / Eclipse / Smoked | Off | Void |
| `frost-sanctuary` | Reading, review, recovery | Frost / Sanctuary / Pearl | Snow | Sanctuary |
| `solar-forge` | Building and active creation | Ember / Forge / Obsidian | Embers | Forge |
| `living-network` | Living systems and collaboration | Verdant / Living / Crystal | Fireflies | Living |
| `nebula-celebration` | Launch and verified completion | Nebula / Prism / Holographic | Stardust | Dream |
| `pearl-gallery` | Media and refined visual library | Pearl / Cathedral / Pearl | Crystal | Sanctuary |
| `quiet-operations` | Dense reliable operations | Aether / Quiet / Smoked | Off | Void |
| `data-temple` | Diagnostics and machine architecture | Aether / Monolith / Clear | Data rain | Aether |
| `phantom-portal` | Entrances and spectral reveals | Phantom / Portal / Liquid | Warp | Portal |
| `auric-throne` | Gold/pearl authority | Auric / Throne / Diamond | Orbitals | Auric |
| `oceanic-depths` | Immersive submerged calm | Oceanic / Ocean / Liquid | Motes | Ocean |
| `rose-gold-sanctum` | Warm welcome, story, gallery | Rose Gold / Sanctum / Velvet | Stardust | Dream |
| `ultraviolet-horizon` | Live futuristic control space | Ultraviolet / Horizon / Mirror | Warp | Ultraviolet |
| `black-diamond-focus` | Restrained premium focus | Eclipse / Throne / Diamond | Orbitals | Void |
| `celestial-orbit` | Flagship visual showcase | Phantom / Cosmos / Mirror | Orbitals | Portal |

## Applying and restoring

```js
scenes.apply("aether-command");
scenes.apply("phantom-portal");
scenes.restore();
```

The first `apply()` captures the pre-scene composition. Later scene changes remain inside that reversible session until `restore()` is called.

## Temporary scene

```js
scenes.applyTemporary("nebula-celebration", 2200);
```

The temporary path captures the immediately preceding engine, field, lighting, active-scene, and outer-session state. Deliberately applying another scene cancels the pending automatic return.

## Cinematic scene morph

```js
await transitions.transitionScene("auric-throne", scenes, {
  transition: "gate",
  duration: 980
});
```

The transition is a finite visual veil around the normal explicit scene application. It does not own navigation.

## Custom scene

```js
scenes.register("public-demo", {
  label: "Public Demo",
  engine: {
    theme: "aether",
    atmosphere: "cathedral",
    material: "smoked",
    depth: "soft",
    luminosity: "balanced",
    density: "airy",
    shape: "sculpted",
    intensity: 0.82,
    atmosphereStrength: 0.8,
    glowStrength: 0.72
  },
  field: { preset: "stardust", density: 0.22, energy: 0.4, speed: 0.25 },
  lighting: "aether"
});
```

Imported/custom scenes are visual definitions only. Do not put secrets, permissions, platform data, or user content in them.

## Semantic state bridge defaults

| State | Default response |
|---|---|
| `command` | Aether Command |
| `focus` | Eclipse Focus |
| `create` | Solar Forge |
| `review` | Frost Sanctuary |
| `live` | Living Network |
| `showcase` | Celestial Orbit |
| `portal` | Phantom Portal |
| `luxury` | Auric Throne |
| `immersive` | Oceanic Depths |
| `spectacle` | Ultraviolet Horizon |
| `quiet` | Quiet Operations |
| `success` | Temporary Nebula Celebration plus explicit target celebration |
| `warning` | Warm pulse only |
| `error` | Danger pulse only |
| `restore` | Restore current scene session |

The platform chooses when to dispatch a state. The bridge does not infer one.
