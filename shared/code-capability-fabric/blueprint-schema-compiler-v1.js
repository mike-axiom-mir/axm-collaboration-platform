'use strict';

const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Composer = require('./declarative-blueprint-composer-v1');
const Pilot = require('./slow-creation-pilot-v1');

const VERSION = '0.1.0';
const SUBJECT_SCHEMA = 'axm.fabric-blueprint-schema-compilation-subject/v1';
const MATRIX_SCHEMA = 'axm.fabric-blueprint-acceptance-matrix/v1';
const RECEIPT_SCHEMA = 'axm.fabric-blueprint-schema-compilation-receipt/v1';
const PROFILE_SCHEMA = 'axm.fabric-blueprint-schema-compiler-profile/v1';
const ACKNOWLEDGEMENT = 'ONE INERT SCHEMA PACKET ONLY';
const DECLARATION_ID = 'interactive-blueprint-schema-compilation-declaration';
const DECLARATION_SCHEMA = 'axm.interactive-pilot-declaration/v1';
const ROOT_PREFIX = 'axm-fabric-creation-pilot-schema-';
const MAX_COMPILER_INPUT_BYTES = 65536;
const MAX_WRITTEN_FILES = 4;
const MAX_WRITTEN_BYTES = 65536;
const INPUT_SCHEMA_FILE = 'input.schema.json';
const OUTPUT_SCHEMA_FILE = 'output.schema.json';
const MATRIX_FILE = 'acceptance-matrix.json';
const RECEIPT_FILE = 'schema-compilation-receipt.json';
const REQUIRED_ACTIONS = Object.freeze(['code.compile-blueprint-schemas']);
const REQUIRED_PERMISSIONS = Object.freeze(['candidate.output-write']);
const REQUIRED_DATA_CLASSES = Object.freeze(['public-generated-artifact']);
const REQUIRED_SOURCE_USES = Object.freeze(['derive-schema-contracts']);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([
  MATRIX_SCHEMA,
  Composer.RECEIPT_SCHEMA,
  RECEIPT_SCHEMA,
  Composer.BLUEPRINT_SCHEMA
].sort());
const LIMITATIONS = Object.freeze([
  'INTERACTIVE_DECLARATION_NOT_CRYPTOGRAPHIC_IDENTITY_PROOF',
  'INTERACTIVE_DECLARATION_REPLAY_NOT_PREVENTED',
  'PREDECISION_EVIDENCE_CONTENT_NOT_VERIFIED_BY_COMPILER',
  'DECLARED_PUBLIC_DATA_CLASS_CONTENT_NOT_VERIFIED',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'SCHEMAS_DESCRIBE_DECLARED_SHAPE_ONLY',
  'SEMANTIC_BEHAVIOR_NOT_IMPLEMENTED',
  'SCHEMA_VALIDATION_RUNTIME_NOT_EXECUTED',
  'GENERATED_EXECUTABLE_CODE_ABSENT',
  'RUNTIME_RESOURCE_BUDGETS_DECLARED_NOT_ENFORCED',
  'RUNTIME_QUALITY_NOT_PROVEN',
  'DIRECT_REUSE_RIGHTS_FOR_FUTURE_CODE_NOT_EVALUATED',
  'MACHINE_HOST_DEFAULT_NOT_ACTIVATED',
  'PERSISTENT_LEARNING_NOT_ADMITTED'
]);
const NEXT_GAPS = Object.freeze([
  'consent.human-decision.authenticate',
  'consent.declaration.replay-prevent',
  'consent.revocation.observe-live',
  'consent.trusted-clock.observe',
  'creation.blueprint-schema.validate-with-independent-validator',
  'creation.blueprint-to-code.provider',
  'creation.semantic-candidate.generate',
  'creation.runtime-quality.verify',
  'learning.admission.decide'
]);
const PROFILE = Object.freeze({
  schema: PROFILE_SCHEMA,
  id: 'deterministic-inert-blueprint-schema-compiler',
  version: VERSION,
  kind: 'PURE_DATA_TRANSFORM',
  maximumCompilerInputBytes: MAX_COMPILER_INPUT_BYTES,
  maximumWrittenFiles: MAX_WRITTEN_FILES,
  maximumWrittenBytes: MAX_WRITTEN_BYTES,
  sourceReads: 'BOUND_EXACT_INPUT_ARTIFACTS_ONLY',
  network: 'DISABLED',
  childProcesses: 'DISABLED',
  generatedCode: 'DISABLED',
  generatedCodeExecution: 'DISABLED',
  outputScope: 'ONE_NEW_OWNED_ROOT',
  authority: 'DISPOSABLE_SCHEMA_PACKET_WRITE_ONLY'
});
const DIGEST = /^sha256:[0-9a-f]{64}$/;

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

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
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

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  if (typeof value.id !== 'string' || !value.id.length || value.id.length > 180) {
    throw new Error(label + '.id must be bounded text');
  }
  if (typeof value.schema !== 'string' || !value.schema.length || value.schema.length > 220) {
    throw new Error(label + '.schema must be bounded text');
  }
  return { id: value.id, schema: value.schema, sha256: digest(value.sha256, label + '.sha256') };
}

function artifactReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256', 'byteLength'], label);
  return {
    ...reference({ id: value.id, schema: value.schema, sha256: value.sha256 }, label),
    byteLength: boundedInteger(value.byteLength, label + '.byteLength', 1, MAX_COMPILER_INPUT_BYTES)
  };
}

function artifactRef(id, schema, bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('artifact bytes must be a Buffer');
  return { id, schema, sha256: sha256(bytes), byteLength: bytes.length };
}

function profileRef() {
  return { id: PROFILE.id, schema: PROFILE.schema, sha256: sha256(PROFILE) };
}

function declarationRef() {
  const core = {
    schema: DECLARATION_SCHEMA,
    id: DECLARATION_ID,
    acknowledgement: ACKNOWLEDGEMENT,
    scope: 'ONE_INERT_SCHEMA_PACKET'
  };
  return { id: core.id, schema: core.schema, sha256: sha256(core) };
}

function compositionReceiptRef(receipt) {
  return {
    id: receipt.intentRef.id + '-composition-receipt',
    schema: receipt.schema,
    sha256: receipt.receiptDigest
  };
}

function inputArtifactRefs(blueprint, blueprintBytes, compositionReceiptBytes) {
  return [
    artifactRef(blueprint.id + '-blueprint-file', blueprint.schema, blueprintBytes),
    artifactRef(blueprint.id + '-composition-receipt-file', Composer.RECEIPT_SCHEMA, compositionReceiptBytes)
  ].sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
}

function compilationSubjectRef(verified, artifacts) {
  const core = {
    schema: SUBJECT_SCHEMA,
    id: verified.blueprint.id + '-schema-compilation',
    blueprintRef: {
      id: verified.blueprint.id,
      schema: verified.blueprint.schema,
      sha256: verified.blueprint.blueprintDigest
    },
    compositionReceiptRef: compositionReceiptRef(verified.receipt),
    inputArtifacts: clone(artifacts)
  };
  return { id: core.id, schema: core.schema, sha256: sha256(core) };
}

function normalizeAuthorization(value) {
  exactKeys(value, ['mode', 'scope', 'acknowledgement', 'instructionRef'], 'schema compilation authorization');
  const normalized = {
    mode: value.mode,
    scope: value.scope,
    acknowledgement: value.acknowledgement,
    instructionRef: reference(value.instructionRef, 'schema compilation authorization.instructionRef')
  };
  if (normalized.mode !== 'INTERACTIVE_SESSION_DECLARATION' ||
    normalized.scope !== 'ONE_INERT_SCHEMA_PACKET' ||
    normalized.acknowledgement !== ACKNOWLEDGEMENT ||
    !same(normalized.instructionRef, declarationRef())) {
    throw new Error('schema compilation authorization does not bind the exact inert packet declaration');
  }
  return normalized;
}

function allFalseLifecycle(value) {
  return Consent.LIFECYCLE_FIELDS.every((field) => value[field] === false);
}

function parseVerifiedSource(intent, blueprintBytes, compositionReceiptBytes) {
  if (!Buffer.isBuffer(blueprintBytes) || !Buffer.isBuffer(compositionReceiptBytes)) {
    throw new Error('blueprint and composition receipt inputs must be exact byte Buffers');
  }
  if (!blueprintBytes.length || !compositionReceiptBytes.length) {
    throw new Error('blueprint and composition receipt inputs must not be empty');
  }
  let parsedReceipt;
  try {
    parsedReceipt = JSON.parse(compositionReceiptBytes.toString('utf8'));
  } catch (error) {
    throw new Error('composition receipt artifact is not valid UTF-8 JSON');
  }
  const normalizedReceipt = Composer.normalizeReceipt(parsedReceipt);
  return Composer.verifyReceiptArtifacts(normalizedReceipt, blueprintBytes, intent);
}

