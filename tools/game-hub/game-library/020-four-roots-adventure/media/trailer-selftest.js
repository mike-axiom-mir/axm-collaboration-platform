'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('../../../../../shared/code-capability-fabric/deterministic-gameplay-trailer-planner-v1');
const Video = require('../../../../../shared/asset-hands/video-codec');
const Raster = require('../../../../../shared/asset-hands/raster-codec');
const Replay = require('../runtime/deterministic-journey');
const Core = require('./four-roots-trailer-core');
const Builder = require('./build-trailer');

async function main() {
  const first = await Builder.render(), second = await Builder.render();
  assert.strictEqual(first.planned.request.requestDigest, second.planned.request.requestDigest);
  assert.strictEqual(first.planned.plan.planDigest, second.planned.plan.planDigest);
  assert.strictEqual(first.planned.replay.replayDigest, second.planned.replay.replayDigest);
  for (const name of Object.keys(first.files)) assert.strictEqual(Builder.sha(first.files[name]), Builder.sha(second.files[name]), name + ' is not deterministic');

  assert.strictEqual(first.built.uniqueFrames.length, 48);
  assert.strictEqual(first.built.sequence.length, 360);
  assert.strictEqual(first.built.uniqueFrames.reduce((sum, item) => sum + item.byteLength, 0), 44236800);
  assert.strictEqual(first.built.record.frameLineage.length, 48);
  assert.strictEqual(first.built.record.frameLineage.filter((entry) => entry.kind === 'gameplay-replay').length, 40);
  assert.deepStrictEqual(Array.from(new Set(first.built.record.frameLineage.filter((entry) => entry.zoneId).map((entry) => entry.zoneId))), ['crossroads', 'truth-hollow', 'agency-garden', 'continuity-archive', 'wisdom-grove']);

  const source = Planner.loadSources();
  assert.strictEqual(Replay.verify(first.planned.replay, source.content, Planner.CONTENT_REF.sha256).pass, true);
  assert.strictEqual(first.planned.replay.summary.moves, 202);
  assert.strictEqual(first.planned.replay.summary.interactionAttempts, 26);
  assert.strictEqual(first.planned.replay.summary.recordedInteractions, 25);
  assert.strictEqual(first.planned.replay.summary.completed, true);

  for (const lineage of first.built.record.frameLineage.filter((entry) => entry.kind === 'gameplay-replay')) {
    const frame = first.built.uniqueFrames[lineage.uniqueFrameIndex], center = Core.playerCenter(lineage);
    assert.deepStrictEqual(Core.pixel(frame, center.x, center.y), Core.rgba(Core.COLORS.ink), 'player marker is missing for ' + lineage.checkpointId);
    const checkpoint = first.planned.replay.checkpoints.find((entry) => entry.id === lineage.checkpointId);
    assert(checkpoint && checkpoint.stateDigest === lineage.stateDigest && checkpoint.x === lineage.x && checkpoint.y === lineage.y);
  }

  assert.strictEqual(first.encoded.durationSeconds, 30);
  assert.deepStrictEqual(first.encoded.frameRate, { numerator: 12, denominator: 1 });
  assert.strictEqual(Video.inspectMp4(first.files[Builder.FILES.mp4]).pass, true);
  assert.strictEqual(Video.inspectWebm(first.files[Builder.FILES.webm]).pass, true);
  for (const name of [Builder.FILES.first, Builder.FILES.middle, Builder.FILES.last]) {
    const inspection = Raster.inspectPng(first.files[name]);
    assert.strictEqual(inspection.pass, true); assert.strictEqual(inspection.width, 640); assert.strictEqual(inspection.height, 360);
  }
  const captions = first.files[Builder.FILES.vtt].toString('utf8');
  assert.match(captions, /^WEBVTT\n\n1\n00:00:00\.000 --> 00:00:05\.000/);
  assert.strictEqual((captions.match(/ --> /g) || []).length, 6);
  assert.match(captions, /deterministic replay footage/i);

  const diskReceipt = JSON.parse(fs.readFileSync(path.join(Builder.OUTPUT, Builder.FILES.receipt), 'utf8'));
  assert.deepStrictEqual(diskReceipt, first.receipt);
  assert.strictEqual(diskReceipt.truth.gameplayReplayRendered, true);
  assert.strictEqual(diskReceipt.truth.nativeGameEngineExecuted, true);
  assert.strictEqual(diskReceipt.truth.reconstructedFromExactEngineStates, true);
  assert.strictEqual(diskReceipt.truth.browserCapture, false);
  assert.strictEqual(diskReceipt.truth.livePlayerInput, false);
  assert.strictEqual(diskReceipt.truth.published, false);
  assert.strictEqual(diskReceipt.rights.publicDistribution, 'HOLD');
  assert.strictEqual(diskReceipt.authority, 'NONE');
  for (const [name, bytes] of Object.entries(first.files)) {
    const disk = fs.readFileSync(path.join(Builder.OUTPUT, name));
    assert.strictEqual(Builder.sha(disk), Builder.sha(bytes), name + ' disk drift');
  }
  const outputPaths = first.planned.plan.outputPaths.slice().sort(), actualPaths = Object.keys(first.files).map((name) => 'media/rendered/' + name).sort();
  assert.deepStrictEqual(actualPaths, outputPaths);
  assert.strictEqual(actualPaths.length, 10);
  const stale = { request: first.planned.request, plan: JSON.parse(JSON.stringify(first.planned.plan)), replay: first.planned.replay };
  stale.plan.truth.published = true;
  assert.strictEqual(Planner.verify(stale, first.planned.request).pass, false);
  console.log('PASS Four Roots deterministic gameplay trailer (40 replay frames / 5 zones, 228 actions, MP4 + WebM, exact 30s, captions, decode, budgets, rights HOLD)');
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
