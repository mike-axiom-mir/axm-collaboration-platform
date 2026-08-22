'use strict';

const crypto = require('crypto');
const Fabric = require('./code-capability-fabric-v2');

const VERSION = '0.1.0';
const TRUST_KEY_SCHEMA = 'axm.code-trust-key/v1';
const OBSERVATION_ATTESTATION_SCHEMA = 'axm.code-host-observation-attestation/v1';
const ASSURANCE_RECORD_SCHEMA = 'axm.code-external-assurance-record/v1';
const READINESS_SUBJECT_SCHEMA = 'axm.code-capability-readiness-subject/v1';
const READINESS_SCHEMA = 'axm.code-capability-readiness/v1';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STATUSES = new Set([
  'PLAN_INVALID',
  'ROUTE_NOT_PLANNED',
  'OBSERVER_KEY_HOLD',
  'OBSERVATION_ATTESTATION_HOLD',
  'ASSURANCE_RECORD_HOLD',
  'ASSURANCE_VERDICT_HOLD',
  'AUTHORIZATION_REQUIRED'
]);
const TRUTH_FIELDS = [
  'routePlanVerified',
  'routePlanned',
  'hostObserverKeyBound',
  'hostObservationSignatureVerified',
  'assuranceRecordIntegrityVerified',
  'assuranceScopeVerified',
  'assurancePassVerdictsAccepted',
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
  return Fabric.canonicalJson(value);
}

function clone(value) {
  return Fabric.clone(value);
}

function sha256(value) {
  return Fabric.sha256(value);
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

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function artifactReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256', 'byteLength'], label);
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1) {
    throw new Error(label + '.byteLength must be a positive safe integer');
  }
  return {
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256'),
    byteLength: value.byteLength
  };
}

function canonicalBase64(value, label, minimumBytes, maximumBytes) {
  const result = strictText(value, label, Math.ceil(maximumBytes / 3) * 4 + 4);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result)) {
    throw new Error(label + ' must be canonical base64');
  }
  const bytes = Buffer.from(result, 'base64');
  if (bytes.length < minimumBytes || bytes.length > maximumBytes || bytes.toString('base64') !== result) {
    throw new Error(label + ' has an invalid decoded length or encoding');
  }
  return { text: result, bytes };
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeTrustKey(value) {
  exactKeys(value, ['schema', 'id', 'algorithm', 'publicKeySpkiDerBase64'], 'trust key');
  if (value.schema !== TRUST_KEY_SCHEMA) throw new Error('trust key schema mismatch');
  if (value.algorithm !== 'Ed25519') throw new Error('trust key algorithm must be Ed25519');
  const encoded = canonicalBase64(value.publicKeySpkiDerBase64, 'trust key.publicKeySpkiDerBase64', 44, 44);
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: encoded.bytes, format: 'der', type: 'spki' });
  } catch (error) {
    throw new Error('trust key public bytes are not a valid SPKI key');
  }
  if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('trust key public bytes are not Ed25519');
  const canonicalDer = publicKey.export({ type: 'spki', format: 'der' });
  if (!canonicalDer.equals(encoded.bytes)) throw new Error('trust key public bytes are not canonical SPKI DER');
  return {
    schema: TRUST_KEY_SCHEMA,
    id: identifier(value.id, 'trust key.id'),
    algorithm: 'Ed25519',
    publicKeySpkiDerBase64: encoded.text
  };
}

function buildTrustKeyRef(value) {
  const key = normalizeTrustKey(value);
  return { id: key.id, schema: key.schema, sha256: sha256(key) };
}

function normalizeObservationAttestationCore(value) {
  exactKeys(value, ['schema', 'observationRecordDigest', 'keyRef', 'signedAt'], 'observation attestation payload');
  if (value.schema !== OBSERVATION_ATTESTATION_SCHEMA) throw new Error('observation attestation schema mismatch');
  return {
    schema: OBSERVATION_ATTESTATION_SCHEMA,
    observationRecordDigest: digest(value.observationRecordDigest, 'observation attestation.observationRecordDigest'),
    keyRef: reference(value.keyRef, 'observation attestation.keyRef'),
    signedAt: timestamp(value.signedAt, 'observation attestation.signedAt')
  };
}

function buildObservationAttestationPayload(value) {
  return Buffer.from(canonicalJson(normalizeObservationAttestationCore(value)), 'utf8');
}

