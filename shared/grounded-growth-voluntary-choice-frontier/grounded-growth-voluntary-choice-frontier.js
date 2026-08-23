#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const Current = require('../grounded-growth-current-state/grounded-growth-current-state');
const Coverage = require('../grounded-growth-human-route-coverage/grounded-growth-human-route-coverage');
const DeterministicJson = require('../../tools/deterministic-json-core');

const RECEIPT_SCHEMA = 'axm.grounded-growth-voluntary-choice-frontier/v1';
const VERSION = '0.1.0';
const STATUS = 'TEST';
const READY_STATE = 'AVAILABLE_ONLY_AFTER_EXPLICIT_HUMAN_REQUEST';
const HOLD_STATE = 'UNAVAILABLE_PENDING_EXTERNAL_EVENT';
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unsupported field(s): ' + extras.sort().join(', '));
}

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be non-empty text');
  if (value.length > (maximum || 500)) throw new Error(label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = text(value, label, 80);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function ref(input, label) {
  exactKeys(input, ['id', 'schema', 'sha256'], label);
  const output = {
    id: text(input.id, label + '.id', 240),
    schema: text(input.schema, label + '.schema', 180),
    sha256: text(input.sha256, label + '.sha256', 71)
  };
  if (!DIGEST.test(output.sha256)) throw new Error(label + '.sha256 must be an exact lowercase digest');
  return output;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256);
}

function nativeRef(value, idField, digestField, label) {
  return ref({ id: value[idField], schema: value.schema, sha256: value[digestField] }, label);
}

function catalogDigest(catalog) {
  const payload = clone(catalog);
  delete payload.catalogDigest;
  return sha256(payload);
}

function parseCommands(route) {
  const capability = route.capabilityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const session = new RegExp('^node ([A-Za-z0-9_./-]+\\.js) session ' + capability + '$').exec(route.sessionCommand || '');
  const handoff = new RegExp('^node ([A-Za-z0-9_./-]+\\.js) handoff ' + capability + ' <external-session-receipt\\.json>$').exec(route.handoffCommand || '');
  if (!session || !handoff || session[1] !== handoff[1]) throw new Error('catalog command mismatch for ' + route.capabilityId);
  if (session[1].startsWith('/') || /^[A-Za-z]:/.test(session[1]) || session[1].split('/').some((item) => !item || item === '.' || item === '..')) {
    throw new Error('catalog runner path must be workspace-relative and bounded for ' + route.capabilityId);
  }
  return { runnerPath: session[1] };
}

