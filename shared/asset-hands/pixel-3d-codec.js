(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var api = factory(
    node ? require("../../tools/spatial-studio/spatial-geometry") : root.AXMSpatialGeometry,
    node ? require("./gltf-codec") : root.AXMGlTFCodec
  );
  if (node) module.exports = api;
  if (root) root.AXMPixel3DCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Geometry, GlTF) {
  "use strict";
  if (!Geometry || !GlTF) throw new Error("pixel 3D codec requires Spatial Geometry and glTF Codec");
  var VERSION = "1.0.0";

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error("typed array bytes required");
  }

  function concat(parts) {
    var length = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(length), offset = 0;
    parts.forEach(function (part) { out.set(part, offset); offset += part.length; });
    return out;
  }

  function pad(value, multiple, fill) {
    var bytes = asBytes(value), length = Math.ceil(bytes.length / multiple) * multiple;
    var out = new Uint8Array(length);
    out.fill(fill || 0);
    out.set(bytes);
    return out;
  }

  function utf8(value) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(String(value));
    return new Uint8Array(Buffer.from(String(value), "utf8"));
  }

  function base64(value) {
    var bytes = asBytes(value);
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    var text = "", step = 32768;
    for (var index = 0; index < bytes.length; index += step) text += String.fromCharCode.apply(null, bytes.subarray(index, Math.min(bytes.length, index + step)));
    return btoa(text);
  }

  function bytesFromDataUrl(value) {
    var match = /^data:model\/gltf-binary;base64,([a-z0-9+/=]+)$/i.exec(String(value || ""));
    if (!match) throw new Error("model/gltf-binary data URL required");
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(match[1], "base64"));
    var raw = atob(match[1]), out = new Uint8Array(raw.length);
    for (var index = 0; index < raw.length; index += 1) out[index] = raw.charCodeAt(index);
    return out;
  }

  function le32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function colour(value, alpha) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    var opacity = alpha == null ? 1 : Math.max(0, Math.min(1, Number(alpha)));
    if (!match) return [0.5, 0.7, 0.8, opacity];
    var number = parseInt(match[1], 16);
    return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255, opacity];
  }

  function minMax(positions) {
    var minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    for (var index = 0; index < positions.length; index += 3) {
      for (var axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], positions[index + axis]);
        maximum[axis] = Math.max(maximum[axis], positions[index + axis]);
      }
    }
    return { min: minimum, max: maximum };
  }

  function normalizedQuaternion(value) {
    if (!Array.isArray(value) || value.length !== 4) return false;
    var length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3]));
    return Number.isFinite(length) && Math.abs(length - 1) < 0.001;
  }

  function validateScene(scene) {
    var errors = [];
    if (!scene || scene.schema !== "axm.pixel-3d-scene-recipe/v1") errors.push("pixel 3D scene recipe required");
    if (!scene || !Array.isArray(scene.nodes) || !scene.nodes.length) errors.push("scene nodes required");
    if (!scene || !Array.isArray(scene.materials) || !scene.materials.length) errors.push("scene materials required");
    if (!scene || !Array.isArray(scene.animations) || !scene.animations.length) errors.push("at least one animation required");
    if (errors.length) return errors;
    var nodeIds = new Set(), materialIds = new Set();
    scene.materials.forEach(function (material) {
      if (materialIds.has(material.id)) errors.push("duplicate material id " + material.id);
      materialIds.add(material.id);
    });
    scene.nodes.forEach(function (node) {
      if (nodeIds.has(node.id)) errors.push("duplicate node id " + node.id);
      nodeIds.add(node.id);
      if (!Array.isArray(node.translation) || node.translation.length !== 3) errors.push(node.id + " translation invalid");
      if (!normalizedQuaternion(node.rotation)) errors.push(node.id + " rotation quaternion invalid");
      if (!Array.isArray(node.scale) || node.scale.length !== 3 || node.scale.some(function (value) { return !(Number(value) > 0); })) errors.push(node.id + " scale invalid");
      if (node.primitive && !materialIds.has(node.material_id)) errors.push(node.id + " material missing");
    });
    scene.nodes.forEach(function (node) {
      if (node.parent_id != null && !nodeIds.has(node.parent_id)) errors.push(node.id + " parent missing");
    });
    scene.animations.forEach(function (animation) {
      if (!Array.isArray(animation.channels) || !animation.channels.length) errors.push(animation.id + " channels required");
      (animation.channels || []).forEach(function (channel) {
        if (!nodeIds.has(channel.node_id)) errors.push(channel.node_id + " animation target missing");
        if (["translation", "rotation", "scale"].indexOf(channel.path) < 0) errors.push(channel.node_id + " animation path invalid");
        if (!Array.isArray(channel.keys) || channel.keys.length < 2) errors.push(channel.node_id + " animation keys missing");
        (channel.keys || []).forEach(function (key) {
          var expected = channel.path === "rotation" ? 4 : 3;
          if (!Array.isArray(key.value) || key.value.length !== expected) errors.push(channel.node_id + " animation value width invalid");
          if (channel.path === "rotation" && !normalizedQuaternion(key.value)) errors.push(channel.node_id + " animation quaternion invalid");
        });
      });
    });
    return errors;
  }

  function pack(scene) {
    var sceneErrors = validateScene(scene);
    if (sceneErrors.length) throw new Error("pixel 3D scene invalid: " + sceneErrors.join(", "));
    var chunks = [], bufferViews = [], accessors = [], byteOffset = 0;

    function addView(value, target) {
      var bytes = asBytes(value), padded = pad(bytes, 4, 0), view = { buffer: 0, byteOffset: byteOffset, byteLength: bytes.length };
      if (target) view.target = target;
      var index = bufferViews.length;
      bufferViews.push(view);
      chunks.push(padded);
      byteOffset += padded.length;
      return index;
    }

    function addAccessor(array, type, componentType, target, minimum, maximum) {
      var accessor = { bufferView: addView(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), target), componentType: componentType, count: array.length / ({ SCALAR: 1, VEC3: 3, VEC4: 4 })[type], type: type };
      if (minimum) accessor.min = minimum;
      if (maximum) accessor.max = maximum;
      accessors.push(accessor);
      return accessors.length - 1;
    }

    var materialIndex = {};
    var materials = scene.materials.map(function (material, index) {
      materialIndex[material.id] = index;
      var alpha = material.opacity == null ? 1 : Math.max(0, Math.min(1, Number(material.opacity)));
      var extensions = {};
      var result = {
        name: material.id,
        pbrMetallicRoughness: {
          baseColorFactor: colour(material.colour, alpha),
          metallicFactor: Number(material.metallic) || 0,
          roughnessFactor: material.roughness == null ? 0.8 : Number(material.roughness)
        },
        alphaMode: alpha < 1 ? "BLEND" : "OPAQUE",
        doubleSided: material.double_sided === true,
        extras: {
          axm_material_id: material.id,
          palette_role: material.role || material.id,
          visual_treatment: material.visual_treatment || null,
          clearcoat: Number(material.clearcoat) || 0,
          sheen: Number(material.sheen) || 0,
          iridescence: Number(material.iridescence) || 0,
          translucency: Number(material.translucency) || 0,
          pattern: material.pattern || null
        }
      };
      if (material.emissive_colour && Number(material.emissive_strength) > 0) {
        result.emissiveFactor = colour(material.emissive_colour).slice(0, 3);
        extensions.KHR_materials_emissive_strength = { emissiveStrength: Number(material.emissive_strength) };
      }
      if (material.unlit) extensions.KHR_materials_unlit = {};
      if (Object.keys(extensions).length) result.extensions = extensions;
      return result;
    });

    var meshes = [], meshIndex = {}, meshMeasures = {}, triangles = 0, uniqueTriangles = 0, vertices = 0;
    function resolveMesh(node) {
      if (!node.primitive) return undefined;
      var primitive = node.primitive;
      var key = [primitive.type, primitive.detail, primitive.minor_radius || 0, primitive.inflate || 0, primitive.twist || 0, node.material_id].join("|");
      if (Object.prototype.hasOwnProperty.call(meshIndex, key)) {
        triangles += meshMeasures[key].triangles;
        return meshIndex[key];
      }
      var built = Geometry.build(primitive.type, primitive.detail, primitive);
      var positions = built.positions instanceof Float32Array ? built.positions : new Float32Array(built.positions);
      var normals = built.normals instanceof Float32Array ? built.normals : new Float32Array(built.normals);
      var IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
      var indices = built.indices instanceof IndexArray ? built.indices : new IndexArray(built.indices);
      var bounds = minMax(positions);
      var positionAccessor = addAccessor(positions, "VEC3", 5126, 34962, bounds.min, bounds.max);
      var normalAccessor = addAccessor(normals, "VEC3", 5126, 34962);
      var indexAccessor = addAccessor(indices, "SCALAR", IndexArray === Uint32Array ? 5125 : 5123, 34963);
      var index = meshes.length;
      meshes.push({
        name: key,
        primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material: materialIndex[node.material_id], mode: 4 }],
        extras: { axm_primitive: primitive.type, detail: primitive.detail }
      });
      meshIndex[key] = index;
      meshMeasures[key] = { triangles: indices.length / 3, vertices: positions.length / 3 };
      triangles += indices.length / 3;
      uniqueTriangles += indices.length / 3;
      vertices += positions.length / 3;
      return index;
    }

    var nodeIndex = {};
    scene.nodes.forEach(function (node, index) { nodeIndex[node.id] = index; });
    var nodes = scene.nodes.map(function (node) {
      var mesh = resolveMesh(node);
      var result = {
        name: node.id,
        translation: node.translation.map(Number),
        rotation: node.rotation.map(Number),
        scale: node.scale.map(Number),
        extras: { axm_node_id: node.id, component_id: node.component_id, identity_id: scene.identity_id }
      };
      if (mesh !== undefined) result.mesh = mesh;
      var children = scene.nodes.filter(function (candidate) { return candidate.parent_id === node.id; }).map(function (child) { return nodeIndex[child.id]; });
      if (children.length) result.children = children;
      return result;
    });
    var roots = scene.nodes.filter(function (node) { return node.parent_id == null; }).map(function (node) { return nodeIndex[node.id]; });

    var animations = scene.animations.map(function (animation) {
      var samplers = [], channels = [];
      animation.channels.forEach(function (channel) {
        var ordered = channel.keys.slice().sort(function (left, right) { return Number(left.time) - Number(right.time); });
        var times = new Float32Array(ordered.map(function (key) { return Number(key.time); }));
        var width = channel.path === "rotation" ? 4 : 3;
        var values = new Float32Array(ordered.reduce(function (all, key) { return all.concat(key.value.map(Number)); }, []));
        var input = addAccessor(times, "SCALAR", 5126, null, [times[0]], [times[times.length - 1]]);
        var output = addAccessor(values, width === 4 ? "VEC4" : "VEC3", 5126, null);
        var samplerIndex = samplers.length;
        samplers.push({ input: input, output: output, interpolation: channel.interpolation || "LINEAR" });
        channels.push({ sampler: samplerIndex, target: { node: nodeIndex[channel.node_id], path: channel.path } });
      });
      return { name: animation.name, samplers: samplers, channels: channels, extras: { axm_animation_id: animation.id, loop: animation.loop !== false } };
    });

    var binary = concat(chunks);
    var usesUnlit = scene.materials.some(function (material) { return material.unlit; });
    var usesEmissiveStrength = scene.materials.some(function (material) { return material.emissive_colour && Number(material.emissive_strength) > 0; });
    var json = {
      asset: { version: "2.0", generator: "AXM Pixel 3D Codec " + VERSION },
      scene: 0,
      scenes: [{ name: scene.id, nodes: roots }],
      nodes: nodes,
      meshes: meshes,
      materials: materials,
      animations: animations,
      buffers: [{ byteLength: binary.length }],
      bufferViews: bufferViews,
      accessors: accessors,
      extras: {
        axm: {
          schema: scene.schema,
          recipe_id: scene.id,
          identity_id: scene.identity_id,
          representation_profile_id: scene.representation_profile_id,
          animation_state: scene.animation_state,
          footprint: scene.footprint,
          pivots: scene.pivots,
          sockets: scene.sockets,
          game_adapter: scene.game_adapter,
          visual_treatment: scene.visual_treatment || null,
          triangles: triangles,
          unique_triangles: uniqueTriangles,
          vertices: vertices,
          nodes: nodes.length,
          materials: materials.length,
          deterministic: true,
          candidate_only: true
        }
      }
    };
    var usedExtensions = [];
    if (usesUnlit) usedExtensions.push("KHR_materials_unlit");
    if (usesEmissiveStrength) usedExtensions.push("KHR_materials_emissive_strength");
    if (usedExtensions.length) json.extensionsUsed = usedExtensions;

    var jsonBytes = pad(utf8(JSON.stringify(json)), 4, 32), binBytes = pad(binary, 4, 0);
    var total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
    var bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
    le32(view, 0, 0x46546c67);
    le32(view, 4, 2);
    le32(view, 8, total);
    le32(view, 12, jsonBytes.length);
    le32(view, 16, 0x4e4f534a);
    bytes.set(jsonBytes, 20);
    var binHeader = 20 + jsonBytes.length;
    le32(view, binHeader, binBytes.length);
    le32(view, binHeader + 4, 0x004e4942);
    bytes.set(binBytes, binHeader + 8);
    var inspection = inspect(bytes);
    if (!inspection.pass) throw new Error("pixel 3D GLB validation failed: " + inspection.errors.join(", "));
    return {
      mime: "model/gltf-binary",
      format: "GLB",
      bytes: bytes,
      byteLength: bytes.length,
      dataUrl: "data:model/gltf-binary;base64," + base64(bytes),
      json: json,
      triangles: triangles,
      vertices: vertices,
      inspection: inspection
    };
  }

  function inspect(value) {
    var bytes = typeof value === "string" ? bytesFromDataUrl(value) : asBytes(value);
    var base = GlTF.inspect(bytes), errors = base.errors ? base.errors.slice() : [];
    var json = base.json || {}, axm = json.extras && json.extras.axm;
    if (!axm || !axm.identity_id) errors.push("AXM identity extras missing");
    if (!axm || ["pixel-8bit-3d", "pixel-16bit-3d"].indexOf(axm.representation_profile_id) < 0) errors.push("pixel 3D profile extras missing");
    if (!Array.isArray(json.nodes) || !json.nodes.length) errors.push("3D nodes missing");
    if (!Array.isArray(json.animations) || !json.animations.length) errors.push("node animation missing");
    (json.animations || []).forEach(function (animation, animationIndex) {
      if (!Array.isArray(animation.channels) || !animation.channels.length) errors.push("animation " + animationIndex + " channels missing");
      (animation.channels || []).forEach(function (channel, channelIndex) {
        var sampler = animation.samplers && animation.samplers[channel.sampler];
        var target = channel.target || {};
        var input = sampler && json.accessors && json.accessors[sampler.input];
        var output = sampler && json.accessors && json.accessors[sampler.output];
        if (!sampler || !input || !output || input.count !== output.count) errors.push("animation " + animationIndex + " channel " + channelIndex + " accessor mismatch");
        if (!json.nodes[target.node] || ["translation", "rotation", "scale"].indexOf(target.path) < 0) errors.push("animation " + animationIndex + " channel " + channelIndex + " target invalid");
        if (target.path === "rotation" && output && output.type !== "VEC4") errors.push("rotation animation requires VEC4 output");
      });
    });
    var colours = new Set((json.materials || []).map(function (material) { return JSON.stringify(material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorFactor); }));
    return {
      pass: errors.length === 0,
      errors: errors,
      version: base.version,
      length: base.length,
      binaryLength: base.binaryLength,
      json: json,
      identity_id: axm && axm.identity_id,
      representation_profile_id: axm && axm.representation_profile_id,
      triangles: axm && axm.triangles,
      vertices: axm && axm.vertices,
      nodes: json.nodes ? json.nodes.length : 0,
      meshes: json.meshes ? json.meshes.length : 0,
      materials: json.materials ? json.materials.length : 0,
      palette_colours: colours.size,
      animations: json.animations ? json.animations.length : 0,
      animation_names: (json.animations || []).map(function (animation) { return animation.name; })
    };
  }

  return { VERSION: VERSION, pack: pack, inspect: inspect, bytesFromDataUrl: bytesFromDataUrl };
});
