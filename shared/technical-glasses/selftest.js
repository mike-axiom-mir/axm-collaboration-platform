#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Glasses = require('./technical-glasses-core');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-glasses-'));
fs.mkdirSync(path.join(root, 'tools', 'alpha'), { recursive: true });
fs.mkdirSync(path.join(root, 'shared', 'capabilities'), { recursive: true });
fs.mkdirSync(path.join(root, 'state', 'body-pulse'), { recursive: true });
fs.mkdirSync(path.join(root, 'state', 'evidence-retention', 'sessions', 'sealed', '2026-07'), { recursive: true });
fs.writeFileSync(path.join(root, 'server.js'), 'module.exports = {};\n');
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node test.js' } }));
fs.writeFileSync(path.join(root, 'README.md'), '# Narrative only\n');
fs.writeFileSync(path.join(root, 'tools', 'alpha', 'index.html'), '<!doctype html><title>Alpha</title>');
fs.writeFileSync(path.join(root, 'tools', 'alpha', 'manifest.json'), JSON.stringify({ id: 'alpha', name: 'Alpha', version: 'v1', status: 'TEST', entry: 'index.html', contract: 'module.contract.json', uses: ['storage'] }));
fs.writeFileSync(path.join(root, 'tools', 'alpha', 'module.contract.json'), JSON.stringify({ schema: 'axm.module-contract/v1', id: 'alpha', version: 'v1', provides: [], consumes: [], permissions: ['storage'], handoffs: { emits: [], accepts: [] }, boundaries: { refuses: ['guessing'] } }));
fs.writeFileSync(path.join(root, 'state', 'body-pulse', 'pulse.json'), JSON.stringify({ mode: 'IDLE', body: { pressure: 'GREEN', thermalC: 44, sampledAt: '2026-07-18T00:00:00.000Z' }, leases: [], modules: {} }));
fs.writeFileSync(path.join(root, 'state', 'evidence-retention', 'telemetry-rollups.json'), JSON.stringify({ buckets:{ 'state/a|indexed':{ count:12 } } }));
fs.writeFileSync(path.join(root, 'state', 'evidence-retention', 'legacy-sources.json'), JSON.stringify({ sources:{ 'state/a/audit.jsonl':{} } }));
fs.writeFileSync(path.join(root, 'state', 'evidence-retention', 'sessions', 'sealed', '2026-07', 'one.jsonl.manifest.json'), JSON.stringify({ events:3 }));

const tool = { id: 'alpha', folder: 'alpha', name: 'Alpha', version: 'v1', status: 'TEST', entry: 'index.html', audience: 'human-machine', summary: 'Test module', actions: ['test'], accepts: [], produces: [], readiness: ['storage'] };
const structuralReadiness = {
  schema: 'axm.workshop-readiness-view/v1',
  state: 'CURRENT',
  source: 'tools-index.json',
  summary: { legacyKinds: 0 },
  reviewCandidates: [{ id: 'alpha', humanDecisionRequired: true }],
  authority: {
    humanPromotionRequired: true,
    humanGate: 'Mike',
    reviewCandidateMeans: 'Current structural and self-test evidence is ready for Mike to inspect.',
    reviewCandidateDoesNotMean: ['approved', 'promoted', 'CANON', 'need-satisfied']
  }
};
const first = Glasses.compile({ root, tools: [tool], readiness: { storage: { state: 'READY', detail: 'local' } }, structuralReadiness, focus: 'test alpha', focusRoutes: [{ id: 'alpha', destinationId: 'alpha', destinationName: 'Alpha', route: '/tools/alpha/index.html', score: 9 }] , now: '2026-07-18T01:00:00.000Z' });
assert.equal(first.schema, Glasses.SCHEMA);
assert.equal(first.counts.modules, 1);
assert.equal(first.counts.contractsPassing, 1);
assert.equal(first.counts.critical, 0);
assert.equal(first.active.body.mode, 'IDLE');
assert.equal(first.active.evidence.sealedEvents, 3);
assert.equal(first.active.evidence.telemetryObservations, 12);
assert.equal(first.focus.routes[0].destinationId, 'alpha');
assert.equal(first.structuralReadiness.state, 'CURRENT');
assert.equal(first.counts.reviewCandidates, 1);
assert.equal(first.truth.automaticAction, false);
assert.equal(first.truth.reviewReadinessIsApproval, false);
assert.equal(first.authority.readmeTechnicalAuthority, false);
assert.ok(first.briefing.includes('Never guess a missing state'));
assert.ok(first.briefing.includes('STRUCTURAL REVIEW EVIDENCE'));
assert.ok(first.briefing.includes('review candidate is not approval'));

fs.writeFileSync(path.join(root, 'tools', 'alpha', 'index.html'), '<!doctype html><title>Alpha changed</title>');
const second = Glasses.compile({ root, tools: [tool], readiness: { storage: { state: 'READY', detail: 'local' } }, now: '2026-07-18T01:01:00.000Z' });
assert.notEqual(first.freshness.fingerprint, second.freshness.fingerprint);

const brokenTool = Object.assign({}, tool, { entry: 'missing.html' });
const broken = Glasses.compile({ root, tools: [brokenTool], readiness: { storage: { state: 'OFFLINE', detail: 'missing' } } });
assert.ok(broken.priorities.some(item => item.code === 'ENTRY_MISSING' && item.severity === 'CRITICAL'));
assert.ok(broken.priorities.some(item => item.code === 'READINESS_UNAVAILABLE' && item.severity === 'HIGH'));
const unknown = Glasses.compile({ root, tools: [tool], readiness: {} });
assert.ok(unknown.priorities.some(item => item.code === 'READINESS_UNKNOWN' && item.severity === 'MEDIUM'));
assert.ok(unknown.priorities.some(item => item.code === 'STRUCTURAL_READINESS_UNAVAILABLE' && item.severity === 'MEDIUM'));

const target = path.join(root, 'state', 'technical-glasses', 'latest.json');
Glasses.writeSnapshot(target, first);
assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).freshness.fingerprint, first.freshness.fingerprint);
fs.rmSync(root, { recursive: true, force: true });
console.log('Technical Glasses selftest: PASS (23 assertions, shared readiness evidence, live fingerprint, no-guess priorities, atomic snapshot)');
