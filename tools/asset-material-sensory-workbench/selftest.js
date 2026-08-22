#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const Hands = require("../../shared/asset-hands/asset-hands");
const Material = require("../../shared/deterministic-material-fabric");
const Core = require("./core");
const Host = require("./server");

const host = {
  capabilities: ["json", "png"],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "image/png", "application/json", Core.RECIPE_SCHEMA, "axm.pbr-material-bake-receipt/v1"]
};

async function generate(recipe, mode, baseBrief) {
  const brief = Host.buildBrief(recipe, mode, baseBrief);
  return Hands.createAsync(Core.HAND_ID, brief, { seed: recipe.seed, createdAt: "2026-08-22T00:00:00.000Z", host });
}

function observeAndReview(session, reviewer, verdict = "ACCEPT_FOR_TEST") {
  const bundle = Core.activeBundle(session);
  Core.recordRenderObservation(session, {
    webgl2: true,
    dynamic_frame_observed: true,
    result_digest: bundle.result.digest,
    viewer_state_digest: session.viewer_state_digest,
    frame_count: 4,
    interaction_count: 2,
    renderer_id: "selftest-webgl2-fixture"
  });
  Core.recordHumanJudgment(session, {
    reviewer,
    verdict,
    dynamic_view_observed: true,
    observations: {
      tiling_seams: "GOOD",
      colour: "GOOD",
      normal_response: "GOOD",
      roughness_metalness: "GOOD",
      emission: "NOT_APPLICABLE",
      height_coherence: "GOOD",
      readability_intended_use: "GOOD"
    },
    notes: "Synthetic selftest judgment; not retained as human taste evidence."
  });
}

async function main() {
  const initialRecipe = Host.defaultRecipe();
  initialRecipe.size = 64;
  const first = await generate(initialRecipe, "create");
  const firstGate = Material.gateResult(first);
  assert.equal(first.status, "READY");
  assert.equal(firstGate.status, "PASS");
  const session = Core.createSession(first, firstGate);
  assert.equal(session.current_result_digest, first.digest);
  assert.equal(session.current_recipe.size, 64);
  assert.equal(Object.keys(session.current_handoff.png_sha256).length, 6);

  observeAndReview(session, "material-selftest-fixture");
  const firstReceipt = Core.createReceipt(session);
  assert.equal(firstReceipt.schema, Core.REVIEW_SCHEMA);
  assert.equal(firstReceipt.render_observation.dynamic_webgl2_observed, true);
  assert.equal(firstReceipt.authority.promoted, false);
  assert.equal(firstReceipt.render_observation.target_renderer_parity_verified, false);

  const sourceResultDigest = session.current_result_digest;
  const sourceRecipeDigest = session.current_recipe_digest;
  Core.setViewer(session, { light_azimuth_deg: 75, uv_tiling: 3 });
  assert.equal(session.current_result_digest, sourceResultDigest);
  assert.equal(session.current_recipe_digest, sourceRecipeDigest);
  assert.equal(session.human_judgment, null);
  assert.equal(session.stale_review_history.length, 1);

  Core.applyRecipeEdit(session, "family", "asphalt");
  Core.applyRecipeEdit(session, "seed", "material-selftest-asphalt");
  Core.applyRecipeEdit(session, "normal_strength", 4.25);
  assert.equal(session.pending_edit.changes.length, 3);
  const edited = await generate(session.draft_recipe, "edit", session.current_result.brief);
  const editedGate = Material.gateResult(edited);
  assert.equal(edited.status, "READY");
  assert.equal(editedGate.status, "PASS");
  assert.notEqual(edited.digest, first.digest);
  const changedPngs = Object.keys(Material.PNG_SPECS).filter((id) => editedGate.png_sha256[id] !== firstGate.png_sha256[id]);
  ["pbr-albedo-map", "pbr-normal-map", "pbr-orm-map", "pbr-height-map", "pbr-material-preview"].forEach((id) => assert.ok(changedPngs.includes(id), id + " should change for the brick-to-asphalt edit"));
  assert.equal(editedGate.png_sha256["pbr-emissive-map"], firstGate.png_sha256["pbr-emissive-map"], "two non-emissive families may truthfully share black emissive bytes");
  assert.notEqual(editedGate.recipe_artifact_digest, firstGate.recipe_artifact_digest);
  assert.notEqual(editedGate.receipt_artifact_digest, firstGate.receipt_artifact_digest);
  Core.bindRegeneratedResult(session, edited, editedGate);
  assert.equal(session.current_recipe.family, "asphalt");
  assert.equal(session.pending_edit, null);
  assert.equal(session.edits.length, 3);

  observeAndReview(session, "material-hold-preservation-fixture", "REVISE");
  const preservedReview = JSON.stringify(session.human_judgment);
  const preservedResult = session.current_result_digest;
  Core.applyRecipeEdit(session, "family", "glass");
  Core.applyRecipeEdit(session, "seed", "glass-proof-01");
  Core.applyRecipeEdit(session, "size", 256);
  Core.applyRecipeEdit(session, "normal_strength", 1.7);
  const held = await generate(session.draft_recipe, "edit", session.current_result.brief);
  const heldGate = Material.gateResult(held);
  assert.equal(held.status, "HOLD");
  assert.equal(heldGate.status, "FAIL");
  assert.equal(heldGate.code, "RESULT_NOT_REVIEWABLE");
  Core.recordRegenerationFailure(session, { code: heldGate.code, message: heldGate.message, result_status: held.status });
  assert.equal(session.current_result_digest, preservedResult);
  assert.equal(JSON.stringify(session.human_judgment), preservedReview);
  assert.equal(session.last_regeneration_failure.preserved_review, true);

  const patch = Core.machinePatch(session);
  assert.equal(patch.schema, Core.PATCH_SCHEMA);
  assert.equal(patch.viewer_state_is_source_neutral, true);
  assert.equal(patch.authority.installed, false);
  assert.equal(patch.source_artifact.content_schema, Core.RECIPE_SCHEMA);
  assert.equal(patch.target_canvas_patch.dimensions.width, 256);
  assert.equal(patch.target_canvas_patch.dimensions.height, 256);

  const tampered = JSON.parse(JSON.stringify(editedGate));
  tampered.result_digest = "wrong";
  assert.throws(() => Core.inspectBundle(edited, tampered), /result digest mismatch/);
  assert.throws(() => Core.recordHumanJudgment(Core.createSession(first, firstGate), {
    reviewer: "accept-without-render",
    verdict: "ACCEPT_FOR_TEST",
    dynamic_view_observed: true,
    observations: {},
    notes: ""
  }), /dynamic WebGL2 observation/);

  process.stdout.write("Asset Material Sensory Workbench selftest PASS (exact machine gate, six SHA-bound PNGs, source-neutral viewer, transactional edit, HOLD preservation, dynamic acceptance gate, non-promoting receipt)\n");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
