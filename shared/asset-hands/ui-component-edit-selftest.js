#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const Hands = require("./asset-hands");

const RECIPE_SCHEMA = "axm.ui-component-recipe/v1";
const SPEC_SCHEMA = "axm.ui-component-spec/v1";
const CREATED_AT = "2026-08-22T00:00:00.000Z";
const HOST = {
  capabilities: ["svg", "json"],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "image/svg+xml", "application/json", SPEC_SCHEMA, RECIPE_SCHEMA],
};

function targetFrom(recipe) {
  return {
    medium: recipe.target.medium,
    dimensions: { width: recipe.target.dimensions.width, height: recipe.target.dimensions.height, unit: "px" },
    colour: { space: "srgb", transparency: recipe.target.transparency, minimum_contrast_ratio: recipe.target.minimum_contrast_ratio },
    behaviour: ["static", "interactive", "responsive"],
    intended_use: recipe.kind,
    responsive: {
      direction: recipe.target.direction,
      input_modalities: recipe.target.input_modalities.slice(),
      reduced_motion: recipe.target.reduced_motion,
      minimum_target_size: recipe.target.minimum_target_size,
    },
    accessibility: { alternative_text: recipe.target.alternative_text, focus_visible: recipe.target.focus_visible },
    performance: { max_file_bytes: 2097152 },
  };
}

function sourceFrom(recipe) {
  return {
    id: "ui-recipe",
    role: "editable-ui-recipe",
    name: recipe.title + " UI recipe",
    mime: "application/json",
    format: "JSON",
    content_schema: RECIPE_SCHEMA,
    editable: true,
    text: JSON.stringify(recipe),
    metadata: { schema: RECIPE_SCHEMA },
  };
}

function briefFor(recipe, mode) {
  return {
    id: recipe.id,
    title: recipe.title,
    kind: recipe.kind,
    operation_mode: mode,
    intended_use: recipe.kind,
    palette: Object.values(recipe.palette),
    target_canvas: targetFrom(recipe),
    required_outputs: ["image/svg+xml", "application/json"],
    editable_recipe_formats: [RECIPE_SCHEMA],
    source_artifacts: mode === "edit" ? [sourceFrom(recipe)] : [],
  };
}

function artifact(result, id) {
  const found = result.artifacts.find((item) => item.id === id);
  assert(found, "missing artifact " + id);
  return found;
}

const createRecipeSeed = {
  schema: RECIPE_SCHEMA,
  version: "1.0.0",
  id: "ui-edit-proof",
  title: "UI edit proof",
  kind: "button",
  seed: "ui-edit-proof-seed",
  authority: "candidate-only",
  target: {
    medium: "game-world",
    dimensions: { width: 480, height: 240, unit: "px" },
    transparency: "allowed",
    minimum_contrast_ratio: 4.5,
    direction: "ltr",
    input_modalities: ["pointer", "keyboard", "gamepad"],
    reduced_motion: false,
    minimum_target_size: 44,
    alternative_text: true,
    focus_visible: true,
    focus_ring: { colour: "#f79009", width: 9 },
  },
  palette: { surface: "#101828", accent: "#2e90fa", foreground: "#f9fafb", attention: "#f79009" },
  geometry: { inset: 18, radius: 19, nine_slice: { left: 36, top: 36, right: 36, bottom: 36 } },
  states: {
    default: { opacity: 1, scale: 1 },
    hover: { opacity: 1, scale: 1 },
    active: { opacity: 0.92, scale: 0.98 },
    disabled: { opacity: 0.45, scale: 1 },
  },
  provenance: null,
};

