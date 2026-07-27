'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SFX = require('./index.js');

const first = SFX.bake({schema: 'axm.audio.sound/v1', params: SFX.PRESETS.explosion}, {seed: 7});
const second = SFX.bake({schema: 'axm.audio.sound/v1', params: SFX.PRESETS.explosion}, {seed: 7});
assert(first.wav.equals(second.wav), 'same params and seed must make byte-identical WAV output');
assert.strictEqual(first.wav.subarray(0, 4).toString('ascii'), 'RIFF');
assert.strictEqual(first.wav.subarray(8, 12).toString('ascii'), 'WAVE');
assert.strictEqual(first.wav.readUInt16LE(20), 1, 'WAV must be PCM');
assert.strictEqual(first.wav.readUInt16LE(22), 1, 'WAV must be mono');
assert.strictEqual(first.wav.readUInt32LE(24), 44100, 'WAV sample rate must be 44.1 kHz');
assert.strictEqual(first.receipt.source_contract, 'axm.audio.sound/v1');
assert.strictEqual(first.receipt.claims.webaudio_sample_identical, false);
assert.strictEqual(first.receipt.claims.human_listened, false);
assert.notDeepStrictEqual(SFX.mutate(SFX.PRESETS.coin, 11), SFX.mutate(SFX.PRESETS.coin, 22));
assert.throws(() => SFX.bake({kind: 'unknown'}), /kind must be tone or noise/);

const soundLab = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'audio-studio', 'sound-lab-engine.html'), 'utf8');
for (const [name, preset] of Object.entries(SFX.PRESETS)) {
  if (name === 'footstep') continue;
  assert(soundLab.includes(`${name}:{`), `${name} must remain an existing Sound Lab preset`);
  assert(soundLab.includes(`freq:${preset.freq}`) || preset.kind === 'noise', `${name} frequency must match Sound Lab`);
}

console.log(`Audio SFX Bake selftest: PASS (${Object.keys(SFX.PRESETS).length} presets, deterministic WAV + honest receipt)`);
