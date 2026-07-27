#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Queue = require('./generate-lifecycle-gap-queue');

const index = {
  schema:'axm.tools-index/v1', sourceDigest:'a'.repeat(64), generatedAt:'2026-07-24T12:00:00.000Z',
  tools:[
    { id:'working-gap', status:'TEST', promotion:{ state:'BLOCKED', blockers:['kind is undeclared'] } },
    { id:'held-gap', status:'TEST', promotion:{ state:'BLOCKED', blockers:['top-level executable selftest is missing'] } }
  ]
};
const gaps = {
  schema:'axm.module-seam-gap-report/v1', moduleCount:2, checkedAt:'2026-07-24T12:00:00.000Z',
  modules:[
    { id:'working-gap', status:'open', gaps:['lifecycle seam declaration missing'] },
    { id:'held-gap', status:'open', gaps:['module contract not declared'] }
  ]
};
const lifecycle = { updatedAt:'2026-07-24T12:00:00.000Z', lifecycles:{ 'working-gap':{ lifecycle:'WORKING' }, 'held-gap':{ lifecycle:'TEST-HOLD' } } };
const report = Queue.buildQueue(index, gaps, lifecycle, '2026-07-24T12:00:00.000Z');
assert.equal(report.entries.length, 2);
assert.equal(report.entries[0].id, 'working-gap');
assert.equal(report.entries[0].priority, 'P0');
assert.equal(report.entries[1].priority, 'P1');
assert.equal(report.entries[1].authority.automaticContractCreation, false);
assert.equal(report.truth.contractsMustBeAuthoredOneModuleAtATime, true);
assert.throws(() => Queue.buildQueue(index, Object.assign({}, gaps, { moduleCount:3 }), lifecycle), /current tool count/);
console.log('lifecycle gap queue selftest: PASS (source-backed priority, one-module inspection, no automatic contracts)');
