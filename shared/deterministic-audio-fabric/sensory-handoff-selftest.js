"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Hands = require("../asset-hands/asset-hands");
const Audio = require(".");

const handoff = fs.readFileSync(path.join(__dirname, "SENSORY_HANDOFF.md"), "utf8");
[
  "deterministic-audio-fabric",
  "deterministic-audio-recipe",
  "deterministic-audio-wav",
  "deterministic-audio-analysis",
  "deterministic-audio-verification",
  Audio.RECIPE_SCHEMA,
  Audio.ANALYSIS_SCHEMA,
  Audio.VERIFICATION_SCHEMA,
  "CONTRACT-AUDIO-HOST-BRIDGE-001",
  "HAND-AUDIO-SENSORY-001",
  "EVIDENCE-AUDIO-PLAYBACK-001",
  "EVIDENCE-AUDIO-PACING-001",
  "EVIDENCE-AUDIO-ACCESSIBILITY-001",
  "EVIDENCE-AUDIO-DEVICE-001",
  "EVIDENCE-AUDIO-HUMAN-APPROVAL-001",
  "EVIDENCE-AUDIO-EXTERNAL-CONFORMANCE-001",
].forEach((token) => assert.ok(handoff.includes(token), "handoff is missing " + token));

const result = Hands.create("deterministic-audio-fabric", {
  id: "sensory-handoff-fixture",
  title: "Hit Candidate",
  kind: "sound-effect",
  operation_mode: "create",
  intended_use: "sound-effect",
  styleTags: ["hit"],
  target_canvas: {
    medium: "audio-device",
    dimensions: { width: 1, height: 1, unit: "px" },
    colour: { space: "srgb", transparency: "opaque" },
    behaviour: ["static"],
    temporal: { sample_rate: 44100, channel_layout: "mono" },
    performance: { max_file_bytes: 300000, max_duration_seconds: 1 },
    intended_use: "sound-effect",
  },
  required_outputs: [Audio.RECIPE_SCHEMA, "audio/wav", Audio.ANALYSIS_SCHEMA, Audio.VERIFICATION_SCHEMA],
  editable_recipe_formats: [Audio.RECIPE_SCHEMA],
  quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
}, {
  seed: "sensory-handoff-fixture",
  createdAt: "2026-08-22T00:00:00.000Z",
});

assert.equal(result.status, "READY");
assert.equal(result.validation_receipt.status, "PASS");
assert.deepEqual(result.artifacts.map((artifact) => ({
  id: artifact.id,
  role: artifact.role,
  mime: artifact.mime,
  schema: artifact.metadata.schema,
  editable: artifact.editable,
  payload: artifact.dataUrl ? "dataUrl" : "text",
})), [
  { id: "deterministic-audio-recipe", role: "editable-audio-recipe", mime: "application/json", schema: Audio.RECIPE_SCHEMA, editable: true, payload: "text" },
  { id: "deterministic-audio-wav", role: "pcm16-wav-delivery", mime: "audio/wav", schema: "audio/wav", editable: false, payload: "dataUrl" },
  { id: "deterministic-audio-analysis", role: "technical-audio-analysis", mime: "application/json", schema: Audio.ANALYSIS_SCHEMA, editable: false, payload: "text" },
  { id: "deterministic-audio-verification", role: "technical-verification", mime: "application/json", schema: Audio.VERIFICATION_SCHEMA, editable: false, payload: "text" },
]);
assert.equal(result.preview.available, true);
assert.equal(result.preview.mime, "audio/wav");
const verification = JSON.parse(result.artifacts[3].text);
assert.equal(verification.claims.audible_playback_verified, false);
assert.equal(verification.claims.human_listened, false);
assert.equal(verification.claims.human_aesthetic_approval, false);
assert.equal(verification.authority.promoted, false);
assert.equal(verification.authority.canonical, false);

console.log(
  "AXM deterministic audio sensory handoff selftest: PASS (exact artifact contract, safe recipe edit seam, eight typed human evidence gaps, non-promoting boundary)",
);
