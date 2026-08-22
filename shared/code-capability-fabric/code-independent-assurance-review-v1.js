'use strict';

const crypto = require('crypto');
const Fabric = require('./code-capability-fabric-v2');
const Readiness = require('./code-capability-readiness-v1');

const VERSION = '0.1.0';
const TRUST_POLICY_SCHEMA = 'axm.code-assurance-trust-policy/v1';
const ASSURANCE_ATTESTATION_SCHEMA = 'axm.code-assurance-attestation/v1';
const REVIEW_SCHEMA = 'axm.code-independent-assurance-review/v1';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STATUSES = new Set([
  'BASE_READINESS_HOLD',
  'TRUST_POLICY_HOLD',
  'VERIFIER_KEY_HOLD',
  'ASSURANCE_ATTESTATION_HOLD',
  'QUORUM_HOLD',
  'HUMAN_POLICY_ACCEPTANCE_REQUIRED'
]);
const LIMITATIONS = [
  'ORGANIZATIONAL_INDEPENDENCE_NOT_PROVEN',
  'TRUST_POLICY_NOT_BOUND_BY_V2_REQUEST'
];
const TRUTH_FIELDS = [
  'baseReadinessVerified',
  'trustPolicyIntegrityVerified',
  'trustPolicyRequestBound',
  'verifierKeysBound',
  'verifierKeysDistinctFromObserver',
  'assuranceSignaturesVerified',
  'assuranceQuorumsSatisfied',
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

function canonicalJson(value) {
  return Readiness.canonicalJson(value);
}

function clone(value) {
  return Readiness.clone(value);
}

function sha256(value) {
  return Readiness.sha256(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = allowed.slice().sort(compareText);
  const missing = expected.filter((key) => !actual.includes(key));
  const extras = actual.filter((key) => !expected.includes(key));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.join(', '));
  if (extras.length) throw new Error(label + ' has unsupported fields: ' + extras.join(', '));
}

function strictText(value, label, maximum = 240) {
  if (typeof value !== 'string' || !value || value.trim() !== value || /\s{2,}/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
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
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) throw new Error(label + ' must be a canonical UTC timestamp');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new Error(label + ' must be a valid canonical UTC timestamp');
  return value;
}

function boundedInteger(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
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

function canonicalBase64(value, label, expectedBytes) {
  const result = strictText(value, label, Math.ceil(expectedBytes / 3) * 4 + 4);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result)) {
    throw new Error(label + ' must be canonical base64');
  }
  const bytes = Buffer.from(result, 'base64');
  if (bytes.length !== expectedBytes || bytes.toString('base64') !== result) {
    throw new Error(label + ' has an invalid decoded length or encoding');
  }
  return { text: result, bytes };
}

function normalizeReferences(values, label, minimum, maximum) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must contain from ' + minimum + ' to ' + maximum + ' references');
  }
  const normalized = values.map((item, index) => reference(item, label + '[' + index + ']'));
  normalized.sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(normalized.map(canonicalJson)).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized;
}

function normalizePolicyRule(value, label) {
  exactKeys(value, ['assuranceSchema', 'trustedVerifierRefs', 'minimumSignatures'], label);
  const trustedVerifierRefs = normalizeReferences(value.trustedVerifierRefs, label + '.trustedVerifierRefs', 1, 8);
  return {
    assuranceSchema: contractToken(value.assuranceSchema, label + '.assuranceSchema'),
    trustedVerifierRefs,
    minimumSignatures: boundedInteger(
      value.minimumSignatures,
      label + '.minimumSignatures',
      1,
      trustedVerifierRefs.length
    )
  };
}

