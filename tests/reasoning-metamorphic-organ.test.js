'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Foundation = require('../kernel/reasoning-foundation');
const Experience = require('../organs/reasoning-experience-organ');
const Metamorphic = require('../organs/reasoning-metamorphic-organ');

function realPassingReceipt(sourceGroup = 'test-real-metamorphic-parent/v1') {
  const session = Foundation.run({
    sessionId: `metamorphic-parent-${sourceGroup}`,
    goal: 'Judge one permissioned reversible proposal with required evidence.',
    evidence: [{ id: 'present-evidence', kind: 'test', status: 'tested', statement: 'The bounded precondition is present.', source: { kind: 'test', id: sourceGroup } }],
    unknowns: [],
    permissions: ['metamorphic:write'],
    constraints: [],
    actions: [{
      id: 'bounded-metamorphic-action', kind: 'write', label: 'Apply a bounded reversible proposal',
      requiredPermissions: ['metamorphic:write'], supportingEvidence: ['present-evidence'], preconditionEvidence: ['present-evidence'],
      expectedEffects: ['A private proposal is represented.'], possibleSideEffects: [], reversible: true, recovery: 'Restore the private checkpoint.', risk: 'low'
    }]
  }, { at: null });
  return Experience.create(session, {
    provider: 'axm-workshop-local',
    sourceGroup,
    experienceKind: 'REAL_LOCAL_LESSON',
    parentReceiptIds: [],
    interventionId: null,
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'Test-owned real local receipt permits private metamorphic evaluation.',
    evaluator: { id: `test-metamorphic-parent-evaluator-${Experience.digest(sourceGroup).slice(0, 8)}`, kind: 'test-evaluator', independent: true, sourceRef: `test://${sourceGroup}`, sourceDigest: Experience.digest({ sourceGroup }) }
  }, {
    observedDecisionValue: 1,
    observedActionId: 'bounded-metamorphic-action',
    expectedDecisionValue: 1,
    expectedActionId: 'bounded-metamorphic-action',
    behaviorMatched: true,
    outcomeVerified: true,
    statement: 'The real local parent produced the expected bounded decision.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
}

function tempLayout(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reasoning-metamorphic-'));
  const directory = path.join(root, 'training', 'datasets', 'reasoning-receipts');
  const stateDir = path.join(root, 'state', 'reasoning-metamorphic-runs');
  fs.mkdirSync(directory, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, directory, stateDir };
}

test('metamorphic organ keeps confirmed invariants as evaluation traces rather than training examples', t => {
  const layout = tempLayout(t);
  const parent = realPassingReceipt();
  Experience.store(parent, layout);
  const first = Metamorphic.run(layout);
  assert.equal(first.reused, false);
  assert.equal(first.batch.summary.sourceReceiptCount, 1);
  assert.equal(first.batch.summary.probes, 10);
  assert.equal(first.batch.summary.atomicProbes, 4);
  assert.equal(first.batch.summary.composedProbes, 6);
  assert.equal(first.batch.summary.maximumCompositionDepth, 2);
  assert.equal(first.batch.summary.invariantConfirmed, 10);
  assert.equal(first.batch.summary.counterexamplesFound, 0);
  assert.equal(first.batch.summary.positiveTrainingReceiptsCreated, 0);
  assert.equal(first.batch.frontier.state, 'NO_UNEXPECTED_SEAM');
  assert.equal(Experience.loadDirectory(layout.directory).length, 1);
  for (const result of first.batch.results) {
    assert.equal(result.experienceStorageState, 'EVALUATION_ONLY_NO_TRAINING_RECEIPT');
    assert.equal(result.negativeExperienceReceiptId, null);
    assert.equal(fs.existsSync(path.join(first.runDir, result.sessionFile)), true);
  }
  assert.equal(Metamorphic.verifyBatch(first.batch, first.runDir), true);
  const second = Metamorphic.run(layout);
  assert.equal(second.reused, true);
  assert.equal(Experience.loadDirectory(layout.directory).length, 1);
});

test('a metamorphic mismatch becomes negative evidence and repeated independent gaps only open a Frontier exam', t => {
  const layout = tempLayout(t);
  const parent = realPassingReceipt();
  Experience.store(parent, layout);
  const execution = Metamorphic.execute(parent, {
    id: 'deliberate-invariance-violation',
    relation: 'DECISION_INVARIANT',
    description: 'Exercise mismatch storage by removing a permission while declaring an invariance relation.',
    mutatedPaths: ['permissions[]'],
    transform(request) { request.permissions = []; return request; }
  }, 'Test-owned metamorphic mismatch permission.', layout);
  assert.equal(execution.result.behaviorMatched, false);
  assert.equal(execution.result.state, 'COUNTEREXAMPLE_FOUND');
  const receipt = Experience.loadDirectory(layout.directory).find(item => item.receipt.receiptId === execution.result.negativeExperienceReceiptId).receipt;
  assert.equal(receipt.trainingExample.outcome, 'DID_NOT_WORK');
  assert.equal(receipt.trainingExample.prototype, null);
  assert.equal(receipt.trainingExample.evidenceRole, 'NEGATIVE_EPISODIC_EXAMPLE');
  assert.equal(receipt.source.experienceKind, 'SYNTHETIC_COUNTEREXAMPLE');
  assert.equal(receipt.authority.semanticTruthWrite, false);

  const base = Object.assign({}, execution.result, { sessionSha256: 'a'.repeat(64) });
  const repeated = Metamorphic.frontierFor([
    Object.assign({}, base, { parentSourceGroup: 'independent/domain-one/v1', reasoningSessionId: 'reasoning-gap-one' }),
    Object.assign({}, base, { parentSourceGroup: 'independent/domain-two/v1', reasoningSessionId: 'reasoning-gap-two', sessionSha256: 'b'.repeat(64) })
  ]);
  assert.equal(repeated.state, 'REPEATED_GAP_FRONTIER_EXAM_REQUIRED');
  assert.equal(repeated.repairOperatorCandidates.length, 1);
  assert.equal(repeated.repairOperatorCandidates[0].organAdmissionState, 'NOT_SUBMITTED_EVIDENCE_ONLY');
  assert.equal(repeated.repairOperatorCandidates[0].authority.writeCode, false);
  assert.match(repeated.assessment.classification, /^FRONTIER_/);
});

test('metamorphic batch reuse refuses a changed probe session', t => {
  const layout = tempLayout(t);
  Experience.store(realPassingReceipt(), layout);
  const first = Metamorphic.run(layout);
  const probeFile = path.join(first.runDir, first.batch.results[0].sessionFile);
  const session = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
  session.limitations.push('tampered');
  fs.writeFileSync(probeFile, JSON.stringify(session, null, 2) + '\n', 'utf8');
  assert.throws(() => Metamorphic.run(layout), /session hash mismatch/);
});

test('probe vocabulary expands from typed receipt shape without a lesson-name rule', t => {
  const layout = tempLayout(t);
  const session = Foundation.run({
    sessionId: 'metamorphic-shaped-parent',
    goal: 'Choose between two bounded paths.',
    evidence: [
      { id: 'shape-evidence-a', kind: 'test', status: 'tested', statement: 'Both paths are locally testable.', source: { kind: 'test', id: 'shape-a' } },
      { id: 'shape-evidence-b', kind: 'observation', status: 'observed', statement: 'The faster path has higher information value.', source: { kind: 'test', id: 'shape-b' } }
    ],
    unknowns: [],
    permissions: [],
    constraints: [
      { id: 'shape-rule-a', type: 'rule', statement: 'Retain evidence lineage.' },
      { id: 'shape-rule-b', type: 'rule', statement: 'Retain a recovery route.' }
    ],
    actions: [
      { id: 'shape-slow', kind: 'observe', label: 'Run the slower check', supportingEvidence: ['shape-evidence-a'], reversible: true, recovery: 'No mutation.', risk: 'low' },
      { id: 'shape-fast', kind: 'observe', label: 'Run the higher-value check', supportingEvidence: ['shape-evidence-b'], reversible: true, recovery: 'No mutation.', risk: 'low' }
    ],
    pathProfiles: [
      { actionId: 'shape-slow', approach: 'Use the slower source.', estimatedCost: 'HIGH', informationValue: 0.2, reversible: true },
      { actionId: 'shape-fast', approach: 'Use the higher-value source.', estimatedCost: 'LOW', informationValue: 0.9, reversible: true }
    ]
  }, { at: null });
  const decision = session.principleTrace.decision;
  const receipt = Experience.create(session, {
    provider: 'axm-workshop-local', sourceGroup: 'unseen-shaped-domain/no-lesson-name/v1', experienceKind: 'REAL_LOCAL_LESSON', parentReceiptIds: [], interventionId: null,
    role: 'training', policyId: Experience.STANDING_POLICY_ID, usePermission: 'allowed', permissionBasis: 'Test-owned shape-driven probe evidence.',
    evaluator: { id: 'shape-driven-independent-evaluator', kind: 'test-evaluator', independent: true, sourceRef: 'test://metamorphic/shape', sourceDigest: 'c'.repeat(64) }
  }, {
    observedDecisionValue: decision.value, observedActionId: decision.selectedActionId,
    expectedDecisionValue: decision.value, expectedActionId: decision.selectedActionId,
    behaviorMatched: true, outcomeVerified: true, statement: 'Shape-driven parent decision verified.', worldMutations: 0, runtimePointerChanged: false, unexpectedSeams: []
  }, { at: null });
  Experience.store(receipt, layout);
  const probeIds = Metamorphic.probeDefinitions(receipt).map(item => item.id);
  assert.ok(probeIds.includes('reverse-evidence-order'));
  assert.ok(probeIds.includes('reverse-candidate-order'));
  assert.ok(probeIds.includes('reverse-constraint-order'));
  const result = Metamorphic.run(layout);
  assert.equal(result.batch.summary.probes, 28);
  assert.equal(result.batch.summary.atomicProbes, 7);
  assert.equal(result.batch.summary.composedProbes, 21);
  assert.equal(result.batch.summary.invariantConfirmed, 28);
  assert.ok(result.batch.results.some(item => item.composition.depth === 2 && item.composition.generated === true));
  assert.equal(result.batch.summary.positiveTrainingReceiptsCreated, 0);
  assert.equal(Experience.loadDirectory(layout.directory).length, 1);
});
