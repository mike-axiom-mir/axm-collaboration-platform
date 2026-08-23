'use strict';

const fs = require('fs');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const CurrentSourceClosure = require('../2026-08-19-human-benefit-readiness/current-protocol');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PORTFOLIO_RELATIVE = 'docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json';
const SOURCE_CLOSURE_PROTOCOL_RELATIVE = 'docs/steward-runs/2026-08-19-human-benefit-readiness/current-protocol.json';
const SOURCE_CLOSURE_PACKET_RELATIVE = 'docs/steward-runs/2026-08-19-human-benefit-readiness/current-participant-packet.json';
const GENERATED_AT = '2026-08-19T10:45:00.000Z';
const SCOPE = 'Any result applies only to the participating local AXM steward and cannot be generalized to other people.';

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8'));
}

function rawRef(relativePath, id, schema) {
  const canonicalText = fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  return { id, schema, path: relativePath, sha256: Human.sha256(canonicalText) };
}

function receiptRef(value, idField, digestField) {
  return { id: value[idField], schema: value.schema, sha256: value[digestField] };
}

const DEFINITIONS = [
  {
    slug: 'baseline-no-new-stop',
    capabilityId: 'simulation.baseline.capsule.verify',
    claimId: 'baseline-no-new-stop-human-benefit',
    claimStatement: 'A human steward spends less effort reviewing recursive no-change output.',
    protocolId: 'baseline-no-new-stop-local-steward-20260819',
    packetId: 'baseline-no-new-stop-local-steward-participant-packet-20260819',
    baseline: {
      surface: 'REQUEST_DRIVEN_REGENERATION_WITHOUT_EXACT_CHANGE_GATE',
      shown: ['a request to run again', 'a newly produced output label', 'a completion message'],
      notShown: ['an exact comparison to the current baseline', 'whether any new information exists', 'a zero-generation reuse decision'],
      decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE when deciding whether the generated work is justified.'
    },
    candidate: {
      surface: 'EXACT_CHANGE_GATED_REUSE_OR_BOUNDED_BUILD',
      shown: ['exact baseline identity', 'exact declared information identity', 'comparison state', 'generation count', 'REUSE_EXISTING or bounded-build disposition'],
      notShown: ['a claim that no-change reuse is a human benefit by itself'],
      decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE using the explicit comparison and stop disposition.'
    },
    trials: [
      ['baseline-review-1', 'baseline-request-only-1', 'condition-a', 1, 'Condition A: a repeated request produced another package, but no exact comparison to the current baseline is shown. Acceptance requires a demonstrated change. Continue, hold, or mark unsure?', 'HOLD'],
      ['baseline-review-2', 'baseline-exact-no-new-1', 'condition-b', 2, 'Condition B: exact baseline and information identities match the prior run; disposition is REUSE_EXISTING and generated output count is zero. The review requires avoiding unjustified duplicate work. Continue, hold, or mark unsure?', 'CONTINUE'],
      ['baseline-review-3', 'baseline-identity-mismatch-1', 'condition-b', 3, 'Condition B: the supplied baseline identity differs from the declared comparison target; disposition is HOLD and generation count is zero. The review requires the exact target baseline. Continue, hold, or mark unsure?', 'HOLD'],
      ['baseline-review-4', 'baseline-new-label-only-1', 'condition-a', 4, 'Condition A: an output has a newer timestamp and revised label, but no baseline bytes or declared information were compared. Acceptance requires evidence of a meaningful change. Continue, hold, or mark unsure?', 'HOLD'],
      ['baseline-review-5', 'baseline-complete-no-stop-proof-1', 'condition-a', 5, 'Condition A: the run reports complete after generating several files, but gives no generation count contract or no-new-information stop evidence. Acceptance requires bounded non-recursive behavior. Continue, hold, or mark unsure?', 'HOLD'],
      ['baseline-review-6', 'baseline-exact-change-1', 'condition-b', 6, 'Condition B: an exact declared input digest changed, the target baseline still matches, and one bounded candidate is produced with the change recorded. The review requires an evidenced change and bounded output. Continue, hold, or mark unsure?', 'CONTINUE']
    ]
  },
  {
    slug: 'research-grounded-disposition',
    capabilityId: 'simulation.run-envelope.verify',
    claimId: 'public-research-replay-human-benefit',
    claimStatement: 'A human steward gains clearer understanding or better decisions from the grounded research disposition.',
    protocolId: 'research-grounded-disposition-local-steward-20260819',
    packetId: 'research-grounded-disposition-local-steward-participant-packet-20260819',
    baseline: {
      surface: 'MODEL_CONSENSUS_AND_STATUS_SHORTCUT',
      shown: ['model agreement count', 'confident recommendation language', 'a proposed status label'],
      notShown: ['exact artifact provenance', 'claim-specific verifier evidence', 'retained versus rejected disposition', 'authority boundaries'],
      decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE when deciding whether a research proposal is grounded enough to retain or use.'
    },
    candidate: {
      surface: 'SOURCE_GROUNDED_DISPOSITION_WITH_EXPLICIT_BOUNDARIES',
      shown: ['exact source references', 'retained signals', 'rejected or deferred proposals', 'claim-specific evidence limits', 'authority and refresh boundaries'],
      notShown: ['a claim that model agreement establishes truth', 'automatic promotion or recursive authority'],
      decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE using the explicit evidence and disposition.'
    },
    trials: [
      ['research-review-1', 'research-consensus-only-1', 'condition-a', 1, 'Condition A: four models agree that a proposal should be adopted, but no exact source or verifier is shown. Adoption requires claim-specific evidence. Continue, hold, or mark unsure?', 'HOLD'],
      ['research-review-2', 'research-supported-signal-1', 'condition-b', 2, 'Condition B: an exact artifact is referenced, the supported signal is separated from broader speculation, and limitations are explicit. Retention requires traceable support without promotion. Continue, hold, or mark unsure?', 'CONTINUE'],
      ['research-review-3', 'research-boundary-conflict-1', 'condition-b', 3, 'Condition B: a proposal would let generated modules promote themselves, and the disposition explicitly rejects it as conflicting with the root boundary. Use requires preserving that boundary. Continue, hold, or mark unsure?', 'HOLD'],
      ['research-review-4', 'research-status-only-1', 'condition-a', 4, 'Condition A: a model-written report labels a capability WORKING, but supplies no runtime or claim-specific verifier evidence. Use requires evidence that can prove the claim. Continue, hold, or mark unsure?', 'HOLD'],
      ['research-review-5', 'research-future-assumption-1', 'condition-a', 5, 'Condition A: a confident recommendation depends on an unspecified future state and provides no refresh trigger or exact baseline. Use requires a current grounded disposition. Continue, hold, or mark unsure?', 'HOLD'],
      ['research-review-6', 'research-grounded-reuse-1', 'condition-b', 6, 'Condition B: exact sources, provenance, retained signals, refusals, and a no-new-information reuse decision are recorded without granting consensus truth. Use requires traceable bounded reuse. Continue, hold, or mark unsure?', 'CONTINUE']
    ]
  },
  {
    slug: 'workspace-local-package-route',
    capabilityId: 'test.tool-forge.package-proof.workspace-local-route',
    claimId: 'workspace-local-package-proof-human-benefit',
    claimStatement: "The repaired route reduces a human steward's confusion, cleanup burden, or cross-drive surprise.",
    protocolId: 'workspace-local-package-route-local-steward-20260819',
    packetId: 'workspace-local-package-route-local-steward-participant-packet-20260819',
    baseline: {
      surface: 'HOST_TEMP_SUCCESS_WITHOUT_ROUTE_OR_CLEANUP_PROOF',
      shown: ['process exit code', 'package creation success message', 'host temporary path when noticed'],
      notShown: ['workspace-drive route', 'exact byte readback', 'post-run deletion result'],
      decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE when deciding whether package proof completed without hidden cross-drive residue.'
    },
    candidate: {
      surface: 'WORKSPACE_LOCAL_TRANSIENT_ROUTE_WITH_EXACT_LIFECYCLE_PROOF',
      shown: ['resolved workspace-local scratch path', 'exact package byte readback', 'cleanup result', 'post-run non-existence check'],
      notShown: ['a claim about browser or host-controlled download destinations'],
      decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE using the explicit route and lifecycle proof.'
    },
    trials: [
      ['package-review-1', 'package-host-temp-1', 'condition-a', 1, 'Condition A: a D-rooted repository test exits zero after writing its proof archive under host TEMP on C; deletion is not checked. Acceptance requires no hidden cross-drive residue. Continue, hold, or mark unsure?', 'HOLD'],
      ['package-review-2', 'package-local-clean-1', 'condition-b', 2, 'Condition B: the proof archive is created under the D workspace scratch lane, exact bytes are read, deletion succeeds, and post-run non-existence is verified. Acceptance requires workspace-local transient proof. Continue, hold, or mark unsure?', 'CONTINUE'],
      ['package-review-3', 'package-cleanup-failed-1', 'condition-b', 3, 'Condition B: the route is workspace-local and exact bytes were read, but the cleanup check finds the archive still present. Acceptance requires removal before return. Continue, hold, or mark unsure?', 'HOLD'],
      ['package-review-4', 'package-exit-zero-c-route-1', 'condition-a', 4, 'Condition A: all assertions pass, but the only returned artifact path is under C\\Temp and no cleanup evidence is included. Acceptance requires a D-local transient lifecycle. Continue, hold, or mark unsure?', 'HOLD'],
      ['package-review-5', 'package-message-only-1', 'condition-a', 5, 'Condition A: a wrapper says package proof complete, but exposes neither the resolved path nor exact byte readback nor deletion status. Acceptance requires route and lifecycle evidence. Continue, hold, or mark unsure?', 'HOLD'],
      ['package-review-6', 'package-hostile-temp-contained-1', 'condition-b', 6, 'Condition B: even with TEMP and TMP pointing to C, the proof resolves under the D workspace scratch lane, reads exact bytes, removes the archive, and verifies absence. Acceptance requires resistance to hostile host-temp routing. Continue, hold, or mark unsure?', 'CONTINUE']
    ]
  }
];

