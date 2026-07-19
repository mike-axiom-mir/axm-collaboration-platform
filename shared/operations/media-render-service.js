'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const SCHEMA = 'axm.media-render-service/v1';
const OUTPUTS = {
  wav: { extension: '.wav', args: ['-c:a','pcm_s16le'] },
  mp3: { extension: '.mp3', args: ['-c:a','libmp3lame','-b:a','192k'] },
  webm: { extension: '.webm', args: ['-c:v','libvpx-vp9','-c:a','libopus'] },
  mp4: { extension: '.mp4', args: ['-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac'] }
};

function wavBuffer(sequence, sampleRate) {
  const rate = sampleRate || 44100, segments = sequence || [], totalSamples = segments.reduce((n, x) => n + Math.round(rate * x.durationMs / 1000), 0), dataBytes = totalSamples * 2, out = Buffer.alloc(44 + dataBytes);
  out.write('RIFF',0); out.writeUInt32LE(36 + dataBytes,4); out.write('WAVE',8); out.write('fmt ',12); out.writeUInt32LE(16,16); out.writeUInt16LE(1,20); out.writeUInt16LE(1,22); out.writeUInt32LE(rate,24); out.writeUInt32LE(rate * 2,28); out.writeUInt16LE(2,32); out.writeUInt16LE(16,34); out.write('data',36); out.writeUInt32LE(dataBytes,40);
  let offset = 44, phase = 0;
  for (const item of segments) {
    const samples = Math.round(rate * item.durationMs / 1000), frequency = Number(item.frequency) || 0, amplitude = Math.max(0, Math.min(1, Number(item.amplitude) || .25));
    for (let i = 0; i < samples; i++) { const fade = Math.min(1, i / 100, (samples - i) / 100), value = frequency ? Math.sin(phase) * amplitude * fade : 0; out.writeInt16LE(Math.round(value * 32767), offset); offset += 2; phase += Math.PI * 2 * frequency / rate; }
  }
  return out;
}

function parsePcmWav(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  if (input.length < 44 || input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WAVE') throw new Error('native WAV adapter needs a RIFF/WAVE source');
  let offset = 12, format = null, dataOffset = -1, dataBytes = 0;
  while (offset + 8 <= input.length) {
    const id = input.toString('ascii', offset, offset + 4), size = input.readUInt32LE(offset + 4), start = offset + 8, end = start + size;
    if (end > input.length) throw new Error('WAV chunk exceeds the source boundary');
    if (id === 'fmt ' && size >= 16) format = { audioFormat: input.readUInt16LE(start), channels: input.readUInt16LE(start + 2), sampleRate: input.readUInt32LE(start + 4), byteRate: input.readUInt32LE(start + 8), blockAlign: input.readUInt16LE(start + 12), bitsPerSample: input.readUInt16LE(start + 14) };
    if (id === 'data' && dataOffset < 0) { dataOffset = start; dataBytes = size; }
    offset = end + (size & 1);
  }
  if (!format || dataOffset < 0) throw new Error('WAV source is missing fmt or data');
  if (format.audioFormat !== 1 || ![8,16].includes(format.bitsPerSample)) throw new Error('native WAV adapter supports uncompressed 8-bit or 16-bit PCM');
  if (format.channels < 1 || format.channels > 8 || format.sampleRate < 1000 || format.sampleRate > 384000) throw new Error('WAV channel or sample-rate metadata is outside native limits');
  const expectedAlign = format.channels * (format.bitsPerSample / 8);
  if (format.blockAlign !== expectedAlign || dataBytes % format.blockAlign) throw new Error('WAV PCM frame alignment is invalid');
  return Object.assign({ input, dataOffset, dataBytes, frames: dataBytes / format.blockAlign }, format);
}

function nativeWavTranscode(value, options) {
  const source = parsePcmWav(value), opts = options || {}, sampleRate = Number(opts.sampleRate) || source.sampleRate, channels = Number(opts.channels) || source.channels;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('native WAV output sample rate must be 8000 to 192000 Hz');
  if (![1,2].includes(channels)) throw new Error('native WAV output must be mono or stereo');
  const frames = Math.max(1, Math.round(source.frames * sampleRate / source.sampleRate)), dataBytes = frames * channels * 2;
  if (dataBytes > 500 * 1024 * 1024) throw new Error('native WAV output exceeds 500 MB');
  const output = Buffer.alloc(44 + dataBytes);
  output.write('RIFF',0); output.writeUInt32LE(36 + dataBytes,4); output.write('WAVE',8); output.write('fmt ',12); output.writeUInt32LE(16,16); output.writeUInt16LE(1,20); output.writeUInt16LE(channels,22); output.writeUInt32LE(sampleRate,24); output.writeUInt32LE(sampleRate * channels * 2,28); output.writeUInt16LE(channels * 2,32); output.writeUInt16LE(16,34); output.write('data',36); output.writeUInt32LE(dataBytes,40);
  function sourceSample(frame, channel) {
    const safeFrame = Math.max(0, Math.min(source.frames - 1, frame)), safeChannel = Math.max(0, Math.min(source.channels - 1, channel)), at = source.dataOffset + safeFrame * source.blockAlign + safeChannel * (source.bitsPerSample / 8);
    return source.bitsPerSample === 8 ? (source.input[at] - 128) / 128 : source.input.readInt16LE(at) / 32768;
  }
  function mappedSample(frame, channel) {
    if (channels === 1) { let sum = 0; for (let inputChannel = 0; inputChannel < source.channels; inputChannel++) sum += sourceSample(frame, inputChannel); return sum / source.channels; }
    return source.channels === 1 ? sourceSample(frame, 0) : sourceSample(frame, channel);
  }
  let writeAt = 44;
  for (let frame = 0; frame < frames; frame++) {
    const position = frame * source.sampleRate / sampleRate, left = Math.floor(position), right = Math.min(source.frames - 1, left + 1), mix = position - left;
    for (let channel = 0; channel < channels; channel++) {
      const sample = mappedSample(left, channel) * (1 - mix) + mappedSample(right, channel) * mix;
      output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), writeAt); writeAt += 2;
    }
  }
  return { buffer: output, source: { sampleRate: source.sampleRate, channels: source.channels, bitsPerSample: source.bitsPerSample, frames: source.frames }, output: { sampleRate, channels, bitsPerSample: 16, frames } };
}

