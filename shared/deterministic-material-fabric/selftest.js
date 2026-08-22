"use strict";

const assert = require("node:assert/strict");
const Hands = require("../asset-hands/asset-hands");
const Material = require(".");

function recipe(overrides) {
  return Object.assign({
    schema: Material.RECIPE_SCHEMA,
    version: "1.0.0",
    id: "material-sensory-fixture",
    family: "glass",
    seed: "material-sensory-fixture",
    size: 64,
    normal_strength: 1.7,
    authority: "candidate-only",
  }, overrides || {});
}

function brief(value, operationMode) {
  const source = {
    id: "pbr-material-request",
    role: "source",
    name: "PBR material request",
    mime: "application/json",
    format: "JSON",
    content_schema: Material.RECIPE_SCHEMA,
    metadata: { schema: Material.RECIPE_SCHEMA },
    editable: true,
    text: JSON.stringify(value),
  };
  return {
    id: value.id,
    title: "Material sensory fixture",
    kind: "material",
    operation_mode: operationMode,
    intended_use: "texture",
    target_canvas: {
      medium: "3d-surface",
      dimensions: { width: value.size, height: value.size, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      behaviour: ["static", "tileable"],
      intended_use: "texture",
      physical: { material_behaviour: [] },
      performance: { max_file_bytes: Material.RESPONSE_BODY_MAX_BYTES },
    },
    required_outputs: ["image/png", "application/json"],
    editable_recipe_formats: [Material.RECIPE_SCHEMA],
    source_artifacts: [source],
  };
}

const host = {
  capabilities: ["json", "png"],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "image/png", "application/json", Material.RECIPE_SCHEMA, Material.RECEIPT_SCHEMA],
};

async function create(value, operationMode) {
  return Hands.createAsync(Material.HAND_ID, brief(value, operationMode), {
    seed: "material-sensory-fixture",
    createdAt: "2026-08-22T00:00:00.000Z",
    host,
  });
}

async function main() {
  const firstResult = await create(recipe(), "create");
  const first = Material.gateResult(firstResult);
  assert.equal(first.status, "PASS", JSON.stringify(first, null, 2));
  assert.equal(first.hand.version, Material.HAND_VERSION);
  assert.equal(first.operation_mode, "create");
  assert.equal(first.pngs.length, 6);
  assert(first.pngs.every((png) => /^[a-f0-9]{64}$/.test(png.byte_sha256)));
  assert.equal(first.sampling_contract["pbr-normal-map"].transfer_function, "linear");
  assert.equal(first.sampling_contract["pbr-material-preview"].wrap, "clamp");
  assert.equal(first.authority.promoted, false);
  assert.equal(first.claims.dynamic_browser_render_observed, false);
  assert(first.serialized_result_bytes < Material.RESPONSE_BODY_MAX_BYTES);

  const editResult = await create(recipe({ family: "asphalt", seed: "material-edit", normal_strength: 2.4 }), "edit");
  const edit = Material.gateResult(editResult);
  assert.equal(edit.status, "PASS", JSON.stringify(edit, null, 2));
  assert.equal(edit.operation_mode, "edit");
  assert.notEqual(edit.result_digest, first.result_digest);
  assert.notEqual(edit.recipe_digest, first.recipe_digest);
  Object.keys(first.png_sha256).forEach((id) => assert.notEqual(edit.png_sha256[id], first.png_sha256[id], id + " must regenerate"));

  const tampered = JSON.parse(JSON.stringify(firstResult));
  tampered.artifacts.find((artifact) => artifact.id === "pbr-normal-map").metadata.sampling.transfer_function = "srgb";
  const samplingFailure = Material.gateResult(tampered);
  assert.equal(samplingFailure.status, "FAIL");
  assert.equal(samplingFailure.code, "SAMPLING_CONTRACT_MISMATCH");

  const holdResult = await create(recipe({ id: "material-hold-fixture", size: 256 }), "create");
  assert.equal(holdResult.status, "HOLD");
  const hold = Material.gateResult(holdResult);
  assert.equal(hold.status, "FAIL");
  assert.equal(hold.code, "RESULT_NOT_REVIEWABLE");

  console.log("AXM deterministic material fabric selftest: PASS (v1.1 create/edit, exact eight-artifact gate, full PNG SHA-256, sampling fail-close, HOLD exclusion)");
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