function prepare(input) {
  exactKeys(input, [
    'intent', 'blueprintBytes', 'compositionReceiptBytes',
    'consentEvaluationInput', 'consentEvaluation', 'authorization'
  ], 'schema compilation input');
  const intent = Composer.normalizeIntent(input.intent);
  const verified = parseVerifiedSource(intent, input.blueprintBytes, input.compositionReceiptBytes);
  const artifacts = inputArtifactRefs(verified.blueprint, input.blueprintBytes, input.compositionReceiptBytes);
  const authorization = normalizeAuthorization(input.authorization);
  const evaluation = Consent.normalizeEvaluation(input.consentEvaluation);
  const evaluationCheck = Consent.verifyEvaluation(evaluation, input.consentEvaluationInput);
  if (!evaluationCheck.pass) {
    throw new Error('grounded consent evaluation verification failed: ' + evaluationCheck.errors.join('|'));
  }
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    throw new Error('grounded consent scope must be hold-free before the schema declaration');
  }
  const policy = Consent.normalizePolicy(input.consentEvaluationInput.policy);
  const instance = Consent.normalizeInstance(input.consentEvaluationInput.instance);
  if (instance.domain !== 'code') throw new Error('schema compilation consent domain must be code');
  if (!same(instance.subjectRef, compilationSubjectRef(verified, artifacts))) {
    throw new Error('grounded consent subject does not bind the exact blueprint compilation packet');
  }
  if (!same(instance.domainProfileRef, profileRef())) {
    throw new Error('grounded consent domain profile does not bind the schema compiler');
  }
  if (!same(instance.inputArtifacts, artifacts)) {
    throw new Error('grounded consent input artifacts do not bind both exact source files');
  }
  if (!same(instance.actions, REQUIRED_ACTIONS)) throw new Error('schema compiler action scope must be exact');
  if (!same(instance.permissions, REQUIRED_PERMISSIONS)) throw new Error('schema compiler permission scope must be exact');
  if (instance.networkDomains.length) throw new Error('schema compiler network must remain disabled');
  if (!same(instance.dataClasses, REQUIRED_DATA_CLASSES)) throw new Error('schema compiler data class must be exact');
  if (!same(instance.sourceUses, REQUIRED_SOURCE_USES)) throw new Error('schema compiler source use must be exact');
  if (!allFalseLifecycle(instance.lifecycle)) throw new Error('schema compiler lifecycle effects must remain false');
  if (!same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) {
    throw new Error('schema compiler evidence schemas must be exact');
  }
  if (instance.resources.maxAttempts !== 1 || instance.resources.maxProcesses !== 1 ||
    instance.resources.maxCostMinorUnits !== 0 ||
    instance.resources.maxInputBytes > MAX_COMPILER_INPUT_BYTES ||
    instance.resources.maxOutputBytes > MAX_WRITTEN_BYTES) {
    throw new Error('schema compiler resource scope exceeds the fixed profile');
  }
  const compilerInputBytes = input.blueprintBytes.length + input.compositionReceiptBytes.length +
    Buffer.byteLength(canonicalJson(intent), 'utf8');
  if (compilerInputBytes > instance.resources.maxInputBytes) {
    throw new Error('schema compiler inputs exceed the consented input byte budget');
  }
  return {
    intent,
    blueprintBytes: input.blueprintBytes,
    compositionReceiptBytes: input.compositionReceiptBytes,
    verified,
    artifacts,
    policy,
    instance,
    evaluation,
    authorization,
    compilerInputBytes
  };
}

function jsonType(field) {
  return { type: field.type, description: field.description };
}

function buildInterfaceSchema(blueprint, direction) {
  if (direction !== 'input' && direction !== 'output') throw new Error('schema direction is unsupported');
  const fields = direction === 'input' ? blueprint.interface.inputs : blueprint.interface.outputs;
  const properties = {};
  for (const field of fields) properties[field.id] = jsonType(field);
  const required = direction === 'input'
    ? fields.filter((field) => field.required).map((field) => field.id)
    : fields.map((field) => field.id);
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:axm:fabric:' + blueprint.id + ':' + direction + ':v1',
    title: blueprint.name + (direction === 'input' ? ' input' : ' output'),
    description: direction === 'input'
      ? 'Strict declared input shape compiled from an inert AXM capability blueprint.'
      : 'Strict declared output shape compiled from an inert AXM capability blueprint.',
    type: 'object',
    additionalProperties: false,
    required,
    properties,
    'x-axm-lineage': {
      status: 'EXPERIMENTAL',
      direction: direction.toUpperCase(),
      blueprintRef: {
        id: blueprint.id,
        schema: blueprint.schema,
        sha256: blueprint.blueprintDigest
      },
      rootsGate: Consent.ROOTS_GATE.slice(),
      authority: 'NONE'
    }
  };
}

function schemaRef(schema, direction, blueprint) {
  return {
    id: blueprint.id + '-' + direction + '-schema',
    schema: schema.$id,
    sha256: sha256(schema)
  };
}

function evidenceKind(caseId) {
  const routes = {
    'composition-graph-resolves': 'STATIC_BLUEPRINT_PROVENANCE',
    'declared-input-contract-holds': 'HELD_OUT_INPUT_SCHEMA_VALIDATION',
    'declared-output-contract-holds': 'HELD_OUT_OUTPUT_SCHEMA_VALIDATION',
    'deterministic-replay-holds': 'REPEAT_RUNTIME_EXECUTION',
    'runtime-resource-ceilings-hold': 'MEASURED_RUNTIME_TELEMETRY',
    'authority-boundary-holds': 'ALLOWED_AND_DENIED_AUTHORIZATION_TESTS',
    'human-quality-review-holds': 'MIKE_OR_APPOINTED_HUMAN_REVIEW'
  };
  if (!routes[caseId]) throw new Error('blueprint acceptance case has no explicit evidence route: ' + caseId);
  return routes[caseId];
}

