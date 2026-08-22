# AXM Aetherglass 7.1 — Integration Guide

## Purpose

Aetherglass should sit **over the current platform**, not become a reason to rebuild it. The safest route is staged:

1. Mount the core atmosphere.
2. Decorate a small number of selected surfaces.
3. Add meaningful global lights.
4. Add composed scenes or a particle field only where useful.
5. Connect platform states through an explicit reviewed event map.
6. Test low-cost, opaque, reduced-motion, mobile, and destroy paths.

Every optional organ can be omitted.

For the six optional cinematic light planes, follow `LUMINOUS_LAYER_FORGE.md`. Start existing platforms with `quiet-aura`. For any redesign rather than a bounded integration, start `tools/local_product_design.py` and approve context plus the visual target before implementation.

---

## 1. Copy the module without flattening it

Preserve the `src/` files as a dedicated visual module directory. A recommended platform placement is:

```text
platform/
  visual/
    aetherglass/
      axm-aetherglass.css
      axm-components.css
      axm-aetherglass.js
      axm-lighting-director.js
      axm-aetherfield.js
      axm-scene-director.js
      axm-interaction-fx.js
      axm-performance-governor.js
      axm-visual-state-bridge.js
      axm-visual-adapter.js
```

Do not merge the source into unrelated global files on the first intake. Keeping one clear directory makes rollback and later updates much safer.

---

## 2. Minimal core installation

Load the core stylesheet and runtime once in the platform shell:

```html
<link rel="stylesheet" href="/visual/aetherglass/axm-aetherglass.css">
<script src="/visual/aetherglass/axm-aetherglass.js"></script>
```

Mount after the chosen root exists:

```js
const visuals = AXMVisualEngine.mount({
  root: document.body,
  applyToDocument: true,
  theme: "aether",
  atmosphere: "cosmos",
  material: "crystal",
  depth: "deep",
  luminosity: "balanced",
  density: "comfortable",
  shape: "sculpted",
  transparency: "auto",
  contrast: "auto",
  quality: "auto",
  motion: "auto",
  intensity: 0.95,
  pointerLighting: true,
  reactivePanels: true,
  parallax: true,
  trackScroll: true,
  persist: false
});
```

This adds the global atmosphere and root visual variables. It does not rewrite component markup or application state.

### Scoped mounting

Aetherglass can be mounted inside one platform region instead of the whole document:

```js
const workspaceVisuals = AXMVisualEngine.mount({
  root: document.querySelector("#visual-workspace"),
  applyToDocument: false,
  theme: "pearl",
  atmosphere: "cathedral"
});
```

Do not mount two engines on the same root. The default duplicate policy returns the existing mounted instance. Use `duplicate: "error"` during strict development or `duplicate: "replace"` only when deliberate replacement is safe.

---

## 3. Apply surface hierarchy deliberately

Load the optional professional component layer when its classes are needed:

```html
<link rel="stylesheet" href="/visual/aetherglass/axm-components.css">
```

Recommended hierarchy:

```html
<nav class="axm-glass axm-glass--quiet axm-navigation">...</nav>

<main class="axm-bento">
  <section class="axm-glass axm-elevate axm-span-8">Primary workspace</section>
  <aside class="axm-glass axm-glass--quiet axm-span-4">Supporting context</aside>
</main>

<button class="axm-button axm-button--primary">Build</button>
<button class="axm-button axm-button--ghost">Cancel</button>
<input class="axm-input" placeholder="Search modules">
```

Use luminous or prismatic surfaces sparingly:

```html
<section class="axm-glass axm-glass--luminous axm-glass--prismatic">
  One focal command, reveal, or creation surface
</section>
```

A page full of maximum glow will look cheaper and reduce orientation. Preserve dark space.

---

## 4. Add contextual global lighting

Load after the core runtime:

```html
<script src="/visual/aetherglass/axm-lighting-director.js"></script>
```

```js
const lighting = new AXMLightingDirector(visuals, {
  maxLights: 10,
  overflow: "reject"
});
```

### Bind a light to a meaningful platform element

