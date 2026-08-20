#!/usr/bin/env node
'use strict';

const Human = require('../human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Loop = require('../verified-capability-loop/verified-capability-loop');

const RECEIPT_SCHEMA = 'axm.grounded-growth-human-route-coverage-receipt/v1';
const VERSION = '0.1.0';
const PACKET_SCHEMA = 'axm.human-benefit-participant-packet/v1';
const READY = 'READY_FOR_VOLUNTARY_INPUT';
const HELD_DEFERRED = 'HELD_DEFERRED_HUMAN_SURFACE';
const HOLD_REASONS = new Set([
  'DEFERRED_HUMAN_SURFACE_REQUIRES_STEWARD_DECISION',
  'NO_CLAIM_NATIVE_PROTOCOL',
  'MISSING_INTERVENTION_LINK'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  return Growth.sha256(value);
}

function requiredText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be non-empty text');
  if (value.length > (maximum || 500)) throw new Error(label + ' is too long');
  return value;
}

function exactTimestamp(value, label) {
  requiredText(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(label + ' must be a sha256 digest');
  return value;
}

function normalizeReference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' must be a reference');
  return {
    id: requiredText(input.id, label + '.id', 240),
    schema: requiredText(input.schema, label + '.schema', 180),
    sha256: exactDigest(input.sha256, label + '.sha256')
  };
}

function nativeReference(value, idField, digestField, label) {
  return normalizeReference({ id: value[idField], schema: value.schema, sha256: value[digestField] }, label);
}

function sameReference(left, right) {
  return Boolean(left && right && left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256);
}

function packetDigest(packet) {
  const payload = clone(packet);
  delete payload.packetDigest;
  return Human.sha256(payload);
}

function verifyParticipantPacket(packet, protocol, current) {
  const errors = [];
  if (!packet || packet.schema !== PACKET_SCHEMA) return { pass: false, errors: ['participant packet schema mismatch'] };
  const serialized = stableStringify(packet);
  ['expectedDecision', '"BASELINE"', '"CANDIDATE"', 'artifactRef'].forEach((token) => {
    if (serialized.includes(token)) errors.push('participant packet leaks ' + token);
  });
  if (packet.packetDigest !== packetDigest(packet)) errors.push('participant packet digest mismatch');
  const protocolRef = nativeReference(protocol, 'protocolId', 'protocolDigest', 'protocol');
  const cycleRef = nativeReference(current.outcome.cycleReceipt, 'cycleId', 'receiptDigest', 'cycle');
  const outcomeRef = nativeReference(current.outcome, 'outcomeId', 'receiptDigest', 'outcome');
  if (!sameReference(packet.protocolRef, protocolRef)) errors.push('participant packet protocol reference mismatch');
  if (!packet.capabilityBinding || packet.capabilityBinding.capabilityId !== current.outcome.capabilityId) {
    errors.push('participant packet capability binding mismatch');
  }
  if (!packet.capabilityBinding || packet.capabilityBinding.humanClaimId !== current.humanClaim.id) {
    errors.push('participant packet human claim binding mismatch');
  }
  if (!packet.capabilityBinding || !sameReference(packet.capabilityBinding.protocolRef, protocolRef)) {
    errors.push('participant packet nested protocol reference mismatch');
  }
  if (!packet.capabilityBinding || !sameReference(packet.capabilityBinding.cycleRef, cycleRef)) {
    errors.push('participant packet cycle reference mismatch');
  }
  if (!packet.capabilityBinding || !sameReference(packet.capabilityBinding.currentOutcomeRef, outcomeRef)) {
    errors.push('participant packet current outcome reference mismatch');
  }
  if (packet.status !== 'READY_FOR_VOLUNTARY_HUMAN_SESSION') errors.push('participant packet is not voluntary-session ready');
  if (!packet.responseBoundary || packet.responseBoundary.exactProtocolRefRequired !== true ||
      packet.responseBoundary.externalToWorkshopRepository !== true || packet.responseBoundary.structuredNoFreeText !== true) {
    errors.push('participant packet response boundary mismatch');
  }
  if (!packet.outputBoundary || packet.outputBoundary.writesAutomatically !== false ||
      packet.outputBoundary.sendsToNetwork !== false || packet.outputBoundary.authenticatesHuman !== false ||
      packet.outputBoundary.createsHumanBenefitVerdict !== false) {
    errors.push('participant packet output boundary mismatch');
  }
  return { pass: errors.length === 0, errors };
}

