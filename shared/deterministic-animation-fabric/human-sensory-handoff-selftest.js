"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Hands = require("../asset-hands/asset-hands.js");
const Motion = require("./index.js");

const brief = {
  id: "human-sensory-handoff-proof",
  title: "Human Sensory Handoff Proof",
  kind: "procedural-animation",
  operation_mode: "create",
  intended_use: "procedural-animation",
  target_canvas: {
    medium: "game-world",
    dimensions: { width: 64, height: 64, unit: "px" },
    colour: { space: "srgb", transparency: "allowed" },
    behaviour: ["animated"],
    intended_use: "procedural-animation",
    performance: {
      max_file_bytes: 3000000,
      max_animation_frames: 12,
      frames_per_second: 6,
      max_duration_seconds: 2,
    },
  },
  required_outputs: [
    Motion.RECIPE_SCHEMA,
    Motion.COMPOSITION_SCHEMA,
    Motion.BAKE_SCHEMA,
    Motion.RECEIPT_SCHEMA,
    "axm.sprite-atlas/v1",
    "text/css",
    "image/svg+xml",
  ],
  editable_recipe_formats: [Motion.RECIPE_SCHEMA, Motion.COMPOSITION_SCHEMA],
  quality_requirements: {
    require_preview: true,
    require_validation: true,
    require_editable_source: true,
  },
};

const result = Hands.create("deterministic-animation-fabric", brief, {
  seed: "human-sensory-handoff-proof",
  createdAt: "2000-01-01T00:00:00.000Z",
});

assert.equal(result.status, "READY");
assert.equal(result.validation_receipt.status, "PASS");
assert.equal(result.hand.id, "deterministic-animation-fabric");
assert.equal(result.hand.version, "1.1.0");
assert.equal(result.hand.authority, "candidate-only");
assert.equal(result.previewArtifactId, "deterministic-motion-filmstrip");
assert.equal(result.preview.artifactId, result.previewArtifactId);

const expected = new Map([
  ["deterministic-motion-composition", ["editable-motion-composition", true, Motion.COMPOSITION_SCHEMA]],
  ["deterministic-motion-recipe", ["editable-motion-recipe", true, Motion.RECIPE_SCHEMA]],
  ["deterministic-motion-bake", ["fixed-point-motion-bake", false, Motion.BAKE_SCHEMA]],
  ["deterministic-motion-css", ["web-motion-adapter", true, null]],
  ["deterministic-motion-atlas-image", ["motion-sprite-atlas-image", false, null]],
  ["deterministic-motion-atlas-manifest", ["motion-sprite-atlas-manifest", false, "axm.sprite-atlas/v1"]],
  ["deterministic-motion-filmstrip", ["motion-filmstrip-proof", false, null]],
  ["deterministic-motion-verification", ["technical-verification", false, Motion.RECEIPT_SCHEMA]],
]);

assert.equal(result.artifacts.length, expected.size);
result.artifacts.forEach((artifact) => {
  const contract = expected.get(artifact.id);
  assert.ok(contract, "undocumented handoff artifact " + artifact.id);
  assert.equal(artifact.role, contract[0]);
  assert.equal(artifact.editable, contract[1]);
  assert.equal(artifact.content_schema, undefined, "output artifacts currently route content schema through metadata");
  if (contract[2]) {
    assert.equal(artifact.metadata.schema, contract[2]);
    assert.equal(JSON.parse(artifact.text).schema, contract[2]);
  }
});

const filmstrip = result.artifacts.find((artifact) => artifact.id === result.previewArtifactId);
assert.equal(filmstrip.metadata.static_proof_only, true);
assert.equal(result.artifacts.find((artifact) => artifact.id === "deterministic-motion-css").metadata.lossy, true);
assert.equal(
  JSON.parse(result.artifacts.find((artifact) => artifact.id === "deterministic-motion-verification").text)
    .claims.does_not_prove.includes("motion taste"),
  true,
);

const compositionArtifact = result.artifacts.find((artifact) => artifact.id === "deterministic-motion-composition");
const sourceArtifact = {
  id: compositionArtifact.id,
  role: "composition",
  name: compositionArtifact.name,
  mime: compositionArtifact.mime,
  format: compositionArtifact.format,
  content_schema: compositionArtifact.metadata.schema,
  editable: true,
  text: compositionArtifact.text,
  digest: compositionArtifact.digest,
  metadata: { source_result_digest: result.digest },
};
const edited = Hands.create(
  "deterministic-animation-fabric",
  Object.assign({}, brief, {
    id: "human-sensory-handoff-edit-proof",
    operation_mode: "edit",
    source_artifacts: [sourceArtifact],
  }),
  { seed: result.seed, createdAt: "2000-01-01T00:00:00.000Z" },
);
assert.equal(edited.status, "READY");
assert.equal(edited.creation_recipe.parameters.sourceSchema, Motion.COMPOSITION_SCHEMA);
assert.equal(edited.creation_recipe.source_artifact_digests[0].digest, compositionArtifact.digest);
assert.equal(edited.measures.compositionDigest, result.measures.compositionDigest);
assert.equal(edited.measures.bakeDigest, result.measures.bakeDigest);

const handoff = fs.readFileSync(path.join(__dirname, "HUMAN_SENSORY_HANDOFF.md"), "utf8");
expected.forEach((_contract, id) => assert.match(handoff, new RegExp("`" + id + "`")));
[
  "HAND-LIVE-PLAYER-001",
  "CONTRACT-ARTIFACT-SCHEMA-BRIDGE-001",
  "CONTRACT-TEMPORAL-OBSERVATION-001",
  "EVIDENCE-FRAME-PACING-001",
  "CONTRACT-REDUCED-MOTION-001",
  "EVIDENCE-ACCESSIBILITY-001",
  "CONTRACT-HUMAN-REVIEW-001",
  "EVIDENCE-AESTHETIC-001",
].forEach((gap) => assert.match(handoff, new RegExp("`" + gap + "`")));
assert.match(handoff, /viewer_state_digest/);
assert.match(handoff, /zoom, contrast mode, playback/);

console.log(
  "Human sensory handoff selftest PASS " +
    "(8 exact artifacts, static-preview truth, schema bridge, composition round trip, 8 typed gaps, viewer-state binding)",
);
