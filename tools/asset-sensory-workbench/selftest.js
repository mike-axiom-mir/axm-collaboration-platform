"use strict";

const assert = require("assert");
const path = require("path");
const Core = require("./core");
const Fabric = require("../../shared/deterministic-animation-fabric");
const Hands = require("../../shared/asset-hands/asset-hands");
const source = require(path.join(
  __dirname,
  "../../shared/deterministic-animation-fabric/fixtures/modular-motion.recipe.json",
));

const first = Core.createSession(source, { id: "sensory-selftest" });
const second = Core.createSession(source, { id: "sensory-selftest" });
assert.deepStrictEqual(first, second, "equal source must create an equal session");
assert.strictEqual(first.source.digest, Core.digest(source));
assert.strictEqual(first.authority.installed, false);
assert.strictEqual(first.authority.promoted, false);
assert.strictEqual(first.authority.canonical, false);

const humanEdit = Core.applyEdit(first, {
  field: "motion.horizontal_amplitude",
  value: 24,
  actor_kind: "human",
  actor_id: "selftest-human",
});
assert.strictEqual(Core.readField(humanEdit.draft_source, "motion.horizontal_amplitude"), 24);
assert.notStrictEqual(humanEdit.draft_digest, first.draft_digest);
assert.strictEqual(humanEdit.edits[0].channel, "human-control");

const machineEdit = Core.applyEdit(humanEdit, {
  field: "motion.rotation_degrees",
  value: 9,
  actor_kind: "machine",
  actor_id: "selftest-machine",
});
assert.strictEqual(Core.readField(machineEdit.draft_source, "motion.rotation_degrees"), 9);
assert.strictEqual(machineEdit.edits[1].channel, "machine-api");
assert.strictEqual(machineEdit.draft_source.nodes.find((node) => node.id === "turn").output_min, -9);

assert.throws(
  () => Core.applyEdit(first, { field: "motion.unknown", value: 1 }),
  /MISSING_EDIT_CAPABILITY/,
);
assert.throws(
  () => Core.applyEdit(first, { field: "motion.horizontal_amplitude", value: 999 }),
  /inside 0\.\.48/,
);
assert.throws(
  () => Core.applyEdit(first, { field: "presentation.fill", value: "red" }),
  /six-digit hexadecimal colour/,
);

const adapted = Core.setViewer(machineEdit, {
  playback_rate: 0.5,
  reduced_motion: true,
  high_contrast: true,
  zoom: 1.5,
});
assert.strictEqual(adapted.draft_digest, machineEdit.draft_digest);
assert.deepStrictEqual(adapted.draft_source, machineEdit.draft_source);
assert.deepStrictEqual(adapted.viewer.playback_rate, { numerator: 1, denominator: 2 });
assert.strictEqual(adapted.viewer.motion_scale, 0);
assert.strictEqual(adapted.viewer.reduced_motion_strategy, "disable-transform-motion");

const compiled = Fabric.compileRecipe(adapted.draft_source);
const sample = Fabric.sampleCompiled(compiled, 6000);
const x = sample.values.find((value) => value.property === "transform.x");
assert(x && Number.isFinite(x.value), "edited deterministic recipe must remain sampleable");

const judged = Core.recordHumanJudgment(adapted, {
  reviewer_id: "mike-test-seat",
  verdict: "REVISE",
  impression: "TOO_FAST",
  note: "Readable, but the first response feels abrupt.",
  recorded_at: "2026-08-22T00:00:00.000Z",
});
const receipt = Core.createReceipt(judged, {
  status: "PASS",
  evidence: ["deterministic-animation compileRecipe", "sampleCompiled at tick 6000"],
});
assert.strictEqual(receipt.human_judgment.verdict, "REVISE");
assert.strictEqual(receipt.authority.promoted, false);
assert.match(receipt.truth, /does not install, promote, canonize or publish/);
assert.strictEqual(receipt.runtime.frame_pacing_verified, false);
assert.strictEqual(receipt.viewer_state_digest, Core.digest(judged.viewer));
assert.strictEqual(receipt.human_judgment.viewer_state_digest, receipt.viewer_state_digest);
assert.strictEqual(receipt.digest, Core.digest({ ...receipt, digest: undefined }));
const viewerChangedAfterReview = Core.setViewer(judged, { zoom: 1.6 });
assert.strictEqual(
  viewerChangedAfterReview.human_judgment,
  null,
  "viewer changes must invalidate a judgment bound to the prior sensory state",
);
assert.strictEqual(viewerChangedAfterReview.review_history.length, 1);
assert.strictEqual(viewerChangedAfterReview.review_history[0].stale_reason, "viewer-change");
assert.strictEqual(
  viewerChangedAfterReview.review_history[0].previous_judgment.viewer_state_digest,
  receipt.viewer_state_digest,
);

