'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Principle = require('../kernel/principle-cell');
const Model = require('../learning/typed-trace-language-model');
const Exam = require('../organs/typed-trace-language-independent-exam-organ');

const ROOT = path.resolve(__dirname, '..');
const NO_LOCAL_OVERLAP = { localEvaluationGroupIds: [] };

function base(overrides = {}) {
  return Object.assign({
    goal: 'Choose only from supplied bounded candidates.',
    evidence: [{ id: 'proof', kind: 'test', status: 'tested', statement: 'The bounded dry run passed.', source: { kind: 'test', id: 'independent-exam' } }],
    unknowns: [], constraints: [], permissions: [],
    actions: [{ id: 'bounded', kind: 'proposal', label: 'Apply the bounded reversible change', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'Restore the checkpoint.' }]
  }, overrides);
}

function traces() {
  return [
    Principle.reason(base()),
    Principle.reason(base({ unknowns: [{ id: 'open-transfer', question: 'Does it transfer?', blocking: false }] })),
    Principle.reason(base({
      evidence: [
        { id: 'left', kind: 'test', status: 'tested', statement: 'Pass.', source: { kind: 'test', id: 'left' }, contradicts: ['right'] },
        { id: 'right', kind: 'test', status: 'contradicted', statement: 'Fail.', source: { kind: 'test', id: 'right' }, contradicts: ['left'] }
      ],
      actions: [{ id: 'bounded', kind: 'proposal', label: 'Use disputed result', supportingEvidence: ['left'], risk: 'low', reversible: true, recovery: 'Restore.' }]
    })),
    Principle.reason(base({ evidence: [], actions: [{ id: 'guess', kind: 'proposal', label: 'Guess', supportingEvidence: ['absent'], risk: 'low', reversible: true, recovery: 'Restore.' }] })),
    Principle.reason(base({ actions: [{ id: 'irreversible', kind: 'proposal', label: 'Mutate without recovery', supportingEvidence: ['proof'], risk: 'low', reversible: false }] })),
    Principle.reason(base({ actions: [] })),
    Principle.reason(base({ actions: [{ id: 'write', kind: 'proposal', label: 'Write outside scope', requiredPermissions: ['external-write'], supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'Restore.' }] }))
  ];
}

function draft(selected = traces()) {
  return {
    schema: Exam.PACK_SCHEMA,
    usePermission: 'allowed',
    permissionBasis: 'The outside author explicitly permits bounded local shadow evaluation; no training permission is granted.',
    author: { id: 'outside-exam-author', kind: 'TEAM', relationshipToMirrorTrainingEffort: 'OUTSIDE_MODEL_AND_CORPUS_AUTHORING' },
    independence: {
      authoredOutsideModelAndCorpusEffort: true,
      modelWeightsUnavailableDuringAuthorship: true,
      modelPredictionsUnavailableDuringAuthorship: true,
      recordsFrozenBeforeFirstEvaluation: true,
      notDerivedFromMirrorLanguageCorpus: true,
      attestationBasis: 'Declared by the outside author and sealed before the first Mirror evaluation.'
    },
    frozenHeldOut: true,
    records: selected.map((trace, index) => ({ id: `outside-${index + 1}`, sourceGroupId: `outside-group-${index + 1}`, trace })),
    boundary: 'Declared-independent typed traces for shadow evaluation only. Authorship separation is asserted, not proven by Mirror.'
  };
}

function syntheticModel(labels) {
  return Model.train(labels.map((label, index) => ({
    id: `model-${index}`, groupId: `model-group-${index}`, split: 'TRAIN', usePermission: 'allowed', permissionBasis: 'Test-only learned model.',
    features: { decision: 'SUPPORTED', unknowns: 'NONE', contradictions: 'NONE', boundaryViolation: 'NONE', missingEvidence: 'NONE', repairabilityGap: 'NONE' },
    expectedPlanId: label
  })));
}

test('sealed outside pack covers every plan family and remains proposal-only', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-independent-language-exam-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const pack = Exam.sealPack(draft());
  Exam.assertSealedPack(pack, NO_LOCAL_OVERLAP);
  const first = Exam.run(pack, { stateDir, localEvaluationGroupIds: [] });
  assert.equal(first.reused, false);
  assert.equal(first.exam.state, 'DECLARED_INDEPENDENT_SHADOW_EXAM_PASSED');
  assert.equal(first.exam.coverage.fullRequiredPlanCoverage, true);
  assert.deepEqual(first.exam.coverage.observedPlanFamilies, Exam.REQUIRED_PLAN_FAMILIES);
  assert.equal(first.exam.evaluation.summary.acceptedShadowRenderings, 7);
  assert.equal(first.exam.evaluation.summary.humanProseDecoyInvariantsPassed, 7);
  assert.equal(first.exam.independence.cryptographicallyProven, false);
  assert.equal(first.exam.authority.independenceCertification, false);
  assert.equal(first.exam.authority.trainingAdmission, false);
  assert.equal(first.exam.authority.runtimePromotion, false);
  Exam.verifyExam(first.exam, pack, first.evaluation, first.runDir, { localEvaluationGroupIds: [] });

  const second = Exam.run(pack, { stateDir, localEvaluationGroupIds: [] });
  assert.equal(second.reused, true);
  assert.equal(second.exam.examDigest, first.exam.examDigest);
});

