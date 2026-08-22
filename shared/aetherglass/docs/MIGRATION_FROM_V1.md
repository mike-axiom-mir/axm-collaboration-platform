# AXM Aetherglass — Migration from v1.0.0 to v5.0.0

## Compatibility position

Version 2 preserves the main v1 entry points and class direction:

- `AXMVisualEngine.mount()`
- `AXMLightingDirector`
- `AXMVisualAdapter`
- `.axm-glass`
- `.axm-glass--quiet`
- `.axm-glass--luminous`
- `.axm-elevate`
- `.axm-button` and major button variants
- form controls, chips, title gradients, energy orb, metric ring, and holographic line

A simple v1 integration should continue to work when its files are replaced in the same load order. Test before deleting the v1 checkpoint.

## Important changes

### More independent controls

V1 primarily exposed theme, quality, motion, and intensity. V2 adds atmosphere, material, depth, luminosity, density, shape, transparency, and contrast.

Existing calls remain valid:

```js
AXMVisualEngine.mount({
  theme: "aether",
  quality: "auto",
  motion: "auto",
  intensity: 1
});
```

### Requested versus resolved state

`getConfig()` returns requested values such as `quality: "auto"`.

`getState()` returns resolved runtime values such as `quality: "high"`, plus:

```js
state.requested
state.configured
```

Use `getConfig()` for export and later reapplication. Use `getState()` for current runtime behavior.

### Stronger teardown ownership

V2 no longer restores an old complete class list. It removes only classes it owns and preserves later platform changes.

### Adapter reporting

The v2 adapter distinguishes:

- dry-run matches;
- elements that actually received classes;
- invalid selectors;
- observed later nodes;
- per-class rollback ownership.

An element that already had every target class can appear in preview but not in the applied-record count because the adapter added nothing to it.

### Lighting API

V2 uses `addAt(x, y, options)` as the fixed-light method. Existing v1 packages may have used `addFixed`. During migration, replace:

```js
lighting.addFixed({ x: 25, y: 25, strength: .2 });
```

with:

```js
lighting.addAt(25, 25, { strength: .2 });
```

### Optional modules

V2 adds Aetherfield, Scene Director, Interaction FX, Performance Governor, Visual State Bridge, and component CSS. None are required for a core-only upgrade.

## Safe migration order

1. Keep the v1 stable checkpoint.
2. Snapshot the platform.
3. Replace core CSS and core JS only.
4. Run existing platform visual checks.
5. Test `destroy()` ownership behavior.
6. Replace Lighting Director and adapter.
7. Run adapter preview and rollback.
8. Add component CSS only if desired.
9. Add Aetherfield and Scene Director.
10. Add semantic state mapping last, after platform events have been reviewed.

## Theme mapping

Existing v1 themes remain:

```text
aether · arcane · frost · solar · verdant
```

New themes are additive:

```text
nebula · eclipse · royal · ember · pearl
```

## Scene migration

A v1 direct lighting scene can continue to use:

```js
lighting.setScene("sanctuary");
lighting.restoreScene();
```

For coordinated engine, field, and light state, migrate to:

```js
const scenes = new AXMSceneDirector(engine, { field, lighting });
scenes.apply("frost-sanctuary");
scenes.restore();
```

## Rollback route

The v1 checkpoint is located at:

```text
rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v1_0_0_STABLE.zip
```

Do not present v2 as fully integrated until the target platform itself has passed routing, form, dialog, drag/drop, keyboard, mobile, low-quality, reduced-motion, opaque, and full destroy tests.