function normalizeTrustPolicyCore(value) {
  exactKeys(value, [
    'schema', 'id', 'evaluatedAt', 'validFrom', 'expiresAt', 'rules',
    'observerMayCount', 'authority'
  ], 'assurance trust policy');
  if (value.schema !== TRUST_POLICY_SCHEMA) throw new Error('assurance trust policy schema mismatch');
  if (value.observerMayCount !== false) throw new Error('assurance trust policy.observerMayCount must remain false');
  if (value.authority !== 'REVIEW_ONLY') throw new Error('assurance trust policy.authority must remain REVIEW_ONLY');
  const evaluatedAt = timestamp(value.evaluatedAt, 'assurance trust policy.evaluatedAt');
  const validFrom = timestamp(value.validFrom, 'assurance trust policy.validFrom');
  const expiresAt = timestamp(value.expiresAt, 'assurance trust policy.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(validFrom)) throw new Error('assurance trust policy.expiresAt must be after validFrom');
  if (Date.parse(evaluatedAt) < Date.parse(validFrom) || Date.parse(evaluatedAt) >= Date.parse(expiresAt)) {
    throw new Error('assurance trust policy is not active at evaluatedAt');
  }
  if (!Array.isArray(value.rules) || value.rules.length < 1 || value.rules.length > 32) {
    throw new Error('assurance trust policy.rules must contain from 1 to 32 rules');
  }
  const rules = value.rules.map((item, index) => normalizePolicyRule(item, 'assurance trust policy.rules[' + index + ']'));
  rules.sort((left, right) => compareText(left.assuranceSchema, right.assuranceSchema));
  if (new Set(rules.map((item) => item.assuranceSchema)).size !== rules.length) {
    throw new Error('assurance trust policy.rules contains duplicate assurance schemas');
  }
  return {
    schema: TRUST_POLICY_SCHEMA,
    id: identifier(value.id, 'assurance trust policy.id'),
    evaluatedAt,
    validFrom,
    expiresAt,
    rules,
    observerMayCount: false,
    authority: 'REVIEW_ONLY'
  };
}

function sealTrustPolicy(value) {
  const core = normalizeTrustPolicyCore(value);
  return { ...core, policyDigest: sha256(core) };
}

function normalizeTrustPolicy(value) {
  exactKeys(value, [
    'schema', 'id', 'evaluatedAt', 'validFrom', 'expiresAt', 'rules',
    'observerMayCount', 'authority', 'policyDigest'
  ], 'assurance trust policy');
  const { policyDigest, ...candidateCore } = value;
  const sealed = sealTrustPolicy(candidateCore);
  if (sealed.policyDigest !== digest(policyDigest, 'assurance trust policy.policyDigest')) {
    throw new Error('assurance trust policy digest mismatch');
  }
  return sealed;
}

function trustPolicyRef(value) {
  const policy = normalizeTrustPolicy(value);
  return { id: policy.id, schema: policy.schema, sha256: policy.policyDigest };
}

function normalizeAttestationPayload(value) {
  exactKeys(value, [
    'schema', 'id', 'assuranceRecordRef', 'readinessDigest', 'trustPolicyDigest',
    'keyRef', 'signedAt'
  ], 'assurance attestation payload');
  if (value.schema !== ASSURANCE_ATTESTATION_SCHEMA) throw new Error('assurance attestation schema mismatch');
  return {
    schema: ASSURANCE_ATTESTATION_SCHEMA,
    id: identifier(value.id, 'assurance attestation.id'),
    assuranceRecordRef: reference(value.assuranceRecordRef, 'assurance attestation.assuranceRecordRef'),
    readinessDigest: digest(value.readinessDigest, 'assurance attestation.readinessDigest'),
    trustPolicyDigest: digest(value.trustPolicyDigest, 'assurance attestation.trustPolicyDigest'),
    keyRef: reference(value.keyRef, 'assurance attestation.keyRef'),
    signedAt: timestamp(value.signedAt, 'assurance attestation.signedAt')
  };
}

function buildAssuranceAttestationPayload(value) {
  return Buffer.from(canonicalJson(normalizeAttestationPayload(value)), 'utf8');
}

function sealAssuranceAttestation(value) {
  exactKeys(value, [
    'schema', 'id', 'assuranceRecordRef', 'readinessDigest', 'trustPolicyDigest',
    'keyRef', 'signedAt', 'signatureBase64'
  ], 'assurance attestation');
  const { signatureBase64, ...candidatePayload } = value;
  const payload = normalizeAttestationPayload(candidatePayload);
  const signature = canonicalBase64(signatureBase64, 'assurance attestation.signatureBase64', 64);
  const core = { ...payload, signatureBase64: signature.text };
  return { ...core, attestationDigest: sha256(core) };
}

function normalizeAssuranceAttestation(value) {
  exactKeys(value, [
    'schema', 'id', 'assuranceRecordRef', 'readinessDigest', 'trustPolicyDigest',
    'keyRef', 'signedAt', 'signatureBase64', 'attestationDigest'
  ], 'assurance attestation');
  const { attestationDigest, ...candidateCore } = value;
  const sealed = sealAssuranceAttestation(candidateCore);
  if (sealed.attestationDigest !== digest(attestationDigest, 'assurance attestation.attestationDigest')) {
    throw new Error('assurance attestation digest mismatch');
  }
  return sealed;
}

function assuranceAttestationRef(value) {
  const attestation = normalizeAssuranceAttestation(value);
  return { id: attestation.id, schema: attestation.schema, sha256: attestation.attestationDigest };
}

function emptyTruth() {
  return Object.fromEntries(TRUTH_FIELDS.map((field) => [field, false]));
}

function sealReview(status, details = {}) {
  if (!STATUSES.has(status)) throw new Error('independent assurance review status is unsupported');
  const core = {
    schema: REVIEW_SCHEMA,
    version: VERSION,
    status,
    baseReadinessDigest: details.baseReadinessDigest || null,
    trustPolicyRef: details.trustPolicyRef || null,
    reviewSubjectDigest: details.reviewSubjectDigest || null,
    boundVerifierRefs: (details.boundVerifierRefs || []).slice().sort((left, right) => compareText(canonicalJson(left), canonicalJson(right))),
    verifiedAttestationRefs: (details.verifiedAttestationRefs || []).slice().sort((left, right) => compareText(canonicalJson(left), canonicalJson(right))),
    quorumResults: (details.quorumResults || []).slice().sort((left, right) => compareText(canonicalJson(left.assuranceRecordRef), canonicalJson(right.assuranceRecordRef))),
    holds: (details.holds || []).slice(),
    limitations: LIMITATIONS.slice(),
    nextGate: status === 'HUMAN_POLICY_ACCEPTANCE_REQUIRED'
      ? 'MIKE_ACCEPT_TRUST_POLICY_BEFORE_ANY_EXECUTOR_DECISION'
      : 'REPAIR_INDEPENDENT_ASSURANCE_EVIDENCE_THEN_REASSESS',
    truth: { ...emptyTruth(), ...(details.truth || {}) },
    authority: 'NONE'
  };
  return { ...core, reviewDigest: sha256(core) };
}

function hold(status, details, message) {
  return sealReview(status, { ...details, holds: [...(details.holds || []), message] });
}

function allPolicyVerifierRefs(policy) {
  const refs = policy.rules.flatMap((rule) => rule.trustedVerifierRefs);
  refs.sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  return Array.from(new Map(refs.map((item) => [canonicalJson(item), item])).values());
}

function assessIndependentAssurance(input) {
  exactKeys(input, [
    'readinessInput', 'readinessAssessment', 'trustPolicy', 'verifierKeys',
    'assuranceAttestations'
  ], 'independent assurance input');
  const base = {};
  const baseVerification = Readiness.verifyReadinessAssessment(input.readinessAssessment, input.readinessInput);
  if (!baseVerification.pass || input.readinessAssessment.status !== 'AUTHORIZATION_REQUIRED') {
    const reason = baseVerification.pass
      ? 'BASE_READINESS_STATUS:' + input.readinessAssessment.status
      : 'BASE_READINESS_INVALID:' + baseVerification.errors.join('|');
    return hold('BASE_READINESS_HOLD', base, reason);
  }
  const readiness = Readiness.normalizeAssessment(input.readinessAssessment);
  const routePlan = Fabric.normalizeRoutePlan(input.readinessInput.routePlan);
  const records = input.readinessInput.assuranceRecords.map(Readiness.normalizeAssuranceRecord)
    .sort((left, right) => compareText(canonicalJson(Readiness.assuranceRecordRef(left)), canonicalJson(Readiness.assuranceRecordRef(right))));
  base.baseReadinessDigest = readiness.readinessDigest;
  base.truth = { baseReadinessVerified: true };

  let policy;
  try {
    policy = normalizeTrustPolicy(input.trustPolicy);
  } catch (error) {
    return hold('TRUST_POLICY_HOLD', base, 'TRUST_POLICY_INVALID:' + error.message);
  }
  if (policy.evaluatedAt !== routePlan.request.policy.observation.evaluatedAt) {
    return hold('TRUST_POLICY_HOLD', base, 'TRUST_POLICY_EVALUATION_TIME_MISMATCH');
  }
  const expectedSchemas = records.map((record) => record.assuranceSchema).sort(compareText);
  const policySchemas = policy.rules.map((rule) => rule.assuranceSchema).sort(compareText);
  if (!same(expectedSchemas, policySchemas)) {
    return hold('TRUST_POLICY_HOLD', base, 'TRUST_POLICY_ASSURANCE_SCHEMA_SET_MISMATCH');
  }
  const observerRef = routePlan.hostObservation.observerRef;
  const policyVerifierRefs = allPolicyVerifierRefs(policy);
  if (policyVerifierRefs.some((item) => same(item, observerRef))) {
    return hold('TRUST_POLICY_HOLD', base, 'HOST_OBSERVER_CANNOT_COUNT_AS_ASSURANCE_VERIFIER');
  }
  base.trustPolicyRef = trustPolicyRef(policy);
  base.reviewSubjectDigest = sha256({
    schema: 'axm.code-independent-assurance-review-subject/v1',
    baseReadinessDigest: readiness.readinessDigest,
    trustPolicyDigest: policy.policyDigest
  });
  base.truth.trustPolicyIntegrityVerified = true;

  if (!Array.isArray(input.verifierKeys) || input.verifierKeys.length < 1 || input.verifierKeys.length > 64) {
    return hold('VERIFIER_KEY_HOLD', base, 'VERIFIER_KEYS_MUST_BE_A_BOUNDED_NONEMPTY_ARRAY');
  }
  let keys;
  try {
    keys = input.verifierKeys.map(Readiness.normalizeTrustKey);
  } catch (error) {
    return hold('VERIFIER_KEY_HOLD', base, 'VERIFIER_KEY_INVALID:' + error.message);
  }
  const keyEntries = keys.map((key) => ({ key, ref: Readiness.buildTrustKeyRef(key) }));
  keyEntries.sort((left, right) => compareText(canonicalJson(left.ref), canonicalJson(right.ref)));
  if (new Set(keyEntries.map((entry) => canonicalJson(entry.ref))).size !== keyEntries.length) {
    return hold('VERIFIER_KEY_HOLD', base, 'VERIFIER_KEY_DUPLICATE_REFERENCE');
  }
  const keyRefs = keyEntries.map((entry) => entry.ref);
  if (!same(keyRefs, policyVerifierRefs)) {
    return hold('VERIFIER_KEY_HOLD', base, 'VERIFIER_KEY_SET_MISMATCH');
  }
  const publicKeyMaterials = keyEntries.map((entry) => entry.key.publicKeySpkiDerBase64);
  if (new Set(publicKeyMaterials).size !== publicKeyMaterials.length) {
    return hold('VERIFIER_KEY_HOLD', base, 'VERIFIER_KEY_DUPLICATE_PUBLIC_KEY_MATERIAL');
  }
  const observerKey = Readiness.normalizeTrustKey(input.readinessInput.observerKey);
  if (!same(Readiness.buildTrustKeyRef(observerKey), observerRef)) {
    return hold('VERIFIER_KEY_HOLD', base, 'BASE_OBSERVER_KEY_BYTES_MISSING');
  }
  if (keyEntries.some((entry) => entry.key.publicKeySpkiDerBase64 === observerKey.publicKeySpkiDerBase64)) {
    return hold('VERIFIER_KEY_HOLD', base, 'HOST_OBSERVER_KEY_MATERIAL_CANNOT_COUNT_AS_ASSURANCE_VERIFIER');
  }
  base.boundVerifierRefs = keyRefs;
  base.truth.verifierKeysBound = true;
  base.truth.verifierKeysDistinctFromObserver = true;

  if (!Array.isArray(input.assuranceAttestations) || input.assuranceAttestations.length < 1 || input.assuranceAttestations.length > 256) {
    return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATIONS_MUST_BE_A_BOUNDED_NONEMPTY_ARRAY');
  }
  let attestations;
  try {
    attestations = input.assuranceAttestations.map(normalizeAssuranceAttestation);
  } catch (error) {
    return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_INVALID:' + error.message);
  }
  attestations.sort((left, right) => compareText(canonicalJson(assuranceAttestationRef(left)), canonicalJson(assuranceAttestationRef(right))));
  if (new Set(attestations.map((item) => item.id)).size !== attestations.length) {
    return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_DUPLICATE_ID');
  }
  if (new Set(attestations.map((item) => item.attestationDigest)).size !== attestations.length) {
    return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_DUPLICATE_DIGEST');
  }
  const attestationTuples = attestations.map((item) => canonicalJson({ record: item.assuranceRecordRef, key: item.keyRef }));
  if (new Set(attestationTuples).size !== attestationTuples.length) {
    return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_DUPLICATE_RECORD_KEY');
  }

  const recordsByRef = new Map(records.map((record) => [canonicalJson(Readiness.assuranceRecordRef(record)), record]));
  const rulesBySchema = new Map(policy.rules.map((rule) => [rule.assuranceSchema, rule]));
  const keysByRef = new Map(keyEntries.map((entry) => [canonicalJson(entry.ref), entry.key]));
  const evaluatedAt = Date.parse(policy.evaluatedAt);
  for (const attestation of attestations) {
    const record = recordsByRef.get(canonicalJson(attestation.assuranceRecordRef));
    if (!record) return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_RECORD_NOT_IN_READINESS:' + attestation.id);
    if (attestation.readinessDigest !== readiness.readinessDigest) {
      return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_READINESS_MISMATCH:' + attestation.id);
    }
    if (attestation.trustPolicyDigest !== policy.policyDigest) {
      return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_POLICY_MISMATCH:' + attestation.id);
    }
    const rule = rulesBySchema.get(record.assuranceSchema);
    if (!rule.trustedVerifierRefs.some((item) => same(item, attestation.keyRef))) {
      return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_KEY_NOT_TRUSTED_FOR_SCHEMA:' + attestation.id);
    }
    const key = keysByRef.get(canonicalJson(attestation.keyRef));
    if (!key) return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_KEY_BYTES_MISSING:' + attestation.id);
    const signedAt = Date.parse(attestation.signedAt);
    if (signedAt < Date.parse(record.observedAt) || signedAt > evaluatedAt ||
      signedAt < Date.parse(policy.validFrom) || signedAt >= Date.parse(policy.expiresAt) ||
      signedAt >= Date.parse(record.expiresAt)) {
      return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_TIME_INVALID:' + attestation.id);
    }
    let verified = false;
    try {
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(key.publicKeySpkiDerBase64, 'base64'),
        format: 'der',
        type: 'spki'
      });
      const payload = buildAssuranceAttestationPayload({
        schema: attestation.schema,
        id: attestation.id,
        assuranceRecordRef: attestation.assuranceRecordRef,
        readinessDigest: attestation.readinessDigest,
        trustPolicyDigest: attestation.trustPolicyDigest,
        keyRef: attestation.keyRef,
        signedAt: attestation.signedAt
      });
      verified = crypto.verify(null, payload, publicKey, Buffer.from(attestation.signatureBase64, 'base64'));
    } catch (error) {
      verified = false;
    }
    if (!verified) return hold('ASSURANCE_ATTESTATION_HOLD', base, 'ASSURANCE_ATTESTATION_SIGNATURE_INVALID:' + attestation.id);
  }
  base.verifiedAttestationRefs = attestations.map(assuranceAttestationRef);
  base.truth.assuranceSignaturesVerified = true;

  const quorumResults = records.map((record) => {
    const recordRef = Readiness.assuranceRecordRef(record);
    const rule = rulesBySchema.get(record.assuranceSchema);
    const verifiedVerifierRefs = attestations
      .filter((item) => same(item.assuranceRecordRef, recordRef))
      .map((item) => item.keyRef)
      .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
    return {
      assuranceRecordRef: recordRef,
      requiredSignatures: rule.minimumSignatures,
      verifiedVerifierRefs,
      satisfied: verifiedVerifierRefs.length >= rule.minimumSignatures
    };
  }).sort((left, right) => compareText(canonicalJson(left.assuranceRecordRef), canonicalJson(right.assuranceRecordRef)));
  base.quorumResults = quorumResults;
  const failedQuorums = quorumResults.filter((item) => !item.satisfied);
  if (failedQuorums.length) {
    return hold(
      'QUORUM_HOLD',
      base,
      'ASSURANCE_QUORUM_NOT_MET:' + failedQuorums.map((item) => item.assuranceRecordRef.id).sort(compareText).join(',')
    );
  }
  base.truth.assuranceQuorumsSatisfied = true;
  return sealReview('HUMAN_POLICY_ACCEPTANCE_REQUIRED', base);
}

