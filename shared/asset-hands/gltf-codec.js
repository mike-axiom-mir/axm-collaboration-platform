(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMGlTFCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.0.0";
  function concat(parts) {
    var length = parts.reduce(function (sum, part) {
        return sum + part.length;
      }, 0),
      out = new Uint8Array(length),
      offset = 0;
    parts.forEach(function (part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }
  function base64(bytes) {
    if (typeof Buffer !== "undefined")
      return Buffer.from(bytes).toString("base64");
    var binary = "",
      step = 32768;
    for (var i = 0; i < bytes.length; i += step)
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(bytes.length, i + step)),
      );
    return btoa(binary);
  }
  function utf8(text) {
    if (typeof TextEncoder !== "undefined")
      return new TextEncoder().encode(text);
    if (typeof Buffer !== "undefined")
      return new Uint8Array(Buffer.from(text, "utf8"));
    var encoded = unescape(encodeURIComponent(text)),
      out = new Uint8Array(encoded.length);
    for (var i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
    return out;
  }
  function pad(bytes, multiple, value) {
    var length = Math.ceil(bytes.length / multiple) * multiple,
      out = new Uint8Array(length);
    out.fill(value || 0);
    out.set(bytes);
    return out;
  }
  function le32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }
  function normal(a, b, c) {
    var ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2],
      x = uy * vz - uz * vy,
      y = uz * vx - ux * vz,
      z = ux * vy - uy * vx,
      length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }
  function hexColour(value, opacity) {
    var alpha = Math.max(
      0,
      Math.min(1, Number(opacity) == null ? 1 : Number(opacity)),
    );
    if (!Number.isFinite(alpha)) alpha = 1;
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    if (!match) return [0.35, 0.72, 0.78, alpha];
    var n = parseInt(match[1], 16);
    return [
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255,
      alpha,
    ];
  }
  function fromProject(project, Geometry, options) {
    if (!project || !Array.isArray(project.objects) || !Geometry)
      throw new Error("Spatial project and geometry engine required");
    options = options || {};
    var positions = [],
      normals = [],
      indices = [],
      triangles = 0;
    project.objects
      .filter(function (object) {
        return object.visible !== false;
      })
      .forEach(function (object) {
        var mesh = Geometry.build(
          object.type,
          object.geometry.detail,
          object.geometry,
        );
        for (var i = 0; i < mesh.indices.length; i += 3) {
          var aIndex = mesh.indices[i] * 3,
            bIndex = mesh.indices[i + 1] * 3,
            cIndex = mesh.indices[i + 2] * 3,
            a = Geometry.transformPoint(
              [
                mesh.positions[aIndex],
                mesh.positions[aIndex + 1],
                mesh.positions[aIndex + 2],
              ],
              object,
            ),
            b = Geometry.transformPoint(
              [
                mesh.positions[bIndex],
                mesh.positions[bIndex + 1],
                mesh.positions[bIndex + 2],
              ],
              object,
            ),
            c = Geometry.transformPoint(
              [
                mesh.positions[cIndex],
                mesh.positions[cIndex + 1],
                mesh.positions[cIndex + 2],
              ],
              object,
            ),
            n = normal(a, b, c),
            base = positions.length / 3;
          positions.push.apply(positions, a.concat(b, c));
          normals.push.apply(normals, n.concat(n, n));
          indices.push(base, base + 1, base + 2);
          triangles++;
        }
      });
    if (!triangles)
      throw new Error("GLB requires visible triangulated geometry");
    var positionArray = new Float32Array(positions),
      normalArray = new Float32Array(normals),
      IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array,
      indexArray = new IndexArray(indices),
      positionBytes = new Uint8Array(positionArray.buffer),
      normalBytes = new Uint8Array(normalArray.buffer),
      indexBytes = new Uint8Array(indexArray.buffer),
      positionOffset = 0,
      normalOffset = pad(positionBytes, 4).length,
      indexOffset = normalOffset + pad(normalBytes, 4).length,
      binary = concat([
        pad(positionBytes, 4),
        pad(normalBytes, 4),
        pad(indexBytes, 4),
      ]),
      mins = [Infinity, Infinity, Infinity],
      maxs = [-Infinity, -Infinity, -Infinity];
    for (var p = 0; p < positions.length; p += 3)
      for (var d = 0; d < 3; d++) {
        mins[d] = Math.min(mins[d], positions[p + d]);
        maxs[d] = Math.max(maxs[d], positions[p + d]);
      }
    var material = (project.materials && project.materials[0]) || {},
      roughness = material.roughness == null ? 0.6 : Number(material.roughness),
      json = {
        asset: { version: "2.0", generator: "AXM glTF Codec " + VERSION },
        scene: 0,
        scenes: [{ name: project.name || "AXM Scene", nodes: [0] }],
        nodes: [{ name: project.name || "AXM Mesh", mesh: 0 }],
        meshes: [
          {
            name: project.name || "AXM Mesh",
            primitives: [
              {
                attributes: { POSITION: 0, NORMAL: 1 },
                indices: 2,
                material: 0,
                mode: 4,
              },
            ],
          },
        ],
        materials: [
          {
            name: material.name || "AXM PBR Material",
            pbrMetallicRoughness: {
              baseColorFactor: hexColour(material.baseColor, material.opacity),
              metallicFactor: Math.max(
                0,
                Math.min(1, Number(material.metallic) || 0),
              ),
              roughnessFactor: Math.max(0, Math.min(1, roughness)),
            },
            doubleSided: material.doubleSided === true,
            alphaMode: Number(material.opacity) < 1 ? "BLEND" : "OPAQUE",
          },
        ],
        buffers: [{ byteLength: binary.length }],
        bufferViews: [
          {
            buffer: 0,
            byteOffset: positionOffset,
            byteLength: positionBytes.length,
            target: 34962,
          },
          {
            buffer: 0,
            byteOffset: normalOffset,
            byteLength: normalBytes.length,
            target: 34962,
          },
          {
            buffer: 0,
            byteOffset: indexOffset,
            byteLength: indexBytes.length,
            target: 34963,
          },
        ],
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: positionArray.length / 3,
            type: "VEC3",
            min: mins,
            max: maxs,
          },
          {
            bufferView: 1,
            componentType: 5126,
            count: normalArray.length / 3,
            type: "VEC3",
          },
          {
            bufferView: 2,
            componentType: indexArray.BYTES_PER_ELEMENT === 4 ? 5125 : 5123,
            count: indexArray.length,
            type: "SCALAR",
          },
        ],
        extras: {
          axm: {
            source_schema: project.format || "axm.spatial.project/v1",
            source_id: project.id || "",
            triangles: triangles,
            known_losses: [
              "authoring hierarchy, lights, rigs, animation and procedural recipes are not encoded",
            ],
          },
        },
      };
    var jsonBytes = pad(utf8(JSON.stringify(json)), 4, 32),
      binBytes = pad(binary, 4, 0),
      total = 12 + 8 + jsonBytes.length + 8 + binBytes.length,
      bytes = new Uint8Array(total),
      view = new DataView(bytes.buffer);
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
    if (!inspection.pass)
      throw new Error(
        "GLB structural validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "model/gltf-binary",
      format: "GLB",
      byteLength: bytes.length,
      triangles: triangles,
      dataUrl: "data:model/gltf-binary;base64," + base64(bytes),
      bytes: bytes,
      json: json,
      inspection: inspection,
    };
  }
  function inspect(bytes) {
    var errors = [],
      json = null,
      binaryLength = 0;
    if (!(bytes instanceof Uint8Array) || bytes.length < 28)
      return { pass: false, errors: ["GLB too small"] };
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      magic = view.getUint32(0, true),
      version = view.getUint32(4, true),
      length = view.getUint32(8, true),
      jsonLength = view.getUint32(12, true),
      jsonType = view.getUint32(16, true);
    if (magic !== 0x46546c67) errors.push("GLB magic mismatch");
    if (version !== 2) errors.push("glTF version must be 2");
    if (length !== bytes.length) errors.push("GLB length mismatch");
    if (jsonType !== 0x4e4f534a) errors.push("JSON chunk missing");
    if (jsonLength % 4 !== 0 || 20 + jsonLength + 8 > bytes.length)
      errors.push("GLB JSON chunk bounds invalid");
    try {
      var raw = bytes.subarray(20, 20 + jsonLength),
        text =
          typeof TextDecoder !== "undefined"
            ? new TextDecoder().decode(raw)
            : Buffer.from(raw).toString("utf8");
      json = JSON.parse(text.trim());
      if (!json.asset || json.asset.version !== "2.0")
        errors.push("glTF asset version missing");
      if (!json.meshes || !json.accessors || !json.bufferViews)
        errors.push("glTF mesh structures missing");
      var binHeader = 20 + jsonLength,
        binLength = view.getUint32(binHeader, true),
        binType = view.getUint32(binHeader + 4, true),
        binStart = binHeader + 8;
      binaryLength = binLength;
      if (binType !== 0x004e4942) errors.push("GLB BIN chunk missing");
      if (binLength % 4 !== 0 || binStart + binLength !== bytes.length)
        errors.push("GLB BIN chunk bounds invalid");
      if (!Array.isArray(json.buffers) || json.buffers.length !== 1)
        errors.push("one embedded glTF buffer is required");
      else if (!(json.buffers[0].byteLength >= 0) || json.buffers[0].byteLength > binLength)
        errors.push("glTF buffer byteLength exceeds BIN chunk");
      var componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 },
        typeComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
      (json.bufferViews || []).forEach(function (bufferView, index) {
        var offset = Number(bufferView.byteOffset) || 0,
          size = Number(bufferView.byteLength);
        if (bufferView.buffer !== 0 || !Number.isInteger(size) || size < 0 || offset < 0 || offset + size > binLength)
          errors.push("bufferView " + index + " exceeds embedded buffer");
        if (bufferView.byteStride != null && (!(bufferView.byteStride >= 4) || bufferView.byteStride > 252 || bufferView.byteStride % 4))
          errors.push("bufferView " + index + " byteStride invalid");
      });
      (json.accessors || []).forEach(function (accessor, index) {
        var bufferView = json.bufferViews && json.bufferViews[accessor.bufferView],
          componentSize = componentBytes[accessor.componentType],
          components = typeComponents[accessor.type],
          count = Number(accessor.count),
          accessorOffset = Number(accessor.byteOffset) || 0;
        if (!bufferView || !componentSize || !components || !Number.isInteger(count) || count < 0) {
          errors.push("accessor " + index + " declaration invalid");
          return;
        }
        var elementSize = componentSize * components,
          stride = Number(bufferView.byteStride) || elementSize,
          required = count ? accessorOffset + stride * (count - 1) + elementSize : accessorOffset;
        if (accessorOffset < 0 || accessorOffset % componentSize || required > bufferView.byteLength)
          errors.push("accessor " + index + " exceeds its bufferView");
      });
      (json.meshes || []).forEach(function (mesh, meshIndex) {
        if (!Array.isArray(mesh.primitives) || !mesh.primitives.length) errors.push("mesh " + meshIndex + " requires primitives");
        (mesh.primitives || []).forEach(function (primitive, primitiveIndex) {
          var positionIndex = primitive.attributes && primitive.attributes.POSITION,
            indexAccessor = json.accessors && json.accessors[primitive.indices],
            positionAccessor = json.accessors && json.accessors[positionIndex];
          if (!positionAccessor || positionAccessor.type !== "VEC3" || positionAccessor.componentType !== 5126)
            errors.push("mesh " + meshIndex + " primitive " + primitiveIndex + " POSITION accessor invalid");
          if (!indexAccessor || indexAccessor.type !== "SCALAR" || [5121, 5123, 5125].indexOf(indexAccessor.componentType) < 0)
            errors.push("mesh " + meshIndex + " primitive " + primitiveIndex + " index accessor invalid");
          if (indexAccessor && positionAccessor) {
            var indexView = json.bufferViews[indexAccessor.bufferView],
              componentSize = componentBytes[indexAccessor.componentType],
              start = binStart + (Number(indexView.byteOffset) || 0) + (Number(indexAccessor.byteOffset) || 0),
              stride = Number(indexView.byteStride) || componentSize,
              dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
              maximum = -1;
            for (var item = 0; item < indexAccessor.count && start + item * stride + componentSize <= bytes.length; item += 1) {
              var at = start + item * stride,
                value = componentSize === 1 ? dataView.getUint8(at) : componentSize === 2 ? dataView.getUint16(at, true) : dataView.getUint32(at, true);
              maximum = Math.max(maximum, value);
            }
            if (maximum >= positionAccessor.count) errors.push("mesh " + meshIndex + " indices exceed POSITION count");
          }
        });
      });
      (json.materials || []).forEach(function (material, index) {
        var factor = material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorFactor;
        if (factor && (factor.length !== 4 || factor.some(function (value) { return !Number.isFinite(value) || value < 0 || value > 1; }))) errors.push("material " + index + " baseColorFactor invalid");
        if (["OPAQUE", "MASK", "BLEND"].indexOf(material.alphaMode || "OPAQUE") < 0) errors.push("material " + index + " alphaMode invalid");
      });
    } catch (error) {
      errors.push("GLB parse failed: " + String(error.message || error));
    }
    return {
      pass: !errors.length,
      errors: errors,
      version: version,
      length: length,
      binaryLength: binaryLength,
      json: json,
    };
  }
  return { VERSION: VERSION, fromProject: fromProject, inspect: inspect };
});
