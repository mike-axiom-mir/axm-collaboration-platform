"use strict";

const crypto = require("node:crypto");
const SfxBake = require("../audio-sfx-bake");
const AudioProduction = require("../asset-hands/upgrade-program/audio-production");

const VERSION = "1.0.0";
const ENGINE_VERSION = "1.0.0";
const RECIPE_SCHEMA = "axm.deterministic-audio-recipe/v1";
const ANALYSIS_SCHEMA = "axm.deterministic-audio-analysis/v1";
const VERIFICATION_SCHEMA = "axm.deterministic-audio-verification/v1";
const SAMPLE_RATE_HZ = 44100;
const CHANNELS = 1;
const SAMPLE_FORMAT = "pcm-s16le";
const MAX_DURATION_SECONDS = 2;
const WAV_RENDERER = "audio-sfx-bake/v0.1.0";
const TECHNICAL_DECODER = "asset-hands/audio-production.wavDecode/v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const output = {};
    Object.keys(value).sort().forEach((key) => {
      output[key] = stable(value[key]);
    });
    return output;
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === "string" ? value : canonicalStringify(value), "utf8");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function text(value, label, maximum) {
  const output = String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
  if (!output) throw new TypeError(label + " is required");
  if (maximum && output.length > maximum)
    throw new RangeError(label + " exceeds " + maximum + " characters");
  return output;
}

function identifier(value, label) {
  const output = text(value, label, 120);
  if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(output))
    throw new TypeError(label + " must be a portable identifier");
  return output;
}

function finite(value, label, minimum, maximum) {
  const output = Number(value);
  if (!Number.isFinite(output)) throw new TypeError(label + " must be finite");
  if (output < minimum || output > maximum)
    throw new RangeError(label + " must stay between " + minimum + " and " + maximum);
  return output;
}

function optionalFinite(value, fallback, label, minimum, maximum) {
  return value == null ? fallback : finite(value, label, minimum, maximum);
}

function round(value) {
  return Math.round(Number(value) * 1e12) / 1e12;
}

