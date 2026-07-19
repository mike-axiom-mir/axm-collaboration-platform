'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Binding = require('../organs/reasoning-memory-feature-binding-organ');
const Experience = require('../organs/reasoning-experience-organ');
const Cycle = require('../training/reasoning-skill-cycle');
const State = require('../kernel/state-language');

const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'training', 'reasoning-strategy-train.json'), 'utf8'));

function sourceDigest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function receipt(rowIndex, sourceGroup, evaluatorId, strategyTag, options = {}) {
  const row = JSON.parse(JSON.stringify(fixture.cases[rowIndex]));
  row.caseId = sourceGroup.replace(/[^a-z0-9]+/gi, '-');
  row.sourceGroup = sourceGroup;
  if (options.toolRequest === true) {
    for (const profile of row.pathProfiles) profile.toolRequest = { tool: 'read-fixture', scope: 'test-only', reason: 'create a second structural binding candidate' };
  }
  if (options.missingRecovery === true) {
    for (const action of row.actions) delete action.recovery;
  }
  const session = Cycle.buildVerifiedSession(row, {
    sha256: sourceDigest(`fixture:${rowIndex}`),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned feature-binding source' }
  }, { at: null });
  const observed = session.principleTrace.decision;
  const worked = options.worked !== false;
  return Experience.create(session, {
    provider: 'axm-workshop-local',
    sourceGroup,
    experienceKind: 'REAL_LOCAL_LESSON',
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'test-owned feature-binding receipt',
    evaluator: {
      id: evaluatorId,
      kind: 'frozen-feature-binding-evaluator',
      independent: true,
      sourceRef: `test://feature-binding/${sourceGroup}`,
      sourceDigest: sourceDigest(evaluatorId)
    }
  }, {
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: observed.value,
    expectedActionId: worked ? observed.selectedActionId : 'independent-expected-path',
    behaviorMatched: worked,
    outcomeSucceeded: true,
    outcomeVerified: true,
    statement: worked ? 'The test strategy worked.' : 'The test strategy missed an independent expected path.',
    strategyTags: [strategyTag],
    strategyLabelSource: 'INDEPENDENT_EVALUATOR',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
}

function access() {
  return {
    requester: 'axm.mirror.test/reasoning-memory-feature-binding',
    purpose: 'Falsify private contrast-tested feature binding.',
    usePermission: 'allowed',
    permissionBasis: 'test-owned explicit read-only scope',
    allowedSourceGroupPrefixes: ['binding-test/'],
    maximumPerOutcome: 8
  };
}

function unseenStrategyReceipts(tag = 'new-contradiction-strategy') {
  return [
    receipt(2, 'binding-test/tagged/left', 'binding-evaluator/one', tag),
    receipt(3, 'binding-test/tagged/right', 'binding-evaluator/two', tag),
    receipt(0, 'binding-test/contrast/left', 'binding-evaluator/three', 'contrast-blocking'),
    receipt(1, 'binding-test/contrast/right', 'binding-evaluator/four', 'contrast-blocking')
  ];
}

test('an unseen strategy tag earns one structural binding from recurrence plus independent contrast', () => {
  const tag = 'new-contradiction-strategy';
  const batch = Binding.build({ strategyTags: [tag], access: access(), receipts: unseenStrategyReceipts(tag) });
  assert.equal(Binding.verify(batch), true);
  assert.equal(batch.state, 'ALL_REQUESTED_STRATEGIES_EXACTLY_BOUND');
  assert.equal(batch.summary.exactBindings, 1);
  assert.equal(batch.bindings[0].state, 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE');
  assert.equal(batch.bindings[0].bindingFeature, 'contradiction:present');
  assert.equal(batch.bindings[0].tagged.sourceGroups.length, 2);
  assert.equal(batch.bindings[0].contrast.sourceGroups.length, 2);
  assert.equal(batch.bindings[0].tagOnlyRetrievalAllowed, false);
});

test('an unseen machine field can earn a new strategy binding without a hardcoded feature map', () => {
  const tag = 'require-declared-recovery-via-schema';
  const receipts = [
    receipt(0, 'binding-test/schema-field/tagged-left', 'binding-evaluator/one', tag, { missingRecovery: true }),
    receipt(2, 'binding-test/schema-field/tagged-right', 'binding-evaluator/two', tag, { missingRecovery: true }),
    receipt(1, 'binding-test/schema-field/contrast-left', 'binding-evaluator/three', 'contrast-recovery-present'),
    receipt(3, 'binding-test/schema-field/contrast-right', 'binding-evaluator/four', 'contrast-recovery-present')
  ];
  const batch = Binding.build({ strategyTags: [tag], access: access(), receipts });
  assert.equal(Binding.verify(batch), true);
  assert.equal(batch.bindings[0].state, 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE');
  assert.equal(batch.bindings[0].bindingFeature,
    'structural-fact:reasoning-feature-source-v1:principletrace.candidates.any.action.recovery:missing');
  assert.equal(batch.source.structuralProjectionOrganId, 'axm.mirror.organ/reasoning-structural-feature-projection-v1');
  assert.equal(batch.policy.schemaSelectedMachineFeaturesCanBind, true);
});

test('tag recurrence alone cannot create a feature binding', () => {
  const tag = 'tag-without-contrast';
  const receipts = [
    receipt(0, 'binding-test/no-contrast/left', 'binding-evaluator/one', tag),
    receipt(1, 'binding-test/no-contrast/right', 'binding-evaluator/two', tag)
  ];
  const batch = Binding.build({ strategyTags: [tag], access: access(), receipts });
  assert.equal(batch.bindings[0].state, 'HOLD_NO_CONTRAST_RECEIPTS');
  assert.equal(batch.bindings[0].bindingFeature, null);
  assert.equal(batch.summary.exactBindings, 0);
});

test('two exclusive structural candidates remain ambiguous and neutral', () => {
  const tag = 'ambiguous-structural-strategy';
  const receipts = [
    receipt(0, 'binding-test/ambiguous/left', 'binding-evaluator/one', tag, { toolRequest: true }),
    receipt(1, 'binding-test/ambiguous/right', 'binding-evaluator/two', tag, { toolRequest: true }),
    receipt(2, 'binding-test/ambiguous-contrast/left', 'binding-evaluator/three', 'contrast-conflict'),
    receipt(3, 'binding-test/ambiguous-contrast/right', 'binding-evaluator/four', 'contrast-conflict')
  ];
  const batch = Binding.build({ strategyTags: [tag], access: access(), receipts });
  assert.equal(batch.bindings[0].state, 'HOLD_AMBIGUOUS_EXCLUSIVE_POSITIVE_FEATURES');
  assert.deepEqual(batch.bindings[0].eligibleExclusivePositiveFeatures, ['blocking-unknown:present', 'tool-request:present']);
  assert.equal(batch.bindings[0].bindingFeature, null);
});

test('receipt order and duplicates cannot change a derived binding', () => {
  const tag = 'order-invariant-strategy';
  const receipts = unseenStrategyReceipts(tag);
  const first = Binding.build({ strategyTags: [tag], access: access(), receipts });
  const reversed = Binding.build({ strategyTags: [tag], access: access(), receipts: receipts.slice().reverse() });
  const duplicated = Binding.build({ strategyTags: [tag], access: access(), receipts: receipts.concat(receipts[0]) });
  assert.equal(first.batchId, reversed.batchId);
  assert.equal(first.batchDigest, reversed.batchDigest);
  assert.equal(duplicated.bindings[0].bindingFeature, first.bindings[0].bindingFeature);
  assert.ok(duplicated.refused.some(item => item.reason === 'DUPLICATE_IDENTICAL_RECEIPT_IGNORED'));
});

test('the verifier rejects recomputed-digest authority and binding tampering', () => {
  const batch = Binding.build({ strategyTags: ['tamper-strategy'], access: access(), receipts: unseenStrategyReceipts('tamper-strategy') });
  const authority = JSON.parse(JSON.stringify(batch));
  authority.authority.decisionAuthority = true;
  authority.batchDigest = State.digest(Object.assign({}, authority, { batchDigest: null }), 64);
  assert.throws(() => Binding.verify(authority), /authority changed/);

  const changed = JSON.parse(JSON.stringify(batch));
  changed.bindings[0].bindingFeature = 'blocking-unknown:present';
  changed.batchDigest = State.digest(Object.assign({}, changed, { batchDigest: null }), 64);
  assert.throws(() => Binding.verify(changed), /result boundary changed/);
});

test('empty strategy input is an explicit neutral batch, not an error or tag-only query', () => {
  const batch = Binding.build({ strategyTags: [], access: access(), receipts: unseenStrategyReceipts() });
  assert.equal(batch.state, 'HOLD_NO_REQUESTED_STRATEGY_EXACTLY_BOUND');
  assert.equal(batch.summary.strategiesAssessed, 0);
  assert.equal(batch.summary.tagOnlyRetrievalsAllowed, 0);
  assert.equal(Binding.verify(batch), true);
});

test('current inventory command writes one immutable private audit and the contract is closed', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-memory-feature-binding-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const first = Binding.run({ root, stateDir });
  const second = Binding.run({ root, stateDir });
  assert.equal(second.reused, true);
  assert.equal(Binding.verify(first.batch, null, first.runDir), true);
  assert.equal(first.batch.summary.tagOnlyRetrievalsAllowed, 0);
  assert.equal(first.batch.authority.decisionAuthority, false);
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'reasoning-memory-feature-binding-batch.schema.json'), 'utf8'));
  const command = fs.readFileSync(path.join(root, 'scripts', 'run-reasoning-memory-feature-bindings.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'runtime', 'server.js'), 'utf8');
  assert.equal(contract.$id, Binding.SCHEMA);
  assert.equal(contract.additionalProperties, false);
  assert.ok(command.includes('Binding.run()'));
  assert.equal(runtime.includes('reasoning-memory-feature-binding-organ'), false);
});
