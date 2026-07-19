(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../raster-codec") : root.AXMRasterCodec,
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
  function (Core, Raster) {
    "use strict";
    if (!Raster || !Raster.encodeApng)
      throw new Error("AXM APNG Raster Codec is required");
    function rgb(hex) {
      var value = parseInt(String(hex || "#39dff2").replace("#", ""), 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }
    function frame(width, height, index, count, palette, transparent) {
      var rgba = new Uint8Array(width * height * 4),
        bg = rgb(palette[0]),
        ink = rgb(palette[1]),
        accent = rgb(palette[2] || palette[1]),
        cx = Math.round(
          width * (0.18 + 0.64 * (index / Math.max(1, count - 1))),
        ),
        cy = Math.round(
          height * (0.5 + Math.sin((index / count) * Math.PI * 2) * 0.18),
        ),
        radius = Math.max(2, Math.round(Math.min(width, height) * 0.14));
      for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++) {
          var o = (y * width + x) * 4,
            checker = ((x >> 3) + (y >> 3)) % 2,
            inside = Math.hypot(x - cx, y - cy) <= radius,
            ring =
              Math.abs(Math.hypot(x - cx, y - cy) - radius) <
              Math.max(1, radius * 0.18),
            colour = inside ? (ring ? accent : ink) : bg,
            alpha = inside ? 255 : transparent ? 0 : checker ? 245 : 225;
          rgba[o] = colour[0];
          rgba[o + 1] = colour[1];
          rgba[o + 2] = colour[2];
          rgba[o + 3] = alpha;
        }
      return rgba;
    }
    function editSource(context) {
      if (context.operationMode !== "edit") return null;
      try {
        var value = JSON.parse(context.sourceArtifacts[0].text);
        if (value.schema !== "axm.animated-raster-recipe/v1") throw new Error();
        return value;
      } catch (error) {
        throw new Error(
          "Animated raster edit requires axm.animated-raster-recipe/v1 JSON",
        );
      }
    }
    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "animated-raster",
        title: "Animated Raster Hand",
        version: "1.1.0",
        category: "raster-animation",
        lifecycle_status: "beta",
        summary:
          "Creates a structurally validated sRGB APNG animation directly from bounded RGBA frames and keeps a procedural editable recipe.",
        purpose:
          "Produce genuine animated raster containers for screen, UI and game-world canvases.",
        operation_modes: ["create", "edit"],
        canvas_models: ["raster-frame", "timeline"],
        entry_surfaces: ["command", "sprite-editor", "export-recipe"],
        mutability: "transform",
        kinds: ["sprite", "character", "effect", "animation", "texture"],
        accepts: [Core.BRIEF_SCHEMA, "axm.animated-raster-recipe/v1"],
        produces: [Core.RESULT_SCHEMA, "image/apng", "application/json"],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.animated-raster-recipe/v1",
            roles: ["source"],
            required_for: ["edit"],
            mutable: false,
            max_bytes: 1000000,
          },
        ],
        output_types: [
          {
            mime: "image/apng",
            format: "APNG",
            schema: "",
            role: "animated-raster-delivery",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.animated-raster-recipe/v1",
            role: "editable-animation-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
        ],
        canvas_types: [
          {
            medium: "screen",
            units: ["px"],
            colour_spaces: ["srgb"],
            transparency_modes: ["required", "allowed", "opaque"],
            behaviours: ["animated"],
            intended_uses: [
              "animation",
              "sprite",
              "character",
              "effect",
              "texture",
            ],
          },
          {
            medium: "ui",
            units: ["px"],
            colour_spaces: ["srgb"],
            transparency_modes: ["required", "allowed", "opaque"],
            behaviours: ["animated"],
            intended_uses: ["animation", "sprite", "effect"],
          },
          {
            medium: "game-world",
            units: ["px"],
            colour_spaces: ["srgb"],
            transparency_modes: ["required", "allowed", "opaque"],
            behaviours: ["animated"],
            intended_uses: [
              "animation",
              "sprite",
              "character",
              "effect",
              "texture",
            ],
          },
        ],
        canvas_limits: {
          max_width: 512,
          max_height: 512,
          max_pixels: 262144,
          texture_bytes_per_pixel: 4,
          min_animation_frames: 2,
          max_animation_frames: 12,
          min_fps: 1,
          max_fps: 60,
        },
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.animated",
          "performance.max-file-bytes",
          "performance.max-texture-memory-bytes",
          "performance.max-animation-frames",
          "performance.frames-per-second",
          "performance.max-duration-seconds",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          "axm.animated-raster-recipe/v1",
        ],
        operations: { preview: true, validate: true, edit: true },
        emits_editable_source: true,
        supports_edit_operation: true,
        requires: [],
        editable: true,
        deterministic: true,
        required_permissions: {
          local_file_system: "none",
          network_domains: [],
        },
        network_policy: { mode: "none", domains: [] },
        engine: {
          name: "AXM APNG encoder",
          version: Raster.VERSION,
          execution: "same-thread-bounded",
        },
        safety_tier: "safe-local",
        portability: {
          interchange_formats: ["image/apng", "axm.animated-raster-recipe/v1"],
          known_losses: [],
          unsupported_features: [
            "Display-P3 and linear-sRGB profiles",
            "animated WebP",
            "GIF palette optimization",
            "video encoding",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "PNG signature",
            "APNG acTL/fcTL/fdAT sequence",
            "chunk CRC",
            "frame and memory budgets",
          ],
        },
        rollback: { strategy: "discard-candidate" },
        evidence: [
          {
            claim:
              "The local raster codec writes PNG animation control and frame data chunks with CRC validation.",
            source_url: "local:shared/asset-hands/raster-codec.js",
            specification_version: Raster.VERSION,
          },
        ],
        tests: ["asset-hands-interchange-selftest", "asset-hands-selftest"],
        implementation_priority: "medium",
        limits: {
          maxDimension: 512,
          maxFrames: 12,
          animatedWebP: false,
          videoEncoding: false,
        },
      },
      create: function (context) {
        var canvas = context.targetCanvas,
          source = editSource(context),
          width = Math.round(canvas.dimensions.width),
          height = Math.round(canvas.dimensions.height),
          desiredFrames = Math.round((source && source.frame_count) || 6),
          frameBudget = Math.min(12,canvas.performance.max_animation_frames || 12),
          requestedFps = Number(
            canvas.performance.frames_per_second || (source && source.fps),
          ) || 12,
          durationBudget = canvas.performance.max_duration_seconds,
          fps = Math.max(
            1,
            Math.min(
              60,
              durationBudget == null
                ? requestedFps
                : Math.max(requestedFps, Math.ceil(2 / durationBudget)),
            ),
          ),
          durationFrameBudget = durationBudget == null
            ? frameBudget
            : Math.floor(durationBudget * fps),
          frames = Math.max(2,Math.min(desiredFrames,frameBudget,durationFrameBudget)),
          transparent = canvas.colour.transparency !== "opaque",
          rgbaFrames = [];
        for (var i = 0; i < frames; i++)
          rgbaFrames.push(
            frame(width, height, i, frames, context.palette, transparent),
          );
        var apng = Raster.encodeApng(width, height, rgbaFrames, {
            fps: fps,
            plays: 0,
            colourSpace: "srgb",
          }),
          recipe = {
            schema: "axm.animated-raster-recipe/v1",
            version: 1,
            id: Core.slug(context.brief.title),
            target_canvas: canvas,
            frame_count: frames,
            fps: fps,
            loop_count: 0,
            algorithm: "moving-disc-v1",
            palette: context.palette.slice(0, 4),
            transparent: transparent,
            frames: Array.from({ length: frames }, function (_, index) {
              return {
                index: index,
                phase: Number((index / frames).toFixed(6)),
                delay: { numerator: 1, denominator: fps },
              };
            }),
            provenance: {
              engine: "AXM APNG encoder",
              source_id: (source && source.id) || null,
            },
          },
          json = JSON.stringify(recipe, null, 2),
          total = apng.byteLength + json.length;
        return {
          artifacts: [
            {
              id: "animated-apng",
              role: "animated-raster-delivery",
              name: context.brief.title + " APNG",
              filename: Core.slug(context.brief.title) + ".apng",
              mime: "image/apng",
              format: "APNG",
              editable: false,
              dataUrl: apng.dataUrl,
              width: width,
              height: height,
              metadata: {
                frames: frames,
                fps: fps,
                loopCount: 0,
                colourSpace: "srgb",
                chunkSequence: apng.inspection.chunks,
              },
            },
            {
              id: "animated-recipe",
              role: "editable-animation-recipe",
              name: context.brief.title + " animation recipe",
              filename: Core.slug(context.brief.title) + ".animation.json",
              mime: "application/json",
              format: "JSON",
              editable: true,
              text: json,
              metadata: { schema: recipe.schema },
            },
          ],
          previewArtifactId: "animated-apng",
          recipe: {
            format: "axm.animated-raster-recipe/v1",
            parameters: {
              operation: context.operationMode,
              width: width,
              height: height,
              frames: frames,
              fps: fps,
              loopCount: 0,
              colourSpace: "srgb",
            },
            steps: [
              { op: "allocate-bounded-rgba-frames" },
              { op: "render-procedural-frame-sequence" },
              { op: "encode-apng-control-and-frame-chunks" },
              { op: "validate-crc-and-sequence" },
            ],
          },
          validationChecks: [
            {
              name: "apng-structure",
              pass: apng.inspection.pass,
              details: apng.inspection,
            },
            {
              name: "declared-frame-count",
              pass: apng.inspection.frames === frames,
            },
            {
              name: "srgb-declared",
              pass: apng.inspection.chunks.indexOf("sRGB") >= 0,
            },
            {
              name: "animation-budget",
              pass:
                canvas.performance.max_animation_frames == null ||
                frames <= canvas.performance.max_animation_frames,
            },
            {
              name: "duration-budget",
              pass:
                canvas.performance.max_duration_seconds == null ||
                frames / fps <= canvas.performance.max_duration_seconds,
            },
            {
              name: "texture-memory-budget",
              pass:
                canvas.performance.max_texture_memory_bytes == null ||
                width * height * 4 <=
                  canvas.performance.max_texture_memory_bytes,
            },
            {
              name: "file-budget",
              pass:
                canvas.performance.max_file_bytes == null ||
                total <= canvas.performance.max_file_bytes,
            },
          ],
          measures: {
            width: width,
            height: height,
            frames: frames,
            fps: fps,
            durationSeconds: frames / fps,
            apngBytes: apng.byteLength,
            totalBytes: total,
          },
          notes: [
            "APNG is a real sRGB animated PNG container; wide-colour APNG, animated WebP and video remain separate missing encoders.",
          ],
        };
      },
    };
  },
);
