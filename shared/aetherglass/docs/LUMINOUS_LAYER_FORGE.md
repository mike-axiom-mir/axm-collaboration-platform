# Luminous Layer Forge

Luminous Layer Forge is an optional v7.1 organ for compositing cinematic light behind the interface. It extends Aetherglass without replacing the core atmosphere, Lighting Director, scenes, cues, particles, or surface materials.

## Include and mount

Load the files after the core luminous architecture and Lighting Director:

```html
<link rel="stylesheet" href="src/axm-luminous-layer-forge.css">
<script src="src/axm-luminous-layer-forge.js"></script>
```

```js
const lightLayers = AXMLuminousLayerForge.mount(engine, {
  preset: "sovereign-aurora",
  reactive: true
});
```

The module inserts one owned stage containing six owned planes. `destroy()` removes the stage, finite radiance nodes, timers, listeners, and the module-owned root attribute.

## Six planes

| Plane | Purpose | Relative cost |
| --- | --- | --- |
| Halo | Responsive focal bloom using the engine pointer position | Low |
| Crown | Top-down volumetric beams and sovereign overhead light | Low |
| Aurora | Slow spectral ribbons for living depth | Medium |
| Prism | Wide refracted spectral rotation | Medium |
| Caustics | Fine energy/light interference texture | High |
| Refraction | Crystalline viewport-edge lift | Low |

## Presets

- `quiet-aura`: halo + refraction for daily work.
- `sovereign-aurora`: balanced halo + crown + aurora + refraction.
- `prismatic-cathedral`: all six planes for hero or showcase moments.
- `neon-sanctum`: halo + aurora + prism + refraction.
- `event-horizon`: halo + crown + caustics + refraction.
- `off`: no effective planes.

Preview with `previewPreset(name)` before applying. Set a preset, intensity, depth, or reactive behavior independently. `setLayer(name, enabled)` enters an inspectable custom stack.

## Automatic restraint

The requested stack remains visible in state while the effective stack adapts:

| Engine route | Effective limit |
| --- | --- |
| High/balanced quality | Requested planes |
| Low quality | Halo, crown, refraction only |
| Transparency off | Halo and crown only, strongly reduced |
| High contrast | Halo, crown, refraction only, strongly reduced |
| Reduced/off motion | Same allowed planes, static presentation |
| Capture freeze | Animations and transitions stopped |
| Print | Forge removed |

These routes do not change content, navigation, semantic meaning, or the user’s requested preset.

## Finite focal radiance

`radianceAt(target, options)` creates a temporary owned bloom at a real element. It rejects missing/out-of-root targets, clamps size, strength, and duration, tracks the timer, and cleans the transient on completion or destroy.

## Intake order

1. Mount and verify the core engine.
2. Add the forge CSS and JavaScript.
3. Mount `quiet-aura` first on an existing platform.
4. Review readability and device performance.
5. Raise to `sovereign-aurora` or a stronger stack only where the visual target calls for it.
6. Keep the v7.0 rollback until local browser, accessibility, responsive, and lifecycle review passes.

Browser/GPU performance is not proven by source validation. Run the supplied browser suite and inspect the real target device before production adoption.
