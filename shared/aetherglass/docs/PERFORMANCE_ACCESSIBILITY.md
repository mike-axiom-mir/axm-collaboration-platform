# AXM Aetherglass 7.1 — Performance and Accessibility

## Principle

Aetherglass should lose visual cost before it loses identity, readability, or user control.

## Quality routes

### High

- Full atmosphere stack.
- Higher particle counts and frame target.
- Stronger blur, material refraction, grain, and secondary detail.
- Best for capable desktop hardware and focused visual experiences.

### Balanced

- Retains the complete Aetherglass world.
- Reduces expensive subtle layers and particle density.
- Recommended default for mixed hardware after initial testing.

### Low

- Simplifies atmospheric detail and animation.
- Reduces particle count and frame target.
- Uses more economical material treatment.
- Preserves palette, hierarchy, borders, and semantic state.

`quality: "auto"` resolves locally from available browser hints such as device memory, hardware concurrency, viewport, pixel ratio, and data-saving preference. It performs no network lookup.

## Motion routes

### Full

All permitted atmospheric, scene, interaction, and field motion is available.

### Reduced

Spatial and continuous motion is reduced. State remains visible through color, material, borders, text, and static composition.

### Off

Animations and motion-dependent effects are disabled. No required information may rely on movement.

`motion: "auto"` respects `prefers-reduced-motion`.

## Transparency routes

### Full

Backdrop blur and translucent materials are permitted when supported.

### Reduced

Surfaces become more opaque while retaining some glass identity.

### Off

Surfaces use opaque fallbacks. Geometry, palette, hierarchy, focus, and state remain intact.

`transparency: "auto"` resolves against browser support and local preference signals.

## Contrast routes

- `normal` uses the standard border and text hierarchy.
- `high` increases separation, surface opacity, and focus clarity.
- `auto` follows `prefers-contrast` when available.

## Performance Governor

The governor samples local animation-frame intervals. It does not benchmark the entire platform and does not transmit results.

Default behavior:

```js
const governor = new AXMPerformanceGovernor(engine, {
  mode: "recommend",
  field,
  sampleFrames: 120,
  targetFps: 45,
  minimumFps: 28
});

governor.start();
```

A report includes:

- sampled frame count;
- average frame time and estimated FPS;
- p95 and p99 frame time;
- long-frame rate;
- locally exposed device hints;
- a keep, balanced-reduction, low-reduction, or insufficient-data recommendation.

Recommendation mode never changes visual state. An explicit call is required:

```js
governor.applyRecommendation();
governor.restoreApplied();
```

Adaptive mode must be deliberately selected. It only reduces cost and never silently upgrades effects.

## Aetherfield adaptation

The Canvas field adapts:

- particle count to viewport area, quality, density, and motion;
- draw interval to quality and motion;
- pixel ratio to a configured cap;
- animation to page visibility;
- interactivity to an explicit toggle.

The field can be disabled independently without removing the core atmosphere.

## Lighting budget

Every tracked global light has a cost. Recommended first-pass budget:

- 1 current-workspace light;
- 1 selected-module or live-seat light;
- 1 contextual media or creation light;
- 1 temporary state light;
- scene lights managed as a separate group.

The Lighting Director has a hard `maxLights` option. The default overflow behavior rejects excess sources instead of silently creating them.

## Mobile containment

At 680 px and below:

- the bento system becomes one zero-minimum column;
- direct grid children receive `min-width: 0`;
- wide tables remain inside `.axm-table-wrap` local scrolling;
- tabs may scroll locally;
- the global page should not widen.

The packaged demo is validated at 390 px with zero page-level horizontal overflow.

## Input safety

- Atmosphere and Canvas layers use `pointer-events: none`.
- Decorative layers are `aria-hidden`.
- Interaction FX binds only to explicit selectors.
- Reduced-motion preference is respected by default.
- Coarse-pointer devices can disable tilt and magnetic movement.
- Focus-visible treatment remains independent of hover.

## Browser fallbacks

When `backdrop-filter` is unavailable, Aetherglass surfaces use more opaque backgrounds and standard borders. The interface must remain readable and functional.

The core uses modern CSS features such as `color-mix()` and registered custom properties where supported. A platform targeting older browsers should test its actual support floor and may add a compiled fallback stylesheet during local intake.

## Acceptance checklist

- No information is hidden in animation.
- Keyboard focus is clear.
- Text meets the platform’s contrast requirements.
- State is not communicated by color alone.
- Motion off and transparency off are coherent, not broken.
- Low quality remains recognizably Aetherglass.
- Wide content stays inside local containers on mobile.
- Decorative layers capture no input.
- Recommendation mode performs no silent change.


## Luminous architecture cost controls

- Surface Composer uses CSS only and should remain limited to meaningful surfaces.
- Liquid, mirror, prism, and large blur recipes cost more than clean-room or black-diamond routes.
- Transition Director is finite and respects reduced/off motion.
- Cue Sequencer creates finite effects only; it does not run a permanent loop.
- Use atmosphere strength and glow strength to reduce visual cost without changing theme identity.
- On constrained mobile hardware, prefer reduced transparency, balanced/low quality, Motes or Off field, and one local luminous surface.

## Production acceptance checks introduced in v4 and preserved in v5

- Surface recipes do not create page overflow or overwrite external inline values.
- Transition cancellation returns the stage to inactive and pointer-safe.
- Cue cancellation clears timers and resolves waiting callers.
- No local recipe or choreography is essential to understanding or operating the platform.
