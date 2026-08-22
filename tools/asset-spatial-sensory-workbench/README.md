# AXM Asset Spatial Sensory Workbench

Status: **TEST**. Candidate-only, local-first, non-promoting.

This tool renders the actual `mesh-glb` bytes emitted by
`parametric-mesh@1.1.0`, not the sampled SVG preview. It combines a narrow
machine edit path with a human spatial evidence seat:

- orbit, zoom, front/side/top/home viewpoints;
- perspective and orthographic projection;
- shaded, wireframe and normal inspection;
- metre grid, axes and delivery bounds;
- explicit as-delivered normals plus a labelled viewer-only face-normal repair
  diagnostic;
- A/B original/current comparison;
- allowlisted one-object Spatial project edits and brief-driven primitive,
  dimension and polygon controls;
- digest-bound, append-only-stale, non-promoting human receipts.

## Run

From `<AXM_WORKSHOP>`:

```powershell
node tools/asset-spatial-sensory-workbench/server.js
```

Open `http://127.0.0.1:8794/`. The host binds only to loopback, accepts only
same-origin JSON, caps requests at 1 MiB and serialized results at 8 MiB, and
writes no files. A user-triggered receipt download is the only write-like
surface. If the hand is absent, the workbench disables regeneration and offers
serialized PASS-result inspection.

## Focused checks

```powershell
node --check tools/asset-spatial-sensory-workbench/server.js
node --check tools/asset-spatial-sensory-workbench/core.js
node --check tools/asset-spatial-sensory-workbench/renderer.js
node --check tools/asset-spatial-sensory-workbench/app.js
node tools/asset-spatial-sensory-workbench/selftest.js
node tools/asset-spatial-sensory-workbench/server-selftest.js
```

Passing these checks does not prove visual usability. Browser observation is a
separate evidence route.

## Truth boundary

The delivery GLB encodes baked geometry, position/rotation/scale,
inflate/twist, base colour+opacity, metallic, roughness and double-sided state.
It does not encode authoring emissive, shadows, camera, lights, hierarchy,
rigging, animation, UVs or textures. Those omitted fields are not exposed as
delivery-affecting controls.

WebGL2 review is not target-engine parity, a screen is not physical-scale
proof, keyboard/pointer testing is not gamepad/XR proof, and automation cannot
occupy the human taste seat. Only Mike/another real reviewer may record an
actual aesthetic judgment, and even `ACCEPT_FOR_TEST` does not install,
promote, canonize or merge an asset.
