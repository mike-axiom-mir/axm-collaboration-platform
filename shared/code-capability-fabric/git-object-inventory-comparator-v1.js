'use strict';

const crypto = require('crypto');
const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Readiness = require('./code-capability-readiness-v1');

const VERSION = '0.1.0';
const INVENTORY_SCHEMA = 'axm.git-object-inventory-observation/v1';
const SUBJECT_SCHEMA = 'axm.git-repository-object-set-subject/v1';
const REQUEST_SCHEMA = 'axm.git-object-inventory-comparison-request/v1';
const RECEIPT_SCHEMA = 'axm.git-object-inventory-comparison-receipt/v1';
const PROFILE_SCHEMA = 'axm.git-object-inventory-comparator-profile/v1';
const ACKNOWLEDGEMENT = 'COMPARE TWO SIGNED HOST-SUPPLIED GIT OBJECT INVENTORIES ONLY';
const DECLARATION_SCHEMA = 'axm.interactive-pilot-declaration/v1';
const DECLARATION_ID = 'interactive-git-object-inventory-comparison-declaration';
const ENUMERATION_CLAIM = 'HOST_DECLARED_ALL_LOCAL_OBJECTS';
const MAX_OBJECTS = 2048;
const MAX_DECLARED_OBJECT_BYTES = 1099511627776;
const MAX_INVENTORY_WINDOW_MS = 3600000;
const MAX_OBSERVATION_SKEW_MS = 300000;
const MAX_VERIFIER_INPUT_BYTES = 1048576;
const MAX_RECEIPT_BYTES = 524288;
const MAX_DECLARED_MEMORY_BYTES = 134217728;
const MAX_DECLARED_DURATION_MS = 5000;
const REQUIRED_ACTIONS = Object.freeze(['code.compare-git-object-inventories']);
const REQUIRED_PERMISSIONS = Object.freeze([]);
const REQUIRED_DATA_CLASSES = Object.freeze(['public-generated-artifact']);
const REQUIRED_SOURCE_USES = Object.freeze(['compare-artifact-lineage']);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([
  Readiness.OBSERVATION_ATTESTATION_SCHEMA,
  RECEIPT_SCHEMA
].sort());
const OBJECT_TYPES = Object.freeze(['blob', 'commit', 'tag', 'tree']);
const ISSUES = Object.freeze([
  'OBJECTS_ADDED',
  'OBJECTS_REMOVED',
  'OBJECT_METADATA_CONTRADICTION'
]);
const LIMITATIONS = Object.freeze([
  'HOST_KEYS_TRUSTED_ONLY_BY_EXACT_CONSENT_BOUND_REQUEST',
  'HOST_ENUMERATION_CLAIM_NOT_INDEPENDENTLY_VERIFIED',
  'GIT_REPOSITORY_NOT_OPENED_BY_COMPARATOR',
  'GIT_COMMANDS_NOT_EXECUTED_BY_COMPARATOR',
  'OBJECT_BYTES_NOT_READ_OR_REHASHED',
  'OBJECT_ID_SECURITY_DEPENDS_ON_DECLARED_FORMAT_AND_HOST_ENUMERATION',
  'SIGNED_OBSERVATION_DOES_NOT_PROVE_ENUMERATION_COMPLETENESS',
  'CALLER_SUPPLIED_TIME_NOT_A_TRUSTED_CLOCK',
  'INTERACTIVE_DECLARATION_NOT_CRYPTOGRAPHIC_HUMAN_IDENTITY_PROOF',
  'INTERACTIVE_DECLARATION_REPLAY_NOT_PREVENTED',
  'PREDECISION_EVIDENCE_CONTENT_NOT_VERIFIED',
  'DECLARED_PUBLIC_DATA_CLASS_CONTENT_NOT_VERIFIED',
  'GIT_REFS_NOT_INSPECTED',
  'GIT_REMOTE_NOT_CONTACTED',
  'TRANSPORT_DELIVERY_NOT_PROVEN',
  'FULL_CLONE_COMPLETENESS_NOT_PROVEN',
  'RECOVERY_REPLAY_NOT_RUN',
  'DURATION_MEMORY_AND_CROSS_INVOCATION_ATTEMPTS_NOT_ENFORCED',
  'MIRROR_CODE_CLONE_NOT_CONNECTED_OR_EXECUTED',
  'MACHINE_HOST_DEFAULT_NOT_ACTIVATED',
  'PERSISTENT_LEARNING_NOT_ADMITTED'
]);
const NEXT_GAPS = Object.freeze([
  'mirror.git-ref-set.compare',
  'mirror.transport.sender-receipt.verify',
  'mirror.transport.receiver-receipt.verify',
  'mirror.clone-completeness.verify',
  'mirror.recovery.replay-test',
  'inventory.host-enumerator.verify',
  'consent.human-decision.authenticate',
  'consent.declaration.replay-prevent',
  'consent.revocation.observe-live',
  'consent.trusted-clock.observe'
]);
const PROFILE = Object.freeze({
  schema: PROFILE_SCHEMA,
  id: 'deterministic-signed-git-object-inventory-comparator',
  version: VERSION,
  kind: 'PURE_DATA_COMPARISON',
  maximumObjectsPerInventory: MAX_OBJECTS,
  maximumDeclaredObjectBytesPerInventory: MAX_DECLARED_OBJECT_BYTES,
  maximumInventoryWindowMs: MAX_INVENTORY_WINDOW_MS,
  maximumObservationSkewMs: MAX_OBSERVATION_SKEW_MS,
  maximumVerifierInputBytes: MAX_VERIFIER_INPUT_BYTES,
  maximumReceiptBytes: MAX_RECEIPT_BYTES,
  maximumDeclaredMemoryBytes: MAX_DECLARED_MEMORY_BYTES,
  maximumDeclaredDurationMs: MAX_DECLARED_DURATION_MS,
  filesystemReads: 'DISABLED_HOST_SUPPLIES_RECORDS',
  filesystemWrites: 'DISABLED',
  gitCommands: 'DISABLED',
  network: 'DISABLED',
  childProcesses: 'DISABLED',
  objectExecution: 'DISABLED',
  authority: 'NONE'
});

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{1,127}$/;

function canonicalJson(value) {
  return Fabric.canonicalJson(value);
}

function clone(value) {
  return Fabric.clone(value);
}

