'use strict';

const ChallengerGate = require('../model-shadow-challenger-gate/model-shadow-challenger-gate');
const Shadow = require('../model-shadow-continuity/model-shadow-continuity');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../grounded-growth-feedback/grounded-growth-feedback');
const Direction = require('../grounded-growth-direction-handoff/grounded-growth-direction-handoff');

function ref(id, schema, seed) {
  return { id, schema, sha256: ChallengerGate.sha256(seed) };
}

const at = '2026-08-20T14:00:00.000Z';
const taskRef = ref('task:signed-review-fixture', 'axm.task/v1', 'task');
const contextRef = ref('context:signed-review-fixture', 'axm.context-envelope/v1', 'context');
const provenanceRef = ref('seat:signed-review-provenance', 'axm.model-seat-provenance/v1', 'provider/model');
const evidenceRef = ref('evidence:signed-review', 'axm.evidence-fragment/v1', 'evidence');

function seat() {
  return {
    id: 'model-seat-signed-review',
    kind: 'MODEL',
    role: 'bounded signed review fixture',
    providerFamily: 'provider-fixture',
    modelId: 'model-fixture-v1',
    identityDisclosure: 'EXACT',
    priorOutputExposure: 'NONE',
    provenanceRef,
    proofAuthority: 'NONE'
  };
}

function commitment(id, overrides) {
  return Object.assign({
    id,
    kind: 'CLAIM',
    position: 'AFFIRM',
    evidenceStage: 'OBSERVED',
    contentDigest: Shadow.sha256('content:' + id),
    sourceRefs: [evidenceRef],
    uncertaintyState: 'DECLARED',
    authorityRequests: []
  }, overrides || {});
}

function snapshot(id, capturedAt, overrides) {
  return Shadow.createSnapshot(Object.assign({
    snapshotId: id,
    capturedAt,
    taskRef,
    contextRef,
    seat: seat(),
    outputRef: ref('output:' + id, 'axm.structured-model-output/v1', 'artifact:' + id),
    commitments: [commitment('agency-boundary', { kind: 'CONSTRAINT' }), commitment('technical-claim')],
    capabilities: ['analysis.explain'],
    requestedPermissions: []
  }, overrides || {}));
}

