#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Choice = require("../../shared/asset-hands/choice-first-core");
const Pilot = require("../../shared/asset-hands/choice-first-pilot-core");
const GameVisual = require("../../shared/asset-hands/game-visual-pack-core");
const Pixel3D = require("../../shared/asset-hands/pixel-3d-core");
const Pixel3DCodec = require("../../shared/asset-hands/pixel-3d-codec");
const Treatment = require("../../shared/asset-hands/visual-treatment-core");
const Raster = require("../../shared/asset-hands/raster-codec");
const Schemas = require("../../shared/asset-hands/artifact-schema-catalog");
const Video = require("../../shared/asset-hands/video-codec");

const root = __dirname;
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }

const eight = Choice.resolveProfile("pixel-8bit");
const sixteen = Choice.resolveProfile("pixel-16bit");
const custom = Choice.resolveProfile({ preset_id: "pixel-custom", axes: { detail: { cell_width: 72, cell_height: 72 }, palette: { max_colours: 32 } } });
assert.equal(eight.status, "READY");
assert.equal(sixteen.status, "READY");
assert.equal(custom.profile.axes.detail.cell_width, 72);
assert.equal(custom.fallback_used, false);
const cinematic = Choice.resolveProfile("cinematic-render");
assert.equal(cinematic.status, "MISSING_REPRESENTATION");
assert.equal(cinematic.fallback_used, false);
assert.equal(cinematic.nearest_substitute_used, false);
assert.equal(Schemas.validate(cinematic.schema, cinematic).pass, true);

let simulation = Choice.createSimulation("axm.park.ferris-wheel", "selftest-simulation");
const beforeIdle = Choice.digest(simulation.state);
let result = Choice.applySimulationEvent(simulation, { id: "idle-decade", type: "time_elapsed", duration_ms: 315576000000 });
simulation = result.simulation;
assert.equal(simulation.state.condition, 100);
assert.equal(simulation.state.cleanliness, 100);
assert.equal(result.receipt.time_only_no_decay, true);
assert.notEqual(Choice.digest(simulation.state), beforeIdle, "time is recorded even though condition remains unchanged");
result = Choice.applySimulationEvent(simulation, { id: "work", type: "use_cycle", cycles: 20, load_factor: 1.5 });
assert(result.simulation.state.condition < 100);
const replayA = Choice.replaySimulation(Choice.createSimulation("axm.park.ticket-gate", "replay"), [{ id: "open", type: "open" }, { id: "use", type: "use_cycle", cycles: 3 }]);
const replayB = Choice.replaySimulation(Choice.createSimulation("axm.park.ticket-gate", "replay"), [{ id: "open", type: "open" }, { id: "use", type: "use_cycle", cycles: 3 }]);
assert.equal(replayA.replay_digest, replayB.replay_digest);
const duplicate = Choice.applySimulationEvent(replayA.simulation, { id: "use", type: "use_cycle", cycles: 3 });
assert.equal(duplicate.receipt.status, "DUPLICATE_IGNORED");

const starter = Choice.createStarterSofa("persistent-sofa");
const insufficient = Choice.applySofaUpgrade(starter, "frame-reinforced-beech", { money: 0, labour_hours: 0, materials: {} });
assert.equal(insufficient.status, "INSUFFICIENT_RESOURCES");
assert.equal(Choice.digest(insufficient.object), Choice.digest(starter));
const upgraded = Choice.applySofaUpgrade(starter, "frame-reinforced-beech", { money: 200, labour_hours: 10, materials: { fasteners: 10, hardwood: 10 } });
assert.equal(upgraded.status, "APPLIED");
assert.equal(upgraded.object.id, starter.id);
assert.equal(upgraded.object.replacement_required, false);
assert.equal(Choice.evaluateSofa(upgraded.object, {}).universal_score, null);

