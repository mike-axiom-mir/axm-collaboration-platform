(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var api = factory(
    node ? require("./target-canvas") : root.AXMTargetCanvas,
    node ? require("./artifact-schema-catalog") : root.AXMArtifactSchemaCatalog,
    node ? require("./ktx2-codec") : root.AXMKTX2Codec,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMAssetHandCore = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (TargetCanvas, ArtifactSchemas, KTX2Codec) {
    "use strict";
    if (!TargetCanvas)
      throw new Error("AXM Target Canvas Contract is required");

    var VERSION = "2.5.0";
    var BRIEF_SCHEMA = "axm.asset-brief/v1";
    var LEGACY_HAND_SCHEMA = "axm.asset-hand/v1";
    var HAND_SCHEMA = "axm.asset-hand/v2";
    var RESULT_SCHEMA = "axm.asset-hand-result/v1";
    var ARTIFACT_SCHEMA = "axm.asset-artifact/v1";
    var SOURCE_ARTIFACT_SCHEMA = "axm.asset-source-artifact/v1";
    var FAMILY_SCHEMA = "axm.asset-hand-family/v1";
    var RECIPE_SCHEMA = "axm.asset-creation-recipe/v1";
    var VALIDATION_SCHEMA = "axm.asset-validation-receipt/v1";
    var GAP_SCHEMA = "axm.asset-hand-gap-report/v1";
    var OPERATION_MODES = [
      "create",
      "edit",
      "inspect",
      "validate",
      "finish",
      "workflow",
    ];
    var CANVAS_MODELS = [
      "dom-component",
      "node-tree-design",
      "raster-frame",
      "vector-document",
      "page-document",
      "timeline",
      "viewport-2d",
      "viewport-3d",
      "cad-parametric",
      "audio-device",
      "procedural-graph",
      "host-neutral",
    ];
    var KINDS = [
      "icon",
      "badge",
      "logo",
      "symbol",
      "panel",
      "ui-component",
      "button",
      "hud",
      "tile",
      "texture",
      "pattern",
      "background",
      "sprite",
      "character",
      "decal",
      "effect",
      "illustration",
      "poster",
      "cover",
      "papercraft",
      "theme",
      "design-tokens",
      "layout",
      "ui-layout",
      "inspection",
      "codegen",
      "timeline",
      "sequence",
      "motion",
      "mesh",
      "3d-object",
      "prop",
      "animation",
      "procedural-animation",
      "material",
      "shader",
      "document",
      "print-document",
      "label",
    ];
    var DEFAULT_PALETTES = [
      ["#07111f", "#29d8f2", "#e9fbff", "#f0b84a"],
      ["#120b24", "#a77cff", "#ff63c5", "#f4eaff"],
      ["#071b16", "#4bdd98", "#d4ffe9", "#f1c85a"],
      ["#21100d", "#ff765e", "#ffd482", "#fff1df"],
    ];

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function text(value, max) {
      var out = String(value == null ? "" : value)
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return max ? out.slice(0, max) : out;
    }
    function number(value, min, max, fallback) {
      var parsed = Number(value);
      return Number.isFinite(parsed)
        ? Math.max(min, Math.min(max, Math.round(parsed)))
        : fallback;
    }
    function decimal(value, min, max, fallback) {
      var parsed = Number(value);
      return Number.isFinite(parsed)
        ? Math.max(min, Math.min(max, parsed))
        : fallback;
    }
    function hash(value) {
      var source = typeof value === "string" ? value : JSON.stringify(value);
      var out = 2166136261;
      for (var index = 0; index < source.length; index += 1) {
        out ^= source.charCodeAt(index);
        out = Math.imul(out, 16777619);
      }
      return (out >>> 0).toString(16).padStart(8, "0");
    }
    function slug(value) {
      return (
        text(value || "asset", 100)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 72) || "asset"
      );
    }
    function escapeXml(value) {
      return String(value == null ? "" : value).replace(
        /[&<>"']/g,
        function (character) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          }[character];
        },
      );
    }
    function rng(seed) {
      var state = parseInt(hash(seed), 16) >>> 0;
      return function () {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }
    function unique(values, max) {
      var seen = {};
      return (Array.isArray(values) ? values : [])
        .map(function (value) {
          return text(value, 80);
        })
        .filter(function (value) {
          if (!value || seen[value]) return false;
          seen[value] = true;
          return true;
        })
        .slice(0, max || 30);
    }
    function validColour(value) {
      return /^#[0-9a-f]{6}$/i.test(String(value || ""));
    }
    function relativeLuminance(value) {
      if (!validColour(value)) return null;
      var hex = String(value).slice(1),
        channels = [0, 2, 4].map(function (offset) {
          var channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }
    function contrastRatio(left, right) {
      var a = relativeLuminance(left),
        b = relativeLuminance(right);
      if (a == null || b == null) return null;
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    function accessiblePair(background, foreground, minimum) {
      var requested = decimal(minimum, 1, 21, 4.5),
        pair = {
          background: validColour(background) ? background : "#000000",
          foreground: validColour(foreground) ? foreground : "#ffffff",
        },
        ratio = contrastRatio(pair.background, pair.foreground);
      if (ratio < requested) {
        var black = contrastRatio(pair.background, "#000000"),
          white = contrastRatio(pair.background, "#ffffff");
        pair.foreground = white >= black ? "#ffffff" : "#000000";
        ratio = Math.max(black, white);
      }
      if (ratio < requested) {
        pair.background = "#000000";
        pair.foreground = "#ffffff";
        ratio = 21;
      }
      pair.ratio = Number(ratio.toFixed(3));
      pair.minimum = requested;
      return pair;
    }
    function paletteFor(brief, offset) {
      var supplied = (brief.palette || []).filter(validColour);
      var base =
        supplied.length >= 2
          ? supplied
          : DEFAULT_PALETTES[
              (parseInt(hash(brief.id), 16) + Number(offset || 0)) %
                DEFAULT_PALETTES.length
            ];
      while (base.length < 4) base.push(DEFAULT_PALETTES[0][base.length]);
      return base.slice(0, 6);
    }
    function kind(value) {
      var raw = text(value, 40)
        .toLowerCase()
        .replace(/[_\s]+/g, "-");
      var aliases = {
        ui: "ui-component",
        interface: "ui-component",
        card: "panel",
        texture2d: "texture",
        "sprite-sheet": "sprite",
        spritesheet: "sprite",
        image: "illustration",
      };
      raw = aliases[raw] || raw;
      return raw || "icon";
    }
    function normalizeBrief(raw) {
      raw = raw && typeof raw === "object" ? raw : {};
      var size = number(raw.size, 16, 4096, 256);
      var briefKind = kind(raw.kind);
      var operationMode = text(raw.operation_mode || raw.operationMode, 40)
        .toLowerCase()
        .replace(/[_\s]+/g, "-");
      if (OPERATION_MODES.indexOf(operationMode) < 0) operationMode = "create";
      var rawTargetCanvas = raw.target_canvas || raw.targetCanvas || {};
      var targetCanvasInspection = TargetCanvas.inspect(rawTargetCanvas, raw);
      var targetCanvas = targetCanvasInspection.canvas;
      var originalTargetCanvas =
        raw.target_canvas_original &&
        typeof raw.target_canvas_original === "object"
          ? raw.target_canvas_original
          : targetCanvasInspection.original;
      var existingCanvasValidation =
        raw.target_canvas_validation &&
        typeof raw.target_canvas_validation === "object"
          ? raw.target_canvas_validation
          : null;
      var targetPixels =
        targetCanvas.dimensions.unit === "px" ? targetCanvas.dimensions : {};
      var width = number(
        raw.width,
        16,
        8192,
        number(targetPixels.width, 16, 8192, size),
      );
      var height = number(
        raw.height,
        16,
        8192,
        number(targetPixels.height, 16, 8192, size),
      );
      var styles = Array.isArray(raw.styleTags)
        ? raw.styleTags
        : text(raw.style || raw.styleTags, 300).split(",");
      var formats = unique(
        (Array.isArray(raw.formats) ? raw.formats : ["SVG", "PNG", "WebP"]).map(
          function (format) {
            return String(format).toUpperCase();
          },
        ),
        8,
      );
      var quality = raw.quality_requirements || raw.qualityRequirements || {};
      var sourceArtifacts = (
        Array.isArray(raw.source_artifacts || raw.sourceArtifacts)
          ? raw.source_artifacts || raw.sourceArtifacts
          : []
      )
        .map(normalizeSourceArtifact)
        .slice(0, 20);
      var requiredOutputs = unique(
        raw.required_outputs || raw.requiredOutputs || [],
        20,
      );
      var recipeFormats = unique(
        raw.editable_recipe_formats ||
          raw.editableRecipeFormats || [RECIPE_SCHEMA],
        20,
      );
      var fallback = raw.fallback_policy || raw.fallbackPolicy || {};
      return {
        schema: BRIEF_SCHEMA,
        id: text(raw.id, 100) || "brief-" + hash(raw),
        title: text(raw.title || raw.name, 120) || "Untitled asset",
        target: text(raw.target, 120) || "shared",
        kind: briefKind,
        operation_mode: operationMode,
        intended_use:
          text(raw.intended_use || raw.intendedUse, 100) ||
          targetCanvas.intended_use ||
          briefKind,
        target_canvas: targetCanvas,
        target_canvas_original: clone(originalTargetCanvas),
        target_canvas_validation: existingCanvasValidation
          ? clone(existingCanvasValidation)
          : {
              pass: targetCanvasInspection.pass,
              errors: targetCanvasInspection.errors.slice(),
              transformations: targetCanvasInspection.transformations.slice(),
            },
        canvas: {
          width: width,
          height: height,
          unit: "px",
          colourSpace: targetCanvas.colour.space,
          compatibilityView: true,
        },
        transparent:
          targetCanvas.colour.transparency !== "opaque" &&
          raw.transparent !== false,
        seamless:
          targetCanvas.physical.repeat.mode !== "none" ||
          targetCanvas.behaviour.indexOf("tileable") >= 0 ||
          (briefKind === "tile" ||
          briefKind === "texture" ||
          briefKind === "pattern"
            ? raw.seamless !== false
            : !!raw.seamless),
        purpose:
          text(raw.purpose || raw.goal, 500) || "Reusable Workshop asset",
        styleTags: unique(styles, 16),
        palette: unique(
          Array.isArray(raw.palette) ? raw.palette : [],
          12,
        ).filter(validColour),
        deliverables: formats.length ? formats : ["SVG", "PNG"],
        required_outputs: requiredOutputs,
        editable_recipe_formats: recipeFormats.length
          ? recipeFormats
          : [RECIPE_SCHEMA],
        fallback_policy: {
          generalist:
            fallback.generalist === "permitted" ||
            fallback.allow_generalist === true ||
            fallback.allowGeneralist === true
              ? "permitted"
              : "forbidden",
          lossy_conversion:
            fallback.lossy_conversion === "permitted" ||
            fallback.lossyConversion === "permitted" ||
            fallback.allow_lossy_conversion === true ||
            fallback.allowLossyConversion === true
              ? "permitted"
              : "forbidden",
        },
        source_artifacts: sourceArtifacts,
        quality_requirements: {
          require_preview:
            operationMode === "inspect" || operationMode === "validate"
              ? quality.require_preview === true ||
                quality.requirePreview === true
              : quality.require_preview !== false &&
                quality.requirePreview !== false,
          require_validation:
            quality.require_validation !== false &&
            quality.requireValidation !== false,
          require_editable_source:
            quality.require_editable_source === true ||
            quality.requireEditableSource === true,
          minimum_quality_score: decimal(
            quality.minimum_quality_score != null
              ? quality.minimum_quality_score
              : quality.minimumQualityScore,
            0,
            1,
            0,
          ),
          strict_validation:
            quality.strict_validation === true ||
            quality.strictValidation === true ||
            operationMode === "validate",
          notes: unique(quality.notes, 20),
        },
        accessibility: {
          smallScaleReadable: raw.smallScaleReadable !== false,
          reducedMotionSafe: raw.reducedMotionSafe !== false,
          contrastTarget:
            text(raw.contrastTarget, 40) ||
            (targetCanvas.colour.minimum_contrast_ratio
              ? String(targetCanvas.colour.minimum_contrast_ratio) + ":1"
              : "context-reviewed"),
        },
        source: {
          schema: text(raw.schema, 100) || "unversioned",
          id: text(raw.id, 100) || null,
        },
      };
    }
    function svgDocument(brief, body, options) {
      options = options || {};
      var width = number(options.width, 1, 16384, brief.canvas.width);
      var height = number(options.height, 1, 16384, brief.canvas.height);
      var extra = options.extraAttributes ? " " + options.extraAttributes : "";
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        width +
        " " +
        height +
        '" width="' +
        width +
        '" height="' +
        height +
        '" role="img" aria-label="' +
        escapeXml(options.label || brief.title) +
        '"' +
        extra +
        ">" +
        body +
        "</svg>"
      );
    }
    function formatFromMime(mime) {
      return (
        {
          "image/svg+xml": "SVG",
          "image/png": "PNG",
          "image/apng": "APNG",
          "image/jpeg": "JPEG",
          "image/webp": "WEBP",
          "image/ktx2": "KTX2",
          "application/json": "JSON",
          "application/dxf": "DXF",
          "application/pdf": "PDF",
          "application/mtlx+xml": "MTLX",
          "application/vnd.opentimelineio+json": "OTIO",
          "text/css": "CSS",
          "text/plain": "TEXT",
          "model/obj": "OBJ",
          "model/gltf-binary": "GLB",
        }[String(mime || "").toLowerCase()] || ""
      );
    }
    function normalizeSourceArtifact(raw) {
      raw = raw && typeof raw === "object" ? raw : {};
      var mime = text(raw.mime || raw.type, 100) || "application/octet-stream";
      var format =
        text(raw.format, 40).toUpperCase() || formatFromMime(mime) || "DATA";
      var value =
        typeof raw.text === "string" ? raw.text.slice(0, 2000000) : "";
      var dataUrl =
        typeof raw.dataUrl === "string" ? raw.dataUrl.slice(0, 24000000) : "";
      var contentSchema = text(
        raw.content_schema ||
          raw.contentSchema ||
          (raw.metadata && raw.metadata.schema),
        120,
      );
      if (!contentSchema && mime === "application/json" && value) {
        try {
          var parsed = JSON.parse(value);
          contentSchema = text(parsed && (parsed.schema || parsed.format), 120);
        } catch (error) {}
      }
      return {
        schema: SOURCE_ARTIFACT_SCHEMA,
        id:
          text(raw.id, 100) || "source-" + hash([mime, format, value, dataUrl]),
        role: text(raw.role, 80) || "source",
        name: text(raw.name || raw.filename, 160) || "Source artifact",
        mime: mime,
        format: format,
        content_schema: contentSchema,
        editable: raw.editable === true,
        text: value,
        dataUrl: dataUrl,
        digest: text(raw.digest, 160) || hash([mime, format, value, dataUrl]),
        metadata: clone(raw.metadata || {}),
      };
    }
    function normalizeOutputType(raw) {
      if (typeof raw === "string") raw = { mime: raw };
      raw = raw || {};
      var mime = text(raw.mime || raw.type, 100);
      var format =
        text(raw.format, 30).toUpperCase() ||
        formatFromMime(mime) ||
        text(raw.schema, 100);
      return {
        mime: mime,
        format: format,
        schema: text(
          raw.schema || raw.content_schema || raw.contentSchema,
          120,
        ),
        role: text(raw.role, 80) || "deliverable",
        editable: raw.editable === true,
        deterministic: raw.deterministic !== false,
        lossy: raw.lossy === true,
        known_losses: unique(raw.known_losses || raw.knownLosses, 30),
      };
    }
    function normalizeInputType(raw) {
      if (typeof raw === "string") raw = { mime: raw };
      raw = raw || {};
      return {
        mime: text(raw.mime || raw.type, 100),
        format: text(raw.format, 40).toUpperCase(),
        schema: text(
          raw.schema || raw.content_schema || raw.contentSchema,
          120,
        ),
        roles: unique(raw.roles, 20),
        required_for: unique(raw.required_for || raw.requiredFor, 10).filter(
          function (mode) {
            return OPERATION_MODES.indexOf(mode) >= 0;
          },
        ),
        mutable: raw.mutable === true,
        max_bytes: number(raw.max_bytes || raw.maxBytes, 1, 100000000, 2000000),
      };
    }
    function normalizePermissionPolicy(raw) {
      raw = raw || {};
      var local = text(
        raw.local_file_system || raw.localFileSystem,
        30,
      ).toLowerCase();
      if (["none", "request", "read", "write"].indexOf(local) < 0)
        local = "none";
      return {
        local_file_system: local,
        clipboard: raw.clipboard === true,
        network_domains: unique(raw.network_domains || raw.networkDomains, 30),
        device_access: unique(raw.device_access || raw.deviceAccess, 20),
        plugin_data: raw.plugin_data === true || raw.pluginData === true,
      };
    }
    function normalizeEvidence(raw) {
      if (typeof raw === "string")
        return {
          claim: text(raw, 300),
          source_url: "",
          specification_version: "",
          retrieved_at: "",
        };
      raw = raw || {};
      return {
        claim: text(raw.claim || raw.title, 300),
        source_url: text(raw.source_url || raw.sourceUrl || raw.url, 1000),
        specification_version: text(
          raw.specification_version || raw.specificationVersion,
          100,
        ),
        retrieved_at: text(raw.retrieved_at || raw.retrievedAt, 40),
      };
    }
    function normalizeCanvasProfile(raw) {
      if (typeof raw === "string") raw = { medium: raw };
      raw = raw || {};
      return {
        medium: text(raw.medium, 60).toLowerCase(),
        units: unique(raw.units, 20),
        colour_spaces: unique(raw.colour_spaces || raw.colourSpaces, 20),
        transparency_modes: unique(
          raw.transparency_modes || raw.transparencyModes,
          10,
        ),
        material_behaviours: unique(
          raw.material_behaviours || raw.materialBehaviours,
          30,
        ),
        behaviours: unique(raw.behaviours || raw.behaviors, 20),
        intended_uses: unique(raw.intended_uses || raw.intendedUses, 40),
        locale_patterns: unique(raw.locale_patterns || raw.localePatterns, 80),
        up_axes: unique(raw.up_axes || raw.upAxes, 3),
        handedness: unique(raw.handedness, 2),
      };
    }
    function normalizeCanvasLimits(raw) {
      raw = raw || {};
      function positive(value) {
        var parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }
      return {
        min_width: positive(raw.min_width || raw.minWidth),
        min_height: positive(raw.min_height || raw.minHeight),
        max_width: positive(raw.max_width || raw.maxWidth),
        max_height: positive(raw.max_height || raw.maxHeight),
        max_pixels: positive(raw.max_pixels || raw.maxPixels),
        texture_bytes_per_pixel: positive(
          raw.texture_bytes_per_pixel || raw.textureBytesPerPixel,
        ),
        max_bleed: positive(raw.max_bleed || raw.maxBleed),
        min_stroke: positive(raw.min_stroke || raw.minStroke),
        max_stroke: positive(raw.max_stroke || raw.maxStroke),
        max_tool_width: positive(raw.max_tool_width || raw.maxToolWidth),
        max_depth: positive(raw.max_depth || raw.maxDepth),
        min_animation_frames: positive(
          raw.min_animation_frames || raw.minAnimationFrames,
        ),
        max_animation_frames: positive(
          raw.max_animation_frames || raw.maxAnimationFrames,
        ),
        min_fps: positive(raw.min_fps || raw.minFps),
        max_fps: positive(raw.max_fps || raw.maxFps),
        min_polygon_count: positive(
          raw.min_polygon_count || raw.minPolygonCount,
        ),
        min_vertices: positive(raw.min_vertices || raw.minVertices),
      };
    }
    function normalizeDescriptor(raw) {
      raw = raw || {};
      var produces = unique(raw.produces, 20);
      var rawOutputTypes =
        raw.output_types ||
        raw.outputTypes ||
        produces.filter(function (entry) {
          return entry !== RESULT_SCHEMA;
        });
      var rawCanvasTypes = raw.canvas_types ||
        raw.canvasTypes || [
          {
            medium: "screen",
            units: ["px"],
            colour_spaces: ["srgb"],
            behaviours: ["static"],
          },
        ];
      var rawInputTypes = raw.input_types || raw.inputTypes || [];
      var outputTypes = (
        Array.isArray(rawOutputTypes) ? rawOutputTypes : [rawOutputTypes]
      )
        .map(normalizeOutputType)
        .filter(function (entry) {
          return entry.mime || entry.format;
        });
      var canvasTypes = (
        Array.isArray(rawCanvasTypes) ? rawCanvasTypes : [rawCanvasTypes]
      )
        .map(normalizeCanvasProfile)
        .filter(function (entry) {
          return entry.medium;
        });
      var inputTypes = (
        Array.isArray(rawInputTypes) ? rawInputTypes : [rawInputTypes]
      )
        .map(normalizeInputType)
        .filter(function (entry) {
          return entry.mime || entry.format || entry.schema;
        });
      var operations = raw.operations || {};
      var operationModes = unique(
        raw.operation_modes || raw.operationModes || ["create"],
        10,
      ).filter(function (mode) {
        return OPERATION_MODES.indexOf(mode) >= 0;
      });
      var lifecycle = text(
        raw.lifecycle_status || raw.lifecycleStatus || raw.status,
        30,
      ).toLowerCase();
      if (
        ["experimental", "beta", "stable", "deprecated"].indexOf(lifecycle) < 0
      )
        lifecycle = "stable";
      var mutability = text(raw.mutability, 30).toLowerCase();
      if (
        ["read-only", "annotate", "transform", "generate", "export"].indexOf(
          mutability,
        ) < 0
      )
        mutability =
          operationModes.indexOf("create") >= 0 ? "generate" : "read-only";
      var network = raw.network_policy || raw.networkPolicy || {};
      var portability = raw.portability || {};
      var hostCompatibility =
        raw.host_compatibility || raw.hostCompatibility || {};
      var emitsEditableSource =
        raw.emits_editable_source === true ||
        raw.emitsEditableSource === true ||
        outputTypes.some(function (output) {
          return output.editable;
        });
      var supportsEditOperation =
        operationModes.indexOf("edit") >= 0 && operations.edit === true;
      var wildcardPolicy = text(
        raw.wildcard_kind_policy || raw.wildcardKindPolicy,
        20,
      ).toLowerCase();
      if (["native", "fallback"].indexOf(wildcardPolicy) < 0)
        wildcardPolicy = "fallback";
      return {
        schema: HAND_SCHEMA,
        legacy_schema:
          raw.schema === LEGACY_HAND_SCHEMA ? LEGACY_HAND_SCHEMA : null,
        contract_version: "2.0",
        source_contract:
          raw.schema === HAND_SCHEMA && raw.contract_version === "2.0"
            ? "native-v2"
            : "legacy-normalized",
        id: slug(raw.id),
        title: text(raw.title, 100) || "Untitled hand",
        version: text(raw.version, 30) || "0.0.0",
        category: text(raw.category, 50) || "creation",
        summary: text(raw.summary, 300),
        purpose: text(raw.purpose || raw.summary, 300),
        lifecycle_status: lifecycle,
        operation_modes: operationModes.length ? operationModes : ["create"],
        canvas_models: unique(
          raw.canvas_models || raw.canvasModels || ["host-neutral"],
          20,
        ).filter(function (model) {
          return CANVAS_MODELS.indexOf(model) >= 0;
        }),
        entry_surfaces: unique(
          raw.entry_surfaces ||
            raw.entrySurfaces || ["command", "export-recipe"],
          20,
        ),
        mutability: mutability,
        kinds: unique(raw.kinds, 40).map(function (entry) {
          return entry === "*" ? "*" : kind(entry);
        }),
        wildcard_kind_policy: wildcardPolicy,
        accepts: unique(
          raw.accepts && raw.accepts.length
            ? raw.accepts
            : [BRIEF_SCHEMA, "axm.asset-need/v1"],
          20,
        ),
        produces: produces.length ? produces : [RESULT_SCHEMA, "image/svg+xml"],
        output_types: outputTypes,
        input_types: inputTypes,
        canvas_types: canvasTypes,
        canvas_limits: normalizeCanvasLimits(
          raw.canvas_limits || raw.canvasLimits,
        ),
        constraints_honoured: unique(
          raw.constraints_honoured ||
            raw.constraintsHonoured || [
              "dimensions",
              "dimensions.unit",
              "colour.space",
              "colour.transparency",
              "behaviour.static",
            ],
          80,
        ),
        editable_recipe_formats: unique(
          raw.editable_recipe_formats ||
            raw.editableRecipeFormats || [RECIPE_SCHEMA],
          30,
        ),
        operations: {
          preview: operations.preview !== false,
          validate: operations.validate !== false,
          edit: supportsEditOperation,
        },
        emits_editable_source: emitsEditableSource,
        supports_edit_operation: supportsEditOperation,
        requires: unique(raw.requires, 20),
        required_permissions: normalizePermissionPolicy(
          raw.required_permissions || raw.requiredPermissions,
        ),
        network_policy: {
          mode: network.mode === "allowlist" ? "allowlist" : "none",
          domains: unique(network.domains, 30),
          rationale: text(network.rationale, 300),
        },
        host_compatibility: {
          hosts: unique(hostCompatibility.hosts, 30),
          minimum_versions: clone(
            hostCompatibility.minimum_versions ||
              hostCompatibility.minimumVersions ||
              {},
          ),
          dependencies: (Array.isArray(hostCompatibility.dependencies)
            ? hostCompatibility.dependencies
            : []
          )
            .map(function (dependency) {
              return clone(dependency);
            })
            .slice(0, 30),
        },
        engine: {
          name:
            text(raw.engine && raw.engine.name, 100) ||
            "AXM local deterministic geometry",
          version: text(raw.engine && raw.engine.version, 30) || VERSION,
          execution:
            text(raw.engine && raw.engine.execution, 80) ||
            "same-thread-bounded",
        },
        editable: emitsEditableSource,
        deterministic: raw.deterministic !== false,
        authority: text(raw.authority, 100) || "candidate-only",
        implementation_status:
          text(raw.implementation_status || raw.implementationStatus, 40) ||
          "executable",
        safety_tier:
          ["safe-local", "local-write", "networked", "native-bridge"].indexOf(
            text(raw.safety_tier || raw.safetyTier, 40),
          ) >= 0
            ? text(raw.safety_tier || raw.safetyTier, 40)
            : "safe-local",
        portability: {
          interchange_formats: unique(
            portability.interchange_formats || portability.interchangeFormats,
            30,
          ),
          known_losses: unique(
            portability.known_losses || portability.knownLosses,
            50,
          ),
          unsupported_features: unique(
            portability.unsupported_features || portability.unsupportedFeatures,
            50,
          ),
          fallbacks: unique(portability.fallbacks, 30),
        },
        validation: clone(raw.validation || {}),
        rollback: clone(raw.rollback || { strategy: "discard-candidate" }),
        observability: clone(
          raw.observability || { logs: true, duration: true, warnings: true },
        ),
        evidence: (Array.isArray(raw.evidence) ? raw.evidence : [])
          .map(normalizeEvidence)
          .filter(function (entry) {
            return entry.claim || entry.source_url;
          })
          .slice(0, 30),
        tests: unique(raw.tests, 50),
        implementation_priority: text(
          raw.implementation_priority || raw.implementationPriority,
          30,
        ),
        limits: clone(raw.limits || {}),
      };
    }
    function validateDescriptor(raw) {
      raw = raw && typeof raw === "object" ? raw : {};
      var descriptor = normalizeDescriptor(raw),
        errors = [],
        warnings = [];
      function requireValue(pass, message) {
        if (!pass) errors.push(message);
      }
      requireValue(!!text(raw.id, 100), "hand id is required");
      requireValue(
        text(raw.id, 100) === descriptor.id,
        "hand id must already be a lowercase portable slug",
      );
      requireValue(!!text(raw.title, 100), "hand title is required");
      requireValue(
        /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(descriptor.version),
        "hand version must be semantic",
      );
      requireValue(
        descriptor.operation_modes.length > 0,
        "at least one operation mode is required",
      );
      requireValue(
        descriptor.canvas_models.length > 0,
        "at least one canvas model is required",
      );
      requireValue(
        descriptor.entry_surfaces.length > 0,
        "at least one entry surface is required",
      );
      requireValue(
        descriptor.kinds.length > 0,
        "at least one asset kind is required",
      );
      requireValue(
        descriptor.output_types.length > 0,
        "at least one output type is required",
      );
      requireValue(
        descriptor.canvas_types.length > 0,
        "at least one canvas profile is required",
      );
      requireValue(
        descriptor.constraints_honoured.length > 0,
        "at least one honoured constraint is required",
      );
      requireValue(
        descriptor.editable_recipe_formats.length > 0,
        "at least one recipe format is required",
      );
      descriptor.output_types.forEach(function (output, index) {
        requireValue(
          !!(output.mime || output.schema),
          "output type " + index + " requires MIME or schema",
        );
        requireValue(
          !!output.format,
          "output type " + index + " requires format",
        );
        requireValue(!!output.role, "output type " + index + " requires role");
        if (output.lossy)
          requireValue(
            output.known_losses.length > 0,
            "lossy output type " + index + " must declare known losses",
          );
        requireValue(
          descriptor.produces.indexOf(output.mime) >= 0 ||
            (!!output.schema &&
              descriptor.produces.indexOf(output.schema) >= 0),
          "output type " + index + " is absent from produces",
        );
      });
      descriptor.canvas_types.forEach(function (profile, index) {
        requireValue(
          profile.medium === "*" ||
            TargetCanvas.MEDIUMS.indexOf(profile.medium) >= 0,
          "canvas profile " + index + " has unsupported medium",
        );
        profile.units.forEach(function (unit) {
          requireValue(
            TargetCanvas.UNITS.indexOf(unit) >= 0,
            "canvas profile " + index + " has unsupported unit " + unit,
          );
        });
        profile.colour_spaces.forEach(function (space) {
          requireValue(
            TargetCanvas.COLOUR_SPACES.indexOf(space) >= 0,
            "canvas profile " +
              index +
              " has unsupported colour space " +
              space,
          );
        });
        profile.behaviours.forEach(function (behaviour) {
          requireValue(
            TargetCanvas.BEHAVIOURS.indexOf(behaviour) >= 0,
            "canvas profile " +
              index +
              " has unsupported behaviour " +
              behaviour,
          );
        });
      });
      if (descriptor.kinds.indexOf("*") >= 0)
        requireValue(
          raw.wildcard_kind_policy === "native" ||
            raw.wildcard_kind_policy === "fallback",
          "wildcard kinds require an explicit native or fallback policy",
        );
      if (raw.operations && raw.operations.edit === true)
        requireValue(
          (raw.operation_modes || raw.operationModes || []).indexOf("edit") >=
            0,
          "operations.edit requires edit in operation_modes",
        );
      if (descriptor.supports_edit_operation) {
        requireValue(
          descriptor.operation_modes.indexOf("edit") >= 0,
          "edit support requires edit operation mode",
        );
        requireValue(
          descriptor.input_types.some(function (input) {
            return input.required_for.indexOf("edit") >= 0;
          }),
          "edit support requires a typed source input",
        );
      }
      if (descriptor.emits_editable_source)
        requireValue(
          descriptor.output_types.some(function (output) {
            return output.editable;
          }),
          "editable-source capability requires an editable output type",
        );
      if (descriptor.source_contract !== "native-v2")
        warnings.push("legacy descriptor was normalized to Hand Contract v2");
      if (raw.schema === HAND_SCHEMA) {
        requireValue(
          raw.contract_version === "2.0",
          "native v2 descriptor requires contract_version 2.0",
        );
        requireValue(
          typeof raw.emits_editable_source === "boolean",
          "native v2 descriptor must explicitly declare emits_editable_source",
        );
        requireValue(
          typeof raw.supports_edit_operation === "boolean",
          "native v2 descriptor must explicitly declare supports_edit_operation",
        );
        descriptor.canvas_types.forEach(function (profile, index) {
          requireValue(
            profile.transparency_modes.length > 0,
            "native v2 canvas profile " +
              index +
              " must explicitly declare supported transparency modes",
          );
        });
        descriptor.canvas_types.forEach(function (profile, index) {
          profile.locale_patterns.forEach(function (pattern) {
            requireValue(
              /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(pattern),
              "canvas profile " +
                index +
                " has invalid locale pattern " +
                pattern,
            );
          });
        });
        descriptor.canvas_types.forEach(function (profile, index) {
          profile.up_axes.forEach(function (axis) {
            requireValue(
              ["x", "y", "z"].indexOf(axis) >= 0,
              "canvas profile " + index + " has invalid up axis " + axis,
            );
          });
          profile.handedness.forEach(function (value) {
            requireValue(
              ["left", "right"].indexOf(value) >= 0,
              "canvas profile " + index + " has invalid handedness " + value,
            );
          });
        });
        (Array.isArray(raw.output_types) ? raw.output_types : []).forEach(
          function (output, index) {
            requireValue(
              typeof output.format === "string" && !!output.format,
              "native v2 output type " +
                index +
                " must explicitly declare format",
            );
            requireValue(
              typeof output.role === "string" && !!output.role,
              "native v2 output type " +
                index +
                " must explicitly declare role",
            );
            requireValue(
              typeof output.editable === "boolean",
              "native v2 output type " +
                index +
                " must explicitly declare editable",
            );
            requireValue(
              typeof output.deterministic === "boolean",
              "native v2 output type " +
                index +
                " must explicitly declare deterministic",
            );
            requireValue(
              typeof output.lossy === "boolean",
              "native v2 output type " +
                index +
                " must explicitly declare lossy",
            );
            requireValue(
              Array.isArray(output.known_losses),
              "native v2 output type " +
                index +
                " must explicitly declare known_losses",
            );
          },
        );
      }
      return {
        pass: errors.length === 0,
        errors: errors,
        warnings: warnings,
        descriptor: descriptor,
      };
    }
    function canvasLimitFailures(descriptor, canvas) {
      var limits = descriptor.canvas_limits || {},
        dimensions = canvas.dimensions || {},
        failures = [];
      if (limits.min_width != null && dimensions.width < limits.min_width)
        failures.push(
          "width below " + limits.min_width + " " + dimensions.unit,
        );
      if (limits.min_height != null && dimensions.height < limits.min_height)
        failures.push(
          "height below " + limits.min_height + " " + dimensions.unit,
        );
      if (limits.max_width != null && dimensions.width > limits.max_width)
        failures.push(
          "width exceeds " + limits.max_width + " " + dimensions.unit,
        );
      if (limits.max_height != null && dimensions.height > limits.max_height)
        failures.push(
          "height exceeds " + limits.max_height + " " + dimensions.unit,
        );
      if (
        dimensions.unit === "px" &&
        limits.max_pixels != null &&
        dimensions.width * dimensions.height > limits.max_pixels
      )
        failures.push("pixel count exceeds " + limits.max_pixels);
      if (
        dimensions.unit === "px" &&
        limits.texture_bytes_per_pixel != null &&
        canvas.performance.max_texture_memory_bytes != null
      ) {
        var estimated = Math.ceil(
          dimensions.width * dimensions.height * limits.texture_bytes_per_pixel,
        );
        if (estimated > canvas.performance.max_texture_memory_bytes)
          failures.push(
            "estimated texture memory " +
              estimated +
              " bytes exceeds budget " +
              canvas.performance.max_texture_memory_bytes,
          );
      }
      if (
        limits.max_bleed != null &&
        canvas.physical.bleed != null &&
        canvas.physical.bleed > limits.max_bleed
      )
        failures.push(
          "bleed exceeds " + limits.max_bleed + " " + canvas.physical.unit,
        );
      if (
        limits.max_stroke != null &&
        canvas.physical.minimum_stroke != null &&
        canvas.physical.minimum_stroke > limits.max_stroke
      )
        failures.push(
          "minimum stroke exceeds " +
            limits.max_stroke +
            " " +
            canvas.physical.unit,
        );
      if (
        limits.max_tool_width != null &&
        canvas.physical.cutting_tool_width != null &&
        canvas.physical.cutting_tool_width > limits.max_tool_width
      )
        failures.push(
          "tool width exceeds " +
            limits.max_tool_width +
            " " +
            canvas.physical.unit,
        );
      if (
        limits.max_depth != null &&
        canvas.physical.depth != null &&
        canvas.physical.depth > limits.max_depth
      )
        failures.push(
          "depth exceeds " + limits.max_depth + " " + canvas.physical.unit,
        );
      if (
        limits.max_animation_frames != null &&
        canvas.performance.max_animation_frames != null &&
        canvas.performance.max_animation_frames > limits.max_animation_frames
      )
        failures.push(
          "animation frame request exceeds " + limits.max_animation_frames,
        );
      if (
        limits.min_animation_frames != null &&
        canvas.behaviour.indexOf("animated") >= 0 &&
        canvas.performance.max_animation_frames != null &&
        canvas.performance.max_animation_frames < limits.min_animation_frames
      )
        failures.push(
          "animation frame budget is below required minimum " +
            limits.min_animation_frames,
        );
      if (
        limits.min_fps != null &&
        canvas.performance.frames_per_second != null &&
        canvas.performance.frames_per_second < limits.min_fps
      )
        failures.push(
          "frame rate is below supported minimum " + limits.min_fps,
        );
      if (
        limits.max_fps != null &&
        canvas.performance.frames_per_second != null &&
        canvas.performance.frames_per_second > limits.max_fps
      )
        failures.push("frame rate exceeds supported maximum " + limits.max_fps);
      if (
        limits.min_polygon_count != null &&
        canvas.performance.max_polygon_count != null &&
        canvas.performance.max_polygon_count < limits.min_polygon_count
      )
        failures.push(
          "polygon budget is below required minimum " +
            limits.min_polygon_count,
        );
      if (
        limits.min_vertices != null &&
        canvas.performance.max_vertices != null &&
        canvas.performance.max_vertices < limits.min_vertices
      )
        failures.push(
          "vertex budget is below required minimum " + limits.min_vertices,
        );
      if (
        canvas.behaviour.indexOf("animated") >= 0 &&
        canvas.performance.max_duration_seconds != null &&
        limits.min_animation_frames != null
      ) {
        var durationFps =
          canvas.performance.frames_per_second == null
            ? limits.max_fps
            : canvas.performance.frames_per_second;
        if (
          durationFps != null &&
          limits.min_animation_frames / durationFps >
            canvas.performance.max_duration_seconds
        )
          failures.push(
            "duration budget cannot contain the minimum " +
              limits.min_animation_frames +
              " frames at " +
              durationFps +
              " fps",
          );
      }
      if (
        canvas.responsive &&
        canvas.responsive.minimum_target_size != null &&
        descriptor.constraints_honoured.indexOf(
          "responsive.minimum-target-size",
        ) >= 0 &&
        canvas.behaviour.indexOf("interactive") >= 0 &&
        (dimensions.width < canvas.responsive.minimum_target_size ||
          dimensions.height < canvas.responsive.minimum_target_size)
      )
        failures.push(
          "interactive canvas is smaller than minimum target size " +
            canvas.responsive.minimum_target_size +
            " " +
            dimensions.unit,
        );
      return failures;
    }
    function normalizeArtifact(raw, brief, index) {
      raw = raw || {};
      var value = typeof raw.text === "string" ? raw.text : "";
      var dataUrl = typeof raw.dataUrl === "string" ? raw.dataUrl : "";
      var format =
        text(raw.format, 20).toUpperCase() ||
        formatFromMime(raw.mime) ||
        "DATA";
      var artifact = {
        schema: ARTIFACT_SCHEMA,
        id: text(raw.id, 100) || "artifact-" + index,
        role:
          text(raw.role, 60) ||
          (index === 0 ? "editable-source" : "supporting-data"),
        name: text(raw.name, 140) || brief.title,
        filename:
          text(raw.filename, 160) ||
          slug(raw.name || brief.title) +
            "." +
            (format === "SVG"
              ? "svg"
              : format === "JSON"
                ? "json"
                : format.toLowerCase()),
        mime:
          text(raw.mime, 100) ||
          (format === "SVG"
            ? "image/svg+xml"
            : format === "JSON"
              ? "application/json"
              : "application/octet-stream"),
        format: format,
        width: number(raw.width, 0, 16384, brief.canvas.width),
        height: number(raw.height, 0, 16384, brief.canvas.height),
        editable: raw.editable === true,
        text: value,
        dataUrl: dataUrl,
        metadata: clone(raw.metadata || {}),
      };
      artifact.digest = hash([
        artifact.mime,
        artifact.width,
        artifact.height,
        artifact.text,
        artifact.dataUrl,
      ]);
      return artifact;
    }
    function validateSvg(svg) {
      var errors = [];
      svg = String(svg || "");
      if (!/^<svg[\s>]/.test(svg) || !/<\/svg>$/.test(svg))
        errors.push("complete SVG required");
      if (
        /<script|javascript:|<foreignObject|<iframe|<object|<embed|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:text\/html)/i.test(
          svg,
        )
      )
        errors.push("executable or external SVG content refused");
      if (svg.length > 600000)
        errors.push("SVG exceeds the 600 KB hand boundary");
      return errors;
    }
    function validateResult(result) {
      var errors = [];
      if (!result || result.schema !== RESULT_SCHEMA)
        errors.push("asset hand result schema mismatch");
      if (
        !result ||
        !result.hand ||
        [HAND_SCHEMA, LEGACY_HAND_SCHEMA].indexOf(result.hand.schema) < 0
      )
        errors.push("hand descriptor missing");
      if (!result || !result.brief || result.brief.schema !== BRIEF_SCHEMA)
        errors.push("normalized asset brief missing");
      if (
        result &&
        result.target_canvas &&
        !TargetCanvas.validate(result.target_canvas).pass
      )
        errors = errors.concat(
          TargetCanvas.validate(result.target_canvas).errors,
        );
      if (
        !result ||
        !Array.isArray(result.artifacts) ||
        !result.artifacts.length
      )
        errors.push("at least one artifact required");
      ((result && result.artifacts) || []).forEach(function (artifact) {
        var isSvg =
          artifact.mime === "image/svg+xml" || artifact.format === "SVG";
        if (
          isSvg &&
          !(artifact.mime === "image/svg+xml" && artifact.format === "SVG")
        )
          errors.push(artifact.id + ": SVG format and MIME must agree");
        if (isSvg)
          errors = errors.concat(
            validateSvg(artifact.text).map(function (error) {
              return artifact.id + ": " + error;
            }),
          );
        if (
          artifact.format === "JSON" ||
          artifact.mime === "application/json"
        ) {
          try {
            var parsed = JSON.parse(artifact.text),
              contentSchema = artifactContentSchema(artifact);
            if (ArtifactSchemas && contentSchema) {
              var schemaValidation = ArtifactSchemas.validate(
                contentSchema,
                parsed,
              );
              if (schemaValidation.known && !schemaValidation.pass)
                errors = errors.concat(
                  schemaValidation.errors.map(function (error) {
                    return artifact.id + ": " + error;
                  }),
                );
            }
          } catch (error) {
            errors.push(artifact.id + ": valid JSON required");
          }
        }
        if (
          /^image\/(?:png|apng|jpeg|webp)$/.test(artifact.mime) &&
          !new RegExp(
            "^data:" + artifact.mime.replace("/", "\\/") + "(?:;|,)",
            "i",
          ).test(artifact.dataUrl)
        )
          errors.push(
            artifact.id + ": raster artifact requires a matching data URL",
          );
        if (artifact.mime === "image/ktx2" || artifact.format === "KTX2") {
          if (!(artifact.mime === "image/ktx2" && artifact.format === "KTX2"))
            errors.push(artifact.id + ": KTX2 format and MIME must agree");
          if (!/^data:image\/ktx2;base64,/i.test(artifact.dataUrl))
            errors.push(
              artifact.id +
                ": KTX2 artifact requires a matching base64 data URL",
            );
          else if (!KTX2Codec)
            errors.push(artifact.id + ": KTX2 validator is unavailable");
          else {
            try {
              var ktxInspection = KTX2Codec.inspect(
                KTX2Codec.bytesFromDataUrl(artifact.dataUrl, "image/ktx2"),
              );
              if (!ktxInspection.pass)
                errors = errors.concat(
                  ktxInspection.errors.map(function (error) {
                    return artifact.id + ": " + error;
                  }),
                );
            } catch (error) {
              errors.push(artifact.id + ": " + String(error.message || error));
            }
          }
        }
        if (!artifact.text && !artifact.dataUrl)
          errors.push(artifact.id + ": artifact content missing");
      });
      if (
        result &&
        result.previewArtifactId &&
        !(result.artifacts || []).some(function (artifact) {
          return artifact.id === result.previewArtifactId;
        })
      )
        errors.push("preview artifact not found");
      if (
        result &&
        result.creation_recipe &&
        result.creation_recipe.schema !== RECIPE_SCHEMA
      )
        errors.push("creation recipe schema mismatch");
      if (
        result &&
        result.validation_receipt &&
        result.validation_receipt.schema !== VALIDATION_SCHEMA
      )
        errors.push("validation receipt schema mismatch");
      return { pass: errors.length === 0, errors: errors };
    }
    function artifactContentSchema(artifact) {
      var schema = text(
        artifact && artifact.metadata && artifact.metadata.schema,
        120,
      );
      if (
        !schema &&
        artifact &&
        (artifact.mime === "application/json" || artifact.format === "JSON") &&
        artifact.text
      ) {
        try {
          var parsed = JSON.parse(artifact.text);
          schema = text(parsed && (parsed.schema || parsed.format), 120);
        } catch (error) {}
      }
      return schema;
    }
    function artifactMatchesToken(artifact, required) {
      var token = String(required || "").toLowerCase();
      return (
        String(artifact.mime || "").toLowerCase() === token ||
        String(artifact.format || "").toLowerCase() === token ||
        String(artifactContentSchema(artifact) || "").toLowerCase() === token
      );
    }
    function artifactMatchesOutputType(artifact, output) {
      if (
        output.mime &&
        String(output.mime).toLowerCase() !==
          String(artifact.mime || "").toLowerCase()
      )
        return false;
      if (
        output.format &&
        String(output.format).toLowerCase() !==
          String(artifact.format || "").toLowerCase()
      )
        return false;
      if (
        output.schema &&
        String(output.schema).toLowerCase() !==
          String(artifactContentSchema(artifact) || "").toLowerCase()
      )
        return false;
      if (artifact.editable !== output.editable) return false;
      return true;
    }
    function artifactBytes(artifact) {
      if (artifact.text) return artifact.text.length;
      var data = String(artifact.dataUrl || ""),
        comma = data.indexOf(",");
      if (comma < 0) return data.length;
      var body = data.slice(comma + 1);
      return /;base64,/i.test(data.slice(0, comma + 1))
        ? Math.floor((body.length * 3) / 4)
        : body.length;
    }
    function postconditionChecks(result, descriptor, normalized, draft) {
      var checks = [],
        artifacts = result.artifacts || [],
        recipe = result.creation_recipe || {},
        quality = normalized.quality_requirements;
      function add(name, pass, details) {
        checks.push({ name: name, pass: !!pass, details: details || null });
      }
      add(
        "target-canvas-effective-preserved",
        hash(result.target_canvas) === hash(normalized.target_canvas),
      );
      add(
        "target-canvas-original-preserved",
        hash(result.target_canvas_original) ===
          hash(normalized.target_canvas_original),
      );
      normalized.required_outputs.forEach(function (required) {
        add(
          "required-output:" + required,
          artifacts.some(function (artifact) {
            return artifactMatchesToken(artifact, required);
          }),
          { required: required },
        );
      });
      normalized.editable_recipe_formats.forEach(function (required) {
        var pass =
          required === RECIPE_SCHEMA
            ? recipe.schema === RECIPE_SCHEMA
            : recipe.format === required ||
              artifacts.some(function (artifact) {
                return (
                  artifact.editable &&
                  artifactContentSchema(artifact) === required
                );
              });
        add("editable-recipe:" + required, pass, {
          required: required,
          actual: recipe.format,
        });
      });
      add(
        "declared-artifact-types",
        artifacts.every(function (artifact) {
          return descriptor.output_types.some(function (output) {
            return artifactMatchesOutputType(artifact, output);
          });
        }),
        {
          undeclared: artifacts
            .filter(function (artifact) {
              return !descriptor.output_types.some(function (output) {
                return artifactMatchesOutputType(artifact, output);
              });
            })
            .map(function (artifact) {
              return artifact.id;
            }),
        },
      );
      if (quality.require_editable_source)
        add(
          "editable-source-emitted",
          artifacts.some(function (artifact) {
            return artifact.editable;
          }),
        );
      if (quality.require_preview)
        add(
          "required-preview-emitted",
          !!(result.preview && result.preview.available),
        );
      var totalBytes = artifacts.reduce(function (sum, artifact) {
        return sum + artifactBytes(artifact);
      }, 0);
      if (normalized.target_canvas.performance.max_file_bytes != null)
        add(
          "core-file-budget",
          totalBytes <= normalized.target_canvas.performance.max_file_bytes,
          {
            actual: totalBytes,
            maximum: normalized.target_canvas.performance.max_file_bytes,
          },
        );
      var qualityScore = Number(
        draft.qualityScore != null
          ? draft.qualityScore
          : draft.measures && draft.measures.qualityScore,
      );
      if (quality.minimum_quality_score > 0)
        add(
          "minimum-quality-score",
          Number.isFinite(qualityScore) &&
            qualityScore >= quality.minimum_quality_score,
          {
            actual: Number.isFinite(qualityScore) ? qualityScore : null,
            minimum: quality.minimum_quality_score,
          },
        );
      return checks;
    }
    function makeResult(provider, brief, draft, options) {
      options = options || {};
      draft = draft || {};
      var descriptor = normalizeDescriptor(provider.descriptor);
      var normalized = normalizeBrief(brief);
      var artifacts = (draft.artifacts || []).map(function (artifact, index) {
        return normalizeArtifact(artifact, normalized, index);
      });
      var seed =
        text(options.seed, 180) ||
        normalized.id +
          ":" +
          descriptor.id +
          ":" +
          number(options.variant, 0, 999, 0);
      var createdAt = text(options.createdAt, 40) || new Date().toISOString();
      var recipeDraft = draft.recipe || {};
      var recipe = {
        schema: RECIPE_SCHEMA,
        format:
          text(recipeDraft.format, 100) ||
          descriptor.editable_recipe_formats[0] ||
          RECIPE_SCHEMA,
        hand: { id: descriptor.id, version: descriptor.version },
        operation_mode: normalized.operation_mode,
        source_artifact_digests: normalized.source_artifacts.map(
          function (artifact) {
            return {
              id: artifact.id,
              digest: artifact.digest,
              mime: artifact.mime,
              content_schema: artifact.content_schema,
            };
          },
        ),
        seed: seed,
        target_canvas: clone(normalized.target_canvas),
        target_canvas_original: clone(normalized.target_canvas_original),
        canvas_transformations:
          normalized.target_canvas_validation.transformations.slice(),
        intended_use: normalized.intended_use,
        parameters: clone(recipeDraft.parameters || {}),
        steps: (Array.isArray(recipeDraft.steps) ? recipeDraft.steps : [])
          .map(function (step) {
            return clone(step);
          })
          .slice(0, 100),
        editable: descriptor.emits_editable_source,
        deterministic: descriptor.deterministic,
      };
      var result = {
        schema: RESULT_SCHEMA,
        id:
          "hand-result-" +
          hash([
            descriptor.id,
            descriptor.version,
            normalized,
            seed,
            artifacts.map(function (artifact) {
              return artifact.digest;
            }),
          ]),
        hand: descriptor,
        brief: normalized,
        target_canvas: clone(normalized.target_canvas),
        target_canvas_original: clone(normalized.target_canvas_original),
        canvas_transform_receipt: {
          status: normalized.target_canvas_validation.transformations.length
            ? "TRANSFORMED"
            : "UNCHANGED",
          transformations:
            normalized.target_canvas_validation.transformations.slice(),
          original_digest: hash(normalized.target_canvas_original),
          effective_digest: hash(normalized.target_canvas),
        },
        variant: number(options.variant, 0, 999, 0),
        seed: seed,
        artifacts: artifacts,
        previewArtifactId:
          text(draft.previewArtifactId, 100) ||
          (artifacts[0] && artifacts[0].id) ||
          null,
        preview: null,
        creation_recipe: recipe,
        measures: clone(draft.measures || {}),
        notes: unique(draft.notes, 20),
        provenance: {
          createdAt: createdAt,
          handId: descriptor.id,
          handVersion: descriptor.version,
          engine: clone(descriptor.engine),
          deterministic: descriptor.deterministic,
          authority: descriptor.authority,
          sourceBriefId: normalized.id,
          operationMode: normalized.operation_mode,
          sourceArtifacts: normalized.source_artifacts.map(function (artifact) {
            return {
              id: artifact.id,
              digest: artifact.digest,
              mime: artifact.mime,
              content_schema: artifact.content_schema,
            };
          }),
          handContract: descriptor.schema,
          targetCanvasOriginalDigest: hash(normalized.target_canvas_original),
          targetCanvasEffectiveDigest: hash(normalized.target_canvas),
        },
      };
      var previewArtifact = artifacts.find(function (artifact) {
        return artifact.id === result.previewArtifactId;
      });
      if (previewArtifact && descriptor.operations.preview)
        result.preview = {
          artifactId: previewArtifact.id,
          mime: previewArtifact.mime,
          format: previewArtifact.format,
          available: true,
        };
      var validation = validateResult(result),
        draftChecks = Array.isArray(draft.validationChecks)
          ? draft.validationChecks
          : [],
        postChecks = postconditionChecks(result, descriptor, normalized, draft);
      draftChecks.concat(postChecks).forEach(function (check) {
        if (check && check.pass === false)
          validation.errors.push(
            text(check.name || check.error, 180) ||
              "provider canvas check failed",
          );
      });
      validation.pass = validation.errors.length === 0;
      result.validation_receipt = {
        schema: VALIDATION_SCHEMA,
        status: validation.pass ? "PASS" : "HOLD",
        validator: {
          id: descriptor.id,
          version: descriptor.version,
          capability: descriptor.operations.validate,
        },
        target_canvas_digest: hash(result.target_canvas),
        artifact_digests: artifacts.map(function (artifact) {
          return {
            id: artifact.id,
            digest: artifact.digest,
            mime: artifact.mime,
          };
        }),
        checks: [
          {
            name: "core-artifact-envelope",
            pass: validateResult(result).pass,
            errors: validateResult(result).errors.slice(),
          },
        ].concat(
          draftChecks.map(function (check) {
            return clone(check);
          }),
          postChecks.map(function (check) {
            return clone(check);
          }),
        ),
        createdAt: createdAt,
      };
      result.status = validation.pass ? "READY" : "HOLD";
      result.failure_code = validation.pass ? null : "HAND_OUTPUT_REJECTED";
      result.technical = {
        pass: validation.pass,
        errors: validation.errors.slice(),
        validationReceipt: VALIDATION_SCHEMA,
      };
      result.digest = hash([
        result.hand.id,
        result.brief,
        result.artifacts.map(function (artifact) {
          return artifact.digest;
        }),
      ]);
      return result;
    }
    function compatibility(provider, brief, host) {
      host = host || {};
      var descriptor = normalizeDescriptor(provider.descriptor);
      var normalized = normalizeBrief(brief);
      if (!normalized.target_canvas_validation.pass)
        return {
          compatible: false,
          score: 0,
          code: "INVALID_CANVAS",
          reason:
            "declared target canvas is invalid: " +
            normalized.target_canvas_validation.errors.join(", "),
          missing: normalized.target_canvas_validation.errors.slice(),
          hand: descriptor,
        };
      if (descriptor.implementation_status !== "executable")
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "hand is a non-executable extension placeholder",
          hand: descriptor,
        };
      if (descriptor.operation_modes.indexOf(normalized.operation_mode) < 0)
        return {
          compatible: false,
          score: 0,
          code: "UNSUPPORTED_OPERATION",
          reason: "operation mode not supported: " + normalized.operation_mode,
          missing: [normalized.operation_mode],
          hand: descriptor,
        };
      if (
        normalized.operation_mode === "edit" &&
        (!descriptor.supports_edit_operation ||
          descriptor.mutability === "read-only")
      )
        return {
          compatible: false,
          score: 0,
          code: "UNSUPPORTED_OPERATION",
          reason: "hand does not implement source edit operations",
          missing: ["implemented edit capability"],
          hand: descriptor,
        };
      function inputMatches(source, input) {
        var bytes = (source.text || "").length + (source.dataUrl || "").length;
        return (
          (!input.mime ||
            input.mime === "*/*" ||
            input.mime.toLowerCase() === source.mime.toLowerCase()) &&
          (!input.format ||
            input.format === "*" ||
            input.format.toLowerCase() === source.format.toLowerCase()) &&
          (!input.schema ||
            input.schema === "*" ||
            input.schema === source.content_schema) &&
          (!input.roles.length ||
            input.roles.indexOf(source.role) >= 0 ||
            (input.roles.indexOf("source") >= 0 && source.editable)) &&
          bytes <= input.max_bytes
        );
      }
      if (normalized.source_artifacts.length && !descriptor.input_types.length)
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "hand declares no compatible source-artifact inputs",
          missing: normalized.source_artifacts.map(function (artifact) {
            return artifact.mime;
          }),
          hand: descriptor,
        };
      var unmatchedSources = normalized.source_artifacts.filter(
        function (source) {
          return !descriptor.input_types.some(function (input) {
            return inputMatches(source, input);
          });
        },
      );
      if (unmatchedSources.length)
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason:
            "source artifact type unsupported: " +
            unmatchedSources
              .map(function (artifact) {
                return artifact.content_schema || artifact.mime;
              })
              .join(", "),
          missing: unmatchedSources.map(function (artifact) {
            return artifact.content_schema || artifact.mime;
          }),
          hand: descriptor,
        };
      var requiredInputs = descriptor.input_types.filter(function (input) {
        return input.required_for.indexOf(normalized.operation_mode) >= 0;
      });
      if (
        requiredInputs.length &&
        !normalized.source_artifacts.some(function (source) {
          return requiredInputs.some(function (input) {
            return inputMatches(source, input);
          });
        })
      )
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason:
            "operation requires one compatible source artifact: " +
            requiredInputs
              .map(function (input) {
                return input.schema || input.mime || input.format;
              })
              .join(", "),
          missing: requiredInputs.map(function (input) {
            return input.schema || input.mime || input.format;
          }),
          hand: descriptor,
        };
      var exact = descriptor.kinds.indexOf(normalized.kind) >= 0;
      var fallback = descriptor.kinds.indexOf("*") >= 0;
      if (!exact && !fallback)
        return {
          compatible: false,
          score: 0,
          code: "UNSUPPORTED_KIND",
          reason: "kind not supported",
          hand: descriptor,
        };
      if (
        !exact &&
        fallback &&
        descriptor.wildcard_kind_policy === "fallback" &&
        normalized.fallback_policy.generalist !== "permitted"
      )
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "generalist fallback is forbidden by the request",
          missing: ["fallback_policy.generalist=permitted"],
          hand: descriptor,
        };
      var canvas = normalized.target_canvas;
      var profiles = descriptor.canvas_types.filter(function (profile) {
        return profile.medium === canvas.medium || profile.medium === "*";
      });
      if (!profiles.length)
        return {
          compatible: false,
          score: 0,
          code: "UNSUPPORTED_CANVAS",
          reason: "target canvas medium not understood: " + canvas.medium,
          hand: descriptor,
        };
      var canvasProfile = profiles.find(function (profile) {
        var locale = String(canvas.responsive.locale || ""),
          localeMatch =
            !locale ||
            !profile.locale_patterns.length ||
            profile.locale_patterns.some(function (pattern) {
              return (
                locale.toLowerCase() === pattern.toLowerCase() ||
                locale.toLowerCase().indexOf(pattern.toLowerCase() + "-") === 0
              );
            });
        return (
          (!profile.units.length ||
            profile.units.indexOf(canvas.dimensions.unit) >= 0) &&
          (!profile.colour_spaces.length ||
            profile.colour_spaces.indexOf(canvas.colour.space) >= 0) &&
          (!profile.transparency_modes.length ||
            profile.transparency_modes.indexOf(canvas.colour.transparency) >=
              0) &&
          localeMatch &&
          (!profile.up_axes.length ||
            profile.up_axes.indexOf(canvas.spatial.up_axis) >= 0) &&
          (!profile.handedness.length ||
            profile.handedness.indexOf(canvas.spatial.handedness) >= 0) &&
          (!canvas.physical.material_behaviour.length ||
            profile.material_behaviours.indexOf("*") >= 0 ||
            canvas.physical.material_behaviour.every(function (behaviour) {
              return profile.material_behaviours.indexOf(behaviour) >= 0;
            })) &&
          canvas.behaviour.every(function (behaviour) {
            return (
              !profile.behaviours.length ||
              profile.behaviours.indexOf(behaviour) >= 0
            );
          }) &&
          (!profile.intended_uses.length ||
            profile.intended_uses.indexOf(normalized.intended_use) >= 0 ||
            profile.intended_uses.indexOf(normalized.kind) >= 0 ||
            profile.intended_uses.indexOf("*") >= 0)
        );
      });
      if (!canvasProfile)
        return {
          compatible: false,
          score: 0,
          code: "UNSUPPORTED_CANVAS",
          reason:
            "canvas unit, colour space, locale, spatial convention, behaviour or intended use is unsupported",
          hand: descriptor,
        };
      var limitFailures = canvasLimitFailures(descriptor, canvas);
      if (limitFailures.length)
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "canvas exceeds hand limits: " + limitFailures.join(", "),
          missing: limitFailures,
          hand: descriptor,
        };
      var requestedConstraints = TargetCanvas.requestedConstraints(canvas);
      var missingConstraints = requestedConstraints.filter(
        function (constraint) {
          return (
            descriptor.constraints_honoured.indexOf(constraint) < 0 &&
            descriptor.constraints_honoured.indexOf("*") < 0
          );
        },
      );
      if (missingConstraints.length)
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "hand cannot honour: " + missingConstraints.join(", "),
          missing: missingConstraints,
          hand: descriptor,
        };
      function outputMatches(required) {
        var token = String(required || "").toLowerCase();
        return descriptor.output_types.some(function (output) {
          return (
            String(output.mime || "").toLowerCase() === token ||
            String(output.format || "").toLowerCase() === token ||
            String(output.schema || "").toLowerCase() === token
          );
        });
      }
      var missingOutputs = normalized.required_outputs.filter(
        function (required) {
          return !outputMatches(required);
        },
      );
      if (missingOutputs.length)
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "required output unavailable: " + missingOutputs.join(", "),
          missing: missingOutputs,
          hand: descriptor,
        };
      var missingRecipes = normalized.editable_recipe_formats.filter(
        function (format) {
          return descriptor.editable_recipe_formats.indexOf(format) < 0;
        },
      );
      if (missingRecipes.length)
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason:
            "editable recipe format unavailable: " + missingRecipes.join(", "),
          missing: missingRecipes,
          hand: descriptor,
        };
      if (
        normalized.quality_requirements.require_preview &&
        !descriptor.operations.preview
      )
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "preview capability required",
          hand: descriptor,
        };
      if (
        normalized.quality_requirements.require_validation &&
        !descriptor.operations.validate
      )
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "validation capability required",
          hand: descriptor,
        };
      if (
        normalized.quality_requirements.require_editable_source &&
        !descriptor.emits_editable_source
      )
        return {
          compatible: false,
          score: 0,
          code: "MISSING_HAND",
          reason: "editable source artifact required",
          hand: descriptor,
        };
      var hostCapabilities = unique(host.capabilities, 50);
      var missing = hostCapabilities.length
        ? descriptor.requires.filter(function (required) {
            return hostCapabilities.indexOf(required) < 0;
          })
        : [];
      if (missing.length)
        return {
          compatible: false,
          score: 0,
          code: "HOST_INCOMPATIBLE",
          reason: "host capability missing: " + missing.join(", "),
          missing: missing,
          hand: descriptor,
        };
      var hostPermissions = unique(host.permissions, 50);
      var requiredPermissions = [];
      if (descriptor.required_permissions.local_file_system !== "none")
        requiredPermissions.push(
          "filesystem:" + descriptor.required_permissions.local_file_system,
        );
      if (descriptor.required_permissions.clipboard)
        requiredPermissions.push("clipboard");
      if (descriptor.required_permissions.plugin_data)
        requiredPermissions.push("plugin-data");
      descriptor.required_permissions.device_access.forEach(function (device) {
        requiredPermissions.push("device:" + device);
      });
      var deniedPermissions = requiredPermissions.filter(function (permission) {
        return hostPermissions.indexOf(permission) < 0;
      });
      if (deniedPermissions.length)
        return {
          compatible: false,
          score: 0,
          code: "HOST_INCOMPATIBLE",
          reason: "host permission missing: " + deniedPermissions.join(", "),
          missing: deniedPermissions,
          hand: descriptor,
        };
      if (descriptor.network_policy.mode === "allowlist") {
        var hostDomains = unique(
          host.networkDomains || host.network_domains,
          50,
        );
        var deniedDomains = descriptor.network_policy.domains.filter(
          function (domain) {
            return hostDomains.indexOf(domain) < 0;
          },
        );
        if (deniedDomains.length)
          return {
            compatible: false,
            score: 0,
            code: "HOST_INCOMPATIBLE",
            reason:
              "network domain not allowed by host: " + deniedDomains.join(", "),
            missing: deniedDomains,
            hand: descriptor,
          };
      }
      var accepts = unique(host.accepts, 50);
      if (
        accepts.length &&
        accepts.indexOf(RESULT_SCHEMA) < 0 &&
        !descriptor.produces.some(function (item) {
          return accepts.indexOf(item) >= 0;
        })
      ) {
        return {
          compatible: false,
          score: 0,
          code: "HOST_INCOMPATIBLE",
          reason: "host accepts none of the hand outputs",
          hand: descriptor,
        };
      }
      var score = exact ? 100 : 15;
      if (canvasProfile.medium === canvas.medium) score += 30;
      score += Math.min(20, requestedConstraints.length);
      if (descriptor.emits_editable_source) score += 8;
      if (descriptor.deterministic) score += 4;
      if (normalized.source_artifacts.length) score += 6;
      return {
        compatible: true,
        score: score,
        code: "COMPATIBLE",
        reason:
          normalized.operation_mode +
          " - " +
          (exact ? "exact asset-kind" : "permitted general asset-kind") +
          " + " +
          canvas.medium +
          " canvas match",
        canvasProfile: clone(canvasProfile),
        hand: descriptor,
      };
    }
    function createRegistry(initialProviders) {
      var providers = {};
      function register(provider) {
        if (
          !provider ||
          !provider.descriptor ||
          (typeof provider.create !== "function" &&
            typeof provider.createAsync !== "function")
        )
          throw new Error(
            "asset hand requires a descriptor and create or createAsync function",
          );
        var contract = validateDescriptor(provider.descriptor);
        if (!contract.pass)
          throw new Error(
            "invalid asset hand descriptor: " + contract.errors.join("; "),
          );
        var descriptor = contract.descriptor;
        if (!descriptor.id || providers[descriptor.id])
          throw new Error(
            "asset hand id is missing or already registered: " + descriptor.id,
          );
        providers[descriptor.id] = {
          descriptor: descriptor,
          create:
            typeof provider.create === "function" ? provider.create : null,
          createAsync:
            typeof provider.createAsync === "function"
              ? provider.createAsync
              : null,
        };
        return clone(descriptor);
      }
      (initialProviders || []).forEach(register);
      function list() {
        return Object.keys(providers)
          .sort()
          .map(function (id) {
            return clone(providers[id].descriptor);
          });
      }
      function routes(brief, host) {
        return Object.keys(providers)
          .map(function (id) {
            return compatibility(providers[id], brief, host);
          })
          .filter(function (route) {
            return route.compatible;
          })
          .sort(function (left, right) {
            return (
              right.score - left.score ||
              left.hand.id.localeCompare(right.hand.id)
            );
          });
      }
      function diagnose(brief, host) {
        var normalized = normalizeBrief(brief);
        var inspected = Object.keys(providers).map(function (id) {
          return compatibility(providers[id], normalized, host);
        });
        var compatible = inspected
          .filter(function (route) {
            return route.compatible;
          })
          .sort(function (left, right) {
            return (
              right.score - left.score ||
              left.hand.id.localeCompare(right.hand.id)
            );
          });
        var anyCanvas = inspected.some(function (route) {
          return route.hand.canvas_types.some(function (profile) {
            return (
              profile.medium === normalized.target_canvas.medium ||
              profile.medium === "*"
            );
          });
        });
        var status = !normalized.target_canvas_validation.pass
          ? "INVALID_CANVAS"
          : compatible.length
            ? "READY"
            : anyCanvas
              ? "MISSING_HAND"
              : "UNSUPPORTED_CANVAS";
        var constraints = TargetCanvas.requestedConstraints(
          normalized.target_canvas,
        );
        return {
          schema: GAP_SCHEMA,
          status: status,
          request: {
            kind: normalized.kind,
            operation_mode: normalized.operation_mode,
            intended_use: normalized.intended_use,
            target_canvas: clone(normalized.target_canvas),
            target_canvas_original: clone(normalized.target_canvas_original),
            target_canvas_validation: clone(
              normalized.target_canvas_validation,
            ),
            fallback_policy: clone(normalized.fallback_policy),
            required_outputs: normalized.required_outputs.slice(),
            editable_recipe_formats: normalized.editable_recipe_formats.slice(),
            quality_requirements: clone(normalized.quality_requirements),
            source_artifacts: normalized.source_artifacts.map(
              function (artifact) {
                return {
                  id: artifact.id,
                  role: artifact.role,
                  mime: artifact.mime,
                  format: artifact.format,
                  content_schema: artifact.content_schema,
                  digest: artifact.digest,
                };
              },
            ),
          },
          compatible_hands: compatible.map(function (route) {
            return {
              id: route.hand.id,
              version: route.hand.version,
              score: route.score,
              reason: route.reason,
            };
          }),
          missing_hand_spec: compatible.length
            ? null
            : {
                kinds: [normalized.kind],
                operation_modes: [normalized.operation_mode],
                input_types: normalized.source_artifacts.map(
                  function (artifact) {
                    return {
                      mime: artifact.mime,
                      format: artifact.format,
                      schema: artifact.content_schema,
                      roles: [artifact.role],
                      required_for: [normalized.operation_mode],
                    };
                  },
                ),
                output_types: normalized.required_outputs.slice(),
                canvas_types: [
                  {
                    medium: normalized.target_canvas.medium,
                    units: [normalized.target_canvas.dimensions.unit],
                    colour_spaces: [normalized.target_canvas.colour.space],
                    transparency_modes: [
                      normalized.target_canvas.colour.transparency,
                    ],
                    material_behaviours:
                      normalized.target_canvas.physical.material_behaviour.slice(),
                    behaviours: normalized.target_canvas.behaviour.slice(),
                    intended_uses: [normalized.intended_use],
                  },
                ],
                constraints_honoured: constraints,
                editable_recipe_formats:
                  normalized.editable_recipe_formats.slice(),
                operations: {
                  preview: normalized.quality_requirements.require_preview,
                  validate: normalized.quality_requirements.require_validation,
                  edit: normalized.quality_requirements.require_editable_source,
                },
              },
          rejections: inspected
            .filter(function (route) {
              return !route.compatible;
            })
            .map(function (route) {
              return {
                handId: route.hand.id,
                code: route.code,
                reason: route.reason,
                missing: (route.missing || []).slice(),
              };
            }),
        };
      }
      function create(handId, brief, options) {
        var provider = providers[handId];
        if (!provider) throw new Error("asset hand not registered: " + handId);
        if (!provider.create)
          throw new Error(handId + " requires the asynchronous create API");
        var route = compatibility(provider, brief, options && options.host);
        if (!route.compatible)
          throw new Error(handId + " is incompatible: " + route.reason);
        var normalized = normalizeBrief(brief);
        var opts = options || {};
        var seed =
          text(opts.seed, 180) ||
          normalized.id + ":" + handId + ":" + number(opts.variant, 0, 999, 0);
        var draft = provider.create({
          brief: normalized,
          operationMode: normalized.operation_mode,
          sourceArtifacts: clone(normalized.source_artifacts),
          targetCanvas: clone(normalized.target_canvas),
          qualityRequirements: clone(normalized.quality_requirements),
          requiredOutputs: normalized.required_outputs.slice(),
          editableRecipeFormats: normalized.editable_recipe_formats.slice(),
          variant: number(opts.variant, 0, 999, 0),
          seed: seed,
          random: rng(seed),
          palette: paletteFor(normalized, opts.variant),
          core: api,
        });
        if (draft && typeof draft.then === "function")
          throw new Error(
            handId +
              " returned asynchronous work through the synchronous create API",
          );
        return makeResult(provider, normalized, draft, {
          seed: seed,
          variant: opts.variant,
          createdAt: opts.createdAt,
        });
      }
      async function createAsync(handId, brief, options) {
        var provider = providers[handId];
        if (!provider) throw new Error("asset hand not registered: " + handId);
        var route = compatibility(provider, brief, options && options.host);
        if (!route.compatible)
          throw new Error(handId + " is incompatible: " + route.reason);
        var normalized = normalizeBrief(brief),
          opts = options || {};
        var seed =
          text(opts.seed, 180) ||
          normalized.id + ":" + handId + ":" + number(opts.variant, 0, 999, 0);
        var context = {
          brief: normalized,
          operationMode: normalized.operation_mode,
          sourceArtifacts: clone(normalized.source_artifacts),
          targetCanvas: clone(normalized.target_canvas),
          qualityRequirements: clone(normalized.quality_requirements),
          requiredOutputs: normalized.required_outputs.slice(),
          editableRecipeFormats: normalized.editable_recipe_formats.slice(),
          variant: number(opts.variant, 0, 999, 0),
          seed: seed,
          random: rng(seed),
          palette: paletteFor(normalized, opts.variant),
          core: api,
        };
        var draft = provider.createAsync
          ? await provider.createAsync(context)
          : await Promise.resolve(provider.create(context));
        return makeResult(provider, normalized, draft, {
          seed: seed,
          variant: opts.variant,
          createdAt: opts.createdAt,
        });
      }
      function createFamily(brief, options) {
        options = options || {};
        var normalized = normalizeBrief(brief);
        var diagnosis = diagnose(normalized, options.host);
        var inspected = Object.keys(providers).map(function (id) {
          return compatibility(providers[id], normalized, options.host);
        });
        var available = inspected
          .filter(function (route) {
            return route.compatible;
          })
          .sort(function (left, right) {
            return (
              right.score - left.score ||
              left.hand.id.localeCompare(right.hand.id)
            );
          });
        var requested = unique(options.handIds, 30);
        if (requested.length)
          available = available.filter(function (route) {
            return requested.indexOf(route.hand.id) >= 0;
          });
        var maxHands = number(options.maxHands, 1, 12, 4);
        var chosen = available.slice(0, maxHands);
        var results = [],
          failures = [];
        chosen.forEach(function (route, index) {
          try {
            var result = create(route.hand.id, normalized, {
              variant: number(options.variant, 0, 999, 0) + index,
              seed:
                text(options.seed, 120) ||
                normalized.id + ":" + route.hand.id + ":" + index,
              createdAt: options.createdAt,
              host: options.host,
            });
            if (!result.technical.pass)
              failures.push({
                handId: route.hand.id,
                errors: result.technical.errors,
              });
            else results.push(result);
          } catch (error) {
            failures.push({
              handId: route.hand.id,
              errors: [String(error.message || error)],
            });
          }
        });
        var status = results.length
          ? failures.length
            ? "PARTIAL"
            : "READY"
          : "MISSING_HAND";
        var issue = null;
        if (!available.length) {
          var anyCanvas = inspected.some(function (route) {
            return route.hand.canvas_types.some(function (profile) {
              return (
                profile.medium === normalized.target_canvas.medium ||
                profile.medium === "*"
              );
            });
          });
          status = diagnosis.status;
          issue = {
            code: status,
            message:
              status === "INVALID_CANVAS"
                ? "The declared target canvas is invalid and was not sent to a hand."
                : status === "UNSUPPORTED_CANVAS"
                  ? "No installed hand understands the declared target canvas."
                  : "No installed hand can honour the complete canvas, output and recipe contract.",
            target_canvas: clone(normalized.target_canvas),
            missing_hand_spec: clone(diagnosis.missing_hand_spec),
            gap_report: clone(diagnosis),
            rejected: inspected.map(function (route) {
              return {
                handId: route.hand.id,
                code: route.code,
                reason: route.reason,
              };
            }),
          };
        } else if (!results.length)
          issue = {
            code: "MISSING_HAND",
            message:
              "Compatible hands were found but every creation attempt was held.",
            target_canvas: clone(normalized.target_canvas),
            rejected: failures.slice(),
          };
        return {
          schema: FAMILY_SCHEMA,
          status: status,
          brief: normalized,
          target_canvas: clone(normalized.target_canvas),
          diagnosis: diagnosis,
          routes: available.map(function (route) {
            return {
              hand: route.hand,
              score: route.score,
              reason: route.reason,
              canvasProfile: route.canvasProfile,
            };
          }),
          results: results,
          failures: failures,
          issues: issue ? [issue] : [],
        };
      }
      async function createFamilyAsync(brief, options) {
        options = options || {};
        var normalized = normalizeBrief(brief),
          diagnosis = diagnose(normalized, options.host);
        var inspected = Object.keys(providers).map(function (id) {
          return compatibility(providers[id], normalized, options.host);
        });
        var available = inspected
          .filter(function (route) {
            return route.compatible;
          })
          .sort(function (left, right) {
            return (
              right.score - left.score ||
              left.hand.id.localeCompare(right.hand.id)
            );
          });
        var requested = unique(options.handIds, 30);
        if (requested.length)
          available = available.filter(function (route) {
            return requested.indexOf(route.hand.id) >= 0;
          });
        var maxHands = number(options.maxHands, 1, 12, 4),
          chosen = available.slice(0, maxHands),
          results = [],
          failures = [];
        for (var index = 0; index < chosen.length; index += 1) {
          var route = chosen[index];
          try {
            var result = await createAsync(route.hand.id, normalized, {
              variant: number(options.variant, 0, 999, 0) + index,
              seed:
                text(options.seed, 120) ||
                normalized.id + ":" + route.hand.id + ":" + index,
              createdAt: options.createdAt,
              host: options.host,
            });
            if (!result.technical.pass)
              failures.push({
                handId: route.hand.id,
                errors: result.technical.errors,
              });
            else results.push(result);
          } catch (error) {
            failures.push({
              handId: route.hand.id,
              errors: [String(error.message || error)],
            });
          }
        }
        var status = results.length
            ? failures.length
              ? "PARTIAL"
              : "READY"
            : "MISSING_HAND",
          issue = null;
        if (!available.length) {
          status = diagnosis.status;
          issue = {
            code: status,
            message:
              status === "INVALID_CANVAS"
                ? "The declared target canvas is invalid and was not sent to a hand."
                : status === "UNSUPPORTED_CANVAS"
                  ? "No installed hand understands the declared target canvas."
                  : "No installed hand can honour the complete canvas, output and recipe contract.",
            target_canvas: clone(normalized.target_canvas),
            missing_hand_spec: clone(diagnosis.missing_hand_spec),
            gap_report: clone(diagnosis),
            rejected: inspected.map(function (candidate) {
              return {
                handId: candidate.hand.id,
                code: candidate.code,
                reason: candidate.reason,
              };
            }),
          };
        } else if (!results.length)
          issue = {
            code: "MISSING_HAND",
            message:
              "Compatible hands were found but every creation attempt was held.",
            target_canvas: clone(normalized.target_canvas),
            rejected: failures.slice(),
          };
        return {
          schema: FAMILY_SCHEMA,
          status: status,
          brief: normalized,
          target_canvas: clone(normalized.target_canvas),
          diagnosis: diagnosis,
          routes: available.map(function (candidate) {
            return {
              hand: candidate.hand,
              score: candidate.score,
              reason: candidate.reason,
              canvasProfile: candidate.canvasProfile,
            };
          }),
          results: results,
          failures: failures,
          issues: issue ? [issue] : [],
        };
      }
      function verifyDeterminism(handId, brief, options) {
        var provider = providers[handId],
          opts = options || {};
        if (!provider) throw new Error("asset hand not registered: " + handId);
        if (
          !provider.descriptor ||
          normalizeDescriptor(provider.descriptor).deterministic === false
        )
          return {
            handId: handId,
            declared: false,
            pass: null,
            reason: "hand explicitly declares nondeterministic output",
          };
        var fixed = {
          seed:
            text(opts.seed, 180) ||
            "determinism:" + normalizeBrief(brief).id + ":" + handId,
          createdAt: text(opts.createdAt, 40) || "2000-01-01T00:00:00.000Z",
          variant: number(opts.variant, 0, 999, 0),
          host: opts.host,
        };
        var first = create(handId, brief, fixed),
          second = create(handId, brief, fixed);
        var pass =
          first.digest === second.digest &&
          hash(first.creation_recipe) === hash(second.creation_recipe) &&
          hash(first.artifacts) === hash(second.artifacts);
        return {
          handId: handId,
          declared: true,
          pass: pass,
          firstDigest: first.digest,
          secondDigest: second.digest,
          recipeMatch:
            hash(first.creation_recipe) === hash(second.creation_recipe),
          artifactsMatch: hash(first.artifacts) === hash(second.artifacts),
        };
      }
      async function verifyDeterminismAsync(handId, brief, options) {
        var provider = providers[handId],
          opts = options || {};
        if (!provider) throw new Error("asset hand not registered: " + handId);
        if (
          !provider.descriptor ||
          normalizeDescriptor(provider.descriptor).deterministic === false
        )
          return {
            handId: handId,
            declared: false,
            pass: null,
            reason: "hand explicitly declares nondeterministic output",
          };
        var fixed = {
          seed:
            text(opts.seed, 180) ||
            "determinism:" + normalizeBrief(brief).id + ":" + handId,
          createdAt: text(opts.createdAt, 40) || "2000-01-01T00:00:00.000Z",
          variant: number(opts.variant, 0, 999, 0),
          host: opts.host,
        };
        var first = await createAsync(handId, brief, fixed),
          second = await createAsync(handId, brief, fixed);
        var pass =
          first.digest === second.digest &&
          hash(first.creation_recipe) === hash(second.creation_recipe) &&
          hash(first.artifacts) === hash(second.artifacts);
        return {
          handId: handId,
          declared: true,
          pass: pass,
          firstDigest: first.digest,
          secondDigest: second.digest,
          recipeMatch:
            hash(first.creation_recipe) === hash(second.creation_recipe),
          artifactsMatch: hash(first.artifacts) === hash(second.artifacts),
        };
      }
      return {
        register: register,
        list: list,
        routes: routes,
        diagnose: diagnose,
        create: create,
        createAsync: createAsync,
        createFamily: createFamily,
        createFamilyAsync: createFamilyAsync,
        verifyDeterminism: verifyDeterminism,
        verifyDeterminismAsync: verifyDeterminismAsync,
      };
    }

    var api = {
      VERSION: VERSION,
      BRIEF_SCHEMA: BRIEF_SCHEMA,
      LEGACY_HAND_SCHEMA: LEGACY_HAND_SCHEMA,
      HAND_SCHEMA: HAND_SCHEMA,
      RESULT_SCHEMA: RESULT_SCHEMA,
      ARTIFACT_SCHEMA: ARTIFACT_SCHEMA,
      SOURCE_ARTIFACT_SCHEMA: SOURCE_ARTIFACT_SCHEMA,
      FAMILY_SCHEMA: FAMILY_SCHEMA,
      TARGET_CANVAS_SCHEMA: TargetCanvas.SCHEMA,
      RECIPE_SCHEMA: RECIPE_SCHEMA,
      VALIDATION_SCHEMA: VALIDATION_SCHEMA,
      GAP_SCHEMA: GAP_SCHEMA,
      TARGET_CANVAS_MEDIUMS: TargetCanvas.MEDIUMS.slice(),
      OPERATION_MODES: OPERATION_MODES.slice(),
      CANVAS_MODELS: CANVAS_MODELS.slice(),
      KINDS: KINDS.slice(),
      normalizeTargetCanvas: TargetCanvas.normalize,
      normalizeBrief: normalizeBrief,
      normalizeSourceArtifact: normalizeSourceArtifact,
      normalizeDescriptor: normalizeDescriptor,
      validateDescriptor: validateDescriptor,
      canvasLimitFailures: canvasLimitFailures,
      normalizeArtifact: normalizeArtifact,
      validateSvg: validateSvg,
      validateResult: validateResult,
      makeResult: makeResult,
      compatibility: compatibility,
      createRegistry: createRegistry,
      hash: hash,
      slug: slug,
      escapeXml: escapeXml,
      rng: rng,
      paletteFor: paletteFor,
      contrastRatio: contrastRatio,
      accessiblePair: accessiblePair,
      artifactSchemas: ArtifactSchemas || null,
      svgDocument: svgDocument,
      clone: clone,
    };
    return api;
  },
);