function sha256(value) {
  return Fabric.sha256(value);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
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
  const missing = expected.filter((key) => !actual.includes(key));
  const extras = actual.filter((key) => !expected.includes(key));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.join(', '));
  if (extras.length) throw new Error(label + ' has unsupported fields: ' + extras.join(', '));
}

function identifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw new Error(label + ' is invalid');
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return value;
}

function boundedInteger(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(label + ' must be a canonical UTC timestamp');
  }
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  if (typeof value.schema !== 'string' || !value.schema.length || value.schema.length > 220) {
    throw new Error(label + '.schema is invalid');
  }
  return {
    id: identifier(value.id, label + '.id'),
    schema: value.schema,
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function artifactReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256', 'byteLength'], label);
  const ref = reference({ id: value.id, schema: value.schema, sha256: value.sha256 }, label);
  return { ...ref, byteLength: boundedInteger(value.byteLength, label + '.byteLength', 1, MAX_VERIFIER_INPUT_BYTES) };
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function profileRef() {
  return { id: PROFILE.id, schema: PROFILE.schema, sha256: sha256(PROFILE) };
}

function declarationRef() {
  const core = {
    schema: DECLARATION_SCHEMA,
    id: DECLARATION_ID,
    acknowledgement: ACKNOWLEDGEMENT,
    scope: 'ONE_SOURCE_AND_ONE_MIRROR_SIGNED_GIT_OBJECT_INVENTORY'
  };
  return { id: core.id, schema: core.schema, sha256: sha256(core) };
}

function normalizeSubjectRef(value, label) {
  const ref = reference(value, label);
  if (ref.schema !== SUBJECT_SCHEMA) throw new Error(label + ' schema mismatch');
  return ref;
}

function normalizeObjectRecord(value, objectFormat, label) {
  exactKeys(value, ['oid', 'type', 'size'], label);
  const oidPattern = objectFormat === 'SHA1' ? /^[0-9a-f]{40}$/ : /^[0-9a-f]{64}$/;
  if (typeof value.oid !== 'string' || !oidPattern.test(value.oid)) {
    throw new Error(label + '.oid does not match ' + objectFormat);
  }
  if (!OBJECT_TYPES.includes(value.type)) throw new Error(label + '.type is unsupported');
  return {
    oid: value.oid,
    type: value.type,
    size: boundedInteger(value.size, label + '.size', 0, MAX_DECLARED_OBJECT_BYTES)
  };
}

function normalizeInventoryCore(value) {
  exactKeys(value, [
    'schema', 'version', 'id', 'role', 'subjectRef', 'objectFormat', 'enumerationClaim',
    'observedAt', 'expiresAt', 'objects', 'objectCount', 'totalDeclaredObjectBytes', 'authority'
  ], 'Git object inventory');
  if (value.schema !== INVENTORY_SCHEMA || value.version !== VERSION) throw new Error('Git object inventory identity mismatch');
  if (!['SOURCE', 'MIRROR'].includes(value.role)) throw new Error('Git object inventory role must be SOURCE or MIRROR');
  if (!['SHA1', 'SHA256'].includes(value.objectFormat)) throw new Error('Git object inventory objectFormat is unsupported');
  if (value.enumerationClaim !== ENUMERATION_CLAIM) throw new Error('Git object inventory enumeration claim mismatch');
  if (value.authority !== 'NONE') throw new Error('Git object inventory authority must remain NONE');
  const observedAt = timestamp(value.observedAt, 'Git object inventory.observedAt');
  const expiresAt = timestamp(value.expiresAt, 'Git object inventory.expiresAt');
  const windowMs = Date.parse(expiresAt) - Date.parse(observedAt);
  if (windowMs <= 0 || windowMs > MAX_INVENTORY_WINDOW_MS) {
    throw new Error('Git object inventory observation window is outside the fixed profile');
  }
  if (!Array.isArray(value.objects) || value.objects.length > MAX_OBJECTS) {
    throw new Error('Git object inventory objects must be a bounded array');
  }
  const objects = value.objects.map((item, index) => normalizeObjectRecord(item, value.objectFormat, 'Git object inventory.objects[' + index + ']'))
    .sort((left, right) => compareText(left.oid, right.oid));
  if (new Set(objects.map((item) => item.oid)).size !== objects.length) {
    throw new Error('Git object inventory contains duplicate object identifiers');
  }
  const totalDeclaredObjectBytes = objects.reduce((total, item) => total + item.size, 0);
  if (!Number.isSafeInteger(totalDeclaredObjectBytes) || totalDeclaredObjectBytes > MAX_DECLARED_OBJECT_BYTES) {
    throw new Error('Git object inventory declared byte total exceeds the fixed profile');
  }
  if (value.objectCount !== objects.length || value.totalDeclaredObjectBytes !== totalDeclaredObjectBytes) {
    throw new Error('Git object inventory count or byte total is inconsistent');
  }
  const core = {
    schema: INVENTORY_SCHEMA,
    version: VERSION,
    id: identifier(value.id, 'Git object inventory.id'),
    role: value.role,
    subjectRef: normalizeSubjectRef(value.subjectRef, 'Git object inventory.subjectRef'),
    objectFormat: value.objectFormat,
    enumerationClaim: ENUMERATION_CLAIM,
    observedAt,
    expiresAt,
    objects,
    objectCount: objects.length,
    totalDeclaredObjectBytes,
    authority: 'NONE'
  };
  if (!same(core, value)) throw new Error('Git object inventory is not canonical');
  return core;
}

function sealInventory(value) {
  const core = normalizeInventoryCore(value);
  return { ...core, inventoryDigest: sha256(core) };
}

function normalizeInventory(value) {
  exactKeys(value, [
    'schema', 'version', 'id', 'role', 'subjectRef', 'objectFormat', 'enumerationClaim',
    'observedAt', 'expiresAt', 'objects', 'objectCount', 'totalDeclaredObjectBytes', 'authority',
    'inventoryDigest'
  ], 'Git object inventory');
  const { inventoryDigest, ...candidateCore } = value;
  const sealed = sealInventory(candidateCore);
  if (sealed.inventoryDigest !== digest(inventoryDigest, 'Git object inventory.inventoryDigest')) {
    throw new Error('Git object inventory digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('Git object inventory is not canonical sealed data');
  return sealed;
}

function inventoryRef(value) {
  const inventory = normalizeInventory(value);
  return { id: inventory.id, schema: inventory.schema, sha256: inventory.inventoryDigest };
}

function inventoryArtifactRef(value) {
  const inventory = normalizeInventory(value);
  return { ...inventoryRef(inventory), byteLength: jsonBytes(inventory).length };
}

function objectSetFingerprint(inventory) {
  return sha256(inventory.objects);
}

function normalizeRequestCore(value) {
  exactKeys(value, [
    'schema', 'id', 'status', 'subjectRef', 'sourceInventoryRef', 'mirrorInventoryRef',
    'trustedObserverRefs', 'rootsGate', 'authority'
  ], 'Git object inventory comparison request');
  if (value.schema !== REQUEST_SCHEMA) throw new Error('Git object inventory comparison request schema mismatch');
  if (value.status !== 'TEST') throw new Error('Git object inventory comparison request must remain TEST');
  if (value.authority !== 'NONE') throw new Error('Git object inventory comparison request authority must remain NONE');
  if (!same(value.rootsGate, Consent.ROOTS_GATE)) throw new Error('Git object inventory comparison request roots gate mismatch');
  if (!Array.isArray(value.trustedObserverRefs) || value.trustedObserverRefs.length < 1 || value.trustedObserverRefs.length > 4) {
    throw new Error('Git object inventory comparison request trusted observers must contain from 1 to 4 refs');
  }
  const trustedObserverRefs = value.trustedObserverRefs.map((item, index) => reference(item, 'request.trustedObserverRefs[' + index + ']'))
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(trustedObserverRefs.map(canonicalJson)).size !== trustedObserverRefs.length) {
    throw new Error('Git object inventory comparison request trusted observers contain duplicates');
  }
  const core = {
    schema: REQUEST_SCHEMA,
    id: identifier(value.id, 'Git object inventory comparison request.id'),
    status: 'TEST',
    subjectRef: normalizeSubjectRef(value.subjectRef, 'request.subjectRef'),
    sourceInventoryRef: reference(value.sourceInventoryRef, 'request.sourceInventoryRef'),
    mirrorInventoryRef: reference(value.mirrorInventoryRef, 'request.mirrorInventoryRef'),
    trustedObserverRefs,
    rootsGate: Consent.ROOTS_GATE.slice(),
    authority: 'NONE'
  };
  if (core.sourceInventoryRef.schema !== INVENTORY_SCHEMA || core.mirrorInventoryRef.schema !== INVENTORY_SCHEMA) {
    throw new Error('Git object inventory comparison request inventory schema mismatch');
  }
  if (core.sourceInventoryRef.id === core.mirrorInventoryRef.id) {
    throw new Error('Git object inventory comparison request inventory ids must be distinct');
  }
  if (!same(core, value)) throw new Error('Git object inventory comparison request is not canonical');
  return core;
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  return { ...core, requestDigest: sha256(core) };
}

function normalizeRequest(value) {
  exactKeys(value, [
    'schema', 'id', 'status', 'subjectRef', 'sourceInventoryRef', 'mirrorInventoryRef',
    'trustedObserverRefs', 'rootsGate', 'authority', 'requestDigest'
  ], 'Git object inventory comparison request');
  const { requestDigest, ...candidateCore } = value;
  const sealed = sealRequest(candidateCore);
  if (sealed.requestDigest !== digest(requestDigest, 'request.requestDigest')) throw new Error('Git object inventory comparison request digest mismatch');
  if (!same(sealed, value)) throw new Error('Git object inventory comparison request is not canonical sealed data');
  return sealed;
}

function requestRef(value) {
  const request = normalizeRequest(value);
  return { id: request.id, schema: request.schema, sha256: request.requestDigest };
}

function buildRequest(sourceInventory, mirrorInventory, observerKeys, id = 'bounded-git-object-inventory-comparison') {
  const source = normalizeInventory(sourceInventory);
  const mirror = normalizeInventory(mirrorInventory);
  if (source.id === mirror.id) throw new Error('Git object inventory source and mirror ids must be distinct');
  const keys = observerKeys.map(Readiness.normalizeTrustKey);
  const trustedObserverRefs = keys.map(Readiness.buildTrustKeyRef)
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  return sealRequest({
    schema: REQUEST_SCHEMA,
    id,
    status: 'TEST',
    subjectRef: source.subjectRef,
    sourceInventoryRef: inventoryRef(source),
    mirrorInventoryRef: inventoryRef(mirror),
    trustedObserverRefs,
    rootsGate: Consent.ROOTS_GATE.slice(),
    authority: 'NONE'
  });
}

function normalizeAuthorization(value) {
  exactKeys(value, ['mode', 'scope', 'acknowledgement', 'instructionRef'], 'Git object inventory comparison authorization');
  const normalized = {
    mode: value.mode,
    scope: value.scope,
    acknowledgement: value.acknowledgement,
    instructionRef: reference(value.instructionRef, 'authorization.instructionRef')
  };
  if (normalized.mode !== 'INTERACTIVE_SESSION_DECLARATION' ||
    normalized.scope !== 'ONE_SOURCE_AND_ONE_MIRROR_SIGNED_GIT_OBJECT_INVENTORY' ||
    normalized.acknowledgement !== ACKNOWLEDGEMENT || !same(normalized.instructionRef, declarationRef())) {
    throw new Error('Git object inventory comparison authorization mismatch');
  }
  return normalized;
}

function verifySignedObservation(inventory, attestationValue, keysByRef, evaluatedAt) {
  const attestation = Readiness.normalizeObservationAttestation(attestationValue);
  if (attestation.observationRecordDigest !== inventory.inventoryDigest) {
    throw new Error(inventory.role.toLowerCase() + ' observation attestation inventory digest mismatch');
  }
  const key = keysByRef.get(canonicalJson(attestation.keyRef));
  if (!key) throw new Error(inventory.role.toLowerCase() + ' observation attestation key is not consent-bound');
  const signedAt = Date.parse(attestation.signedAt);
  if (signedAt < Date.parse(inventory.observedAt) || signedAt > Date.parse(inventory.expiresAt) || signedAt > Date.parse(evaluatedAt)) {
    throw new Error(inventory.role.toLowerCase() + ' observation attestation time is invalid');
  }
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(key.publicKeySpkiDerBase64, 'base64'),
    format: 'der',
    type: 'spki'
  });
  const verified = crypto.verify(
    null,
    Readiness.buildObservationAttestationPayload({
      schema: attestation.schema,
      observationRecordDigest: attestation.observationRecordDigest,
      keyRef: attestation.keyRef,
      signedAt: attestation.signedAt
    }),
    publicKey,
    Buffer.from(attestation.signatureBase64, 'base64')
  );
  if (!verified) throw new Error(inventory.role.toLowerCase() + ' observation attestation signature is invalid');
  return { attestation, observerRef: Readiness.buildTrustKeyRef(key) };
}

