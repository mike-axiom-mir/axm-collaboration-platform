(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMRasterCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.2.0";
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256),
      n,
      c,
      k;
    for (n = 0; n < 256; n += 1) {
      c = n;
      for (k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function concat(parts) {
    var length = parts.reduce(function (sum, part) {
      return sum + part.length;
    }, 0);
    var output = new Uint8Array(length),
      offset = 0;
    parts.forEach(function (part) {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }
  function u32(value) {
    value = value >>> 0;
    return new Uint8Array([
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ]);
  }
  function ascii(value) {
    var output = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i += 1)
      output[i] = value.charCodeAt(i) & 255;
    return output;
  }
  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i += 1)
      crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function adler32(bytes) {
    var a = 1,
      b = 0;
    for (var i = 0; i < bytes.length; i += 1) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }
  function chunk(type, data) {
    var typeBytes = ascii(type),
      body = concat([typeBytes, data]);
    return concat([u32(data.length), body, u32(crc32(body))]);
  }
  function storedDeflate(bytes) {
    var parts = [new Uint8Array([0x78, 0x01])],
      offset = 0;
    while (offset < bytes.length) {
      var length = Math.min(65535, bytes.length - offset),
        final = offset + length >= bytes.length;
      var inverse = ~length & 65535;
      parts.push(
        new Uint8Array([
          final ? 1 : 0,
          length & 255,
          (length >>> 8) & 255,
          inverse & 255,
          (inverse >>> 8) & 255,
        ]),
      );
      parts.push(bytes.subarray(offset, offset + length));
      offset += length;
    }
    parts.push(u32(adler32(bytes)));
    return concat(parts);
  }
  function base64(bytes) {
    if (typeof Buffer !== "undefined")
      return Buffer.from(bytes).toString("base64");
    var binary = "",
      step = 32768;
    for (var offset = 0; offset < bytes.length; offset += step)
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(offset, Math.min(bytes.length, offset + step)),
      );
    return btoa(binary);
  }
  function bytesFromDataUrl(value, mime) {
    var expected = "data:" + String(mime || "image/png") + ";base64,";
    if (typeof value !== "string" || value.slice(0, expected.length).toLowerCase() !== expected.toLowerCase())
      throw new Error("expected a base64 " + (mime || "image/png") + " data URL");
    var encoded = value.slice(expected.length), binary;
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(encoded, "base64"));
    binary = atob(encoded);
    var output = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
    return output;
  }
  function scanlines(width, height, rgba) {
    if (!(width > 0 && height > 0) || width > 4096 || height > 4096)
      throw new Error("PNG dimensions must be between 1 and 4096 pixels");
    if (!(rgba instanceof Uint8Array) || rgba.length !== width * height * 4)
      throw new Error("RGBA byte length does not match PNG dimensions");
    var output = new Uint8Array(height * (1 + width * 4)),
      sourceOffset = 0,
      targetOffset = 0;
    for (var y = 0; y < height; y += 1) {
      output[targetOffset] = 0;
      targetOffset += 1;
      output.set(
        rgba.subarray(sourceOffset, sourceOffset + width * 4),
        targetOffset,
      );
      sourceOffset += width * 4;
      targetOffset += width * 4;
    }
    return output;
  }
  function scanlines16(width, height, rgba) {
    if (!(width > 0 && height > 0) || width > 4096 || height > 4096)
      throw new Error("PNG dimensions must be between 1 and 4096 pixels");
    if (!(rgba instanceof Uint16Array) || rgba.length !== width * height * 4)
      throw new Error("16-bit RGBA sample length does not match PNG dimensions");
    var output = new Uint8Array(height * (1 + width * 8)),
      sourceOffset = 0,
      targetOffset = 0;
    for (var y = 0; y < height; y += 1) {
      output[targetOffset++] = 0;
      for (var x = 0; x < width * 4; x += 1) {
        var sample = rgba[sourceOffset++];
        output[targetOffset++] = (sample >>> 8) & 255;
        output[targetOffset++] = sample & 255;
      }
    }
    return output;
  }
  function iccChunk(profile, name) {
    if (!(profile instanceof Uint8Array) || profile.length < 132)
      throw new Error("embedded ICC profile is missing or truncated");
    var profileName = String(name || "AXM profile").replace(/[^\x20-\x7e]/g, " ").slice(0, 79);
    if (!profileName) profileName = "AXM profile";
    return chunk("iCCP", concat([ascii(profileName), new Uint8Array([0, 0]), storedDeflate(profile)]));
  }
  function dataUrl(mime, bytes) {
    return "data:" + mime + ";base64," + base64(bytes);
  }
  function encodeRgba(width, height, rgba, options) {
    width = Math.round(Number(width));
    height = Math.round(Number(height));
    options = options || {};
    var rows = scanlines(width, height, rgba);
    var header = concat([
      u32(width),
      u32(height),
      new Uint8Array([8, 6, 0, 0, 0]),
    ]);
    var parts = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
    ];
    if (options.iccProfile instanceof Uint8Array)
      parts.push(iccChunk(options.iccProfile, options.profileName));
    else if (options.colourSpace === "srgb")
      parts.push(chunk("sRGB", new Uint8Array([0])));
    parts.push(
      chunk("IDAT", storedDeflate(rows)),
      chunk("IEND", new Uint8Array(0)),
    );
    var png = concat(parts),
      inspection = inspectPng(png);
    if (!inspection.pass)
      throw new Error(
        "PNG structural validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "image/png",
      format: "PNG",
      width: width,
      height: height,
      byteLength: png.length,
      dataUrl: dataUrl("image/png", png),
      bytes: png,
      inspection: inspection,
    };
  }
  function encodeRgba16(width, height, rgba, options) {
    width = Math.round(Number(width));
    height = Math.round(Number(height));
    options = options || {};
    var rows = scanlines16(width, height, rgba),
      header = concat([u32(width), u32(height), new Uint8Array([16, 6, 0, 0, 0])]),
      parts = [
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
      ];
    if (options.iccProfile instanceof Uint8Array)
      parts.push(iccChunk(options.iccProfile, options.profileName));
    else if (options.colourSpace === "srgb")
      parts.push(chunk("sRGB", new Uint8Array([0])));
    parts.push(chunk("IDAT", storedDeflate(rows)), chunk("IEND", new Uint8Array(0)));
    var png = concat(parts), inspection = inspectPng(png);
    if (!inspection.pass)
      throw new Error("16-bit PNG structural validation failed: " + inspection.errors.join(", "));
    return {
      mime: "image/png",
      format: "PNG",
      width: width,
      height: height,
      bitDepth: 16,
      byteLength: png.length,
      dataUrl: dataUrl("image/png", png),
      bytes: png,
      inspection: inspection,
    };
  }
  function encodeApng(width, height, frames, options) {
    width = Math.round(Number(width));
    height = Math.round(Number(height));
    options = options || {};
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 60)
      throw new Error("APNG requires 2..60 frames");
    var fps = Math.max(1, Math.min(240, Math.round(Number(options.fps) || 12))),
      plays = Math.max(
        0,
        Math.min(65535, Math.round(Number(options.plays) || 0)),
      ),
      header = concat([
        u32(width),
        u32(height),
        new Uint8Array([8, 6, 0, 0, 0]),
      ]),
      parts = [
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
        chunk("acTL", concat([u32(frames.length), u32(plays)])),
      ],
      sequence = 0;
    if (options.colourSpace === "srgb")
      parts.push(chunk("sRGB", new Uint8Array([0])));
    frames.forEach(function (frame, index) {
      var rgba = frame && frame.rgba instanceof Uint8Array ? frame.rgba : frame,
        rows = scanlines(width, height, rgba),
        delayNum = Math.max(
          1,
          Math.min(65535, Math.round(Number(frame && frame.delay_num) || 1)),
        ),
        delayDen = Math.max(
          1,
          Math.min(65535, Math.round(Number(frame && frame.delay_den) || fps)),
        ),
        control = concat([
          u32(sequence++),
          u32(width),
          u32(height),
          u32(0),
          u32(0),
          new Uint8Array([
            (delayNum >>> 8) & 255,
            delayNum & 255,
            (delayDen >>> 8) & 255,
            delayDen & 255,
            0,
            index === 0 ? 0 : 1,
          ]),
        ]),
        compressed = storedDeflate(rows);
      parts.push(chunk("fcTL", control));
      if (index === 0) parts.push(chunk("IDAT", compressed));
      else parts.push(chunk("fdAT", concat([u32(sequence++), compressed])));
    });
    parts.push(chunk("IEND", new Uint8Array(0)));
    var bytes = concat(parts),
      inspection = inspectApng(bytes);
    if (!inspection.pass)
      throw new Error(
        "APNG structural validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "image/apng",
      format: "APNG",
      width: width,
      height: height,
      frames: frames.length,
      fps: fps,
      plays: plays,
      byteLength: bytes.length,
      dataUrl: dataUrl("image/apng", bytes),
      bytes: bytes,
      inspection: inspection,
    };
  }
  function inspectStoredDeflate(data, expectedLength) {
    var errors = [],
      parts = [],
      offset = 2,
      final = false;
    if (!(data instanceof Uint8Array) || data.length < 7 || data[0] !== 0x78)
      errors.push("zlib header missing");
    while (!errors.length && !final && offset < data.length - 4) {
      var header = data[offset++];
      final = (header & 1) === 1;
      if (((header >>> 1) & 3) !== 0) {
        errors.push(
          "only stored DEFLATE blocks are supported by the local validator",
        );
        break;
      }
      if (offset + 4 > data.length - 4) {
        errors.push("stored DEFLATE header truncated");
        break;
      }
      var length = data[offset] | (data[offset + 1] << 8),
        inverse = data[offset + 2] | (data[offset + 3] << 8);
      offset += 4;
      if ((~length & 65535) !== inverse) {
        errors.push("stored DEFLATE length complement mismatch");
        break;
      }
      if (offset + length > data.length - 4) {
        errors.push("stored DEFLATE block truncated");
        break;
      }
      parts.push(data.subarray(offset, offset + length));
      offset += length;
    }
    var rows = concat(parts),
      declared =
        ((data[data.length - 4] << 24) |
          (data[data.length - 3] << 16) |
          (data[data.length - 2] << 8) |
          data[data.length - 1]) >>>
        0;
    if (adler32(rows) !== declared) errors.push("zlib Adler-32 mismatch");
    if (expectedLength != null && rows.length !== expectedLength)
      errors.push("decoded scanline length mismatch");
    return { pass: !errors.length, errors: errors, decodedBytes: rows.length };
  }
  function inflateStored(data) {
    var check = inspectStoredDeflate(data), errors = check.errors.slice(), parts = [], offset = 2, final = false;
    while (!errors.length && !final && offset < data.length - 4) {
      var header = data[offset++];
      final = (header & 1) === 1;
      var length = data[offset] | (data[offset + 1] << 8);
      offset += 4;
      parts.push(data.subarray(offset, offset + length));
      offset += length;
    }
    if (errors.length) throw new Error("stored DEFLATE decode failed: " + errors.join(", "));
    return concat(parts);
  }
  function decodeRgba(bytes) {
    var inspection = inspectPng(bytes);
    if (!inspection.pass) throw new Error("PNG validation failed: " + inspection.errors.join(", "));
    if (inspection.colourType !== 6 || (inspection.bitDepth !== 8 && inspection.bitDepth !== 16))
      throw new Error("local PNG decoder supports 8-bit or 16-bit RGBA only");
    if (!inspection.deepValidated)
      throw new Error("local PNG decoder requires the bounded stored-DEFLATE profile");
    var offset = 8, idat = [];
    while (offset + 12 <= bytes.length) {
      var length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0,
        type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]),
        start = offset + 8;
      if (type === "IDAT") idat.push(bytes.subarray(start, start + length));
      offset += 12 + length;
      if (type === "IEND") break;
    }
    var rows = inflateStored(concat(idat)), bytesPerSample = inspection.bitDepth === 16 ? 2 : 1,
      stride = inspection.width * 4 * bytesPerSample, sourceOffset = 0,
      samples = inspection.bitDepth === 16 ? new Uint16Array(inspection.width * inspection.height * 4) : new Uint8Array(inspection.width * inspection.height * 4),
      sampleOffset = 0;
    for (var y = 0; y < inspection.height; y += 1) {
      if (rows[sourceOffset++] !== 0) throw new Error("local PNG decoder supports filter type 0 only");
      if (inspection.bitDepth === 8) {
        samples.set(rows.subarray(sourceOffset, sourceOffset + stride), sampleOffset);
        sampleOffset += stride;
        sourceOffset += stride;
      } else {
        for (var x = 0; x < stride; x += 2) samples[sampleOffset++] = (rows[sourceOffset + x] << 8) | rows[sourceOffset + x + 1];
        sourceOffset += stride;
      }
    }
    return { width:inspection.width, height:inspection.height, bitDepth:inspection.bitDepth, rgba:samples, inspection:inspection };
  }
  function extractIcc(bytes) {
    var inspection=inspectPng(bytes);
    if(!inspection.pass)throw new Error("PNG validation failed: "+inspection.errors.join(", "));
    var offset=8;
    while(offset+12<=bytes.length){
      var length=((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0,
        type=String.fromCharCode(bytes[offset+4],bytes[offset+5],bytes[offset+6],bytes[offset+7]),start=offset+8,data=bytes.subarray(start,start+length);
      if(type==="iCCP"){
        var zero=data.indexOf(0);
        if(zero<1||zero+2>data.length||data[zero+1]!==0)throw new Error("PNG iCCP header invalid");
        return{name:String.fromCharCode.apply(null,data.subarray(0,zero)),bytes:inflateStored(data.subarray(zero+2))};
      }
      offset+=12+length;if(type==="IEND")break;
    }
    return null;
  }
  function inspectApng(bytes) {
    var errors = [],
      chunks = [],
      offset = 8,
      sequence = [],
      frames = 0,
      hasImage = false,
      width = 0,
      height = 0,
      declaredFrames = null,
      plays = null,
      firstIdat = -1,
      animationIndex = -1,
      frameDataChecks = [];
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.length < 40 ||
      [137, 80, 78, 71, 13, 10, 26, 10].some(function (value, index) {
        return bytes[index] !== value;
      })
    )
      errors.push("PNG signature missing");
    while (!errors.length && offset + 12 <= bytes.length) {
      var length =
          ((bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3]) >>>
          0,
        type = String.fromCharCode(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7],
        ),
        dataStart = offset + 8,
        dataEnd = dataStart + length,
        end = offset + 12 + length;
      if (end > bytes.length) {
        errors.push("chunk exceeds file");
        break;
      }
      var body = bytes.subarray(offset + 4, dataEnd),
        data = bytes.subarray(dataStart, dataEnd),
        expected =
          ((bytes[dataEnd] << 24) |
            (bytes[dataEnd + 1] << 16) |
            (bytes[dataEnd + 2] << 8) |
            bytes[dataEnd + 3]) >>>
          0;
      if (crc32(body) !== expected) errors.push(type + " CRC mismatch");
      chunks.push(type);
      if (chunks.length === 1 && type !== "IHDR")
        errors.push("IHDR must be first");
      if (type === "IHDR") {
        if (length !== 13) errors.push("IHDR length must be 13");
        else {
          width =
            ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>>
            0;
          height =
            ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>>
            0;
          if (!width || !height)
            errors.push("IHDR dimensions must be positive");
          if (data[8] !== 8 || data[9] !== 6)
            errors.push("local APNG expects 8-bit RGBA");
        }
      }
      if (type === "acTL") {
        animationIndex = chunks.length - 1;
        if (length !== 8) errors.push("acTL length must be 8");
        else {
          declaredFrames =
            ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>>
            0;
          plays =
            ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>>
            0;
        }
      }
      if (type === "fcTL") {
        frames++;
        if (length !== 26) errors.push("fcTL length must be 26");
        else {
          var seq =
              ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>>
              0,
            frameWidth =
              ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>>
              0,
            frameHeight =
              ((data[8] << 24) |
                (data[9] << 16) |
                (data[10] << 8) |
                data[11]) >>>
              0,
            x =
              ((data[12] << 24) |
                (data[13] << 16) |
                (data[14] << 8) |
                data[15]) >>>
              0,
            y =
              ((data[16] << 24) |
                (data[17] << 16) |
                (data[18] << 8) |
                data[19]) >>>
              0;
          sequence.push(seq);
          if (
            !frameWidth ||
            !frameHeight ||
            x + frameWidth > width ||
            y + frameHeight > height
          )
            errors.push("fcTL frame exceeds IHDR canvas");
          if (
            frames === 1 &&
            (frameWidth !== width ||
              frameHeight !== height ||
              x !== 0 ||
              y !== 0)
          )
            errors.push("first animated frame must cover the full canvas");
          if (data[24] > 2) errors.push("fcTL dispose operation invalid");
          if (data[25] > 1) errors.push("fcTL blend operation invalid");
        }
      }
      if (type === "IDAT") {
        if (firstIdat < 0) firstIdat = chunks.length - 1;
        hasImage = true;
        frameDataChecks.push(
          inspectStoredDeflate(data, height * (1 + width * 4)),
        );
      }
      if (type === "fdAT") {
        if (length < 5) errors.push("fdAT too short");
        else {
          sequence.push(
            ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>>
              0,
          );
          frameDataChecks.push(
            inspectStoredDeflate(data.subarray(4), height * (1 + width * 4)),
          );
        }
      }
      offset = end;
      if (type === "IEND") break;
    }
    for (var i = 0; i < sequence.length; i += 1)
      if (sequence[i] !== i) errors.push("APNG sequence is not contiguous");
    frameDataChecks.forEach(function (check) {
      if (!check.pass) errors = errors.concat(check.errors);
    });
    if (animationIndex < 0) errors.push("acTL missing");
    if (firstIdat >= 0 && animationIndex > firstIdat)
      errors.push("acTL must appear before IDAT");
    if (declaredFrames !== frames)
      errors.push("acTL frame count does not match fcTL count");
    if (frames < 2) errors.push("multiple fcTL frames required");
    if (!hasImage) errors.push("IDAT missing");
    if (chunks[chunks.length - 1] !== "IEND") errors.push("IEND missing");
    if (offset !== bytes.length) errors.push("trailing bytes after IEND");
    return {
      pass: !errors.length,
      errors: errors,
      chunks: chunks,
      frames: frames,
      declaredFrames: declaredFrames,
      plays: plays,
      width: width,
      height: height,
      sequence: sequence,
      decodedFrames: frameDataChecks.length,
    };
  }
  function inspectPng(bytes) {
    var errors = [],
      warnings = [],
      chunks = [],
      offset = 8,
      width = 0,
      height = 0,
      idat = [],
      colourType = null,
      bitDepth = null,
      iccProfile = null,
      iccProfileName = null;
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.length < 40 ||
      [137, 80, 78, 71, 13, 10, 26, 10].some(function (value, index) {
        return bytes[index] !== value;
      })
    )
      errors.push("PNG signature missing");
    while (!errors.length && offset + 12 <= bytes.length) {
      var length =
          ((bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3]) >>>
          0,
        type = String.fromCharCode(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7],
        ),
        dataStart = offset + 8,
        dataEnd = dataStart + length,
        end = offset + 12 + length;
      if (end > bytes.length) {
        errors.push("chunk exceeds file");
        break;
      }
      var body = bytes.subarray(offset + 4, dataEnd),
        data = bytes.subarray(dataStart, dataEnd),
        expected =
          ((bytes[dataEnd] << 24) |
            (bytes[dataEnd + 1] << 16) |
            (bytes[dataEnd + 2] << 8) |
            bytes[dataEnd + 3]) >>>
          0;
      if (crc32(body) !== expected) errors.push(type + " CRC mismatch");
      chunks.push(type);
      if (chunks.length === 1 && type !== "IHDR")
        errors.push("IHDR must be first");
      if (type === "IHDR") {
        if (length !== 13) errors.push("IHDR length must be 13");
        else {
          width =
            ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>>
            0;
          height =
            ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>>
            0;
          bitDepth = data[8];
          colourType = data[9];
          if (!width || !height)
            errors.push("IHDR dimensions must be positive");
          if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0)
            errors.push(
              "unsupported PNG compression, filter or interlace method",
            );
        }
      }
      if (type === "IDAT") idat.push(data);
      if (type === "iCCP") {
        var zero = data.indexOf(0);
        if (zero < 1 || zero > 79 || zero + 2 > data.length)
          errors.push("iCCP profile name or compression header invalid");
        else if (data[zero + 1] !== 0)
          errors.push("iCCP compression method must be zero");
        else {
          iccProfileName = String.fromCharCode.apply(null, data.subarray(0, zero));
          var inflatedProfile = inspectStoredDeflate(data.subarray(zero + 2));
          if (!inflatedProfile.pass) errors = errors.concat(inflatedProfile.errors.map(function (error) { return "iCCP " + error; }));
          else {
            var profileParts = [], profileData = data.subarray(zero + 2), profileOffset = 2, profileFinal = false;
            while (!profileFinal && profileOffset < profileData.length - 4) {
              var profileHeader = profileData[profileOffset++];
              profileFinal = (profileHeader & 1) === 1;
              var profileLength = profileData[profileOffset] | (profileData[profileOffset + 1] << 8);
              profileOffset += 4;
              profileParts.push(profileData.subarray(profileOffset, profileOffset + profileLength));
              profileOffset += profileLength;
            }
            iccProfile = concat(profileParts);
            if (iccProfile.length < 132 || String.fromCharCode(iccProfile[36], iccProfile[37], iccProfile[38], iccProfile[39]) !== "acsp")
              errors.push("iCCP payload is not an ICC profile");
            else {
              var declaredProfileSize = ((iccProfile[0] << 24) | (iccProfile[1] << 16) | (iccProfile[2] << 8) | iccProfile[3]) >>> 0;
              if (declaredProfileSize !== iccProfile.length) errors.push("iCCP ICC size mismatch");
            }
          }
        }
      }
      offset = end;
      if (type === "IEND") break;
    }
    if (!idat.length) errors.push("IDAT missing");
    if (chunks[chunks.length - 1] !== "IEND") errors.push("IEND missing");
    if (offset !== bytes.length) errors.push("trailing bytes after IEND");
    var deep = null,
      channels =
        colourType === 6
          ? 4
          : colourType === 2
            ? 3
            : colourType === 0
              ? 1
              : null;
    if (!errors.length && channels && (bitDepth === 8 || bitDepth === 16)) {
      var compressed = concat(idat);
      if (compressed[0] === 0x78 && compressed[1] === 0x01)
        deep = inspectStoredDeflate(
          compressed,
          height * (1 + width * channels * (bitDepth === 16 ? 2 : 1)),
        );
      else
        warnings.push(
          "pixel stream uses a compressor outside the local deep validator",
        );
      if (deep && !deep.pass) errors = errors.concat(deep.errors);
    } else if (!errors.length)
      warnings.push(
        "pixel depth or colour type is outside the local deep validator",
      );
    return {
      pass: !errors.length,
      errors: errors,
      warnings: warnings,
      chunks: chunks,
      width: width,
      height: height,
      bitDepth: bitDepth,
      colourType: colourType,
      hasSrgb: chunks.indexOf("sRGB") >= 0,
      hasIcc: chunks.indexOf("iCCP") >= 0,
      iccProfileName: iccProfileName,
      iccProfileBytes: iccProfile ? iccProfile.length : 0,
      deepValidated: !!deep,
    };
  }

  return {
    VERSION: VERSION,
    encodeRgba: encodeRgba,
    encodeRgba16: encodeRgba16,
    encodeApng: encodeApng,
    decodeRgba: decodeRgba,
    extractIcc: extractIcc,
    bytesFromDataUrl: bytesFromDataUrl,
    inspectPng: inspectPng,
    inspectApng: inspectApng,
    crc32: crc32,
    adler32: adler32,
  };
});
