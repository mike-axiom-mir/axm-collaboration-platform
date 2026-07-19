(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("../../tools/spatial-studio/spatial-geometry")
      : root.AXMSpatialGeometry,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMGeometryGraphCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Geometry) {
  "use strict";
  if (!Geometry) throw new Error("AXM spatial geometry is required");
  var VERSION = "1.0.0",
    SCHEMA = "geometry-graph+json",
    ALLOWED = ["primitive", "transform", "linear-array", "merge", "output"],
    SHAPES = ["cube", "sphere", "cylinder", "cone", "plane", "torus"];
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object")
      return (
        "{" +
        Object.keys(value)
          .sort()
          .map(function (key) {
            return JSON.stringify(key) + ":" + canonical(value[key]);
          })
          .join(",") +
        "}"
      );
    return JSON.stringify(value);
  }
  function hash(value) {
    var source = typeof value === "string" ? value : canonical(value),
      output = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      output ^= source.charCodeAt(index);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(16).padStart(8, "0");
  }
  function finiteArray(value, length, fallback) {
    if (
      !Array.isArray(value) ||
      value.length !== length ||
      value.some(function (item) {
        return !Number.isFinite(Number(item));
      })
    )
      return fallback.slice();
    return value.map(Number);
  }
  function inspect(graph) {
    var errors = [],
      ids = {},
      outputCount = 0;
    if (!graph || typeof graph !== "object" || Array.isArray(graph))
      return { pass: false, errors: ["geometry graph must be an object"] };
    if (graph.schema !== SCHEMA)
      errors.push("geometry graph schema must be geometry-graph+json");
    if (
      !Array.isArray(graph.nodes) ||
      !graph.nodes.length ||
      graph.nodes.length > 64
    )
      errors.push("geometry graph requires 1..64 nodes");
    (graph.nodes || []).forEach(function (node) {
      if (
        !node ||
        typeof node !== "object" ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(String(node.id || ""))
      ) {
        errors.push("node id is invalid");
        return;
      }
      if (ids[node.id]) errors.push("duplicate node id: " + node.id);
      ids[node.id] = node;
      if (ALLOWED.indexOf(node.type) < 0)
        errors.push("node type is not allowlisted: " + node.type);
      if (node.type === "primitive" && SHAPES.indexOf(node.shape) < 0)
        errors.push(node.id + " has unsupported primitive shape");
      if (
        node.type === "primitive" &&
        (!(Number(node.detail) >= 3) || Number(node.detail) > 32)
      )
        errors.push(node.id + " detail must be 3..32");
      if (
        (node.type === "transform" ||
          node.type === "linear-array" ||
          node.type === "output") &&
        !node.input
      )
        errors.push(node.id + " requires input");
      if (
        node.type === "linear-array" &&
        (!(Number(node.count) >= 1) ||
          Number(node.count) > 32 ||
          Math.floor(Number(node.count)) !== Number(node.count))
      )
        errors.push(node.id + " array count must be an integer from 1..32");
      if (
        node.type === "merge" &&
        (!Array.isArray(node.inputs) ||
          !node.inputs.length ||
          node.inputs.length > 16)
      )
        errors.push(node.id + " merge requires 1..16 inputs");
      if (node.type === "output") outputCount += 1;
    });
    if (outputCount !== 1)
      errors.push("geometry graph requires exactly one output node");
    function dependencies(node) {
      return node.type === "merge"
        ? node.inputs || []
        : node.input
          ? [node.input]
          : [];
    }
    Object.keys(ids).forEach(function (id) {
      dependencies(ids[id]).forEach(function (dependency) {
        if (!ids[dependency])
          errors.push(id + " references missing node " + dependency);
      });
    });
    var visiting = {},
      visited = {};
    function walk(id) {
      if (visiting[id]) {
        errors.push("geometry graph cycle detected at " + id);
        return;
      }
      if (visited[id] || !ids[id]) return;
      visiting[id] = true;
      dependencies(ids[id]).forEach(walk);
      visiting[id] = false;
      visited[id] = true;
    }
    Object.keys(ids).forEach(walk);
    return {
      pass: !errors.length,
      errors: Array.from(new Set(errors)),
      nodeCount: (graph.nodes || []).length,
      outputNode:
        (graph.nodes || []).find(function (node) {
          return node.type === "output";
        }) || null,
      allowedNodeTypes: ALLOWED.slice(),
    };
  }
  function evaluate(graph, options) {
    options = options || {};
    var checked = inspect(graph);
    if (!checked.pass)
      throw new Error(
        "geometry graph validation failed: " + checked.errors.join("; "),
      );
    var byId = {},
      memo = {},
      keys = {},
      hits = 0,
      misses = 0,
      tolerance = Math.max(0, Number(options.toleranceMetres) || 0);
    graph.nodes.forEach(function (node) {
      byId[node.id] = node;
    });
    function snap(value) {
      return tolerance > 0 ? Math.round(value / tolerance) * tolerance : value;
    }
    function transformInstance(instance, node) {
      var translate = finiteArray(node.translate, 3, [0, 0, 0]),
        rotate = finiteArray(node.rotate, 3, [0, 0, 0]),
        scale = finiteArray(node.scale, 3, [1, 1, 1]),
        output = clone(instance);
      output.id = node.id + "-" + instance.id;
      output.position = output.position.map(function (value, index) {
        return snap(value + translate[index]);
      });
      output.rotation = output.rotation.map(function (value, index) {
        return value + rotate[index];
      });
      output.scale = output.scale.map(function (value, index) {
        return Math.max(0.000001, snap(value * scale[index]));
      });
      output.source_nodes = output.source_nodes.concat([node.id]);
      return output;
    }
    function evaluateNode(id) {
      if (memo[id]) {
        hits += 1;
        return clone(memo[id]);
      }
      misses += 1;
      var node = byId[id],
        output;
      if (node.type === "primitive")
        output = [
          {
            id: node.id,
            shape: node.shape,
            detail: Math.round(node.detail),
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            source_nodes: [node.id],
          },
        ];
      else if (node.type === "transform")
        output = evaluateNode(node.input).map(function (instance) {
          return transformInstance(instance, node);
        });
      else if (node.type === "linear-array") {
        var source = evaluateNode(node.input),
          offset = finiteArray(node.offset, 3, [1, 0, 0]);
        output = [];
        for (var copyIndex = 0; copyIndex < Number(node.count); copyIndex += 1)
          source.forEach(function (instance) {
            var copy = clone(instance);
            copy.id = node.id + "-" + copyIndex + "-" + instance.id;
            copy.position = copy.position.map(function (value, axis) {
              return snap(value + offset[axis] * copyIndex);
            });
            copy.source_nodes = copy.source_nodes.concat([node.id]);
            output.push(copy);
          });
      } else if (node.type === "merge") {
        output = [];
        node.inputs.forEach(function (input, inputIndex) {
          evaluateNode(input).forEach(function (instance) {
            var copy = clone(instance);
            copy.id = node.id + "-" + inputIndex + "-" + instance.id;
            copy.source_nodes = copy.source_nodes.concat([node.id]);
            output.push(copy);
          });
        });
      } else output = evaluateNode(node.input);
      keys[id] = hash({
        node: node,
        dependencies:
          node.type === "merge"
            ? node.inputs.map(function (input) {
                return keys[input];
              })
            : node.input
              ? [keys[node.input]]
              : [],
      });
      memo[id] = clone(output);
      return clone(output);
    }
    var instances = evaluateNode(checked.outputNode.id),
      triangles = 0,
      vertices = 0;
    instances.forEach(function (instance) {
      var mesh = Geometry.build(instance.shape, instance.detail, {});
      triangles += mesh.indices.length / 3;
      vertices += mesh.positions.length / 3;
    });
    var maxTriangles =
        options.maxTriangles == null ? 200000 : Number(options.maxTriangles),
      maxVertices =
        options.maxVertices == null ? 300000 : Number(options.maxVertices),
      errors = [];
    if (triangles > maxTriangles)
      errors.push("evaluated triangles exceed budget");
    if (vertices > maxVertices) errors.push("evaluated vertices exceed budget");
    if (instances.length > 256)
      errors.push("evaluated instances exceed hard limit");
    return {
      pass: !errors.length,
      errors: errors,
      graphDigest: hash(graph),
      outputDigest: hash(instances),
      outputNodeKey: keys[checked.outputNode.id],
      instances: instances,
      triangles: triangles,
      vertices: vertices,
      cache: {
        scope: "request-local",
        deterministic: true,
        hits: hits,
        misses: misses,
        entries: Object.keys(memo).length,
        node_keys: clone(keys),
      },
      toleranceMetres: tolerance,
    };
  }
  return {
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    ALLOWED_NODE_TYPES: ALLOWED.slice(),
    SHAPES: SHAPES.slice(),
    canonical: canonical,
    hash: hash,
    inspect: inspect,
    evaluate: evaluate,
  };
});
