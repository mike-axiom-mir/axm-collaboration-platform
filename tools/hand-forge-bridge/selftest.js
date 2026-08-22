#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Foundry = require('../hand-specification-foundry/hand-specification-core');
const Verification = require('../hand-verification-lab/hand-verification-core');
const Forge = require('../agent-tool-forge/forge-core');
const Zip = require('../agent-tool-forge/zip-store');
const Bridge = require('./hand-forge-bridge-core');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.equal(manifest.id, 'hand-forge-bridge');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
assert(contract.boundaries.refuses.includes('unbound-specification-and-plan'));
assert(contract.boundaries.refuses.includes('foundation-source-implicit-copy'));
assert(contract.boundaries.refuses.includes('automatic-install'));
assert(contract.boundaries.refuses.includes('automatic-canon'));

assert(/<html\b[^>]*\blang=/i.test(html));
assert(/name=["']viewport["']/i.test(html));
assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
['specificationInput', 'planInput', 'draftId', 'draftName', 'draftKind', 'draftRisk', 'capabilities']
  .forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
assert(css.includes(':focus-visible'));
assert(css.includes('min-height: 44px'));
assert(!/\sonclick\s*=/i.test(html));

const foundryExample = Foundry.example();
const specification = Foundry.buildSpecification(foundryExample.draft, '2026-07-28T21:00:00.000Z');
const plan = Verification.buildPlan(specification, '2026-07-28T21:05:00.000Z');
const suggested = Bridge.suggestConfig(specification);
assert.equal(suggested.id, 'evidence.archive.persist-v1');
assert.equal(suggested.kind, 'machine-capability');
assert.equal(suggested.risk, 'HIGH');
assert(suggested.capabilities.includes('gate'));
assert(suggested.capabilities.includes('storage'));
assert(suggested.capabilities.includes('files'));

const result = Bridge.build(specification, plan, suggested, '2026-07-28T21:10:00.000Z');
assert.equal(result.schema, 'axm.hand-forge-bridge-result/v1');
assert.equal(result.status, 'EXPERIMENTAL_REVIEW_PACKAGE');
assert.equal(result.package.schema, Forge.PACKAGE_SCHEMA);
assert.equal(result.package.draft.schema, Forge.SCHEMA);
assert.equal(result.package.draft.kind, 'machine-capability');
assert.equal(result.package.install.performed, false);
assert.equal(result.package.install.statusRequested, 'EXPERIMENTAL');
['manifest.json', 'index.html', 'README.md', 'draft.json', 'machine.js', 'hand-specification.json', 'verification-plan.json']
  .forEach(file => assert(Object.hasOwn(result.package.files, file), file + ' must be included'));
assert.equal(result.package.packageFingerprint, Forge.fingerprintFiles(result.package.files));
assert.notEqual(result.package.packageFingerprint, result.package.bridge.forgeOnlyPackageFingerprint);
assert.equal(JSON.parse(result.package.files['hand-specification.json']).capabilityId, specification.capabilityId);
assert.equal(JSON.parse(result.package.files['verification-plan.json']).target.specificationFingerprint, Verification.fingerprint(specification));

assert.equal(result.receipt.schema, 'axm.hand-forge-bridge-receipt/v1');
assert.equal(result.receipt.status, 'DRAFT_PACKAGE_PREPARED');
assert.equal(result.receipt.source.specificationFingerprint, Verification.fingerprint(specification));
assert.equal(result.receipt.output.forgePackageFingerprint, result.package.packageFingerprint);
assert.equal(result.receipt.output.fileCount, 7);
assert.equal(result.receipt.truth.sourceBound, true);
assert.equal(result.receipt.truth.sourceArtifactsIncluded, true);
assert.equal(result.receipt.truth.packagePrepared, true);
['installed', 'executed', 'authorityGranted', 'promoted', 'released', 'canon']
  .forEach(field => assert.equal(result.receipt.truth[field], false, field + ' must remain false'));

const repeated = Bridge.build(specification, plan, suggested, '2026-07-28T21:10:00.000Z');
assert.deepEqual(repeated, result, 'bridge output is deterministic with exact sources, config and timestamp');
const zipA = Zip.build(result.package.files, result.package.draft.id);
const zipB = Zip.build(repeated.package.files, repeated.package.draft.id);
assert.deepEqual(zipA, zipB, 'review ZIP bytes are deterministic');
assert.equal(zipA[0], 0x50);
assert.equal(zipA[1], 0x4b);

const alteredPlan = JSON.parse(JSON.stringify(plan));
alteredPlan.target.specificationFingerprint = 'fnv1a32:00000000';
assert.throws(() => Bridge.build(specification, alteredPlan, suggested), /not source-bound/);
const wrongTarget = JSON.parse(JSON.stringify(plan));
wrongTarget.target.capabilityId = 'other.capability/v1';
assert.throws(() => Bridge.build(specification, wrongTarget, suggested), /target does not match/);
const invalidPlan = JSON.parse(JSON.stringify(plan));
invalidPlan.cases.pop();
assert.throws(() => Bridge.build(specification, invalidPlan, suggested), /exactly ten/);
assert.throws(() => Bridge.build(specification, plan, Object.assign({}, suggested, { kind: 'foundation-tool' })), /Foundation-bearing routes/);
assert.throws(() => Bridge.build(specification, plan, Object.assign({}, suggested, { capabilities: ['gate', 'telepathy'] })), /unsupported Forge capability/);

const names = Bridge.downloadNames(result);
assert.equal(names.zip, 'evidence.archive.persist-v1-EXPERIMENTAL.zip');
assert(names.review.endsWith('-forge-review.json'));
assert(names.receipt.endsWith('-bridge-receipt.json'));
assert(app.includes('AXMZipStore'));
assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
assert(!app.includes('localStorage'));
assert(!app.includes('fetch('));

console.log('Hand Forge Bridge selftest: PASS');