function buildAcceptanceMatrix(blueprint, inputSchema, outputSchema) {
  const inputRef = schemaRef(inputSchema, 'input', blueprint);
  const outputRef = schemaRef(outputSchema, 'output', blueprint);
  const core = {
    schema: MATRIX_SCHEMA,
    version: VERSION,
    status: 'TEST_PLAN_ONLY',
    blueprintRef: {
      id: blueprint.id,
      schema: blueprint.schema,
      sha256: blueprint.blueprintDigest
    },
    interfaceSchemaRefs: [inputRef, outputRef].sort((left, right) => compareText(left.id, right.id)),
    cases: blueprint.acceptancePlan.map((item) => ({
      id: item.id,
      claim: item.claim,
      sourceStatus: item.status,
      evidenceRequired: item.evidenceRequired,
      evidenceKind: evidenceKind(item.id),
      evidenceArtifactRefs: item.id === 'declared-input-contract-holds'
        ? [inputRef]
        : item.id === 'declared-output-contract-holds' ? [outputRef] : [],
      verdict: 'UNRUN'
    })),
    desiredOutcomeReviews: blueprint.desiredOutcomes.map((item) => ({
      claim: item.claim,
      sourceStatus: item.status,
      reviewStatus: 'HUMAN_REVIEW_REQUIRED'
    })),
    rootsGate: Consent.ROOTS_GATE.slice(),
    truth: {
      blueprintLineageVerified: true,
      inputSchemaGenerated: true,
      outputSchemaGenerated: true,
      acceptanceCasesRouted: true,
      anyAcceptanceCaseExecuted: false,
      semanticBehaviorImplemented: false,
      runtimeQualityProven: false,
      humanQualityApproved: false
    },
    authority: 'NONE'
  };
  return { ...core, matrixDigest: sha256(core) };
}

function normalizeAcceptanceMatrix(value, blueprint, inputSchema, outputSchema) {
  const expected = buildAcceptanceMatrix(blueprint, inputSchema, outputSchema);
  if (!same(value, expected)) throw new Error('acceptance matrix does not match the exact verified blueprint and schemas');
  return expected;
}

function compileArtifacts(prepared) {
  const blueprint = prepared.verified.blueprint;
  const inputSchema = buildInterfaceSchema(blueprint, 'input');
  const outputSchema = buildInterfaceSchema(blueprint, 'output');
  const matrix = buildAcceptanceMatrix(blueprint, inputSchema, outputSchema);
  return {
    inputSchema,
    outputSchema,
    matrix,
    inputSchemaBytes: jsonBytes(inputSchema),
    outputSchemaBytes: jsonBytes(outputSchema),
    matrixBytes: jsonBytes(matrix)
  };
}

function evaluationRef(evaluation, blueprint) {
  return {
    id: blueprint.id + '-schema-consent-evaluation',
    schema: evaluation.schema,
    sha256: evaluation.evaluationDigest
  };
}

function outputArtifact(pathName, value, bytes) {
  return {
    path: pathName,
    schema: value.schema || value.$id,
    objectSha256: value.matrixDigest || sha256(value),
    fileSha256: sha256(bytes),
    byteLength: bytes.length
  };
}

function buildReceiptCore(prepared, compiled) {
  const blueprint = prepared.verified.blueprint;
  const artifacts = [
    outputArtifact(INPUT_SCHEMA_FILE, compiled.inputSchema, compiled.inputSchemaBytes),
    outputArtifact(OUTPUT_SCHEMA_FILE, compiled.outputSchema, compiled.outputSchemaBytes),
    outputArtifact(MATRIX_FILE, compiled.matrix, compiled.matrixBytes)
  ].sort((left, right) => compareText(left.path, right.path));
  return {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: 'SCHEMA_PACKET_EMITTED_FOR_REVIEW',
    subjectRef: compilationSubjectRef(prepared.verified, prepared.artifacts),
    intentRef: clone(prepared.verified.receipt.intentRef),
    blueprintRef: {
      id: blueprint.id,
      schema: blueprint.schema,
      sha256: blueprint.blueprintDigest
    },
    compositionReceiptRef: compositionReceiptRef(prepared.verified.receipt),
    inputArtifactRefs: clone(prepared.artifacts),
    consentEvaluationRef: evaluationRef(prepared.evaluation, blueprint),
    instructionRef: prepared.authorization.instructionRef,
    compilerProfileRef: profileRef(),
    derivedArtifactFiles: artifacts,
    resourceObservation: {
      compilerInputBytes: prepared.compilerInputBytes,
      inputSchemaBytes: compiled.inputSchemaBytes.length,
      outputSchemaBytes: compiled.outputSchemaBytes.length,
      matrixBytes: compiled.matrixBytes.length,
      totalFilesWritten: MAX_WRITTEN_FILES,
      inputByteCeilingEnforced: true,
      fileCountEnforced: true,
      outputByteCeilingEnforced: true,
      attemptCountEnforced: true,
      durationEnforced: false,
      memoryEnforced: false
    },
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: {
      fabricFirstGateApplied: true,
      exactSourceArtifactBytesVerified: true,
      sourceObjectLineageVerified: true,
      groundedConsentScopeVerified: true,
      interactiveDeclarationSupplied: true,
      interactiveDeclarationReplayPrevented: false,
      cryptographicHumanAuthenticationVerified: false,
      predecisionEvidenceContentVerified: false,
      declaredPublicDataClassContentVerified: false,
      trustedClockObserved: false,
      liveRevocationChecked: false,
      compilerWriteAuthorityUsed: true,
      fabricGrantedAuthority: false,
      inputSchemaWritten: true,
      outputSchemaWritten: true,
      acceptanceMatrixWritten: true,
      allArtifactsReadBack: true,
      receiptWritten: true,
      receiptReadBack: true,
      arbitraryWorkspaceContentRead: false,
      networkUsed: false,
      childProcessSpawned: false,
      generatedExecutableCodePresent: false,
      candidateCodeExecuted: false,
      schemaValidationRuntimeExecuted: false,
      anyAcceptanceCaseExecuted: false,
      runtimeQualityProven: false,
      humanQualityApproved: false,
      machineDefaultActivated: false,
      persistentLearningAdmitted: false,
      installed: false,
      registered: false,
      staged: false,
      promoted: false,
      canonChanged: false,
      filesRetained: true
    },
    authority: 'DISPOSABLE_SCHEMA_PACKET_WRITE_ONLY_USED'
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
      resourceObservation: {
        ...core.resourceObservation,
        receiptBytes,
        totalBytesWritten: core.resourceObservation.inputSchemaBytes +
          core.resourceObservation.outputSchemaBytes + core.resourceObservation.matrixBytes + receiptBytes
      }
    };
    const receipt = sealReceipt(withResources);
    const bytes = jsonBytes(receipt);
    if (bytes.length === receiptBytes) return { receipt, bytes };
    receiptBytes = bytes.length;
  }
  throw new Error('schema compilation receipt byte length did not stabilize');
}

