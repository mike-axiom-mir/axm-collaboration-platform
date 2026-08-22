'use strict';

const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Compiler = require('./blueprint-schema-compiler-v1');
const Lineage = require('../../tools/module-lineage-comparator/core/lineage-core');

const VERSION = '0.1.0';
const REQUEST_SCHEMA = 'axm.fabric-schema-packet-mirror-verification-request/v1';
const RECEIPT_SCHEMA = 'axm.fabric-schema-packet-mirror-verification-receipt/v1';
const PROFILE_SCHEMA = 'axm.fabric-schema-packet-mirror-verifier-profile/v1';
const PACKET_SCHEMA = 'axm.fabric-schema-packet-byte-set/v1';
const ACKNOWLEDGEMENT = 'COMPARE ONE SOURCE AND ONE MIRROR PACKET ONLY';
const DECLARATION_ID = 'interactive-schema-packet-mirror-verification-declaration';
const DECLARATION_SCHEMA = 'axm.interactive-pilot-declaration/v1';
const MAX_FILES_PER_PACKET = 8;
const MAX_FILE_BYTES = 65536;
const MAX_PACKET_BYTES = 131072;
const MAX_VERIFIER_INPUT_BYTES = 262144;
const MAX_RECEIPT_BYTES = 32768;
const EXPECTED_FILES = Object.freeze([
  Compiler.INPUT_SCHEMA_FILE,
  Compiler.MATRIX_FILE,
  Compiler.OUTPUT_SCHEMA_FILE,
  Compiler.RECEIPT_FILE
].sort());
const REQUIRED_ACTIONS = Object.freeze(['code.verify-schema-packet-mirror']);
const REQUIRED_PERMISSIONS = Object.freeze([]);
const REQUIRED_DATA_CLASSES = Object.freeze(['public-generated-artifact']);
const REQUIRED_SOURCE_USES = Object.freeze(['compare-artifact-lineage']);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([
  Compiler.RECEIPT_SCHEMA,
  RECEIPT_SCHEMA
].sort());
const PACKET_ISSUES = Object.freeze([
  'COMPILATION_ARTIFACT_VERIFICATION_FAILED',
  'EXPECTED_FILE_MISSING',
  'RECEIPT_JSON_INVALID',
  'RECEIPT_OBJECT_INVALID',
  'RECEIPT_BYTES_NOT_DETERMINISTIC',
  'UNEXPECTED_FILE_PRESENT'
]);
const LIMITATIONS = Object.freeze([
  'INTERACTIVE_DECLARATION_NOT_CRYPTOGRAPHIC_IDENTITY_PROOF',
  'INTERACTIVE_DECLARATION_REPLAY_NOT_PREVENTED',
  'PREDECISION_EVIDENCE_CONTENT_NOT_VERIFIED_BY_MIRROR_VERIFIER',
  'DECLARED_PUBLIC_DATA_CLASS_CONTENT_NOT_VERIFIED',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'EXACT_SCHEMA_PACKET_BYTES_ONLY',
  'GIT_OBJECT_DATABASE_NOT_INSPECTED',
  'GIT_REFS_NOT_INSPECTED',
  'GIT_REMOTE_NOT_CONTACTED',
  'TRANSPORT_DELIVERY_NOT_PROVEN',
  'FULL_CLONE_COMPLETENESS_NOT_PROVEN',
  'SEMANTIC_EQUIVALENCE_NOT_INFERRED',
  'MIRROR_CODE_CLONE_NOT_CONNECTED_OR_EXECUTED',
  'PACKET_PATH_PRIVACY_NOT_INDEPENDENTLY_VERIFIED',
  'FILESYSTEM_CANONICALIZATION_NOT_OBSERVED',
  'WINDOWS_SHORT_NAME_ALIASES_NOT_RESOLVED',
  'CROSS_INVOCATION_ATTEMPT_LIMIT_NOT_ENFORCED',
  'DURATION_AND_MEMORY_NOT_ENFORCED',
  'MACHINE_HOST_DEFAULT_NOT_ACTIVATED',
  'PERSISTENT_LEARNING_NOT_ADMITTED'
]);
const NEXT_GAPS = Object.freeze([
  'mirror.git-object-set.compare',
  'mirror.git-ref-set.compare',
  'mirror.transport.sender-receipt.verify',
  'mirror.transport.receiver-receipt.verify',
  'mirror.clone-completeness.verify',
  'mirror.recovery.replay-test',
  'consent.human-decision.authenticate',
  'consent.declaration.replay-prevent',
  'consent.revocation.observe-live',
  'consent.trusted-clock.observe'
]);
const PROFILE = Object.freeze({
  schema: PROFILE_SCHEMA,
  id: 'deterministic-schema-packet-mirror-verifier',
  version: VERSION,
  kind: 'PURE_DATA_COMPARISON',
  maximumFilesPerPacket: MAX_FILES_PER_PACKET,
  maximumFileBytes: MAX_FILE_BYTES,
  maximumPacketBytes: MAX_PACKET_BYTES,
  maximumVerifierInputBytes: MAX_VERIFIER_INPUT_BYTES,
  maximumReceiptBytes: MAX_RECEIPT_BYTES,
  filesystemReads: 'DISABLED_HOST_SUPPLIES_BYTES',
  filesystemWrites: 'DISABLED',
  gitCommands: 'DISABLED',
  network: 'DISABLED',
  childProcesses: 'DISABLED',
  packetExecution: 'DISABLED',
  authority: 'NONE'
});
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REQUEST_ID = /^[a-z0-9][a-z0-9-]{1,99}$/;
const EXECUTABLE_LIKE = /\.(?:bat|cjs|cmd|com|dll|exe|jar|js|mjs|msi|ps1|py|sh|wasm)$/i;
const WINDOWS_INVALID_SEGMENT_CHARS = /[<>:"|?*]/;
const WINDOWS_DEVICE_BASENAME = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i;

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

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
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

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) {
    throw new Error(label + ' must be a lowercase SHA-256 digest');
  }
  return value;
}

function boundedInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function boundedText(value, label, maximum = 240) {
  if (typeof value !== 'string' || !value.length || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(label + ' must be bounded canonical text');
  }
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: boundedText(value.id, label + '.id', 180),
    schema: boundedText(value.schema, label + '.schema', 220),
    sha256: digest(value.sha256, label + '.sha256')
  };
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
    scope: 'ONE_SOURCE_AND_ONE_MIRROR_SCHEMA_PACKET'
  };
  return { id: core.id, schema: core.schema, sha256: sha256(core) };
}

function safePacketPath(value) {
  if (typeof value !== 'string') throw new Error('packet path must be a string');
  const relativePath = Lineage.safeRelative(value);
  if (relativePath !== value || relativePath === '.' || value.normalize('NFC') !== value) {
    throw new Error('packet path must be a canonical NFC relative path: ' + value);
  }
  const segments = value.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' ||
      WINDOWS_INVALID_SEGMENT_CHARS.test(segment) || /[. ]$/.test(segment) ||
      Buffer.byteLength(segment, 'utf8') > 255) {
      throw new Error('packet path has a non-portable segment: ' + value);
    }
    const deviceBasename = segment.split('.')[0];
    if (WINDOWS_DEVICE_BASENAME.test(deviceBasename)) {
      throw new Error('packet path uses a reserved Windows device name: ' + value);
    }
  }
  return relativePath;
}

function decodePacket(value, expectedRole) {
  exactKeys(value, ['role', 'files'], expectedRole.toLowerCase() + ' packet');
  if (value.role !== expectedRole) throw new Error('packet role must be exactly ' + expectedRole);
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > MAX_FILES_PER_PACKET) {
    throw new Error('packet files must contain from 1 to ' + MAX_FILES_PER_PACKET + ' records');
  }
  const seen = new Set();
  let totalBytes = 0;
  const files = value.files.map((item, index) => {
    exactKeys(item, ['path', 'bytes'], expectedRole.toLowerCase() + ' packet.files[' + index + ']');
    const relativePath = safePacketPath(item.path);
    const collision = relativePath.toLowerCase();
    if (seen.has(collision)) throw new Error('packet contains a case-insensitive duplicate path: ' + relativePath);
    seen.add(collision);
    if (!Buffer.isBuffer(item.bytes)) throw new Error('packet file bytes must be a Buffer: ' + relativePath);
    if (!item.bytes.length || item.bytes.length > MAX_FILE_BYTES) {
      throw new Error('packet file byte length is outside the fixed profile: ' + relativePath);
    }
    totalBytes += item.bytes.length;
    if (totalBytes > MAX_PACKET_BYTES) throw new Error('packet total bytes exceed the fixed profile');
    return {
      path: relativePath,
      bytes: item.bytes,
      sha256: sha256(item.bytes),
      byteLength: item.bytes.length
    };
  }).sort((left, right) => compareText(left.path, right.path));
  const digestRows = files.map((file) => ({ path: file.path, sha256: file.sha256, byteLength: file.byteLength }));
  return {
    role: expectedRole,
    files,
    filesByPath: new Map(files.map((file) => [file.path, file])),
    fileCount: files.length,
    totalBytes,
    packetDigest: sha256(digestRows)
  };
}

function packetRef(decoded, requestId, role) {
  return {
    id: requestId + '-' + role.toLowerCase() + '-packet',
    schema: PACKET_SCHEMA,
    sha256: decoded.packetDigest
  };
}

function packetArtifactRef(decoded, requestId, role) {
  return { ...packetRef(decoded, requestId, role), byteLength: decoded.totalBytes };
}

function normalizeRequestCore(value) {
  exactKeys(value, [
    'schema', 'id', 'status', 'comparisonScope', 'sourcePacketRef', 'mirrorPacketRef',
    'rootsGate', 'authority'
  ], 'schema packet mirror verification request');
  if (value.schema !== REQUEST_SCHEMA) throw new Error('mirror verification request schema mismatch');
  if (typeof value.id !== 'string' || !REQUEST_ID.test(value.id)) throw new Error('mirror verification request id is invalid');
  if (value.status !== 'TEST') throw new Error('mirror verification request status must remain TEST');
  if (value.comparisonScope !== 'EXACT_FOUR_FILE_SCHEMA_PACKET_BYTES') {
    throw new Error('mirror verification request comparison scope mismatch');
  }
  if (!same(value.rootsGate, Consent.ROOTS_GATE)) throw new Error('mirror verification request must preserve all four roots in order');
  if (value.authority !== 'NONE') throw new Error('mirror verification request authority must remain NONE');
  const core = {
    schema: REQUEST_SCHEMA,
    id: value.id,
    status: 'TEST',
    comparisonScope: 'EXACT_FOUR_FILE_SCHEMA_PACKET_BYTES',
    sourcePacketRef: reference(value.sourcePacketRef, 'request.sourcePacketRef'),
    mirrorPacketRef: reference(value.mirrorPacketRef, 'request.mirrorPacketRef'),
    rootsGate: Consent.ROOTS_GATE.slice(),
    authority: 'NONE'
  };
  if (core.sourcePacketRef.schema !== PACKET_SCHEMA || core.mirrorPacketRef.schema !== PACKET_SCHEMA ||
    core.sourcePacketRef.id !== core.id + '-source-packet' ||
    core.mirrorPacketRef.id !== core.id + '-mirror-packet') {
    throw new Error('mirror verification request packet reference lineage mismatch');
  }
  return core;
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  return { ...core, requestDigest: sha256(core) };
}