function normalizeObservationAttestation(value) {
  exactKeys(value, ['schema', 'observationRecordDigest', 'keyRef', 'signedAt', 'signatureBase64'], 'observation attestation');
  const { signatureBase64, ...candidateCore } = value;
  const core = normalizeObservationAttestationCore(candidateCore);
  const signature = canonicalBase64(signatureBase64, 'observation attestation.signatureBase64', 64, 64);
  return { ...core, signatureBase64: signature.text };
}

function normalizeAssuranceRecordCore(value) {
  exactKeys(value, [
    'schema', 'id', 'assuranceSchema', 'subjectDigest', 'verifierRef', 'verdict',
    'observedAt', 'expiresAt', 'evidenceArtifacts', 'authority'
  ], 'assurance record');
  if (value.schema !== ASSURANCE_RECORD_SCHEMA) throw new Error('assurance record schema mismatch');
  if (value.authority !== 'VERIFY_ONLY') throw new Error('assurance record authority must remain VERIFY_ONLY');
  const verdict = strictText(value.verdict, 'assurance record.verdict', 16);
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(verdict)) throw new Error('assurance record verdict is unsupported');
  const observedAt = timestamp(value.observedAt, 'assurance record.observedAt');
  const expiresAt = timestamp(value.expiresAt, 'assurance record.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(observedAt)) throw new Error('assurance record.expiresAt must be after observedAt');
  if (!Array.isArray(value.evidenceArtifacts) || value.evidenceArtifacts.length < 1 || value.evidenceArtifacts.length > 32) {
    throw new Error('assurance record.evidenceArtifacts must contain from 1 to 32 byte-bound references');
  }
  const evidenceArtifacts = value.evidenceArtifacts.map((item, index) => artifactReference(item, 'assurance record.evidenceArtifacts[' + index + ']'));
  evidenceArtifacts.sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(evidenceArtifacts.map(canonicalJson)).size !== evidenceArtifacts.length) {
    throw new Error('assurance record.evidenceArtifacts contains duplicates');
  }
  return {
    schema: ASSURANCE_RECORD_SCHEMA,
    id: identifier(value.id, 'assurance record.id'),
    assuranceSchema: contractToken(value.assuranceSchema, 'assurance record.assuranceSchema'),
    subjectDigest: digest(value.subjectDigest, 'assurance record.subjectDigest'),
    verifierRef: reference(value.verifierRef, 'assurance record.verifierRef'),
    verdict,
    observedAt,
    expiresAt,
    evidenceArtifacts,
    authority: 'VERIFY_ONLY'
  };
}

function sealAssuranceRecord(value) {
  const core = normalizeAssuranceRecordCore(value);
  return { ...core, recordDigest: sha256(core) };
}

function normalizeAssuranceRecord(value) {
  exactKeys(value, [
    'schema', 'id', 'assuranceSchema', 'subjectDigest', 'verifierRef', 'verdict',
    'observedAt', 'expiresAt', 'evidenceArtifacts', 'authority', 'recordDigest'
  ], 'assurance record');
  const { recordDigest, ...candidateCore } = value;
  const sealed = sealAssuranceRecord(candidateCore);
  if (sealed.recordDigest !== digest(recordDigest, 'assurance record.recordDigest')) {
    throw new Error('assurance record digest mismatch');
  }
  return sealed;
}

function assuranceRecordRef(record) {
  const normalized = normalizeAssuranceRecord(record);
  return { id: normalized.id, schema: normalized.assuranceSchema, sha256: normalized.recordDigest };
}

function requestReadinessScope(request) {
  return {
    schema: request.schema,
    id: request.id,
    capability: request.capability,
    inputSchema: request.inputSchema,
    outputSchema: request.outputSchema,
    selection: request.selection,
    inputArtifacts: request.inputArtifacts,
    workspaceBoundaryRef: request.workspaceBoundaryRef,
    reuseRights: request.reuseRights,
    policy: {
      authority: request.policy.authority,
      allowedPermissions: request.policy.allowedPermissions,
      allowedNetworkDomains: request.policy.allowedNetworkDomains,
      allowedMutability: request.policy.allowedMutability,
      allowedSourceUse: request.policy.allowedSourceUse,
      resourceCeilings: request.policy.resourceCeilings,
      observation: {
        evaluatedAt: request.policy.observation.evaluatedAt,
        maximumAgeMs: request.policy.observation.maximumAgeMs,
        trustedObserverRefs: request.policy.observation.trustedObserverRefs
      },
      requiredAssuranceSchemas: request.policy.requiredAssuranceSchemas
    }
  };
}

