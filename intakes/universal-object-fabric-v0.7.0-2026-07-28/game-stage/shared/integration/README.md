# AXM Universal Object Fabric — Integration Bridges

These helpers consume v0.5 Universal Object contracts, optional v0.7 Runtime Capsules, optional v0.6 portable visual skins, and the preserved v0.4 game assets. They do not guess source filenames, rewrite a game project, create physics bodies, or promote physical-world outputs.

“Optional” here means the helpers remain backward-compatible with legacy v0.5 inputs. Every object manifest shipped in the v0.7 release archive is required to declare both `industry_outputs.runtime_capsule` and `industry_outputs.visual_skin`; the fallback route is not permission to omit them from a v0.7 build.

The examples below assume the repository root is served as the HTTP document root or copied under Godot's `res://` root.

## Three.js

- `threejs/axm-universal-object.js` loads one universal object, a selected declared LOD, semantic materials, assembly groups, joint limits, sockets, state names, and optional visual-skin data.
- `threejs/axm-world-kit.js` can load the combined world proof or clone each unique source model for a lighter runtime integration.
- The calling game supplies its own `THREE` instance and `GLTFLoader` from the same release.
- Serve the folder over HTTP. Browser `fetch()` normally cannot read the package directly through `file://`.

Minimal route:

```js
import { AXMUniversalObjectLoader } from '/universal_fabric/integration/threejs/axm-universal-object.js';

const axm = new AXMUniversalObjectLoader({
  THREE,
  gltfLoader,
  packageBaseUrl: '/deployments/AXM_8_GAMES_SHARED_GEOMETRY/'
});

const turret = await axm.load(
  '/universal_archive/objects/AXM-TURRET-001/0.5.0/UNIVERSAL_OBJECT_MANIFEST.json'
);
scene.add(turret);
axm.setJointValue(turret, 'yaw', 35);

const mountSocket = axm.getSocket(turret, 'base_mount'); // exact, case-sensitive ID
const variants = axm.availableVisualVariants(turret);
if (variants.includes('neon')) {
  const visualHints = axm.setVisualVariant(turret, 'neon');
  // The receiving renderer may inspect visualHints; no optional effect is auto-installed.
}
```

Pass `{ lod: 1 }` to `load()` for an exact declared LOD, or pass `{ projectedScreenHeight: 0.1 }` to use the source threshold suggestion. `selectLOD()` is also available as a pure selector. These helpers do not install camera listeners or automatically swap an already-loaded scene.

## Godot 4

- `godot/AXMUniversalObject.gd` reads the manifest set, applies starter materials, creates assembly groups, exposes exact sockets and LOD selection, and applies optional portable visual variants.
- `godot/AXMWorldKit.gd` instantiates the world from source runtime manifests.
- Copy/import the GLB assets into a Godot-visible location first. Godot project import settings and final collision policy remain project decisions.

```gdscript
const AXMObject = preload("res://universal_fabric/integration/godot/AXMUniversalObject.gd")

var contract_set := AXMObject.load_contract_set(
    "res://universal_archive/objects/AXM-TURRET-001/0.5.0/UNIVERSAL_OBJECT_MANIFEST.json",
    "res://deployments/AXM_8_GAMES_SHARED_GEOMETRY"
)

var selected_lod := AXMObject.select_lod(contract_set, 0.1)
var mount_socket := AXMObject.get_socket(contract_set, "base_mount")

# `model_root` is a GLB scene instantiated by the receiving Godot project.
AXMObject.apply_materials(model_root, contract_set["materials"])
var visual_skin: Dictionary = contract_set["visual_skin"]
if not visual_skin.is_empty():
    var fallback_variant := str(visual_skin.get("fallback_variant", "default"))
    var visual_hints := AXMObject.apply_visual_variant(
        model_root,
        contract_set,
        fallback_variant
    )
```

`apply_visual_variant()` creates `StandardMaterial3D` overrides from portable base color, opacity, metallic, roughness, emissive, culling, and depth-write values. It returns renderer hints, optional layer slots, and unresolved external capabilities to the calling project; it does not execute them.

## Runtime Capsule

When `industry_outputs.runtime_capsule` is present, each object helper loads the source-bound sidecar and exposes all declared LOD records, collision data, sockets, assembly/material links, default and named states, and explicit authority limits. If the sidecar is absent, both helpers fall back to the v0.5 game binding plus the v0.4 runtime and socket manifests.

Collision remains a data contract. The receiving engine must explicitly choose the collision GLB or implement an engine-native interpretation; neither helper creates a rigid body, collider, or project setting.

## Portable visual skins

When `industry_outputs.visual_skin` is present, a helper may apply a generated `portable_fallback` variant by exact ID. Portable variants change presentation material overrides only. Renderer-specific outlines, bloom, refraction, textures, decals, shader graphs, and external capability bridges remain optional hints owned by the receiving game.

Visual skins do not modify canonical meshes, transforms, collision, simulation values, measured material facts, object meaning, or manufacturing evidence. Missing sidecars retain the canonical semantic-material route.

## Boundary

The movement helpers animate game scene nodes only. Runtime Capsule and visual-skin helpers expose bounded game data and portable presentation. None of these bridges provide actuator control, robotics safety logic, engineering simulation, receiving-game acceptance, or manufacturing instructions.
