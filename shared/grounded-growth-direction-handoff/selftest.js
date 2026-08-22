#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../grounded-growth-feedback/grounded-growth-feedback');
const Handoff = require('./grounded-growth-direction-handoff');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const at = '2026-08-19T12:30:00.000Z';
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-direction-handoff.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(schema.$id === Handoff.HANDOFF_SCHEMA, 'direction handoff schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract stays TEST with no permissions or writes');
check(contract.boundaries.refuses.includes('machine-selection-among-multiple-actions'), 'module contract refuses machine selection among multiple actions');
check(contract.boundaries.refuses.includes('technical-proof-as-human-benefit') && contract.boundaries.refuses.includes('automatic-canon'), 'module contract separates beneficiary proof and refuses automatic CANON');
check(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
check(Handoff.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Handoff.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;
console.log('PASS unsafe canonical state is refused');

function ref(id, value, schemaName) {
  return Growth.reference(value, { id, schema: schemaName || 'axm.test-evidence/v1' });
}

function availableCycle() {
  const candidateRef = Loop.reference({ candidate: 'direction handoff fixture' }, { id: 'candidate-direction', schema: 'text/javascript' });
  return Loop.build({
    cycleId: 'cycle-direction-handoff',
    capabilityId: 'growth.direction-handoff-fixture/v1',
    generatedAt: at,
    baseline: {
      kind: 'git-and-worktree', identity: 'bounded direction selftest fixture',
      receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'baseline-direction', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-direction', statement: 'Verified feedback must become review-only directions without autonomous action.',
      sourceRef: Loop.reference({ need: 'direction' }, { id: 'need-direction-source', schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN', reason: 'No feedback-to-direction handoff existed.',
      reportRef: Loop.reference({ missing: 'direction handoff' }, { id: 'gap-direction', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ source: 'selftest' }, { id: 'provenance-direction', schema: 'axm.source-provenance/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: true, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ checks: 'fixture', result: 'PASS' }, { id: 'verification-direction', schema: 'axm.focused-test-receipt/v1' }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic fixture proves contract behavior only.']
    },
    decision: {
      verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: candidateRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'CONTINUE', candidate: candidateRef.sha256 }, { id: 'decision-direction', schema: 'axm.review-decision/v1' })
    },
    availability: {
      status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'fixture-availability',
      receiptRef: Loop.reference({ available: candidateRef.sha256 }, { id: 'availability-direction', schema: 'axm.module-availability-receipt/v1' })
    },
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
}

function closure() {
  const covered = [
    ref('direction-baseline', { before: true }).sha256,
    ref('direction-outcome', { after: true }).sha256,
    ref('direction-evidence', { evidence: true }).sha256
  ];
  return {
    state: 'CURRENT', checkedAt: at,
    receiptRef: ref('direction-closure', { state: 'CURRENT', covered }, 'axm.evidence-closure-receipt/v1'),
    coveredDigests: covered
  };
}

function claim(extra) {
  return Object.assign({
    id: 'direction-claim', beneficiary: 'AI_WORKFLOW',
    statement: 'The fixture AI workflow completes with fewer unsupported actions.',
    kind: 'WORKFLOW_OUTCOME', verdict: 'PASS', proofSurface: 'AI_WORKFLOW_EVALUATION',
    baselineRef: ref('direction-baseline', { before: true }),
    outcomeRef: ref('direction-outcome', { after: true }),
    evidenceRefs: [ref('direction-evidence', { evidence: true })],
    evidenceClosure: closure(), limitations: ['Synthetic fixture proves direction routing only.']
  }, extra || {});
}

function outcome(extra) {
  return Growth.buildOutcome(Object.assign({
    outcomeId: 'direction-outcome-1', generatedAt: at,
    cycleReceipt: availableCycle(),
    informationRefs: [ref('direction-information', { signal: 'new' })],
    claims: [],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  }, extra || {}));
}

function feedback(sourceReceipt, extra) {
  return Feedback.buildPacket(Object.assign({
    packetId: 'direction-feedback-1', generatedAt: '2026-08-19T12:30:01.000Z',
    sourceReceipt, routeStates: [], existingNeeds: [], coverageLinks: []
  }, extra || {}));
}

function handoff(sourcePacket, extra) {
  return Handoff.buildHandoff(Object.assign({
    handoffId: 'direction-handoff-1', generatedAt: '2026-08-19T12:30:02.000Z',
    sourcePacket, selections: []
  }, extra || {}));
}

const unknown = outcome();
const basicFeedback = feedback(unknown);
const basic = handoff(basicFeedback);
check(basic.summary.candidateNeedCount === 2 && basic.summary.directionCount === 2 && basic.summary.holdCount === 0, 'two single-response feedback needs become two review-only directions');
check(basic.directions.every((item) => item.direction.truth_state === 'HYPOTHESIS' && item.direction.steward_status === 'PENDING' && item.direction.execution_status === 'NOT_STARTED'), 'all directions remain HYPOTHESIS, PENDING and NOT_STARTED');
check(basic.directions.every((item) => item.selection.state === 'SOLE_COMPATIBLE_RESPONSE' && item.selection.sourceRef === null), 'single responses use deterministic contract selection without inventing a steward');
check(basic.directions.every((item) => item.needDigest === Handoff.sha256(basicFeedback.candidateNeeds.find((need) => need.need_id === item.needId))), 'every direction binds the exact source need digest');
check(basic.directions.every((item) => item.directionDigest === Handoff.sha256(item.direction)), 'every direction carries an exact digest');
check(basic.directions.every((item) => item.evidencePlan.sharedGrowthClaimAllowed === false), 'no draft direction permits a shared-growth claim');
check(basic.directions.every((item) => item.evidencePlan.aiWorkflowBenefit.verdict === 'NOT_RUN' && item.evidencePlan.humanBenefit.verdict === 'NOT_RUN'), 'AI and human beneficiary proof remain separately NOT_RUN');
check(basic.truth.automaticExecution === false && basic.truth.automaticWrite === false && basic.truth.automaticCanon === false, 'handoff grants no execution, write or CANON authority');
check(Handoff.verifyHandoff(basic).pass, 'fresh direction handoff verifies deterministically');

const voluntaryRef = ref('voluntary-direction-route', { state: 'READY_FOR_VOLUNTARY_INPUT' }, 'axm.human-route-readiness/v1');
const voluntaryFeedback = feedback(unknown, {
  routeStates: [{
    capabilityId: unknown.capabilityId,
    needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE',
    state: 'READY_FOR_VOLUNTARY_INPUT',
    evidenceRef: voluntaryRef,
    detail: 'A person may independently opt in, complete, or withdraw.'
  }]
});
const voluntary = handoff(voluntaryFeedback);
const wait = voluntary.directions.find((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE');
check(wait && wait.executionPlan.state === 'HOLD_FOR_EVIDENCE' && wait.executionPlan.steps.length === 0, 'WAIT_FOR_EVIDENCE creates a zero-step hold rather than hidden work');
check(wait.evidencePlan.humanBenefit.participationAutomatic === false && wait.evidencePlan.humanBenefit.completionOrWithdrawalValid === true, 'voluntary human participation and withdrawal remain preserved');

const wrongSurface = outcome({ claims: [claim({ beneficiary: 'HUMAN', proofSurface: 'FOCUSED_RUNTIME' })] });
const multiFeedback = feedback(wrongSurface);
check(multiFeedback.candidateNeeds.length === 1 && multiFeedback.candidateNeeds[0].possible_responses.length === 2, 'evidence-route repair fixture exposes two compatible responses');
const held = handoff(multiFeedback);
check(held.summary.directionCount === 0 && held.summary.holdCount === 1, 'multi-response need stays held without explicit selection');
check(held.holds[0].reason === 'MULTIPLE_RESPONSES_REQUIRE_EXPLICIT_SELECTION', 'multi-response hold states the exact missing selection');

const selectedRef = ref('direction-selection', { action: 'REPAIR', fixture: true }, 'axm.proposal-selection/v1');
const selected = handoff(multiFeedback, {
  selections: [{
    needId: multiFeedback.candidateNeeds[0].need_id,
    actionType: 'REPAIR',
    sourceKind: 'SYNTHETIC_FIXTURE',
    sourceRef: selectedRef,
    rationale: 'Select REPAIR only to exercise the bounded synthetic challenger path.'
  }]
});
check(selected.summary.directionCount === 1 && selected.summary.actionDirectionCount === 1 && selected.summary.holdCount === 0, 'explicit allowed selection creates one action direction');
check(selected.directions[0].selection.sourceKind === 'SYNTHETIC_FIXTURE' && selected.truth.explicitSelectionAuthenticated === false, 'selection provenance is retained without authentication');
check(selected.directions[0].executionPlan.state === 'PROPOSAL_ONLY' && selected.directions[0].executionPlan.automatic === false, 'action direction remains a non-automatic proposal');
check(selected.directions[0].evidencePlan.technicalEffect.proofSurface === 'BASELINE_CHALLENGER_VERIFICATION', 'action direction requires baseline/challenger verification');
check(selected.directions[0].direction.priority_components.formula_version === 'grounded-feedback-transparent-v1', 'priority uses a named transparent advisory formula');
check(selected.directions[0].direction.priority_components.advisory_score >= 0 && selected.directions[0].direction.priority_components.advisory_score <= 1, 'advisory score remains bounded');
check(Handoff.verifyHandoff(selected).pass, 'selected action handoff verifies deterministically');

assert.throws(() => handoff(multiFeedback, {
  selections: [{
    needId: multiFeedback.candidateNeeds[0].need_id,
    actionType: 'BUILD', sourceKind: 'SYNTHETIC_FIXTURE', sourceRef: selectedRef,
    rationale: 'This action is not declared compatible.'
  }]
}), /selection action is not allowed/);
checks += 1; console.log('PASS selection outside the verified need response set is refused');

assert.throws(() => handoff(multiFeedback, {
  selections: [{
    needId: 'axm:need:unknown-direction-selection',
    actionType: 'REPAIR', sourceKind: 'SYNTHETIC_FIXTURE', sourceRef: selectedRef,
    rationale: 'Unknown needs must not be accepted.'
  }]
}), /unknown candidate need/);
checks += 1; console.log('PASS selection for an unknown need is refused');

const tamperedSource = clone(basicFeedback);
tamperedSource.candidateNeeds[0].severity = 0.01;
assert.throws(() => handoff(tamperedSource), /source feedback packet is invalid/);
checks += 1; console.log('PASS tampered source feedback is refused natively');

const tamperedDirection = clone(basic);
tamperedDirection.directions[0].direction.steward_status = 'ACCEPTED';
check(!Handoff.verifyHandoff(tamperedDirection).pass, 'direction cannot be silently changed from PENDING to ACCEPTED');

const tamperedClaim = clone(basic);
tamperedClaim.directions[0].evidencePlan.sharedGrowthClaimAllowed = true;
check(!Handoff.verifyHandoff(tamperedClaim).pass, 'shared-growth gate cannot be silently opened');

const reordered = handoff(basicFeedback);
check(reordered.handoffDigest === basic.handoffDigest, 'same exact inputs reproduce the same handoff digest');
check(basic.summary.acceptedDirectionCount === 0 && basic.summary.executedDirectionCount === 0, 'summary records zero accepted and zero executed directions');

console.log('Grounded Growth direction handoff selftest passed: ' + checks + ' checks.');
