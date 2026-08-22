'use strict';

const crypto = require('crypto');
const CapabilityLoop = require('../verified-capability-loop/verified-capability-loop');
const DeterministicJson = require('../../tools/deterministic-json-core');

const OUTCOME_SCHEMA = 'axm.grounded-growth-outcome-receipt/v1';
const PORTFOLIO_SCHEMA = 'axm.grounded-growth-portfolio/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const BENEFICIARIES = ['HUMAN', 'AI_WORKFLOW', 'SHARED_SYSTEM'];
const VERDICTS = ['PASS', 'FAIL', 'UNKNOWN', 'NOT_RUN'];
const CLOSURE_STATES = ['CURRENT', 'HELD', 'UNKNOWN'];
const CLAIM_KINDS = [
  'EXISTENCE',
  'STATIC_STRUCTURE',
  'DETERMINISTIC_BEHAVIOR',
  'VISUAL_APPEARANCE',
  'MOTION_TIMING',
  'INTERACTION_JOURNEY',
  'PERSISTENCE',
  'TRANSPORT',
  'AUTHORIZATION',
  'PERFORMANCE',
  'RESOURCE_SAFETY',
  'LEARNING_IMPROVEMENT',
  'QUALITY',
  'TASTE_MEANING',
  'WORKFLOW_OUTCOME'
];
const PROOF_SURFACES = [
  'NOT_RUN',
  'FILE_INSPECTION',
  'INDEPENDENT_INVENTORY',
  'STATIC_INSPECTION',
  'SCHEMA_VALIDATION',
  'FOCUSED_RUNTIME',
  'INDEPENDENT_RUNTIME',
  'LIVE_VISUAL',
  'FRAME_SEQUENCE',
  'RUNTIME_TIMING',
  'LIVE_INTERACTION',
  'REPRESENTATIVE_USER_JOURNEY',
  'HUMAN_OBSERVATION',
  'RESTART_RECOVERY',
  'SENDER_RECEIVER_RECEIPTS',
  'ALLOW_DENY_PROBE',
  'MEASURED_WORKLOAD',
  'RESOURCE_TELEMETRY',
  'HELD_OUT_EVALUATION',
  'AI_WORKFLOW_EVALUATION',
  'ACCEPTANCE_INSPECTION',
  'HUMAN_REVIEW',
  'HUMAN_JUDGMENT'
];

const KIND_SURFACES = {
  EXISTENCE: ['FILE_INSPECTION', 'INDEPENDENT_INVENTORY'],
  STATIC_STRUCTURE: ['STATIC_INSPECTION', 'SCHEMA_VALIDATION'],
  DETERMINISTIC_BEHAVIOR: ['FOCUSED_RUNTIME', 'INDEPENDENT_RUNTIME'],
  VISUAL_APPEARANCE: ['LIVE_VISUAL'],
  MOTION_TIMING: ['FRAME_SEQUENCE', 'RUNTIME_TIMING'],
  INTERACTION_JOURNEY: ['LIVE_INTERACTION', 'REPRESENTATIVE_USER_JOURNEY', 'HUMAN_OBSERVATION'],
  PERSISTENCE: ['RESTART_RECOVERY'],
  TRANSPORT: ['SENDER_RECEIVER_RECEIPTS'],
  AUTHORIZATION: ['ALLOW_DENY_PROBE'],
  PERFORMANCE: ['MEASURED_WORKLOAD'],
  RESOURCE_SAFETY: ['RESOURCE_TELEMETRY'],
  LEARNING_IMPROVEMENT: ['HELD_OUT_EVALUATION'],
  QUALITY: ['ACCEPTANCE_INSPECTION', 'HUMAN_REVIEW', 'REPRESENTATIVE_USER_JOURNEY'],
  TASTE_MEANING: ['HUMAN_JUDGMENT'],
  WORKFLOW_OUTCOME: ['REPRESENTATIVE_USER_JOURNEY', 'HUMAN_OBSERVATION', 'AI_WORKFLOW_EVALUATION', 'HELD_OUT_EVALUATION']
};

const BENEFICIARY_SURFACES = {
  HUMAN: ['REPRESENTATIVE_USER_JOURNEY', 'HUMAN_OBSERVATION', 'LIVE_INTERACTION', 'HUMAN_REVIEW', 'HUMAN_JUDGMENT'],
  AI_WORKFLOW: ['AI_WORKFLOW_EVALUATION', 'HELD_OUT_EVALUATION']
};

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function exactTimestamp(value, label) {
  if (value == null || value === '') throw new Error(label + ' is required');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(label + ' must be a valid timestamp');
  return date.toISOString();
}