function slug(value) {
  return String(value == null ? "audio-candidate" : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "audio-candidate";
}

function seedU32(seed) {
  return parseInt(sha256(String(seed)).slice(0, 8), 16) >>> 0;
}

function normalizeAuthority(raw) {
  raw = raw && typeof raw === "object" ? raw : {};
  if (raw.installed === true || raw.promoted === true || raw.canonical === true)
    throw new Error("deterministic audio recipes cannot grant installation, promotion, or canon authority");
  return {
    installed: false,
    promoted: false,
    canonical: false,
    human_listening_review_required: true,
  };
}

function normalizeSound(raw) {
  raw = raw && raw.schema === "axm.audio.sound/v1" && raw.sound
    ? raw.sound
    : raw;
  const params = raw && raw.params && typeof raw.params === "object"
    ? raw.params
    : raw;
  if (!params || typeof params !== "object" || Array.isArray(params))
    throw new TypeError("recipe sound params are required");
  const kind = text(params.kind, "sound kind", 20).toLowerCase();
  const duration = finite(params.dur, "sound duration", 0.01, MAX_DURATION_SECONDS);
  if (kind === "noise") {
    return {
      schema: "axm.audio.sound/v1",
      params: {
        kind: "noise",
        dur: duration,
        gain: optionalFinite(params.gain, 0.6, "noise gain", 0.0001, 1),
        filterFreq: optionalFinite(params.filterFreq, 1200, "noise filter frequency", 20, 20000),
      },
    };
  }
  if (kind !== "tone") throw new TypeError("sound kind must be tone or noise");
  const wave = text(params.wave || "square", "waveform", 20).toLowerCase();
  if (!["sine", "sawtooth", "triangle", "square"].includes(wave))
    throw new TypeError("waveform must be sine, sawtooth, triangle, or square");
  const hasNoise = params.noise === true;
  const output = {
    kind: "tone",
    wave,
    freq: optionalFinite(params.freq, 440, "start frequency", 1, 20000),
    sweep: params.sweep === true,
    freqEnd: optionalFinite(params.freqEnd, params.freq == null ? 440 : Number(params.freq), "end frequency", 1, 20000),
    dur: duration,
    attack: optionalFinite(params.attack, 0.005, "attack", 0.0001, duration),
    gain: optionalFinite(params.gain, 0.5, "tone gain", 0.0001, 1),
    noise: hasNoise,
  };
  if (hasNoise) {
    output.noiseGain = optionalFinite(params.noiseGain, 0.35, "noise layer gain", 0.0001, 1);
    output.filterFreq = optionalFinite(params.filterFreq, 1200, "noise layer filter frequency", 20, 20000);
  }
  return { schema: "axm.audio.sound/v1", params: output };
}

function normalizeRecipe(raw) {
  raw = clone(raw || {});
  if (raw.schema && raw.schema !== RECIPE_SCHEMA)
    throw new TypeError("deterministic audio recipe schema mismatch");
  if (raw.version && raw.version !== VERSION)
    throw new TypeError("deterministic audio recipe version mismatch");
  const recipe = {
    schema: RECIPE_SCHEMA,
    version: VERSION,
    id: identifier(raw.id, "recipe id"),
    seed: text(raw.seed, "recipe seed", 180),
    sample_rate_hz: Number(raw.sample_rate_hz == null ? SAMPLE_RATE_HZ : raw.sample_rate_hz),
    channels: Number(raw.channels == null ? CHANNELS : raw.channels),
    sample_format: text(raw.sample_format || SAMPLE_FORMAT, "sample format", 40),
    sound: normalizeSound(raw.sound),
    authority: normalizeAuthority(raw.authority),
  };
  if (recipe.sample_rate_hz !== SAMPLE_RATE_HZ)
    throw new RangeError("only 44100 Hz recipes are supported by the preserved renderer");
  if (recipe.channels !== CHANNELS)
    throw new RangeError("only mono recipes are supported by the preserved renderer");
  if (recipe.sample_format !== SAMPLE_FORMAT)
    throw new RangeError("only pcm-s16le recipes are supported by the preserved renderer");
  return recipe;
}

function createCandidateRecipe(options) {
  options = options || {};
  const presetName = Object.prototype.hasOwnProperty.call(SfxBake.PRESETS, options.preset)
    ? options.preset
    : "blip";
  const params = clone(options.params || SfxBake.PRESETS[presetName]);
  if (options.max_duration_seconds != null)
    params.dur = Math.min(
      Number(params.dur),
      finite(options.max_duration_seconds, "maximum duration", 0.01, MAX_DURATION_SECONDS),
    );
  return normalizeRecipe({
    schema: RECIPE_SCHEMA,
    version: VERSION,
    id: slug(options.id || presetName + "-candidate"),
    seed: String(options.seed == null ? "deterministic-audio-default" : options.seed),
    sample_rate_hz: SAMPLE_RATE_HZ,
    channels: CHANNELS,
    sample_format: SAMPLE_FORMAT,
    sound: { schema: "axm.audio.sound/v1", params },
    authority: {},
  });
}

function inspectCanonicalWav(wav) {
  if (!Buffer.isBuffer(wav) || wav.length < 44)
    throw new TypeError("canonical WAV bytes are required");
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("RIFF/WAVE signature is missing");
  if (wav.toString("ascii", 12, 16) !== "fmt " || wav.readUInt32LE(16) !== 16)
    throw new Error("canonical PCM fmt chunk is required");
  if (wav.readUInt16LE(20) !== 1) throw new Error("PCM encoding is required");
  if (wav.toString("ascii", 36, 40) !== "data")
    throw new Error("canonical data chunk position is required");
  const channels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const byteRate = wav.readUInt32LE(28);
  const blockAlign = wav.readUInt16LE(32);
  const bitsPerSample = wav.readUInt16LE(34);
  const dataBytes = wav.readUInt32LE(40);
  if (channels !== CHANNELS || sampleRate !== SAMPLE_RATE_HZ || bitsPerSample !== 16)
    throw new Error("WAV must be mono 44100 Hz PCM16");
  if (blockAlign !== channels * 2 || byteRate !== sampleRate * blockAlign)
    throw new Error("WAV PCM rate fields are inconsistent");
  if (wav.length !== 44 + dataBytes || dataBytes % blockAlign !== 0)
    throw new Error("WAV data length is inconsistent");
  return {
    container: "RIFF/WAVE",
    codec: "PCM",
    sample_format: SAMPLE_FORMAT,
    sample_rate_hz: sampleRate,
    channels,
    bits_per_sample: bitsPerSample,
    block_align_bytes: blockAlign,
    byte_rate: byteRate,
    data_bytes: dataBytes,
    frame_count: dataBytes / blockAlign,
    total_bytes: wav.length,
  };
}

function render(rawRecipe) {
  const recipe = normalizeRecipe(rawRecipe);
  const recipeDigest = sha256(recipe);
  const engineResult = SfxBake.bake(recipe.sound, { seed: seedU32(recipe.seed) });
  const header = inspectCanonicalWav(engineResult.wav);
  const decoded = AudioProduction.wavDecode(engineResult.wav);
  const metrics = AudioProduction.analyze(decoded.samples, decoded.sample_rate, decoded.channels);
  const wavSha256 = sha256(engineResult.wav);
  if (engineResult.receipt.sha256 !== wavSha256)
    throw new Error("audio-sfx-bake receipt digest mismatch");
  if (decoded.sample_rate !== header.sample_rate_hz || decoded.channels !== header.channels)
    throw new Error("second local decoder disagrees with the canonical WAV header");
  if (decoded.samples.length !== header.frame_count * header.channels)
    throw new Error("second local decoder sample count disagrees with the WAV header");
  const analysis = {
    schema: ANALYSIS_SCHEMA,
    version: VERSION,
    status: "TECHNICAL_PASS",
    recipe_id: recipe.id,
    recipe_digest: recipeDigest,
    wav_sha256: wavSha256,
    render_seed_u32: seedU32(recipe.seed),
    renderer: WAV_RENDERER,
    decoder: TECHNICAL_DECODER,
    container: header.container,
    codec: header.codec,
    sample_format: header.sample_format,
    sample_rate_hz: header.sample_rate_hz,
    channels: header.channels,
    bits_per_sample: header.bits_per_sample,
    frame_count: header.frame_count,
    sample_count: decoded.samples.length,
    data_bytes: header.data_bytes,
    total_bytes: header.total_bytes,
    duration_seconds: round(decoded.duration_seconds),
    duration_ms: Math.round(decoded.duration_seconds * 1000),
    rms: round(metrics.rms),
    rms_dbfs: round(metrics.rms_dbfs),
    sample_peak: round(metrics.sample_peak),
    true_peak_estimate: round(metrics.true_peak_estimate),
    clipped_samples: metrics.clipped_samples,
    claims: {
      technical_decode_completed: true,
      audible_playback_verified: false,
      human_listened: false,
      human_aesthetic_approval: false,
      device_output_verified: false,
      external_wav_conformance: false,
    },
  };
  analysis.digest = sha256(analysis);
  return {
    recipe,
    recipe_digest: recipeDigest,
    wav: engineResult.wav,
    wav_sha256: wavSha256,
    engine_receipt: clone(engineResult.receipt),
    analysis,
  };
}

function verify(rawRecipe, suppliedRender) {
  const first = suppliedRender || render(rawRecipe);
  const second = render(first.recipe);
  const header = inspectCanonicalWav(first.wav);
  const checks = [
    { name: "recipe-schema", pass: first.recipe.schema === RECIPE_SCHEMA, details: { actual: first.recipe.schema } },
    { name: "recipe-candidate-authority", pass: !first.recipe.authority.installed && !first.recipe.authority.promoted && !first.recipe.authority.canonical, details: clone(first.recipe.authority) },
    { name: "preserved-renderer-receipt", pass: first.engine_receipt.renderer === WAV_RENDERER && first.engine_receipt.status === "RENDERED_UNREVIEWED", details: { renderer: first.engine_receipt.renderer, status: first.engine_receipt.status } },
    { name: "preserved-renderer-digest", pass: first.engine_receipt.sha256 === first.wav_sha256, details: { receipt_sha256: first.engine_receipt.sha256, actual_sha256: first.wav_sha256 } },
    { name: "canonical-pcm16-wav", pass: header.codec === "PCM" && header.bits_per_sample === 16 && header.sample_rate_hz === SAMPLE_RATE_HZ && header.channels === CHANNELS, details: header },
    { name: "second-local-decoder", pass: first.analysis.status === "TECHNICAL_PASS" && first.analysis.decoder === TECHNICAL_DECODER, details: { decoder: first.analysis.decoder, status: first.analysis.status } },
    { name: "repeat-render-bytes", pass: first.wav.equals(second.wav), details: { first_sha256: first.wav_sha256, second_sha256: second.wav_sha256 } },
    { name: "repeat-analysis", pass: first.analysis.digest === second.analysis.digest, details: { first_digest: first.analysis.digest, second_digest: second.analysis.digest } },
    { name: "bounded-duration", pass: first.analysis.duration_seconds <= MAX_DURATION_SECONDS, details: { actual_seconds: first.analysis.duration_seconds, maximum_seconds: MAX_DURATION_SECONDS } },
  ];
  const pass = checks.every((check) => check.pass);
  const receipt = {
    schema: VERIFICATION_SCHEMA,
    version: VERSION,
    status: pass ? "PASS" : "HOLD",
    recipe_id: first.recipe.id,
    recipe_digest: first.recipe_digest,
    wav_sha256: first.wav_sha256,
    analysis_digest: first.analysis.digest,
    checks,
    source_receipt: clone(first.engine_receipt),
    claims: {
      deterministic_wav_bytes: pass,
      canonical_pcm16_wav: pass,
      technical_analysis: pass,
      audible_playback_verified: false,
      human_listened: false,
      human_aesthetic_approval: false,
      device_output_verified: false,
      webaudio_sample_identical: false,
      external_wav_conformance: false,
    },
    authority: {
      candidate_only: true,
      installed: false,
      promoted: false,
      canonical: false,
      human_listening_review_required: true,
    },
  };
  receipt.digest = sha256(receipt);
  return receipt;
}

module.exports = {
  VERSION,
  ENGINE_VERSION,
  RECIPE_SCHEMA,
  ANALYSIS_SCHEMA,
  VERIFICATION_SCHEMA,
  SAMPLE_RATE_HZ,
  CHANNELS,
  SAMPLE_FORMAT,
  MAX_DURATION_SECONDS,
  WAV_RENDERER,
  TECHNICAL_DECODER,
  canonicalStringify,
  sha256,
  seedU32,
  normalizeRecipe,
  createCandidateRecipe,
  inspectCanonicalWav,
  render,
  verify,
};
