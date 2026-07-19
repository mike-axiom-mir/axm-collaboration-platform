'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const Cycle = require('../training/reasoning-skill-cycle');
const Experience = require('../organs/reasoning-experience-organ');
const MemoryGuidance = require('../organs/reasoning-memory-guidance-organ');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'training', 'reasoning-strategy-train.json'), 'utf8'));

function reasoningInput(options = {}) {
  const row = fixture.cases[0];
  const input = {
    goal: row.goal,
    evidence: JSON.parse(JSON.stringify(row.evidence)),
    unknowns: JSON.parse(JSON.stringify(row.unknowns)),
    actions: JSON.parse(JSON.stringify(row.actions)),
    pathProfiles: JSON.parse(JSON.stringify(row.pathProfiles))
  };
  if (options.missingRecovery === true) for (const action of input.actions) delete action.recovery;
  if (options.strategyTag) input.pathProfiles[0].strategyTags = [options.strategyTag];
  return input;
}

function memoryReceipt(sourceGroup, evaluatorId, tag, worked, rowIndex = 0, options = {}) {
  const row = JSON.parse(JSON.stringify(fixture.cases[rowIndex]));
  row.caseId = sourceGroup.replace(/[^a-z0-9]+/gi, '-');
  row.sourceGroup = sourceGroup;
  if (options.missingRecovery === true) for (const action of row.actions) delete action.recovery;
  const session = Cycle.buildVerifiedSession(row, {
    sha256: 'b'.repeat(64),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned memory guidance source' }
  }, { at: null });
  const observed = session.principleTrace.decision;
  return Experience.create(session, {
    provider: 'axm-workshop-local',
    sourceGroup,
    experienceKind: 'REAL_LOCAL_LESSON',
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'test-owned memory guidance receipt',
    evaluator: {
      id: evaluatorId,
      kind: 'frozen-memory-guidance-evaluator',
      independent: true,
      sourceRef: `test://memory-guidance/${sourceGroup}`,
      sourceDigest: evaluatorId.includes('one') ? '1'.repeat(64) : evaluatorId.includes('two') ? '2'.repeat(64) : '3'.repeat(64)
    }
  }, {
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: observed.value,
    expectedActionId: worked ? observed.selectedActionId : 'independent-expected-path',
    behaviorMatched: worked,
    outcomeSucceeded: true,
    outcomeVerified: true,
    statement: worked ? 'The tagged strategy worked.' : 'The tagged strategy missed the independent expected path.',
    strategyTags: [tag],
    strategyLabelSource: 'INDEPENDENT_EVALUATOR',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
}

function memory(receipts, options = {}) {
  const contrastReceipts = options.includeContrasts === false ? [] : [
    memoryReceipt('memory-guidance/contrast/left', 'evaluator/contrast-one', 'contrast-conflict', true, 2),
    memoryReceipt('memory-guidance/contrast/right', 'evaluator/contrast-two', 'contrast-conflict', true, 3)
  ];
  return {
    receipts: receipts.concat(contrastReceipts),
    access: {
      requester: 'axm.mirror.reasoning-foundation/memory-guidance-test',
      purpose: 'Evaluate a private bounded memory-guidance challenger.',
      usePermission: 'allowed',
      permissionBasis: 'test-owned explicit memory-guidance scope',
      allowedSourceGroupPrefixes: ['memory-guidance/'],
      maximumPerOutcome: 8
    }
  };
}

test('independently recurrent positive memory improves a frozen eligible path choice', () => {
  const receipts = [
    memoryReceipt('memory-guidance/positive/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/positive/right', 'evaluator/two', 'ask-blocking-unknown', true)
  ];
  const baseline = Foundation.run(reasoningInput(), { at: null });
  const challenger = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts) });
  assert.equal(baseline.pathSet.selectedActionId, 'assume-port');
  assert.equal(challenger.pathSet.selectedActionId, 'ask-state');
  const guided = challenger.pathSet.comparisons.find(item => item.actionId === 'ask-state');
  assert.equal(guided.memoryGuidanceState, 'SUPPORTING_CONTEXT');
  assert.equal(guided.memoryGuidanceAdjustment, 12);
  const path = challenger.pathSet.strategyGuidance.memory.paths.find(item => item.actionId === 'ask-state');
  assert.deepEqual(path.exactFeatureBindingsUsed, ['blocking-unknown:present']);
  assert.equal(path.tagOnlyRetrievals, 0);
  assert.equal(challenger.pathSet.strategyGuidance.mode, 'PRIVATE_MEMORY_CHALLENGER');
  assert.equal(challenger.pathSet.strategyGuidance.activeRuntimeAuthority, false);
  assert.equal(challenger.independentSeamReview.summary.open, 0);
});