function loopCycle() {
  const candidateRef = Loop.reference(
    { candidate: 'signed review fixture' },
    { id: 'candidate-signed-review', schema: 'text/javascript' }
  );
  return Loop.build({
    cycleId: 'cycle-signed-review',
    capabilityId: 'growth.signed-review-fixture/v1',
    generatedAt: at,
    baseline: {
      kind: 'git-and-worktree',
      identity: 'bounded signed review fixture',
      receiptRef: Loop.reference(
        { baseline: 'fixture' },
        { id: 'baseline-signed-review', schema: 'axm.baseline-observation/v1' }
      )
    },
    need: {
      id: 'need-signed-review',
      statement: 'Review declarations need exact detached signature evidence without gaining execution authority.',
      sourceRef: Loop.reference(
        { need: 'signed review' },
        { id: 'need-signed-review-source', schema: 'axm.workshop-need/v1' }
      )
    },
    gap: {
      state: 'OPEN',
      reason: 'Review Inbox actor strings do not carry cryptographic key-possession evidence.',
      reportRef: Loop.reference(
        { missing: 'signature evidence' },
        { id: 'gap-signed-review', schema: 'axm.capability-gap-report/v1' }
      )
    },
    provenance: [Loop.reference(
      { source: 'selftest' },
      { id: 'provenance-signed-review', schema: 'axm.source-provenance/v1' }
    )],
    candidate: {
      strategy: 'ADAPT',
      status: 'EXPERIMENTAL',
      artifactRef: candidateRef,
      sourceMutationPerformed: true,
      installed: false,
      promoted: false,
      canon: false
    },
    verification: {
      verdict: 'PASS',
      subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference(
        { result: 'PASS' },
        { id: 'verification-signed-review', schema: 'axm.focused-test-receipt/v1' }
      ),
      evidenceAuthority: 'MIXED',
      limitations: ['Synthetic fixtures prove contract behavior only.']
    },
    decision: {
      verdict: 'CONTINUE',
      actorKind: 'HUMAN',
      actorId: 'fixture-steward',
      candidateDigest: candidateRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference(
        { verdict: 'CONTINUE' },
        { id: 'decision-signed-review', schema: 'axm.review-decision/v1' }
      )
    },
    availability: {
      status: 'AVAILABLE',
      candidateDigest: candidateRef.sha256,
      authorityId: 'fixture-availability',
      receiptRef: Loop.reference(
        { available: true },
        { id: 'availability-signed-review', schema: 'axm.module-availability-receipt/v1' }
      )
    },
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
}

function directionHandoff() {
  const covered = [
    ref('signed-review-baseline-claim', 'axm.test-evidence/v1', 'before').sha256,
    ref('signed-review-outcome-claim', 'axm.test-evidence/v1', 'after').sha256,
    ref('signed-review-evidence-claim', 'axm.test-evidence/v1', 'proof').sha256
  ];
  const outcome = Growth.buildOutcome({
    outcomeId: 'signed-review-source-outcome',
    generatedAt: at,
    cycleReceipt: loopCycle(),
    informationRefs: [ref('signed-review-information', 'axm.test-evidence/v1', 'new signal')],
    claims: [{
      id: 'signed-review-human-wrong-surface',
      beneficiary: 'HUMAN',
      statement: 'The fixture human workflow is improved.',
      kind: 'WORKFLOW_OUTCOME',
      verdict: 'PASS',
      proofSurface: 'FOCUSED_RUNTIME',
      baselineRef: ref('signed-review-baseline-claim', 'axm.test-evidence/v1', 'before'),
      outcomeRef: ref('signed-review-outcome-claim', 'axm.test-evidence/v1', 'after'),
      evidenceRefs: [ref('signed-review-evidence-claim', 'axm.test-evidence/v1', 'proof')],
      evidenceClosure: {
        state: 'CURRENT',
        checkedAt: at,
        receiptRef: ref('signed-review-closure', 'axm.evidence-closure-receipt/v1', ChallengerGate.stableStringify(covered)),
        coveredDigests: covered
      },
      limitations: ['Wrong proof surface intentionally creates a synthetic repair need.']
    }],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
  const feedback = Feedback.buildPacket({
    packetId: 'signed-review-feedback',
    generatedAt: '2026-08-20T14:00:01.000Z',
    sourceReceipt: outcome,
    routeStates: [],
    existingNeeds: [],
    coverageLinks: []
  });
  const need = feedback.candidateNeeds[0];
  return Direction.buildHandoff({
    handoffId: 'signed-review-direction',
    generatedAt: '2026-08-20T14:00:02.000Z',
    sourcePacket: feedback,
    selections: [{
      needId: need.need_id,
      actionType: 'REPAIR',
      sourceKind: 'SYNTHETIC_FIXTURE',
      sourceRef: ref('signed-review-selection', 'axm.proposal-selection/v1', 'repair'),
      rationale: 'Use a synthetic REPAIR selection only to verify the bounded signed-review leaf.'
    }]
  });
}

function cases() {
  return [
    {
      id: 'visible-contract', kind: 'TECHNICAL', exposure: 'DESIGN_VISIBLE',
      sourceRef: ref('signed-review-visible-case', 'axm.challenger-case/v1', 'visible'),
      passCondition: 'The declared structured constraint remains present.',
      counterevidence: 'The declared structured constraint is absent.'
    },
    {
      id: 'held-out-ai-workflow', kind: 'AI_WORKFLOW', exposure: 'HELD_OUT',
      sourceRef: ref('signed-review-ai-case', 'axm.challenger-case/v1', 'held-out-ai'),
      passCondition: 'The held-out workflow improves on its declared condition.',
      counterevidence: 'The held-out workflow is unchanged, unknown, or worse.'
    },
    {
      id: 'held-out-regression', kind: 'REGRESSION', exposure: 'HELD_OUT',
      sourceRef: ref('signed-review-regression-case', 'axm.challenger-case/v1', 'held-out-regression'),
      passCondition: 'The known-safe held-out behavior remains available.',
      counterevidence: 'The candidate regresses the known-safe behavior.'
    }
  ];
}

function buildFixture() {
  const baseline = snapshot('snapshot:signed-review-baseline', '2026-08-20T14:00:00.000Z');
  const candidate = snapshot('snapshot:signed-review-drift', '2026-08-20T14:01:00.000Z', {
    commitments: [
      commitment('agency-boundary', { kind: 'CONSTRAINT' }),
      commitment('technical-claim', { contentDigest: Shadow.sha256('changed technical trace') })
    ]
  });
  const observationInput = {
    observationId: 'observation:signed-review',
    observedAt: '2026-08-20T14:02:00.000Z',
    baselineSnapshot: baseline,
    candidateSnapshot: candidate
  };
  const handoff = directionHandoff();
  const proposalInput = {
    proposalId: 'proposal:signed-review',
    generatedAt: '2026-08-20T14:03:00.000Z',
    observation: Shadow.buildObservation(observationInput),
    directionHandoff: handoff,
    directionId: handoff.directions[0].direction.direction_id,
    caseManifestId: 'cases:signed-review',
    cases: cases(),
    budget: { maxCases: 3, maxWallMs: 5000, maxOperations: 4 }
  };
  const proposal = ChallengerGate.buildProposal(proposalInput);
  const reviewItem = {
    schema: 'axm.review-item/v1',
    id: 'review:signed-review-fixture',
    kind: proposal.reviewProjection.kind,
    sourceRef: proposal.reviewProjection.sourceRef,
    artifactDigest: proposal.reviewProjection.artifactDigest,
    action: proposal.reviewProjection.action,
    state: 'APPROVED',
    requiredSeats: 1,
    votes: [{
      actor: 'fixture-human',
      actorKind: 'human',
      verdict: 'APPROVE',
      note: 'Synthetic fixture note must not survive the reviewed handoff or signed receipt.',
      artifactDigest: proposal.reviewProjection.artifactDigest,
      at: '2026-08-20T14:03:30.000Z'
    }]
  };
  const reviewedHandoffInput = {
    handoffId: 'handoff:signed-review-reviewed',
    generatedAt: '2026-08-20T14:04:00.000Z',
    proposalInput,
    proposal,
    reviewItem
  };
  return {
    reviewedHandoffInput,
    reviewedHandoff: ChallengerGate.buildReviewedHandoff(reviewedHandoffInput)
  };
}

module.exports = { buildFixture };