function buildReadinessSubject(plan) {
  const normalized = Fabric.normalizeRoutePlan(plan);
  if (normalized.status !== 'ROUTE_PLANNED' || !normalized.selected || !normalized.hostObservation || !normalized.plannedEnvelope) {
    throw new Error('readiness subject requires a ROUTE_PLANNED v2 plan');
  }
  const observation = normalized.hostObservation;
  const envelope = normalized.plannedEnvelope;
  return {
    schema: READINESS_SUBJECT_SCHEMA,
    requestScopeDigest: sha256(requestReadinessScope(normalized.request)),
    provider: {
      id: normalized.selected.id,
      version: normalized.selected.version,
      descriptorSha256: normalized.selected.descriptorSha256
    },
    observerRef: clone(observation.observerRef),
    availability: observation.availability,
    observationWindow: { observedAt: observation.observedAt, expiresAt: observation.expiresAt },
    executorRef: clone(observation.executorRef),
    workspaceBoundaryRef: clone(observation.workspaceBoundaryRef),
    authorityEnvelopeDigest: sha256(observation.authorityEnvelope),
    resourceEnvelopeDigest: sha256(observation.resourceEnvelope),
    plannedAuthorityDigest: sha256(envelope.authority),
    plannedResourceDigest: sha256(envelope.resources),
    plannedWorkspaceBoundaryRef: clone(envelope.workspaceBoundaryRef)
  };
}

function emptyTruth() {
  return Object.fromEntries(TRUTH_FIELDS.map((field) => [field, false]));
}

function buildAssessmentCore(status, details) {
  if (!STATUSES.has(status)) throw new Error('readiness status is unsupported');
  const truth = { ...emptyTruth(), ...(details.truth || {}) };
  return {
    schema: READINESS_SCHEMA,
    version: VERSION,
    status,
    planDigest: details.planDigest || null,
    readinessSubjectDigest: details.readinessSubjectDigest || null,
    verifiedObserverRef: details.verifiedObserverRef || null,
    verifiedAssuranceRefs: (details.verifiedAssuranceRefs || []).slice().sort((left, right) => compareText(canonicalJson(left), canonicalJson(right))),
    holds: (details.holds || []).slice(),
    nextGate: status === 'AUTHORIZATION_REQUIRED'
      ? 'MIKE_DECISION_AND_REPAIRED_DISPOSABLE_SANDBOX_EXECUTOR'
      : 'REPAIR_EVIDENCE_THEN_REASSESS',
    truth,
    authority: 'NONE'
  };
}

function sealAssessment(status, details) {
  const core = buildAssessmentCore(status, details);
  return { ...core, readinessDigest: sha256(core) };
}

function hold(status, details, message) {
  return sealAssessment(status, { ...details, holds: [...(details.holds || []), message] });
}

