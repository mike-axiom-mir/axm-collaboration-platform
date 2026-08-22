(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports ? require("./choice-first-core") : root.AXMChoiceFirstCore,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMChoiceFirstPilotCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Choice) {
  "use strict";
  if (!Choice) throw new Error("AXM Choice First Core is required");

  var VERSION = "1.0.0";
  var PALETTES = {
    "pixel-8bit": [
      "#00000000", "#182033FF", "#263859FF", "#315A7DFF", "#3B82F6FF", "#7DD3FCFF", "#F8FAFCFF", "#FFF1D0FF",
      "#F9C74FFF", "#F9844AFF", "#E05263FF", "#43AA8BFF", "#7A4E2DFF", "#D9A066FF", "#6B7280FF", "#6D4C9FFF",
    ],
    "pixel-16bit": [
      "#00000000", "#111827FF", "#182033FF", "#263859FF", "#315A7DFF", "#3B82F6FF", "#60A5FAFF", "#7DD3FCFF",
      "#BAE6FDFF", "#F8FAFCFF", "#FFF1D0FF", "#F9C74FFF", "#F6B83FFF", "#F9844AFF", "#E05263FF", "#BE3A52FF",
      "#43AA8BFF", "#2D7D6CFF", "#7A4E2DFF", "#A96F3FFF", "#D9A066FF", "#EDC58AFF", "#4B5563FF", "#6B7280FF",
      "#9CA3AFFF", "#6D4C9FFF", "#9876C6FF", "#B892E3FF", "#3E6F4EFF", "#74A65BFF", "#F2A7B8FF", "#C97A91FF",
    ],
  };
  var LOW_PALETTE_FALLBACK = { 16: 11, 17: 11, 18: 12, 19: 12, 20: 13, 21: 7, 22: 14, 23: 14, 24: 6, 25: 15, 26: 15, 27: 15, 28: 11, 29: 11, 30: 10, 31: 10 };
  PALETTES["pixel-custom"] = PALETTES["pixel-16bit"].slice();

  function colourBytes(value) {
    var match = /^#([0-9a-f]{8})$/i.exec(String(value));
    if (!match) throw new Error("pilot colour must be #RRGGBBAA");
    return [0, 2, 4, 6].map(function (offset) { return parseInt(match[1].slice(offset, offset + 2), 16); });
  }

  function makeImage(width, height, colour) {
    var rgba = new Uint8Array(width * height * 4);
    var fill = colourBytes(colour || "#00000000");
    for (var index = 0; index < rgba.length; index += 4) rgba.set(fill, index);
    return { width: width, height: height, rgba: rgba };
  }

  function painter(profileId, requestedSize) {
    var palette = PALETTES[profileId];
    if (!palette) throw new Error("pilot renderer only installs pixel-8bit and pixel-16bit");
    var size = requestedSize == null ? (profileId === "pixel-16bit" ? 96 : profileId === "pixel-custom" ? 64 : 48) : Math.max(16, Math.min(256, Math.round(Number(requestedSize))));
    var scale = size / 48;
    var image = makeImage(size, size);
    var bytes = palette.map(colourBytes);
    function unit(value) { return Math.round(value * scale); }
    function pixel(x, y, colour) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      var selected = bytes[colour] || bytes[LOW_PALETTE_FALLBACK[colour]] || bytes[1];
      image.rgba.set(selected, (y * size + x) * 4);
    }
    function rect(x, y, width, height, colour) {
      var left = unit(x), top = unit(y), right = unit(x + width), bottom = unit(y + height);
      for (var py = top; py < bottom; py += 1) for (var px = left; px < right; px += 1) pixel(px, py, colour);
    }
    function line(x0, y0, x1, y1, colour, thickness) {
      x0 = unit(x0); y0 = unit(y0); x1 = unit(x1); y1 = unit(y1);
      var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      var error = dx + dy;
      var radius = Math.max(0, Math.floor(unit(thickness || 1) / 2));
      while (true) {
        for (var oy = -radius; oy <= radius; oy += 1) for (var ox = -radius; ox <= radius; ox += 1) pixel(x0 + ox, y0 + oy, colour);
        if (x0 === x1 && y0 === y1) break;
        var twice = 2 * error;
        if (twice >= dy) { error += dy; x0 += sx; }
        if (twice <= dx) { error += dx; y0 += sy; }
      }
    }
    function polygon(points, colour) {
      var mapped = points.map(function (point) { return [unit(point[0]), unit(point[1])]; });
      var minY = Math.max(0, Math.min.apply(null, mapped.map(function (point) { return point[1]; })));
      var maxY = Math.min(size - 1, Math.max.apply(null, mapped.map(function (point) { return point[1]; })));
      for (var y = minY; y <= maxY; y += 1) {
        var intersections = [];
        for (var index = 0; index < mapped.length; index += 1) {
          var a = mapped[index], b = mapped[(index + 1) % mapped.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        intersections.sort(function (a, b) { return a - b; });
        for (var pair = 0; pair + 1 < intersections.length; pair += 2) for (var x = Math.ceil(intersections[pair]); x <= Math.floor(intersections[pair + 1]); x += 1) pixel(x, y, colour);
      }
    }
    function ellipse(cx, cy, rx, ry, colour) {
      var left = unit(cx - rx), right = unit(cx + rx), top = unit(cy - ry), bottom = unit(cy + ry);
      var centerX = unit(cx), centerY = unit(cy), radiusX = Math.max(1, unit(rx)), radiusY = Math.max(1, unit(ry));
      for (var y = top; y <= bottom; y += 1) for (var x = left; x <= right; x += 1) {
        var nx = (x - centerX) / radiusX, ny = (y - centerY) / radiusY;
        if (nx * nx + ny * ny <= 1) pixel(x, y, colour);
      }
    }
    function ring(cx, cy, radius, colour, thickness, segments) {
      var previous = null;
      for (var index = 0; index <= segments; index += 1) {
        var angle = Math.PI * 2 * index / segments;
        var point = [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
        if (previous) line(previous[0], previous[1], point[0], point[1], colour, thickness);
        previous = point;
      }
    }
    return { image: image, palette: palette.slice(), size: size, scale: scale, unit: unit, pixel: pixel, rect: rect, line: line, polygon: polygon, ellipse: ellipse, ring: ring };
  }

  function drawGround(p, wide) {
    p.ellipse(24, 42, wide || 17, 3, 2);
    p.ellipse(24, 41.5, (wide || 17) - 1, 2, 3);
    if (p.scale > 1) p.line(12, 41, 36, 41, 5, 0.5);
  }

  function ferrisWheel(p, frame, state) {
    drawGround(p, 18);
    var phase = Math.PI * 2 * (frame % 12) / 12;
    p.rect(10, 38, 28, 3, 18);
    p.rect(11, 37, 26, 1, 20);
    p.line(14, 38, 24, 20, 1, 3);
    p.line(34, 38, 24, 20, 1, 3);
    p.line(14, 38, 24, 20, 11, 1);
    p.line(34, 38, 24, 20, 11, 1);
    var spokes = p.scale > 1 ? 12 : 8;
    for (var spoke = 0; spoke < spokes; spoke += 1) {
      var angle = phase + Math.PI * 2 * spoke / spokes;
      p.line(24, 20, 24 + Math.cos(angle) * 14, 20 + Math.sin(angle) * 14, spoke % 2 ? 8 : 9, p.scale > 1 ? 0.65 : 1);
    }
    p.ring(24, 20, 14.5, 1, p.scale > 1 ? 1.2 : 1.5, p.scale > 1 ? 48 : 28);
    p.ring(24, 20, 12.8, 10, p.scale > 1 ? 0.55 : 1, p.scale > 1 ? 48 : 28);
    p.ellipse(24, 20, 2.4, 2.4, 8);
    p.ellipse(24, 20, 1.2, 1.2, 1);
    for (var gondola = 0; gondola < 8; gondola += 1) {
      var gondolaAngle = phase + Math.PI * 2 * gondola / 8;
      var gx = 24 + Math.cos(gondolaAngle) * 14.5;
      var gy = 20 + Math.sin(gondolaAngle) * 14.5;
      p.line(gx, gy, gx, gy + 1.5, 1, 0.75);
      p.rect(gx - 2.1, gy + 1, 4.2, 2.5, gondola % 2 ? 4 : 14);
      p.rect(gx - 1.5, gy + 1.5, 3, 0.75, gondola % 2 ? 7 : 10);
    }
    p.rect(31.5, 33, 5.5, 5, 3);
    p.rect(32.5, 34, 3.5, 2, state && state.faults && state.faults.length ? 14 : 16);
    if (p.scale > 1) { p.rect(12, 39, 24, 0.5, 21); p.pixel(p.unit(24), p.unit(20), 9); }
  }

  function carouselHorse(p, frame, state) {
    drawGround(p, 16);
    var bob = state && state.animation_state === "fault" ? 0 : Math.sin(Math.PI * 2 * (frame % 12) / 12) * 1.5;
    p.ellipse(24, 39, 16, 3.5, 18);
    p.ellipse(24, 38, 15, 2.5, 11);
    p.polygon([[8, 15], [24, 6], [40, 15], [36, 19], [12, 19]], 10);
    p.polygon([[12, 15], [19, 9], [22, 17]], 8);
    p.polygon([[24, 7], [29, 17], [34, 12], [38, 16]], 9);
    p.line(9, 19, 39, 19, 1, 1.5);
    p.rect(23, 8, 2, 31, 8);
    p.rect(23.6, 9, 0.8, 28, 7);
    var y = 28 + bob;
    p.ellipse(24, y, 7, 3.5, 6);
    p.ellipse(29.5, y - 2.5, 2.8, 2.5, 6);
    p.polygon([[31, y - 4], [34, y - 6], [33, y - 1]], 6);
    p.rect(20, y - 2, 7, 2.5, 14);
    p.rect(21, y - 1.5, 5, 1, 15);
    p.line(19, y + 1, 16, y + 6, 1, 1.2);
    p.line(22, y + 2, 21, y + 7, 1, 1.2);
    p.line(27, y + 2, 29, y + 7, 1, 1.2);
    p.line(30, y, 34, y + 5, 1, 1.2);
    p.line(17, y - 1, 14, y - 4, 25, 1);
    p.pixel(p.unit(31), p.unit(y - 3), 1);
    if (p.scale > 1) { p.line(18, y - 2, 28, y - 3, 9, 0.5); p.rect(34, 14, 1, 2, 11); }
  }

  function ticketGate(p, frame, state) {
    drawGround(p, 15);
    p.polygon([[7, 38], [11, 32], [37, 32], [41, 38], [35, 42], [13, 42]], 3);
    p.line(11, 32, 37, 32, 5, 1);
    p.rect(10, 17, 7, 21, 1);
    p.rect(11, 18, 5, 19, 4);
    p.rect(31, 17, 7, 21, 1);
    p.rect(32, 18, 5, 19, 3);
    p.rect(11.5, 20, 4, 4, 2);
    p.rect(12.5, 21, 2, 2, 7);
    var stage = frame % 12;
    var open = stage >= 4 && stage <= 9;
    var progress = stage < 4 ? 0 : stage < 7 ? (stage - 3) / 3 : stage <= 9 ? 1 : (12 - stage) / 2;
    var angle = -Math.PI / 2 * Math.max(0, Math.min(1, progress));
    var hingeX = 16, hingeY = 27;
    var endX = hingeX + Math.cos(angle) * 15;
    var endY = hingeY + Math.sin(angle) * 15;
    p.ellipse(hingeX, hingeY, 1.6, 1.6, 8);
    p.line(hingeX, hingeY, endX, endY, state && state.operating_state === "denied" ? 14 : 8, 2.2);
    p.line(hingeX, hingeY - 0.4, endX, endY - 0.4, 7, 0.6);
    var fault = state && state.faults && state.faults.length;
    var light = fault ? 14 : state && state.operating_state === "denied" ? 14 : open ? 16 : (frame % 2 ? 8 : 9);
    p.rect(33, 14, 3, 3, 1);
    p.rect(33.5, 14.5, 2, 2, light);
    p.line(24, 18, 24, 32, 23, 1);
    p.polygon([[21, 20], [24, 17], [27, 20], [24, 23]], open ? 16 : 8);
    if (p.scale > 1) { p.rect(12, 25, 3, 5, 6); p.rect(33, 25, 3, 6, 24); }
  }

  function sofa(p, frame, options) {
    drawGround(p, 18);
    var object = options && options.sofa;
    var installed = object && object.installed_components || {};
    var velvet = installed.upholstery === "warm-velvet";
    var easy = installed.upholstery === "easy-clean-weave";
    var canvas = installed.upholstery === "durable-canvas";
    var body = velvet ? 25 : easy ? 16 : canvas ? 20 : 4;
    var bodyLight = velvet ? 27 : easy ? 17 : canvas ? 21 : 6;
    var bob = Math.sin(Math.PI * 2 * (frame % 8) / 8) * 0.35;
    p.rect(9, 18, 30, 18, 1);
    p.rect(10, 19, 28, 16, body);
    p.rect(8, 24, 6, 13, 1);
    p.rect(9, 25, 5, 11, body);
    p.rect(34, 24, 6, 13, 1);
    p.rect(34, 25, 5, 11, body);
    p.rect(13, 27 + bob, 10.5, 7, 1);
    p.rect(14, 27.5 + bob, 9, 5.5, bodyLight);
    p.rect(24.5, 27 - bob, 10.5, 7, 1);
    p.rect(25, 27.5 - bob, 9, 5.5, bodyLight);
    p.rect(12, 20, 24, 2, bodyLight);
    p.rect(11, 36, 5, 3, 18);
    p.rect(32, 36, 5, 3, 18);
    if (installed.frame === "reinforced-beech-frame") { p.rect(12, 37, 24, 1, 20); p.rect(15, 38, 3, 2, 19); p.rect(30, 38, 3, 2, 19); }
    if (installed.utility === "underseat-storage") { p.rect(17, 34, 14, 3, 18); p.rect(18, 34.5, 12, 1.5, 20); p.rect(23.5, 35, 1, 1, 8); }
    if (installed.utility === "manual-recline") { p.line(37, 29, 41, 31, 8, 1); p.rect(40, 30, 2, 3, 18); }
    if (velvet && p.scale > 1) for (var x = 12; x < 36; x += 4) p.rect(x, 20, 1, 1, 30);
    if (easy && p.scale > 1) p.line(11, 23, 37, 23, 8, 0.5);
    if (canvas && p.scale > 1) for (var stitch = 12; stitch < 36; stitch += 3) p.pixel(p.unit(stitch), p.unit(21), 18);
  }

  function render(identityId, profileId, frameIndex, options) {
    Choice.getIdentity(identityId);
    if (profileId !== "pixel-8bit" && profileId !== "pixel-16bit" && profileId !== "pixel-custom") throw new Error("pilot renderer requires an installed pixel profile");
    var requestedSize = options && options.profile && options.profile.axes && options.profile.axes.detail && options.profile.axes.detail.cell_width;
    var p = painter(profileId, requestedSize);
    var state = options && options.simulation && options.simulation.state || options && options.state || null;
    if (identityId === "axm.park.ferris-wheel") ferrisWheel(p, frameIndex, state);
    else if (identityId === "axm.park.carousel-horse") carouselHorse(p, frameIndex, state);
    else if (identityId === "axm.park.ticket-gate") ticketGate(p, frameIndex, state);
    else if (identityId === "axm.home.starter-sofa") sofa(p, frameIndex, options || {});
    else throw new Error("no pilot art renderer for " + identityId);
    return { identity_id: identityId, profile_id: profileId, frame_index: frameIndex, width: p.image.width, height: p.image.height, rgba: p.image.rgba, palette: p.palette, pivot: { x: 0.5, y: 1, unit: "normalized" } };
  }

  function frameCount(profileId, identityId) {
    if (identityId === "axm.home.starter-sofa") return profileId === "pixel-16bit" ? 8 : 6;
    return profileId === "pixel-16bit" ? 12 : 8;
  }

  function renderFrames(identityId, profileId, options) {
    var count = frameCount(profileId, identityId);
    var frames = [];
    for (var index = 0; index < count; index += 1) frames.push(render(identityId, profileId, index, options));
    return frames;
  }

  function renderSheet(frames) {
    if (!frames || !frames.length) throw new Error("pilot sprite sheet requires frames");
    var cellWidth = frames[0].width, cellHeight = frames[0].height;
    var columns = Math.min(4, frames.length), rows = Math.ceil(frames.length / columns);
    var sheet = makeImage(cellWidth * columns, cellHeight * rows);
    frames.forEach(function (frame, index) {
      var left = (index % columns) * cellWidth, top = Math.floor(index / columns) * cellHeight;
      for (var y = 0; y < cellHeight; y += 1) {
        var sourceStart = y * cellWidth * 4;
        var targetStart = ((top + y) * sheet.width + left) * 4;
        sheet.rgba.set(frame.rgba.subarray(sourceStart, sourceStart + cellWidth * 4), targetStart);
      }
    });
    return { width: sheet.width, height: sheet.height, rgba: sheet.rgba, cell_width: cellWidth, cell_height: cellHeight, columns: columns, rows: rows };
  }

  function countColours(frame, includeTransparent) {
    var colours = new Set();
    for (var index = 0; index < frame.rgba.length; index += 4) {
      if (!includeTransparent && frame.rgba[index + 3] === 0) continue;
      colours.add([frame.rgba[index], frame.rgba[index + 1], frame.rgba[index + 2], frame.rgba[index + 3]].join(","));
    }
    return colours.size;
  }

  return {
    VERSION: VERSION,
    PALETTES: JSON.parse(JSON.stringify(PALETTES)),
    makeImage: makeImage,
    render: render,
    renderFrames: renderFrames,
    renderSheet: renderSheet,
    frameCount: frameCount,
    countColours: countColours,
  };
});
