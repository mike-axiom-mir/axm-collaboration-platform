'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Foundation = require('../kernel/reasoning-foundation');

function action(id, label) {
  return {
    id,
    kind: 'proposal',
    label,
    supportingEvidence: ['proof'],
    preconditionEvidence: ['proof'],
    requiredPermissions: [],
    risk: 'low',
    reversible: true,
    recovery: 'Return to the unchanged checkpoint.'
  };
}

function profiles() {
  return [
    { actionId: 'slow', approach: 'Repeat the existing explanation.', estimatedCost: 'HIGH', informationValue: 0.2, reversible: true },
    { actionId: 'probe', approach: 'Run an independent bounded probe.', estimatedCost: 'LOW', informationValue: 0.9, reversible: true }
  ];
}

function base(actions) {
  return {
    schema: 'axm.mirror.reasoning-session/v1',
    goal: 'Choose the most informative bounded path.',
    evidence: [{ id: 'proof', kind: 'test', status: 'tested', statement: 'Both paths are permitted local proposals.', source: { kind: 'test', id: 'foundation-test' } }],
    actions,
    pathProfiles: profiles()
  };
}

test('reasoning foundation compares paths without giving input order authority', () => {
  const first = Foundation.run(base([action('slow', 'Slow path'), action('probe', 'Probe path')]), { at: '2026-07-18T00:00:00.000Z' });
  const reversed = Foundation.run(base([action('probe', 'Probe path'), action('slow', 'Slow path')]), { at: '2026-07-18T00:00:00.000Z' });
  assert.equal(first.pathSet.selectedActionId, 'probe');
  assert.equal(reversed.pathSet.selectedActionId, 'probe');
  assert.equal(first.principleTrace.decision.selectedActionId, 'probe');
  assert.equal(first.pathSet.inputOrderAuthority, false);
  assert.equal(first.independentSeamReview.summary.open, 0);
  assert.ok(first.seams.some(item => item.id === 'selected-path-unverified'));
  assert.ok(first.seams.some(item => item.id === 'observed-consequence-missing'));
});

test('problem state keeps assumptions, blocking unknowns and contradictions visible', () => {
  const input = base([action('slow', 'Slow path'), action('probe', 'Probe path')]);
  input.evidence.push(
    { id: 'left', kind: 'observation', status: 'observed', statement: 'The switch is on.', contradicts: ['right'], source: { kind: 'fixture', id: 'left' } },
    { id: 'right', kind: 'observation', status: 'observed', statement: 'The switch is off.', contradicts: ['left'], source: { kind: 'fixture', id: 'right' } }
  );
  input.assumptions = [{ id: 'a1', statement: 'The labels refer to the same switch.', status: 'OPEN', evidenceRefs: [] }];
  input.unknowns = [{ id: 'which-state', question: 'Which switch state is current?', blocking: true }];
  const result = Foundation.run(input, { at: '2026-07-18T00:00:00.000Z' });
  assert.equal(result.problemState.assumptions[0].status, 'OPEN');
  assert.deepEqual(result.problemState.contradictions, [['left', 'right']]);
  assert.ok(result.seams.some(item => item.id === 'blocking-unknowns'));
  assert.ok(result.seams.some(item => item.id === 'unresolved-contradictions'));
  assert.ok(result.metacognition.confidenceAfter <= 0.35);
});

test('a tool request is explicit but never grants or uses the tool', () => {
  const input = base([action('slow', 'Slow path'), action('probe', 'Probe path')]);
  input.pathProfiles[1].toolRequest = { tool: 'fixture-reader', scope: 'one named fixture', reason: 'Obtain the missing observation', requiredPermission: 'read-fixture' };
  const result = Foundation.run(input, { at: '2026-07-18T00:00:00.000Z' });
  assert.equal(result.pathSet.comparisons.find(item => item.actionId === 'probe').toolRequest.authorityGranted, false);
  assert.equal(result.authority.toolUse, false);
  assert.equal(result.authority.permissionGrant, false);
  assert.equal(result.metacognition.nextAction, 'REQUEST_EXTERNAL_TOOL_GATE');
  assert.ok(result.seams.some(item => item.id === 'external-tool-gate-required'));
});

