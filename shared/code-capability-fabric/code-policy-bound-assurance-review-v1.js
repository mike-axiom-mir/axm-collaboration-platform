'use strict';

const Fabric = require('./code-capability-fabric-v2');
const Independent = require('./code-independent-assurance-review-v1');

const VERSION = '0.1.0';
const POLICY_BINDING_SCHEMA = 'axm.code-policy-bound-assurance-request/v1';
const REVIEW_SCHEMA = 'axm.code-policy-bound-assurance-review/v1';
const ROOTS_GATE = [
  'truth',
  'agency-non-domination',
  'continuity',
  'wisdom-over-speed'
];
const LIMITATIONS = [
  'BASE_V2_REQUEST_SCHEMA_UNCHANGED',
  'REQUESTER_AUTHORSHIP_NOT_PROVEN',
  'HUMAN_POLICY_ACCEPTANCE_NOT_PROVEN',
  'ORGANIZATIONAL_INDEPENDENCE_NOT_PROVEN'
];
const STATUSES = new Set([
  'BASE_REVIEW_HOLD',
  'POLICY_BINDING_HOLD',
  'REQUEST_BINDING_HOLD',
  'TRUST_POLICY_BINDING_HOLD',
  'ASSURANCE_SCOPE_HOLD',
  'TIME_WINDOW_HOLD',
  'AUTHENTICATED_HUMAN_DECISION_REQUIRED'
]);
const TRUTH_FIELDS = [
  'baseIndependentReviewVerified',
  'policyBindingIntegrityVerified',
  'baseRequestDigestBound',
  'trustPolicyDigestBound',
  'assuranceSchemaSetBound',
  'rootsGateBound',
  'bindingTimeWindowVerified',
  'requesterAuthorshipVerified',
  'humanPolicyAcceptanceVerified',
  'organizationalIndependenceProven',
  'resourceEnforcementObserved',
  'executorAuthorized',
  'providerCodeLoaded',
  'providerCodeExecuted',
  'workspaceContentRead',
  'permissionGranted',
  'networkUsed',
  'outputWritten',
  'installed',
  'promoted',
  'canonChanged'
];
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function canonicalJson(value) {
  return Fabric.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return Fabric.sha256(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = allowed.slice().sort(compareText);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const extras = actual.filter((key) => !expected.includes(key));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.join(', '));
  if (extras.length) throw new Error(label + ' has unsupported fields: ' + extras.join(', '));
}

function strictText(value, label, maximum = 240) {
  if (typeof value !== 'string' || !value.length || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(label + ' must be non-empty canonical text');
  }
  if (value.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return value;
}

function identifier(value, label) {
  const result = strictText(value, label, 128);
  if (!ID.test(result)) throw new Error(label + ' is not a stable identifier');
  return result;
}

function contractToken(value, label) {
  const result = strictText(value, label, 180);
  if (!CONTRACT_TOKEN.test(result)) throw new Error(label + ' is not a portable contract token');
  return result;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) {
    throw new Error(label + ' must be a lowercase SHA-256 digest');
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) {
    throw new Error(label + ' must be a canonical UTC timestamp');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(label + ' must be a valid canonical UTC timestamp');
  }
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeContracts(values, label, minimum = 0, maximum = 32) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must contain from ' + minimum + ' to ' + maximum + ' contract tokens');
  }
  const normalized = values.map((value, index) => contractToken(value, label + '[' + index + ']'));
  normalized.sort(compareText);
  if (new Set(normalized).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized;
}

function normalizeRootsGate(value) {
  if (!Array.isArray(value) || !same(value, ROOTS_GATE)) {
    throw new Error('policy binding.rootsGate must preserve the four roots in exact order');
  }
  return ROOTS_GATE.slice();
}