function normalizeReceipt(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'subjectRef', 'intentRef', 'blueprintRef',
    'compositionReceiptRef', 'inputArtifactRefs', 'consentEvaluationRef',
    'instructionRef', 'compilerProfileRef', 'derivedArtifactFiles',
    'resourceObservation', 'limitations', 'nextImprovementGaps', 'truth',
    'authority', 'receiptDigest'
  ], 'schema compilation receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION ||
    value.status !== 'SCHEMA_PACKET_EMITTED_FOR_REVIEW') {
    throw new Error('schema compilation receipt identity mismatch');
  }
  if (value.authority !== 'DISPOSABLE_SCHEMA_PACKET_WRITE_ONLY_USED') {
    throw new Error('schema compilation receipt authority mismatch');
  }
  if (!same(value.limitations, LIMITATIONS) || !same(value.nextImprovementGaps, NEXT_GAPS)) {
    throw new Error('schema compilation receipt limitations or next gaps drifted');
  }
  if (!Array.isArray(value.inputArtifactRefs) || value.inputArtifactRefs.length !== 2) {
    throw new Error('schema compilation receipt must bind exactly two source artifacts');
  }
  const normalizedInputs = value.inputArtifactRefs.map((item, index) =>
    artifactReference(item, 'receipt.inputArtifactRefs[' + index + ']'));
  const sortedInputs = normalizedInputs.slice().sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (!same(normalizedInputs, sortedInputs)) throw new Error('schema compilation receipt input artifact order mismatch');
  if (!Array.isArray(value.derivedArtifactFiles) || value.derivedArtifactFiles.length !== 3) {
    throw new Error('schema compilation receipt must bind exactly three derived artifacts');
  }
  const expectedPaths = [INPUT_SCHEMA_FILE, MATRIX_FILE, OUTPUT_SCHEMA_FILE].sort();
  const actualPaths = value.derivedArtifactFiles.map((item, index) => {
    exactKeys(item, ['path', 'schema', 'objectSha256', 'fileSha256', 'byteLength'], 'receipt.derivedArtifactFiles[' + index + ']');
    digest(item.objectSha256, 'receipt derived object digest');
    digest(item.fileSha256, 'receipt derived file digest');
    boundedInteger(item.byteLength, 'receipt derived artifact bytes', 1, MAX_WRITTEN_BYTES);
    return item.path;
  });
  if (!same(actualPaths, expectedPaths)) throw new Error('schema compilation receipt derived artifact paths mismatch');
  exactKeys(value.resourceObservation, [
    'compilerInputBytes', 'inputSchemaBytes', 'outputSchemaBytes', 'matrixBytes',
    'receiptBytes', 'totalFilesWritten', 'totalBytesWritten',
    'inputByteCeilingEnforced', 'fileCountEnforced', 'outputByteCeilingEnforced',
    'attemptCountEnforced', 'durationEnforced', 'memoryEnforced'
  ], 'schema compilation receipt.resourceObservation');
  const resources = value.resourceObservation;
  const byteFields = ['compilerInputBytes', 'inputSchemaBytes', 'outputSchemaBytes', 'matrixBytes', 'receiptBytes', 'totalBytesWritten'];
  byteFields.forEach((field) => boundedInteger(resources[field], 'receipt resource ' + field, 1, MAX_WRITTEN_BYTES));
  if (resources.totalFilesWritten !== MAX_WRITTEN_FILES ||
    resources.totalBytesWritten !== resources.inputSchemaBytes + resources.outputSchemaBytes +
      resources.matrixBytes + resources.receiptBytes ||
    resources.totalBytesWritten > MAX_WRITTEN_BYTES) {
    throw new Error('schema compilation receipt resource totals mismatch');
  }
  const filesByPath = Object.fromEntries(value.derivedArtifactFiles.map((item) => [item.path, item]));
  if (filesByPath[INPUT_SCHEMA_FILE].byteLength !== resources.inputSchemaBytes ||
    filesByPath[OUTPUT_SCHEMA_FILE].byteLength !== resources.outputSchemaBytes ||
    filesByPath[MATRIX_FILE].byteLength !== resources.matrixBytes) {
    throw new Error('schema compilation receipt artifact bytes do not match resource observations');
  }
  const expectedResourceTruth = {
    inputByteCeilingEnforced: true,
    fileCountEnforced: true,
    outputByteCeilingEnforced: true,
    attemptCountEnforced: true,
    durationEnforced: false,
    memoryEnforced: false
  };
  Object.entries(expectedResourceTruth).forEach(([field, expected]) => {
    if (resources[field] !== expected) throw new Error('schema compilation receipt resource truth mismatch: ' + field);
  });
  const trueTruth = new Set([
    'fabricFirstGateApplied', 'exactSourceArtifactBytesVerified', 'sourceObjectLineageVerified',
    'groundedConsentScopeVerified', 'interactiveDeclarationSupplied', 'compilerWriteAuthorityUsed',
    'inputSchemaWritten', 'outputSchemaWritten', 'acceptanceMatrixWritten', 'allArtifactsReadBack',
    'receiptWritten', 'receiptReadBack', 'filesRetained'
  ]);
  const truthFields = [
    'fabricFirstGateApplied', 'exactSourceArtifactBytesVerified', 'sourceObjectLineageVerified',
    'groundedConsentScopeVerified', 'interactiveDeclarationSupplied', 'interactiveDeclarationReplayPrevented',
    'cryptographicHumanAuthenticationVerified', 'predecisionEvidenceContentVerified',
    'declaredPublicDataClassContentVerified', 'trustedClockObserved', 'liveRevocationChecked',
    'compilerWriteAuthorityUsed', 'fabricGrantedAuthority', 'inputSchemaWritten', 'outputSchemaWritten',
    'acceptanceMatrixWritten', 'allArtifactsReadBack', 'receiptWritten', 'receiptReadBack',
    'arbitraryWorkspaceContentRead', 'networkUsed', 'childProcessSpawned', 'generatedExecutableCodePresent',
    'candidateCodeExecuted', 'schemaValidationRuntimeExecuted', 'anyAcceptanceCaseExecuted',
    'runtimeQualityProven', 'humanQualityApproved', 'machineDefaultActivated', 'persistentLearningAdmitted',
    'installed', 'registered', 'staged', 'promoted', 'canonChanged', 'filesRetained'
  ];
  exactKeys(value.truth, truthFields, 'schema compilation receipt.truth');
  truthFields.forEach((field) => {
    if (value.truth[field] !== trueTruth.has(field)) {
      throw new Error('schema compilation receipt.truth.' + field + ' violates the truth ceiling');
    }
  });
  const subjectRef = reference(value.subjectRef, 'receipt.subjectRef');
  const intentRef = reference(value.intentRef, 'receipt.intentRef');
  const blueprintRef = reference(value.blueprintRef, 'receipt.blueprintRef');
  const sourceReceiptRef = reference(value.compositionReceiptRef, 'receipt.compositionReceiptRef');
  const consentRef = reference(value.consentEvaluationRef, 'receipt.consentEvaluationRef');
  const instructionRef = reference(value.instructionRef, 'receipt.instructionRef');
  const compilerRef = reference(value.compilerProfileRef, 'receipt.compilerProfileRef');
  if (subjectRef.schema !== SUBJECT_SCHEMA || subjectRef.id !== blueprintRef.id + '-schema-compilation' ||
    intentRef.schema !== Composer.INTENT_SCHEMA || blueprintRef.schema !== Composer.BLUEPRINT_SCHEMA ||
    blueprintRef.id !== intentRef.id || sourceReceiptRef.schema !== Composer.RECEIPT_SCHEMA ||
    sourceReceiptRef.id !== intentRef.id + '-composition-receipt' ||
    consentRef.schema !== Consent.EVALUATION_SCHEMA ||
    consentRef.id !== blueprintRef.id + '-schema-consent-evaluation' ||
    !same(instructionRef, declarationRef()) || !same(compilerRef, profileRef())) {
    throw new Error('schema compilation receipt reference lineage mismatch');
  }
  const inputSchemas = normalizedInputs.map((item) => item.schema).sort(compareText);
  if (!same(inputSchemas, [Composer.BLUEPRINT_SCHEMA, Composer.RECEIPT_SCHEMA].sort(compareText))) {
    throw new Error('schema compilation receipt source artifact schemas mismatch');
  }
  if (filesByPath[INPUT_SCHEMA_FILE].schema !== 'urn:axm:fabric:' + blueprintRef.id + ':input:v1' ||
    filesByPath[OUTPUT_SCHEMA_FILE].schema !== 'urn:axm:fabric:' + blueprintRef.id + ':output:v1' ||
    filesByPath[MATRIX_FILE].schema !== MATRIX_SCHEMA) {
    throw new Error('schema compilation receipt derived artifact schemas mismatch');
  }
  const { receiptDigest, ...core } = value;
  if (sha256(core) !== digest(receiptDigest, 'schema compilation receipt.receiptDigest')) {
    throw new Error('schema compilation receipt digest mismatch');
  }
  if (jsonBytes(value).length !== resources.receiptBytes) {
    throw new Error('schema compilation receipt byte observation mismatch');
  }
  return clone(value);
}