test('verified repeated transfer can only produce a review proposal', () => {
  const input = base([action('slow', 'Slow path'), action('probe', 'Probe path')]);
  input.evidence.push(
    { id: 'outcome', kind: 'observation', status: 'observed', statement: 'The bounded probe produced the expected result.', source: { kind: 'fixture', id: 'outcome' } },
    { id: 'transfer', kind: 'test', status: 'tested', statement: 'The method passed an unseen transfer case.', source: { kind: 'held-out', id: 'transfer' } },
    { id: 'regression', kind: 'test', status: 'tested', statement: 'Earlier behavior still passes.', source: { kind: 'regression', id: 'regression' } }
  );
  input.verificationReceipts = [{ id: 'verify-probe', actionId: 'probe', claim: 'The probe is supported on the bounded fixture.', evidenceRefs: ['proof'], method: 'deterministic fixture test', result: 'PASS', limitations: ['one bounded route'] }];
  input.outcome = {
    result: 'PASS', statement: 'Observed bounded success.', evidenceRefs: ['outcome'], verified: true,
    repeatedVerifiedOutcomes: 2, transferEvidenceRefs: ['transfer'], regressionEvidenceRefs: ['regression'],
    usePermission: 'allowed', permissionBasis: 'owner-provided local fixture', worldMutations: 0, runtimePointerChanged: false
  };
  const result = Foundation.run(input, { at: '2026-07-18T00:00:00.000Z' });
  assert.equal(result.pathSet.selectedActionId, 'probe');
  assert.equal(result.consolidation.state, 'PROPOSE_REVIEW');
  assert.equal(result.consolidation.authority.memoryWrite, false);
  assert.equal(result.consolidation.authority.trainingAdmission, false);
  assert.equal(result.consolidation.authority.activeModelChange, false);
  assert.equal(result.memoryRoute.writesPerformed.length, 0);
  assert.equal(result.independentSeamReview.summary.open, 0);
});

test('one unverified outcome cannot become a reusable lesson', () => {
  const input = base([action('slow', 'Slow path'), action('probe', 'Probe path')]);
  input.outcome = { result: 'PASS', statement: 'It seemed to work once.', evidenceRefs: [], verified: false, repeatedVerifiedOutcomes: 1, usePermission: 'unknown' };
  const result = Foundation.run(input, { at: '2026-07-18T00:00:00.000Z' });
  assert.equal(result.consolidation.state, 'NOT_ELIGIBLE');
  assert.equal(result.consolidation.lessonCandidate, null);
  assert.deepEqual(result.memoryRoute.semanticCandidates, []);
});

test('private hidden reasoning and unknown critical fields are refused', () => {
  assert.throws(() => Foundation.run({ goal: 'Refuse hidden reasoning.', chainOfThought: 'private' }), /private hidden reasoning/);
  assert.throws(() => Foundation.run({ goal: 'Refuse silent fields.', mysteryAuthority: true }), /unknown critical reasoning-session fields/);
});

test('native reasoning foundation contracts are present and valid JSON', () => {
  const root = path.resolve(__dirname, '..', 'contracts');
  const files = [
    'reasoning-state.schema.json', 'decomposition.schema.json', 'candidate-path.schema.json',
    'reasoning-verification.schema.json', 'memory-route.schema.json',
    'reasoning-memory-context.schema.json', 'reasoning-memory-guidance.schema.json',
    'reasoning-memory-guidance-exam-result.schema.json',
    'metacognition-receipt.schema.json', 'consolidation-proposal.schema.json',
    'reasoning-session.schema.json'
  ];
  for (const file of files) {
    const contract = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.ok(contract.$id, `${file} has an id`);
  }
});
