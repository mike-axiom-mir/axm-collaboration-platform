#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Foundry = require('../hand-specification-foundry/hand-specification-core');
const Core = require('./hand-verification-core');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.equal(manifest.id, 'hand-verification-lab');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
assert(contract.boundaries.refuses.includes('unevidenced-pass-as-proof'));
assert(contract.boundaries.refuses.includes('operator-declaration-as-independent-runtime-proof'));
assert(contract.boundaries.refuses.includes('automatic-canon'));

assert(/<html\b[^>]*\blang=/i.test(html));
assert(/name=["']viewport["']/i.test(html));
assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
assert(html.includes('for="specificationInput"'));
assert(css.includes(':focus-visible'));
assert(css.includes('min-height: 44px'));
assert(!/\sonclick\s*=/i.test(html));

const specification = Core.parseSpecification(JSON.stringify(Core.example()));
const plan = Core.buildPlan(specification, '2026-07-28T20:00:00.000Z');
assert.equal(plan.schema, 'axm.hand-verification-plan/v1');
assert.equal(plan.capability, 'capability.verify.missing-hand/v1');
assert.equal(plan.status, 'DRAFT_VERIFICATION_PLAN');
assert.equal(plan.cases.length, 10);
assert.deepEqual(plan.cases.map(testCase => testCase.family), [
  'CONTRACT_SCHEMA_IDENTITY',
  'POSITIVE_HAPPY_PATH',
  'MALFORMED_INPUT_REFUSAL',
  'PERMISSION_CONSENT_REFUSAL',
  'SIDE_EFFECT_CONFINEMENT',
  'RESOURCE_BUDGET_BOUNDARY',
  'FAILURE_RECOVERY',
  'COMPATIBILITY_MAJOR_VERSION',
  'EVIDENCE_COMPLETENESS',
  'PROMOTION_CANON_AUTHORITY_HOLD'
]);
assert.deepEqual(Core.validatePlan(plan), { pass: true, errors: [] });
assert.equal(plan.truth.executesTests, false);
assert.equal(plan.truth.runtimeProven, false);

const foundryExample = Foundry.example();
const foundrySpecification = Foundry.buildSpecification(foundryExample.draft, '2026-07-28T19:55:00.000Z');
const crossModulePlan = Core.buildPlan(foundrySpecification, '2026-07-28T20:00:00.000Z');
assert.equal(crossModulePlan.target.capabilityId, foundrySpecification.capabilityId);
assert.equal(crossModulePlan.target.specificationSchema, Foundry.SPEC_SCHEMA);
assert.deepEqual(Core.validatePlan(crossModulePlan), { pass: true, errors: [] });

const repeated = Core.buildPlan(specification, '2026-07-28T20:00:00.000Z');
assert.deepEqual(repeated, plan, 'plan generation is deterministic with an injected timestamp');

const emptyReceipt = Core.buildReceipt(plan, [], '2026-07-28T20:10:00.000Z');
assert.equal(emptyReceipt.summary.overall, 'UNKNOWN');
assert.equal(emptyReceipt.summary.counts.NOT_RUN, 10);

const unsupportedPass = Core.buildReceipt(plan, [{ caseId: 'verify-01', verdict: 'PASS' }], '2026-07-28T20:10:00.000Z');
assert.equal(unsupportedPass.records[0].requestedVerdict, 'PASS');
assert.equal(unsupportedPass.records[0].effectiveVerdict, 'UNKNOWN');
assert.match(unsupportedPass.records[0].downgradeReason, /requires both/);

const failure = Core.buildReceipt(plan, [{ caseId: 'verify-03', verdict: 'FAIL', observation: 'Malformed input mutated target state.' }], '2026-07-28T20:10:00.000Z');
assert.equal(failure.summary.overall, 'FAIL');

const evidenced = plan.cases.map(testCase => ({
  caseId: testCase.id,
  verdict: 'PASS',
  evidencePointer: 'receipt://' + testCase.id,
  observation: 'Bounded verifier observation for ' + testCase.family + '.'
}));
const allPass = Core.buildReceipt(plan, evidenced, '2026-07-28T20:10:00.000Z');
assert.equal(allPass.schema, 'axm.hand-verification-receipt/v1');
assert.equal(allPass.summary.overall, 'PASS');
assert.equal(allPass.summary.evidencedPasses, 10);
assert.equal(allPass.evidenceAuthority, 'DECLARED_BY_OPERATOR');
assert.equal(allPass.truth.operatorDeclarationOnly, true);
assert.equal(allPass.truth.independentVerification, false);
assert.equal(allPass.truth.runtimeProven, false);
['installed', 'authorityGranted', 'promoted', 'released', 'canon']
  .forEach(field => assert.equal(allPass.truth[field], false, field + ' must remain false'));

const badSpec = Core.example();
badSpec.truth.canon = true;
assert.throws(() => Core.parseSpecification(badSpec), /truth.canon/);
const badPlan = JSON.parse(JSON.stringify(plan));
badPlan.truth.promoted = true;
assert.equal(Core.validatePlan(badPlan).pass, false);
assert.throws(() => Core.parseSpecification('{}'), /schema must be/);
assert.throws(() => Core.buildReceipt(plan, [{ caseId: 'verify-99', verdict: 'PASS' }]), /unknown case/);
assert.throws(() => Core.buildReceipt(plan, [{ caseId: 'verify-01', verdict: 'YES' }]), /invalid verdict/);
assert(Core.downloadName(plan, 'plan').startsWith('axm-hand-verification-plan-evidence.archive.persist-v1'));
assert(Core.downloadName(allPass, 'receipt').startsWith('axm-hand-verification-receipt-evidence.archive.persist-v1'));

assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
assert(!app.includes('localStorage'));
assert(!app.includes('fetch('));

console.log('Hand Verification Lab selftest: PASS');
