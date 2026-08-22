(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var scriptUrl = !node && typeof document !== "undefined" && document.currentScript ? document.currentScript.src : null;
  var loader;
  if (node) {
    var path = require("node:path"), pathToFileURL = require("node:url").pathToFileURL;
    loader = function () {
      return Promise.all([
        import(pathToFileURL(path.resolve(__dirname, "../../../tools/pbr-material-baker/pbr-baker-core.mjs")).href),
        import(pathToFileURL(path.resolve(__dirname, "../../../tools/pbr-material-baker/pbr-baker-verifier.mjs")).href)
      ]);
    };
  } else {
    loader = function () {
      if (!scriptUrl) return Promise.reject(new Error("PBR material hand script URL is unavailable"));
      return Promise.all([
        import(new URL("../../../tools/pbr-material-baker/pbr-baker-core.mjs", scriptUrl).href),
        import(new URL("../../../tools/pbr-material-baker/pbr-baker-verifier.mjs", scriptUrl).href)
      ]);
    };
  }
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../raster-codec") : root.AXMRasterCodec,
    loader
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, RasterCodec, loadModules) {
  "use strict";
  if (!Core || !RasterCodec || !loadModules) throw new Error("PBR material hand dependencies are required");
  var VERSION = "1.1.0";
  var RECIPE_SCHEMA = "axm.pbr-material-recipe/v1";
  var RECEIPT_SCHEMA = "axm.pbr-material-bake-receipt/v1";
  var MAPS = ["albedo", "normal", "orm", "emissive", "height"];

  function jsonArtifact(id, role, name, filename, value, editable) {
    return { id: id, role: role, name: name, filename: filename, mime: "application/json", format: "JSON", editable: !!editable, text: JSON.stringify(value, null, 2), metadata: { schema: value.schema || null, candidateOnly: true, canonical: false } };
  }

  function pngArtifact(id, name, filename, encoded, metadata) {
    return { id: id, role: id, name: name, filename: filename, mime: "image/png", format: "PNG", editable: false, dataUrl: encoded.dataUrl, width: encoded.width, height: encoded.height, metadata: Object.assign({ schema: "PNG.1.0", colourSpace: "sRGB/material-channel", deterministic: true, candidateOnly: true, canonical: false }, metadata || {}) };
  }

  function samplingMetadata(name) {
    var channels = {
      albedo: { r: "base-color-red", g: "base-color-green", b: "base-color-blue", a: "opacity" },
      normal: { r: "tangent-x", g: "tangent-y-positive-opengl", b: "tangent-z", a: "one" },
      orm: { r: "ambient-occlusion", g: "roughness", b: "metalness", a: "one" },
      emissive: { r: "emissive-red", g: "emissive-green", b: "emissive-blue", a: "one" },
      height: { r: "height", g: "height", b: "height", a: "one" },
      preview: { r: "reference-preview-red", g: "reference-preview-green", b: "reference-preview-blue", a: "one" }
    };
    var colour = name === "albedo" || name === "emissive" || name === "preview";
    return {
      interpretation: colour ? "colour" : "data",
      transfer_function: colour ? "srgb" : "linear",
      channel_semantics: channels[name],
      wrap: name === "preview" ? "clamp" : "repeat"
    };
  }

  function validateRecipe(request, context) {
    if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("PBR material recipe must be a JSON object");
    var allowed = ["authority", "family", "id", "normal_strength", "schema", "seed", "size", "version"];
    var extras = Object.keys(request).filter(function (key) { return allowed.indexOf(key) < 0; });
    if (extras.length) throw new Error("PBR material recipe contains unsupported fields: " + extras.join(", "));
    if (request.schema !== RECIPE_SCHEMA || request.version !== "1.0.0") throw new Error("PBR material recipe schema/version mismatch");
    if (typeof request.id !== "string" || !request.id.trim() || request.id.length > 120) throw new Error("PBR material recipe id must contain 1-120 characters");
    if (typeof request.seed !== "string" || !request.seed.trim() || request.seed.length > 120) throw new Error("PBR material recipe seed must contain 1-120 characters");
    if (request.authority !== "candidate-only") throw new Error("PBR material recipe must remain candidate-only");
    if (!Number.isInteger(request.size) || request.size < 32 || request.size > 512) throw new Error("PBR material recipe size must be an integer from 32 through 512");
    if (!Number.isFinite(request.normal_strength) || request.normal_strength < 0.25 || request.normal_strength > 8) throw new Error("PBR material normal_strength must stay from 0.25 through 8");
    var dimensions = context && context.brief && context.brief.target_canvas && context.brief.target_canvas.dimensions;
    if (!dimensions || Number(dimensions.width) !== request.size || Number(dimensions.height) !== request.size)
      throw new Error("PBR material recipe size must match both target_canvas dimensions");
  }

  function rgbaBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value && ArrayBuffer.isView(value) && value.BYTES_PER_ELEMENT === 1)
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error("PBR material baker returned a non-byte RGBA buffer");
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "pbr-material-bake",
    title: "Deterministic PBR Material Bake Hand",
    version: VERSION,
    category: "material-texture-baking",
    lifecycle_status: "experimental",
    summary: "Exposes the existing seeded PBR Material Baker as an Asset Hand that creates and source-edits real albedo, OpenGL normal, packed ORM, emissive, height and preview PNGs with independent verification.",
    purpose: "Let Asset Fabric manipulate and generate repeatable game-material map sets instead of treating material direction as metadata only.",
    operation_modes: ["create", "edit", "inspect", "workflow"],
    canvas_models: ["raster-frame", "procedural-graph"],
    entry_surfaces: ["command", "asset-fabric", "spatial-studio", "export-recipe"],
    mutability: "transform",
    kinds: ["texture", "material", "shader"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, RECIPE_SCHEMA],
    produces: [Core.RESULT_SCHEMA, RECIPE_SCHEMA, RECEIPT_SCHEMA, "axm.pbr-material-verification/v1", "image/png"],
    input_types: [{ mime: "application/json", format: "JSON", schema: RECIPE_SCHEMA, roles: [], required_for: ["create", "edit", "inspect", "workflow"], mutable: true, max_bytes: 100000 }],
    output_types: [
      { mime: "image/png", format: "PNG", schema: "PNG.1.0", role: "pbr-albedo-map", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "PNG.1.0", role: "pbr-normal-map", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "PNG.1.0", role: "pbr-orm-map", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "PNG.1.0", role: "pbr-emissive-map", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "PNG.1.0", role: "pbr-height-map", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "PNG.1.0", role: "pbr-material-preview", editable: false, deterministic: true, lossy: false, known_losses: ["Preview is a local reference sphere, not an engine-specific renderer parity claim."] },
      { mime: "application/json", format: "JSON", schema: RECIPE_SCHEMA, role: "editable-pbr-material-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: RECEIPT_SCHEMA, role: "pbr-material-bake-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] }
    ],
    canvas_types: [{ medium: "3d-surface", units: ["px"], colour_spaces: ["srgb", "linear-srgb", "material-channel"], transparency_modes: ["opaque"], material_behaviours: ["albedo", "normal", "ambient-occlusion", "roughness", "metallic", "emissive", "height"], behaviours: ["static", "tileable"], intended_uses: ["texture", "material", "shader", "3d-model"] }],
    canvas_limits: { min_width: 32, min_height: 32, max_width: 512, max_height: 512, max_pixels: 262144, texture_bytes_per_pixel: 4 },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.static", "behaviour.tileable", "physical.repeat", "performance.max-file-bytes", "material channels", "source-artifact.schema", "seed", "normal convention", "channel packing"],
    editable_recipe_formats: [RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: true },
    emits_editable_source: true,
    supports_edit_operation: true,
    requires: [],
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "The seeded baker and PNG codec run locally without network access." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM PBR Material Baker", version: "v0.1", bundled: true }, { name: "AXM Raster Codec", version: RasterCodec.VERSION, bundled: true }] },
    engine: { name: "AXM seeded PBR material baker", version: "v0.1", execution: "local-pure-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: { interchange_formats: ["image/png", RECIPE_SCHEMA, RECEIPT_SCHEMA], known_losses: ["No renderer parity is inferred from the reference preview."], unsupported_features: ["artist-authored texture semantics", "automatic GLB binding", "automatic library promotion"], fallbacks: [] },
    validation: { checks: ["five exact map dimensions", "non-flat albedo/height/normal signal", "unit normals", "OpenGL tangent convention", "independent ORM channels", "declared packing", "PNG structural validation", "byte determinism"] },
    rollback: { strategy: "discard candidate map artifacts; the hand cannot install or bind them automatically" },
    evidence: [{ claim: "The hand executes the existing seeded material baker and emits real independently inspectable PNG bytes.", source_url: "local:tools/pbr-material-baker/pbr-baker-core.mjs", specification_version: "v0.1", retrieved_at: "2026-08-12" }],
    tests: ["pbr-material-bake-hand-selftest", "deterministic-material-fabric-selftest", "pbr-material-baker-selftest", "asset-hands-selftest", "schema-contract-selftest"],
    limits: { families: 6, maximumSize: 512, automaticBinding: false, automaticPromotion: false }
  };

  async function createAsync(context) {
    var sources = context.sourceArtifacts.filter(function (item) { return item.content_schema === RECIPE_SCHEMA; });
    if (sources.length !== 1) throw new Error("PBR material hand requires exactly one " + RECIPE_SCHEMA + " source");
    var request;
    try { request = JSON.parse(sources[0].text); } catch (error) { throw new Error("PBR material recipe is not valid JSON"); }
    validateRecipe(request, context);
    var modules = await loadModules(), Baker = modules[0], Verifier = modules[1];
    if (!Baker.MATERIAL_FAMILIES[request.family]) throw new Error("MISSING_VISUAL_CAPABILITY: pbr-family:" + request.family);
    var bakerRecipe = { family: request.family, seed: request.seed, size: request.size, normalStrength: request.normal_strength };
    var bake = Baker.bakeMaterial(bakerRecipe), replay = Baker.bakeMaterial(bakerRecipe);
    var verification = Verifier.verifyMaterialBake(bake), encoded = {}, replayEncoded = {};
    MAPS.forEach(function (name) { encoded[name] = RasterCodec.encodeRgba(bake.recipe.size, bake.recipe.size, rgbaBytes(bake.maps[name])); replayEncoded[name] = RasterCodec.encodeRgba(replay.recipe.size, replay.recipe.size, rgbaBytes(replay.maps[name])); });
    encoded.preview = RasterCodec.encodeRgba(bake.recipe.size, bake.recipe.size, rgbaBytes(Baker.renderMaterialBall(bake)));
    replayEncoded.preview = RasterCodec.encodeRgba(replay.recipe.size, replay.recipe.size, rgbaBytes(Baker.renderMaterialBall(replay)));
    var names = MAPS.concat(["preview"]), mapDigests = {}, checks = [];
    names.forEach(function (name) {
      mapDigests[name] = Core.hash(encoded[name].dataUrl);
      checks.push({ id: name + "-png", pass: encoded[name].inspection.pass, details: encoded[name].inspection.errors.join("; ") || encoded[name].bytes.length + " bytes" });
      checks.push({ id: name + "-deterministic", pass: encoded[name].dataUrl === replayEncoded[name].dataUrl, details: mapDigests[name] });
    });
    checks.push({ id: "independent-material-verifier", pass: verification.status === "pass", details: verification.summary ? verification.summary.passed + " PASS / " + verification.summary.failed + " FAIL" : verification.status });
    checks.push({ id: "candidate-only", pass: request.authority === "candidate-only", details: "installed=false; promoted=false; canonical=false" });
    var receipt = { schema: RECEIPT_SCHEMA, version: "1.0.0", status: checks.every(function (check) { return check.pass; }) ? "PASS" : "FAIL", recipe_id: request.id, family: request.family, size: bake.recipe.size, map_digests: mapDigests, verification: verification, checks: checks, deterministic: true, authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true } };
    var slugName = Core.slug(context.brief.title + "-" + request.family), artifacts = names.map(function (name) {
      var role = name === "preview" ? "pbr-material-preview" : "pbr-" + name + "-map";
      return pngArtifact(role, context.brief.title + " " + name, slugName + "-" + name + ".png", encoded[name], {
        map: name,
        family: request.family,
        sampling: samplingMetadata(name),
        tangentConvention: bake.recipe.tangentConvention,
        normalConvention: name === "normal" ? bake.recipe.tangentConvention : null,
        packing: name === "orm" ? bake.recipe.packing.orm : null,
        digest: mapDigests[name]
      });
    });
    artifacts.push(jsonArtifact("editable-pbr-material-recipe", "editable-pbr-material-recipe", context.brief.title + " recipe", slugName + "-recipe.json", request, true));
    artifacts.push(jsonArtifact("pbr-material-bake-receipt", "pbr-material-bake-receipt", context.brief.title + " receipt", slugName + "-receipt.json", receipt, false));
    return {
      artifacts: artifacts,
      previewArtifactId: "pbr-material-preview",
      recipe: { format: RECIPE_SCHEMA, parameters: request, steps: [{ op: "seed-exact-family" }, { op: "sample-periodic-material-signal" }, { op: "derive-opengl-normal" }, { op: "pack-orm-channels" }, { op: "encode-six-deterministic-pngs" }, { op: "verify-signal-packing-and-replay" }] },
      validationChecks: checks.map(function (check) { return { name: check.id, pass: check.pass, details: check.details }; }),
      measures: { family: request.family, width: bake.recipe.size, height: bake.recipe.size, maps: MAPS.length, pngs: names.length, totalBytes: names.reduce(function (sum, name) { return sum + encoded[name].bytes.length; }, 0), deterministic: true },
      notes: ["The map set is real deterministic PNG output, not a flat placeholder.", "No map is installed, bound to a game asset, promoted or visually approved automatically.", "The preview is a local reference render and does not prove target-engine parity."]
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