function normalizePolicyBindingCore(value) {
  exactKeys(value, [
    'schema', 'id', 'baseRequestRef', 'trustPolicyRef', 'assuranceSchemas',
    'rootsGate', 'boundAt', 'expiresAt', 'scope', 'authority'
  ], 'policy binding');
  if (value.schema !== POLICY_BINDING_SCHEMA) throw new Error('policy binding schema mismatch');
  if (value.scope !== 'INDEPENDENT_ASSURANCE_REVIEW_ONLY') {
    throw new Error('policy binding.scope must remain INDEPENDENT_ASSURANCE_REVIEW_ONLY');
  }
  if (value.authority !== 'NONE') throw new Error('policy binding.authority must remain NONE');
  const boundAt = timestamp(value.boundAt, 'policy binding.boundAt');
  const expiresAt = timestamp(value.expiresAt, 'policy binding.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(boundAt)) {
    throw new Error('policy binding.expiresAt must be after boundAt');
  }
  return {
    schema: POLICY_BINDING_SCHEMA,
    id: identifier(value.id, 'policy binding.id'),
    baseRequestRef: reference(value.baseRequestRef, 'policy binding.baseRequestRef'),
    trustPolicyRef: reference(value.trustPolicyRef, 'policy binding.trustPolicyRef'),
    assuranceSchemas: normalizeContracts(value.assuranceSchemas, 'policy binding.assuranceSchemas', 1, 32),
    rootsGate: normalizeRootsGate(value.rootsGate),
    boundAt,
    expiresAt,
    scope: 'INDEPENDENT_ASSURANCE_REVIEW_ONLY',
    authority: 'NONE'
  };
}

function sealPolicyBinding(value) {
  const core = normalizePolicyBindingCore(value);
  return { ...core, bindingDigest: sha256(core) };
}

function normalizePolicyBinding(value) {
  exactKeys(value, [
    'schema', 'id', 'baseRequestRef', 'trustPolicyRef', 'assuranceSchemas',
    'rootsGate', 'boundAt', 'expiresAt', 'scope', 'authority', 'bindingDigest'
  ], 'policy binding');
  const { bindingDigest, ...candidateCore } = value;
  const sealed = sealPolicyBinding(candidateCore);
  if (sealed.bindingDigest !== digest(bindingDigest, 'policy binding.bindingDigest')) {
    throw new Error('policy binding digest mismatch');
  }
  return sealed;
}

function policyBindingRef(value) {
  const binding = normalizePolicyBinding(value);
  return { id: binding.id, schema: binding.schema, sha256: binding.bindingDigest };
}

function baseRequestRef(value) {
  const request = Fabric.normalizeRequest(value);
  return { id: request.id, schema: request.schema, sha256: sha256(request) };
}

function emptyTruth() {
  return Object.fromEntries(TRUTH_FIELDS.map((field) => [field, false]));
}

function sealReview(status, details = {}) {
  if (!STATUSES.has(status)) throw new Error('policy-bound review status is unsupported');
  const core = {
    schema: REVIEW_SCHEMA,
    version: VERSION,
    status,
    baseReviewDigest: details.baseReviewDigest || null,
    policyBindingRef: details.policyBindingRef || null,
    boundBaseRequestRef: details.boundBaseRequestRef || null,
    boundTrustPolicyRef: details.boundTrustPolicyRef || null,
    boundAssuranceSchemas: (details.boundAssuranceSchemas || []).slice().sort(compareText),
    holds: (details.holds || []).slice(),
    limitations: LIMITATIONS.slice(),
    nextGate: status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED'
      ? 'MIKE_AUTHENTICATED_POLICY_DECISION_OUTSIDE_FABRIC'
      : 'REPAIR_POLICY_BINDING_THEN_REASSESS',
    truth: { ...emptyTruth(), ...(details.truth || {}) },
    authority: 'NONE'
  };
  return { ...core, reviewDigest: sha256(core) };
}

function hold(status, details, message) {
  return sealReview(status, { ...details, holds: [...(details.holds || []), message] });
}

