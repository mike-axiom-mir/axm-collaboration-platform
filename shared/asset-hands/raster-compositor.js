(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMRasterCompositor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var RECIPE_SCHEMA = "axm.raster-composition/v1";
  var RECEIPT_SCHEMA = "axm.raster-composition-receipt/v1";
  var MAX_DIMENSION = 2048;
  var MAX_PIXELS = 4194304;
  var MAX_LAYERS = 32;
  var MAX_FILTERS = 64;
  var MAX_WORKING_BYTES = 134217728;
  var BLEND_MODES = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "add",
    "subtract",
  ];
  var FILTER_TYPES = [
    "brightness",
    "contrast",
    "saturation",
    "hue",
    "grayscale",
    "invert",
    "gamma",
    "threshold",
    "posterize",
    "tint",
    "blur",
    "sharpen",
    "pixelate",
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function cleanText(value, maximum) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum || 160);
  }
  function finite(value, label) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(label + " must be finite");
    return parsed;
  }
  function bounded(value, minimum, maximum, label) {
    value = finite(value, label);
    if (value < minimum || value > maximum)
      throw new Error(label + " must be between " + minimum + " and " + maximum);
    return value;
  }
  function integer(value, minimum, maximum, label) {
    value = finite(value, label);
    if (Math.round(value) !== value || value < minimum || value > maximum)
      throw new Error(label + " must be an integer between " + minimum + " and " + maximum);
    return value;
  }
  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
  function byte(value) {
    return Math.round(clamp(value, 0, 255));
  }
  function stableStringify(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(function (key) {
          return JSON.stringify(key) + ":" + stableStringify(value[key]);
        })
        .join(",") +
      "}"
    );
  }
  function digest(value) {
    var source = typeof value === "string" ? value : stableStringify(value);
    var out = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      out ^= source.charCodeAt(index);
      out = Math.imul(out, 16777619);
    }
    return "fnv1a32-" + (out >>> 0).toString(16).padStart(8, "0");
  }
  function parseColour(value, label) {
    var match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(value || ""));
    if (!match) throw new Error((label || "colour") + " must be #RRGGBB or #RRGGBBAA");
    return [
      parseInt(match[1].slice(0, 2), 16),
      parseInt(match[1].slice(2, 4), 16),
      parseInt(match[1].slice(4, 6), 16),
      match[2] ? parseInt(match[2], 16) : 255,
    ];
  }
  function normalizeFilter(raw, label) {
    raw = raw && typeof raw === "object" ? raw : {};
    var type = cleanText(raw.type, 40).toLowerCase();
    if (FILTER_TYPES.indexOf(type) < 0)
      throw new Error(label + " uses unsupported filter " + (type || "(missing)"));
    var filter = { type: type };
    if (type === "brightness" || type === "contrast")
      filter.value = bounded(raw.value, -1, 1, label + ".value");
    else if (type === "saturation")
      filter.value = bounded(raw.value, 0, 3, label + ".value");
    else if (type === "hue")
      filter.value = bounded(raw.value, -180, 180, label + ".value");
    else if (type === "grayscale" || type === "invert")
      filter.amount = bounded(raw.amount, 0, 1, label + ".amount");
    else if (type === "gamma")
      filter.value = bounded(raw.value, 0.1, 4, label + ".value");
    else if (type === "threshold")
      filter.value = bounded(raw.value, 0, 1, label + ".value");
    else if (type === "posterize")
      filter.levels = integer(raw.levels, 2, 64, label + ".levels");
    else if (type === "tint") {
      parseColour(raw.colour, label + ".colour");
      filter.colour = String(raw.colour).toUpperCase();
      filter.amount = bounded(raw.amount, 0, 1, label + ".amount");
    } else if (type === "blur")
      filter.radius = integer(raw.radius, 1, 12, label + ".radius");
    else if (type === "sharpen")
      filter.amount = bounded(raw.amount, 0, 3, label + ".amount");
    else if (type === "pixelate")
      filter.size = integer(raw.size, 2, 64, label + ".size");
    return filter;
  }
  function normalizeRecipe(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    if (raw.schema !== RECIPE_SCHEMA)
      throw new Error("raster composition recipe schema must be " + RECIPE_SCHEMA);
    var canvas = raw.canvas && typeof raw.canvas === "object" ? raw.canvas : {};
    var width = integer(canvas.width, 1, MAX_DIMENSION, "canvas.width");
    var height = integer(canvas.height, 1, MAX_DIMENSION, "canvas.height");
    if (width * height > MAX_PIXELS)
      throw new Error("raster composition exceeds " + MAX_PIXELS + " pixels");
    if (String(canvas.colour_space || "srgb").toLowerCase() !== "srgb")
      throw new Error("raster compositor v1 supports only sRGB RGBA8");
    if (!Array.isArray(raw.layers) || !raw.layers.length)
      throw new Error("raster composition requires at least one layer");
    if (raw.layers.length > MAX_LAYERS)
      throw new Error("raster composition exceeds " + MAX_LAYERS + " layers");
    var seen = {};
    var filterCount = 0;
    var layers = raw.layers.map(function (source, index) {
      source = source && typeof source === "object" ? source : {};
      var label = "layers[" + index + "]";
      var id = cleanText(source.id, 100);
      if (!id) throw new Error(label + ".id is required");
      if (seen[id]) throw new Error("duplicate raster layer id " + id);
      seen[id] = true;
      var hasSource = !!cleanText(source.source_artifact_id, 100);
      var hasFill = typeof source.fill === "string" && !!source.fill;
      if ((hasSource ? 1 : 0) + (hasFill ? 1 : 0) !== 1)
        throw new Error(label + " must declare exactly one source_artifact_id or fill");
      var filters = (Array.isArray(source.filters) ? source.filters : []).map(function (filter, filterIndex) {
        return normalizeFilter(filter, label + ".filters[" + filterIndex + "]");
      });
      filterCount += filters.length;
      var layer = {
        id: id,
        name: cleanText(source.name || id, 140),
        visible: source.visible !== false,
        opacity: source.opacity == null ? 1 : bounded(source.opacity, 0, 1, label + ".opacity"),
        blend_mode: cleanText(source.blend_mode || "normal", 40).toLowerCase(),
        offset: {
          x: source.offset && source.offset.x != null ? integer(source.offset.x, -MAX_DIMENSION, MAX_DIMENSION, label + ".offset.x") : 0,
          y: source.offset && source.offset.y != null ? integer(source.offset.y, -MAX_DIMENSION, MAX_DIMENSION, label + ".offset.y") : 0,
        },
        filters: filters,
      };
      if (BLEND_MODES.indexOf(layer.blend_mode) < 0)
        throw new Error(label + " uses unsupported blend mode " + layer.blend_mode);
      if (hasSource) layer.source_artifact_id = cleanText(source.source_artifact_id, 100);
      else {
        parseColour(source.fill, label + ".fill");
        layer.fill = String(source.fill).toUpperCase();
      }
      if (source.mask != null) {
        if (!source.mask || typeof source.mask !== "object") throw new Error(label + ".mask must be an object");
        var maskSource = cleanText(source.mask.source_artifact_id, 100);
        var channel = cleanText(source.mask.channel || "alpha", 20).toLowerCase();
        if (!maskSource) throw new Error(label + ".mask.source_artifact_id is required");
        if (["alpha", "luminance"].indexOf(channel) < 0)
          throw new Error(label + ".mask.channel must be alpha or luminance");
        layer.mask = { source_artifact_id: maskSource, channel: channel, invert: source.mask.invert === true };
      }
      return layer;
    });
    var globalFilters = (Array.isArray(raw.global_filters) ? raw.global_filters : []).map(function (filter, index) {
      return normalizeFilter(filter, "global_filters[" + index + "]");
    });
    filterCount += globalFilters.length;
    if (filterCount > MAX_FILTERS)
      throw new Error("raster composition exceeds " + MAX_FILTERS + " filters");
    return {
      schema: RECIPE_SCHEMA,
      version: "1.0.0",
      id: cleanText(raw.id || "raster-composition", 100),
      canvas: { width: width, height: height, colour_space: "srgb", alpha: canvas.alpha !== false },
      layers: layers,
      global_filters: globalFilters,
      notes: (Array.isArray(raw.notes) ? raw.notes : []).map(function (note) { return cleanText(note, 300); }).filter(Boolean).slice(0, 20),
    };
  }

  function asRgba(source, id) {
    if (!source || !(source.rgba instanceof Uint8Array))
      throw new Error("source " + id + " is missing Uint8Array RGBA pixels");
    var width = integer(source.width, 1, MAX_DIMENSION, "source " + id + " width");
    var height = integer(source.height, 1, MAX_DIMENSION, "source " + id + " height");
    if (source.rgba.length !== width * height * 4)
      throw new Error("source " + id + " RGBA length does not match dimensions");
    return { id: id, width: width, height: height, rgba: source.rgba, digest: cleanText(source.digest || digest(source.rgba.length + ":" + id), 160) };
  }
  function copyRgba(source) {
    return new Uint8Array(source);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hueChannel(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hslToRgb(h, s, l) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [hueChannel(p, q, h + 1 / 3) * 255, hueChannel(p, q, h) * 255, hueChannel(p, q, h - 1 / 3) * 255];
  }
  function pointFilter(rgba, filter) {
    var tint = filter.type === "tint" ? parseColour(filter.colour, "tint.colour") : null;
    for (var offset = 0; offset < rgba.length; offset += 4) {
      var r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2], value, hsl, converted;
      if (filter.type === "brightness") {
        value = filter.value * 255; r += value; g += value; b += value;
      } else if (filter.type === "contrast") {
        value = 1 + filter.value; r = (r - 127.5) * value + 127.5; g = (g - 127.5) * value + 127.5; b = (b - 127.5) * value + 127.5;
      } else if (filter.type === "saturation") {
        value = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = value + (r - value) * filter.value; g = value + (g - value) * filter.value; b = value + (b - value) * filter.value;
      } else if (filter.type === "hue") {
        hsl = rgbToHsl(r, g, b); hsl[0] = (hsl[0] + filter.value / 360 + 1) % 1; converted = hslToRgb(hsl[0], hsl[1], hsl[2]); r = converted[0]; g = converted[1]; b = converted[2];
      } else if (filter.type === "grayscale") {
        value = 0.2126 * r + 0.7152 * g + 0.0722 * b; r += (value - r) * filter.amount; g += (value - g) * filter.amount; b += (value - b) * filter.amount;
      } else if (filter.type === "invert") {
        r += (255 - 2 * r) * filter.amount; g += (255 - 2 * g) * filter.amount; b += (255 - 2 * b) * filter.amount;
      } else if (filter.type === "gamma") {
        r = 255 * Math.pow(r / 255, 1 / filter.value); g = 255 * Math.pow(g / 255, 1 / filter.value); b = 255 * Math.pow(b / 255, 1 / filter.value);
      } else if (filter.type === "threshold") {
        value = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 >= filter.value ? 255 : 0; r = g = b = value;
      } else if (filter.type === "posterize") {
        value = filter.levels - 1; r = Math.round((r / 255) * value) * 255 / value; g = Math.round((g / 255) * value) * 255 / value; b = Math.round((b / 255) * value) * 255 / value;
      } else if (filter.type === "tint") {
        r += (tint[0] - r) * filter.amount; g += (tint[1] - g) * filter.amount; b += (tint[2] - b) * filter.amount;
      }
      rgba[offset] = byte(r); rgba[offset + 1] = byte(g); rgba[offset + 2] = byte(b);
    }
    return rgba;
  }
  function boxBlur(rgba, width, height, radius) {
    var horizontal = new Uint8Array(rgba.length), output = new Uint8Array(rgba.length), x, y, c, sum, count, sample;
    for (y = 0; y < height; y += 1) for (x = 0; x < width; x += 1) for (c = 0; c < 4; c += 1) {
      sum = 0; count = 0;
      for (sample = Math.max(0, x - radius); sample <= Math.min(width - 1, x + radius); sample += 1) { sum += rgba[(y * width + sample) * 4 + c]; count += 1; }
      horizontal[(y * width + x) * 4 + c] = byte(sum / count);
    }
    for (y = 0; y < height; y += 1) for (x = 0; x < width; x += 1) for (c = 0; c < 4; c += 1) {
      sum = 0; count = 0;
      for (sample = Math.max(0, y - radius); sample <= Math.min(height - 1, y + radius); sample += 1) { sum += horizontal[(sample * width + x) * 4 + c]; count += 1; }
      output[(y * width + x) * 4 + c] = byte(sum / count);
    }
    return output;
  }
  function pixelate(rgba, width, height, size) {
    var output = copyRgba(rgba), x0, y0, x, y, c, sum, count, average;
    for (y0 = 0; y0 < height; y0 += size) for (x0 = 0; x0 < width; x0 += size) {
      average = [0, 0, 0, 0]; count = 0;
      for (y = y0; y < Math.min(height, y0 + size); y += 1) for (x = x0; x < Math.min(width, x0 + size); x += 1) { for (c = 0; c < 4; c += 1) average[c] += rgba[(y * width + x) * 4 + c]; count += 1; }
      for (c = 0; c < 4; c += 1) average[c] = byte(average[c] / count);
      for (y = y0; y < Math.min(height, y0 + size); y += 1) for (x = x0; x < Math.min(width, x0 + size); x += 1) for (c = 0; c < 4; c += 1) output[(y * width + x) * 4 + c] = average[c];
    }
    return output;
  }
  function applyFilters(source, width, height, filters) {
    var output = copyRgba(source);
    (filters || []).forEach(function (filter) {
      if (["blur", "sharpen", "pixelate"].indexOf(filter.type) < 0) output = pointFilter(output, filter);
      else if (filter.type === "blur") output = boxBlur(output, width, height, filter.radius);
      else if (filter.type === "pixelate") output = pixelate(output, width, height, filter.size);
      else {
        var blurred = boxBlur(output, width, height, 1), sharpened = new Uint8Array(output.length);
        for (var index = 0; index < output.length; index += 4) {
          sharpened[index] = byte(output[index] + filter.amount * (output[index] - blurred[index]));
          sharpened[index + 1] = byte(output[index + 1] + filter.amount * (output[index + 1] - blurred[index + 1]));
          sharpened[index + 2] = byte(output[index + 2] + filter.amount * (output[index + 2] - blurred[index + 2]));
          sharpened[index + 3] = output[index + 3];
        }
        output = sharpened;
      }
    });
    return output;
  }
  function blendChannel(mode, backdrop, source) {
    var b = backdrop / 255, s = source / 255, result;
    if (mode === "normal") result = s;
    else if (mode === "multiply") result = b * s;
    else if (mode === "screen") result = b + s - b * s;
    else if (mode === "overlay") result = b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    else if (mode === "darken") result = Math.min(b, s);
    else if (mode === "lighten") result = Math.max(b, s);
    else if (mode === "color-dodge") result = s >= 1 ? 1 : Math.min(1, b / (1 - s));
    else if (mode === "color-burn") result = s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
    else if (mode === "hard-light") result = s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    else if (mode === "soft-light") result = s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * ((b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b);
    else if (mode === "difference") result = Math.abs(b - s);
    else if (mode === "exclusion") result = b + s - 2 * b * s;
    else if (mode === "add") result = Math.min(1, b + s);
    else if (mode === "subtract") result = Math.max(0, b - s);
    else throw new Error("unsupported blend mode " + mode);
    return result * 255;
  }
  function compositeLayer(target, targetWidth, targetHeight, source, sourceWidth, sourceHeight, layer, mask) {
    for (var sy = 0; sy < sourceHeight; sy += 1) {
      var ty = sy + layer.offset.y;
      if (ty < 0 || ty >= targetHeight) continue;
      for (var sx = 0; sx < sourceWidth; sx += 1) {
        var tx = sx + layer.offset.x;
        if (tx < 0 || tx >= targetWidth) continue;
        var sourceOffset = (sy * sourceWidth + sx) * 4, targetOffset = (ty * targetWidth + tx) * 4;
        var maskAmount = 1;
        if (mask) {
          if (mask.width !== sourceWidth || mask.height !== sourceHeight)
            throw new Error("mask " + layer.mask.source_artifact_id + " dimensions must equal layer " + layer.id);
          var maskOffset = sourceOffset;
          maskAmount = layer.mask.channel === "alpha" ? mask.rgba[maskOffset + 3] / 255 : (0.2126 * mask.rgba[maskOffset] + 0.7152 * mask.rgba[maskOffset + 1] + 0.0722 * mask.rgba[maskOffset + 2]) / 255;
          if (layer.mask.invert) maskAmount = 1 - maskAmount;
        }
        var sourceAlpha = (source[sourceOffset + 3] / 255) * layer.opacity * maskAmount;
        if (sourceAlpha <= 0) continue;
        var backdropAlpha = target[targetOffset + 3] / 255;
        var outputAlpha = sourceAlpha + backdropAlpha * (1 - sourceAlpha);
        for (var channel = 0; channel < 3; channel += 1) {
          var sourceColour = source[sourceOffset + channel], backdropColour = target[targetOffset + channel];
          var blended = blendChannel(layer.blend_mode, backdropColour, sourceColour);
          var premultiplied = sourceAlpha * ((1 - backdropAlpha) * sourceColour + backdropAlpha * blended) + (1 - sourceAlpha) * backdropAlpha * backdropColour;
          target[targetOffset + channel] = outputAlpha > 0 ? byte(premultiplied / outputAlpha) : 0;
        }
        target[targetOffset + 3] = byte(outputAlpha * 255);
      }
    }
  }
  function fillPixels(width, height, colour) {
    var rgba = new Uint8Array(width * height * 4), parsed = parseColour(colour, "fill");
    for (var index = 0; index < rgba.length; index += 4) { rgba[index] = parsed[0]; rgba[index + 1] = parsed[1]; rgba[index + 2] = parsed[2]; rgba[index + 3] = parsed[3]; }
    return rgba;
  }
  function compose(rawRecipe, rawSources) {
    var recipe = normalizeRecipe(rawRecipe), sourceMap = {}, sourceBytes = 0, largestSourceBytes = 0;
    Object.keys(rawSources || {}).forEach(function (id) {
      sourceMap[id] = asRgba(rawSources[id], id);
      sourceBytes += sourceMap[id].rgba.length;
      largestSourceBytes = Math.max(largestSourceBytes, sourceMap[id].rgba.length);
    });
    var outputBytes = recipe.canvas.width * recipe.canvas.height * 4;
    var filterBufferBytes = Math.max(outputBytes, largestSourceBytes) * 3;
    var workingBytes = sourceBytes + outputBytes + filterBufferBytes;
    if (workingBytes > MAX_WORKING_BYTES)
      throw new Error("raster composition working set exceeds " + MAX_WORKING_BYTES + " bytes");
    var output = new Uint8Array(outputBytes), used = [], filtersApplied = 0;
    recipe.layers.forEach(function (layer) {
      if (!layer.visible) return;
      var source;
      if (layer.source_artifact_id) {
        source = sourceMap[layer.source_artifact_id];
        if (!source) throw new Error("layer " + layer.id + " source artifact is missing: " + layer.source_artifact_id);
      } else source = { id: "fill:" + layer.id, width: recipe.canvas.width, height: recipe.canvas.height, rgba: fillPixels(recipe.canvas.width, recipe.canvas.height, layer.fill), digest: digest(layer.fill) };
      var pixels = applyFilters(source.rgba, source.width, source.height, layer.filters), mask = null;
      filtersApplied += layer.filters.length;
      if (layer.mask) {
        mask = sourceMap[layer.mask.source_artifact_id];
        if (!mask) throw new Error("layer " + layer.id + " mask artifact is missing: " + layer.mask.source_artifact_id);
      }
      compositeLayer(output, recipe.canvas.width, recipe.canvas.height, pixels, source.width, source.height, layer, mask);
      used.push({ layer_id: layer.id, source_artifact_id: layer.source_artifact_id || null, source_digest: source.digest, mask_artifact_id: layer.mask ? layer.mask.source_artifact_id : null, blend_mode: layer.blend_mode, opacity: layer.opacity, filters: layer.filters.map(function (filter) { return filter.type; }) });
    });
    output = applyFilters(output, recipe.canvas.width, recipe.canvas.height, recipe.global_filters);
    filtersApplied += recipe.global_filters.length;
    return {
      width: recipe.canvas.width,
      height: recipe.canvas.height,
      rgba: output,
      recipe: recipe,
      receipt: {
        schema: RECEIPT_SCHEMA,
        version: "1.0.0",
        status: "PASS",
        engine: { id: "axm-raster-compositor", version: VERSION, profile: "bounded-srgb-rgba8" },
        recipe_digest: digest(recipe),
        layers: used,
        output: { width: recipe.canvas.width, height: recipe.canvas.height, colour_space: "srgb", pixel_format: "RGBA8", pixel_digest: digest(Array.prototype.join.call(output, ",")) },
        measures: { layers_total: recipe.layers.length, layers_composited: used.length, filters_applied: filtersApplied, source_bytes: sourceBytes, output_bytes: output.length, estimated_working_bytes: workingBytes },
        limits: { max_dimension: MAX_DIMENSION, max_pixels: MAX_PIXELS, max_layers: MAX_LAYERS, max_filters: MAX_FILTERS, max_working_bytes: MAX_WORKING_BYTES },
        unsupported: ["arbitrary rotation or resampling", "HDR, wide-gamut, CMYK or ICC transforms", "GPU or third-party plug-in shaders", "neural or generative effects", "3D, video or animation compositing"],
        authority: "candidate-only",
        visual_approval: false,
        canonical: false,
      },
    };
  }

  return {
    VERSION: VERSION,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    BLEND_MODES: BLEND_MODES.slice(),
    FILTER_TYPES: FILTER_TYPES.slice(),
    LIMITS: { maxDimension: MAX_DIMENSION, maxPixels: MAX_PIXELS, maxLayers: MAX_LAYERS, maxFilters: MAX_FILTERS, maxWorkingBytes: MAX_WORKING_BYTES },
    normalizeRecipe: normalizeRecipe,
    applyFilters: applyFilters,
    compose: compose,
    digest: digest,
  };
});
