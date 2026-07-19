'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Cycle = require('../training/reasoning-skill-cycle');
const Experience = require('../organs/reasoning-experience-organ');
const Curriculum = require('../organs/reasoning-failure-curriculum-organ');

function session() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'training', 'reasoning-strategy-train.json'), 'utf8'));
  const row = JSON.parse(JSON.stringify(fixture.cases[0]));
  row.caseId = 'failure-curriculum-fixture';
  row.sourceGroup = 'failure-curriculum/base';
  return Cycle.buildVerifiedSession(row, {
    sha256: 'b'.repeat(64),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned failure curriculum fixture' }
  }, { at: null });
}

function source(group, evaluator, overrides = {}) {
  return Object.assign({
    provider: 'axm-workshop-local',
    sourceGroup: group,
    experienceKind: 'REAL_LOCAL_LESSON',
    parentReceiptIds: [],
    interventionId: null,
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'test-owned local failure evidence',
    evaluator: {
      id: evaluator,
      kind: 'frozen-independent-test-evaluator',
      independent: true,
      sourceRef: `test://failure-curriculum/${evaluator}`,
      sourceDigest: Experience.digest({ evaluator })
    }
  }, overrides);
}

function evaluation(reasoningSession, overrides = {}) {
  const observed = reasoningSession.principleTrace.decision;
  return Object.assign({
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: observed.value,
    expectedActionId: observed.selectedActionId,
    behaviorMatched: true,
    outcomeVerified: true,
    statement: 'Independent evaluator observed the expected bounded behavior.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, overrides);
}

function receipt(group, evaluator, overrides = {}) {
  const reasoningSession = session();
  return Experience.create(reasoningSession, source(group, evaluator, overrides.source), evaluation(reasoningSession, overrides.evaluation), { at: null });
}

function policy() {
  return {
    schema: 'axm.mirror.training-policy/v1',
    automaticReasoningFailureCurriculumPlanning: true,
    reasoningFailureCurriculumPlanningScope: 'verified-real-local-negative-receipts-only-proposal-only-no-synthetic-proof-no-training-no-code-build-no-install-no-promotion-no-world-action',
    automaticRuntimePromotion: false,
    automaticCanonPromotion: false,
    automaticAuthorityGrowth: false
  };
}

test('current positive-only experience produces an honest no-negative hold', () => {
  const positive = receipt('real/positive/one', 'evaluator/positive-one');
  const batch = Curriculum.buildBatch([{ receipt: positive, sha256: Experience.digest(positive) }]);
  assert.equal(batch.state, 'NO_VERIFIED_REAL_LOCAL_NEGATIVE_EXPERIENCE');
  assert.equal(batch.summary.realLocalPositiveReceipts, 1);
  assert.equal(batch.summary.realLocalNegativeReceipts, 0);
  assert.equal(batch.summary.curriculumRequestsProposed, 0);
  assert.equal(batch.authority.trainingAdmission, false);
});

test('one real negative is preserved but cannot claim a recurrent curriculum need', () => {
  const negative = receipt('real/negative/one', 'evaluator/negative-one', {
    evaluation: { expectedActionId: 'independent-missing-candidate', behaviorMatched: false, statement: 'Expected candidate was absent.' }
  });
  const batch = Curriculum.buildBatch([{ receipt: negative, sha256: Experience.digest(negative) }]);
  assert.equal(batch.state, 'REAL_FAILURES_HELD_FOR_MORE_INDEPENDENT_RECURRENCE');
  assert.equal(batch.requests.length, 1);
  assert.equal(batch.requests[0].failureClass, 'CANDIDATE_ORIGINATION_FAILURE');
  assert.equal(batch.requests[0].state, 'HOLD_INSUFFICIENT_INDEPENDENT_REAL_SOURCE_GROUPS');
  assert.equal(batch.requests[0].route.kind, 'NEW_HARDCODED_ORGAN_ADMISSION');
  assert.equal(batch.requests[0].contractDraft.installationState, 'NOT_BUILT_OR_INSTALLED');
});

test('two independent real failures can propose a bounded curriculum without self-authority', () => {
  const left = receipt('real/negative/left', 'evaluator/negative-left', {
    evaluation: { expectedActionId: 'independent-missing-candidate-left', behaviorMatched: false }
  });
  const right = receipt('real/negative/right', 'evaluator/negative-right', {
    evaluation: { expectedActionId: 'independent-missing-candidate-right', behaviorMatched: false }
  });
  const batch = Curriculum.buildBatch([
    { receipt: left, sha256: Experience.digest(left) },
    { receipt: right, sha256: Experience.digest(right) }
  ]);
  assert.equal(batch.state, 'INDEPENDENT_FAILURE_CURRICULUM_REQUESTS_PROPOSED');
  assert.equal(batch.requests.length, 1);
  assert.equal(batch.requests[0].state, 'PROPOSE_INDEPENDENT_CURRICULUM');
  assert.equal(batch.requests[0].recurrence.distinctRealSourceGroups, 2);
  assert.equal(batch.requests[0].contractDraft.inputSchema, 'axm.mirror.reasoning-state/v1');
  assert.equal(batch.requests[0].contractDraft.outputSchema, 'axm.mirror.reasoning-path-set/v1');
  assert.equal(batch.requests[0].curriculum.candidateMayAuthorExpectedResult, false);
  assert.equal(batch.requests[0].authority.trainingAdmission, false);
  assert.equal(batch.requests[0].authority.codeBuild, false);
  assert.equal(batch.requests[0].authority.installOrgan, false);
});

test('an expected candidate already present routes to strategy repair, not a new organ', () => {
  const reasoningSession = session();
  const candidateIds = reasoningSession.principleTrace.candidates.map(item => item.action.id);
  assert.ok(candidateIds.length > 1);
  const alternate = candidateIds.find(id => id !== reasoningSession.principleTrace.decision.selectedActionId);
  const negative = Experience.create(reasoningSession, source('real/path-selection/one', 'evaluator/path-selection'), evaluation(reasoningSession, {
    expectedActionId: alternate,
    behaviorMatched: false
  }), { at: null });
  const batch = Curriculum.buildBatch([{ receipt: negative, sha256: Experience.digest(negative) }]);
  assert.equal(batch.requests[0].failureClass, 'PATH_SELECTION_FAILURE');
  assert.equal(batch.requests[0].route.kind, 'PRIVATE_STRATEGY_CHALLENGER_CURRICULUM');
  assert.equal(batch.requests[0].contractDraft, null);
});

test('a selected expected action with a failed outcome routes to cause-and-repair examination', () => {
  const negative = receipt('real/outcome/one', 'evaluator/outcome-one', {
    evaluation: { behaviorMatched: false, outcomeSucceeded: false, statement: 'The selected expected action still failed in observed use.' }
  });
  const batch = Curriculum.buildBatch([{ receipt: negative, sha256: Experience.digest(negative) }]);
  assert.equal(batch.requests[0].failureClass, 'VERIFIED_ACTION_OUTCOME_FAILURE');
  assert.equal(batch.requests[0].route.kind, 'INDEPENDENT_CAUSE_AND_REPAIR_EXAM');
});

test('synthetic negatives stay visible but cannot prove a real curriculum need', () => {
  const negative = receipt('synthetic/negative/one', 'evaluator/synthetic-one', {
    source: {
      experienceKind: 'SYNTHETIC_COUNTEREXAMPLE',
      parentReceiptIds: [`reasoning-experience-${'a'.repeat(24)}`],
      interventionId: 'fixture-intervention'
    },
    evaluation: { expectedActionId: 'synthetic-missing-candidate', behaviorMatched: false }
  });
  const batch = Curriculum.buildBatch([{ receipt: negative, sha256: Experience.digest(negative) }]);
  assert.equal(batch.state, 'NO_VERIFIED_REAL_LOCAL_NEGATIVE_EXPERIENCE');
  assert.equal(batch.summary.syntheticNegativeReceiptsExcluded, 1);
  assert.equal(batch.requests.length, 0);
});

test('batch verification catches content drift and immutable storage reuses exact results', t => {
  const negative = receipt('real/storage/one', 'evaluator/storage-one', {
    evaluation: { expectedActionId: 'storage-missing-candidate', behaviorMatched: false }
  });
  const records = [{ receipt: negative, sha256: Experience.digest(negative) }];
  const batch = Curriculum.buildBatch(records);
  assert.equal(Curriculum.verifyBatch(batch, records), true);
  const changed = JSON.parse(JSON.stringify(batch));
  changed.summary.curriculumRequestsProposed = 99;
  assert.throws(() => Curriculum.verifyBatch(changed, records), /digest changed/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-failure-curriculum-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = Curriculum.run({ root, records, policy: policy(), stateDir: path.join(root, 'state') });
  const second = Curriculum.run({ root, records, policy: policy(), stateDir: path.join(root, 'state') });
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(first.batch.batchId, second.batch.batchId);
});

test('public contracts and command exist while the active runtime does not import the organ', () => {
  const requestSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'reasoning-failure-curriculum-request.schema.json'), 'utf8'));
  const batchSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'reasoning-failure-curriculum-batch.schema.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const runtime = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'server.js'), 'utf8');
  assert.equal(requestSchema.$id, Curriculum.REQUEST_SCHEMA);
  assert.equal(batchSchema.$id, Curriculum.BATCH_SCHEMA);
  assert.equal(packageJson.scripts['plan:reasoning-failure-curriculum'], 'node scripts/run-reasoning-failure-curriculum.js');
  assert.equal(runtime.includes('reasoning-failure-curriculum-organ'), false);
});