test('recurrent counterevidence lowers a matching path without becoming truth', () => {
  const receipts = [
    memoryReceipt('memory-guidance/negative/left', 'evaluator/one', 'guess-through-unknown', false),
    memoryReceipt('memory-guidance/negative/right', 'evaluator/two', 'guess-through-unknown', false)
  ];
  const challenger = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts) });
  assert.equal(challenger.pathSet.selectedActionId, 'ask-state');
  const guided = challenger.pathSet.comparisons.find(item => item.actionId === 'assume-port');
  assert.equal(guided.memoryGuidanceState, 'COUNTEREVIDENCE_CONTEXT');
  assert.equal(guided.memoryGuidanceAdjustment, -12);
  assert.equal(challenger.pathSet.strategyGuidance.memory.authority.semanticTruthWrite, false);
  assert.equal(challenger.pathSet.strategyGuidance.memory.authority.decisionAuthority, false);
});

test('contradictory memory neutralizes itself instead of selecting a story', () => {
  const receipts = [
    memoryReceipt('memory-guidance/conflict/positive', 'evaluator/one', 'guess-through-unknown', true),
    memoryReceipt('memory-guidance/conflict/negative', 'evaluator/two', 'guess-through-unknown', false)
  ];
  const baseline = Foundation.run(reasoningInput(), { at: null });
  const challenger = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts) });
  const guided = challenger.pathSet.comparisons.find(item => item.actionId === 'assume-port');
  assert.equal(guided.memoryGuidanceState, 'CONTRADICTORY_CONTEXT');
  assert.equal(guided.memoryGuidanceAdjustment, 0);
  assert.equal(challenger.pathSet.selectedActionId, baseline.pathSet.selectedActionId);
});

test('two source groups with one evaluator are visible but cannot adjust ordering', () => {
  const receipts = [
    memoryReceipt('memory-guidance/one-evaluator/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/one-evaluator/right', 'evaluator/one', 'ask-blocking-unknown', true)
  ];
  const challenger = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts) });
  const guided = challenger.pathSet.comparisons.find(item => item.actionId === 'ask-state');
  assert.equal(guided.memoryGuidanceState, 'INSUFFICIENT_INDEPENDENCE');
  assert.equal(guided.memoryGuidanceAdjustment, 0);
  assert.equal(challenger.pathSet.selectedActionId, 'assume-port');
});

test('memory cannot make a missing-permission path eligible', () => {
  const receipts = [
    memoryReceipt('memory-guidance/permission/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/permission/right', 'evaluator/two', 'ask-blocking-unknown', true)
  ];
  const input = reasoningInput();
  input.actions[0].requiredPermissions = ['private-read'];
  input.pathProfiles[0].requiredPermissions = ['private-read'];
  const challenger = Foundation.run(input, { at: null, reasoningMemory: memory(receipts) });
  const guided = challenger.pathSet.comparisons.find(item => item.actionId === 'ask-state');
  assert.equal(guided.memoryGuidanceAdjustment, 12);
  assert.deepEqual(guided.missingPermissions, ['private-read']);
  assert.equal(guided.eligible, false);
  assert.equal(challenger.pathSet.selectedActionId, 'assume-port');
});

test('tag-only recurrence without independent contrast stays neutral', () => {
  const receipts = [
    memoryReceipt('memory-guidance/tag-only/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/tag-only/right', 'evaluator/two', 'ask-blocking-unknown', true)
  ];
  const challenger = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts, { includeContrasts: false }) });
  const guidance = challenger.pathSet.strategyGuidance.memory;
  const path = guidance.paths.find(item => item.actionId === 'ask-state');
  const binding = guidance.featureBinding.bindings.find(item => item.strategyTag === 'ask-blocking-unknown');
  assert.equal(binding.state, 'HOLD_NO_CONTRAST_RECEIPTS');
  assert.equal(path.state, 'UNBOUND_STRATEGY_CONTEXT');
  assert.equal(path.adjustment, 0);
  assert.equal(path.tagOnlyRetrievals, 0);
  assert.equal(challenger.pathSet.selectedActionId, 'assume-port');
});

test('a learned tag binding cannot cross into a current structural feature mismatch', () => {
  const receipts = [
    memoryReceipt('memory-guidance/mismatch/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/mismatch/right', 'evaluator/two', 'ask-blocking-unknown', true)
  ];
  const challenger = Foundation.run(reasoningInput(), {
    at: null,
    strategyFeatures: ['contradiction:present'],
    reasoningMemory: memory(receipts)
  });
  const path = challenger.pathSet.strategyGuidance.memory.paths.find(item => item.actionId === 'ask-state');
  assert.equal(path.state, 'CONTEXT_FEATURE_MISMATCH');
  assert.equal(path.adjustment, 0);
  assert.equal(path.bindingRefs[0].bindingFeature, 'blocking-unknown:present');
  assert.equal(path.bindingRefs[0].currentFeatureMatched, false);
  assert.equal(challenger.pathSet.selectedActionId, 'assume-port');
});

