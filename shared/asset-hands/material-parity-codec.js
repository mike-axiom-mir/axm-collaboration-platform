(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./raster-codec")
      : root.AXMRasterCodec,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMMaterialParityCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Raster) {
  "use strict";
  if (!Raster) throw new Error("AXM raster codec is required");

  var VERSION = "1.0.0";
  var GLTF_BACKEND = "gltf-metallic-roughness-cpu/v1";
  var MATERIALX_BACKEND = "materialx-standard-surface-cpu/v1";
  var PIXELS_PER_MILLISECOND = 4096;

  function finite(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }
  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  function round(value, places) {
    var power = Math.pow(10, places == null ? 8 : places);
    return Math.round(value * power) / power;
  }
  function normalize3(value) {
    var length = Math.hypot(value[0], value[1], value[2]) || 1;
    return [value[0] / length, value[1] / length, value[2] / length];
  }
  function dot(left, right) {
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
  }
  function mix(left, right, amount) {
    return left * (1 - amount) + right * amount;
  }
  function linearToSrgb(value) {
    value = clamp(value, 0, 1);
    return value <= 0.0031308
      ? value * 12.92
      : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  }
  function srgbToLinear(value) {
    value = clamp(value, 0, 1);
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  function graphCheck(graph) {
    var errors = [],
      parameters = graph && graph.parameters;
    if (!graph || typeof graph !== "object" || Array.isArray(graph))
      errors.push("material graph must be an object");
    if (graph && graph.schema !== "axm.material-graph/v1")
      errors.push("material graph schema must be axm.material-graph/v1");
    if (graph && graph.node !== "standard_surface")
      errors.push("only standard_surface is supported");
    if (!parameters || typeof parameters !== "object")
      errors.push("material parameters are missing");
    var colour = parameters && parameters.base_color;
    if (
      !Array.isArray(colour) ||
      colour.length !== 3 ||
      colour.some(function (item) {
        return (
          !Number.isFinite(Number(item)) || Number(item) < 0 || Number(item) > 1
        );
      })
    )
      errors.push(
        "base_color must contain three finite values in the 0..1 range",
      );
    ["metallic", "roughness", "opacity"].forEach(function (name) {
      var value = parameters && Number(parameters[name]);
      if (!Number.isFinite(value) || value < 0 || value > 1)
        errors.push(name + " must be finite and in the 0..1 range");
    });
    if (graph && graph.bindings != null && !Array.isArray(graph.bindings))
      errors.push("bindings must be an array");
    return { pass: !errors.length, errors: errors };
  }
  function bindingValue(graph, backend, parameter, original) {
    var value = original;
    (graph.bindings || []).forEach(function (binding) {
      if (!binding || typeof binding !== "object") return;
      if (String(binding.backend || "") !== backend) return;
      if (String(binding.parameter || "") !== parameter) return;
      value = value * finite(binding.scale, 1) + finite(binding.offset, 0);
    });
    return clamp(value, 0, 1);
  }
  function gltfParameters(graph) {
    var source = graph.parameters;
    return {
      base: source.base_color.map(function (item) {
        return clamp(Number(item), 0, 1);
      }),
      metallic: bindingValue(
        graph,
        GLTF_BACKEND,
        "metallicFactor",
        Number(source.metallic),
      ),
      roughness: bindingValue(
        graph,
        GLTF_BACKEND,
        "roughnessFactor",
        Number(source.roughness),
      ),
      opacity: bindingValue(
        graph,
        GLTF_BACKEND,
        "baseColorFactor.a",
        Number(source.opacity),
      ),
    };
  }
  function materialXParameters(graph) {
    var source = graph.parameters;
    return {
      base: source.base_color.map(function (item, index) {
        return bindingValue(
          graph,
          MATERIALX_BACKEND,
          "base_color." + index,
          Number(item),
        );
      }),
      metallic: bindingValue(
        graph,
        MATERIALX_BACKEND,
        "metalness",
        Number(source.metallic),
      ),
      roughness: bindingValue(
        graph,
        MATERIALX_BACKEND,
        "specular_roughness",
        Number(source.roughness),
      ),
      opacity: bindingValue(
        graph,
        MATERIALX_BACKEND,
        "opacity",
        Number(source.opacity),
      ),
    };
  }
  function geometryTerms(normal) {
    var light = normalize3([-0.42, 0.58, 0.7]),
      view = [0, 0, 1],
      halfVector = normalize3([
        light[0] + view[0],
        light[1] + view[1],
        light[2] + view[2],
      ]);
    return {
      nDotL: Math.max(0, dot(normal, light)),
      nDotV: Math.max(0, dot(normal, view)),
      nDotH: Math.max(0, dot(normal, halfVector)),
      vDotH: Math.max(0, dot(view, halfVector)),
    };
  }
  function gltfShade(parameters, normal) {
    var term = geometryTerms(normal),
      alpha = Math.max(0.001, parameters.roughness * parameters.roughness),
      alpha2 = alpha * alpha,
      denominator = term.nDotH * term.nDotH * (alpha2 - 1) + 1,
      distribution =
        alpha2 / Math.max(Math.PI * denominator * denominator, 0.000001),
      k = Math.pow(parameters.roughness + 1, 2) / 8,
      geometryL = term.nDotL / Math.max(term.nDotL * (1 - k) + k, 0.000001),
      geometryV = term.nDotV / Math.max(term.nDotV * (1 - k) + k, 0.000001),
      output = [];
    for (var channel = 0; channel < 3; channel += 1) {
      var f0 = mix(0.04, parameters.base[channel], parameters.metallic),
        fresnel = f0 + (1 - f0) * Math.pow(1 - term.vDotH, 5),
        specular =
          (distribution * geometryL * geometryV * fresnel) /
          Math.max(4 * term.nDotL * term.nDotV, 0.000001),
        diffuse =
          ((1 - fresnel) *
            (1 - parameters.metallic) *
            parameters.base[channel]) /
          Math.PI;
      output[channel] =
        0.025 * parameters.base[channel] +
        (diffuse + specular) * term.nDotL * 2.4;
    }
    return { rgb: output, alpha: parameters.opacity };
  }
  function materialXShade(parameters, normal) {
    var vectors = geometryTerms(normal),
      roughnessSquared = Math.max(0.001, Math.pow(parameters.roughness, 2)),
      roughnessFourth = roughnessSquared * roughnessSquared,
      nhDenominator = vectors.nDotH * vectors.nDotH * (roughnessFourth - 1) + 1,
      normalDistribution =
        roughnessFourth /
        Math.max(Math.PI * nhDenominator * nhDenominator, 0.000001),
      shadowingK = Math.pow(parameters.roughness + 1, 2) / 8,
      lightMask =
        vectors.nDotL /
        Math.max(vectors.nDotL * (1 - shadowingK) + shadowingK, 0.000001),
      viewMask =
        vectors.nDotV /
        Math.max(vectors.nDotV * (1 - shadowingK) + shadowingK, 0.000001),
      output = [];
    for (var channel = 0; channel < 3; channel += 1) {
      var dielectricOrMetal =
          0.04 * (1 - parameters.metallic) +
          parameters.base[channel] * parameters.metallic,
        edgeReflectance =
          dielectricOrMetal +
          (1 - dielectricOrMetal) * Math.pow(1 - vectors.vDotH, 5),
        glossy =
          (normalDistribution * lightMask * viewMask * edgeReflectance) /
          Math.max(4 * vectors.nDotL * vectors.nDotV, 0.000001),
        matte =
          ((1 - edgeReflectance) *
            (1 - parameters.metallic) *
            parameters.base[channel]) /
          Math.PI;
      output[channel] =
        parameters.base[channel] * 0.025 +
        (matte + glossy) * vectors.nDotL * 2.4;
    }
    return { rgb: output, alpha: parameters.opacity };
  }
  function render(graph, backend, width, height) {
    var checked = graphCheck(graph);
    if (!checked.pass) throw new Error(checked.errors.join("; "));
    if (backend !== GLTF_BACKEND && backend !== MATERIALX_BACKEND)
      throw new Error("unsupported reference backend: " + backend);
    width = Math.max(8, Math.min(256, Math.round(width)));
    height = Math.max(8, Math.min(256, Math.round(height)));
    var parameters =
        backend === GLTF_BACKEND
          ? gltfParameters(graph)
          : materialXParameters(graph),
      shade = backend === GLTF_BACKEND ? gltfShade : materialXShade,
      rgba = new Uint8Array(width * height * 4),
      offset = 0;
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var nx = ((x + 0.5) / width - 0.5) * 2.14,
          ny = (0.5 - (y + 0.5) / height) * 2.14,
          radiusSquared = nx * nx + ny * ny,
          checker = (Math.floor(x / 8) + Math.floor(y / 8)) & 1 ? 0.11 : 0.17;
        if (radiusSquared > 1) {
          var background = Math.round(linearToSrgb(checker) * 255);
          rgba[offset++] = background;
          rgba[offset++] = background;
          rgba[offset++] = background;
          rgba[offset++] = 255;
          continue;
        }
        var sample = shade(
          parameters,
          normalize3([nx, ny, Math.sqrt(Math.max(0, 1 - radiusSquared))]),
        );
        for (var channel = 0; channel < 3; channel += 1)
          rgba[offset++] = Math.round(linearToSrgb(sample.rgb[channel]) * 255);
        rgba[offset++] = Math.round(clamp(sample.alpha, 0, 1) * 255);
      }
    }
    var png = Raster.encodeRgba(width, height, rgba, { colourSpace: "srgb" });
    return {
      backend: backend,
      width: width,
      height: height,
      rgba: rgba,
      png: png,
      parameters: parameters,
    };
  }
  function compare(left, right, threshold) {
    if (left.width !== right.width || left.height !== right.height)
      throw new Error("reference images must have identical dimensions");
    threshold = Object.assign(
      {
        mean_absolute_linear: 0.002,
        rmse_linear: 0.004,
        max_absolute_linear: 0.03,
        mismatched_fraction: 0.01,
        per_channel_difference: 2,
      },
      threshold || {},
    );
    var rgba = new Uint8Array(left.rgba.length),
      absolute = 0,
      squared = 0,
      maximum = 0,
      mismatched = 0,
      samples = left.width * left.height * 3,
      pixels = left.width * left.height;
    for (var pixel = 0; pixel < pixels; pixel += 1) {
      var pixelMismatch = false;
      for (var channel = 0; channel < 3; channel += 1) {
        var index = pixel * 4 + channel,
          byteDifference = Math.abs(left.rgba[index] - right.rgba[index]),
          difference = Math.abs(
            srgbToLinear(left.rgba[index] / 255) -
              srgbToLinear(right.rgba[index] / 255),
          );
        absolute += difference;
        squared += difference * difference;
        maximum = Math.max(maximum, difference);
        pixelMismatch =
          pixelMismatch || byteDifference > threshold.per_channel_difference;
        rgba[index] = Math.min(255, byteDifference * 12);
      }
      if (pixelMismatch) mismatched += 1;
      rgba[pixel * 4 + 3] = 255;
    }
    var metrics = {
      mean_absolute_linear: round(absolute / samples),
      rmse_linear: round(Math.sqrt(squared / samples)),
      max_absolute_linear: round(maximum),
      mismatched_pixels: mismatched,
      mismatched_fraction: round(mismatched / pixels),
      compared_pixels: pixels,
    };
    var pass =
      metrics.mean_absolute_linear <= threshold.mean_absolute_linear &&
      metrics.rmse_linear <= threshold.rmse_linear &&
      metrics.max_absolute_linear <= threshold.max_absolute_linear &&
      metrics.mismatched_fraction <= threshold.mismatched_fraction;
    return {
      pass: pass,
      metrics: metrics,
      threshold: threshold,
      png: Raster.encodeRgba(left.width, left.height, rgba, {
        colourSpace: "srgb",
      }),
    };
  }
  function resolution(maxFrameMs) {
    var budget = maxFrameMs == null ? 12 : Math.max(0.01, Number(maxFrameMs)),
      side = Math.floor(Math.sqrt((budget * PIXELS_PER_MILLISECOND) / 3));
    side = Math.max(8, Math.min(128, side));
    return {
      width: side,
      height: side,
      estimated_frame_ms: round((side * side * 3) / PIXELS_PER_MILLISECOND, 6),
      model:
        "three pixel passes / 4096 pixels-per-ms conservative reference budget",
    };
  }
  function inspectPng(value) {
    var bytes =
      value instanceof Uint8Array ? value : Raster.bytesFromDataUrl(value);
    return Raster.inspectPng(bytes);
  }

  return {
    VERSION: VERSION,
    GLTF_BACKEND: GLTF_BACKEND,
    MATERIALX_BACKEND: MATERIALX_BACKEND,
    PIXELS_PER_MILLISECOND: PIXELS_PER_MILLISECOND,
    graphCheck: graphCheck,
    render: render,
    compare: compare,
    resolution: resolution,
    inspectPng: inspectPng,
    bytesFromDataUrl: Raster.bytesFromDataUrl,
  };
});
