'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { reason } = require('../kernel/principle-cell');
const Seam = require('../kernel/seam-cell');
const Foundation = require('../kernel/reasoning-foundation');

function baseCycle(overrides) {
  return Object.assign({
    schema: 'axm.mirror.learning-cycle/v1', cycleId: 'cycle-test',
    corpus: {
      approvedSessionEpisodes: 1,
      approvedTrainingEpisodes: 1,
      trainingTokenCount: 50000,
      documents: [
        { id: 'a', usePermission: 'allowed', permissionBasis: 'owner', sha256: 'a'.repeat(64) },
        { id: 'b', usePermission: 'allowed', permissionBasis: 'owner', sha256: 'b'.repeat(64) },
        { id: 'c', usePermission: 'allowed', permissionBasis: 'owner', sha256: 'c'.repeat(64) }
      ],
      splits: { train: ['a'], validation: ['b'], test: ['c'] },
      splitLineage: {
        schema: 'axm.mirror.language-evaluation-split-lineage/v1',
        assignmentPolicy: 'IMMUTABLE_FIRST_OBSERVED_GROUP_ROLE_NEW_GROUPS_TRAIN_ONLY',
        historicalCyclesInspected: 1,
        historicalCycleIds: ['cycle-00000000000000000000'],
        historicallyAssignedGroupsInCurrentCorpus: 3,
        firstAssignmentGroups: [],
        newGroupsAssignedToTraining: [],
        validationExposure: [{ groupId: 'b', priorCycleCount: 1, firstCycleId: 'cycle-00000000000000000000' }],
        testExposure: [{ groupId: 'c', priorCycleCount: 1, firstCycleId: 'cycle-00000000000000000000' }],
        evaluationGroupsMovedToTraining: [],
        trainingGroupsMovedToEvaluation: [],
        historicalRoleConflicts: 0,
        automaticEvaluationRoleReassignment: false,
        authority: { trainingAdmission: false, thresholdChange: false, modelSelection: false, runtimePromotion: false, canonChange: false },
        boundary: 'Fixture split lineage.'
      }
    },
    evaluation: {
      baseline: { artifactId: 'base', testPerplexity: 10 },
      challenger: { artifactId: 'new', testPerplexity: 9 },
      canaries: [{ id: 'permission-hold', status: 'PASS' }],
      selectionUsedTestMetrics: false,
      testExcludedFromTraining: true
    },
    recovery: { previousChampion: 'base', rollbackProcedure: 'Restore pointer base.', rollbackDryRun: 'PASS: pointer unchanged.' },
    promotion: { automatic: false, reviewRequired: true, runtimePointerChanged: false },
    seamInvocation: { mode: 'deliberate', invoked: true },
    artifacts: [{ path: 'report.json', sha256: 'd'.repeat(64) }]
  }, overrides);
}

test('no candidate is a visible capability seam and a value-zero hold', () => {
  const trace = reason({ goal: 'Try one bounded action.', evidence: [], unknowns: [], constraints: [], permissions: [], actions: [] });
  assert.equal(trace.decision.value, 0);
  const report = Seam.inspectTrace(trace);
  assert.ok(report.seams.some(item => item.id === 'candidate-organ-missing'));
  assert.ok(!report.seams.some(item => item.id === 'hold-labelled-success'));
});

test('legacy success-labelled hold is detected', () => {
  const trace = reason({ goal: 'Hold.', evidence: [], unknowns: [], constraints: [], permissions: [], actions: [] });
  trace.decision.value = 1;
  const report = Seam.inspectTrace(trace);
  assert.ok(report.seams.some(item => item.id === 'hold-labelled-success' && item.severity === 'high'));
});

test('clean learning-cycle structure can reach zero implementation seams', () => {
  const report = Seam.inspectLearningCycle(baseCycle());
  assert.equal(report.summary.open, 0);
});

test('learning-cycle result digest binds the reconstructable Seam subject contract', () => {
  const cycle = baseCycle({ resultDigest: 'e'.repeat(64) });
  const report = Seam.inspectLearningCycle(cycle);
  assert.equal(report.subject.digest, cycle.resultDigest);
  assert.equal(Seam.verifyReportIntegrity(report), true);
  const altered = JSON.parse(JSON.stringify(report));
  altered.summary.open += 1;
  assert.throws(() => Seam.verifyReportIntegrity(altered), /integrity mismatch/);
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'seam-report.schema.json'), 'utf8'));
  assert.equal(contract.properties.subject.properties.digest.pattern, '^[a-f0-9]{64}$');
});

test('regression, leakage and automatic promotion are blocked', () => {
  const cycle = baseCycle();
  cycle.corpus.splits.validation = ['a'];
  cycle.evaluation.challenger.testPerplexity = 12;
  cycle.promotion.automatic = true;
  const report = Seam.inspectLearningCycle(cycle);
  const ids = report.seams.map(item => item.id);
  assert.ok(ids.includes('evaluation-split-leakage'));
  assert.ok(ids.includes('challenger-regression'));
  assert.ok(ids.includes('automatic-promotion-enabled'));
});

test('missing or conflicting longitudinal evaluation roles block training interpretation', () => {
  const missing = baseCycle();
  delete missing.corpus.splitLineage;
  assert.ok(Seam.inspectLearningCycle(missing).seams.some(item => item.id === 'evaluation-role-lineage-missing' && item.severity === 'critical'));

  const moved = baseCycle();
  moved.corpus.splitLineage.evaluationGroupsMovedToTraining = ['c'];
  moved.corpus.splitLineage.historicalRoleConflicts = 1;
  assert.ok(Seam.inspectLearningCycle(moved).seams.some(item => item.id === 'longitudinal-evaluation-role-conflict' && item.severity === 'critical'));
});

test('seams close only with passing evidence and preserve history', () => {
  const cycle = baseCycle(); cycle.evaluation.challenger.testPerplexity = 12;
  const report = Seam.inspectLearningCycle(cycle);
  assert.throws(() => Seam.closeSeam(report, 'challenger-regression', { testStatus: 'PASS', statement: 'fixed', evidenceRefs: [] }), /evidenceRefs/);
  const closed = Seam.closeSeam(report, 'challenger-regression', { testStatus: 'PASS', statement: 'Repaired challenger beat the frozen baseline.', evidenceRefs: ['run-2-report'], actor: 'codex' });
  assert.equal(closed.seams.find(item => item.id === 'challenger-regression').status, 'CLOSED');
  assert.equal(closed.summary.closed, 1);
});

test('reasoning session audit catches authority and selection bypasses', () => {
  const session = Foundation.run({
    goal: 'Audit one bounded path.',
    evidence: [{ id: 'proof', kind: 'test', status: 'tested', statement: 'The path is locally supported.', source: { kind: 'test', id: 'seam' } }],
    actions: [
      { id: 'one', kind: 'proposal', label: 'One path', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'No mutation.' },
      { id: 'two', kind: 'proposal', label: 'Two path', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'No mutation.' }
    ]
  }, { at: '2026-07-18T00:00:00.000Z' });
  assert.equal(Seam.inspectReasoningSession(session).summary.open, 0);
  session.authority.toolUse = true;
  session.pathSet.comparisons.find(item => item.actionId === session.pathSet.selectedActionId).eligible = false;
  const report = Seam.inspectReasoningSession(session);
  const ids = report.seams.map(item => item.id);
  assert.ok(ids.includes('reasoning-tool-authority-leak'));
  assert.ok(ids.includes('reasoning-authority-boundary-incomplete'));
  assert.ok(ids.includes('reasoning-selection-bypassed-gate'));
});
