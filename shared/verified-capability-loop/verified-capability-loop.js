'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const RECEIPT_SCHEMA = 'axm.verified-capability-cycle-receipt/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const GAP_STATES = ['OPEN', 'NO_GAP', 'UNKNOWN'];
const STRATEGIES = ['REUSE', 'COMPOSE', 'ADAPT', 'BUILD'];
const VERDICTS = ['PASS', 'FAIL', 'UNKNOWN', 'NOT_RUN'];
const EVIDENCE_AUTHORITIES = ['INDEPENDENT_RUNTIME', 'MIXED', 'STATIC_ONLY', 'OPERATOR_DECLARATION'];
const DECISIONS = ['HOLD', 'CONTINUE', 'REJECT'];
const REFRESH_TRIGGERS = ['NEW_INFORMATION', 'MANUAL', 'HEARTBEAT'];

function clone(value) {
  return JSON.parse(DeterministicJson.canonicalJson(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function text(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function timestamp(value, label) {
  const date = new Date(value || new Date().toISOString());
  if (Number.isNaN(date.getTime())) throw new Error(label + ' must be a valid timestamp');
  return date.toISOString();
}

function digest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a SHA-256 digest');
  return result;
}

function reference(value, input) {
  input = input || {};
  return {
    id: text(input.id || 'evidence', 'reference id', 180),
    schema: text(input.schema || 'application/octet-stream', 'reference schema', 180),
    sha256: sha256(value)
  };
}

function normalizeReference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' reference is required');
  return {
    id: text(input.id, label + ' id', 180),
    schema: text(input.schema, label + ' schema', 180),
    sha256: digest(input.sha256, label + ' sha256')
  };
}

function normalizeReferences(values, label, required) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (required && !values.length) throw new Error(label + ' needs at least one reference');
  if (values.length > 32) throw new Error(label + ' exceeds 32 references');
  return values.map((value, index) => normalizeReference(value, label + '[' + index + ']'));
}

function normalizeBaseline(input) {
  input = input || {};
  return {
    kind: text(input.kind, 'baseline kind', 80),
    identity: text(input.identity, 'baseline identity', 300),
    receiptRef: normalizeReference(input.receiptRef, 'baseline receipt')
  };
}

function normalizeNeed(input) {
  input = input || {};
  return {
    id: text(input.id, 'need id', 180),
    statement: text(input.statement, 'need statement', 1200),
    sourceRef: normalizeReference(input.sourceRef, 'need source'),
    directionRef: input.directionRef ? normalizeReference(input.directionRef, 'need direction') : null
  };
}

function normalizeGap(input) {
  input = input || {};
  const state = String(input.state || '').toUpperCase();
  if (!GAP_STATES.includes(state)) throw new Error('gap state must be OPEN, NO_GAP, or UNKNOWN');
  return {
    state,
    reason: text(input.reason, 'gap reason', 1200),
    reportRef: normalizeReference(input.reportRef, 'gap report'),
    existingCapabilityRef: input.existingCapabilityRef ? normalizeReference(input.existingCapabilityRef, 'existing capability') : null
  };
}

function normalizeCandidate(input) {
  if (input == null) return null;
  const strategy = String(input.strategy || '').toUpperCase();
  if (!STRATEGIES.includes(strategy)) throw new Error('candidate strategy is unsupported');
  if (String(input.status || '').toUpperCase() !== 'EXPERIMENTAL') throw new Error('candidate status must remain EXPERIMENTAL');
  ['installed', 'promoted', 'canon'].forEach(field => {
    if (input[field] !== false) throw new Error('candidate.' + field + ' must be false');
  });
  return {
    strategy,
    status: 'EXPERIMENTAL',
    artifactRef: normalizeReference(input.artifactRef, 'candidate artifact'),
    sourceMutationPerformed: input.sourceMutationPerformed === true,
    installed: false,
    promoted: false,
    canon: false
  };
}

