'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Foundation = require('../kernel/reasoning-foundation');
const Experience = require('../organs/reasoning-experience-organ');
const Counterexamples = require('../organs/reasoning-counterexample-organ');
const Cycle = require('../training/reasoning-skill-cycle');

function realPassingReceipt() {
  const session = Foundation.run({
    sessionId: 'counterexample-real-parent',
    goal: 'Judge one permissioned reversible proposal with required evidence.',
    evidence: [{ id: 'present-evidence', kind: 'test', status: 'tested', statement: 'The bounded precondition is present.', source: { kind: 'test', id: 'parent' } }],
    unknowns: [],
    permissions: ['counterexample:write'],
    constraints: [],
    actions: [{
      id: 'bounded-parent-action', kind: 'write', label: 'Apply a bounded reversible proposal',
      requiredPermissions: ['counterexample:write'], supportingEvidence: ['present-evidence'], preconditionEvidence: ['present-evidence'],
      expectedEffects: ['A private proposal is represented.'], possibleSideEffects: [], reversible: true, recovery: 'Restore the private checkpoint.', risk: 'low'
    }]
  }, { at: null });
  return Experience.create(session, {
    provider: 'axm-workshop-local',
    sourceGroup: 'test-real-counterexample-parent/v1',
    experienceKind: 'REAL_LOCAL_LESSON',
    parentReceiptIds: [],
    interventionId: null,
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'Test-owned local receipt permits bounded private counterexample practice.',
    evaluator: { id: 'test-parent-evaluator', kind: 'test-evaluator', independent: true, sourceRef: 'test://counterexample-parent', sourceDigest: 'a'.repeat(64) }
  }, {
    observedDecisionValue: 1,
    observedActionId: 'bounded-parent-action',
    expectedDecisionValue: 1,
    expectedActionId: 'bounded-parent-action',
    behaviorMatched: true,
    outcomeVerified: true,
    statement: 'The real local parent produced the expected bounded decision.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
}

function tempLayout(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reasoning-counterexamples-'));
  const directory = path.join(root, 'training', 'datasets', 'reasoning-receipts');
  const stateDir = path.join(root, 'state', 'reasoning-counterexample-runs');
  fs.mkdirSync(directory, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, directory, stateDir };
}

test('counterexample organ derives parent-linked synthetic safeguards and never recurses', t => {
  const layout = tempLayout(t);
  const parent = realPassingReceipt();
  Experience.store(parent, layout);
  const first = Counterexamples.run(layout);
  assert.equal(first.reused, false);
  assert.equal(first.batch.summary.sourceReceiptCount, 1);
  assert.equal(first.batch.summary.interventions, 3);
  assert.equal(first.batch.summary.worked, 3);
  assert.equal(first.batch.summary.didNotWork, 0);
  assert.equal(Counterexamples.verifyBatch(first.batch), true);
  const loaded = Experience.loadDirectory(layout.directory);
  assert.equal(loaded.length, 4);
  const synthetic = loaded.filter(item => item.receipt.source.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE');
  assert.equal(synthetic.length, 3);
  for (const item of synthetic) {
    assert.deepEqual(item.receipt.source.parentReceiptIds, [parent.receiptId]);
    assert.ok(item.receipt.source.interventionId);
    assert.equal(item.receipt.trainingExample.semanticConsolidation, false);
    assert.equal(item.receipt.authority.worldAction, false);
    assert.equal(item.receipt.authority.heldOutMutation, false);
  }
  const second = Counterexamples.run(layout);
  assert.equal(second.reused, true);
  assert.equal(Experience.loadDirectory(layout.directory).length, 4);

  const cycle = Cycle.run({ reasoningReceiptsDir: layout.directory, stateDir: path.join(layout.root, 'state', 'reasoning-skill-runs') });
  assert.equal(cycle.cycle.corpus.realLocalReasoningExperienceReceiptCount, 1);
  assert.equal(cycle.cycle.corpus.syntheticCounterexampleReceiptCount, 3);
  assert.equal(cycle.cycle.evaluation.canaries.find(item => item.id === 'synthetic-counterexample-lineage').status, 'PASS');
  assert.equal(cycle.cycle.authority.activeRuntime, false);
  fs.unlinkSync(synthetic[0].file);
  assert.throws(() => Counterexamples.run(layout), /batch receipt is missing or changed/);
});

test('counterexample mismatch becomes negative synthetic evidence without a prototype', t => {
  const layout = tempLayout(t);
  const parent = realPassingReceipt();
  Experience.store(parent, layout);
  const result = Counterexamples.execute(parent, {
    id: 'deliberately-wrong-independent-expectation',
    description: 'Test the negative evidence path with an independently wrong expected refusal.',
    expectedValue: -1,
    expectedActionId: 'bounded-parent-action',
    transform(request) { return request; }
  }, 'Test-owned counterexample permission.', layout);
  assert.equal(result.behaviorMatched, false);
  assert.equal(result.outcome, 'DID_NOT_WORK');
  const receipt = Experience.loadDirectory(layout.directory).find(item => item.receipt.receiptId === result.receiptId).receipt;
  assert.equal(receipt.source.experienceKind, 'SYNTHETIC_COUNTEREXAMPLE');
  assert.equal(receipt.trainingExample.evidenceRole, 'NEGATIVE_EPISODIC_EXAMPLE');
  assert.equal(receipt.trainingExample.prototype, null);
  assert.equal(receipt.admission.semanticConsolidation, false);
});

test('known-fail counterexample v1 receipts remain stored but are excluded from training', t => {
  const layout = tempLayout(t);
  const parent = realPassingReceipt();
  Experience.store(parent, layout);
  Counterexamples.run(layout);
  const current = Experience.loadDirectory(layout.directory).find(item => item.receipt.source.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').receipt;
  const knownFail = JSON.parse(JSON.stringify(current));
  knownFail.source.sourceGroup = `known-fail/${current.receiptId}/v1`;
  knownFail.source.evaluator.id = `${Counterexamples.SUPERSEDED_ORGAN_ID}/evaluator`;
  knownFail.source.evaluator.sourceRef = `known-fail://${current.receiptId}`;
  knownFail.receiptId = `reasoning-experience-${Experience.digest({ source: knownFail.source, evaluation: knownFail.evaluation, trainingExample: knownFail.trainingExample }).slice(0, 24)}`;
  delete knownFail.receiptDigest;
  knownFail.receiptDigest = Experience.digest(knownFail);
  assert.equal(Experience.verify(knownFail), true);
  assert.equal(Experience.trainingEligibility(knownFail).state, 'KNOWN_FAIL_SUPERSEDED');
  Experience.store(knownFail, layout);
  const cycle = Cycle.run({ reasoningReceiptsDir: layout.directory, stateDir: path.join(layout.root, 'state', 'reviewed-reasoning-runs') });
  assert.equal(cycle.cycle.corpus.discoveredReasoningExperienceReceiptCount, 5);
  assert.equal(cycle.cycle.corpus.privateReasoningExperienceReceiptCount, 4);
  assert.equal(cycle.cycle.corpus.excludedReasoningExperienceReceipts.length, 1);
  assert.equal(cycle.cycle.corpus.excludedReasoningExperienceReceipts[0].preserved, true);
  assert.equal(cycle.cycle.evaluation.canaries.find(item => item.id === 'known-failed-experience-excluded').status, 'PASS');
  assert.equal(fs.existsSync(path.join(layout.directory, `${knownFail.receiptId}.json`)), true);
});

test('v3 requires explicit synthetic lineage and verifies immutable v2 receipts', () => {
  const parent = realPassingReceipt();
  const badSource = Object.assign({}, parent.source, {
    sourceGroup: 'bad-synthetic-lineage',
    experienceKind: 'SYNTHETIC_COUNTEREXAMPLE',
    parentReceiptIds: [],
    interventionId: null
  });
  assert.throws(() => Experience.create(parent.reasoningSession, badSource, {
    observedDecisionValue: 1, observedActionId: 'bounded-parent-action', expectedDecisionValue: 1, expectedActionId: 'bounded-parent-action',
    behaviorMatched: true, outcomeVerified: true, worldMutations: 0, runtimePointerChanged: false, unexpectedSeams: []
  }), /requires one parent receipt/);

  const legacy = JSON.parse(JSON.stringify(parent));
  legacy.schema = Experience.LEGACY_SCHEMA;
  legacy.organ.id = Experience.LEGACY_ORGAN_ID;
  delete legacy.source.experienceKind;
  delete legacy.source.parentReceiptIds;
  delete legacy.source.interventionId;
  legacy.receiptId = `reasoning-experience-${Experience.digest({ source: legacy.source, evaluation: legacy.evaluation, trainingExample: legacy.trainingExample }).slice(0, 24)}`;
  delete legacy.receiptDigest;
  legacy.receiptDigest = Experience.digest(legacy);
  assert.equal(Experience.verify(legacy), true);
});
