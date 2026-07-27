(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../raster-codec") : root.AXMRasterCodec,
    node ? require("../raster-compositor") : root.AXMRasterCompositor,
    node ? require("../optional-wasm-vips")() : root.Vips,
    node ? require("crypto") : null,
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, RasterCodec, Compositor, VipsFactory, NodeCrypto) {
  "use strict";
  if (!RasterCodec || !Compositor) throw new Error("AXM raster codec and compositor are required");

  var runtimePromise = null;
  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error("raster source bytes must be a typed array");
  }
  function utf8(value) {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value), "utf8"));
    return new TextEncoder().encode(String(value));
  }
  async function sha256(bytes) {
    bytes = asBytes(bytes);
    if (NodeCrypto) return NodeCrypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    if (globalThis.crypto && globalThis.crypto.subtle) {
      var result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(result)).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
    }
    throw new Error("SHA-256 runtime is unavailable");
  }
  async function vipsRuntime() {
    if (!runtimePromise) runtimePromise = (async function () {
      if (typeof VipsFactory !== "function") throw new Error("RASTER_DECODER_UNAVAILABLE: pinned wasm-vips is not loaded");
      if (typeof window !== "undefined" && globalThis.crossOriginIsolated !== true)
        throw new Error("RASTER_DECODER_UNAVAILABLE: browser must be cross-origin isolated for wasm-vips");
      var vips = await VipsFactory();
      vips.concurrency(1);
      return { vips: vips, version: [vips.version(0), vips.version(1), vips.version(2)].join(".") };
    })();
    return runtimePromise;
  }
  async function decodePng(item) {
    if (!item || item.mime !== "image/png" || !/^data:image\/png;base64,/i.test(item.dataUrl || ""))
      throw new Error("raster compositor source " + (item && item.id || "(missing)") + " must be a genuine PNG data URL");
    var bytes = RasterCodec.bytesFromDataUrl(item.dataUrl, "image/png"), localError = null;
    try {
      var decoded = RasterCodec.decodeRgba(bytes);
      if (decoded.bitDepth !== 8) throw new Error("16-bit PNG requires a declared bit-depth conversion hand");
      return {
        id: item.id,
        width: decoded.width,
        height: decoded.height,
        rgba: decoded.rgba,
        digest: await sha256(bytes),
        byteLength: bytes.length,
        decoder: { id: "axm-bounded-png", version: RasterCodec.VERSION },
        transformations: [],
      };
    } catch (error) {
      localError = String(error.message || error);
    }
    var runtime = await vipsRuntime(), handles = [], image = null;
    try {
      image = runtime.vips.Image.newFromBuffer(bytes, "");
      handles.push(image);
      if (String(image.format).toLowerCase() !== "uchar")
        throw new Error("only 8-bit PNG sources are accepted; explicit bit-depth conversion is required");
      var converted = image.colourspace("srgb");
      handles.push(converted);
      image = converted;
      if (!image.hasAlpha()) {
        converted = image.addalpha();
        handles.push(converted);
        image = converted;
      }
      if (image.bands > 4) {
        converted = image.extractBand(0, { n: 4 });
        handles.push(converted);
        image = converted;
      }
      if (image.bands !== 4) throw new Error("decoded PNG could not be normalized to RGBA8");
      var memory = asBytes(image.writeToMemory());
      if (memory.length !== image.width * image.height * 4) throw new Error("libvips RGBA memory length mismatch");
      return {
        id: item.id,
        width: image.width,
        height: image.height,
        rgba: new Uint8Array(memory),
        digest: await sha256(bytes),
        byteLength: bytes.length,
        decoder: { id: "libvips-wasm", version: runtime.version },
        transformations: ["decode PNG", "convert tagged source to sRGB", "normalize to RGBA8"],
        boundedDecoderFallback: localError,
      };
    } catch (error) {
      throw new Error("PNG source " + item.id + " is unsupported: " + String(error.message || error) + "; bounded decoder said: " + localError);
    } finally {
      handles.reverse().forEach(function (handle) { try { if (handle && handle.delete) handle.delete(); } catch (error) {} });
    }
  }
  function recipeSource(context) {
    var item = context.sourceArtifacts.find(function (source) { return source.content_schema === Compositor.RECIPE_SCHEMA; });
    if (!item) return null;
    try { return { item: item, value: JSON.parse(item.text) }; }
    catch (error) { throw new Error("raster composition recipe is not valid JSON"); }
  }
  function defaultRecipe(context, pngItems) {
    var canvas = context.targetCanvas, width = Math.round(canvas.dimensions.width), height = Math.round(canvas.dimensions.height);
    var layers = [{ id: "background", name: "Background", visible: true, opacity: 1, blend_mode: "normal", offset: { x: 0, y: 0 }, fill: String(context.palette[0] || "#000000").toUpperCase(), filters: [] }];
    pngItems.forEach(function (item, index) {
      layers.push({ id: "source-" + (index + 1), name: item.name || item.id, visible: true, opacity: 1, blend_mode: "normal", offset: { x: 0, y: 0 }, source_artifact_id: item.id, filters: [] });
    });
    if (!pngItems.length) layers.push({ id: "accent", name: "Accent veil", visible: true, opacity: 0.45, blend_mode: "screen", offset: { x: 0, y: 0 }, fill: String(context.palette[1] || "#29D8F2").toUpperCase() + "80", filters: [{ type: "saturation", value: 1.15 }] });
    return { schema: Compositor.RECIPE_SCHEMA, version: "1.0.0", id: "composition-" + Core.slug(context.brief.id), canvas: { width: width, height: height, colour_space: "srgb", alpha: canvas.colour.transparency !== "opaque" }, layers: layers, global_filters: [], notes: [] };
  }
  function jsonArtifact(id, role, name, filename, value, editable) {
    return { id: id, role: role, name: name, filename: filename, mime: "application/json", format: "JSON", editable: editable, text: JSON.stringify(value, null, 2), metadata: { schema: value.schema } };
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "raster-compositor",
    title: "Bounded Raster Compositor Hand",
    version: "1.0.0",
    category: "raster-composition",
    lifecycle_status: "beta",
    summary: "Composes ordered sRGB RGBA8 PNG layers with alpha or luminance masks, fourteen blend modes and thirteen deterministic filters, while retaining an editable recipe and exact output receipt.",
    purpose: "Provide a real modular raster spine without hiding model dependencies, unsupported effects or visual approval behind a generic editor claim.",
    operation_modes: ["create", "edit", "workflow"],
    canvas_models: ["raster-frame", "node-tree-design", "viewport-2d"],
    entry_surfaces: ["command", "raster-editor", "visual-grammar", "export-recipe"],
    mutability: "transform",
    kinds: ["texture", "background", "sprite", "effect", "illustration", "poster", "cover", "decal", "theme"],
    accepts: [Core.BRIEF_SCHEMA, "image/png", Compositor.RECIPE_SCHEMA],
    produces: [Core.RESULT_SCHEMA, "image/png", "application/json", Compositor.RECIPE_SCHEMA, Compositor.RECEIPT_SCHEMA],
    input_types: [
      { mime: "image/png", format: "PNG", roles: ["source", "layer", "mask"], required_for: [], mutable: false, max_bytes: 16777216 },
      { mime: "application/json", format: "JSON", schema: Compositor.RECIPE_SCHEMA, roles: ["source", "recipe"], required_for: ["edit", "workflow"], mutable: false, max_bytes: 2000000 }
    ],
    output_types: [
      { mime: "image/png", format: "PNG", role: "composited-raster-candidate", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Compositor.RECIPE_SCHEMA, role: "editable-raster-composition", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Compositor.RECEIPT_SCHEMA, role: "raster-composition-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] }
    ],
    canvas_types: [
      { medium: "screen", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["static"], intended_uses: ["texture", "background", "effect", "illustration", "poster", "cover", "decal", "theme"] },
      { medium: "ui", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["static"], intended_uses: ["texture", "background", "effect", "illustration", "decal", "theme"] },
      { medium: "game-world", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed", "opaque"], behaviours: ["static"], intended_uses: ["texture", "background", "sprite", "effect", "illustration", "decal"] }
    ],
    canvas_limits: { min_width: 1, min_height: 1, max_width: 2048, max_height: 2048, max_pixels: 4194304, texture_bytes_per_pixel: 4 },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.static", "performance.max-file-bytes", "performance.max-texture-memory-bytes"],
    editable_recipe_formats: [Core.RECIPE_SCHEMA, Compositor.RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: true },
    emits_editable_source: true,
    supports_edit_operation: true,
    requires: [],
    editable: true,
    deterministic: true,
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "The compositor, PNG codec, hashes and pinned fallback decoder run locally." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM raster compositor", version: Compositor.VERSION, bundled: true }, { name: "wasm-vips", version: "0.0.18", bundled: true }], browserRequirements: ["crossOriginIsolated only when the general PNG fallback decoder is needed"] },
    engine: { name: "AXM deterministic RGBA compositor + PNG codec + pinned libvips decoder", version: Compositor.VERSION, execution: "local-async-bounded" },
    safety_tier: "safe-local",
    authority: "candidate-only",
    implementation_status: "executable",
    portability: {
      interchange_formats: ["image/png", Compositor.RECIPE_SCHEMA, Compositor.RECEIPT_SCHEMA],
      known_losses: ["Tagged 8-bit source PNGs outside sRGB are converted to sRGB by the pinned decoder and the conversion is receipted."],
      unsupported_features: ["arbitrary rotation or resampling", "HDR, wide-gamut, CMYK or ICC output", "GPU or third-party plug-in shaders", "neural or generative effects", "3D, video or animation compositing"],
      fallbacks: ["The bounded AXM PNG decoder is tried first; pinned libvips is used only for ordinary PNG profiles it cannot decode."]
    },
    validation: { checks: ["recipe schema and bounds", "source PNG decode", "source and output SHA-256", "layer and mask references", "blend and filter allowlists", "PNG structural parse", "independent PNG decode", "pixel equality", "file and memory budgets"] },
    evidence: [{ claim: "Source-over alpha compositing and blend functions are applied as an explicit deterministic pixel operation.", source_url: "local:shared/asset-hands/raster-compositor.js", specification_version: Compositor.VERSION, retrieved_at: "2026-07-22" }],
    tests: ["raster-compositor-selftest", "asset-hands-selftest", "schema-contract-selftest"],
    limits: { maxDimension: 2048, maxPixels: 4194304, maxLayers: 32, maxFilters: 64, maxWorkingBytes: 134217728, colourSpace: "sRGB", pixelFormat: "RGBA8", automaticApproval: false }
  };

  async function createAsync(context) {
    var pngItems = context.sourceArtifacts.filter(function (item) { return item.mime === "image/png"; });
    var sourceRecipe = recipeSource(context);
    var recipe = Compositor.normalizeRecipe(sourceRecipe ? sourceRecipe.value : defaultRecipe(context, pngItems));
    if (recipe.canvas.width !== Math.round(context.targetCanvas.dimensions.width) || recipe.canvas.height !== Math.round(context.targetCanvas.dimensions.height))
      throw new Error("raster composition recipe dimensions must equal the target canvas; implicit resampling is refused");
    var decodedEntries = await Promise.all(pngItems.map(decodePng)), decoded = {};
    decodedEntries.forEach(function (item) { decoded[item.id] = item; });
    var composed = Compositor.compose(recipe, decoded);
    var png = RasterCodec.encodeRgba(composed.width, composed.height, composed.rgba, { colourSpace: "srgb" });
    var roundTrip = RasterCodec.decodeRgba(png.bytes), pixelMatch = roundTrip.rgba.length === composed.rgba.length && roundTrip.rgba.every(function (value, index) { return value === composed.rgba[index]; });
    var recipeText = JSON.stringify(composed.recipe, null, 2), outputSha = await sha256(png.bytes), recipeSha = await sha256(utf8(recipeText));
    var receipt = composed.receipt;
    receipt.recipe_digest = "sha256:" + recipeSha;
    receipt.source_artifacts = decodedEntries.map(function (item) { return { id: item.id, mime: "image/png", sha256: item.digest, bytes: item.byteLength, width: item.width, height: item.height, decoder: item.decoder, transformations: item.transformations }; });
    receipt.output.container = "PNG";
    receipt.output.sha256 = outputSha;
    receipt.output.bytes = png.byteLength;
    receipt.checks = [
      { name: "recipe-schema-and-bounds", pass: composed.recipe.schema === Compositor.RECIPE_SCHEMA },
      { name: "source-artifacts-decoded", pass: decodedEntries.length === pngItems.length },
      { name: "png-container", pass: png.inspection.pass, details: png.inspection },
      { name: "independent-png-decode", pass: roundTrip.inspection.pass },
      { name: "decoded-pixels-match-compositor-output", pass: pixelMatch },
      { name: "target-dimensions", pass: png.width === composed.width && png.height === composed.height },
      { name: "texture-memory-budget", pass: context.targetCanvas.performance.max_texture_memory_bytes == null || composed.rgba.length <= context.targetCanvas.performance.max_texture_memory_bytes },
      { name: "file-budget", pass: context.targetCanvas.performance.max_file_bytes == null || png.byteLength + recipeText.length <= context.targetCanvas.performance.max_file_bytes },
      { name: "candidate-only", pass: receipt.authority === "candidate-only" && receipt.visual_approval === false && receipt.canonical === false }
    ];
    receipt.status = receipt.checks.every(function (check) { return check.pass; }) ? "PASS" : "HOLD";
    var slug = Core.slug(context.brief.title), artifacts = [
      { id: "composited-png", role: "composited-raster-candidate", name: context.brief.title + " composited PNG", filename: slug + ".png", mime: "image/png", format: "PNG", width: composed.width, height: composed.height, editable: false, dataUrl: png.dataUrl, metadata: { nativeRaster: true, colourSpace: "srgb", pixelFormat: "RGBA8", sha256: outputSha, byteLength: png.byteLength, visualApproval: false, canonical: false } },
      jsonArtifact("raster-composition", "editable-raster-composition", context.brief.title + " composition", slug + ".raster-composition.json", composed.recipe, true),
      jsonArtifact("raster-composition-receipt", "raster-composition-receipt", context.brief.title + " composition receipt", slug + ".raster-composition-receipt.json", receipt, false)
    ];
    var totalBytes = png.byteLength + artifacts[1].text.length + artifacts[2].text.length;
    return {
      artifacts: artifacts,
      previewArtifactId: "composited-png",
      recipe: { format: Compositor.RECIPE_SCHEMA, parameters: composed.recipe, steps: [{ op: "validate-bounded-srgb-rgba-recipe" }, { op: "decode-and-sha256-bind-source-png-layers" }, { op: "apply-ordered-layer-filter-mask-and-blend-graph" }, { op: "apply-global-filter-chain" }, { op: "encode-and-parse-png" }, { op: "independently-decode-and-compare-pixels" }, { op: "emit-editable-recipe-and-candidate-only-receipt" }] },
      validationChecks: receipt.checks,
      measures: { width: composed.width, height: composed.height, layers: composed.recipe.layers.length, compositedLayers: receipt.measures.layers_composited, filters: receipt.measures.filters_applied, sourceBytes: receipt.measures.source_bytes, workingBytes: receipt.measures.estimated_working_bytes, pngBytes: png.byteLength, totalBytes: totalBytes, blendModes: Compositor.BLEND_MODES.length, filterTypes: Compositor.FILTER_TYPES.length },
      notes: ["Layer order, alpha or luminance masks, blend modes and filters are retained in an editable deterministic recipe.", "The PNG is a technical candidate only; code cannot approve appearance or promote it to canon.", "Neural effects, arbitrary transforms, wide colour, 3D and timeline compositing remain separate optional hands rather than hidden fallbacks."]
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
