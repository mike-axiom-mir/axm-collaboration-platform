#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const Hands = require("../../shared/asset-hands/asset-hands");
const Spatial = require("../../shared/deterministic-spatial-handoff");
const Server = require("./server");
const Core = require("./core");
const Renderer = require("./renderer");

const createdAt = "2026-08-22T00:00:00.000Z";
const host = { capabilities: ["svg", "json", "canvas-2d", "output:image.transform"], permissions: [], accepts: [Hands.RESULT_SCHEMA, "model/obj", "model/gltf-binary", "application/json", "image/svg+xml"] };
function create(controls, mode, project) {
  const result = Hands.create("parametric-mesh", Server.buildBrief(controls, mode, project), { seed: controls.seed, createdAt, host });
  return { result, handoff: Spatial.gateResult(result) };
}

const controls = Server.defaultControls();
const first = create(controls, "create");
assert.equal(first.result.status, "READY");
assert.equal(first.handoff.status, "PASS");
const session = Core.createSession(first.result, first.handoff);
assert.equal(session.current_controls.primitive, "sphere");
assert.equal(Core.acceptanceGate(session).pass, false);
assert.deepEqual(Core.acceptanceGate(session).missing, ["dynamic WebGL2 frame for current viewer state", "user-driven orbit", "user-driven zoom", "front view", "side view", "top view"]);

const glb = first.result.artifacts.find((artifact) => artifact.id === "mesh-glb");
const parsed = Renderer.parseGlb(glb.dataUrl);
assert.equal(parsed.triangle_count, first.handoff.glb.triangle_count);
assert.equal(parsed.vertex_count, first.handoff.glb.vertex_count);
assert.equal(parsed.zero_normal_count, first.handoff.glb.zero_normal_count);
assert.equal(parsed.material.metallicFactor, first.handoff.glb.material_projection.metallicFactor);

Core.recordInteraction(session, "orbit", { input: "test" });
Core.recordInteraction(session, "zoom", { input: "test" });
["front", "side", "top"].forEach((preset) => Core.recordInteraction(session, "preset", { preset }));
Core.recordRenderObservation(session, { webgl2: true, dynamic_frame_observed: true, result_digest: first.result.digest, glb_sha256: first.handoff.artifact_sha256["mesh-glb"], frame_count: 6, zero_normal_count: first.handoff.glb.zero_normal_count });
assert.equal(Core.acceptanceGate(session).pass, true);
const receipt = Core.setReview(session, { decision: "ACCEPT_FOR_TEST", notes: "Bounded synthetic human-seat test only" });
assert.equal(receipt.authority.promoted, false);
assert.equal(receipt.claims.target_renderer_parity, false);
assert.equal(receipt.dynamic_view_gate.pass, true);

const viewerDigest = session.viewer_state_digest;
Core.setViewer(session, { projection: "orthographic" });
assert.notEqual(session.viewer_state_digest, viewerDigest);
assert.equal(session.human_judgment, null);
assert.equal(session.stale_review_history.length, 1);

const editedControls = Object.assign({}, session.current_controls, {
  primitive: "torus",
  dimensions: { width: 3, height: 1.25, depth: 2, unit: "m" },
  max_polygon_count: 900,
  position: [0.25, -0.1, 0.4],
  rotation: [18, 37, -12],
  inflate: 0.15,
  twist: 42,
  baseColor: "#d8842f",
  metallic: 0.72,
  roughness: 0.28,
  opacity: 0.84,
  doubleSided: true
});
Core.replaceDraftControls(session, editedControls);
assert.equal(session.pending_edit.primitive_control_mode, "brief-semantic-inference");
const second = create(session.draft_controls, "edit", session.current_project);
assert.equal(second.handoff.status, "PASS");
assert.equal(second.handoff.project_profile.primitive, "torus");
assert.equal(second.result.artifacts.length, 4);
first.result.artifacts.forEach((artifact) => assert.notEqual(second.result.artifacts.find((item) => item.id === artifact.id).digest, artifact.digest));
Core.bindRegeneratedResult(session, second.result, second.handoff);
assert.equal(session.current_controls.primitive, "torus");
assert.equal(session.journey.orbit_count, 0);
assert.equal(Core.acceptanceGate(session).pass, false);
const preserved = session.current_result.digest;
Core.recordRegenerationFailure(session, { code: "RESULT_NOT_REVIEWABLE", message: "synthetic failure", result_status: "HOLD" });
assert.equal(session.current_result.digest, preserved);
assert.equal(session.last_regeneration_failure.preserved_result_digest, preserved);

assert.throws(() => Core.setReview(session, { decision: "ACCEPT_FOR_TEST", notes: "must fail" }), /requires/);
const revise = Core.setReview(session, { decision: "NEEDS_CHANGES", notes: "Further shape work required" });
assert.equal(revise.decision, "NEEDS_CHANGES");
assert.equal(Core.exportSession(session).authority.canonical, false);

const tampered = JSON.parse(JSON.stringify(second.handoff));
tampered.result_digest = "tampered";
assert.throws(() => Core.inspectBundle(second.result, tampered), /mismatch/);

console.log("AXM spatial sensory core selftest: PASS (machine gate bind, GLB parse, journey-gated human receipt, viewer staleness, transactional edit/failure preservation)");