function exactDigest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a SHA-256 digest');
  return result;
}

function reference(value, input) {
  input = input || {};
  return {
    id: requiredText(input.id || 'evidence', 'reference id', 180),
    schema: requiredText(input.schema || 'application/octet-stream', 'reference schema', 180),
    sha256: sha256(value)
  };
}

function normalizeReference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' reference is required');
  return {
    id: requiredText(input.id, label + ' id', 180),
    schema: requiredText(input.schema, label + ' schema', 180),
    sha256: exactDigest(input.sha256, label + ' sha256')
  };
}

function normalizeReferences(values, label, required) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (required && !values.length) throw new Error(label + ' needs at least one reference');
  if (values.length > 32) throw new Error(label + ' exceeds 32 references');
  return values.map((value, index) => normalizeReference(value, label + '[' + index + ']'));
}

function normalizeClosure(input, label) {
  if (input == null) return { state: 'UNKNOWN', checkedAt: null, receiptRef: null, coveredDigests: [] };
  const state = String(input.state || '').toUpperCase();
  if (!CLOSURE_STATES.includes(state)) throw new Error(label + ' state is unsupported');
  if (state === 'UNKNOWN' && input.checkedAt == null && input.receiptRef == null) {
    return { state: 'UNKNOWN', checkedAt: null, receiptRef: null, coveredDigests: [] };
  }
  if (!Array.isArray(input.coveredDigests)) throw new Error(label + ' coveredDigests must be an array');
  if (input.coveredDigests.length > 96) throw new Error(label + ' coveredDigests exceeds 96 entries');
  const coveredDigests = Array.from(new Set(input.coveredDigests.map((value, index) => exactDigest(value, label + ' coveredDigests[' + index + ']')))).sort();
  return {
    state,
    checkedAt: exactTimestamp(input.checkedAt, label + ' checkedAt'),
    receiptRef: normalizeReference(input.receiptRef, label + ' receipt'),
    coveredDigests
  };
}

function normalizeClaim(input, index) {
  input = input || {};
  const label = 'claim[' + index + ']';
  const beneficiary = String(input.beneficiary || '').toUpperCase();
  const kind = String(input.kind || '').toUpperCase();
  const verdict = String(input.verdict || '').toUpperCase();
  const proofSurface = String(input.proofSurface || 'NOT_RUN').toUpperCase();
  if (!BENEFICIARIES.includes(beneficiary)) throw new Error(label + ' beneficiary is unsupported');
  if (!CLAIM_KINDS.includes(kind)) throw new Error(label + ' kind is unsupported');
  if (!VERDICTS.includes(verdict)) throw new Error(label + ' verdict is unsupported');
  if (!PROOF_SURFACES.includes(proofSurface)) throw new Error(label + ' proofSurface is unsupported');

  const evidenceRefs = normalizeReferences(input.evidenceRefs || [], label + ' evidenceRefs', false);
  const baselineRef = input.baselineRef ? normalizeReference(input.baselineRef, label + ' baseline') : null;
  const outcomeRef = input.outcomeRef ? normalizeReference(input.outcomeRef, label + ' outcome') : null;
  const evidenceClosure = normalizeClosure(input.evidenceClosure, label + ' evidenceClosure');
  const limitations = Array.isArray(input.limitations)
    ? input.limitations.map((value, limitIndex) => requiredText(value, label + ' limitation ' + limitIndex, 500))
    : [];
  if (limitations.length > 24) throw new Error(label + ' limitations exceed 24 entries');

  const routeReasons = [];
  if (verdict === 'PASS' || verdict === 'FAIL') {
    if (!KIND_SURFACES[kind].includes(proofSurface)) routeReasons.push('PROOF_SURFACE_DOES_NOT_MATCH_CLAIM_KIND');
    if (beneficiary !== 'SHARED_SYSTEM' && !BENEFICIARY_SURFACES[beneficiary].includes(proofSurface)) {
      routeReasons.push(beneficiary + '_BENEFIT_REQUIRES_BENEFICIARY_NATIVE_EVIDENCE');
    }
    if (!baselineRef || !outcomeRef) routeReasons.push('BASELINE_AND_OUTCOME_REFERENCES_REQUIRED');
    if (!evidenceRefs.length) routeReasons.push('EVIDENCE_REFERENCE_REQUIRED');
    if (evidenceClosure.state !== 'CURRENT' || !evidenceClosure.receiptRef) routeReasons.push('CURRENT_EVIDENCE_CLOSURE_REQUIRED');
    const requiredClosureDigests = [baselineRef, outcomeRef, ...evidenceRefs].filter(Boolean).map((ref) => ref.sha256);
    if (requiredClosureDigests.some((requiredDigest) => !evidenceClosure.coveredDigests.includes(requiredDigest))) {
      routeReasons.push('EVIDENCE_CLOSURE_DOES_NOT_COVER_CLAIM');
    }
  }

  const routeStatus = verdict === 'UNKNOWN' || verdict === 'NOT_RUN'
    ? 'NOT_PROVEN'
    : routeReasons.length ? 'HOLD' : 'ADMITTED';

  return {
    id: requiredText(input.id, label + ' id', 180),
    beneficiary,
    statement: requiredText(input.statement, label + ' statement', 1200),
    kind,
    verdict,
    admittedVerdict: routeStatus === 'ADMITTED' ? verdict : (verdict === 'PASS' || verdict === 'FAIL' ? 'UNKNOWN' : verdict),
    proofSurface,
    baselineRef,
    outcomeRef,
    evidenceRefs,
    evidenceClosure,
    routeStatus,
    routeReasons,
    limitations
  };
}

