(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./raster-operations-core")
      : root.AXMRasterOperationsCore,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMPixelAnimationCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Raster) {
  "use strict";

  if (!Raster) throw new Error("AXM raster operations core is required");

  var VERSION = "0.1.0";
  var RECIPE_SCHEMA = "axm.pixel-animation-recipe/v1";
  var MANIFEST_SCHEMA = "axm.sprite-animation/v1";
  var VIDEO_SEQUENCE_SCHEMA = "axm.pixel-video-sequence/v1";
  var RECEIPT_SCHEMA = "axm.pixel-animation-receipt/v1";
  var MAX_FRAMES = Raster.MAX_FRAMES;
  var MAX_CLIPS = 32;
  var MAX_APNG_FRAMES = 60;
  var MAX_FRAME_PIXELS = 16777216;

  var PROFILE_DEFINITIONS = {
    "pixel-8bit": {
      id: "pixel-8bit",
      label: "8-bit pixel workflow",
      interpretation: "workflow-preset-not-hardware-emulation",
      pixel_format: "RGBA8",
      colour_space: "sRGB",
      max_colours: 16,
      grid_presets: [8, 16, 32],
      default_cell_size: 16,
      default_frame_duration_ms: 125,
      default_preview_scale: 8,
      nearest_neighbour: true,
      integer_scale_only: true,
    },
    "pixel-16bit": {
      id: "pixel-16bit",
      label: "16-bit pixel workflow",
      interpretation: "workflow-preset-not-hardware-emulation",
      pixel_format: "RGBA8",
      colour_space: "sRGB",
      max_colours: 64,
      grid_presets: [16, 32, 64],
      default_cell_size: 32,
      default_frame_duration_ms: 83,
      default_preview_scale: 4,
      nearest_neighbour: true,
      integer_scale_only: true,
    },
    "pixel-custom": {
      id: "pixel-custom",
      label: "Custom pixel workflow",
      interpretation: "workflow-preset-not-hardware-emulation",
      pixel_format: "RGBA8",
      colour_space: "sRGB",
      max_colours: 256,
      grid_presets: [8, 16, 32, 64],
      default_cell_size: 32,
      default_frame_duration_ms: 100,
      default_preview_scale: 4,
      nearest_neighbour: true,
      integer_scale_only: true,
    },
  };

  function ensure(pass, message) {
    if (!pass) throw new Error(message);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function integer(value, minimum, maximum, label) {
    var parsed = Number(value);
    ensure(Number.isInteger(parsed), label + " must be an integer");
    ensure(parsed >= minimum && parsed <= maximum, label + " is outside its bounded range");
    return parsed;
  }

  function finite(value, minimum, maximum, label) {
    var parsed = Number(value);
    ensure(Number.isFinite(parsed), label + " must be finite");
    ensure(parsed >= minimum && parsed <= maximum, label + " is outside its bounded range");
    return parsed;
  }

  function boundedText(value, fallback, maximum, label) {
    var result = String(value == null ? fallback || "" : value).trim();
    ensure(!!result, label + " is required");
    ensure(result.length <= maximum, label + " exceeds its bounded length");
    return result;
  }

  function optionalText(value, maximum, label) {
    if (value == null || String(value).trim() === "") return null;
    return boundedText(value, "", maximum, label);
  }

  function portableId(value, fallback, label) {
    var id = String(value || fallback || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
    ensure(!!id, (label || "id") + " is required");
    return id;
  }

  function uniqueStrings(values, maximum, label) {
    var seen = Object.create(null);
    return (Array.isArray(values) ? values : []).map(function (value) {
      return boundedText(value, "", maximum || 80, label || "value");
    }).filter(function (value) {
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    }).sort();
  }

  function colourBytes(value, label) {
    var text = String(value || "").trim();
    var match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(text);
    ensure(!!match, (label || "colour") + " must use #RRGGBB or #RRGGBBAA");
    var alpha = match[2] || "ff";
    return [
      parseInt(match[1].slice(0, 2), 16),
      parseInt(match[1].slice(2, 4), 16),
      parseInt(match[1].slice(4, 6), 16),
      parseInt(alpha, 16),
    ];
  }

  function byteHex(value) {
    return value.toString(16).padStart(2, "0").toUpperCase();
  }

  function normalizeColour(value, label) {
    return "#" + colourBytes(value, label).map(byteHex).join("");
  }

  function resolveProfile(rawProfile) {
    var id = typeof rawProfile === "string"
      ? rawProfile
      : rawProfile && rawProfile.id;
    id = String(id || "pixel-8bit").toLowerCase();
    ensure(Object.prototype.hasOwnProperty.call(PROFILE_DEFINITIONS, id), "unsupported pixel workflow profile: " + id);
    return clone(PROFILE_DEFINITIONS[id]);
  }

  function axisCount(total, margin, cell, spacing, explicit, label) {
    var available = total - margin * 2;
    ensure(available >= cell, label + " grid has no complete cell");
    var count;
    if (explicit != null) count = integer(explicit, 1, MAX_FRAMES, label + " count");
    else {
      var numerator = available + spacing;
      var denominator = cell + spacing;
      ensure(numerator % denominator === 0, label + " grid leaves undeclared trailing pixels");
      count = numerator / denominator;
    }
    var used = margin * 2 + count * cell + Math.max(0, count - 1) * spacing;
    ensure(used === total, label + " grid does not exactly cover the source");
    return count;
  }

  function normalizeSheet(raw, dimensions, profile) {
    raw = raw || {};
    dimensions = dimensions || {};
    var sourceWidth = integer(dimensions.width == null ? raw.source_width : dimensions.width, 1, 16384, "sheet source width");
    var sourceHeight = integer(dimensions.height == null ? raw.source_height : dimensions.height, 1, 16384, "sheet source height");
    ensure(sourceWidth * sourceHeight <= Raster.MAX_PIXELS, "animation source exceeds the raster core pixel boundary");
    var cellWidth = integer(raw.cell_width == null ? profile.default_cell_size : raw.cell_width, 1, 256, "sheet cell width");
    var cellHeight = integer(raw.cell_height == null ? profile.default_cell_size : raw.cell_height, 1, 256, "sheet cell height");
    var marginX = integer(raw.margin_x == null ? 0 : raw.margin_x, 0, 1024, "sheet horizontal margin");
    var marginY = integer(raw.margin_y == null ? 0 : raw.margin_y, 0, 1024, "sheet vertical margin");
    var spacingX = integer(raw.spacing_x == null ? 0 : raw.spacing_x, 0, 256, "sheet horizontal spacing");
    var spacingY = integer(raw.spacing_y == null ? 0 : raw.spacing_y, 0, 256, "sheet vertical spacing");
    var columns = axisCount(sourceWidth, marginX, cellWidth, spacingX, raw.columns, "horizontal");
    var rows = axisCount(sourceHeight, marginY, cellHeight, spacingY, raw.rows, "vertical");
    ensure(columns * rows <= MAX_FRAMES, "animation sheet exceeds the frame boundary");
    return {
      source_width: sourceWidth,
      source_height: sourceHeight,
      cell_width: cellWidth,
      cell_height: cellHeight,
      columns: columns,
      rows: rows,
      margin_x: marginX,
      margin_y: marginY,
      spacing_x: spacingX,
      spacing_y: spacingY,
      order: "row-major",
    };
  }

  function cellFromRaw(raw, fallbackIndex, sheet, label) {
    var column, row;
    if (raw && raw.cell && typeof raw.cell === "object") {
      column = raw.cell.column;
      row = raw.cell.row;
    } else {
      var cellIndex = raw && raw.cell_index != null ? raw.cell_index : fallbackIndex;
      cellIndex = integer(cellIndex, 0, sheet.columns * sheet.rows - 1, label + " cell index");
      column = cellIndex % sheet.columns;
      row = Math.floor(cellIndex / sheet.columns);
    }
    return {
      column: integer(column, 0, sheet.columns - 1, label + " cell column"),
      row: integer(row, 0, sheet.rows - 1, label + " cell row"),
    };
  }

  function normalizeBounds(raw, sheet, label) {
    raw = raw || {};
    var x = integer(raw.x == null ? 0 : raw.x, 0, sheet.cell_width - 1, label + " bounds x");
    var y = integer(raw.y == null ? 0 : raw.y, 0, sheet.cell_height - 1, label + " bounds y");
    var width = integer(raw.width == null ? sheet.cell_width : raw.width, 1, sheet.cell_width, label + " bounds width");
    var height = integer(raw.height == null ? sheet.cell_height : raw.height, 1, sheet.cell_height, label + " bounds height");
    ensure(x + width <= sheet.cell_width && y + height <= sheet.cell_height, label + " bounds exceed the frame cell");
    return { x: x, y: y, width: width, height: height };
  }

  function normalizePivot(raw, label) {
    raw = raw || {};
    var unit = String(raw.unit || "normalized").toLowerCase();
    ensure(unit === "normalized" || unit === "px", label + " pivot unit is unsupported");
    var minimum = unit === "normalized" ? -4 : -4096;
    var maximum = unit === "normalized" ? 4 : 4096;
    return {
      x: finite(raw.x == null ? 0.5 : raw.x, minimum, maximum, label + " pivot x"),
      y: finite(raw.y == null ? 1 : raw.y, minimum, maximum, label + " pivot y"),
      unit: unit,
    };
  }

  function normalizeEvents(values, duration, frameId) {
    var ids = {};
    return (Array.isArray(values) ? values : []).map(function (raw, index) {
      raw = raw || {};
      var id = portableId(raw.id, frameId + "-event-" + String(index + 1).padStart(2, "0"), "frame event id");
      ensure(!ids[id], "frame event ids must be unique within " + frameId);
      ids[id] = true;
      return {
        id: id,
        name: boundedText(raw.name, id, 80, "frame event name"),
        at_ms: integer(raw.at_ms == null ? 0 : raw.at_ms, 0, duration, "frame event time"),
        data: clone(raw.data || {}),
      };
    }).sort(function (left, right) {
      return left.at_ms - right.at_ms || left.id.localeCompare(right.id);
    });
  }

  function normalizeFrames(rawFrames, sheet, sourceId, profile) {
    var values = Array.isArray(rawFrames) && rawFrames.length
      ? rawFrames
      : Array.from({ length: sheet.columns * sheet.rows }, function (_, index) {
          return { cell_index: index, animation: "default", direction: "none", index: index };
        });
    ensure(values.length >= 1 && values.length <= MAX_FRAMES, "animation recipe requires 1 to " + MAX_FRAMES + " frames");
    var ids = Object.create(null), groupCounts = new Map(), groupIndices = new Map();
    return values.map(function (raw, position) {
      raw = raw || {};
      var id = portableId(raw.id, "frame-" + String(position).padStart(3, "0"), "frame id");
      ensure(!ids[id], "animation frame ids must be unique");
      ids[id] = true;
      var animation = boundedText(raw.animation, "default", 80, "frame animation");
      var direction = boundedText(raw.direction, "none", 80, "frame direction");
      var group = animation + "\u0000" + direction;
      var frameIndex = integer(raw.index == null ? groupCounts.get(group) || 0 : raw.index, 0, MAX_FRAMES - 1, "frame animation index");
      var indices = groupIndices.get(group) || new Set();
      ensure(!indices.has(frameIndex), "frame animation indices must be unique within " + animation + "/" + direction);
      indices.add(frameIndex);
      groupIndices.set(group, indices);
      groupCounts.set(group, Math.max(groupCounts.get(group) || 0, frameIndex + 1));
      var duration = integer(raw.duration_ms == null ? profile.default_frame_duration_ms : raw.duration_ms, 1, 10000, "frame duration");
      var cell = cellFromRaw(raw, position, sheet, id);
      var atlas = {
        x: sheet.margin_x + cell.column * (sheet.cell_width + sheet.spacing_x),
        y: sheet.margin_y + cell.row * (sheet.cell_height + sheet.spacing_y),
        width: sheet.cell_width,
        height: sheet.cell_height,
      };
      return {
        id: id,
        asset_id: boundedText(raw.asset_id, sourceId + "#frame:" + id, 160, "frame asset id"),
        animation: animation,
        direction: direction,
        index: frameIndex,
        duration_ms: duration,
        cell: cell,
        atlas: atlas,
        bounds: normalizeBounds(raw.bounds, sheet, id),
        pivot: normalizePivot(raw.pivot, id),
        tags: uniqueStrings(raw.tags, 80, "frame tag"),
        events: normalizeEvents(raw.events, duration, id),
      };
    });
  }

  function normalizePlayback(raw, frameCount) {
    raw = raw || {};
    var mode = String(raw.mode || "loop").toLowerCase();
    var order = String(raw.order || "forward").toLowerCase();
    ensure(mode === "loop" || mode === "once", "clip playback mode is unsupported");
    ensure(order === "forward" || order === "reverse" || order === "ping-pong", "clip playback order is unsupported");
    ensure(frameCount >= 2, "pixel animation clips require at least two frames");
    return {
      mode: mode,
      order: order,
      repeat_count: mode === "once" ? 1 : integer(raw.repeat_count == null ? 0 : raw.repeat_count, 0, 65535, "clip repeat count"),
    };
  }

  function orderedIds(frameIds, order) {
    var ids = frameIds.slice();
    if (order === "reverse") return ids.reverse();
    if (order === "ping-pong" && ids.length > 2) return ids.concat(ids.slice(1, -1).reverse());
    return ids;
  }

  function normalizeClips(rawClips, frames) {
    var frameMap = new Map(frames.map(function (frame) { return [frame.id, frame]; }));
    var grouped = new Map();
    frames.forEach(function (frame) {
      var key = frame.animation + "\u0000" + frame.direction;
      var groupedFrames = grouped.get(key) || [];
      groupedFrames.push(frame);
      grouped.set(key, groupedFrames);
    });
    grouped.forEach(function (groupedFrames) {
      groupedFrames.sort(function (left, right) { return left.index - right.index || left.id.localeCompare(right.id); });
    });
    var values = Array.isArray(rawClips) && rawClips.length
      ? rawClips
      : Array.from(grouped.keys()).sort().map(function (key) {
          var groupedFrames = grouped.get(key);
          var first = groupedFrames[0];
          return {
            id: first.animation + "-" + first.direction,
            animation: first.animation,
            direction: first.direction,
            frame_ids: groupedFrames.map(function (frame) { return frame.id; }),
          };
        });
    ensure(values.length >= 1 && values.length <= MAX_CLIPS, "animation recipe requires 1 to " + MAX_CLIPS + " clips");
    var clipIds = Object.create(null), runtimeNames = Object.create(null), referenced = Object.create(null);
    var clips = values.map(function (raw, position) {
      raw = raw || {};
      var animation = boundedText(raw.animation, "default", 80, "clip animation");
      var direction = boundedText(raw.direction, "none", 80, "clip direction");
      var id = portableId(raw.id, animation + "-" + direction + "-" + position, "clip id");
      ensure(!clipIds[id], "animation clip ids must be unique");
      clipIds[id] = true;
      var frameIds = (Array.isArray(raw.frame_ids) ? raw.frame_ids : []).map(function (value) {
        return portableId(value, "", "clip frame id");
      });
      ensure(frameIds.length >= 2 && frameIds.length <= MAX_FRAMES, "clip " + id + " requires 2 to " + MAX_FRAMES + " frame references");
      ensure(new Set(frameIds).size === frameIds.length, "clip " + id + " contains duplicate frame references");
      frameIds.forEach(function (frameId) {
        var frame = frameMap.get(frameId);
        ensure(!!frame, "clip " + id + " references missing frame " + frameId);
        ensure(frame.animation === animation && frame.direction === direction, "clip " + id + " frame metadata does not match its animation and direction");
        referenced[frameId] = true;
      });
      var runtimeName = boundedText(raw.runtime_name, animation + "|" + direction, 120, "clip runtime name");
      ensure(!runtimeNames[runtimeName], "animation clip runtime names must be unique");
      runtimeNames[runtimeName] = true;
      var playback = normalizePlayback(raw.playback, frameIds.length);
      var ordered = orderedIds(frameIds, playback.order);
      var duration = ordered.reduce(function (sum, frameId) { return sum + frameMap.get(frameId).duration_ms; }, 0);
      return {
        id: id,
        runtime_name: runtimeName,
        animation: animation,
        direction: direction,
        frame_ids: frameIds,
        playback: playback,
        duration_ms: duration,
        tags: uniqueStrings(raw.tags, 80, "clip tag"),
      };
    });
    var orphaned = frames.filter(function (frame) { return !referenced[frame.id]; }).map(function (frame) { return frame.id; });
    ensure(orphaned.length === 0, "animation frames must belong to at least one clip: " + orphaned.join(", "));
    return clips;
  }

  function normalizePalette(raw, profile) {
    raw = raw || {};
    var colours = (Array.isArray(raw.colours) ? raw.colours : []).map(function (value, index) {
      return normalizeColour(value, "palette colour " + index);
    });
    ensure(colours.length <= 256, "animation palette exceeds 256 colours");
    ensure(new Set(colours).size === colours.length, "animation palette colours must be unique");
    var enforcement = String(raw.enforcement || (colours.length ? "exact" : "limit")).toLowerCase();
    ensure(enforcement === "limit" || enforcement === "exact", "animation palette enforcement is unsupported");
    ensure(enforcement !== "exact" || colours.length > 0, "exact palette enforcement requires declared colours");
    var maxColours = integer(raw.max_colours == null ? profile.max_colours : raw.max_colours, 1, profile.max_colours, "animation palette maximum");
    ensure(colours.length <= maxColours, "declared animation palette exceeds its maximum");
    return {
      enforcement: enforcement,
      max_colours: maxColours,
      colours: colours,
      include_transparent: raw.include_transparent === true,
    };
  }

  function normalizePreview(raw, profile) {
    raw = raw || {};
    return {
      emit_integer_preview: raw.emit_integer_preview !== false,
      integer_scale: integer(raw.integer_scale == null ? profile.default_preview_scale : raw.integer_scale, 1, 16, "preview integer scale"),
      background: normalizeColour(raw.background || "#00000000", "preview background"),
    };
  }

  function normalizeVideo(raw) {
    raw = raw || {};
    return {
      emit_sequence: raw.emit_sequence !== false,
      cycles: integer(raw.cycles == null ? 1 : raw.cycles, 1, 16, "video sequence cycles"),
      timebase: "milliseconds",
    };
  }

  function normalizeValidation(raw) {
    raw = raw || {};
    return {
      reject_duplicate_frames: raw.reject_duplicate_frames === true,
      max_clip_duration_ms: integer(raw.max_clip_duration_ms == null ? 120000 : raw.max_clip_duration_ms, 1, 120000, "maximum clip duration"),
    };
  }

  function normalizeContributors(values) {
    var ids = Object.create(null);
    return (Array.isArray(values) ? values : []).slice(0, 32).map(function (raw, index) {
      raw = raw || {};
      var type = String(raw.type || "unknown").toLowerCase();
      ensure(["human", "ai", "program", "mixed", "unknown"].indexOf(type) >= 0, "contributor type is unsupported");
      var id = boundedText(raw.id, "contributor-" + (index + 1), 120, "contributor id");
      ensure(!ids[id], "contributor ids must be unique");
      ids[id] = true;
      return {
        id: id,
        type: type,
        role: boundedText(raw.role, "author", 80, "contributor role"),
        tool: optionalText(raw.tool, 120, "contributor tool"),
        version: optionalText(raw.version, 80, "contributor version"),
      };
    });
  }

  function normalizeProvenance(raw) {
    raw = raw || {};
    var authorType = String(raw.author_type || "unknown").toLowerCase();
    ensure(["human", "ai", "program", "mixed", "unknown"].indexOf(authorType) >= 0, "animation author type is unsupported");
    var contributors = normalizeContributors(raw.contributors);
    return {
      author_type: authorType,
      actor_id: optionalText(raw.actor_id, 120, "animation actor id"),
      parent_package_id: optionalText(raw.parent_package_id, 160, "parent package id"),
      parent_recipe_id: optionalText(raw.parent_recipe_id, 160, "parent recipe id"),
      contributors: contributors,
      ai_used: authorType === "ai" || authorType === "mixed" || contributors.some(function (item) { return item.type === "ai" || item.type === "mixed"; }),
    };
  }

  function normalizeRecipe(raw, sourceDimensions) {
    raw = raw && typeof raw === "object" ? clone(raw) : {};
    ensure(raw.schema === RECIPE_SCHEMA, "pixel animation recipe schema mismatch");
    var profile = resolveProfile(raw.profile);
    var sourceArtifactId = boundedText(raw.source_artifact_id, "", 100, "pixel animation source_artifact_id");
    var sheet = normalizeSheet(raw.sheet, sourceDimensions, profile);
    var frames = normalizeFrames(raw.frames, sheet, sourceArtifactId, profile);
    var clips = normalizeClips(raw.clips, frames);
    var validation = normalizeValidation(raw.validation);
    clips.forEach(function (clip) {
      ensure(clip.duration_ms <= validation.max_clip_duration_ms, "clip " + clip.id + " exceeds the declared duration boundary");
    });
    ensure(frames.length * sheet.cell_width * sheet.cell_height <= MAX_FRAME_PIXELS, "animation frame extraction exceeds the memory boundary");
    return {
      schema: RECIPE_SCHEMA,
      version: "1.0.0",
      id: portableId(raw.id, "pixel-animation", "pixel animation recipe id"),
      identity_id: optionalText(raw.identity_id, 160, "asset identity id"),
      representation_profile_id: optionalText(raw.representation_profile_id, 160, "representation profile id"),
      source_artifact_id: sourceArtifactId,
      profile: profile,
      sheet: sheet,
      frames: frames,
      clips: clips,
      palette: normalizePalette(raw.palette, profile),
      preview: normalizePreview(raw.preview, profile),
      video: normalizeVideo(raw.video),
      validation: validation,
      provenance: normalizeProvenance(raw.provenance),
      authority: "candidate-only",
    };
  }

  function extractFrames(sheetImage, rawRecipe) {
    var sheet = Raster.makeImage(sheetImage.width, sheetImage.height, sheetImage.rgba);
    var recipe = normalizeRecipe(rawRecipe, { width: sheet.width, height: sheet.height });
    var frames = recipe.frames.map(function (metadata) {
      return {
        metadata: clone(metadata),
        image: Raster.crop(sheet, metadata.atlas),
      };
    });
    return { recipe: recipe, frames: frames };
  }

  function paletteEntries(image, includeTransparent) {
    var counts = new Map();
    for (var index = 0; index < image.rgba.length; index += 4) {
      var alpha = image.rgba[index + 3];
      if (!includeTransparent && alpha === 0) continue;
      var rgba = [image.rgba[index], image.rgba[index + 1], image.rgba[index + 2], alpha];
      var key = rgba.join(",");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(function (entry) {
      return { rgba: entry[0].split(",").map(Number), count: entry[1] };
    }).sort(function (left, right) {
      return right.count - left.count || left.rgba.join(",").localeCompare(right.rgba.join(","));
    });
  }

  function inspectFrames(extraction) {
    var recipe = extraction.recipe;
    var images = extraction.frames.map(function (frame) { return frame.image; });
    var framePalettes = images.map(function (image) { return paletteEntries(image, recipe.palette.include_transparent); });
    var assetCounts = new Map();
    framePalettes.forEach(function (entries) {
      entries.forEach(function (entry) {
        var key = entry.rgba.join(",");
        assetCounts.set(key, (assetCounts.get(key) || 0) + entry.count);
      });
    });
    var assetPalette = Array.from(assetCounts.entries()).map(function (entry) {
      return { rgba: entry[0].split(",").map(Number), count: entry[1] };
    }).sort(function (left, right) {
      return right.count - left.count || left.rgba.join(",").localeCompare(right.rgba.join(","));
    });
    var allowed = new Set(recipe.palette.colours.map(function (value) { return colourBytes(value).join(","); }));
    var offPalette = assetPalette.filter(function (entry) {
      return recipe.palette.enforcement === "exact" && !allowed.has(entry.rgba.join(","));
    });
    var duplicates = Raster.duplicateFrames(images);
    var clipDurations = recipe.clips.map(function (clip) {
      return { id: clip.id, duration_ms: clip.duration_ms };
    });
    return {
      frame_count: images.length,
      clip_count: recipe.clips.length,
      asset_palette_count: assetPalette.length,
      asset_palette: assetPalette.slice(0, 256),
      frame_palette_counts: framePalettes.map(function (entries) { return entries.length; }),
      off_palette_colours: offPalette,
      duplicate_frame_pairs: duplicates,
      clip_durations: clipDurations,
      palette_limit_pass: assetPalette.length <= recipe.palette.max_colours,
      exact_palette_pass: recipe.palette.enforcement !== "exact" || offPalette.length === 0,
      duplicate_policy_pass: !recipe.validation.reject_duplicate_frames || duplicates.length === 0,
    };
  }

  function frameMap(recipe) {
    return new Map(recipe.frames.map(function (frame) { return [frame.id, frame]; }));
  }

  function clipById(recipe, value) {
    var clip = recipe.clips.find(function (item) { return item.id === value || item.runtime_name === value; });
    ensure(!!clip, "animation clip is missing: " + value);
    return clip;
  }

  function orderedFrameIds(recipe, clipId) {
    var clip = clipById(recipe, clipId);
    return orderedIds(clip.frame_ids, clip.playback.order);
  }

  function clipTimeline(recipe, clipId, cycles) {
    var clip = clipById(recipe, clipId);
    var frames = frameMap(recipe);
    var ids = orderedIds(clip.frame_ids, clip.playback.order);
    cycles = integer(cycles == null ? 1 : cycles, 1, 65535, "timeline cycles");
    var segments = [], cursor = 0;
    for (var cycle = 0; cycle < cycles; cycle += 1) {
      ids.forEach(function (frameId, sequenceIndex) {
        var duration = frames.get(frameId).duration_ms;
        segments.push({
          frame_id: frameId,
          cycle: cycle,
          sequence_index: sequenceIndex,
          start_ms: cursor,
          duration_ms: duration,
          end_ms: cursor + duration,
        });
        cursor += duration;
      });
    }
    return {
      clip_id: clip.id,
      runtime_name: clip.runtime_name,
      cycles: cycles,
      duration_ms: cursor,
      segments: segments,
    };
  }

  function sampleClip(recipe, clipId, elapsedMs) {
    var clip = clipById(recipe, clipId);
    elapsedMs = Math.max(0, finite(elapsedMs, 0, Number.MAX_SAFE_INTEGER, "animation elapsed time"));
    var one = clipTimeline(recipe, clip.id, 1);
    var finiteCycles = clip.playback.mode === "once"
      ? 1
      : clip.playback.repeat_count > 0
        ? clip.playback.repeat_count
        : null;
    var ended = finiteCycles != null && elapsedMs >= one.duration_ms * finiteCycles;
    var cycle = Math.floor(elapsedMs / one.duration_ms);
    if (finiteCycles != null) cycle = Math.min(finiteCycles - 1, cycle);
    var local = ended ? one.duration_ms : elapsedMs % one.duration_ms;
    if (ended) local = one.duration_ms - 0.000001;
    var segment = one.segments.find(function (item) { return local >= item.start_ms && local < item.end_ms; }) || one.segments[one.segments.length - 1];
    return {
      clip_id: clip.id,
      runtime_name: clip.runtime_name,
      frame_id: segment.frame_id,
      elapsed_ms: elapsedMs,
      local_time_ms: local,
      frame_elapsed_ms: Math.max(0, local - segment.start_ms),
      frame_progress: Math.max(0, Math.min(1, (local - segment.start_ms) / segment.duration_ms)),
      cycle: cycle,
      ended: ended,
    };
  }

  function toGameAnimationClips(recipe) {
    return recipe.clips.map(function (clip) {
      return {
        id: clip.id,
        name: clip.runtime_name,
        duration: clip.duration_ms / 1000,
        duration_ms: clip.duration_ms,
        loop: clip.playback.mode === "loop",
        animation: clip.animation,
        direction: clip.direction,
        source_contract: MANIFEST_SCHEMA,
      };
    });
  }

  function sampleGameAnimationFrame(recipe, gameFrame) {
    ensure(gameFrame && gameFrame.clip, "game animation frame must name a clip");
    var sampled = sampleClip(recipe, gameFrame.clip, Number(gameFrame.state_time_ms) || 0);
    sampled.game_state = gameFrame.state || null;
    sampled.game_tick = gameFrame.tick == null ? null : gameFrame.tick;
    sampled.source_schema = gameFrame.schema || null;
    return sampled;
  }

  function compileVideoSequence(recipe, frameArtifacts, manifestId) {
    frameArtifacts = frameArtifacts || {};
    var sequences = recipe.clips.map(function (clip) {
      var timeline = clipTimeline(recipe, clip.id, recipe.video.cycles);
      return {
        clip_id: clip.id,
        runtime_name: clip.runtime_name,
        animation: clip.animation,
        direction: clip.direction,
        cycles: timeline.cycles,
        duration_ms: timeline.duration_ms,
        segments: timeline.segments.map(function (segment) {
          var artifact = frameArtifacts[segment.frame_id] || {};
          return Object.assign({}, segment, {
            artifact_id: artifact.artifact_id || null,
            filename: artifact.filename || null,
            sha256: artifact.sha256 || null,
          });
        }),
      };
    });
    return {
      schema: VIDEO_SEQUENCE_SCHEMA,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: recipe.id + "-video-sequences",
      identity_id: recipe.identity_id,
      representation_profile_id: recipe.representation_profile_id,
      source_manifest_id: manifestId,
      timebase: { unit: "milliseconds", integer: true },
      dimensions: { width: recipe.sheet.cell_width, height: recipe.sheet.cell_height, unit: "px" },
      frames: recipe.frames.map(function (frame) {
        var artifact = frameArtifacts[frame.id] || {};
        return {
          frame_id: frame.id,
          artifact_id: artifact.artifact_id || null,
          filename: artifact.filename || null,
          sha256: artifact.sha256 || null,
        };
      }),
      sequences: sequences,
      provenance: clone(recipe.provenance),
      authority: "candidate-only",
    };
  }

  return {
    VERSION: VERSION,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    MANIFEST_SCHEMA: MANIFEST_SCHEMA,
    VIDEO_SEQUENCE_SCHEMA: VIDEO_SEQUENCE_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    MAX_FRAMES: MAX_FRAMES,
    MAX_CLIPS: MAX_CLIPS,
    MAX_APNG_FRAMES: MAX_APNG_FRAMES,
    PROFILES: clone(PROFILE_DEFINITIONS),
    resolveProfile: resolveProfile,
    normalizeRecipe: normalizeRecipe,
    extractFrames: extractFrames,
    inspectFrames: inspectFrames,
    orderedFrameIds: orderedFrameIds,
    clipTimeline: clipTimeline,
    sampleClip: sampleClip,
    toGameAnimationClips: toGameAnimationClips,
    sampleGameAnimationFrame: sampleGameAnimationFrame,
    compileVideoSequence: compileVideoSequence,
  };
});
