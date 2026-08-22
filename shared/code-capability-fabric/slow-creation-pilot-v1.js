'use strict';

const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Nursery = require('../../tools/detached-candidate-nursery/core/nursery-core');

const VERSION = '0.1.0';
const INTENT_SCHEMA = 'axm.fabric-inert-creation-intent/v1';
const RECEIPT_SCHEMA = 'axm.fabric-creation-pilot-receipt/v1';
const PROFILE_SCHEMA = 'axm.fabric-inert-candidate-emitter-profile/v1';
const TEMPLATE = 'STATIC_HTML_MODULE_SHELL';
const ACKNOWLEDGEMENT = 'ONE INERT CANDIDATE ONLY';
const DECLARATION_ID = 'interactive-slow-creation-declaration';
const DECLARATION_SCHEMA = 'axm.interactive-pilot-declaration/v1';
const ROOT_PREFIX = 'axm-fabric-creation-pilot-';
const MAX_CANDIDATE_FILES = 6;
const MAX_OUTPUT_BYTES = 65536;
const CANDIDATE_FILE_PATHS = [
  'README.md',
  'candidate.receipt.json',
  'index.html',
  'manifest.json',
  'module-bundle.json',
  'module.contract.json'
];
const REQUIRED_ACTIONS = ['code.emit-inert-candidate'];
const REQUIRED_PERMISSIONS = ['candidate.output-write'];
const REQUIRED_DATA_CLASSES = ['public-instruction'];
const REQUIRED_SOURCE_USES = ['derive-concepts'];
const REQUIRED_EVIDENCE_SCHEMAS = [
  'axm.detached-candidate-record/v1',
  RECEIPT_SCHEMA
];
const LIMITATIONS = [
  'INTERACTIVE_DECLARATION_NOT_CRYPTOGRAPHIC_IDENTITY_PROOF',
  'INTERACTIVE_DECLARATION_REPLAY_NOT_PREVENTED',
  'PREDECISION_EVIDENCE_CONTENT_NOT_VERIFIED_BY_EMITTER',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'MACHINE_HOST_DEFAULT_NOT_ACTIVATED',
  'STATIC_TEMPLATE_ONLY',
  'RUNTIME_QUALITY_NOT_PROVEN',
  'RESOURCE_ENFORCEMENT_LIMITED_TO_FILE_COUNT_AND_BYTES',
  'PERSISTENT_LEARNING_NOT_ADMITTED'
];
const NEXT_GAPS = [
  'consent.human-decision.authenticate',
  'consent.declaration.replay-prevent',
  'consent.revocation.observe-live',
  'consent.trusted-clock.observe',
  'machine-host.fabric-create.fixed-action',
  'creation.semantic-candidate.generate',
  'creation.runtime-quality.verify',
  'learning.admission.decide'
];
const PROFILE = Object.freeze({
  schema: PROFILE_SCHEMA,
  id: 'fixed-static-module-shell',
  version: VERSION,
  template: TEMPLATE,
  maximumCandidateFiles: MAX_CANDIDATE_FILES,
  maximumCandidateBytes: MAX_OUTPUT_BYTES,
  sourceReads: 'DISABLED',
  network: 'DISABLED',
  childProcesses: 'DISABLED',
  generatedCodeExecution: 'DISABLED',
  outputScope: 'ONE_NEW_OWNED_ROOT',
  authority: 'DISPOSABLE_CANDIDATE_WRITE_ONLY'
});
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9.-]{1,127}$/;
const CANDIDATE_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const ROOT_NAME = /^axm-fabric-creation-pilot-[a-z0-9][a-z0-9-]{0,63}$/;

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

