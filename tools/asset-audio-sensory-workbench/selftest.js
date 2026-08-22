#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Core = require("./core.js");

function wavDataUrl(frequency) {
  const sampleRate = 8000;
  const frames = 800;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + frames * 2, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index += 1) {
    bytes.writeInt16LE(Math.round(Math.sin(index / sampleRate * frequency * Math.PI * 2) * 12000), 44 + index * 2);
  }
  return "data:audio/wav;base64," + bytes.toString("base64");
}

function resultFor(frequency, suffix) {
  const recipeSha = (suffix === "a" ? "a" : "b").repeat(64);
  const wavSha = (suffix === "a" ? "c" : "d").repeat(64);
  const recipe = {
    schema: Core.RECIPE_SCHEMA,
    version: "1.0.0",
    seed: "7",
    params: {
      kind: "tone",
      wave: "sine",
      freq: frequency,
      freqEnd: frequency,
      dur: 0.1,
      attack: 0.005,
      gain: 0.45,
      filterFreq: 1200,
      noiseGain: 0.2
    }
  };
  const analysis = {
    schema: Core.ANALYSIS_SCHEMA,
    version: "1.0.0",
    sample_rate_hz: 8000,
    channels: 1,
    duration_seconds: 0.1,
    sample_peak: 0.37,
    rms: 0.25,
    recipe_digest: recipeSha,
    wav_sha256: wavSha
  };
  const verification = {
    schema: Core.VERIFICATION_SCHEMA,
    version: "1.0.0",
    status: "PASS",
    recipe_digest: recipeSha,
    wav_sha256: wavSha,
    claims: { deterministic_bytes: true, human_listened: false, approved: false, audible_playback_verified: false, human_aesthetic_approval: false, device_output_verified: false, webaudio_sample_identical: false, external_wav_conformance: false }
  };
  const artifacts = [
    { schema: "axm.asset-artifact/v1", id: "deterministic-audio-recipe", role: "editable-audio-recipe", name: "Recipe", filename: "audio.json", mime: "application/json", format: "json", editable: true, text: JSON.stringify(recipe), metadata: { schema: Core.RECIPE_SCHEMA, digest: recipeSha }, digest: "recipe-" + suffix },
    { schema: "axm.asset-artifact/v1", id: "deterministic-audio-wav", role: "pcm16-wav-delivery", name: "WAV", filename: "audio.wav", mime: "audio/wav", format: "wav", editable: false, dataUrl: wavDataUrl(frequency), metadata: { schema: "audio/wav", sha256: wavSha, preview_means_payload_available_only: true }, digest: "wav-" + suffix },
    { schema: "axm.asset-artifact/v1", id: "deterministic-audio-analysis", role: "technical-audio-analysis", name: "Analysis", filename: "analysis.json", mime: "application/json", format: "json", editable: false, text: JSON.stringify(analysis), metadata: { schema: Core.ANALYSIS_SCHEMA }, digest: "analysis-" + suffix },
    { schema: "axm.asset-artifact/v1", id: "deterministic-audio-verification", role: "technical-verification", name: "Verification", filename: "verification.json", mime: "application/json", format: "json", editable: false, text: JSON.stringify(verification), metadata: { schema: Core.VERIFICATION_SCHEMA }, digest: "verification-" + suffix }
  ];
  return {
    schema: Core.RESULT_SCHEMA,
    id: "audio-result-" + suffix,
    hand: { id: Core.HAND_ID, version: Core.HAND_VERSION },
    artifacts,
    previewArtifactId: "deterministic-audio-wav",
    preview: { artifactId: "deterministic-audio-wav", mime: "audio/wav", format: "WAV", available: true },
    validation_receipt: { status: "PASS" },
    status: "READY",
    failure_code: null,
    technical: { pass: true, errors: [] },
    digest: "result-" + suffix
  };
}

const initial = resultFor(440, "a");
const inspected = Core.inspectHandResult(initial);
assert.strictEqual(inspected.wav.sample_rate, 8000);
assert.strictEqual(inspected.wav.frames, 800);
assert.strictEqual(Core.waveformEnvelope(inspected.wav_artifact.dataUrl, 64).length, 64);

