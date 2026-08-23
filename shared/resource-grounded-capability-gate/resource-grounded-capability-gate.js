'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const CapabilityLoop = require('../verified-capability-loop/verified-capability-loop');

const POLICY_SCHEMA = 'axm.resource-grounded-capability-policy/v1';
const OBSERVATION_SCHEMA = 'axm.resource-observation/v1';
const RECEIPT_SCHEMA = 'axm.resource-grounded-capability-gate-receipt/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const IDENTIFIER = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/;
const EVIDENCE_AUTHORITIES = ['DIRECT_MACHINE_METER', 'IMPORTED_ATTESTATION', 'MANUAL_DECLARATION'];
const COVERAGE_STATES = ['COMPLETE', 'PARTIAL', 'UNKNOWN'];
const DIMENSIONS = Object.freeze({
  CPU_CORE_MILLISECONDS: 'ms',
  WALL_MILLISECONDS: 'ms',
  ACCELERATOR_MILLISECONDS: 'ms',
  PEAK_MEMORY_BYTES: 'byte',
  STORAGE_WRITE_BYTES: 'byte',
  NETWORK_INGRESS_BYTES: 'byte',
  NETWORK_EGRESS_BYTES: 'byte',
  ENERGY_MILLIWATT_HOURS: 'mWh',
  CARBON_MILLIGRAMS: 'mgCO2e'
});

