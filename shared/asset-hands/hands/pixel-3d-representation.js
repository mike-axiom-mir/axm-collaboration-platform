(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../pixel-3d-core") : root.AXMPixel3DCore
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, Pixel3D) {
  "use strict";
  if (!Core || !Pixel3D) throw new Error("pixel 3D representation hand dependencies are required");
  var VERSION = "1.0.0";

  function jsonArtifact(id, role, name, filename, value, editable) {
    return {
      id: id,
      role: role,
      name: name,
      filename: filename,
      mime: "application/json",
      format: "JSON",
      editable: !!editable,
      text: JSON.stringify(value, null, 2),
      metadata: { schema: value.schema || null, candidateOnly: true, canonical: false }
    };
  }

  function previewSvg(result, width, height) {
    width = Math.max(320, Number(width) || 640);
    height = Math.max(180, Number(height) || 360);
    var title = result.identity.id.split(".").pop().replace(/-/g, " ");
    var detail = result.profile.id === "pixel-8bit-3d" ? 8 : 16;
    var colours = result.scene.materials.map(function (item) { return item.colour; });
    var bars = colours.map(function (colour, index) {
      return '<rect x="' + (30 + index * 28) + '" y="' + (height - 54) + '" width="22" height="22" fill="' + colour + '"/>';
    }).join("");
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Pixel styled 3D package diagram"><rect width="100%" height="100%" fill="#08111d"/><path d="M' + (width * .5) + ' 52 L' + (width * .72) + ' ' + (height * .37) + ' L' + (width * .5) + ' ' + (height * .62) + ' L' + (width * .28) + ' ' + (height * .37) + ' Z" fill="' + colours[0] + '" stroke="#f9c74f" stroke-width="4"/><path d="M' + (width * .28) + ' ' + (height * .37) + ' L' + (width * .5) + ' ' + (height * .62) + ' V' + (height * .82) + ' L' + (width * .28) + ' ' + (height * .57) + ' Z" fill="' + (colours[1] || colours[0]) + '"/><path d="M' + (width * .72) + ' ' + (height * .37) + ' L' + (width * .5) + ' ' + (height * .62) + ' V' + (height * .82) + ' L' + (width * .72) + ' ' + (height * .57) + ' Z" fill="' + (colours[2] || colours[0]) + '"/><text x="30" y="34" fill="#7dd3fc" font-family="ui-monospace,monospace" font-size="14">AXM ' + detail + '-BIT 3D · GLB 2.0 · ANIMATED</text><text x="30" y="' + (height - 70) + '" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="20">' + title.toUpperCase() + '</text>' + bars + '<text x="' + (width - 230) + '" y="' + (height - 36) + '" fill="#9fb4c8" font-family="ui-monospace,monospace" font-size="12">DIAGRAM — OPEN GLB FOR MODEL</text></svg>';
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "pixel-3d-representation",
    title: "Identity-Bound Pixel 3D Representation Hand",
    version: VERSION,
    category: "pixel-styled-realtime-3d",
    lifecycle_status: "experimental",
    summary: "Creates deterministic animated GLB representations in exact pixel-8bit-3d or pixel-16bit-3d art directions while preserving identity, footprint, pivots, sockets and semantic state.",
    purpose: "Let later games render the same simulation object as independently selectable pixel-styled 3D without silent quality fallback or identity replacement.",
    operation_modes: ["create", "inspect", "workflow"],
    canvas_models: ["viewport-3d"],
    entry_surfaces: ["command", "asset-fabric", "spatial-studio", "export-recipe"],
    mutability: "generate",
    kinds: ["3d-model", "prop", "character", "animation"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, Pixel3D.SCHEMAS.request],
    produces: [Core.RESULT_SCHEMA, "model/gltf-binary", "image/svg+xml", Pixel3D.SCHEMAS.recipe, Pixel3D.SCHEMAS.receipt, Pixel3D.SCHEMAS.profile, "axm.asset-identity/v1", Pixel3D.SCHEMAS.representationSet],
    input_types: [{ mime: "application/json", format: "JSON", schema: Pixel3D.SCHEMAS.request, roles: [], required_for: ["create", "inspect", "workflow"], mutable: false, max_bytes: 100000 }],
    output_types: [
      { mime: "model/gltf-binary", format: "GLB", schema: "glTF.2.0", role: "pixel-3d-runtime-model", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Pixel3D.SCHEMAS.recipe, role: "editable-pixel-3d-scene-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Pixel3D.SCHEMAS.receipt, role: "pixel-3d-validation-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Pixel3D.SCHEMAS.profile, role: "visual-representation-profile", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.asset-identity/v1", role: "asset-identity", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Pixel3D.SCHEMAS.representationSet, role: "asset-representation-set", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/svg+xml", format: "SVG", role: "pixel-3d-package-diagram", editable: false, deterministic: true, lossy: true, known_losses: ["Diagram identifies the package and palette but is not a rendered view of the GLB."] }
    ],
    canvas_types: [{ medium: "3d-surface", units: ["m", "game-world-unit"], colour_spaces: ["linear-srgb", "material-channel"], transparency_modes: ["opaque"], behaviours: ["animated", "interactive"], intended_uses: ["3d-model", "prop", "character", "animation"], up_axes: ["y"], handedness: ["right"] }],
    canvas_limits: { min_width: 0.1, min_height: 0.1, max_width: 20, max_height: 20, min_animation_frames: 2, max_animation_frames: 240, min_polygon_count: 1, min_vertices: 1 },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.animated", "behaviour.interactive", "performance.max-file-bytes", "performance.max-polygon-count", "performance.max-animation-frames", "performance.max-vertices", "spatial.up-axis", "spatial.handedness", "spatial.world-scale", "source-artifact.schema", "identity", "representation-profile", "no-silent-fallback"],
    editable_recipe_formats: [Pixel3D.SCHEMAS.request, Pixel3D.SCHEMAS.recipe],
    operations: { preview: true, validate: true, edit: false },
    emits_editable_source: true,
    supports_edit_operation: false,
    requires: [],
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "Geometry, animation, GLB packing and validation are deterministic local operations." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM Pixel 3D Core", version: Pixel3D.VERSION, bundled: true }] },
    engine: { name: "AXM identity-bound primitive GLB builder", version: VERSION, execution: "local-pure-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: { interchange_formats: ["model/gltf-binary", Pixel3D.SCHEMAS.recipe, Pixel3D.SCHEMAS.profile, Pixel3D.SCHEMAS.representationSet], known_losses: ["SVG output is only a package diagram."], unsupported_features: ["collision mesh", "physics", "engine-specific import settings", "textures", "high-detail 3D", "cinematic render", "whole-game 3D pack completion"], fallbacks: [] },
    validation: { checks: ["GLB 2.0 structure", "identity/profile extras", "footprint/pivot/socket preservation", "animated node hierarchy", "palette/triangle/node/material/file budgets", "byte determinism", "no silent fallback"] },
    rollback: { strategy: "discard candidate artifacts; this hand cannot install or activate a representation" },
    evidence: [{ claim: "The hand emits actual animated GLB 2.0 bytes with AXM identity extras and deterministic receipts.", source_url: "local:shared/asset-hands/pixel-3d-codec.js", specification_version: VERSION, retrieved_at: "2026-08-12" }],
    tests: ["pixel-3d-core-selftest", "pixel-3d-hand-selftest", "asset-hands-selftest", "schema-contract-selftest"],
    limits: { pilotIdentities: 4, profiles: 2, fallback: false, installation: false, automaticPromotion: false, wholeGame3DPack: false }
  };

  async function createAsync(context) {
    var sources = context.sourceArtifacts.filter(function (item) { return item.content_schema === Pixel3D.SCHEMAS.request; });
    if (sources.length !== 1) throw new Error("pixel 3D hand requires exactly one " + Pixel3D.SCHEMAS.request + " source");
    var request;
    try { request = JSON.parse(sources[0].text); } catch (error) { throw new Error("pixel 3D request is not valid JSON"); }
    if (request.schema !== Pixel3D.SCHEMAS.request) throw new Error("pixel 3D request schema mismatch");
    var result = Pixel3D.buildPackage(request);
    if (result.status !== "READY") throw new Error(result.status + ": " + (result.missing || []).join(", "));
    var replay = Pixel3D.buildPackage(request);
    var performance = context.targetCanvas.performance;
    var spatial = context.targetCanvas.spatial;
    var hostChecks = [
      { name: "host-polygon-budget", pass: performance.max_polygon_count == null || result.receipt.measures.triangles <= performance.max_polygon_count },
      { name: "host-vertex-budget", pass: performance.max_vertices == null || result.receipt.measures.vertices <= performance.max_vertices },
      { name: "host-animation-key-budget", pass: performance.max_animation_frames == null || result.receipt.measures.animation_keys <= performance.max_animation_frames },
      { name: "host-file-budget", pass: performance.max_file_bytes == null || result.glb.bytes.length <= performance.max_file_bytes },
      { name: "host-spatial-convention", pass: spatial.up_axis === "y" && spatial.handedness === "right" && (spatial.world_scale == null || spatial.world_scale === 1) }
    ];
    var slug = Core.slug(context.brief.title + "-" + result.profile.id);
    var svg = previewSvg(result, context.brief.canvas.width, context.brief.canvas.height);
    var artifacts = [
      { id: "pixel-3d-runtime-model", role: "pixel-3d-runtime-model", name: context.brief.title + " animated GLB", filename: slug + ".glb", mime: "model/gltf-binary", format: "GLB", editable: false, dataUrl: result.glb.dataUrl, metadata: { schema: "glTF.2.0", identity_id: result.identity.id, representation_profile_id: result.profile.id, animation_state: result.scene.animation_state, digest: result.receipt.glb_digest, candidateOnly: true, canonical: false } },
      jsonArtifact("pixel-3d-scene-recipe", "editable-pixel-3d-scene-recipe", context.brief.title + " scene recipe", slug + "-scene.json", result.scene, true),
      jsonArtifact("pixel-3d-validation-receipt", "pixel-3d-validation-receipt", context.brief.title + " validation receipt", slug + "-receipt.json", result.receipt, false),
      jsonArtifact("visual-representation-profile", "visual-representation-profile", context.brief.title + " profile", slug + "-profile.json", result.profile, true),
      jsonArtifact("asset-identity", "asset-identity", context.brief.title + " identity", slug + "-identity.json", result.identity, true),
      jsonArtifact("asset-representation-set", "asset-representation-set", context.brief.title + " representation set", slug + "-representations.json", result.representation_set, true),
      { id: "pixel-3d-package-diagram", role: "pixel-3d-package-diagram", name: context.brief.title + " package diagram", filename: slug + "-diagram.svg", mime: "image/svg+xml", format: "SVG", editable: false, text: svg, width: context.brief.canvas.width, height: context.brief.canvas.height, metadata: { meshRender: false, candidateOnly: true } }
    ];
    return {
      artifacts: artifacts,
      previewArtifactId: "pixel-3d-package-diagram",
      recipe: { format: Pixel3D.SCHEMAS.recipe, parameters: result.scene, steps: [{ op: "resolve-exact-profile-without-fallback" }, { op: "bind-identity-footprint-pivots-and-sockets" }, { op: "construct-hierarchical-primitive-mesh" }, { op: "author-semantic-node-animation" }, { op: "pack-glb-2-with-identity-extras" }, { op: "verify-budgets-and-determinism" }] },
      validationChecks: result.receipt.checks.concat(hostChecks, [{ name: "hand-replay-glb-digest", pass: replay.receipt.glb_digest === result.receipt.glb_digest }, { name: "candidate-only", pass: result.identity.authority.installed === false && result.identity.authority.canonical === false }]),
      measures: Object.assign({}, result.receipt.measures, { identityId: result.identity.id, profileId: result.profile.id, fallbackUsed: false }),
      notes: result.receipt.known_losses.concat(["The SVG is labelled as a diagram; the GLB is the real model output.", "The hand creates candidate artifacts and cannot install, activate, promote or canonize them."])
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
