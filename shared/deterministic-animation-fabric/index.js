(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMDeterministicAnimationFabric = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var RECIPE_SCHEMA = "axm.deterministic-animation-recipe/v1";
  var COMPOSITION_SCHEMA = "axm.deterministic-animation-composition/v1";
  var BAKE_SCHEMA = "axm.deterministic-animation-bake/v1";
  var RECEIPT_SCHEMA = "axm.deterministic-animation-verification/v1";
  var VERSION = "1.0.0";
  var ENGINE_VERSION = "1.1.0";
  var PRECISION = 1000000;
  var MAX_SAFE = Number.MAX_SAFE_INTEGER;
  var MAX_COMPOSITION_SOURCES = 32;
  var MAX_COMPOSITION_LAYERS = 128;
  var MAX_ATLAS_FRAMES = 256;
  var NODE_TYPES = [
    "constant",
    "keyframes",
    "wave",
    "noise",
    "add",
    "multiply",
    "clamp",
    "remap",
    "abs",
  ];
  var UNITS = [
    "unitless",
    "px",
    "normalized",
    "ratio",
    "deg",
    "rad",
    "game-world-unit",
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      var out = {};
      Object.keys(value)
        .sort()
        .forEach(function (key) {
          out[key] = stable(value[key]);
        });
      return out;
    }
    return value;
  }

  function canonicalStringify(value) {
    return JSON.stringify(stable(value));
  }

  function fnv1a32(source) {
    var text = String(source == null ? "" : source);
    var state = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      state ^= text.charCodeAt(index);
      state = Math.imul(state, 16777619);
    }
    return state >>> 0;
  }

  function digest(value) {
    return "fnv1a32:" + fnv1a32(typeof value === "string" ? value : canonicalStringify(value))
      .toString(16)
      .padStart(8, "0");
  }

  function text(value, label, max) {
    var result = String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim();
    if (!result) throw new TypeError(label + " is required");
    if (max && result.length > max)
      throw new RangeError(label + " exceeds " + max + " characters");
    return result;
  }

  function identifier(value, label) {
    var result = text(value, label, 120);
    if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(result))
      throw new TypeError(label + " must be a portable identifier");
    return result;
  }

  function integer(value, label, min, max) {
    var result = Number(value);
    if (!Number.isSafeInteger(result))
      throw new TypeError(label + " must be a safe integer");
    if (result < min || result > max)
      throw new RangeError(label + " must stay between " + min + " and " + max);
    return result;
  }

  function finite(value, label, min, max) {
    var result = Number(value);
    if (!Number.isFinite(result)) throw new TypeError(label + " must be finite");
    if (result < min || result > max)
      throw new RangeError(label + " must stay between " + min + " and " + max);
    return result;
  }

  function fixed(value, label) {
    var result = Math.round(finite(value, label, -1000000, 1000000) * PRECISION);
    if (!Number.isSafeInteger(result)) throw new RangeError(label + " exceeds fixed-point range");
    return result;
  }

  function safeBigIntNumber(value, label) {
    var result = Number(value);
    if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_SAFE)
      throw new RangeError(label + " exceeds the deterministic integer range");
    return result;
  }

  function mulDiv(value, numerator, denominator, label) {
    if (!denominator) throw new RangeError(label + " divides by zero");
    return safeBigIntNumber(
      (BigInt(value) * BigInt(numerator)) / BigInt(denominator),
      label,
    );
  }

  function mulFixed(left, right, label) {
    return mulDiv(left, right, PRECISION, label || "fixed multiplication");
  }

  function mod(value, divisor) {
    var result = value % divisor;
    return result < 0 ? result + divisor : result;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(function (key) {
      deepFreeze(value[key]);
    });
    return value;
  }

  var BUILTIN_BLOCKS = deepFreeze({
    "axm.motion.oscillator/v1": {
      id: "axm.motion.oscillator/v1",
      parameters: {
        waveform: { type: "string", default: "triangle" },
        period_ticks: { type: "integer", default: 1000 },
        phase_ticks: { type: "integer", default: 0 },
        amplitude: { type: "number", default: 1 },
        offset: { type: "number", default: 0 },
      },
      nodes: [
        {
          id: "value",
          type: "wave",
          waveform: "$waveform",
          period_ticks: "$period_ticks",
          phase_ticks: "$phase_ticks",
          amplitude: "$amplitude",
          offset: "$offset",
        },
      ],
      outputs: { value: "value" },
    },
    "axm.motion.seeded-noise/v1": {
      id: "axm.motion.seeded-noise/v1",
      parameters: {
        hold_ticks: { type: "integer", default: 100 },
        amplitude: { type: "number", default: 1 },
        offset: { type: "number", default: 0 },
        seed: { type: "string", default: "default" },
      },
      nodes: [
        {
          id: "value",
          type: "noise",
          hold_ticks: "$hold_ticks",
          amplitude: "$amplitude",
          offset: "$offset",
          seed: "$seed",
        },
      ],
      outputs: { value: "value" },
    },
    "axm.motion.envelope/v1": {
      id: "axm.motion.envelope/v1",
      parameters: {
        points: { type: "array", default: [{ tick: 0, value: 0 }] },
        interpolation: { type: "string", default: "linear" },
      },
      nodes: [
        {
          id: "value",
          type: "keyframes",
          points: "$points",
          interpolation: "$interpolation",
        },
      ],
      outputs: { value: "value" },
    },
  });

  function parameterValue(definition, supplied, label) {
    var value = supplied === undefined ? clone(definition.default) : supplied;
    if (definition.type === "number") return finite(value, label, -1000000, 1000000);
    if (definition.type === "integer") return integer(value, label, -1000000000, 1000000000);
    if (definition.type === "string") return text(value, label, 200);
    if (definition.type === "array") {
      if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
      return clone(value);
    }
    throw new TypeError(label + " has unsupported parameter type " + definition.type);
  }

  function substitute(value, parameters) {
    if (typeof value === "string" && /^\$[a-z0-9_.-]+$/i.test(value)) {
      var key = value.slice(1);
      if (!Object.prototype.hasOwnProperty.call(parameters, key))
        throw new Error("missing block parameter " + key);
      return clone(parameters[key]);
    }
    if (Array.isArray(value))
      return value.map(function (item) {
        return substitute(item, parameters);
      });
    if (value && typeof value === "object") {
      var out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = substitute(value[key], parameters);
      });
      return out;
    }
    return value;
  }

  function validateBlock(raw, label) {
    var block = clone(raw || {});
    block.id = identifier(block.id, label + " id");
    block.parameters = block.parameters && typeof block.parameters === "object" ? block.parameters : {};
    block.nodes = Array.isArray(block.nodes) ? block.nodes : [];
    block.outputs = block.outputs && typeof block.outputs === "object" ? block.outputs : {};
    if (!block.nodes.length) throw new Error(label + " needs nodes");
    var nodeIds = new Set();
    block.nodes.forEach(function (node) {
      var id = identifier(node && node.id, label + " node id");
      if (nodeIds.has(id)) throw new Error(label + " has duplicate node " + id);
      nodeIds.add(id);
    });
    Object.keys(block.parameters).forEach(function (name) {
      identifier(name, label + " parameter");
      var definition = block.parameters[name] || {};
      if (["number", "integer", "string", "array"].indexOf(definition.type) < 0)
        throw new TypeError(label + " parameter " + name + " has unsupported type");
      parameterValue(definition, undefined, label + " parameter " + name);
    });
    Object.keys(block.outputs).forEach(function (name) {
      identifier(name, label + " output");
      if (!nodeIds.has(block.outputs[name]))
        throw new Error(label + " output " + name + " references a missing node");
    });
    return block;
  }

  function expandRecipe(raw) {
    var blocks = {};
    Object.keys(BUILTIN_BLOCKS).forEach(function (id) {
      blocks[id] = validateBlock(BUILTIN_BLOCKS[id], "built-in block " + id);
    });
    (raw.blocks || []).forEach(function (candidate) {
      var block = validateBlock(candidate, "custom block");
      if (blocks[block.id]) throw new Error("block id collides with existing block " + block.id);
      blocks[block.id] = block;
    });

    var nodes = clone(raw.nodes || []);
    var aliases = {};
    var instances = (raw.instances || []).map(function (candidate) {
      var instance = clone(candidate || {});
      instance.id = identifier(instance.id, "block instance id");
      instance.block = identifier(instance.block, "block instance type");
      var block = blocks[instance.block];
      if (!block) throw new Error("unknown animation block " + instance.block);
      var supplied = instance.parameters && typeof instance.parameters === "object" ? instance.parameters : {};
      Object.keys(supplied).forEach(function (name) {
        if (!block.parameters[name])
          throw new Error("unknown parameter " + name + " for block " + block.id);
      });
      var parameters = {};
      Object.keys(block.parameters).forEach(function (name) {
        parameters[name] = parameterValue(
          block.parameters[name],
          supplied[name],
          "instance " + instance.id + " parameter " + name,
        );
      });
      var localIds = new Set(block.nodes.map(function (node) { return node.id; }));
      block.nodes.forEach(function (template) {
        var node = substitute(template, parameters);
        node.id = instance.id + "/" + node.id;
        if (node.input && localIds.has(node.input)) node.input = instance.id + "/" + node.input;
        if (Array.isArray(node.inputs))
          node.inputs = node.inputs.map(function (input) {
            return localIds.has(input) ? instance.id + "/" + input : input;
          });
        nodes.push(node);
      });
      Object.keys(block.outputs).forEach(function (name) {
        aliases[instance.id + "." + name] = instance.id + "/" + block.outputs[name];
      });
      return { id: instance.id, block: instance.block, parameters: parameters };
    });

    nodes.forEach(function (node) {
      if (node.input && aliases[node.input]) node.input = aliases[node.input];
      if (Array.isArray(node.inputs))
        node.inputs = node.inputs.map(function (input) { return aliases[input] || input; });
    });
    var tracks = clone(raw.tracks || []).map(function (track) {
      track.node = aliases[track.node] || track.node;
      return track;
    });
    return { blocks: blocks, nodes: nodes, tracks: tracks, instances: instances };
  }

  function normalizeNode(raw, timebase) {
    var node = clone(raw || {});
    node.id = identifier(node.id, "node id");
    node.type = text(node.type, "node " + node.id + " type", 40).toLowerCase();
    if (NODE_TYPES.indexOf(node.type) < 0)
      throw new Error("node " + node.id + " has unsupported type " + node.type);
    var out = { id: node.id, type: node.type };
    if (node.type === "constant") out.value_i = fixed(node.value, "node " + node.id + " value");
    if (node.type === "keyframes") {
      if (!Array.isArray(node.points) || !node.points.length)
        throw new Error("keyframe node " + node.id + " needs points");
      out.interpolation = String(node.interpolation || "linear").toLowerCase();
      if (["step", "linear", "smoothstep"].indexOf(out.interpolation) < 0)
        throw new Error("keyframe node " + node.id + " has unsupported interpolation");
      out.points = node.points
        .map(function (point, index) {
          return {
            tick: integer(point.tick, "node " + node.id + " point " + index + " tick", 0, timebase.duration_ticks),
            value_i: fixed(point.value, "node " + node.id + " point " + index + " value"),
          };
        })
        .sort(function (a, b) { return a.tick - b.tick; });
      for (var pointIndex = 1; pointIndex < out.points.length; pointIndex += 1)
        if (out.points[pointIndex].tick === out.points[pointIndex - 1].tick)
          throw new Error("keyframe node " + node.id + " has duplicate ticks");
    }
    if (node.type === "wave") {
      out.waveform = String(node.waveform || "triangle").toLowerCase();
      if (["triangle", "saw", "square"].indexOf(out.waveform) < 0)
        throw new Error("wave node " + node.id + " has unsupported waveform");
      out.period_ticks = integer(node.period_ticks, "node " + node.id + " period", 1, 1000000000);
      out.phase_ticks = integer(node.phase_ticks || 0, "node " + node.id + " phase", -1000000000, 1000000000);
      out.amplitude_i = fixed(node.amplitude == null ? 1 : node.amplitude, "node " + node.id + " amplitude");
      out.offset_i = fixed(node.offset || 0, "node " + node.id + " offset");
    }
    if (node.type === "noise") {
      out.hold_ticks = integer(node.hold_ticks, "node " + node.id + " hold", 1, 1000000000);
      out.amplitude_i = fixed(node.amplitude == null ? 1 : node.amplitude, "node " + node.id + " amplitude");
      out.offset_i = fixed(node.offset || 0, "node " + node.id + " offset");
      out.seed = text(node.seed || "default", "node " + node.id + " seed", 200);
    }
    if (node.type === "add" || node.type === "multiply") {
      if (!Array.isArray(node.inputs) || !node.inputs.length)
        throw new Error(node.type + " node " + node.id + " needs inputs");
      out.inputs = node.inputs.map(function (input) { return identifier(input, "node " + node.id + " input"); });
    }
    if (["clamp", "remap", "abs"].indexOf(node.type) >= 0)
      out.input = identifier(node.input, "node " + node.id + " input");
    if (node.type === "clamp") {
      out.min_i = fixed(node.min, "node " + node.id + " minimum");
      out.max_i = fixed(node.max, "node " + node.id + " maximum");
      if (out.max_i < out.min_i) throw new Error("clamp node " + node.id + " maximum is below minimum");
    }
    if (node.type === "remap") {
      out.input_min_i = fixed(node.input_min, "node " + node.id + " input minimum");
      out.input_max_i = fixed(node.input_max, "node " + node.id + " input maximum");
      out.output_min_i = fixed(node.output_min, "node " + node.id + " output minimum");
      out.output_max_i = fixed(node.output_max, "node " + node.id + " output maximum");
      if (out.input_max_i === out.input_min_i) throw new Error("remap node " + node.id + " input range is zero");
    }
    return out;
  }

  function dependencies(node) {
    if (node.inputs) return node.inputs.slice();
    if (node.input) return [node.input];
    return [];
  }

  function topologicalOrder(nodes) {
    var byId = new Map(nodes.map(function (node) { return [node.id, node]; }));
    var temporary = new Set();
    var permanent = new Set();
    var order = [];
    function visit(id, trail) {
      if (permanent.has(id)) return;
      if (temporary.has(id)) throw new Error("animation node cycle: " + trail.concat(id).join(" -> "));
      var node = byId.get(id);
      if (!node) throw new Error("missing animation node " + id);
      temporary.add(id);
      dependencies(node).forEach(function (dependency) { visit(dependency, trail.concat(id)); });
      temporary.delete(id);
      permanent.add(id);
      order.push(id);
    }
    Array.from(byId.keys()).sort().forEach(function (id) { visit(id, []); });
    return order;
  }

  function compileRecipe(input) {
    if (!input || typeof input !== "object") throw new TypeError("animation recipe must be an object");
    if (input.schema !== RECIPE_SCHEMA) throw new Error("animation recipe schema must be " + RECIPE_SCHEMA);
    if (input.version !== VERSION) throw new Error("animation recipe version must be " + VERSION);
    var id = identifier(input.id, "recipe id");
    var fps = integer(input.timebase && input.timebase.frames_per_second, "frames per second", 1, 240);
    var ticksPerSecond = integer(input.timebase && input.timebase.ticks_per_second, "ticks per second", fps, 1000000);
    if (ticksPerSecond % fps !== 0)
      throw new Error("ticks per second must be exactly divisible by frames per second");
    var ticksPerFrame = ticksPerSecond / fps;
    var durationTicks = integer(input.timebase && input.timebase.duration_ticks, "duration ticks", ticksPerFrame, 600000000);
    if (durationTicks % ticksPerFrame !== 0)
      throw new Error("duration ticks must contain an exact whole number of frames");
    var baseFrameCount = durationTicks / ticksPerFrame;
    var loop = input.loop === true;
    var frameCount = baseFrameCount + (loop ? 0 : 1);
    if (frameCount > 20000) throw new RangeError("animation recipe exceeds the 20000-frame bake limit");
    var timebase = {
      ticks_per_second: ticksPerSecond,
      frames_per_second: fps,
      ticks_per_frame: ticksPerFrame,
      duration_ticks: durationTicks,
      duration_seconds: durationTicks / ticksPerSecond,
      frame_count: frameCount,
    };
    var expanded = expandRecipe(input);
    if (!expanded.nodes.length) throw new Error("animation recipe needs nodes or block instances");
    var nodes = expanded.nodes.map(function (node) { return normalizeNode(node, timebase); });
    var nodeIds = new Set();
    nodes.forEach(function (node) {
      if (nodeIds.has(node.id)) throw new Error("duplicate animation node " + node.id);
      nodeIds.add(node.id);
    });
    var order = topologicalOrder(nodes);
    var tracks = expanded.tracks.map(function (candidate, index) {
      var raw = candidate || {};
      var track = {
        id: identifier(raw.id || "track-" + index, "track id"),
        target: identifier(raw.target, "track target"),
        property: text(raw.property, "track property", 160),
        node: identifier(raw.node, "track node"),
        unit: String(raw.unit || "unitless").toLowerCase(),
      };
      if (!nodeIds.has(track.node)) throw new Error("track " + track.id + " references missing node " + track.node);
      if (UNITS.indexOf(track.unit) < 0) throw new Error("track " + track.id + " has unsupported unit " + track.unit);
      return track;
    }).sort(function (a, b) { return a.id.localeCompare(b.id); });
    if (!tracks.length) throw new Error("animation recipe needs tracks");
    if (new Set(tracks.map(function (track) { return track.id; })).size !== tracks.length)
      throw new Error("animation track ids must be unique");
    var bindings = tracks.map(function (track) { return track.target + "|" + track.property; });
    if (new Set(bindings).size !== bindings.length)
      throw new Error("each target property must have exactly one deterministic track");
    var events = (input.events || []).map(function (candidate) {
      return {
        id: identifier(candidate.id, "event id"),
        tick: integer(candidate.tick, "event tick", 0, durationTicks),
        kind: text(candidate.kind || "marker", "event kind", 80),
        payload: clone(candidate.payload || {}),
      };
    }).sort(function (a, b) { return a.tick - b.tick || a.id.localeCompare(b.id); });
    if (new Set(events.map(function (event) { return event.id; })).size !== events.length)
      throw new Error("animation event ids must be unique");
    var presentation = clone(input.presentation || {});
    var canonicalRecipe = {
      schema: RECIPE_SCHEMA,
      version: VERSION,
      id: id,
      seed: text(input.seed || id, "recipe seed", 200),
      loop: loop,
      timebase: {
        ticks_per_second: ticksPerSecond,
        frames_per_second: fps,
        duration_ticks: durationTicks,
      },
      blocks: clone(input.blocks || []),
      instances: expanded.instances,
      nodes: clone(input.nodes || []),
      tracks: clone(input.tracks || []),
      events: events,
      presentation: presentation,
      adapter: input.adapter ? clone(input.adapter) : null,
      authority: {
        installed: false,
        promoted: false,
        canonical: false,
        human_visual_review_required: true,
      },
    };
    return deepFreeze({
      schema: "axm.deterministic-animation-compiled/v1",
      version: VERSION,
      id: id,
      seed: canonicalRecipe.seed,
      loop: loop,
      timebase: timebase,
      nodes: nodes.sort(function (a, b) { return a.id.localeCompare(b.id); }),
      order: order,
      tracks: tracks,
      events: events,
      presentation: presentation,
      canonical_recipe: canonicalRecipe,
      recipe_digest: digest(canonicalRecipe),
      determinism: {
        fixed_point_precision: PRECISION,
        integer_time: true,
        dependency_order_explicit: true,
        seeded_noise: true,
        call_time_randomness: false,
      },
    });
  }

  function waveValue(node, tick) {
    var phase = mod(tick + node.phase_ticks, node.period_ticks);
    var unit;
    if (node.waveform === "saw")
      unit = -PRECISION + mulDiv(phase, 2 * PRECISION, node.period_ticks, "saw wave");
    else if (node.waveform === "square")
      unit = phase * 2 < node.period_ticks ? -PRECISION : PRECISION;
    else {
      var centered = Math.abs(mulDiv(phase, PRECISION, node.period_ticks, "triangle phase") - Math.floor(PRECISION / 2));
      unit = PRECISION - 4 * centered;
    }
    return safeBigIntNumber(node.offset_i + mulFixed(node.amplitude_i, unit, "wave amplitude"), "wave result");
  }

  function keyframeValue(node, tick) {
    if (tick <= node.points[0].tick) return node.points[0].value_i;
    var last = node.points[node.points.length - 1];
    if (tick >= last.tick) return last.value_i;
    for (var index = 1; index < node.points.length; index += 1) {
      var right = node.points[index];
      if (tick > right.tick) continue;
      var left = node.points[index - 1];
      if (node.interpolation === "step") return left.value_i;
      var span = right.tick - left.tick;
      var offset = tick - left.tick;
      var ratio = mulDiv(offset, PRECISION, span, "keyframe ratio");
      if (node.interpolation === "smoothstep") {
        var squared = mulFixed(ratio, ratio, "smoothstep square");
        ratio = mulFixed(squared, 3 * PRECISION - 2 * ratio, "smoothstep curve");
      }
      return safeBigIntNumber(
        left.value_i + mulDiv(right.value_i - left.value_i, ratio, PRECISION, "keyframe interpolation"),
        "keyframe result",
      );
    }
    return last.value_i;
  }

  function evaluateNode(node, tick, values, seed) {
    var result;
    if (node.type === "constant") result = node.value_i;
    if (node.type === "keyframes") result = keyframeValue(node, tick);
    if (node.type === "wave") result = waveValue(node, tick);
    if (node.type === "noise") {
      var cell = Math.floor(tick / node.hold_ticks);
      var raw = fnv1a32(seed + "|" + node.seed + "|" + cell);
      var signed = raw % (2 * PRECISION + 1) - PRECISION;
      result = node.offset_i + mulFixed(node.amplitude_i, signed, "noise amplitude");
    }
    if (node.type === "add")
      result = node.inputs.reduce(function (sum, input) {
        return safeBigIntNumber(sum + values.get(input), "add result");
      }, 0);
    if (node.type === "multiply")
      result = node.inputs.reduce(function (product, input) {
        return mulFixed(product, values.get(input), "multiply result");
      }, PRECISION);
    if (node.type === "clamp") result = Math.max(node.min_i, Math.min(node.max_i, values.get(node.input)));
    if (node.type === "remap") {
      var value = values.get(node.input);
      result = node.output_min_i + mulDiv(
        value - node.input_min_i,
        node.output_max_i - node.output_min_i,
        node.input_max_i - node.input_min_i,
        "remap result",
      );
    }
    if (node.type === "abs") result = Math.abs(values.get(node.input));
    return safeBigIntNumber(result, "node " + node.id + " result");
  }

  function sampleCompiled(compiled, requestedTick) {
    if (!compiled || compiled.schema !== "axm.deterministic-animation-compiled/v1")
      throw new TypeError("compiled deterministic animation is required");
    var tick = integer(requestedTick, "sample tick", 0, compiled.timebase.duration_ticks);
    var localTick = compiled.loop && tick === compiled.timebase.duration_ticks ? 0 : tick;
    var byId = new Map(compiled.nodes.map(function (node) { return [node.id, node]; }));
    var values = new Map();
    compiled.order.forEach(function (id) {
      values.set(id, evaluateNode(byId.get(id), localTick, values, compiled.seed));
    });
    return {
      schema: "axm.deterministic-animation-sample/v1",
      recipe_id: compiled.id,
      tick: tick,
      local_tick: localTick,
      values: compiled.tracks.map(function (track) {
        var value = values.get(track.node);
        return {
          id: track.id,
          target: track.target,
          property: track.property,
          unit: track.unit,
          value_i: value,
          value: value / PRECISION,
        };
      }),
    };
  }

  function bake(input) {
    if (input && (input.schema === COMPOSITION_SCHEMA || input.schema === "axm.deterministic-animation-composition-compiled/v1"))
      return bakeComposition(input);
    var compiled = input && input.schema === "axm.deterministic-animation-compiled/v1" ? input : compileRecipe(input);
    var frames = [];
    for (var index = 0; index < compiled.timebase.frame_count; index += 1) {
      var tick = Math.min(index * compiled.timebase.ticks_per_frame, compiled.timebase.duration_ticks);
      var sample = sampleCompiled(compiled, tick);
      frames.push({
        index: index,
        tick: tick,
        values_i: Object.fromEntries(sample.values.map(function (value) { return [value.id, value.value_i]; })),
      });
    }
    var tracks = compiled.tracks.map(function (track) {
      return {
        id: track.id,
        target: track.target,
        property: track.property,
        unit: track.unit,
        precision: PRECISION,
        samples_i: frames.map(function (frame) { return frame.values_i[track.id]; }),
      };
    });
    var result = {
      schema: BAKE_SCHEMA,
      version: VERSION,
      recipe_id: compiled.id,
      recipe_digest: compiled.recipe_digest,
      timebase: clone(compiled.timebase),
      loop: compiled.loop,
      tracks: tracks,
      frames: frames,
      events: compiled.events.map(function (event) {
        return {
          id: event.id,
          tick: event.tick,
          frame_index: Math.min(Math.floor(event.tick / compiled.timebase.ticks_per_frame), frames.length - 1),
          kind: event.kind,
          payload: clone(event.payload),
        };
      }),
      determinism: clone(compiled.determinism),
      authority: {
        installed: false,
        promoted: false,
        canonical: false,
        human_visual_review_required: true,
      },
    };
    result.digest = digest(result);
    return deepFreeze(result);
  }

  function compositionTrackId(target, property) {
    var readable = (target + "-" + property)
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, "-")
      .replace(/[./]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return "track-" + (readable || "value") + "-" + digest(target + "|" + property).slice(-8);
  }

  function defaultBindingValue(property) {
    return property === "transform.scale" || property === "opacity" ? PRECISION : 0;
  }

  function normalizeCompositionEvent(candidate, durationTicks) {
    return {
      id: identifier(candidate.id, "composition event id"),
      tick: integer(candidate.tick, "composition event tick", 0, durationTicks),
      kind: text(candidate.kind || "marker", "composition event kind", 80),
      payload: clone(candidate.payload || {}),
    };
  }

  function compileComposition(input) {
    if (!input || typeof input !== "object")
      throw new TypeError("deterministic animation composition must be an object");
    if (input.schema !== COMPOSITION_SCHEMA)
      throw new Error("animation composition schema must be " + COMPOSITION_SCHEMA);
    if (input.version !== VERSION)
      throw new Error("animation composition version must be " + VERSION);
    var id = identifier(input.id, "composition id");
    var fps = integer(input.timebase && input.timebase.frames_per_second, "composition frames per second", 1, 240);
    var ticksPerSecond = integer(input.timebase && input.timebase.ticks_per_second, "composition ticks per second", fps, 1000000);
    if (ticksPerSecond % fps !== 0)
      throw new Error("composition ticks per second must be exactly divisible by frames per second");
    var ticksPerFrame = ticksPerSecond / fps;
    var durationTicks = integer(input.timebase && input.timebase.duration_ticks, "composition duration ticks", ticksPerFrame, 600000000);
    if (durationTicks % ticksPerFrame !== 0)
      throw new Error("composition duration ticks must contain an exact whole number of frames");
    var loop = input.loop === true;
    var frameCount = durationTicks / ticksPerFrame + (loop ? 0 : 1);
    if (frameCount > 20000)
      throw new RangeError("animation composition exceeds the 20000-frame bake limit");
    var timebase = {
      ticks_per_second: ticksPerSecond,
      frames_per_second: fps,
      ticks_per_frame: ticksPerFrame,
      duration_ticks: durationTicks,
      duration_seconds: durationTicks / ticksPerSecond,
      frame_count: frameCount,
    };

    if (!Array.isArray(input.sources) || !input.sources.length)
      throw new Error("animation composition needs embedded recipe sources");
    if (input.sources.length > MAX_COMPOSITION_SOURCES)
      throw new RangeError("animation composition exceeds the source boundary");
    var sourceIds = new Set();
    var sources = input.sources.map(function (candidate) {
      var source = candidate || {};
      var sourceId = identifier(source.id, "composition source id");
      if (sourceIds.has(sourceId)) throw new Error("duplicate composition source " + sourceId);
      sourceIds.add(sourceId);
      return { id: sourceId, compiled: compileRecipe(source.recipe) };
    }).sort(function (left, right) { return left.id.localeCompare(right.id); });
    var sourceById = new Map(sources.map(function (source) { return [source.id, source]; }));

    if (!Array.isArray(input.layers) || !input.layers.length)
      throw new Error("animation composition needs layers");
    if (input.layers.length > MAX_COMPOSITION_LAYERS)
      throw new RangeError("animation composition exceeds the layer boundary");
    var layerIds = new Set();
    var outputBindings = new Map();
    var layers = input.layers.map(function (candidate, index) {
      var raw = candidate || {};
      var layerId = identifier(raw.id, "composition layer id");
      if (layerIds.has(layerId)) throw new Error("duplicate composition layer " + layerId);
      layerIds.add(layerId);
      var sourceId = identifier(raw.source, "layer " + layerId + " source");
      var source = sourceById.get(sourceId);
      if (!source) throw new Error("layer " + layerId + " references missing source " + sourceId);
      var startTick = integer(raw.start_tick == null ? 0 : raw.start_tick, "layer " + layerId + " start tick", 0, durationTicks);
      var endTick = integer(raw.end_tick == null ? durationTicks : raw.end_tick, "layer " + layerId + " end tick", 0, durationTicks);
      if (endTick <= startTick) throw new Error("layer " + layerId + " end tick must follow its start tick");
      var sourceInTick = integer(raw.source_in_tick == null ? 0 : raw.source_in_tick, "layer " + layerId + " source-in tick", 0, source.compiled.timebase.duration_ticks);
      var rate = raw.rate || {};
      var numerator = integer(rate.numerator == null ? 1 : rate.numerator, "layer " + layerId + " rate numerator", 1, 1000);
      var denominator = integer(rate.denominator == null ? 1 : rate.denominator, "layer " + layerId + " rate denominator", 1, 1000);
      var playback = String(raw.playback || (source.compiled.loop ? "loop" : "clamp")).toLowerCase();
      if (["clamp", "loop", "ping-pong"].indexOf(playback) < 0)
        throw new Error("layer " + layerId + " has unsupported playback " + playback);
      var blend = String(raw.blend || "replace").toLowerCase();
      if (["replace", "add", "multiply"].indexOf(blend) < 0)
        throw new Error("layer " + layerId + " has unsupported blend " + blend);
      var weightI = fixed(raw.weight == null ? 1 : raw.weight, "layer " + layerId + " weight");
      if (weightI < 0 || weightI > PRECISION)
        throw new RangeError("layer " + layerId + " weight must stay between zero and one");
      var prefix = raw.target_prefix == null ? "" : String(raw.target_prefix).trim();
      if (prefix) prefix = identifier(prefix, "layer " + layerId + " target prefix");
      var properties = (Array.isArray(raw.properties) ? raw.properties : []).map(function (property) {
        return text(property, "layer " + layerId + " property", 160);
      }).sort();
      if (new Set(properties).size !== properties.length)
        throw new Error("layer " + layerId + " property filters must be unique");
      var allowed = new Set(properties);
      var trackMap = source.compiled.tracks.filter(function (track) {
        return !allowed.size || allowed.has(track.property);
      }).map(function (track) {
        var target = prefix ? identifier(prefix + "/" + track.target, "layer " + layerId + " mapped target") : track.target;
        var binding = target + "|" + track.property;
        var known = outputBindings.get(binding);
        if (known && known.unit !== track.unit)
          throw new Error("composition binding " + binding + " mixes incompatible units");
        if (!known) {
          known = {
            id: compositionTrackId(target, track.property),
            target: target,
            property: track.property,
            unit: track.unit,
          };
          outputBindings.set(binding, known);
        }
        return {
          source_track_id: track.id,
          output_track_id: known.id,
          binding: binding,
        };
      });
      if (!trackMap.length) throw new Error("layer " + layerId + " property filter selects no tracks");
      return {
        id: layerId,
        source: sourceId,
        order: integer(raw.order == null ? index : raw.order, "layer " + layerId + " order", -1000000, 1000000),
        start_tick: startTick,
        end_tick: endTick,
        source_in_tick: sourceInTick,
        rate: { numerator: numerator, denominator: denominator },
        playback: playback,
        blend: blend,
        weight_i: weightI,
        weight: weightI / PRECISION,
        target_prefix: prefix,
        properties: properties,
        track_map: trackMap,
      };
    }).sort(function (left, right) { return left.order - right.order || left.id.localeCompare(right.id); });
    var tracks = Array.from(outputBindings.values()).sort(function (left, right) {
      return left.target.localeCompare(right.target) || left.property.localeCompare(right.property);
    });
    var events = (input.events || []).map(function (event) {
      return normalizeCompositionEvent(event, durationTicks);
    }).sort(function (left, right) { return left.tick - right.tick || left.id.localeCompare(right.id); });
    if (new Set(events.map(function (event) { return event.id; })).size !== events.length)
      throw new Error("animation composition event ids must be unique");
    var presentation = clone(input.presentation || {});
    var canonicalComposition = {
      schema: COMPOSITION_SCHEMA,
      version: VERSION,
      id: id,
      seed: text(input.seed || id, "composition seed", 200),
      loop: loop,
      timebase: {
        ticks_per_second: ticksPerSecond,
        frames_per_second: fps,
        duration_ticks: durationTicks,
      },
      sources: sources.map(function (source) {
        return { id: source.id, recipe: clone(source.compiled.canonical_recipe) };
      }),
      layers: layers.map(function (layer) {
        return {
          id: layer.id,
          source: layer.source,
          order: layer.order,
          start_tick: layer.start_tick,
          end_tick: layer.end_tick,
          source_in_tick: layer.source_in_tick,
          rate: clone(layer.rate),
          playback: layer.playback,
          blend: layer.blend,
          weight: layer.weight,
          target_prefix: layer.target_prefix,
          properties: clone(layer.properties),
        };
      }),
      events: events,
      presentation: presentation,
      authority: {
        installed: false,
        promoted: false,
        canonical: false,
        human_visual_review_required: true,
      },
    };
    return deepFreeze({
      schema: "axm.deterministic-animation-composition-compiled/v1",
      version: VERSION,
      engine_version: ENGINE_VERSION,
      id: id,
      seed: canonicalComposition.seed,
      loop: loop,
      timebase: timebase,
      sources: sources,
      layers: layers,
      tracks: tracks,
      events: events,
      presentation: presentation,
      canonical_composition: canonicalComposition,
      composition_digest: digest(canonicalComposition),
      determinism: {
        fixed_point_precision: PRECISION,
        integer_time: true,
        dependency_order_explicit: true,
        seeded_noise: true,
        call_time_randomness: false,
      },
      losses: sources.some(function (source) { return source.compiled.events.length > 0; })
        ? ["source recipe events are not implicitly remapped; composition events are explicit"]
        : [],
    });
  }

  function layerLocalTick(compiled, layer, source, outputTick) {
    var elapsed = outputTick - layer.start_tick;
    var numerator = source.timebase.ticks_per_second * layer.rate.numerator;
    var denominator = compiled.timebase.ticks_per_second * layer.rate.denominator;
    var local = layer.source_in_tick + mulDiv(elapsed, numerator, denominator, "composition layer time mapping");
    var duration = source.timebase.duration_ticks;
    if (layer.playback === "loop") return mod(local, duration);
    if (layer.playback === "ping-pong") {
      var phase = mod(local, duration * 2);
      return phase > duration ? duration * 2 - phase : phase;
    }
    return Math.max(0, Math.min(duration, local));
  }

  function sampleComposition(input, requestedTick) {
    var compiled = input && input.schema === "axm.deterministic-animation-composition-compiled/v1"
      ? input
      : compileComposition(input);
    var tick = integer(requestedTick, "composition sample tick", 0, compiled.timebase.duration_ticks);
    var localTick = compiled.loop && tick === compiled.timebase.duration_ticks ? 0 : tick;
    var values = new Map();
    compiled.tracks.forEach(function (track) {
      values.set(track.id, defaultBindingValue(track.property));
    });
    var sourceById = new Map(compiled.sources.map(function (source) { return [source.id, source.compiled]; }));
    compiled.layers.forEach(function (layer) {
      if (localTick < layer.start_tick || localTick > layer.end_tick) return;
      var source = sourceById.get(layer.source);
      var sourceTick = layerLocalTick(compiled, layer, source, localTick);
      var sourceSample = sampleCompiled(source, sourceTick);
      var sourceValues = new Map(sourceSample.values.map(function (value) { return [value.id, value.value_i]; }));
      layer.track_map.forEach(function (mapping) {
        var current = values.get(mapping.output_track_id);
        var incoming = sourceValues.get(mapping.source_track_id);
        var result;
        if (layer.blend === "add")
          result = current + mulFixed(incoming, layer.weight_i, "composition additive blend");
        else if (layer.blend === "multiply") {
          var factor = PRECISION + mulFixed(incoming - PRECISION, layer.weight_i, "composition multiplicative weight");
          result = mulFixed(current, factor, "composition multiplicative blend");
        } else
          result = current + mulFixed(incoming - current, layer.weight_i, "composition replacement blend");
        values.set(mapping.output_track_id, safeBigIntNumber(result, "composition binding " + mapping.binding));
      });
    });
    return {
      schema: "axm.deterministic-animation-composition-sample/v1",
      recipe_id: compiled.id,
      tick: tick,
      local_tick: localTick,
      values: compiled.tracks.map(function (track) {
        var value = values.get(track.id);
        return {
          id: track.id,
          target: track.target,
          property: track.property,
          unit: track.unit,
          value_i: value,
          value: value / PRECISION,
        };
      }),
    };
  }

  function bakeComposition(input) {
    var compiled = input && input.schema === "axm.deterministic-animation-composition-compiled/v1"
      ? input
      : compileComposition(input);
    var frames = [];
    for (var index = 0; index < compiled.timebase.frame_count; index += 1) {
      var tick = Math.min(index * compiled.timebase.ticks_per_frame, compiled.timebase.duration_ticks);
      var sample = sampleComposition(compiled, tick);
      frames.push({
        index: index,
        tick: tick,
        values_i: Object.fromEntries(sample.values.map(function (value) { return [value.id, value.value_i]; })),
      });
    }
    var result = {
      schema: BAKE_SCHEMA,
      version: VERSION,
      recipe_id: compiled.id,
      recipe_digest: compiled.composition_digest,
      timebase: clone(compiled.timebase),
      loop: compiled.loop,
      tracks: compiled.tracks.map(function (track) {
        return {
          id: track.id,
          target: track.target,
          property: track.property,
          unit: track.unit,
          precision: PRECISION,
          samples_i: frames.map(function (frame) { return frame.values_i[track.id]; }),
        };
      }),
      frames: frames,
      events: compiled.events.map(function (event) {
        return {
          id: event.id,
          tick: event.tick,
          frame_index: Math.min(Math.floor(event.tick / compiled.timebase.ticks_per_frame), frames.length - 1),
          kind: event.kind,
          payload: clone(event.payload),
        };
      }),
      determinism: clone(compiled.determinism),
      authority: {
        installed: false,
        promoted: false,
        canonical: false,
        human_visual_review_required: true,
      },
    };
    result.digest = digest(result);
    return deepFreeze(result);
  }

  function verifyComposition(input) {
    var checks = [];
    var compiled;
    var first;
    var second;
    try {
      compiled = compileComposition(input);
      checks.push({ id: "compile-composition", status: "PASS", evidence: compiled.composition_digest });
      first = bakeComposition(compiled);
      second = bakeComposition(compiled);
      checks.push({ id: "repeat-composition-bake", status: first.digest === second.digest ? "PASS" : "FAIL", evidence: [first.digest, second.digest] });
      checks.push({ id: "ordered-layers", status: compiled.layers.length > 0 ? "PASS" : "FAIL", evidence: compiled.layers.map(function (layer) { return layer.id + ":" + layer.order; }) });
      checks.push({ id: "fixed-point-values", status: first.tracks.every(function (track) { return track.samples_i.every(Number.isSafeInteger); }) ? "PASS" : "FAIL", evidence: "precision=" + PRECISION });
      checks.push({ id: "bounded-frame-count", status: first.frames.length <= 20000 ? "PASS" : "FAIL", evidence: first.frames.length });
      checks.push({ id: "authority", status: first.authority.canonical === false && first.authority.human_visual_review_required === true ? "PASS" : "FAIL", evidence: first.authority });
    } catch (error) {
      checks.push({ id: "compile-composition", status: "FAIL", evidence: String(error && error.message ? error.message : error) });
    }
    var failed = checks.filter(function (check) { return check.status === "FAIL"; }).length;
    return {
      schema: RECEIPT_SCHEMA,
      version: VERSION,
      status: failed ? "HOLD" : "PASS",
      recipe_id: compiled ? compiled.id : input && input.id || null,
      recipe_digest: compiled ? compiled.composition_digest : null,
      bake_digest: first ? first.digest : null,
      checks: checks,
      summary: { total: checks.length, passed: checks.length - failed, failed: failed },
      claims: {
        proves: ["bounded embedded clip composition", "rational time remapping", "ordered fixed-point layer blending", "repeatable fixed-tick bake"],
        does_not_prove: ["source event remapping", "motion taste", "deformation quality", "engine adapter parity", "final encoded media"],
      },
      authority: { installed: false, promoted: false, canonical: false, human_visual_review_required: true },
    };
  }

  function verify(input) {
    if (input && input.schema === COMPOSITION_SCHEMA) return verifyComposition(input);
    var checks = [];
    var compiled;
    var first;
    var second;
    try {
      compiled = compileRecipe(input);
      checks.push({ id: "compile", status: "PASS", evidence: compiled.recipe_digest });
      first = bake(compiled);
      second = bake(compiled);
      checks.push({ id: "repeat-bake", status: first.digest === second.digest ? "PASS" : "FAIL", evidence: [first.digest, second.digest] });
      checks.push({ id: "integer-time", status: compiled.timebase.ticks_per_second % compiled.timebase.frames_per_second === 0 ? "PASS" : "FAIL", evidence: compiled.timebase });
      checks.push({ id: "fixed-point-values", status: first.tracks.every(function (track) { return track.samples_i.every(Number.isSafeInteger); }) ? "PASS" : "FAIL", evidence: "precision=" + PRECISION });
      checks.push({ id: "bounded-frame-count", status: first.frames.length <= 20000 ? "PASS" : "FAIL", evidence: first.frames.length });
      checks.push({ id: "authority", status: first.authority.canonical === false && first.authority.human_visual_review_required === true ? "PASS" : "FAIL", evidence: first.authority });
    } catch (error) {
      checks.push({ id: "compile", status: "FAIL", evidence: String(error && error.message ? error.message : error) });
    }
    var failed = checks.filter(function (check) { return check.status === "FAIL"; }).length;
    return {
      schema: RECEIPT_SCHEMA,
      version: VERSION,
      status: failed ? "HOLD" : "PASS",
      recipe_id: compiled ? compiled.id : input && input.id || null,
      recipe_digest: compiled ? compiled.recipe_digest : null,
      bake_digest: first ? first.digest : null,
      checks: checks,
      summary: { total: checks.length, passed: checks.length - failed, failed: failed },
      claims: {
        proves: ["typed graph compilation", "repeatable fixed-tick bake", "integer fixed-point samples"],
        does_not_prove: ["motion taste", "deformation quality", "engine adapter parity", "final encoded media"],
      },
      authority: { installed: false, promoted: false, canonical: false, human_visual_review_required: true },
    };
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character];
    });
  }

  function resolveBake(input) {
    if (input && input.schema === BAKE_SCHEMA) return input;
    return bake(input);
  }

  function presentationValue(baked, frameIndex, target, property, fallback) {
    var track = baked.tracks.find(function (item) { return item.target === target && item.property === property; });
    return track ? track.samples_i[frameIndex] / track.precision : fallback;
  }

  function selectedFrameIndexes(frameCount, maximum) {
    var count = Math.min(frameCount, maximum);
    if (count <= 1) return [0];
    var indexes = [];
    for (var index = 0; index < count; index += 1)
      indexes.push(Math.round(index * (frameCount - 1) / (count - 1)));
    return indexes;
  }

  function renderFilmstripSvg(input, options) {
    var baked = resolveBake(input);
    options = options || {};
    var target = options.target || baked.tracks[0].target;
    var indexes = selectedFrameIndexes(baked.frames.length, Math.max(1, Math.min(16, Number(options.max_frames) || 12)));
    var columns = Math.min(4, indexes.length);
    var rows = Math.ceil(indexes.length / columns);
    var cellWidth = 144;
    var cellHeight = 132;
    var background = options.background || "#07111f";
    var fill = options.fill || "#29d8f2";
    var stroke = options.stroke || "#e9fbff";
    var shape = options.shape || "diamond";
    var body = '<rect width="100%" height="100%" fill="' + esc(background) + '"/>';
    indexes.forEach(function (frameIndex, slot) {
      var column = slot % columns;
      var row = Math.floor(slot / columns);
      var originX = column * cellWidth;
      var originY = row * cellHeight;
      var x = presentationValue(baked, frameIndex, target, "transform.x", 0);
      var y = presentationValue(baked, frameIndex, target, "transform.y", 0);
      var scale = presentationValue(baked, frameIndex, target, "transform.scale", 1);
      var rotation = presentationValue(baked, frameIndex, target, "transform.rotation", 0);
      var opacity = Math.max(0, Math.min(1, presentationValue(baked, frameIndex, target, "opacity", 1)));
      var localX = cellWidth / 2 + Math.max(-cellWidth * 0.28, Math.min(cellWidth * 0.28, x));
      var localY = cellHeight / 2 + Math.max(-cellHeight * 0.25, Math.min(cellHeight * 0.25, y));
      body += '<g transform="translate(' + originX + ' ' + originY + ')">';
      body += '<rect x="4" y="4" width="136" height="124" rx="10" fill="none" stroke="' + esc(stroke) + '" stroke-opacity=".16"/>';
      body += '<path d="M14 105 H130" stroke="' + esc(stroke) + '" stroke-opacity=".18"/>';
      body += '<g opacity="' + opacity.toFixed(4) + '" transform="translate(' + localX.toFixed(3) + ' ' + localY.toFixed(3) + ') rotate(' + rotation.toFixed(3) + ') scale(' + scale.toFixed(6) + ')">';
      if (shape === "circle") body += '<circle r="18" fill="' + esc(fill) + '" stroke="' + esc(stroke) + '" stroke-width="2"/>';
      else if (shape === "square") body += '<rect x="-18" y="-18" width="36" height="36" rx="5" fill="' + esc(fill) + '" stroke="' + esc(stroke) + '" stroke-width="2"/>';
      else body += '<path d="M0 -23 L23 0 L0 23 L-23 0 Z" fill="' + esc(fill) + '" stroke="' + esc(stroke) + '" stroke-width="2"/>';
      body += '</g><text x="12" y="121" fill="' + esc(stroke) + '" fill-opacity=".72" font-family="monospace" font-size="9">f' + frameIndex + ' · t' + baked.frames[frameIndex].tick + '</text></g>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + columns * cellWidth + '" height="' + rows * cellHeight + '" viewBox="0 0 ' + columns * cellWidth + ' ' + rows * cellHeight + '" role="img" aria-label="' + esc(baked.recipe_id + " deterministic animation filmstrip") + '">' + body + '</svg>';
  }

  function spriteAtlasLayout(baked, options) {
    options = options || {};
    var frameCount = baked.frames.length;
    if (frameCount > MAX_ATLAS_FRAMES)
      throw new RangeError("sprite atlas exceeds the " + MAX_ATLAS_FRAMES + " frame boundary");
    var frameWidth = integer(options.frame_width == null ? 96 : options.frame_width, "atlas frame width", 1, 1024);
    var frameHeight = integer(options.frame_height == null ? 96 : options.frame_height, "atlas frame height", 1, 1024);
    if (frameWidth * frameHeight * frameCount > 16777216)
      throw new RangeError("sprite atlas exceeds the 16777216 logical-pixel boundary");
    var defaultColumns = Math.min(16, Math.ceil(Math.sqrt(frameCount)));
    var columns = integer(options.columns == null ? defaultColumns : options.columns, "atlas columns", 1, Math.min(256, frameCount));
    var rows = Math.ceil(frameCount / columns);
    return {
      frame_width: frameWidth,
      frame_height: frameHeight,
      frame_count: frameCount,
      columns: columns,
      rows: rows,
      width: columns * frameWidth,
      height: rows * frameHeight,
    };
  }

  function renderSpriteAtlasSvg(input, options) {
    var baked = resolveBake(input);
    options = options || {};
    var layout = spriteAtlasLayout(baked, options);
    var target = options.target || baked.tracks[0].target;
    var fill = options.fill || "#29d8f2";
    var stroke = options.stroke || "#e9fbff";
    var background = options.background || "transparent";
    var shape = options.shape || "diamond";
    var radius = Math.max(2, Math.min(layout.frame_width, layout.frame_height) * 0.2);
    var definitions = "";
    var body = "";
    baked.frames.forEach(function (frame, frameIndex) {
      var column = frameIndex % layout.columns;
      var row = Math.floor(frameIndex / layout.columns);
      var originX = column * layout.frame_width;
      var originY = row * layout.frame_height;
      var clipId = "atlas-cell-" + frameIndex;
      definitions += '<clipPath id="' + clipId + '"><rect x="' + originX + '" y="' + originY + '" width="' + layout.frame_width + '" height="' + layout.frame_height + '"/></clipPath>';
      var x = presentationValue(baked, frameIndex, target, "transform.x", 0);
      var y = presentationValue(baked, frameIndex, target, "transform.y", 0);
      var scale = presentationValue(baked, frameIndex, target, "transform.scale", 1);
      var rotation = presentationValue(baked, frameIndex, target, "transform.rotation", 0);
      var opacity = Math.max(0, Math.min(1, presentationValue(baked, frameIndex, target, "opacity", 1)));
      body += '<g clip-path="url(#' + clipId + ')">';
      if (background !== "transparent")
        body += '<rect x="' + originX + '" y="' + originY + '" width="' + layout.frame_width + '" height="' + layout.frame_height + '" fill="' + esc(background) + '"/>';
      body += '<g opacity="' + opacity.toFixed(6) + '" transform="translate(' + (originX + layout.frame_width / 2 + x).toFixed(4) + ' ' + (originY + layout.frame_height / 2 + y).toFixed(4) + ') rotate(' + rotation.toFixed(4) + ') scale(' + scale.toFixed(6) + ')">';
      if (shape === "circle")
        body += '<circle r="' + radius.toFixed(4) + '" fill="' + esc(fill) + '" stroke="' + esc(stroke) + '" stroke-width="2"/>';
      else if (shape === "square")
        body += '<rect x="' + (-radius).toFixed(4) + '" y="' + (-radius).toFixed(4) + '" width="' + (radius * 2).toFixed(4) + '" height="' + (radius * 2).toFixed(4) + '" rx="' + Math.max(1, radius * 0.18).toFixed(4) + '" fill="' + esc(fill) + '" stroke="' + esc(stroke) + '" stroke-width="2"/>';
      else
        body += '<path d="M0 ' + (-radius).toFixed(4) + ' L' + radius.toFixed(4) + ' 0 L0 ' + radius.toFixed(4) + ' L' + (-radius).toFixed(4) + ' 0 Z" fill="' + esc(fill) + '" stroke="' + esc(stroke) + '" stroke-width="2"/>';
      body += "</g></g>";
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + layout.width + '" height="' + layout.height + '" viewBox="0 0 ' + layout.width + ' ' + layout.height + '" role="img" aria-label="' + esc(baked.recipe_id + " deterministic sprite atlas") + '" data-bake-digest="' + esc(baked.digest) + '"><defs>' + definitions + "</defs>" + body + "</svg>";
  }

  function createSpriteAtlasManifest(input, options) {
    var baked = resolveBake(input);
    options = options || {};
    var layout = spriteAtlasLayout(baked, options);
    var durationMs = Number((1000 / baked.timebase.frames_per_second).toFixed(6));
    var name = text(options.name || baked.recipe_id, "atlas name", 160);
    var image = text(options.image || baked.recipe_id + "-atlas.svg", "atlas image", 240);
    return deepFreeze({
      schema: "axm.sprite-atlas/v1",
      name: name,
      image: image,
      frameWidth: layout.frame_width,
      frameHeight: layout.frame_height,
      frameCount: layout.frame_count,
      fps: baked.timebase.frames_per_second,
      loop: baked.loop,
      tags: [{ name: "default", from: 0, to: layout.frame_count - 1, direction: "forward" }],
      pivot: { x: 0.5, y: 0.5 },
      frames: baked.frames.map(function (frame, frameIndex) {
        return {
          id: "frame-" + String(frameIndex).padStart(4, "0"),
          x: frameIndex % layout.columns * layout.frame_width,
          y: Math.floor(frameIndex / layout.columns) * layout.frame_height,
          width: layout.frame_width,
          height: layout.frame_height,
          durationMs: durationMs,
          pivot: { x: 0.5, y: 0.5 },
        };
      }),
    });
  }

  function cssNumber(value) {
    var result = Number(value.toFixed(6));
    return Object.is(result, -0) ? "0" : String(result);
  }

  function renderCssKeyframes(input, options) {
    var baked = resolveBake(input);
    options = options || {};
    var targets = Array.from(new Set(baked.tracks.map(function (track) { return track.target; }))).sort();
    var duration = baked.timebase.duration_seconds;
    var css = "/* " + baked.schema + " · " + baked.digest + " · candidate-only */\n";
    targets.forEach(function (target) {
      var safe = target.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
      var name = (options.prefix || "axm-motion-") + safe;
      css += "@keyframes " + name + " {\n";
      baked.frames.forEach(function (frame, index) {
        var percent = frame.tick / baked.timebase.duration_ticks * 100;
        var x = presentationValue(baked, index, target, "transform.x", 0);
        var y = presentationValue(baked, index, target, "transform.y", 0);
        var scale = presentationValue(baked, index, target, "transform.scale", 1);
        var rotation = presentationValue(baked, index, target, "transform.rotation", 0);
        var opacity = Math.max(0, Math.min(1, presentationValue(baked, index, target, "opacity", 1)));
        css += "  " + cssNumber(percent) + "% { transform: translate(" + cssNumber(x) + "px, " + cssNumber(y) + "px) rotate(" + cssNumber(rotation) + "deg) scale(" + cssNumber(scale) + "); opacity: " + cssNumber(opacity) + "; }\n";
      });
      if (baked.loop) {
        var firstX = presentationValue(baked, 0, target, "transform.x", 0);
        var firstY = presentationValue(baked, 0, target, "transform.y", 0);
        var firstScale = presentationValue(baked, 0, target, "transform.scale", 1);
        var firstRotation = presentationValue(baked, 0, target, "transform.rotation", 0);
        var firstOpacity = Math.max(0, Math.min(1, presentationValue(baked, 0, target, "opacity", 1)));
        css += "  100% { transform: translate(" + cssNumber(firstX) + "px, " + cssNumber(firstY) + "px) rotate(" + cssNumber(firstRotation) + "deg) scale(" + cssNumber(firstScale) + "); opacity: " + cssNumber(firstOpacity) + "; }\n";
      }
      css += "}\n." + name + " { animation: " + name + " " + cssNumber(duration) + "s linear " + (baked.loop ? "infinite" : "1 both") + "; }\n";
    });
    return css;
  }

  function createCandidateRecipe(options) {
    options = options || {};
    var id = identifier(options.id || "deterministic-motion-candidate", "candidate recipe id");
    var fps = integer(options.frames_per_second || 30, "candidate frames per second", 1, 120);
    var frames = integer(options.frame_count || fps * 2, "candidate frame count", 2, 1200);
    var ticksPerFrame = 1000;
    var ticksPerSecond = fps * ticksPerFrame;
    var durationTicks = frames * ticksPerFrame;
    var width = finite(options.width || 64, "candidate width", 1, 8192);
    var height = finite(options.height || 64, "candidate height", 1, 8192);
    var seed = text(options.seed || id, "candidate seed", 200);
    var phase = fnv1a32(seed) % durationTicks;
    var palette = Array.isArray(options.palette) ? options.palette : ["#07111f", "#29d8f2", "#e9fbff"];
    return {
      schema: RECIPE_SCHEMA,
      version: VERSION,
      id: id,
      seed: seed,
      loop: true,
      timebase: {
        ticks_per_second: ticksPerSecond,
        frames_per_second: fps,
        duration_ticks: durationTicks,
      },
      blocks: [],
      instances: [
        {
          id: "sway",
          block: "axm.motion.oscillator/v1",
          parameters: { waveform: "triangle", period_ticks: durationTicks, phase_ticks: phase, amplitude: Math.min(24, width * 0.16), offset: 0 },
        },
        {
          id: "bob",
          block: "axm.motion.oscillator/v1",
          parameters: { waveform: "triangle", period_ticks: Math.max(ticksPerFrame * 2, Math.floor(durationTicks / 2 / ticksPerFrame) * ticksPerFrame), phase_ticks: 0, amplitude: Math.min(14, height * 0.11), offset: 0 },
        },
        {
          id: "pulse",
          block: "axm.motion.oscillator/v1",
          parameters: { waveform: "triangle", period_ticks: Math.max(ticksPerFrame * 2, Math.floor(durationTicks / 2 / ticksPerFrame) * ticksPerFrame), phase_ticks: Math.floor(durationTicks / 4), amplitude: 0.08, offset: 1 },
        },
        {
          id: "texture",
          block: "axm.motion.seeded-noise/v1",
          parameters: { hold_ticks: ticksPerFrame * 3, amplitude: Math.min(2, width * 0.02), offset: 0, seed: seed + ":micro" },
        },
      ],
      nodes: [
        { id: "x", type: "add", inputs: ["sway.value", "texture.value"] },
        { id: "rotation", type: "remap", input: "sway.value", input_min: -Math.min(24, width * 0.16), input_max: Math.min(24, width * 0.16), output_min: -7, output_max: 7 },
        { id: "opacity", type: "constant", value: 1 },
      ],
      tracks: [
        { id: "hero-x", target: "hero", property: "transform.x", node: "x", unit: "px" },
        { id: "hero-y", target: "hero", property: "transform.y", node: "bob.value", unit: "px" },
        { id: "hero-scale", target: "hero", property: "transform.scale", node: "pulse.value", unit: "ratio" },
        { id: "hero-rotation", target: "hero", property: "transform.rotation", node: "rotation", unit: "deg" },
        { id: "hero-opacity", target: "hero", property: "opacity", node: "opacity", unit: "ratio" },
      ],
      events: [
        { id: "cycle-origin", tick: 0, kind: "marker", payload: { phase: "origin" } },
        { id: "cycle-accent", tick: Math.floor(durationTicks / 2), kind: "accent", payload: { phase: "counterpoint" } },
      ],
      presentation: {
        target: "hero",
        shape: options.shape || "diamond",
        background: palette[0] || "#07111f",
        fill: palette[1] || "#29d8f2",
        stroke: palette[2] || "#e9fbff",
      },
      authority: { installed: false, promoted: false, canonical: false, human_visual_review_required: true },
    };
  }

  function wrapRecipeAsComposition(recipe, options) {
    options = options || {};
    var compiled = compileRecipe(recipe);
    var compositionId = identifier(options.id || compiled.id + "-composition", "wrapped composition id");
    return {
      schema: COMPOSITION_SCHEMA,
      version: VERSION,
      id: compositionId,
      seed: text(options.seed || compiled.seed + ":composition", "wrapped composition seed", 200),
      loop: options.loop == null ? compiled.loop : options.loop === true,
      timebase: {
        ticks_per_second: compiled.timebase.ticks_per_second,
        frames_per_second: compiled.timebase.frames_per_second,
        duration_ticks: compiled.timebase.duration_ticks,
      },
      sources: [{ id: "source", recipe: clone(compiled.canonical_recipe) }],
      layers: [{
        id: "source-layer",
        source: "source",
        order: 0,
        start_tick: 0,
        end_tick: compiled.timebase.duration_ticks,
        source_in_tick: 0,
        rate: { numerator: 1, denominator: 1 },
        playback: compiled.loop ? "loop" : "clamp",
        blend: "replace",
        weight: 1,
        target_prefix: "",
        properties: [],
      }],
      events: clone(compiled.events),
      presentation: clone(options.presentation || compiled.presentation),
      authority: { installed: false, promoted: false, canonical: false, human_visual_review_required: true },
    };
  }

  function createCandidateComposition(options) {
    options = options || {};
    var id = identifier(options.id || "deterministic-motion-composition", "candidate composition id");
    var primary = createCandidateRecipe(Object.assign({}, options, {
      id: id + "-primary",
      seed: text(options.seed || id, "candidate composition seed", 200) + ":primary",
    }));
    var accent = createCandidateRecipe(Object.assign({}, options, {
      id: id + "-accent",
      seed: text(options.seed || id, "candidate composition seed", 200) + ":accent",
    }));
    var durationTicks = primary.timebase.duration_ticks;
    return {
      schema: COMPOSITION_SCHEMA,
      version: VERSION,
      id: id,
      seed: text(options.seed || id, "candidate composition seed", 200),
      loop: true,
      timebase: clone(primary.timebase),
      sources: [
        { id: "primary", recipe: primary },
        { id: "accent", recipe: accent },
      ],
      layers: [
        {
          id: "primary-layer",
          source: "primary",
          order: 0,
          start_tick: 0,
          end_tick: durationTicks,
          source_in_tick: 0,
          rate: { numerator: 1, denominator: 1 },
          playback: "loop",
          blend: "replace",
          weight: 1,
          target_prefix: "",
          properties: [],
        },
        {
          id: "accent-layer",
          source: "accent",
          order: 10,
          start_tick: 0,
          end_tick: durationTicks,
          source_in_tick: Math.floor(durationTicks / 4),
          rate: { numerator: 2, denominator: 1 },
          playback: "ping-pong",
          blend: "add",
          weight: 0.18,
          target_prefix: "",
          properties: ["transform.rotation", "transform.x", "transform.y"],
        },
      ],
      events: [
        { id: "composition-origin", tick: 0, kind: "marker", payload: { layer: "primary-layer" } },
        { id: "composition-counterpoint", tick: Math.floor(durationTicks / 2), kind: "accent", payload: { layer: "accent-layer" } },
      ],
      presentation: clone(primary.presentation),
      authority: { installed: false, promoted: false, canonical: false, human_visual_review_required: true },
    };
  }

  function fromProceduralMotion(clip, options) {
    options = options || {};
    if (!clip || clip.schema !== "axm.procedural-motion/v1")
      throw new TypeError("axm.procedural-motion/v1 clip is required");
    var id = identifier(options.id || clip.id || "adapted-motion", "adapted recipe id");
    var fps = integer(options.frames_per_second || 60, "adapter frames per second", 1, 240);
    var durationMs = finite(
      options.duration_ms || clip.durationMs,
      "adapter duration milliseconds",
      1,
      600000,
    );
    var frames = Math.max(1, Math.round(durationMs / 1000 * fps));
    var ticksPerFrame = 1000;
    var durationTicks = frames * ticksPerFrame;
    var channels = clip.channels && typeof clip.channels === "object" ? clip.channels : {};
    var channelNames = Object.keys(channels).sort();
    if (!channelNames.length) throw new Error("procedural motion clip has no channels");
    var mappings = options.mappings && typeof options.mappings === "object" ? options.mappings : {};
    var nodes = [];
    var tracks = [];
    var losses = [];
    channelNames.forEach(function (channel) {
      var points = channels[channel];
      if (!Array.isArray(points) || !points.length)
        throw new Error("procedural motion channel " + channel + " has no keyframes");
      var normalizedPoints = points.map(function (point, index) {
        var normalizedTime = finite(point.t, "channel " + channel + " key " + index + " time", 0, 1);
        return {
          tick: Math.round(normalizedTime * durationTicks),
          value: finite(point.v, "channel " + channel + " key " + index + " value", -1000000, 1000000),
        };
      });
      if (clip.loop === true && normalizedPoints[normalizedPoints.length - 1].tick < durationTicks)
        normalizedPoints.push({ tick: durationTicks, value: normalizedPoints[0].value });
      var hasNamedEase = points.some(function (point) { return point.ease && point.ease !== "linear"; });
      if (hasNamedEase) losses.push("channel " + channel + " named easing normalized to deterministic smoothstep");
      var nodeId = "channel/" + channel.replace(/[^a-z0-9._/-]+/gi, "-");
      var mapping = mappings[channel] || {};
      nodes.push({
        id: nodeId,
        type: "keyframes",
        points: normalizedPoints,
        interpolation: hasNamedEase ? "smoothstep" : "linear",
      });
      tracks.push({
        id: "track-" + channel.replace(/[^a-z0-9._/-]+/gi, "-").toLowerCase(),
        target: mapping.target || options.target || "motion-root",
        property: mapping.property || "channel." + channel,
        node: nodeId,
        unit: mapping.unit || options.unit || "unitless",
      });
    });
    return {
      schema: RECIPE_SCHEMA,
      version: VERSION,
      id: id,
      seed: text(options.seed || id, "adapted recipe seed", 200),
      loop: clip.loop === true || options.loop === true,
      timebase: {
        ticks_per_second: fps * ticksPerFrame,
        frames_per_second: fps,
        duration_ticks: durationTicks,
      },
      blocks: [],
      instances: [],
      nodes: nodes,
      tracks: tracks,
      events: [],
      presentation: clone(options.presentation || {}),
      adapter: {
        source_schema: "axm.procedural-motion/v1",
        source_id: clip.id || null,
        losses: losses,
      },
      authority: { installed: false, promoted: false, canonical: false, human_visual_review_required: true },
    };
  }

  return {
    VERSION: VERSION,
    ENGINE_VERSION: ENGINE_VERSION,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    COMPOSITION_SCHEMA: COMPOSITION_SCHEMA,
    BAKE_SCHEMA: BAKE_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    PRECISION: PRECISION,
    NODE_TYPES: NODE_TYPES.slice(),
    BUILTIN_BLOCKS: clone(BUILTIN_BLOCKS),
    canonicalStringify: canonicalStringify,
    digest: digest,
    compileRecipe: compileRecipe,
    compileComposition: compileComposition,
    sampleCompiled: sampleCompiled,
    sampleComposition: sampleComposition,
    bake: bake,
    bakeComposition: bakeComposition,
    verify: verify,
    verifyComposition: verifyComposition,
    renderFilmstripSvg: renderFilmstripSvg,
    renderSpriteAtlasSvg: renderSpriteAtlasSvg,
    createSpriteAtlasManifest: createSpriteAtlasManifest,
    renderCssKeyframes: renderCssKeyframes,
    createCandidateRecipe: createCandidateRecipe,
    wrapRecipeAsComposition: wrapRecipeAsComposition,
    createCandidateComposition: createCandidateComposition,
    fromProceduralMotion: fromProceduralMotion,
    MAX_COMPOSITION_SOURCES: MAX_COMPOSITION_SOURCES,
    MAX_COMPOSITION_LAYERS: MAX_COMPOSITION_LAYERS,
    MAX_ATLAS_FRAMES: MAX_ATLAS_FRAMES,
  };
});