function deriveOutcomeState(cycle, noNewInformation, claims, refresh) {
  if (noNewInformation) return 'NO_NEW_INFORMATION';
  if (claims.some((claim) => claim.routeStatus === 'HOLD')) return 'EVIDENCE_HOLD';
  if (claims.some((claim) => claim.admittedVerdict === 'FAIL')) return 'REGRESSION_HOLD';
  if (cycle.state === 'REFRESH_DUE' || refresh.due) return 'REFRESH_REQUIRED';
  if (['REJECTED', 'STEWARD_HOLD', 'REPAIR_OR_REJECT', 'VERIFICATION_HOLD'].includes(cycle.state)) return 'CYCLE_HOLD';
  if (cycle.state !== 'AVAILABLE_FOR_REUSE') return 'CANDIDATE_ONLY';

  const humanPass = claims.some((claim) => claim.beneficiary === 'HUMAN' && claim.admittedVerdict === 'PASS');
  const aiPass = claims.some((claim) => claim.beneficiary === 'AI_WORKFLOW' && claim.admittedVerdict === 'PASS');
  const systemPass = claims.some((claim) => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS');
  if (humanPass && aiPass) return 'GROUNDED_SHARED_GROWTH';
  if (humanPass) return 'HUMAN_GROWTH_ONLY';
  if (aiPass) return 'AI_WORKFLOW_GROWTH_ONLY';
  if (systemPass) return 'SYSTEM_EFFECT_ONLY';
  return 'AVAILABLE_EFFECT_UNKNOWN';
}

function growthClaim(state) {
  const claims = {
    GROUNDED_SHARED_GROWTH: 'HUMAN_AND_AI_WORKFLOW_OUTCOMES_EVIDENCE_BACKED',
    HUMAN_GROWTH_ONLY: 'HUMAN_OUTCOME_EVIDENCE_BACKED_AI_WORKFLOW_UNKNOWN',
    AI_WORKFLOW_GROWTH_ONLY: 'AI_WORKFLOW_OUTCOME_EVIDENCE_BACKED_HUMAN_UNKNOWN',
    SYSTEM_EFFECT_ONLY: 'SYSTEM_EFFECT_EVIDENCE_BACKED_BENEFICIARY_OUTCOMES_UNKNOWN',
    CANDIDATE_ONLY: 'CANDIDATE_OR_LIFECYCLE_EFFECT_ONLY',
    NO_NEW_INFORMATION: 'NO_NEW_GROWTH_CLAIM'
  };
  return claims[state] || 'GROWTH_NOT_ESTABLISHED';
}

function normalizeRefresh(input, cycle) {
  input = input || {};
  return {
    checkedAt: exactTimestamp(input.checkedAt || cycle.refresh.checkedAt, 'refresh checkedAt'),
    due: input.due === true || cycle.state === 'REFRESH_DUE',
    reason: requiredText(input.reason || cycle.refresh.reason, 'refresh reason', 800)
  };
}

function buildOutcome(input) {
  input = input || {};
  const cycle = clone(input.cycleReceipt);
  const cycleCheck = CapabilityLoop.verify(cycle);
  if (!cycleCheck.pass) throw new Error('cycle receipt is invalid: ' + cycleCheck.errors.join('; '));

  const noNewInformation = input.noNewInformation === true;
  const previousOutcomeRef = input.previousOutcomeRef ? normalizeReference(input.previousOutcomeRef, 'previous outcome') : null;
  if (previousOutcomeRef && previousOutcomeRef.schema !== OUTCOME_SCHEMA) throw new Error('previous outcome schema mismatch');
  const informationRefs = normalizeReferences(input.informationRefs || [], 'informationRefs', !noNewInformation);
  const claims = Array.isArray(input.claims) ? input.claims.map(normalizeClaim) : [];
  if (claims.length > 64) throw new Error('claims exceed 64 entries');
  if (new Set(claims.map((claim) => claim.id)).size !== claims.length) throw new Error('claim ids must be unique');
  if (noNewInformation && !previousOutcomeRef) throw new Error('NO_NEW_INFORMATION requires a previous outcome reference');
  if (noNewInformation && (informationRefs.length || claims.length)) throw new Error('NO_NEW_INFORMATION cannot carry new information or claims');

  const refresh = normalizeRefresh(input.refresh, cycle);
  const state = deriveOutcomeState(cycle, noNewInformation, claims, refresh);
  const receipt = {
    schema: OUTCOME_SCHEMA,
    version: VERSION,
    outcomeId: requiredText(input.outcomeId, 'outcomeId', 180),
    generatedAt: exactTimestamp(input.generatedAt, 'generatedAt'),
    capabilityId: cycle.capabilityId,
    cycleReceipt: cycle,
    interventionRef: input.interventionRef ? normalizeReference(input.interventionRef, 'intervention') : null,
    previousOutcomeRef,
    noNewInformation,
    informationRefs,
    claims,
    refresh,
    state,
    growthClaim: growthClaim(state),
    nextEvidenceNeeds: noNewInformation ? ['REFER_TO_PREVIOUS_OUTCOME'] : [
      ...(claims.some((claim) => claim.beneficiary === 'HUMAN' && claim.admittedVerdict === 'PASS') ? [] : ['HUMAN_BENEFIT_NATIVE_EVIDENCE']),
      ...(claims.some((claim) => claim.beneficiary === 'AI_WORKFLOW' && claim.admittedVerdict === 'PASS') ? [] : ['AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE']),
      ...(claims.some((claim) => claim.routeStatus === 'HOLD') ? ['REPAIR_EVIDENCE_ROUTE'] : []),
      ...(refresh.due ? ['REFRESH_CHANGED_BASELINE_OR_EVIDENCE'] : [])
    ],
    truth: {
      receiptAuthority: 'BENEFICIARY_OUTCOME_LINKING_ONLY',
      capabilityAvailabilityIsGrowth: false,
      systemEffectIsHumanBenefit: false,
      systemEffectIsAiWorkflowBenefit: false,
      humanBenefitRequiresHumanNativeEvidence: true,
      aiWorkflowBenefitRequiresHeldOutOrWorkflowEvidence: true,
      modelWeightTrainingClaimed: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      automaticRootMutation: false
    },
    receiptDigest: null
  };
  const digestPayload = clone(receipt);
  delete digestPayload.receiptDigest;
  receipt.receiptDigest = sha256(digestPayload);
  return receipt;
}

function verifyOutcome(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== OUTCOME_SCHEMA) return { pass: false, errors: ['outcome receipt schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('outcome receipt version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildOutcome({
      outcomeId: receipt.outcomeId,
      generatedAt: receipt.generatedAt,
      cycleReceipt: receipt.cycleReceipt,
      interventionRef: receipt.interventionRef,
      previousOutcomeRef: receipt.previousOutcomeRef,
      noNewInformation: receipt.noNewInformation,
      informationRefs: receipt.informationRefs,
      claims: receipt.claims,
      refresh: receipt.refresh
    });
  } catch (error) {
    errors.push('outcome receipt content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('outcome receipt content or derived state mismatch');
    if (rebuilt.receiptDigest !== receipt.receiptDigest) errors.push('outcome receipt digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

function portfolioOverall(effectiveOutcomes) {
  const states = effectiveOutcomes.map((receipt) => receipt.state);
  if (states.some((state) => ['EVIDENCE_HOLD', 'REGRESSION_HOLD', 'CYCLE_HOLD'].includes(state))) return 'HOLD';
  if (states.includes('REFRESH_REQUIRED')) return 'REFRESH_REQUIRED';
  if (states.includes('GROUNDED_SHARED_GROWTH')) return 'GROUNDED_SHARED_GROWTH_PRESENT';
  if (states.includes('HUMAN_GROWTH_ONLY') || states.includes('AI_WORKFLOW_GROWTH_ONLY')) return 'PARTIAL_BENEFICIARY_GROWTH';
  if (states.includes('SYSTEM_EFFECT_ONLY')) return 'SYSTEM_EFFECTS_ONLY';
  return 'CANDIDATES_OR_UNKNOWN_EFFECTS';
}

function buildPortfolio(input) {
  input = input || {};
  if (!Array.isArray(input.outcomes) || !input.outcomes.length) throw new Error('portfolio needs at least one outcome receipt');
  if (input.outcomes.length > 128) throw new Error('portfolio exceeds 128 outcome receipts');
  const outcomes = input.outcomes.map((receipt, index) => {
    const copied = clone(receipt);
    const checked = verifyOutcome(copied);
    if (!checked.pass) throw new Error('outcome[' + index + '] is invalid: ' + checked.errors.join('; '));
    return copied;
  }).sort((a, b) => a.generatedAt.localeCompare(b.generatedAt) || a.outcomeId.localeCompare(b.outcomeId));

  const ids = new Set();
  const chains = new Map();
  for (const outcome of outcomes) {
    if (ids.has(outcome.outcomeId)) throw new Error('duplicate outcomeId: ' + outcome.outcomeId);
    ids.add(outcome.outcomeId);
    const chain = chains.get(outcome.capabilityId);
    const previous = chain && chain.latest;
    if (!previous && outcome.previousOutcomeRef) throw new Error('first portfolio outcome for ' + outcome.capabilityId + ' must not skip earlier ancestry');
    if (previous) {
      if (!outcome.previousOutcomeRef || outcome.previousOutcomeRef.sha256 !== previous.receiptDigest || outcome.previousOutcomeRef.id !== previous.outcomeId) {
        throw new Error('outcome ancestry mismatch for ' + outcome.capabilityId);
      }
      if (outcome.noNewInformation && outcome.cycleReceipt.receiptDigest !== previous.cycleReceipt.receiptDigest) {
        throw new Error('NO_NEW_INFORMATION cannot cross a changed capability cycle for ' + outcome.capabilityId);
      }
      if (outcome.noNewInformation && outcome.refresh.due) {
        throw new Error('NO_NEW_INFORMATION cannot hide a due refresh for ' + outcome.capabilityId);
      }
    }
    chains.set(outcome.capabilityId, {
      latest: outcome,
      effective: outcome.noNewInformation && chain ? chain.effective : outcome
    });
  }

  const latest = Array.from(chains.values()).sort((a, b) => a.latest.capabilityId.localeCompare(b.latest.capabilityId));
  const stateCounts = {};
  outcomes.forEach((outcome) => { stateCounts[outcome.state] = (stateCounts[outcome.state] || 0) + 1; });
  const portfolio = {
    schema: PORTFOLIO_SCHEMA,
    version: VERSION,
    portfolioId: requiredText(input.portfolioId, 'portfolioId', 180),
    generatedAt: exactTimestamp(input.generatedAt, 'generatedAt'),
    outcomes,
    latest: latest.map(({ latest: outcome, effective }) => ({
      capabilityId: outcome.capabilityId,
      outcomeId: outcome.outcomeId,
      state: outcome.state,
      receiptDigest: outcome.receiptDigest,
      effectiveOutcomeId: effective.outcomeId,
      effectiveState: effective.state,
      effectiveReceiptDigest: effective.receiptDigest,
      nextEvidenceNeeds: effective.nextEvidenceNeeds
    })),
    summary: {
      outcomeCount: outcomes.length,
      capabilityCount: latest.length,
      stateCounts,
      overall: portfolioOverall(latest.map((item) => item.effective))
    },
    truth: {
      portfolioIsDerivedView: true,
      receiptsRemainAuthorityForTheirOwnClaimsOnly: true,
      noNewInformationCannotErasePriorOutcome: true,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    portfolioDigest: null
  };
  const digestPayload = clone(portfolio);
  delete digestPayload.portfolioDigest;
  portfolio.portfolioDigest = sha256(digestPayload);
  return portfolio;
}

function verifyPortfolio(portfolio) {
  const errors = [];
  if (!portfolio || portfolio.schema !== PORTFOLIO_SCHEMA) return { pass: false, errors: ['portfolio schema mismatch'] };
  if (portfolio.version !== VERSION) errors.push('portfolio version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildPortfolio({
      portfolioId: portfolio.portfolioId,
      generatedAt: portfolio.generatedAt,
      outcomes: portfolio.outcomes
    });
  } catch (error) {
    errors.push('portfolio content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(portfolio)) errors.push('portfolio content or derived summary mismatch');
    if (rebuilt.portfolioDigest !== portfolio.portfolioDigest) errors.push('portfolio digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  OUTCOME_SCHEMA,
  PORTFOLIO_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  reference,
  buildOutcome,
  verifyOutcome,
  buildPortfolio,
  verifyPortfolio
};