function normalizeRequest(value) {
  exactKeys(value, [
    'schema', 'id', 'status', 'comparisonScope', 'sourcePacketRef', 'mirrorPacketRef',
    'rootsGate', 'authority', 'requestDigest'
  ], 'schema packet mirror verification request');
  const { requestDigest, ...coreValue } = value;
  const sealed = sealRequest(coreValue);
  if (sealed.requestDigest !== digest(requestDigest, 'mirror verification request.requestDigest')) {
    throw new Error('mirror verification request digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('mirror verification request is not canonical');
  return sealed;
}

function requestRef(requestValue) {
  const request = normalizeRequest(requestValue);
  return { id: request.id, schema: request.schema, sha256: request.requestDigest };
}

function normalizeAuthorization(value) {
  exactKeys(value, ['mode', 'scope', 'acknowledgement', 'instructionRef'], 'mirror verification authorization');
  const normalized = {
    mode: value.mode,
    scope: value.scope,
    acknowledgement: value.acknowledgement,
    instructionRef: reference(value.instructionRef, 'mirror verification authorization.instructionRef')
  };
  if (normalized.mode !== 'INTERACTIVE_SESSION_DECLARATION' ||
    normalized.scope !== 'ONE_SOURCE_AND_ONE_MIRROR_SCHEMA_PACKET' ||
    normalized.acknowledgement !== ACKNOWLEDGEMENT ||
    !same(normalized.instructionRef, declarationRef())) {
    throw new Error('mirror verification authorization does not bind the exact comparison declaration');
  }
  return normalized;
}

function allFalseLifecycle(value) {
  return Consent.LIFECYCLE_FIELDS.every((field) => value[field] === false);
}

function packetAssessment(decoded, compilerInput, expectedPacket) {
  const actualPaths = decoded.files.map((file) => file.path);
  const missing = EXPECTED_FILES.filter((file) => !decoded.filesByPath.has(file));
  const extra = actualPaths.filter((file) => !EXPECTED_FILES.includes(file));
  const issues = [];
  if (missing.length) issues.push('EXPECTED_FILE_MISSING');
  if (extra.length) issues.push('UNEXPECTED_FILE_PRESENT');
  let receipt = null;
  let receiptObjectValid = false;
  let embeddedCompilationVerified = false;
  let deterministicReceiptBytes = false;
  const receiptFile = decoded.filesByPath.get(Compiler.RECEIPT_FILE);
  if (receiptFile) {
    try {
      receipt = JSON.parse(receiptFile.bytes.toString('utf8'));
    } catch (error) {
      issues.push('RECEIPT_JSON_INVALID');
    }
    if (receipt) {
      try {
        Compiler.normalizeReceipt(receipt);
        receiptObjectValid = true;
      } catch (error) {
        issues.push('RECEIPT_OBJECT_INVALID');
      }
    }
  }
  if (!missing.length && receiptObjectValid) {
    try {
      Compiler.verifyCompilationArtifacts(receipt, {
        [Compiler.INPUT_SCHEMA_FILE]: decoded.filesByPath.get(Compiler.INPUT_SCHEMA_FILE).bytes,
        [Compiler.OUTPUT_SCHEMA_FILE]: decoded.filesByPath.get(Compiler.OUTPUT_SCHEMA_FILE).bytes,
        [Compiler.MATRIX_FILE]: decoded.filesByPath.get(Compiler.MATRIX_FILE).bytes
      }, compilerInput);
      embeddedCompilationVerified = true;
    } catch (error) {
      issues.push('COMPILATION_ARTIFACT_VERIFICATION_FAILED');
    }
    deterministicReceiptBytes = receiptFile.bytes.equals(expectedPacket.receiptBytes);
    if (!deterministicReceiptBytes) issues.push('RECEIPT_BYTES_NOT_DETERMINISTIC');
  }
  const normalizedIssues = Array.from(new Set(issues)).sort(compareText);
  return {
    missing,
    extra,
    issues: normalizedIssues,
    receipt,
    receiptObjectValid,
    embeddedCompilationVerified,
    deterministicReceiptBytes,
    exactCompilationPacketVerified: normalizedIssues.length === 0 &&
      embeddedCompilationVerified && deterministicReceiptBytes && same(actualPaths, EXPECTED_FILES)
  };
}

function observedInputBytes(input, request, source, mirror) {
  const metadata = {
    request,
    compilerIntent: input.compilerInput.intent,
    compilerConsentEvaluationInput: input.compilerInput.consentEvaluationInput,
    compilerConsentEvaluation: input.compilerInput.consentEvaluation,
    compilerAuthorization: input.compilerInput.authorization,
    consentEvaluationInput: input.consentEvaluationInput,
    consentEvaluation: input.consentEvaluation,
    authorization: input.authorization,
    sourceRows: source.files.map((file) => ({ path: file.path, sha256: file.sha256, byteLength: file.byteLength })),
    mirrorRows: mirror.files.map((file) => ({ path: file.path, sha256: file.sha256, byteLength: file.byteLength }))
  };
  return source.totalBytes + mirror.totalBytes + input.compilerInput.blueprintBytes.length +
    input.compilerInput.compositionReceiptBytes.length + Buffer.byteLength(canonicalJson(metadata), 'utf8');
}

function prepare(input) {
  exactKeys(input, [
    'request', 'sourcePacket', 'mirrorPacket', 'compilerInput',
    'consentEvaluationInput', 'consentEvaluation', 'authorization'
  ], 'schema packet mirror verification input');
  const source = decodePacket(input.sourcePacket, 'SOURCE');
  const mirror = decodePacket(input.mirrorPacket, 'MIRROR');
  const request = normalizeRequest(input.request);
  if (!same(request.sourcePacketRef, packetRef(source, request.id, 'SOURCE')) ||
    !same(request.mirrorPacketRef, packetRef(mirror, request.id, 'MIRROR'))) {
    throw new Error('mirror verification request does not bind the exact packet bytes');
  }
  const expectedPacket = Compiler.expectedPacket(input.compilerInput);
  const sourceAssessment = packetAssessment(source, input.compilerInput, expectedPacket);
  if (!sourceAssessment.exactCompilationPacketVerified) {
    throw new Error('source packet is not an exact verified Fabric schema packet: ' + sourceAssessment.issues.join(','));
  }
  const mirrorAssessment = packetAssessment(mirror, input.compilerInput, expectedPacket);
  const authorization = normalizeAuthorization(input.authorization);
  const evaluation = Consent.normalizeEvaluation(input.consentEvaluation);
  const evaluationCheck = Consent.verifyEvaluation(evaluation, input.consentEvaluationInput);
  if (!evaluationCheck.pass) {
    throw new Error('grounded consent evaluation verification failed: ' + evaluationCheck.errors.join('|'));
  }
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    throw new Error('grounded consent scope must be hold-free before mirror comparison declaration');
  }
  const policy = Consent.normalizePolicy(input.consentEvaluationInput.policy);
  const instance = Consent.normalizeInstance(input.consentEvaluationInput.instance);
  const artifacts = [
    packetArtifactRef(source, request.id, 'SOURCE'),
    packetArtifactRef(mirror, request.id, 'MIRROR')
  ].sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (instance.domain !== 'code') throw new Error('mirror verification consent domain must be code');
  if (!same(instance.subjectRef, requestRef(request))) throw new Error('grounded consent subject does not bind the exact mirror request');
  if (!same(instance.domainProfileRef, profileRef())) throw new Error('grounded consent domain profile does not bind the mirror verifier');
  if (!same(instance.inputArtifacts, artifacts)) throw new Error('grounded consent input artifacts do not bind both exact packets');
  if (!same(instance.actions, REQUIRED_ACTIONS)) throw new Error('mirror verifier action scope must be exact');
  if (!same(instance.permissions, REQUIRED_PERMISSIONS)) throw new Error('mirror verifier permission scope must remain empty');
  if (instance.networkDomains.length) throw new Error('mirror verifier network must remain disabled');
  if (!same(instance.dataClasses, REQUIRED_DATA_CLASSES)) throw new Error('mirror verifier data class must be exact');
  if (!same(instance.sourceUses, REQUIRED_SOURCE_USES)) throw new Error('mirror verifier source use must be exact');
  if (!allFalseLifecycle(instance.lifecycle)) throw new Error('mirror verifier lifecycle effects must remain false');
  if (!same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) throw new Error('mirror verifier evidence schemas must be exact');
  if (instance.resources.maxAttempts !== 1 || instance.resources.maxProcesses !== 1 ||
    instance.resources.maxCostMinorUnits !== 0 ||
    instance.resources.maxInputBytes > MAX_VERIFIER_INPUT_BYTES ||
    instance.resources.maxOutputBytes > MAX_RECEIPT_BYTES) {
    throw new Error('mirror verifier resource scope exceeds the fixed profile');
  }
  const verifierInputBytes = observedInputBytes(input, request, source, mirror);
  if (verifierInputBytes > instance.resources.maxInputBytes) {
    throw new Error('mirror verifier inputs exceed the consented input byte budget');
  }
  return {
    request,
    source,
    mirror,
    sourceAssessment,
    mirrorAssessment,
    expectedPacket,
    artifacts,
    policy,
    instance,
    evaluation,
    authorization,
    verifierInputBytes
  };
}

function fileRecord(file) {
  return { path: file.path, sha256: file.sha256, byteLength: file.byteLength };
}

function fileDelta(source, mirror) {
  const sourcePaths = new Set(source.files.map((file) => file.path));
  const mirrorPaths = new Set(mirror.files.map((file) => file.path));
  const added = mirror.files.filter((file) => !sourcePaths.has(file.path)).map(fileRecord);
  const removed = source.files.filter((file) => !mirrorPaths.has(file.path)).map(fileRecord);
  const changed = [];
  const unchanged = [];
  for (const sourceFile of source.files) {
    const mirrorFile = mirror.filesByPath.get(sourceFile.path);
    if (!mirrorFile) continue;
    if (sourceFile.bytes.equals(mirrorFile.bytes)) {
      unchanged.push(fileRecord(sourceFile));
    } else {
      changed.push({
        path: sourceFile.path,
        sourceSha256: sourceFile.sha256,
        mirrorSha256: mirrorFile.sha256,
        sourceByteLength: sourceFile.byteLength,
        mirrorByteLength: mirrorFile.byteLength
      });
    }
  }
  return { added, removed, changed, unchanged };
}

function packetSummary(decoded, assessment, requestId, role) {
  return {
    packetRef: packetRef(decoded, requestId, role),
    fileCount: decoded.fileCount,
    totalBytes: decoded.totalBytes,
    embeddedCompilationVerified: assessment.embeddedCompilationVerified,
    deterministicReceiptBytes: assessment.deterministicReceiptBytes,
    exactCompilationPacketVerified: assessment.exactCompilationPacketVerified,
    issues: assessment.issues.slice()
  };
}

function evaluationRef(evaluation, request) {
  return {
    id: request.id + '-consent-evaluation',
    schema: evaluation.schema,
    sha256: evaluation.evaluationDigest
  };
}

function compilerReceiptRef(prepared) {
  const receipt = prepared.expectedPacket.receipt;
  return {
    id: receipt.blueprintRef.id + '-schema-compilation-receipt',
    schema: receipt.schema,
    sha256: receipt.receiptDigest
  };
}

function receiptCore(prepared) {
  const delta = fileDelta(prepared.source, prepared.mirror);
  const match = prepared.source.packetDigest === prepared.mirror.packetDigest &&
    prepared.mirrorAssessment.exactCompilationPacketVerified &&
    !delta.added.length && !delta.removed.length && !delta.changed.length;
  const executableLikePaths = prepared.mirror.files
    .map((file) => file.path)
    .filter((file) => EXECUTABLE_LIKE.test(file));
  return {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: match ? 'MATCH' : 'DRIFT',
    comparisonMeaning: 'Exact schema-packet byte equality only; source and mirror are directional labels, not trust or precedence.',
    requestRef: requestRef(prepared.request),
    consentEvaluationRef: evaluationRef(prepared.evaluation, prepared.request),
    instructionRef: prepared.authorization.instructionRef,
    verifierProfileRef: profileRef(),
    compilerReceiptRef: compilerReceiptRef(prepared),
    source: packetSummary(prepared.source, prepared.sourceAssessment, prepared.request.id, 'SOURCE'),
    mirror: packetSummary(prepared.mirror, prepared.mirrorAssessment, prepared.request.id, 'MIRROR'),
    fileDelta: delta,
    executableLikePathsPresent: executableLikePaths,
    resourceObservation: {
      verifierInputBytes: prepared.verifierInputBytes,
      sourcePacketBytes: prepared.source.totalBytes,
      mirrorPacketBytes: prepared.mirror.totalBytes,
      writtenFiles: 0,
      inputByteCeilingEnforced: true,
      outputByteCeilingEnforced: true,
      fileCountEnforced: true,
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
      sourceExactCompilationPacketVerified: true,
      mirrorExactCompilationPacketVerified: match,
      exactPacketByteEqualityProven: match,
      mirrorDriftObserved: !match,
      filePathsCompared: true,
      fileBytesCompared: true,
      fileContentRetainedInReceipt: false,
      gitObjectDatabaseInspected: false,
      gitRefsInspected: false,
      gitRemoteContacted: false,
      transportDeliveryProven: false,
      fullCloneCompletenessProven: false,
      semanticEquivalenceInferred: false,
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
    const withResources = {
      ...core,
      resourceObservation: { ...core.resourceObservation, receiptBytes }
    };
    const receipt = sealReceipt(withResources);
    const bytes = jsonBytes(receipt);
    if (bytes.length === receiptBytes) return { receipt, bytes };
    receiptBytes = bytes.length;
  }
  throw new Error('mirror verification receipt byte length did not stabilize');
}

function comparePackets(input) {
  const prepared = prepare(input);
  const sealed = receiptWithStableByteLength(receiptCore(prepared));
  if (sealed.bytes.length > prepared.instance.resources.maxOutputBytes) {
    throw new Error('mirror verification receipt exceeds the consented output byte budget');
  }
  return sealed.receipt;
}

function normalizeFileRecord(value, label) {
  exactKeys(value, ['path', 'sha256', 'byteLength'], label);
  return {
    path: safePacketPath(value.path),
    sha256: digest(value.sha256, label + '.sha256'),
    byteLength: boundedInteger(value.byteLength, label + '.byteLength', 1, MAX_FILE_BYTES)
  };
}

function normalizeChangedRecord(value, label) {
  exactKeys(value, [
    'path', 'sourceSha256', 'mirrorSha256', 'sourceByteLength', 'mirrorByteLength'
  ], label);
  return {
    path: safePacketPath(value.path),
    sourceSha256: digest(value.sourceSha256, label + '.sourceSha256'),
    mirrorSha256: digest(value.mirrorSha256, label + '.mirrorSha256'),
    sourceByteLength: boundedInteger(value.sourceByteLength, label + '.sourceByteLength', 1, MAX_FILE_BYTES),
    mirrorByteLength: boundedInteger(value.mirrorByteLength, label + '.mirrorByteLength', 1, MAX_FILE_BYTES)
  };
}

function normalizePacketSummary(value, label) {
  exactKeys(value, [
    'packetRef', 'fileCount', 'totalBytes', 'embeddedCompilationVerified',
    'deterministicReceiptBytes', 'exactCompilationPacketVerified', 'issues'
  ], label);
  if (!Array.isArray(value.issues) || value.issues.length > PACKET_ISSUES.length ||
    value.issues.some((item) => !PACKET_ISSUES.includes(item)) ||
    new Set(value.issues).size !== value.issues.length ||
    !same(value.issues, value.issues.slice().sort(compareText))) {
    throw new Error(label + '.issues are invalid or non-canonical');
  }
  ['embeddedCompilationVerified', 'deterministicReceiptBytes', 'exactCompilationPacketVerified'].forEach((field) => {
    if (typeof value[field] !== 'boolean') throw new Error(label + '.' + field + ' must be boolean');
  });
  return {
    packetRef: reference(value.packetRef, label + '.packetRef'),
    fileCount: boundedInteger(value.fileCount, label + '.fileCount', 1, MAX_FILES_PER_PACKET),
    totalBytes: boundedInteger(value.totalBytes, label + '.totalBytes', 1, MAX_PACKET_BYTES),
    embeddedCompilationVerified: value.embeddedCompilationVerified,
    deterministicReceiptBytes: value.deterministicReceiptBytes,
    exactCompilationPacketVerified: value.exactCompilationPacketVerified,
    issues: value.issues.slice()
  };
}

function normalizeReceipt(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'comparisonMeaning', 'requestRef', 'consentEvaluationRef',
    'instructionRef', 'verifierProfileRef', 'compilerReceiptRef', 'source', 'mirror',
    'fileDelta', 'executableLikePathsPresent', 'resourceObservation', 'limitations',
    'nextImprovementGaps', 'truth', 'authority', 'receiptDigest'
  ], 'schema packet mirror verification receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION || !['MATCH', 'DRIFT'].includes(value.status)) {
    throw new Error('mirror verification receipt identity mismatch');
  }
  if (value.comparisonMeaning !== 'Exact schema-packet byte equality only; source and mirror are directional labels, not trust or precedence.') {
    throw new Error('mirror verification receipt meaning drifted');
  }
  if (!same(value.limitations, LIMITATIONS) || !same(value.nextImprovementGaps, NEXT_GAPS)) {
    throw new Error('mirror verification receipt limitations or gaps drifted');
  }
  if (value.authority !== 'NONE') throw new Error('mirror verification receipt authority must remain NONE');
  const source = normalizePacketSummary(value.source, 'receipt.source');
  const mirror = normalizePacketSummary(value.mirror, 'receipt.mirror');
  exactKeys(value.fileDelta, ['added', 'removed', 'changed', 'unchanged'], 'receipt.fileDelta');
  for (const field of ['added', 'removed', 'changed', 'unchanged']) {
    if (!Array.isArray(value.fileDelta[field]) || value.fileDelta[field].length > MAX_FILES_PER_PACKET) {
      throw new Error('receipt.fileDelta.' + field + ' must be a bounded array');
    }
  }
  const delta = {
    added: value.fileDelta.added.map((item, index) => normalizeFileRecord(item, 'receipt.fileDelta.added[' + index + ']')),
    removed: value.fileDelta.removed.map((item, index) => normalizeFileRecord(item, 'receipt.fileDelta.removed[' + index + ']')),
    changed: value.fileDelta.changed.map((item, index) => normalizeChangedRecord(item, 'receipt.fileDelta.changed[' + index + ']')),
    unchanged: value.fileDelta.unchanged.map((item, index) => normalizeFileRecord(item, 'receipt.fileDelta.unchanged[' + index + ']'))
  };
  for (const values of Object.values(delta)) {
    const paths = values.map((item) => item.path);
    if (new Set(paths.map((item) => item.toLowerCase())).size !== paths.length ||
      !same(paths, paths.slice().sort(compareText))) {
      throw new Error('mirror verification receipt file delta paths are duplicate or non-canonical');
    }
  }
  const allDeltaPaths = Object.values(delta).flat().map((item) => item.path.toLowerCase());
  if (new Set(allDeltaPaths).size !== allDeltaPaths.length) {
    throw new Error('mirror verification receipt file path appears in multiple delta categories');
  }
  const sourceRows = [
    ...delta.removed,
    ...delta.unchanged,
    ...delta.changed.map((item) => ({
      path: item.path,
      sha256: item.sourceSha256,
      byteLength: item.sourceByteLength
    }))
  ].sort((left, right) => compareText(left.path, right.path));
  const mirrorRows = [
    ...delta.added,
    ...delta.unchanged,
    ...delta.changed.map((item) => ({
      path: item.path,
      sha256: item.mirrorSha256,
      byteLength: item.mirrorByteLength
    }))
  ].sort((left, right) => compareText(left.path, right.path));
  if (source.fileCount !== sourceRows.length || mirror.fileCount !== mirrorRows.length ||
    source.totalBytes !== sourceRows.reduce((total, item) => total + item.byteLength, 0) ||
    mirror.totalBytes !== mirrorRows.reduce((total, item) => total + item.byteLength, 0) ||
    source.packetRef.sha256 !== sha256(sourceRows) || mirror.packetRef.sha256 !== sha256(mirrorRows)) {
    throw new Error('mirror verification receipt packet summaries contradict the file delta');
  }
  const sourcePaths = sourceRows.map((item) => item.path);
  const mirrorPaths = mirrorRows.map((item) => item.path);
  if (!same(sourcePaths, EXPECTED_FILES) || source.issues.length ||
    !source.embeddedCompilationVerified || !source.deterministicReceiptBytes ||
    !source.exactCompilationPacketVerified) {
    throw new Error('mirror verification receipt source packet truth is invalid');
  }
  const mirrorExpectedShape = same(mirrorPaths, EXPECTED_FILES);
  const mirrorExact = mirrorExpectedShape && !mirror.issues.length &&
    mirror.embeddedCompilationVerified && mirror.deterministicReceiptBytes;
  if (mirror.exactCompilationPacketVerified !== mirrorExact ||
    mirror.issues.includes('EXPECTED_FILE_MISSING') !== EXPECTED_FILES.some((item) => !mirrorPaths.includes(item)) ||
    mirror.issues.includes('UNEXPECTED_FILE_PRESENT') !== mirrorPaths.some((item) => !EXPECTED_FILES.includes(item))) {
    throw new Error('mirror verification receipt mirror packet truth is invalid');
  }
  if (!Array.isArray(value.executableLikePathsPresent) || value.executableLikePathsPresent.length > MAX_FILES_PER_PACKET ||
    value.executableLikePathsPresent.some((item) => safePacketPath(item) !== item || !EXECUTABLE_LIKE.test(item)) ||
    new Set(value.executableLikePathsPresent.map((item) => item.toLowerCase())).size !== value.executableLikePathsPresent.length ||
    !same(value.executableLikePathsPresent, value.executableLikePathsPresent.slice().sort(compareText)) ||
    !same(value.executableLikePathsPresent, mirrorPaths.filter((item) => EXECUTABLE_LIKE.test(item)))) {
    throw new Error('mirror verification receipt executable-like path list is invalid');
  }
  exactKeys(value.resourceObservation, [
    'verifierInputBytes', 'sourcePacketBytes', 'mirrorPacketBytes', 'receiptBytes',
    'writtenFiles', 'inputByteCeilingEnforced', 'outputByteCeilingEnforced',
    'fileCountEnforced', 'attemptCountEnforced', 'durationEnforced', 'memoryEnforced'
  ], 'receipt.resourceObservation');
  const resources = {
    verifierInputBytes: boundedInteger(value.resourceObservation.verifierInputBytes, 'receipt verifier input bytes', 1, MAX_VERIFIER_INPUT_BYTES),
    sourcePacketBytes: boundedInteger(value.resourceObservation.sourcePacketBytes, 'receipt source packet bytes', 1, MAX_PACKET_BYTES),
    mirrorPacketBytes: boundedInteger(value.resourceObservation.mirrorPacketBytes, 'receipt mirror packet bytes', 1, MAX_PACKET_BYTES),
    receiptBytes: boundedInteger(value.resourceObservation.receiptBytes, 'receipt bytes', 1, MAX_RECEIPT_BYTES),
    writtenFiles: 0,
    inputByteCeilingEnforced: true,
    outputByteCeilingEnforced: true,
    fileCountEnforced: true,
    attemptCountEnforced: false,
    durationEnforced: false,
    memoryEnforced: false
  };
  if (!same(resources, value.resourceObservation)) throw new Error('mirror verification receipt resource observation mismatch');
  const truthFields = [
    'fabricFirstGateApplied', 'groundedConsentScopeVerified', 'interactiveDeclarationSupplied',
    'interactiveDeclarationReplayPrevented', 'cryptographicHumanAuthenticationVerified',
    'trustedClockObserved', 'liveRevocationChecked', 'sourceExactCompilationPacketVerified',
    'mirrorExactCompilationPacketVerified', 'exactPacketByteEqualityProven', 'mirrorDriftObserved',
    'filePathsCompared', 'fileBytesCompared', 'fileContentRetainedInReceipt',
    'gitObjectDatabaseInspected', 'gitRefsInspected', 'gitRemoteContacted',
    'transportDeliveryProven', 'fullCloneCompletenessProven', 'semanticEquivalenceInferred',
    'mirrorCodeCloneConnected', 'mirrorCodeCloneExecuted', 'sourceMutationPerformed',
    'mirrorMutationPerformed', 'automaticMergePerformed', 'machineDefaultActivated',
    'persistentLearningAdmitted', 'installed', 'published', 'promoted', 'canonChanged'
  ];
  exactKeys(value.truth, truthFields, 'receipt.truth');
  const expectedTrue = new Set([
    'fabricFirstGateApplied', 'groundedConsentScopeVerified', 'interactiveDeclarationSupplied',
    'sourceExactCompilationPacketVerified', 'filePathsCompared', 'fileBytesCompared'
  ]);
  if (value.status === 'MATCH') {
    expectedTrue.add('mirrorExactCompilationPacketVerified');
    expectedTrue.add('exactPacketByteEqualityProven');
  } else {
    expectedTrue.add('mirrorDriftObserved');
  }
  truthFields.forEach((field) => {
    if (value.truth[field] !== expectedTrue.has(field)) {
      throw new Error('mirror verification receipt.truth.' + field + ' violates the truth ceiling');
    }
  });
  if ((value.status === 'MATCH') !== (
    source.packetRef.sha256 === mirror.packetRef.sha256 && source.exactCompilationPacketVerified &&
    mirror.exactCompilationPacketVerified && !delta.added.length && !delta.removed.length && !delta.changed.length
  )) {
    throw new Error('mirror verification receipt status contradicts packet evidence');
  }
  const core = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: value.status,
    comparisonMeaning: value.comparisonMeaning,
    requestRef: reference(value.requestRef, 'receipt.requestRef'),
    consentEvaluationRef: reference(value.consentEvaluationRef, 'receipt.consentEvaluationRef'),
    instructionRef: reference(value.instructionRef, 'receipt.instructionRef'),
    verifierProfileRef: reference(value.verifierProfileRef, 'receipt.verifierProfileRef'),
    compilerReceiptRef: reference(value.compilerReceiptRef, 'receipt.compilerReceiptRef'),
    source,
    mirror,
    fileDelta: delta,
    executableLikePathsPresent: value.executableLikePathsPresent.slice(),
    resourceObservation: resources,
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: clone(value.truth),
    authority: 'NONE'
  };
  if (!REQUEST_ID.test(core.requestRef.id) ||
    !same(core.instructionRef, declarationRef()) || !same(core.verifierProfileRef, profileRef()) ||
    core.requestRef.schema !== REQUEST_SCHEMA ||
    source.packetRef.schema !== PACKET_SCHEMA || mirror.packetRef.schema !== PACKET_SCHEMA ||
    source.packetRef.id !== core.requestRef.id + '-source-packet' ||
    mirror.packetRef.id !== core.requestRef.id + '-mirror-packet' ||
    core.consentEvaluationRef.schema !== Consent.EVALUATION_SCHEMA ||
    core.consentEvaluationRef.id !== core.requestRef.id + '-consent-evaluation' ||
    core.compilerReceiptRef.schema !== Compiler.RECEIPT_SCHEMA) {
    throw new Error('mirror verification receipt reference lineage mismatch');
  }
  const receiptDigest = digest(value.receiptDigest, 'mirror verification receipt.receiptDigest');
  if (sha256(core) !== receiptDigest) throw new Error('mirror verification receipt digest mismatch');
  const normalized = { ...core, receiptDigest };
  if (!same(normalized, value)) throw new Error('mirror verification receipt is not canonical');
  if (jsonBytes(normalized).length !== resources.receiptBytes) throw new Error('mirror verification receipt byte observation mismatch');
  return normalized;
}

