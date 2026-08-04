#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Bridge = require('./axm-heartbeat-mirror-learning-bridge');
const PulseService = require('../pulse/axm-body-pulse-service');
const ReviewService = require('../operations/review-service');

const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-heartbeat-mirror-learning-'));
let pulseState = null;
let bridgeState = null;
let clock = Date.parse('2026-07-27T12:00:00.000Z');
let feedStatusCalls = 0;
let ingested = [];
const pulse = PulseService.create({
  read: () => pulseState,
  write: value => { pulseState = value; },
  measure: () => ({ cpuUsedRatio:.1, memoryUsedRatio:.1, gpuUsedRatio:0, gpuTemperatureC:35, batteryPercent:100, onBattery:false, temperatureSource:'fixture' })
});
const review = ReviewService.create({ stateRoot });
const bridge = Bridge.create({
  bodyPulse: pulse,
  reviewService: review,
  read: () => bridgeState,
  write: value => { bridgeState = value; },
  now: () => clock,
  actionFeedStatus: async () => { feedStatusCalls += 1; return { enabled:true, state:'OPTED_IN' }; },
  ingestLesson: async action => { ingested.push(action); return { accepted:true, state:'ADMITTED_PRIVATE_LESSON', episodeId:'episode-1', digest:'b'.repeat(64) }; }
});

(async () => {
  assert.equal(bridge.status().state, 'DORMANT');
  assert.equal(bridge.status().enabled, false);
  assert.equal(bridge.status().pulseModule.enabled, false);
  const dormant = await bridge.onBeat({ beatId:'beat-off', sequence:1, kind:'SCHEDULED' });
  assert.equal(dormant.reason, 'mirror-learning-lane-disabled');
  assert.equal(feedStatusCalls, 0, 'OFF lane must not probe Mirror');
  assert.equal(ingested.length, 0, 'OFF lane must not ingest lessons');

  bridge.configure({ enabled:true, actorId:'mike-test' });
  const pulseOff = await bridge.onBeat({ beatId:'beat-pulse-off', sequence:2, kind:'SCHEDULED' });
  assert.equal(pulseOff.reason, 'mirror-learning-pulse-module-disabled');
  assert.equal(feedStatusCalls, 0, 'disabled Pulse seat must hold before Mirror access');

  pulse.register({ moduleId:Bridge.MODULE_ID, enabled:true });
  pulse.setMode({ mode:'CONSERVE', actorId:'mike-test' });
  const digest = 'a'.repeat(64);
  const item = review.submit({
    kind:Bridge.REVIEW_KIND,
    title:'Code draft fixture',
    sourceRef:'mirror-code-clone:fixture:safe-repair',
    artifactDigest:digest,
    summary:'Candidate only.',
    requiredSeats:2,
    action:{ type:'review-code-draft', moduleId:'fixture-module', candidateRoot:'private-path-not-for-learning', receiptPath:'private-receipt-not-for-learning', automaticApply:false }
  });
  review.recordTechnicalReview(item.id, { schema:'axm.code-draft-technical-review/v1', artifactDigest:digest, verdict:'APPROVE', summary:'Exact candidate checked against its bounded fixture evidence.', checks:[{ id:'fixture-integrity', status:'PASS', evidence:'Bounded selftest fixture.' }], automaticApply:false });
  review.vote(item.id, { artifactDigest:digest, actor:'Mike', actorKind:'human', verdict:'APPROVE', note:'Machine explanation reviewed before consent.', informedExplanation:true });
  clock += Bridge.WINDOW_MS;
  const learned = await bridge.onBeat({ beatId:'beat-learn', sequence:3, kind:'SCHEDULED' });
  assert.equal(learned.status, 'PASS');
  assert.equal(ingested.length, 1);
  assert.equal(ingested[0].schema, 'axm.action/v1');
  assert.equal(ingested[0].state, 'COMPLETE');
  assert.equal(ingested[0].receipt.evidence[0].sha256, digest);
  assert(!JSON.stringify(ingested[0]).includes('private-path-not-for-learning'), 'lesson envelope must exclude candidate paths and source content');
  assert.equal(bridge.status().trainingAuthority, 'NONE');
  assert.equal(bridge.status().originalMirrorWriteAuthority, 'NONE');
  assert.equal(bridge.status().waitingLessons.length, 0);
  assert(pulse.status().recentReceipts.some(receipt => receipt.effect === 'private-mirror-lesson-corpus-only'));

  const capped = await bridge.onBeat({ beatId:'beat-capped', sequence:4, kind:'SCHEDULED' });
  assert.equal(capped.reason, 'one-mirror-lesson-per-hour-cap');
  const manual = await bridge.onBeat({ beatId:'manual', sequence:5, kind:'MANUAL' });
  assert.equal(manual.reason, 'manual-beats-do-not-admit-mirror-lessons');
  bridge.configure({ enabled:false, actorId:'mike-test' });
  clock += Bridge.WINDOW_MS;
  await bridge.onBeat({ beatId:'beat-off-again', sequence:6, kind:'SCHEDULED' });
  assert.equal(ingested.length, 1, 'turning the lane OFF must keep it quiet');

  fs.rmSync(stateRoot, { recursive:true, force:true });
  console.log('PASS dormant hourly Mirror learning lane · explicit gates · one reviewed clone lesson · no source/apply/training authority');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
