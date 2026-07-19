'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Principle = require('../kernel/principle-cell');
const Model = require('../learning/typed-trace-language-model');
const Evaluation = require('../organs/typed-trace-language-shadow-evaluation-organ');

const ROOT = path.resolve(__dirname, '..');

function base(overrides = {}) {
  return Object.assign({
    goal: 'Choose only from supplied bounded candidates.',
    evidence: [{ id: 'proof', kind: 'test', status: 'tested', statement: 'The bounded dry run passed.', source: { kind: 'test', id: 'shadow-evaluation' } }],
    unknowns: [], constraints: [], permissions: [],
    actions: [{ id: 'bounded', kind: 'proposal', label: 'Apply the bounded reversible change', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'Restore the checkpoint.' }]
  }, overrides);
}

function record(id, trace, overrides = {}) {
  return Object.assign({
    id,
    sourceGroupId: `shadow-group-${id}`,
    sourceKind: 'SYNTHETIC_FIXTURE',
    usePermission: 'allowed',
    permissionBasis: 'Bounded local test fixture for shadow evaluation.',
    trace
  }, overrides);
}

function sevenRecords() {
  return [
    record('supported-clear', Principle.reason(base())),
    record('supported-unknown', Principle.reason(base({ unknowns: [{ id: 'open-transfer', question: 'Does it transfer?', blocking: false }] }))),
    record('contradiction', Principle.reason(base({
      evidence: [
        { id: 'left', kind: 'test', status: 'tested', statement: 'Pass.', source: { kind: 'test', id: 'left' }, contradicts: ['right'] },
        { id: 'right', kind: 'test', status: 'contradicted', statement: 'Fail.', source: { kind: 'test', id: 'right' }, contradicts: ['left'] }
      ],
      actions: [{ id: 'bounded', kind: 'proposal', label: 'Use disputed result', supportingEvidence: ['left'], risk: 'low', reversible: true, recovery: 'Restore.' }]
    }))),
    record('missing-evidence', Principle.reason(base({ evidence: [], actions: [{ id: 'guess', kind: 'proposal', label: 'Guess', supportingEvidence: ['absent'], risk: 'low', reversible: true, recovery: 'Restore.' }] }))),
    record('repairability', Principle.reason(base({ actions: [{ id: 'irreversible', kind: 'proposal', label: 'Mutate without recovery', supportingEvidence: ['proof'], risk: 'low', reversible: false }] }))),
    record('explicit-hold', Principle.reason(base({ actions: [] }))),
    record('refuse-boundary', Principle.reason(base({ actions: [{ id: 'write', kind: 'proposal', label: 'Write outside scope', requiredPermissions: ['external-write'], supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'Restore.' }] })))
  ];
}

function syntheticModel(labels) {
  return Model.train(labels.map((label, index) => ({
    id: `model-${index}`, groupId: `model-group-${index}`, split: 'TRAIN', usePermission: 'allowed', permissionBasis: 'Test-only learned model.',
    features: { decision: 'SUPPORTED', unknowns: 'NONE', contradictions: 'NONE', boundaryViolation: 'NONE', missingEvidence: 'NONE', repairabilityGap: 'NONE' },
    expectedPlanId: label
  })));
}

test('append-only shadow evaluation preserves seven trace families and defeats fluent human-prose decoys', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-language-shadow-eval-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const sources = sevenRecords();
  const first = Evaluation.run(sources, { stateDir });
  assert.equal(first.reused, false);
  assert.equal(first.batch.state, 'NO_OBSERVED_LANGUAGE_SHADOW_DRIFT');
  assert.equal(first.batch.summary.recordsAssessed, 7);
  assert.equal(first.batch.summary.sourceGroupsAssessed, 7);
  assert.equal(first.batch.summary.acceptedShadowRenderings, 7);
  assert.equal(first.batch.summary.fallbackRenderings, 0);
  assert.equal(first.batch.summary.humanProseDecoyInvariantsPassed, 7);
  assert.equal(first.batch.summary.curriculumGapsProposed, 0);
  assert.equal(first.batch.summary.trainingAdmissions, 0);
  assert.equal(first.batch.summary.modelChanges, 0);
  assert.equal(first.batch.authority.activeHumanRendering, false);
  assert.equal(first.batch.authority.runtimePromotion, false);
  assert.ok(first.batch.results.every(item => item.response.fidelity.sourceHumanRenderingRead === false));
  Evaluation.verifyBatch(first.batch, first.runDir);

  const reversed = Evaluation.run(sources.slice().reverse(), { stateDir });
  assert.equal(reversed.reused, true);
  assert.equal(reversed.batch.batchId, first.batch.batchId);
  assert.equal(reversed.batch.batchDigest, first.batch.batchDigest);
});