function buildSurface(definition, role) {
  const source = role === 'baseline' ? definition.baseline : definition.candidate;
  return {
    schema: 'axm.human-benefit-comparison-surface/v1',
    version: '0.1.0',
    capabilityId: definition.capabilityId,
    claimId: definition.claimId,
    conditionLabel: role === 'baseline' ? 'Condition A' : 'Condition B',
    surface: source.surface,
    shown: source.shown,
    notShown: source.notShown,
    decision: source.decision,
    truth: {
      conditionRoleDisclosedToParticipant: false,
      expectedDecisionsDisclosedToParticipant: false,
      humanOutcomeClaimed: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    }
  };
}

function findCurrent(portfolio, capabilityId) {
  const latest = portfolio.latest.find((item) => item.capabilityId === capabilityId);
  if (!latest) throw new Error('current portfolio lacks capability ' + capabilityId);
  const outcome = portfolio.outcomes.find((item) => item.outcomeId === latest.effectiveOutcomeId);
  if (!outcome) throw new Error('current portfolio lacks effective outcome ' + latest.effectiveOutcomeId);
  const humanClaim = outcome.claims.find((claim) => claim.beneficiary === 'HUMAN');
  if (!humanClaim || humanClaim.admittedVerdict !== 'NOT_RUN' || humanClaim.routeStatus !== 'NOT_PROVEN') {
    throw new Error('current human claim is not an unrun route for ' + capabilityId);
  }
  return { latest, outcome, humanClaim };
}

