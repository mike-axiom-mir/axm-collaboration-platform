'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const CloneRoleSteward = require('./clone-role-steward-organ');

const ORGAN_ID = 'axm.mirror.organ/outward-clone-service-router-v1';
const REGISTRY_SCHEMA = 'axm.mirror.outward-clone-service-registry/v1';
const REQUEST_SCHEMA = 'axm.mirror.outward-clone-service-request/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.outward-clone-service-assessment/v1';
const REGISTRY_PATH = 'lineage/outward-clone-service-registry-v1.json';
const ROLE_IDS = Object.freeze(['repairbuddy', 'future-code-mirror', 'mirror-code-clone-v0.2', 'english-learner-mirror', 'game-tester-mirror']);
const ROLE_CLASSES = Object.freeze(['STABILITY_REPAIR', 'CAPABILITY_STORY_INNOVATION', 'HISTORICAL_ROLE_MISMATCH', 'LANGUAGE_LEARNING_SPECIALIST', 'GAME_TESTING_SPECIALIST']);
const SERVICE_KINDS = Object.freeze(['STABILITY_REPAIR_PROPOSAL', 'CAPABILITY_STORY_INNOVATION_PROPOSAL', 'PRESERVE_EVIDENCE_ONLY', 'ENGLISH_LESSON_OR_EVIDENCE_REQUEST', 'GAME_TEST_MISSION_PROPOSAL']);
const TARGET_KINDS = Object.freeze(['CODEBASE_PROPOSAL_ONLY', 'DISPOSABLE_CODE_LAB', 'EVIDENCE_ARCHIVE', 'LANGUAGE_DATA', 'GAME_PACKAGE', 'DECLARATIVE_FIXTURE']);
const BENEFICIARY_KINDS = Object.freeze(['HUMAN', 'EXTERNAL_MACHINE', 'PARENT_MIRROR', 'UNKNOWN']);
const INPUT_KINDS = Object.freeze(['CLONE_ROLE_ASSESSMENT', 'SPECIALIST_REQUEST', 'LESSON_SOURCE', 'GAME_MANIFEST', 'MISSION_REQUEST', 'EVIDENCE_PACK', 'HUMAN_DIRECTION']);
const AUTHORITY_KEYS = Object.freeze(['executeService', 'targetRead', 'ephemeralTargetMutation', 'targetSourceWrite', 'targetPersistentWrite', 'parentMirrorReadPrivate', 'parentMirrorWrite', 'toolUse', 'network', 'permissionGrant', 'installation', 'promotion', 'canon', 'worldAction']);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const ASSESSMENT_STATES = Object.freeze([
  'ROUTE_PROPOSAL_ONLY_READY_FOR_SPECIALIST_HANDLER_REVIEW',
  'PRESERVATION_ROUTE_ONLY',
  'HOLD_REGISTRY_LINEAGE_DIVERGED',
  'HOLD_UNKNOWN_CLONE',
  'HOLD_CROSS_ROLE_SERVICE',
  'HOLD_TARGET_KIND_MISMATCH',
  'HOLD_PARENT_AS_DIRECT_BENEFICIARY',
  'HOLD_BENEFICIARY_UNKNOWN',
  'HOLD_RETURN_PATH_UNSAFE',
  'HOLD_REQUIRED_INPUT_KIND_MISSING',
  'REFUSED_REQUESTED_AUTHORITY'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function digest(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function without(value, ...keys) { const copy = clone(value); for (const key of keys) delete copy[key]; return copy; }

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function boundedText(value, label, maximum = 500, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum || /[\u0000-\u001f]/.test(value)) throw new Error(`${label} is invalid`);
  return value.trim();
}

function identifier(value, label, maximum = 180) {
  const output = boundedText(value, label, maximum);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(output) || output.includes('..')) throw new Error(`${label} is invalid`);
  return output;
}

function sha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value || ''))) throw new Error(`${label} must be sha256`);
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its bound`);
  return value;
}

function inside(root, target) {
  const relation = path.relative(path.resolve(root), path.resolve(target));
  return !!relation && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
}

function exactAuthority(value, label) {
  exactKeys(value, AUTHORITY_KEYS, label);
  for (const key of AUTHORITY_KEYS) if (typeof value[key] !== 'boolean') throw new Error(`${label}.${key} must be boolean`);
  return stable(value);
}

function zeroAuthority(value, label) {
  const authority = exactAuthority(value, label);
  if (Object.values(authority).some(Boolean)) throw new Error(`${label} gained authority`);
  return authority;
}

function exactStringArray(value, allowed, label, minimum = 1, maximum = 16) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some(item => typeof item !== 'string' || !allowed.includes(item)) || new Set(value).size !== value.length) throw new Error(`${label} is invalid`);
  return value.slice();
}

function normalizeRegistry(value, allowUnsealed = false) {
  const registry = stable(value);
  exactKeys(registry, ['schema', 'registryId', 'registryDigest', 'status', 'recordedAt', 'humanDirection', 'evidence', 'roles', 'handContract', 'authority', 'boundary'], 'outward clone service registry');
  if (registry.schema !== REGISTRY_SCHEMA || registry.status !== 'TEST' || registry.recordedAt !== '2026-08-10') throw new Error('outward clone service registry identity changed');
  if (allowUnsealed) {
    if (registry.registryId !== null || registry.registryDigest !== null) throw new Error('unsealed outward registry must use null identity');
  } else {
    if (!/^outward-clone-service-registry-[a-f0-9]{20}$/.test(registry.registryId || '')) throw new Error('outward registry id is invalid');
    sha(registry.registryDigest, 'outward registry digest');
  }
  exactKeys(registry.humanDirection, ['declaredBy', 'statements', 'canonAccepted'], 'outward registry human direction');
  if (registry.humanDirection.declaredBy !== 'Mike' || registry.humanDirection.canonAccepted !== false || !Array.isArray(registry.humanDirection.statements) || registry.humanDirection.statements.length !== 2) throw new Error('outward registry human direction changed');
  registry.humanDirection.statements = registry.humanDirection.statements.map((item, index) => boundedText(item, `human direction ${index}`, 500));
  if (!Array.isArray(registry.evidence) || registry.evidence.length !== 4) throw new Error('outward registry evidence count changed');
  const evidenceIds = new Set();
  registry.evidence = registry.evidence.map((item, index) => {
    exactKeys(item, ['evidenceId', 'path', 'sha256', 'assertion'], `outward registry evidence ${index}`);
    const evidenceId = identifier(item.evidenceId, `evidence ${index} id`);
    if (evidenceIds.has(evidenceId)) throw new Error('outward registry evidence id is duplicated');
    evidenceIds.add(evidenceId);
    const evidencePath = boundedText(item.path, `evidence ${index} path`, 300);
    if (!/^[A-Za-z0-9._/-]+$/.test(evidencePath) || evidencePath.includes('..')) throw new Error('outward registry evidence path is unsafe');
    return { evidenceId, path: evidencePath, sha256: sha(item.sha256, `evidence ${index} digest`), assertion: identifier(item.assertion, `evidence ${index} assertion`, 120) };
  });
  if (!Array.isArray(registry.roles) || registry.roles.length !== ROLE_IDS.length) throw new Error('outward registry must contain exactly five roles');
  const roleIds = new Set();
  registry.roles = registry.roles.map((role, index) => {
    exactKeys(role, ['cloneId', 'displayName', 'status', 'roleClass', 'purpose', 'serviceKind', 'targetKinds', 'requiredInputKinds', 'evidenceIds', 'handlerBuiltState', 'directParentBeneficiaryAllowed', 'automaticReturnAllowed', 'authority', 'limitations'], `outward role ${index}`);
    const cloneId = identifier(role.cloneId, `role ${index} cloneId`, 100);
    if (!ROLE_IDS.includes(cloneId) || roleIds.has(cloneId)) throw new Error('outward registry role identity is unknown or duplicated');
    roleIds.add(cloneId);
    if (!['TEST', 'NEEDS_REVIEW', 'EXPERIMENTAL'].includes(role.status) || !ROLE_CLASSES.includes(role.roleClass) || !SERVICE_KINDS.includes(role.serviceKind)) throw new Error(`outward role ${cloneId} classification changed`);
    const normalized = {
      cloneId,
      displayName: boundedText(role.displayName, `${cloneId} displayName`, 140),
      status: role.status,
      roleClass: role.roleClass,
      purpose: boundedText(role.purpose, `${cloneId} purpose`, 700),
      serviceKind: role.serviceKind,
      targetKinds: exactStringArray(role.targetKinds, TARGET_KINDS, `${cloneId} targetKinds`, 1, 4),
      requiredInputKinds: exactStringArray(role.requiredInputKinds, INPUT_KINDS, `${cloneId} requiredInputKinds`, 1, 6),
      evidenceIds: role.evidenceIds.map(item => identifier(item, `${cloneId} evidenceId`, 180)),
      handlerBuiltState: identifier(role.handlerBuiltState, `${cloneId} handlerBuiltState`, 180),
      directParentBeneficiaryAllowed: role.directParentBeneficiaryAllowed,
      automaticReturnAllowed: role.automaticReturnAllowed,
      authority: zeroAuthority(role.authority, `${cloneId} authority`),
      limitations: role.limitations.map((item, limitIndex) => boundedText(item, `${cloneId} limitation ${limitIndex}`, 600))
    };
    if (normalized.evidenceIds.length < 1 || new Set(normalized.evidenceIds).size !== normalized.evidenceIds.length || normalized.evidenceIds.some(item => !evidenceIds.has(item))) throw new Error(`${cloneId} evidence binding is invalid`);
    if (typeof normalized.directParentBeneficiaryAllowed !== 'boolean' || normalized.directParentBeneficiaryAllowed !== false || typeof normalized.automaticReturnAllowed !== 'boolean' || normalized.automaticReturnAllowed !== false) throw new Error(`${cloneId} outward boundary changed`);
    if (!normalized.limitations.length) throw new Error(`${cloneId} limitations are empty`);
    return normalized;
  });
  const expectedRoles = {
    repairbuddy: ['STABILITY_REPAIR', 'STABILITY_REPAIR_PROPOSAL'],
    'future-code-mirror': ['CAPABILITY_STORY_INNOVATION', 'CAPABILITY_STORY_INNOVATION_PROPOSAL'],
    'mirror-code-clone-v0.2': ['HISTORICAL_ROLE_MISMATCH', 'PRESERVE_EVIDENCE_ONLY'],
    'english-learner-mirror': ['LANGUAGE_LEARNING_SPECIALIST', 'ENGLISH_LESSON_OR_EVIDENCE_REQUEST'],
    'game-tester-mirror': ['GAME_TESTING_SPECIALIST', 'GAME_TEST_MISSION_PROPOSAL']
  };
  for (const [cloneId, [roleClass, serviceKind]] of Object.entries(expectedRoles)) {
    const role = registry.roles.find(item => item.cloneId === cloneId);
    if (!role || role.roleClass !== roleClass || role.serviceKind !== serviceKind) throw new Error(`${cloneId} outward service separation changed`);
  }
  exactKeys(registry.handContract, ['capabilityIds', 'inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget', 'failureRecovery', 'compatibility', 'verification', 'promotionGate'], 'outward router hand contract');
  registry.handContract.capabilityIds = exactStringArray(registry.handContract.capabilityIds, ['clone.service.outward-envelope.route', 'clone.service.specialist.role-align', 'clone.service.parent-beneficiary.refuse', 'clone.service.return-path.review-only'], 'outward router capabilityIds', 4, 4);
  for (const key of ['inputs', 'outputs', 'sideEffects', 'permissions', 'failureRecovery', 'compatibility', 'verification']) {
    if (!Array.isArray(registry.handContract[key]) || !registry.handContract[key].length || registry.handContract[key].length > 16) throw new Error(`outward router hand contract ${key} is invalid`);
    registry.handContract[key] = registry.handContract[key].map((item, index) => boundedText(item, `hand contract ${key} ${index}`, 500));
  }
  exactKeys(registry.handContract.resourceBudget, ['maxInputBytes', 'maxInputRefs', 'maxArtifacts', 'maxDurationMs', 'externalActions'], 'outward router resource budget');
  integer(registry.handContract.resourceBudget.maxInputBytes, 'maxInputBytes', 1, 1048576);
  integer(registry.handContract.resourceBudget.maxInputRefs, 'maxInputRefs', 1, 32);
  integer(registry.handContract.resourceBudget.maxArtifacts, 'maxArtifacts', 0, 64);
  integer(registry.handContract.resourceBudget.maxDurationMs, 'maxDurationMs', 1, 600000);
  if (registry.handContract.resourceBudget.externalActions !== 0) throw new Error('outward router resource budget gained external actions');
  registry.handContract.promotionGate = boundedText(registry.handContract.promotionGate, 'outward router promotion gate', 700);
  registry.authority = zeroAuthority(registry.authority, 'outward registry authority');
  registry.boundary = boundedText(registry.boundary, 'outward registry boundary', 2000);
  return stable(registry);
}

function sealRegistry(draft) {
  const registry = normalizeRegistry(Object.assign({}, clone(draft), { registryId: null, registryDigest: null }), true);
  const bodyDigest = digest(without(registry, 'registryId', 'registryDigest'));
  registry.registryId = `outward-clone-service-registry-${bodyDigest.slice(0, 20)}`;
  registry.registryDigest = bodyDigest;
  return stable(registry);
}

function validateRegistry(value) {
  const registry = normalizeRegistry(value, false);
  const expected = sealRegistry(registry);
  if (JSON.stringify(registry) !== JSON.stringify(expected)) throw new Error('outward clone service registry content address changed');
  return registry;
}

function semanticEvidence(assertion, bytes) {
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch (_) { return false; }
  if (assertion === 'BASE_CLONE_ROLE_REGISTRY_V1') {
    try { CloneRoleSteward.validateRegistry(value); return value.roles.length === 3; } catch (_) { return false; }
  }
  if (assertion === 'ENGLISH_SPECIALIST_SETTINGS') {
    return value.schema === 'axm.mirror.specialist-mirror-settings/v1' && value.specialistId === 'english-learner-mirror' && value.enabled === true && value.limits.includes('NO_AUTOMATIC_RETURN_PATH_TO_MIRROR') && value.authority.writeMirror === false && value.authority.worldAction === false;
  }
  if (assertion === 'GAME_TESTER_SPECIALIST_SETTINGS') {
    return value.schema === 'axm.mirror.specialist-mirror-settings/v1' && value.specialistId === 'game-tester-mirror' && value.enabled === true && value.limits.includes('NO_AUTOMATIC_RETURN_PATH_TO_MIRROR') && value.limits.includes('NO_WRITE_TO_TESTED_TARGET') && value.authority.writeMirror === false && value.authority.worldAction === false;
  }
  if (assertion === 'GAME_TESTER_BEHAVIORAL_EXAM_PACK') {
    return value.schema === 'axm.mirror.game-tester-mission-behavioral-exam-pack/v1' && value.candidate && value.candidate.organId === 'axm.mirror.organ/game-tester-mission-compiler-v1' && value.authorship && value.authorship.relationToCandidateBuilder === 'SAME_BUILDER' && value.authority && Object.values(value.authority).every(item => item === false);
  }
  return false;
}

function inspectRegistry(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const registryFile = path.resolve(root, options.registryPath || REGISTRY_PATH);
  if (!inside(root, registryFile) || !fs.existsSync(registryFile)) throw new Error('outward registry is missing or outside Mirror');
  const stat = fs.lstatSync(registryFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('outward registry must be one bounded ordinary file');
  const registryBytes = fs.readFileSync(registryFile);
  const registry = validateRegistry(JSON.parse(registryBytes.toString('utf8')));
  const checks = [];
  for (const ref of registry.evidence) {
    const file = path.resolve(root, ref.path);
    let state = 'PASS';
    let observedSha256 = null;
    let reason = null;
    if (!inside(root, file) || !fs.existsSync(file)) { state = 'HOLD_EVIDENCE_MISSING'; reason = 'evidence file is missing or outside Mirror'; }
    else {
      const evidenceStat = fs.lstatSync(file);
      if (!evidenceStat.isFile() || evidenceStat.isSymbolicLink() || evidenceStat.size > 2 * 1024 * 1024) { state = 'HOLD_EVIDENCE_NOT_ORDINARY_FILE'; reason = 'evidence must be one bounded ordinary file'; }
      else {
        const bytes = fs.readFileSync(file);
        observedSha256 = digest(bytes);
        if (observedSha256 !== ref.sha256) { state = 'HOLD_EVIDENCE_DIGEST_DIVERGED'; reason = 'evidence bytes changed'; }
        else if (!semanticEvidence(ref.assertion, bytes)) { state = 'HOLD_EVIDENCE_SEMANTICS_DIVERGED'; reason = 'evidence meaning changed'; }
      }
    }
    checks.push({ evidenceId: ref.evidenceId, path: ref.path, assertion: ref.assertion, expectedSha256: ref.sha256, observedSha256, state, reason });
  }
  const failed = checks.filter(item => item.state !== 'PASS');
  return stable({
    schema: 'axm.mirror.outward-clone-service-registry-inspection/v1',
    state: failed.length ? 'HOLD_REGISTRY_LINEAGE_DIVERGED' : 'PASS_CURRENT_OUTWARD_CLONE_LINEAGE',
    registryId: registry.registryId,
    registryDigest: registry.registryDigest,
    registryFileSha256: digest(registryBytes),
    checkedEvidence: checks.length,
    passedEvidence: checks.length - failed.length,
    failedEvidence: failed.length,
    checks,
    findings: failed.map(item => ({ code: item.state, evidenceId: item.evidenceId, statement: item.reason })),
    authority: ZERO_AUTHORITY,
    registry
  });
}

function normalizeInputRefs(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new Error('service input refs are outside their bound');
  const ids = new Set();
  return value.map((item, index) => {
    exactKeys(item, ['id', 'digest', 'kind'], `service input ref ${index}`);
    const id = identifier(item.id, `input ref ${index} id`);
    if (ids.has(id)) throw new Error('service input ref id is duplicated');
    ids.add(id);
    if (!INPUT_KINDS.includes(item.kind)) throw new Error('service input ref kind is invalid');
    return { id, digest: sha(item.digest, `input ref ${index} digest`), kind: item.kind };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeRequest(value) {
  const request = stable(value);
  exactKeys(request, ['schema', 'requestId', 'requestDigest', 'cloneId', 'serviceKind', 'beneficiary', 'target', 'inputRefs', 'returnPath', 'budget', 'requestedAuthority', 'humanRendering'], 'outward clone service request');
  if (request.schema !== REQUEST_SCHEMA) throw new Error('outward clone service request schema changed');
  if (request.requestId !== null) identifier(request.requestId, 'service requestId');
  if (request.requestDigest !== null) sha(request.requestDigest, 'service requestDigest');
  const cloneId = identifier(request.cloneId, 'service cloneId', 100);
  if (!SERVICE_KINDS.includes(request.serviceKind)) throw new Error('service kind is invalid');
  exactKeys(request.beneficiary, ['kind', 'id', 'digest', 'needStatement'], 'service beneficiary');
  if (!BENEFICIARY_KINDS.includes(request.beneficiary.kind)) throw new Error('service beneficiary kind is invalid');
  exactKeys(request.target, ['kind', 'id', 'digest', 'sourceWriteAllowed', 'persistentWriteAllowed'], 'service target');
  if (!TARGET_KINDS.includes(request.target.kind) || request.target.sourceWriteAllowed !== false || request.target.persistentWriteAllowed !== false) throw new Error('service target boundary changed');
  exactKeys(request.returnPath, ['recipientKind', 'recipientId', 'directToParentMirror', 'automaticIntake', 'separateReviewRequired'], 'service return path');
  if (!BENEFICIARY_KINDS.includes(request.returnPath.recipientKind)) throw new Error('service return recipient kind is invalid');
  for (const key of ['directToParentMirror', 'automaticIntake', 'separateReviewRequired']) if (typeof request.returnPath[key] !== 'boolean') throw new Error(`service return path ${key} must be boolean`);
  exactKeys(request.budget, ['maxInputBytes', 'maxArtifacts', 'maxDurationMs'], 'service budget');
  const normalized = {
    schema: REQUEST_SCHEMA,
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    cloneId,
    serviceKind: request.serviceKind,
    beneficiary: { kind: request.beneficiary.kind, id: identifier(request.beneficiary.id, 'beneficiary id'), digest: sha(request.beneficiary.digest, 'beneficiary digest'), needStatement: boundedText(request.beneficiary.needStatement, 'beneficiary need statement', 1200) },
    target: { kind: request.target.kind, id: identifier(request.target.id, 'target id'), digest: sha(request.target.digest, 'target digest'), sourceWriteAllowed: false, persistentWriteAllowed: false },
    inputRefs: normalizeInputRefs(request.inputRefs),
    returnPath: { recipientKind: request.returnPath.recipientKind, recipientId: identifier(request.returnPath.recipientId, 'return recipient id'), directToParentMirror: request.returnPath.directToParentMirror, automaticIntake: request.returnPath.automaticIntake, separateReviewRequired: request.returnPath.separateReviewRequired },
    budget: { maxInputBytes: integer(request.budget.maxInputBytes, 'service maxInputBytes', 1, 1048576), maxArtifacts: integer(request.budget.maxArtifacts, 'service maxArtifacts', 0, 64), maxDurationMs: integer(request.budget.maxDurationMs, 'service maxDurationMs', 1, 600000) },
    requestedAuthority: exactAuthority(request.requestedAuthority, 'service requested authority'),
    humanRendering: boundedText(request.humanRendering, 'service human rendering', 2000, 0)
  };
  return stable(normalized);
}

function sealRequest(draft) {
  const request = normalizeRequest(Object.assign({}, clone(draft), { requestId: null, requestDigest: null }));
  request.requestId = `outward-clone-service-request-${digest(request).slice(0, 24)}`;
  request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  return stable(request);
}

function validateRequest(value) {
  const request = normalizeRequest(value);
  const expected = sealRequest(request);
  if (JSON.stringify(request) !== JSON.stringify(expected)) throw new Error('outward clone service request content address changed');
  return request;
}

function finding(code, severity, statement) { return { code, severity, statement }; }

function assessmentState(findings, role) {
  if (findings.some(item => item.code === 'REQUESTED_AUTHORITY_OUTSIDE_ROUTER')) return 'REFUSED_REQUESTED_AUTHORITY';
  if (findings.some(item => item.code === 'REGISTRY_LINEAGE_DIVERGED')) return 'HOLD_REGISTRY_LINEAGE_DIVERGED';
  if (!role) return 'HOLD_UNKNOWN_CLONE';
  if (findings.some(item => item.code === 'PARENT_MIRROR_IS_NOT_DIRECT_BENEFICIARY')) return 'HOLD_PARENT_AS_DIRECT_BENEFICIARY';
  if (findings.some(item => item.code === 'BENEFICIARY_KIND_UNKNOWN')) return 'HOLD_BENEFICIARY_UNKNOWN';
  if (findings.some(item => item.code === 'RETURN_PATH_UNSAFE')) return 'HOLD_RETURN_PATH_UNSAFE';
  if (findings.some(item => item.code === 'SERVICE_KIND_ROLE_MISMATCH')) return 'HOLD_CROSS_ROLE_SERVICE';
  if (findings.some(item => item.code === 'TARGET_KIND_ROLE_MISMATCH')) return 'HOLD_TARGET_KIND_MISMATCH';
  if (findings.some(item => item.code === 'REQUIRED_INPUT_KIND_MISSING')) return 'HOLD_REQUIRED_INPUT_KIND_MISSING';
  if (role.roleClass === 'HISTORICAL_ROLE_MISMATCH') return 'PRESERVATION_ROUTE_ONLY';
  return 'ROUTE_PROPOSAL_ONLY_READY_FOR_SPECIALIST_HANDLER_REVIEW';
}

function assess(value, options = {}) {
  const request = validateRequest(value);
  const inspection = inspectRegistry(options);
  const role = inspection.registry.roles.find(item => item.cloneId === request.cloneId) || null;
  const findings = [];
  if (Object.values(request.requestedAuthority).some(Boolean)) findings.push(finding('REQUESTED_AUTHORITY_OUTSIDE_ROUTER', 'REFUSE', 'The router can classify one proposal but cannot execute a service or grant any requested authority.'));
  if (inspection.state !== 'PASS_CURRENT_OUTWARD_CLONE_LINEAGE') findings.push(finding('REGISTRY_LINEAGE_DIVERGED', 'HOLD', 'One or more exact role or specialist lineage sources changed or disappeared.'));
  if (!role) findings.push(finding('UNKNOWN_CLONE', 'HOLD', 'The requested clone is absent from the outward service registry.'));
  if (request.beneficiary.kind === 'PARENT_MIRROR') findings.push(finding('PARENT_MIRROR_IS_NOT_DIRECT_BENEFICIARY', 'HOLD', 'Specialist clones serve a declared human or external-machine need; parent Mirror is not their direct customer.'));
  else if (request.beneficiary.kind === 'UNKNOWN') findings.push(finding('BENEFICIARY_KIND_UNKNOWN', 'HOLD', 'The beneficiary must be a declared human or external machine.'));
  const returnSafe = request.returnPath.recipientKind === request.beneficiary.kind && request.returnPath.recipientId === request.beneficiary.id && request.returnPath.directToParentMirror === false && request.returnPath.automaticIntake === false && request.returnPath.separateReviewRequired === true;
  if (!returnSafe) findings.push(finding('RETURN_PATH_UNSAFE', 'HOLD', 'Results must return to the exact beneficiary for separate review, never directly or automatically into parent Mirror.'));
  if (role && request.serviceKind !== role.serviceKind) findings.push(finding('SERVICE_KIND_ROLE_MISMATCH', 'HOLD', `Requested service ${request.serviceKind} belongs outside ${role.cloneId}.`));
  if (role && !role.targetKinds.includes(request.target.kind)) findings.push(finding('TARGET_KIND_ROLE_MISMATCH', 'HOLD', `Target kind ${request.target.kind} is outside ${role.cloneId}'s declared service boundary.`));
  if (role) {
    const suppliedKinds = new Set(request.inputRefs.map(item => item.kind));
    const missingKinds = role.requiredInputKinds.filter(kind => !suppliedKinds.has(kind));
    if (missingKinds.length) findings.push(finding('REQUIRED_INPUT_KIND_MISSING', 'HOLD', `Missing declared input kinds: ${missingKinds.join(', ')}.`));
  }
  findings.push(finding('INPUT_REFERENCES_DECLARED_NOT_VERIFIED', 'INFO', 'Input digests are caller declarations until the selected specialist handler independently verifies the referenced bytes.'));
  const state = assessmentState(findings, role);
  if (!ASSESSMENT_STATES.includes(state)) throw new Error('outward service assessment escaped its closed state set');
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    assessmentId: null,
    assessmentDigest: null,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    source: { requestId: request.requestId, requestDigest: request.requestDigest, registryId: inspection.registryId, registryDigest: inspection.registryDigest },
    state,
    role: role ? { cloneId: role.cloneId, roleClass: role.roleClass, serviceKind: role.serviceKind, handlerBuiltState: role.handlerBuiltState, directParentBeneficiaryAllowed: false, automaticReturnAllowed: false } : null,
    beneficiary: clone(request.beneficiary),
    target: clone(request.target),
    returnPath: clone(request.returnPath),
    findings,
    views: {
      human: { suppliedRendering: request.humanRendering, needStatement: request.beneficiary.needStatement, nonAuthoritative: true },
      machine: { cloneId: request.cloneId, serviceKind: request.serviceKind, targetKind: request.target.kind, inputRefKinds: request.inputRefs.map(item => item.kind).sort(), inputDigests: request.inputRefs.map(item => item.digest).sort(), requestedAuthorityTrueKeys: Object.entries(request.requestedAuthority).filter(([, enabled]) => enabled).map(([key]) => key).sort() }
    },
    counts: { externalActions: 0, servicesExecuted: 0, targetReads: 0, targetWrites: 0, parentMirrorReads: 0, parentMirrorWrites: 0, toolCalls: 0, networkCalls: 0, permissionGrants: 0, installations: 0, promotions: 0, canonChanges: 0, worldActions: 0 },
    authority: ZERO_AUTHORITY,
    nextGate: state === 'ROUTE_PROPOSAL_ONLY_READY_FOR_SPECIALIST_HANDLER_REVIEW' || state === 'PRESERVATION_ROUTE_ONLY'
      ? 'THE_NAMED_SPECIALIST_HANDLER_MUST_REVERIFY_INPUT_BYTES_CAPABILITIES_PERMISSIONS_BUDGET_AND_RETURN_BOUNDARY_BEFORE_ANY_SERVICE_ACTION'
      : 'RESOLVE_THE_NAMED_ROLE_BENEFICIARY_RETURN_LINEAGE_INPUT_OR_AUTHORITY_HOLD',
    limitations: [
      'This router proves only that one content-addressed request fits a declared outward clone service envelope and current local lineage.',
      'It does not execute RepairBuddy, Code Mirror, English Learner Mirror, Game Tester Mirror, or the historical clone; verify input bytes; certify beneficiary identity; grant a lease; or prove a service result.',
      'A role-aligned route does not prove repair correctness, innovation, novelty, usefulness, learning, English ability, game behavior, visual quality, accessibility, fun, safety, release readiness, or CANON.',
      'Parent Mirror may receive a separately reviewed proposal through another explicit protocol, but this router provides no direct or automatic return path.'
    ],
    boundary: 'Routes one outward clone service proposal to a declared human or external-machine beneficiary while keeping parent Mirror, target writes, execution, permissions, tools, network, installation, promotion, CANON, and world action outside this TEST organ.'
  };
  const body = without(assessment, 'assessmentId', 'assessmentDigest');
  assessment.assessmentId = `outward-clone-service-assessment-${digest(body).slice(0, 24)}`;
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return stable(assessment);
}