function normalizeVerification(input, candidate) {
  if (input == null) return null;
  if (!candidate) throw new Error('verification cannot exist without a candidate');
  const verdict = String(input.verdict || '').toUpperCase();
  const evidenceAuthority = String(input.evidenceAuthority || '').toUpperCase();
  if (!VERDICTS.includes(verdict)) throw new Error('verification verdict is unsupported');
  if (!EVIDENCE_AUTHORITIES.includes(evidenceAuthority)) throw new Error('verification evidenceAuthority is unsupported');
  const subjectDigest = digest(input.subjectDigest, 'verification subjectDigest');
  if (subjectDigest !== candidate.artifactRef.sha256) throw new Error('verification subject digest does not match the candidate');
  const limitations = Array.isArray(input.limitations) ? input.limitations.map((value, index) => text(value, 'verification limitation ' + index, 500)) : [];
  if (limitations.length > 24) throw new Error('verification limitations exceed 24 entries');
  return {
    verdict,
    subjectDigest,
    receiptRef: normalizeReference(input.receiptRef, 'verification receipt'),
    evidenceAuthority,
    limitations
  };
}

function effectiveVerification(verification) {
  return !!(verification && verification.verdict === 'PASS' && ['INDEPENDENT_RUNTIME', 'MIXED'].includes(verification.evidenceAuthority));
}

function normalizeDecision(input, candidate) {
  if (input == null) return null;
  if (!candidate) throw new Error('steward decision cannot exist without a candidate');
  const verdict = String(input.verdict || '').toUpperCase();
  if (!DECISIONS.includes(verdict)) throw new Error('steward decision is unsupported');
  if (String(input.actorKind || '').toUpperCase() !== 'HUMAN') throw new Error('steward decision actorKind must be HUMAN');
  const candidateDigest = digest(input.candidateDigest, 'decision candidateDigest');
  if (candidateDigest !== candidate.artifactRef.sha256) throw new Error('decision candidate digest does not match the candidate');
  const expectedConfirmation = verdict + ' VERIFIED CAPABILITY';
  if (input.confirmation !== expectedConfirmation) throw new Error('steward decision requires exact confirmation: ' + expectedConfirmation);
  return {
    verdict,
    actorKind: 'HUMAN',
    actorId: text(input.actorId, 'decision actorId', 120),
    candidateDigest,
    confirmation: expectedConfirmation,
    decisionRef: normalizeReference(input.decisionRef, 'decision receipt')
  };
}

function normalizeAvailability(input, candidate, decision, verification) {
  if (input == null) return null;
  if (!candidate || !decision || decision.verdict !== 'CONTINUE' || !effectiveVerification(verification)) {
    throw new Error('availability requires a verified candidate and a human CONTINUE decision');
  }
  const status = String(input.status || '').toUpperCase();
  if (!['AVAILABLE', 'NOT_AVAILABLE'].includes(status)) throw new Error('availability status is unsupported');
  const candidateDigest = digest(input.candidateDigest, 'availability candidateDigest');
  if (candidateDigest !== candidate.artifactRef.sha256) throw new Error('availability candidate digest does not match the candidate');
  return {
    status,
    candidateDigest,
    authorityId: text(input.authorityId, 'availability authorityId', 160),
    receiptRef: normalizeReference(input.receiptRef, 'availability receipt')
  };
}

function normalizeRefresh(input) {
  input = input || {};
  const trigger = String(input.trigger || '').toUpperCase();
  if (!REFRESH_TRIGGERS.includes(trigger)) throw new Error('refresh trigger is unsupported');
  return {
    trigger,
    checkedAt: timestamp(input.checkedAt, 'refresh checkedAt'),
    due: input.due === true,
    reason: text(input.reason, 'refresh reason', 800)
  };
}

