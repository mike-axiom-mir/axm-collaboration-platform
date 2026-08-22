"use strict";
const assert = require("node:assert/strict");
const Hands = require("./asset-hands");

const RECIPE_SCHEMA = "axm.pbr-material-recipe/v1";
const RECEIPT_SCHEMA = "axm.pbr-material-bake-receipt/v1";

function makeSource(recipe) {
  return {
    id: "pbr-material-request",
    role: "source",
    name: "PBR material request",
    mime: "application/json",
    format: "JSON",
    content_schema: recipe.schema,
    metadata: { schema: recipe.schema },
    editable: true,
    text: JSON.stringify(recipe),
  };
}

function makeBrief(recipe, operationMode) {
  return {
    id: recipe.id, title: recipe.id, kind: "material", operation_mode: operationMode, intended_use: "texture",
    target_canvas: { medium: "3d-surface", dimensions: { width: recipe.size, height: recipe.size, unit: "px" }, colour: { space: "srgb", transparency: "opaque" }, behaviour: ["static", "tileable"], intended_use: "texture", physical: { material_behaviour: [] }, performance: { max_file_bytes: 12000000 } },
    required_outputs: ["image/png", "application/json"], editable_recipe_formats: [recipe.schema], source_artifacts: [makeSource(recipe)]
  };
}

async function main() {
  const recipe = { schema: RECIPE_SCHEMA, version: "1.0.0", id: "glass-material-proof", family: "glass", seed: "glass-proof-01", size: 64, normal_strength: 1.7, authority: "candidate-only" };
  let brief = makeBrief(recipe, "create");
  const host = { capabilities: ["json", "png"], permissions: [], accepts: [Hands.RESULT_SCHEMA, "image/png", "application/json", recipe.schema, "axm.pbr-material-bake-receipt/v1"] };
  const diagnosis = Hands.diagnose(brief, host);
  assert.equal(diagnosis.status, "READY", JSON.stringify(diagnosis, null, 2));
  assert(diagnosis.compatible_hands.some((hand) => hand.id === "pbr-material-bake"));
  const first = await Hands.createAsync("pbr-material-bake", brief, { seed: "glass-proof", createdAt: "2026-08-12T00:00:00.000Z", host });
  const second = await Hands.createAsync("pbr-material-bake", brief, { seed: "glass-proof", createdAt: "2026-08-12T00:00:00.000Z", host });
  assert.equal(first.status, "READY");
  assert.equal(first.technical.pass, true);
  assert.equal(first.hand.version, "1.1.0");
  assert.equal(first.creation_recipe.operation_mode, "create");
  assert.equal(first.artifacts.filter((artifact) => artifact.mime === "image/png").length, 6);
  assert(first.artifacts.some((artifact) => artifact.role === "pbr-normal-map"));
  assert(first.artifacts.some((artifact) => artifact.role === "pbr-orm-map"));
  assert(first.artifacts.some((artifact) => artifact.role === "pbr-material-preview"));
  assert(first.validation_receipt.checks.every((check) => check.pass));
  const sampling = Object.fromEntries(first.artifacts.filter((artifact) => artifact.mime === "image/png").map((artifact) => [artifact.id, artifact.metadata.sampling]));
  assert.deepEqual(sampling["pbr-albedo-map"], { interpretation: "colour", transfer_function: "srgb", channel_semantics: { r: "base-color-red", g: "base-color-green", b: "base-color-blue", a: "opacity" }, wrap: "repeat" });
  assert.deepEqual(sampling["pbr-normal-map"], { interpretation: "data", transfer_function: "linear", channel_semantics: { r: "tangent-x", g: "tangent-y-positive-opengl", b: "tangent-z", a: "one" }, wrap: "repeat" });
  assert.deepEqual(sampling["pbr-orm-map"], { interpretation: "data", transfer_function: "linear", channel_semantics: { r: "ambient-occlusion", g: "roughness", b: "metalness", a: "one" }, wrap: "repeat" });
  assert.deepEqual(sampling["pbr-material-preview"], { interpretation: "colour", transfer_function: "srgb", channel_semantics: { r: "reference-preview-red", g: "reference-preview-green", b: "reference-preview-blue", a: "one" }, wrap: "clamp" });
  assert.match(first.artifacts.find((artifact) => artifact.id === "pbr-normal-map").metadata.normalConvention, /OpenGL.*\+Y/);
  assert.equal(first.measures.maps, 5);
  assert.equal(first.measures.pngs, 6);
  assert(first.measures.totalBytes > 1000);
  assert.deepEqual(first.artifacts.map((artifact) => artifact.dataUrl || artifact.text), second.artifacts.map((artifact) => artifact.dataUrl || artifact.text));

  const editedRecipe = { ...recipe, family: "asphalt", seed: "asphalt-edit-02", normal_strength: 2.4 };
  brief = makeBrief(editedRecipe, "edit");
  const editDiagnosis = Hands.diagnose(brief, host);
  assert.equal(editDiagnosis.status, "READY", JSON.stringify(editDiagnosis, null, 2));
  const edited = await Hands.createAsync("pbr-material-bake", brief, { seed: "glass-proof", createdAt: "2026-08-12T00:00:00.000Z", host });
  assert.equal(edited.status, "READY");
  assert.equal(edited.technical.pass, true);
  assert.equal(edited.validation_receipt.status, "PASS");
  assert.equal(edited.creation_recipe.operation_mode, "edit");
  assert.equal(edited.creation_recipe.source_artifact_digests.length, 1);
  assert.notEqual(edited.digest, first.digest);
  assert(edited.artifacts.every((artifact, index) => artifact.digest !== first.artifacts[index].digest), "edit must transactionally regenerate all eight artifacts");
  assert.equal(JSON.parse(edited.artifacts.find((artifact) => artifact.id === "editable-pbr-material-recipe").text).family, "asphalt");
  assert.equal(JSON.parse(edited.artifacts.find((artifact) => artifact.id === "pbr-material-bake-receipt").text).schema, RECEIPT_SCHEMA);
  console.log("PBR Material Bake Hand selftest PASS (v1.1 public create/edit, 6 real PNGs, explicit sampling, deterministic replay, candidate-only)");
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
