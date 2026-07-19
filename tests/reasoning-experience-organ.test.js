'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Cycle = require('../training/reasoning-skill-cycle');
const Experience = require('../organs/reasoning-experience-organ');
const StrategyModel = require('../learning/reasoning-strategy-model');

function verifiedExperienceSession() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'training', 'reasoning-strategy-train.json'), 'utf8'));
  const row = JSON.parse(JSON.stringify(fixture.cases[0]));
  row.caseId = 'experience-blocking-unknown';
  row.sourceGroup = 'experience/blocking-unknown/independent-one';
  return Cycle.buildVerifiedSession(row, {
    sha256: 'b'.repeat(64),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned reasoning experience' }
  }, { at: null });
}

function source() {
  return {
    provider: 'axm-workshop-local',
    sourceGroup: 'experience/blocking-unknown/independent-one',
    role: 'training',
    policyId: 'axm.mirror.standing-local-practice/v1',
    usePermission: 'allowed',
    permissionBasis: 'test-owned local Workshop reasoning experience',
    evaluator: { id: 'evaluator/experience-one', kind: 'frozen-test-evaluator', independent: true, sourceRef: 'test://reasoning-experience/one', sourceDigest: 'd'.repeat(64) }
  };
}

function evaluation(session, overrides = {}) {
  return Object.assign({
    observedDecisionValue: session.principleTrace.decision.value,
    observedActionId: session.principleTrace.decision.selectedActionId,
    expectedDecisionValue: session.principleTrace.decision.value,
    expectedActionId: session.principleTrace.decision.selectedActionId,
    behaviorMatched: true,
    outcomeVerified: true,
    statement: 'The independent fixture evaluator observed the expected bounded behavior.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, overrides);
}

test('experience organ appends an eligible deterministic receipt and the next cycle discovers it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reasoning-experience-'));
  const receiptDir = path.join(root, 'training', 'datasets', 'reasoning-receipts');
  const stateDir = path.join(root, 'state', 'reasoning-skill-runs');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const session = verifiedExperienceSession();
  const receipt = Experience.create(session, source(), evaluation(session), { at: null });
  assert.equal(Experience.verify(receipt), true);
  assert.deepEqual(receipt.trainingExample.strategyTags, ['ask-blocking-unknown']);
  assert.equal(receipt.trainingExample.semanticConsolidation, false);
  const stored = Experience.store(receipt, { root, directory: receiptDir });
  assert.equal(stored.state, 'APPENDED_PRIVATE_TRAINING_RECEIPT');
  assert.equal(Experience.store(receipt, { root, directory: receiptDir }).state, 'REUSED_EQUIVALENT_SOURCE_GROUP_RECEIPT');
  const samePolicy = source();
  samePolicy.permissionBasis = 'A different human rendering of the same authenticated standing policy.';
  const proseVariant = Experience.create(session, samePolicy, evaluation(session), { at: null });
  assert.notEqual(proseVariant.receiptId, receipt.receiptId);
  assert.equal(Experience.store(proseVariant, { root, directory: receiptDir }).state, 'REUSED_EQUIVALENT_SOURCE_GROUP_RECEIPT');

  const result = Cycle.run({ stateDir, reasoningReceiptsDir: receiptDir });
  assert.equal(result.cycle.corpus.privateReasoningExperienceReceiptCount, 1);
  assert.equal(result.cycle.corpus.admittedVerifiedSessions, 13);
  assert.equal(result.cycle.evaluation.challenger.passed, 12);
  assert.equal(result.cycle.evaluation.origination.challenger.passed, 12);
  assert.equal(result.cycle.evaluation.canaries.find(item => item.id === 'experience-self-training-closed').status, 'PASS');
  assert.equal(result.cycle.authority.activeRuntime, false);
});

