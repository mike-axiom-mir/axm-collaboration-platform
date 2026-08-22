#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const Hands = require("../../shared/asset-hands/asset-hands");
const Fabric = require("../../shared/deterministic-ui-fabric");
const Core = require("./core");
const Renderer = require("./renderer");

const HOST = { capabilities: ["svg", "json"], permissions: [], accepts: [Hands.RESULT_SCHEMA, "image/svg+xml", "application/json", Core.RECIPE_SCHEMA, "axm.ui-component-spec/v1"] };
const CREATED_AT = "2026-08-22T00:00:00.000Z";
function target(recipe) { return { medium: recipe.target.medium, dimensions: recipe.target.dimensions, colour: { space: "srgb", transparency: recipe.target.transparency, minimum_contrast_ratio: recipe.target.minimum_contrast_ratio }, behaviour: ["static", "interactive", "responsive"], intended_use: recipe.kind, responsive: { direction: recipe.target.direction, input_modalities: recipe.target.input_modalities, reduced_motion: recipe.target.reduced_motion, minimum_target_size: recipe.target.minimum_target_size }, accessibility: { alternative_text: recipe.target.alternative_text, focus_visible: recipe.target.focus_visible }, performance: { max_file_bytes: 2097152 } }; }
function source(recipe) { return { id: "ui-recipe", role: "editable-ui-recipe", name: recipe.title + " UI recipe", mime: "application/json", format: "JSON", content_schema: Core.RECIPE_SCHEMA, editable: true, text: JSON.stringify(recipe), metadata: { schema: Core.RECIPE_SCHEMA } }; }
function brief(recipe, mode) { return { id: recipe.id, title: recipe.title, kind: recipe.kind, operation_mode: mode, intended_use: recipe.kind, palette: Object.values(recipe.palette), target_canvas: target(recipe), required_outputs: ["image/svg+xml", "application/json"], editable_recipe_formats: [Core.RECIPE_SCHEMA], source_artifacts: mode === "edit" ? [source(recipe)] : [] }; }
function artifact(result, id) { return result.artifacts.find((item) => item.id === id); }

const seedRecipe = { schema: Core.RECIPE_SCHEMA, version: "1.0.0", id: "ui-human-core", title: "Human core UI", kind: "button", seed: "ui-human-core-seed", authority: "candidate-only", target: { medium: "game-world", dimensions: { width: 480, height: 240, unit: "px" }, transparency: "allowed", minimum_contrast_ratio: 4.5, direction: "ltr", input_modalities: ["pointer", "keyboard", "gamepad"], reduced_motion: false, minimum_target_size: 44, alternative_text: true, focus_visible: true, focus_ring: { colour: "#F79009", width: 9 } }, palette: { surface: "#101828", accent: "#2E90FA", foreground: "#F9FAFB", attention: "#F79009" }, geometry: { inset: 18, radius: 19, nine_slice: { left: 36, top: 36, right: 36, bottom: 36 } }, states: { default: { opacity: 1, scale: 1 }, hover: { opacity: 1, scale: 1 }, active: { opacity: 0.92, scale: 0.98 }, disabled: { opacity: 0.45, scale: 1 } }, provenance: null };
const created = Hands.create(Core.HAND_ID, brief(seedRecipe, "create"), { seed: seedRecipe.seed, createdAt: CREATED_AT, host: HOST });
const handoff = Fabric.gateResult(created);
assert.equal(handoff.status, "PASS");
const session = Core.createSession(created, handoff);
assert.equal(session.current_result_digest, created.digest);
assert.equal(session.current_handoff.preview.static_visual_only, true);
assert.equal(Core.journeyReadiness(session).pass, false);
assert.throws(() => Core.recordHumanJudgment(session, { reviewer: "selftest", decision: "accept-candidate" }), /complete current browser journey/);

const editedRecipe = JSON.parse(artifact(created, "ui-recipe").text);
editedRecipe.title = "Human core edited UI";
editedRecipe.target.dimensions = { width: 640, height: 180, unit: "px" };
editedRecipe.target.focus_ring = { colour: "#00FF99", width: 6 };
editedRecipe.palette = { surface: "#241233", accent: "#805AD5", foreground: "#FFFFFF", attention: "#00FF99" };
editedRecipe.geometry = { inset: 12, radius: 24, nine_slice: { left: 28, top: 24, right: 30, bottom: 26 } };
editedRecipe.states.hover = { opacity: 0.96, scale: 1.03 };
Core.replaceDraftRecipe(session, editedRecipe);
const edited = Hands.create(Core.HAND_ID, brief(editedRecipe, "edit"), { seed: editedRecipe.seed, createdAt: CREATED_AT, host: HOST });
const editedHandoff = Fabric.gateResult(edited);
assert.equal(editedHandoff.status, "PASS");
assert.notEqual(edited.digest, created.digest);
assert(edited.artifacts.every((item, index) => item.digest !== created.artifacts[index].digest));
Core.bindRegeneratedResult(session, edited, editedHandoff);
assert.equal(session.current_result_digest, edited.digest);
assert.equal(session.comparison_history.length, 1);

function observe(patch, kind) { Core.setViewer(session, patch); Core.recordJourneyEvent(session, kind); }
Core.STATES.forEach((name) => observe({ component_state: name }, "state"));
observe({ render_mode: "raw" }, "mode");
observe({ render_mode: "nine-slice", stretch_width: 640, stretch_height: 180 }, "mode");
observe({ render_mode: "nine-slice", stretch_width: 900, stretch_height: 180 }, "mode");
observe({ zoom_percent: 100 }, "zoom");
observe({ zoom_percent: 200 }, "zoom");
observe({ background: "dark" }, "background");
observe({ background: "light" }, "background");
observe({ input_journey: "pointer" }, "pointer");
observe({ input_journey: "keyboard", focus_visible: true }, "keyboard");
observe({ safe_area: "mobile" }, "safe-area");
observe({ reduced_motion_preference: true }, "reduced-motion");
assert.equal(Core.journeyReadiness(session).pass, true);
Core.recordHumanJudgment(session, { reviewer: "automated-selftest-boundary", decision: "hold", notes: "Mechanism test only; no human approval." });
const receipt = Core.createReceipt(session);
assert.equal(receipt.human_judgment.decision, "hold");
assert.equal(receipt.authority.promoted, false);
assert.equal(receipt.claims.physical_touch_or_gamepad_verified, false);
const historyBefore = session.stale_review_history.length;
Core.setViewer(session, { zoom_percent: 100 });
assert.equal(session.human_judgment, null);
assert.equal(session.stale_review_history.length, historyBefore + 1);
const preserved = session.current_result_digest;
Core.recordRegenerationFailure(session, { code: "RESULT_NOT_REVIEWABLE", message: "synthetic HOLD", result_status: "HOLD" });
assert.equal(session.current_result_digest, preserved);
assert.equal(session.last_regeneration_failure.preserved_result_digest, preserved);
const patch = Core.machinePatch(session);
assert.equal(patch.source_artifact.content_schema, Core.RECIPE_SCHEMA);
assert.equal(patch.authority.canonical, false);
const slices = Renderer.computeNineSlice(640, 180, 900, 180, editedRecipe.geometry.nine_slice);
assert.equal(slices.cells.length, 9);
assert.equal(slices.cells.reduce((sum, cell) => sum + cell.dw * cell.dh, 0), 900 * 180);
console.log("AXM UI sensory core selftest: PASS (frozen machine bind, create/edit replacement, inert nine-slice math, full journey gate, viewer staleness, HOLD preservation, human-only receipt)");
