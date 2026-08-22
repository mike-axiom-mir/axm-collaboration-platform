#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Core = require('./hand-specification-core');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.equal(manifest.id, 'hand-specification-foundry');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
assert(contract.boundaries.refuses.includes('prototype-as-gap-closure'));
assert(contract.boundaries.refuses.includes('automatic-hand-implementation'));
assert(contract.boundaries.refuses.includes('automatic-canon'));

assert(/<html\b[^>]*\blang=/i.test(html));
assert(/name=["']viewport["']/i.test(html));
assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
[
  'gapReportInput', 'candidateSelect', 'capabilityId', 'gapType', 'sourceRequirementIds', 'purpose',
  'inputsAndSchemas', 'outputsAndSchemas', 'sideEffects', 'permissionsAndConsent', 'resourceBudget',
  'failureAndRecovery', 'compatibilityVersionContract', 'verificationContract', 'promotionGate'
].forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
assert(css.includes(':focus-visible'));
assert(css.includes('min-height: 44px'));
assert(!/\sonclick\s*=/i.test(html));

const sample = Core.example();
const parsed = Core.parseGapReport(JSON.stringify(sample.report));
const candidates = Core.listCandidates(parsed);
assert.equal(candidates.length, 1);
assert.equal(candidates[0].capabilityId, 'evidence.archive.persist/v1');
const seed = Core.seedFromGapReport(parsed, candidates[0].capabilityId);
assert.equal(seed.gapType, 'AUTHORITY');
assert.deepEqual(seed.sourceRequirementIds, ['durable-evidence-archive']);
assert.equal(Core.validateDraft(seed).pass, false, 'unfilled seed remains honestly incomplete');

const specification = Core.buildSpecification(sample.draft, '2026-07-28T19:00:00.000Z');
assert.equal(specification.schema, 'axm.missing-hand-specification/v1');
assert.equal(specification.capability, 'capability.specify.missing-hand/v1');
assert.equal(specification.status, 'DRAFT');
assert.equal(specification.gapType, 'AUTHORITY');
assert.equal(specification.provenance.generatedAt, '2026-07-28T19:00:00.000Z');
assert.equal(specification.truth.implementationNeutral, true);
['installed', 'executed', 'authorityGranted', 'promoted', 'canon', 'prototypeOrMockClosesGap']
  .forEach(field => assert.equal(specification.truth[field], false, field + ' must remain false'));
assert.deepEqual(Core.validateSpecification(specification), { pass: true, errors: [] });

const badTruth = JSON.parse(JSON.stringify(specification));
badTruth.truth.promoted = true;
assert.equal(Core.validateSpecification(badTruth).pass, false);
assert.throws(() => Core.parseGapReport('{}'), /schema must be/);
assert.throws(() => Core.seedFromGapReport(parsed, 'missing'), /not present/);
assert.throws(() => Core.buildSpecification(Object.assign({}, sample.draft, { verificationContract: '' })), /verificationContract/);
assert(Core.downloadName(specification).startsWith('axm-missing-hand-evidence.archive.persist-v1'));

assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
assert(!app.includes('localStorage'));
assert(!app.includes('fetch('));

console.log('Hand Specification Foundry selftest: PASS');
