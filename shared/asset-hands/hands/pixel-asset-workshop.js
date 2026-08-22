(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../raster-codec") : root.AXMRasterCodec,
    node ? require("../raster-operations-core") : root.AXMRasterOperationsCore,
    node ? require("crypto") : null,
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, RasterCodec, RasterOperations, NodeCrypto) {
  "use strict";

  if (!RasterCodec || !RasterOperations) throw new Error("AXM raster codec and raster operations core are required");

  var PACKAGE_SCHEMA = "axm.pixel-asset-package/v1";
  var RECEIPT_SCHEMA = "axm.raster-operations-receipt/v1";

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error("SHA-256 input must be a typed byte array");
  }

  function utf8(value) {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value), "utf8"));
    return new TextEncoder().encode(String(value));
  }

  async function sha256(bytes) {
    bytes = asBytes(bytes);
    if (NodeCrypto) return NodeCrypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    if (globalThis.crypto && globalThis.crypto.subtle) {
      var digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
    }
    throw new Error("SHA-256 runtime is unavailable");
  }

  function jsonArtifact(id, role, name, filename, value, editable, schema) {
    return {
      id: id,
      role: role,
      name: name,
      filename: filename,
      mime: "application/json",
      format: "JSON",
      width: 0,
      height: 0,
      editable: editable,
      text: JSON.stringify(value, null, 2),
      metadata: { schema: schema, candidateOnly: true, canonical: false },
    };
  }

  function suppliedSha256(value) {
    var match = /^(?:sha256:)?([0-9a-f]{64})$/i.exec(String(value || "").trim());
    return match ? match[1].toLowerCase() : null;
  }

  function stateEqual(left, right) {
    if (!left || !right || left.kind !== right.kind) return false;
    if (left.kind === "image") return RasterOperations.imagesEqual(left.image, right.image);
    return left.frames.length === right.frames.length && left.frames.every(function (frame, index) {
      return RasterOperations.imagesEqual(frame, right.frames[index]);
    });
  }

  async function encodedArtifact(id, role, name, filename, image, entityId, parentEntityIds) {
    var png = RasterCodec.encodeRgba(image.width, image.height, image.rgba, { colourSpace: "srgb" });
    var decoded = RasterCodec.decodeRgba(png.bytes);
    var pixelMatch = decoded.width === image.width && decoded.height === image.height && decoded.rgba.length === image.rgba.length && decoded.rgba.every(function (value, index) { return value === image.rgba[index]; });
    var digest = await sha256(png.bytes);
    return {
      artifact: {
        id: id,
        role: role,
        name: name,
        filename: filename,
        mime: "image/png",
        format: "PNG",
        width: image.width,
        height: image.height,
        editable: false,
        dataUrl: png.dataUrl,
        metadata: {
          sha256: digest,
          entityId: entityId,
          parentEntityIds: parentEntityIds.slice(),
          colourSpace: "srgb",
          pixelFormat: "RGBA8",
          candidateOnly: true,
          canonical: false,
        },
      },
      record: {
        id: id,
        entity_id: entityId,
        role: role,
        filename: filename,
        mime: "image/png",
        width: image.width,
        height: image.height,
        sha256: digest,
        parent_entity_ids: parentEntityIds.slice(),
      },
      check: { name: "png-pixel-roundtrip:" + id, pass: png.inspection.pass && decoded.inspection.pass && pixelMatch },
    };
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "pixel-asset-workshop",
    title: "Pixel Asset Workshop",
    version: "0.1.0",
    category: "transformation",
    lifecycle_status: "experimental",
    summary: "Preserves an imported PNG and derives deterministic pixel assets through explicit raster recipes, grid slicing, packing, validation and parent-child lineage.",
    purpose: "Provide the pixel-asset specialization above a reusable deterministic raster-operations core.",
    operation_modes: ["edit", "workflow"],
    canvas_models: ["raster-frame"],
    entry_surfaces: ["command", "sprite-editor", "export-recipe"],
    mutability: "transform",
    kinds: ["sprite", "character", "effect", "icon", "tile", "texture", "decal", "illustration"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, RasterOperations.RECIPE_SCHEMA],
    produces: [Core.RESULT_SCHEMA, "image/png", "application/json", RasterOperations.RECIPE_SCHEMA, PACKAGE_SCHEMA, RECEIPT_SCHEMA],
    input_types: [
      { mime: "image/png", format: "PNG", schema: "", roles: [], required_for: ["edit", "workflow"], mutable: false, max_bytes: 24000000 },
      { mime: "application/json", format: "JSON", schema: RasterOperations.RECIPE_SCHEMA, roles: [], required_for: ["edit", "workflow"], mutable: false, max_bytes: 2000000 },
    ],
    output_types: [
      { mime: "image/png", format: "PNG", schema: "", role: "immutable-source-copy", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "", role: "derived-raster-candidate", editable: false, deterministic: true, lossy: true, known_losses: ["explicit crop, resize, palette or alpha operations may discard source information"] },
      { mime: "application/json", format: "JSON", schema: RasterOperations.RECIPE_SCHEMA, role: "editable-raster-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: PACKAGE_SCHEMA, role: "pixel-asset-package", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: RECEIPT_SCHEMA, role: "raster-operations-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] },
    ],
    canvas_types: [
      { medium: "game-world", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["static", "animated", "tileable"], intended_uses: ["sprite", "character", "effect", "icon", "tile", "texture", "decal"] },
      { medium: "screen", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["static", "animated", "tileable"], intended_uses: ["sprite", "effect", "icon", "tile", "texture", "illustration"] },
    ],
    canvas_limits: { min_width: 1, min_height: 1, max_width: 2048, max_height: 2048, max_pixels: RasterOperations.MAX_PIXELS, texture_bytes_per_pixel: 4, max_animation_frames: RasterOperations.MAX_FRAMES },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.static", "behaviour.animated", "behaviour.tileable", "performance.max-file-bytes", "performance.max-texture-memory-bytes", "performance.max-animation-frames"],
    editable_recipe_formats: [Core.RECIPE_SCHEMA, RasterOperations.RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: true },
    emits_editable_source: true,
    supports_edit_operation: true,
    requires: [],
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "PNG decode, raster transforms, SHA-256, validation and packaging run locally." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM raster operations core", version: RasterOperations.VERSION, bundled: true }, { name: "AXM bounded PNG codec", version: RasterCodec.VERSION, bundled: true }] },
    engine: { name: "AXM deterministic raster operations core", version: RasterOperations.VERSION, execution: "local-async-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: {
      interchange_formats: ["image/png", RasterOperations.RECIPE_SCHEMA, PACKAGE_SCHEMA, RECEIPT_SCHEMA],
      known_losses: ["Only operations explicitly present in the recipe may remove source pixels or colours."],
      unsupported_features: ["JPEG or WebP import", "content-aware pixel abstraction", "semantic segmentation", "generative pixel invention", "arbitrary rotation", "ICC or wide-colour output", "Tiled or engine-specific export adapters"],
      fallbacks: ["Unsupported import and semantic operations fail visibly; no AI or lossy implicit conversion is used."],
    },
    validation: { checks: ["immutable source byte preservation", "source and output SHA-256", "recipe source binding", "repeat execution pixel equality", "PNG encode/decode pixel roundtrip", "target dimensions", "palette limit", "duplicate frames", "slice-pack roundtrip when applicable", "candidate-only authority"] },
    rollback: { strategy: "discard-derived-candidates-and-retain-source-copy" },
    evidence: [{ claim: "Every supported transform is an explicit deterministic RGBA8 operation and the imported PNG is emitted unchanged as a separate source artifact.", source_url: "local:shared/asset-hands/raster-operations-core.js", specification_version: RasterOperations.VERSION, retrieved_at: "2026-08-11" }],
    tests: ["pixel-asset-workshop-selftest", "asset-hands-selftest", "schema-contract-selftest"],
    limits: { sourceMime: "image/png", pixelFormat: "RGBA8", colourSpace: "sRGB", maxPixels: RasterOperations.MAX_PIXELS, maxFrames: RasterOperations.MAX_FRAMES, automaticApproval: false, aiOperations: false },
  };

  async function createAsync(context) {
    var pngItems = context.sourceArtifacts.filter(function (item) { return item.mime === "image/png"; });
    var recipeItems = context.sourceArtifacts.filter(function (item) { return item.content_schema === RasterOperations.RECIPE_SCHEMA; });
    if (pngItems.length !== 1) throw new Error("pixel asset workshop requires exactly one PNG source artifact");
    if (recipeItems.length !== 1) throw new Error("pixel asset workshop requires exactly one raster operations recipe artifact");
    var source = pngItems[0], sourceBytes = RasterCodec.bytesFromDataUrl(source.dataUrl, "image/png");
    var decoded = RasterCodec.decodeRgba(sourceBytes);
    if (decoded.bitDepth !== 8) throw new Error("pixel asset workshop requires an explicit conversion before 16-bit PNG input");
    var sourceSha = await sha256(sourceBytes), claimedSha = suppliedSha256(source.digest);
    if (claimedSha && claimedSha !== sourceSha) throw new Error("PNG source SHA-256 does not match the supplied digest");
    var rawRecipe;
    try { rawRecipe = JSON.parse(recipeItems[0].text); }
    catch (error) { throw new Error("raster operations recipe is not valid JSON"); }
    if (rawRecipe.source_artifact_id !== source.id) throw new Error("raster operations recipe must bind the exact PNG source artifact id");
    var inputImage = RasterOperations.makeImage(decoded.width, decoded.height, decoded.rgba);
    var run = RasterOperations.runRecipe(inputImage, rawRecipe);
    var repeated = RasterOperations.runRecipe(inputImage, run.recipe);
    var repeatPass = stateEqual(run.state, repeated.state) && ((!run.retainedFrames && !repeated.retainedFrames) || (run.retainedFrames && repeated.retainedFrames && run.retainedFrames.length === repeated.retainedFrames.length && run.retainedFrames.every(function (frame, index) { return RasterOperations.imagesEqual(frame, repeated.retainedFrames[index]); })));
    var slug = Core.slug(context.brief.title), artifacts = [], assetRecords = [], pngChecks = [];
    artifacts.push({
      id: "immutable-source",
      role: "immutable-source-copy",
      name: context.brief.title + " immutable source",
      filename: slug + "-source.png",
      mime: "image/png",
      format: "PNG",
      width: decoded.width,
      height: decoded.height,
      editable: false,
      dataUrl: source.dataUrl,
      metadata: { sha256: sourceSha, sourceArtifactId: source.id, suppliedDigest: source.digest, immutable: true, candidateOnly: true, canonical: false },
    });
    assetRecords.push({ id: "immutable-source", entity_id: "source:" + source.id, role: "immutable-source-copy", filename: slug + "-source.png", mime: "image/png", width: decoded.width, height: decoded.height, sha256: sourceSha, parent_entity_ids: [] });

    if (run.retainedFrames) {
      for (var frameIndex = 0; frameIndex < run.retainedFrames.length; frameIndex += 1) {
        var frameId = "frame-" + String(frameIndex).padStart(3, "0");
        var frameFilename = slug + "-" + frameId + ".png";
        var frameEntityId = run.retainedFrameIds[frameIndex];
        var frameActivity = run.activities.find(function (activity) { return activity.generated.indexOf(frameEntityId) >= 0; });
        var frameOutput = await encodedArtifact(frameId, "derived-frame-candidate", context.brief.title + " frame " + frameIndex, frameFilename, run.retainedFrames[frameIndex], frameEntityId, frameActivity ? frameActivity.used : ["source:" + source.id]);
        artifacts.push(frameOutput.artifact); assetRecords.push(frameOutput.record); pngChecks.push(frameOutput.check);
      }
    }
    if (run.state.kind === "image") {
      var finalEntityId = run.state.entityIds[0];
      var finalRole = run.retainedFrames ? "packed-sprite-sheet-candidate" : "derived-raster-candidate";
      var finalOutput = await encodedArtifact("derived-raster", finalRole, context.brief.title + " derived raster", slug + ".png", run.state.image, finalEntityId, run.activities.length ? run.activities[run.activities.length - 1].used : ["source:" + source.id]);
      artifacts.push(finalOutput.artifact); assetRecords.push(finalOutput.record); pngChecks.push(finalOutput.check);
    }

    var recipeText = JSON.stringify(run.recipe, null, 2), recipeSha = await sha256(utf8(recipeText));
    var targetWidth = Math.round(context.targetCanvas.dimensions.width), targetHeight = Math.round(context.targetCanvas.dimensions.height);
    var finalImages = run.state.kind === "image" ? [run.state.image] : run.state.frames;
    var maxColours = run.recipe.validation.max_colours == null ? null : Number(run.recipe.validation.max_colours);
    var checks = [
      { name: "source-png-decoded", pass: decoded.inspection.pass },
      { name: "source-sha256-verified", pass: !claimedSha || claimedSha === sourceSha },
      { name: "source-copy-byte-identical", pass: artifacts[0].dataUrl === source.dataUrl },
      { name: "recipe-source-bound", pass: run.recipe.source_artifact_id === source.id },
      { name: "explicit-deterministic-operations-only", pass: run.activities.every(function (activity) { return activity.deterministic === true && RasterOperations.OPERATIONS.indexOf(activity.operation) >= 0; }) },
      { name: "same-source-recipe-pixel-repeat", pass: repeatPass },
      { name: "target-dimensions", pass: finalImages.every(function (image) { return image.width === targetWidth && image.height === targetHeight; }), details: { target: [targetWidth, targetHeight], actual: finalImages.map(function (image) { return [image.width, image.height]; }) } },
      { name: "palette-limit", pass: maxColours == null || run.analysis.output_palette_counts.every(function (count) { return count <= maxColours; }), details: { maximum: maxColours, actual: run.analysis.output_palette_counts } },
      { name: "duplicate-frame-policy", pass: run.recipe.validation.reject_duplicate_frames !== true || run.analysis.duplicate_frame_pairs.length === 0, details: { duplicatePairs: run.analysis.duplicate_frame_pairs } },
      { name: "candidate-only-authority", pass: run.recipe.authority === "candidate-only" },
    ].concat(run.roundTrips, pngChecks);
    if (context.targetCanvas.performance.max_animation_frames != null) checks.push({ name: "frame-budget", pass: !run.retainedFrames || run.retainedFrames.length <= context.targetCanvas.performance.max_animation_frames });
    if (context.targetCanvas.performance.max_texture_memory_bytes != null) checks.push({ name: "texture-memory-budget", pass: finalImages.every(function (image) { return image.rgba.length <= context.targetCanvas.performance.max_texture_memory_bytes; }) });

    var outputEntityIds = new Set(assetRecords.map(function (asset) { return asset.entity_id; }));
    var entities = run.entities.map(function (entity) {
      var copy = Object.assign({}, entity);
      var asset = assetRecords.find(function (candidate) { return candidate.entity_id === entity.id; });
      copy.materialized = outputEntityIds.has(entity.id);
      copy.sha256 = asset ? asset.sha256 : entity.id === "source:" + source.id ? sourceSha : null;
      return copy;
    });
    var packageManifest = {
      schema: PACKAGE_SCHEMA,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: "pixel-package-" + sourceSha.slice(0, 12) + "-" + run.recipe.id,
      source: { artifact_id: source.id, supplied_digest: source.digest, sha256: sourceSha, mime: "image/png", width: decoded.width, height: decoded.height, immutable: true, copy_artifact_id: "immutable-source", upstream_parent_asset_id: source.metadata && (source.metadata.asset_id || source.metadata.parent_asset_id) || null },
      recipe: { schema: RasterOperations.RECIPE_SCHEMA, id: run.recipe.id, sha256: recipeSha, artifact_id: "raster-operations-recipe" },
      entities: entities,
      activities: run.activities,
      assets: assetRecords,
      analysis: run.analysis,
      engine: { id: "axm-raster-operations-core", version: RasterOperations.VERSION, deterministic: true, offline: true, ai_used: false },
      authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true },
    };
    var receipt = {
      schema: RECEIPT_SCHEMA,
      version: "1.0.0",
      status: checks.every(function (check) { return check.pass; }) ? "PASS" : "HOLD",
      source: packageManifest.source,
      recipe: packageManifest.recipe,
      outputs: assetRecords,
      operations: run.activities,
      checks: checks,
      limits: { max_pixels: RasterOperations.MAX_PIXELS, max_frames: RasterOperations.MAX_FRAMES, source_mime: "image/png", colour_space: "sRGB", pixel_format: "RGBA8", jpeg_webp_import: false, semantic_ai: false, generative_ai: false },
      authority: "candidate-only",
    };
    artifacts.push(jsonArtifact("raster-operations-recipe", "editable-raster-recipe", context.brief.title + " raster recipe", slug + "-raster-operations.json", run.recipe, true, RasterOperations.RECIPE_SCHEMA));
    artifacts.push(jsonArtifact("pixel-asset-package", "pixel-asset-package", context.brief.title + " pixel asset package", slug + "-pixel-package.json", packageManifest, false, PACKAGE_SCHEMA));
    artifacts.push(jsonArtifact("raster-operations-receipt", "raster-operations-receipt", context.brief.title + " raster operations receipt", slug + "-raster-receipt.json", receipt, false, RECEIPT_SCHEMA));
    return {
      artifacts: artifacts,
      previewArtifactId: run.state.kind === "image" ? "derived-raster" : run.retainedFrames ? "frame-000" : "immutable-source",
      recipe: { format: RasterOperations.RECIPE_SCHEMA, parameters: run.recipe, steps: run.activities.map(function (activity) { return { op: activity.operation, id: activity.id, parameters: activity.parameters, used: activity.used, generated: activity.generated }; }) },
      validationChecks: checks,
      measures: { sourceWidth: decoded.width, sourceHeight: decoded.height, operations: run.activities.length, frames: run.retainedFrames ? run.retainedFrames.length : 0, sourcePaletteCount: run.analysis.source_palette_count, outputPaletteCounts: run.analysis.output_palette_counts, duplicateFramePairs: run.analysis.duplicate_frame_pairs.length, sourceSha256: sourceSha, recipeSha256: recipeSha, aiUsed: false, originalPreserved: true },
      notes: ["The imported PNG is emitted byte-for-byte as a separate immutable source copy.", "Every derived output is a candidate linked through explicit deterministic activities; nothing is installed, promoted or canonicalized.", "JPEG/WebP import, semantic masks, artistic abstraction, generative pixels and engine-specific export remain visible gaps."],
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