let session = Core.createSession(initial);
assert.strictEqual(Core.readField(session.draft_recipe, "frequency_hz"), 440);
assert.strictEqual(session.authority.promoted, false);

const sourceDigest = session.current_recipe_digest;
session = Core.applyEdit(session, { actor: "human", channel: "slider", field: "frequency_hz", value: 660 });
assert(session.pending_edit);
assert.strictEqual(Core.readField(session.draft_recipe, "frequency_hz"), 660);
session = Core.bindRegeneratedResult(session, resultFor(660, "b"));
assert.strictEqual(session.pending_edit, null);
assert.notStrictEqual(session.current_recipe_digest, sourceDigest);
assert.strictEqual(session.edits[0].result_digest, "result-b");

session = Core.recordPlaybackEvent(session, { kind: "play-requested", trusted_user_gesture: true, position_seconds: 0, observed_at_monotonic_ms: 10 });
session = Core.recordPlaybackEvent(session, { kind: "playing", trusted_user_gesture: true, position_seconds: 0.01, observed_at_monotonic_ms: 12 });
session = Core.recordHumanJudgment(session, { reviewer: "Mike", verdict: "ACCEPT_FOR_TEST", impression: "BALANCED", heard_as_presented: true, notes: "bounded fixture" });
assert(session.human_receipt);
assert.strictEqual(session.human_receipt.playback_observation.physical_audibility_verified, false);
assert.strictEqual(session.human_receipt.human_judgment.heard_as_presented, true);
assert.strictEqual(session.human_receipt.authority.canonical, false);

const recipeBeforeListenerChange = session.current_recipe_digest;
const resultBeforeListenerChange = session.current_result_digest;
const oldListenerDigest = session.listener_state_digest;
session = Core.setListener(session, { volume: 0.4, playback_rate: 1.25 });
assert.notStrictEqual(session.listener_state_digest, oldListenerDigest);
assert.strictEqual(session.current_recipe_digest, recipeBeforeListenerChange);
assert.strictEqual(session.current_result_digest, resultBeforeListenerChange);
assert.strictEqual(session.human_receipt, null);
assert.strictEqual(session.stale_review_history.length, 1);
assert.strictEqual(session.stale_review_history[0].stale_reason, "listener-state-change");

const patch = Core.machinePatch(session);
assert.strictEqual(patch.source_artifact.content_schema, Core.RECIPE_SCHEMA);
assert.strictEqual(patch.listener_state_is_source_neutral, true);
assert.strictEqual(patch.authority.promoted, false);

let transactional = Core.createSession(initial);
transactional = Core.recordPlaybackEvent(transactional, { kind: "playing", trusted_user_gesture: true, position_seconds: 0.01 });
transactional = Core.recordHumanJudgment(transactional, { reviewer: "fixture", verdict: "REVISE", impression: "UNCERTAIN", heard_as_presented: false });
transactional = Core.applyEdit(transactional, { field: "frequency_hz", value: 660 });
assert(transactional.human_receipt, "an uncommitted draft must not stale the current review");
transactional = Core.cancelPendingEdit(transactional, "fixture failure");
assert(transactional.human_receipt, "failed regeneration must preserve the still-current review");
transactional = Core.applyEdit(transactional, { field: "frequency_hz", value: 660 });
transactional = Core.bindRegeneratedResult(transactional, resultFor(660, "b"));
assert.strictEqual(transactional.human_receipt, null, "successful source regeneration must stale the old review");
assert.strictEqual(transactional.stale_review_history.length, 1);

assert.throws(() => Core.recordHumanJudgment(Core.createSession(initial), { verdict: "ACCEPT_FOR_TEST", impression: "BALANCED", heard_as_presented: true }), /recorded playback/);
assert.throws(() => Core.inspectWav("data:audio/wav;base64," + Buffer.from("not-wave").toString("base64")), /shorter|header/);

console.log("Asset Audio Sensory Workbench selftest PASS (WAV gate + waveform envelope, digest-bound edit/regeneration, listener/source separation, playback observation, stale review history, non-promoting receipt)");
