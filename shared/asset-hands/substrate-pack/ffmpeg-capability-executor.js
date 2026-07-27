'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Pack = require('./pack-core');

const RECEIPT_SCHEMA = 'axm.ffmpeg-capability-receipt/v1';
const RECIPE = Object.freeze({
  schema: 'axm.ffmpeg-capability-recipe/v1',
  source: { video: 'lavfi:testsrc2', width: 64, height: 48, fps: 10, seconds: 1, audio: 'lavfi:sine', frequency_hz: 1000, sample_rate_hz: 48000, channels: 1 },
  container: 'matroska',
  codecs: { video: 'ffv1', audio: 'pcm_s16le' },
  decoded_video: { pixel_format: 'rgb24', expected_frames: 10 },
  decoded_audio: { sample_format: 's16le', sample_rate_hz: 48000, channels: 1 },
  loudness: { standard: 'EBU R128', filter: 'ebur128=peak=true' },
  repetitions: 2,
});

function capture(command, args, job, label, timeout) {
  const stdoutFile = path.join(job, label + '-stdout.txt');
  const stderrFile = path.join(job, label + '-stderr.txt');
  const stdoutHandle = fs.openSync(stdoutFile, 'wx');
  const stderrHandle = fs.openSync(stderrFile, 'wx');
  let result;
  try {
    result = childProcess.spawnSync(command, args, {
      windowsHide: true,
      shell: false,
      timeout: timeout || 60000,
      stdio: ['ignore', stdoutHandle, stderrHandle],
      env: Object.assign({}, process.env, { AV_LOG_FORCE_NOCOLOR: '1' }),
    });
  } finally {
    fs.closeSync(stdoutHandle);
    fs.closeSync(stderrHandle);
  }
  const stdout = fs.readFileSync(stdoutFile);
  const stderr = fs.readFileSync(stderrFile);
  if (stdout.length > 8 * 1024 * 1024 || stderr.length > 8 * 1024 * 1024) throw new Error('FFmpeg capability output exceeds bounds');
  return {
    status: result.status,
    error: result.error && (result.error.code || 'PROCESS_ERROR'),
    stdout,
    stderr,
    receipt: {
      status: result.status,
      error: result.error && (result.error.code || 'PROCESS_ERROR') || null,
      stdout_digest: Pack.sha256(stdout),
      stderr_digest: Pack.sha256(stderr),
    },
  };
}

