#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Bridge = require('./axm-heartbeat-code-draft-bridge');
const PulseService = require('../pulse/axm-body-pulse-service');
const ReviewService = require('../operations/review-service');
const U = require('../operations/operations-utils');

function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function legacyModule(root, id) {
  const file = path.join(root, 'tools', id, 'manifest.json');
  writeJson(file, { id, name:id, version:'v0.1', status:'TEST', entry:'index.html', type:'hub-module', hubApiVersion:'1.0', uses:[] });
  fs.writeFileSync(path.join(root, 'tools', id, 'index.html'), '<!doctype html><title>' + id + '</title>\n');
  return { file, sha256: U.sha256(fs.readFileSync(file)) };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-heartbeat-code-draft-source-'));
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-heartbeat-code-draft-state-'));
const candidates = path.join(os.tmpdir(), 'axm-heartbeat-code-draft-candidates-' + Date.now());
const sources = [];
for (let index = 1; index <= 7; index += 1) sources.push(legacyModule(root, 'fixture-' + index));
legacyModule(root, 'mirror-protected-fixture');
let pulseState = null;
const pulse = PulseService.create({ read:() => pulseState, write:value => { pulseState = value; }, measure:() => ({ cpuUsedRatio:.1, memoryUsedRatio:.1, gpuUsedRatio:0, gpuTemperatureC:35, batteryPercent:100, onBattery:false, temperatureSource:'fixture' }) });
pulse.setMode({ mode:'CONSERVE', actorId:'test' });
const review = ReviewService.create({ stateRoot });
let bridgeState = {
  schema: Bridge.STATE_SCHEMA,
  version: '0.1.0',
  lastWindowAt: '2026-07-27T10:00:00.000Z',
  running: true,
  activeBeatId: 'beat-interrupted',
  lastReason: 'code-drafts-running',
  seen: {},
  runs: []
};
let clock = Date.parse('2026-07-27T12:00:00.000Z');
const bridge = Bridge.create({ root, candidateBaseRoot:candidates, bodyPulse:pulse, reviewService:review, read:() => bridgeState, write:value => { bridgeState = value; }, now:() => clock });

(async () => {
  assert.equal(bridge.status().state, 'DORMANT', 'the experimental draft lane is packaged dormant');
  assert.equal(bridge.status().enabled, false);
  assert.equal(bridge.status().lastReason, 'interrupted-by-server-restart');
  assert(bridge.status().recentRuns.some(run => run.status === 'INTERRUPTED' && run.beatId === 'beat-interrupted'));
  const dormant = await bridge.onBeat({ beatId:'beat-dormant', sequence:1, kind:'SCHEDULED' });
  assert.equal(dormant.reason, 'code-draft-pulse-module-disabled');
  assert.equal(review.list().length, 0, 'a dormant lane must not create review work');
  pulse.register({ moduleId:Bridge.MODULE_ID, enabled:true });
  const first = await bridge.onBeat({ beatId:'beat-1', sequence:1, kind:'SCHEDULED' });
  assert.equal(first.status, 'PASS');
  assert.equal(first.drafts.length, 1);
  assert(first.drafts.every(item => item.status === 'DRAFTED' && item.reviewId && item.expiresAt));
  assert.equal(review.list().filter(item => item.kind === Bridge.REVIEW_KIND).length, 1);
  const firstReview = review.list().find(item => item.kind === Bridge.REVIEW_KIND);
  assert.equal(firstReview.action.reviewExplanation.schema, 'axm.code-draft-plain-explanation/v1');
  assert(firstReview.action.reviewExplanation.recommendation.includes('TECHNICAL CHECK REQUIRED FIRST'));
  assert.equal(firstReview.action.reviewExplanation.automaticApply, false);
  assert.equal(pulse.status().recentReceipts.filter(item => item.goalId === first.goalId).length, 1);
  sources.forEach(source => assert.equal(U.sha256(fs.readFileSync(source.file)), source.sha256, 'source must remain byte-identical'));
  const capped = await bridge.onBeat({ beatId:'beat-2', sequence:2, kind:'SCHEDULED' });
  assert.equal(capped.reason, 'one-draft-per-hour-cap');
  const drafted = first.drafts.slice();
  for (let sequence = 2; sequence <= 7; sequence += 1) {
    clock += Bridge.WINDOW_MS;
    const next = await bridge.onBeat({ beatId:'beat-' + sequence, sequence, kind:'SCHEDULED' });
    assert.equal(next.status, 'PASS');
    assert.equal(next.drafts.length, 1);
    drafted.push(next.drafts[0]);
  }
  assert.equal(new Set(drafted.map(item => item.moduleId)).size, 7);
  clock += Bridge.WINDOW_MS;
  const empty = await bridge.onBeat({ beatId:'beat-8', sequence:8, kind:'SCHEDULED' });
  assert.equal(empty.status, 'EMPTY');
  assert.equal(review.list().filter(item => item.kind === Bridge.REVIEW_KIND).length, 7, 'unchanged source is not drafted twice');
  const manual = await bridge.onBeat({ beatId:'manual', sequence:9, kind:'MANUAL' });
  assert.equal(manual.reason, 'manual-beats-do-not-create-code-drafts');
  clock += Bridge.QUEUE_RETENTION_MS + Bridge.WINDOW_MS;
  await bridge.onBeat({ beatId:'beat-expire', sequence:10, kind:'SCHEDULED' });
  assert.equal(bridge.status().queue.length, 0, 'seven-day review queue expires on the first scheduled beat after retention');
  assert(review.list().filter(item => item.kind === Bridge.REVIEW_KIND).every(item => item.state === 'EXPIRED'));
  assert.equal(bridge.status().sourceWriteAuthority, 'NONE');
  const evidence = bridge.status().evidenceSummary;
  assert.equal(evidence.durationKind, 'WALL_CLOCK_PROCESS_WINDOW');
  assert.equal(evidence.retainedWindowCount, 10);
  assert.equal(evidence.passWindowCount, 7);
  assert.equal(evidence.emptyWindowCount, 2);
  assert.equal(evidence.candidateExecutionCount, 7);
  assert.equal(evidence.draftedCandidateCount, 7);
  assert.equal(evidence.failedCandidateCount, 0);
  assert.equal(evidence.uniqueModuleCount, 7);
  assert.equal(evidence.pendingReviewCount, 0);
  assert.equal(evidence.pressureSampleCount, 14);
  assert.equal(evidence.peakCpuUsedRatio, 0.1);
  fs.rmSync(root, { recursive:true, force:true }); fs.rmSync(stateRoot, { recursive:true, force:true }); fs.rmSync(candidates, { recursive:true, force:true });
  console.log('PASS heartbeat code drafts · dormant by default · one/hour when enabled · persistent dual review · seven-day expiry · dedupe · source unchanged');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