test('experience organ refuses learned self-training and non-independent evaluation', () => {
  const learned = verifiedExperienceSession();
  learned.cell.learnedWeights = true;
  learned.cell.status = 'PRIVATE_CHALLENGER';
  assert.throws(() => Experience.create(learned, source(), evaluation(learned)), /self-training/);

  const ownEvaluator = source();
  ownEvaluator.evaluator.id = 'axm.machine.mirror/seed-0';
  const independentSession = verifiedExperienceSession();
  assert.throws(() => Experience.create(independentSession, ownEvaluator, evaluation(independentSession)), /cannot be the learner/);

  const outsidePolicy = source();
  outsidePolicy.provider = 'unreviewed-provider';
  assert.throws(() => Experience.create(independentSession, outsidePolicy, evaluation(independentSession)), /standing local Workshop policy/);

  const undigested = source();
  delete undigested.evaluator.sourceDigest;
  assert.throws(() => Experience.create(independentSession, undigested, evaluation(independentSession)), /content digest/);
});

test('experience receipt tampering and hidden reasoning are refused', () => {
  const session = verifiedExperienceSession();
  const receipt = Experience.create(session, source(), evaluation(session), { at: null });
  const changed = JSON.parse(JSON.stringify(receipt));
  changed.reasoningSession.pathSet.selectedActionId = 'tampered';
  assert.throws(() => Experience.verify(changed), /digest mismatch/);
  const hidden = source();
  hidden.hidden_reasoning = 'do not admit this';
  assert.throws(() => Experience.create(session, hidden, evaluation(session)), /private reasoning field refused/);
});

test('a verified mismatch becomes negative episodic evidence, not a success prototype', () => {
  const session = verifiedExperienceSession();
  const receipt = Experience.create(session, Object.assign(source(), { sourceGroup: 'experience/negative/independent-two' }), evaluation(session, {
    expectedActionId: 'different-expected-action',
    behaviorMatched: false,
    strategyTags: ['tempting-shortcut'],
    statement: 'The observed decision did not match the independent expected action.'
  }), { at: null });
  assert.equal(receipt.evaluation.result, 'DID_NOT_WORK');
  assert.equal(receipt.trainingExample.evidenceRole, 'NEGATIVE_EPISODIC_EXAMPLE');
  assert.equal(receipt.trainingExample.prototype, null);
  assert.equal(receipt.admission.semanticConsolidation, false);
  assert.equal(Experience.verify(receipt), true);
});

test('negative experience lowers matching strategy support and remains separate from positive prototypes', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'training', 'reasoning-strategy-train.json'), 'utf8'));
  const trainingFixture = { sha256: 'f'.repeat(64), value: { usePermission: 'allowed', permissionBasis: 'negative-evidence model test' } };
  const blocking = Cycle.buildVerifiedSession(fixture.cases[0], trainingFixture, { at: null });
  const conflict = Cycle.buildVerifiedSession(fixture.cases[2], trainingFixture, { at: null });
  const negativeReceipt = Experience.create(blocking, Object.assign(source(), { sourceGroup: 'experience/negative/ask-blocking' }), evaluation(blocking, {
    expectedActionId: 'independent-repair-path',
    behaviorMatched: false,
    strategyTags: ['ask-blocking-unknown']
  }), { at: null });
  const baseline = StrategyModel.train([blocking, conflict], { at: null });
  const learned = StrategyModel.train([blocking, conflict], { at: null, experienceReceipts: [negativeReceipt] });
  const features = StrategyModel.extractFeatures(blocking);
  const before = StrategyModel.predict(baseline, features).rankings.find(item => item.strategyTag === 'ask-blocking-unknown');
  const after = StrategyModel.predict(learned, features).rankings.find(item => item.strategyTag === 'ask-blocking-unknown');
  assert.equal(learned.training.admittedNegativeExperiences, 1);
  assert.equal(learned.negativeLabels['ask-blocking-unknown'].examples, 1);
  assert.equal(after.negativeEvidenceExamples, 1);
  assert.ok(after.support < before.support);
  assert.ok(learned.labels['ask-blocking-unknown'].prototype);
});
