#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Service = require('../../shared/cognitive-resource/cognitive-resource-service');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const relation = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'cognitive-resource', 'missing-provider-relation.json'), 'utf8'));
const api = fs.readFileSync(path.join(root, 'shared', 'operations', 'operations-api.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'hub', 'hub-shell.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const controls = Service.CONTROL_CATALOG;
const requiredProviders = ['codex-goal-completion-receipt/v1','local-hardware-process-meter/v1','declared-provider-compute-meter/v1','codex-goal-receipt-explicit-import/v1','workshop-server-process-window-meter/v1'];
const requiredControls = ['cognitive-stack-status','cognitive-goal-import','cognitive-local-meter-start','cognitive-local-meter-stop','cognitive-evidence-bundle','cognitive-explorer-open','cognitive-calibration-capture','human-attention-capture','sustainability-capture','mirror-intake-import','workshop-direction-open','workshop-direction-status','workshop-direction-preview','workshop-direction-commit','workshop-direction-lifecycle'];
const childModules = ['cognitive-evidence-explorer','cognitive-calibration-lab','human-attention-ledger','sustainability-metrology-lab','mirror-intake-monitor'];

assert.strictEqual(manifest.id, 'cognitive-resource-meter');
assert.strictEqual(manifest.status, 'TEST');
assert.strictEqual(contract.id, manifest.id);
assert.deepStrictEqual(contract.permissions, manifest.permissions);
assert.strictEqual(relation.status, 'RESOLVED_BY_TEST_MODULE');
assert.strictEqual(relation.resolution.moduleId, manifest.id);
assert.strictEqual(relation.existingOwnerReview.length, 4);
assert(relation.existingOwnerReview.every(item => item.compatible === false));
assert.strictEqual(Service.CATALOG.hands.length, 8);
assert.strictEqual(Service.CATALOG.contractBindings.length, 2);
assert(requiredProviders.every(id => Service.CATALOG.providers.some(item => item.id === id)));
assert.strictEqual(new Set(Service.CATALOG.providers.map(item => item.id)).size, Service.CATALOG.providers.length);
assert(Service.CATALOG.providers.every(item => item.automaticCapture === false));
assert(Service.CATALOG.providers.some(item => item.status === 'HOLD_UNBOUND_PROVIDER'));
assert(Object.values(Service.CATALOG.authority).every(value => value === false));
assert.strictEqual(controls.presentationOwner, 'workshop-command-center');
assert(requiredControls.every(id => controls.controls.some(item => item.id === id)));
assert.strictEqual(new Set(controls.controls.map(item => item.id)).size, controls.controls.length);
assert(controls.controls.every(item => item.automatic === false));
assert(Object.values(controls.authority).every(value => value === false));
assert(api.includes("'/api/cognitive-resource-meter/provider-run'"));
assert(api.includes("'/api/cognitive-resource-meter/economics-profile'"));
assert(api.includes("'/api/cognitive-resource-meter/export'"));
assert(api.includes("'/api/cognitive-resource-meter/goal-receipt/import'"));
assert(api.includes("'/api/cognitive-resource-meter/local-meter/start'"));
assert(api.includes("'/api/cognitive-resource-meter/local-meter/stop'"));
assert(api.includes("'/api/cognitive-resource-meter/vaults'"));
assert(api.includes("'/api/cognitive-resource-meter/timeline'"));
assert(api.includes("'/api/cognitive-resource-meter/bundle'"));
assert(api.includes("'/api/cognitive-resource-meter/command-center-controls'"));
assert(api.includes("'/api/cognitive-evidence-labs/calibration'"));
assert(api.includes("'/api/cognitive-evidence-labs/attention'"));
assert(api.includes("'/api/cognitive-evidence-labs/sustainability'"));
assert(api.includes("'/api/cognitive-evidence-labs/mirror-intake'"));
assert(api.includes("requirePermission('cognitive-resource-meter','cognitive.evidence.write')"));
assert(api.includes("requirePermission('cognitive-resource-meter','cognitive.measure.local')"));
assert(server.includes('/api/workshop-direction/compile') && server.includes('/api/workshop-direction/commit') && server.includes('/api/workshop-direction/status'));
assert(server.includes('explicit-compile') && server.includes('explicit-commit') && server.includes('explicit-status'));
assert(hub.includes("build: ['agent-tool-forge','browser-lan-hardware-qa-lab','cognitive-resource-meter'"));
assert(childModules.every(id => hub.includes("'" + id + "'")));
for (const id of childModules) {
  const childManifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', id, 'manifest.json'), 'utf8'));
  assert.strictEqual(childManifest.integratedInto, manifest.id);
  assert.strictEqual(childManifest.layer, 'machine');
}
assert(page.includes('TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER'));
assert(!JSON.stringify(Service.CATALOG).match(/[A-Za-z]:[\\/]/));
assert(contract.boundaries.refuses.includes('absolute-mirror-path'));
assert(contract.boundaries.refuses.includes('automatic-network-price-refresh'));
assert(contract.boundaries.refuses.includes('ranking'));
assert(contract.boundaries.refuses.includes('world-action'));

console.log('Cognitive Resource Meter discovery seam review: PASS · new owner relation proven · Hub Build route · API permission gate · 8 Hands · 2 digest-bound contracts · zero authority');