function verifyCatalog(catalog, coverage) {
  const errors = [];
  try {
    exactKeys(catalog, [
      'schema', 'version', 'catalogId', 'generatedAt', 'status', 'coverageRef',
      'readyRoutes', 'heldRoutes', 'truth', 'catalogDigest'
    ], 'catalog');
    if (catalog.schema !== 'axm.grounded-growth-human-route-catalog/v1' || catalog.version !== '0.1.0' || catalog.status !== 'TEST') {
      throw new Error('catalog identity or TEST status mismatch');
    }
    if (catalog.catalogDigest !== catalogDigest(catalog)) throw new Error('catalog digest mismatch');
    if (!sameRef(catalog.coverageRef, nativeRef(coverage, 'receiptId', 'receiptDigest', 'coverage'))) {
      throw new Error('catalog coverage reference mismatch');
    }
    if (!Array.isArray(catalog.readyRoutes) || !Array.isArray(catalog.heldRoutes)) throw new Error('catalog route arrays are required');
    const coverageReady = new Map(coverage.routes.map((item) => [item.capabilityId, item]));
    const catalogReady = new Map();
    let runnerPath = null;
    for (const route of catalog.readyRoutes) {
      if (catalogReady.has(route.capabilityId)) throw new Error('duplicate catalog ready route ' + route.capabilityId);
      const source = coverageReady.get(route.capabilityId);
      if (!source) throw new Error('catalog ready route is absent from coverage ' + route.capabilityId);
      if (route.humanClaimId !== source.humanClaimId || route.humanEvidenceState !== 'NOT_RUN') {
        throw new Error('catalog claim or human-evidence mismatch for ' + route.capabilityId);
      }
      if (!sameRef(route.protocolRef, source.protocolRef) || !sameRef(route.participantPacketRef, source.participantPacketRef) ||
          !sameRef(route.interventionLinkRef, source.interventionLinkRef)) {
        throw new Error('catalog route reference mismatch for ' + route.capabilityId);
      }
      const parsed = parseCommands(route);
      if (runnerPath && parsed.runnerPath !== runnerPath) throw new Error('catalog routes do not share one current runner');
      runnerPath = parsed.runnerPath;
      catalogReady.set(route.capabilityId, route);
    }
    if (catalogReady.size !== coverageReady.size) throw new Error('catalog does not cover every ready route');
    const coverageHeld = new Map(coverage.holds.map((item) => [item.capabilityId, item]));
    const catalogHeld = new Map();
    for (const hold of catalog.heldRoutes) {
      if (catalogHeld.has(hold.capabilityId)) throw new Error('duplicate catalog held route ' + hold.capabilityId);
      const source = coverageHeld.get(hold.capabilityId);
      if (!source) throw new Error('catalog held route is absent from coverage ' + hold.capabilityId);
      if (hold.humanClaimId !== source.humanClaimId || hold.reasonCode !== source.reasonCode || hold.proposalId !== source.proposalId ||
          hold.requiredExternalEvent !== source.requiredExternalEvent || hold.commandAvailable !== false || hold.humanEvidenceState !== 'NOT_RUN') {
        throw new Error('catalog held route mismatch for ' + hold.capabilityId);
      }
      catalogHeld.set(hold.capabilityId, hold);
    }
    if (catalogHeld.size !== coverageHeld.size) throw new Error('catalog does not cover every held route');
    const forbidden = [
      catalog.truth.commandsRunAutomatically,
      catalog.truth.participationStarted,
      catalog.truth.humanBenefitEstablished,
      catalog.truth.deferredSurfaceImplemented,
      catalog.truth.sourceAuthenticationClaimed,
      catalog.truth.writesAutomatically,
      catalog.truth.sendsToNetwork,
      catalog.truth.installsAutomatically,
      catalog.truth.promotesAutomatically,
      catalog.truth.canonizesAutomatically
    ];
    if (forbidden.some((value) => value !== false)) throw new Error('catalog truth or authority boundary mismatch');
    return { pass: true, errors: [], runnerPath };
  } catch (error) {
    errors.push(error.message);
    return { pass: false, errors, runnerPath: null };
  }
}

function receiptDigest(receipt) {
  const payload = clone(receipt);
  delete payload.frontierDigest;
  return sha256(payload);
}

