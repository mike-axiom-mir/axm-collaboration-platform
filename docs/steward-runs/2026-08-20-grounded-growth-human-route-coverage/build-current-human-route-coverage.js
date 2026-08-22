#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Coverage = require('../../../shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const PriorRoutes = require('../2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness');

const ROOT = path.resolve(__dirname, '../../..');
const LANE = 'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage';
const PORTFOLIO_PATH = 'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/CURRENT_PORTFOLIO.json';
const LINEAGE_PATH = 'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/CURRENT_SIGNAL_LINEAGE_RECEIPT.json';
const DISPOSITION_PATH = 'docs/steward-runs/2026-08-19-public-baseline-research-run/RESEARCH_DISPOSITION.json';
const PRIOR_READINESS_PATH = 'docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json';
const RUNNER_PATH = LANE + '/run-current-human-route-interactive.js';
const SOURCE_CLOSURE_BASELINE_PATH = 'docs/steward-runs/2026-08-19-human-benefit-readiness/baseline-surface.json';
const SOURCE_CLOSURE_CANDIDATE_PATH = 'docs/steward-runs/2026-08-19-human-benefit-readiness/candidate-surface.json';
const SOURCE_CLOSURE_PROTOCOL_PATH = 'docs/steward-runs/2026-08-19-human-benefit-readiness/current-protocol.json';
const PROTOCOL_AT = '2026-08-20T01:01:00.000Z';
const LINK_AT = '2026-08-20T01:03:00.000Z';
const PACKET_AT = '2026-08-20T01:04:00.000Z';
const COVERAGE_AT = '2026-08-20T01:10:00.000Z';
const SCOPE = 'Any result applies only to the participating local AXM steward and cannot be generalized to other people.';