test('poisoned or ambiguous learned plans become review-only curriculum gaps, never self-training', () => {
  const source = [record('drift-source', Principle.reason(base()))];
  const poisoned = Evaluation.buildBatch(source, { model: syntheticModel(['REFUSE_BOUNDARY', 'REFUSE_BOUNDARY', 'REFUSE_BOUNDARY']) });
  assert.equal(poisoned.state, 'OBSERVED_LANGUAGE_SHADOW_DRIFT_REQUIRES_REVIEW');
  assert.equal(poisoned.summary.learnedPlanContradictions, 1);
  assert.equal(poisoned.summary.curriculumGapsProposed, 1);
  assert.equal(poisoned.results[0].curriculumGap.authority.trainingAdmission, false);
  assert.equal(poisoned.results[0].curriculumGap.authority.automaticRetraining, false);
  assert.equal(poisoned.summary.automaticRetrainingRuns, 0);
  assert.equal(poisoned.summary.runtimePromotions, 0);

  const ambiguous = Evaluation.buildBatch(source, { model: syntheticModel(['SUPPORTED_BOUNDED_CLEAR', 'SUPPORTED_BOUNDED_UNCERTAIN']) });
  assert.equal(ambiguous.summary.learnedPlanUncertain, 1);
  assert.equal(ambiguous.summary.fallbackRenderings, 1);
  assert.equal(ambiguous.results[0].response.proposal, null);
});

test('permission, hidden reasoning, source-group separation, file tampering, and divergent reuse are refused', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-language-shadow-refusal-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const source = record('bounded-source', Principle.reason(base()));

  assert.throws(() => Evaluation.buildBatch([Object.assign({}, source, { usePermission: 'unknown' })]), /explicit evaluation permission/);
  assert.throws(() => Evaluation.buildBatch([Object.assign({}, source, { sourceGroupId: 'wisdom-train-01' })]), /entered training/);
  const hidden = JSON.parse(JSON.stringify(source));
  hidden.trace.hiddenReasoning = 'private';
  assert.throws(() => Evaluation.buildBatch([hidden]), /private hidden reasoning/);
  assert.throws(() => Evaluation.buildBatch([Object.assign({}, source, { newAuthority: true })]), /unknown critical/);

  const written = Evaluation.run([source], { stateDir });
  const resultFile = path.join(written.runDir, written.batch.files[0].path);
  fs.appendFileSync(resultFile, 'tamper', 'utf8');
  assert.throws(() => Evaluation.verifyBatch(written.batch, written.runDir), /result file changed/);
  assert.throws(() => Evaluation.run([source], { stateDir }), /result file changed/);
});

test('shadow evaluation contracts are present and the active artifact remains outside runtime', () => {
  for (const file of ['typed-trace-language-curriculum-gap.schema.json', 'typed-trace-language-shadow-evaluation-batch.schema.json']) {
    const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', file), 'utf8'));
    assert.ok(contract.$id);
  }
  const inputs = Evaluation.loadInputs();
  assert.equal(inputs.model.authority.runtimePromotion, false);
  assert.ok(inputs.trainingGroupIds.size > 0);
});

test('verified real receipt discovery grows from source type without a receipt fixture list', () => {
  const trace = Principle.reason(base());
  function wrapped(id, kind, permission = 'allowed') {
    return { receipt: {
      receiptId: id,
      source: { experienceKind: kind, sourceGroup: `receipt-group-${id}`, usePermission: permission, permissionBasis: 'Standing local typed-trace policy.' },
      admission: { state: 'APPROVED_PRIVATE_EPISODIC_TRAINING', semanticConsolidation: false },
      reasoningSession: { principleTrace: trace }
    } };
  }
  const records = Evaluation.recordsFromVerifiedReceipts([
    wrapped('legacy-real', undefined),
    wrapped('explicit-real', 'REAL_LOCAL_LESSON'),
    wrapped('synthetic', 'SYNTHETIC_COUNTEREXAMPLE'),
    wrapped('contract', 'CONTRACT_DERIVED_EXAM')
  ]);
  assert.deepEqual(records.map(item => item.id), ['legacy-real', 'explicit-real']);
  assert.ok(records.every(item => item.sourceKind === 'REAL_LOCAL_TRACE'));
  assert.throws(() => Evaluation.recordsFromVerifiedReceipts([wrapped('unpermitted-real', 'REAL_LOCAL_LESSON', 'unknown')]), /explicit shadow-evaluation permission/);
});
