'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Foundation = require('../kernel/reasoning-foundation');
const StrategyModel = require('../learning/reasoning-strategy-model');
const Cycle = require('../training/reasoning-skill-cycle');

function cycleOptions(stateDir) {
  return { stateDir, reasoningReceiptsDir: path.join(stateDir, 'empty-reasoning-receipts') };
}

test('private strategy challenger learns reusable structural selection on frozen transfer cases', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reasoning-skill-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const result = Cycle.run(cycleOptions(stateDir));
  assert.equal(result.cycle.corpus.admittedVerifiedSessions, 12);
  assert.equal(result.cycle.evaluation.baseline.cases, 12);
  assert.equal(result.cycle.evaluation.baseline.passed, 0);
  assert.equal(result.cycle.evaluation.baseline.accuracy, 0);
  assert.equal(result.cycle.evaluation.challenger.cases, 12);
  assert.equal(result.cycle.evaluation.challenger.passed, 12);
  assert.equal(result.cycle.evaluation.challenger.accuracy, 1);
  assert.equal(result.cycle.evaluation.challenger.adversarialPassed, result.cycle.evaluation.challenger.adversarialCases);
  assert.equal(result.cycle.evaluation.origination.baseline.passed, 2);
  assert.equal(result.cycle.evaluation.origination.baseline.accuracy, 1 / 6);
  assert.equal(result.cycle.evaluation.origination.challenger.accuracy, 1);
  assert.ok(result.cycle.evaluation.origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length).every(item => item.originatedCandidates >= 1));
  assert.ok(result.cycle.evaluation.origination.challenger.results.filter(item => !item.observableExpectedStrategyTags.length).every(item => item.safeUnderspecifiedHold && item.originatedCandidates === 0));
  assert.equal(result.cycle.promotion.state, 'PROPOSE_HUMAN_REVIEW');
  assert.equal(result.seamReport.summary.open, 0);
  assert.equal(result.cycle.authority.activeRuntime, false);
  assert.equal(result.cycle.promotion.runtimePointerChanged, false);
  assert.deepEqual(result.cycle.model.learnedLabels, [
    'ask-blocking-unknown', 'discriminate-conflict', 'request-bounded-tool', 'test-open-assumption'
  ]);
  assert.deepEqual(result.cycle.model.learnedSequences, [
    'ask-blocking-unknown',
    'ask-blocking-unknown>then>discriminate-conflict',
    'ask-blocking-unknown>then>request-bounded-tool',
    'discriminate-conflict',
    'discriminate-conflict>then>test-open-assumption',
    'request-bounded-tool',
    'request-bounded-tool>then>test-open-assumption',
    'test-open-assumption'
  ]);
  const composed = result.cycle.evaluation.origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length > 1);
  assert.equal(composed.length, 2);
  for (const item of composed) assert.deepEqual(item.selectedStrategyTags, item.observableExpectedStrategyTags);
  assert.equal(result.cycle.evaluation.origination.challenger.legacyExactPassed, 8);
  assert.equal(result.cycle.evaluation.canaries.find(item => item.id === 'ordered-strategy-composition').status, 'PASS');
  const reused = Cycle.run(cycleOptions(stateDir));
  assert.equal(reused.reused, true);
  assert.equal(reused.cycle.cycleId, result.cycle.cycleId);
});

test('strategy labels are learned from verified receipts rather than a compiled label list', () => {
  const fixture = {
    sha256: 'a'.repeat(64),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned fixture' }
  };
  const row = {
    caseId: 'novel-strategy-case', sourceGroup: 'train/novel/one', goal: 'Test a new reusable strategy label.',
    evidence: [{ id: 'initial', kind: 'test', status: 'tested', statement: 'A bounded state exists.', source: { kind: 'test', id: 'novel' } }],
    actions: [
      { id: 'novel', kind: 'observe', label: 'Use the new strategy', risk: 'low', reversible: true, recovery: 'No mutation.' },
      { id: 'shortcut', kind: 'observe', label: 'Use a shortcut', risk: 'low', reversible: true, recovery: 'No mutation.' }
    ],
    pathProfiles: [
      { actionId: 'novel', approach: 'A newly named transferable strategy.', estimatedCost: 'HIGH', informationValue: 0.1, reversible: true, strategyTags: ['teacher-created-strategy-x'] },
      { actionId: 'shortcut', approach: 'Shortcut.', estimatedCost: 'LOW', informationValue: 0.9, reversible: true, strategyTags: ['shortcut'] }
    ],
    correctActionId: 'novel', resolvedSeams: []
  };
  const session = Cycle.buildVerifiedSession(row, fixture, { at: null });
  const model = StrategyModel.train([session], { at: null });
  assert.ok(model.labels['teacher-created-strategy-x']);
  assert.ok(model.sequences['teacher-created-strategy-x']);
  assert.equal(Object.hasOwn(model.labels, 'ask-blocking-unknown'), false);
  assert.equal(model.authority.activeRuntime, false);
});

