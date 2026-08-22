#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Core = require('./workbench-core');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.equal(manifest.id, 'capability-gap-workbench');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
assert(contract.boundaries.refuses.includes('automatic-install'));
assert(contract.boundaries.refuses.includes('automatic-permission-grant'));
assert(contract.boundaries.refuses.includes('declaration-as-runtime-proof'));

assert(/<html\b[^>]*\blang=/i.test(html));
assert(/name=["']viewport["']/i.test(html));
assert(html.includes('for="requirementsInput"') && html.includes('for="inventoryInput"'));
assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
assert(html.includes('../../shared/ai-native-hands/capability-gap-hand.js'));
assert(css.includes(':focus-visible'));
assert(css.includes('min-height: 44px'));
assert(!/\sonclick\s*=/i.test(html));

const sample = Core.example();
const report = Core.analyze(sample.requirements, sample.inventory, '2026-07-28T18:00:00.000Z');
assert.equal(report.schema, 'axm.capability-gap-report/v1');
assert.equal(report.overall, 'DEGRADED');
assert.equal(report.requirements.length, 3);
assert.deepEqual(report.missingCapabilities, ['evidence.archive.persist/v1']);
assert.equal(report.proposedContracts[0].gapType, 'AUTHORITY');
assert(report.proposedContracts[0].requiredFields.includes('verification'));
assert.equal(report.automaticInstall, false);
assert.equal(report.automaticPermission, false);
assert.equal(report.automaticQualityReduction, false);
assert.equal(report.workbench.declarationsAreRuntimeProof, false);
assert.equal(report.workbench.generatedAt, '2026-07-28T18:00:00.000Z');

const blocked = Core.analyze(
  JSON.stringify([{ id: 'required-hand', capabilities: ['hand.missing'], required: true, gapType: 'HAND' }]),
  JSON.stringify([]),
  '2026-07-28T18:00:00.000Z'
);
assert.equal(blocked.overall, 'BLOCKED');
assert.equal(blocked.proposedContracts[0].contractState, 'SPEC_REQUIRED');

const unknown = Core.analyze(
  JSON.stringify({ requirements: [{ id: 'unknown-proof', capabilities: ['proof.live'], required: true }] }),
  JSON.stringify({ capabilities: [{ id: 'proof.live', status: 'unknown' }] }),
  '2026-07-28T18:00:00.000Z'
);
assert.equal(unknown.overall, 'UNKNOWN');
assert.deepEqual(Core.parseDocument('[{"id":"x"}]', 'requirements'), [{ id: 'x' }]);
assert.throws(() => Core.parseDocument('{}', 'requirements'), /requirements array/);
assert.throws(() => Core.analyze('not json', '[]'), /requirements JSON is invalid/);
assert(Core.downloadName(report.workbench.generatedAt).endsWith('.json'));

assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
assert(!app.includes('localStorage'));
assert(!app.includes('fetch('));

console.log('Capability Gap Workbench selftest: PASS');