function normalizeQuorumResult(value, label) {
  exactKeys(value, ['assuranceRecordRef', 'requiredSignatures', 'verifiedVerifierRefs', 'satisfied'], label);
  const verifiedVerifierRefs = normalizeReferences(value.verifiedVerifierRefs, label + '.verifiedVerifierRefs', 0, 8);
  const requiredSignatures = boundedInteger(value.requiredSignatures, label + '.requiredSignatures', 1, 8);
  if (typeof value.satisfied !== 'boolean') throw new Error(label + '.satisfied must be boolean');
  if (value.satisfied !== (verifiedVerifierRefs.length >= requiredSignatures)) {
    throw new Error(label + '.satisfied conflicts with verifier count');
  }
  return {
    assuranceRecordRef: reference(value.assuranceRecordRef, label + '.assuranceRecordRef'),
    requiredSignatures,
    verifiedVerifierRefs,
    satisfied: value.satisfied
  };
}

function normalizeTruth(value) {
  exactKeys(value, TRUTH_FIELDS, 'independent assurance review.truth');
  const result = {};
  TRUTH_FIELDS.forEach((field) => {
    if (typeof value[field] !== 'boolean') throw new Error('independent assurance review.truth.' + field + ' must be boolean');
    result[field] = value[field];
  });
  const alwaysFalse = [
    'trustPolicyRequestBound', 'organizationalIndependenceProven', 'resourceEnforcementObserved',
    'executorAuthorized', 'providerCodeLoaded', 'providerCodeExecuted', 'workspaceContentRead',
    'permissionGranted', 'networkUsed', 'outputWritten', 'installed', 'promoted', 'canonChanged'
  ];
  alwaysFalse.forEach((field) => {
    if (result[field]) throw new Error('independent assurance review.truth.' + field + ' violates the review-only truth ceiling');
  });
  if (result.trustPolicyIntegrityVerified && !result.baseReadinessVerified) throw new Error('trust policy cannot be verified before base readiness');
  if (result.verifierKeysBound && !result.trustPolicyIntegrityVerified) throw new Error('verifier keys cannot bind before trust policy verification');
  if (result.verifierKeysDistinctFromObserver && !result.verifierKeysBound) throw new Error('verifier separation cannot precede key binding');
  if (result.assuranceSignaturesVerified && !result.verifierKeysDistinctFromObserver) throw new Error('assurance signatures cannot verify before key separation');
  if (result.assuranceQuorumsSatisfied && !result.assuranceSignaturesVerified) throw new Error('assurance quorum cannot pass before signatures verify');
  return result;
}