function buildProtocol(definition, surfaces) {
  return Human.buildProtocol({
    protocolId: definition.protocolId,
    generatedAt: GENERATED_AT,
    fixtureMode: 'LIVE',
    claim: {
      id: definition.claimId,
      statement: definition.claimStatement,
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: SCOPE
    },
    conditions: [
      {
        id: 'condition-a', role: 'BASELINE', label: 'Condition A',
        artifactRef: Human.reference(pretty(surfaces.baseline), { id: definition.slug + '-condition-a-surface', schema: surfaces.baseline.schema })
      },
      {
        id: 'condition-b', role: 'CANDIDATE', label: 'Condition B',
        artifactRef: Human.reference(pretty(surfaces.candidate), { id: definition.slug + '-condition-b-surface', schema: surfaces.candidate.schema })
      }
    ],
    trials: definition.trials.map(([id, caseId, conditionId, order, prompt, expectedDecision]) => ({
      id, caseId, conditionId, order, prompt, expectedDecision
    })),
    fairness: { maximumSameConditionRun: 2 },
    successRule: {
      minimumCompletedSessions: 1,
      minimumCandidateAccuracyGain: 0,
      maximumCandidateUnsupportedContinueRate: 0,
      maximumCandidateMeanTimeRatio: 1.25,
      minimumHelpedFraction: 1,
      requireNoHighBurden: true
    }
  });
}

