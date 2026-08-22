(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports ? require("./choice-first-core") : root.AXMChoiceFirstCore,
    typeof module === "object" && module.exports ? require("./choice-first-pilot-core") : root.AXMChoiceFirstPilotCore,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMChoiceFirstFilmCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Choice, Pilot) {
  "use strict";
  if (!Choice || !Pilot) throw new Error("choice-first film dependencies are required");
  var VERSION = "1.0.0";
  var WIDTH = 640, HEIGHT = 360, FPS = 12, FRAMES = 240, UNIQUE_PHASES = 8;
  var FONT = {
    " ":["00000","00000","00000","00000","00000","00000","00000"],
    "A":["01110","10001","10001","11111","10001","10001","10001"], "B":["11110","10001","10001","11110","10001","10001","11110"],
    "C":["01111","10000","10000","10000","10000","10000","01111"], "D":["11110","10001","10001","10001","10001","10001","11110"],
    "E":["11111","10000","10000","11110","10000","10000","11111"], "F":["11111","10000","10000","11110","10000","10000","10000"],
    "G":["01111","10000","10000","10111","10001","10001","01111"], "H":["10001","10001","10001","11111","10001","10001","10001"],
    "I":["11111","00100","00100","00100","00100","00100","11111"], "J":["00111","00010","00010","00010","10010","10010","01100"],
    "K":["10001","10010","10100","11000","10100","10010","10001"], "L":["10000","10000","10000","10000","10000","10000","11111"],
    "M":["10001","11011","10101","10101","10001","10001","10001"], "N":["10001","11001","10101","10011","10001","10001","10001"],
    "O":["01110","10001","10001","10001","10001","10001","01110"], "P":["11110","10001","10001","11110","10000","10000","10000"],
    "Q":["01110","10001","10001","10001","10101","10010","01101"], "R":["11110","10001","10001","11110","10100","10010","10001"],
    "S":["01111","10000","10000","01110","00001","00001","11110"], "T":["11111","00100","00100","00100","00100","00100","00100"],
    "U":["10001","10001","10001","10001","10001","10001","01110"], "V":["10001","10001","10001","10001","10001","01010","00100"],
    "W":["10001","10001","10001","10101","10101","10101","01010"], "X":["10001","10001","01010","00100","01010","10001","10001"],
    "Y":["10001","10001","01010","00100","00100","00100","00100"], "Z":["11111","00001","00010","00100","01000","10000","11111"],
    "+":["00000","00100","00100","11111","00100","00100","00000"], "/":["00001","00010","00010","00100","01000","01000","10000"],
    ".":["00000","00000","00000","00000","00000","01100","01100"], ",":["00000","00000","00000","00000","01100","01100","01000"],
    "-":["00000","00000","00000","11111","00000","00000","00000"], ":":["00000","01100","01100","00000","01100","01100","00000"],
    "0":["01110","10001","10011","10101","11001","10001","01110"], "1":["00100","01100","00100","00100","00100","00100","01110"],
    "2":["01110","10001","00001","00010","00100","01000","11111"], "3":["11110","00001","00001","01110","00001","00001","11110"],
    "4":["00010","00110","01010","10010","11111","00010","00010"], "5":["11111","10000","10000","11110","00001","00001","11110"],
    "6":["01110","10000","10000","11110","10001","10001","01110"], "7":["11111","00001","00010","00100","01000","01000","01000"],
    "8":["01110","10001","10001","01110","10001","10001","01110"], "9":["01110","10001","10001","01111","00001","00001","01110"],
  };

  function rgba(hex) {
    var value = String(hex).replace("#", "");
    if (value.length === 6) value += "FF";
    return [0, 2, 4, 6].map(function (offset) { return parseInt(value.slice(offset, offset + 2), 16); });
  }

  function canvas(colour) {
    var out = new Uint8Array(WIDTH * HEIGHT * 4), bytes = rgba(colour);
    for (var index = 0; index < out.length; index += 4) out.set(bytes, index);
    return out;
  }

  function setPixel(target, x, y, colour) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    var source = Array.isArray(colour) ? colour : rgba(colour);
    if (source[3] === 0) return;
    target.set(source, (y * WIDTH + x) * 4);
  }

  function rect(target, x, y, width, height, colour) {
    var bytes = Array.isArray(colour) ? colour : rgba(colour);
    for (var py = Math.max(0, Math.round(y)); py < Math.min(HEIGHT, Math.round(y + height)); py += 1) for (var px = Math.max(0, Math.round(x)); px < Math.min(WIDTH, Math.round(x + width)); px += 1) setPixel(target, px, py, bytes);
  }

  function line(target, x0, y0, x1, y1, colour, thickness) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, error = dx + dy, radius = Math.floor((thickness || 1) / 2);
    while (true) {
      rect(target, x0 - radius, y0 - radius, radius * 2 + 1, radius * 2 + 1, colour);
      if (x0 === x1 && y0 === y1) break;
      var twice = error * 2;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
  }

  function blit(target, sprite, x, y, scale) {
    scale = Math.max(1, Math.round(scale));
    for (var sy = 0; sy < sprite.height; sy += 1) for (var sx = 0; sx < sprite.width; sx += 1) {
      var offset = (sy * sprite.width + sx) * 4;
      if (sprite.rgba[offset + 3] === 0) continue;
      var colour = [sprite.rgba[offset], sprite.rgba[offset + 1], sprite.rgba[offset + 2], sprite.rgba[offset + 3]];
      rect(target, x + sx * scale, y + sy * scale, scale, scale, colour);
    }
  }

  function textWidth(text, scale) {
    return Math.max(0, String(text).length * 6 * scale - scale);
  }

  function drawText(target, text, x, y, scale, colour, shadow) {
    text = String(text).toUpperCase();
    if (shadow) drawText(target, text, x + scale, y + scale, scale, shadow, null);
    for (var charIndex = 0; charIndex < text.length; charIndex += 1) {
      var glyph = FONT[text[charIndex]] || FONT[" "];
      for (var row = 0; row < 7; row += 1) for (var column = 0; column < 5; column += 1) if (glyph[row][column] === "1") rect(target, x + charIndex * 6 * scale + column * scale, y + row * scale, scale, scale, colour);
    }
  }

  function backdrop(target, scene, phase) {
    var top = ["#101827", "#131D31", "#102437", "#17213A", "#0D1B2A"][scene];
    rect(target, 0, 0, WIDTH, HEIGHT, top);
    for (var band = 0; band < 6; band += 1) rect(target, 0, 56 + band * 42, WIDTH, 42, band % 2 ? "#162B40" : "#1A3347");
    rect(target, 0, 302, WIDTH, 58, "#0A111D");
    for (var grid = -80; grid < 720; grid += 64) line(target, grid + phase * 2, 302, grid + 82 + phase * 2, 228, "#315A7D", 2);
    line(target, 0, 302, WIDTH, 302, "#F9C74F", 3);
    rect(target, 24, 22, 96, 8, "#F9C74F");
    rect(target, 24, 34, 54, 4, "#43AA8B");
    drawText(target, "AXM / VISUAL CHOICE", 395, 25, 2, "#7DD3FC", "#111827");
  }

  function caption(target, lines, accent) {
    var scale = lines.some(function (line) { return line.length > 28; }) ? 3 : 4;
    var totalHeight = lines.length * (8 * scale) - scale;
    var startY = 325 - totalHeight;
    rect(target, 20, startY - 12, 600, totalHeight + 22, "#111827");
    rect(target, 20, startY - 12, 8, totalHeight + 22, accent || "#F9C74F");
    lines.forEach(function (line, index) { drawText(target, line, 42, startY + index * 8 * scale, scale, "#F8FAFC", "#263859"); });
  }

  function iconPerson(target, x, y, colour) {
    rect(target, x + 12, y, 16, 16, colour); rect(target, x + 6, y + 18, 28, 30, colour); rect(target, x, y + 24, 8, 26, colour); rect(target, x + 32, y + 24, 8, 26, colour);
  }

  function iconProgram(target, x, y, colour) {
    rect(target, x, y, 48, 42, colour); rect(target, x + 5, y + 5, 38, 32, "#111827"); drawText(target, ">_", x + 10, y + 14, 3, colour, null);
  }

  function upgradedSofa() {
    var sofa = Choice.createStarterSofa("film-sofa");
    var resources = { money: 1000, labour_hours: 40, materials: { fasteners: 30, hardwood: 20, textile: 30, filling: 20, springs: 20, sealant: 5, mechanism: 4, cleaner: 10 } };
    ["frame-reinforced-beech", "cushion-cotton-soft", "upholstery-warm-velvet", "utility-underseat-storage"].forEach(function (id) { var result = Choice.applySofaUpgrade(sofa, id, resources); sofa = result.object; resources = result.resources; });
    return sofa;
  }

  function renderScene(scene, phase) {
    var target = canvas("#101827");
    backdrop(target, scene, phase);
    var ferris8 = Pilot.render("axm.park.ferris-wheel", "pixel-8bit", phase, {});
    var ferris16 = Pilot.render("axm.park.ferris-wheel", "pixel-16bit", phase, {});
    var carousel16 = Pilot.render("axm.park.carousel-horse", "pixel-16bit", phase, {});
    var gate8 = Pilot.render("axm.park.ticket-gate", "pixel-8bit", phase, {});
    var gate16 = Pilot.render("axm.park.ticket-gate", "pixel-16bit", phase, {});
    if (scene === 0) {
      blit(target, gate8, 220, 72, 4);
      drawText(target, "ONE TRUE GATE", 52, 90, 3, "#F9C74F", "#111827");
      caption(target, ["START SMALL."], "#F9C74F");
    } else if (scene === 1) {
      blit(target, ferris8, 190, 56, 5);
      drawText(target, "ID / STATE / HISTORY", 42, 68, 3, "#43AA8B", "#111827");
      caption(target, ["PRESERVE WHAT IS TRUE."], "#43AA8B");
    } else if (scene === 2) {
      rect(target, 318, 50, 4, 226, "#F9C74F");
      blit(target, ferris8, 68, 78, 4);
      blit(target, ferris16, 370, 72, 2);
      drawText(target, "8-BIT", 106, 58, 3, "#7DD3FC", "#111827");
      drawText(target, "16-BIT", 414, 58, 3, "#F9C74F", "#111827");
      caption(target, ["ADD CAPABILITY."], "#F9844A");
    } else if (scene === 3) {
      blit(target, gate16, 52, 106, 1);
      blit(target, carousel16, 492, 102, 1);
      iconPerson(target, 225, 106, "#F9C74F");
      drawText(target, "HUMAN", 200, 168, 2, "#F8FAFC", "#111827");
      rect(target, 304, 105, 48, 48, "#6D4C9F");
      drawText(target, "AI", 313, 120, 3, "#F8FAFC", null);
      iconProgram(target, 390, 108, "#43AA8B");
      caption(target, ["HUMAN + AI + PROGRAM", "SAME CONTRACT."], "#6D4C9F");
    } else {
      var sofa = Pilot.render("axm.home.starter-sofa", "pixel-16bit", phase, { sofa: upgradedSofa() });
      blit(target, ferris16, 30, 70, 2);
      blit(target, carousel16, 224, 84, 2);
      blit(target, sofa, 422, 92, 2);
      drawText(target, "AXM", 257, 47, 7, "#F9C74F", "#111827");
      caption(target, ["BUILD BY CHOICE,", "NOT BY LIMIT."], "#F9C74F");
    }
    return target;
  }

  function build() {
    var uniqueFrames = [];
    for (var scene = 0; scene < 5; scene += 1) for (var phase = 0; phase < UNIQUE_PHASES; phase += 1) uniqueFrames.push(renderScene(scene, phase));
    var sequence = [];
    for (var frame = 0; frame < FRAMES; frame += 1) {
      var sceneIndex = Math.min(4, Math.floor(frame / 48));
      var local = frame % 48;
      var phaseIndex = Math.floor((local % 12) * UNIQUE_PHASES / 12);
      sequence.push(sceneIndex * UNIQUE_PHASES + phaseIndex);
    }
    var cues = [
      { start: "00:00:00.000", end: "00:00:04.000", text: "START SMALL." },
      { start: "00:00:04.000", end: "00:00:08.000", text: "PRESERVE WHAT IS TRUE." },
      { start: "00:00:08.000", end: "00:00:12.000", text: "ADD CAPABILITY." },
      { start: "00:00:12.000", end: "00:00:16.000", text: "HUMAN + AI + PROGRAM / SAME CONTRACT." },
      { start: "00:00:16.000", end: "00:00:20.000", text: "AXM / BUILD BY CHOICE, NOT BY LIMIT." },
    ];
    var vtt = "WEBVTT\n\n" + cues.map(function (cue, index) { return (index + 1) + "\n" + cue.start + " --> " + cue.end + "\n" + cue.text + "\n"; }).join("\n");
    return {
      uniqueFrames: uniqueFrames,
      sequence: sequence,
      vtt: vtt,
      recipe: {
        schema: "axm.choice-first-pixel-film/v1",
        version: "1.0.0",
        status: "EXPERIMENTAL",
        id: "axm-choice-first-pixel-explainer",
        dimensions: { width: WIDTH, height: HEIGHT, unit: "px" },
        frame_rate: { numerator: FPS, denominator: 1 },
        frames: FRAMES,
        unique_frames: uniqueFrames.length,
        duration_seconds: FRAMES / FPS,
        captions: cues,
        sequence_contract: "sparse-indexed-unique-rgba-frames",
        audio: false,
        provenance: { renderer: "AXMChoiceFirstFilmCore", version: VERSION, bitmap_text: true, original_programmatic_visuals: true },
        authority: Choice.authority(),
      },
    };
  }

  return { VERSION: VERSION, WIDTH: WIDTH, HEIGHT: HEIGHT, FPS: FPS, FRAMES: FRAMES, UNIQUE_PHASES: UNIQUE_PHASES, renderScene: renderScene, build: build, drawText: drawText, textWidth: textWidth };
});
