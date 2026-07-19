# AXM Spatial Studio

Spatial Studio is parent workspace **#9**: one visible 3D and simulation room with modular engines underneath it. Product, architecture, fashion, jewelry, landscape and vehicle work are templates in the same scene model, not separate applications.

## Working now

- dependency-free local WebGL 3D viewport with orbit and zoom;
- editable cube, sphere, cylinder, cone, plane and torus recipes;
- bounded detail, inflate and twist modifiers;
- object hierarchy, transforms, reusable material recipes, cameras and lights;
- frame-based transform animation using the shared timeline shape;
- real triangulated OBJ export and PNG frame proof;
- editable voxel cells and image-set capture manifests;
- bounded shared-physics 2D projection tests that never mutate or impersonate the 3D scene;
- portable project/scene packets and an unreviewed Publish inbox handoff.
- shared Asset Hands drawer with guarded intake for validated editable Spatial
  projects and material graphs; every intake retains original/effective canvas,
  recipe, validation, artifact inventory and hand identity.

## Modular boundaries

`spatial-core.js` owns the project document and guarded transitions. `spatial-geometry.js` owns mesh recipes and OBJ output. `spatial-renderer.js` is a replaceable WebGL preview adapter. `spatial-app.js` connects those engines to the UI, shared engines, shared physics, browser storage and explicit downloads.

Advanced sculpt/boolean/retopology, UV baking, skin deformation, full 3D dynamics, fluids, cloth, hair, volumes, path tracing and photogrammetry are deliberately visible as missing adapter slots. A future executable hand can fill a slot without turning Spatial Studio into multiple hard-wired engines.

Run `node selftest.js` from this directory for focused verification.