function buildParticipantPacket(definition, current, protocol) {
  const conditionLabels = new Map(protocol.conditions.map((condition) => [condition.id, condition.label]));
  const packet = {
    schema: 'axm.human-benefit-participant-packet/v1',
    version: '0.1.0',
    packetId: definition.packetId,
    generatedAt: protocol.generatedAt,
    capabilityBinding: {
      capabilityId: definition.capabilityId,
      humanClaimId: definition.claimId,
      protocolRef: receiptRef(protocol, 'protocolId', 'protocolDigest'),
      cycleRef: receiptRef(current.outcome.cycleReceipt, 'cycleId', 'receiptDigest'),
      currentOutcomeRef: receiptRef(current.outcome, 'outcomeId', 'receiptDigest')
    },
    protocolRef: receiptRef(protocol, 'protocolId', 'protocolDigest'),
    status: 'READY_FOR_VOLUNTARY_HUMAN_SESSION',
    notices: [
      'Participation is optional. Stopping or withdrawing does not count as failure.',
      'The packet records only structured choices, confidence, confusion, elapsed milliseconds, effect and burden.',
      'Do not enter a name, email address, free-text comment, audio, video or screen recording.',
      'This one-person result can describe only the participating local steward.',
      'The condition roles and expected decisions are intentionally absent from this participant packet.',
      'The exact protocol reference must accompany an external response so responses cannot cross capability routes.'
    ],
    trials: protocol.trials.map((trial) => ({
      trialId: trial.id,
      order: trial.order,
      conditionLabel: conditionLabels.get(trial.conditionId),
      prompt: trial.prompt,
      responseFields: {
        decision: ['CONTINUE', 'HOLD', 'UNSURE'],
        confidence: 'integer 1 to 5',
        confusion: ['NONE', 'SOME', 'BLOCKED'],
        elapsedMs: 'integer 0 to 3600000'
      }
    })),
    completionFields: {
      effect: ['HELPED', 'HARMED', 'NO_MEANINGFUL_DIFFERENCE', 'UNSURE'],
      burden: ['LOW', 'ACCEPTABLE', 'HIGH'],
      confidence: 'integer 1 to 5'
    },
    responseBoundary: {
      schema: 'axm.human-benefit-response-input/v1',
      exactProtocolRefRequired: true,
      externalToWorkshopRepository: true,
      structuredNoFreeText: true
    },
    outputBoundary: {
      writesAutomatically: false,
      sendsToNetwork: false,
      authenticatesHuman: false,
      createsHumanBenefitVerdict: false
    },
    packetDigest: null
  };
  const payload = JSON.parse(JSON.stringify(packet));
  delete payload.packetDigest;
  packet.packetDigest = Human.sha256(payload);
  return packet;
}

function verifyParticipantPacket(protocol, packet) {
  const serialized = Human.stableStringify(packet);
  const forbidden = ['expectedDecision', '\"BASELINE\"', '\"CANDIDATE\"', 'artifactRef'];
  const leaks = forbidden.filter((token) => serialized.includes(token));
  const exactProtocol = packet && packet.protocolRef
    && packet.protocolRef.id === protocol.protocolId
    && packet.protocolRef.schema === protocol.schema
    && packet.protocolRef.sha256 === protocol.protocolDigest;
  const digestPayload = JSON.parse(JSON.stringify(packet));
  const recordedDigest = digestPayload.packetDigest;
  delete digestPayload.packetDigest;
  return { pass: leaks.length === 0 && exactProtocol && recordedDigest === Human.sha256(digestPayload), leaks, exactProtocol };
}

