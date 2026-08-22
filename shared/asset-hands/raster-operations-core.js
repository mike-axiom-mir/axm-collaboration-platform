(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMRasterOperationsCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var RECIPE_SCHEMA = "axm.raster-operations-recipe/v1";
  var MAX_PIXELS = 4194304;
  var MAX_FRAMES = 256;
  var OPERATIONS = [
    "crop",
    "trim-alpha",
    "resize-nearest",
    "pad",
    "alpha-threshold",
    "palette-map",
    "grid-slice",
    "grid-pack",
  ];

  function ensure(pass, message) {
    if (!pass) throw new Error(message);
  }

  function integer(value, minimum, maximum, label) {
    var parsed = Number(value);
    ensure(Number.isInteger(parsed), label + " must be an integer");
    ensure(parsed >= minimum && parsed <= maximum, label + " is outside its bounded range");
    return parsed;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function portableId(value, fallback) {
    var id = String(value || fallback || "operation")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    ensure(!!id, "operation id is required");
    return id;
  }

  function copyBytes(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
    if (ArrayBuffer.isView(value))
      return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    return new Uint8Array(value || []);
  }

  function makeImage(width, height, rgba) {
    width = integer(width, 1, 16384, "image width");
    height = integer(height, 1, 16384, "image height");
    ensure(width * height <= MAX_PIXELS, "image exceeds the raster core pixel boundary");
    rgba = copyBytes(rgba);
    ensure(rgba.length === width * height * 4, "RGBA8 byte length does not match image dimensions");
    return { width: width, height: height, rgba: rgba };
  }

  function cloneImage(image) {
    return makeImage(image.width, image.height, image.rgba);
  }

  function parseColour(value, fallback) {
    value = String(value || fallback || "#00000000").trim();
    var match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
    ensure(!!match, "colour must use #RRGGBB or #RRGGBBAA");
    var rgb = match[1], alpha = match[2] || "ff";
    return [
      parseInt(rgb.slice(0, 2), 16),
      parseInt(rgb.slice(2, 4), 16),
      parseInt(rgb.slice(4, 6), 16),
      parseInt(alpha, 16),
    ];
  }

  function crop(image, parameters) {
    parameters = parameters || {};
    var x = integer(parameters.x, 0, image.width - 1, "crop x");
    var y = integer(parameters.y, 0, image.height - 1, "crop y");
    var width = integer(parameters.width, 1, image.width, "crop width");
    var height = integer(parameters.height, 1, image.height, "crop height");
    ensure(x + width <= image.width && y + height <= image.height, "crop rectangle exceeds source bounds");
    var output = new Uint8Array(width * height * 4);
    for (var row = 0; row < height; row += 1) {
      var sourceStart = ((y + row) * image.width + x) * 4;
      output.set(image.rgba.subarray(sourceStart, sourceStart + width * 4), row * width * 4);
    }
    return makeImage(width, height, output);
  }

  function trimAlpha(image, parameters) {
    parameters = parameters || {};
    var threshold = integer(parameters.threshold == null ? 0 : parameters.threshold, 0, 255, "trim alpha threshold");
    var minX = image.width, minY = image.height, maxX = -1, maxY = -1;
    for (var y = 0; y < image.height; y += 1) {
      for (var x = 0; x < image.width; x += 1) {
        if (image.rgba[(y * image.width + x) * 4 + 3] <= threshold) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    ensure(maxX >= minX && maxY >= minY, "trim-alpha found no pixel above the declared threshold");
    return crop(image, { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
  }

  function resizeNearest(image, parameters) {
    parameters = parameters || {};
    var width = integer(parameters.width, 1, 16384, "resize width");
    var height = integer(parameters.height, 1, 16384, "resize height");
    ensure(width * height <= MAX_PIXELS, "resized image exceeds the raster core pixel boundary");
    var output = new Uint8Array(width * height * 4);
    for (var y = 0; y < height; y += 1) {
      var sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
      for (var x = 0; x < width; x += 1) {
        var sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
        var source = (sourceY * image.width + sourceX) * 4;
        var target = (y * width + x) * 4;
        output[target] = image.rgba[source];
        output[target + 1] = image.rgba[source + 1];
        output[target + 2] = image.rgba[source + 2];
        output[target + 3] = image.rgba[source + 3];
      }
    }
    return makeImage(width, height, output);
  }

  function anchorOffset(anchor, outerWidth, outerHeight, innerWidth, innerHeight) {
    var horizontal = anchor.indexOf("left") >= 0 ? 0 : anchor.indexOf("right") >= 0 ? outerWidth - innerWidth : Math.floor((outerWidth - innerWidth) / 2);
    var vertical = anchor.indexOf("top") >= 0 ? 0 : anchor.indexOf("bottom") >= 0 ? outerHeight - innerHeight : Math.floor((outerHeight - innerHeight) / 2);
    return { x: horizontal, y: vertical };
  }

  function pad(image, parameters) {
    parameters = parameters || {};
    var width = integer(parameters.width, image.width, 16384, "pad width");
    var height = integer(parameters.height, image.height, 16384, "pad height");
    ensure(width * height <= MAX_PIXELS, "padded image exceeds the raster core pixel boundary");
    var allowed = ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"];
    var anchor = String(parameters.anchor || "center").toLowerCase();
    ensure(allowed.indexOf(anchor) >= 0, "pad anchor is unsupported");
    var fill = parseColour(parameters.fill, "#00000000");
    var output = new Uint8Array(width * height * 4);
    for (var index = 0; index < width * height; index += 1) output.set(fill, index * 4);
    var offset = anchorOffset(anchor, width, height, image.width, image.height);
    for (var y = 0; y < image.height; y += 1) {
      var sourceStart = y * image.width * 4;
      var targetStart = ((offset.y + y) * width + offset.x) * 4;
      output.set(image.rgba.subarray(sourceStart, sourceStart + image.width * 4), targetStart);
    }
    return makeImage(width, height, output);
  }

  function alphaThreshold(image, parameters) {
    parameters = parameters || {};
    var threshold = integer(parameters.threshold == null ? 127 : parameters.threshold, 0, 255, "alpha threshold");
    var output = copyBytes(image.rgba);
    for (var index = 3; index < output.length; index += 4) output[index] = output[index] > threshold ? 255 : 0;
    return makeImage(image.width, image.height, output);
  }

  function paletteMap(image, parameters) {
    parameters = parameters || {};
    ensure(Array.isArray(parameters.palette) && parameters.palette.length >= 1 && parameters.palette.length <= 256, "palette-map requires 1 to 256 colours");
    var colours = parameters.palette.map(function (colour) { return parseColour(colour, "#000000"); });
    var output = copyBytes(image.rgba);
    for (var index = 0; index < output.length; index += 4) {
      if (output[index + 3] === 0) continue;
      var best = 0, bestDistance = Infinity;
      for (var colourIndex = 0; colourIndex < colours.length; colourIndex += 1) {
        var colour = colours[colourIndex];
        var red = output[index] - colour[0], green = output[index + 1] - colour[1], blue = output[index + 2] - colour[2];
        var distance = red * red + green * green + blue * blue;
        if (distance < bestDistance) { bestDistance = distance; best = colourIndex; }
      }
      output[index] = colours[best][0];
      output[index + 1] = colours[best][1];
      output[index + 2] = colours[best][2];
    }
    return makeImage(image.width, image.height, output);
  }

  function sliceGrid(image, parameters) {
    parameters = parameters || {};
    var cellWidth = integer(parameters.cell_width, 1, image.width, "grid cell width");
    var cellHeight = integer(parameters.cell_height, 1, image.height, "grid cell height");
    ensure(image.width % cellWidth === 0 && image.height % cellHeight === 0, "grid slice requires dimensions divisible by the declared cell");
    var columns = image.width / cellWidth, rows = image.height / cellHeight;
    ensure(columns * rows <= MAX_FRAMES, "grid slice exceeds the frame boundary");
    var frames = [];
    for (var row = 0; row < rows; row += 1) {
      for (var column = 0; column < columns; column += 1) {
        frames.push(crop(image, { x: column * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight }));
      }
    }
    return { frames: frames, columns: columns, rows: rows, cellWidth: cellWidth, cellHeight: cellHeight };
  }

  function packGrid(frames, parameters) {
    parameters = parameters || {};
    ensure(Array.isArray(frames) && frames.length >= 1 && frames.length <= MAX_FRAMES, "grid pack requires a bounded frame set");
    var cellWidth = frames[0].width, cellHeight = frames[0].height;
    ensure(frames.every(function (frame) { return frame.width === cellWidth && frame.height === cellHeight; }), "grid pack requires equal frame dimensions");
    var columns = integer(parameters.columns == null ? frames.length : parameters.columns, 1, frames.length, "pack columns");
    var rows = Math.ceil(frames.length / columns);
    var padding = integer(parameters.padding == null ? 0 : parameters.padding, 0, 256, "pack padding");
    var width = columns * cellWidth + Math.max(0, columns - 1) * padding;
    var height = rows * cellHeight + Math.max(0, rows - 1) * padding;
    ensure(width * height <= MAX_PIXELS, "packed grid exceeds the raster core pixel boundary");
    var fill = parseColour(parameters.fill, "#00000000");
    var output = new Uint8Array(width * height * 4);
    for (var index = 0; index < width * height; index += 1) output.set(fill, index * 4);
    frames.forEach(function (frame, frameIndex) {
      var column = frameIndex % columns, row = Math.floor(frameIndex / columns);
      var offsetX = column * (cellWidth + padding), offsetY = row * (cellHeight + padding);
      for (var y = 0; y < cellHeight; y += 1) {
        var sourceStart = y * cellWidth * 4;
        var targetStart = ((offsetY + y) * width + offsetX) * 4;
        output.set(frame.rgba.subarray(sourceStart, sourceStart + cellWidth * 4), targetStart);
      }
    });
    return { image: makeImage(width, height, output), columns: columns, rows: rows, padding: padding };
  }

  function palette(image) {
    var counts = new Map();
    for (var index = 0; index < image.rgba.length; index += 4) {
      var key = [image.rgba[index], image.rgba[index + 1], image.rgba[index + 2], image.rgba[index + 3]].join(",");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(function (entry) { return { rgba: entry[0].split(",").map(Number), count: entry[1] }; })
      .sort(function (left, right) { return right.count - left.count || left.rgba.join(",").localeCompare(right.rgba.join(",")); });
  }

  function imagesEqual(left, right) {
    if (!left || !right || left.width !== right.width || left.height !== right.height || left.rgba.length !== right.rgba.length) return false;
    for (var index = 0; index < left.rgba.length; index += 1) if (left.rgba[index] !== right.rgba[index]) return false;
    return true;
  }

  function fingerprint(image) {
    var value = 2166136261;
    value ^= image.width; value = Math.imul(value, 16777619);
    value ^= image.height; value = Math.imul(value, 16777619);
    for (var index = 0; index < image.rgba.length; index += 1) { value ^= image.rgba[index]; value = Math.imul(value, 16777619); }
    return (value >>> 0).toString(16).padStart(8, "0");
  }

  function duplicateFrames(frames) {
    var groups = new Map(), duplicates = [];
    frames.forEach(function (frame, index) {
      var key = fingerprint(frame), candidates = groups.get(key) || [];
      candidates.forEach(function (candidate) {
        if (imagesEqual(frames[candidate], frame)) duplicates.push([candidate, index]);
      });
      candidates.push(index); groups.set(key, candidates);
    });
    return duplicates;
  }

  function normalizeRecipe(raw) {
    raw = raw && typeof raw === "object" ? clone(raw) : {};
    ensure(raw.schema === RECIPE_SCHEMA, "raster operations recipe schema mismatch");
    ensure(Array.isArray(raw.operations) && raw.operations.length <= 64, "raster operations recipe requires at most 64 operations");
    var ids = {}, sliceCount = 0, packCount = 0;
    var operations = raw.operations.map(function (operation, index) {
      operation = operation || {};
      var op = String(operation.op || "").toLowerCase();
      ensure(OPERATIONS.indexOf(op) >= 0, "unsupported raster operation: " + op);
      if (op === "grid-slice") sliceCount += 1;
      if (op === "grid-pack") packCount += 1;
      var id = portableId(operation.id, "op-" + String(index + 1).padStart(2, "0") + "-" + op);
      ensure(!ids[id], "raster operation ids must be unique");
      ids[id] = true;
      return { id: id, op: op, parameters: clone(operation.parameters || {}) };
    });
    ensure(sliceCount <= 1 && packCount <= 1, "v0 supports at most one grid-slice and one grid-pack operation");
    var sourceArtifactId = String(raw.source_artifact_id || "");
    ensure(!!sourceArtifactId && sourceArtifactId.length <= 100, "raster operations recipe requires a bounded source_artifact_id");
    return {
      schema: RECIPE_SCHEMA,
      version: "1.0.0",
      id: portableId(raw.id, "raster-recipe"),
      source_artifact_id: sourceArtifactId,
      operations: operations,
      validation: clone(raw.validation || {}),
      authority: "candidate-only",
    };
  }

  function runRecipe(inputImage, rawRecipe) {
    var recipe = normalizeRecipe(rawRecipe), source = cloneImage(inputImage);
    var current = { kind: "image", image: source, entityIds: ["source:" + (recipe.source_artifact_id || "input")] };
    var activities = [], entities = [{ id: current.entityIds[0], kind: "raster", width: source.width, height: source.height, materialized: true }];
    var retainedFrames = null, retainedFrameIds = [], sliceInfo = null, roundTrips = [];
    recipe.operations.forEach(function (operation) {
      var used = current.entityIds.slice(), generated = [], next;
      if (operation.op === "grid-slice") {
        ensure(current.kind === "image", "grid-slice requires an image state");
        var beforeSlice = cloneImage(current.image);
        var sliced = sliceGrid(current.image, operation.parameters);
        retainedFrames = sliced.frames.map(cloneImage);
        retainedFrameIds = retainedFrames.map(function (frame, index) {
          var id = operation.id + "/frame-" + String(index).padStart(3, "0");
          entities.push({ id: id, kind: "frame", width: frame.width, height: frame.height, materialized: true, frame_index: index });
          return id;
        });
        sliceInfo = { source: beforeSlice, columns: sliced.columns, rows: sliced.rows, cellWidth: sliced.cellWidth, cellHeight: sliced.cellHeight, operationId: operation.id };
        generated = retainedFrameIds.slice();
        next = { kind: "frames", frames: retainedFrames.map(cloneImage), entityIds: generated.slice() };
      } else if (operation.op === "grid-pack") {
        ensure(current.kind === "frames", "grid-pack requires a frame state produced by grid-slice");
        var packed = packGrid(current.frames, operation.parameters);
        generated = [operation.id];
        entities.push({ id: operation.id, kind: "raster", width: packed.image.width, height: packed.image.height, materialized: true });
        if (sliceInfo && packed.padding === 0 && packed.columns === sliceInfo.columns) {
          roundTrips.push({ name: "slice-pack-pixel-roundtrip", pass: imagesEqual(sliceInfo.source, packed.image), slice_operation_id: sliceInfo.operationId, pack_operation_id: operation.id });
        }
        next = { kind: "image", image: packed.image, entityIds: generated.slice() };
      } else {
        ensure(current.kind === "image", operation.op + " requires an image state");
        var functions = { crop: crop, "trim-alpha": trimAlpha, "resize-nearest": resizeNearest, pad: pad, "alpha-threshold": alphaThreshold, "palette-map": paletteMap };
        var transformed = functions[operation.op](current.image, operation.parameters);
        generated = [operation.id];
        entities.push({ id: operation.id, kind: "raster", width: transformed.width, height: transformed.height, materialized: true });
        next = { kind: "image", image: transformed, entityIds: generated.slice() };
      }
      activities.push({ id: "activity:" + operation.id, operation: operation.op, parameters: clone(operation.parameters), used: used, generated: generated, deterministic: true });
      current = next;
    });
    var finalImages = current.kind === "image" ? [current.image] : current.frames;
    var sourcePalette = palette(source), palettes = finalImages.map(palette), duplicates = retainedFrames ? duplicateFrames(retainedFrames) : [];
    return {
      recipe: recipe,
      state: current,
      retainedFrames: retainedFrames,
      retainedFrameIds: retainedFrameIds,
      activities: activities,
      entities: entities,
      roundTrips: roundTrips,
      analysis: {
        source_palette_count: sourcePalette.length,
        source_palette: sourcePalette.slice(0, 256),
        source_palette_truncated: sourcePalette.length > 256,
        output_palette_counts: palettes.map(function (entries) { return entries.length; }),
        output_palettes: palettes.map(function (entries) { return entries.slice(0, 256); }),
        output_palettes_truncated: palettes.map(function (entries) { return entries.length > 256; }),
        duplicate_frame_pairs: duplicates,
      },
    };
  }

  return {
    VERSION: VERSION,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    OPERATIONS: OPERATIONS.slice(),
    MAX_PIXELS: MAX_PIXELS,
    MAX_FRAMES: MAX_FRAMES,
    makeImage: makeImage,
    cloneImage: cloneImage,
    crop: crop,
    trimAlpha: trimAlpha,
    resizeNearest: resizeNearest,
    pad: pad,
    alphaThreshold: alphaThreshold,
    paletteMap: paletteMap,
    sliceGrid: sliceGrid,
    packGrid: packGrid,
    palette: palette,
    imagesEqual: imagesEqual,
    duplicateFrames: duplicateFrames,
    normalizeRecipe: normalizeRecipe,
    runRecipe: runRecipe,
  };
});