test('small outside pack remains insufficient and poisoned model opens review-only drift', () => {
  const small = Exam.sealPack(draft(traces().slice(0, 2)));
  const insufficient = Exam.buildExam(small, NO_LOCAL_OVERLAP);
  assert.equal(insufficient.exam.state, 'DECLARED_INDEPENDENT_EVIDENCE_INSUFFICIENT_COVERAGE');
  assert.ok(insufficient.exam.coverage.missingPlanFamilies.length > 0);
  assert.equal(insufficient.exam.authority.thresholdChange, false);

  const poisoned = syntheticModel(['REFUSE_BOUNDARY', 'REFUSE_BOUNDARY', 'REFUSE_BOUNDARY']);
  const drift = Exam.buildExam(Exam.sealPack(draft([traces()[0]])), { model: poisoned, localEvaluationGroupIds: [] });
  assert.equal(drift.exam.state, 'DECLARED_INDEPENDENT_SHADOW_DRIFT_REQUIRES_REVIEW');
  assert.equal(drift.exam.evaluation.summary.curriculumGapsProposed, 1);
  assert.equal(drift.exam.authority.automaticRetraining, false);
  assert.equal(drift.exam.authority.modelChange, false);
});

test('sealing and intake refuse fake separation, overlap, hidden reasoning, and mutable fields', () => {
  const falseClaim = draft();
  falseClaim.independence.modelPredictionsUnavailableDuringAuthorship = false;
  assert.throws(() => Exam.sealPack(falseClaim), /attestation is not declared/);

  const unknown = draft();
  unknown.autoPromote = true;
  assert.throws(() => Exam.sealPack(unknown), /fields changed/);

  const overlap = draft([traces()[0]]);
  overlap.records[0].sourceGroupId = 'wisdom-held-01';
  assert.throws(() => Exam.assertSealedPack(Exam.sealPack(overlap), NO_LOCAL_OVERLAP), /overlaps known Mirror evidence/);

  const localOverlap = draft([traces()[0]]);
  localOverlap.records[0].sourceGroupId = 'existing-local-evaluation-group';
  assert.throws(() => Exam.assertSealedPack(Exam.sealPack(localOverlap), { localEvaluationGroupIds: ['existing-local-evaluation-group'] }), /overlaps known Mirror evidence/);

  const hidden = draft([traces()[0]]);
  hidden.records[0].trace.privateReasoning = 'do not ingest';
  assert.throws(() => Exam.assertSealedPack(Exam.sealPack(hidden), NO_LOCAL_OVERLAP), /private hidden reasoning/);
});

test('sealed bytes and append-only exam evidence detect tampering', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-independent-language-tamper-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const pack = Exam.sealPack(draft());
  const changed = JSON.parse(JSON.stringify(pack));
  changed.records[0].trace.human = { summary: 'changed after sealing' };
  assert.throws(() => Exam.assertSealedPack(changed, NO_LOCAL_OVERLAP), /seal or canonical bytes changed/);

  const written = Exam.run(pack, { stateDir, localEvaluationGroupIds: [] });
  fs.appendFileSync(path.join(written.runDir, 'source-pack.json'), 'tamper', 'utf8');
  assert.throws(() => Exam.verifyExam(written.exam, pack, written.evaluation, written.runDir, { localEvaluationGroupIds: [] }), /evidence file changed/);
  assert.throws(() => Exam.run(pack, { stateDir, localEvaluationGroupIds: [] }), /Unexpected non-whitespace|JSON/);
});

test('independent exam contracts and command surfaces are present outside runtime', () => {
  for (const file of ['typed-trace-language-independent-pack.schema.json', 'typed-trace-language-independent-exam.schema.json']) {
    const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', file), 'utf8'));
    assert.ok(contract.$id);
  }
  for (const file of ['scripts/seal-typed-trace-language-independent-pack.js', 'scripts/run-typed-trace-language-independent-exam.js']) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true);
  }
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('typed-trace-language-independent-exam-organ'), false);
});
