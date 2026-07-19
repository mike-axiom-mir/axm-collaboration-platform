'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Exam = require('../organs/reasoning-memory-guidance-exam-organ');
const Guidance = require('../organs/reasoning-memory-guidance-organ');
const Binding = require('../organs/reasoning-memory-feature-binding-organ');

test('current frozen exam improves contract-boundary transfer and preserves the real-local diversity hold', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-memory-guidance-exam-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const execution = Exam.run({ stateDir });
  const result = execution.result;
  assert.equal(result.state, 'TEST_CONTRACT_BOUNDARY_TRANSFER_IMPROVED_REAL_LOCAL_EVALUATOR_DIVERSITY_HOLD');
  assert.equal(result.summary.cases, 5);
  assert.equal(result.summary.passed, 5);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.normativeImprovements, 2);
  assert.equal(result.summary.heldMemoryOpportunities, 1);
  assert.equal(result.summary.realLocalOpportunityHolds, 1);
  assert.equal(result.summary.canariesPassed, result.summary.canaries);
  assert.equal(result.promotion.state, 'HOLD_REAL_LOCAL_EVALUATOR_DIVERSITY_AND_OUTSIDE_INDEPENDENT_EXAM');
  assert.equal(result.source.evaluatedGuidanceOrganId, Guidance.ORGAN_ID);
  assert.equal(result.source.evaluatedGuidanceSchema, Guidance.SCHEMA);
  assert.equal(result.source.evaluatedFeatureBindingOrganId, Binding.ORGAN_ID);
  assert.equal(result.source.evaluatedFeatureBindingSchema, Binding.SCHEMA);
  assert.equal(result.authority.activeRuntime, false);
  assert.equal(result.authority.decisionAuthority, false);
  assert.equal(Exam.verify(result), true);
});

test('permission, access-scope, and order canaries preserve their exact boundaries', () => {
  const result = Exam.evaluate();
  const permission = result.results.find(item => item.family === 'PERMISSION_CANARY');
  const access = result.results.find(item => item.family === 'ACCESS_SCOPE_CANARY');
  const order = result.results.find(item => item.family === 'ORDER_CANARY');
  assert.equal(permission.challengerSelectedActionId, 'shortcut');
  assert.equal(permission.guidance.adjustment, 12);
  assert.equal(permission.checks.noIneligibleSelection, true);
  assert.equal(access.guidance.state, 'NO_CONTEXT');
  assert.equal(access.guidance.adjustment, 0);
  assert.equal(order.challengerSelectedActionId, 'respect-boundary');
  assert.equal(order.normativeImprovement, true);
});

test('result digest and immutable directory refuse silent mutation', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-memory-guidance-exam-tamper-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const first = Exam.run({ stateDir });
  const second = Exam.run({ stateDir });
  assert.equal(second.reused, true);
  const changed = JSON.parse(JSON.stringify(first.result));
  changed.summary.normativeImprovements = 999;
  assert.throws(() => Exam.verify(changed), /digest mismatch/);
  const file = path.join(first.runDir, 'result.json');
  fs.appendFileSync(file, ' ');
  assert.throws(() => Exam.run({ stateDir }), /different bytes|Unexpected non-whitespace|JSON/);
});

test('pack and result contracts are present while outside independence remains unclaimed', () => {
  const root = path.resolve(__dirname, '..');
  const pack = Exam.loadPack(path.join(root, 'training', 'reasoning-memory-guidance-exam.json')).pack;
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'reasoning-memory-guidance-exam-result.schema.json'), 'utf8'));
  const runtime = fs.readFileSync(path.join(root, 'runtime', 'server.js'), 'utf8');
  assert.equal(pack.authorship.outsideAuthored, false);
  assert.equal(pack.authorship.candidateAuthoredExpectedOutcomes, false);
  assert.equal(contract.$id, Exam.SCHEMA);
  assert.equal(contract.additionalProperties, false);
  assert.equal(runtime.includes('reasoningMemory'), false);
  assert.equal(runtime.includes('reasoning-memory-guidance-exam-organ'), false);
});
