'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Foundation = require('../kernel/reasoning-foundation');
const Admission = require('../kernel/organ-admission-cell');

function gapSession(id) {
  return Foundation.run({
    goal: `A repeated capability gap needs a candidate organ: ${id}`,
    evidence: [
      { id: 'gap-proof', kind: 'test', status: 'tested', statement: `Existing cells could not originate a candidate for ${id}.`, source: { kind: 'organ-gap-fixture', id } },
      { id: 'transfer-proof', kind: 'test', status: 'tested', statement: 'The same gap transferred to another surface.', source: { kind: 'organ-gap-transfer', id } },
      { id: 'regression-proof', kind: 'test', status: 'tested', statement: 'Earlier cells remained unchanged.', source: { kind: 'organ-gap-regression', id } }
    ],
    actions: [],
    outcome: {
      result: 'HOLD',
      statement: 'The gap is verified; no adequate path exists yet.',
      evidenceRefs: ['gap-proof'],
      transferEvidenceRefs: ['transfer-proof'],
      regressionEvidenceRefs: ['regression-proof'],
      verified: true,
      repeatedVerifiedOutcomes: 2,
      usePermission: 'allowed',
      permissionBasis: 'test-owned organ-gap fixture',
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: ['candidate-path-missing']
    }
  }, { at: null });
}

function contract(overrides = {}) {
  return Object.assign({
    organId: 'axm.mirror.organ/example-gap-v1',
    purpose: 'Originate bounded candidates for one repeated verified gap.',
    implementationKind: 'HARD_CODED_DETERMINISTIC',
    inputSchema: 'axm.mirror.example-gap-input/v1',
    outputSchema: 'axm.mirror.example-gap-candidates/v1',
    toolAuthority: false,
    worldMutationAuthority: false,
    permissionGrantAuthority: false,
    runtimeInstallAuthority: false,
    tests: {
      heldOutTransfer: true,
      counterexamples: true,
      earlierCapabilityRegression: true,
      authorityCanaries: true,
      rollback: 'Remove the isolated candidate organ and replay the deterministic baseline.',
      independentEvaluator: 'axm.mirror.seam-cell/seed-0'
    }
  }, overrides);
}

test('two independently bound verified gaps can earn only an organ build proposal', () => {
  const left = gapSession('left-domain');
  const right = gapSession('right-domain');
  assert.equal(left.developmentProposal.architectureRoute.decision, 'NEW_HARDCODED_ORGAN_CANDIDATE');
  const result = Admission.assess({
    reasoningSessions: [left, right],
    evidenceBindings: [
      { reasoningSessionId: left.reasoningSessionId, sourceGroup: 'domain/left', evidenceRefs: ['gap-proof'] },
      { reasoningSessionId: right.reasoningSessionId, sourceGroup: 'domain/right', evidenceRefs: ['gap-proof'] }
    ],
    proposedContract: contract()
  });
  assert.equal(result.classification, 'PROPOSE_BUILD');
  assert.equal(result.buildProposal.status, 'EXPERIMENTAL_BUILD_CANDIDATE');
  assert.equal(result.buildProposal.installationState, 'NOT_INSTALLED');
  assert.equal(result.authority.writeCode, false);
  assert.equal(result.authority.installOrgan, false);
  assert.equal(result.authority.runtimePromotion, false);
});

test('one source group is evidence for a hold, not organ need', () => {
  const session = gapSession('one-domain');
  const result = Admission.assess({
    reasoningSessions: [session],
    evidenceBindings: [{ reasoningSessionId: session.reasoningSessionId, sourceGroup: 'domain/one', evidenceRefs: ['gap-proof'] }],
    proposedContract: contract()
  });
  assert.equal(result.classification, 'HOLD_EVIDENCE');
  assert.equal(result.buildProposal, null);
  assert.ok(result.gaps.evidence.includes('at-least-two-verified-reasoning-sessions'));
});

test('an organ contract that asks for authority is rejected even with good evidence', () => {
  const left = gapSession('left-authority');
  const right = gapSession('right-authority');
  const result = Admission.assess({
    reasoningSessions: [left, right],
    evidenceBindings: [
      { reasoningSessionId: left.reasoningSessionId, sourceGroup: 'authority/left', evidenceRefs: ['gap-proof'] },
      { reasoningSessionId: right.reasoningSessionId, sourceGroup: 'authority/right', evidenceRefs: ['gap-proof'] }
    ],
    proposedContract: contract({ toolAuthority: true, runtimeInstallAuthority: true })
  });
  assert.equal(result.classification, 'REJECT_BOUNDARY');
  assert.deepEqual(result.gaps.boundaryViolations, ['toolAuthority', 'runtimeInstallAuthority']);
  assert.equal(result.buildProposal, null);
});