```js
const workspaceLight = lighting.bind(".current-workspace", {
  group: "interface",
  color: "var(--axm-accent-1)",
  strength: 0.22,
  scaleToTarget: true,
  targetScale: 2.8,
  kind: "ambient"
});
```

The light follows the element during scroll and resize. The element’s content and event handlers are not changed.

### Add a fixed composition light

```js
const horizonLight = lighting.addAt(50, 94, {
  units: "%",
  group: "composition",
  color: "var(--axm-lux)",
  strength: 0.12,
  sizeX: 1100,
  sizeY: 520,
  kind: "spotlight"
});
```

### Group control

```js
lighting.setGroupEnabled("interface", false);
lighting.setGroupEnabled("interface", true);
lighting.clear("composition");
```

### Event light

```js
lighting.pulseAt(".verified-result", {
  color: "var(--axm-positive)",
  strength: 0.72,
  size: 860,
  duration: 900
});

lighting.sweep({
  color: "var(--axm-lux)",
  strength: 0.38,
  duration: 1200
});
```

Start with no more than four bound lights. Meaningful light is stronger than universal light.

---

## 5. Add the adaptive Aetherfield

```html
<script src="/visual/aetherglass/axm-aetherfield.js"></script>
```

```js
const field = AXMAetherfield.mount(visuals, {
  preset: "constellation",
  density: 0.55,
  energy: 0.7,
  speed: 0.45,
  interactive: true,
  seed: "axm-platform"
});
```

Available presets:

```text
off · stardust · constellation · nebula · fireflies · embers · crystal · snow · data-rain
```

Runtime control:

```js
field.setPreset("fireflies");
field.setDensity(0.4);
field.setEnergy(0.65);
field.setSpeed(0.3);
field.setInteractive(false);
field.burstAt(".new-module", { count: 18, strength: 1.1, colorIndex: 2 });
```

The field automatically adjusts particle count and frame pacing according to resolved quality, motion, viewport size, and visibility.

---

## 6. Coordinate visual scenes

```html
<script src="/visual/aetherglass/axm-scene-director.js"></script>
```

```js
const scenes = new AXMSceneDirector(visuals, {
  field,
  lighting,
  transitionDuration: 700
});

scenes.apply("aether-command");
```

A scene coordinates the engine axes, Aetherfield, and Lighting Director. Available scenes are documented in `SCENE_REFERENCE.md`.

### Temporary scene with exact prior-state restoration

```js
scenes.applyTemporary("nebula-celebration", 2200);
```

When the duration ends, the immediately previous composition returns. It does not jump all the way back to the first session baseline.

### Register a platform-specific scene

```js
scenes.register("verification-chamber", {
  label: "Verification Chamber",
  description: "Focused evidence review with minimal distraction.",
  engine: {
    theme: "eclipse",
    atmosphere: "monolith",
    material: "smoked",
    depth: "soft",
    luminosity: "dim",
    intensity: 0.68
  },
  field: {
    preset: "data-rain",
    density: 0.22,
    energy: 0.4,
    speed: 0.3
  },
  lighting: "void"
});
```

Custom scenes can be exported and imported with `scenes.export(name)` and `scenes.import(json)`.

---

## 7. Add explicit interaction effects

```html
<script src="/visual/aetherglass/axm-interaction-fx.js"></script>
```

```js
const interactions = AXMInteractionFX.mount(visuals, {
  lighting,
  field,
  tiltSelector: ".axm-tilt, [data-axm-tilt]",
  magneticSelector: ".axm-button--magnetic",
  ripple: true,
  focusPulse: true
});
```

Effects remain opt-in through classes, selectors, or explicit calls:

```js
interactions.attention(".current-module", {
  color: "var(--axm-accent-1)",
  particles: 12,
  duration: 700
});

interactions.celebrate(".completed-build");
interactions.scan({ color: "var(--axm-lux)" });
```

Reduced-motion and coarse-pointer routes are respected by default.

---

## 8. Connect semantic platform states explicitly

Load after scenes and interactions:

