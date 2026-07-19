'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Cycle = require('../training/reasoning-skill-cycle');
const Experience = require('../organs/reasoning-experience-organ');
const MemoryContext = require('../organs/reasoning-memory-context-organ');

function session(sourceGroup = 'memory/context/base', options = {}) {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'training', 'reasoning-strategy-train.json'), 'utf8'));
  const row = JSON.parse(JSON.stringify(fixture.cases[0]));
  row.caseId = sourceGroup.replace(/[^a-z0-9]+/gi, '-');
  row.sourceGroup = sourceGroup;
  if (options.missingRecovery === true) for (const action of row.actions) delete action.recovery;
  return Cycle.buildVerifiedSession(row, {
    sha256: 'b'.repeat(64),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned reasoning memory context' }
  }, { at: null });
}

function receipt(sourceGroup, worked = true, options = {}) {
  const reasoning = session(sourceGroup, options);
  const observed = reasoning.principleTrace.decision;
  return Experience.create(reasoning, {
    provider: 'axm-workshop-local',
    sourceGroup,
    experienceKind: options.experienceKind || 'REAL_LOCAL_LESSON',
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'test-owned local memory episode',
    evaluator: {
      id: `evaluator/${sourceGroup}`,
      kind: 'frozen-memory-test-evaluator',
      independent: true,
      sourceRef: `test://memory/${sourceGroup}`,
      sourceDigest: (options.digestCharacter || 'd').repeat(64)
    }
  }, {
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: observed.value,
    expectedActionId: worked ? observed.selectedActionId : 'independent-expected-path',
    behaviorMatched: worked,
    outcomeSucceeded: true,
    outcomeVerified: true,
    statement: worked ? 'The bounded behavior worked.' : 'The bounded decision missed the independent expected path.',
    strategyTags: ['ask-blocking-unknown'],
    strategyLabelSource: 'INDEPENDENT_EVALUATOR',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
}

function input(receipts) {
  return {
    query: {
      queryId: 'blocking-unknown-context',
      requiredFeatures: ['blocking-unknown:present'],
      requiredStrategyTags: ['ask-blocking-unknown'],
      requiredSeamIds: []
    },
    access: {
      requester: 'axm.mirror.reasoning-foundation/seed-0',
      purpose: 'Retrieve bounded structural precedents before forming a proposal.',
      usePermission: 'allowed',
      permissionBasis: 'test-owned explicit retrieval scope',
      allowedSourceGroupPrefixes: ['memory/allowed/'],
      maximumPerOutcome: 4
    },
    receipts
  };
}

test('bounded retrieval preserves matching success and counterevidence as a contradiction', () => {
  const positive = receipt('memory/allowed/positive', true, { digestCharacter: 'a' });
  const negative = receipt('memory/allowed/negative', false, { digestCharacter: 'b' });
  const result = MemoryContext.retrieve(input([positive, negative]));
  assert.equal(result.state, 'CONTRADICTORY_RELEVANT_EXPERIENCE');
  assert.equal(result.inventory.exactMatches, 2);
  assert.equal(result.supporting.length, 1);
  assert.equal(result.counterevidence.length, 1);
  assert.equal(result.counterevidence[0].negativeClass, 'DECISION_MISMATCH');
  assert.equal(result.contradictions.length, 1);
  assert.equal(result.supporting[0].semanticTruth, false);
  assert.equal(result.authority.decisionAuthority, false);
  assert.equal(result.authority.memoryWrite, false);
});

test('source scope blocks otherwise relevant receipts without exposing them as context', () => {
  const allowed = receipt('memory/allowed/one', true, { digestCharacter: 'c' });
  const denied = receipt('memory/private/two', false, { digestCharacter: 'd' });
  const result = MemoryContext.retrieve(input([allowed, denied]));
  assert.equal(result.state, 'SUPPORTING_EXPERIENCE_ONLY');
  assert.equal(result.inventory.accessible, 1);
  assert.equal(result.inventory.exactMatches, 1);
  assert.equal(result.counterevidence.length, 0);
  assert.ok(result.refused.some(item => item.receiptId === denied.receiptId && item.reason === 'SOURCE_GROUP_OUT_OF_REQUEST_SCOPE'));
  assert.ok(result.unknowns.includes('OUT_OF_SCOPE_RECEIPTS_NOT_USED'));
});

test('exact retrieval joins positive schema-selected facts without rewriting the receipt', () => {
  const missing = receipt('memory/allowed/recovery-missing', true, { digestCharacter: '9', missingRecovery: true });
  const present = receipt('memory/allowed/recovery-present', true, { digestCharacter: '8' });
  const request = input([missing, present]);
  request.query.requiredFeatures = [
    'structural-fact:reasoning-feature-source-v1:principletrace.candidates.any.action.recovery:missing'
  ];
  const result = MemoryContext.retrieve(request);
  assert.equal(result.inventory.exactMatches, 1);
  assert.equal(result.supporting[0].receiptId, missing.receiptId);
  assert.equal(result.supporting[0].matched.features[0], request.query.requiredFeatures[0]);
  assert.equal(result.featureProjection.positiveFactsOnly, true);
  assert.equal(missing.trainingExample.features.includes(request.query.requiredFeatures[0]), false);
});

test('tampered receipts are refused and cannot become retrieved context', () => {
  const valid = receipt('memory/allowed/valid', true, { digestCharacter: 'e' });
  const tampered = JSON.parse(JSON.stringify(valid));
  tampered.evaluation.result = 'DID_NOT_WORK';
  const result = MemoryContext.retrieve(input([tampered]));
  assert.equal(result.state, 'NO_EXACT_STRUCTURAL_MATCH');
  assert.equal(result.inventory.verifiedUnique, 0);
  assert.equal(result.inventory.exactMatches, 0);
  assert.ok(result.refused.some(item => item.reason === 'INVALID_OR_UNVERIFIED_RECEIPT'));
  assert.ok(result.unknowns.includes('INVALID_RECEIPTS_NOT_USED'));
});

test('retrieval is input-order independent and balances each outcome class', () => {
  const receipts = [
    receipt('memory/allowed/a', true, { digestCharacter: '1' }),
    receipt('memory/allowed/b', true, { digestCharacter: '2' }),
    receipt('memory/allowed/c', false, { digestCharacter: '3' }),
    receipt('memory/allowed/d', false, { digestCharacter: '4' })
  ];
  const left = input(receipts);
  left.access.maximumPerOutcome = 1;
  const right = input(receipts.slice().reverse());
  right.access.maximumPerOutcome = 1;
  const first = MemoryContext.retrieve(left);
  const reversed = MemoryContext.retrieve(right);
  assert.equal(first.contextDigest, reversed.contextDigest);
  assert.equal(first.supporting.length, 1);
  assert.equal(first.counterevidence.length, 1);
  assert.ok(first.unknowns.includes('RELEVANT_RESULTS_TRUNCATED'));
});

test('unbounded or unstructured retrieval requests are refused', () => {
  const one = receipt('memory/allowed/one', true, { digestCharacter: 'f' });
  const noQuery = input([one]);
  noQuery.query.requiredFeatures = [];
  noQuery.query.requiredStrategyTags = [];
  assert.throws(() => MemoryContext.retrieve(noQuery), /requires at least one exact structural/);

  const noScope = input([one]);
  noScope.access.allowedSourceGroupPrefixes = [];
  assert.throws(() => MemoryContext.retrieve(noScope), /requires at least one exact source group/);

  const noPermission = input([one]);
  noPermission.access.usePermission = 'unknown';
  assert.throws(() => MemoryContext.retrieve(noPermission), /explicit allowed-use basis/);
});

test('reasoning memory context contract is closed and parseable', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'reasoning-memory-context.schema.json'), 'utf8'));
  assert.equal(contract.$id, MemoryContext.SCHEMA);
  assert.equal(contract.additionalProperties, false);
  assert.ok(contract.required.includes('contextDigest'));
});