function currentByCapability(portfolio) {
  const portfolioCheck = Growth.verifyPortfolio(portfolio);
  if (!portfolioCheck.pass) throw new Error('portfolio is invalid: ' + portfolioCheck.errors.join('; '));
  const current = new Map();
  for (const latest of portfolio.latest) {
    const outcome = portfolio.outcomes.find((item) => item.receiptDigest === latest.effectiveReceiptDigest);
    if (!outcome) throw new Error('portfolio lacks effective outcome ' + latest.effectiveReceiptDigest);
    const cycleCheck = Loop.verify(outcome.cycleReceipt);
    if (!cycleCheck.pass) throw new Error('cycle is invalid for ' + outcome.capabilityId + ': ' + cycleCheck.errors.join('; '));
    const humanClaim = outcome.claims.find((claim) => claim.beneficiary === 'HUMAN');
    if (!humanClaim || humanClaim.admittedVerdict !== 'NOT_RUN' || humanClaim.routeStatus !== 'NOT_PROVEN') {
      throw new Error('current human claim is not NOT_RUN / NOT_PROVEN for ' + outcome.capabilityId);
    }
    current.set(outcome.capabilityId, { latest, outcome, humanClaim });
  }
  return current;
}

function readyRow(route, current) {
  const protocol = clone(route.protocol);
  const protocolCheck = Human.verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('protocol invalid for ' + current.outcome.capabilityId + ': ' + protocolCheck.errors.join('; '));
  if (protocol.fixtureMode !== 'LIVE' || protocol.claim.targetScope !== 'NAMED_LOCAL_STEWARD') {
    throw new Error('protocol is not a named-local LIVE route for ' + current.outcome.capabilityId);
  }
  if (protocol.claim.id !== current.humanClaim.id || protocol.claim.statement !== current.humanClaim.statement) {
    throw new Error('protocol human claim differs from current outcome for ' + current.outcome.capabilityId);
  }
  const packet = clone(route.packet);
  const packetCheck = verifyParticipantPacket(packet, protocol, current);
  if (!packetCheck.pass) throw new Error('participant packet invalid for ' + current.outcome.capabilityId + ': ' + packetCheck.errors.join('; '));
  const link = clone(route.interventionLink);
  const linkCheck = Bridge.verifyInterventionLink(link, current.outcome.cycleReceipt, protocol);
  if (!linkCheck.pass) throw new Error('intervention link invalid for ' + current.outcome.capabilityId + ': ' + linkCheck.errors.join('; '));
  if (link.capabilityId !== current.outcome.capabilityId || link.claimId !== current.humanClaim.id) {
    throw new Error('intervention link crossed capability or claim for ' + current.outcome.capabilityId);
  }
  return {
    capabilityId: current.outcome.capabilityId,
    humanClaimId: current.humanClaim.id,
    currentOutcomeRef: nativeReference(current.outcome, 'outcomeId', 'receiptDigest', 'outcome'),
    currentCycleRef: nativeReference(current.outcome.cycleReceipt, 'cycleId', 'receiptDigest', 'cycle'),
    protocolRef: nativeReference(protocol, 'protocolId', 'protocolDigest', 'protocol'),
    participantPacketRef: nativeReference(packet, 'packetId', 'packetDigest', 'participant packet'),
    ancestryMode: link.ancestry.mode,
    capabilitySurfaceRef: normalizeReference(link.ancestry.capabilitySurfaceRef, 'capability surface'),
    interventionLinkRef: nativeReference(link, 'linkId', 'linkDigest', 'intervention link'),
    runnerRef: normalizeReference(route.runnerRef, 'runner'),
    routeState: READY,
    humanEvidenceState: 'NOT_RUN',
    humanBenefitEstablished: false
  };
}