function allFalseLifecycle(value) {
  return Consent.LIFECYCLE_FIELDS.every((field) => value[field] === false);
}

function observedInputBytes(input, normalized) {
  const metadata = {
    request: normalized.request,
    observerKeys: normalized.keys,
    sourceAttestation: normalized.sourceSigned.attestation,
    mirrorAttestation: normalized.mirrorSigned.attestation,
    consentEvaluationInput: input.consentEvaluationInput,
    consentEvaluation: input.consentEvaluation,
    authorization: input.authorization
  };
  return jsonBytes(normalized.source).length + jsonBytes(normalized.mirror).length +
    Buffer.byteLength(canonicalJson(metadata), 'utf8');
}

function prepare(input) {
  exactKeys(input, [
    'request', 'sourceInventory', 'mirrorInventory', 'observerKeys', 'sourceAttestation',
    'mirrorAttestation', 'consentEvaluationInput', 'consentEvaluation', 'authorization'
  ], 'Git object inventory comparison input');
  const source = normalizeInventory(input.sourceInventory);
  const mirror = normalizeInventory(input.mirrorInventory);
  if (source.role !== 'SOURCE' || mirror.role !== 'MIRROR') throw new Error('Git object inventory input roles are directional and exact');
  if (source.id === mirror.id) throw new Error('Git object inventory source and mirror ids must be distinct');
  if (!same(source.subjectRef, mirror.subjectRef)) throw new Error('Git object inventories do not describe the same logical subject');
  if (source.objectFormat !== mirror.objectFormat) throw new Error('Git object inventory object formats are incompatible');
  const request = normalizeRequest(input.request);
  if (!same(request.subjectRef, source.subjectRef) || !same(request.sourceInventoryRef, inventoryRef(source)) ||
    !same(request.mirrorInventoryRef, inventoryRef(mirror))) {
    throw new Error('Git object inventory comparison request does not bind the exact inventories');
  }
  if (!Array.isArray(input.observerKeys) || input.observerKeys.length < 1 || input.observerKeys.length > 4) {
    throw new Error('Git object inventory comparison observer keys must contain from 1 to 4 keys');
  }
  const keys = input.observerKeys.map(Readiness.normalizeTrustKey);
  const keyRefs = keys.map(Readiness.buildTrustKeyRef).sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(keyRefs.map(canonicalJson)).size !== keyRefs.length || !same(keyRefs, request.trustedObserverRefs)) {
    throw new Error('Git object inventory comparison observer keys do not match the consent-bound trusted set');
  }
  const evaluation = Consent.normalizeEvaluation(input.consentEvaluation);
  const evaluationCheck = Consent.verifyEvaluation(evaluation, input.consentEvaluationInput);
  if (!evaluationCheck.pass) throw new Error('grounded consent evaluation verification failed: ' + evaluationCheck.errors.join('|'));
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    throw new Error('grounded consent scope must be hold-free before interactive comparison declaration');
  }
  const evaluatedAt = timestamp(evaluation.evaluatedAt, 'consent evaluation.evaluatedAt');
  for (const inventory of [source, mirror]) {
    if (Date.parse(inventory.observedAt) > Date.parse(evaluatedAt) || Date.parse(inventory.expiresAt) <= Date.parse(evaluatedAt)) {
      throw new Error(inventory.role.toLowerCase() + ' Git object inventory is stale or future-dated at evaluation');
    }
  }
  if (Math.abs(Date.parse(source.observedAt) - Date.parse(mirror.observedAt)) > MAX_OBSERVATION_SKEW_MS) {
    throw new Error('Git object inventory observation times exceed the comparison skew profile');
  }
  const keysByRef = new Map(keys.map((key) => [canonicalJson(Readiness.buildTrustKeyRef(key)), key]));
  const sourceSigned = verifySignedObservation(source, input.sourceAttestation, keysByRef, evaluatedAt);
  const mirrorSigned = verifySignedObservation(mirror, input.mirrorAttestation, keysByRef, evaluatedAt);
  const authorization = normalizeAuthorization(input.authorization);
  const policy = Consent.normalizePolicy(input.consentEvaluationInput.policy);
  const instance = Consent.normalizeInstance(input.consentEvaluationInput.instance);
  const artifacts = [inventoryArtifactRef(source), inventoryArtifactRef(mirror)]
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (instance.domain !== 'code' || !same(instance.subjectRef, requestRef(request)) || !same(instance.domainProfileRef, profileRef())) {
    throw new Error('grounded consent subject or profile does not bind the exact comparison');
  }
  if (!same(instance.inputArtifacts, artifacts)) throw new Error('grounded consent input artifacts do not bind both exact inventories');
  if (!same(instance.actions, REQUIRED_ACTIONS)) throw new Error('Git object inventory comparison action scope must be exact');
  if (!same(instance.permissions, REQUIRED_PERMISSIONS)) throw new Error('Git object inventory comparison permission scope must remain empty');
  if (instance.networkDomains.length) throw new Error('Git object inventory comparison network must remain disabled');
  if (!same(instance.dataClasses, REQUIRED_DATA_CLASSES) || !same(instance.sourceUses, REQUIRED_SOURCE_USES)) {
    throw new Error('Git object inventory comparison data class or source use must be exact');
  }
  if (!allFalseLifecycle(instance.lifecycle)) throw new Error('Git object inventory comparison lifecycle effects must remain false');
  if (!same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) {
    throw new Error('Git object inventory comparison evidence schemas must be exact');
  }
  if (instance.resources.maxAttempts !== 1 || instance.resources.maxProcesses !== 1 ||
    instance.resources.maxCostMinorUnits !== 0 || instance.resources.maxInputBytes > MAX_VERIFIER_INPUT_BYTES ||
    instance.resources.maxOutputBytes > MAX_RECEIPT_BYTES ||
    instance.resources.maxMemoryBytes > MAX_DECLARED_MEMORY_BYTES ||
    instance.resources.maxDurationMs > MAX_DECLARED_DURATION_MS) {
    throw new Error('Git object inventory comparison resource scope exceeds the fixed profile');
  }
  const normalized = { request, source, mirror, keys, sourceSigned, mirrorSigned, evaluation, authorization, policy, instance, artifacts };
  const verifierInputBytes = observedInputBytes(input, normalized);
  if (verifierInputBytes > instance.resources.maxInputBytes) {
    throw new Error('Git object inventory comparison inputs exceed the consented input byte budget');
  }
  return { ...normalized, verifierInputBytes };
}

