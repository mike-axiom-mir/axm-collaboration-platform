(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../visual-treatment-core") : root.AXMVisualTreatmentCore
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, Treatment) {
  "use strict";
  if (!Core || !Treatment) throw new Error("visual treatment hand dependencies are required");
  var VERSION = "1.0.0";

  function jsonArtifact(id, role, name, filename, value, editable) {
    return { id: id, role: role, name: name, filename: filename, mime: "application/json", format: "JSON", editable: !!editable, text: JSON.stringify(value, null, 2), metadata: { schema: value.schema || null, candidateOnly: true, canonical: false } };
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "visual-treatment-composer",
    title: "Deterministic Visual Capability Composer Hand",
    version: VERSION,
    category: "cross-surface-visual-treatment",
    lifecycle_status: "experimental",
    summary: "Composes exact Style Fabric presets and treatments, AetherFX modules, portable FX blocks, PBR families, Aetherglass lighting/material semantics and supplied Storycraft nodes onto identity-bound animated GLBs without changing simulation truth.",
    purpose: "Turn the Workshop's separate visual systems into reusable choices inside the deterministic asset factory while preserving exact routing and typed gaps.",
    operation_modes: ["create", "inspect", "workflow"],
    canvas_models: ["viewport-3d", "storyboard", "portable-style"],
    entry_surfaces: ["command", "asset-fabric", "spatial-studio", "export-recipe"],
    mutability: "generate",
    kinds: ["3d-model", "prop", "character", "material", "shader", "effect", "storyboard", "theme"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, Treatment.SCHEMAS.request],
    produces: [Core.RESULT_SCHEMA, "model/gltf-binary", "image/svg+xml", "text/css", Treatment.SCHEMAS.recipe, Treatment.SCHEMAS.receipt, Treatment.SCHEMAS.catalog, "axm.pixel-3d-scene-recipe/v1", "axm.asset-identity/v1", "axm.asset-representation-set/v1"],
    input_types: [{ mime: "application/json", format: "JSON", schema: Treatment.SCHEMAS.request, roles: [], required_for: ["create", "inspect", "workflow"], mutable: false, max_bytes: 200000 }],
    output_types: [
      { mime: "model/gltf-binary", format: "GLB", schema: "glTF.2.0", role: "treated-runtime-model", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/svg+xml", format: "SVG", schema: "SVG.1.1", role: "storycraft-treatment-board", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "text/css", format: "CSS", schema: "CSS.3", role: "portable-aetherfx-css", editable: true, deterministic: true, lossy: true, known_losses: ["CSS classes and variables do not imply 3D shader parity."] },
      { mime: "application/json", format: "JSON", schema: Treatment.SCHEMAS.recipe, role: "editable-visual-treatment-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Treatment.SCHEMAS.receipt, role: "visual-treatment-validation-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.pixel-3d-scene-recipe/v1", role: "treated-scene-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.asset-identity/v1", role: "asset-identity", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.asset-representation-set/v1", role: "treated-representation-set", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Treatment.SCHEMAS.catalog, role: "visual-capability-catalog", editable: false, deterministic: true, lossy: false, known_losses: [] }
    ],
    canvas_types: [
      { medium: "3d-surface", units: ["m", "game-world-unit"], colour_spaces: ["linear-srgb", "material-channel"], transparency_modes: ["opaque", "allowed"], material_behaviours: ["pbr", "emissive", "glass", "gloss", "metallic", "rough", "storycraft-companion"], behaviours: ["animated", "interactive"], intended_uses: ["3d-model", "prop", "character", "animation", "material", "effect"], up_axes: ["y"], handedness: ["right"] },
      { medium: "screen", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["opaque", "allowed"], material_behaviours: ["glass", "glow", "paper", "neon"], behaviours: ["static", "responsive"], intended_uses: ["storyboard", "theme", "effect", "presentation"] }
    ],
    canvas_limits: { min_width: 0.1, min_height: 0.1, max_width: 4096, max_height: 4096, min_animation_frames: 2, max_animation_frames: 240, min_polygon_count: 1, min_vertices: 1 },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "material behaviour", "behaviour.animated", "behaviour.interactive", "performance.max-file-bytes", "performance.max-polygon-count", "performance.max-animation-frames", "performance.max-vertices", "spatial.up-axis", "spatial.handedness", "spatial.world-scale", "source-artifact.schema", "identity", "representation-profile", "style-layer-id", "effect-module-id", "material-family-id", "accessibility", "supplied-story-copy", "no-silent-fallback"],
    editable_recipe_formats: [Treatment.SCHEMAS.request, Treatment.SCHEMAS.recipe],
    operations: { preview: true, validate: true, edit: false },
    emits_editable_source: true,
    supports_edit_operation: false,
    requires: [],
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "Style, effect, material, geometry, GLB and SVG composition are local deterministic operations." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM Visual Capability Catalog", version: Treatment.CATALOG.version, bundled: true }, { name: "AXM Style Fabric", version: "0.6.0", bundled: true }, { name: "AXM AetherFX", version: "v1.3.0-axm.1", bundled: true }, { name: "AXM Pixel 3D Core", version: "1.0.0", bundled: true }] },
    engine: { name: "AXM deterministic cross-surface visual treatment composer", version: VERSION, execution: "local-pure-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: { interchange_formats: ["model/gltf-binary", "image/svg+xml", "text/css", Treatment.SCHEMAS.recipe, "axm.asset-representation-set/v1"], known_losses: ["Some AetherFX modules are portable-web or token-only until a matching GLB shader adapter exists."], unsupported_features: ["automatic game installation", "automatic shader parity", "cinematic rendering", "whole-game 3D conversion", "narrative inference"], fallbacks: [] },
    validation: { checks: ["exact style/effect/material resolution", "catalog digest binding", "identity/profile preservation", "GLB structure and animation", "palette/triangle/node/material/file budgets", "byte determinism", "candidate-only authority", "no silent fallback"] },
    rollback: { strategy: "discard candidate artifacts; this hand cannot apply a visual treatment to a game or canonical asset" },
    evidence: [{ claim: "The hand executes Style Fabric data, AetherFX module plans, Visual FX SVG/CSS blocks and Pixel 3D GLB packing through one digest-bound recipe.", source_url: "local:shared/asset-hands/visual-treatment-core.js", specification_version: VERSION, retrieved_at: "2026-08-12" }],
    tests: ["visual-treatment-core-selftest", "visual-treatment-hand-selftest", "asset-hands-selftest", "schema-contract-selftest", "live-browser-treatment-test"],
    limits: { catalogDigest: Treatment.CATALOG.digest, direct3DEffects: Treatment.DIRECT_3D_EFFECTS.length, automaticApplication: false, automaticPromotion: false, cinematic: false }
  };

  async function createAsync(context) {
    var sources = context.sourceArtifacts.filter(function (item) { return item.content_schema === Treatment.SCHEMAS.request; });
    if (sources.length !== 1) throw new Error("visual treatment hand requires exactly one " + Treatment.SCHEMAS.request + " source");
    var request;
    try { request = JSON.parse(sources[0].text); } catch (error) { throw new Error("visual treatment request is not valid JSON"); }
    var result = Treatment.buildPackage(request);
    if (result.status !== "READY") throw new Error(result.status + ": " + (result.missing || []).map(function (item) { return item.id || item; }).join(", "));
    var replay = Treatment.buildPackage(request), performance = context.targetCanvas.performance, spatial = context.targetCanvas.spatial;
    var hostChecks = [
      { name: "host-polygon-budget", pass: performance.max_polygon_count == null || result.receipt.measures.triangles <= performance.max_polygon_count },
      { name: "host-vertex-budget", pass: performance.max_vertices == null || result.receipt.measures.vertices <= performance.max_vertices },
      { name: "host-animation-key-budget", pass: performance.max_animation_frames == null || result.receipt.measures.animations <= performance.max_animation_frames },
      { name: "host-file-budget", pass: performance.max_file_bytes == null || result.glb.bytes.length <= performance.max_file_bytes },
      { name: "host-spatial-convention", pass: spatial.up_axis === "y" && spatial.handedness === "right" && (spatial.world_scale == null || spatial.world_scale === 1) }
    ];
    var name = Core.slug(context.brief.title + "-" + request.profile_id + "-treated");
    var artifacts = [
      { id: "treated-runtime-model", role: "treated-runtime-model", name: context.brief.title + " treated animated GLB", filename: name + ".glb", mime: "model/gltf-binary", format: "GLB", editable: false, dataUrl: result.glb.dataUrl, metadata: { schema: "glTF.2.0", identity_id: result.identity.id, representation_profile_id: result.profile.id, treatment_digest: result.receipt.treatment_digest, catalog_digest: result.receipt.catalog_digest, digest: result.receipt.glb_digest, candidateOnly: true, canonical: false } },
      { id: "storycraft-treatment-board", role: "storycraft-treatment-board", name: context.brief.title + " Storycraft treatment board", filename: name + "-story.svg", mime: "image/svg+xml", format: "SVG", editable: false, text: result.storyboard_svg, width: 960, height: 540, metadata: { schema: "SVG.1.1", suppliedCopyOnly: true, inferredNarrative: false, candidateOnly: true } },
      { id: "portable-aetherfx-css", role: "portable-aetherfx-css", name: context.brief.title + " portable AetherFX variables", filename: name + ".css", mime: "text/css", format: "CSS", editable: true, text: result.portable_css, metadata: { schema: "CSS.3", glbShaderParityClaimed: false, candidateOnly: true } },
      jsonArtifact("editable-visual-treatment-recipe", "editable-visual-treatment-recipe", context.brief.title + " treatment recipe", name + "-treatment.json", result.recipe, true),
      jsonArtifact("visual-treatment-validation-receipt", "visual-treatment-validation-receipt", context.brief.title + " treatment receipt", name + "-receipt.json", result.receipt, false),
      jsonArtifact("treated-scene-recipe", "treated-scene-recipe", context.brief.title + " treated scene", name + "-scene.json", result.scene, true),
      jsonArtifact("asset-identity", "asset-identity", context.brief.title + " identity", name + "-identity.json", result.identity, true),
      jsonArtifact("treated-representation-set", "treated-representation-set", context.brief.title + " representation set", name + "-representations.json", result.representation_set, true),
      jsonArtifact("visual-capability-catalog", "visual-capability-catalog", context.brief.title + " capability catalog", name + "-catalog.json", Treatment.CATALOG, false)
    ];
    return {
      artifacts: artifacts,
      previewArtifactId: "storycraft-treatment-board",
      recipe: { format: Treatment.SCHEMAS.recipe, parameters: result.recipe, steps: [{ op: "resolve-exact-style-layers" }, { op: "compile-exact-aetherfx-module-plan" }, { op: "apply-supported-material-light-and-atmosphere-to-glb" }, { op: "emit-portable-web-css-and-storycraft-svg" }, { op: "preserve-identity-profile-and-simulation" }, { op: "verify-budgets-determinism-and-no-fallback" }] },
      validationChecks: result.receipt.checks.map(function (check) { return { name: check.id, pass: check.pass, details: check.details }; }).concat(hostChecks, [{ name: "hand-replay-glb-digest", pass: replay.receipt.glb_digest === result.receipt.glb_digest }, { name: "hand-replay-treatment-digest", pass: replay.receipt.treatment_digest === result.receipt.treatment_digest }, { name: "candidate-only", pass: result.receipt.authority.installed === false && result.receipt.authority.canonical === false }]),
      measures: Object.assign({}, result.receipt.measures, { identityId: result.identity.id, profileId: result.profile.id, catalogDigest: result.receipt.catalog_digest, treatmentDigest: result.receipt.treatment_digest, fallbackUsed: false }),
      notes: result.receipt.known_losses.concat(["The GLB is the real animated 3D output; the SVG is the exact supplied-copy Storycraft companion.", "This hand creates candidates and cannot install, activate, promote or canonize a treatment."])
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