function buildNewRoute(definition, portfolio) {
  const current = findCurrent(portfolio, definition.capabilityId);
  if (current.humanClaim.id !== definition.claimId) throw new Error('claim binding changed for ' + definition.capabilityId);
  const surfaces = { baseline: buildSurface(definition, 'baseline'), candidate: buildSurface(definition, 'candidate') };
  const protocol = buildProtocol(definition, surfaces);
  const packet = buildParticipantPacket(definition, current, protocol);
  const protocolCheck = Human.verifyProtocol(protocol);
  const packetCheck = verifyParticipantPacket(protocol, packet);
  if (!protocolCheck.pass) throw new Error('protocol invalid for ' + definition.capabilityId + ': ' + protocolCheck.errors.join('; '));
  if (!packetCheck.pass) throw new Error('participant packet invalid for ' + definition.capabilityId + ': ' + packetCheck.leaks.join(', '));
  return { definition, current, surfaces, protocol, packet, provenance: 'NEW_SCOPED_ROUTE' };
}

function buildSourceClosureRoute(portfolio) {
  const current = findCurrent(portfolio, 'evidence.registered-source-closure/v1');
  const exact = CurrentSourceClosure.loadExact();
  const built = CurrentSourceClosure.buildCurrentProtocol();
  if (Human.stableStringify(built) !== Human.stableStringify(exact.protocol)) throw new Error('existing source-closure protocol drifted');
  const packetCheck = CurrentSourceClosure.verifyParticipantPacket(built, exact.packet);
  if (!packetCheck.pass) throw new Error('existing source-closure packet drifted or leaks answers');
  if (current.humanClaim.id !== built.claim.id) throw new Error('existing source-closure claim no longer binds current portfolio');
  return {
    definition: {
      slug: 'source-closure', capabilityId: current.outcome.capabilityId,
      claimId: built.claim.id, protocolId: built.protocolId, packetId: exact.packet.packetId
    },
    current,
    protocol: exact.protocol,
    packet: exact.packet,
    provenance: 'REUSED_EXACT_EXISTING_ROUTE'
  };
}

function bridgeReadiness(route) {
  const cycle = route.current.outcome.cycleReceipt;
  const candidateRef = cycle.candidate && cycle.candidate.artifactRef;
  const reusedRef = cycle.gap && cycle.gap.existingCapabilityRef;
  if (candidateRef) {
    return {
      state: 'WAITING_FOR_LIVE_HUMAN_EVIDENCE',
      currentCoreAncestrySupported: true,
      capabilitySurfaceRef: candidateRef,
      limitation: 'No LIVE native evaluation, explicit human judgment, source-trust declaration, intervention link, or current bridge closure exists.'
    };
  }
  return {
    state: 'BLOCKED_BY_REUSE_EXISTING_ANCESTRY',
    currentCoreAncestrySupported: false,
    capabilitySurfaceRef: reusedRef || null,
    limitation: 'The current grounded bridge accepts cycle.candidate.artifactRef only; this verified REUSE_EXISTING cycle carries its surface at cycle.gap.existingCapabilityRef.'
  };
}

