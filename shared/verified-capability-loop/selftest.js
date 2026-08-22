#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Loop = require('./verified-capability-loop');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

const at = '2026-08-19T04:00:00.000Z';
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified-capability-cycle-receipt.schema.json'), 'utf8'));
check(schema.$id === Loop.RECEIPT_SCHEMA, 'receipt schema identity matches the implementation');
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(contract.status === 'TEST', 'module contract keeps the connector at TEST');
check(Array.isArray(contract.permissions) && contract.permissions.length === 0, 'module contract grants no permissions');
check(Array.isArray(contract.boundaries.writes) && contract.boundaries.writes.length === 0, 'module contract declares no writes');
check([
  'candidate-execution',
  'automatic-install',
  'automatic-permission-grant',
  'automatic-promotion',
  'automatic-canon',
  'root-mutation',
  'model-weight-training-claim'
].every((boundary) => contract.boundaries.refuses.includes(boundary)), 'module contract records the authority ceiling');
const baseline = {
  kind: 'git-and-worktree',
  identity: 'public baseline plus explicitly observed local branch state',
  receiptRef: Loop.reference({ publicCommit: '7147b97', localHead: 'c6e79092' }, { id: 'baseline-observation', schema: 'axm.baseline-observation/v1' })
};
const need = {
  id: 'need-output-availability',
  statement: 'Registered raw evidence output must remain available and unchanged when a later verifier checks it.',
  sourceRef: Loop.reference({ source: '5YFF signal', probe: 'removed-corrupted-summary-replaced' }, { id: 'need-source', schema: 'axm.research-signal/v1' }),
  directionRef: Loop.reference({ direction: 'Truth over convenient summaries' }, { id: 'root-direction', schema: 'axm.direction-reference/v1' })
};
const gap = {
  state: 'OPEN',
  reason: 'The registry stored source digests but did not re-check registered bytes after mutation or removal.',
  reportRef: Loop.reference({ before: ['MISSING_UNDETECTED', 'CHANGED_UNDETECTED'] }, { id: 'gap-report', schema: 'axm.capability-gap-report/v1' })
};
const provenance = [
  Loop.reference({ test: 'output-availability-before-v2', result: 'FAIL' }, { id: 'negative-probe', schema: 'axm.runtime-probe/v1' })
];
const candidateRef = Loop.reference({ change: 'bounded verifySource and verifySources on registered Evidence Retention sources' }, { id: 'evidence-retention-repair', schema: 'text/javascript' });
const candidate = {
  strategy: 'ADAPT',
  status: 'EXPERIMENTAL',
  artifactRef: candidateRef,
  sourceMutationPerformed: true,
  installed: false,
  promoted: false,
  canon: false
};
const verificationRef = Loop.reference({ checks: 27, failed: 0, negativeStates: ['MISSING', 'CHANGED', 'CHANGED'] }, { id: 'focused-verification', schema: 'axm.focused-test-receipt/v1' });

function input(extra) {
  return Object.assign({
    cycleId: 'cycle-output-availability-20260819',
    capabilityId: 'evidence.registered-source-closure/v1',
    generatedAt: at,
    baseline,
    need,
    gap,
    provenance,
    candidate: null,
    verification: null,
    decision: null,
    availability: null,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Recheck only when source bytes, baseline identity, or a relevant claim changes.' }
  }, extra || {});
}

const open = Loop.build(input());
check(open.state === 'GAP_OPEN', 'an observed need with no candidate remains GAP_OPEN');

const unverified = Loop.build(input({ candidate }));
check(unverified.state === 'CANDIDATE_UNVERIFIED', 'a candidate does not close its own gap');

const declared = Loop.build(input({ candidate, verification: {
  verdict: 'PASS', subjectDigest: candidateRef.sha256, receiptRef: verificationRef,
  evidenceAuthority: 'OPERATOR_DECLARATION', limitations: ['No independent runtime observation.']
} }));
check(declared.state === 'VERIFICATION_HOLD', 'operator-declared PASS cannot become effective runtime proof');