```html
<script src="/visual/aetherglass/axm-visual-state-bridge.js"></script>
```

```js
const bridge = AXMVisualStateBridge.mount(visuals, {
  scenes,
  lighting,
  interactions,
  field
});
```

The default event prefix is `axmvisualstate:`. The platform can dispatch a semantic state without importing the bridge object into every component:

```js
document.body.dispatchEvent(new CustomEvent("axmvisualstate:focus", {
  detail: { target: ".current-workspace" }
}));
```

Equivalent helper:

```js
bridge.dispatch("success", {
  target: ".completed-build",
  duration: 2200
});
```

Default mappings:

```text
command · focus · create · review · live · showcase · quiet
success · warning · error · restore
```

The bridge does not infer emotion, inspect content, or monitor platform data. It responds only to events or direct calls the platform explicitly emits.

### Custom mapping

```js
bridge.register("verification-passed", {
  temporaryScene: "nebula-celebration",
  duration: 1600,
  pulse: {
    color: "var(--axm-positive)",
    strength: 0.64,
    size: 760
  }
});

bridge.dispatch("verification-passed", {
  target: "#verification-result"
});
```

---

## 9. Use the Performance Governor without silent control

```html
<script src="/visual/aetherglass/axm-performance-governor.js"></script>
```

```js
const governor = new AXMPerformanceGovernor(visuals, {
  mode: "recommend",
  field,
  sampleFrames: 120,
  targetFps: 45,
  minimumFps: 28
});

governor.start();
```

When sampling ends:

```js
const report = governor.getReport();
console.log(report.recommendation);
```

In the default `recommend` mode, no visual setting changes automatically. Apply and reverse a recommendation explicitly:

```js
governor.applyRecommendation();
governor.restoreApplied();
```

`mode: "adaptive"` is available, but it must be deliberately selected and only reduces visual cost. It never silently upgrades effects.

---

## 10. Adapt an existing interface without hand-editing every component

Load the explicit adapter:

```html
<script src="/visual/aetherglass/axm-visual-adapter.js"></script>
```

Create a reviewed selector map:

```js
const adapter = new AXMVisualAdapter({
  root: document,
  observe: false,
  map: {
    navigation: [".platform-nav"],
    panels: [".workspace-card"],
    quietPanels: [".side-panel"],
    luminousPanels: [".main-command-surface"],
    primaryButtons: ["[data-action='build']"],
    ghostButtons: ["[data-action='cancel']"],
    inputs: ["input[type='text']"],
    selects: ["select"],
    chips: [".status-pill"]
  }
});

console.table(adapter.preview());
const report = adapter.apply();
```

For interfaces that create later nodes:

```js
adapter.startObserving();
```

Rollback removes only classes the adapter added:

```js
adapter.rollback();
```

A class already present before adapter application is not claimed by the adapter and remains after rollback.

---

## 11. Runtime settings panel

A small platform settings section can expose:

- Theme
- Atmosphere
- Material
- Depth
- Luminosity
- Transparency
- Quality
- Motion
- Intensity
- Pointer lighting
- Reactive panels
- Parallax
- Aetherfield preset and density
- Master visual enable/disable

Use the engine setters directly:

```js
visuals.setTheme("royal");
visuals.setAtmosphere("cathedral");
visuals.setMaterial("obsidian");
visuals.setMotion("reduced");
visuals.setTransparency("off");
visuals.setIntensity(0.8);
```

Persistence remains off unless `persist: true` is explicitly selected. Exporting visual settings is safer for early integration than silently storing them.

---

## 12. Portable configuration

```js
const json = visuals.exportConfig();
visuals.importConfig(json, { persist: false });
```

A full composition can be assembled from:

```js
const composition = {
  engine: visuals.getConfig(),
  field: field.getState(),
  scene: scenes.getState().active
};
```

Do not include platform content, user data, secrets, or permissions in visual configuration files.

---

## 13. Cleanup and rollback order

Destroy optional modules before the core engine:

