#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Media = require('../../shared/operations/media-render-service');
const Review = require('../../shared/operations/review-service');

const PREFIX = 'axm-media-render-selftest-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
const root = path.join(temp, 'workshop');
const options = { root, stateRoot: path.join(root, 'state'), exportRoot: path.join(root, 'exports') };
let pass = 0;

function check(label, run) {
  run();
  pass += 1;
  console.log('PASS  ' + label);
}

async function checkAsync(label, run) {
  await run();
  pass += 1;
  console.log('PASS  ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

async function waitFor(read, predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < (timeoutMs || 4000)) {
    const value = read();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('timed out waiting for media job');
}

function cleanup() {
  const resolved = path.resolve(temp), allowedRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowedRoot) || !path.basename(resolved).startsWith(PREFIX)) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

async function main() {
  try {
    fs.mkdirSync(options.stateRoot, { recursive: true });
    fs.mkdirSync(options.exportRoot, { recursive: true });
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });

    const manifest = readJson('manifest.json');
    const contract = readJson('module.contract.json');
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    const review = Review.create({ stateRoot: options.stateRoot });
    const media = Media.create(Object.assign({}, options, { reviewService: review }));

    check('manifest and contract bound rendering and publication authority', () => {
      assert.equal(manifest.id, 'media-render-transcode-service');
      assert.equal(contract.id, manifest.id);
      assert.deepStrictEqual(contract.permissions, manifest.permissions);
      assert(contract.boundaries.refuses.includes('arbitrary-ffmpeg-arguments'));
      assert(contract.boundaries.refuses.includes('automatic-publish'));
      assert(contract.boundaries.refuses.includes('more-than-two-concurrent-jobs'));
    });

    check('native tone generation emits parseable PCM WAV', () => {
      const buffer = Media.wavBuffer([{ frequency: 440, durationMs: 100, amplitude: 0.2 }], 22050);
      const parsed = Media.parsePcmWav(buffer);
      assert.equal(parsed.sampleRate, 22050);
      assert.equal(parsed.channels, 1);
      assert.equal(parsed.bitsPerSample, 16);
      assert.equal(parsed.frames, 2205);
    });

    check('native PCM transcode changes rate and channels without a dependency', () => {
      const source = Media.wavBuffer([{ frequency: 220, durationMs: 80, amplitude: 0.1 }], 22050);
      const transcoded = Media.nativeWavTranscode(source, { sampleRate: 44100, channels: 2 });
      const parsed = Media.parsePcmWav(transcoded.buffer);
      assert.equal(parsed.sampleRate, 44100);
      assert.equal(parsed.channels, 2);
      assert.equal(transcoded.source.sampleRate, 22050);
      assert.equal(transcoded.output.bitsPerSample, 16);
    });

    check('invalid WAV and unsafe source paths are refused', () => {
      assert.throws(() => Media.parsePcmWav(Buffer.from('not-wave')), /RIFF\/WAVE source/);
      assert.throws(() => media.start({ action: 'transcode', source: '../../outside.wav', format: 'wav' }, 'selftest'), /unsafe relative path|inside assets or exports/);
      assert.throws(() => media.start({ action: 'shell', source: 'assets/source.wav', format: 'mp4' }, 'selftest'), /action is not allowlisted/);
    });

    check('core status requires no third-party codec and never auto-publishes', () => {
      const status = media.status();
      assert.deepStrictEqual(status.requiredThirdPartyDependencies, []);
      assert.deepStrictEqual(status.nativeOutputs, ['wav']);
      assert.equal(status.arbitraryCodecArguments, false);
      assert.equal(status.automaticPublish, false);
      assert.equal(status.concurrencyLimit, 2);
    });

    await checkAsync('tone render writes a hashed WAV and pending review handoff', async () => {
      const queued = media.start({ action: 'tone-sequence', sequence: [{ frequency: 440, durationMs: 50, amplitude: 0.1 }, { frequency: 660, durationMs: 50, amplitude: 0.1 }] }, 'selftest');
      const jobs = await waitFor(() => media.list(), rows => rows.some(item => item.id === queued.id && item.state === 'PASS'));
      const job = jobs.find(item => item.id === queued.id);
      const output = path.join(root, job.output.file);
      assert(fs.existsSync(output));
      assert.match(job.output.sha256, /^[a-f0-9]{64}$/);
      assert.equal(Media.parsePcmWav(fs.readFileSync(output)).sampleRate, 44100);
      assert(job.reviewId);
      assert.equal(review.get(job.reviewId).state, 'PENDING');
    });

    await checkAsync('native service transcode records engine and output metadata', async () => {
      const source = path.join(root, 'assets', 'native-source.wav');
      fs.writeFileSync(source, Media.wavBuffer([{ frequency: 330, durationMs: 80, amplitude: 0.1 }], 22050));
      const queued = media.start({ action: 'transcode', source: 'assets/native-source.wav', format: 'wav', sampleRate: 48000, channels: 2 }, 'selftest');
      const jobs = await waitFor(() => media.list(), rows => rows.some(item => item.id === queued.id && item.state === 'PASS'));
      const job = jobs.find(item => item.id === queued.id);
      const parsed = Media.parsePcmWav(fs.readFileSync(path.join(root, job.output.file)));
      assert.equal(job.engine, 'axm-native-pcm-wav/v1');
      assert.equal(job.nativeTranscode.output.sampleRate, 48000);
      assert.equal(parsed.sampleRate, 48000);
      assert.equal(parsed.channels, 2);
    });

    check('browser surface exposes bounded render transcode and cancel actions', () => {
      assert(app.includes("O.post('/api/media-render/start'"));
      assert(app.includes("O.post('/api/media-render/cancel'"));
      assert(app.includes("'x-axm-media': 'explicit-render'"));
      assert(app.includes("'x-axm-media': 'explicit-cancel'"));
    });

    console.log('Media Render & Transcode Service selftest: PASS (' + pass + ' controls)');
  } finally {
    cleanup();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