function canonical(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(canonical(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : canonical(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  return value;
}

function exactKeys(value, allowed, label) {
  const keys = Object.keys(object(value, label));
  const extra = keys.filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (extra.length) throw new Error(label + ' has unsupported fields: ' + extra.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}

function string(value, label, maximum) {
  if (typeof value !== 'string') throw new Error(label + ' must be a string');
  const result = value.trim();
  if (!result) throw new Error(label + ' is required');
  if (result !== value) throw new Error(label + ' must not contain surrounding whitespace');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function identifier(value, label) {
  const result = string(value, label, 180);
  if (!IDENTIFIER.test(result)) throw new Error(label + ' must be a lowercase portable identifier');
  return result;
}

function enumValue(value, allowed, label) {
  const result = string(value, label, 80);
  if (!allowed.includes(result)) throw new Error(label + ' is unsupported');
  return result;
}

function digest(value, label) {
  const result = string(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return result;
}

function timestamp(value, label) {
  const result = string(value, label, 40);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result) {
    throw new Error(label + ' must be a canonical UTC timestamp');
  }
  return result;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(label + ' must be a boolean');
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be a safe integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function nullableInteger(value, label, minimum, maximum) {
  return value === null ? null : integer(value, label, minimum, maximum);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function reference(value, input) {
  input = input || {};
  return {
    id: identifier(input.id || 'evidence', 'reference id'),
    schema: string(input.schema || 'application/octet-stream', 'reference schema', 180),
    sha256: sha256(value)
  };
}

function normalizeReference(input, label) {
  exactKeys(input, ['id', 'schema', 'sha256'], label);
  return {
    id: identifier(input.id, label + ' id'),
    schema: string(input.schema, label + ' schema', 180),
    sha256: digest(input.sha256, label + ' sha256')
  };
}

function sameReference(left, right) {
  return canonical(left) === canonical(right);
}

function normalizeDimension(input, index) {
  const label = 'policy dimensions[' + index + ']';
  exactKeys(input, ['id', 'unit', 'required', 'absoluteMax', 'maxRegressionBps'], label);
  const id = enumValue(input.id, Object.keys(DIMENSIONS), label + ' id');
  const unit = string(input.unit, label + ' unit', 24);
  if (unit !== DIMENSIONS[id]) throw new Error(label + ' unit must be ' + DIMENSIONS[id] + ' for ' + id);
  const required = boolean(input.required, label + ' required');
  const absoluteMax = nullableInteger(input.absoluteMax, label + ' absoluteMax', 0, Number.MAX_SAFE_INTEGER);
  const maxRegressionBps = nullableInteger(input.maxRegressionBps, label + ' maxRegressionBps', 0, 100000);
  if (required && absoluteMax === null && maxRegressionBps === null) {
    throw new Error(label + ' required dimension needs an absolute or regression ceiling');
  }
  return { id, unit, required, absoluteMax, maxRegressionBps };
}

function normalizePolicyBody(input) {
  exactKeys(input, [
    'schema', 'policyId', 'capabilityId', 'candidateDigest', 'baselineDigest',
    'workloadRef', 'environmentRef', 'freshnessWindowMs', 'dimensions'
  ], 'resource policy');
  if (input.schema !== POLICY_SCHEMA) throw new Error('resource policy schema mismatch');
  if (!Array.isArray(input.dimensions) || !input.dimensions.length || input.dimensions.length > 16) {
    throw new Error('resource policy dimensions must contain 1 through 16 entries');
  }
  const dimensions = input.dimensions.map(normalizeDimension).sort((a, b) => compareText(a.id, b.id));
  const duplicates = dimensions.filter((item, index) => index > 0 && dimensions[index - 1].id === item.id);
  if (duplicates.length) throw new Error('resource policy dimension ids must be unique');
  if (!dimensions.some((item) => item.required)) throw new Error('resource policy needs at least one required dimension');
  return {
    schema: POLICY_SCHEMA,
    policyId: identifier(input.policyId, 'resource policy policyId'),
    capabilityId: identifier(input.capabilityId, 'resource policy capabilityId'),
    candidateDigest: digest(input.candidateDigest, 'resource policy candidateDigest'),
    baselineDigest: digest(input.baselineDigest, 'resource policy baselineDigest'),
    workloadRef: normalizeReference(input.workloadRef, 'resource policy workloadRef'),
    environmentRef: normalizeReference(input.environmentRef, 'resource policy environmentRef'),
    freshnessWindowMs: integer(input.freshnessWindowMs, 'resource policy freshnessWindowMs', 1, 31536000000),
    dimensions
  };
}

function sealPolicy(input) {
  const body = normalizePolicyBody(input);
  return Object.assign(body, { policyDigest: sha256(body) });
}

function normalizePolicy(input) {
  exactKeys(input, [
    'schema', 'policyId', 'capabilityId', 'candidateDigest', 'baselineDigest',
    'workloadRef', 'environmentRef', 'freshnessWindowMs', 'dimensions', 'policyDigest'
  ], 'sealed resource policy');
  const bodyInput = clone(input);
  delete bodyInput.policyDigest;
  const sealed = sealPolicy(bodyInput);
  if (digest(input.policyDigest, 'resource policy policyDigest') !== sealed.policyDigest) {
    throw new Error('resource policy digest mismatch');
  }
  return sealed;
}

function normalizeMeasurement(input, index) {
  const label = 'measurements[' + index + ']';
  exactKeys(input, ['id', 'unit', 'coverage', 'value', 'measurementDefinitionRef'], label);
  const id = enumValue(input.id, Object.keys(DIMENSIONS), label + ' id');
  const unit = string(input.unit, label + ' unit', 24);
  if (unit !== DIMENSIONS[id]) throw new Error(label + ' unit must be ' + DIMENSIONS[id] + ' for ' + id);
  const coverage = enumValue(input.coverage, COVERAGE_STATES, label + ' coverage');
  const value = nullableInteger(input.value, label + ' value', 0, Number.MAX_SAFE_INTEGER);
  if (coverage === 'COMPLETE' && value === null) throw new Error(label + ' COMPLETE coverage requires a value');
  if (coverage === 'UNKNOWN' && value !== null) throw new Error(label + ' UNKNOWN coverage requires a null value');
  return {
    id,
    unit,
    coverage,
    value,
    measurementDefinitionRef: normalizeReference(input.measurementDefinitionRef, label + ' measurementDefinitionRef')
  };
}

function normalizeObservationBody(input) {
  exactKeys(input, [
    'schema', 'observationId', 'subjectKind', 'subjectDigest', 'workloadRef',
    'environmentRef', 'observedAt', 'evidenceAuthority', 'measurements', 'evidenceRef'
  ], 'resource observation');
  if (input.schema !== OBSERVATION_SCHEMA) throw new Error('resource observation schema mismatch');
  if (!Array.isArray(input.measurements) || !input.measurements.length || input.measurements.length > 16) {
    throw new Error('resource observation measurements must contain 1 through 16 entries');
  }
  const measurements = input.measurements.map(normalizeMeasurement).sort((a, b) => compareText(a.id, b.id));
  if (measurements.some((item, index) => index > 0 && measurements[index - 1].id === item.id)) {
    throw new Error('resource observation measurement ids must be unique');
  }
  return {
    schema: OBSERVATION_SCHEMA,
    observationId: identifier(input.observationId, 'resource observation observationId'),
    subjectKind: enumValue(input.subjectKind, ['BASELINE', 'CANDIDATE'], 'resource observation subjectKind'),
    subjectDigest: digest(input.subjectDigest, 'resource observation subjectDigest'),
    workloadRef: normalizeReference(input.workloadRef, 'resource observation workloadRef'),
    environmentRef: normalizeReference(input.environmentRef, 'resource observation environmentRef'),
    observedAt: timestamp(input.observedAt, 'resource observation observedAt'),
    evidenceAuthority: enumValue(input.evidenceAuthority, EVIDENCE_AUTHORITIES, 'resource observation evidenceAuthority'),
    measurements,
    evidenceRef: normalizeReference(input.evidenceRef, 'resource observation evidenceRef')
  };
}

function sealObservation(input) {
  const body = normalizeObservationBody(input);
  return Object.assign(body, { observationDigest: sha256(body) });
}

function normalizeObservation(input, expectedKind) {
  if (input === null) return null;
  exactKeys(input, [
    'schema', 'observationId', 'subjectKind', 'subjectDigest', 'workloadRef',
    'environmentRef', 'observedAt', 'evidenceAuthority', 'measurements', 'evidenceRef',
    'observationDigest'
  ], expectedKind.toLowerCase() + ' observation');
  const bodyInput = clone(input);
  delete bodyInput.observationDigest;
  const sealed = sealObservation(bodyInput);
  if (sealed.subjectKind !== expectedKind) throw new Error('observation subjectKind must be ' + expectedKind);
  if (digest(input.observationDigest, 'resource observation observationDigest') !== sealed.observationDigest) {
    throw new Error('resource observation digest mismatch');
  }
  return sealed;
}

function observationAgeState(observation, evaluatedAt, freshnessWindowMs) {
  const observed = Date.parse(observation.observedAt);
  const evaluated = Date.parse(evaluatedAt);
  if (observed > evaluated) throw new Error('resource observation cannot be from the future');
  return evaluated - observed <= freshnessWindowMs ? 'CURRENT' : 'STALE';
}

function assertBindings(policy, cycle, observation, expectedKind) {
  const expectedDigest = expectedKind === 'BASELINE'
    ? cycle.baseline.receiptRef.sha256
    : cycle.candidate.artifactRef.sha256;
  if (observation.subjectDigest !== expectedDigest) throw new Error(expectedKind + ' observation subject digest mismatch');
  if (!sameReference(observation.workloadRef, policy.workloadRef)) throw new Error(expectedKind + ' observation workload mismatch');
  if (!sameReference(observation.environmentRef, policy.environmentRef)) throw new Error(expectedKind + ' observation environment mismatch');
  const expectedIds = policy.dimensions.map((item) => item.id).join('|');
  const actualIds = observation.measurements.map((item) => item.id).join('|');
  if (actualIds !== expectedIds) throw new Error(expectedKind + ' observation measurement set mismatch');
}

function regressionWithin(baseline, candidate, basisPoints) {
  if (basisPoints === null) return true;
  if (baseline === 0) return candidate === 0;
  return BigInt(candidate) * 10000n <= BigInt(baseline) * BigInt(10000 + basisPoints);
}

function evaluateDimension(policyDimension, baseline, candidate) {
  const definitionAligned = sameReference(baseline.measurementDefinitionRef, candidate.measurementDefinitionRef);
  const complete = baseline.coverage === 'COMPLETE' && candidate.coverage === 'COMPLETE' &&
    baseline.value !== null && candidate.value !== null;
  const evidenceEligible = complete && definitionAligned;
  const absolutePass = policyDimension.absoluteMax === null ||
    (candidate.value !== null && candidate.value <= policyDimension.absoluteMax);
  const regressionPass = policyDimension.maxRegressionBps === null ||
    (complete && regressionWithin(baseline.value, candidate.value, policyDimension.maxRegressionBps));
  let verdict = 'PASS';
  let reason = 'Measured candidate is within the declared resource envelope.';
  if (!evidenceEligible) {
    verdict = policyDimension.required ? 'EVIDENCE_HOLD' : 'OPTIONAL_UNKNOWN';
    reason = definitionAligned
      ? 'Comparable complete measurement evidence is unavailable.'
      : 'Baseline and candidate use different measurement definitions.';
  } else if (!absolutePass) {
    verdict = policyDimension.required ? 'BUDGET_EXCEEDED' : 'ADVISORY_EXCEEDED';
    reason = 'Candidate exceeds the declared absolute ceiling.';
  } else if (!regressionPass) {
    verdict = policyDimension.required ? 'REGRESSION_EXCEEDED' : 'ADVISORY_REGRESSION';
    reason = 'Candidate exceeds the declared regression ceiling.';
  }
  return {
    id: policyDimension.id,
    unit: policyDimension.unit,
    required: policyDimension.required,
    baselineValue: baseline.value,
    candidateValue: candidate.value,
    absoluteMax: policyDimension.absoluteMax,
    maxRegressionBps: policyDimension.maxRegressionBps,
    baselineCoverage: baseline.coverage,
    candidateCoverage: candidate.coverage,
    definitionAligned,
    verdict,
    reason
  };
}

function deriveState(policy, baseline, candidate, evaluatedAt) {
  if (!baseline) return { state: 'BASELINE_OBSERVATION_REQUIRED', results: [] };
  if (!candidate) return { state: 'CANDIDATE_OBSERVATION_REQUIRED', results: [] };
  const baselineFreshness = observationAgeState(baseline, evaluatedAt, policy.freshnessWindowMs);
  const candidateFreshness = observationAgeState(candidate, evaluatedAt, policy.freshnessWindowMs);
  const results = policy.dimensions.map((dimension, index) =>
    evaluateDimension(dimension, baseline.measurements[index], candidate.measurements[index]));
  if (baselineFreshness === 'STALE' || candidateFreshness === 'STALE') {
    return { state: 'OBSERVATION_STALE', results, baselineFreshness, candidateFreshness };
  }
  if (baseline.evidenceAuthority === 'MANUAL_DECLARATION' || candidate.evidenceAuthority === 'MANUAL_DECLARATION' ||
      results.some((item) => item.required && item.verdict === 'EVIDENCE_HOLD')) {
    return { state: 'RESOURCE_EVIDENCE_HOLD', results, baselineFreshness, candidateFreshness };
  }
  if (results.some((item) => item.required && item.verdict === 'BUDGET_EXCEEDED')) {
    return { state: 'RESOURCE_BUDGET_EXCEEDED', results, baselineFreshness, candidateFreshness };
  }
  if (results.some((item) => item.required && item.verdict === 'REGRESSION_EXCEEDED')) {
    return { state: 'RESOURCE_REGRESSION_HOLD', results, baselineFreshness, candidateFreshness };
  }
  return { state: 'RESOURCE_EVIDENCE_ALIGNED', results, baselineFreshness, candidateFreshness };
}

function normalizeUpstreamCycle(input) {
  const result = CapabilityLoop.verify(input);
  if (!result.pass) throw new Error('upstream capability cycle does not verify: ' + result.errors.join('; '));
  if (input.state !== 'AWAITING_STEWARD') {
    throw new Error('upstream capability cycle must be AWAITING_STEWARD before resource review');
  }
  if (!input.candidate || !input.verification || input.verification.verdict !== 'PASS' ||
      !['INDEPENDENT_RUNTIME', 'MIXED'].includes(input.verification.evidenceAuthority)) {
    throw new Error('upstream capability cycle lacks effective functional verification');
  }
  return clone(input);
}

function build(input) {
  exactKeys(input, ['gateId', 'evaluatedAt', 'capabilityCycle', 'policy', 'baselineObservation', 'candidateObservation'], 'gate input');
  const gateId = identifier(input.gateId, 'gateId');
  const evaluatedAt = timestamp(input.evaluatedAt, 'evaluatedAt');
  const cycle = normalizeUpstreamCycle(input.capabilityCycle);
  const policy = normalizePolicy(input.policy);
  const baseline = normalizeObservation(input.baselineObservation, 'BASELINE');
  const candidate = normalizeObservation(input.candidateObservation, 'CANDIDATE');
  if (policy.capabilityId !== cycle.capabilityId) throw new Error('resource policy capabilityId mismatch');
  if (policy.candidateDigest !== cycle.candidate.artifactRef.sha256) throw new Error('resource policy candidate digest mismatch');
  if (policy.baselineDigest !== cycle.baseline.receiptRef.sha256) throw new Error('resource policy baseline digest mismatch');
  if (baseline) assertBindings(policy, cycle, baseline, 'BASELINE');
  if (candidate) assertBindings(policy, cycle, candidate, 'CANDIDATE');
  const derived = deriveState(policy, baseline, candidate, evaluatedAt);
  const requiredResults = derived.results.filter((item) => item.required);
  const summary = {
    dimensions: derived.results.length,
    requiredDimensions: policy.dimensions.filter((item) => item.required).length,
    requiredPassed: requiredResults.filter((item) => item.verdict === 'PASS').length,
    requiredHeld: requiredResults.filter((item) => item.verdict === 'EVIDENCE_HOLD').length,
    requiredBudgetExceeded: requiredResults.filter((item) => item.verdict === 'BUDGET_EXCEEDED').length,
    requiredRegressionExceeded: requiredResults.filter((item) => item.verdict === 'REGRESSION_EXCEEDED').length,
    optionalUnknown: derived.results.filter((item) => item.verdict === 'OPTIONAL_UNKNOWN').length,
    optionalAdvisories: derived.results.filter((item) => ['ADVISORY_EXCEEDED', 'ADVISORY_REGRESSION'].includes(item.verdict)).length
  };
  const aligned = derived.state === 'RESOURCE_EVIDENCE_ALIGNED';
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    gateId,
    evaluatedAt,
    state: derived.state,
    capabilityId: cycle.capabilityId,
    candidateDigest: cycle.candidate.artifactRef.sha256,
    baselineDigest: cycle.baseline.receiptRef.sha256,
    capabilityCycleRef: {
      id: cycle.cycleId,
      schema: cycle.schema,
      sha256: sha256(cycle)
    },
    policy,
    baselineObservation: baseline,
    candidateObservation: candidate,
    freshness: {
      baseline: derived.baselineFreshness || 'NOT_AVAILABLE',
      candidate: derived.candidateFreshness || 'NOT_AVAILABLE'
    },
    results: derived.results,
    summary,
    recommendation: {
      verdict: aligned ? 'READY_FOR_HUMAN_REVIEW' : 'HOLD',
      reason: aligned
        ? 'Required resource evidence aligns with the declared envelope; human judgment is still required.'
        : 'Resource evidence is missing, stale, incomparable, over budget, or regressive.'
    },
    truth: {
      gateAuthority: 'RESOURCE_EVIDENCE_COMPARISON_ONLY',
      measurementPerformed: false,
      measurementEvidenceBytesVerified: false,
      observationAuthorityAuthenticated: false,
      functionalVerificationReperformed: false,
      unknownTreatedAsUnlimited: false,
      improvementEstablished: false,
      hardwareSafetyProved: false,
      longTermSafetyProved: false,
      automaticExecution: false,
      automaticPermissionGrant: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      automaticRootMutation: false,
      humanStewardDecisionRequired: true
    },
    receiptDigest: null
  };
  const digestPayload = clone(receipt);
  delete digestPayload.receiptDigest;
  receipt.receiptDigest = sha256(digestPayload);
  return receipt;
}

function verify(receipt, capabilityCycle) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA) return { pass: false, errors: ['receipt schema mismatch'] };
  if (!capabilityCycle) return { pass: false, errors: ['upstream capability cycle is required'] };
  let rebuilt = null;
  try {
    rebuilt = build({
      gateId: receipt.gateId,
      evaluatedAt: receipt.evaluatedAt,
      capabilityCycle,
      policy: receipt.policy,
      baselineObservation: receipt.baselineObservation,
      candidateObservation: receipt.candidateObservation
    });
  } catch (error) {
    errors.push('receipt content invalid: ' + error.message);
  }
  if (rebuilt && canonical(rebuilt) !== canonical(receipt)) errors.push('receipt content or derived state mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  POLICY_SCHEMA,
  OBSERVATION_SCHEMA,
  RECEIPT_SCHEMA,
  VERSION,
  DIMENSIONS,
  canonical,
  sha256,
  reference,
  sealPolicy,
  sealObservation,
  build,
  verify
};