function verifyReceipt(value, input) {
  const normalized = normalizeReceipt(value);
  const rebuilt = comparePackets(input);
  if (!same(normalized, rebuilt)) throw new Error('mirror verification receipt differs from deterministic rebuild');
  return normalized;
}

function buildRequest(sourcePacket, mirrorPacket, id = 'bounded-schema-packet-mirror-verification') {
  const source = decodePacket(sourcePacket, 'SOURCE');
  const mirror = decodePacket(mirrorPacket, 'MIRROR');
  return sealRequest({
    schema: REQUEST_SCHEMA,
    id,
    status: 'TEST',
    comparisonScope: 'EXACT_FOUR_FILE_SCHEMA_PACKET_BYTES',
    sourcePacketRef: packetRef(source, id, 'SOURCE'),
    mirrorPacketRef: packetRef(mirror, id, 'MIRROR'),
    rootsGate: Consent.ROOTS_GATE.slice(),
    authority: 'NONE'
  });
}

function buildExampleInput(blueprintBytes, compositionReceiptBytes, sourcePacket, mirrorPacket) {
  const compilerInput = Compiler.buildExampleInput(blueprintBytes, compositionReceiptBytes);
  const request = buildRequest(sourcePacket, mirrorPacket);
  const source = decodePacket(sourcePacket, 'SOURCE');
  const mirror = decodePacket(mirrorPacket, 'MIRROR');
  const artifacts = [
    packetArtifactRef(source, request.id, 'SOURCE'),
    packetArtifactRef(mirror, request.id, 'MIRROR')
  ].sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'schema-packet-mirror-verification-test-settings',
    validFrom: '2026-08-22T15:00:00.000Z',
    expiresAt: '2026-08-22T17:00:00.000Z',
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
        maxMemoryBytes: 134217728,
        maxDurationMs: 5000,
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
    id: 'schema-packet-mirror-verification-test-instance',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: requestRef(request),
    domainProfileRef: profileRef(),
    predecisionEvidenceRefs: [{
      id: 'four-root-schema-packet-mirror-policy-review',
      schema: 'axm.code-policy-bound-assurance-review/v1',
      sha256: sha256('schema-packet-mirror-predecision-review-placeholder')
    }],
    inputArtifacts: artifacts,
    actions: REQUIRED_ACTIONS.slice(),
    permissions: REQUIRED_PERMISSIONS.slice(),
    networkDomains: [],
    dataClasses: REQUIRED_DATA_CLASSES.slice(),
    sourceUses: REQUIRED_SOURCE_USES.slice(),
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources: {
      maxInputBytes: MAX_VERIFIER_INPUT_BYTES,
      maxOutputBytes: MAX_RECEIPT_BYTES,
      maxMemoryBytes: 134217728,
      maxDurationMs: 5000,
      maxProcesses: 1,
      maxAttempts: 1,
      maxCostMinorUnits: 0
    },
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T15:10:00.000Z',
    expiresAt: '2026-08-22T16:10:00.000Z',
    authority: 'NONE'
  });
  const consentEvaluationInput = { policy, instance, evaluatedAt: '2026-08-22T15:25:00.000Z' };
  return {
    request,
    sourcePacket,
    mirrorPacket,
    compilerInput,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput),
    authorization: {
      mode: 'INTERACTIVE_SESSION_DECLARATION',
      scope: 'ONE_SOURCE_AND_ONE_MIRROR_SCHEMA_PACKET',
      acknowledgement: ACKNOWLEDGEMENT,
      instructionRef: declarationRef()
    }
  };
}

module.exports = {
  VERSION,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  PROFILE_SCHEMA,
  PACKET_SCHEMA,
  ACKNOWLEDGEMENT,
  DECLARATION_ID,
  DECLARATION_SCHEMA,
  MAX_FILES_PER_PACKET,
  MAX_FILE_BYTES,
  MAX_PACKET_BYTES,
  MAX_VERIFIER_INPUT_BYTES,
  MAX_RECEIPT_BYTES,
  EXPECTED_FILES,
  REQUIRED_ACTIONS,
  REQUIRED_PERMISSIONS,
  REQUIRED_DATA_CLASSES,
  REQUIRED_SOURCE_USES,
  REQUIRED_EVIDENCE_SCHEMAS,
  PACKET_ISSUES,
  LIMITATIONS,
  NEXT_GAPS,
  PROFILE,
  canonicalJson,
  sha256,
  profileRef,
  declarationRef,
  safePacketPath,
  decodePacket,
  packetRef,
  packetArtifactRef,
  sealRequest,
  normalizeRequest,
  requestRef,
  prepare,
  comparePackets,
  normalizeReceipt,
  verifyReceipt,
  buildRequest,
  buildExampleInput
};
