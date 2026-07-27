#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Heartbeat = require('./axm-platform-heartbeat-core');

let pass = 0;
function test(name, fn) { try { fn(); pass += 1; console.log('PASS ' + name); } catch (error) { console.error('FAIL ' + name + '\n  ' + error.stack); process.exitCode = 1; } }

test('starts on the explicitly authorized hourly low profile with no action authority', () => {
  const status = Heartbeat.status(Heartbeat.createState(), 1000);
  assert.equal(status.config.enabled, true);
  assert.equal(status.config.cadenceMs, 3600000);
  assert.equal(status.config.resumeAfterRestart, true);
  assert.equal(status.pulseBridge.automaticPulseRequests, false);
});
test('profile selects deterministic cadence', () => {
  const state = Heartbeat.configure(Heartbeat.createState(), { profileId: 'steady', enabled: true }, 'mike', 1000);
  assert.equal(state.config.cadenceMs, 300000);
  assert.equal(state.nextDueAt, new Date(301000).toISOString());
});
test('explicit run time anchors the cadence without emitting immediately', () => {
  const anchorAt = new Date(4000).toISOString();
  const state = Heartbeat.configure(Heartbeat.createState(), { cadenceMs: 5000, anchorAt, enabled: true }, 'mike', 1000);
  assert.equal(state.config.anchorAt, anchorAt);
  assert.equal(state.nextDueAt, anchorAt);
  assert.equal(state.sequence, 0);
  assert.equal(Heartbeat.status(state, 1000).scheduleMode, 'ANCHORED');
});
test('past run time advances to the next anchored cadence boundary', () => {
  const anchorAt = new Date(4000).toISOString();
  const state = Heartbeat.configure(Heartbeat.createState(), { cadenceMs: 5000, anchorAt, enabled: true }, 'mike', 6000);
  assert.equal(state.nextDueAt, new Date(9000).toISOString());
});
test('invalid run time is refused instead of silently shifting the clock', () => {
  assert.throws(() => Heartbeat.configure(Heartbeat.createState(), { anchorAt: 'not-a-time' }, 'mike', 1000), /valid ISO timestamp/);
});
test('clearing the run time restores interval-from-change scheduling', () => {
  let state = Heartbeat.configure(Heartbeat.createState(), { cadenceMs: 5000, anchorAt: new Date(4000).toISOString() }, 'mike', 1000);
  state = Heartbeat.configure(state, { anchorAt: null }, 'mike', 2000);
  assert.equal(state.config.anchorAt, null);
  assert.equal(state.nextDueAt, new Date(7000).toISOString());
  assert.equal(Heartbeat.status(state, 2000).scheduleMode, 'INTERVAL_FROM_CHANGE');
});
test('manual step works while stopped and grants nothing', () => {
  const result = Heartbeat.manualStep(Heartbeat.createState(), 'mike', 1000);
  assert.equal(result.beat.sequence, 1);
  assert.equal(result.beat.authority, 'TIME_SIGNAL_ONLY');
  assert.equal(result.beat.pulseRequested, false);
  assert.deepEqual(result.beat.actionsActivated, []);
});
test('scheduled beat emits only when due', () => {
  let state = Heartbeat.configure(Heartbeat.createState(), { cadenceMs: 5000, enabled: true }, 'mike', 1000);
  assert.equal(Heartbeat.advance(state, 5999).emitted, false);
  const result = Heartbeat.advance(state, 6000);
  assert.equal(result.emitted, true);
  assert.equal(result.beat.sequence, 1);
  assert.equal(result.state.nextDueAt, new Date(11000).toISOString());
});
test('missed beats coalesce instead of bursting', () => {
  let state = Heartbeat.configure(Heartbeat.createState(), { cadenceMs: 5000, enabled: true }, 'mike', 1000);
  const result = Heartbeat.advance(state, 21000);
  assert.equal(result.beat.missedBeats, 3);
  assert.equal(result.beat.coalesced, true);
  assert.equal(result.state.sequence, 1);
  assert.equal(result.state.nextDueAt, new Date(26000).toISOString());
});
test('restart resume remains an explicit setting', () => {
  const state = Heartbeat.configure(Heartbeat.createState(), { resumeAfterRestart: false }, 'mike', 1000);
  assert.equal(state.config.resumeAfterRestart, false);
});

if (!process.exitCode) console.log('\n' + pass + ' PASS / 0 FAIL / platform-heartbeat ' + Heartbeat.VERSION);