function heldRow(hold, current) {
  const reasonCode = requiredText(hold.reasonCode, 'hold reasonCode', 120);
  if (!HOLD_REASONS.has(reasonCode)) throw new Error('unsupported human-route hold reason ' + reasonCode);
  const evidenceRefs = Array.from(hold.evidenceRefs || []).map((item, index) => normalizeReference(item, 'hold evidence[' + index + ']'));
  if (!evidenceRefs.length) throw new Error('held route requires evidence');
  const proposalId = hold.proposalId === null || hold.proposalId === undefined
    ? null : requiredText(hold.proposalId, 'hold proposalId', 180);
  if (reasonCode === 'DEFERRED_HUMAN_SURFACE_REQUIRES_STEWARD_DECISION' && !proposalId) {
    throw new Error('deferred human-surface hold requires proposalId');
  }
  return {
    capabilityId: current.outcome.capabilityId,
    humanClaimId: current.humanClaim.id,
    currentOutcomeRef: nativeReference(current.outcome, 'outcomeId', 'receiptDigest', 'outcome'),
    currentCycleRef: nativeReference(current.outcome.cycleReceipt, 'cycleId', 'receiptDigest', 'cycle'),
    routeState: HELD_DEFERRED,
    reasonCode,
    proposalId,
    evidenceRefs: evidenceRefs.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
    requiredExternalEvent: 'EXPLICIT_STEWARD_DECISION_AND_CLAIM_NATIVE_HUMAN_SURFACE',
    humanEvidenceState: 'NOT_RUN',
    humanBenefitEstablished: false,
    automaticAction: false
  };
}

function receiptDigest(receipt) {
  const payload = clone(receipt);
  delete payload.receiptDigest;
  return sha256(payload);
}