function expectedPacket(input) {
  const prepared = prepare(input);
  const compiled = compileArtifacts(prepared);
  const sealed = receiptWithStableByteLength(buildReceiptCore(prepared, compiled));
  if (sealed.receipt.resourceObservation.totalBytesWritten > prepared.instance.resources.maxOutputBytes) {
    throw new Error('schema compilation output exceeds consented output byte budget');
  }
  return { prepared, compiled, receipt: sealed.receipt, receiptBytes: sealed.bytes };
}

function verifyCompilationArtifacts(receiptValue, artifactBytes, input) {
  exactKeys(artifactBytes, [INPUT_SCHEMA_FILE, OUTPUT_SCHEMA_FILE, MATRIX_FILE], 'schema compilation artifact bytes');
  const packet = expectedPacket(input);
  const expectedBytes = {
    [INPUT_SCHEMA_FILE]: packet.compiled.inputSchemaBytes,
    [OUTPUT_SCHEMA_FILE]: packet.compiled.outputSchemaBytes,
    [MATRIX_FILE]: packet.compiled.matrixBytes
  };
  for (const file of Object.keys(expectedBytes)) {
    if (!Buffer.isBuffer(artifactBytes[file]) || !artifactBytes[file].equals(expectedBytes[file])) {
      throw new Error(file + ' bytes do not match the exact deterministic compilation');
    }
  }
  const receipt = normalizeReceipt(receiptValue);
  if (!same(receipt, packet.receipt)) throw new Error('schema compilation receipt differs from deterministic rebuild');
  normalizeAcceptanceMatrix(
    JSON.parse(artifactBytes[MATRIX_FILE].toString('utf8')),
    packet.prepared.verified.blueprint,
    packet.compiled.inputSchema,
    packet.compiled.outputSchema
  );
  return {
    receipt,
    inputSchema: packet.compiled.inputSchema,
    outputSchema: packet.compiled.outputSchema,
    matrix: packet.compiled.matrix
  };
}

