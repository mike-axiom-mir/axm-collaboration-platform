#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Gate = require('./model-shadow-challenger-gate');
const Shadow = require('../model-shadow-continuity/model-shadow-continuity');
const Challenger = require('../grounded-growth-challenger-lab/grounded-growth-challenger-lab');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../grounded-growth-feedback/grounded-growth-feedback');
const Direction = require('../grounded-growth-direction-handoff/grounded-growth-direction-handoff');
const ReviewService = require('../operations/review-service');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function ref(id, schema, seed) { return { id, schema, sha256: Gate.sha256(seed) }; }

const at = '2026-08-20T14:00:00.000Z';
const taskRef = ref('task:shadow-gate-fixture', 'axm.task/v1', 'task');
const contextRef = ref('context:shadow-gate-fixture', 'axm.context-envelope/v1', 'context');
const provenanceRef = ref('seat:shadow-gate-provenance', 'axm.model-seat-provenance/v1', 'provider/model');
const evidenceRef = ref('evidence:shadow-gate', 'axm.evidence-fragment/v1', 'evidence');

function seat() {
  return {
    id: 'model-seat-gate', kind: 'MODEL', role: 'bounded challenger fixture',
    providerFamily: 'provider-fixture', modelId: 'model-fixture-v1',
    identityDisclosure: 'EXACT', priorOutputExposure: 'NONE', provenanceRef,
    proofAuthority: 'NONE'
  };
}

function commitment(id, overrides) {
  return Object.assign({
    id, kind: 'CLAIM', position: 'AFFIRM', evidenceStage: 'OBSERVED',
    contentDigest: Shadow.sha256('content:' + id), sourceRefs: [evidenceRef],
    uncertaintyState: 'DECLARED', authorityRequests: []
  }, overrides || {});
}

function snapshot(id, capturedAt, overrides) {
  return Shadow.createSnapshot(Object.assign({
    snapshotId: id, capturedAt, taskRef, contextRef, seat: seat(),
    outputRef: ref('output:' + id, 'axm.structured-model-output/v1', 'artifact:' + id),
    commitments: [
      commitment('agency-boundary', { kind: 'CONSTRAINT' }),
      commitment('technical-claim')
    ],
    capabilities: ['analysis.explain'], requestedPermissions: []
  }, overrides || {}));
}

function observation(candidate, overrides) {
  const input = Object.assign({
    observationId: 'observation:shadow-gate', observedAt: '2026-08-20T14:02:00.000Z',
    baselineSnapshot: baseline, candidateSnapshot: candidate
  }, overrides || {});
  return { input, receipt: Shadow.buildObservation(input) };
}

