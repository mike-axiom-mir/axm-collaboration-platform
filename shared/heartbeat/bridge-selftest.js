#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Bridge = require('./axm-heartbeat-verification-bridge');
const PulseCore = require('../pulse/axm-body-pulse-core');
const PulseService = require('../pulse/axm-body-pulse-service');

let pulseState = null;
const pulse = PulseService.create({
  read: () => pulseState,
  write: value => { pulseState = value; },
  measure: () => ({ cpuUsedRatio: 0.1, memoryUsedRatio: 0.1, gpuUsedRatio: 0, gpuTemperatureC: 40, batteryPercent: 100, onBattery: false, temperatureSource: 'deterministic-fixture' })
});
pulse.setMode({ mode: 'ACTIVE', actorId: 'test' });
let bridgeState = null;
let clock = Date.parse('2026-07-27T10:00:00.000Z');
const bridge = Bridge.create({
  root: require('path').resolve(__dirname, '..', '..'),
  bodyPulse: pulse,
  read: () => bridgeState,
  write: value => { bridgeState = value; },
  now: () => clock,
  execute: async check => ({ checkId: check.id, label: check.label, status: 'PASS', exitCode: 0, signal: null, durationMs: 1, summary: 'deterministic fixture pass' })
});

(async () => {
  const first = await bridge.onBeat({ beatId: 'beat-1', sequence: 1, kind: 'SCHEDULED' });
  assert.equal(first.status, 'PASS');
  assert.equal(first.checks.length, 15);
  assert.equal(new Set(first.checks.map(item => item.checkId)).size, 15);
  assert(pulse.status().recentReceipts.filter(item => item.goalId === first.goalId).length === 15);
  assert.equal(first.evidenceAuthority, 'NAMED_DETERMINISTIC_CHECKS_ONLY');
  const held = await bridge.onBeat({ beatId: 'beat-2', sequence: 2, kind: 'SCHEDULED' });
  assert.equal(held.reason, 'fifteen-per-hour-cap');
  clock += Bridge.WINDOW_MS - 500;
  const second = await bridge.onBeat({ beatId: 'beat-2', sequence: 2, kind: 'SCHEDULED' });
  assert.equal(second.status, 'PASS');
  assert.equal(second.checks.length, 15, 'sub-second scheduler jitter must not skip an hourly window');
  assert.notDeepEqual(first.checks.map(item => item.checkId), second.checks.map(item => item.checkId));
  const manual = await bridge.onBeat({ beatId: 'beat-manual', sequence: 3, kind: 'MANUAL' });
  assert.equal(manual.reason, 'manual-beats-do-not-spend-verification-pulses');
  assert.equal(bridge.status().maxChecksPerHour, 15);
  assert.equal(bridge.status().repairAuthority, 'FINDINGS_ONLY');
  let bootstrapPulseState = null;
  const bootstrapPulse = PulseService.create({ read: () => bootstrapPulseState, write: value => { bootstrapPulseState = value; } });
  let bootstrapBridgeState = null;
  Bridge.create({ root: require('path').resolve(__dirname, '..', '..'), bodyPulse: bootstrapPulse, read: () => bootstrapBridgeState, write: value => { bootstrapBridgeState = value; }, bootstrapPulseMode: 'CONSERVE', bootstrapActor: 'mike-authorized-test', execute: async () => ({ status: 'PASS' }) });
  assert.equal(bootstrapPulse.status().mode, 'CONSERVE');
  assert.equal(bootstrapBridgeState.pulseBootstrapApplied, true);
  bootstrapPulse.setMode({ mode: 'STOPPED', actorId: 'test-user' });
  Bridge.create({ root: require('path').resolve(__dirname, '..', '..'), bodyPulse: bootstrapPulse, read: () => bootstrapBridgeState, write: value => { bootstrapBridgeState = value; }, bootstrapPulseMode: 'CONSERVE', bootstrapActor: 'mike-authorized-test', execute: async () => ({ status: 'PASS' }) });
  assert.equal(bootstrapPulse.status().mode, 'STOPPED');
  console.log('PASS heartbeat verification bridge / fifteen hourly evidence receipts / findings only');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
