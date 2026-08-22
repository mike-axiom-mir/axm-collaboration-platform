#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const path = require("path");
const { pathToFileURL } = require("url");
const Hands = require("./asset-hands");
const ArtifactSchemas = require("./artifact-schema-catalog");
const RasterCodec = require("./raster-codec");
const Raster = require("./raster-operations-core");
const PixelAnimation = require("./pixel-animation-core");

function sha256(bytes) {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

const colours = {
  red: [228, 63, 90, 255],
  white: [249, 247, 243, 255],
  green: [47, 199, 116, 255],
  yellow: [245, 196, 81, 255],
};

function animationSheet() {
  const width = 32;
  const height = 8;
  const rgba = new Uint8Array(width * height * 4);
  function set(frame, x, y, colour) {
    rgba.set(colour, (y * width + frame * 8 + x) * 4);
  }
  for (let frame = 0; frame < 4; frame += 1) {
    const body = frame < 2 ? colours.red : colours.green;
    for (let y = 2; y <= 6; y += 1) {
      for (let x = 2; x <= 5; x += 1) set(frame, x, y, body);
    }
    set(frame, 3 + (frame % 2), 3, colours.white);
    set(frame, 2 + (frame % 2), 7, frame % 2 ? colours.yellow : body);
    set(frame, 5 - (frame % 2), 7, frame % 2 ? body : colours.yellow);
  }
  return Raster.makeImage(width, height, rgba);
}

const rawRecipe = {
  schema: PixelAnimation.RECIPE_SCHEMA,
  id: "retro-hero-animation",
  source_artifact_id: "source-sheet",
  profile: "pixel-8bit",
  sheet: { cell_width: 8, cell_height: 8 },
  frames: [
    { id: "idle-down-0", cell_index: 0, animation: "Idle", direction: "down", index: 0, duration_ms: 200, pivot: { x: 0.5, y: 1, unit: "normalized" }, tags: ["idle"] },
    { id: "idle-down-1", cell_index: 1, animation: "Idle", direction: "down", index: 1, duration_ms: 300, pivot: { x: 0.5, y: 1, unit: "normalized" }, tags: ["idle"], events: [{ id: "blink", name: "blink", at_ms: 100, data: { eye: "right" } }] },
    { id: "walk-down-0", cell_index: 2, animation: "Walk", direction: "down", index: 0, duration_ms: 100, pivot: { x: 0.5, y: 1, unit: "normalized" }, tags: ["locomotion"], events: [{ id: "foot-left", name: "foot-left", at_ms: 50, data: {} }] },
    { id: "walk-down-1", cell_index: 3, animation: "Walk", direction: "down", index: 1, duration_ms: 150, pivot: { x: 0.5, y: 1, unit: "normalized" }, tags: ["locomotion"], events: [{ id: "foot-right", name: "foot-right", at_ms: 75, data: {} }] },
  ],
  clips: [
    { id: "idle-down", runtime_name: "Idle|down", animation: "Idle", direction: "down", frame_ids: ["idle-down-0", "idle-down-1"], playback: { mode: "loop", order: "forward", repeat_count: 0 }, tags: ["idle"] },
    { id: "walk-down", runtime_name: "Walk|down", animation: "Walk", direction: "down", frame_ids: ["walk-down-0", "walk-down-1"], playback: { mode: "loop", order: "forward", repeat_count: 0 }, tags: ["locomotion"] },
  ],
  palette: { enforcement: "exact", max_colours: 4, colours: ["#E43F5A", "#F9F7F3", "#2FC774", "#F5C451"], include_transparent: false },
  preview: { emit_integer_preview: true, integer_scale: 4, background: "#132238" },
  video: { emit_sequence: true, cycles: 2 },
  validation: { reject_duplicate_frames: true, max_clip_duration_ms: 2000 },
  provenance: {
    author_type: "program",
    actor_id: "pixel-animation-selftest",
    parent_package_id: "pixel-package-parent",
    parent_recipe_id: "pixel-foundation-proof",
    contributors: [{ id: "fixture-author", type: "program", role: "fixture", tool: "node", version: process.version }],
  },
  authority: "candidate-only",
};

const sheet = animationSheet();
const extraction = PixelAnimation.extractFrames(sheet, rawRecipe);
const recipe = extraction.recipe;
const analysis = PixelAnimation.inspectFrames(extraction);
assert.equal(recipe.profile.id, "pixel-8bit");
assert.equal(recipe.profile.interpretation, "workflow-preset-not-hardware-emulation");
assert.equal(recipe.profile.max_colours, 16);
assert.equal(recipe.sheet.columns, 4);
assert.equal(recipe.sheet.rows, 1);
assert.equal(recipe.frames.length, 4);
assert.equal(recipe.clips.length, 2);
assert.equal(recipe.clips[0].duration_ms, 500);
assert.equal(analysis.palette_limit_pass, true);
assert.equal(analysis.exact_palette_pass, true);
assert.equal(analysis.duplicate_policy_pass, true);
assert.equal(recipe.provenance.ai_used, false);
assert.ok(extraction.frames.every((frame) => frame.image.width === 8 && frame.image.height === 8));
assert.equal(PixelAnimation.sampleClip(recipe, "idle-down", 0).frame_id, "idle-down-0");
assert.equal(PixelAnimation.sampleClip(recipe, "idle-down", 199).frame_id, "idle-down-0");
assert.equal(PixelAnimation.sampleClip(recipe, "idle-down", 200).frame_id, "idle-down-1");
assert.equal(PixelAnimation.sampleClip(recipe, "idle-down", 499).frame_id, "idle-down-1");
assert.equal(PixelAnimation.sampleClip(recipe, "idle-down", 500).frame_id, "idle-down-0");

const sixteenBitProfile = PixelAnimation.normalizeRecipe({
  schema: PixelAnimation.RECIPE_SCHEMA,
  id: "sixteen-bit-proof",
  source_artifact_id: "source-16",
  profile: "pixel-16bit",
  sheet: { cell_width: 16, cell_height: 16 },
  frames: [
    { id: "frame-a", cell_index: 0, animation: "Idle", direction: "right", index: 0 },
    { id: "frame-b", cell_index: 1, animation: "Idle", direction: "right", index: 1 },
  ],
  clips: [{ id: "idle-right", animation: "Idle", direction: "right", frame_ids: ["frame-a", "frame-b"] }],
  provenance: { author_type: "human", actor_id: "mike", contributors: [] },
}, { width: 32, height: 16 });
assert.equal(sixteenBitProfile.profile.id, "pixel-16bit");
assert.equal(sixteenBitProfile.profile.max_colours, 64);
assert.equal(sixteenBitProfile.frames[0].duration_ms, 83);
assert.equal(sixteenBitProfile.preview.integer_scale, 4);

const pingPong = PixelAnimation.normalizeRecipe({
  schema: PixelAnimation.RECIPE_SCHEMA,
  id: "ping-pong-proof",
  source_artifact_id: "source-ping",
  profile: "pixel-custom",
  sheet: { cell_width: 8, cell_height: 8 },
  frames: [0, 1, 2].map((cell, index) => ({ id: "ping-" + index, cell_index: cell, animation: "Pulse", direction: "none", index, duration_ms: 50 + index * 10 })),
  clips: [{ id: "pulse", animation: "Pulse", direction: "none", frame_ids: ["ping-0", "ping-1", "ping-2"], playback: { mode: "loop", order: "ping-pong", repeat_count: 0 } }],
  provenance: { author_type: "ai", actor_id: "proposal-agent", contributors: [] },
}, { width: 24, height: 8 });
assert.deepEqual(PixelAnimation.orderedFrameIds(pingPong, "pulse"), ["ping-0", "ping-1", "ping-2", "ping-1"]);
assert.equal(pingPong.clips[0].duration_ms, 240);
assert.equal(pingPong.provenance.ai_used, true);

assert.throws(
  () => PixelAnimation.normalizeRecipe({ ...rawRecipe, sheet: { cell_width: 7, cell_height: 8 } }, { width: 32, height: 8 }),
  /trailing pixels|exactly cover/,
);
assert.throws(
  () => PixelAnimation.normalizeRecipe({ ...rawRecipe, clips: [{ ...rawRecipe.clips[0], frame_ids: ["idle-down-0", "missing-frame"] }, rawRecipe.clips[1]] }, { width: 32, height: 8 }),
  /references missing frame/,
);

async function integration() {
  const sourcePng = RasterCodec.encodeRgba(sheet.width, sheet.height, sheet.rgba, { colourSpace: "srgb" });
  const sourceDigest = sha256(sourcePng.bytes);
  const recipeText = JSON.stringify(recipe);
  const parentPackage = {
    schema: "axm.pixel-asset-package/v1",
    version: "1.0.0",
    status: "EXPERIMENTAL",
    id: "pixel-package-parent",
    source: { sha256: "0".repeat(64) },
    recipe: {},
    entities: [],
    activities: [],
    assets: [{ id: "derived-raster", sha256: sourceDigest }],
    analysis: {},
    engine: {},
    authority: { candidate_only: true, installed: false, promoted: false, canonical: false },
  };
  const brief = {
    id: "pixel-animation-integration",
    title: "Retro Hero Animation",
    kind: "character",
    operation_mode: "workflow",
    intended_use: "character",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 8, height: 8, unit: "px" },
      colour: { space: "srgb", transparency: "required" },
      behaviour: ["animated"],
      intended_use: "character",
      performance: { max_file_bytes: 20000000, max_texture_memory_bytes: 2048, max_animation_frames: 4, max_duration_seconds: 1 },
    },
    required_outputs: ["image/png", "image/apng", PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA, PixelAnimation.RECEIPT_SCHEMA],
    editable_recipe_formats: [PixelAnimation.RECIPE_SCHEMA],
    source_artifacts: [
      { id: "source-sheet", role: "source", name: "Source sprite sheet", mime: "image/png", format: "PNG", dataUrl: sourcePng.dataUrl, digest: "sha256:" + sourceDigest, metadata: { original_filename: "hero-sheet.png" } },
      { id: "animation-recipe-source", role: "recipe", name: "Pixel animation recipe", mime: "application/json", format: "JSON", content_schema: PixelAnimation.RECIPE_SCHEMA, editable: true, text: recipeText, digest: "sha256:" + sha256(Buffer.from(recipeText)), metadata: {} },
      { id: "parent-package-source", role: "parent-package", name: "Parent pixel package", mime: "application/json", format: "JSON", content_schema: "axm.pixel-asset-package/v1", editable: false, text: JSON.stringify(parentPackage), digest: "sha256:" + sha256(Buffer.from(JSON.stringify(parentPackage))), metadata: {} },
    ],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
  };
  const host = {
    capabilities: [],
    permissions: [],
    accepts: [Hands.RESULT_SCHEMA, "image/png", "image/apng", "application/json", PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA, PixelAnimation.RECEIPT_SCHEMA],
  };
  const options = { host, seed: "pixel-animation-proof", createdAt: "2026-08-11T00:00:00.000Z" };
  const first = await Hands.createAsync("pixel-animation-workshop", brief, options);
  const second = await Hands.createAsync("pixel-animation-workshop", brief, options);
  assert.equal(first.status, "READY", first.technical.errors.join("; "));
  assert.equal(first.hand.lifecycle_status, "experimental");
  assert.equal(first.artifacts.length, 13);
  assert.equal(first.preview.mime, "image/apng");
  assert.equal(first.artifacts.find((artifact) => artifact.id === "immutable-animation-sheet").dataUrl, sourcePng.dataUrl);
  assert.deepEqual(first.artifacts.map((artifact) => artifact.dataUrl || artifact.text), second.artifacts.map((artifact) => artifact.dataUrl || artifact.text));
  const preview = first.artifacts.find((artifact) => artifact.id === "animation-preview-idle-down");
  assert.equal(preview.width, 32);
  assert.equal(preview.height, 32);
  assert.equal(preview.metadata.integerScale, 4);
  const native = first.artifacts.find((artifact) => artifact.id === "animation-clip-idle-down");
  const nativeInspection = RasterCodec.inspectApng(RasterCodec.bytesFromDataUrl(native.dataUrl, "image/apng"));
  assert.equal(nativeInspection.pass, true);
  assert.deepEqual(nativeInspection.delays.map((delay) => [delay.numerator, delay.denominator]), [[200, 1000], [300, 1000]]);
  assert.equal(nativeInspection.durationMs, 500);
  const manifest = JSON.parse(first.artifacts.find((artifact) => artifact.id === "sprite-animation-manifest").text);
  const video = JSON.parse(first.artifacts.find((artifact) => artifact.id === "pixel-video-sequence").text);
  const receipt = JSON.parse(first.artifacts.find((artifact) => artifact.id === "pixel-animation-receipt").text);
  assert.equal(ArtifactSchemas.validate(manifest.schema, manifest).pass, true);
  assert.equal(ArtifactSchemas.validate(video.schema, video).pass, true);
  assert.equal(ArtifactSchemas.validate(receipt.schema, receipt).pass, true);
  assert.equal(manifest.profile.id, "pixel-8bit");
  assert.equal(manifest.profile.interpretation, "workflow-preset-not-hardware-emulation");
  assert.equal(manifest.source.parent_package_id, parentPackage.id);
  assert.equal(manifest.game_adapter.contract, "axm.game-animation-graph/v1");
  assert.equal(manifest.game_adapter.clips.length, 2);
  assert.equal(manifest.authority.installed, false);
  assert.equal(manifest.authority.promoted, false);
  assert.equal(manifest.authority.canonical, false);
  assert.equal(video.sequences.length, 2);
  assert.equal(video.sequences.find((sequence) => sequence.clip_id === "idle-down").duration_ms, 1000);
  assert.ok(video.sequences.every((sequence) => sequence.segments.every((segment) => segment.artifact_id && /^[0-9a-f]{64}$/.test(segment.sha256))));
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.checks.find((check) => check.name === "optional-parent-package-bound").pass, true);
  assert.equal(receipt.checks.find((check) => check.name === "game-animation-adapter").pass, true);
  assert.equal(receipt.checks.find((check) => check.name === "video-sequence-timing-and-artifact-binding").pass, true);
  assert.equal(receipt.checks.find((check) => check.name === "repeat-extraction-pixel-equality").pass, true);

  const GameAnimation = await import(pathToFileURL(path.join(__dirname, "../game-animation-foundation/animation-spine.mjs")).href);
  const gameClips = PixelAnimation.toGameAnimationClips(recipe);
  const graph = GameAnimation.buildHumanoidGameplayGraph(gameClips, { id: "pixel-game-adapter-proof" });
  const controller = GameAnimation.createAnimationController(graph);
  assert.equal(PixelAnimation.sampleGameAnimationFrame(recipe, controller.snapshot()).frame_id, "idle-down-0");
  controller.setParameter("speed", 1);
  const transitioned = controller.update(16);
  assert.equal(transitioned.state, "walk");
  assert.equal(PixelAnimation.sampleGameAnimationFrame(recipe, transitioned).frame_id, "walk-down-0");

  const sixteenFrames = extraction.frames.slice(0, 2).map((frame) =>
    Raster.resizeNearest(frame.image, { width: 16, height: 16 }),
  );
  const sixteenSheet = Raster.packGrid(sixteenFrames, { columns: 2, padding: 0 }).image;
  const sixteenPng = RasterCodec.encodeRgba(sixteenSheet.width, sixteenSheet.height, sixteenSheet.rgba, { colourSpace: "srgb" });
  const sixteenDigest = sha256(sixteenPng.bytes);
  const sixteenRecipe = {
    schema: PixelAnimation.RECIPE_SCHEMA,
    id: "sixteen-bit-animation-integration",
    source_artifact_id: "source-16-sheet",
    profile: "pixel-16bit",
    sheet: { cell_width: 16, cell_height: 16 },
    frames: [
      { id: "idle-right-0", cell_index: 0, animation: "Idle", direction: "right", index: 0 },
      { id: "idle-right-1", cell_index: 1, animation: "Idle", direction: "right", index: 1 },
    ],
    clips: [{ id: "idle-right", runtime_name: "Idle|right", animation: "Idle", direction: "right", frame_ids: ["idle-right-0", "idle-right-1"], playback: { mode: "loop", order: "forward", repeat_count: 0 } }],
    palette: { enforcement: "exact", max_colours: 4, colours: ["#E43F5A", "#F9F7F3", "#F5C451"], include_transparent: false },
    provenance: { author_type: "human", actor_id: "profile-proof", contributors: [] },
  };
  const normalizedSixteenRecipe = PixelAnimation.normalizeRecipe(sixteenRecipe, {
    width: sixteenSheet.width,
    height: sixteenSheet.height,
  });
  const sixteenRecipeText = JSON.stringify(normalizedSixteenRecipe);
  const sixteenBrief = {
    id: "pixel-animation-16bit-integration",
    title: "Sixteen Bit Profile Animation",
    kind: "character",
    operation_mode: "workflow",
    intended_use: "character",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 16, height: 16, unit: "px" },
      colour: { space: "srgb", transparency: "required" },
      behaviour: ["animated"],
      intended_use: "character",
      performance: { max_file_bytes: 20000000, max_texture_memory_bytes: 4096, max_animation_frames: 2, max_duration_seconds: 1 },
    },
    required_outputs: ["image/png", "image/apng", PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA, PixelAnimation.RECEIPT_SCHEMA],
    editable_recipe_formats: [PixelAnimation.RECIPE_SCHEMA],
    source_artifacts: [
      { id: "source-16-sheet", role: "source", name: "16-bit profile sheet", mime: "image/png", format: "PNG", dataUrl: sixteenPng.dataUrl, digest: "sha256:" + sixteenDigest, metadata: {} },
      { id: "animation-16-recipe", role: "recipe", name: "16-bit profile recipe", mime: "application/json", format: "JSON", content_schema: PixelAnimation.RECIPE_SCHEMA, editable: true, text: sixteenRecipeText, digest: "sha256:" + sha256(Buffer.from(sixteenRecipeText)), metadata: {} },
    ],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
  };
  const sixteenResult = await Hands.createAsync("pixel-animation-workshop", sixteenBrief, options);
  assert.equal(sixteenResult.status, "READY", sixteenResult.technical.errors.join("; "));
  const sixteenManifest = JSON.parse(sixteenResult.artifacts.find((artifact) => artifact.id === "sprite-animation-manifest").text);
  const sixteenNative = sixteenResult.artifacts.find((artifact) => artifact.id === "animation-clip-idle-right");
  const sixteenInspection = RasterCodec.inspectApng(RasterCodec.bytesFromDataUrl(sixteenNative.dataUrl, "image/apng"));
  assert.equal(sixteenManifest.profile.id, "pixel-16bit");
  assert.equal(sixteenManifest.profile.max_colours, 64);
  assert.deepEqual(sixteenInspection.delays.map((delay) => delay.durationMs), [83, 83]);

  const badPaletteBrief = JSON.parse(JSON.stringify(brief));
  const badPaletteRecipe = JSON.parse(JSON.stringify(recipe));
  badPaletteRecipe.palette.colours = ["#E43F5A", "#F9F7F3", "#F5C451"];
  badPaletteRecipe.provenance.parent_package_id = "pixel-package-parent";
  const badPaletteText = JSON.stringify(badPaletteRecipe);
  badPaletteBrief.source_artifacts[1].text = badPaletteText;
  badPaletteBrief.source_artifacts[1].digest = "sha256:" + sha256(Buffer.from(badPaletteText));
  const held = await Hands.createAsync("pixel-animation-workshop", badPaletteBrief, options);
  assert.equal(held.status, "HOLD");
  assert.equal(held.validation_receipt.checks.find((check) => check.name === "exact-palette").pass, false);

  const mismatchedParentBrief = JSON.parse(JSON.stringify(brief));
  const mismatchedRecipe = JSON.parse(JSON.stringify(recipe));
  mismatchedRecipe.provenance.parent_package_id = "wrong-parent";
  const mismatchedRecipeText = JSON.stringify(mismatchedRecipe);
  mismatchedParentBrief.source_artifacts[1].text = mismatchedRecipeText;
  mismatchedParentBrief.source_artifacts[1].digest = "sha256:" + sha256(Buffer.from(mismatchedRecipeText));
  await assert.rejects(() => Hands.createAsync("pixel-animation-workshop", mismatchedParentBrief, options), /explicitly bind the supplied parent package id/);
}

integration()
  .then(() => {
    console.log("AXM Pixel Animation Workshop selftest PASS (8-bit/16-bit workflow profiles, frame metadata, variable timing, integer previews, parent lineage, game-spine sampling, video-sequence bridge, deterministic APNG/PNG/JSON outputs, visible AI and authority boundaries)");
  })
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