function strictText(value, label, maximum) {
  if (typeof value !== 'string' || !value.length || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)) {
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

function candidateId(value, label) {
  const result = strictText(value, label, 80);
  if (!CANDIDATE_ID.test(result)) throw new Error(label + ' is not a portable candidate identifier');
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

function normalizeIntentCore(value) {
  exactKeys(value, [
    'schema', 'id', 'name', 'purpose', 'capability', 'status', 'template',
    'authority'
  ], 'creation intent');
  if (value.schema !== INTENT_SCHEMA) throw new Error('creation intent schema mismatch');
  if (value.status !== 'EXPERIMENTAL') throw new Error('creation intent status must remain EXPERIMENTAL');
  if (value.template !== TEMPLATE) throw new Error('creation intent template is unsupported');
  if (value.authority !== 'NONE') throw new Error('creation intent authority must remain NONE');
  return {
    schema: INTENT_SCHEMA,
    id: candidateId(value.id, 'creation intent.id'),
    name: strictText(value.name, 'creation intent.name', 120),
    purpose: strictText(value.purpose, 'creation intent.purpose', 600),
    capability: identifier(value.capability, 'creation intent.capability'),
    status: 'EXPERIMENTAL',
    template: TEMPLATE,
    authority: 'NONE'
  };
}

function sealIntent(value) {
  const core = normalizeIntentCore(value);
  return { ...core, intentDigest: sha256(core) };
}

function normalizeIntent(value) {
  exactKeys(value, [
    'schema', 'id', 'name', 'purpose', 'capability', 'status', 'template',
    'authority', 'intentDigest'
  ], 'creation intent');
  const { intentDigest, ...candidateCore } = value;
  const sealed = sealIntent(candidateCore);
  if (sealed.intentDigest !== digest(intentDigest, 'creation intent.intentDigest')) {
    throw new Error('creation intent digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('creation intent is not in canonical normalized form');
  return sealed;
}

function intentRef(value) {
  const intent = normalizeIntent(value);
  return { id: intent.id, schema: intent.schema, sha256: intent.intentDigest };
}

function profileRef() {
  return { id: PROFILE.id, schema: PROFILE.schema, sha256: sha256(PROFILE) };
}

function declarationRef() {
  const declaration = {
    mode: 'INTERACTIVE_SESSION_DECLARATION',
    scope: 'ONE_INERT_CANDIDATE',
    acknowledgement: ACKNOWLEDGEMENT
  };
  return { id: DECLARATION_ID, schema: DECLARATION_SCHEMA, sha256: sha256(declaration) };
}

function normalizeAuthorization(value) {
  exactKeys(value, ['mode', 'scope', 'acknowledgement', 'instructionRef'], 'pilot authorization');
  if (value.mode !== 'INTERACTIVE_SESSION_DECLARATION') {
    throw new Error('pilot authorization.mode is unsupported');
  }
  if (value.scope !== 'ONE_INERT_CANDIDATE') {
    throw new Error('pilot authorization.scope must remain ONE_INERT_CANDIDATE');
  }
  if (value.acknowledgement !== ACKNOWLEDGEMENT) {
    throw new Error('pilot authorization exact acknowledgement is required');
  }
  const normalized = {
    mode: 'INTERACTIVE_SESSION_DECLARATION',
    scope: 'ONE_INERT_CANDIDATE',
    acknowledgement: ACKNOWLEDGEMENT,
    instructionRef: reference(value.instructionRef, 'pilot authorization.instructionRef')
  };
  if (!same(normalized.instructionRef, declarationRef())) {
    throw new Error('pilot authorization instruction reference does not bind the exact declaration');
  }
  return normalized;
}

function allFalseLifecycle(value) {
  return Consent.LIFECYCLE_FIELDS.every((field) => value[field] === false);
}

function prepare(input) {
  exactKeys(input, [
    'intent', 'consentEvaluationInput', 'consentEvaluation', 'authorization'
  ], 'creation pilot input');
  const intent = normalizeIntent(input.intent);
  const authorization = normalizeAuthorization(input.authorization);
  const evaluation = Consent.normalizeEvaluation(input.consentEvaluation);
  const verified = Consent.verifyEvaluation(evaluation, input.consentEvaluationInput);
  if (!verified.pass) throw new Error('grounded consent evaluation verification failed: ' + verified.errors.join('|'));
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    throw new Error('grounded consent scope must be hold-free before the pilot declaration');
  }
  const policy = Consent.normalizePolicy(input.consentEvaluationInput.policy);
  const instance = Consent.normalizeInstance(input.consentEvaluationInput.instance);
  if (!same(instance.subjectRef, intentRef(intent))) {
    throw new Error('grounded consent subject does not bind the exact creation intent');
  }
  if (instance.domain !== 'code') throw new Error('creation pilot consent domain must be code');
  if (!same(instance.domainProfileRef, profileRef())) {
    throw new Error('grounded consent domain profile does not bind the fixed emitter');
  }
  if (!same(instance.actions, REQUIRED_ACTIONS)) throw new Error('creation pilot action scope must be exact');
  if (!same(instance.permissions, REQUIRED_PERMISSIONS)) throw new Error('creation pilot permission scope must be exact');
  if (instance.networkDomains.length) throw new Error('creation pilot network must remain disabled');
  if (!same(instance.dataClasses, REQUIRED_DATA_CLASSES)) throw new Error('creation pilot data class must be exact');
  if (!same(instance.sourceUses, REQUIRED_SOURCE_USES)) throw new Error('creation pilot source use must be exact');
  if (!allFalseLifecycle(instance.lifecycle)) throw new Error('creation pilot lifecycle effects must remain false');
  if (instance.inputArtifacts.length) throw new Error('creation pilot cannot read input artifacts');
  if (!same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) {
    throw new Error('creation pilot evidence schemas must be exact');
  }
  if (instance.resources.maxAttempts !== 1 || instance.resources.maxProcesses !== 1 ||
    instance.resources.maxCostMinorUnits !== 0 ||
    instance.resources.maxOutputBytes > MAX_OUTPUT_BYTES) {
    throw new Error('creation pilot resource scope exceeds the fixed emitter profile');
  }
  return {
    intent,
    policy,
    instance,
    evaluation,
    authorization
  };
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function candidateReceipt(intent) {
  return {
    schema: Nursery.RECEIPT_SCHEMA,
    candidate: { id: intent.id, version: 'v0.1' },
    creation: {
      template: TEMPLATE,
      intentRef: intentRef(intent),
      declaredStatus: 'EXPERIMENTAL',
      humanReviewRequired: true
    },
    authority: {
      installed: false,
      registered: false,
      staged: false,
      promoted: false,
      canonChanged: false,
      permissionsChanged: false
    },
    truth: {
      generatedCodeExecuted: false,
      runtimeQualityProven: false,
      visualApprovalProven: false
    }
  };
}

function buildCandidateFiles(intentValue) {
  const intent = normalizeIntent(intentValue);
  const manifest = {
    schema: 'axm.tool-manifest/v1',
    id: intent.id,
    name: intent.name,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: 'index.html',
    contract: 'module.contract.json',
    kind: 'candidate-module-shell',
    uses: [],
    permissions: [],
    summary: intent.purpose
  };
  const contract = {
    schema: Nursery.CONTRACT_SCHEMA,
    id: intent.id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    provides: [intent.capability],
    consumes: [],
    permissions: [],
    handoffs: { emits: [], accepts: [] },
    rootsGate: Consent.ROOTS_GATE.slice(),
    lifecycle: {
      state_owner: 'none',
      reload: 'reset',
      disconnect: 'not-applicable',
      cleanup: 'explicit'
    },
    boundaries: {
      writes: [],
      refuses: [
        'generated-code-execution',
        'network-use',
        'permission-grant',
        'automatic-install',
        'automatic-promotion',
        'automatic-canon'
      ]
    }
  };
  const html = Buffer.from(
    '<!doctype html>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + htmlEscape(intent.name) + '</title>\n' +
    '<main>\n' +
    '  <h1>' + htmlEscape(intent.name) + '</h1>\n' +
    '  <p>' + htmlEscape(intent.purpose) + '</p>\n' +
    '  <p>Status: EXPERIMENTAL candidate data. No script is included or executed.</p>\n' +
    '</main>\n',
    'utf8'
  );
  const readme = Buffer.from(
    '# ' + intent.name + '\n\n' +
    'Status: `EXPERIMENTAL`\n\n' +
    intent.purpose + '\n\n' +
    'This fixed-template candidate was emitted as inert data for structural review. ' +
    'It is not installed, executed, promoted, or CANON.\n',
    'utf8'
  );
  const files = [
    { path: 'candidate.receipt.json', bytes: jsonBytes(candidateReceipt(intent)) },
    { path: 'index.html', bytes: html },
    { path: 'manifest.json', bytes: jsonBytes(manifest) },
    { path: 'module.contract.json', bytes: jsonBytes(contract) },
    { path: 'README.md', bytes: readme }
  ].sort((left, right) => compareText(left.path, right.path));
  const bundle = {
    schema: Nursery.BUNDLE_SCHEMA,
    requiredSeats: 1,
    files: files.map((file) => ({
      path: file.path,
      encoding: 'base64',
      content: file.bytes.toString('base64'),
      sha256: Nursery.sha256(file.bytes)
    }))
  };
  files.push({ path: 'module-bundle.json', bytes: jsonBytes(bundle) });
  files.sort((left, right) => compareText(left.path, right.path));
  if (files.length !== MAX_CANDIDATE_FILES) throw new Error('fixed candidate file count drifted');
  const totalBytes = files.reduce((sum, file) => sum + file.bytes.length, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_OUTPUT_BYTES) {
    throw new Error('fixed candidate exceeds output byte ceiling');
  }
  return { intent, files, totalBytes };
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function validateNewRoot(allowedParentInput, rootNameInput) {
  const allowedParent = String(allowedParentInput || '');
  if (!allowedParent || !path.isAbsolute(allowedParent)) {
    throw new Error('allowed parent must be an absolute path');
  }
  if (path.resolve(allowedParent) !== allowedParent) {
    throw new Error('allowed parent must use its exact canonical path spelling');
  }
  const rootName = String(rootNameInput || '');
  if (!ROOT_NAME.test(rootName) || !rootName.startsWith(ROOT_PREFIX)) {
    throw new Error('creation root name must use the fixed pilot prefix');
  }
  let parentStat;
  try {
    parentStat = fs.lstatSync(allowedParent);
  } catch (error) {
    throw new Error('allowed parent must already exist');
  }
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('allowed parent must be a real directory, not a link');
  }
  const realParent = fs.realpathSync(allowedParent);
  if (realParent !== allowedParent) {
    throw new Error('allowed parent must be supplied through its canonical path');
  }
  const root = path.join(realParent, rootName);
  if (!samePath(path.dirname(root), realParent)) throw new Error('creation root escaped the allowed parent');
  if (fs.existsSync(root)) throw new Error('creation root must not already exist');
  return { parent: realParent, root, rootName };
}

function fileRef(file) {
  return {
    path: file.path,
    sha256: sha256(file.bytes),
    byteLength: file.bytes.length
  };
}

function evaluationRef(evaluation, intent) {
  return {
    id: intent.id + '-consent-evaluation',
    schema: evaluation.schema,
    sha256: evaluation.evaluationDigest
  };
}

function sealReceipt(core) {
  return { ...core, receiptDigest: sha256(core) };
}

function normalizeReceipt(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'intentRef', 'consentEvaluationRef',
    'instructionRef', 'emitterProfileRef', 'candidate', 'candidateFiles',
    'nurseryRecordDigest', 'nurseryStatus', 'resourceObservation', 'limitations',
    'nextImprovementGaps', 'truth', 'authority', 'receiptDigest'
  ], 'creation pilot receipt');
  if (value.schema !== RECEIPT_SCHEMA) throw new Error('creation pilot receipt schema mismatch');
  if (value.version !== VERSION) throw new Error('creation pilot receipt version mismatch');
  if (value.status !== 'CANDIDATE_EMITTED_FOR_REVIEW') throw new Error('creation pilot receipt status mismatch');
  if (!same(value.limitations, LIMITATIONS)) throw new Error('creation pilot receipt limitations drifted');
  if (!same(value.nextImprovementGaps, NEXT_GAPS)) throw new Error('creation pilot receipt gaps drifted');
  if (value.authority !== 'DISPOSABLE_CANDIDATE_WRITE_ONLY_USED') {
    throw new Error('creation pilot receipt authority mismatch');
  }
  exactKeys(value.candidate, ['id', 'version', 'status'], 'creation pilot receipt.candidate');
  if (value.candidate.status !== 'EXPERIMENTAL' || value.candidate.version !== 'v0.1') {
    throw new Error('creation pilot receipt candidate status or version mismatch');
  }
  if (!Array.isArray(value.candidateFiles)) {
    throw new Error('creation pilot receipt candidate files must be an array');
  }
  const candidateFiles = value.candidateFiles.map((item, index) => {
    exactKeys(item, ['path', 'sha256', 'byteLength'], 'creation pilot receipt.candidateFiles[' + index + ']');
    if (!Number.isSafeInteger(item.byteLength) || item.byteLength < 0) {
      throw new Error('creation pilot receipt candidate byte length invalid');
    }
    return {
      path: Nursery.safeRelative(item.path),
      sha256: digest(item.sha256, 'creation pilot receipt.candidateFiles[' + index + '].sha256'),
      byteLength: item.byteLength
    };
  }).sort((left, right) => compareText(left.path, right.path));
  if (!same(candidateFiles.map((item) => item.path), CANDIDATE_FILE_PATHS)) {
    throw new Error('creation pilot receipt candidate files are not the fixed exact set');
  }
  exactKeys(value.resourceObservation, [
    'candidateFileCount', 'candidateBytes', 'fileCountEnforced',
    'byteCeilingEnforced', 'durationEnforced', 'memoryEnforced'
  ], 'creation pilot receipt.resourceObservation');
  const expectedResource = {
    candidateFileCount: MAX_CANDIDATE_FILES,
    candidateBytes: candidateFiles.reduce((sum, item) => sum + item.byteLength, 0),
    fileCountEnforced: true,
    byteCeilingEnforced: true,
    durationEnforced: false,
    memoryEnforced: false
  };
  if (expectedResource.candidateBytes > MAX_OUTPUT_BYTES) {
    throw new Error('creation pilot receipt candidate bytes exceed the fixed ceiling');
  }
  if (!same(value.resourceObservation, expectedResource)) {
    throw new Error('creation pilot receipt resource observation mismatch');
  }
  const truthFields = [
    'fabricFirstGateApplied', 'interactiveDeclarationSupplied',
    'interactiveDeclarationReplayPrevented',
    'cryptographicHumanAuthenticationVerified', 'predecisionEvidenceContentVerified',
    'trustedClockObserved', 'liveRevocationChecked', 'emitterWriteAuthorityUsed',
    'fabricGrantedAuthority', 'candidateFilesWritten', 'candidateFilesReadBack',
    'candidateStructureInspected', 'sourceContentRead', 'networkUsed',
    'childProcessSpawned', 'candidateCodeExecuted', 'runtimeQualityProven',
    'visualApprovalProven', 'machineDefaultActivated', 'persistentLearningAdmitted',
    'installed', 'registered', 'staged', 'promoted', 'canonChanged', 'filesRetained'
  ];
  exactKeys(value.truth, truthFields, 'creation pilot receipt.truth');
  const expectedTrue = new Set([
    'fabricFirstGateApplied', 'interactiveDeclarationSupplied',
    'emitterWriteAuthorityUsed', 'candidateFilesWritten', 'candidateFilesReadBack',
    'candidateStructureInspected', 'filesRetained'
  ]);
  for (const field of truthFields) {
    if (value.truth[field] !== expectedTrue.has(field)) {
      throw new Error('creation pilot receipt.truth.' + field + ' violates the pilot truth ceiling');
    }
  }
  const core = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: 'CANDIDATE_EMITTED_FOR_REVIEW',
    intentRef: reference(value.intentRef, 'creation pilot receipt.intentRef'),
    consentEvaluationRef: reference(value.consentEvaluationRef, 'creation pilot receipt.consentEvaluationRef'),
    instructionRef: reference(value.instructionRef, 'creation pilot receipt.instructionRef'),
    emitterProfileRef: reference(value.emitterProfileRef, 'creation pilot receipt.emitterProfileRef'),
    candidate: {
      id: candidateId(value.candidate.id, 'creation pilot receipt.candidate.id'),
      version: 'v0.1',
      status: 'EXPERIMENTAL'
    },
    candidateFiles,
    nurseryRecordDigest: digest(value.nurseryRecordDigest, 'creation pilot receipt.nurseryRecordDigest'),
    nurseryStatus: value.nurseryStatus,
    resourceObservation: expectedResource,
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: clone(value.truth),
    authority: 'DISPOSABLE_CANDIDATE_WRITE_ONLY_USED'
  };
  if (core.intentRef.schema !== INTENT_SCHEMA || core.candidate.id !== core.intentRef.id) {
    throw new Error('creation pilot receipt candidate does not bind the intent reference');
  }
  if (core.consentEvaluationRef.id !== core.candidate.id + '-consent-evaluation' ||
    core.consentEvaluationRef.schema !== Consent.EVALUATION_SCHEMA) {
    throw new Error('creation pilot receipt consent evaluation reference mismatch');
  }
  if (!same(core.instructionRef, declarationRef())) {
    throw new Error('creation pilot receipt instruction reference mismatch');
  }
  if (!same(core.emitterProfileRef, profileRef())) {
    throw new Error('creation pilot receipt emitter profile reference mismatch');
  }
  if (core.nurseryStatus !== 'READY_FOR_LATER_INTAKE') {
    throw new Error('creation pilot receipt nursery status is not structurally ready');
  }
  const receiptDigest = digest(value.receiptDigest, 'creation pilot receipt.receiptDigest');
  if (sha256(core) !== receiptDigest) throw new Error('creation pilot receipt digest mismatch');
  const normalized = { ...core, receiptDigest };
  if (!same(normalized, value)) throw new Error('creation pilot receipt is not in canonical normalized form');
  return normalized;
}

function safeCleanupOwnedRoot(boundary) {
  if (!boundary || !ROOT_NAME.test(boundary.rootName) ||
    !samePath(path.dirname(boundary.root), boundary.parent) ||
    !samePath(boundary.root, path.join(boundary.parent, boundary.rootName))) {
    throw new Error('owned creation root cleanup boundary refused');
  }
  if (fs.existsSync(boundary.root)) fs.rmSync(boundary.root, { recursive: true, force: true });
}

function emit(input, options) {
  const prepared = prepare(input);
  exactKeys(options, ['allowedParent', 'rootName', 'faultAt'], 'creation pilot options');
  const faultAt = options.faultAt == null ? null : String(options.faultAt);
  if (faultAt !== null && faultAt !== 'AFTER_FIRST_FILE' && faultAt !== 'AFTER_CANDIDATE_FILES') {
    throw new Error('creation pilot fault injection is unsupported');
  }
  const boundary = validateNewRoot(options.allowedParent, options.rootName);
  const built = buildCandidateFiles(prepared.intent);
  if (built.totalBytes > prepared.instance.resources.maxOutputBytes) {
    throw new Error('candidate bytes exceed consented output budget');
  }
  const candidateRoot = path.join(boundary.root, prepared.intent.id);
  let rootCreated = false;
  try {
    fs.mkdirSync(boundary.root);
    rootCreated = true;
    fs.mkdirSync(candidateRoot);
    built.files.forEach((file, index) => {
      fs.writeFileSync(path.join(candidateRoot, file.path), file.bytes, { flag: 'wx' });
      if (faultAt === 'AFTER_FIRST_FILE' && index === 0) throw new Error('bounded injected creation pilot fault');
    });
    if (faultAt === 'AFTER_CANDIDATE_FILES') throw new Error('bounded injected creation pilot fault');
    for (const file of built.files) {
      const readback = fs.readFileSync(path.join(candidateRoot, file.path));
      if (!readback.equals(file.bytes)) throw new Error('candidate readback byte drift: ' + file.path);
    }
    const nurseryRecord = Nursery.inspectCandidate(candidateRoot, prepared.intent.id);
    if (nurseryRecord.status !== 'READY_FOR_LATER_INTAKE' || nurseryRecord.errors.length) {
      throw new Error('detached Nursery rejected emitted candidate structure');
    }
    const core = {
      schema: RECEIPT_SCHEMA,
      version: VERSION,
      status: 'CANDIDATE_EMITTED_FOR_REVIEW',
      intentRef: intentRef(prepared.intent),
      consentEvaluationRef: evaluationRef(prepared.evaluation, prepared.intent),
      instructionRef: prepared.authorization.instructionRef,
      emitterProfileRef: profileRef(),
      candidate: { id: prepared.intent.id, version: 'v0.1', status: 'EXPERIMENTAL' },
      candidateFiles: built.files.map(fileRef).sort((left, right) => compareText(left.path, right.path)),
      nurseryRecordDigest: sha256(nurseryRecord),
      nurseryStatus: nurseryRecord.status,
      resourceObservation: {
        candidateFileCount: built.files.length,
        candidateBytes: built.totalBytes,
        fileCountEnforced: true,
        byteCeilingEnforced: true,
        durationEnforced: false,
        memoryEnforced: false
      },
      limitations: LIMITATIONS.slice(),
      nextImprovementGaps: NEXT_GAPS.slice(),
      truth: {
        fabricFirstGateApplied: true,
        interactiveDeclarationSupplied: true,
        interactiveDeclarationReplayPrevented: false,
        cryptographicHumanAuthenticationVerified: false,
        predecisionEvidenceContentVerified: false,
        trustedClockObserved: false,
        liveRevocationChecked: false,
        emitterWriteAuthorityUsed: true,
        fabricGrantedAuthority: false,
        candidateFilesWritten: true,
        candidateFilesReadBack: true,
        candidateStructureInspected: true,
        sourceContentRead: false,
        networkUsed: false,
        childProcessSpawned: false,
        candidateCodeExecuted: false,
        runtimeQualityProven: false,
        visualApprovalProven: false,
        machineDefaultActivated: false,
        persistentLearningAdmitted: false,
        installed: false,
        registered: false,
        staged: false,
        promoted: false,
        canonChanged: false,
        filesRetained: true
      },
      authority: 'DISPOSABLE_CANDIDATE_WRITE_ONLY_USED'
    };
    const receipt = normalizeReceipt(sealReceipt(core));
    const receiptFile = path.join(boundary.root, 'pilot-receipt.json');
    fs.writeFileSync(receiptFile, jsonBytes(receipt), { flag: 'wx' });
    const receiptReadback = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    normalizeReceipt(receiptReadback);
    return receipt;
  } catch (error) {
    if (rootCreated) safeCleanupOwnedRoot(boundary);
    throw error;
  }
}

function buildExampleInput() {
  const intent = sealIntent({
    schema: INTENT_SCHEMA,
    id: 'modular-capability-observation-card',
    name: 'Modular Capability Observation Card',
    purpose: 'Record one small deterministic capability experiment without installation, execution, promotion, or CANON authority.',
    capability: 'modular-capability-observation',
    status: 'EXPERIMENTAL',
    template: TEMPLATE,
    authority: 'NONE'
  });
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'slow-creation-pilot-settings',
    validFrom: '2026-08-22T00:00:00.000Z',
    expiresAt: '2026-08-23T00:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [INTENT_SCHEMA],
      domainProfileSchemas: [PROFILE_SCHEMA],
      allowedActions: REQUIRED_ACTIONS.slice(),
      allowedPermissions: REQUIRED_PERMISSIONS.slice(),
      allowedNetworkDomains: [],
      allowedDataClasses: REQUIRED_DATA_CLASSES.slice(),
      allowedSourceUses: REQUIRED_SOURCE_USES.slice(),
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: {
        maxInputBytes: 8192,
        maxOutputBytes: MAX_OUTPUT_BYTES,
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
    id: 'slow-creation-pilot-instance',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: intentRef(intent),
    domainProfileRef: profileRef(),
    predecisionEvidenceRefs: [{
      id: 'four-root-policy-review',
      schema: 'axm.code-policy-bound-assurance-review/v1',
      sha256: sha256('slow-creation-pilot-predecision-review-placeholder')
    }],
    inputArtifacts: [],
    actions: REQUIRED_ACTIONS.slice(),
    permissions: REQUIRED_PERMISSIONS.slice(),
    networkDomains: [],
    dataClasses: REQUIRED_DATA_CLASSES.slice(),
    sourceUses: REQUIRED_SOURCE_USES.slice(),
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources: {
      maxInputBytes: 8192,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      maxMemoryBytes: 134217728,
      maxDurationMs: 5000,
      maxProcesses: 1,
      maxAttempts: 1,
      maxCostMinorUnits: 0
    },
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T01:30:00.000Z',
    expiresAt: '2026-08-22T02:00:00.000Z',
    authority: 'NONE'
  });
  const consentEvaluationInput = {
    policy,
    instance,
    evaluatedAt: '2026-08-22T01:35:00.000Z'
  };
  return {
    intent,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput),
    authorization: {
      mode: 'INTERACTIVE_SESSION_DECLARATION',
      scope: 'ONE_INERT_CANDIDATE',
      acknowledgement: ACKNOWLEDGEMENT,
      instructionRef: {
        ...declarationRef()
      }
    }
  };
}

module.exports = {
  VERSION,
  INTENT_SCHEMA,
  RECEIPT_SCHEMA,
  PROFILE_SCHEMA,
  TEMPLATE,
  ACKNOWLEDGEMENT,
  DECLARATION_ID,
  DECLARATION_SCHEMA,
  ROOT_PREFIX,
  MAX_CANDIDATE_FILES,
  MAX_OUTPUT_BYTES,
  CANDIDATE_FILE_PATHS,
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
  sealIntent,
  normalizeIntent,
  intentRef,
  profileRef,
  declarationRef,
  prepare,
  buildCandidateFiles,
  validateNewRoot,
  emit,
  normalizeReceipt,
  buildExampleInput,
  clone
};