function build(input) {
  input = input || {};
  const portfolio = clone(input.portfolio);
  const current = currentByCapability(portfolio);
  const seen = new Set();
  const readyRoutes = Array.from(input.readyRoutes || []).map((route) => {
    const capabilityId = requiredText(route.capabilityId, 'ready route capabilityId', 240);
    if (seen.has(capabilityId)) throw new Error('duplicate human-route coverage for ' + capabilityId);
    const exact = current.get(capabilityId);
    if (!exact) throw new Error('ready route is not a current capability chain: ' + capabilityId);
    seen.add(capabilityId);
    return readyRow(route, exact);
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const heldRoutes = Array.from(input.heldRoutes || []).map((hold) => {
    const capabilityId = requiredText(hold.capabilityId, 'held route capabilityId', 240);
    if (seen.has(capabilityId)) throw new Error('duplicate human-route coverage for ' + capabilityId);
    const exact = current.get(capabilityId);
    if (!exact) throw new Error('held route is not a current capability chain: ' + capabilityId);
    seen.add(capabilityId);
    return heldRow(hold, exact);
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const missingCapabilityIds = Array.from(current.keys()).filter((capabilityId) => !seen.has(capabilityId)).sort();
  if (missingCapabilityIds.length) throw new Error('current human-route coverage is missing: ' + missingCapabilityIds.join(', '));
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  const latestSourceTime = Math.max(...portfolio.outcomes.map((outcome) => new Date(outcome.generatedAt).getTime()));
  if (new Date(generatedAt).getTime() < latestSourceTime) throw new Error('coverage receipt cannot predate the current portfolio');
  const sourceRefs = Array.from(input.sourceRefs || []).map((item, index) => normalizeReference(item, 'sourceRefs[' + index + ']'))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  if (!sourceRefs.length) throw new Error('coverage receipt requires source references');
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    receiptId: requiredText(input.receiptId, 'receiptId', 200),
    generatedAt,
    status: input.status === 'TEST' ? 'TEST' : (() => { throw new Error('status must be TEST'); })(),
    state: heldRoutes.length ? 'BOUNDED_COVERAGE_WITH_EXPLICIT_HOLDS' : 'TECHNICAL_ROUTES_READY_HUMAN_EVIDENCE_NOT_RUN',
    portfolioRef: nativeReference(portfolio, 'portfolioId', 'portfolioDigest', 'portfolio'),
    routes: readyRoutes,
    holds: heldRoutes,
    coverage: {
      currentCapabilityChains: current.size,
      readyRoutes: readyRoutes.length,
      heldRoutes: heldRoutes.length,
      missingRoutes: 0,
      candidateAncestryReady: readyRoutes.filter((route) => route.ancestryMode === 'CANDIDATE').length,
      reuseExistingAncestryReady: readyRoutes.filter((route) => route.ancestryMode === 'REUSE_EXISTING').length,
      humanNotRun: current.size,
      humanPass: 0
    },
    decision: {
      state: 'NO_AUTOMATIC_PARTICIPATION_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: 0,
      currentBestAction: heldRoutes.length ? 'PRESERVE_CURRENT_OPTIONAL_ROUTES_AND_HOLD_DEFERRED_HUMAN_SURFACE' : 'PRESERVE_CURRENT_OPTIONAL_ROUTES'
    },
    truth: {
      portfolioVerifiedNatively: true,
      routeReadinessIsParticipation: false,
      packetReadinessIsHumanEvidence: false,
      humanParticipationOccurred: false,
      humanBenefitEstablished: false,
      deferredProposalImplemented: false,
      sourceAuthenticationClaimed: false,
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
    sourceRefs,
    receiptDigest: null
  };
  receipt.receiptDigest = receiptDigest(receipt);
  return receipt;
}

function verify(receipt, sources) {
  const errors = [];
  try {
    const rebuilt = build({
      receiptId: receipt.receiptId,
      generatedAt: receipt.generatedAt,
      status: receipt.status,
      portfolio: sources.portfolio,
      readyRoutes: sources.readyRoutes,
      heldRoutes: sources.heldRoutes,
      sourceRefs: sources.sourceRefs
    });
    if (stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('coverage receipt content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function verifyPortable(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION) errors.push('coverage schema or version mismatch');
  if (receipt && receipt.status !== 'TEST') errors.push('coverage status must remain TEST');
  if (receipt && receipt.receiptDigest !== receiptDigest(receipt)) errors.push('coverage receipt digest mismatch');
  const routes = receipt && Array.isArray(receipt.routes) ? receipt.routes : [];
  const holds = receipt && Array.isArray(receipt.holds) ? receipt.holds : [];
  const capabilityIds = [...routes, ...holds].map((item) => item.capabilityId);
  if (new Set(capabilityIds).size !== capabilityIds.length) errors.push('coverage capability ids are not unique');
  if (!receipt || !receipt.coverage || receipt.coverage.currentCapabilityChains !== capabilityIds.length ||
      receipt.coverage.readyRoutes !== routes.length || receipt.coverage.heldRoutes !== holds.length ||
      receipt.coverage.missingRoutes !== 0 || receipt.coverage.humanNotRun !== capabilityIds.length || receipt.coverage.humanPass !== 0) {
    errors.push('coverage summary mismatch');
  }
  if (routes.some((item) => item.routeState !== READY || item.humanEvidenceState !== 'NOT_RUN' || item.humanBenefitEstablished !== false)) {
    errors.push('ready route inflates human evidence');
  }
  if (holds.some((item) => item.routeState !== HELD_DEFERRED || item.humanEvidenceState !== 'NOT_RUN' ||
      item.humanBenefitEstablished !== false || item.automaticAction !== false)) {
    errors.push('held route inflates evidence or action');
  }
  const forbiddenTruth = receipt && receipt.truth ? [
    receipt.truth.routeReadinessIsParticipation,
    receipt.truth.packetReadinessIsHumanEvidence,
    receipt.truth.humanParticipationOccurred,
    receipt.truth.humanBenefitEstablished,
    receipt.truth.deferredProposalImplemented,
    receipt.truth.sourceAuthenticationClaimed,
    receipt.truth.automaticExecution,
    receipt.truth.automaticWrite,
    receipt.truth.automaticInstall,
    receipt.truth.automaticPermissionGrant,
    receipt.truth.automaticPromotion,
    receipt.truth.automaticMerge,
    receipt.truth.automaticCanon,
    receipt.truth.foundationMutation,
    receipt.truth.modelWeightTrainingClaimed
  ] : [true];
  if (forbiddenTruth.some((value) => value !== false)) errors.push('coverage truth or authority boundary mismatch');
  if (!receipt || !receipt.decision || receipt.decision.autonomousActionCount !== 0 || receipt.decision.reviewableActionCount !== 0) {
    errors.push('coverage receipt grants action');
  }
  return {
    pass: errors.length === 0,
    errors,
    sourceTruth: 'UNKNOWN',
    sourceCurrentness: 'UNKNOWN',
    humanBenefit: 'NOT_RUN'
  };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  PACKET_SCHEMA,
  READY,
  HELD_DEFERRED,
  stableStringify,
  sha256,
  packetDigest,
  verifyParticipantPacket,
  build,
  verify,
  verifyPortable
};
