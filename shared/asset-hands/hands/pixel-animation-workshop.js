(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../raster-codec") : root.AXMRasterCodec,
    node ? require("../raster-operations-core") : root.AXMRasterOperationsCore,
    node ? require("../pixel-animation-core") : root.AXMPixelAnimationCore,
    node ? require("crypto") : null,
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, RasterCodec, Raster, PixelAnimation, NodeCrypto) {
  "use strict";

  if (!RasterCodec || !Raster || !PixelAnimation) throw new Error("AXM raster codec, raster operations and pixel animation cores are required");

  var PARENT_PACKAGE_SCHEMA = "axm.pixel-asset-package/v1";

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

  function suppliedSha256(value) {
    var match = /^(?:sha256:)?([0-9a-f]{64})$/i.exec(String(value || "").trim());
    return match ? match[1].toLowerCase() : null;
  }

  function stateEqual(left, right) {
    return left.recipe && right.recipe && JSON.stringify(left.recipe) === JSON.stringify(right.recipe) &&
      left.frames.length === right.frames.length && left.frames.every(function (frame, index) {
        return frame.metadata.id === right.frames[index].metadata.id && Raster.imagesEqual(frame.image, right.frames[index].image);
      });
  }

  function jsonArtifact(id, role, name, filename, text, editable, schema, digest) {
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
      text: text,
      metadata: { schema: schema, sha256: digest, candidateOnly: true, canonical: false },
    };
  }

  async function jsonOutput(id, role, name, filename, value, editable, schema) {
    var text = JSON.stringify(value, null, 2);
    var digest = await sha256(utf8(text));
    return {
      artifact: jsonArtifact(id, role, name, filename, text, editable, schema, digest),
      record: { id: id, role: role, mime: "application/json", filename: filename, sha256: digest },
      text: text,
      sha256: digest,
    };
  }

  async function pngOutput(id, role, name, filename, image, metadata) {
    var encoded = RasterCodec.encodeRgba(image.width, image.height, image.rgba, { colourSpace: "srgb" });
    var decoded = RasterCodec.decodeRgba(encoded.bytes);
    var digest = await sha256(encoded.bytes);
    var pixelsPass = decoded.width === image.width && decoded.height === image.height && decoded.rgba.length === image.rgba.length && decoded.rgba.every(function (value, index) { return value === image.rgba[index]; });
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
        dataUrl: encoded.dataUrl,
        metadata: Object.assign({ sha256: digest, pixelFormat: "RGBA8", colourSpace: "sRGB", candidateOnly: true, canonical: false }, metadata || {}),
      },
      record: { id: id, role: role, mime: "image/png", filename: filename, sha256: digest, width: image.width, height: image.height },
      check: { name: "png-pixel-roundtrip:" + id, pass: encoded.inspection.pass && decoded.inspection.pass && pixelsPass },
      bytes: encoded.byteLength,
    };
  }

  async function apngOutput(id, role, name, filename, width, height, frames, plays, metadata) {
    var encoded = RasterCodec.encodeApng(width, height, frames, { fps: 12, plays: plays, colourSpace: "srgb" });
    var digest = await sha256(encoded.bytes);
    var expectedDuration = frames.reduce(function (sum, frame) { return sum + (frame.delay_num / frame.delay_den) * 1000; }, 0);
    var timingPass = encoded.inspection.delays.length === frames.length && Math.abs(encoded.inspection.durationMs - expectedDuration) < 0.0001;
    return {
      artifact: {
        id: id,
        role: role,
        name: name,
        filename: filename,
        mime: "image/apng",
        format: "APNG",
        width: width,
        height: height,
        editable: false,
        dataUrl: encoded.dataUrl,
        metadata: Object.assign({ sha256: digest, frames: frames.length, plays: plays, durationMs: encoded.inspection.durationMs, variableFrameTiming: true, pixelFormat: "RGBA8", colourSpace: "sRGB", candidateOnly: true, canonical: false }, metadata || {}),
      },
      record: { id: id, role: role, mime: "image/apng", filename: filename, sha256: digest, width: width, height: height },
      checks: [
        { name: "apng-structure:" + id, pass: encoded.inspection.pass, details: encoded.inspection },
        { name: "apng-frame-timing:" + id, pass: timingPass, details: { expectedDurationMs: expectedDuration, actualDurationMs: encoded.inspection.durationMs, delays: encoded.inspection.delays } },
      ],
      bytes: encoded.byteLength,
    };
  }

  function parentPackage(sourceItem, recipe, packageItems, sourceSha) {
    if (packageItems.length > 1) throw new Error("pixel animation workshop accepts at most one parent pixel package");
    if (!packageItems.length) {
      if (recipe.provenance.parent_package_id) throw new Error("pixel animation recipe names a parent package that was not supplied");
      return { present: false, id: null, digest_bound: false };
    }
    var value;
    try { value = JSON.parse(packageItems[0].text); }
    catch (error) { throw new Error("parent pixel asset package is not valid JSON"); }
    if (!value || value.schema !== PARENT_PACKAGE_SCHEMA) throw new Error("parent pixel asset package schema mismatch");
    if (recipe.provenance.parent_package_id !== value.id) throw new Error("pixel animation recipe must explicitly bind the supplied parent package id");
    var candidates = [];
    if (value.source && value.source.sha256) candidates.push(value.source.sha256);
    (Array.isArray(value.assets) ? value.assets : []).forEach(function (asset) { if (asset.sha256) candidates.push(asset.sha256); });
    if (candidates.indexOf(sourceSha) < 0) throw new Error("parent pixel package does not contain the supplied animation sheet SHA-256");
    return { present: true, id: value.id, source_artifact_id: sourceItem.id, digest_bound: true };
  }

  function apngFrames(recipe, clip, extractionMap, scale) {
    var metadataMap = new Map(recipe.frames.map(function (frame) { return [frame.id, frame]; }));
    return PixelAnimation.orderedFrameIds(recipe, clip.id).map(function (frameId) {
      var image = extractionMap.get(frameId);
      if (scale > 1) image = Raster.resizeNearest(image, { width: image.width * scale, height: image.height * scale });
      return { rgba: image.rgba, delay_num: metadataMap.get(frameId).duration_ms, delay_den: 1000 };
    });
  }

  function videoSequencePass(sequence) {
    return sequence.sequences.every(function (item) {
      if (!item.segments.length) return false;
      var cursor = 0;
      for (var index = 0; index < item.segments.length; index += 1) {
        var segment = item.segments[index];
        if (segment.start_ms !== cursor || segment.end_ms !== segment.start_ms + segment.duration_ms || !segment.artifact_id || !segment.sha256) return false;
        cursor = segment.end_ms;
      }
      return cursor === item.duration_ms;
    });
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "pixel-animation-workshop",
    title: "Pixel Animation Workshop",
    version: "0.1.0",
    category: "raster-animation",
    lifecycle_status: "experimental",
    summary: "Turns a preserved PNG sprite sheet plus an engine-neutral recipe into timed frame PNGs, variable-delay APNG previews, game clip metadata and a codec-neutral video sequence.",
    purpose: "Provide the modular Sprite/Tile and Animation Intelligence layer above deterministic raster operations without making a game engine, video codec, human or AI the owner of the asset model.",
    operation_modes: ["edit", "workflow"],
    canvas_models: ["raster-frame", "timeline"],
    entry_surfaces: ["command", "sprite-editor", "asset-fabric", "export-recipe"],
    mutability: "transform",
    kinds: ["sprite", "character", "effect", "tile", "animation", "sequence"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, "image/png", PixelAnimation.RECIPE_SCHEMA, PARENT_PACKAGE_SCHEMA],
    produces: [Core.RESULT_SCHEMA, "image/png", "image/apng", "application/json", PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA, PixelAnimation.RECEIPT_SCHEMA],
    input_types: [
      { mime: "image/png", format: "PNG", schema: "", roles: [], required_for: ["edit", "workflow"], mutable: false, max_bytes: 24000000 },
      { mime: "application/json", format: "JSON", schema: PixelAnimation.RECIPE_SCHEMA, roles: [], required_for: ["edit", "workflow"], mutable: false, max_bytes: 2000000 },
      { mime: "application/json", format: "JSON", schema: PARENT_PACKAGE_SCHEMA, roles: [], required_for: [], mutable: false, max_bytes: 2000000 },
    ],
    output_types: [
      { mime: "image/png", format: "PNG", schema: "", role: "immutable-animation-sheet", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/png", format: "PNG", schema: "", role: "pixel-animation-frame", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/apng", format: "APNG", schema: "", role: "pixel-animation-clip", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/apng", format: "APNG", schema: "", role: "integer-scale-animation-preview", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: PixelAnimation.RECIPE_SCHEMA, role: "editable-pixel-animation-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: PixelAnimation.MANIFEST_SCHEMA, role: "engine-neutral-sprite-animation", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: PixelAnimation.VIDEO_SEQUENCE_SCHEMA, role: "codec-neutral-video-frame-sequence", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: PixelAnimation.RECEIPT_SCHEMA, role: "pixel-animation-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] },
    ],
    canvas_types: [
      { medium: "game-world", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["animated"], intended_uses: ["sprite", "character", "effect", "tile", "animation", "sequence"] },
      { medium: "screen", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["animated"], intended_uses: ["sprite", "character", "effect", "animation", "sequence"] },
    ],
    canvas_limits: { min_width: 1, min_height: 1, max_width: 256, max_height: 256, max_pixels: 65536, texture_bytes_per_pixel: 4, min_animation_frames: 2, max_animation_frames: PixelAnimation.MAX_FRAMES },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.animated", "performance.max-file-bytes", "performance.max-texture-memory-bytes", "performance.max-animation-frames", "performance.max-duration-seconds"],
    editable_recipe_formats: [Core.RECIPE_SCHEMA, PixelAnimation.RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: true },
    emits_editable_source: true,
    supports_edit_operation: true,
    requires: [],
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "PNG decode, frame extraction, timing, APNG encoding, hashing and packaging run locally." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM raster operations core", version: Raster.VERSION, bundled: true }, { name: "AXM pixel animation core", version: PixelAnimation.VERSION, bundled: true }, { name: "AXM raster codec", version: RasterCodec.VERSION, bundled: true }], optional_adapters: ["axm.game-animation-graph/v1", PixelAnimation.VIDEO_SEQUENCE_SCHEMA] },
    engine: { name: "AXM pixel animation core + APNG codec", version: PixelAnimation.VERSION, execution: "local-async-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: {
      interchange_formats: ["image/png", "image/apng", PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA],
      known_losses: ["The 8-bit and 16-bit labels are AXM workflow profiles; they do not emulate a specific console, indexed hardware palette or source PNG bit depth."],
      unsupported_features: ["hardware-specific console binary formats", "Tiled or Godot native resource export", "GIF or WebP animation delivery", "audio", "semantic missing-frame invention", "generative frame creation", "sub-pixel interpolation"],
      fallbacks: ["Unsupported engine, semantic and generative behavior remains an explicit adapter gap; frame PNGs and generic JSON remain available."],
    },
    validation: { checks: ["immutable source bytes and SHA-256", "exact grid coverage", "frame/clip reference integrity", "palette limit or exact palette", "duplicate frame policy", "repeat extraction pixel equality", "variable APNG frame timing", "integer nearest preview", "game clip adapter", "codec-neutral video sequence", "candidate-only authority"] },
    rollback: { strategy: "discard-animation-candidates-and-retain-source-sheet" },
    evidence: [{ claim: "The same normalized pixel clips can be sampled directly, adapted to the game animation spine, and compiled to integer-millisecond video frame holds without changing the source frames.", source_url: "local:shared/asset-hands/pixel-animation-core.js", specification_version: PixelAnimation.VERSION, retrieved_at: "2026-08-11" }],
    tests: ["pixel-animation-workshop-selftest", "asset-hands-selftest", "schema-contract-selftest", "html-script-syntax-test"],
    limits: { sourceMime: "image/png", pixelFormat: "RGBA8", colourSpace: "sRGB", maxFrames: PixelAnimation.MAX_FRAMES, maxClips: PixelAnimation.MAX_CLIPS, maxApngFramesPerClip: PixelAnimation.MAX_APNG_FRAMES, automaticApproval: false, aiGeneration: false },
  };

  async function createAsync(context) {
    var pngItems = context.sourceArtifacts.filter(function (item) { return item.mime === "image/png"; });
    var recipeItems = context.sourceArtifacts.filter(function (item) { return item.content_schema === PixelAnimation.RECIPE_SCHEMA; });
    var packageItems = context.sourceArtifacts.filter(function (item) { return item.content_schema === PARENT_PACKAGE_SCHEMA; });
    if (pngItems.length !== 1) throw new Error("pixel animation workshop requires exactly one PNG sprite-sheet source");
    if (recipeItems.length !== 1) throw new Error("pixel animation workshop requires exactly one pixel animation recipe");

    var source = pngItems[0];
    var sourceBytes = RasterCodec.bytesFromDataUrl(source.dataUrl, "image/png");
    var decoded = RasterCodec.decodeRgba(sourceBytes);
    if (decoded.bitDepth !== 8) throw new Error("pixel animation workshop uses RGBA8 storage; 16-bit is a workflow profile, not a 16-bit PNG input claim");
    var sourceSha = await sha256(sourceBytes);
    var claimedSha = suppliedSha256(source.digest);
    if (claimedSha && claimedSha !== sourceSha) throw new Error("animation sheet SHA-256 does not match the supplied digest");
    var rawRecipe;
    try { rawRecipe = JSON.parse(recipeItems[0].text); }
    catch (error) { throw new Error("pixel animation recipe is not valid JSON"); }
    if (rawRecipe.source_artifact_id !== source.id) throw new Error("pixel animation recipe must bind the exact PNG source artifact id");

    var sheetImage = Raster.makeImage(decoded.width, decoded.height, decoded.rgba);
    var extraction = PixelAnimation.extractFrames(sheetImage, rawRecipe);
    var recipe = extraction.recipe;
    var repeated = PixelAnimation.extractFrames(sheetImage, recipe);
    var repeatPass = stateEqual(extraction, repeated);
    var analysis = PixelAnimation.inspectFrames(extraction);
    var parent = parentPackage(source, recipe, packageItems, sourceSha);
    var slug = Core.slug(context.brief.title);
    var artifacts = [], records = [], checks = [], binaryBytes = sourceBytes.length;

    artifacts.push({
      id: "immutable-animation-sheet",
      role: "immutable-animation-sheet",
      name: context.brief.title + " immutable animation sheet",
      filename: slug + "-source-sheet.png",
      mime: "image/png",
      format: "PNG",
      width: decoded.width,
      height: decoded.height,
      editable: false,
      dataUrl: source.dataUrl,
      metadata: { sha256: sourceSha, sourceArtifactId: source.id, suppliedDigest: source.digest, immutable: true, parentPackageId: parent.id, candidateOnly: true, canonical: false },
    });
    records.push({ id: "immutable-animation-sheet", role: "immutable-animation-sheet", mime: "image/png", filename: slug + "-source-sheet.png", sha256: sourceSha, width: decoded.width, height: decoded.height });

    var extractionMap = new Map();
    var frameArtifacts = {};
    for (var frameIndex = 0; frameIndex < extraction.frames.length; frameIndex += 1) {
      var extracted = extraction.frames[frameIndex];
      var frame = extracted.metadata;
      extractionMap.set(frame.id, extracted.image);
      var frameArtifactId = "animation-frame-" + frame.id;
      var frameFilename = slug + "-" + frame.id + ".png";
      var output = await pngOutput(frameArtifactId, "pixel-animation-frame", context.brief.title + " " + frame.animation + " " + frame.direction + " frame " + frame.index, frameFilename, extracted.image, {
        frameId: frame.id,
        assetId: frame.asset_id,
        animation: frame.animation,
        direction: frame.direction,
        index: frame.index,
        durationMs: frame.duration_ms,
        atlas: frame.atlas,
        bounds: frame.bounds,
        pivot: frame.pivot,
        tags: frame.tags,
        events: frame.events,
      });
      artifacts.push(output.artifact);
      records.push(output.record);
      checks.push(output.check);
      binaryBytes += output.bytes;
      frameArtifacts[frame.id] = { artifact_id: frameArtifactId, filename: frameFilename, sha256: output.record.sha256 };
    }

    var clipDeliveries = [];
    var previewArtifactId = null;
    for (var clipIndex = 0; clipIndex < recipe.clips.length; clipIndex += 1) {
      var clip = recipe.clips[clipIndex];
      if (PixelAnimation.orderedFrameIds(recipe, clip.id).length > PixelAnimation.MAX_APNG_FRAMES) throw new Error("clip " + clip.id + " exceeds the bounded APNG delivery frame count");
      var plays = clip.playback.mode === "once" ? 1 : clip.playback.repeat_count;
      var nativeFrames = apngFrames(recipe, clip, extractionMap, 1);
      var nativeId = "animation-clip-" + clip.id;
      var nativeFilename = slug + "-" + clip.id + ".apng";
      var nativeOutput = await apngOutput(nativeId, "pixel-animation-clip", context.brief.title + " " + clip.runtime_name, nativeFilename, recipe.sheet.cell_width, recipe.sheet.cell_height, nativeFrames, plays, { clipId: clip.id, runtimeName: clip.runtime_name, animation: clip.animation, direction: clip.direction, playback: clip.playback, nativeScale: 1 });
      artifacts.push(nativeOutput.artifact);
      records.push(nativeOutput.record);
      checks = checks.concat(nativeOutput.checks);
      binaryBytes += nativeOutput.bytes;
      var clipRecord = { id: clip.id, runtime_name: clip.runtime_name, animation: clip.animation, direction: clip.direction, frame_ids: clip.frame_ids.slice(), playback: clip.playback, duration_ms: clip.duration_ms, apng_artifact_id: nativeId, preview_artifact_id: nativeId };

      if (recipe.preview.emit_integer_preview && recipe.preview.integer_scale > 1) {
        var scale = recipe.preview.integer_scale;
        var previewFrames = apngFrames(recipe, clip, extractionMap, scale);
        var scaledId = "animation-preview-" + clip.id;
        var scaledFilename = slug + "-" + clip.id + "-preview-" + scale + "x.apng";
        var previewOutput = await apngOutput(scaledId, "integer-scale-animation-preview", context.brief.title + " " + clip.runtime_name + " " + scale + "x preview", scaledFilename, recipe.sheet.cell_width * scale, recipe.sheet.cell_height * scale, previewFrames, plays, { clipId: clip.id, runtimeName: clip.runtime_name, integerScale: scale, nearestNeighbour: true, background: recipe.preview.background });
        artifacts.push(previewOutput.artifact);
        records.push(previewOutput.record);
        checks = checks.concat(previewOutput.checks);
        binaryBytes += previewOutput.bytes;
        clipRecord.preview_artifact_id = scaledId;
      }
      if (!previewArtifactId) previewArtifactId = clipRecord.preview_artifact_id;
      clipDeliveries.push(clipRecord);
    }

    var recipeText = JSON.stringify(recipe, null, 2);
    var recipeSha = await sha256(utf8(recipeText));
    var manifestId = "sprite-animation-" + sourceSha.slice(0, 12) + "-" + recipe.id;
    var videoSequence = PixelAnimation.compileVideoSequence(recipe, frameArtifacts, manifestId);
    var videoArtifactId = "pixel-video-sequence";
    var gameClips = PixelAnimation.toGameAnimationClips(recipe);
    var manifest = {
      schema: PixelAnimation.MANIFEST_SCHEMA,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: manifestId,
      identity_id: recipe.identity_id,
      representation_profile_id: recipe.representation_profile_id,
      profile: recipe.profile,
      source: { artifact_id: source.id, sha256: sourceSha, mime: "image/png", width: decoded.width, height: decoded.height, immutable: true, parent_package_id: parent.id },
      sheet: recipe.sheet,
      frames: recipe.frames.map(function (frame) {
        return Object.assign({}, frame, frameArtifacts[frame.id]);
      }),
      clips: clipDeliveries,
      palette: Object.assign({}, recipe.palette, { analysis: analysis }),
      deliveries: records.map(function (record) { return { artifact_id: record.id, role: record.role, mime: record.mime, filename: record.filename, sha256: record.sha256 }; }),
      game_adapter: { contract: "axm.game-animation-graph/v1", clips: gameClips, sampler: "AXMPixelAnimationCore.sampleGameAnimationFrame" },
      video_adapter: { contract: PixelAnimation.VIDEO_SEQUENCE_SCHEMA, artifact_id: videoArtifactId },
      provenance: { recipe_id: recipe.id, recipe_sha256: recipeSha, engine: { id: "axm-pixel-animation-core", version: PixelAnimation.VERSION, deterministic: true, offline: true }, author: recipe.provenance, ai_used: recipe.provenance.ai_used },
      authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true },
    };

    var recipeOutput = await jsonOutput("pixel-animation-recipe", "editable-pixel-animation-recipe", context.brief.title + " pixel animation recipe", slug + "-animation-recipe.json", recipe, true, PixelAnimation.RECIPE_SCHEMA);
    var manifestOutput = await jsonOutput("sprite-animation-manifest", "engine-neutral-sprite-animation", context.brief.title + " sprite animation manifest", slug + "-sprite-animation.json", manifest, false, PixelAnimation.MANIFEST_SCHEMA);
    var videoOutput = await jsonOutput(videoArtifactId, "codec-neutral-video-frame-sequence", context.brief.title + " video frame sequence", slug + "-video-sequence.json", videoSequence, false, PixelAnimation.VIDEO_SEQUENCE_SCHEMA);
    [recipeOutput, manifestOutput, videoOutput].forEach(function (output) {
      artifacts.push(output.artifact);
      records.push(output.record);
    });

    var targetWidth = Math.round(context.targetCanvas.dimensions.width);
    var targetHeight = Math.round(context.targetCanvas.dimensions.height);
    var maxDuration = context.targetCanvas.performance.max_duration_seconds;
    var checksAtFront = [
      { name: "source-png-decoded", pass: decoded.inspection.pass },
      { name: "source-sha256-verified", pass: !claimedSha || claimedSha === sourceSha },
      { name: "source-copy-byte-identical", pass: artifacts[0].dataUrl === source.dataUrl },
      { name: "recipe-source-bound", pass: recipe.source_artifact_id === source.id },
      { name: "optional-identity-profile-binding", pass: (!recipe.identity_id && !recipe.representation_profile_id) || (!!recipe.identity_id && !!recipe.representation_profile_id), details: { identityId: recipe.identity_id, representationProfileId: recipe.representation_profile_id } },
      { name: "optional-parent-package-bound", pass: !parent.present || parent.digest_bound, details: parent },
      { name: "workflow-profile-not-hardware-claim", pass: recipe.profile.interpretation === "workflow-preset-not-hardware-emulation" && recipe.profile.pixel_format === "RGBA8" },
      { name: "exact-grid-coverage", pass: recipe.sheet.source_width === decoded.width && recipe.sheet.source_height === decoded.height },
      { name: "repeat-extraction-pixel-equality", pass: repeatPass },
      { name: "target-frame-dimensions", pass: targetWidth === recipe.sheet.cell_width && targetHeight === recipe.sheet.cell_height, details: { target: [targetWidth, targetHeight], frame: [recipe.sheet.cell_width, recipe.sheet.cell_height] } },
      { name: "palette-limit", pass: analysis.palette_limit_pass, details: { maximum: recipe.palette.max_colours, actual: analysis.asset_palette_count } },
      { name: "exact-palette", pass: analysis.exact_palette_pass, details: { enforcement: recipe.palette.enforcement, offPalette: analysis.off_palette_colours } },
      { name: "duplicate-frame-policy", pass: analysis.duplicate_policy_pass, details: { reject: recipe.validation.reject_duplicate_frames, duplicates: analysis.duplicate_frame_pairs } },
      { name: "game-animation-adapter", pass: gameClips.length === recipe.clips.length && gameClips.every(function (clip) { return clip.duration_ms > 0 && clip.source_contract === PixelAnimation.MANIFEST_SCHEMA; }) },
      { name: "video-sequence-timing-and-artifact-binding", pass: videoSequencePass(videoSequence) },
      { name: "ai-and-author-provenance-visible", pass: typeof recipe.provenance.ai_used === "boolean" && !!recipe.provenance.author_type },
      { name: "frame-budget", pass: context.targetCanvas.performance.max_animation_frames == null || recipe.frames.length <= context.targetCanvas.performance.max_animation_frames },
      { name: "duration-budget", pass: maxDuration == null || recipe.clips.every(function (clip) { return clip.duration_ms / 1000 <= maxDuration; }) },
      { name: "texture-memory-budget", pass: context.targetCanvas.performance.max_texture_memory_bytes == null || decoded.rgba.length <= context.targetCanvas.performance.max_texture_memory_bytes },
      { name: "candidate-only-authority", pass: recipe.authority === "candidate-only" && manifest.authority.installed === false && manifest.authority.promoted === false && manifest.authority.canonical === false },
    ];
    checks = checksAtFront.concat(checks);

    var jsonBytesBeforeReceipt = recipeOutput.text.length + manifestOutput.text.length + videoOutput.text.length;
    checks.push({ name: "declared-output-budget-before-receipt", pass: context.targetCanvas.performance.max_file_bytes == null || binaryBytes + jsonBytesBeforeReceipt <= context.targetCanvas.performance.max_file_bytes, details: { bytes: binaryBytes + jsonBytesBeforeReceipt, excludesReceipt: true } });
    var measures = {
      sourceWidth: decoded.width,
      sourceHeight: decoded.height,
      frameWidth: recipe.sheet.cell_width,
      frameHeight: recipe.sheet.cell_height,
      frames: recipe.frames.length,
      clips: recipe.clips.length,
      profile: recipe.profile.id,
      paletteColours: analysis.asset_palette_count,
      duplicateFramePairs: analysis.duplicate_frame_pairs.length,
      previewScale: recipe.preview.integer_scale,
      videoSequences: videoSequence.sequences.length,
      sourceSha256: sourceSha,
      recipeSha256: recipeSha,
      aiUsed: recipe.provenance.ai_used,
      originalPreserved: true,
    };
    var receipt = {
      schema: PixelAnimation.RECEIPT_SCHEMA,
      version: "1.0.0",
      status: checks.every(function (check) { return check.pass; }) ? "PASS" : "HOLD",
      source: manifest.source,
      recipe: { schema: PixelAnimation.RECIPE_SCHEMA, id: recipe.id, sha256: recipeSha, artifact_id: recipeOutput.record.id },
      profile: recipe.profile,
      outputs: records.slice(),
      checks: checks,
      measures: measures,
      limits: { max_frames: PixelAnimation.MAX_FRAMES, max_clips: PixelAnimation.MAX_CLIPS, max_apng_frames_per_clip: PixelAnimation.MAX_APNG_FRAMES, source_mime: "image/png", pixel_format: "RGBA8", colour_space: "sRGB", hardware_emulation: false, generative_frames: false, automatic_approval: false },
      authority: "candidate-only",
    };
    var receiptOutput = await jsonOutput("pixel-animation-receipt", "pixel-animation-receipt", context.brief.title + " pixel animation receipt", slug + "-animation-receipt.json", receipt, false, PixelAnimation.RECEIPT_SCHEMA);
    artifacts.push(receiptOutput.artifact);

    return {
      artifacts: artifacts,
      previewArtifactId: previewArtifactId || "immutable-animation-sheet",
      recipe: { format: PixelAnimation.RECIPE_SCHEMA, parameters: recipe, steps: [{ op: "preserve-source-sheet" }, { op: "normalize-profile-grid-frames-clips-and-provenance" }, { op: "extract-cell-frames" }, { op: "validate-palette-duplicates-and-timing" }, { op: "encode-variable-delay-apng-clips" }, { op: "render-nearest-neighbour-integer-previews" }, { op: "compile-game-animation-clip-adapter" }, { op: "compile-codec-neutral-video-sequences" }, { op: "emit-sha256-bound-candidate-package" }] },
      validationChecks: checks,
      measures: measures,
      notes: ["pixel-8bit and pixel-16bit are explicit AXM workflow profiles over RGBA8 sRGB pixels, not claims of universal retro hardware fidelity.", "Game state graphs can consume the emitted semantic clip list while AXMPixelAnimationCore selects the discrete frame for each state time.", "The video sequence preserves frame artifacts and integer millisecond holds; a later video adapter must still decode, composite and encode those frames.", "All outputs remain EXPERIMENTAL candidates; no AI, human or deterministic program can install, promote or canonize them through this hand."],
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