function passed(execution) { return execution.status === 0 && !execution.error; }
function digestFile(file, minimum) { return fs.existsSync(file) && fs.statSync(file).size >= minimum ? Pack.sha256(fs.readFileSync(file)) : null; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function approximately(left, right, tolerance) { return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance; }

function parseProbe(execution) {
  if (!passed(execution)) return null;
  try {
    const value = JSON.parse(execution.stdout.toString('utf8'));
    return value && Array.isArray(value.streams) && value.format ? value : null;
  } catch (error) { return null; }
}

function parseLoudness(execution) {
  const text = execution.stderr.toString('utf8');
  const integrated = /Integrated loudness:\s*[\s\S]*?I:\s*(-?[0-9]+(?:\.[0-9]+)?)\s+LUFS/i.exec(text);
  const range = /Loudness range:\s*[\s\S]*?LRA:\s*(-?[0-9]+(?:\.[0-9]+)?)\s+LU/i.exec(text);
  const peak = /True peak:\s*[\s\S]*?Peak:\s*(-?[0-9]+(?:\.[0-9]+)?)\s+dBFS/i.exec(text);
  return {
    integrated_lufs: integrated ? number(integrated[1]) : null,
    loudness_range_lu: range ? number(range[1]) : null,
    true_peak_dbfs: peak ? number(peak[1]) : null,
  };
}

function cleanDiagnostic(executions) {
  const lines = executions.flatMap((execution) => (execution.stderr.toString('utf8') + '\n' + execution.stdout.toString('utf8')).split(/\r?\n/))
    .filter((line) => /error|invalid|failed|exception/i.test(line)).slice(-20).join('\n');
  return Pack.cleanText(lines, 3000) || null;
}

function createExecutor(options) {
  options = options || {};
  const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot());
  const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'external-process-matrix', fresh_process: true, id: 'axm-ffmpeg-capability-matrix', version: '1.0.0', host: 'ffmpeg', network: false, repetitions: 2, retains_media: false });
  function resolve() { return Pack.resolveRequest({ id: 'ffmpeg' }, { root, lock, inventory: options.inventory }); }
  function run() {
    const resolution = resolve();
    if (resolution.status !== 'READY') return { schema: RECEIPT_SCHEMA, version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['ffmpeg'], identity, private_location_retained: false };
    const jobRoot = path.resolve(root, '.jobs');
    fs.mkdirSync(jobRoot, { recursive: true });
    const job = path.join(jobRoot, 'ffmpeg-capabilities-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('FFmpeg capability job escaped root');
    fs.mkdirSync(job, { recursive: false });
    try {
      const entry = Pack.entryById(lock, 'ffmpeg');
      const ffmpeg = Pack.entrypointPath(root, entry, 'ffmpeg');
      const ffprobe = Pack.entrypointPath(root, entry, 'ffprobe');
      const invalid = path.join(job, 'invalid-media.bin');
      fs.writeFileSync(invalid, Buffer.from('AXM intentionally invalid media corpus\n'), { flag: 'wx' });
      const runs = ['a', 'b'].map((label) => {
        const container = path.join(job, 'matrix-' + label + '.mkv');
        const video = path.join(job, 'decoded-' + label + '.rgb');
        const audio = path.join(job, 'decoded-' + label + '.pcm');
        const mux = capture(ffmpeg, [
          '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
          '-f', 'lavfi', '-i', 'testsrc2=size=64x48:rate=10:duration=1',
          '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000:duration=1',
          '-map', '0:v:0', '-map', '1:a:0', '-map_metadata', '-1',
          '-c:v', 'ffv1', '-level', '3', '-g', '1', '-threads:v', '1', '-flags:v', '+bitexact',
          '-c:a', 'pcm_s16le', '-flags:a', '+bitexact', '-fflags', '+bitexact', '-shortest', container,
        ], job, 'mux-' + label);
        const probe = capture(ffprobe, ['-v', 'error', '-show_entries', 'stream=index,codec_name,codec_type,width,height,sample_rate,channels:format=format_name,duration,size', '-of', 'json', container], job, 'probe-' + label);
        const videoDecode = capture(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', container, '-map', '0:v:0', '-frames:v', '10', '-pix_fmt', 'rgb24', '-f', 'rawvideo', video], job, 'video-decode-' + label);
        const audioDecode = capture(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', container, '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', '-f', 's16le', audio], job, 'audio-decode-' + label);
        const loudness = capture(ffmpeg, ['-nostdin', '-hide_banner', '-nostats', '-i', container, '-map', '0:a:0', '-filter:a', 'ebur128=peak=true', '-f', 'null', '-'], job, 'loudness-' + label);
        const rejection = capture(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', invalid], job, 'invalid-' + label);
        const parsedProbe = parseProbe(probe);
        const parsedLoudness = parseLoudness(loudness);
        return {
          label,
          process: { mux: mux.receipt, probe: probe.receipt, video_decode: videoDecode.receipt, audio_decode: audioDecode.receipt, loudness: loudness.receipt, invalid_rejection: rejection.receipt },
          process_pass: passed(mux) && passed(probe) && passed(videoDecode) && passed(audioDecode) && passed(loudness),
          invalid_rejected: rejection.status !== 0 && !rejection.error,
          probe: parsedProbe ? {
            format_name: String(parsedProbe.format.format_name || ''),
            duration_seconds: number(parsedProbe.format.duration),
            size_bytes: number(parsedProbe.format.size),
            streams: parsedProbe.streams.map((stream) => ({ index: stream.index, codec_name: stream.codec_name, codec_type: stream.codec_type, width: stream.width || null, height: stream.height || null, sample_rate: number(stream.sample_rate), channels: stream.channels || null })),
          } : null,
          loudness: parsedLoudness,
          container_digest: digestFile(container, 1024),
          decoded_video_digest: digestFile(video, 64 * 48 * 3 * 10),
          decoded_video_bytes: fs.existsSync(video) ? fs.statSync(video).size : 0,
          decoded_audio_digest: digestFile(audio, 90000),
          decoded_audio_bytes: fs.existsSync(audio) ? fs.statSync(audio).size : 0,
          diagnostic: cleanDiagnostic([mux, probe, videoDecode, audioDecode, loudness]),
        };
      });
      const validProbe = (run) => run.probe && run.probe.streams.length === 2 &&
        run.probe.streams.some((stream) => stream.codec_type === 'video' && stream.codec_name === 'ffv1' && stream.width === 64 && stream.height === 48) &&
        run.probe.streams.some((stream) => stream.codec_type === 'audio' && stream.codec_name === 'pcm_s16le' && stream.sample_rate === 48000 && stream.channels === 1) &&
        approximately(run.probe.duration_seconds, 1, 0.1) && run.probe.size_bytes > 1024;
      const validLoudness = (run) => Number.isFinite(run.loudness.integrated_lufs) && run.loudness.integrated_lufs > -40 && run.loudness.integrated_lufs < -5 && Number.isFinite(run.loudness.true_peak_dbfs) && run.loudness.true_peak_dbfs < 0;
      const checks = [
        { name: 'two-bounded-fresh-process-matrices', pass: runs.every((run) => run.process_pass) },
        { name: 'audio-video-mux-created', pass: runs.every((run) => !!run.container_digest) },
        { name: 'independent-stream-probe', pass: runs.every(validProbe) },
        { name: 'decoded-video-frame-budget', pass: runs.every((run) => run.decoded_video_bytes === 64 * 48 * 3 * 10 && !!run.decoded_video_digest) },
        { name: 'decoded-audio-sample-budget', pass: runs.every((run) => run.decoded_audio_bytes >= 90000 && run.decoded_audio_bytes <= 100000 && !!run.decoded_audio_digest) },
        { name: 'ebu-r128-loudness-measured', pass: runs.every(validLoudness) },
        { name: 'invalid-media-counterexample-rejected', pass: runs.every((run) => run.invalid_rejected) },
        { name: 'decoded-video-repeatability', pass: runs[0].decoded_video_digest && runs[0].decoded_video_digest === runs[1].decoded_video_digest },
        { name: 'decoded-audio-repeatability', pass: runs[0].decoded_audio_digest && runs[0].decoded_audio_digest === runs[1].decoded_audio_digest },
        { name: 'loudness-repeatability', pass: approximately(runs[0].loudness.integrated_lufs, runs[1].loudness.integrated_lufs, 0.01) && approximately(runs[0].loudness.true_peak_dbfs, runs[1].loudness.true_peak_dbfs, 0.01) },
      ];
      const receipt = {
        schema: RECEIPT_SCHEMA,
        version: '1.0.0',
        status: checks.every((check) => check.pass) ? 'PASS' : 'FAIL',
        identity,
        runtime: resolution.selected,
        recipe: RECIPE,
        recipe_digest: Pack.digest(RECIPE),
        provides_substrates: ['independent-audio-decoder', 'independent-av-decoder', 'loudness-meter', 'video-muxer'],
        checks,
        runs,
        private_location_retained: false,
        generated_media_retained: false,
        automatic_media_retention: false,
      };
      receipt.digest = Pack.digest(receipt);
      return receipt;
    } finally {
      const resolved = path.resolve(job);
      if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe FFmpeg capability cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = Object.freeze({ RECEIPT_SCHEMA, RECIPE, createExecutor });
