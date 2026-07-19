(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMOpenUSDCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.0.0",
    MIME = "model/vnd.usdz+zip";
  var crcTable = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n += 1) {
      var value = n;
      for (var bit = 0; bit < 8; bit += 1)
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[n] = value >>> 0;
    }
    return table;
  })();
  function crc32(data) {
    var crc = 0xffffffff;
    for (var index = 0; index < data.length; index += 1)
      crc = crcTable[(crc ^ data[index]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function utf8(value) {
    if (typeof TextEncoder !== "undefined")
      return new TextEncoder().encode(String(value));
    return new Uint8Array(Buffer.from(String(value), "utf8"));
  }
  function decode(value) {
    if (typeof TextDecoder !== "undefined")
      return new TextDecoder("utf-8", { fatal: true }).decode(value);
    return Buffer.from(value).toString("utf8");
  }
  function concat(parts) {
    var size = parts.reduce(function (sum, part) {
        return sum + part.length;
      }, 0),
      output = new Uint8Array(size),
      offset = 0;
    parts.forEach(function (part) {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }
  function le16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }
  function le32(value) {
    return new Uint8Array([
      value & 255,
      (value >>> 8) & 255,
      (value >>> 16) & 255,
      (value >>> 24) & 255,
    ]);
  }
  function read16(data, offset) {
    return data[offset] | (data[offset + 1] << 8);
  }
  function read32(data, offset) {
    return (
      (data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24)) >>>
      0
    );
  }
  function base64(data) {
    if (typeof Buffer !== "undefined")
      return Buffer.from(data).toString("base64");
    var binary = "";
    for (var offset = 0; offset < data.length; offset += 32768)
      binary += String.fromCharCode.apply(
        null,
        data.subarray(offset, Math.min(data.length, offset + 32768)),
      );
    return btoa(binary);
  }
  function dataUrl(mime, data) {
    return "data:" + mime + ";base64," + base64(data);
  }
  function bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(value))
      return new Uint8Array(value);
    var encoded = String(value || ""),
      comma = encoded.indexOf(","),
      body = comma >= 0 ? encoded.slice(comma + 1) : encoded;
    if (typeof Buffer !== "undefined")
      return new Uint8Array(Buffer.from(body, "base64"));
    var raw = atob(body),
      output = new Uint8Array(raw.length);
    for (var index = 0; index < raw.length; index += 1)
      output[index] = raw.charCodeAt(index);
    return output;
  }
  function safePath(path) {
    path = String(path || "");
    return (
      !!path &&
      path.length <= 180 &&
      path[0] !== "/" &&
      path.indexOf("\\") < 0 &&
      !/(^|\/)\.\.?($|\/)/.test(path) &&
      !/^[a-z]+:/i.test(path)
    );
  }
  function cleanPath(path) {
    var parts = [];
    String(path || "")
      .split("/")
      .forEach(function (part) {
        if (!part || part === ".") return;
        if (part === "..") parts.pop();
        else parts.push(part);
      });
    return parts.join("/");
  }
  function dirname(path) {
    var index = path.lastIndexOf("/");
    return index < 0 ? "" : path.slice(0, index + 1);
  }
  function resolvePath(from, reference) {
    return cleanPath(dirname(from) + String(reference || ""));
  }
  function alignedExtra(offset, nameLength) {
    var base = offset + 30 + nameLength,
      length = (64 - (base % 64)) % 64;
    if (length > 0 && length < 4) length += 64;
    if (!length) return new Uint8Array(0);
    return concat([le16(0x1986), le16(length - 4), new Uint8Array(length - 4)]);
  }
  function packageUsd(files, rootName) {
    rootName = String(rootName || "root.usda");
    if (
      !safePath(rootName) ||
      !files ||
      !Object.prototype.hasOwnProperty.call(files, rootName)
    )
      throw new Error("USDZ root layer is missing or unsafe");
    var names = [rootName].concat(
        Object.keys(files)
          .filter(function (name) {
            return name !== rootName;
          })
          .sort(),
      ),
      local = [],
      central = [],
      offset = 0;
    names.forEach(function (name) {
      if (!safePath(name)) throw new Error("unsafe USDZ path: " + name);
      var nameBytes = utf8(name),
        content =
          typeof files[name] === "string"
            ? utf8(files[name])
            : bytes(files[name]),
        checksum = crc32(content),
        extra = alignedExtra(offset, nameBytes.length),
        dataOffset = offset + 30 + nameBytes.length + extra.length;
      if (dataOffset % 64 !== 0)
        throw new Error("USDZ alignment calculation failed");
      var localHeader = concat([
        le32(0x04034b50),
        le16(20),
        le16(0x0800),
        le16(0),
        le16(0),
        le16(0x21),
        le32(checksum),
        le32(content.length),
        le32(content.length),
        le16(nameBytes.length),
        le16(extra.length),
        nameBytes,
        extra,
      ]);
      var centralHeader = concat([
        le32(0x02014b50),
        le16(20),
        le16(20),
        le16(0x0800),
        le16(0),
        le16(0),
        le16(0x21),
        le32(checksum),
        le32(content.length),
        le32(content.length),
        le16(nameBytes.length),
        le16(0),
        le16(0),
        le16(0),
        le16(0),
        le32(0),
        le32(offset),
        nameBytes,
      ]);
      local.push(localHeader, content);
      central.push(centralHeader);
      offset += localHeader.length + content.length;
    });
    var centralSize = central.reduce(function (sum, value) {
        return sum + value.length;
      }, 0),
      end = concat([
        le32(0x06054b50),
        le16(0),
        le16(0),
        le16(names.length),
        le16(names.length),
        le32(centralSize),
        le32(offset),
        le16(0),
      ]),
      output = concat(local.concat(central, [end])),
      inspection = inspectPackage(output);
    if (!inspection.pass)
      throw new Error(
        "USDZ validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: MIME,
      format: "USDZ",
      bytes: output,
      byteLength: output.length,
      dataUrl: dataUrl(MIME, output),
      inspection: inspection,
    };
  }
  function inspectArchive(value) {
    var data = bytes(value),
      files = {},
      entries = [],
      errors = [],
      offset = 0;
    while (offset + 4 <= data.length && read32(data, offset) === 0x04034b50) {
      if (offset + 30 > data.length) {
        errors.push("ZIP local header truncated");
        break;
      }
      var flags = read16(data, offset + 6),
        method = read16(data, offset + 8),
        checksum = read32(data, offset + 14),
        compressed = read32(data, offset + 18),
        uncompressed = read32(data, offset + 22),
        nameLength = read16(data, offset + 26),
        extraLength = read16(data, offset + 28),
        nameStart = offset + 30,
        dataStart = nameStart + nameLength + extraLength,
        dataEnd = dataStart + compressed;
      if (dataEnd > data.length) {
        errors.push("ZIP entry exceeds archive");
        break;
      }
      var name;
      try {
        name = decode(data.slice(nameStart, nameStart + nameLength));
      } catch (error) {
        name = "";
        errors.push("ZIP filename is not valid UTF-8");
      }
      if (!safePath(name)) errors.push("unsafe USDZ entry path: " + name);
      if (method !== 0)
        errors.push(name + " must be stored without compression");
      if (flags & 1) errors.push(name + " must not be encrypted");
      if ((flags & 0x0800) === 0)
        errors.push(name + " UTF-8 filename flag missing");
      if (compressed !== uncompressed)
        errors.push(name + " compressed and uncompressed sizes differ");
      if (dataStart % 64 !== 0)
        errors.push(name + " file data is not aligned to 64 bytes");
      if (files[name]) errors.push("duplicate USDZ entry: " + name);
      var file = data.slice(dataStart, dataEnd);
      if (crc32(file) !== checksum) errors.push(name + " CRC mismatch");
      files[name] = file;
      entries.push({
        name: name,
        bytes: file.length,
        data_offset: dataStart,
        aligned_64: dataStart % 64 === 0,
      });
      offset = dataEnd;
    }
    var centralOffset = offset,
      end = -1;
    if (read32(data, centralOffset) !== 0x02014b50)
      errors.push("USDZ central directory missing");
    for (
      var cursor = Math.max(0, data.length - 65557);
      cursor + 4 <= data.length;
      cursor += 1
    )
      if (read32(data, cursor) === 0x06054b50) end = cursor;
    if (end < 0) errors.push("USDZ end-of-central-directory missing");
    else {
      if (read16(data, end + 10) !== entries.length)
        errors.push("USDZ central entry count mismatch");
      if (read32(data, end + 16) !== centralOffset)
        errors.push("USDZ central directory offset mismatch");
    }
    return {
      pass: !errors.length,
      errors: errors,
      files: files,
      entries: entries,
      centralOffset: centralOffset,
      bytes: data.length,
    };
  }
  function references(text) {
    var output = [],
      expression = /@([^@]+)@(\s*<[^>]+>)?/g,
      match;
    while ((match = expression.exec(String(text || "")))) output.push(match[1]);
    return output;
  }
  function inspectLayer(text) {
    text = String(text || "");
    var errors = [],
      refs = references(text),
      header = /^#usda\s+1\.0(?:\r?\n|$)/.test(text),
      defaultPrim =
        (/defaultPrim\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"/.exec(text) || [])[1] ||
        null,
      upAxis = (/upAxis\s*=\s*"([XYZ])"/.exec(text) || [])[1] || null,
      meters = Number(
        (/metersPerUnit\s*=\s*([0-9.eE+-]+)/.exec(text) || [])[1],
      ),
      variants = Array.from(
        text.matchAll(/variantSet\s+"([^"]+)"\s*=\s*\{/g),
      ).map(function (match) {
        return match[1];
      }),
      triangle =
        Number((/int\s+axmTriangles\s*=\s*(\d+)/.exec(text) || [])[1]) || 0,
      vertices =
        Number((/int\s+axmVertices\s*=\s*(\d+)/.exec(text) || [])[1]) || 0;
    if (!header) errors.push("USDA 1.0 header missing");
    if (text.indexOf("\u0000") >= 0) errors.push("USDA contains NUL bytes");
    refs.forEach(function (path) {
      if (!safePath(path))
        errors.push("unsafe composition asset path: " + path);
    });
    if (/\b(?:https?|file):/i.test(text))
      errors.push("external URL or file URI is forbidden");
    return {
      pass: !errors.length,
      errors: errors,
      format: "USDA 1.0",
      defaultPrim: defaultPrim,
      upAxis: upAxis,
      metersPerUnit: Number.isFinite(meters) ? meters : null,
      references: refs,
      variantSets: variants,
      triangles: triangle,
      vertices: vertices,
    };
  }
  function inspectPackage(value) {
    var archive = inspectArchive(value),
      errors = archive.errors.slice(),
      names = archive.entries.map(function (entry) {
        return entry.name;
      }),
      root = names[0] || "",
      layers = {},
      refs = [],
      missing = [],
      totalTriangles = 0,
      totalVertices = 0;
    if (!root || !/\.usd[ac]?$/i.test(root))
      errors.push("first USDZ entry must be a USD root layer");
    names
      .filter(function (name) {
        return /\.usda$/i.test(name);
      })
      .forEach(function (name) {
        var text;
        try {
          text = decode(archive.files[name]);
        } catch (error) {
          errors.push(name + " is not valid UTF-8");
          return;
        }
        var inspection = inspectLayer(text);
        layers[name] = inspection;
        if (!inspection.pass)
          errors = errors.concat(
            inspection.errors.map(function (item) {
              return name + ": " + item;
            }),
          );
        totalTriangles += inspection.triangles;
        totalVertices += inspection.vertices;
        inspection.references.forEach(function (reference) {
          var resolved = resolvePath(name, reference);
          refs.push({ layer: name, reference: reference, resolved: resolved });
          if (names.indexOf(resolved) < 0) missing.push(resolved);
        });
      });
    if (!layers[root])
      errors.push(
        "USDZ root layer must use readable USDA in this bounded profile",
      );
    if (missing.length)
      errors.push(
        "unresolved package references: " +
          Array.from(new Set(missing)).join(", "),
      );
    return {
      pass: !errors.length,
      errors: errors,
      mime: MIME,
      format: "USDZ",
      bytes: archive.bytes,
      rootLayer: root || null,
      entries: archive.entries,
      layers: layers,
      references: refs,
      missingReferences: Array.from(new Set(missing)),
      layerCount: Object.keys(layers).length,
      allDataAligned64: archive.entries.every(function (entry) {
        return entry.aligned_64;
      }),
      storedOnly: archive.errors.every(function (error) {
        return error.indexOf("stored without compression") < 0;
      }),
      packagedTriangles: totalTriangles,
      packagedVertices: totalVertices,
    };
  }
  function points(values) {
    return values
      .map(function (point) {
        return "(" + point.join(", ") + ")";
      })
      .join(", ");
  }
  function assetLayer(name, shape, colour) {
    var shapes = {
        cube: {
          points: [
            [-0.5, -0.5, -0.5],
            [0.5, -0.5, -0.5],
            [0.5, 0.5, -0.5],
            [-0.5, 0.5, -0.5],
            [-0.5, -0.5, 0.5],
            [0.5, -0.5, 0.5],
            [0.5, 0.5, 0.5],
            [-0.5, 0.5, 0.5],
          ],
          indices: [
            0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6,
            2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3,
          ],
        },
        octahedron: {
          points: [
            [0, 0.7, 0],
            [0.7, 0, 0],
            [0, 0, 0.7],
            [-0.7, 0, 0],
            [0, 0, -0.7],
            [0, -0.7, 0],
          ],
          indices: [
            0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1,
            4,
          ],
        },
        plane: {
          points: [
            [-0.5, 0, -0.5],
            [0.5, 0, -0.5],
            [0.5, 0, 0.5],
            [-0.5, 0, 0.5],
          ],
          indices: [0, 2, 1, 0, 3, 2],
        },
      },
      geometry = shapes[shape] || shapes.cube,
      triangles = geometry.indices.length / 3,
      counts = new Array(triangles).fill(3),
      prim = String(name || "Asset").replace(/[^A-Za-z0-9_]/g, "_");
    return (
      '#usda 1.0\n(\n    defaultPrim = "Asset"\n    metersPerUnit = 1\n    upAxis = "Y"\n)\n\ndef Xform "Asset" (\n    customData = {\n        int axmTriangles = ' +
      triangles +
      "\n        int axmVertices = " +
      geometry.points.length +
      '\n        string axmShape = "' +
      shape +
      '"\n    }\n)\n{\n    def Mesh "' +
      prim +
      'Mesh"\n    {\n        int[] faceVertexCounts = [' +
      counts.join(", ") +
      "]\n        int[] faceVertexIndices = [" +
      geometry.indices.join(", ") +
      "]\n        point3f[] points = [" +
      points(geometry.points) +
      "]\n        color3f[] primvars:displayColor = [(" +
      colour.join(", ") +
      ')] (\n            interpolation = "constant"\n        )\n        uniform token subdivisionScheme = "none"\n    }\n}\n'
    );
  }
  function rootLayer(composition) {
    var dims = composition.dimensions,
      active = composition.active_variant,
      payload = composition.layers.find(function (layer) {
        return layer.arc === "payload";
      }),
      ground = composition.layers.find(function (layer) {
        return layer.id === "ground";
      });
    return (
      '#usda 1.0\n(\n    defaultPrim = "World"\n    metersPerUnit = ' +
      composition.meters_per_unit +
      '\n    upAxis = "Y"\n)\n\ndef Xform "World" (\n    variants = { string model = "' +
      active +
      '" }\n    prepend variantSets = "model"\n)\n{\n    variantSet "model" = {\n' +
      composition.variants
        .map(function (variant) {
          return (
            '        "' +
            variant.id +
            '" {\n            def Xform "Hero" (\n                prepend references = @' +
            variant.layer +
            "@</Asset>\n            )\n            {\n                double3 xformOp:scale = (" +
            dims.width * 0.18 +
            ", " +
            dims.height * 0.18 +
            ", " +
            dims.depth * 0.18 +
            ')\n                uniform token[] xformOpOrder = ["xformOp:scale"]\n            }\n        }'
          );
        })
        .join("\n") +
      "\n    }\n" +
      (ground
        ? '    def Xform "Ground" (\n        prepend references = @' +
          ground.path +
          "@</Asset>\n    )\n    {\n        double3 xformOp:scale = (" +
          dims.width +
          ", 1, " +
          dims.depth +
          ')\n        uniform token[] xformOpOrder = ["xformOp:scale"]\n    }\n'
        : "") +
      (payload
        ? '    def Xform "Environment" (\n        prepend payload = @' +
          payload.path +
          "@</Asset>\n    )\n    {\n        double3 xformOp:scale = (" +
          dims.width +
          ", " +
          dims.height +
          ", " +
          dims.depth +
          ')\n        uniform token[] xformOpOrder = ["xformOp:scale"]\n    }\n'
        : "") +
      "}\n"
    );
  }
  function build(composition) {
    var files = {};
    composition.variants.forEach(function (variant, index) {
      files[variant.layer] = assetLayer(
        variant.id,
        variant.shape,
        index ? [0.28, 0.58, 0.92] : [0.25, 0.78, 0.7],
      );
    });
    composition.layers.forEach(function (layer) {
      if (layer.id === "ground")
        files[layer.path] = assetLayer("Ground", "plane", [0.18, 0.22, 0.25]);
      if (layer.arc === "payload")
        files[layer.path] = assetLayer(
          "Environment",
          "cube",
          [0.08, 0.12, 0.18],
        );
    });
    files[composition.root_layer] = rootLayer(composition);
    var ordered = {};
    ordered[composition.root_layer] = files[composition.root_layer];
    Object.keys(files)
      .sort()
      .forEach(function (name) {
        if (name !== composition.root_layer) ordered[name] = files[name];
      });
    var packaged = packageUsd(ordered, composition.root_layer);
    return {
      files: ordered,
      root: ordered[composition.root_layer],
      package: packaged,
      inspection: packaged.inspection,
    };
  }
  return {
    VERSION: VERSION,
    MIME: MIME,
    safePath: safePath,
    packageUsd: packageUsd,
    inspectArchive: inspectArchive,
    inspectLayer: inspectLayer,
    inspectPackage: inspectPackage,
    assetLayer: assetLayer,
    rootLayer: rootLayer,
    build: build,
    bytesFromDataUrl: bytes,
    dataUrl: dataUrl,
    decode: decode,
  };
});