function assessPolicyBoundAssurance(input) {
  exactKeys(input, ['independentReviewInput', 'independentReview', 'policyBinding'], 'policy-bound assurance input');
  const details = {};
  const verification = Independent.verifyIndependentAssuranceReview(
    input.independentReview,
    input.independentReviewInput
  );
  const baseStatus = input.independentReview && input.independentReview.status;
  if (!verification.pass || baseStatus !== 'HUMAN_POLICY_ACCEPTANCE_REQUIRED') {
    const reason = verification.pass
      ? 'BASE_REVIEW_STATUS:' + baseStatus
      : 'BASE_REVIEW_INVALID:' + verification.errors.join('|');
    return hold('BASE_REVIEW_HOLD', details, reason);
  }

  const baseReview = Independent.normalizeReview(input.independentReview);
  const routePlan = Fabric.normalizeRoutePlan(input.independentReviewInput.readinessInput.routePlan);
  const request = Fabric.normalizeRequest(routePlan.request);
  const trustPolicy = Independent.normalizeTrustPolicy(input.independentReviewInput.trustPolicy);
  details.baseReviewDigest = baseReview.reviewDigest;
  details.truth = { baseIndependentReviewVerified: true };

  let binding;
  try {
    binding = normalizePolicyBinding(input.policyBinding);
  } catch (error) {
    return hold('POLICY_BINDING_HOLD', details, 'POLICY_BINDING_INVALID:' + error.message);
  }
  details.policyBindingRef = policyBindingRef(binding);
  details.truth.policyBindingIntegrityVerified = true;
  details.truth.rootsGateBound = true;

  const expectedRequestRef = baseRequestRef(request);
  if (!same(binding.baseRequestRef, expectedRequestRef)) {
    return hold('REQUEST_BINDING_HOLD', details, 'BASE_REQUEST_REFERENCE_MISMATCH');
  }
  details.boundBaseRequestRef = expectedRequestRef;
  details.truth.baseRequestDigestBound = true;

  const expectedPolicyRef = Independent.trustPolicyRef(trustPolicy);
  if (!same(binding.trustPolicyRef, expectedPolicyRef)) {
    return hold('TRUST_POLICY_BINDING_HOLD', details, 'TRUST_POLICY_REFERENCE_MISMATCH');
  }
  details.boundTrustPolicyRef = expectedPolicyRef;
  details.truth.trustPolicyDigestBound = true;

  const expectedAssuranceSchemas = trustPolicy.rules
    .map((rule) => rule.assuranceSchema)
    .sort(compareText);
  if (!same(binding.assuranceSchemas, expectedAssuranceSchemas)) {
    return hold('ASSURANCE_SCOPE_HOLD', details, 'ASSURANCE_SCHEMA_SET_MISMATCH');
  }
  details.boundAssuranceSchemas = expectedAssuranceSchemas;
  details.truth.assuranceSchemaSetBound = true;

  const boundAt = Date.parse(binding.boundAt);
  const expiresAt = Date.parse(binding.expiresAt);
  const evaluatedAt = Date.parse(request.policy.observation.evaluatedAt);
  const policyValidFrom = Date.parse(trustPolicy.validFrom);
  const policyExpiresAt = Date.parse(trustPolicy.expiresAt);
  const earliestAssuranceSignature = Math.min(...input.independentReviewInput.assuranceAttestations
    .map(Independent.normalizeAssuranceAttestation)
    .map((attestation) => Date.parse(attestation.signedAt)));
  if (boundAt < policyValidFrom || boundAt > evaluatedAt ||
    boundAt > earliestAssuranceSignature ||
    expiresAt <= evaluatedAt || expiresAt > policyExpiresAt) {
    return hold('TIME_WINDOW_HOLD', details, 'POLICY_BINDING_TIME_WINDOW_INVALID');
  }
  details.truth.bindingTimeWindowVerified = true;

  return sealReview('AUTHENTICATED_HUMAN_DECISION_REQUIRED', details);
}