function loopCycle() {
  const candidateRef = Loop.reference({ candidate: 'gate fixture' }, { id: 'candidate-shadow-gate', schema: 'text/javascript' });
  return Loop.build({
    cycleId: 'cycle-shadow-gate', capabilityId: 'growth.shadow-gate-fixture/v1', generatedAt: at,
    baseline: {
      kind: 'git-and-worktree', identity: 'bounded gate fixture',
      receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'baseline-shadow-gate', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-shadow-gate', statement: 'Model drift needs an explicit held-out challenger gate.',
      sourceRef: Loop.reference({ need: 'shadow gate' }, { id: 'need-shadow-gate-source', schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN', reason: 'The model-shadow and Challenger Lab contracts are not composed.',
      reportRef: Loop.reference({ missing: 'gate' }, { id: 'gap-shadow-gate', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ source: 'selftest' }, { id: 'provenance-shadow-gate', schema: 'axm.source-provenance/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: true, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ result: 'PASS' }, { id: 'verification-shadow-gate', schema: 'axm.focused-test-receipt/v1' }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic fixture proves contract behavior only.']
    },
    decision: {
      verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: candidateRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'CONTINUE' }, { id: 'decision-shadow-gate', schema: 'axm.review-decision/v1' })
    },
    availability: {
      status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'fixture-availability',
      receiptRef: Loop.reference({ available: true }, { id: 'availability-shadow-gate', schema: 'axm.module-availability-receipt/v1' })
    },
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
}

function closure() {
  const covered = [
    ref('gate-baseline-claim', 'axm.test-evidence/v1', 'before').sha256,
    ref('gate-outcome-claim', 'axm.test-evidence/v1', 'after').sha256,
    ref('gate-evidence-claim', 'axm.test-evidence/v1', 'proof').sha256
  ];
  return {
    state: 'CURRENT', checkedAt: at,
    receiptRef: ref('gate-closure', 'axm.evidence-closure-receipt/v1', Gate.stableStringify(covered)),
    coveredDigests: covered
  };
}

function actionHandoff() {
  const outcome = Growth.buildOutcome({
    outcomeId: 'shadow-gate-source-outcome', generatedAt: at, cycleReceipt: loopCycle(),
    informationRefs: [ref('gate-information', 'axm.test-evidence/v1', 'new signal')],
    claims: [{
      id: 'shadow-gate-human-wrong-surface', beneficiary: 'HUMAN',
      statement: 'The fixture human workflow is improved.', kind: 'WORKFLOW_OUTCOME', verdict: 'PASS',
      proofSurface: 'FOCUSED_RUNTIME',
      baselineRef: ref('gate-baseline-claim', 'axm.test-evidence/v1', 'before'),
      outcomeRef: ref('gate-outcome-claim', 'axm.test-evidence/v1', 'after'),
      evidenceRefs: [ref('gate-evidence-claim', 'axm.test-evidence/v1', 'proof')],
      evidenceClosure: closure(), limitations: ['Wrong proof surface intentionally creates a repair need.']
    }],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
  const feedback = Feedback.buildPacket({
    packetId: 'shadow-gate-feedback', generatedAt: '2026-08-20T14:00:01.000Z',
    sourceReceipt: outcome, routeStates: [], existingNeeds: [], coverageLinks: []
  });
  const need = feedback.candidateNeeds[0];
  return Direction.buildHandoff({
    handoffId: 'shadow-gate-direction', generatedAt: '2026-08-20T14:00:02.000Z', sourcePacket: feedback,
    selections: [{
      needId: need.need_id, actionType: 'REPAIR', sourceKind: 'SYNTHETIC_FIXTURE',
      sourceRef: ref('shadow-gate-selection', 'axm.proposal-selection/v1', 'repair'),
      rationale: 'Use a synthetic REPAIR selection only to verify the bounded gate.'
    }]
  });
}

function cases() {
  return [
    {
      id: 'visible-contract', kind: 'TECHNICAL', exposure: 'DESIGN_VISIBLE',
      sourceRef: ref('gate-visible-case', 'axm.challenger-case/v1', 'visible'),
      passCondition: 'The declared structured constraint remains present.',
      counterevidence: 'The declared structured constraint is absent.'
    },
    {
      id: 'held-out-ai-workflow', kind: 'AI_WORKFLOW', exposure: 'HELD_OUT',
      sourceRef: ref('gate-ai-case', 'axm.challenger-case/v1', 'held-out-ai'),
      passCondition: 'The held-out workflow improves on its declared condition.',
      counterevidence: 'The held-out workflow is unchanged, unknown, or worse.'
    },
    {
      id: 'held-out-regression', kind: 'REGRESSION', exposure: 'HELD_OUT',
      sourceRef: ref('gate-regression-case', 'axm.challenger-case/v1', 'held-out-regression'),
      passCondition: 'The known-safe held-out behavior remains available.',
      counterevidence: 'The candidate regresses the known-safe behavior.'
    }
  ];
}

const baseline = snapshot('snapshot:gate-baseline', '2026-08-20T14:00:00.000Z');
const driftCandidate = snapshot('snapshot:gate-drift', '2026-08-20T14:01:00.000Z', {
  commitments: [
    commitment('agency-boundary', { kind: 'CONSTRAINT' }),
    commitment('technical-claim', { contentDigest: Shadow.sha256('changed technical trace') })
  ]
});
const drift = observation(driftCandidate);
equal(drift.receipt.decision.classification, 'DRIFT_DETECTED', 'fixture provides ordinary structured drift');
const directionHandoff = actionHandoff();
check(Direction.verifyHandoff(directionHandoff).pass, 'existing non-WAIT Grounded Growth direction verifies natively');
const directionId = directionHandoff.directions[0].direction.direction_id;
const proposalInput = {
  proposalId: 'proposal:shadow-gate', generatedAt: '2026-08-20T14:03:00.000Z', observation: drift.receipt,
  directionHandoff, directionId, caseManifestId: 'cases:shadow-gate', cases: cases(),
  budget: { maxCases: 3, maxWallMs: 5000, maxOperations: 4 }
};
const proposal = Gate.buildProposal(proposalInput);
equal(proposal.state, 'CHALLENGER_PLAN_READY_FOR_EXPLICIT_REVIEW', 'ordinary drift becomes a review-ready challenger plan');
check(Gate.verifyProposal(proposalInput, proposal).pass, 'proposal verifies by exact rebuild');
check(Challenger.verifyPlan(proposal.plan).pass, 'proposal delegates to the native Challenger Lab plan');
equal(proposal.plan.baselineRef.sha256, baseline.outputRef.sha256, 'challenger baseline binds the exact baseline output artifact');
equal(proposal.plan.challengerRef.sha256, driftCandidate.outputRef.sha256, 'challenger candidate binds the exact candidate output artifact');
equal(proposal.plan.directionRef.sha256, directionHandoff.directions[0].directionDigest, 'challenger plan binds the existing direction digest');
equal('sha256:' + proposal.reviewProjection.artifactDigest, proposal.plan.planDigest, 'review projection binds the exact plan digest');
equal(proposal.reviewProjection.action.executionOnApproval, false, 'review approval does not execute the plan');
equal(proposal.truth.sourceDirectionInvented, false, 'gate does not invent a Grounded Growth direction');
equal(proposal.truth.rawModelOutputEmbedded, false, 'proposal embeds no raw model output');
equal(proposal.truth.reviewSubmitted, false, 'proposal is not automatically submitted');

const reviewRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-shadow-challenger-review-'));
let approvedItem;
try {
  const review = ReviewService.create({ stateRoot: reviewRoot });
  const pendingItem = review.submit(proposal.reviewProjection);
  equal(pendingItem.artifactDigest, proposal.reviewProjection.artifactDigest, 'existing Review Inbox accepts the plan projection');
  approvedItem = review.vote(pendingItem.id, {
    actor: 'fixture-human', actorKind: 'human', verdict: 'APPROVE',
    artifactDigest: pendingItem.artifactDigest,
    note: 'Synthetic fixture vote proves service compatibility, not actual human participation.'
  });
  equal(approvedItem.state, 'APPROVED', 'Review Inbox records the declared fixture human approval');

  const handoffInput = {
    handoffId: 'handoff:shadow-gate-reviewed', generatedAt: '2026-08-20T14:04:00.000Z',
    proposalInput, proposal, reviewItem: approvedItem
  };
  const handoff = Gate.buildReviewedHandoff(handoffInput);
  check(Gate.verifyReviewedHandoff(handoffInput, handoff).pass, 'reviewed handoff verifies by exact rebuild');
  equal(handoff.reviewEvidence.declaredHumanApprovalCount, 1, 'handoff records one declared human approval without copying identity');
  equal(handoff.truth.reviewActorAuthenticated, false, 'declared human seat is not called authenticated');
  equal(handoff.truth.actualHumanParticipationProven, false, 'synthetic or local review state does not prove actual human participation');
  equal(handoff.truth.executionAuthorized, false, 'reviewed handoff still grants no execution authority');
  equal(handoff.truth.adoptionAuthorized, false, 'reviewed handoff grants no adoption authority');
  check(!Gate.stableStringify(handoff).includes('fixture-human'), 'reviewed handoff stores only a digest of the declared actor identifier');
  check(!Gate.stableStringify(handoff).includes('Synthetic fixture vote'), 'reviewed handoff does not retain vote notes');

  const handoffTamper = JSON.parse(JSON.stringify(handoff));
  handoffTamper.truth.executionAuthorized = true;
  equal(Gate.verifyReviewedHandoff(handoffInput, handoffTamper).pass, false, 'execution-authority tampering is detected');

  const wrongDigestItem = JSON.parse(JSON.stringify(approvedItem));
  wrongDigestItem.artifactDigest = '0'.repeat(64);
  throws(() => Gate.buildReviewedHandoff(Object.assign({}, handoffInput, { reviewItem: wrongDigestItem })), /artifact digest mismatch/, 'wrong review digest is refused');

  const machineOnlyItem = JSON.parse(JSON.stringify(approvedItem));
  machineOnlyItem.votes[0].actorKind = 'machine';
  throws(() => Gate.buildReviewedHandoff(Object.assign({}, handoffInput, { reviewItem: machineOnlyItem })), /declared human approval seat/, 'machine-only approval cannot satisfy the declared human seat gate');

  const pendingCopy = JSON.parse(JSON.stringify(approvedItem));
  pendingCopy.state = 'PENDING';
  throws(() => Gate.buildReviewedHandoff(Object.assign({}, handoffInput, { reviewItem: pendingCopy })), /not approved/, 'pending review cannot create the reviewed handoff');

  const conflictingItem = JSON.parse(JSON.stringify(approvedItem));
  conflictingItem.votes.push({
    actor: 'fixture-dissent', actorKind: 'human', verdict: 'HOLD', note: 'hold',
    artifactDigest: approvedItem.artifactDigest, at: '2026-08-20T14:03:30.000Z'
  });
  throws(() => Gate.buildReviewedHandoff(Object.assign({}, handoffInput, { reviewItem: conflictingItem })), /conflicting vote/, 'conflicting exact-digest review remains held');
} finally {
  fs.rmSync(reviewRoot, { recursive: true, force: true });
}
equal(fs.existsSync(reviewRoot), false, 'temporary Review Inbox compatibility state is removed');

const matching = observation(snapshot('snapshot:gate-match', '2026-08-20T14:01:00.000Z'));
const matchProposal = Gate.buildProposal(Object.assign({}, proposalInput, { proposalId: 'proposal:match', observation: matching.receipt }));
equal(matchProposal.state, 'NO_STRUCTURED_DRIFT_TO_CHALLENGE', 'matching structured trace creates no challenger plan');
equal(matchProposal.plan, null, 'matching structured trace manufactures no plan');

const critical = observation(snapshot('snapshot:gate-critical', '2026-08-20T14:01:00.000Z', {
  commitments: [commitment('technical-claim', { authorityRequests: ['EXECUTE'] })]
}));
const criticalProposal = Gate.buildProposal(Object.assign({}, proposalInput, { proposalId: 'proposal:critical', observation: critical.receipt }));
equal(criticalProposal.state, 'HOLD_CRITICAL_AUTHORITY_DRIFT', 'critical authority drift is held before challenger design');
equal(criticalProposal.plan, null, 'critical authority drift manufactures no experiment plan');

const changedContext = observation(snapshot('snapshot:gate-context', '2026-08-20T14:01:00.000Z', {
  contextRef: ref('context:changed', 'axm.context-envelope/v1', 'changed context'),
  commitments: [commitment('changed-context-claim')]
}));
const invalidProposal = Gate.buildProposal(Object.assign({}, proposalInput, { proposalId: 'proposal:invalid', observation: changedContext.receipt }));
equal(invalidProposal.state, 'HOLD_INVALID_COMPARISON', 'invalid comparison cannot be treated as drift');

const sameArtifactCandidate = snapshot('snapshot:gate-same-artifact', '2026-08-20T14:01:00.000Z', {
  outputRef: baseline.outputRef,
  commitments: [
    commitment('agency-boundary', { kind: 'CONSTRAINT' }),
    commitment('technical-claim', { contentDigest: Shadow.sha256('changed trace with same artifact') })
  ]
});
const sameArtifact = observation(sameArtifactCandidate);
const sameArtifactProposal = Gate.buildProposal(Object.assign({}, proposalInput, { proposalId: 'proposal:same-artifact', observation: sameArtifact.receipt }));
equal(sameArtifactProposal.state, 'HOLD_NO_DISTINCT_OUTPUT_ARTIFACTS', 'same output artifact stays held instead of becoming a fake challenger');

const tamperedProposal = JSON.parse(JSON.stringify(proposal));
tamperedProposal.state = 'NO_STRUCTURED_DRIFT_TO_CHALLENGE';
equal(Gate.verifyProposal(proposalInput, tamperedProposal).pass, false, 'proposal tampering is detected');
throws(() => Gate.buildProposal(Object.assign({}, proposalInput, { surprise: true })), /unknown fields/, 'unknown proposal field is refused');
throws(() => Gate.stableStringify({ lost: undefined }), /undefined/, 'undefined state is refused at the deterministic boundary');
const cyclic = {}; cyclic.self = cyclic;
throws(() => Gate.stableStringify(cyclic), /cycle/, 'cyclic state is refused at the deterministic boundary');

const proposalSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-challenger-proposal.schema.json'), 'utf8'));
const handoffSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-challenger-reviewed-handoff.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
equal(proposalSchema.$id, Gate.PROPOSAL_SCHEMA, 'proposal schema identity matches implementation');
equal(handoffSchema.$id, Gate.HANDOFF_SCHEMA, 'reviewed handoff schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains TEST with zero permissions and writes');
check(contract.boundaries.refuses.includes('critical-authority-drift-as-challenger') && contract.boundaries.refuses.includes('review-approval-as-execution-authority'), 'contract refuses authority drift and review-as-execution substitution');
check(contract.boundaries.refuses.includes('declared-human-seat-as-authenticated-human') && contract.boundaries.refuses.includes('ai-workflow-win-as-human-benefit'), 'contract refuses human identity and benefit overclaims');

console.log('\nModel Shadow Challenger Gate selftest: PASS (' + checks + ' checks)');
