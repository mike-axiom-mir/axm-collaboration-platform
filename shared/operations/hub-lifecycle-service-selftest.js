#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Service = require('./hub-lifecycle-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-hub-lifecycle-'));
const stateRoot = path.join(root, 'state');
const indexFile = path.join(root, 'tools-index.json');
const receiptFile = path.join(stateRoot, 'tool-readiness', 'latest-selftests.json');
const sourceDigest = 'a'.repeat(64);
const passDigest = 'b'.repeat(64);
const index = {
  schema: 'axm.tools-index/v1', generatedAt: '2026-07-24T12:00:00.000Z', sourceDigest,
  capabilities: [], promotionQueue: {}, truth: { automaticPromotion: false },
  tools: [
    { id:'ready-tool', status:'TEST', promotion:{ state:'READY_FOR_HUMAN_REVIEW', blockers:[] }, selftest:{ promotionPath:'tools/ready-tool/selftest.js', sha256:passDigest, result:{ verdict:'PASS', outputSha256:'c'.repeat(64) } } },
    { id:'held-tool', status:'TEST', promotion:{ state:'BLOCKED', blockers:['valid module contract is missing'] }, selftest:{ promotionPath:'tools/held-tool/selftest.js', sha256:'d'.repeat(64), result:{ verdict:'PASS', outputSha256:'e'.repeat(64) } } },
    { id:'early-tool', status:'EXPERIMENTAL', promotion:{ state:'NOT_APPLICABLE', blockers:['kind is undeclared'] }, selftest:{ promotionPath:null, sha256:null, result:null } },
    { id:'manual-tool', status:'EXPERIMENTAL', promotion:{ state:'NOT_APPLICABLE', blockers:[] }, selftest:{ promotionPath:null, sha256:null, result:null } }
  ]
};
const receipt = { schema:'axm.tool-selftest-results/v1', generatedAt:'2026-07-24T12:00:00.000Z', results:[] };
fs.mkdirSync(path.dirname(receiptFile), { recursive:true });
fs.writeFileSync(indexFile, JSON.stringify(index));
fs.writeFileSync(receiptFile, JSON.stringify(receipt));
const fakeReadiness = {
  validateIndex(value) { return { pass:value && value.schema === 'axm.tools-index/v1', errors:[] }; },
  buildIndex() { return JSON.parse(JSON.stringify(index)); }
};
const service = Service.create({ root, stateRoot, toolsIndexFile:indexFile, selftestResultsFile:receiptFile, toolReadiness:fakeReadiness });

assert.equal(service.status().count, 0);
service.set({ id: 'studio', lifecycle: 'WORKING', actor: 'Mike', source: 'hub-menu' });
assert.equal(service.status().lifecycles.studio.lifecycle, 'WORKING');
service.batch([
  { id: 'forge', lifecycle: 'NEEDS VERIFY' },
  { id: 'audio-studio', lifecycle: 'SAVED CHECKPOINT' }
], 'Codex', 'verified-batch');
const state = service.status();
assert.equal(state.count, 3);
assert.equal(state.lifecycles.forge.lifecycle, 'NEEDS VERIFY');
assert.equal(state.lifecycles['audio-studio'].source, 'verified-batch');
assert.equal(state.truth.quickMenuMaximum, 'WORKING');
assert.equal(state.truth.canonEndpoint, false);
assert.equal(state.lifecycles.studio.evidence, null);
assert.throws(() => service.set({ id: 'studio', lifecycle: 'CANON CANDIDATE' }), /refused/);
assert.throws(() => service.set({ id: '../studio', lifecycle: 'WORKING' }), /module id/);
assert.throws(() => service.batch([{ id: 'x', lifecycle: 'WORKING' }, { id: 'x', lifecycle: 'TEST-HOLD' }]), /duplicate/);

service.set({ id:'manual-tool', lifecycle:'WORKING', actor:'Mike', source:'hub-menu' });
const plan = service.reconciliationPlan();
assert.equal(plan.entries.length, 4);
assert.equal(plan.entries.find(row => row.id === 'ready-tool').lifecycle, 'WORKING');
assert.equal(plan.entries.find(row => row.id === 'ready-tool').evidence.selftestVerdict, 'PASS');
assert.equal(plan.entries.find(row => row.id === 'held-tool').lifecycle, 'TEST-HOLD');
assert.deepEqual(plan.entries.find(row => row.id === 'held-tool').evidence.namedHolds, ['valid module contract is missing']);
assert.equal(plan.entries.find(row => row.id === 'early-tool').lifecycle, 'NEEDS VERIFY');
assert.equal(plan.entries.find(row => row.id === 'manual-tool').lifecycle, 'WORKING');
assert.equal(plan.entries.find(row => row.id === 'manual-tool').evidence.basis, 'PRESERVED_EXPLICIT_LOCAL_JUDGMENT');
assert.equal(plan.truth.canonGranted, false);
assert.throws(() => service.applyReconciliation({ planDigest:plan.planDigest }), /confirmation/);
assert.throws(() => service.applyReconciliation({ confirmation:Service.RECONCILIATION_CONFIRMATION, planDigest:'0'.repeat(64) }), /plan changed/);
const applied = service.applyReconciliation({ confirmation:Service.RECONCILIATION_CONFIRMATION, planDigest:plan.planDigest, actor:'Codex' });
assert.equal(applied.updated, 4);
assert.equal(applied.canonGranted, false);
assert.equal(service.status().lifecycles['ready-tool'].evidence.toolsIndexSourceDigest, sourceDigest);

const staleReadiness = Object.assign({}, fakeReadiness, { buildIndex() { return Object.assign({}, index, { sourceDigest:'f'.repeat(64) }); } });
const staleService = Service.create({ root, stateRoot, toolsIndexFile:indexFile, selftestResultsFile:receiptFile, toolReadiness:staleReadiness });
assert.throws(() => staleService.reconciliationPlan(), /stale/);

console.log('hub lifecycle service selftest: PASS (evidence reconciliation, stale-index refusal, shared state, CANON refused)');
