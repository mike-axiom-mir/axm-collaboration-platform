(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AXMUISensoryRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  function computeNineSlice(sourceWidth, sourceHeight, targetWidth, targetHeight, slice) {
    [sourceWidth, sourceHeight, targetWidth, targetHeight].forEach(function (value) { requireValue(Number.isFinite(value) && value > 0, "nine-slice dimensions must be positive"); });
    requireValue(slice && slice.left + slice.right < sourceWidth && slice.top + slice.bottom < sourceHeight, "nine-slice centre must remain positive");
    var targetLeft = Math.min(slice.left, targetWidth / 2);
    var targetRight = Math.min(slice.right, targetWidth - targetLeft);
    var targetTop = Math.min(slice.top, targetHeight / 2);
    var targetBottom = Math.min(slice.bottom, targetHeight - targetTop);
    var sx = [0, slice.left, sourceWidth - slice.right, sourceWidth];
    var sy = [0, slice.top, sourceHeight - slice.bottom, sourceHeight];
    var dx = [0, targetLeft, targetWidth - targetRight, targetWidth];
    var dy = [0, targetTop, targetHeight - targetBottom, targetHeight];
    var cells = [];
    for (var row = 0; row < 3; row += 1) for (var column = 0; column < 3; column += 1) cells.push({ sx: sx[column], sy: sy[row], sw: sx[column + 1] - sx[column], sh: sy[row + 1] - sy[row], dx: dx[column], dy: dy[row], dw: dx[column + 1] - dx[column], dh: dy[row + 1] - dy[row] });
    return { cells: cells, source: { width: sourceWidth, height: sourceHeight }, target: { width: targetWidth, height: targetHeight }, slice: Object.assign({}, slice) };
  }
  function backgroundStyle(name) {
    if (name === "light") return { fill: "#f4f7fb", grid: "#d5dce7" };
    if (name === "checker") return { fill: "#667085", grid: "#98a2b3" };
    if (name === "game") return { fill: "#193344", grid: "#315f72" };
    return { fill: "#07111f", grid: "#18263b" };
  }
  function paintBackground(context, canvas, name) {
    var style = backgroundStyle(name);
    context.fillStyle = style.fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = style.grid;
    context.lineWidth = 1;
    var step = name === "checker" ? 20 : 40;
    for (var x = 0; x < canvas.width; x += step) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke(); }
    for (var y = 0; y < canvas.height; y += step) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke(); }
  }
  function decodeSvg(svgText) {
    requireValue(typeof Blob === "function" && typeof Image === "function" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && typeof URL.revokeObjectURL === "function", "browser inert-image decode is unavailable");
    return new Promise(function (resolve, reject) {
      var blob = new Blob([svgText], { type: "image/svg+xml" });
      var url = URL.createObjectURL(blob);
      var image = new Image();
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("gated SVG image decode failed")); };
      image.src = url;
    });
  }
  function drawSafeArea(context, rect, mode) {
    if (mode === "none") return;
    var insetX = mode === "tv" ? rect.width * 0.05 : rect.width * 0.08;
    var insetY = mode === "tv" ? rect.height * 0.05 : rect.height * 0.04;
    context.save();
    context.strokeStyle = mode === "tv" ? "#f79009" : "#7f56d9";
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.strokeRect(rect.x + insetX, rect.y + insetY, rect.width - insetX * 2, rect.height - insetY * 2);
    if (mode === "mobile") {
      context.fillStyle = "rgba(127,86,217,.28)";
      context.fillRect(rect.x + rect.width * 0.36, rect.y, rect.width * 0.28, Math.max(8, rect.height * 0.05));
    }
    context.restore();
  }
  function drawFocus(context, rect, recipe, viewer) {
    if (!viewer.focus_visible || !recipe.target.focus_visible) return;
    context.save();
    context.strokeStyle = recipe.target.focus_ring.colour;
    context.lineWidth = recipe.target.focus_ring.width;
    context.setLineDash([recipe.target.focus_ring.width * 2, recipe.target.focus_ring.width]);
    context.strokeRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10);
    context.restore();
  }
  function renderToCanvas(canvas, image, recipe, viewer) {
    requireValue(canvas && typeof canvas.getContext === "function", "canvas is required");
    var context = canvas.getContext("2d");
    requireValue(context, "2D canvas context is required");
    var pixelRatio = Math.max(1, Math.min(2, typeof devicePixelRatio === "number" ? devicePixelRatio : 1));
    var cssWidth = Math.max(320, canvas.clientWidth || 640);
    var cssHeight = Math.max(240, canvas.clientHeight || 420);
    canvas.width = Math.floor(cssWidth * pixelRatio);
    canvas.height = Math.floor(cssHeight * pixelRatio);
    context.scale(pixelRatio, pixelRatio);
    var logical = { width: cssWidth, height: cssHeight };
    paintBackground(context, logical, viewer.background);
    context.imageSmoothingEnabled = true;
    context.filter = viewer.contrast_mode === "high" ? "contrast(1.35) saturate(1.1)" : "none";
    var targetWidth = viewer.render_mode === "nine-slice" ? viewer.stretch_width : recipe.target.dimensions.width;
    var targetHeight = viewer.render_mode === "nine-slice" ? viewer.stretch_height : recipe.target.dimensions.height;
    var state = recipe.states[viewer.component_state];
    var effectiveScale = viewer.reduced_motion_preference ? 1 : state.scale;
    var zoom = viewer.zoom_percent / 100;
    var fit = Math.min((cssWidth - 64) / targetWidth, (cssHeight - 64) / targetHeight, 1.5) * zoom * effectiveScale;
    var width = targetWidth * fit;
    var height = targetHeight * fit;
    var rect = { x: (cssWidth - width) / 2, y: (cssHeight - height) / 2, width: width, height: height };
    context.save();
    context.globalAlpha = state.opacity;
    if (viewer.render_mode === "nine-slice") {
      var layout = computeNineSlice(recipe.target.dimensions.width, recipe.target.dimensions.height, targetWidth, targetHeight, recipe.geometry.nine_slice);
      layout.cells.forEach(function (cell) { context.drawImage(image, cell.sx, cell.sy, cell.sw, cell.sh, rect.x + cell.dx * fit, rect.y + cell.dy * fit, cell.dw * fit, cell.dh * fit); });
      context.strokeStyle = "rgba(255,255,255,.48)";
      context.lineWidth = 1;
      [recipe.geometry.nine_slice.left, targetWidth - recipe.geometry.nine_slice.right].forEach(function (value) { context.beginPath(); context.moveTo(rect.x + value * fit, rect.y); context.lineTo(rect.x + value * fit, rect.y + rect.height); context.stroke(); });
      [recipe.geometry.nine_slice.top, targetHeight - recipe.geometry.nine_slice.bottom].forEach(function (value) { context.beginPath(); context.moveTo(rect.x, rect.y + value * fit); context.lineTo(rect.x + rect.width, rect.y + value * fit); context.stroke(); });
    } else context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    context.restore();
    context.filter = "none";
    drawFocus(context, rect, recipe, viewer);
    drawSafeArea(context, rect, viewer.safe_area);
    return { renderer_id: "axm-ui-inert-svg-canvas-v1", mode: viewer.render_mode, state: viewer.component_state, rect: rect, target_width: targetWidth, target_height: targetHeight, zoom_percent: viewer.zoom_percent, reduced_motion_effective: viewer.reduced_motion_preference, inert_image_decode: true, svg_dom_injected: false };
  }

  return { computeNineSlice: computeNineSlice, decodeSvg: decodeSvg, renderToCanvas: renderToCanvas };
});
