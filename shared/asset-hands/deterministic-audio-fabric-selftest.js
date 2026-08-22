"use strict";

const assert = require("node:assert/strict");
const Hands = require("./asset-hands");
const Audio = require("../deterministic-audio-fabric");
const Provider = require("./hands/deterministic-audio-fabric");

function brief(operationMode, sourceArtifacts, overrides) {
  overrides = overrides || {};
  return {
    schema: "axm.asset-brief/v1",
    id: "audio-hand-fixture",
    title: "Coin Candidate",
    kind: "sound-effect",
    operation_mode: operationMode || "create",
    intended_use: "sound-effect",
    styleTags: ["coin"],
    target_canvas: {
      medium: "audio-device",
      dimensions: { width: 1, height: 1, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      behaviour: ["static"],
      temporal: {
        sample_rate: overrides.sample_rate == null ? 44100 : overrides.sample_rate,
        channel_layout: overrides.channel_layout || "mono",
      },
      performance: {
        max_file_bytes: overrides.max_file_bytes || 300000,
        max_duration_seconds: overrides.max_duration_seconds || 1,
      },
      intended_use: "sound-effect",
    },
    source_artifacts: sourceArtifacts || [],
    required_outputs: [
      Audio.RECIPE_SCHEMA,
      "audio/wav",
      Audio.ANALYSIS_SCHEMA,
      Audio.VERIFICATION_SCHEMA,
    ],
    editable_recipe_formats: [Audio.RECIPE_SCHEMA],
    quality_requirements: {
      require_preview: true,
      require_validation: true,
      require_editable_source: true,
    },
  };
}

const descriptor = Hands.list().find((hand) => hand.id === "deterministic-audio-fabric");
assert.ok(descriptor);
assert.equal(descriptor.id, "deterministic-audio-fabric");
assert.equal(descriptor.version, "1.0.0");
assert.equal(descriptor.source_contract, "native-v2");
assert.deepEqual(descriptor.operation_modes, ["create", "edit"]);
assert.equal(descriptor.limits.audiblePlaybackVerification, false);
assert.equal(descriptor.limits.humanListeningReviewRequired, true);
assert.equal(Provider.descriptor.id, descriptor.id);
assert.equal(typeof Provider.create, "function");

const options = {
  seed: "public-loopback-route-fixture",
  createdAt: "2026-08-22T00:00:00.000Z",
};
const created = Hands.create("deterministic-audio-fabric", brief("create"), options);
assert.equal(created.status, "READY", created.technical.errors.join("\n"));
assert.equal(created.validation_receipt.status, "PASS");
assert.equal(created.technical.pass, true);
assert.equal(created.previewArtifactId, "deterministic-audio-wav");
assert.deepEqual(created.preview, {
  artifactId: "deterministic-audio-wav",
  mime: "audio/wav",
  format: "WAV",
  available: true,
});
assert.deepEqual(created.artifacts.map((artifact) => artifact.id), [
  "deterministic-audio-recipe",
  "deterministic-audio-wav",
  "deterministic-audio-analysis",
  "deterministic-audio-verification",
]);

const recipeArtifact = created.artifacts[0];
const wavArtifact = created.artifacts[1];
const analysisArtifact = created.artifacts[2];
const verificationArtifact = created.artifacts[3];
assert.equal(recipeArtifact.metadata.schema, Audio.RECIPE_SCHEMA);
assert.equal(analysisArtifact.metadata.schema, Audio.ANALYSIS_SCHEMA);
assert.equal(verificationArtifact.metadata.schema, Audio.VERIFICATION_SCHEMA);
assert.equal(wavArtifact.metadata.schema, "audio/wav");
assert.match(wavArtifact.dataUrl, /^data:audio\/wav;base64,/);
const wavBytes = Buffer.from(wavArtifact.dataUrl.split(",")[1], "base64");
const header = Audio.inspectCanonicalWav(wavBytes);
assert.equal(header.codec, "PCM");
assert.equal(header.sample_rate_hz, 44100);
assert.equal(header.channels, 1);
assert.equal(header.bits_per_sample, 16);
assert.equal(Audio.sha256(wavBytes), wavArtifact.metadata.sha256);

const analysis = JSON.parse(analysisArtifact.text);
const verification = JSON.parse(verificationArtifact.text);
assert.equal(analysis.status, "TECHNICAL_PASS");
assert.equal(analysis.wav_sha256, wavArtifact.metadata.sha256);
assert.equal(verification.status, "PASS");
assert.equal(verification.claims.audible_playback_verified, false);
assert.equal(verification.claims.human_listened, false);
assert.equal(verification.claims.human_aesthetic_approval, false);
assert.equal(verification.claims.device_output_verified, false);
assert.equal(verification.authority.candidate_only, true);
assert.equal(verification.authority.promoted, false);

const repeated = Hands.create("deterministic-audio-fabric", brief("create"), options);
assert.equal(repeated.status, "READY");
assert.equal(repeated.digest, created.digest);
assert.equal(repeated.validation_receipt.status, created.validation_receipt.status);
assert.deepEqual(
  repeated.artifacts.map((artifact) => ({
    id: artifact.id,
    digest: artifact.digest,
    text: artifact.text,
    dataUrl: artifact.dataUrl,
    metadata: artifact.metadata,
  })),
  created.artifacts.map((artifact) => ({
    id: artifact.id,
    digest: artifact.digest,
    text: artifact.text,
    dataUrl: artifact.dataUrl,
    metadata: artifact.metadata,
  })),
);

const editedRecipe = JSON.parse(recipeArtifact.text);
editedRecipe.sound.params.freq = 777;
const editSource = {
  id: recipeArtifact.id,
  role: recipeArtifact.role,
  name: recipeArtifact.name,
  mime: recipeArtifact.mime,
  format: recipeArtifact.format,
  editable: true,
  text: JSON.stringify(editedRecipe, null, 2),
  metadata: { schema: Audio.RECIPE_SCHEMA },
};
const edited = Hands.create(
  "deterministic-audio-fabric",
  brief("edit", [editSource]),
  options,
);
assert.equal(edited.status, "READY", edited.technical.errors.join("\n"));
assert.equal(edited.validation_receipt.status, "PASS");
assert.notEqual(edited.digest, created.digest);
assert.notEqual(edited.artifacts[1].metadata.sha256, wavArtifact.metadata.sha256);
assert.equal(edited.creation_recipe.parameters.sourceRecipeUsed, true);
assert.ok(edited.creation_recipe.parameters.sourceArtifactDigest);
assert.notEqual(edited.creation_recipe.parameters.sourceArtifactDigest, recipeArtifact.digest);
assert.equal(
  edited.creation_recipe.parameters.sourceRecipeDigest,
  edited.artifacts[0].metadata.digest,
);
assert.equal(
  JSON.parse(edited.artifacts[2].text).wav_sha256,
  edited.artifacts[1].metadata.sha256,
);
assert.equal(
  JSON.parse(edited.artifacts[3].text).wav_sha256,
  edited.artifacts[1].metadata.sha256,
);
const repeatedEdit = Hands.create(
  "deterministic-audio-fabric",
  brief("edit", [editSource]),
  options,
);
assert.equal(repeatedEdit.digest, edited.digest);
assert.equal(repeatedEdit.artifacts[1].dataUrl, edited.artifacts[1].dataUrl);

const unsupportedRate = Hands.create(
  "deterministic-audio-fabric",
  brief("create", [], { sample_rate: 48000 }),
  options,
);
assert.equal(unsupportedRate.status, "HOLD");
assert.equal(unsupportedRate.validation_receipt.status, "HOLD");
assert.ok(unsupportedRate.technical.errors.includes("sample-rate"));

assert.throws(
  () => Hands.create(
    "deterministic-audio-fabric",
    brief("edit", [{
      id: "wrong-source",
      role: "source",
      name: "Wrong source",
      mime: "application/json",
      format: "JSON",
      editable: true,
      text: "{}",
      metadata: { schema: "axm.unknown/v1" },
    }]),
    options,
  ),
  /incompatible|requires an axm\.deterministic-audio-recipe/,
);

console.log(
  "AXM deterministic audio Asset Hand selftest: PASS (public CommonJS create/edit route, stable WAV data URL/schema/status/result digest, honest technical candidate boundary)",
);
