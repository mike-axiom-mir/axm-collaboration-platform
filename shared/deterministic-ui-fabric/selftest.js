#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const Hands = require("../asset-hands/asset-hands");
const Fabric = require("./index");

const CREATED_AT = "2026-08-22T00:00:00.000Z";
const HOST = {
  capabilities: ["svg", "json"],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "image/svg+xml", "application/json", Fabric.SPEC_SCHEMA, Fabric.RECIPE_SCHEMA],
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function target(recipe) {
  return {
    medium: recipe.target.medium,
    dimensions: clone(recipe.target.dimensions),
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
    performance: { max_file_bytes: Fabric.RESPONSE_BODY_MAX_BYTES },
  };
}

function source(recipe) {
  return {
    id: "ui-recipe", role: "editable-ui-recipe", name: recipe.title + " UI recipe",
    mime: "application/json", format: "JSON", content_schema: Fabric.RECIPE_SCHEMA,
    editable: true, text: JSON.stringify(recipe), metadata: { schema: Fabric.RECIPE_SCHEMA },
  };
}

function brief(recipe, mode) {
  return {
    id: recipe.id, title: recipe.title, kind: recipe.kind, operation_mode: mode, intended_use: recipe.kind,
    palette: Object.values(recipe.palette), target_canvas: target(recipe),
    required_outputs: ["image/svg+xml", "application/json"], editable_recipe_formats: [Fabric.RECIPE_SCHEMA],
    source_artifacts: mode === "edit" ? [source(recipe)] : [],
  };
}

function byId(result, id) {
  const item = result.artifacts.find((artifact) => artifact.id === id);
  assert(item, "missing " + id);
  return item;
}

function expectCode(result, code) {
  const handoff = Fabric.gateResult(result);
  assert.equal(handoff.status, "FAIL", JSON.stringify(handoff, null, 2));
  assert.equal(handoff.code, code, JSON.stringify(handoff, null, 2));
}

const seedRecipe = {
  schema: Fabric.RECIPE_SCHEMA, version: "1.0.0", id: "deterministic-ui-proof", title: "Deterministic UI proof",
  kind: "button", seed: "deterministic-ui-proof-seed", authority: "candidate-only",
  target: {
    medium: "game-world", dimensions: { width: 480, height: 240, unit: "px" }, transparency: "allowed",
    minimum_contrast_ratio: 4.5, direction: "ltr", input_modalities: ["pointer", "keyboard", "gamepad"],
    reduced_motion: false, minimum_target_size: 44, alternative_text: true, focus_visible: true,
    focus_ring: { colour: "#ff9f1c", width: 9 },
  },
  palette: { surface: "#111111", accent: "#4f8cff", foreground: "#222222", attention: "#ff9f1c" },
  geometry: { inset: 18, radius: 19, nine_slice: { left: 36, top: 36, right: 36, bottom: 36 } },
  states: {
    default: { opacity: 1, scale: 1 }, hover: { opacity: 1, scale: 1 },
    active: { opacity: 0.92, scale: 0.98 }, disabled: { opacity: 0.45, scale: 1 },
  },
  provenance: null,
};

const first = Hands.create(Fabric.HAND_ID, brief(seedRecipe, "create"), { seed: seedRecipe.seed, createdAt: CREATED_AT, host: HOST });
const second = Hands.create(Fabric.HAND_ID, brief(seedRecipe, "create"), { seed: seedRecipe.seed, createdAt: CREATED_AT, host: HOST });
assert.equal(first.status, "READY");
assert.deepEqual(first.artifacts.map((artifact) => artifact.digest), second.artifacts.map((artifact) => artifact.digest));
const handoff = Fabric.assertResult(first);
assert.equal(handoff.status, "PASS");
assert.equal(handoff.schema, Fabric.HANDOFF_SCHEMA);
assert.equal(handoff.hand.version, "1.2.0");
assert.equal(handoff.operation_mode, "create");
assert.equal(handoff.artifacts.length, 3);
assert.equal(handoff.preview.static_visual_only, true);
assert.equal(handoff.preview.interactive_state_proof, false);
assert.equal(handoff.warnings[0].code, "REQUESTED_PALETTE_NORMALIZED");
assert.equal(handoff.authority.installed, false);
assert.equal(handoff.claims.human_aesthetic_approval, false);
assert.equal(handoff.artifact_sha256["ui-source"], Fabric.sha256(byId(first, "ui-source").text));

