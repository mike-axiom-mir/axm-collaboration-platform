(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node
      ? require("../../deterministic-animation-fabric")
      : root.AXMDeterministicAnimationFabric,
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (Core, Motion) {
    "use strict";
    if (!Core) throw new Error("AXM Asset Hand Core is required");
    if (!Motion) throw new Error("AXM Deterministic Animation Fabric is required");

    function parseSource(context) {
      var candidates = (context.sourceArtifacts || []).filter(function (artifact) {
        return artifact.content_schema === Motion.RECIPE_SCHEMA ||
          artifact.content_schema === Motion.COMPOSITION_SCHEMA ||
          artifact.mime === "application/json" && artifact.text;
      });
      for (var index = 0; index < candidates.length; index += 1) {
        try {
          var parsed = JSON.parse(candidates[index].text);
          if (parsed && (parsed.schema === Motion.RECIPE_SCHEMA || parsed.schema === Motion.COMPOSITION_SCHEMA))
            return { schema: parsed.schema, value: parsed };
        } catch (error) {}
      }
      if (context.operationMode === "edit")
        throw new Error("deterministic animation edit requires a recipe or composition source artifact");
      return null;
    }

    function generatedComposition(context) {
      var canvas = context.targetCanvas;
      var fps = canvas.performance.frames_per_second || 30;
      var durationFrames = Math.max(2, Math.round(fps * 2));
      if (canvas.performance.max_duration_seconds != null)
        durationFrames = Math.min(durationFrames, Math.max(2, Math.floor(canvas.performance.max_duration_seconds * fps)));
      if (canvas.performance.max_animation_frames != null)
        durationFrames = Math.min(durationFrames, Math.max(2, canvas.performance.max_animation_frames));
      var seed = String(context.seed || Core.hash([context.brief.id, context.brief.title]));
      var shapes = ["diamond", "circle", "square"];
      return Motion.createCandidateComposition({
        id: Core.slug(context.brief.title) + "-motion",
        seed: seed,
        frames_per_second: fps,
        frame_count: durationFrames,
        width: context.brief.canvas.width,
        height: context.brief.canvas.height,
        shape: shapes[parseInt(Core.hash(seed), 16) % shapes.length],
        palette: context.palette,
      });
    }

    function byteLength(value) {
      if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
      return typeof Buffer !== "undefined" ? Buffer.byteLength(value, "utf8") : unescape(encodeURIComponent(value)).length;
    }

    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "deterministic-animation-fabric",
        title: "Deterministic Animation Fabric Hand",
        version: "1.1.0",
        category: "animation",
        lifecycle_status: "beta",
        summary: "Composes reusable motion clips through rational time domains and ordered fixed-point blends, then emits editable sources, an exact bake, CSS, SVG proof and bounded sprite-atlas assets.",
        operation_modes: ["create", "edit", "workflow"],
        canvas_models: ["timeline", "viewport-2d"],
        entry_surfaces: ["asset-fabric", "export-recipe"],
        mutability: "transform",
        kinds: ["procedural-animation"],
        accepts: [Core.BRIEF_SCHEMA, Motion.RECIPE_SCHEMA, Motion.COMPOSITION_SCHEMA],
        produces: [
          Core.RESULT_SCHEMA,
          Motion.RECIPE_SCHEMA,
          Motion.COMPOSITION_SCHEMA,
          Motion.BAKE_SCHEMA,
          Motion.RECEIPT_SCHEMA,
          "axm.sprite-atlas/v1",
          "application/json",
          "text/css",
          "image/svg+xml",
        ],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: Motion.RECIPE_SCHEMA,
            roles: ["source", "recipe"],
            required_for: ["edit"],
            mutable: false,
            max_bytes: 2000000,
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: Motion.COMPOSITION_SCHEMA,
            roles: ["source", "composition"],
            required_for: ["edit"],
            mutable: false,
            max_bytes: 4000000,
          },
        ],
        output_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: Motion.COMPOSITION_SCHEMA,
            role: "editable-motion-composition",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: ["embedded source events are not implicitly time-remapped; composition events are explicit"],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: Motion.RECIPE_SCHEMA,
            role: "editable-motion-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: Motion.BAKE_SCHEMA,
            role: "fixed-point-motion-bake",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: Motion.RECEIPT_SCHEMA,
            role: "technical-verification",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "text/css",
            format: "CSS",
            role: "web-motion-adapter",
            editable: true,
            deterministic: true,
            lossy: true,
            known_losses: ["only transform x/y/scale/rotation and opacity tracks map to CSS"],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "motion-filmstrip-proof",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: ["filmstrip samples at most sixteen frames and is not final animated appearance"],
          },
          {
            mime: "image/svg+xml",
            format: "SVG Sprite Atlas",
            role: "motion-sprite-atlas-image",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: ["generic presentation geometry only; atlas output is bounded to 256 frames and 16777216 logical pixels"],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.sprite-atlas/v1",
            role: "motion-sprite-atlas-manifest",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
        ],
        canvas_types: [
          {
            medium: "screen",
            units: ["px"],
            colour_spaces: ["srgb", "display-p3"],
            transparency_modes: ["opaque", "allowed", "required"],
            behaviours: ["animated"],
            intended_uses: ["procedural-animation", "animation", "motion", "effect"],
          },
          {
            medium: "ui",
            units: ["px"],
            colour_spaces: ["srgb", "display-p3"],
            transparency_modes: ["opaque", "allowed", "required"],
            behaviours: ["animated"],
            intended_uses: ["procedural-animation", "animation", "motion", "effect"],
          },
          {
            medium: "game-world",
            units: ["px", "game-world-unit"],
            colour_spaces: ["srgb", "linear-srgb"],
            transparency_modes: ["opaque", "allowed", "required"],
            behaviours: ["animated"],
            intended_uses: ["procedural-animation", "animation", "motion", "effect"],
          },
        ],
        canvas_limits: {
          min_width: 1,
          min_height: 1,
          max_width: 8192,
          max_height: 8192,
          min_animation_frames: 2,
          max_animation_frames: 20000,
          min_fps: 1,
          max_fps: 240,
        },
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.animated",
          "performance.max-file-bytes",
          "performance.max-animation-frames",
          "performance.frames-per-second",
          "performance.max-duration-seconds",
        ],
        editable_recipe_formats: [Core.RECIPE_SCHEMA, Motion.RECIPE_SCHEMA, Motion.COMPOSITION_SCHEMA],
        operations: { preview: true, validate: true, edit: true },
        emits_editable_source: true,
        supports_edit_operation: true,
        requires: [],
        editable: true,
        deterministic: true,
        required_permissions: { local_file_system: "none", network_domains: [] },
        network_policy: { mode: "none", domains: [] },
        host_compatibility: {
          dependencies: [{ id: "deterministic-animation-fabric", version: Motion.ENGINE_VERSION }],
        },
        engine: {
          name: "AXM fixed-tick modular animation fabric",
          version: Motion.ENGINE_VERSION,
          execution: "same-thread-bounded",
        },
        safety_tier: "safe-local",
        portability: {
          interchange_formats: [Motion.RECIPE_SCHEMA, Motion.COMPOSITION_SCHEMA, Motion.BAKE_SCHEMA, "axm.sprite-atlas/v1", "CSS Keyframes", "SVG"],
          known_losses: ["CSS, filmstrip and sprite-atlas SVG are delivery views; the composition, recipes and integer bake remain authoritative candidate sources", "source clip events require explicit composition events"],
          unsupported_features: ["final video encoding", "rig deformation", "renderer parity", "automatic runtime installation"],
          fallbacks: [],
        },
        validation: {
          checks: ["acyclic source graphs", "bounded composition sources and layers", "rational time mapping", "ordered fixed-point blending", "integer timebase", "repeat bake", "atlas boundary", "frame budget", "file budget", "authority gate"],
        },
        rollback: { strategy: "discard-candidate" },
        evidence: [
          {
            claim: "Repeated and cross-process fixed-tick bakes reproduce the fixture digest.",
            source_url: "local:shared/deterministic-animation-fabric/selftest.js",
            specification_version: Motion.VERSION,
          },
        ],
        tests: ["deterministic-animation-fabric-selftest", "asset-hand-deterministic-animation-fabric-selftest"],
        implementation_priority: "high",
        limits: {
          maximumBakedFrames: 20000,
          maximumCompositionSources: Motion.MAX_COMPOSITION_SOURCES,
          maximumCompositionLayers: Motion.MAX_COMPOSITION_LAYERS,
          maximumAtlasFrames: Motion.MAX_ATLAS_FRAMES,
          maximumAtlasLogicalPixels: 16777216,
          integerFramesPerSecondOnly: true,
          finalMediaEncoding: false,
          automaticPromotion: false,
          humanVisualReviewRequired: true,
        },
      },

      create: function (context) {
        var source = parseSource(context);
        var composition = !source
          ? generatedComposition(context)
          : source.schema === Motion.COMPOSITION_SCHEMA
            ? source.value
            : Motion.wrapRecipeAsComposition(source.value, { id: source.value.id + "-composition" });
        var compiled = Motion.compileComposition(composition);
        var bake = Motion.bakeComposition(compiled);
        var receipt = Motion.verifyComposition(composition);
        var primarySourceId = compiled.layers[0].source;
        var primarySource = compiled.sources.find(function (item) { return item.id === primarySourceId; });
        var primary = primarySource.compiled;
        var presentation = Object.assign({}, compiled.presentation || {}, {
          target: compiled.presentation && compiled.presentation.target || compiled.tracks[0].target,
          background: compiled.presentation && compiled.presentation.background || context.palette[0],
          fill: compiled.presentation && compiled.presentation.fill || context.palette[1],
          stroke: compiled.presentation && compiled.presentation.stroke || context.palette[2],
        });
        var css = Motion.renderCssKeyframes(bake);
        var svg = Motion.renderFilmstripSvg(bake, presentation);
        var compositionText = JSON.stringify(compiled.canonical_composition, null, 2);
        var recipeText = JSON.stringify(primary.canonical_recipe, null, 2);
        var bakeText = JSON.stringify(bake, null, 2);
        var receiptText = JSON.stringify(receipt, null, 2);
        var maxFrames = context.targetCanvas.performance.max_animation_frames;
        var maxDuration = context.targetCanvas.performance.max_duration_seconds;
        var requestedFps = context.targetCanvas.performance.frames_per_second;
        var maxBytes = context.targetCanvas.performance.max_file_bytes;
        var atlasRequired = (context.brief.required_outputs || []).indexOf("axm.sprite-atlas/v1") >= 0;
        var slug = Core.slug(context.brief.title);
        var frameWidth = Math.round(context.targetCanvas.dimensions.width);
        var frameHeight = Math.round(context.targetCanvas.dimensions.height);
        var atlasEligible = context.targetCanvas.dimensions.unit === "px" &&
          bake.frames.length <= Motion.MAX_ATLAS_FRAMES &&
          frameWidth >= 1 && frameWidth <= 1024 &&
          frameHeight >= 1 && frameHeight <= 1024 &&
          frameWidth * frameHeight * bake.frames.length <= 16777216;
        var atlasSvg = null;
        var atlasManifest = null;
        var atlasManifestText = null;
        var atlasFilename = slug + "-motion-atlas.svg";
        if (atlasEligible) {
          var atlasOptions = Object.assign({}, presentation, {
            frame_width: frameWidth,
            frame_height: frameHeight,
          });
          atlasSvg = Motion.renderSpriteAtlasSvg(bake, atlasOptions);
          atlasManifest = Motion.createSpriteAtlasManifest(bake, {
            name: context.brief.title,
            image: atlasFilename,
            frame_width: frameWidth,
            frame_height: frameHeight,
          });
          atlasManifestText = JSON.stringify(atlasManifest, null, 2);
        }
        var artifacts = [
          {
            id: "deterministic-motion-composition",
            role: "editable-motion-composition",
            name: context.brief.title + " deterministic motion composition",
            filename: slug + ".motion-composition.json",
            mime: "application/json",
            format: "JSON",
            content_schema: Motion.COMPOSITION_SCHEMA,
            editable: true,
            text: compositionText,
            metadata: { schema: Motion.COMPOSITION_SCHEMA, digest: compiled.composition_digest, sources: compiled.sources.length, layers: compiled.layers.length },
          },
          {
            id: "deterministic-motion-recipe",
            role: "editable-motion-recipe",
            name: context.brief.title + " primary deterministic motion recipe",
            filename: slug + ".motion-recipe.json",
            mime: "application/json",
            format: "JSON",
            content_schema: Motion.RECIPE_SCHEMA,
            editable: true,
            text: recipeText,
            metadata: { schema: Motion.RECIPE_SCHEMA, digest: primary.recipe_digest, composition_source: primarySource.id },
          },
          {
            id: "deterministic-motion-bake",
            role: "fixed-point-motion-bake",
            name: context.brief.title + " fixed-point motion bake",
            filename: slug + ".motion-bake.json",
            mime: "application/json",
            format: "JSON",
            content_schema: Motion.BAKE_SCHEMA,
            editable: false,
            text: bakeText,
            metadata: { schema: Motion.BAKE_SCHEMA, digest: bake.digest, precision: Motion.PRECISION, composition_digest: compiled.composition_digest },
          },
          {
            id: "deterministic-motion-css",
            role: "web-motion-adapter",
            name: context.brief.title + " CSS keyframes",
            filename: slug + ".motion.css",
            mime: "text/css",
            format: "CSS",
            editable: true,
            text: css,
            metadata: { source_bake_digest: bake.digest, lossy: true },
          },
          {
            id: "deterministic-motion-filmstrip",
            role: "motion-filmstrip-proof",
            name: context.brief.title + " motion filmstrip",
            filename: slug + "-motion-filmstrip.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: Math.min(576, context.brief.canvas.width * 4),
            height: Math.min(528, context.brief.canvas.height * 4),
            metadata: { source_bake_digest: bake.digest, static_proof_only: true },
          },
          {
            id: "deterministic-motion-verification",
            role: "technical-verification",
            name: context.brief.title + " motion verification",
            filename: slug + ".motion-verification.json",
            mime: "application/json",
            format: "JSON",
            content_schema: Motion.RECEIPT_SCHEMA,
            editable: false,
            text: receiptText,
            metadata: { schema: Motion.RECEIPT_SCHEMA, status: receipt.status },
          },
        ];
        if (atlasEligible) {
          var atlasWidth = atlasManifest.frames.reduce(function (maximum, frame) { return Math.max(maximum, frame.x + frame.width); }, 0);
          var atlasHeight = atlasManifest.frames.reduce(function (maximum, frame) { return Math.max(maximum, frame.y + frame.height); }, 0);
          artifacts.splice(4, 0,
            {
              id: "deterministic-motion-atlas-image",
              role: "motion-sprite-atlas-image",
              name: context.brief.title + " deterministic SVG sprite atlas",
              filename: atlasFilename,
              mime: "image/svg+xml",
              format: "SVG",
              editable: false,
              text: atlasSvg,
              width: atlasWidth,
              height: atlasHeight,
              metadata: { source_bake_digest: bake.digest, frames: bake.frames.length, exact_frame_coverage: true },
            },
            {
              id: "deterministic-motion-atlas-manifest",
              role: "motion-sprite-atlas-manifest",
              name: context.brief.title + " sprite atlas manifest",
              filename: slug + ".sprite-atlas.json",
              mime: "application/json",
              format: "JSON",
              content_schema: "axm.sprite-atlas/v1",
              editable: false,
              text: atlasManifestText,
              metadata: { schema: "axm.sprite-atlas/v1", source_bake_digest: bake.digest },
            },
          );
        }
        var totalBytes = artifacts.reduce(function (sum, artifact) {
          return sum + byteLength(artifact.text || "");
        }, 0);
        return {
          artifacts: artifacts,
          previewArtifactId: "deterministic-motion-filmstrip",
          recipe: {
            format: Motion.COMPOSITION_SCHEMA,
            parameters: {
              operation: context.operationMode,
              sourceRecipeUsed: !!source,
              sourceSchema: source ? source.schema : null,
              compositionDigest: compiled.composition_digest,
              recipeDigest: primary.recipe_digest,
              bakeDigest: bake.digest,
              ticksPerSecond: compiled.timebase.ticks_per_second,
              framesPerSecond: compiled.timebase.frames_per_second,
              frameCount: bake.frames.length,
              fixedPointPrecision: Motion.PRECISION,
              compositionSources: compiled.sources.length,
              compositionLayers: compiled.layers.length,
              spriteAtlasEmitted: atlasEligible,
            },
            steps: [
              { op: "validate-and-expand-data-only-blocks" },
              { op: "topologically-order-motion-dag" },
              { op: "map-rational-layer-time-domains" },
              { op: "apply-ordered-fixed-point-layer-blends" },
              { op: "bake-exact-integer-ticks-and-fixed-point-values" },
              { op: "repeat-bake-and-compare-digest" },
              { op: "derive-css-adapter" },
              { op: "emit-bounded-svg-sprite-atlas-and-manifest" },
              { op: "render-static-svg-filmstrip-proof" },
            ],
          },
          validationChecks: [
            { name: "deterministic-core-verification", pass: receipt.status === "PASS", details: receipt.summary },
            { name: "frame-budget", pass: maxFrames == null || bake.frames.length <= maxFrames, details: { requested_maximum: maxFrames, actual: bake.frames.length } },
            { name: "frame-rate", pass: requestedFps == null || compiled.timebase.frames_per_second === requestedFps, details: { requested: requestedFps, actual: compiled.timebase.frames_per_second } },
            { name: "duration-budget", pass: maxDuration == null || compiled.timebase.duration_seconds <= maxDuration, details: { requested_maximum_seconds: maxDuration, actual_seconds: compiled.timebase.duration_seconds } },
            { name: "sprite-atlas-boundary", pass: atlasEligible || !atlasRequired, details: { required: atlasRequired, emitted: atlasEligible, maximum_frames: Motion.MAX_ATLAS_FRAMES, maximum_logical_pixels: 16777216, unit: context.targetCanvas.dimensions.unit } },
            { name: "file-budget", pass: maxBytes == null || totalBytes <= maxBytes, details: { requested_maximum_bytes: maxBytes, actual_bytes: totalBytes } },
            { name: "candidate-authority", pass: compiled.canonical_composition.authority.canonical === false && compiled.canonical_composition.authority.promoted === false, details: compiled.canonical_composition.authority },
          ],
          measures: {
            nodes: compiled.sources.reduce(function (sum, item) { return sum + item.compiled.nodes.length; }, 0),
            sources: compiled.sources.length,
            layers: compiled.layers.length,
            tracks: compiled.tracks.length,
            events: compiled.events.length,
            frames: bake.frames.length,
            framesPerSecond: compiled.timebase.frames_per_second,
            ticksPerSecond: compiled.timebase.ticks_per_second,
            fixedPointPrecision: Motion.PRECISION,
            totalBytes: totalBytes,
            recipeDigest: primary.recipe_digest,
            compositionDigest: compiled.composition_digest,
            bakeDigest: bake.digest,
            atlasFrames: atlasEligible ? atlasManifest.frameCount : 0,
          },
          notes: [
            "The editable composition, embedded recipes and integer bake are the authoritative candidate artifacts; CSS and SVG views declare their losses.",
            atlasEligible ? "The SVG sprite atlas and axm.sprite-atlas/v1 manifest cover every baked frame." : "Sprite-atlas output was held because this canvas exceeds the declared pixel, unit or frame boundary; the exact bake remains available.",
            "Source clip events are not silently time-remapped; composition events must be explicit.",
            "Static filmstrips prove deterministic samples, not good motion or final runtime appearance.",
            "No artifact is installed, promoted or canonical without an explicit human decision.",
          ],
        };
      },
    };
  },
);