function normalizeTruth(value) {
  exactKeys(value, TRUTH_FIELDS, 'policy-bound review.truth');
  const result = {};
  for (const field of TRUTH_FIELDS) {
    if (typeof value[field] !== 'boolean') throw new Error('policy-bound review.truth.' + field + ' must be boolean');
    result[field] = value[field];
  }
  const falseCeiling = [
    'requesterAuthorshipVerified', 'humanPolicyAcceptanceVerified',
    'organizationalIndependenceProven', 'resourceEnforcementObserved',
    'executorAuthorized', 'providerCodeLoaded', 'providerCodeExecuted',
    'workspaceContentRead', 'permissionGranted', 'networkUsed', 'outputWritten',
    'installed', 'promoted', 'canonChanged'
  ];
  for (const field of falseCeiling) {
    if (result[field]) throw new Error('policy-bound review.truth.' + field + ' violates the review-only truth ceiling');
  }
  if (result.policyBindingIntegrityVerified && !result.baseIndependentReviewVerified) {
    throw new Error('policy binding cannot verify before the base independent review');
  }
  if (result.rootsGateBound !== result.policyBindingIntegrityVerified) {
    throw new Error('root binding must exactly track policy-binding integrity');
  }
  if (result.baseRequestDigestBound && !result.policyBindingIntegrityVerified) {
    throw new Error('request digest cannot bind before policy-binding integrity');
  }
  if (result.trustPolicyDigestBound && !result.baseRequestDigestBound) {
    throw new Error('trust policy cannot bind before the base request');
  }
  if (result.assuranceSchemaSetBound && !result.trustPolicyDigestBound) {
    throw new Error('assurance schemas cannot bind before the trust policy');
  }
  if (result.bindingTimeWindowVerified && !result.assuranceSchemaSetBound) {
    throw new Error('binding time cannot verify before the assurance schema set');
  }
  return result;
}