function deriveState(gap, candidate, verification, decision, availability, refresh) {
  if (gap.state === 'UNKNOWN') return 'NEEDS_GAP_EVIDENCE';
  if (gap.state === 'NO_GAP') return gap.existingCapabilityRef ? (refresh.due ? 'REFRESH_DUE' : 'REUSE_EXISTING') : 'NEEDS_GAP_EVIDENCE';
  if (!candidate) return 'GAP_OPEN';
  if (decision && decision.verdict === 'REJECT') return 'REJECTED';
  if (decision && decision.verdict === 'HOLD') return 'STEWARD_HOLD';
  if (!verification) return 'CANDIDATE_UNVERIFIED';
  if (verification.verdict === 'FAIL') return 'REPAIR_OR_REJECT';
  if (!effectiveVerification(verification)) return 'VERIFICATION_HOLD';
  if (!decision) return 'AWAITING_STEWARD';
  if (!availability || availability.status !== 'AVAILABLE') return 'READY_FOR_GOVERNED_INTAKE';
  return refresh.due ? 'REFRESH_DUE' : 'AVAILABLE_FOR_REUSE';
}

function improvementClaim(state) {
  if (state === 'AVAILABLE_FOR_REUSE') return 'AVAILABLE_AND_REFRESHABLE';
  if (state === 'REFRESH_DUE') return 'PREVIOUSLY_AVAILABLE_RECHECK_REQUIRED';
  if (['AWAITING_STEWARD', 'STEWARD_HOLD', 'READY_FOR_GOVERNED_INTAKE'].includes(state)) return 'VERIFIED_CANDIDATE_ONLY';
  return 'NOT_ESTABLISHED';
}

function build(input) {
  input = input || {};
  const baseline = normalizeBaseline(input.baseline);
  const need = normalizeNeed(input.need);
  const gap = normalizeGap(input.gap);
  const provenance = normalizeReferences(input.provenance || [], 'provenance', gap.state === 'OPEN');
  const candidate = normalizeCandidate(input.candidate);
  const verification = normalizeVerification(input.verification, candidate);
  const decision = normalizeDecision(input.decision, candidate);
  if (decision && decision.verdict === 'CONTINUE' && !effectiveVerification(verification)) {
    throw new Error('CONTINUE cannot advance an unverified candidate');
  }
  const availability = normalizeAvailability(input.availability, candidate, decision, verification);
  const refresh = normalizeRefresh(input.refresh);
  const state = deriveState(gap, candidate, verification, decision, availability, refresh);
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    cycleId: text(input.cycleId, 'cycleId', 180),
    capabilityId: text(input.capabilityId, 'capabilityId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    state,
    baseline,
    need,
    gap,
    provenance,
    candidate,
    verification,
    stewardDecision: decision,
    availability,
    refresh,
    improvementClaim: improvementClaim(state),
    truth: {
      cycleAuthority: 'RECEIPT_LINKING_ONLY',
      automaticExecution: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      automaticRootMutation: false,
      modelWeightTrainingClaimed: false,
      humanStewardDecisionRequired: true
    },
    receiptDigest: null
  };
  const digestPayload = clone(receipt);
  delete digestPayload.receiptDigest;
  receipt.receiptDigest = sha256(digestPayload);
  return receipt;
}

function verify(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA) return { pass: false, errors: ['receipt schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('receipt version mismatch');
  let rebuilt = null;
  try {
    rebuilt = build({
      cycleId: receipt.cycleId,
      capabilityId: receipt.capabilityId,
      generatedAt: receipt.generatedAt,
      baseline: receipt.baseline,
      need: receipt.need,
      gap: receipt.gap,
      provenance: receipt.provenance,
      candidate: receipt.candidate,
      verification: receipt.verification,
      decision: receipt.stewardDecision,
      availability: receipt.availability,
      refresh: receipt.refresh
    });
  } catch (error) {
    errors.push('receipt content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('receipt content or derived state mismatch');
    if (rebuilt.receiptDigest !== receipt.receiptDigest) errors.push('receipt digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  reference,
  build,
  verify
};