const verification = {
  verdict: 'PASS', subjectDigest: candidateRef.sha256, receiptRef: verificationRef,
  evidenceAuthority: 'MIXED', limitations: ['Focused current-source checks do not prove every future filesystem race.']
};
const awaiting = Loop.build(input({ candidate, verification }));
check(awaiting.state === 'AWAITING_STEWARD', 'runtime-supported candidate waits for the human steward');
check(awaiting.improvementClaim === 'VERIFIED_CANDIDATE_ONLY', 'verification does not claim installed improvement');
check(Loop.verify(awaiting).pass, 'fresh cycle receipt verifies deterministically');

assert.throws(() => Loop.build(input({ candidate, verification: Object.assign({}, verification, { subjectDigest: 'sha256:' + '0'.repeat(64) }) })), /does not match/);
checks += 1; console.log('PASS candidate and verification digest mismatch is refused');

const decisionRef = Loop.reference({ actor: 'mike', verdict: 'CONTINUE', candidate: candidateRef.sha256 }, { id: 'steward-decision', schema: 'axm.review-decision/v1' });
const decision = {
  verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'mike', candidateDigest: candidateRef.sha256,
  confirmation: 'CONTINUE VERIFIED CAPABILITY', decisionRef
};
const reject = {
  verdict: 'REJECT', actorKind: 'HUMAN', actorId: 'mike', candidateDigest: candidateRef.sha256,
  confirmation: 'REJECT VERIFIED CAPABILITY',
  decisionRef: Loop.reference({ actor: 'mike', verdict: 'REJECT', candidate: candidateRef.sha256 }, { id: 'reject-decision', schema: 'axm.review-decision/v1' })
};
const rejectedBeforeVerification = Loop.build(input({ candidate, decision: reject }));
check(rejectedBeforeVerification.state === 'REJECTED', 'human REJECT is effective without making the candidate prove itself first');

const ready = Loop.build(input({ candidate, verification, decision }));
check(ready.state === 'READY_FOR_GOVERNED_INTAKE', 'human CONTINUE still waits for governed availability');
check(ready.truth.automaticInstall === false && ready.truth.automaticCanon === false, 'cycle carries no install or CANON authority');

const availability = {
  status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'module-installer',
  receiptRef: Loop.reference({ installedCandidate: candidateRef.sha256, authority: 'module-installer' }, { id: 'availability', schema: 'axm.module-availability-receipt/v1' })
};
const available = Loop.build(input({ candidate, verification, decision, availability }));
check(available.state === 'AVAILABLE_FOR_REUSE', 'external availability completes the reusable capability state');
check(available.improvementClaim === 'AVAILABLE_AND_REFRESHABLE', 'improvement is claimed only after governed availability');

const due = Loop.build(input({ candidate, verification, decision, availability, refresh: {
  trigger: 'HEARTBEAT', checkedAt: at, due: true, reason: 'The baseline or source evidence changed and requires a new check.'
} }));
check(due.state === 'REFRESH_DUE', 'new information reopens an available capability for refresh');

const held = Loop.build(input({ candidate, verification, decision: Object.assign({}, decision, {
  verdict: 'HOLD', confirmation: 'HOLD VERIFIED CAPABILITY', decisionRef: Loop.reference({ verdict: 'HOLD' }, { id: 'hold', schema: 'axm.review-decision/v1' })
}) }));
check(held.state === 'STEWARD_HOLD', 'human HOLD remains a first-class outcome');

const tampered = JSON.parse(JSON.stringify(awaiting));
tampered.state = 'AVAILABLE_FOR_REUSE';
check(!Loop.verify(tampered).pass, 'tampered derived state fails receipt verification');
check(awaiting.truth.modelWeightTrainingClaimed === false, 'capability accumulation is not mislabeled as model-weight training');

console.log('\nVerified Capability Loop selftest: PASS (' + checks + ' checks)');
