(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMTargetCanvas = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.2.0";
  var SCHEMA = "axm.target-canvas/v1";
  var MEDIUMS = [
    "screen",
    "ui",
    "game-world",
    "print",
    "paper",
    "fabric",
    "wood",
    "metal",
    "physical-object",
    "3d-surface",
    "audio-device",
  ];
  var UNITS = ["px", "mm", "m", "game-world-unit"];
  var BEHAVIOURS = [
    "static",
    "animated",
    "interactive",
    "responsive",
    "tileable",
  ];
  var COLOUR_SPACES = [
    "srgb",
    "display-p3",
    "linear-srgb",
    "cmyk",
    "grayscale",
    "material-channel",
  ];
  var ALPHA_MODES = ["straight", "premultiplied", "none"];
  var RENDERING_INTENTS = [
    "perceptual",
    "relative-colorimetric",
    "saturation",
    "absolute-colorimetric",
  ];
  var KERF_SIDES = ["centerline", "inside", "outside"];
  var UP_AXES = ["x", "y", "z"];
  var HANDEDNESS = ["left", "right"];

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
  function decimal(value, min, max, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, parsed))
      : fallback;
  }
  function integer(value, min, max, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, Math.round(parsed)))
      : fallback;
  }
  function choice(value, values, fallback) {
    var normalized = text(value, 60)
      .toLowerCase()
      .replace(/[_\s]+/g, "-");
    return values.indexOf(normalized) >= 0 ? normalized : fallback;
  }
  function unique(values, allowed, fallback) {
    var seen = {},
      out = [];
    (Array.isArray(values) ? values : [values]).forEach(function (value) {
      var normalized = choice(value, allowed, "");
      if (normalized && !seen[normalized]) {
        seen[normalized] = true;
        out.push(normalized);
      }
    });
    return out.length ? out : (fallback || []).slice();
  }
  function nullableInteger(value, min, max) {
    return value == null || value === ""
      ? null
      : integer(value, min, max, null);
  }
  function nullableDecimal(value, min, max) {
    return value == null || value === ""
      ? null
      : decimal(value, min, max, null);
  }
  function first() {
    for (var index = 0; index < arguments.length; index++)
      if (arguments[index] != null && arguments[index] !== "")
        return arguments[index];
    return null;
  }
  function stringList(values, maxItems, maxLength) {
    var seen = {},
      out = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      var normalized = text(value, maxLength || 100);
      if (normalized && !seen[normalized]) {
        seen[normalized] = true;
        out.push(normalized);
      }
    });
    return out.slice(0, maxItems || 20);
  }
  function numericList(values, maxItems, min, max) {
    return (Array.isArray(values) ? values : [])
      .slice(0, maxItems || 20)
      .map(function (value) {
        return decimal(
          value,
          min == null ? -1000000 : min,
          max == null ? 1000000 : max,
          0,
        );
      });
  }
  function breakpoints(values, fallbackUnit) {
    return (Array.isArray(values) ? values : [])
      .slice(0, 20)
      .map(function (item, index) {
        item =
          item && typeof item === "object" && !Array.isArray(item) ? item : {};
        var minimum = nullableDecimal(
          first(item.min_width, item.minWidth, item.minimum),
          0,
          1000000,
        );
        var maximum = nullableDecimal(
          first(item.max_width, item.maxWidth, item.maximum),
          0,
          1000000,
        );
        return {
          id: text(item.id || item.name, 60) || "breakpoint-" + (index + 1),
          min_width: minimum,
          max_width: maximum,
          unit: choice(item.unit, UNITS, fallbackUnit),
        };
      });
  }
  function declaredInput(raw) {
    return !!(
      raw &&
      typeof raw === "object" &&
      (raw.schema ||
        raw.declaration === "declared" ||
        raw.medium ||
        raw.dimensions ||
        raw.colour ||
        raw.color ||
        raw.physical ||
        raw.behaviour ||
        raw.behavior ||
        raw.performance ||
        raw.print ||
        raw.responsive ||
        raw.spatial ||
        raw.temporal ||
        raw.accessibility)
    );
  }
  function validateDeclaration(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    if (!declaredInput(raw))
      return { pass: true, errors: [], declaration: "legacy-inferred" };
    var errors = [];
    function object(value, name) {
      if (value != null && (typeof value !== "object" || Array.isArray(value)))
        errors.push(name + " must be an object");
    }
    function booleanValue(value, name) {
      if (value != null && typeof value !== "boolean")
        errors.push(name + " must be a boolean");
    }
    function arrayValue(value, name, itemType) {
      if (value == null) return;
      if (!Array.isArray(value)) {
        errors.push(name + " must be an array");
        return;
      }
      if (itemType)
        value.forEach(function (item, index) {
          if (typeof item !== itemType)
            errors.push(name + "[" + index + "] must be a " + itemType);
        });
    }
    function enumValue(value, allowed, name) {
      if (
        value != null &&
        value !== "" &&
        allowed.indexOf(choice(value, allowed, "")) < 0
      )
        errors.push(name + " is unsupported: " + text(value, 80));
    }
    function numeric(value, min, max, name, integerOnly) {
      if (value == null || value === "") return;
      var parsed = Number(value);
      if (
        !Number.isFinite(parsed) ||
        parsed < min ||
        parsed > max ||
        (integerOnly && Math.round(parsed) !== parsed)
      )
        errors.push(
          name +
            " must be " +
            (integerOnly ? "an integer " : "") +
            "between " +
            min +
            " and " +
            max,
        );
    }
    if (raw.schema && raw.schema !== SCHEMA)
      errors.push("target canvas schema mismatch");
    if (!raw.medium)
      errors.push("medium is required for a declared target canvas");
    if (
      !raw.dimensions ||
      typeof raw.dimensions !== "object" ||
      Array.isArray(raw.dimensions)
    )
      errors.push("dimensions are required for a declared target canvas");
    if (
      !(raw.colour || raw.color) ||
      typeof (raw.colour || raw.color) !== "object" ||
      Array.isArray(raw.colour || raw.color)
    )
      errors.push("colour is required for a declared target canvas");
    if (
      !Array.isArray(raw.behaviour || raw.behavior) ||
      !(raw.behaviour || raw.behavior).length
    )
      errors.push("behaviour is required for a declared target canvas");
    if (!text(raw.intended_use || raw.intendedUse, 100))
      errors.push("intended_use is required for a declared target canvas");
    enumValue(raw.medium, MEDIUMS, "medium");
    object(raw.dimensions, "dimensions");
    object(raw.colour || raw.color, "colour");
    object(raw.physical, "physical");
    object(raw.performance, "performance");
    object(raw.print, "print");
    object(raw.responsive, "responsive");
    object(raw.spatial, "spatial");
    object(raw.temporal, "temporal");
    object(raw.accessibility, "accessibility");
    var dimensions =
      raw.dimensions && typeof raw.dimensions === "object"
        ? raw.dimensions
        : raw;
    if (dimensions.width == null || dimensions.width === "")
      errors.push("dimensions.width is required");
    if (dimensions.height == null || dimensions.height === "")
      errors.push("dimensions.height is required");
    if (!(dimensions.unit || raw.unit))
      errors.push("dimensions.unit is required");
    numeric(dimensions.width, 0.01, 1000000, "dimensions.width");
    numeric(dimensions.height, 0.01, 1000000, "dimensions.height");
    numeric(dimensions.depth, 0, 1000000, "dimensions.depth");
    enumValue(dimensions.unit || raw.unit, UNITS, "dimensions.unit");
    var colour = raw.colour || raw.color || {};
    if (!(colour.space || colour.colour_space || colour.color_space))
      errors.push("colour.space is required");
    if (!colour.transparency) errors.push("colour.transparency is required");
    enumValue(
      colour.space || colour.colour_space || colour.color_space,
      COLOUR_SPACES,
      "colour.space",
    );
    enumValue(
      colour.transparency,
      ["required", "allowed", "opaque"],
      "colour.transparency",
    );
    enumValue(
      colour.alpha_mode || colour.alphaMode,
      ALPHA_MODES,
      "colour.alpha_mode",
    );
    enumValue(
      colour.rendering_intent || colour.renderingIntent,
      RENDERING_INTENTS,
      "colour.rendering_intent",
    );
    numeric(
      first(colour.minimum_contrast_ratio, colour.contrast_ratio),
      1,
      21,
      "colour.minimum_contrast_ratio",
    );
    numeric(
      first(colour.bit_depth, colour.bitDepth),
      1,
      64,
      "colour.bit_depth",
      true,
    );
    numeric(
      first(colour.peak_luminance_nits, colour.peakLuminanceNits),
      0.01,
      100000,
      "colour.peak_luminance_nits",
    );
    numeric(
      first(colour.total_ink_coverage, colour.totalInkCoverage),
      0,
      400,
      "colour.total_ink_coverage",
    );
    booleanValue(
      first(colour.printable_colours, colour.printableColors),
      "colour.printable_colours",
    );
    arrayValue(
      first(colour.spot_colours, colour.spotColors),
      "colour.spot_colours",
      "string",
    );
    var declaredAlpha = first(colour.alpha_mode, colour.alphaMode);
    if (
      declaredAlpha === "none" &&
      colour.transparency &&
      colour.transparency !== "opaque"
    )
      errors.push("colour.alpha_mode none requires opaque transparency");
    if (
      (declaredAlpha === "straight" || declaredAlpha === "premultiplied") &&
      colour.transparency === "opaque"
    )
      errors.push("opaque transparency requires colour.alpha_mode none");
    var physical = raw.physical || {},
      repeat = physical.repeat || {};
    enumValue(physical.unit, UNITS, "physical.unit");
    enumValue(repeat.mode, ["none", "x", "y", "xy"], "physical.repeat.mode");
    enumValue(
      first(physical.kerf_side, physical.kerfSide),
      KERF_SIDES,
      "physical.kerf_side",
    );
    if (
      physical.unit &&
      dimensions.unit &&
      choice(physical.unit, UNITS, "") !== choice(dimensions.unit, UNITS, "")
    )
      errors.push(
        "physical.unit must match dimensions.unit until a unit transformation is explicitly declared",
      );
    if (
      physical.repeat != null &&
      (typeof physical.repeat !== "object" || Array.isArray(physical.repeat))
    )
      errors.push("physical.repeat must be an object");
    ["material_behaviour", "materialBehavior", "operations"].forEach(
      function (key) {
        arrayValue(physical[key], "physical." + key, "string");
      },
    );
    numeric(physical.bleed, 0, 10000, "physical.bleed");
    numeric(
      first(physical.minimum_stroke, physical.minStroke),
      0,
      10000,
      "physical.minimum_stroke",
    );
    numeric(
      first(physical.cutting_tool_width, physical.toolWidth),
      0,
      10000,
      "physical.cutting_tool_width",
    );
    numeric(physical.depth, 0, 10000, "physical.depth");
    numeric(physical.tolerance, 0, 10000, "physical.tolerance");
    numeric(
      first(physical.material_thickness, physical.materialThickness),
      0,
      10000,
      "physical.material_thickness",
    );
    numeric(repeat.width, 0.01, 1000000, "physical.repeat.width");
    numeric(repeat.height, 0.01, 1000000, "physical.repeat.height");
    var materialThickness = first(
      physical.material_thickness,
      physical.materialThickness,
    );
    if (
      physical.depth != null &&
      materialThickness != null &&
      Number(physical.depth) > Number(materialThickness)
    )
      errors.push("physical.depth cannot exceed physical.material_thickness");
    var behaviour = raw.behaviour || raw.behavior;
    if (behaviour != null && !Array.isArray(behaviour))
      errors.push("behaviour must be an array");
    (Array.isArray(behaviour) ? behaviour : []).forEach(function (item) {
      enumValue(item, BEHAVIOURS, "behaviour");
    });
    var performance = raw.performance || {};
    numeric(
      first(performance.max_file_bytes, performance.maxFileBytes),
      1,
      2000000000,
      "performance.max_file_bytes",
      true,
    );
    numeric(
      first(
        performance.max_texture_memory_bytes,
        performance.maxTextureMemoryBytes,
      ),
      1,
      2000000000,
      "performance.max_texture_memory_bytes",
      true,
    );
    numeric(
      first(performance.max_polygon_count, performance.maxPolygonCount),
      0,
      100000000,
      "performance.max_polygon_count",
      true,
    );
    numeric(
      first(performance.max_frame_ms, performance.maxFrameMs),
      0.01,
      10000,
      "performance.max_frame_ms",
    );
    numeric(
      first(performance.max_animation_frames, performance.maxAnimationFrames),
      1,
      100000,
      "performance.max_animation_frames",
      true,
    );
    numeric(
      first(performance.frames_per_second, performance.fps),
      0.01,
      1000,
      "performance.frames_per_second",
    );
    numeric(
      first(performance.max_vertices, performance.maxVertices),
      0,
      200000000,
      "performance.max_vertices",
      true,
    );
    numeric(
      first(performance.max_draw_calls, performance.maxDrawCalls),
      0,
      1000000,
      "performance.max_draw_calls",
      true,
    );
    numeric(
      first(performance.max_mip_levels, performance.maxMipLevels),
      1,
      64,
      "performance.max_mip_levels",
      true,
    );
    numeric(
      first(performance.max_duration_seconds, performance.maxDurationSeconds),
      0.001,
      864000,
      "performance.max_duration_seconds",
    );
    var print = raw.print || {};
    numeric(print.dpi, 1, 9600, "print.dpi");
    numeric(
      first(print.safe_margin, print.safeMargin),
      0,
      10000,
      "print.safe_margin",
    );
    booleanValue(first(print.crop_marks, print.cropMarks), "print.crop_marks");
    booleanValue(
      first(print.registration_marks, print.registrationMarks),
      "print.registration_marks",
    );
    if (
      (print.crop_marks === true ||
        print.cropMarks === true ||
        print.registration_marks === true ||
        print.registrationMarks === true) &&
      !(Number(physical.bleed) > 0)
    )
      errors.push(
        "print crop or registration marks require positive physical.bleed",
      );
    var responsive = raw.responsive || {};
    numeric(
      first(responsive.pixel_density, responsive.pixelDensity),
      0.1,
      16,
      "responsive.pixel_density",
    );
    numeric(
      first(responsive.minimum_target_size, responsive.minimumTargetSize),
      1,
      1000,
      "responsive.minimum_target_size",
    );
    numeric(
      first(responsive.zoom_percent, responsive.zoomPercent),
      25,
      1000,
      "responsive.zoom_percent",
    );
    enumValue(
      responsive.direction,
      ["ltr", "rtl", "auto"],
      "responsive.direction",
    );
    arrayValue(
      responsive.safe_areas || responsive.safeAreas,
      "responsive.safe_areas",
      "string",
    );
    arrayValue(
      responsive.input_modalities || responsive.inputModalities,
      "responsive.input_modalities",
      "string",
    );
    booleanValue(
      first(responsive.reduced_motion, responsive.reducedMotion),
      "responsive.reduced_motion",
    );
    if (
      responsive.breakpoints != null &&
      !Array.isArray(responsive.breakpoints)
    )
      errors.push("responsive.breakpoints must be an array");
    var breakpointIds = {};
    (Array.isArray(responsive.breakpoints)
      ? responsive.breakpoints
      : []
    ).forEach(function (breakpoint, index) {
      if (
        !breakpoint ||
        typeof breakpoint !== "object" ||
        Array.isArray(breakpoint)
      ) {
        errors.push("responsive.breakpoints[" + index + "] must be an object");
        return;
      }
      var minimum = first(
          breakpoint.min_width,
          breakpoint.minWidth,
          breakpoint.minimum,
        ),
        maximum = first(
          breakpoint.max_width,
          breakpoint.maxWidth,
          breakpoint.maximum,
        );
      numeric(
        minimum,
        0,
        1000000,
        "responsive.breakpoints[" + index + "].min_width",
      );
      numeric(
        maximum,
        0,
        1000000,
        "responsive.breakpoints[" + index + "].max_width",
      );
      enumValue(
        breakpoint.unit || dimensions.unit,
        UNITS,
        "responsive.breakpoints[" + index + "].unit",
      );
      if (
        minimum != null &&
        maximum != null &&
        Number(minimum) > Number(maximum)
      )
        errors.push(
          "responsive.breakpoints[" + index + "] minimum exceeds maximum",
        );
      var breakpointId = text(breakpoint.id || breakpoint.name, 60);
      if (breakpointId && breakpointIds[breakpointId])
        errors.push(
          "responsive breakpoint ids must be unique: " + breakpointId,
        );
      if (breakpointId) breakpointIds[breakpointId] = true;
    });
    var spatial = raw.spatial || {};
    enumValue(
      first(spatial.up_axis, spatial.upAxis),
      UP_AXES,
      "spatial.up_axis",
    );
    enumValue(spatial.handedness, HANDEDNESS, "spatial.handedness");
    numeric(
      first(spatial.world_scale, spatial.worldScale),
      0.000001,
      1000000,
      "spatial.world_scale",
    );
    if (spatial.origin != null) {
      if (
        !Array.isArray(spatial.origin) ||
        (spatial.origin.length !== 0 && spatial.origin.length !== 3)
      )
        errors.push(
          "spatial.origin must be empty or contain exactly three numeric coordinates",
        );
      else
        spatial.origin.forEach(function (value, index) {
          numeric(value, -1000000, 1000000, "spatial.origin[" + index + "]");
        });
    }
    var temporal = raw.temporal || {};
    numeric(
      first(temporal.frame_rate_numerator, temporal.frameRateNumerator),
      1,
      1000000,
      "temporal.frame_rate_numerator",
      true,
    );
    numeric(
      first(temporal.frame_rate_denominator, temporal.frameRateDenominator),
      1,
      1000000,
      "temporal.frame_rate_denominator",
      true,
    );
    numeric(
      first(temporal.sample_rate, temporal.sampleRate),
      1,
      768000,
      "temporal.sample_rate",
      true,
    );
    numeric(
      first(temporal.tempo_bpm, temporal.tempoBpm),
      20,
      400,
      "temporal.tempo_bpm",
    );
    numeric(
      first(temporal.time_signature_numerator, temporal.timeSignatureNumerator),
      1,
      32,
      "temporal.time_signature_numerator",
      true,
    );
    numeric(
      first(
        temporal.time_signature_denominator,
        temporal.timeSignatureDenominator,
      ),
      1,
      32,
      "temporal.time_signature_denominator",
      true,
    );
    numeric(
      first(temporal.ticks_per_quarter, temporal.ticksPerQuarter),
      24,
      9600,
      "temporal.ticks_per_quarter",
      true,
    );
    numeric(
      first(temporal.midi_channel, temporal.midiChannel),
      1,
      16,
      "temporal.midi_channel",
      true,
    );
    numeric(
      first(temporal.note_min, temporal.noteMin),
      0,
      127,
      "temporal.note_min",
      true,
    );
    numeric(
      first(temporal.note_max, temporal.noteMax),
      0,
      127,
      "temporal.note_max",
      true,
    );
    var signatureDenominator = first(
        temporal.time_signature_denominator,
        temporal.timeSignatureDenominator,
      ),
      noteMinimum = first(temporal.note_min, temporal.noteMin),
      noteMaximum = first(temporal.note_max, temporal.noteMax);
    if (
      signatureDenominator != null &&
      [1, 2, 4, 8, 16, 32].indexOf(Number(signatureDenominator)) < 0
    )
      errors.push(
        "temporal.time_signature_denominator must be a power of two from 1 to 32",
      );
    if (
      noteMinimum != null &&
      noteMaximum != null &&
      Number(noteMinimum) > Number(noteMaximum)
    )
      errors.push("temporal.note_min exceeds temporal.note_max");
    var rateNumerator = first(
        temporal.frame_rate_numerator,
        temporal.frameRateNumerator,
      ),
      rateDenominator = first(
        temporal.frame_rate_denominator,
        temporal.frameRateDenominator,
      ),
      performanceFps = first(performance.frames_per_second, performance.fps);
    if ((rateNumerator == null) !== (rateDenominator == null))
      errors.push(
        "temporal frame rate numerator and denominator must be declared together",
      );
    if (
      rateNumerator != null &&
      rateDenominator != null &&
      performanceFps != null &&
      Math.abs(
        Number(rateNumerator) / Number(rateDenominator) -
          Number(performanceFps),
      ) > 0.000001
    )
      errors.push(
        "temporal frame rate and performance.frames_per_second conflict",
      );
    booleanValue(
      first(temporal.drop_frame, temporal.dropFrame),
      "temporal.drop_frame",
    );
    var accessibility = raw.accessibility || {};
    booleanValue(
      first(accessibility.reading_order, accessibility.readingOrder),
      "accessibility.reading_order",
    );
    booleanValue(
      first(accessibility.alternative_text, accessibility.alternativeText),
      "accessibility.alternative_text",
    );
    booleanValue(accessibility.keyboard, "accessibility.keyboard");
    booleanValue(
      first(accessibility.focus_visible, accessibility.focusVisible),
      "accessibility.focus_visible",
    );
    return {
      pass: errors.length === 0,
      errors: errors,
      declaration: "declared",
    };
  }
  function inferMedium(raw) {
    var target = text(raw && raw.target, 120).toLowerCase(),
      kind = text(
        raw && (raw.intended_use || raw.intendedUse || raw.kind),
        80,
      ).toLowerCase();
    if (
      /audio|midi|music|notation|score|instrument|device-ui/.test(
        target + " " + kind,
      )
    )
      return "audio-device";
    if (/fabric|cloth|shirt|clothing|textile/.test(target + " " + kind))
      return "fabric";
    if (/print|poster|paper|book|brochure/.test(target + " " + kind))
      return kind === "paper" ? "paper" : "print";
    if (/wood|engrave|cutting/.test(target + " " + kind)) return "wood";
    if (/metal/.test(target + " " + kind)) return "metal";
    if (/3d|material|mesh/.test(target + " " + kind)) return "3d-surface";
    if (/game|world|terrain|tile|sprite|texture/.test(target + " " + kind))
      return "game-world";
    if (/ui|interface|hud|button|panel/.test(target + " " + kind)) return "ui";
    return "screen";
  }
  function defaultUnit(medium) {
    if (medium === "game-world") return "game-world-unit";
    if (
      ["print", "paper", "fabric", "wood", "metal", "physical-object"].indexOf(
        medium,
      ) >= 0
    )
      return "mm";
    if (medium === "3d-surface") return "m";
    return "px";
  }
  function defaultColourSpace(medium) {
    if (medium === "print" || medium === "paper") return "cmyk";
    if (medium === "wood" || medium === "metal" || medium === "physical-object")
      return "grayscale";
    if (medium === "3d-surface") return "material-channel";
    return "srgb";
  }
  function normalize(raw, legacy) {
    raw = raw && typeof raw === "object" ? raw : {};
    legacy = legacy && typeof legacy === "object" ? legacy : {};
    var declared = declaredInput(raw);
    var medium = choice(
      raw.medium,
      MEDIUMS,
      inferMedium(Object.assign({}, legacy, raw)),
    );
    var dimensions =
      raw.dimensions && typeof raw.dimensions === "object"
        ? raw.dimensions
        : raw;
    var unit = choice(dimensions.unit || raw.unit, UNITS, defaultUnit(medium));
    var legacySize = Number(legacy.size) || 256;
    var defaultWidth =
      unit === "px"
        ? Number(legacy.width) || legacySize
        : medium === "game-world"
          ? 1
          : medium === "3d-surface"
            ? 1
            : 210;
    var defaultHeight =
      unit === "px"
        ? Number(legacy.height) || legacySize
        : medium === "game-world"
          ? 1
          : medium === "3d-surface"
            ? 1
            : 210;
    var colour = raw.colour || raw.color || {};
    var physical = raw.physical || {};
    var repeat =
      physical.repeat && typeof physical.repeat === "object"
        ? physical.repeat
        : {};
    var performance = raw.performance || {};
    var transparency = choice(
      colour.transparency,
      ["required", "allowed", "opaque"],
      legacy.transparent === false ? "opaque" : "allowed",
    );
    var behaviours = unique(
      raw.behaviour ||
        raw.behavior ||
        (legacy.seamless ? ["static", "tileable"] : ["static"]),
      BEHAVIOURS,
      ["static"],
    );
    return {
      schema: SCHEMA,
      medium: medium,
      dimensions: {
        width: decimal(dimensions.width, 0.01, 1000000, defaultWidth),
        height: decimal(dimensions.height, 0.01, 1000000, defaultHeight),
        depth: nullableDecimal(dimensions.depth, 0, 1000000),
        unit: unit,
      },
      colour: {
        space: choice(
          colour.space ||
            colour.colour_space ||
            colour.color_space ||
            legacy.colourSpace ||
            legacy.colorSpace,
          COLOUR_SPACES,
          defaultColourSpace(medium),
        ),
        transparency: transparency,
        minimum_contrast_ratio: nullableDecimal(
          first(colour.minimum_contrast_ratio, colour.contrast_ratio),
          1,
          21,
        ),
        printable_colours:
          colour.printable_colours === true || colour.printableColors === true,
        profile:
          text(colour.profile || colour.profile_id || colour.profileId, 160) ||
          null,
        bit_depth: nullableInteger(
          first(colour.bit_depth, colour.bitDepth),
          1,
          64,
        ),
        transfer_function:
          text(colour.transfer_function || colour.transferFunction, 80) || null,
        primaries: text(colour.primaries, 80) || null,
        alpha_mode: choice(
          colour.alpha_mode || colour.alphaMode,
          ALPHA_MODES,
          transparency === "opaque" ? "none" : "straight",
        ),
        rendering_intent: choice(
          colour.rendering_intent || colour.renderingIntent,
          RENDERING_INTENTS,
          "relative-colorimetric",
        ),
        spot_colours: stringList(
          colour.spot_colours || colour.spotColors,
          32,
          100,
        ),
        total_ink_coverage: nullableDecimal(
          first(colour.total_ink_coverage, colour.totalInkCoverage),
          0,
          400,
        ),
        peak_luminance_nits: nullableDecimal(
          first(colour.peak_luminance_nits, colour.peakLuminanceNits),
          0.01,
          100000,
        ),
      },
      physical: {
        unit: choice(physical.unit, UNITS, unit),
        bleed: nullableDecimal(physical.bleed, 0, 10000),
        minimum_stroke: nullableDecimal(
          first(physical.minimum_stroke, physical.minStroke),
          0,
          10000,
        ),
        cutting_tool_width: nullableDecimal(
          first(physical.cutting_tool_width, physical.toolWidth),
          0,
          10000,
        ),
        depth: nullableDecimal(physical.depth, 0, 10000),
        repeat: {
          mode: choice(
            repeat.mode || (legacy.seamless ? "xy" : "none"),
            ["none", "x", "y", "xy"],
            "none",
          ),
          width: nullableDecimal(repeat.width, 0.01, 1000000),
          height: nullableDecimal(repeat.height, 0.01, 1000000),
        },
        material_behaviour: stringList(
          Array.isArray(physical.material_behaviour)
            ? physical.material_behaviour
            : physical.materialBehavior,
          20,
          80,
        ),
        tolerance: nullableDecimal(physical.tolerance, 0, 10000),
        material_thickness: nullableDecimal(
          first(physical.material_thickness, physical.materialThickness),
          0,
          10000,
        ),
        kerf_side: choice(
          physical.kerf_side || physical.kerfSide,
          KERF_SIDES,
          "centerline",
        ),
        grain_direction:
          text(physical.grain_direction || physical.grainDirection, 80) || null,
        operations: stringList(physical.operations, 20, 80),
      },
      behaviour: behaviours,
      performance: {
        max_file_bytes: nullableInteger(
          first(performance.max_file_bytes, performance.maxFileBytes),
          1,
          2000000000,
        ),
        max_texture_memory_bytes: nullableInteger(
          first(
            performance.max_texture_memory_bytes,
            performance.maxTextureMemoryBytes,
          ),
          1,
          2000000000,
        ),
        max_polygon_count: nullableInteger(
          first(performance.max_polygon_count, performance.maxPolygonCount),
          0,
          100000000,
        ),
        max_frame_ms: nullableDecimal(
          first(performance.max_frame_ms, performance.maxFrameMs),
          0.01,
          10000,
        ),
        max_animation_frames: nullableInteger(
          first(
            performance.max_animation_frames,
            performance.maxAnimationFrames,
          ),
          1,
          100000,
        ),
        frames_per_second: nullableDecimal(
          first(performance.frames_per_second, performance.fps),
          0.01,
          1000,
        ),
        max_vertices: nullableInteger(
          first(performance.max_vertices, performance.maxVertices),
          0,
          200000000,
        ),
        max_draw_calls: nullableInteger(
          first(performance.max_draw_calls, performance.maxDrawCalls),
          0,
          1000000,
        ),
        max_mip_levels: nullableInteger(
          first(performance.max_mip_levels, performance.maxMipLevels),
          1,
          64,
        ),
        max_duration_seconds: nullableDecimal(
          first(
            performance.max_duration_seconds,
            performance.maxDurationSeconds,
          ),
          0.001,
          864000,
        ),
      },
      print: {
        dpi: nullableDecimal(raw.print && raw.print.dpi, 1, 9600),
        safe_margin: nullableDecimal(
          raw.print && first(raw.print.safe_margin, raw.print.safeMargin),
          0,
          10000,
        ),
        crop_marks: !!(
          raw.print &&
          (raw.print.crop_marks === true || raw.print.cropMarks === true)
        ),
        registration_marks: !!(
          raw.print &&
          (raw.print.registration_marks === true ||
            raw.print.registrationMarks === true)
        ),
        output_condition:
          text(
            raw.print &&
              (raw.print.output_condition || raw.print.outputCondition),
            160,
          ) || null,
        font_policy:
          text(
            raw.print && (raw.print.font_policy || raw.print.fontPolicy),
            80,
          ) || null,
      },
      responsive: {
        breakpoints: breakpoints(
          raw.responsive && raw.responsive.breakpoints,
          unit,
        ),
        container_policy:
          text(
            raw.responsive &&
              (raw.responsive.container_policy ||
                raw.responsive.containerPolicy),
            80,
          ) || null,
        pixel_density: nullableDecimal(
          raw.responsive &&
            first(raw.responsive.pixel_density, raw.responsive.pixelDensity),
          0.1,
          16,
        ),
        locale: text(raw.responsive && raw.responsive.locale, 40) || null,
        direction: choice(
          raw.responsive && raw.responsive.direction,
          ["ltr", "rtl", "auto"],
          "auto",
        ),
        safe_areas: stringList(
          raw.responsive &&
            (raw.responsive.safe_areas || raw.responsive.safeAreas),
          20,
          80,
        ),
        input_modalities: stringList(
          raw.responsive &&
            (raw.responsive.input_modalities || raw.responsive.inputModalities),
          20,
          80,
        ),
        reduced_motion: !!(
          raw.responsive &&
          (raw.responsive.reduced_motion === true ||
            raw.responsive.reducedMotion === true)
        ),
        minimum_target_size: nullableDecimal(
          raw.responsive &&
            first(
              raw.responsive.minimum_target_size,
              raw.responsive.minimumTargetSize,
            ),
          1,
          1000,
        ),
        zoom_percent: nullableDecimal(
          raw.responsive &&
            first(raw.responsive.zoom_percent, raw.responsive.zoomPercent),
          25,
          1000,
        ),
      },
      spatial: {
        up_axis: choice(
          raw.spatial && (raw.spatial.up_axis || raw.spatial.upAxis),
          UP_AXES,
          "y",
        ),
        handedness: choice(
          raw.spatial && raw.spatial.handedness,
          HANDEDNESS,
          "right",
        ),
        origin: numericList(
          raw.spatial && raw.spatial.origin,
          3,
          -1000000,
          1000000,
        ),
        world_scale: nullableDecimal(
          raw.spatial && first(raw.spatial.world_scale, raw.spatial.worldScale),
          0.000001,
          1000000,
        ),
        uv_convention:
          text(
            raw.spatial &&
              (raw.spatial.uv_convention || raw.spatial.uvConvention),
            80,
          ) || null,
        tangent_convention:
          text(
            raw.spatial &&
              (raw.spatial.tangent_convention || raw.spatial.tangentConvention),
            80,
          ) || null,
        lod_policy:
          text(
            raw.spatial && (raw.spatial.lod_policy || raw.spatial.lodPolicy),
            80,
          ) || null,
        collision: text(raw.spatial && raw.spatial.collision, 80) || null,
      },
      temporal: {
        frame_rate_numerator: nullableInteger(
          raw.temporal &&
            first(
              raw.temporal.frame_rate_numerator,
              raw.temporal.frameRateNumerator,
            ),
          1,
          1000000,
        ),
        frame_rate_denominator: nullableInteger(
          raw.temporal &&
            first(
              raw.temporal.frame_rate_denominator,
              raw.temporal.frameRateDenominator,
            ),
          1,
          1000000,
        ),
        drop_frame: !!(
          raw.temporal &&
          (raw.temporal.drop_frame === true || raw.temporal.dropFrame === true)
        ),
        sample_rate: nullableInteger(
          raw.temporal &&
            first(raw.temporal.sample_rate, raw.temporal.sampleRate),
          1,
          768000,
        ),
        channel_layout:
          text(
            raw.temporal &&
              (raw.temporal.channel_layout || raw.temporal.channelLayout),
            80,
          ) || null,
        codec: text(raw.temporal && raw.temporal.codec, 80) || null,
        container: text(raw.temporal && raw.temporal.container, 80) || null,
        captions: text(raw.temporal && raw.temporal.captions, 80) || null,
        tempo_bpm: nullableDecimal(
          raw.temporal && first(raw.temporal.tempo_bpm, raw.temporal.tempoBpm),
          20,
          400,
        ),
        time_signature_numerator: nullableInteger(
          raw.temporal &&
            first(
              raw.temporal.time_signature_numerator,
              raw.temporal.timeSignatureNumerator,
            ),
          1,
          32,
        ),
        time_signature_denominator: nullableInteger(
          raw.temporal &&
            first(
              raw.temporal.time_signature_denominator,
              raw.temporal.timeSignatureDenominator,
            ),
          1,
          32,
        ),
        ticks_per_quarter: nullableInteger(
          raw.temporal &&
            first(raw.temporal.ticks_per_quarter, raw.temporal.ticksPerQuarter),
          24,
          9600,
        ),
        midi_channel: nullableInteger(
          raw.temporal &&
            first(raw.temporal.midi_channel, raw.temporal.midiChannel),
          1,
          16,
        ),
        note_min: nullableInteger(
          raw.temporal && first(raw.temporal.note_min, raw.temporal.noteMin),
          0,
          127,
        ),
        note_max: nullableInteger(
          raw.temporal && first(raw.temporal.note_max, raw.temporal.noteMax),
          0,
          127,
        ),
      },
      accessibility: {
        standard:
          text(raw.accessibility && raw.accessibility.standard, 80) || null,
        reading_order: !!(
          raw.accessibility &&
          (raw.accessibility.reading_order === true ||
            raw.accessibility.readingOrder === true)
        ),
        alternative_text: !!(
          raw.accessibility &&
          (raw.accessibility.alternative_text === true ||
            raw.accessibility.alternativeText === true)
        ),
        keyboard: !!(raw.accessibility && raw.accessibility.keyboard),
        focus_visible: !!(
          raw.accessibility &&
          (raw.accessibility.focus_visible === true ||
            raw.accessibility.focusVisible === true)
        ),
      },
      intended_use:
        text(
          raw.intended_use ||
            raw.intendedUse ||
            legacy.intended_use ||
            legacy.intendedUse ||
            legacy.kind,
          100,
        ) || "general-asset",
      declaration: declared ? "declared" : "legacy-inferred",
    };
  }
  function requestedConstraints(canvas) {
    canvas = normalize(canvas);
    var out = [
      "dimensions",
      "dimensions.unit",
      "colour.space",
      "colour.transparency",
    ];
    if (canvas.colour.minimum_contrast_ratio != null)
      out.push("colour.contrast");
    if (canvas.colour.printable_colours) out.push("colour.printable");
    if (canvas.physical.bleed != null) out.push("physical.bleed");
    if (canvas.physical.minimum_stroke != null)
      out.push("physical.minimum-stroke");
    if (canvas.physical.cutting_tool_width != null)
      out.push("physical.cutting-tool-width");
    if (canvas.physical.depth != null) out.push("physical.depth");
    if (canvas.physical.repeat.mode !== "none") out.push("physical.repeat");
    if (
      canvas.physical.repeat.width != null ||
      canvas.physical.repeat.height != null
    )
      out.push("physical.repeat-size");
    if (canvas.physical.material_behaviour.length)
      out.push("physical.material-behaviour");
    if (canvas.physical.tolerance != null) out.push("physical.tolerance");
    if (canvas.physical.material_thickness != null)
      out.push("physical.material-thickness");
    if (canvas.physical.kerf_side !== "centerline")
      out.push("physical.kerf-side");
    if (canvas.physical.grain_direction) out.push("physical.grain-direction");
    if (canvas.physical.operations.length) out.push("physical.operations");
    if (canvas.colour.profile) out.push("colour.profile");
    if (canvas.colour.bit_depth != null) out.push("colour.bit-depth");
    if (canvas.colour.transfer_function) out.push("colour.transfer-function");
    if (canvas.colour.primaries) out.push("colour.primaries");
    if (
      canvas.colour.alpha_mode !==
      (canvas.colour.transparency === "opaque" ? "none" : "straight")
    )
      out.push("colour.alpha-mode");
    if (canvas.colour.rendering_intent !== "relative-colorimetric")
      out.push("colour.rendering-intent");
    if (canvas.colour.spot_colours.length) out.push("colour.spot-colours");
    if (canvas.colour.total_ink_coverage != null)
      out.push("colour.total-ink-coverage");
    if (canvas.colour.peak_luminance_nits != null)
      out.push("colour.peak-luminance");
    Object.keys(canvas.print || {}).forEach(function (key) {
      var value = canvas.print[key];
      if (
        value != null &&
        value !== false &&
        (!Array.isArray(value) || value.length)
      )
        out.push("print." + key.replace(/_/g, "-"));
    });
    Object.keys(canvas.responsive || {}).forEach(function (key) {
      var value = canvas.responsive[key];
      if (
        value != null &&
        value !== false &&
        value !== "auto" &&
        (!Array.isArray(value) || value.length)
      )
        out.push("responsive." + key.replace(/_/g, "-"));
    });
    Object.keys(canvas.spatial || {}).forEach(function (key) {
      var value = canvas.spatial[key];
      var isDefault =
        (key === "up_axis" && value === "y") ||
        (key === "handedness" && value === "right");
      if (
        !isDefault &&
        value != null &&
        (!Array.isArray(value) || value.length)
      )
        out.push("spatial." + key.replace(/_/g, "-"));
    });
    Object.keys(canvas.temporal || {}).forEach(function (key) {
      var value = canvas.temporal[key];
      if (value != null && value !== false)
        out.push("temporal." + key.replace(/_/g, "-"));
    });
    Object.keys(canvas.accessibility || {}).forEach(function (key) {
      var value = canvas.accessibility[key];
      if (value != null && value !== false)
        out.push("accessibility." + key.replace(/_/g, "-"));
    });
    canvas.behaviour.forEach(function (item) {
      out.push("behaviour." + item);
    });
    Object.keys(canvas.performance).forEach(function (key) {
      if (canvas.performance[key] != null)
        out.push("performance." + key.replace(/_/g, "-"));
    });
    return out;
  }
  function validate(canvas) {
    var declaration = validateDeclaration(canvas),
      errors = declaration.errors.slice();
    if (!canvas || canvas.schema !== SCHEMA)
      errors.push("target canvas schema mismatch");
    if (!canvas || MEDIUMS.indexOf(canvas.medium) < 0)
      errors.push("unsupported target canvas medium");
    if (
      !canvas ||
      !canvas.dimensions ||
      UNITS.indexOf(canvas.dimensions.unit) < 0
    )
      errors.push("target canvas dimensions and unit are required");
    if (
      canvas &&
      canvas.dimensions &&
      (!(canvas.dimensions.width > 0) || !(canvas.dimensions.height > 0))
    )
      errors.push("target canvas width and height must be positive");
    if (
      !canvas ||
      !canvas.colour ||
      COLOUR_SPACES.indexOf(canvas.colour.space) < 0
    )
      errors.push("target canvas colour space is required");
    if (
      canvas &&
      canvas.physical &&
      canvas.dimensions &&
      canvas.physical.unit !== canvas.dimensions.unit
    )
      errors.push("target canvas physical and dimensional units differ");
    if (
      canvas &&
      canvas.spatial &&
      canvas.spatial.origin &&
      canvas.spatial.origin.length &&
      canvas.spatial.origin.length !== 3
    )
      errors.push("target canvas spatial origin requires three coordinates");
    return { pass: errors.length === 0, errors: errors };
  }
  function inspect(raw, legacy) {
    var declaration = validateDeclaration(raw);
    var canvas = normalize(raw, legacy);
    var normalized = validate(canvas);
    var transformations = [];
    if (canvas.declaration === "legacy-inferred")
      transformations.push(
        "legacy target canvas inferred from the saved request",
      );
    return {
      pass: declaration.pass && normalized.pass,
      errors: declaration.errors.concat(normalized.errors),
      canvas: canvas,
      original: clone(raw && typeof raw === "object" ? raw : {}),
      declaration: canvas.declaration,
      transformations: transformations,
    };
  }

  return {
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    MEDIUMS: MEDIUMS.slice(),
    UNITS: UNITS.slice(),
    BEHAVIOURS: BEHAVIOURS.slice(),
    COLOUR_SPACES: COLOUR_SPACES.slice(),
    ALPHA_MODES: ALPHA_MODES.slice(),
    RENDERING_INTENTS: RENDERING_INTENTS.slice(),
    normalize: normalize,
    inspect: inspect,
    validateDeclaration: validateDeclaration,
    requestedConstraints: requestedConstraints,
    validate: validate,
    clone: clone,
    inferMedium: inferMedium,
  };
});