function normalizeReview(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'baseReviewDigest', 'policyBindingRef',
    'boundBaseRequestRef', 'boundTrustPolicyRef', 'boundAssuranceSchemas',
    'holds', 'limitations', 'nextGate', 'truth', 'authority', 'reviewDigest'
  ], 'policy-bound review');
  if (value.schema !== REVIEW_SCHEMA) throw new Error('policy-bound review schema mismatch');
  if (value.version !== VERSION) throw new Error('policy-bound review version mismatch');
  if (!STATUSES.has(value.status)) throw new Error('policy-bound review status is unsupported');
  if (value.authority !== 'NONE') throw new Error('policy-bound review authority must remain NONE');
  if (!same(value.limitations, LIMITATIONS)) throw new Error('policy-bound review limitations must remain explicit');
  const expectedNextGate = value.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED'
    ? 'MIKE_AUTHENTICATED_POLICY_DECISION_OUTSIDE_FABRIC'
    : 'REPAIR_POLICY_BINDING_THEN_REASSESS';
  if (value.nextGate !== expectedNextGate) throw new Error('policy-bound review nextGate conflicts with status');
  if (!Array.isArray(value.holds) || value.holds.length > 64) throw new Error('policy-bound review.holds must be a bounded array');
  const holds = value.holds.map((item, index) => strictText(item, 'policy-bound review.holds[' + index + ']', 500));
  if (new Set(holds).size !== holds.length) throw new Error('policy-bound review.holds contains duplicates');
  const truth = normalizeTruth(value.truth);
  const core = {
    schema: REVIEW_SCHEMA,
    version: VERSION,
    status: value.status,
    baseReviewDigest: value.baseReviewDigest == null ? null : digest(value.baseReviewDigest, 'policy-bound review.baseReviewDigest'),
    policyBindingRef: value.policyBindingRef == null ? null : reference(value.policyBindingRef, 'policy-bound review.policyBindingRef'),
    boundBaseRequestRef: value.boundBaseRequestRef == null ? null : reference(value.boundBaseRequestRef, 'policy-bound review.boundBaseRequestRef'),
    boundTrustPolicyRef: value.boundTrustPolicyRef == null ? null : reference(value.boundTrustPolicyRef, 'policy-bound review.boundTrustPolicyRef'),
    boundAssuranceSchemas: normalizeContracts(value.boundAssuranceSchemas, 'policy-bound review.boundAssuranceSchemas', 0, 32),
    holds,
    limitations: LIMITATIONS.slice(),
    nextGate: expectedNextGate,
    truth,
    authority: 'NONE'
  };
  const reviewDigest = digest(value.reviewDigest, 'policy-bound review.reviewDigest');
  if (sha256(core) !== reviewDigest) throw new Error('policy-bound review digest mismatch');
  const normalized = { ...core, reviewDigest };
  if (!same(normalized, value)) throw new Error('policy-bound review is not in canonical normalized form');
  if ((value.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') !== (holds.length === 0)) {
    throw new Error('AUTHENTICATED_HUMAN_DECISION_REQUIRED must be the only hold-free status');
  }
  if (truth.baseIndependentReviewVerified !== (core.baseReviewDigest !== null)) {
    throw new Error('base review reference conflicts with truth');
  }
  if (truth.policyBindingIntegrityVerified !== (core.policyBindingRef !== null)) {
    throw new Error('policy binding reference conflicts with truth');
  }
  if (truth.baseRequestDigestBound !== (core.boundBaseRequestRef !== null)) {
    throw new Error('bound request reference conflicts with truth');
  }
  if (truth.trustPolicyDigestBound !== (core.boundTrustPolicyRef !== null)) {
    throw new Error('bound trust-policy reference conflicts with truth');
  }
  if (truth.assuranceSchemaSetBound !== (core.boundAssuranceSchemas.length > 0)) {
    throw new Error('bound assurance schemas conflict with truth');
  }
  const progressByStatus = {
    BASE_REVIEW_HOLD: 0,
    POLICY_BINDING_HOLD: 1,
    REQUEST_BINDING_HOLD: 3,
    TRUST_POLICY_BINDING_HOLD: 4,
    ASSURANCE_SCOPE_HOLD: 5,
    TIME_WINDOW_HOLD: 6,
    AUTHENTICATED_HUMAN_DECISION_REQUIRED: 7
  };
  const stagedTruth = [
    'baseIndependentReviewVerified',
    'policyBindingIntegrityVerified',
    'rootsGateBound',
    'baseRequestDigestBound',
    'trustPolicyDigestBound',
    'assuranceSchemaSetBound',
    'bindingTimeWindowVerified'
  ];
  const progress = progressByStatus[value.status];
  stagedTruth.forEach((field, index) => {
    if (truth[field] !== (index < progress)) {
      throw new Error('policy-bound review status conflicts with truth.' + field);
    }
  });
  if (value.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    const requiredTrue = [
      'baseIndependentReviewVerified', 'policyBindingIntegrityVerified',
      'baseRequestDigestBound', 'trustPolicyDigestBound',
      'assuranceSchemaSetBound', 'rootsGateBound', 'bindingTimeWindowVerified'
    ];
    for (const field of requiredTrue) {
      if (!truth[field]) throw new Error('AUTHENTICATED_HUMAN_DECISION_REQUIRED needs truth.' + field);
    }
  }
  return normalized;
}

function verifyPolicyBoundAssuranceReview(value, input) {
  const errors = [];
  try {
    const normalized = normalizeReview(value);
    const rebuilt = assessPolicyBoundAssurance(input);
    if (!same(normalized, rebuilt)) throw new Error('policy-bound review differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  VERSION,
  POLICY_BINDING_SCHEMA,
  REVIEW_SCHEMA,
  ROOTS_GATE,
  LIMITATIONS,
  canonicalJson,
  sha256,
  baseRequestRef,
  sealPolicyBinding,
  normalizePolicyBinding,
  policyBindingRef,
  assessPolicyBoundAssurance,
  normalizeReview,
  verifyPolicyBoundAssuranceReview,
  clone
};