function validateAssessment(value, request = null, options = {}) {
  const assessment = stable(value);
  exactKeys(assessment, ['schema', 'assessmentId', 'assessmentDigest', 'status', 'organ', 'source', 'state', 'role', 'beneficiary', 'target', 'returnPath', 'findings', 'views', 'counts', 'authority', 'nextGate', 'limitations', 'boundary'], 'outward clone service assessment');
  if (assessment.schema !== ASSESSMENT_SCHEMA || assessment.status !== 'TEST' || assessment.organ.id !== ORGAN_ID || assessment.organ.learnedWeights !== false || !ASSESSMENT_STATES.includes(assessment.state)) throw new Error('outward service assessment identity changed');
  zeroAuthority(assessment.authority, 'outward service assessment authority');
  if (Object.values(assessment.counts).some(item => item !== 0)) throw new Error('outward service assessment action counts changed');
  const expectedId = `outward-clone-service-assessment-${digest(without(assessment, 'assessmentId', 'assessmentDigest')).slice(0, 24)}`;
  const expectedDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  if (assessment.assessmentId !== expectedId || assessment.assessmentDigest !== expectedDigest) throw new Error('outward service assessment content address changed');
  if (request && JSON.stringify(assessment) !== JSON.stringify(assess(request, options))) throw new Error('outward service assessment no longer matches its request and registry');
  return assessment;
}

module.exports = {
  ORGAN_ID,
  REGISTRY_SCHEMA,
  REQUEST_SCHEMA,
  ASSESSMENT_SCHEMA,
  REGISTRY_PATH,
  ROLE_IDS,
  ROLE_CLASSES,
  SERVICE_KINDS,
  TARGET_KINDS,
  BENEFICIARY_KINDS,
  INPUT_KINDS,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  ASSESSMENT_STATES,
  stable,
  clone,
  digest,
  sealRegistry,
  validateRegistry,
  semanticEvidence,
  inspectRegistry,
  sealRequest,
  validateRequest,
  assess,
  validateAssessment
};