function compareObjectSets(source, mirror) {
  const sourceByOid = new Map(source.objects.map((item) => [item.oid, item]));
  const mirrorByOid = new Map(mirror.objects.map((item) => [item.oid, item]));
  const added = mirror.objects.filter((item) => !sourceByOid.has(item.oid));
  const removed = source.objects.filter((item) => !mirrorByOid.has(item.oid));
  const metadataChanged = [];
  let unchangedObjectCount = 0;
  let unchangedDeclaredBytes = 0;
  for (const sourceObject of source.objects) {
    const mirrorObject = mirrorByOid.get(sourceObject.oid);
    if (!mirrorObject) continue;
    if (sourceObject.type === mirrorObject.type && sourceObject.size === mirrorObject.size) {
      unchangedObjectCount += 1;
      unchangedDeclaredBytes += sourceObject.size;
    } else {
      metadataChanged.push({
        oid: sourceObject.oid,
        sourceType: sourceObject.type,
        mirrorType: mirrorObject.type,
        sourceSize: sourceObject.size,
        mirrorSize: mirrorObject.size
      });
    }
  }
  const issues = [];
  if (added.length) issues.push('OBJECTS_ADDED');
  if (removed.length) issues.push('OBJECTS_REMOVED');
  if (metadataChanged.length) issues.push('OBJECT_METADATA_CONTRADICTION');
  return { added, removed, metadataChanged, unchangedObjectCount, unchangedDeclaredBytes, issues };
}