function assessExecutionReadiness(input) {
  exactKeys(input, ['routePlan', 'routeInput', 'observerKey', 'observationAttestation', 'assuranceRecords'], 'readiness input');
  let routeVerification;
  try {
    routeVerification = Fabric.verifyRoutePlan(input.routePlan, input.routeInput);
  } catch (error) {
    routeVerification = { pass: false, errors: [error.message] };
  }
  if (!routeVerification.pass) {
    const routeErrors = routeVerification.errors.length ? routeVerification.errors : ['unknown route-plan verification failure'];
    return sealAssessment('PLAN_INVALID', {
      holds: routeErrors.map((message) => 'ROUTE_PLAN_INVALID:' + message)
    });
  }

  const plan = Fabric.normalizeRoutePlan(input.routePlan);
  const base = {
    planDigest: plan.planDigest,
    truth: { routePlanVerified: true, routePlanned: plan.status === 'ROUTE_PLANNED' }
  };
  if (plan.status !== 'ROUTE_PLANNED') {
    return hold('ROUTE_NOT_PLANNED', base, 'ROUTE_STATUS:' + plan.status);
  }

  const subject = buildReadinessSubject(plan);
  const subjectDigest = sha256(subject);
  base.readinessSubjectDigest = subjectDigest;

  let key;
  let keyRef;
  try {
    key = normalizeTrustKey(input.observerKey);
    keyRef = buildTrustKeyRef(key);
  } catch (error) {
    return hold('OBSERVER_KEY_HOLD', base, 'OBSERVER_KEY_INVALID:' + error.message);
  }
  if (!same(keyRef, plan.hostObservation.observerRef)) {
    return hold('OBSERVER_KEY_HOLD', base, 'OBSERVER_KEY_REFERENCE_MISMATCH');
  }
  base.verifiedObserverRef = keyRef;
  base.truth.hostObserverKeyBound = true;

  let attestation;
  try {
    attestation = normalizeObservationAttestation(input.observationAttestation);
  } catch (error) {
    return hold('OBSERVATION_ATTESTATION_HOLD', base, 'OBSERVATION_ATTESTATION_INVALID:' + error.message);
  }
  if (!same(attestation.keyRef, keyRef)) {
    return hold('OBSERVATION_ATTESTATION_HOLD', base, 'OBSERVATION_ATTESTATION_KEY_MISMATCH');
  }
  if (attestation.observationRecordDigest !== plan.hostObservation.recordDigest) {
    return hold('OBSERVATION_ATTESTATION_HOLD', base, 'OBSERVATION_ATTESTATION_RECORD_MISMATCH');
  }
  const signedAt = Date.parse(attestation.signedAt);
  const evaluatedAt = Date.parse(plan.request.policy.observation.evaluatedAt);
  if (signedAt < Date.parse(plan.hostObservation.observedAt) ||
    signedAt > Date.parse(plan.hostObservation.expiresAt) || signedAt > evaluatedAt) {
    return hold('OBSERVATION_ATTESTATION_HOLD', base, 'OBSERVATION_ATTESTATION_TIME_OUTSIDE_OBSERVATION_WINDOW');
  }
  let signatureVerified = false;
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(key.publicKeySpkiDerBase64, 'base64'),
      format: 'der',
      type: 'spki'
    });
    const payload = buildObservationAttestationPayload({
      schema: attestation.schema,
      observationRecordDigest: attestation.observationRecordDigest,
      keyRef: attestation.keyRef,
      signedAt: attestation.signedAt
    });
    signatureVerified = crypto.verify(null, payload, publicKey, Buffer.from(attestation.signatureBase64, 'base64'));
  } catch (error) {
    signatureVerified = false;
  }
  if (!signatureVerified) {
    return hold('OBSERVATION_ATTESTATION_HOLD', base, 'OBSERVATION_SIGNATURE_INVALID');
  }
  base.truth.hostObservationSignatureVerified = true;

  if (!Array.isArray(input.assuranceRecords) || input.assuranceRecords.length > 32) {
    return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_RECORDS_MUST_BE_A_BOUNDED_ARRAY');
  }
  let records;
  try {
    records = input.assuranceRecords.map(normalizeAssuranceRecord);
  } catch (error) {
    return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_RECORD_INVALID:' + error.message);
  }
  records.sort((left, right) => compareText(canonicalJson(assuranceRecordRef(left)), canonicalJson(assuranceRecordRef(right))));
  const recordRefs = records.map(assuranceRecordRef).sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(recordRefs.map(canonicalJson)).size !== recordRefs.length) {
    return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_RECORD_DUPLICATE_REFERENCE');
  }
  if (new Set(recordRefs.map((item) => item.id)).size !== recordRefs.length) {
    return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_RECORD_DUPLICATE_ID');
  }
  const expectedRefs = plan.plannedEnvelope.assuranceRefs.slice().sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (!same(recordRefs, expectedRefs)) {
    return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_REFERENCE_SET_MISMATCH');
  }
  base.verifiedAssuranceRefs = recordRefs;
  base.truth.assuranceRecordIntegrityVerified = true;

  for (const record of records) {
    if (record.subjectDigest !== subjectDigest) {
      return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_SUBJECT_MISMATCH:' + record.id);
    }
    if (!same(record.verifierRef, keyRef)) {
      return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_VERIFIER_MISMATCH:' + record.id);
    }
    if (Date.parse(record.observedAt) > signedAt || Date.parse(record.observedAt) > evaluatedAt ||
      Date.parse(record.expiresAt) <= evaluatedAt) {
      return hold('ASSURANCE_RECORD_HOLD', base, 'ASSURANCE_RECORD_STALE_OR_FUTURE:' + record.id);
    }
  }
  base.truth.assuranceScopeVerified = true;

  const nonPassing = records.filter((record) => record.verdict !== 'PASS');
  if (nonPassing.length) {
    return hold(
      'ASSURANCE_VERDICT_HOLD',
      base,
      'ASSURANCE_NON_PASS:' + nonPassing.map((record) => record.id + '=' + record.verdict).sort(compareText).join(',')
    );
  }
  base.truth.assurancePassVerdictsAccepted = true;

  return sealAssessment('AUTHORIZATION_REQUIRED', base);
}

