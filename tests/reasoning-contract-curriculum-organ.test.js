'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const ContractCurriculum = require('../organs/reasoning-contract-curriculum-organ');
const Experience = require('../organs/reasoning-experience-organ');
const StrategyModel = require('../learning/reasoning-strategy-model');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-contract-curriculum-'));
  const workshopRoot = path.join(root, 'workshop');
  const stateDir = path.join(root, 'state', 'contract-curriculum');
  const directory = path.join(root, 'training', 'datasets', 'reasoning-receipts');
  fs.mkdirSync(path.join(workshopRoot, 'tools'), { recursive: true });
  const wanted = { PRIVATE_TRAINING: 3, HELD_OUT_EVALUATION: 2 };
  const ids = [];
  for (let index = 0; index < 200 && (wanted.PRIVATE_TRAINING || wanted.HELD_OUT_EVALUATION); index += 1) {
    const id = `fixture-module-${index}`;
    const partition = ContractCurriculum.partitionFor(id);
    if (!wanted[partition]) continue;
    wanted[partition] -= 1;
    ids.push({ id, partition });
    const moduleDir = path.join(workshopRoot, 'tools', id);
    fs.mkdirSync(moduleDir, { recursive: true });
    fs.writeFileSync(path.join(moduleDir, 'module.contract.json'), JSON.stringify({
      schema: 'axm.module-contract/v1',
      id,
      version: '1.0.0-test',
      provides: [],
      consumes: [],
      permissions: [],
      handoffs: [],
      boundaries: { writes: [], refuses: [`automatic-${id}-promotion`, `hidden-${id}-authority`] }
    }, null, 2) + '\n');
  }
  assert.equal(ids.length, 5);
  return { root, workshopRoot, stateDir, directory, ids };
}

test('typed contracts automatically become separated training and held-out boundary exams', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  const derived = ContractCurriculum.derive(options);
  assert.equal(derived.reused, false);
  assert.equal(derived.batch.summary.eligibleContracts, 5);
  assert.equal(derived.batch.summary.privateTrainingExams, 3);
  assert.equal(derived.batch.summary.heldOutEvaluationExams, 2);
  assert.equal(derived.batch.summary.boundaryPreserved, 5);
  assert.equal(derived.batch.summary.boundaryMismatches, 0);
  assert.equal(derived.batch.summary.receiptsAppended, 3);
  assert.equal(derived.batch.frontier.state, 'NO_UNEXPECTED_SEAM');
  assert.ok(derived.batch.results.filter(item => item.partition === 'HELD_OUT_EVALUATION').every(item => !item.reasoningExperienceReceiptId));

  const loaded = Experience.loadDirectory(options.directory);
  assert.equal(loaded.length, 3);
  assert.ok(loaded.every(item => item.receipt.schema === Experience.SCHEMA));
  assert.ok(loaded.every(item => item.receipt.source.experienceKind === 'CONTRACT_DERIVED_EXAM'));
  assert.ok(loaded.every(item => item.receipt.trainingExample.strategyTags.includes('respect-explicit-prohibition')));
  assert.ok(loaded.every(item => Experience.trainingEligibility(item.receipt).eligible));

  const model = StrategyModel.train([], { at: null, experienceReceipts: loaded.map(item => item.receipt) });
  assert.equal(model.training.admittedContractDerivedExams, 3);
  assert.equal(model.sequences['respect-explicit-prohibition'].prototype.kind, 'hold');
  const evaluated = ContractCurriculum.evaluateHeldOut(derived, model, options);
  assert.equal(evaluated.evaluation.summary.heldOutContracts, 2);
  assert.equal(evaluated.evaluation.summary.noModelOriginatedCandidates, 0);
  assert.equal(evaluated.evaluation.summary.challengerPassed, 2);
  assert.equal(evaluated.evaluation.summary.challengerFailed, 0);
  assert.equal(evaluated.evaluation.summary.trainingReceiptsCreated, 0);
  assert.equal(evaluated.evaluation.splitLeakage, false);
  assert.ok(evaluated.evaluation.results.every(item => item.originatedCandidateKinds.every(kind => kind === 'hold')));
  assert.ok(evaluated.evaluation.results.every(item => item.observableStrategyTags.includes('respect-explicit-prohibition')));
  assert.equal(ContractCurriculum.evaluateHeldOut(derived, model, options).reused, true);
  assert.equal(ContractCurriculum.derive(options).reused, true);
});

test('invalid contracts stay visible and held-out exams never become receipts', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  const badDir = path.join(options.workshopRoot, 'tools', 'bad-id');
  const templateDir = path.join(options.workshopRoot, 'tools', '_module-template');
  fs.mkdirSync(badDir, { recursive: true });
  fs.mkdirSync(templateDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'module.contract.json'), JSON.stringify({ schema: 'axm.module-contract/v1', id: 'different-id', boundaries: { refuses: ['unsafe'] } }));
  fs.writeFileSync(path.join(templateDir, 'module.contract.json'), JSON.stringify({ schema: 'axm.module-contract/v1', id: 'CHANGE-ME', boundaries: { refuses: ['unsafe'] } }));
  const derived = ContractCurriculum.derive(options);
  assert.equal(derived.batch.summary.refusedOrExcludedContracts, 2);
  assert.deepEqual(derived.batch.refusedContracts.map(item => item.state).sort(), ['EXCLUDED_TEMPLATE', 'REFUSED_UNTYPED_OR_MISMATCHED_CONTRACT']);
  const training = derived.batch.results.filter(item => item.partition === 'PRIVATE_TRAINING').length;
  assert.equal(Experience.loadDirectory(options.directory).length, training);
});

test('session tampering is detected instead of silently reusing contract evidence', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  const derived = ContractCurriculum.derive(options);
  const target = path.join(derived.runDir, derived.batch.results[0].sessionFile);
  fs.appendFileSync(target, ' ');
  assert.throws(() => ContractCurriculum.derive(options), /session hash mismatch/);
});
