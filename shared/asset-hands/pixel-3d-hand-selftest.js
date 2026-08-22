#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Hands = require("./asset-hands");
const Pixel3D = require("./pixel-3d-core");

async function main() {
  const request = { schema: Pixel3D.SCHEMAS.request, version: "1.0.0", id: "pixel-3d-hand-proof", identity_id: "axm.park.ferris-wheel", profile_id: "pixel-8bit-3d", animation_state: "running", authority: "candidate-only" };
  const source = { id: "pixel-3d-request", role: "source", name: "Pixel 3D request", mime: "application/json", format: "JSON", content_schema: Pixel3D.SCHEMAS.request, editable: true, text: JSON.stringify(request) };
  const brief = {
    id: "pixel-3d-hand-proof",
    title: "Pixel 3D hand proof",
    kind: "3d-model",
    operation_mode: "create",
    intended_use: "3d-model",
    target_canvas: { medium: "3d-surface", dimensions: { width: 8, height: 9, depth: 4, unit: "game-world-unit" }, colour: { space: "linear-srgb", transparency: "opaque" }, behaviour: ["animated", "interactive"], intended_use: "3d-model", spatial: { up_axis: "y", handedness: "right", world_scale: 1 }, performance: { max_polygon_count: 2000, max_vertices: 5000, max_animation_frames: 240, max_file_bytes: 524288 } },
    required_outputs: ["model/gltf-binary", "application/json"],
    editable_recipe_formats: [Pixel3D.SCHEMAS.recipe],
    source_artifacts: [source]
  };
  const host = { capabilities: ["json", "glb"], permissions: [], accepts: [Hands.RESULT_SCHEMA, "model/gltf-binary", "application/json", "image/svg+xml", Pixel3D.SCHEMAS.recipe, Pixel3D.SCHEMAS.receipt, Pixel3D.SCHEMAS.profile, Pixel3D.SCHEMAS.representationSet, "axm.asset-identity/v1"] };
  const diagnosis = Hands.diagnose(brief, host);
  assert.equal(diagnosis.status, "READY");
  assert(diagnosis.compatible_hands.some((hand) => hand.id === "pixel-3d-representation"));
  const result = await Hands.createAsync("pixel-3d-representation", brief, { seed: "pixel-3d-hand-proof", createdAt: "2026-08-12T00:00:00.000Z", host });
  assert.equal(result.status, "READY");
  assert.equal(result.technical.pass, true);
  assert.equal(result.validation_receipt.status, "PASS");
  assert.equal(result.artifacts.length, 7);
  const model = result.artifacts.find((artifact) => artifact.id === "pixel-3d-runtime-model");
  assert(model.dataUrl.startsWith("data:model/gltf-binary;base64,"));
  assert.equal(model.metadata.identity_id, request.identity_id);
  assert.equal(model.metadata.representation_profile_id, request.profile_id);
  const receipt = JSON.parse(result.artifacts.find((artifact) => artifact.id === "pixel-3d-validation-receipt").text);
  assert.equal(receipt.status, "PASS");
  assert(receipt.checks.every((check) => check.pass));
  console.log("Pixel 3D Hand selftest PASS (routed, animated GLB, identity-bound, deterministic, candidate-only)");
}

main().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