test('schema-selected machine facts teach and retrieve a new strategy without tag-only fallback', () => {
  const tag = 'require-declared-recovery-via-schema';
  const receipts = [
    memoryReceipt('memory-guidance/schema-field/tagged-left', 'evaluator/one', tag, true, 0, { missingRecovery: true }),
    memoryReceipt('memory-guidance/schema-field/tagged-right', 'evaluator/two', tag, true, 2, { missingRecovery: true }),
    memoryReceipt('memory-guidance/schema-field/contrast-left', 'evaluator/contrast-one', 'contrast-recovery-present', true, 1),
    memoryReceipt('memory-guidance/schema-field/contrast-right', 'evaluator/contrast-two', 'contrast-recovery-present', true, 3)
  ];
  const scopedMemory = memory(receipts, { includeContrasts: false });
  const matching = Foundation.run(reasoningInput({ missingRecovery: true, strategyTag: tag }), { at: null, reasoningMemory: scopedMemory });
  const matchedPath = matching.pathSet.strategyGuidance.memory.paths.find(item => item.actionId === 'ask-state');
  assert.equal(matchedPath.state, 'SUPPORTING_CONTEXT');
  assert.equal(matchedPath.adjustment, 12);
  assert.deepEqual(matchedPath.exactFeatureBindingsUsed, [
    'structural-fact:reasoning-feature-source-v1:principletrace.candidates.any.action.recovery:missing'
  ]);
  assert.equal(matchedPath.bindingRefs[0].currentFeatureMatched, true);
  assert.equal(matchedPath.tagOnlyRetrievals, 0);
  assert.equal(matching.pathSet.strategyGuidance.structuralProjection.summary.proseFieldsRead, 0);
  assert.equal(matching.independentSeamReview.summary.open, 0);

  const mismatch = Foundation.run(reasoningInput({ strategyTag: tag }), { at: null, reasoningMemory: scopedMemory });
  const mismatchedPath = mismatch.pathSet.strategyGuidance.memory.paths.find(item => item.actionId === 'ask-state');
  assert.equal(mismatchedPath.state, 'CONTEXT_FEATURE_MISMATCH');
  assert.equal(mismatchedPath.adjustment, 0);
  assert.equal(mismatchedPath.bindingRefs[0].currentFeatureMatched, false);
});

test('an explicit memory request with no strategy tags returns neutral guidance', () => {
  const output = MemoryGuidance.create({
    problemFeatures: ['blocking-unknown:present'],
    pathProfiles: [{ actionId: 'untagged', strategyTags: [] }],
    receipts: [],
    access: memory([]).access
  });
  assert.equal(output.featureBinding.state, 'HOLD_NO_REQUESTED_STRATEGY_EXACTLY_BOUND');
  assert.equal(output.paths[0].state, 'NO_CONTEXT');
  assert.equal(output.paths[0].adjustment, 0);
  assert.equal(MemoryGuidance.verify(output), true);
});

test('Seam Cell catches guidance tampering and private challenger episodes cannot self-train', () => {
  const receipts = [
    memoryReceipt('memory-guidance/tamper/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/tamper/right', 'evaluator/two', 'ask-blocking-unknown', true)
  ];
  const challenger = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts) });
  const changed = JSON.parse(JSON.stringify(challenger));
  changed.pathSet.strategyGuidance.memory.paths[0].adjustment = 999;
  const report = Seam.inspectReasoningSession(changed);
  assert.ok(report.seams.some(item => item.id === 'reasoning-memory-guidance-integrity-failed'));

  const source = {
    provider: 'axm-workshop-local', sourceGroup: 'memory-guidance/self-train', experienceKind: 'REAL_LOCAL_LESSON', role: 'training',
    policyId: Experience.STANDING_POLICY_ID, usePermission: 'allowed', permissionBasis: 'test refusal',
    evaluator: { id: 'evaluator/three', kind: 'test', independent: true, sourceRef: 'test://self-train', sourceDigest: '3'.repeat(64) }
  };
  const decision = challenger.principleTrace.decision;
  assert.throws(() => Experience.create(challenger, source, {
    observedDecisionValue: decision.value, observedActionId: decision.selectedActionId,
    expectedDecisionValue: decision.value, expectedActionId: decision.selectedActionId,
    behaviorMatched: true, outcomeSucceeded: true, outcomeVerified: true,
    worldMutations: 0, runtimePointerChanged: false
  }), /private-challenger self-training/);
});

test('guidance contract is closed and verifier accepts only the sealed policy', () => {
  const receipts = [
    memoryReceipt('memory-guidance/verify/left', 'evaluator/one', 'ask-blocking-unknown', true),
    memoryReceipt('memory-guidance/verify/right', 'evaluator/two', 'ask-blocking-unknown', true)
  ];
  const session = Foundation.run(reasoningInput(), { at: null, reasoningMemory: memory(receipts) });
  assert.equal(MemoryGuidance.verify(session.pathSet.strategyGuidance.memory), true);
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'reasoning-memory-guidance.schema.json'), 'utf8'));
  assert.equal(contract.$id, MemoryGuidance.SCHEMA);
  assert.equal(contract.additionalProperties, false);
});