function ensureFreshOwnedRoot(boundary) {
  fs.mkdirSync(boundary.root);
  const stat = fs.lstatSync(boundary.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(boundary.root) !== boundary.root) {
    throw new Error('schema output root changed identity after creation');
  }
}

function safeCleanupOwnedRoot(boundary) {
  if (!fs.existsSync(boundary.root)) return;
  const stat = fs.lstatSync(boundary.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.dirname(boundary.root) !== boundary.parent) {
    throw new Error('refusing cleanup because schema output root identity changed');
  }
  const allowedFiles = new Set([INPUT_SCHEMA_FILE, OUTPUT_SCHEMA_FILE, MATRIX_FILE, RECEIPT_FILE]);
  const entries = fs.readdirSync(boundary.root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !allowedFiles.has(entry.name))) {
    throw new Error('refusing cleanup because schema output root contains an unexpected entry');
  }
  for (const entry of entries) fs.unlinkSync(path.join(boundary.root, entry.name));
  fs.rmdirSync(boundary.root);
}

function validateAllowedParentSpelling(value) {
  const allowedParent = String(value || '');
  if (process.platform === 'win32' && /^[a-z]:[\\/]/.test(allowedParent)) {
    throw new Error('allowed parent must use canonical upper-case Windows drive spelling');
  }
  return allowedParent;
}

function emit(input, options) {
  exactKeys(options, ['allowedParent', 'rootName', 'faultAt'], 'schema compilation options');
  const faultAt = options.faultAt == null ? null : String(options.faultAt);
  const supportedFaults = [null, 'AFTER_INPUT_SCHEMA', 'AFTER_OUTPUT_SCHEMA', 'AFTER_MATRIX', 'AFTER_RECEIPT'];
  if (!supportedFaults.includes(faultAt)) throw new Error('schema compilation fault injection is unsupported');
  if (typeof options.rootName !== 'string' || !options.rootName.startsWith(ROOT_PREFIX)) {
    throw new Error('schema output root name must use the fixed schema prefix');
  }
  const boundary = Pilot.validateNewRoot(validateAllowedParentSpelling(options.allowedParent), options.rootName);
  const packet = expectedPacket(input);
  const writes = [
    [INPUT_SCHEMA_FILE, packet.compiled.inputSchemaBytes, 'AFTER_INPUT_SCHEMA'],
    [OUTPUT_SCHEMA_FILE, packet.compiled.outputSchemaBytes, 'AFTER_OUTPUT_SCHEMA'],
    [MATRIX_FILE, packet.compiled.matrixBytes, 'AFTER_MATRIX'],
    [RECEIPT_FILE, packet.receiptBytes, 'AFTER_RECEIPT']
  ];
  let rootCreated = false;
  try {
    ensureFreshOwnedRoot(boundary);
    rootCreated = true;
    for (const [file, bytes, fault] of writes) {
      fs.writeFileSync(path.join(boundary.root, file), bytes, { flag: 'wx' });
      if (faultAt === fault) throw new Error('bounded injected schema compilation fault');
    }
    const readback = Object.fromEntries(writes.map(([file]) => [file, fs.readFileSync(path.join(boundary.root, file))]));
    writes.forEach(([file, bytes]) => {
      if (!readback[file].equals(bytes)) throw new Error('schema compilation readback byte drift: ' + file);
    });
    verifyCompilationArtifacts(
      JSON.parse(readback[RECEIPT_FILE].toString('utf8')),
      {
        [INPUT_SCHEMA_FILE]: readback[INPUT_SCHEMA_FILE],
        [OUTPUT_SCHEMA_FILE]: readback[OUTPUT_SCHEMA_FILE],
        [MATRIX_FILE]: readback[MATRIX_FILE]
      },
      input
    );
    return {
      inputSchema: packet.compiled.inputSchema,
      outputSchema: packet.compiled.outputSchema,
      matrix: packet.compiled.matrix,
      receipt: packet.receipt
    };
  } catch (error) {
    if (rootCreated) safeCleanupOwnedRoot(boundary);
    throw error;
  }
}