function buildReadiness(portfolio, routes) {
  const routeReceipts = routes.map((route) => ({
    capabilityId: route.definition.capabilityId,
    humanClaimId: route.definition.claimId,
    protocolProvenance: route.provenance,
    protocolRef: receiptRef(route.protocol, 'protocolId', 'protocolDigest'),
    participantPacketRef: {
      id: route.packet.packetId,
      schema: route.packet.schema,
      sha256: route.packet.packetDigest
    },
    currentCycleRef: receiptRef(route.current.outcome.cycleReceipt, 'cycleId', 'receiptDigest'),
    currentOutcomeRef: receiptRef(route.current.outcome, 'outcomeId', 'receiptDigest'),
    protocolState: 'READY_FOR_VOLUNTARY_INPUT',
    humanEvidenceState: 'NOT_RUN',
    humanBenefitEstablished: false,
    groundedBridge: bridgeReadiness(route)
  }));
  const bridgeSupported = routeReceipts.filter((route) => route.groundedBridge.currentCoreAncestrySupported).length;
  const receipt = {
    schema: 'axm.human-benefit-portfolio-readiness-receipt/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'VOLUNTARY_PROTOCOL_COVERAGE_READY_BRIDGE_PARTIAL',
    portfolioRef: rawRef(PORTFOLIO_RELATIVE, portfolio.portfolioId, portfolio.schema),
    capabilityComparison: {
      before: {
        currentCapabilityChains: 4,
        concreteVoluntaryProtocolRoutes: 1,
        answerFreeParticipantPackets: 1,
        currentBridgeAncestrySupported: 2,
        establishedHumanBenefits: 0
      },
      after: {
        currentCapabilityChains: routes.length,
        concreteVoluntaryProtocolRoutes: routes.length,
        answerFreeParticipantPackets: routes.length,
        currentBridgeAncestrySupported: bridgeSupported,
        currentBridgeAncestryBlocked: routes.length - bridgeSupported,
        establishedHumanBenefits: 0
      }
    },
    routes: routeReceipts,
    collectionBoundary: {
      selectorRequired: true,
      exactProtocolRefRequiredForExternalResponse: true,
      responseMustStayOutsideWorkshopRepository: true,
      interactiveRouteRequiresLocalTty: true,
      pipedOrAutomatedInteractiveInputRefused: true,
      withdrawalRetainsParticipantRef: false,
      withdrawalRetainsObservations: false,
      syntheticCanBecomeLive: false,
      crossCapabilityResponseAccepted: false
    },
    nextGate: {
      authority: 'VOLUNTARY_LOCAL_HUMAN',
      action: 'A person may independently select one capability packet, opt in, complete or withdraw, and later make an explicit claim-scoped judgment. No participation is requested by this receipt.',
      automatic: false,
      requiredForHumanBenefitClaim: true
    },
    unresolvedTechnicalGate: {
      capabilityIds: routeReceipts.filter((route) => !route.groundedBridge.currentCoreAncestrySupported).map((route) => route.capabilityId),
      reason: 'The current grounded bridge has no exact ancestry route for REUSE_EXISTING capability cycles.',
      humanParticipationShouldWaitForBridgeRepair: true
    },
    truth: {
      readinessOnly: true,
      humanParticipationOccurred: false,
      sessionReceiptCreated: false,
      evaluationReceiptCreated: false,
      humanJudgmentCreated: false,
      groundedOutcomeRefreshed: false,
      humanBenefitClaimed: false,
      humanBenefitEstablished: false,
      cohortClaimed: false,
      sourceAuthenticationClaimed: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    sourceRefs: [
      rawRef('shared/human-benefit-evidence/human-benefit-evidence.js', 'human-benefit-evidence-core', 'text/javascript'),
      rawRef('shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js', 'grounded-growth-human-bridge-core', 'text/javascript'),
      rawRef(SOURCE_CLOSURE_PROTOCOL_RELATIVE, 'existing-source-closure-protocol-file', Human.PROTOCOL_SCHEMA),
      rawRef(SOURCE_CLOSURE_PACKET_RELATIVE, 'existing-source-closure-packet-file', 'axm.human-benefit-participant-packet/v1')
    ],
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Human.sha256(payload);
  return receipt;
}

function buildRequirements() {
  return {
    requirements: [
      {
        id: 'portfolio-voluntary-protocol-coverage',
        capabilities: ['human.protocol.every-current-chain', 'human.packet.answer-free', 'human.route.capability-bind'],
        required: true
      },
      {
        id: 'consent-retention-and-automation-boundary',
        capabilities: ['human.consent.voluntary', 'human.withdrawal.no-retention', 'human.response.external-only', 'human.interactive.tty-only'],
        required: true
      },
      {
        id: 'grounded-human-bridge-coverage',
        capabilities: ['human.bridge.candidate-ancestry', 'human.bridge.reuse-existing-ancestry'],
        required: true
      },
      {
        id: 'authority-preservation',
        capabilities: ['authority.human-steward.preserve'],
        required: true
      },
      {
        id: 'live-human-beneficiary-outcome',
        capabilities: ['growth.human-evidence.live'],
        required: false
      }
    ]
  };
}

function buildInventory() {
  return {
    capabilities: [
      { id: 'human.protocol.every-current-chain', status: 'available', constraints: ['Four exact one-person protocols; one reused and three newly scoped.'] },
      { id: 'human.packet.answer-free', status: 'available', constraints: ['Four packets omit condition roles, expected decisions, and artifact references.'] },
      { id: 'human.route.capability-bind', status: 'available', constraints: ['External responses require the exact selected protocol reference; cross-capability input is refused.'] },
      { id: 'human.consent.voluntary', status: 'available', constraints: ['Only VOLUNTARY_OPT_IN is accepted and no session starts automatically.'] },
      { id: 'human.withdrawal.no-retention', status: 'available', constraints: ['Withdrawal receipts omit participant reference, observations, and participant judgment.'] },
      { id: 'human.response.external-only', status: 'available', constraints: ['Live response input inside the Workshop repository is refused.'] },
      { id: 'human.interactive.tty-only', status: 'available', constraints: ['Piped or automated interactive input is refused before prompting.'] },
      { id: 'human.bridge.candidate-ancestry', status: 'available', constraints: ['Current bridge contract recognizes the two current cycles with cycle.candidate.artifactRef; LIVE evidence is still NOT_RUN.'] },
      { id: 'human.bridge.reuse-existing-ancestry', status: 'degraded', constraints: ['Current bridge contract does not recognize cycle.gap.existingCapabilityRef for two REUSE_EXISTING cycles.'] },
      { id: 'authority.human-steward.preserve', status: 'available', constraints: ['No participation request, verdict, execution, install, permission, promotion, merge, CANON, or Foundation authority.'] },
      { id: 'growth.human-evidence.live', status: 'degraded', constraints: ['No person opted in; no LIVE session, evaluation, judgment, or Grounded Growth refresh exists.'] }
    ]
  };
}

function buildGapReport(requirements, inventory) {
  const byId = new Map(inventory.capabilities.map((capability) => [capability.id, capability]));
  const rows = requirements.requirements.map((requirement) => {
    const capabilities = requirement.capabilities.map((id) => byId.get(id) || { id, status: 'missing', constraints: [] });
    const available = capabilities.filter((item) => item.status === 'available').map((item) => item.id);
    const degraded = capabilities.filter((item) => item.status === 'degraded').map((item) => item.id);
    const unknown = capabilities.filter((item) => item.status === 'unknown').map((item) => item.id);
    const missing = capabilities.filter((item) => item.status === 'missing').map((item) => item.id);
    const status = missing.length ? 'BLOCKED' : degraded.length ? 'DEGRADED' : unknown.length ? (requirement.required ? 'UNKNOWN' : 'OPTIONAL_UNKNOWN') : 'READY';
    return {
      id: requirement.id,
      required: requirement.required,
      status,
      available,
      degraded,
      unknown,
      missing,
      declaredConstraints: Object.fromEntries(capabilities.map((item) => [item.id, item.constraints]))
    };
  });
  return {
    schema: 'capability-gap-report/v1',
    overall: rows.some((row) => row.required && row.status === 'BLOCKED') ? 'BLOCKED' : rows.some((row) => row.required && row.status !== 'READY') ? 'DEGRADED' : 'READY',
    requirements: rows,
    missingCapabilities: rows.flatMap((row) => row.missing),
    proposedHands: [{
      id: 'reuse-existing-human-bridge-ancestry-adapter',
      status: 'PROPOSED_NOT_BUILT',
      purpose: 'Admit exact REUSE_EXISTING ancestry without inventing a candidate or weakening LIVE, scope, trust, closure, or authority gates.'
    }]
  };
}

function buildAll() {
  const portfolio = readJson(PORTFOLIO_RELATIVE);
  const portfolioCheck = Growth.verifyPortfolio(portfolio);
  if (!portfolioCheck.pass) throw new Error('current Grounded Growth portfolio invalid: ' + portfolioCheck.errors.join('; '));
  if (portfolio.latest.length !== 4) throw new Error('expected four current capability chains; found ' + portfolio.latest.length);
  const routes = [buildSourceClosureRoute(portfolio), ...DEFINITIONS.map((definition) => buildNewRoute(definition, portfolio))];
  if (new Set(routes.map((route) => route.definition.capabilityId)).size !== portfolio.latest.length) throw new Error('route coverage is not one-to-one');
  const requirements = buildRequirements();
  const inventory = buildInventory();
  return {
    portfolio,
    routes,
    requirements,
    inventory,
    gapReport: buildGapReport(requirements, inventory),
    readiness: buildReadiness(portfolio, routes)
  };
}

function outputFiles(result) {
  const files = new Map();
  for (const route of result.routes.filter((item) => item.provenance === 'NEW_SCOPED_ROUTE')) {
    const slug = route.definition.slug;
    files.set('surfaces/' + slug + '-condition-a.json', route.surfaces.baseline);
    files.set('surfaces/' + slug + '-condition-b.json', route.surfaces.candidate);
    files.set('protocols/' + slug + '-protocol.json', route.protocol);
    files.set('packets/' + slug + '-participant-packet.json', route.packet);
  }
  files.set('CAPABILITY_REQUIREMENTS.json', result.requirements);
  files.set('CAPABILITY_INVENTORY.json', result.inventory);
  files.set('CAPABILITY_GAP_REPORT.json', result.gapReport);
  files.set('PORTFOLIO_READINESS_RECEIPT.json', result.readiness);
  return files;
}

function writeAll() {
  const result = buildAll();
  for (const [relativePath, value] of outputFiles(result)) {
    const target = path.join(__dirname, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pretty(value), 'utf8');
  }
  return result;
}

function loadRecordedRoute(capabilityId) {
  if (capabilityId === 'evidence.registered-source-closure/v1') {
    return { protocol: readJson(SOURCE_CLOSURE_PROTOCOL_RELATIVE), packet: readJson(SOURCE_CLOSURE_PACKET_RELATIVE) };
  }
  const definition = DEFINITIONS.find((item) => item.capabilityId === capabilityId);
  if (!definition) throw new Error('unsupported capability route: ' + capabilityId);
  return {
    protocol: JSON.parse(fs.readFileSync(path.join(__dirname, 'protocols', definition.slug + '-protocol.json'), 'utf8')),
    packet: JSON.parse(fs.readFileSync(path.join(__dirname, 'packets', definition.slug + '-participant-packet.json'), 'utf8'))
  };
}

function loadRecordedRoutes() {
  const portfolio = readJson(PORTFOLIO_RELATIVE);
  const sourceProtocol = readJson(SOURCE_CLOSURE_PROTOCOL_RELATIVE);
  const sourcePacket = readJson(SOURCE_CLOSURE_PACKET_RELATIVE);
  const sourceDefinition = {
    slug: 'source-closure',
    capabilityId: 'evidence.registered-source-closure/v1',
    claimId: sourceProtocol.claim.id,
    protocolId: sourceProtocol.protocolId,
    packetId: sourcePacket.packetId
  };
  return [sourceDefinition, ...DEFINITIONS].map((definition) => {
    const recordedRoute = loadRecordedRoute(definition.capabilityId);
    const current = findCurrent(portfolio, definition.capabilityId);
    const protocolCheck = Human.verifyProtocol(recordedRoute.protocol);
    const packetCheck = verifyParticipantPacket(recordedRoute.protocol, recordedRoute.packet);
    if (!protocolCheck.pass || !packetCheck.pass) {
      throw new Error('recorded portfolio route invalid for ' + definition.capabilityId);
    }
    return {
      definition,
      current,
      protocol: recordedRoute.protocol,
      packet: recordedRoute.packet,
      provenance: definition.capabilityId === 'evidence.registered-source-closure/v1'
        ? 'REUSED_EXACT_EXISTING_ROUTE'
        : 'NEW_SCOPED_ROUTE'
    };
  });
}

function verifyRecorded() {
  const result = buildAll();
  const expected = outputFiles(result);
  for (const [relativePath, value] of expected) {
    const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, ...relativePath.split('/')), 'utf8'));
    if (Human.stableStringify(recorded) !== Human.stableStringify(value)) throw new Error(relativePath + ' differs from exact current sources');
  }
  return result;
}

function main() {
  if (process.argv.includes('--write')) {
    const result = writeAll();
    console.log('WROTE ' + outputFiles(result).size + ' exact readiness artifacts; human participation NOT_RUN');
    return;
  }
  if (process.argv.includes('--check-recorded')) {
    const result = verifyRecorded();
    console.log('PASS exact portfolio readiness covers ' + result.routes.length + ' capability chains; human participation NOT_RUN');
    return;
  }
  console.log(pretty(buildAll().readiness));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFINITIONS,
  buildAll,
  buildParticipantPacket,
  verifyParticipantPacket,
  loadRecordedRoute,
  loadRecordedRoutes,
  verifyRecorded,
  writeAll
};