```js
governor.destroy({ restore: true });
bridge.destroy();
interactions.destroy();
scenes.destroy({ restore: true });
field.destroy();
lighting.destroy();
adapter.rollback();
visuals.destroy();
```

The core engine tracks only the classes it added. Attributes and inline styles are restored only when their current value still matches the last value applied by the engine. This prevents teardown from silently overwriting later platform changes.

Keep the packaged v4, v3, v2, and v1 checkpoints until v5 has passed the platform’s own integration tests.

---

## 14. Framework lifecycle example

React-style lifecycle:

```jsx
import { useEffect } from "react";
import "./visual/aetherglass/axm-aetherglass.css";
import "./visual/aetherglass/axm-components.css";

export function VisualShell({ children }) {
  useEffect(() => {
    const engine = window.AXMVisualEngine.mount({
      root: document.body,
      theme: "aether",
      quality: "auto",
      persist: false
    });

    const lighting = new window.AXMLightingDirector(engine);
    const field = window.AXMAetherfield.mount(engine, { preset: "constellation" });
    const scenes = new window.AXMSceneDirector(engine, { field, lighting });

    scenes.apply("aether-command");

    return () => {
      scenes.destroy({ restore: true });
      field.destroy();
      lighting.destroy();
      engine.destroy();
    };
  }, []);

  return children;
}
```

Ensure the source scripts are loaded once by the app shell. Do not mount the engine on every route render.

---

## 15. Required integration checks

Before calling the integration complete, test:

- Existing routing, navigation, forms, dialogs, menus, drag/drop, keyboard control, and scrolling.
- 390 px mobile width with zero page-level horizontal overflow.
- Internal wide tables scroll only inside their own container.
- High, balanced, and low quality.
- Full, reduced, and off motion.
- Full, reduced, and off transparency.
- Normal and high contrast.
- Browser without `backdrop-filter` support.
- Hidden-tab pause and resume.
- No atmosphere or canvas layer captures pointer input.
- No new network requests, telemetry, or console errors.
- Adapter preview before apply and rollback afterward.
- Scene restore and temporary-scene exact prior restoration.
- Visual State Bridge responds only to explicit mapped events.
- Performance Governor recommends without changing state in default mode.
- Full module destroy preserves platform classes, attributes, and inline styles added after mount.

Use `tests/smoke.html` as a module test, not as a substitute for platform-specific integration testing.


## 16. Add local surface composition only after the hierarchy is stable

Load `axm-luminous-architecture.css` and `axm-surface-composer.js`. Preview before apply:

```js
const surfaces = new AXMSurfaceComposer({ root: document });
const report = surfaces.preview(".current-workspace", "black-diamond");
if (report.valid) surfaces.apply(".current-workspace", "black-diamond");
```

Start with one target. Test changing recipes, an external inline-variable change after apply, `restore()`, and `destroy()`. A local recipe must not become a replacement for semantic surface hierarchy.

## 17. Add finite scene transitions

Load `axm-transition-director.js` after the scene director:

```js
const transitions = AXMTransitionDirector.mount(engine, { policy: "replace" });
await transitions.transitionScene("phantom-portal", scenes, { transition: "gate" });
```

Test replace, queue, reject, cancel, reduced motion, off motion, and destroy. The transition stage must remain pointer-safe and must not intercept routing.

## 18. Add reviewed cue choreography

Load `axm-cue-sequencer.js` only after its dependencies are available:

```js
const cues = new AXMCueSequencer(engine, { field, lighting, scenes, interactions });
await cues.play("verification", { target: ".verified-result" });
```

Review every cue action and target. Custom cues are finite data with whitelisted actions, not arbitrary code. Test `stop()` and confirm the play promise resolves as incomplete and timers return to zero.

## 19. v5 cleanup order

1. Performance Governor destroy/restore.
2. Cue Sequencer destroy.
3. Transition Director destroy.
4. Surface Composer destroy.
5. Visual State Bridge destroy.
6. Interaction FX destroy.
7. Scene Director restore/destroy.
8. Aetherfield destroy.
9. Lighting Director destroy.
10. Visual Adapter rollback.
11. Core engine destroy.
