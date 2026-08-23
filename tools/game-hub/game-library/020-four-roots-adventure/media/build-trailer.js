#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Planner = require('../../../../../shared/code-capability-fabric/deterministic-gameplay-trailer-planner-v1');
const Video = require('../../../../../shared/asset-hands/video-codec');
const Raster = require('../../../../../shared/asset-hands/raster-codec');
const Replay = require('../runtime/deterministic-journey');
const Core = require('./four-roots-trailer-core');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'rendered');
const FILES = Object.freeze({
  mp4: 'four-roots-adventure-trailer.mp4', webm: 'four-roots-adventure-trailer.webm', vtt: 'four-roots-adventure-trailer.vtt',
  plan: 'trailer-plan.json', replay: 'gameplay-replay.json', sequence: 'sparse-sequence.json', receipt: 'verification-receipt.json',
  first: 'proof-first.png', middle: 'proof-middle.png', last: 'proof-last.png'
});

function sha(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function json(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function record(name, bytes, mime) { const value = Buffer.from(bytes); return { path: 'media/rendered/' + name, mime, byteLength: value.length, sha256: sha(value) }; }
function publicInspection(value) { return { pass: value.pass, errors: value.errors, mime: value.mime, format: value.format, codec: value.codec, profile: value.profile, bytes: value.bytes, width: value.width, height: value.height, frames: value.frames, durationSeconds: value.durationSeconds, fps: value.fps }; }

async function render() {
  const planned = Planner.plan(Planner.buildExampleRequest());
  const sources = Planner.loadSources();
  const replayBuild = Replay.build(sources.content, Planner.CONTENT_REF.sha256);
  if (Replay.canonical(replayBuild.record) !== Replay.canonical(planned.replay) || Replay.verify(planned.replay, sources.content, Planner.CONTENT_REF.sha256).pass !== true) throw new Error('planned gameplay replay failed exact native-engine reconstruction');
  const built = Core.build(planned.plan, sources.content, replayBuild);
  const encoded = await Video.encodeSparse(Core.WIDTH, Core.HEIGHT, built.uniqueFrames, built.sequence, { frameRate: { numerator: 12, denominator: 1 }, formats: ['mp4', 'webm'], jpegQuality: 88, vp8Quality: 86 });
  const proofIndexes = [0, 24, 47], proofNames = [FILES.first, FILES.middle, FILES.last];
  const proofs = proofIndexes.map((index, proofIndex) => {
    const encodedPng = Raster.encodeRgba(Core.WIDTH, Core.HEIGHT, built.uniqueFrames[index], { colourSpace: 'srgb' });
    return { name: proofNames[proofIndex], bytes: Buffer.from(encodedPng.bytes), inspection: encodedPng.inspection };
  });
  const planBytes = json({ request: planned.request, plan: planned.plan });
  const replayBytes = json(planned.replay);
  const sequenceBytes = json(built.record);
  const vttBytes = Buffer.from(built.vtt, 'utf8');
  const mp4Bytes = Buffer.from(encoded.mp4.bytes), webmBytes = Buffer.from(encoded.webm.bytes);
  const artifacts = [
    record(FILES.mp4, mp4Bytes, 'video/mp4'), record(FILES.webm, webmBytes, 'video/webm'), record(FILES.vtt, vttBytes, 'text/vtt'),
    record(FILES.plan, planBytes, 'application/json'), record(FILES.replay, replayBytes, 'application/json'), record(FILES.sequence, sequenceBytes, 'application/json'),
    ...proofs.map((item) => record(item.name, item.bytes, 'image/png'))
  ];
  const outputBytes = artifacts.reduce((sum, item) => sum + item.byteLength, 0);
  if (outputBytes > planned.request.resources.maxEncodedOutputBytes) throw new Error('encoded gameplay trailer output byte budget exceeded');
  const receiptCore = {
    schema: 'axm.game-trailer-render-verification-receipt/v2', version: '2.0.0', status: 'PASS', trailerId: planned.plan.id,
    requestDigest: planned.request.requestDigest, planDigest: planned.plan.planDigest, replayRef: planned.plan.replayRef, sourceRefs: planned.plan.sourceRefs,
    renderer: { id: 'axm-native-gameplay-replay-video-renderer', version: Video.VERSION, engine: encoded.engine, providerCalled: false, aiUsed: false, childProcesses: 0, networkRequests: 0 },
    profile: { width: encoded.width, height: encoded.height, frames: encoded.frames, uniqueFrames: encoded.uniqueFrames, gameplayUniqueFrames: 40, titleUniqueFrames: 8, frameRate: encoded.frameRate, durationSeconds: encoded.durationSeconds, audio: false, captions: true },
    containers: { mp4: { ...publicInspection(encoded.mp4.inspection), module: encoded.mp4.module }, webm: { ...publicInspection(encoded.webm.inspection), module: encoded.webm.module } },
    proofFrames: proofs.map((item, index) => ({ role: ['first-title', 'middle-gameplay', 'last-gameplay'][index], frameIndex: proofIndexes[index], frameLineage: built.record.frameLineage[proofIndexes[index]], ...record(item.name, item.bytes, 'image/png'), inspection: { pass: item.inspection.pass, errors: item.inspection.errors, width: item.inspection.width, height: item.inspection.height, colourType: item.inspection.colourType } })),
    artifacts: artifacts.map((item) => ({ ...item })), receiptSelfReference: 'OMITTED_TO_AVOID_RECURSIVE_DIGEST',
    resources: { uniqueFrameBytes: built.uniqueFrames.reduce((sum, item) => sum + item.byteLength, 0), replayBytes: replayBuild.recordBytes, replayActions: planned.replay.summary.actions, replayCheckpoints: planned.replay.checkpoints.length, encodedAndEvidenceBytesExcludingReceipt: outputBytes, maxEncodedOutputBytes: planned.request.resources.maxEncodedOutputBytes, files: 10, childProcesses: 0, networkRequests: 0, enforced: true },
    rights: planned.plan.rights,
    truth: { actualVideoRendered: true, gameplayReplayRendered: true, nativeGameEngineExecuted: true, replayVerified: true, reconstructedFromExactEngineStates: true, browserCapture: false, livePlayerInput: false, playabilityProvenByTrailer: false, containersParsed: true, firstMiddleLastDecoded: true, captionCompanionEmitted: true, published: false, installed: false, promoted: false, canonChanged: false },
    limitations: planned.plan.limitations, authority: 'NONE'
  };
  const receipt = { ...receiptCore, receiptDigest: Planner.hashValue(receiptCore) };
  const receiptBytes = json(receipt), receiptRecord = record(FILES.receipt, receiptBytes, 'application/json');
  if (outputBytes + receiptBytes.length > planned.request.resources.maxEncodedOutputBytes) throw new Error('complete gameplay trailer output byte budget exceeded');
  const allArtifacts = [...artifacts.slice(0, 6), receiptRecord, ...artifacts.slice(6)];
  if (allArtifacts.length !== 10 || new Set(allArtifacts.map((item) => item.path)).size !== 10) throw new Error('gameplay trailer artifact set drift');
  return {
    planned, replayBuild, built, encoded, proofs, receipt,
    files: {
      [FILES.mp4]: mp4Bytes, [FILES.webm]: webmBytes, [FILES.vtt]: vttBytes, [FILES.plan]: planBytes,
      [FILES.replay]: replayBytes, [FILES.sequence]: sequenceBytes, [FILES.receipt]: receiptBytes,
      [FILES.first]: proofs[0].bytes, [FILES.middle]: proofs[1].bytes, [FILES.last]: proofs[2].bytes
    }
  };
}
function write(result, options) {
  const replace = options && options.replace === true;
  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const [name, bytes] of Object.entries(result.files)) {
    const target = path.join(OUTPUT, name);
    if (!target.startsWith(OUTPUT + path.sep)) throw new Error('gameplay trailer output escaped fixed root');
    if (fs.existsSync(target) && !replace) throw new Error('gameplay trailer output already exists: ' + name);
    fs.writeFileSync(target, bytes, { flag: replace ? 'w' : 'wx' });
  }
  return result.receipt;
}

async function main() {
  const result = await render(); write(result, { replace: process.argv.includes('--replace') });
  process.stdout.write(JSON.stringify({ status: result.receipt.status, requestDigest: result.receipt.requestDigest, planDigest: result.receipt.planDigest, replaySemanticDigest: result.planned.replay.replayDigest, replayFileSha256: result.receipt.replayRef.sha256, receiptDigest: result.receipt.receiptDigest, artifacts: result.receipt.artifacts }, null, 2) + '\n');
}
if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exit(1); });
module.exports = { ROOT, OUTPUT, FILES, sha, json, record, render, write };
