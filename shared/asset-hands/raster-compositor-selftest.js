#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Compositor = require("./raster-compositor");
const RasterCodec = require("./raster-codec");
const Hands = require("./asset-hands");

function solid(colour) {
  const rgba = new Uint8Array(64);
  for (let i = 0; i < rgba.length; i += 4) rgba.set(colour, i);
  return rgba;
}
function layer(id, source, mode = "normal", filters = []) {
  return { id, name: id, visible: true, opacity: 1, blend_mode: mode, offset: { x: 0, y: 0 }, source_artifact_id: source, filters };
}
function recipe(layers, global_filters = []) {
  return { schema: Compositor.RECIPE_SCHEMA, version: "1.0.0", id: "proof", canvas: { width: 4, height: 4, colour_space: "srgb", alpha: true }, layers, global_filters, notes: [] };
}

const sources = {
  red: { width: 4, height: 4, rgba: solid([220, 30, 20, 255]), digest: "red" },
  blue: { width: 4, height: 4, rgba: solid([25, 60, 230, 180]), digest: "blue" },
  mask: { width: 4, height: 4, rgba: solid([128, 128, 128, 128]), digest: "mask" },
};
const masked = layer("blue-mask", "blue", "screen", [{ type: "brightness", value: 0.1 }]);
masked.opacity = 0.8;
masked.mask = { source_artifact_id: "mask", channel: "alpha", invert: false };
const proof = recipe([layer("red-base", "red"), masked], [{ type: "contrast", value: 0.1 }]);
const first = Compositor.compose(proof, sources);
assert.deepEqual(Array.from(first.rgba), Array.from(Compositor.compose(proof, sources).rgba));
assert.equal(first.receipt.status, "PASS");
assert.equal(first.receipt.visual_approval, false);
assert.equal(first.receipt.canonical, false);
assert.notDeepEqual(Array.from(first.rgba), Array.from(Compositor.compose(recipe([masked, layer("red-base", "red")]), sources).rgba));

Compositor.BLEND_MODES.forEach((mode) => {
  assert.equal(Compositor.compose(recipe([layer("red", "red"), layer("blend", "blue", mode)]), sources).rgba.length, 64);
});
[
  { type: "brightness", value: 0.2 }, { type: "contrast", value: 0.2 },
  { type: "saturation", value: 1.4 }, { type: "hue", value: 45 },
  { type: "grayscale", amount: 0.5 }, { type: "invert", amount: 0.5 },
  { type: "gamma", value: 1.8 }, { type: "threshold", value: 0.5 },
  { type: "posterize", levels: 5 }, { type: "tint", colour: "#33AAFF", amount: 0.35 },
  { type: "blur", radius: 1 }, { type: "sharpen", amount: 1 },
  { type: "pixelate", size: 2 },
].forEach((filter) => {
  assert.equal(Compositor.compose(recipe([layer("filtered", "red", "normal", [filter])]), sources).receipt.measures.filters_applied, 1);
});
assert.throws(() => Compositor.compose(recipe([layer("fake", "red", "normal", [{ type: "magic-ai" }])]), sources), /unsupported filter/);
assert.throws(() => Compositor.normalizeRecipe({ ...proof, canvas: { ...proof.canvas, width: 2049 } }), /canvas.width/);

async function integration() {
  const red = RasterCodec.encodeRgba(4, 4, sources.red.rgba, { colourSpace: "srgb" });
  const blue = RasterCodec.encodeRgba(4, 4, sources.blue.rgba, { colourSpace: "srgb" });
  const editRecipe = recipe([layer("red-source", "red-png"), layer("blue-source", "blue-png", "overlay", [{ type: "saturation", value: 1.2 }])]);
  const brief = Hands.normalizeBrief({
    id: "raster-compositor-integration", title: "Raster compositor integration", kind: "illustration",
    operation_mode: "edit", intended_use: "illustration",
    target_canvas: { medium: "screen", dimensions: { width: 4, height: 4, unit: "px" }, colour: { space: "srgb", transparency: "allowed" }, behaviour: ["static"], intended_use: "illustration", performance: { max_file_bytes: 1000000, max_texture_memory_bytes: 1000000 } },
    required_outputs: ["image/png", Compositor.RECIPE_SCHEMA, Compositor.RECEIPT_SCHEMA],
    editable_recipe_formats: [Compositor.RECIPE_SCHEMA],
    source_artifacts: [
      { id: "red-png", role: "layer", name: "Red", mime: "image/png", format: "PNG", dataUrl: red.dataUrl },
      { id: "blue-png", role: "layer", name: "Blue", mime: "image/png", format: "PNG", dataUrl: blue.dataUrl },
      { id: "composition-recipe", role: "recipe", name: "Recipe", mime: "application/json", format: "JSON", content_schema: Compositor.RECIPE_SCHEMA, editable: true, text: JSON.stringify(editRecipe) },
    ],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
  });
  const host = { capabilities: [], permissions: [], accepts: [Hands.RESULT_SCHEMA, "image/png", "application/json", Compositor.RECIPE_SCHEMA, Compositor.RECEIPT_SCHEMA] };
  const options = { host, seed: "raster-compositor-proof", createdAt: "2026-07-22T00:00:00.000Z" };
  const result = await Hands.createAsync("raster-compositor", brief, options);
  assert.equal(result.status, "READY");
  assert.equal(result.hand.id, "raster-compositor");
  assert.equal(result.artifacts.length, 3);
  const png = result.artifacts.find((artifact) => artifact.id === "composited-png");
  assert.equal(RasterCodec.decodeRgba(RasterCodec.bytesFromDataUrl(png.dataUrl, "image/png")).width, 4);
  const receipt = JSON.parse(result.artifacts.find((artifact) => artifact.id === "raster-composition-receipt").text);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.source_artifacts.length, 2);
  assert(receipt.source_artifacts.every((source) => /^[0-9a-f]{64}$/.test(source.sha256)));
  assert(/^[0-9a-f]{64}$/.test(receipt.output.sha256));
  assert.equal(receipt.visual_approval, false);
  assert.equal(result.digest, (await Hands.createAsync("raster-compositor", brief, options)).digest);
  console.log("Raster compositor selftest PASS (14 blends, 13 filters, masks, PNG round-trip, SHA-256 receipts)");
}

integration().catch((error) => { console.error((error && error.stack) || error); process.exitCode = 1; });