for (const identity of Choice.listIdentities()) {
  const frame8 = Pilot.render(identity.id, "pixel-8bit", 0, { profile: eight.profile, sofa: starter });
  const frame16 = Pilot.render(identity.id, "pixel-16bit", 0, { profile: sixteen.profile, sofa: starter });
  const frameCustom = Pilot.render(identity.id, "pixel-custom", 0, { profile: custom.profile, sofa: starter });
  assert.equal(frame8.width, 48); assert.equal(frame16.width, 96); assert.equal(frameCustom.width, 72);
  assert(Pilot.countColours(frame8, false) <= 16); assert(Pilot.countColours(frame16, false) <= 64); assert(Pilot.countColours(frameCustom, false) <= 32);
}

const catalog = readJson("pilots/catalog.json");
const causalProof = readJson("pilots/causal-proof.json");
const sofaProof = readJson("pilots/sofa-branching-proof.json");
const filmReceipt = readJson("pilots/film/verification-receipt.json");
const gameVisualProof = readJson("pilots/game-visual-choice-proof.json");
const pixel3DProof = readJson("pilots/pixel-3d/pilot-proof.json");
const pixel3DCatalog = readJson("pilots/pixel-3d/catalog.json");
const treatmentProof = readJson("pilots/visual-treatment-pilot-manifest.json");
assert.equal(catalog.status, "EXPERIMENTAL");
assert.equal(catalog.assets.length, 4);
assert(catalog.assets.every((asset) => asset.simulation_state_digest));
assert(causalProof.checks.every((check) => check.pass));
assert(sofaProof.checks.every((check) => check.pass));
assert.equal(filmReceipt.frames, 240);
assert.equal(filmReceipt.unique_frames, 40);
assert.equal(filmReceipt.duration_seconds, 20);
assert.equal(filmReceipt.expanded_raw_frames_held, false);
assert(filmReceipt.checks.every((check) => check.pass));
assert.equal(gameVisualProof.status, "PASS");
assert.equal(gameVisualProof.scenarios.length, 7);
assert.equal(gameVisualProof.baseline_receipt.status, "PASS");
assert(Object.values(gameVisualProof.assertions).every(Boolean));
assert.equal(GameVisual.buildPilotScenarioProof().status, "PASS");
assert.equal(pixel3DProof.status, "EXPERIMENTAL");
assert.equal(pixel3DProof.identities.length, 4);
assert(pixel3DProof.checks.every((check) => check.pass));
assert(pixel3DProof.unavailable_requests.every((gap) => gap.status === "MISSING_REPRESENTATION" && gap.fallback_used === false));
assert.equal(pixel3DCatalog.identities.length, 4);
assert.equal(treatmentProof.status, "PASS");
assert.equal(treatmentProof.catalog_digest, Treatment.CATALOG.digest);
assert.deepEqual(treatmentProof.counts, { treated_identity_packages: 4, pbr_material_sets: 6, style_choices: 28, aetherfx_modules: 64, portable_fx_blocks: 15, adapters: 30 });
assert.equal(treatmentProof.boundaries.fallback_used, false);
for (const item of treatmentProof.packages) {
  const inspection = Pixel3DCodec.inspect(fs.readFileSync(path.join(root, "pilots", item.glb)));
  const recipe = readJson("pilots/visual-treatments/" + item.slug + "/" + item.slug + "-recipe.json");
  const receipt = readJson("pilots/visual-treatments/" + item.slug + "/" + item.slug + "-receipt.json");
  assert.equal(inspection.pass, true);
  assert.equal(inspection.identity_id, item.identity_id);
  assert.equal(Schemas.validate(Treatment.SCHEMAS.recipe, recipe).pass, true);
  assert.equal(Schemas.validate(Treatment.SCHEMAS.receipt, receipt).pass, true);
  assert.equal(receipt.fallback_used, false);
  assert.equal(receipt.nearest_substitute_used, false);
}
for (const set of treatmentProof.pbr_material_sets) {
  assert.equal(set.verification, "pass");
  for (const relative of set.maps.concat([set.preview])) {
    const inspection = Raster.inspectPng(fs.readFileSync(path.join(root, "pilots", relative)));
    assert.equal(inspection.pass, true);
    assert.equal(inspection.width, 128);
    assert.equal(inspection.height, 128);
  }
}
assert.equal(Schemas.validate(Pixel3D.SCHEMAS.request, { schema: Pixel3D.SCHEMAS.request, version: "1.0.0", id: "schema-proof", identity_id: "axm.park.ferris-wheel", profile_id: "pixel-8bit-3d", animation_state: "running", authority: "candidate-only" }).pass, true);
for (const item of pixel3DCatalog.identities) {
  const proofItem = pixel3DProof.identities.find((candidate) => candidate.identity_id === item.identity_id);
  assert(proofItem);
  assert.equal(Schemas.validate("axm.asset-identity/v1", readJson(proofItem.identity.path)).pass, true);
  assert.equal(Schemas.validate("axm.asset-representation-set/v1", readJson(proofItem.representation_set.path)).pass, true);
  for (const profileId of ["pixel-8bit-3d", "pixel-16bit-3d"]) {
    const model = fs.readFileSync(path.join(root, item.profiles[profileId]));
    const inspection = Pixel3DCodec.inspect(model);
    assert.equal(inspection.pass, true);
    assert.equal(inspection.identity_id, item.identity_id);
    assert.equal(inspection.representation_profile_id, profileId);
    assert.equal(inspection.animations, 1);
    assert.equal(Schemas.validate(Pixel3D.SCHEMAS.profile, readJson(proofItem.profiles[profileId].profile.path)).pass, true);
    assert.equal(Schemas.validate(Pixel3D.SCHEMAS.recipe, readJson(proofItem.profiles[profileId].recipe.path)).pass, true);
    assert.equal(Schemas.validate(Pixel3D.SCHEMAS.receipt, readJson(proofItem.profiles[profileId].receipt.path)).pass, true);
  }
}
assert.equal(Pixel3D.resolveProfile("cinematic-render").status, "MISSING_REPRESENTATION");
assert.equal(Pixel3D.resolveProfile("cinematic-render").fallback_used, false);
assert.equal(Video.inspectMp4(fs.readFileSync(path.join(root, "pilots/film/axm-choice-first-pixel-explainer.mp4"))).frames, 240);
assert.equal(Video.inspectWebm(fs.readFileSync(path.join(root, "pilots/film/axm-choice-first-pixel-explainer.webm"))).frames, 240);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(html.includes("choice-first-core.js"));
assert(html.includes("choice-first-pilot-core.js"));
assert(html.includes("game-visual-pack-core.js"));
assert(html.includes("game-layer-app.js"));
assert(html.includes("pixel-3d-core.js"));
assert(html.includes("pixel-3d-app.js"));
assert(html.includes("visual-treatment-core.js"));
assert(html.includes("visual-treatment-app.js"));
assert(html.includes("Prove unknown effect refusal"));
assert(html.includes("native-renderer.mjs") === false, "native renderer is dynamically imported by the bounded viewer app");
assert(fs.readFileSync(path.join(root, "pixel-3d-app.js"), "utf8").includes("native-renderer.mjs"));
assert(html.includes("Whole-game 3D pack: not yet available"));
assert(html.includes("hardwareProfileSelect"));
assert(html.includes("Recommendation is not activation"));
assert(html.includes("<video"));
assert(html.includes("kind=\"captions\""));
assert(html.includes("installed: false"));
console.log("Choice-First Visual & Simulation Lab selftest PASS (asset and whole-game choice layers, 8 base + 4 treated animated GLBs, 6 verified PBR map sets, 28 styles, 64 AetherFX routes, native WebGL viewer seam, old-machine baseline, player authority, causal replay/no-decay, sofa branches, 240-sample film)");