function inventorySummary(inventory, signed) {
  const attestationId = inventory.role.toLowerCase() + '-git-object-inventory-attestation';
  return {
    inventoryRef: inventoryArtifactRef(inventory),
    attestationRef: {
      id: attestationId,
      schema: signed.attestation.schema,
      sha256: sha256(signed.attestation),
      byteLength: jsonBytes(signed.attestation).length
    },
    observerRef: signed.observerRef,
    objectFormat: inventory.objectFormat,
    objectSetFingerprint: objectSetFingerprint(inventory),
    objectCount: inventory.objectCount,
    totalDeclaredObjectBytes: inventory.totalDeclaredObjectBytes,
    observedAt: inventory.observedAt,
    expiresAt: inventory.expiresAt,
    signatureVerified: true
  };
}

function receiptCore(prepared) {
  const delta = compareObjectSets(prepared.source, prepared.mirror);
  const match = !delta.added.length && !delta.removed.length && !delta.metadataChanged.length &&
    objectSetFingerprint(prepared.source) === objectSetFingerprint(prepared.mirror);
  return {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: match ? 'MATCH' : 'DRIFT',
    comparisonMeaning: 'Equality or drift inside two exact signed host-supplied Git object inventory observations only.',
    requestRef: requestRef(prepared.request),
    consentEvaluationRef: {
      id: prepared.request.id + '-consent-evaluation',
      schema: prepared.evaluation.schema,
      sha256: prepared.evaluation.evaluationDigest
    },
    instructionRef: prepared.authorization.instructionRef,
    comparatorProfileRef: profileRef(),
    subjectRef: prepared.source.subjectRef,
    source: inventorySummary(prepared.source, prepared.sourceSigned),
    mirror: inventorySummary(prepared.mirror, prepared.mirrorSigned),
    delta: {
      added: delta.added,
      removed: delta.removed,
      metadataChanged: delta.metadataChanged,
      unchangedObjectCount: delta.unchangedObjectCount,
      unchangedDeclaredBytes: delta.unchangedDeclaredBytes
    },
    issues: delta.issues,
    resourceObservation: {
      verifierInputBytes: prepared.verifierInputBytes,
      sourceInventoryRecords: prepared.source.objectCount,
      mirrorInventoryRecords: prepared.mirror.objectCount,
      deltaRecords: delta.added.length + delta.removed.length + delta.metadataChanged.length,
      writtenFiles: 0,
      inputByteCeilingEnforced: true,
      outputByteCeilingEnforced: true,
      recordCountEnforced: true,
      declaredObjectByteCeilingEnforced: true,
      attemptCountEnforced: false,
      durationEnforced: false,
      memoryEnforced: false
    },
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: {
      fabricFirstGateApplied: true,
      groundedConsentScopeVerified: true,
      interactiveDeclarationSupplied: true,
      interactiveDeclarationReplayPrevented: false,
      cryptographicHumanAuthenticationVerified: false,
      trustedClockObserved: false,
      liveRevocationChecked: false,
      sourceObservationSignatureVerified: true,
      mirrorObservationSignatureVerified: true,
      logicalSubjectMatched: true,
      objectFormatMatched: true,
      objectIdsCompared: true,
      declaredObjectMetadataCompared: true,
      objectSetEqualityWithinSignedObservationsProven: match,
      objectSetDriftWithinSignedObservationsObserved: !match,
      hostEnumerationCompletenessVerified: false,
      actualRepositoryObjectSetEqualityProven: false,
      GitRepositoryOpened: false,
      GitCommandExecuted: false,
      objectBytesRead: false,
      objectContentIntegrityRecomputed: false,
      networkUsed: false,
      childProcessSpawned: false,
      fileContentRetainedInReceipt: false,
      mirrorCodeCloneConnected: false,
      mirrorCodeCloneExecuted: false,
      sourceMutationPerformed: false,
      mirrorMutationPerformed: false,
      automaticMergePerformed: false,
      machineDefaultActivated: false,
      persistentLearningAdmitted: false,
      installed: false,
      published: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
}

function sealReceipt(core) {
  return { ...core, receiptDigest: sha256(core) };
}

function receiptWithStableByteLength(core) {
  let receiptBytes = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidateCore = {
      ...core,
      resourceObservation: { ...core.resourceObservation, receiptBytes }
    };
    const receipt = sealReceipt(candidateCore);
    const next = jsonBytes(receipt).length;
    if (next === receiptBytes) return { receipt, bytes: jsonBytes(receipt) };
    receiptBytes = next;
  }
  throw new Error('Git object inventory comparison receipt byte length did not stabilize');
}

function compareInventories(input) {
  const prepared = prepare(input);
  const sealed = receiptWithStableByteLength(receiptCore(prepared));
  if (sealed.bytes.length > prepared.instance.resources.maxOutputBytes) {
    throw new Error('Git object inventory comparison receipt exceeds the consented output byte budget');
  }
  return sealed.receipt;
}

function normalizeInventorySummary(value, label) {
  exactKeys(value, [
    'inventoryRef', 'attestationRef', 'observerRef', 'objectFormat', 'objectSetFingerprint', 'objectCount',
    'totalDeclaredObjectBytes', 'observedAt', 'expiresAt', 'signatureVerified'
  ], label);
  if (!['SHA1', 'SHA256'].includes(value.objectFormat)) throw new Error(label + '.objectFormat is invalid');
  if (value.signatureVerified !== true) throw new Error(label + '.signatureVerified must be true');
  return {
    inventoryRef: artifactReference(value.inventoryRef, label + '.inventoryRef'),
    attestationRef: artifactReference(value.attestationRef, label + '.attestationRef'),
    observerRef: reference(value.observerRef, label + '.observerRef'),
    objectFormat: value.objectFormat,
    objectSetFingerprint: digest(value.objectSetFingerprint, label + '.objectSetFingerprint'),
    objectCount: boundedInteger(value.objectCount, label + '.objectCount', 0, MAX_OBJECTS),
    totalDeclaredObjectBytes: boundedInteger(value.totalDeclaredObjectBytes, label + '.totalDeclaredObjectBytes', 0, MAX_DECLARED_OBJECT_BYTES),
    observedAt: timestamp(value.observedAt, label + '.observedAt'),
    expiresAt: timestamp(value.expiresAt, label + '.expiresAt'),
    signatureVerified: true
  };
}

function normalizeMetadataChange(value, objectFormat, label) {
  exactKeys(value, ['oid', 'sourceType', 'mirrorType', 'sourceSize', 'mirrorSize'], label);
  const source = normalizeObjectRecord(
    { oid: value.oid, type: value.sourceType, size: value.sourceSize },
    objectFormat,
    label + '.source'
  );
  const mirror = normalizeObjectRecord(
    { oid: value.oid, type: value.mirrorType, size: value.mirrorSize },
    objectFormat,
    label + '.mirror'
  );
  return {
    oid: source.oid,
    sourceType: source.type,
    mirrorType: mirror.type,
    sourceSize: source.size,
    mirrorSize: mirror.size
  };
}

function normalizeReceipt(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'comparisonMeaning', 'requestRef', 'consentEvaluationRef',
    'instructionRef', 'comparatorProfileRef', 'subjectRef', 'source', 'mirror', 'delta',
    'issues', 'resourceObservation', 'limitations', 'nextImprovementGaps', 'truth', 'authority',
    'receiptDigest'
  ], 'Git object inventory comparison receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION || !['MATCH', 'DRIFT'].includes(value.status)) {
    throw new Error('Git object inventory comparison receipt identity mismatch');
  }
  if (value.comparisonMeaning !== 'Equality or drift inside two exact signed host-supplied Git object inventory observations only.') {
    throw new Error('Git object inventory comparison receipt meaning drifted');
  }
  if (value.authority !== 'NONE' || !same(value.limitations, LIMITATIONS) || !same(value.nextImprovementGaps, NEXT_GAPS)) {
    throw new Error('Git object inventory comparison receipt authority, limitations, or gaps drifted');
  }
  const source = normalizeInventorySummary(value.source, 'receipt.source');
  const mirror = normalizeInventorySummary(value.mirror, 'receipt.mirror');
  if (source.objectFormat !== mirror.objectFormat) throw new Error('receipt object formats are incompatible');
  if (source.inventoryRef.schema !== INVENTORY_SCHEMA || mirror.inventoryRef.schema !== INVENTORY_SCHEMA ||
    source.attestationRef.schema !== Readiness.OBSERVATION_ATTESTATION_SCHEMA ||
    mirror.attestationRef.schema !== Readiness.OBSERVATION_ATTESTATION_SCHEMA ||
    source.observerRef.schema !== Readiness.TRUST_KEY_SCHEMA || mirror.observerRef.schema !== Readiness.TRUST_KEY_SCHEMA) {
    throw new Error('receipt signed inventory lineage schema mismatch');
  }
  exactKeys(value.delta, ['added', 'removed', 'metadataChanged', 'unchangedObjectCount', 'unchangedDeclaredBytes'], 'receipt.delta');
  for (const field of ['added', 'removed', 'metadataChanged']) {
    if (!Array.isArray(value.delta[field]) || value.delta[field].length > MAX_OBJECTS) {
      throw new Error('receipt.delta.' + field + ' must be a bounded array');
    }
  }
  const added = value.delta.added.map((item, index) => normalizeObjectRecord(item, source.objectFormat, 'receipt.delta.added[' + index + ']'));
  const removed = value.delta.removed.map((item, index) => normalizeObjectRecord(item, source.objectFormat, 'receipt.delta.removed[' + index + ']'));
  const metadataChanged = value.delta.metadataChanged.map((item, index) => normalizeMetadataChange(item, source.objectFormat, 'receipt.delta.metadataChanged[' + index + ']'));
  for (const records of [added, removed, metadataChanged]) {
    const ids = records.map((item) => item.oid);
    if (new Set(ids).size !== ids.length || !same(ids, ids.slice().sort(compareText))) {
      throw new Error('receipt delta object identifiers are duplicate or non-canonical');
    }
  }
  const allDeltaIds = [...added, ...removed, ...metadataChanged].map((item) => item.oid);
  if (new Set(allDeltaIds).size !== allDeltaIds.length) throw new Error('receipt object appears in multiple delta categories');
  const unchangedObjectCount = boundedInteger(value.delta.unchangedObjectCount, 'receipt.delta.unchangedObjectCount', 0, MAX_OBJECTS);
  const unchangedDeclaredBytes = boundedInteger(value.delta.unchangedDeclaredBytes, 'receipt.delta.unchangedDeclaredBytes', 0, MAX_DECLARED_OBJECT_BYTES);
  if (source.objectCount !== removed.length + metadataChanged.length + unchangedObjectCount ||
    mirror.objectCount !== added.length + metadataChanged.length + unchangedObjectCount ||
    source.totalDeclaredObjectBytes !== removed.reduce((sum, item) => sum + item.size, 0) +
      metadataChanged.reduce((sum, item) => sum + item.sourceSize, 0) + unchangedDeclaredBytes ||
    mirror.totalDeclaredObjectBytes !== added.reduce((sum, item) => sum + item.size, 0) +
      metadataChanged.reduce((sum, item) => sum + item.mirrorSize, 0) + unchangedDeclaredBytes) {
    throw new Error('receipt inventory summaries contradict the object delta');
  }
  const delta = { added, removed, metadataChanged, unchangedObjectCount, unchangedDeclaredBytes };
  if (!Array.isArray(value.issues) || value.issues.some((item) => !ISSUES.includes(item)) ||
    new Set(value.issues).size !== value.issues.length || !same(value.issues, value.issues.slice().sort(compareText))) {
    throw new Error('receipt issues are invalid or non-canonical');
  }
  const expectedIssues = [];
  if (added.length) expectedIssues.push('OBJECTS_ADDED');
  if (removed.length) expectedIssues.push('OBJECTS_REMOVED');
  if (metadataChanged.length) expectedIssues.push('OBJECT_METADATA_CONTRADICTION');
  if (!same(value.issues, expectedIssues.sort(compareText))) throw new Error('receipt issues contradict object delta');
  const evidenceMatch = !added.length && !removed.length && !metadataChanged.length &&
    source.objectSetFingerprint === mirror.objectSetFingerprint;
  if ((value.status === 'MATCH') !== evidenceMatch) throw new Error('receipt status contradicts signed observation evidence');
  exactKeys(value.resourceObservation, [
    'verifierInputBytes', 'sourceInventoryRecords', 'mirrorInventoryRecords', 'deltaRecords',
    'writtenFiles', 'inputByteCeilingEnforced', 'outputByteCeilingEnforced', 'recordCountEnforced',
    'declaredObjectByteCeilingEnforced', 'attemptCountEnforced', 'durationEnforced', 'memoryEnforced',
    'receiptBytes'
  ], 'receipt.resourceObservation');
  const resources = {
    verifierInputBytes: boundedInteger(value.resourceObservation.verifierInputBytes, 'receipt verifier input bytes', 1, MAX_VERIFIER_INPUT_BYTES),
    sourceInventoryRecords: source.objectCount,
    mirrorInventoryRecords: mirror.objectCount,
    deltaRecords: added.length + removed.length + metadataChanged.length,
    writtenFiles: 0,
    inputByteCeilingEnforced: true,
    outputByteCeilingEnforced: true,
    recordCountEnforced: true,
    declaredObjectByteCeilingEnforced: true,
    attemptCountEnforced: false,
    durationEnforced: false,
    memoryEnforced: false,
    receiptBytes: boundedInteger(value.resourceObservation.receiptBytes, 'receipt bytes', 1, MAX_RECEIPT_BYTES)
  };
  if (!same(resources, value.resourceObservation)) throw new Error('receipt resource observation mismatch');
  const truthFields = [
    'fabricFirstGateApplied', 'groundedConsentScopeVerified', 'interactiveDeclarationSupplied',
    'interactiveDeclarationReplayPrevented', 'cryptographicHumanAuthenticationVerified', 'trustedClockObserved',
    'liveRevocationChecked',
    'sourceObservationSignatureVerified', 'mirrorObservationSignatureVerified', 'logicalSubjectMatched',
    'objectFormatMatched', 'objectIdsCompared', 'declaredObjectMetadataCompared',
    'objectSetEqualityWithinSignedObservationsProven', 'objectSetDriftWithinSignedObservationsObserved',
    'hostEnumerationCompletenessVerified', 'actualRepositoryObjectSetEqualityProven', 'GitRepositoryOpened',
    'GitCommandExecuted', 'objectBytesRead', 'objectContentIntegrityRecomputed', 'networkUsed',
    'childProcessSpawned', 'fileContentRetainedInReceipt', 'mirrorCodeCloneConnected',
    'mirrorCodeCloneExecuted', 'sourceMutationPerformed', 'mirrorMutationPerformed',
    'automaticMergePerformed', 'machineDefaultActivated', 'persistentLearningAdmitted', 'installed',
    'published', 'promoted', 'canonChanged'
  ];
  exactKeys(value.truth, truthFields, 'receipt.truth');
  const expectedTrue = new Set([
    'fabricFirstGateApplied', 'groundedConsentScopeVerified', 'interactiveDeclarationSupplied',
    'sourceObservationSignatureVerified', 'mirrorObservationSignatureVerified', 'logicalSubjectMatched',
    'objectFormatMatched', 'objectIdsCompared', 'declaredObjectMetadataCompared'
  ]);
  expectedTrue.add(value.status === 'MATCH' ? 'objectSetEqualityWithinSignedObservationsProven' : 'objectSetDriftWithinSignedObservationsObserved');
  for (const field of truthFields) {
    if (value.truth[field] !== expectedTrue.has(field)) throw new Error('receipt.truth.' + field + ' violates the truth ceiling');
  }
  const core = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: value.status,
    comparisonMeaning: value.comparisonMeaning,
    requestRef: reference(value.requestRef, 'receipt.requestRef'),
    consentEvaluationRef: reference(value.consentEvaluationRef, 'receipt.consentEvaluationRef'),
    instructionRef: reference(value.instructionRef, 'receipt.instructionRef'),
    comparatorProfileRef: reference(value.comparatorProfileRef, 'receipt.comparatorProfileRef'),
    subjectRef: normalizeSubjectRef(value.subjectRef, 'receipt.subjectRef'),
    source,
    mirror,
    delta,
    issues: value.issues.slice(),
    resourceObservation: resources,
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: clone(value.truth),
    authority: 'NONE'
  };
  if (core.requestRef.schema !== REQUEST_SCHEMA || core.consentEvaluationRef.schema !== Consent.EVALUATION_SCHEMA ||
    !same(core.instructionRef, declarationRef()) || !same(core.comparatorProfileRef, profileRef()) ||
    core.consentEvaluationRef.id !== core.requestRef.id + '-consent-evaluation' ||
    !same(core.subjectRef, value.subjectRef)) {
    throw new Error('receipt reference lineage mismatch');
  }
  const receiptDigest = digest(value.receiptDigest, 'receipt.receiptDigest');
  if (sha256(core) !== receiptDigest) throw new Error('receipt digest mismatch');
  const normalized = { ...core, receiptDigest };
  if (!same(normalized, value)) throw new Error('receipt is not canonical');
  if (jsonBytes(normalized).length !== resources.receiptBytes) throw new Error('receipt byte observation mismatch');
  return normalized;
}