const patch = Core.machinePatch(judged);
assert.strictEqual(patch.operations.length, 2);
assert.strictEqual(patch.result.digest, judged.draft_digest);
assert.deepStrictEqual(patch.draft_source, judged.draft_source);

const brief = {
  id: "asset-sensory-hand-result-proof",
  title: "Asset Sensory Hand Result Proof",
  kind: "procedural-animation",
  operation_mode: "create",
  intended_use: "procedural-animation",
  target_canvas: {
    medium: "game-world",
    dimensions: { width: 96, height: 96, unit: "px" },
    colour: { space: "srgb", transparency: "allowed" },
    behaviour: ["animated"],
    intended_use: "procedural-animation",
    performance: {
      max_file_bytes: 3000000,
      max_animation_frames: 24,
      frames_per_second: 12,
      max_duration_seconds: 2,
    },
  },
  required_outputs: [
    Fabric.RECIPE_SCHEMA,
    Fabric.COMPOSITION_SCHEMA,
    Fabric.BAKE_SCHEMA,
    Fabric.RECEIPT_SCHEMA,
    "axm.sprite-atlas/v1",
    "text/css",
    "image/svg+xml",
  ],
  editable_recipe_formats: [Fabric.RECIPE_SCHEMA, Fabric.COMPOSITION_SCHEMA],
  quality_requirements: {
    require_preview: true,
    require_validation: true,
    require_editable_source: true,
  },
};

const handResult = Hands.create("deterministic-animation-fabric", brief, {
  seed: "asset-sensory-hand-result-proof",
  createdAt: "2000-01-01T00:00:00.000Z",
});
const compositionSession = Core.ingestHandResult(handResult, { id: "composition-session" });
assert.strictEqual(compositionSession.draft_source.schema, Fabric.COMPOSITION_SCHEMA);
assert.strictEqual(compositionSession.result_binding.validation_status, "PASS");
assert.strictEqual(compositionSession.static_preview.static_proof_only, true);
assert.strictEqual(compositionSession.source_artifact.content_schema, Fabric.COMPOSITION_SCHEMA);
assert.strictEqual(
  compositionSession.source.canonical_digest,
  handResult.measures.compositionDigest,
  "both canonical and artifact digest families must be retained",
);

const compositionEdited = Core.applyEdit(compositionSession, {
  field: "motion.horizontal_amplitude",
  value: 21,
  actor_kind: "human",
  actor_id: "composition-human",
});
const sourceArtifact = Core.roundTripSourceArtifact(compositionEdited);
assert.strictEqual(sourceArtifact.content_schema, Fabric.COMPOSITION_SCHEMA);
assert.strictEqual(JSON.parse(sourceArtifact.text).schema, sourceArtifact.content_schema);
assert.strictEqual(sourceArtifact.metadata.origin_artifact_digest, compositionSession.source.artifact_digest);

const regenerated = Hands.create(
  "deterministic-animation-fabric",
  {
    ...brief,
    id: "asset-sensory-hand-result-edit-proof",
    operation_mode: "edit",
    source_artifacts: [sourceArtifact],
  },
  { seed: handResult.seed, createdAt: "2000-01-01T00:00:00.000Z" },
);
assert.strictEqual(regenerated.status, "READY");
assert.notStrictEqual(regenerated.measures.compositionDigest, handResult.measures.compositionDigest);
const regeneratedSession = Core.bindRegeneratedResult(compositionEdited, regenerated);
assert.strictEqual(regeneratedSession.result_binding.composition_digest, compositionEdited.draft_digest);
assert.strictEqual(regeneratedSession.derived_artifacts.length, 7);

const corrupt = JSON.parse(JSON.stringify(handResult));
corrupt.artifacts.find((artifact) => artifact.id === "deterministic-motion-composition").metadata.schema =
  Fabric.RECIPE_SCHEMA;
assert.throws(
  () => Core.ingestHandResult(corrupt),
  /CONTRACT-ARTIFACT-SCHEMA-BRIDGE-001/,
);

console.log(
  "Asset Sensory Workbench selftest PASS " +
    "(Asset Hand gate + schema bridge, composition round trip with regenerated artifacts, " +
    "human controls -> digest-bound edits, machine API parity, viewer/source separation, " +
    "reduced-motion adaptation, human receipt without promotion)",
);