test('model digest detects learned artifact tampering', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reasoning-model-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const result = Cycle.run(cycleOptions(stateDir));
  assert.equal(StrategyModel.verify(result.model), true);
  const changed = JSON.parse(JSON.stringify(result.model));
  changed.labels[Object.keys(changed.labels)[0]].examples += 1;
  assert.throws(() => StrategyModel.verify(changed), /digest mismatch/);
});

test('pre-sequence strategy artifacts are refused instead of silently reused', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reasoning-model-v1-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const result = Cycle.run(cycleOptions(stateDir));
  const oldShape = JSON.parse(JSON.stringify(result.model));
  delete oldShape.sequences;
  delete oldShape.modelDigest;
  oldShape.modelDigest = StrategyModel.digest(oldShape);
  assert.throws(() => StrategyModel.verify(oldShape), /no learned sequences/);
});

test('verified seam closure preserves the original contradiction and closure receipt', () => {
  const input = {
    goal: 'Resolve a contradiction without erasing it.',
    evidence: [
      { id: 'left', kind: 'observation', status: 'observed', statement: 'Left says on.', contradicts: ['right'], source: { kind: 'test', id: 'left' } },
      { id: 'right', kind: 'observation', status: 'observed', statement: 'Right says off.', contradicts: ['left'], source: { kind: 'test', id: 'right' } },
      { id: 'resolution', kind: 'test', status: 'tested', statement: 'A timestamp check shows right is current.', source: { kind: 'test', id: 'resolution' } },
      { id: 'transfer', kind: 'test', status: 'tested', statement: 'Transferred.', source: { kind: 'test', id: 'transfer' } },
      { id: 'regression', kind: 'test', status: 'tested', statement: 'Regression clear.', source: { kind: 'test', id: 'regression' } }
    ],
    actions: [
      { id: 'check', kind: 'observe', label: 'Discriminate by timestamp', risk: 'low', reversible: true, recovery: 'No mutation.' },
      { id: 'guess', kind: 'observe', label: 'Guess', risk: 'low', reversible: true, recovery: 'No mutation.' }
    ],
    pathProfiles: [
      { actionId: 'check', strategyTags: ['discriminate'], estimatedCost: 'HIGH', informationValue: 0.1 },
      { actionId: 'guess', strategyTags: ['guess'], estimatedCost: 'LOW', informationValue: 0.9 }
    ],
    verificationReceipts: [
      { actionId: 'check', claim: 'Timestamp discriminates.', evidenceRefs: ['resolution'], method: 'fixture', result: 'PASS' },
      { actionId: 'guess', claim: 'Guess is adequate.', evidenceRefs: ['resolution'], method: 'fixture', result: 'FAIL' }
    ],
    outcome: {
      result: 'PASS', statement: 'Resolved.', evidenceRefs: ['resolution'], transferEvidenceRefs: ['transfer'], regressionEvidenceRefs: ['regression'],
      resolvedSeams: [{ seamId: 'unresolved-contradictions', testStatus: 'PASS', statement: 'Timestamp discriminated without deletion.', evidenceRefs: ['resolution'] }],
      verified: true, repeatedVerifiedOutcomes: 2, usePermission: 'allowed', permissionBasis: 'test fixture', worldMutations: 0, runtimePointerChanged: false
    }
  };
  const session = Foundation.run(input, { at: null });
  assert.deepEqual(session.problemState.contradictions, [['left', 'right']]);
  const seam = session.seams.find(item => item.id === 'unresolved-contradictions');
  assert.equal(seam.status, 'CLOSED');
  assert.deepEqual(seam.closure.evidenceRefs, ['resolution']);
  assert.equal(session.consolidation.state, 'PROPOSE_REVIEW');
});