function buildExampleInput(blueprintBytes, compositionReceiptBytes) {
  const composerExample = Composer.buildExampleInput();
  const intent = composerExample.intent;
  const verified = parseVerifiedSource(intent, blueprintBytes, compositionReceiptBytes);
  const artifacts = inputArtifactRefs(verified.blueprint, blueprintBytes, compositionReceiptBytes);
  const subjectRef = compilationSubjectRef(verified, artifacts);
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'blueprint-schema-compilation-test-settings',
    validFrom: '2026-08-22T00:00:00.000Z',
    expiresAt: '2026-08-23T00:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [SUBJECT_SCHEMA],
      domainProfileSchemas: [PROFILE_SCHEMA],
      allowedActions: REQUIRED_ACTIONS.slice(),
      allowedPermissions: REQUIRED_PERMISSIONS.slice(),
      allowedNetworkDomains: [],
      allowedDataClasses: REQUIRED_DATA_CLASSES.slice(),
      allowedSourceUses: REQUIRED_SOURCE_USES.slice(),
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: {
        maxInputBytes: MAX_COMPILER_INPUT_BYTES,
        maxOutputBytes: MAX_WRITTEN_BYTES,
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
    id: 'blueprint-schema-compilation-test-instance',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef,
    domainProfileRef: profileRef(),
    predecisionEvidenceRefs: [{
      id: 'four-root-schema-compilation-policy-review',
      schema: 'axm.code-policy-bound-assurance-review/v1',
      sha256: sha256('schema-compilation-predecision-review-placeholder')
    }],
    inputArtifacts: artifacts,
    actions: REQUIRED_ACTIONS.slice(),
    permissions: REQUIRED_PERMISSIONS.slice(),
    networkDomains: [],
    dataClasses: REQUIRED_DATA_CLASSES.slice(),
    sourceUses: REQUIRED_SOURCE_USES.slice(),
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources: {
      maxInputBytes: MAX_COMPILER_INPUT_BYTES,
      maxOutputBytes: MAX_WRITTEN_BYTES,
      maxMemoryBytes: 134217728,
      maxDurationMs: 5000,
      maxProcesses: 1,
      maxAttempts: 1,
      maxCostMinorUnits: 0
    },
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T02:30:00.000Z',
    expiresAt: '2026-08-22T03:30:00.000Z',
    authority: 'NONE'
  });
  const consentEvaluationInput = { policy, instance, evaluatedAt: '2026-08-22T02:50:00.000Z' };
  return {
    intent,
    blueprintBytes,
    compositionReceiptBytes,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput),
    authorization: {
      mode: 'INTERACTIVE_SESSION_DECLARATION',
      scope: 'ONE_INERT_SCHEMA_PACKET',
      acknowledgement: ACKNOWLEDGEMENT,
      instructionRef: declarationRef()
    }
  };
}

module.exports = {
  VERSION,
  SUBJECT_SCHEMA,
  MATRIX_SCHEMA,
  RECEIPT_SCHEMA,
  PROFILE_SCHEMA,
  ACKNOWLEDGEMENT,
  DECLARATION_ID,
  DECLARATION_SCHEMA,
  ROOT_PREFIX,
  MAX_COMPILER_INPUT_BYTES,
  MAX_WRITTEN_FILES,
  MAX_WRITTEN_BYTES,
  INPUT_SCHEMA_FILE,
  OUTPUT_SCHEMA_FILE,
  MATRIX_FILE,
  RECEIPT_FILE,
  REQUIRED_ACTIONS,
  REQUIRED_PERMISSIONS,
  REQUIRED_DATA_CLASSES,
  REQUIRED_SOURCE_USES,
  REQUIRED_EVIDENCE_SCHEMAS,
  LIMITATIONS,
  NEXT_GAPS,
  PROFILE,
  canonicalJson,
  sha256,
  profileRef,
  declarationRef,
  compositionReceiptRef,
  inputArtifactRefs,
  compilationSubjectRef,
  prepare,
  buildInterfaceSchema,
  buildAcceptanceMatrix,
  normalizeAcceptanceMatrix,
  compileArtifacts,
  normalizeReceipt,
  expectedPacket,
  verifyCompilationArtifacts,
  emit,
  buildExampleInput
};