const createBrief = briefFor(createRecipeSeed, "create");
const createDiagnosis = Hands.diagnose(createBrief, HOST);
assert.equal(createDiagnosis.status, "READY", JSON.stringify(createDiagnosis, null, 2));
const created = Hands.create("ui-component", createBrief, { seed: createRecipeSeed.seed, createdAt: CREATED_AT, host: HOST });
const replay = Hands.create("ui-component", createBrief, { seed: createRecipeSeed.seed, createdAt: CREATED_AT, host: HOST });
assert.equal(created.status, "READY");
assert.equal(created.technical.pass, true);
assert.equal(created.validation_receipt.status, "PASS");
assert.equal(created.hand.version, "1.2.0");
assert.equal(created.creation_recipe.operation_mode, "create");
assert.equal(created.artifacts.length, 3);
assert.deepEqual(created.artifacts.map((item) => item.id), ["ui-source", "ui-metadata", "ui-recipe"]);
assert.deepEqual(created.artifacts.map((item) => item.digest), replay.artifacts.map((item) => item.digest));
assert.equal(artifact(created, "ui-source").role, "editable-source");
assert.equal(artifact(created, "ui-metadata").metadata.schema, SPEC_SCHEMA);
assert.equal(artifact(created, "ui-recipe").metadata.schema, RECIPE_SCHEMA);
assert.equal(created.previewArtifactId, "ui-source");
assert.match(artifact(created, "ui-source").text, /^<svg\b/);
assert.doesNotMatch(artifact(created, "ui-source").text, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|file:)/i);

const emitted = JSON.parse(artifact(created, "ui-recipe").text);
assert.equal(emitted.authority, "candidate-only");
assert.equal(emitted.provenance, null);
assert.deepEqual(JSON.parse(artifact(created, "ui-metadata").text).tokens.requestedPalette, emitted.palette);

const editedRecipe = JSON.parse(JSON.stringify(emitted));
editedRecipe.title = "Edited HUD control";
editedRecipe.kind = "hud";
editedRecipe.target.dimensions = { width: 640, height: 180, unit: "px" };
editedRecipe.target.direction = "rtl";
editedRecipe.target.input_modalities = ["pointer", "keyboard", "touch"];
editedRecipe.target.focus_ring = { colour: "#00ff99", width: 6 };
editedRecipe.palette = { surface: "#241233", accent: "#805ad5", foreground: "#ffffff", attention: "#00ff99" };
editedRecipe.geometry = { inset: 12, radius: 24, nine_slice: { left: 28, top: 24, right: 30, bottom: 26 } };
editedRecipe.states.hover = { opacity: 0.96, scale: 1.03 };
editedRecipe.states.active = { opacity: 0.86, scale: 0.95 };
const editBrief = briefFor(editedRecipe, "edit");
const editDiagnosis = Hands.diagnose(editBrief, HOST);
assert.equal(editDiagnosis.status, "READY", JSON.stringify(editDiagnosis, null, 2));
const edited = Hands.create("ui-component", editBrief, { seed: "host-route-seed", createdAt: CREATED_AT, host: HOST });
assert.equal(edited.status, "READY");
assert.equal(edited.technical.pass, true);
assert.equal(edited.validation_receipt.status, "PASS");
assert.equal(edited.creation_recipe.operation_mode, "edit");
assert.equal(edited.creation_recipe.source_artifact_digests.length, 1);
assert(edited.artifacts.every((item, index) => item.digest !== created.artifacts[index].digest), "edit must regenerate all three artifacts");
const editedOutput = JSON.parse(artifact(edited, "ui-recipe").text);
const editedMetadata = JSON.parse(artifact(edited, "ui-metadata").text);
assert.equal(editedOutput.title, editedRecipe.title);
assert.equal(editedOutput.target.focus_ring.width, 6);
assert.equal(editedOutput.provenance.operation, "edit");
assert.equal(editedOutput.provenance.source_artifact_id, "ui-recipe");
assert.equal(editedMetadata.interaction.focusRing.colour, "#00ff99");
assert.deepEqual(editedMetadata.stateStyles, editedOutput.states);
assert.deepEqual(editedMetadata.nineSlice, editedOutput.geometry.nine_slice);

const directSvgBrief = { ...editBrief, source_artifacts: [{ id: "ui-source", role: "editable-source", mime: "image/svg+xml", format: "SVG", editable: true, text: artifact(created, "ui-source").text }] };
assert.equal(Hands.diagnose(directSvgBrief, HOST).status, "MISSING_HAND");
const authorityViolation = JSON.parse(JSON.stringify(editedRecipe));
authorityViolation.authority = "canonical";
assert.throws(() => Hands.create("ui-component", briefFor(authorityViolation, "edit"), { seed: "bad-authority", createdAt: CREATED_AT, host: HOST }), /authority is invalid/);

console.log("UI Component Edit selftest PASS (ui-component@1.2.0 create/edit, three-artifact transaction, strict recipe master, static SVG boundary)");