const DETACHED = {
  slug: 'detached-current-state-trust',
  capabilityId: 'growth.current-state.detached-integrity.verify',
  claimId: 'portable-current-state-human-benefit',
  claimStatement: 'A person makes fewer mistaken receipt-trust decisions when using the detached guard.',
  protocolId: 'detached-current-state-trust-local-steward-20260820',
  packetId: 'current-detached-current-state-trust-participant-packet-20260820',
  linkId: 'human-bridge-v2-detached-current-state-trust-20260820',
  baseline: {
    surface: 'SELF_CONSISTENT_RECEIPT_ACCEPTED_AS_SOURCE_TRUTH',
    shown: ['schema label', 'self digest', 'reported current-state label'],
    notShown: ['source-graph availability', 'source authenticity', 'source currentness', 'historical drift classification', 'lifecycle authority boundaries'],
    decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE when deciding whether a detached receipt supports the requested trust decision.'
  },
  candidate: {
    surface: 'DETACHED_INTEGRITY_WITH_EXPLICIT_SOURCE_TRUTH_LIMITS',
    shown: ['self-integrity verdict', 'internal coherence checks', 'authority boundary checks', 'source truth UNKNOWN without native graph', 'source currentness UNKNOWN without native graph'],
    notShown: ['a claim that coherent detached bytes authenticate their source', 'automatic installation, promotion, merge, or CANON authority'],
    decision: 'The reviewer chooses CONTINUE, HOLD, or UNSURE using the exact detached verdict and explicit trust ceiling.'
  },
  trials: [
    ['detached-trust-1', 'detached-self-consistent-forgery-1', 'condition-a', 1, 'Condition A: a receipt is internally self-consistent and labels itself CURRENT, but the native source graph is unavailable. The requested decision would treat it as authenticated source truth. Continue, hold, or mark unsure?', 'HOLD'],
    ['detached-trust-2', 'detached-bounded-format-use-1', 'condition-b', 2, 'Condition B: integrity and internal coherence pass, source truth and currentness are explicitly UNKNOWN, and the requested use is limited to checking the receipt format. Continue, hold, or mark unsure?', 'CONTINUE'],
    ['detached-trust-3', 'detached-tampered-digest-1', 'condition-b', 3, 'Condition B: the receipt digest does not match its content, so detached integrity fails before any source-truth question. Continue, hold, or mark unsure?', 'HOLD'],
    ['detached-trust-4', 'detached-status-only-1', 'condition-a', 4, 'Condition A: the receipt says TEST and CURRENT but provides no authority boundary and no distinction between integrity and authenticity. Use requires a bounded trust decision. Continue, hold, or mark unsure?', 'HOLD'],
    ['detached-trust-5', 'detached-view-drift-as-tamper-1', 'condition-a', 5, 'Condition A: a regenerated broad report changed, and every digest difference is called tampering without classifying mutable derived-view drift. The decision requires distinguishing history from a current view. Continue, hold, or mark unsure?', 'HOLD'],
    ['detached-trust-6', 'detached-authority-inflation-1', 'condition-b', 6, 'Condition B: a recomputed receipt sets installed and CANON authority true; the detached guard rejects the authority inflation even though the digest is coherent. Continue, hold, or mark unsure?', 'HOLD']
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileRef(relativePath, id, schema) {
  return {
    id,
    schema,
    sha256: Coverage.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function receiptRef(value, idField, digestField) {
  return { id: value[idField], schema: value.schema, sha256: value[digestField] };
}

function findCurrent(portfolio, capabilityId) {
  const latest = portfolio.latest.find((item) => item.capabilityId === capabilityId);
  if (!latest) throw new Error('current portfolio lacks capability ' + capabilityId);
  const outcome = portfolio.outcomes.find((item) => item.receiptDigest === latest.effectiveReceiptDigest);
  if (!outcome) throw new Error('current portfolio lacks effective outcome ' + latest.effectiveReceiptDigest);
  const humanClaim = outcome.claims.find((claim) => claim.beneficiary === 'HUMAN');
  if (!humanClaim || humanClaim.admittedVerdict !== 'NOT_RUN' || humanClaim.routeStatus !== 'NOT_PROVEN') {
    throw new Error('current human claim is not NOT_RUN / NOT_PROVEN for ' + capabilityId);
  }
  return { latest, outcome, humanClaim };
}

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

function buildProtocol(definition, surfaces) {
  return Human.buildProtocol({
    protocolId: definition.protocolId,
    generatedAt: PROTOCOL_AT,
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

function refreshProtocolClaim(route, current) {
  const protocol = route.protocol;
  if (route.definition.capabilityId !== 'evidence.registered-source-closure/v1') {
    throw new Error('claim refresh is not authorized for ' + route.definition.capabilityId);
  }
  if (protocol.claim.id !== current.humanClaim.id) throw new Error('claim refresh cannot change claim identity');
  return Human.buildProtocol({
    protocolId: 'evidence-source-closure-local-steward-20260820',
    generatedAt: PROTOCOL_AT,
    fixtureMode: 'LIVE',
    claim: {
      id: current.humanClaim.id,
      statement: current.humanClaim.statement,
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: SCOPE
    },
    conditions: clone(protocol.conditions),
    trials: clone(protocol.trials),
    fairness: { maximumSameConditionRun: protocol.fairness.maximumSameConditionRun },
    successRule: clone(protocol.successRule)
  });
}

function packetIdFor(definition) {
  return 'current-' + definition.slug + '-participant-packet-20260820';
}

function buildParticipantPacket(definition, current, protocol) {
  const conditionLabels = new Map(protocol.conditions.map((condition) => [condition.id, condition.label]));
  const protocolRef = receiptRef(protocol, 'protocolId', 'protocolDigest');
  const packet = {
    schema: Coverage.PACKET_SCHEMA,
    version: '0.1.0',
    packetId: packetIdFor(definition),
    generatedAt: PACKET_AT,
    capabilityBinding: {
      capabilityId: definition.capabilityId,
      humanClaimId: definition.claimId,
      protocolRef,
      cycleRef: receiptRef(current.outcome.cycleReceipt, 'cycleId', 'receiptDigest'),
      currentOutcomeRef: receiptRef(current.outcome, 'outcomeId', 'receiptDigest')
    },
    protocolRef,
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
  packet.packetDigest = Coverage.packetDigest(packet);
  return packet;
}

function gapReports() {
  const before = readJson(LANE + '/CAPABILITY_GAP_BEFORE.json');
  const after = readJson(LANE + '/CAPABILITY_GAP_AFTER.json');
  if (before.overall !== 'BLOCKED') throw new Error('before capability gap must remain BLOCKED');
  if (after.overall !== 'DEGRADED' || after.missingCapabilities.length !== 0) {
    throw new Error('after capability gap must be DEGRADED only by optional unknown evidence');
  }
  return { before, after };
}

function sourceRefs(portfolio, lineage) {
  return [
    fileRef('shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage.js', 'human-route-coverage-core', 'text/javascript'),
    fileRef('shared/grounded-growth-human-route-coverage/selftest.js', 'human-route-coverage-selftest', 'text/javascript'),
    fileRef('shared/human-benefit-evidence/human-benefit-evidence.js', 'human-benefit-evidence-core', 'text/javascript'),
    fileRef('shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js', 'grounded-growth-human-bridge-v2-core', 'text/javascript'),
    fileRef('shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js', 'grounded-growth-human-handoff-core', 'text/javascript'),
    fileRef(RUNNER_PATH, 'current-human-route-interactive-driver', 'text/javascript'),
    fileRef(LANE + '/build-current-human-route-coverage.js', 'current-human-route-coverage-builder', 'text/javascript'),
    fileRef(LANE + '/EVIDENCE_ROUTES.md', 'human-route-coverage-evidence-routes', 'text/markdown'),
    fileRef(LANE + '/CAPABILITY_GAP_BEFORE.json', 'human-route-coverage-gap-before', 'capability-gap-report/v1'),
    fileRef(LANE + '/CAPABILITY_GAP_AFTER.json', 'human-route-coverage-gap-after', 'capability-gap-report/v1'),
    fileRef(PRIOR_READINESS_PATH, 'prior-four-route-operational-readiness', 'axm.grounded-growth-human-handoff-readiness/v1'),
    fileRef(SOURCE_CLOSURE_BASELINE_PATH, 'registered-identity-surface', 'axm.human-benefit-comparison-surface/v1'),
    fileRef(SOURCE_CLOSURE_CANDIDATE_PATH, 'exact-closure-surface', 'axm.human-benefit-comparison-surface/v1'),
    fileRef(SOURCE_CLOSURE_PROTOCOL_PATH, 'prior-source-closure-protocol', Human.PROTOCOL_SCHEMA),
    receiptRef(portfolio, 'portfolioId', 'portfolioDigest'),
    receiptRef(lineage, 'lineageId', 'receiptDigest'),
    fileRef(DISPOSITION_PATH, 'public-baseline-research-disposition-file', 'axm.research-disposition/v1')
  ];
}

function buildAll() {
  const gaps = gapReports();
  const portfolio = readJson(PORTFOLIO_PATH);
  const portfolioCheck = Growth.verifyPortfolio(portfolio);
  if (!portfolioCheck.pass) throw new Error('current portfolio invalid: ' + portfolioCheck.errors.join('; '));
  if (portfolio.latest.length !== 6) throw new Error('expected six current capability chains');
  const lineage = readJson(LINEAGE_PATH);
  const deferred = lineage.proposals.find((proposal) => proposal.proposalId === 'proposal:signal-link-ledger');
  if (!deferred || deferred.state !== 'DEFERRED_NO_ACTION' || deferred.action !== 'NONE' ||
      deferred.implementedByThisReceipt !== false || deferred.automaticAction !== false) {
    throw new Error('signal-link ledger is no longer an exact deferred non-action');
  }

  const prior = PriorRoutes.verifyRecorded();
  if (prior.routes.length !== 4) throw new Error('expected four exact prior human routes');
  const runnerRef = fileRef(RUNNER_PATH, 'current-human-route-interactive-driver', 'text/javascript');
  const readyRoutes = prior.routes.map((route) => {
    const current = findCurrent(portfolio, route.definition.capabilityId);
    if (route.current.outcome.cycleReceipt.receiptDigest !== current.outcome.cycleReceipt.receiptDigest) {
      throw new Error('prior route cycle differs from current chain for ' + route.definition.capabilityId);
    }
    if (route.protocol.claim.id !== current.humanClaim.id) {
      throw new Error('prior protocol claim identity differs from current claim for ' + route.definition.capabilityId);
    }
    const claimMatches = route.protocol.claim.statement === current.humanClaim.statement;
    const protocol = claimMatches ? route.protocol : refreshProtocolClaim(route, current);
    const interventionLink = claimMatches ? route.link : Bridge.buildInterventionLink({
      linkId: 'human-bridge-v2-source-closure-20260820',
      generatedAt: LINK_AT,
      cycleReceipt: current.outcome.cycleReceipt,
      protocol
    });
    const packet = buildParticipantPacket(route.definition, current, protocol);
    return {
      capabilityId: route.definition.capabilityId,
      definition: route.definition,
      current,
      protocol,
      packet,
      interventionLink,
      runnerRef,
      provenance: claimMatches
        ? 'REUSED_PROTOCOL_AND_LINK_REBOUND_PACKET_TO_CURRENT_OUTCOME'
        : 'REUSED_SURFACES_AND_TRIALS_REFRESHED_PROTOCOL_AND_LINK_FOR_CURRENT_CLAIM'
    };
  });

  const detachedCurrent = findCurrent(portfolio, DETACHED.capabilityId);
  if (detachedCurrent.humanClaim.id !== DETACHED.claimId || detachedCurrent.humanClaim.statement !== DETACHED.claimStatement) {
    throw new Error('detached current-state human claim changed');
  }
  const detachedSurfaces = {
    baseline: buildSurface(DETACHED, 'baseline'),
    candidate: buildSurface(DETACHED, 'candidate')
  };
  const detachedProtocol = buildProtocol(DETACHED, detachedSurfaces);
  const detachedPacket = buildParticipantPacket(DETACHED, detachedCurrent, detachedProtocol);
  const detachedLink = Bridge.buildInterventionLink({
    linkId: DETACHED.linkId,
    generatedAt: LINK_AT,
    cycleReceipt: detachedCurrent.outcome.cycleReceipt,
    protocol: detachedProtocol
  });
  readyRoutes.push({
    capabilityId: DETACHED.capabilityId,
    definition: DETACHED,
    current: detachedCurrent,
    protocol: detachedProtocol,
    packet: detachedPacket,
    interventionLink: detachedLink,
    runnerRef,
    provenance: 'NEW_CLAIM_NATIVE_ROUTE'
  });

  const heldCurrent = findCurrent(portfolio, 'growth.knowledge-signal-lineage.verify');
  const heldRoutes = [{
    capabilityId: heldCurrent.outcome.capabilityId,
    reasonCode: 'DEFERRED_HUMAN_SURFACE_REQUIRES_STEWARD_DECISION',
    proposalId: deferred.proposalId,
    evidenceRefs: [
      receiptRef(lineage, 'lineageId', 'receiptDigest'),
      fileRef(DISPOSITION_PATH, 'public-baseline-research-disposition-file', 'axm.research-disposition/v1')
    ]
  }];
  const sources = sourceRefs(portfolio, lineage);
  const coverage = Coverage.build({
    receiptId: 'current-grounded-growth-human-route-coverage-20260820',
    generatedAt: COVERAGE_AT,
    status: 'TEST',
    portfolio,
    readyRoutes,
    heldRoutes,
    sourceRefs: sources
  });
  const coverageCheck = Coverage.verify(coverage, { portfolio, readyRoutes, heldRoutes, sourceRefs: sources });
  if (!coverageCheck.pass) throw new Error('current coverage failed native rebuild: ' + coverageCheck.errors.join('; '));
  if (coverage.coverage.readyRoutes !== 5 || coverage.coverage.heldRoutes !== 1 || coverage.coverage.humanPass !== 0) {
    throw new Error('unexpected current human-route coverage counts');
  }

  const catalog = {
    schema: 'axm.grounded-growth-human-route-catalog/v1',
    version: '0.1.0',
    catalogId: 'current-grounded-growth-human-route-catalog-20260820',
    generatedAt: COVERAGE_AT,
    status: 'TEST',
    coverageRef: receiptRef(coverage, 'receiptId', 'receiptDigest'),
    readyRoutes: readyRoutes.map((route) => ({
      capabilityId: route.capabilityId,
      humanClaimId: route.current.humanClaim.id,
      provenance: route.provenance,
      protocolRef: receiptRef(route.protocol, 'protocolId', 'protocolDigest'),
      participantPacketRef: receiptRef(route.packet, 'packetId', 'packetDigest'),
      interventionLinkRef: receiptRef(route.interventionLink, 'linkId', 'linkDigest'),
      sessionCommand: 'node ' + RUNNER_PATH + ' session ' + route.capabilityId,
      handoffCommand: 'node ' + RUNNER_PATH + ' handoff ' + route.capabilityId + ' <external-session-receipt.json>',
      humanEvidenceState: 'NOT_RUN'
    })).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)),
    heldRoutes: coverage.holds.map((hold) => ({
      capabilityId: hold.capabilityId,
      humanClaimId: hold.humanClaimId,
      reasonCode: hold.reasonCode,
      proposalId: hold.proposalId,
      requiredExternalEvent: hold.requiredExternalEvent,
      commandAvailable: false,
      humanEvidenceState: 'NOT_RUN'
    })),
    truth: {
      commandsRunAutomatically: false,
      participationStarted: false,
      humanBenefitEstablished: false,
      deferredSurfaceImplemented: false,
      sourceAuthenticationClaimed: false,
      writesAutomatically: false,
      sendsToNetwork: false,
      installsAutomatically: false,
      promotesAutomatically: false,
      canonizesAutomatically: false
    },
    catalogDigest: null
  };
  const catalogPayload = clone(catalog);
  delete catalogPayload.catalogDigest;
  catalog.catalogDigest = Coverage.sha256(catalogPayload);

  const summary = {
    schema: 'axm.grounded-growth-human-route-coverage-summary/v1',
    generatedAt: COVERAGE_AT,
    portfolioRef: receiptRef(portfolio, 'portfolioId', 'portfolioDigest'),
    coverageRef: receiptRef(coverage, 'receiptId', 'receiptDigest'),
    catalogRef: receiptRef(catalog, 'catalogId', 'catalogDigest'),
    capabilityGap: {
      before: gaps.before.overall,
      after: gaps.after.overall,
      requiredMissingAfter: gaps.after.missingCapabilities.length
    },
    routes: {
      currentCapabilityChains: 6,
      priorOperationalRoutes: 4,
      currentReadyRoutes: 5,
      currentHeldRoutes: 1,
      exactProtocolAndLinkReuse: 3,
      claimRefreshedRoutes: 1,
      newClaimNativeRoutes: 2,
      newSurfaceRoutes: 1,
      reboundCurrentPackets: 5,
      humanPass: 0,
      humanNotRun: 6
    },
    heldBoundary: {
      capabilityId: 'growth.knowledge-signal-lineage.verify',
      proposalId: 'proposal:signal-link-ledger',
      state: 'HELD_DEFERRED_HUMAN_SURFACE',
      proposalImplemented: false,
      requiresExplicitStewardDecision: true
    },
    decision: coverage.decision,
    truth: {
      technicalCoverageIsHumanBenefit: false,
      participationOccurred: false,
      liveEvidenceCreated: false,
      humanBenefitEstablished: false,
      sourceAuthenticationClaimed: false,
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      modelLearningClaimed: false
    },
    summaryDigest: null
  };
  const summaryPayload = clone(summary);
  delete summaryPayload.summaryDigest;
  summary.summaryDigest = Coverage.sha256(summaryPayload);

  return { gaps, portfolio, lineage, readyRoutes, heldRoutes, detachedSurfaces, coverage, catalog, summary };
}

function outputFiles(result) {
  const files = new Map([
    ['surfaces/' + DETACHED.slug + '-condition-a.json', result.detachedSurfaces.baseline],
    ['surfaces/' + DETACHED.slug + '-condition-b.json', result.detachedSurfaces.candidate],
    ['protocols/' + DETACHED.slug + '-protocol.json', result.readyRoutes.find((route) => route.capabilityId === DETACHED.capabilityId).protocol],
    ['links/' + DETACHED.slug + '-intervention-link.json', result.readyRoutes.find((route) => route.capabilityId === DETACHED.capabilityId).interventionLink],
    ['protocols/source-closure-current-claim-protocol.json', result.readyRoutes.find((route) => route.capabilityId === 'evidence.registered-source-closure/v1').protocol],
    ['links/source-closure-current-claim-intervention-link.json', result.readyRoutes.find((route) => route.capabilityId === 'evidence.registered-source-closure/v1').interventionLink],
    ['CURRENT_HUMAN_ROUTE_COVERAGE.json', result.coverage],
    ['CURRENT_HUMAN_ROUTE_CATALOG.json', result.catalog],
    ['CURRENT_SUMMARY.json', result.summary]
  ]);
  for (const route of result.readyRoutes) files.set('packets/' + route.definition.slug + '-participant-packet.json', route.packet);
  return files;
}

function writeAll() {
  const result = buildAll();
  for (const [relativePath, value] of outputFiles(result)) {
    const target = path.join(__dirname, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pretty(value), 'utf8');
  }
  return result;
}

function recorded() {
  const result = buildAll();
  for (const [relativePath, expected] of outputFiles(result)) {
    const actual = JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));
    if (Coverage.stableStringify(actual) !== Coverage.stableStringify(expected)) {
      throw new Error(relativePath + ' differs from exact current sources');
    }
  }
  return result;
}

function checkRecorded() {
  return recorded();
}

function loadRecordedCoverageRoute() {
  const portfolio = readJson(PORTFOLIO_PATH);
  const coverage = readJson(LANE + '/CURRENT_HUMAN_ROUTE_COVERAGE.json');
  const catalog = readJson(LANE + '/CURRENT_HUMAN_ROUTE_CATALOG.json');
  const recordedRows = new Map(coverage.routes.map((route) => [route.capabilityId, route]));
  const priorRoutes = PriorRoutes.loadRecordedRoutes();
  const readyRoutes = priorRoutes.map((route) => {
    const capabilityId = route.definition.capabilityId;
    const row = recordedRows.get(capabilityId);
    if (!row) throw new Error('recorded coverage lacks ready route ' + capabilityId);
    const sourceClosure = capabilityId === 'evidence.registered-source-closure/v1';
    const protocol = sourceClosure
      ? readJson(LANE + '/protocols/source-closure-current-claim-protocol.json')
      : route.protocol;
    const interventionLink = sourceClosure
      ? readJson(LANE + '/links/source-closure-current-claim-intervention-link.json')
      : route.link;
    return {
      capabilityId,
      protocol,
      packet: readJson(LANE + '/packets/' + route.definition.slug + '-participant-packet.json'),
      interventionLink,
      runnerRef: row.runnerRef
    };
  });
  const detachedRow = recordedRows.get(DETACHED.capabilityId);
  if (!detachedRow) throw new Error('recorded coverage lacks detached current-state route');
  readyRoutes.push({
    capabilityId: DETACHED.capabilityId,
    protocol: readJson(LANE + '/protocols/' + DETACHED.slug + '-protocol.json'),
    packet: readJson(LANE + '/packets/' + DETACHED.slug + '-participant-packet.json'),
    interventionLink: readJson(LANE + '/links/' + DETACHED.slug + '-intervention-link.json'),
    runnerRef: detachedRow.runnerRef
  });
  const heldRoutes = coverage.holds.map((hold) => ({
    capabilityId: hold.capabilityId,
    reasonCode: hold.reasonCode,
    proposalId: hold.proposalId,
    evidenceRefs: hold.evidenceRefs
  }));
  const check = Coverage.verify(coverage, {
    portfolio,
    readyRoutes,
    heldRoutes,
    sourceRefs: coverage.sourceRefs
  });
  if (!check.pass) throw new Error('recorded human-route coverage invalid: ' + check.errors.join('; '));
  return { portfolio, readyRoutes, heldRoutes, coverage, catalog };
}

if (require.main === module) {
  try {
    const result = process.argv.includes('--write') ? writeAll() : checkRecorded();
    process.stdout.write(JSON.stringify({
      state: result.coverage.state,
      currentChains: result.coverage.coverage.currentCapabilityChains,
      readyRoutes: result.coverage.coverage.readyRoutes,
      heldRoutes: result.coverage.coverage.heldRoutes,
      humanPass: result.coverage.coverage.humanPass,
      humanNotRun: result.coverage.coverage.humanNotRun,
      gapBefore: result.gaps.before.overall,
      gapAfter: result.gaps.after.overall,
      deferredSurfaceImplemented: result.coverage.truth.deferredProposalImplemented,
      digest: result.coverage.receiptDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  LANE,
  PORTFOLIO_PATH,
  LINEAGE_PATH,
  DISPOSITION_PATH,
  RUNNER_PATH,
  DETACHED,
  readJson,
  fileRef,
  receiptRef,
  findCurrent,
  buildParticipantPacket,
  refreshProtocolClaim,
  gapReports,
  buildAll,
  outputFiles,
  writeAll,
  recorded,
  checkRecorded,
  loadRecordedCoverageRoute
};