const editedRecipe = JSON.parse(byId(first, "ui-recipe").text);
editedRecipe.title = "Edited deterministic HUD";
editedRecipe.kind = "hud";
editedRecipe.target.dimensions = { width: 720, height: 180, unit: "px" };
editedRecipe.target.direction = "rtl";
editedRecipe.target.input_modalities = ["pointer", "keyboard", "touch"];
editedRecipe.target.focus_ring = { colour: "#00ffaa", width: 5 };
editedRecipe.palette = { surface: "#20102e", accent: "#8b5cf6", foreground: "#ffffff", attention: "#00ffaa" };
editedRecipe.geometry = { inset: 10, radius: 22, nine_slice: { left: 24, top: 20, right: 28, bottom: 22 } };
editedRecipe.states.hover = { opacity: 0.97, scale: 1.04 };
editedRecipe.states.active = { opacity: 0.88, scale: 0.96 };
const edited = Hands.create(Fabric.HAND_ID, brief(editedRecipe, "edit"), { seed: "host-route-seed", createdAt: CREATED_AT, host: HOST });
const editedHandoff = Fabric.assertResult(edited);
assert.equal(editedHandoff.operation_mode, "edit");
assert.notEqual(editedHandoff.result_digest, handoff.result_digest);
assert.notEqual(editedHandoff.recipe_digest, handoff.recipe_digest);
assert(edited.artifacts.every((artifact, index) => artifact.digest !== first.artifacts[index].digest));
assert.equal(editedHandoff.target.focus_ring.colour, "#00ffaa");
assert.equal(editedHandoff.nine_slice_contract.left, 24);

let mutated = clone(first);
mutated.status = "HOLD";
expectCode(mutated, "RESULT_NOT_REVIEWABLE");
mutated = clone(first);
mutated.hand.authority = "canonical";
expectCode(mutated, "AUTHORITY_VIOLATION");
mutated = clone(first);
mutated.artifacts[0].role = "interactive-proof";
expectCode(mutated, "ARTIFACT_ENVELOPE_MISMATCH");
mutated = clone(first);
const invalidRecipe = JSON.parse(byId(mutated, "ui-recipe").text);
invalidRecipe.extra = true;
byId(mutated, "ui-recipe").text = JSON.stringify(invalidRecipe);
expectCode(mutated, "RECIPE_INVALID");
mutated = clone(first);
const unboundRecipe = JSON.parse(byId(mutated, "ui-recipe").text);
unboundRecipe.target.dimensions.width += 1;
byId(mutated, "ui-recipe").text = JSON.stringify(unboundRecipe);
expectCode(mutated, "RECIPE_BINDING_MISMATCH");
mutated = clone(first);
const invalidMetadata = JSON.parse(byId(mutated, "ui-metadata").text);
delete invalidMetadata.name;
byId(mutated, "ui-metadata").text = JSON.stringify(invalidMetadata);
expectCode(mutated, "METADATA_INVALID");
mutated = clone(first);
const badSlice = JSON.parse(byId(mutated, "ui-metadata").text);
badSlice.nineSlice.left += 1;
byId(mutated, "ui-metadata").text = JSON.stringify(badSlice);
expectCode(mutated, "NINE_SLICE_INVALID");
mutated = clone(first);
const badState = JSON.parse(byId(mutated, "ui-metadata").text);
badState.stateStyles.hover.opacity = 0.2;
byId(mutated, "ui-metadata").text = JSON.stringify(badState);
expectCode(mutated, "STATE_CONTRACT_MISMATCH");
mutated = clone(first);
const badToken = JSON.parse(byId(mutated, "ui-metadata").text);
badToken.tokens.accent = "#000000";
byId(mutated, "ui-metadata").text = JSON.stringify(badToken);
expectCode(mutated, "TOKEN_CONTRACT_MISMATCH");
mutated = clone(first);
byId(mutated, "ui-source").text = byId(mutated, "ui-source").text.replace("</svg>", '<script>alert(1)</script></svg>');
expectCode(mutated, "SVG_UNSAFE");
mutated = clone(first);
byId(mutated, "ui-source").text = byId(mutated, "ui-source").text.replace('viewBox="0 0 480 240"', 'viewBox="0 0 481 240"');
expectCode(mutated, "SVG_STRUCTURE_MISMATCH");
mutated = clone(first);
mutated.padding = "x".repeat(Fabric.RESPONSE_BODY_MAX_BYTES);
expectCode(mutated, "RESPONSE_BUDGET_EXCEEDED");

console.log("Deterministic UI Fabric selftest PASS (whole-result gate, create/edit binding, inert SVG safety, 12 typed failure routes)");
