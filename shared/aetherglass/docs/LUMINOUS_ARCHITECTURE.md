# AXM Aetherglass 7.1 — Luminous Architecture

This layer adds local material composition, finite scene morphs, and explicit visual choreography without taking control of navigation or platform logic.

Load it only after the core:

```html
<link rel="stylesheet" href="src/axm-luminous-architecture.css">
<script src="src/axm-surface-composer.js"></script>
<script src="src/axm-transition-director.js"></script>
<script src="src/axm-cue-sequencer.js"></script>
```

## 1. Surface Composer

Global material selects how the platform generally holds light. Surface Composer lets a specific panel receive a local recipe without changing the world around it.

Built-ins:

- `black-diamond` — restrained dark luxury and hard clarity.
- `moonstone` — pale luminous glass for welcoming or reflective surfaces.
- `liquid-neon` — high-energy fluid glass for deliberate focal zones.
- `auric-glass` — warm gold authority without turning the whole platform gold.
- `phantom-silk` — soft spectral depth.
- `prism-vault` — flagship spectral surface.
- `clean-room` — low-decoration operational clarity.

```js
const surfaces = new AXMSurfaceComposer({ root: document });

surfaces.preview(".current-workspace", "black-diamond");
surfaces.apply(".current-workspace", "black-diamond");
surfaces.wake(".current-workspace", true);
surfaces.restore(".current-workspace");
surfaces.destroy();
```

Only explicit targets are changed. Custom recipes may set only a small approved CSS-variable list. URL values, expressions, braces, and semicolons are rejected. Restoration changes only values still equal to the last composer-applied values.

## 2. Transition Director

The Transition Director is a decorative finite stage. It does not intercept links, routes, clicks, or application state.

Built-ins:

```text
veil · prism · eclipse · gate · bloom · silence
```

```js
const transitions = AXMTransitionDirector.mount(engine, {
  duration: 900,
  policy: "replace"
});

await transitions.transitionScene("phantom-portal", scenes, {
  transition: "gate",
  duration: 980
});
```

Policies:

- `replace` — cancel the active transition and run the new one.
- `queue` — hold a finite number of later requests.
- `reject` — return an explicit busy result.

`cancel()` and `clearQueue()` return the stage to an inactive pointer-safe state. Reduced/off motion shortens or removes the visual duration while still running the requested action.

## 3. Cue Sequencer

Cue Sequencer coordinates a finite list of reviewed visual actions. It is not a scripting engine.

Allowed actions:

```text
pulse · sweep · burst · scene · attention · field · engine · group
```

Built-ins:

- `awakening`
- `verification`
- `showcase`
- `portal-open`
- `quiet-reset`

```js
const cues = new AXMCueSequencer(engine, {
  field,
  lighting,
  scenes,
  interactions
});

await cues.play("verification", { target: ".verified-result" });
cues.stop("user-request");
```

A custom cue sequence is data, not arbitrary JavaScript:

```js
cues.register("local-reveal", {
  duration: 1600,
  cues: [
    { at: 0, action: "field", preset: "motes" },
    { at: 180, action: "pulse", target: "$target", duration: 900 },
    { at: 520, action: "sweep", duration: 780 }
  ]
});
```

The sequencer limits cue count, total duration, sequence names, and action types. `stop()` resolves the active play result as incomplete and clears its timers.

## Recommended restraint

Use one strong transition for a meaningful world change, not every click. Use cue choreography for verification, reveal, portal entry, or a flagship showcase. Use local surface recipes to establish hierarchy, not to make every card exceptional.

## Cleanup order

```js
cues.destroy();
transitions.destroy();
surfaces.destroy();
```

Then continue with bridge, interactions, scenes, field, lighting, adapter, and finally the core engine.