function normalizeReview(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'baseReadinessDigest', 'trustPolicyRef',
    'reviewSubjectDigest', 'boundVerifierRefs', 'verifiedAttestationRefs',
    'quorumResults', 'holds', 'limitations', 'nextGate', 'truth', 'authority',
    'reviewDigest'
  ], 'independent assurance review');
  if (value.schema !== REVIEW_SCHEMA) throw new Error('independent assurance review schema mismatch');
  if (value.version !== VERSION) throw new Error('independent assurance review version mismatch');
  if (!STATUSES.has(value.status)) throw new Error('independent assurance review status is unsupported');
  if (value.authority !== 'NONE') throw new Error('independent assurance review authority must remain NONE');
  if (!same(value.limitations, LIMITATIONS)) throw new Error('independent assurance review limitations must remain explicit');
  const expectedNextGate = value.status === 'HUMAN_POLICY_ACCEPTANCE_REQUIRED'
    ? 'MIKE_ACCEPT_TRUST_POLICY_BEFORE_ANY_EXECUTOR_DECISION'
    : 'REPAIR_INDEPENDENT_ASSURANCE_EVIDENCE_THEN_REASSESS';
  if (value.nextGate !== expectedNextGate) throw new Error('independent assurance review nextGate conflicts with status');
  if (!Array.isArray(value.holds) || value.holds.length > 64) throw new Error('independent assurance review.holds must be a bounded array');
  const holds = value.holds.map((item, index) => strictText(item, 'independent assurance review.holds[' + index + ']', 500));
  if (new Set(holds).size !== holds.length) throw new Error('independent assurance review.holds contains duplicates');
  const boundVerifierRefs = normalizeReferences(value.boundVerifierRefs, 'independent assurance review.boundVerifierRefs', 0, 64);
  const verifiedAttestationRefs = normalizeReferences(value.verifiedAttestationRefs, 'independent assurance review.verifiedAttestationRefs', 0, 256);
  if (!Array.isArray(value.quorumResults) || value.quorumResults.length > 32) throw new Error('independent assurance review.quorumResults must be a bounded array');
  const quorumResults = value.quorumResults.map((item, index) => normalizeQuorumResult(item, 'independent assurance review.quorumResults[' + index + ']'));
  quorumResults.sort((left, right) => compareText(canonicalJson(left.assuranceRecordRef), canonicalJson(right.assuranceRecordRef)));
  if (new Set(quorumResults.map((item) => canonicalJson(item.assuranceRecordRef))).size !== quorumResults.length) {
    throw new Error('independent assurance review.quorumResults contains duplicate records');
  }
  const truth = normalizeTruth(value.truth);
  const core = {
    schema: REVIEW_SCHEMA,
    version: VERSION,
    status: value.status,
    baseReadinessDigest: value.baseReadinessDigest == null ? null : digest(value.baseReadinessDigest, 'independent assurance review.baseReadinessDigest'),
    trustPolicyRef: value.trustPolicyRef == null ? null : reference(value.trustPolicyRef, 'independent assurance review.trustPolicyRef'),
    reviewSubjectDigest: value.reviewSubjectDigest == null ? null : digest(value.reviewSubjectDigest, 'independent assurance review.reviewSubjectDigest'),
    boundVerifierRefs,
    verifiedAttestationRefs,
    quorumResults,
    holds,
    limitations: LIMITATIONS.slice(),
    nextGate: expectedNextGate,
    truth,
    authority: 'NONE'
  };
  const reviewDigest = digest(value.reviewDigest, 'independent assurance review.reviewDigest');
  if (sha256(core) !== reviewDigest) throw new Error('independent assurance review digest mismatch');
  const normalized = { ...core, reviewDigest };
  if (!same(normalized, value)) throw new Error('independent assurance review is not in canonical normalized form');
  if ((normalized.status === 'HUMAN_POLICY_ACCEPTANCE_REQUIRED') !== (normalized.holds.length === 0)) {
    throw new Error('HUMAN_POLICY_ACCEPTANCE_REQUIRED must be the only hold-free status');
  }
  if (truth.baseReadinessVerified !== (normalized.baseReadinessDigest !== null)) throw new Error('base readiness reference conflicts with truth');
  if (truth.trustPolicyIntegrityVerified !== (normalized.trustPolicyRef !== null && normalized.reviewSubjectDigest !== null)) {
    throw new Error('trust policy references conflict with truth');
  }
  if (truth.verifierKeysBound !== (normalized.boundVerifierRefs.length > 0)) throw new Error('bound verifier references conflict with truth');
  if (truth.assuranceSignaturesVerified !== (normalized.verifiedAttestationRefs.length > 0)) {
    throw new Error('verified attestation references conflict with truth');
  }
  if (truth.assuranceQuorumsSatisfied !== (normalized.quorumResults.length > 0 && normalized.quorumResults.every((item) => item.satisfied))) {
    throw new Error('quorum results conflict with truth');
  }
  if (normalized.status === 'HUMAN_POLICY_ACCEPTANCE_REQUIRED') {
    const requiredTrue = [
      'baseReadinessVerified', 'trustPolicyIntegrityVerified', 'verifierKeysBound',
      'verifierKeysDistinctFromObserver', 'assuranceSignaturesVerified',
      'assuranceQuorumsSatisfied'
    ];
    requiredTrue.forEach((field) => {
      if (!truth[field]) throw new Error('HUMAN_POLICY_ACCEPTANCE_REQUIRED needs truth.' + field);
    });
  }
  return normalized;
}

function verifyIndependentAssuranceReview(value, input) {
  const errors = [];
  try {
    const normalized = normalizeReview(value);
    const rebuilt = assessIndependentAssurance(input);
    if (!same(normalized, rebuilt)) throw new Error('independent assurance review differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  VERSION,
  TRUST_POLICY_SCHEMA,
  ASSURANCE_ATTESTATION_SCHEMA,
  REVIEW_SCHEMA,
  canonicalJson,
  sha256,
  sealTrustPolicy,
  normalizeTrustPolicy,
  trustPolicyRef,
  buildAssuranceAttestationPayload,
  sealAssuranceAttestation,
  normalizeAssuranceAttestation,
  assuranceAttestationRef,
  assessIndependentAssurance,
  normalizeReview,
  verifyIndependentAssuranceReview,
  clone
};
