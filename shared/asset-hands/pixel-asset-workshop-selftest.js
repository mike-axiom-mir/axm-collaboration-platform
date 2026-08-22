#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const Hands = require("./asset-hands");
const RasterCodec = require("./raster-codec");
const RasterOperations = require("./raster-operations-core");

function sha256(bytes) {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function sourcePixels() {
  const rgba = new Uint8Array(4 * 4 * 4);
  function set(x, y, colour) {
    rgba.set(colour, (y * 4 + x) * 4);
  }
  set(1, 1, [255, 0, 0, 255]);
  set(2, 1, [0, 255, 0, 255]);
  set(1, 2, [0, 0, 255, 255]);
  set(2, 2, [255, 255, 255, 255]);
  return rgba;
}

const originalImage = RasterOperations.makeImage(4, 4, sourcePixels());
const coreRecipe = {
  schema: RasterOperations.RECIPE_SCHEMA,
  version: "1.0.0",
  id: "pixel-foundation-proof",
  source_artifact_id: "source-png",
  operations: [
    { id: "trim", op: "trim-alpha", parameters: { threshold: 0 } },
    { id: "resize", op: "resize-nearest", parameters: { width: 4, height: 4 } },
    { id: "palette", op: "palette-map", parameters: { palette: ["#000000", "#FFFFFF"] } },
    { id: "alpha", op: "alpha-threshold", parameters: { threshold: 127 } },
    { id: "slice", op: "grid-slice", parameters: { cell_width: 2, cell_height: 2 } },
    { id: "pack", op: "grid-pack", parameters: { columns: 2, padding: 0 } },
  ],
  validation: { max_colours: 2, reject_duplicate_frames: false },
  authority: "candidate-only",
};

const coreRun = RasterOperations.runRecipe(originalImage, coreRecipe);
assert.equal(coreRun.state.kind, "image");
assert.equal(coreRun.retainedFrames.length, 4);
assert.equal(coreRun.roundTrips.length, 1);
assert.equal(coreRun.roundTrips[0].pass, true);
assert.equal(coreRun.analysis.output_palette_counts[0], 2);
assert.ok(coreRun.analysis.duplicate_frame_pairs.length > 0);
assert.ok(RasterOperations.imagesEqual(coreRun.state.image, RasterOperations.runRecipe(originalImage, coreRecipe).state.image));
assert.throws(
  () => RasterOperations.runRecipe(originalImage, { ...coreRecipe, operations: [{ id: "ai", op: "magic-ai", parameters: {} }] }),
  /unsupported raster operation/,
);
assert.throws(
  () => RasterOperations.sliceGrid(originalImage, { cell_width: 3, cell_height: 2 }),
  /dimensions divisible/,
);

async function integration() {
  const sourcePng = RasterCodec.encodeRgba(4, 4, originalImage.rgba, { colourSpace: "srgb" });
  const sourceDigest = sha256(sourcePng.bytes);
  const brief = {
    id: "pixel-asset-workshop-integration",
    title: "Pixel Foundation Proof",
    kind: "sprite",
    operation_mode: "edit",
    intended_use: "sprite",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 4, height: 4, unit: "px" },
      colour: { space: "srgb", transparency: "allowed" },
      behaviour: ["animated"],
      intended_use: "sprite",
      performance: { max_file_bytes: 2000000, max_texture_memory_bytes: 1024, max_animation_frames: 4 },
    },
    required_outputs: ["image/png", RasterOperations.RECIPE_SCHEMA, "axm.pixel-asset-package/v1", "axm.raster-operations-receipt/v1"],
    editable_recipe_formats: [RasterOperations.RECIPE_SCHEMA],
    source_artifacts: [
      { id: "source-png", role: "source", name: "Source PNG", mime: "image/png", format: "PNG", dataUrl: sourcePng.dataUrl, digest: "sha256:" + sourceDigest, metadata: { original_filename: "source.png" } },
      { id: "raster-recipe", role: "recipe", name: "Raster recipe", mime: "application/json", format: "JSON", content_schema: RasterOperations.RECIPE_SCHEMA, editable: true, text: JSON.stringify(coreRecipe) },
    ],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
  };
  const host = {
    capabilities: [],
    permissions: [],
    accepts: [Hands.RESULT_SCHEMA, "image/png", "application/json", RasterOperations.RECIPE_SCHEMA, "axm.pixel-asset-package/v1", "axm.raster-operations-receipt/v1"],
  };
  const options = { host, seed: "pixel-foundation-proof", createdAt: "2026-08-11T00:00:00.000Z" };
  const first = await Hands.createAsync("pixel-asset-workshop", brief, options);
  const second = await Hands.createAsync("pixel-asset-workshop", brief, options);
  assert.equal(first.status, "READY", first.technical.errors.join("; "));
  assert.equal(first.hand.lifecycle_status, "experimental");
  assert.equal(first.artifacts.length, 9);
  assert.equal(first.artifacts.find((artifact) => artifact.id === "immutable-source").dataUrl, sourcePng.dataUrl);
  assert.equal(first.artifacts.find((artifact) => artifact.id === "derived-raster").dataUrl, second.artifacts.find((artifact) => artifact.id === "derived-raster").dataUrl);
  const manifest = JSON.parse(first.artifacts.find((artifact) => artifact.id === "pixel-asset-package").text);
  const receipt = JSON.parse(first.artifacts.find((artifact) => artifact.id === "raster-operations-receipt").text);
  assert.equal(manifest.status, "EXPERIMENTAL");
  assert.equal(manifest.source.sha256, sourceDigest);
  assert.equal(manifest.source.immutable, true);
  assert.equal(manifest.engine.ai_used, false);
  assert.equal(manifest.authority.installed, false);
  assert.equal(manifest.authority.promoted, false);
  assert.equal(manifest.authority.canonical, false);
  assert.equal(manifest.activities.length, coreRecipe.operations.length);
  assert.ok(manifest.activities.every((activity) => activity.deterministic === true));
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.checks.find((check) => check.name === "source-copy-byte-identical").pass, true);
  assert.equal(receipt.checks.find((check) => check.name === "same-source-recipe-pixel-repeat").pass, true);
  assert.equal(receipt.checks.find((check) => check.name === "slice-pack-pixel-roundtrip").pass, true);
  assert.ok(receipt.outputs.every((output) => /^[0-9a-f]{64}$/.test(output.sha256)));

  const badBrief = JSON.parse(JSON.stringify(brief));
  badBrief.source_artifacts[0].digest = "sha256:" + "0".repeat(64);
  await assert.rejects(() => Hands.createAsync("pixel-asset-workshop", badBrief, options), /does not match the supplied digest/);
}

integration()
  .then(() => {
    console.log("AXM Pixel Asset Workshop selftest PASS (immutable PNG source, explicit deterministic raster recipe, SHA-256 lineage, palette/grid validation, slice-pack pixel roundtrip, visible AI/import gaps)");
  })
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