function verifyReceipt(value, input) {
  const normalized = normalizeReceipt(value);
  const rebuilt = compareInventories(input);
  if (!same(normalized, rebuilt)) throw new Error('receipt differs from deterministic rebuild');
  return normalized;
}

function buildExampleInput(sourceInventory, mirrorInventory, observerKeys, sourceAttestation, mirrorAttestation) {
  const source = normalizeInventory(sourceInventory);
  const mirror = normalizeInventory(mirrorInventory);
  const request = buildRequest(source, mirror, observerKeys);
  const artifacts = [inventoryArtifactRef(source), inventoryArtifactRef(mirror)]
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'git-object-inventory-comparison-test-settings',
    validFrom: '2026-08-22T18:00:00.000Z',
    expiresAt: '2026-08-22T20:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [REQUEST_SCHEMA],
      domainProfileSchemas: [PROFILE_SCHEMA],
      allowedActions: REQUIRED_ACTIONS.slice(),
      allowedPermissions: REQUIRED_PERMISSIONS.slice(),
      allowedNetworkDomains: [],
      allowedDataClasses: REQUIRED_DATA_CLASSES.slice(),
      allowedSourceUses: REQUIRED_SOURCE_USES.slice(),
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: {
        maxInputBytes: MAX_VERIFIER_INPUT_BYTES,
        maxOutputBytes: MAX_RECEIPT_BYTES,
        maxMemoryBytes: MAX_DECLARED_MEMORY_BYTES,
        maxDurationMs: MAX_DECLARED_DURATION_MS,
        maxProcesses: 1,
        maxAttempts: 1,
        maxCostMinorUnits: 0
      },
      requiredPredecisionEvidenceSchemas: ['axm.code-policy-bound-assurance-review/v1'],
      requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice()
    }],
    rootsGate: Consent.ROOTS_GATE.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE'
  });
  const instance = Consent.sealInstance({
    schema: Consent.INSTANCE_SCHEMA,
    id: 'git-object-inventory-comparison-test-instance',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: requestRef(request),
    domainProfileRef: profileRef(),
    predecisionEvidenceRefs: [{
      id: 'four-root-git-object-inventory-comparison-policy-review',
      schema: 'axm.code-policy-bound-assurance-review/v1',
      sha256: sha256('git-object-inventory-comparison-predecision-review-placeholder')
    }],
    inputArtifacts: artifacts,
    actions: REQUIRED_ACTIONS.slice(),
    permissions: [],
    networkDomains: [],
    dataClasses: REQUIRED_DATA_CLASSES.slice(),
    sourceUses: REQUIRED_SOURCE_USES.slice(),
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources: {
      maxInputBytes: MAX_VERIFIER_INPUT_BYTES,
      maxOutputBytes: MAX_RECEIPT_BYTES,
      maxMemoryBytes: MAX_DECLARED_MEMORY_BYTES,
      maxDurationMs: MAX_DECLARED_DURATION_MS,
      maxProcesses: 1,
      maxAttempts: 1,
      maxCostMinorUnits: 0
    },
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T18:05:00.000Z',
    expiresAt: '2026-08-22T19:05:00.000Z',
    authority: 'NONE'
  });
  const consentEvaluationInput = { policy, instance, evaluatedAt: '2026-08-22T18:15:00.000Z' };
  return {
    request,
    sourceInventory: source,
    mirrorInventory: mirror,
    observerKeys,
    sourceAttestation,
    mirrorAttestation,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput),
    authorization: {
      mode: 'INTERACTIVE_SESSION_DECLARATION',
      scope: 'ONE_SOURCE_AND_ONE_MIRROR_SIGNED_GIT_OBJECT_INVENTORY',
      acknowledgement: ACKNOWLEDGEMENT,
      instructionRef: declarationRef()
    }
  };
}

