# AXM Visual Grammar

Status: **TEST contract**. Not canon. No execution or visual approval authority.

This layer closes the gap between “AXM has modular visual pieces” and “a future editor can safely swap those pieces.” It does **not** remove raster, renderer, material, filter, or layout implementations from the software that already owns them. Those implementations remain usable where they are. Visual Grammar gives them a second, shared representation built on the Universal Component Protocol (UCP).

## What is modular now

A visual profile binds exact UCP component versions to named roles across seven categories:

- foundation: palette, colour policy, typography, spacing, shape, density;
- source: raster, vector, text, mesh, and imagery;
- composition: layers, ordering, masks, blends, compositors, filters, effects;
- surface: materials, textures, lighting, cameras;
- behaviour: layout, responsive layout, motion, interaction states;
- delivery: renderers and output adapters;
- governance: accessibility, performance, and truth-surface policies.

Namespaced extension roles (`x.vendor.role`) remain possible, so the protocol does not freeze future discovery into today's list.

`visual-grammar-core.js` validates the profile and underlying typed UCP graph, plans required hands, reports missing capabilities, and swaps only editable presentation-plane components. A swap is data-only, preserves semantic components, and invalidates previous technical/visual approval. It never renders, executes, publishes, or decides taste.

## Existing Hub skins are not thrown away

`hub-skin-adapter.js` converts an accepted `axm.skin/v1` into separate palette, typography, shape, layout, imagery, and output-adapter components. It can convert the resulting profile back to the old Hub format, so today's Hub keeps running while a future drag/drop skin manipulator gains typed parts.

The adapter declares the exact limit: Hub v1 cannot render generic compositor, filter, material, lighting, motion, or 3D roles. Those roles can live in Visual Grammar now, but they need a compatible target adapter and executable hand before a particular app can display them.

## Honest capability boundary

The protocol layer is ready. The manipulation/runtime layer is mixed:

- colour tokens, canvases, UCP graphs, Hub skin round-trip, and route planning: `READY_CONTRACT`;
- current raster/vector engines and Hub Skinner: `DEGRADED` but useful;
- bounded static sRGB RGBA8 compositing: `READY_BOUNDED` through the
  `raster-compositor` hand (layers, masks, opacity, offsets, 14 blend modes and
  13 deterministic filters);
- GPU shaders, arbitrary transforms/resampling, HDR/wide-gamut/CMYK/ICC,
  neural effects, 3D, video and animation compositing: `MISSING_HANDS`;
- appearance and taste: always a human/machine judgment gate after a real render.

The shared `visual-proof` service can bind a module's artifact digest, technical
receipt, and portable native-visual proof references into one deterministic
receipt. That improves handoff and corroboration across visual modules, but it
does not render, inspect, approve, promote, or grant canon authority.

See `capability-matrix.json` for the audit. This distinction prevents “the schema mentions filters” from being mistaken for “every target can execute filters.”

## Focused verification

```powershell
node shared/visual-grammar/selftest.js
node shared/visual-proof/selftest.js
node shared/asset-hands/universal-component-selftest.js
node hub/skin-selftest.js
```

The selftest proves exact component resolution, capability-gap reporting, reversible Hub conversion, presentation-only swaps, approval invalidation, and refusal to alter a protected semantic component.
