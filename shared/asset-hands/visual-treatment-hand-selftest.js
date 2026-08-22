"use strict";
const assert = require("node:assert/strict");
const Hands = require("./asset-hands");
const Treatment = require("./visual-treatment-core");

const request = {
  schema: Treatment.SCHEMAS.request,
  version: "1.0.0",
  id: "hand-treatment-proof",
  identity_id: "axm.park.carousel-horse",
  profile_id: "pixel-16bit-3d",
  animation_state: "running",
  style_layers: [{ id: "character-comic-vanguard", weight: 0.82 }, { id: "neon-paper-selective", weight: 0.55 }],
  effect_modules: [{ id: "light.neon-edge-glow", params: { intensity: 0.62 } }, { id: "depth.layered-shadow", params: {} }],
  material_family: "painted-metal",
  story: { title: "COMIC HORSE / NEON NIGHT", nodes: [{ id: "horse", caption: "ONE HORSE, ANOTHER DIRECTION.", duration_s: 2, focus_component: "horse-root" }] },
  accessibility: { reduced_motion: false, high_contrast: true, effect_scale: 0.8 },
  authority: "candidate-only"
};

async function main() {
  const source = { id: "visual-treatment-request", role: "source", name: "Visual treatment request", mime: "application/json", format: "JSON", content_schema: Treatment.SCHEMAS.request, editable: true, text: JSON.stringify(request) };
  const brief = {
    id: "hand-treatment-proof", title: "Comic neon carousel horse", kind: "3d-model", operation_mode: "create", intended_use: "3d-model",
    target_canvas: { medium: "3d-surface", dimensions: { width: 8, height: 9, depth: 4, unit: "game-world-unit" }, colour: { space: "linear-srgb", transparency: "opaque" }, behaviour: ["animated", "interactive"], intended_use: "3d-model", spatial: { up_axis: "y", handedness: "right", world_scale: 1 }, performance: { max_polygon_count: 6000, max_vertices: 10000, max_animation_frames: 240, max_file_bytes: 1048576 } },
    required_outputs: ["model/gltf-binary", "application/json"], editable_recipe_formats: [Treatment.SCHEMAS.recipe], source_artifacts: [source]
  };
  const host = { capabilities: ["json", "glb", "svg", "css"], permissions: [], accepts: [Hands.RESULT_SCHEMA, "model/gltf-binary", "image/svg+xml", "text/css", "application/json", Treatment.SCHEMAS.recipe, Treatment.SCHEMAS.receipt] };
  const diagnosis = Hands.diagnose(brief, host);
  assert.equal(diagnosis.status, "READY");
  assert(diagnosis.compatible_hands.some((hand) => hand.id === "visual-treatment-composer"));
  const first = await Hands.createAsync("visual-treatment-composer", brief, { seed: "hand-treatment-proof", createdAt: "2026-08-12T00:00:00.000Z", host });
  const second = await Hands.createAsync("visual-treatment-composer", brief, { seed: "hand-treatment-proof", createdAt: "2026-08-12T00:00:00.000Z", host });
  assert.equal(first.status, "READY", JSON.stringify({ status: first.status, technical: first.technical, receipt: first.validation_receipt }, null, 2));
  assert.equal(first.technical.pass, true);
  assert.equal(first.artifacts.length, 9);
  assert(first.artifacts.some((artifact) => artifact.mime === "model/gltf-binary"));
  assert(first.artifacts.some((artifact) => artifact.role === "storycraft-treatment-board"));
  assert(first.artifacts.some((artifact) => artifact.role === "portable-aetherfx-css"));
  assert(first.artifacts.some((artifact) => artifact.role === "treated-representation-set"));
  assert(first.validation_receipt.checks.every((check) => check.pass));
  assert.equal(first.measures.fallbackUsed, false);
  assert.equal(first.measures.treatmentDigest, second.measures.treatmentDigest);
  assert.equal(first.artifacts.find((artifact) => artifact.mime === "model/gltf-binary").dataUrl, second.artifacts.find((artifact) => artifact.mime === "model/gltf-binary").dataUrl);
  console.log("Visual Treatment Hand selftest PASS (registry-routed Style Fabric + AetherFX + PBR + animated GLB + supplied Storycraft + exact replay)");
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