module.exports = {
  VERSION,
  INVENTORY_SCHEMA,
  SUBJECT_SCHEMA,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  PROFILE_SCHEMA,
  ACKNOWLEDGEMENT,
  DECLARATION_SCHEMA,
  DECLARATION_ID,
  ENUMERATION_CLAIM,
  MAX_OBJECTS,
  MAX_DECLARED_OBJECT_BYTES,
  MAX_INVENTORY_WINDOW_MS,
  MAX_OBSERVATION_SKEW_MS,
  MAX_VERIFIER_INPUT_BYTES,
  MAX_RECEIPT_BYTES,
  MAX_DECLARED_MEMORY_BYTES,
  MAX_DECLARED_DURATION_MS,
  REQUIRED_ACTIONS,
  REQUIRED_PERMISSIONS,
  REQUIRED_DATA_CLASSES,
  REQUIRED_SOURCE_USES,
  REQUIRED_EVIDENCE_SCHEMAS,
  OBJECT_TYPES,
  ISSUES,
  LIMITATIONS,
  NEXT_GAPS,
  PROFILE,
  canonicalJson,
  sha256,
  jsonBytes,
  profileRef,
  declarationRef,
  normalizeObjectRecord,
  sealInventory,
  normalizeInventory,
  inventoryRef,
  inventoryArtifactRef,
  objectSetFingerprint,
  sealRequest,
  normalizeRequest,
  requestRef,
  buildRequest,
  prepare,
  compareObjectSets,
  compareInventories,
  normalizeReceipt,
  verifyReceipt,
  buildExampleInput
};
