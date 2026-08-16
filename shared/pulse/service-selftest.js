#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Service = require('./axm-body-pulse-service');
let stored = null;
const service = Service.create({
  read: () => stored,
  write: value => { stored = value; },
  measure: () => ({
    cpuUsedRatio: 0.1,
    memoryUsedRatio: 0.1,
    gpuUsedRatio: null,
    gpuTemperatureC: null,
    cpuTemperatureC: null,
    batteryPercent: null,
    onBattery: null
  })
});
const status = service.status();
assert.equal(status.mode, 'STOPPED');
assert(status.modules.some(module => module.moduleId === 'asset-fabric'));
assert(status.modules.some(module => module.moduleId === 'governed-evolution-lab'));
assert(status.modules.some(module => module.moduleId === 'mirror-learning-forge'));
assert(status.body.knownSignals.includes('memory'));
assert(status.body.unknownSignals.includes('cpu-thermal'));
if (status.body.knownSignals.includes('gpu-thermal')) assert(Number.isFinite(status.body.gpuTemperatureC));
service.register({ moduleId: 'asset-fabric', enabled: true });
service.goal({ goalId: 'test-goal', moduleId: 'asset-fabric', title: 'Test one family', priority: 90, maxPulses: 1, createdBy: 'test' });
service.setMode({ mode: 'ACTIVE', actorId: 'test' });
const grant = service.request({ moduleId: 'asset-fabric', force: true });
assert.equal(grant.granted, true);
const done = service.complete({ leaseId: grant.lease.leaseId, outcome: 'COMPLETED', summary: 'Test completed.' });
assert.equal(done.receipt.promotionAuthority, 'NONE');
let lifecycle = service.goal({ goalId: 'test-goal', moduleId: 'asset-fabric', title: 'Test one family', status: 'DONE', statusChangedBy: 'test' });
assert.equal(lifecycle.retention.archivedGoalCount, 1);
lifecycle = service.deleteGoals({ goalIds: ['test-goal'], actorId: 'test' });
assert(!lifecycle.goals.some(goal => goal.goalId === 'test-goal'));
assert(!lifecycle.recentReceipts.some(receipt => receipt.goalId === 'test-goal'));
console.log('PASS body-pulse local service');
