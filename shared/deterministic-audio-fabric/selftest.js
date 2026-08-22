"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const Audio = require(".");

const recipe = Audio.createCandidateRecipe({
  id: "coin-fixture",
  preset: "coin",
  seed: "deterministic-audio-fixture",
});
assert.equal(recipe.schema, Audio.RECIPE_SCHEMA);
assert.equal(recipe.version, "1.0.0");
assert.equal(recipe.sample_rate_hz, 44100);
assert.equal(recipe.channels, 1);
assert.equal(recipe.sample_format, "pcm-s16le");
assert.deepEqual(recipe.authority, {
  installed: false,
  promoted: false,
  canonical: false,
  human_listening_review_required: true,
});

const first = Audio.render(recipe);
const second = Audio.render(recipe);
assert.ok(Buffer.isBuffer(first.wav));
assert.ok(first.wav.equals(second.wav));
assert.equal(first.wav_sha256, second.wav_sha256);
assert.equal(first.analysis.digest, second.analysis.digest);
assert.equal(first.wav.toString("ascii", 0, 4), "RIFF");
assert.equal(first.wav.toString("ascii", 8, 12), "WAVE");
assert.equal(first.wav.readUInt16LE(20), 1);
assert.equal(first.wav.readUInt16LE(22), 1);
assert.equal(first.wav.readUInt32LE(24), 44100);
assert.equal(first.wav.readUInt16LE(34), 16);
assert.equal(first.engine_receipt.status, "RENDERED_UNREVIEWED");
assert.equal(first.engine_receipt.claims.human_listened, false);
assert.equal(first.engine_receipt.claims.approved, false);
assert.equal(first.analysis.status, "TECHNICAL_PASS");
assert.equal(first.analysis.claims.audible_playback_verified, false);
assert.equal(first.analysis.claims.human_listened, false);
assert.equal(first.analysis.claims.human_aesthetic_approval, false);
assert.equal(first.analysis.claims.external_wav_conformance, false);

const verification = Audio.verify(recipe, first);
assert.equal(verification.status, "PASS");
assert.ok(verification.checks.every((check) => check.pass));
assert.equal(verification.claims.deterministic_wav_bytes, true);
assert.equal(verification.claims.canonical_pcm16_wav, true);
assert.equal(verification.claims.audible_playback_verified, false);
assert.equal(verification.claims.human_listened, false);
assert.equal(verification.claims.human_aesthetic_approval, false);
assert.equal(verification.claims.device_output_verified, false);
assert.equal(verification.authority.candidate_only, true);
assert.equal(verification.authority.canonical, false);

const childProgram = [
  "const A=require(process.argv[1]);",
  "const recipe=A.createCandidateRecipe({id:'coin-fixture',preset:'coin',seed:'deterministic-audio-fixture'});",
  "const output=A.render(recipe);",
  "process.stdout.write(JSON.stringify({wav:output.wav_sha256,analysis:output.analysis.digest,recipe:output.recipe_digest}));",
].join("");
const child = spawnSync(process.execPath, ["-e", childProgram, path.resolve(__dirname)], {
  encoding: "utf8",
  windowsHide: true,
});
assert.equal(child.status, 0, child.stderr);
assert.deepEqual(JSON.parse(child.stdout), {
  wav: first.wav_sha256,
  analysis: first.analysis.digest,
  recipe: first.recipe_digest,
});

const edited = JSON.parse(JSON.stringify(recipe));
edited.sound.params.freq = 777;
const editedRender = Audio.render(edited);
assert.notEqual(editedRender.recipe_digest, first.recipe_digest);
assert.notEqual(editedRender.wav_sha256, first.wav_sha256);
assert.equal(Audio.verify(edited, editedRender).status, "PASS");

assert.throws(
  () => Audio.normalizeRecipe(Object.assign({}, recipe, { sample_rate_hz: 48000 })),
  /only 44100 Hz/,
);
assert.throws(
  () => Audio.normalizeRecipe(Object.assign({}, recipe, { channels: 2 })),
  /only mono/,
);
assert.throws(
  () => Audio.normalizeRecipe(Object.assign({}, recipe, { authority: { promoted: true } })),
  /cannot grant installation, promotion, or canon authority/,
);
const tooLong = JSON.parse(JSON.stringify(recipe));
tooLong.sound.params.dur = 2.01;
assert.throws(() => Audio.normalizeRecipe(tooLong), /sound duration must stay between/);

console.log(
  "AXM deterministic audio fabric selftest: PASS (genuine PCM16 WAV, cross-process stable digests, bounded edit regeneration, technical-only receipts)",
);