function create(options) {
  const stateFile = path.join(options.stateRoot, 'media-render-transcode', 'jobs.json'), auditFile = path.join(options.stateRoot, 'media-render-transcode', 'audit.jsonl'), outputDir = path.join(options.exportRoot, 'media-renders'), active = new Map();
  function read() { return U.loadJson(stateFile, { schema: SCHEMA, version: 1, jobs: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function ffmpeg() { const check = childProcess.spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true, timeout: 3000 }); return { available: check.status === 0, version: check.status === 0 ? String(check.stdout || '').split(/\r?\n/)[0].slice(0, 200) : null }; }
  function update(id, patch) { const state = read(), job = state.jobs.find(x => x.id === id); if (!job) return null; Object.assign(job, patch, { updatedAt: U.now() }); write(state); return U.clone(job); }
  function finished(id, outputFile) {
    const relative = path.relative(options.root, outputFile).replace(/\\/g, '/'), stat = fs.statSync(outputFile), digest = U.fileSha256(outputFile), job = update(id, { state: 'PASS', progress: 1, endedAt: U.now(), output: { file: relative, url: '/' + relative.split('/').map(encodeURIComponent).join('/'), bytes: stat.size, sha256: digest } });
    if (options.reviewService) { const review = options.reviewService.submit({ kind: 'media-render', title: 'Rendered media ' + path.basename(outputFile), sourceRef: 'media-render:' + id, artifactDigest: digest, summary: stat.size + ' byte evidence-bearing media render', requiredSeats: 1, action: { type: 'publish-media-output', jobId: id } }); update(id, { reviewId: review.id }); }
    audit({ type: 'render-pass', id, output: relative, digest }); active.delete(id); return job;
  }
  function failed(id, error) { active.delete(id); audit({ type: 'render-fail', id, error: String(error.message || error).slice(0, 500) }); return update(id, { state: 'FAIL', endedAt: U.now(), error: String(error.message || error).slice(0, 1000) }); }
  function validateSequence(raw) {
    const list = Array.isArray(raw) ? raw : []; if (!list.length || list.length > 128) throw new Error('tone render needs 1 to 128 segments'); let total = 0;
    const sequence = list.map(item => { const durationMs = Math.max(10, Math.min(5000, Number(item.durationMs) || 250)), frequency = Math.max(0, Math.min(20000, Number(item.frequency) || 440)), amplitude = Math.max(0, Math.min(1, Number(item.amplitude) || .25)); total += durationMs; return { durationMs, frequency, amplitude }; });
    if (total > 60000) throw new Error('tone render duration exceeds 60 seconds'); return sequence;
  }
  function sourceFile(relative) {
    const rel = U.safeRelative(relative); if (!/^(assets|exports)\//.test(rel)) throw new Error('media source must be inside assets or exports'); const absolute = path.resolve(options.root, rel); U.assertUnder(absolute, options.root); if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error('media source file not found'); if (fs.statSync(absolute).size > 500 * 1024 * 1024) throw new Error('media source exceeds 500 MB'); return absolute;
  }
  function start(input, actor) {
    const body = input || {}, action = String(body.action || 'tone-sequence'); if (!['tone-sequence','transcode'].includes(action)) throw new Error('media action is not allowlisted'); const state = read(); if (active.size >= 2) throw new Error('media render concurrency limit reached');
    const id = U.uid('media'), format = action === 'tone-sequence' ? 'wav' : String(body.format || '').toLowerCase(); if (!OUTPUTS[format]) throw new Error('media output format is unsupported');
    const source = action === 'transcode' ? sourceFile(body.source) : null;
    fs.mkdirSync(outputDir, { recursive: true }); const outputFile = path.join(outputDir, id + OUTPUTS[format].extension), job = { schema: 'axm.media-render-job/v1', id, action, format, state: 'QUEUED', progress: 0, actor: String(actor || 'local-user').slice(0, 120), createdAt: U.now(), updatedAt: U.now(), startedAt: null, endedAt: null, output: null, reviewId: null, cancellationRequested: false };
    state.jobs.unshift(job); state.jobs = state.jobs.slice(0, 200); write(state); audit({ type: 'render-queued', id, action, format });
    if (action === 'tone-sequence') {
      const sequence = validateSequence(body.sequence); active.set(id, { type: action }); setImmediate(() => { try { update(id, { state: 'RUNNING', progress: .1, startedAt: U.now(), inputSummary: { segments: sequence.length, durationMs: sequence.reduce((n,x)=>n+x.durationMs,0) } }); const current = read().jobs.find(x => x.id === id); if (current && current.cancellationRequested) return failed(id, new Error('render cancelled')); fs.writeFileSync(outputFile, wavBuffer(sequence, 44100)); finished(id, outputFile); } catch (error) { failed(id, error); } });
    } else if (format === 'wav' && path.extname(source).toLowerCase() === '.wav') {
      active.set(id, { type: 'native-wav-transcode' });
      setImmediate(() => { try {
        update(id, { state: 'RUNNING', progress: .2, startedAt: U.now(), inputSummary: { source: path.relative(options.root, source).replace(/\\/g, '/'), sampleRate: Number(body.sampleRate) || null, channels: Number(body.channels) || null }, engine: 'axm-native-pcm-wav/v1' });
        const current = read().jobs.find(x => x.id === id); if (current && current.cancellationRequested) return failed(id, new Error('render cancelled'));
        const transcoded = nativeWavTranscode(fs.readFileSync(source), { sampleRate: body.sampleRate, channels: body.channels }); fs.writeFileSync(outputFile, transcoded.buffer); update(id, { nativeTranscode: { source: transcoded.source, output: transcoded.output } }); finished(id, outputFile);
      } catch (error) { failed(id, error); } });
    } else {
      const capability = ffmpeg(); if (!capability.available) return failed(id, new Error('optional FFmpeg adapter is unavailable; native WAV render and PCM transcode remain available'));
      const args = ['-nostdin','-hide_banner','-loglevel','error','-i',source].concat(OUTPUTS[format].args, [outputFile]), child = childProcess.spawn('ffmpeg', args, { windowsHide: true, stdio: ['ignore','ignore','pipe'] }); let stderr = '';
      active.set(id, { type: action, child }); update(id, { state: 'RUNNING', progress: .15, startedAt: U.now(), inputSummary: { source: path.relative(options.root, source).replace(/\\/g, '/') }, engine: capability.version });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8000); }); child.once('error', error => failed(id, error)); child.once('exit', code => { if (code === 0 && fs.existsSync(outputFile)) finished(id, outputFile); else failed(id, new Error('FFmpeg exited ' + code + (stderr ? ': ' + stderr.slice(-500) : ''))); });
    }
    return U.clone(job);
  }
  function cancel(id, actor) { const running = active.get(id), state = read(), job = state.jobs.find(x => x.id === id); if (!job) throw new Error('media job not found'); if (['PASS','FAIL','CANCELLED'].includes(job.state)) throw new Error('media job is already finished'); update(id, { cancellationRequested: true, cancelledBy: String(actor || 'local-user').slice(0, 120) }); if (running && running.child) running.child.kill(); active.delete(id); audit({ type: 'render-cancelled', id }); return update(id, { state: 'CANCELLED', endedAt: U.now(), progress: job.progress }); }
  function list() { return read().jobs.map(U.clone); }
  function status() { const jobs = list(), capability = ffmpeg(); return { schema: SCHEMA, jobs, active: active.size, concurrencyLimit: 2, outputs: Object.keys(OUTPUTS), nativeOutputs: ['wav'], requiredThirdPartyDependencies: [], optionalAdapters: [{ id: 'ffmpeg', openSource: true, free: true, available: capability.available, version: capability.version, expandsOutputs: ['mp3','webm','mp4'] }], engines: { deterministicWav: true, nativePcmWavTranscode: true, ffmpeg: capability }, arbitraryCodecArguments: false, automaticPublish: false }; }
  return { status, list, start, cancel, ffmpeg, validateSequence, wavBuffer, parsePcmWav, nativeWavTranscode, stateFile, auditFile };
}

module.exports = { SCHEMA, OUTPUTS, wavBuffer, parsePcmWav, nativeWavTranscode, create };
