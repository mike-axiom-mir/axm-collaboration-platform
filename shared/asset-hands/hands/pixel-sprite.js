(function (root, factory) {
  var provider = factory(
    typeof module === "object" && module.exports
      ? require("../asset-hand-core")
      : root.AXMAssetHandCore,
  );
  if (typeof module === "object" && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";
  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "pixel-sprite",
      title: "Pixel & Sprite Hand",
      version: "1.1.0",
      category: "creation",
      lifecycle_status: "beta",
      summary:
        "Creates crisp pixel icons, effects and frame-based sprite sheets with atlas timing metadata.",
      operation_modes: ["create"],
      canvas_models: ["raster-frame"],
      entry_surfaces: ["command", "sprite-editor", "export-recipe"],
      mutability: "generate",
      kinds: ["sprite", "character", "effect", "icon", "tile"],
      produces: [Core.RESULT_SCHEMA, "image/svg+xml", "application/json"],
      requires: ["svg", "json"],
      editable: true,
      deterministic: true,
      output_types: [
        {
          mime: "image/svg+xml",
          format: "SVG",
          schema: "",
          role: "editable-pixel-grid",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.sprite-atlas/v1",
          role: "sprite-atlas",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
      ],
      canvas_types: [
        {
          medium: "game-world",
          units: ["px"],
          colour_spaces: ["srgb"],
          transparency_modes: ["required", "allowed", "opaque"],
          behaviours: ["static", "animated"],
          intended_uses: [
            "sprite",
            "character",
            "effect",
            "icon",
            "tile",
          ],
        },
        {
          medium: "screen",
          units: ["px"],
          colour_spaces: ["srgb"],
          transparency_modes: ["required", "allowed", "opaque"],
          behaviours: ["static", "animated"],
          intended_uses: ["sprite", "effect", "icon"],
        },
      ],
      canvas_limits: {
        min_width: 1,
        min_height: 1,
        max_width: 1024,
        max_height: 1024,
        min_animation_frames: 2,
        max_animation_frames: 4,
        min_fps: 1,
        max_fps: 240,
      },
      constraints_honoured: [
        "dimensions",
        "dimensions.unit",
        "colour.space",
        "colour.transparency",
        "behaviour.static",
        "behaviour.animated",
        "performance.max-file-bytes",
        "performance.max-texture-memory-bytes",
        "performance.max-animation-frames",
        "performance.frames-per-second",
        "performance.max-duration-seconds",
      ],
      editable_recipe_formats: [Core.RECIPE_SCHEMA, "axm.pixel-grid-recipe/v1"],
      operations: { preview: true, validate: true, edit: false },
      emits_editable_source: true,
      supports_edit_operation: false,
      engine: {
        name: "AXM pixel-cell composer",
        version: "1.0.0",
        execution: "same-thread-bounded",
      },
      limits: { maxFrames: 4, grid: "16x16", externalResources: false },
    },
    create: function (context) {
      var brief = context.brief,
        frameWidth = Math.min(1024, brief.canvas.width),
        frameHeight = Math.min(1024, brief.canvas.height);
      var animated = context.targetCanvas.behaviour.indexOf("animated") >= 0,
        requestedMax = context.targetCanvas.performance.max_animation_frames;
      var durationBudget = context.targetCanvas.performance.max_duration_seconds,
        requestedFps = Number(context.targetCanvas.performance.frames_per_second) || 12,
        fps = Math.max(
          1,
          Math.min(
            240,
            animated && durationBudget != null
              ? Math.max(requestedFps, Math.ceil(2 / durationBudget))
              : requestedFps,
          ),
        ),
        durationFrameBudget = durationBudget == null ? 4 : Math.floor(durationBudget * fps),
        frames =
          animated
            ? Math.max(2, Math.min(4, requestedMax == null ? 4 : requestedMax, durationFrameBudget))
            : 1,
        sheetWidth = frameWidth * frames,
        colours = context.palette,
        durationMs = Math.max(1, Math.round(1000 / fps));
      var px = frameWidth / 16,
        py = frameHeight / 16,
        groups = [];
      function rect(x, y, w, h, colour, opacity) {
        return (
          '<rect x="' +
          (x * px).toFixed(2) +
          '" y="' +
          (y * py).toFixed(2) +
          '" width="' +
          (w * px).toFixed(2) +
          '" height="' +
          (h * py).toFixed(2) +
          '" fill="' +
          colour +
          '"' +
          (opacity == null ? "" : ' fill-opacity="' + opacity + '"') +
          "/>"
        );
      }
      for (var frame = 0; frame < frames; frame += 1) {
        var shift = frame % 2,
          content = "";
        if (!brief.transparent)
          content +=
            '<rect width="' +
            frameWidth +
            '" height="' +
            frameHeight +
            '" fill="' +
            colours[0] +
            '"/>';
        if (brief.kind === "effect") {
          var reach = 2 + frame;
          content += rect(
            8 - reach,
            8 - reach,
            reach * 2,
            reach * 2,
            colours[1],
            0.18,
          );
          content +=
            rect(6, 6, 4, 4, colours[3], 0.9) +
            rect(7, 4 - shift, 2, 8 + shift * 2, colours[2], 0.86) +
            rect(4 - shift, 7, 8 + shift * 2, 2, colours[2], 0.86);
        } else {
          content +=
            rect(5, 4 + shift, 6, 7, colours[1]) +
            rect(6, 2 + shift, 4, 3, colours[3]);
          content +=
            rect(6, 6 + shift, 1, 1, colours[0]) +
            rect(9, 6 + shift, 1, 1, colours[0]);
          content +=
            rect(4, 6 + shift, 1, 3, colours[2]) +
            rect(11, 6 + shift, 1, 3, colours[2]);
          content +=
            rect(5 + shift, 11, 2, 3, colours[1]) +
            rect(9 - shift, 11, 2, 3, colours[1]);
        }
        groups.push(
          '<g transform="translate(' +
            frame * frameWidth +
            ' 0)">' +
            content +
            "</g>",
        );
      }
      var sheetBrief = Core.clone(brief);
      sheetBrief.canvas.width = sheetWidth;
      sheetBrief.canvas.height = frameHeight;
      var svg = Core.svgDocument(sheetBrief, groups.join(""), {
        width: sheetWidth,
        height: frameHeight,
        extraAttributes: 'shape-rendering="crispEdges"',
      });
      var atlas = {
        schema: "axm.sprite-atlas/v1",
        name: brief.title,
        image: Core.slug(brief.title) + "-sheet.svg",
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        frameCount: frames,
        fps: fps,
        loop: frames > 1,
        tags: [
          { name: "default", from: 0, to: frames - 1, direction: "forward" },
        ],
        pivot: { x: 0.5, y: 1 },
        frames: [],
      };
      for (var index = 0; index < frames; index += 1)
        atlas.frames.push({
          id: "frame-" + index,
          x: index * frameWidth,
          y: 0,
          width: frameWidth,
          height: frameHeight,
          durationMs: durationMs,
          pivot: atlas.pivot,
        });
      return {
        artifacts: [
          {
            id: "sprite-sheet",
            role: "editable-source",
            name: brief.title + " sprite sheet",
            filename: Core.slug(brief.title) + "-sheet.svg",
            mime: "image/svg+xml",
            format: "SVG",
            width: sheetWidth,
            height: frameHeight,
            editable: true,
            text: svg,
            metadata: {
              frameWidth: frameWidth,
              frameHeight: frameHeight,
              frameCount: frames,
              pixelGrid: 16,
            },
          },
          {
            id: "sprite-atlas",
            role: "runtime-metadata",
            name: brief.title + " atlas",
            filename: Core.slug(brief.title) + "-atlas.json",
            mime: "application/json",
            format: "JSON",
            width: 0,
            height: 0,
            editable: true,
            text: JSON.stringify(atlas, null, 2),
            metadata: { schema: atlas.schema },
          },
        ],
        previewArtifactId: "sprite-sheet",
        recipe: {
          format: "axm.pixel-grid-recipe/v1",
          parameters: {
            grid: [16, 16],
            frames: frames,
            fps: fps,
            frameWidth: frameWidth,
            frameHeight: frameHeight,
            targetMedium: context.targetCanvas.medium,
          },
          steps: [
            { op: "derive-frame-count-from-animation-budget" },
            { op: "compose-pixel-cells" },
            { op: "pack-frame-strip" },
            { op: "emit-atlas-timing" },
          ],
        },
        validationChecks: [
          {
            name: "target-canvas-propagated",
            pass: context.targetCanvas.schema === Core.TARGET_CANVAS_SCHEMA,
          },
          {
            name: "frame-budget",
            pass:
              !context.targetCanvas.performance.max_animation_frames ||
              frames <= context.targetCanvas.performance.max_animation_frames,
          },
          {
            name: "texture-memory-estimate",
            pass:
              !context.targetCanvas.performance.max_texture_memory_bytes ||
              sheetWidth * frameHeight * 4 <=
                context.targetCanvas.performance.max_texture_memory_bytes,
          },
          {
            name: "duration-budget",
            pass:
              durationBudget == null || frames / fps <= durationBudget,
          },
        ],
        measures: {
          pixelGrid: 16,
          frameCount: frames,
          durationSeconds: frames / fps,
          crispEdges: true,
          atlasReady: true,
        },
        notes: [
          "Each frame is preserved in a deterministic grid with explicit timing metadata.",
        ],
      };
    },
  };
});
