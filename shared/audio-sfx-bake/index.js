'use strict';

const crypto = require('crypto');

const SAMPLE_RATE = 44100;
const MASTER_GAIN = 0.9;

function mulberry32(seed) {
  let state = Number(seed) >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function oscillator(type, phase) {
  const turn = (phase / (2 * Math.PI)) % 1;
  switch (type) {
    case 'sine': return Math.sin(phase);
    case 'sawtooth': return 2 * turn - 1;
    case 'triangle': return 1 - 4 * Math.abs(Math.round(turn) - turn);
    case 'square':
    default: return Math.sin(phase) >= 0 ? 1 : -1;
  }
}

function normalizeInput(input) {
  const params = input && input.schema === 'axm.audio.sound/v1'
    ? (input.sound && input.sound.params) || input.params
    : input;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new TypeError('SFX Bake requires axm.audio.sound/v1 params or a compatible params object.');
  }
  if (params.kind !== 'tone' && params.kind !== 'noise') {
    throw new TypeError('SFX Bake kind must be tone or noise.');
  }
  return Object.assign({}, params);
}

function render(input, seed = 1) {
  const sound = normalizeInput(input);
  const duration = Math.max(0.01, Number(sound.dur) || 0.15);
  const length = Math.max(1, Math.floor(SAMPLE_RATE * duration));
  const samples = new Float32Array(length);
  const hasNoise = sound.kind === 'noise' || Boolean(sound.noise);

  if (sound.kind !== 'noise') {
    const startFrequency = Math.max(1, Number(sound.freq) || 440);
    const endFrequency = sound.sweep && sound.freqEnd
      ? Math.max(1, Number(sound.freqEnd))
      : startFrequency;
    const peak = Number(sound.gain) || 0.5;
    const floor = 0.0001;
    const attackSamples = Math.max(1, Math.floor((Number(sound.attack) || 0.005) * SAMPLE_RATE));
    let phase = 0;
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      const frequency = startFrequency * Math.pow(endFrequency / startFrequency, progress);
      phase += 2 * Math.PI * frequency / SAMPLE_RATE;
      const gain = index < attackSamples
        ? floor * Math.pow(peak / floor, index / attackSamples)
        : peak * Math.pow(floor / peak, (index - attackSamples) / Math.max(1, length - attackSamples));
      samples[index] += oscillator(sound.wave || 'square', phase) * gain;
    }
  }

  if (hasNoise) {
    const random = mulberry32(seed);
    const noiseGain = sound.kind === 'noise'
      ? (Number(sound.gain) || 0.6)
      : (Number(sound.noiseGain) || 0.35);
    const floor = 0.0001;
    const cutoff = Number(sound.filterFreq) || 1200;
    const dt = 1 / SAMPLE_RATE;
    const rc = 1 / (2 * Math.PI * cutoff);
    const alpha = dt / (rc + dt);
    let filtered = 0;
    for (let index = 0; index < length; index += 1) {
      const white = (random() * 2 - 1) * (1 - index / length);
      filtered += alpha * (white - filtered);
      const gain = noiseGain * Math.pow(floor / noiseGain, index / length);
      samples[index] += filtered * gain;
    }
  }

  for (let index = 0; index < length; index += 1) {
    samples[index] = clamp(samples[index] * MASTER_GAIN, -1, 1);
  }
  return samples;
}

function toWav(samples) {
  if (!(samples instanceof Float32Array)) {
    throw new TypeError('toWav expects Float32Array samples.');
  }
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = clamp(samples[index], -1, 1);
    bytes.writeInt16LE((value < 0 ? value * 32768 : value * 32767) | 0, 44 + index * 2);
  }
  return bytes;
}

function mutate(input, seed = 1, amount = 0.5) {
  const params = normalizeInput(input);
  const random = mulberry32(seed);
  const jitter = (value, factor) => value * (1 + (random() * 2 - 1) * amount * factor);
  if (params.freq) params.freq = Math.max(1, jitter(params.freq, 0.4));
  if (params.freqEnd) params.freqEnd = Math.max(1, jitter(params.freqEnd, 0.4));
  if (params.dur) params.dur = clamp(jitter(params.dur, 0.3), 0.02, 2);
  if (params.filterFreq) params.filterFreq = Math.max(80, jitter(params.filterFreq, 0.5));
  return params;
}

function bake(input, options = {}) {
  const params = normalizeInput(input);
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : 1;
  const samples = render(params, seed);
  const wav = toWav(samples);
  const digest = crypto.createHash('sha256').update(wav).digest('hex');
  return {
    wav,
    receipt: {
      schema: 'axm.audio.sfx-bake-receipt/v1',
      source_contract: 'axm.audio.sound/v1',
      renderer: 'audio-sfx-bake/v0.1.0',
      status: 'RENDERED_UNREVIEWED',
      seed,
      sample_rate_hz: SAMPLE_RATE,
      channels: 1,
      sample_format: 'pcm-s16le',
      duration_ms: Math.round(samples.length / SAMPLE_RATE * 1000),
      bytes: wav.length,
      sha256: digest,
      claims: {
        deterministic_bytes: true,
        webaudio_sample_identical: false,
        human_listened: false,
        approved: false
      }
    }
  };
}

const PRESETS = Object.freeze({
  blip: {kind: 'tone', wave: 'square', freq: 520, sweep: true, freqEnd: 380, dur: 0.06, attack: 0.005, gain: 0.45},
  coin: {kind: 'tone', wave: 'square', freq: 988, sweep: true, freqEnd: 1319, dur: 0.18, attack: 0.005, gain: 0.5},
  shoot: {kind: 'tone', wave: 'sawtooth', freq: 880, sweep: true, freqEnd: 120, dur: 0.12, attack: 0.005, gain: 0.4},
  zap: {kind: 'tone', wave: 'sawtooth', freq: 1200, sweep: true, freqEnd: 200, dur: 0.15, attack: 0.005, gain: 0.4},
  build: {kind: 'tone', wave: 'triangle', freq: 300, sweep: true, freqEnd: 560, dur: 0.13, attack: 0.005, gain: 0.55},
  powerup: {kind: 'tone', wave: 'square', freq: 300, sweep: true, freqEnd: 1200, dur: 0.4, attack: 0.005, gain: 0.4},
  hit: {kind: 'noise', dur: 0.16, gain: 0.5, filterFreq: 900},
  explosion: {kind: 'noise', dur: 0.5, gain: 0.85, filterFreq: 600},
  footstep: {kind: 'noise', dur: 0.09, gain: 0.4, filterFreq: 500}
});

module.exports = {SAMPLE_RATE, PRESETS, normalizeInput, render, toWav, mutate, bake};