function build(input) {
  exactKeys(input, [
    'frontierId', 'generatedAt', 'currentStateReceipt', 'currentStateInput',
    'humanRouteCoverageReceipt', 'humanRouteCoverageInput', 'routeCatalog'
  ], 'input');
  const currentState = clone(input.currentStateReceipt);
  const currentCheck = Current.verify(currentState, clone(input.currentStateInput));
  if (!currentCheck.pass) throw new Error('current state invalid: ' + currentCheck.errors.join('; '));
  const coverage = clone(input.humanRouteCoverageReceipt);
  const coverageInput = clone(input.humanRouteCoverageInput);
  const coverageCheck = Coverage.verify(coverage, coverageInput);
  if (!coverageCheck.pass) throw new Error('human-route coverage invalid: ' + coverageCheck.errors.join('; '));
  const catalog = clone(input.routeCatalog);
  const catalogCheck = verifyCatalog(catalog, coverage);
  if (!catalogCheck.pass) throw new Error('human-route catalog invalid: ' + catalogCheck.errors.join('; '));
  if (!sameRef(currentState.sourceRefs.latestPortfolio, coverage.portfolioRef)) {
    throw new Error('current state and human-route coverage target different portfolios');
  }
  if (currentState.currentEvidence.capabilityChains !== coverage.coverage.currentCapabilityChains ||
      currentState.currentEvidence.humanPass !== coverage.coverage.humanPass ||
      currentState.currentEvidence.humanNotRun !== coverage.coverage.humanNotRun) {
    throw new Error('current state and human-route coverage beneficiary counts disagree');
  }
  if (coverage.coverage.humanPass !== 0 || coverage.coverage.humanNotRun !== coverage.coverage.currentCapabilityChains) {
    throw new Error('voluntary choice frontier requires all current human claims to remain NOT_RUN');
  }
  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  [currentState.generatedAt, coverage.generatedAt, catalog.generatedAt].forEach((value, index) => {
    if (Date.parse(value) > Date.parse(generatedAt)) throw new Error('choice frontier predates source index ' + index);
  });
  const catalogByCapability = new Map(catalog.readyRoutes.map((item) => [item.capabilityId, item]));
  const choices = coverage.routes.map((route) => {
    const catalogRoute = catalogByCapability.get(route.capabilityId);
    return {
      choiceId: 'human-route:' + route.capabilityId,
      capabilityId: route.capabilityId,
      humanClaimId: route.humanClaimId,
      availability: READY_STATE,
      protocolRef: clone(route.protocolRef),
      participantPacketRef: clone(route.participantPacketRef),
      interventionLinkRef: clone(route.interventionLinkRef),
      runnerRef: clone(route.runnerRef),
      sessionCommand: catalogRoute.sessionCommand,
      handoffCommand: catalogRoute.handoffCommand,
      priority: null,
      recommended: false,
      preselected: false,
      started: false,
      humanEvidenceState: 'NOT_RUN'
    };
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const holds = coverage.holds.map((hold) => ({
    choiceId: 'human-route:' + hold.capabilityId,
    capabilityId: hold.capabilityId,
    humanClaimId: hold.humanClaimId,
    availability: HOLD_STATE,
    reasonCode: hold.reasonCode,
    proposalId: hold.proposalId,
    requiredExternalEvent: hold.requiredExternalEvent,
    commandAvailable: false,
    priority: null,
    recommended: false,
    preselected: false,
    started: false,
    humanEvidenceState: 'NOT_RUN'
  })).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const technicalPass = currentState.currentEvidence.sharedSystemPass + currentState.currentEvidence.aiWorkflowPass;
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    frontierId: text(input.frontierId, 'frontierId', 200),
    generatedAt,
    status: STATUS,
    state: holds.length ? 'CURRENT_NEUTRAL_OPTION_MENU_WITH_EXPLICIT_HOLDS' : 'CURRENT_NEUTRAL_OPTION_MENU',
    sourceRefs: {
      currentState: nativeRef(currentState, 'receiptId', 'receiptDigest', 'current state'),
      portfolio: clone(coverage.portfolioRef),
      humanRouteCoverage: nativeRef(coverage, 'receiptId', 'receiptDigest', 'coverage'),
      humanRouteCatalog: nativeRef(catalog, 'catalogId', 'catalogDigest', 'catalog')
    },
    current: {
      capabilityChains: coverage.coverage.currentCapabilityChains,
      priorOptionalReviewCandidates: currentState.decision.reviewableActionCount,
      availableChoices: choices.length,
      heldChoices: holds.length,
      sharedSystemPass: currentState.currentEvidence.sharedSystemPass,
      aiWorkflowPass: currentState.currentEvidence.aiWorkflowPass,
      humanPass: currentState.currentEvidence.humanPass,
      humanNotRun: currentState.currentEvidence.humanNotRun
    },
    choices,
    holds,
    selectionPolicy: {
      mode: 'HUMAN_CHOOSES_ONE_OR_MORE_OR_WAIT',
      defaultChoiceId: null,
      rankedChoiceIds: [],
      preselectedChoiceIds: [],
      waitAllowed: true,
      explicitHumanRequestRequiredBeforeMenuOrPrompt: true,
      optOutHasNoPenalty: true,
      systemMayExplainRoutesAfterRequest: true,
      systemMayStartWithoutHumanSelection: false
    },
    balance: {
      technicalPassSignals: technicalPass,
      currentHumanPassSignals: currentState.currentEvidence.humanPass,
      technicalEvidenceAheadOfHumanEvidence: technicalPass > currentState.currentEvidence.humanPass,
      currentRoutesCoverEveryHumanClaim: choices.length + holds.length === coverage.coverage.currentCapabilityChains,
      groundedGrowthForAiAndHumansEstablished: false
    },
    decision: {
      state: 'NO_SELECTION_EVENT',
      currentBestAction: 'WAIT_OR_ON_EXPLICIT_REQUEST_PRESENT_NEUTRAL_ROUTE_MENU',
      availableChoiceCount: choices.length,
      heldChoiceCount: holds.length,
      selectedChoiceCount: 0,
      autonomousActionCount: 0,
      reviewableActionCount: 0,
      selectionEventRequired: true
    },
    truth: {
      currentStateVerifiedNatively: true,
      coverageVerifiedNatively: true,
      catalogVerifiedExactly: true,
      portfolioCrossBound: true,
      oldSingleReviewCandidateIsCompleteCurrentMenu: false,
      menuAvailabilityIsParticipation: false,
      routeReadinessIsHumanEvidence: false,
      selectionClaimed: false,
      participationOccurred: false,
      humanBenefitEstablished: false,
      sourceAuthenticationClaimed: false,
      deferredProposalImplemented: false,
      automaticPrompt: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    frontierDigest: null
  };
  receipt.frontierDigest = receiptDigest(receipt);
  return receipt;
}

function verify(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION) throw new Error('choice frontier schema or version mismatch');
    const rebuilt = build(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('choice frontier content, native sources, or digest mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function verifyPortable(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== STATUS) errors.push('choice frontier identity mismatch');
  if (receipt && receipt.frontierDigest !== receiptDigest(receipt)) errors.push('choice frontier digest mismatch');
  const choices = receipt && Array.isArray(receipt.choices) ? receipt.choices : [];
  const holds = receipt && Array.isArray(receipt.holds) ? receipt.holds : [];
  if (!receipt || !receipt.current || receipt.current.availableChoices !== choices.length || receipt.current.heldChoices !== holds.length ||
      receipt.current.capabilityChains !== choices.length + holds.length || receipt.current.humanPass !== 0 ||
      receipt.current.humanNotRun !== receipt.current.capabilityChains) errors.push('choice frontier current counts mismatch');
  if (choices.some((item) => item.availability !== READY_STATE || item.priority !== null || item.recommended !== false ||
      item.preselected !== false || item.started !== false || item.humanEvidenceState !== 'NOT_RUN')) errors.push('ready choice violates neutral selection');
  if (holds.some((item) => item.availability !== HOLD_STATE || item.commandAvailable !== false || item.priority !== null ||
      item.recommended !== false || item.preselected !== false || item.started !== false || item.humanEvidenceState !== 'NOT_RUN')) errors.push('held choice violates neutral hold');
  const policy = receipt && receipt.selectionPolicy;
  if (!policy || policy.defaultChoiceId !== null || !Array.isArray(policy.rankedChoiceIds) || policy.rankedChoiceIds.length ||
      !Array.isArray(policy.preselectedChoiceIds) || policy.preselectedChoiceIds.length || policy.waitAllowed !== true ||
      policy.explicitHumanRequestRequiredBeforeMenuOrPrompt !== true || policy.optOutHasNoPenalty !== true ||
      policy.systemMayStartWithoutHumanSelection !== false) errors.push('neutral selection policy mismatch');
  if (!receipt || !receipt.decision || receipt.decision.state !== 'NO_SELECTION_EVENT' || receipt.decision.selectedChoiceCount !== 0 ||
      receipt.decision.autonomousActionCount !== 0 || receipt.decision.reviewableActionCount !== 0 ||
      receipt.decision.selectionEventRequired !== true) errors.push('choice frontier decision grants selection or action');
  const truth = receipt && receipt.truth;
  const allowedTrue = new Set(['currentStateVerifiedNatively', 'coverageVerifiedNatively', 'catalogVerifiedExactly', 'portfolioCrossBound']);
  if (!truth || Object.entries(truth).some(([key, value]) => allowedTrue.has(key) ? value !== true : value !== false)) {
    errors.push('choice frontier truth or authority boundary mismatch');
  }
  return {
    pass: errors.length === 0,
    errors,
    sourceTruth: 'UNKNOWN',
    sourceCurrentness: 'UNKNOWN',
    selection: 'NOT_OCCURRED',
    humanBenefit: 'NOT_RUN'
  };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  READY_STATE,
  HOLD_STATE,
  stableStringify,
  sha256,
  catalogDigest,
  verifyCatalog,
  build,
  verify,
  verifyPortable
};
