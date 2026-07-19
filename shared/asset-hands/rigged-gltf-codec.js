(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./gltf-codec")
      : root.AXMGlTFCodec,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMRiggedGlTFCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (GlTF) {
  "use strict";
  if (!GlTF) throw new Error("AXM glTF codec is required");
  var VERSION = "1.0.0";
  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value))
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error("GLB bytes must be a typed array");
  }
  function concat(parts) {
    var length = parts.reduce(function (sum, item) {
        return sum + item.length;
      }, 0),
      out = new Uint8Array(length),
      offset = 0;
    parts.forEach(function (item) {
      out.set(item, offset);
      offset += item.length;
    });
    return out;
  }
  function pad(value, multiple, fill) {
    value = asBytes(value);
    var length = Math.ceil(value.length / multiple) * multiple,
      out = new Uint8Array(length);
    out.fill(fill || 0);
    out.set(value);
    return out;
  }
  function utf8(value) {
    return new TextEncoder().encode(String(value));
  }
  function base64(value) {
    value = asBytes(value);
    if (typeof Buffer !== "undefined")
      return Buffer.from(value).toString("base64");
    var text = "",
      step = 32768;
    for (var i = 0; i < value.length; i += step)
      text += String.fromCharCode.apply(
        null,
        value.subarray(i, Math.min(value.length, i + step)),
      );
    return btoa(text);
  }
  function dataUrl(mime, value) {
    return "data:" + mime + ";base64," + base64(value);
  }
  function bytesFromDataUrl(value) {
    var match = /^data:model\/gltf-binary;base64,([a-z0-9+/=]+)$/i.exec(
      String(value || ""),
    );
    if (!match)
      throw new Error(
        "GLB source requires a model/gltf-binary base64 data URL",
      );
    if (typeof Buffer !== "undefined")
      return new Uint8Array(Buffer.from(match[1], "base64"));
    var raw = atob(match[1]),
      out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }
  function quatZ(angle) {
    return [
      0,
      0,
      Number(Math.sin(angle / 2).toFixed(7)),
      Number(Math.cos(angle / 2).toFixed(7)),
    ];
  }
  function makeClip(options) {
    options = options || {};
    var fps = Math.max(1, Math.min(60, Number(options.fps) || 24)),
      maxFrames = Math.max(
        2,
        Math.min(240, Math.floor(Number(options.maxFrames) || 48)),
      ),
      duration = Math.max(1 / fps, Math.min(10, Number(options.duration) || 2)),
      desired = Math.max(2, Math.round(duration * fps) + 1),
      count = Math.min(maxFrames, desired),
      actualDuration = (count - 1) / fps,
      frames = [];
    for (var index = 0; index < count; index += 1) {
      var phase = count === 1 ? 0 : index / (count - 1),
        spine = Math.sin(phase * Math.PI * 2) * 0.28,
        head = Math.sin(phase * Math.PI * 4) * 0.16;
      frames.push({
        time: Number((index / fps).toFixed(7)),
        spine_rotation: quatZ(spine),
        head_rotation: quatZ(head),
      });
    }
    return {
      schema: "animation/clip+json",
      version: "1.0.0",
      id: String(options.id || "bounded-rig-clip"),
      name: String(options.name || "Bounded rig idle"),
      fps: fps,
      duration_seconds: Number(actualDuration.toFixed(7)),
      skeleton: {
        root: "root",
        joints: [
          { id: "root", parent: null, translation: [0, -0.5, 0] },
          { id: "spine", parent: "root", translation: [0, 0.5, 0] },
          { id: "head", parent: "spine", translation: [0, 0.5, 0] },
        ],
      },
      frames: frames,
      loop: true,
      provenance: options.provenance || null,
    };
  }
  function normalizedClip(input, options) {
    input = input || {};
    options = options || {};
    if (
      input.schema !== "animation/clip+json" ||
      !Array.isArray(input.frames) ||
      input.frames.length < 2
    )
      throw new Error(
        "rig edit requires animation/clip+json with at least two frames",
      );
    var fps = Math.max(
        1,
        Math.min(60, Number(options.fps) || Number(input.fps) || 24),
      ),
      maxFrames = Math.max(
        2,
        Math.min(
          240,
          Math.floor(Number(options.maxFrames) || input.frames.length),
        ),
      ),
      chosen = [];
    for (
      var index = 0;
      index < Math.min(maxFrames, input.frames.length);
      index += 1
    ) {
      var sourceIndex = Math.round(
          (index * (input.frames.length - 1)) /
            (Math.min(maxFrames, input.frames.length) - 1),
        ),
        frame = input.frames[sourceIndex] || {},
        spine = Array.isArray(frame.spine_rotation)
          ? frame.spine_rotation
          : [0, 0, 0, 1],
        head = Array.isArray(frame.head_rotation)
          ? frame.head_rotation
          : [0, 0, 0, 1];
      [spine, head].forEach(function (q) {
        if (
          q.length !== 4 ||
          q.some(function (v) {
            return !Number.isFinite(Number(v));
          })
        )
          throw new Error("clip rotation must be a finite quaternion");
        var length = Math.hypot.apply(Math, q);
        if (length < 0.000001)
          throw new Error("clip quaternion length is zero");
        for (var qIndex = 0; qIndex < 4; qIndex += 1)
          q[qIndex] = Number((q[qIndex] / length).toFixed(7));
      });
      chosen.push({
        time: Number((index / fps).toFixed(7)),
        spine_rotation: spine.map(Number),
        head_rotation: head.map(Number),
      });
    }
    return {
      schema: "animation/clip+json",
      version: "1.0.0",
      id: String(input.id || options.id || "edited-rig-clip"),
      name: String(options.name || input.name || "Edited rig clip"),
      fps: fps,
      duration_seconds: Number(((chosen.length - 1) / fps).toFixed(7)),
      skeleton: {
        root: "root",
        joints: [
          { id: "root", parent: null, translation: [0, -0.5, 0] },
          { id: "spine", parent: "root", translation: [0, 0.5, 0] },
          { id: "head", parent: "spine", translation: [0, 0.5, 0] },
        ],
      },
      frames: chosen,
      loop: input.loop !== false,
      provenance: options.provenance || input.provenance || null,
    };
  }
  function arrays(height, radial, segments, requestedRadius) {
    var positions = [],
      normals = [],
      joints = [],
      weights = [],
      indices = [],
      radius = Math.max(0.02, Math.min(height, Number(requestedRadius) || height * 0.18));
    for (var row = 0; row <= segments; row += 1) {
      var t = row / segments,
        y = -height / 2 + t * height;
      for (var side = 0; side < radial; side += 1) {
        var angle = (side / radial) * Math.PI * 2,
          x = Math.cos(angle) * radius,
          z = Math.sin(angle) * radius;
        positions.push(x, y, z);
        normals.push(Math.cos(angle), 0, Math.sin(angle));
        if (t <= 0.5) {
          var spine = t * 2;
          joints.push(0, 1, 0, 0);
          weights.push(1 - spine, spine, 0, 0);
        } else {
          var head = (t - 0.5) * 2;
          joints.push(1, 2, 0, 0);
          weights.push(1 - head, head, 0, 0);
        }
      }
    }
    for (var rowIndex = 0; rowIndex < segments; rowIndex += 1)
      for (var sideIndex = 0; sideIndex < radial; sideIndex += 1) {
        var next = (sideIndex + 1) % radial,
          a = rowIndex * radial + sideIndex,
          b = rowIndex * radial + next,
          c = (rowIndex + 1) * radial + sideIndex,
          d = (rowIndex + 1) * radial + next;
        indices.push(a, c, b, b, c, d);
      }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      joints: new Uint16Array(joints),
      weights: new Float32Array(weights),
      indices: new Uint16Array(indices),
      triangles: indices.length / 3,
      vertices: positions.length / 3,
    };
  }
  function pack(clip, options) {
    options = options || {};
    var height = Math.max(0.2, Math.min(20, Number(options.height) || 2)),
      radius = Math.max(0.02, Math.min(height, Number(options.radius) || height * 0.18)),
      budget = Math.max(
        16,
        Math.min(50000, Math.floor(Number(options.maxTriangles) || 2048)),
      ),
      vertexBudget = Math.max(
        16,
        Math.min(50000, Math.floor(Number(options.maxVertices) || 4096)),
      ),
      radial = 16,
      segments = 12,
      mesh = arrays(height, radial, segments, radius);
    while (
      (mesh.triangles > budget || mesh.vertices > vertexBudget) &&
      (radial > 3 || segments > 2)
    ) {
      if (radial >= segments && radial > 3) radial -= 1;
      else if (segments > 2) segments -= 1;
      mesh = arrays(height, radial, segments, radius);
    }
    if (mesh.triangles > budget || mesh.vertices > vertexBudget)
      throw new Error(
        "polygon or vertex budget cannot hold the minimum skinned mesh",
      );
    var inverse = new Float32Array(48);
    for (var m = 0; m < 3; m += 1) {
      inverse[m * 16] = 1;
      inverse[m * 16 + 5] = 1;
      inverse[m * 16 + 10] = 1;
      inverse[m * 16 + 15] = 1;
    }
    inverse[13] = height / 2;
    inverse[32 + 13] = -height / 2;
    var times = new Float32Array(
        clip.frames.map(function (frame) {
          return frame.time;
        }),
      ),
      spine = new Float32Array(
        clip.frames.reduce(function (all, frame) {
          return all.concat(frame.spine_rotation);
        }, []),
      ),
      head = new Float32Array(
        clip.frames.reduce(function (all, frame) {
          return all.concat(frame.head_rotation);
        }, []),
      ),
      chunks = [],
      views = [],
      accessors = [];
    function view(array, target) {
      var value = pad(
          new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
          4,
        ),
        offset = chunks.reduce(function (sum, item) {
          return sum + item.length;
        }, 0),
        index = views.length;
      chunks.push(value);
      views.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: array.byteLength,
      });
      if (target) views[index].target = target;
      return index;
    }
    function accessor(array, type, componentType, target, min, max) {
      var v = view(array, target),
        count =
          array.length /
          { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type],
        a = {
          bufferView: v,
          componentType: componentType,
          count: count,
          type: type,
        };
      if (min) a.min = min;
      if (max) a.max = max;
      accessors.push(a);
      return accessors.length - 1;
    }
    var posMin = [Infinity, Infinity, Infinity],
      posMax = [-Infinity, -Infinity, -Infinity];
    for (var p = 0; p < mesh.positions.length; p += 3)
      for (var dim = 0; dim < 3; dim += 1) {
        posMin[dim] = Math.min(posMin[dim], mesh.positions[p + dim]);
        posMax[dim] = Math.max(posMax[dim], mesh.positions[p + dim]);
      }
    var posAccessor = accessor(
        mesh.positions,
        "VEC3",
        5126,
        34962,
        posMin,
        posMax,
      ),
      normalAccessor = accessor(mesh.normals, "VEC3", 5126, 34962),
      jointAccessor = accessor(mesh.joints, "VEC4", 5123, 34962),
      weightAccessor = accessor(mesh.weights, "VEC4", 5126, 34962),
      indexAccessor = accessor(mesh.indices, "SCALAR", 5123, 34963),
      inverseAccessor = accessor(inverse, "MAT4", 5126),
      timeAccessor = accessor(
        times,
        "SCALAR",
        5126,
        null,
        [times[0]],
        [times[times.length - 1]],
      ),
      spineAccessor = accessor(spine, "VEC4", 5126),
      headAccessor = accessor(head, "VEC4", 5126),
      binary = concat(chunks),
      json = {
        asset: {
          version: "2.0",
          generator: "AXM Rigged glTF Codec " + VERSION,
        },
        scene: 0,
        scenes: [{ name: String(options.name || clip.name), nodes: [0, 1] }],
        nodes: [
          { name: "CharacterMesh", mesh: 0, skin: 0 },
          { name: "root", children: [2], translation: [0, -height / 2, 0] },
          { name: "spine", children: [3], translation: [0, height / 2, 0] },
          { name: "head", translation: [0, height / 2, 0] },
        ],
        meshes: [
          {
            name: "SkinnedCharacter",
            primitives: [
              {
                attributes: {
                  POSITION: posAccessor,
                  NORMAL: normalAccessor,
                  JOINTS_0: jointAccessor,
                  WEIGHTS_0: weightAccessor,
                },
                indices: indexAccessor,
                material: 0,
                mode: 4,
              },
            ],
          },
        ],
        materials: [
          {
            name: "CharacterMaterial",
            pbrMetallicRoughness: {
              baseColorFactor: options.baseColor || [0.25, 0.72, 0.68, 1],
              metallicFactor: 0.05,
              roughnessFactor: 0.62,
            },
            doubleSided: false,
            alphaMode: "OPAQUE",
          },
        ],
        skins: [
          {
            name: "CharacterSkin",
            inverseBindMatrices: inverseAccessor,
            skeleton: 1,
            joints: [1, 2, 3],
          },
        ],
        animations: [
          {
            name: clip.name,
            samplers: [
              {
                input: timeAccessor,
                output: spineAccessor,
                interpolation: "LINEAR",
              },
              {
                input: timeAccessor,
                output: headAccessor,
                interpolation: "LINEAR",
              },
            ],
            channels: [
              { sampler: 0, target: { node: 2, path: "rotation" } },
              { sampler: 1, target: { node: 3, path: "rotation" } },
            ],
          },
        ],
        buffers: [{ byteLength: binary.length }],
        bufferViews: views,
        accessors: accessors,
        extras: {
          axm: {
            source_schema: "animation/clip+json",
            source_id: clip.id,
            triangles: mesh.triangles,
            vertices: mesh.vertices,
            joints: 3,
            frames: clip.frames.length,
            fps: clip.fps,
            duration_seconds: clip.duration_seconds,
            up_axis: "y",
            handedness: "right",
          },
        },
      },
      jsonBytes = pad(utf8(JSON.stringify(json)), 4, 32),
      binBytes = pad(binary, 4, 0),
      total = 12 + 8 + jsonBytes.length + 8 + binBytes.length,
      output = new Uint8Array(total),
      data = new DataView(output.buffer);
    data.setUint32(0, 0x46546c67, true);
    data.setUint32(4, 2, true);
    data.setUint32(8, total, true);
    data.setUint32(12, jsonBytes.length, true);
    data.setUint32(16, 0x4e4f534a, true);
    output.set(jsonBytes, 20);
    var binHeader = 20 + jsonBytes.length;
    data.setUint32(binHeader, binBytes.length, true);
    data.setUint32(binHeader + 4, 0x004e4942, true);
    output.set(binBytes, binHeader + 8);
    var inspection = inspect(output);
    if (!inspection.pass)
      throw new Error(
        "rigged GLB validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "model/gltf-binary",
      format: "GLB",
      bytes: output,
      byteLength: output.length,
      dataUrl: dataUrl("model/gltf-binary", output),
      json: json,
      clip: clip,
      triangles: mesh.triangles,
      vertices: mesh.vertices,
      inspection: inspection,
    };
  }
  function parse(value) {
    var bytes = asBytes(value),
      base = GlTF.inspect(bytes),
      json = base.json,
      view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      jsonLength = bytes.length >= 20 ? view.getUint32(12, true) : 0,
      binStart = 20 + jsonLength + 8;
    return { bytes: bytes, base: base, json: json, binStart: binStart };
  }
  function accessorData(parsed, index) {
    var json = parsed.json,
      accessor = json.accessors[index],
      bufferView = json.bufferViews[accessor.bufferView],
      components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[
        accessor.type
      ],
      bytesPer = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType],
      start =
        parsed.binStart +
        (bufferView.byteOffset || 0) +
        (accessor.byteOffset || 0),
      stride = bufferView.byteStride || components * bytesPer,
      out = [];
    for (var item = 0; item < accessor.count; item += 1) {
      var values = [];
      for (var component = 0; component < components; component += 1) {
        var at = start + item * stride + component * bytesPer,
          v;
        if (accessor.componentType === 5121) v = parsed.bytes[at];
        else if (accessor.componentType === 5123)
          v = new DataView(
            parsed.bytes.buffer,
            parsed.bytes.byteOffset + at,
            2,
          ).getUint16(0, true);
        else if (accessor.componentType === 5125)
          v = new DataView(
            parsed.bytes.buffer,
            parsed.bytes.byteOffset + at,
            4,
          ).getUint32(0, true);
        else
          v = new DataView(
            parsed.bytes.buffer,
            parsed.bytes.byteOffset + at,
            4,
          ).getFloat32(0, true);
        values.push(v);
      }
      out.push(values);
    }
    return out;
  }
  function multiply(a, b) {
    var out = new Array(16).fill(0);
    for (var col = 0; col < 4; col += 1)
      for (var row = 0; row < 4; row += 1)
        for (var k = 0; k < 4; k += 1)
          out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    return out;
  }
  function matrix(translation, rotation) {
    translation = translation || [0, 0, 0];
    rotation = rotation || [0, 0, 0, 1];
    var x = rotation[0],
      y = rotation[1],
      z = rotation[2],
      w = rotation[3],
      x2 = x + x,
      y2 = y + y,
      z2 = z + z,
      xx = x * x2,
      xy = x * y2,
      xz = x * z2,
      yy = y * y2,
      yz = y * z2,
      zz = z * z2,
      wx = w * x2,
      wy = w * y2,
      wz = w * z2;
    return [
      1 - (yy + zz),
      xy + wz,
      xz - wy,
      0,
      xy - wz,
      1 - (xx + zz),
      yz + wx,
      0,
      xz + wy,
      yz - wx,
      1 - (xx + yy),
      0,
      translation[0],
      translation[1],
      translation[2],
      1,
    ];
  }
  function point(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  }
  function deformation(
    parsed,
    positionAccessor,
    jointAccessor,
    weightAccessor,
    inverseAccessor,
    skin,
    animation,
  ) {
    var positions = accessorData(parsed, positionAccessor),
      joints = accessorData(parsed, jointAccessor),
      weights = accessorData(parsed, weightAccessor),
      inverse = accessorData(parsed, inverseAccessor),
      times = accessorData(
        parsed,
        parsed.json.accessors[animation.samplers[0].input]
          ? animation.samplers[0].input
          : 0,
      ).map(function (item) {
        return item[0];
      }),
      channelOutputs = {};
    animation.channels.forEach(function (channel) {
      channelOutputs[channel.target.node] = accessorData(
        parsed,
        animation.samplers[channel.sampler].output,
      );
    });
    var sampleIndices = Array.from(
        new Set([
          0,
          Math.floor((times.length - 1) / 4),
          Math.floor((times.length - 1) / 2),
          Math.floor(((times.length - 1) * 3) / 4),
          times.length - 1,
        ]),
      ),
      parents = {};
    parsed.json.nodes.forEach(function (node, index) {
      (node.children || []).forEach(function (child) {
        parents[child] = index;
      });
    });
    function global(nodeIndex, frame, cache) {
      if (cache[nodeIndex]) return cache[nodeIndex];
      var node = parsed.json.nodes[nodeIndex],
        rotation = channelOutputs[nodeIndex]
          ? channelOutputs[nodeIndex][frame]
          : node.rotation,
        local = matrix(node.translation, rotation),
        parent = parents[nodeIndex];
      cache[nodeIndex] =
        parent == null ? local : multiply(global(parent, frame, cache), local);
      return cache[nodeIndex];
    }
    var receipts = [];
    sampleIndices.forEach(function (frame) {
      var cache = {},
        jointMatrices = skin.joints.map(function (nodeIndex, index) {
          return multiply(global(nodeIndex, frame, cache), inverse[index]);
        }),
        mins = [Infinity, Infinity, Infinity],
        maxs = [-Infinity, -Infinity, -Infinity],
        checksum = 0,
        step = Math.max(1, Math.floor(positions.length / 256));
      for (var vertex = 0; vertex < positions.length; vertex += step) {
        var skinned = [0, 0, 0];
        for (var influence = 0; influence < 4; influence += 1) {
          var weight = weights[vertex][influence];
          if (weight) {
            var transformed = point(
              jointMatrices[joints[vertex][influence]],
              positions[vertex],
            );
            for (var dimension = 0; dimension < 3; dimension += 1)
              skinned[dimension] += transformed[dimension] * weight;
          }
        }
        for (var d = 0; d < 3; d += 1) {
          mins[d] = Math.min(mins[d], skinned[d]);
          maxs[d] = Math.max(maxs[d], skinned[d]);
          checksum += skinned[d] * (vertex + 1) * (d + 1);
        }
      }
      receipts.push({
        frame: frame,
        time: times[frame],
        min: mins.map(function (value) {
          return Number(value.toFixed(6));
        }),
        max: maxs.map(function (value) {
          return Number(value.toFixed(6));
        }),
        checksum: Number(checksum.toFixed(6)),
      });
    });
    return {
      pass: receipts.every(function (receipt) {
        return receipt.min.concat(receipt.max).every(Number.isFinite);
      }),
      samples: receipts,
      changed:
        new Set(
          receipts.map(function (receipt) {
            return receipt.checksum;
          }),
        ).size > 1,
    };
  }
  function inspect(value) {
    var parsed = parse(value),
      json = parsed.json,
      errors = (parsed.base.errors || []).slice(),
      skin = json && json.skins && json.skins[0],
      animation = json && json.animations && json.animations[0],
      primitive =
        json &&
        json.meshes &&
        json.meshes[0] &&
        json.meshes[0].primitives &&
        json.meshes[0].primitives[0],
      weights = [],
      joints = [],
      times = [],
      deformed = { pass: false, samples: [], changed: false };
    if (!skin || !Array.isArray(skin.joints) || skin.joints.length < 2)
      errors.push("glTF skin and joints missing");
    if (
      !primitive ||
      primitive.attributes.JOINTS_0 == null ||
      primitive.attributes.WEIGHTS_0 == null
    )
      errors.push("glTF skin attributes missing");
    if (
      !animation ||
      !Array.isArray(animation.channels) ||
      !animation.channels.length
    )
      errors.push("glTF animation channels missing");
    if (skin && primitive && animation) {
      var pos = json.accessors[primitive.attributes.POSITION],
        jointAccessor = json.accessors[primitive.attributes.JOINTS_0],
        weightAccessor = json.accessors[primitive.attributes.WEIGHTS_0],
        inverseAccessor = json.accessors[skin.inverseBindMatrices];
      if (
        !jointAccessor ||
        jointAccessor.type !== "VEC4" ||
        [5121, 5123].indexOf(jointAccessor.componentType) < 0
      )
        errors.push("JOINTS_0 accessor invalid");
      if (
        !weightAccessor ||
        weightAccessor.type !== "VEC4" ||
        weightAccessor.componentType !== 5126
      )
        errors.push("WEIGHTS_0 accessor invalid");
      if (
        !inverseAccessor ||
        inverseAccessor.type !== "MAT4" ||
        inverseAccessor.componentType !== 5126 ||
        inverseAccessor.count !== skin.joints.length
      )
        errors.push("inverse bind matrices invalid");
      if (
        pos &&
        jointAccessor &&
        weightAccessor &&
        (pos.count !== jointAccessor.count ||
          pos.count !== weightAccessor.count)
      )
        errors.push("skin attribute counts differ");
      try {
        weights = accessorData(parsed, primitive.attributes.WEIGHTS_0);
        joints = accessorData(parsed, primitive.attributes.JOINTS_0);
        weights.forEach(function (row, index) {
          var sum = row.reduce(function (total, item) {
            return total + item;
          }, 0);
          if (
            Math.abs(sum - 1) > 0.001 ||
            row.some(function (item) {
              return !Number.isFinite(item) || item < 0 || item > 1;
            })
          )
            errors.push("skin weights invalid at vertex " + index);
        });
        joints.forEach(function (row, index) {
          if (
            row.some(function (item) {
              return (
                !Number.isInteger(item) ||
                item < 0 ||
                item >= skin.joints.length
              );
            })
          )
            errors.push("joint index invalid at vertex " + index);
        });
        var inputIndices = Array.from(
          new Set(
            animation.samplers.map(function (sampler) {
              return sampler.input;
            }),
          ),
        );
        if (inputIndices.length !== 1)
          errors.push(
            "bounded rig requires one shared animation time accessor",
          );
        times = accessorData(parsed, inputIndices[0]).map(function (item) {
          return item[0];
        });
        for (var t = 1; t < times.length; t += 1)
          if (!(times[t] > times[t - 1]))
            errors.push("animation times are not strictly increasing");
        animation.channels.forEach(function (channel, index) {
          var sampler = animation.samplers[channel.sampler],
            output = accessorData(parsed, sampler.output);
          if (channel.target.path !== "rotation")
            errors.push("bounded rig channel " + index + " is not rotation");
          if (output.length !== times.length)
            errors.push("animation output count differs from time count");
          output.forEach(function (q) {
            if (
              q.length !== 4 ||
              Math.abs(Math.hypot.apply(Math, q) - 1) > 0.002
            )
              errors.push("animation quaternion is not normalized");
          });
        });
        deformed = deformation(
          parsed,
          primitive.attributes.POSITION,
          primitive.attributes.JOINTS_0,
          primitive.attributes.WEIGHTS_0,
          skin.inverseBindMatrices,
          skin,
          animation,
        );
        if (!deformed.pass)
          errors.push("CPU skin deformation produced invalid bounds");
        if (!deformed.changed)
          errors.push("animation does not change the skinned mesh");
      } catch (error) {
        errors.push(
          "rig accessor validation failed: " + String(error.message || error),
        );
      }
    }
    return {
      pass: !errors.length,
      errors: errors,
      base: parsed.base,
      skin: skin
        ? {
            joints: skin.joints.length,
            skeleton: skin.skeleton,
            inverseBindMatrices: skin.inverseBindMatrices,
          }
        : null,
      animation: animation
        ? {
            channels: animation.channels.length,
            samplers: animation.samplers.length,
            frames: times.length,
            durationSeconds: times.length ? times[times.length - 1] : 0,
          }
        : null,
      vertices: weights.length,
      triangles:
        primitive && json.accessors[primitive.indices]
          ? json.accessors[primitive.indices].count / 3
          : 0,
      weightSumsPass:
        !!weights.length &&
        !errors.some(function (error) {
          return /weights invalid/.test(error);
        }),
      jointIndicesPass:
        !!joints.length &&
        !errors.some(function (error) {
          return /joint index/.test(error);
        }),
      deformation: deformed,
      json: json,
    };
  }
  return {
    VERSION: VERSION,
    makeClip: makeClip,
    normalizedClip: normalizedClip,
    pack: pack,
    inspect: inspect,
    bytesFromDataUrl: bytesFromDataUrl,
    dataUrl: dataUrl,
  };
});