function normalizeTruth(value) {
  exactKeys(value, TRUTH_FIELDS, 'readiness.truth');
  const result = {};
  TRUTH_FIELDS.forEach((field) => {
    if (typeof value[field] !== 'boolean') throw new Error('readiness.truth.' + field + ' must be boolean');
    result[field] = value[field];
  });
  const forbiddenTrue = [
    'resourceEnforcementObserved', 'executorAuthorized', 'providerCodeLoaded', 'providerCodeExecuted',
    'workspaceContentRead', 'permissionGranted', 'networkUsed', 'outputWritten', 'installed',
    'promoted', 'canonChanged'
  ];
  forbiddenTrue.forEach((field) => {
    if (result[field]) throw new Error('readiness.truth.' + field + ' violates the readiness-only truth ceiling');
  });
  return result;
}

function normalizeAssessment(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'planDigest', 'readinessSubjectDigest', 'verifiedObserverRef',
    'verifiedAssuranceRefs', 'holds', 'nextGate', 'truth', 'authority', 'readinessDigest'
  ], 'readiness');
  if (value.schema !== READINESS_SCHEMA) throw new Error('readiness schema mismatch');
  if (value.version !== VERSION) throw new Error('readiness version mismatch');
  if (!STATUSES.has(value.status)) throw new Error('readiness status is unsupported');
  if (value.authority !== 'NONE') throw new Error('readiness authority must remain NONE');
  const expectedNextGate = value.status === 'AUTHORIZATION_REQUIRED'
    ? 'MIKE_DECISION_AND_REPAIRED_DISPOSABLE_SANDBOX_EXECUTOR'
    : 'REPAIR_EVIDENCE_THEN_REASSESS';
  if (value.nextGate !== expectedNextGate) throw new Error('readiness nextGate conflicts with status');
  if (!Array.isArray(value.holds) || value.holds.length > 64) throw new Error('readiness.holds must be a bounded array');
  const holds = value.holds.map((item, index) => strictText(item, 'readiness.holds[' + index + ']', 500));
  if (new Set(holds).size !== holds.length) throw new Error('readiness.holds contains duplicates');
  if (!Array.isArray(value.verifiedAssuranceRefs) || value.verifiedAssuranceRefs.length > 32) {
    throw new Error('readiness.verifiedAssuranceRefs must be a bounded array');
  }
  const refs = value.verifiedAssuranceRefs.map((item, index) => reference(item, 'readiness.verifiedAssuranceRefs[' + index + ']'));
  refs.sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(refs.map(canonicalJson)).size !== refs.length) throw new Error('readiness.verifiedAssuranceRefs contains duplicates');
  const truth = normalizeTruth(value.truth);
  if (truth.routePlanned && !truth.routePlanVerified) throw new Error('readiness truth cannot plan an unverified route');
  if (truth.hostObserverKeyBound && !truth.routePlanned) throw new Error('readiness truth cannot bind a key before a route is planned');
  if (truth.hostObservationSignatureVerified && !truth.hostObserverKeyBound) {
    throw new Error('readiness truth cannot verify a signature before binding its key');
  }
  if (truth.assuranceRecordIntegrityVerified && !truth.hostObservationSignatureVerified) {
    throw new Error('readiness truth cannot authenticate assurance records before the signed observation');
  }
  if (truth.assuranceScopeVerified && !truth.assuranceRecordIntegrityVerified) {
    throw new Error('readiness truth cannot verify assurance scope before record integrity');
  }
  if (truth.assurancePassVerdictsAccepted && !truth.assuranceScopeVerified) {
    throw new Error('readiness truth cannot accept assurance verdicts before scope verification');
  }
  const core = {
    schema: READINESS_SCHEMA,
    version: VERSION,
    status: value.status,
    planDigest: value.planDigest == null ? null : digest(value.planDigest, 'readiness.planDigest'),
    readinessSubjectDigest: value.readinessSubjectDigest == null ? null : digest(value.readinessSubjectDigest, 'readiness.readinessSubjectDigest'),
    verifiedObserverRef: value.verifiedObserverRef == null ? null : reference(value.verifiedObserverRef, 'readiness.verifiedObserverRef'),
    verifiedAssuranceRefs: refs,
    holds,
    nextGate: expectedNextGate,
    truth,
    authority: 'NONE'
  };
  const readinessDigest = digest(value.readinessDigest, 'readiness.readinessDigest');
  if (sha256(core) !== readinessDigest) throw new Error('readiness digest mismatch');
  const normalized = { ...core, readinessDigest };
  if (!same(normalized, value)) throw new Error('readiness is not in canonical normalized form');
  if (normalized.status === 'PLAN_INVALID') {
    if (normalized.planDigest !== null || normalized.readinessSubjectDigest !== null ||
      normalized.verifiedObserverRef !== null || normalized.verifiedAssuranceRefs.length) {
      throw new Error('PLAN_INVALID cannot retain unverified plan or evidence references');
    }
  } else if (normalized.planDigest === null) {
    throw new Error('a verified route result must retain its plan digest');
  }
  if (normalized.truth.routePlanned && normalized.readinessSubjectDigest === null) {
    throw new Error('a planned route must retain its readiness subject digest');
  }
  if (normalized.truth.hostObserverKeyBound !== (normalized.verifiedObserverRef !== null)) {
    throw new Error('verifiedObserverRef must match hostObserverKeyBound truth');
  }
  if (normalized.truth.assuranceRecordIntegrityVerified !== (normalized.verifiedAssuranceRefs.length > 0)) {
    throw new Error('verifiedAssuranceRefs must match assuranceRecordIntegrityVerified truth');
  }
  if ((normalized.status === 'AUTHORIZATION_REQUIRED') !== (normalized.holds.length === 0)) {
    throw new Error('AUTHORIZATION_REQUIRED must be the only hold-free status');
  }
  const proofFields = TRUTH_FIELDS.slice(0, 7);
  if (normalized.status === 'PLAN_INVALID' && proofFields.some((field) => normalized.truth[field])) {
    throw new Error('PLAN_INVALID cannot retain positive readiness proof');
  }
  if (normalized.status === 'ROUTE_NOT_PLANNED' &&
    (!normalized.truth.routePlanVerified || normalized.truth.routePlanned)) {
    throw new Error('ROUTE_NOT_PLANNED truth conflicts with status');
  }
  if (normalized.status === 'OBSERVER_KEY_HOLD' &&
    (!normalized.truth.routePlanned || normalized.truth.hostObserverKeyBound)) {
    throw new Error('OBSERVER_KEY_HOLD truth conflicts with status');
  }
  if (normalized.status === 'OBSERVATION_ATTESTATION_HOLD' &&
    (!normalized.truth.hostObserverKeyBound || normalized.truth.hostObservationSignatureVerified)) {
    throw new Error('OBSERVATION_ATTESTATION_HOLD truth conflicts with status');
  }
  if (normalized.status === 'ASSURANCE_RECORD_HOLD' &&
    (!normalized.truth.hostObservationSignatureVerified || normalized.truth.assuranceScopeVerified)) {
    throw new Error('ASSURANCE_RECORD_HOLD truth conflicts with status');
  }
  if (normalized.status === 'ASSURANCE_VERDICT_HOLD' &&
    (!normalized.truth.assuranceScopeVerified || normalized.truth.assurancePassVerdictsAccepted)) {
    throw new Error('ASSURANCE_VERDICT_HOLD truth conflicts with status');
  }
  if (normalized.status === 'AUTHORIZATION_REQUIRED') {
    const requiredTrue = [
      'routePlanVerified', 'routePlanned', 'hostObserverKeyBound',
      'hostObservationSignatureVerified', 'assuranceRecordIntegrityVerified',
      'assuranceScopeVerified', 'assurancePassVerdictsAccepted'
    ];
    requiredTrue.forEach((field) => {
      if (!normalized.truth[field]) throw new Error('AUTHORIZATION_REQUIRED needs readiness.truth.' + field);
    });
  }
  return normalized;
}

function verifyReadinessAssessment(value, input) {
  const errors = [];
  try {
    const normalized = normalizeAssessment(value);
    const rebuilt = assessExecutionReadiness(input);
    if (!same(normalized, rebuilt)) throw new Error('readiness content differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  VERSION,
  TRUST_KEY_SCHEMA,
  OBSERVATION_ATTESTATION_SCHEMA,
  ASSURANCE_RECORD_SCHEMA,
  READINESS_SUBJECT_SCHEMA,
  READINESS_SCHEMA,
  canonicalJson,
  sha256,
  normalizeTrustKey,
  buildTrustKeyRef,
  buildObservationAttestationPayload,
  normalizeObservationAttestation,
  sealAssuranceRecord,
  normalizeAssuranceRecord,
  assuranceRecordRef,
  buildReadinessSubject,
  assessExecutionReadiness,
  normalizeAssessment,
  verifyReadinessAssessment,
  clone
};
