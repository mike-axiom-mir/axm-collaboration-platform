'use strict';

const crypto = require('crypto');
const Json = require('../../tools/deterministic-json-core');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.workshop-contract-repair-request/v1';
const OBSERVATION_SCHEMA = 'axm.workshop-contract-observation/v1';
const PLAN_SCHEMA = 'axm.workshop-contract-repair-plan/v1';
const CANDIDATE_SCHEMA = 'axm.workshop-contract-repair-candidate/v1';
const REPAIR_CLASS = 'LEGACY_MANIFEST_SCHEMA_AND_KIND';
const ROOTS = Object.freeze(['TRUTH', 'AGENCY_NON_DOMINATION', 'CONTINUITY', 'WISDOM_OVER_SPEED']);
const ALLOWED_KINDS = Object.freeze(['adapter', 'machine-capability', 'product', 'scaffold', 'service']);
const SCOPE_ID = 'target-legacy-manifest-contract-selftest-v1';
const RECIPE = Object.freeze({ id: 'draft-legacy-manifest-schema-kind-alternatives-v1', repairClass: REPAIR_CLASS });
const RESOURCES = Object.freeze({ maxInputFiles: 8, maxInputBytes: 2097152, maxOutputFiles: 6, maxOutputBytes: 8388608, maxEvidenceFiles: 16, maxEvidenceBytes: 8388608, maxIterations: 8, maxNetworkRequests: 0, maxChildProcesses: 0 });
const PRIVACY = Object.freeze({ scopeId: SCOPE_ID, sourceBytesInEvidence: false, candidateBytesInOutput: true, stdoutRetention: false, stderrRetention: false, machinePathRetention: false, secretsRead: false });
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Json.canonicalJson(value); }
function same(left, right) { return Json.sameCanonical(left, right); }
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function hashBytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return hashBytes(Buffer.from(canonical(value), 'utf8')); }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const actual = Object.keys(value).sort(), expected = keys.slice().sort();
  if (!same(actual, expected)) throw new Error(label + ' fields are not exact');
}
function text(value, label, max = 200) {
  if (typeof value !== 'string' || !value.length || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(label + ' must be bounded text');
  return value;
}
function portableId(value, label) { if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function sha(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function timestamp(value, label) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(label + ' must be a canonical timestamp'); return value; }
function portablePath(value, label) {
  text(value, label, 260);
  if (value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.startsWith('//') || value.includes(':') || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(label + ' must be a portable relative path');
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  for (const part of value.split('/')) if (reserved.test(part) || /[. ]$/.test(part)) throw new Error(label + ' contains a Windows-unsafe segment');
  return value;
}
function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: portableId(value.id, label + '.id'), schema: text(value.schema, label + '.schema', 180), sha256: sha(value.sha256, label + '.sha256') };
}
function fileRef(value, label) {
  exact(value, ['path', 'sha256', 'byteLength'], label);
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1) throw new Error(label + '.byteLength is invalid');
  return { path: portablePath(value.path, label + '.path'), sha256: sha(value.sha256, label + '.sha256'), byteLength: value.byteLength };
}
function stringArray(value, label, maxItems = 64) {
  if (!Array.isArray(value) || value.length > maxItems || new Set(value).size !== value.length) throw new Error(label + ' must be a unique bounded array');
  return value.map((item, index) => text(item, label + '[' + index + ']', 300));
}
function normalizeRoots(value) {
  if (!Array.isArray(value) || value.length !== ROOTS.length) throw new Error('all four roots are required');
  return value.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index] || entry.verdict !== 'PASS' || !Array.isArray(entry.evidenceRefs) || !entry.evidenceRefs.length) throw new Error('four-root gate must be ordered PASS with evidence');
    return { root: entry.root, verdict: 'PASS', evidenceRefs: entry.evidenceRefs.map((ref, refIndex) => reference(ref, 'rootsGate[' + index + '].evidenceRefs[' + refIndex + ']')) };
  });
}
function normalizeTarget(value, label) {
  exact(value, ['toolId', 'manifestPath', 'contractPath', 'selftestPath'], label);
  const toolId = portableId(value.toolId, label + '.toolId');
  const prefix = 'tools/' + toolId + '/';
  const manifestPath = portablePath(value.manifestPath, label + '.manifestPath');
  const contractPath = portablePath(value.contractPath, label + '.contractPath');
  const selftestPath = portablePath(value.selftestPath, label + '.selftestPath');
  if (manifestPath !== prefix + 'manifest.json' || contractPath !== prefix + 'module.contract.json' || selftestPath !== prefix + 'selftest.js') throw new Error(label + ' paths must be the exact target tool files');
  return { toolId, manifestPath, contractPath, selftestPath };
}
function sealRequest(value) {
  exact(value, ['schema', 'id', 'sourceLabel', 'evaluatedAt', 'recipe', 'target', 'rootsGate', 'authorization', 'resources', 'privacy', 'authority'], 'contract repair request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE' || !same(value.recipe, RECIPE) || !same(value.resources, RESOURCES) || !same(value.privacy, PRIVACY)) throw new Error('contract repair request policy drifted');
  exact(value.authorization, ['decisionRef', 'snapshotRead', 'sandboxDraft', 'sandboxRefresh', 'preview', 'humanSelectionRequired', 'machineSelection', 'candidateExecution', 'sourceWriteBack', 'install', 'integrate', 'publish', 'promote', 'canon', 'authenticatedIdentityProven', 'authority'], 'authorization');
  const expected = { snapshotRead: true, sandboxDraft: true, sandboxRefresh: true, preview: true, humanSelectionRequired: true, machineSelection: false, candidateExecution: false, sourceWriteBack: false, install: false, integrate: false, publish: false, promote: false, canon: false, authenticatedIdentityProven: false, authority: 'NONE' };
  const decisionRef = reference(value.authorization.decisionRef, 'authorization.decisionRef');
  for (const [key, expectedValue] of Object.entries(expected)) if (value.authorization[key] !== expectedValue) throw new Error('authorization drifted: ' + key);
  const core = { schema: REQUEST_SCHEMA, id: portableId(value.id, 'request.id'), sourceLabel: text(value.sourceLabel, 'sourceLabel', 160), evaluatedAt: timestamp(value.evaluatedAt, 'evaluatedAt'), recipe: clone(RECIPE), target: normalizeTarget(value.target, 'target'), rootsGate: normalizeRoots(value.rootsGate), authorization: { decisionRef, ...expected }, resources: clone(RESOURCES), privacy: clone(PRIVACY), authority: 'NONE' };
  return { ...core, requestDigest: hashValue(core) };
}
function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'sourceLabel', 'evaluatedAt', 'recipe', 'target', 'rootsGate', 'authorization', 'resources', 'privacy', 'authority', 'requestDigest'], 'contract repair request');
  const { requestDigest, ...core } = value, sealed = sealRequest(core);
  if (requestDigest !== sealed.requestDigest) throw new Error('contract repair request digest mismatch');
  return sealed;
}
function validation(value, label) {
  exact(value, ['pass', 'errors'], label);
  if (typeof value.pass !== 'boolean') throw new Error(label + '.pass must be boolean');
  const errors = stringArray(value.errors, label + '.errors');
  if (value.pass !== (errors.length === 0)) throw new Error(label + ' pass/errors disagree');
  return { pass: value.pass, errors };
}
function sealObservation(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'sourceLabel', 'evaluatedAt', 'scopeId', 'target', 'inputRefs', 'manifest', 'contract', 'selftest', 'allowedKinds', 'resources', 'privacy', 'truth', 'authority'], 'contract observation');
  if (value.schema !== OBSERVATION_SCHEMA || value.version !== VERSION || value.status !== 'TEST' || value.scopeId !== SCOPE_ID || value.authority !== 'NONE' || !same(value.allowedKinds, ALLOWED_KINDS) || !same(value.privacy, PRIVACY)) throw new Error('contract observation identity drifted');
  const target = normalizeTarget(value.target, 'observation.target');
  if (!Array.isArray(value.inputRefs) || value.inputRefs.length !== 3) throw new Error('observation requires three input refs');
  const inputRefs = value.inputRefs.map((ref, index) => fileRef(ref, 'inputRefs[' + index + ']')).sort((a, b) => compareText(a.path, b.path));
  if (!same(inputRefs.map((ref) => ref.path), [target.contractPath, target.manifestPath, target.selftestPath].sort())) throw new Error('observation input scope drifted');
  exact(value.manifest, ['ref', 'declaredSchema', 'schemaState', 'id', 'kindState', 'declaredKind', 'validation'], 'observation.manifest');
  const manifestRef = fileRef(value.manifest.ref, 'observation.manifest.ref');
  if (manifestRef.path !== target.manifestPath || value.manifest.id !== target.toolId || !['MISSING', 'PRESENT_VALID', 'PRESENT_INVALID'].includes(value.manifest.schemaState) || !['MISSING', 'PRESENT_VALID', 'PRESENT_INVALID'].includes(value.manifest.kindState)) throw new Error('manifest observation drifted');
  const declaredSchema = value.manifest.declaredSchema === null ? null : text(value.manifest.declaredSchema, 'manifest.declaredSchema', 120);
  if ((value.manifest.schemaState === 'MISSING') !== (declaredSchema === null)) throw new Error('manifest schema state disagrees with declared schema');
  if (value.manifest.schemaState === 'PRESENT_VALID' && declaredSchema !== 'axm.tool-manifest/v1') throw new Error('valid manifest schema is unsupported');
  if (value.manifest.schemaState === 'PRESENT_INVALID' && declaredSchema === 'axm.tool-manifest/v1') throw new Error('invalid manifest schema is valid');
  const declaredKind = value.manifest.declaredKind === null ? null : text(value.manifest.declaredKind, 'manifest.declaredKind', 80);
  if ((value.manifest.kindState === 'MISSING') !== (declaredKind === null)) throw new Error('manifest kind state disagrees with declared kind');
  if (value.manifest.kindState === 'PRESENT_VALID' && !ALLOWED_KINDS.includes(declaredKind)) throw new Error('valid manifest kind is not allowed');
  if (value.manifest.kindState === 'PRESENT_INVALID' && ALLOWED_KINDS.includes(declaredKind)) throw new Error('invalid manifest kind is allowed');
  exact(value.contract, ['ref', 'schema', 'id', 'permissionParity', 'validation'], 'observation.contract');
  const contractRef = fileRef(value.contract.ref, 'observation.contract.ref');
  if (contractRef.path !== target.contractPath || value.contract.schema !== 'axm.module-contract/v1' || value.contract.id !== target.toolId || typeof value.contract.permissionParity !== 'boolean') throw new Error('contract observation drifted');
  exact(value.selftest, ['ref', 'state'], 'observation.selftest');
  const selftestRef = fileRef(value.selftest.ref, 'observation.selftest.ref');
  if (selftestRef.path !== target.selftestPath || value.selftest.state !== 'PRESENT_NOT_RUN') throw new Error('selftest observation drifted');
  if (!same([manifestRef, contractRef, selftestRef].sort((a, b) => compareText(a.path, b.path)), inputRefs)) throw new Error('observation refs disagree');
  exact(value.resources, ['inputFiles', 'inputBytes', 'networkRequests', 'childProcesses', 'enforced'], 'observation.resources');
  const inputBytes = inputRefs.reduce((sum, ref) => sum + ref.byteLength, 0);
  if (value.resources.inputFiles !== 3 || value.resources.inputBytes !== inputBytes || value.resources.networkRequests !== 0 || value.resources.childProcesses !== 0 || value.resources.enforced !== true || inputBytes > RESOURCES.maxInputBytes) throw new Error('observation resources drifted');
  const expectedTruth = { sourceRead: true, sourceWritten: false, candidateBytesRetainedInOutput: true, candidateExecuted: false, testsExecuted: false, networkUsed: false, childProcessSpawned: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false };
  exact(value.truth, Object.keys(expectedTruth), 'observation.truth');
  if (!same(value.truth, expectedTruth)) throw new Error('observation truth drifted');
  const core = { schema: OBSERVATION_SCHEMA, version: VERSION, status: 'TEST', id: portableId(value.id, 'observation.id'), sourceLabel: text(value.sourceLabel, 'observation.sourceLabel', 160), evaluatedAt: timestamp(value.evaluatedAt, 'observation.evaluatedAt'), scopeId: SCOPE_ID, target, inputRefs, manifest: { ref: manifestRef, declaredSchema, schemaState: value.manifest.schemaState, id: value.manifest.id, kindState: value.manifest.kindState, declaredKind, validation: validation(value.manifest.validation, 'observation.manifest.validation') }, contract: { ref: contractRef, schema: value.contract.schema, id: value.contract.id, permissionParity: value.contract.permissionParity, validation: validation(value.contract.validation, 'observation.contract.validation') }, selftest: { ref: selftestRef, state: 'PRESENT_NOT_RUN' }, allowedKinds: clone(ALLOWED_KINDS), sourceStateDigest: hashValue(inputRefs), resources: clone(value.resources), privacy: clone(PRIVACY), truth: expectedTruth, authority: 'NONE' };
  return { ...core, observationDigest: hashValue(core) };
}
function normalizeObservation(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'sourceLabel', 'evaluatedAt', 'scopeId', 'target', 'inputRefs', 'manifest', 'contract', 'selftest', 'allowedKinds', 'sourceStateDigest', 'resources', 'privacy', 'truth', 'authority', 'observationDigest'], 'contract observation');
  const { observationDigest, sourceStateDigest, ...unsealed } = value, sealed = sealObservation(unsealed);
  if (sourceStateDigest !== sealed.sourceStateDigest || observationDigest !== sealed.observationDigest) throw new Error('contract observation digest mismatch');
  return sealed;
}
function requiredTests(target) {
  return [
    { id: 'target-selftest', command: ['node', target.selftestPath], claim: 'Target behavior remains compatible after a human selects one exact alternative.', status: 'NOT_RUN', evidenceRefs: [] },
    { id: 'manifest-readiness', command: ['node', 'shared/readiness/selftest.js'], claim: 'The selected candidate satisfies Workshop manifest readiness semantics.', status: 'NOT_RUN', evidenceRefs: [] },
    { id: 'hub-verification', command: ['node', 'hub/verify-plus.js'], claim: 'The selected candidate preserves Hub verification claims.', status: 'NOT_RUN', evidenceRefs: [] },
    { id: 'workshop-verifier', command: ['node', 'verify.js'], claim: 'The selected candidate does not add Workshop verifier failures.', status: 'NOT_RUN', evidenceRefs: [] }
  ];
}
function alternative(kind) {
  return { id: 'kind-' + kind, kind, patch: [{ operation: 'JSON_ADD', pointer: '/schema', value: 'axm.tool-manifest/v1' }, { operation: 'JSON_ADD', pointer: '/kind', value: kind }], ranking: null, semanticFitness: 'UNKNOWN', requiresHumanSelection: true };
}
function plan(inputRequest, inputObservation) {
  const request = normalizeRequest(inputRequest), observation = normalizeObservation(inputObservation);
  if (!same(request.target, observation.target) || request.sourceLabel !== observation.sourceLabel || request.evaluatedAt !== observation.evaluatedAt) throw new Error('request and observation scope disagree');
  let status = 'CURRENT_NO_DRAFT', finding = 'NONE', alternatives = [];
  if (observation.manifest.schemaState === 'MISSING' && observation.manifest.kindState === 'MISSING') {
    if (!observation.manifest.validation.pass || !observation.contract.validation.pass || !observation.contract.permissionParity) {
      status = 'HOLD'; finding = 'ADDITIONAL_DEFECTS_REQUIRE_SEPARATE_REQUEST';
    } else {
      status = 'DRAFT_ALTERNATIVES_PLANNED'; finding = 'LEGACY_MANIFEST_SCHEMA_AND_KIND_MISSING'; alternatives = ALLOWED_KINDS.map(alternative);
    }
  } else if (observation.manifest.schemaState !== 'PRESENT_VALID' || observation.manifest.kindState !== 'PRESENT_VALID') {
    status = 'HOLD'; finding = 'UNSUPPORTED_DECLARATION_STATE_REQUIRES_SEPARATE_REQUEST';
  }
  const core = {
    schema: PLAN_SCHEMA, version: VERSION, status, id: request.id + '-plan',
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest }, observationRef: { id: observation.id, schema: observation.schema, sha256: observation.observationDigest },
    recipe: clone(RECIPE), finding, target: clone(request.target), alternatives, selectedAlternative: null, ranking: 'NONE',
    requiredTests: requiredTests(request.target),
    limitations: ['Only the exact legacy state with both schema and kind absent is in scope.', 'The schema addition is fixed to axm.tool-manifest/v1; its allowed kind values remain equal alternatives because current bytes do not prove semantic intent.', 'Structural validation is not runtime, behavioral, usefulness, or semantic-fitness proof.', 'Every required test remains NOT_RUN until a separately authorized disposable executor evaluates one exact selected candidate.', 'The draft cannot select, execute, write back, install, integrate, publish, promote, or alter CANON.'],
    truth: { deterministicPlan: true, sourceCurrentAtPlanning: true, alternativesUnranked: true, humanSelectionRequired: true, candidateExecuted: false, testsExecuted: false, sourceWritten: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  };
  return { ...core, planDigest: hashValue(core) };
}
function normalizePlan(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'requestRef', 'observationRef', 'recipe', 'finding', 'target', 'alternatives', 'selectedAlternative', 'ranking', 'requiredTests', 'limitations', 'truth', 'authority', 'planDigest'], 'contract repair plan');
  if (value.schema !== PLAN_SCHEMA || value.version !== VERSION || value.authority !== 'NONE' || !same(value.recipe, RECIPE) || !['DRAFT_ALTERNATIVES_PLANNED', 'CURRENT_NO_DRAFT', 'HOLD'].includes(value.status) || value.selectedAlternative !== null || value.ranking !== 'NONE') throw new Error('contract repair plan identity drifted');
  const target = normalizeTarget(value.target, 'plan.target');
  if (!Array.isArray(value.alternatives)) throw new Error('plan alternatives must be an array');
  const alternatives = value.alternatives.map((entry, index) => {
    exact(entry, ['id', 'kind', 'patch', 'ranking', 'semanticFitness', 'requiresHumanSelection'], 'plan.alternatives[' + index + ']');
    const expected = alternative(ALLOWED_KINDS[index]);
    if (!expected || !same(entry, expected)) throw new Error('plan alternative policy drifted');
    return clone(entry);
  });
  if ((value.status === 'DRAFT_ALTERNATIVES_PLANNED') !== (alternatives.length === ALLOWED_KINDS.length) || (value.status === 'DRAFT_ALTERNATIVES_PLANNED') !== (value.finding === 'LEGACY_MANIFEST_SCHEMA_AND_KIND_MISSING')) throw new Error('plan status, finding, and alternatives disagree');
  if (value.status === 'CURRENT_NO_DRAFT' && value.finding !== 'NONE') throw new Error('current plan has a finding');
  if (value.status === 'HOLD' && !['ADDITIONAL_DEFECTS_REQUIRE_SEPARATE_REQUEST', 'UNSUPPORTED_DECLARATION_STATE_REQUIRES_SEPARATE_REQUEST'].includes(value.finding)) throw new Error('plan hold finding is invalid');
  const tests = value.requiredTests.map((test, index) => normalizeTest(test, 'plan.requiredTests[' + index + ']'));
  if (!same(tests, requiredTests(target))) throw new Error('plan required tests drifted');
  const expectedTruth = { deterministicPlan: true, sourceCurrentAtPlanning: true, alternativesUnranked: true, humanSelectionRequired: true, candidateExecuted: false, testsExecuted: false, sourceWritten: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false };
  exact(value.truth, Object.keys(expectedTruth), 'plan.truth'); if (!same(value.truth, expectedTruth)) throw new Error('plan truth drifted');
  const core = { schema: PLAN_SCHEMA, version: VERSION, status: value.status, id: portableId(value.id, 'plan.id'), requestRef: reference(value.requestRef, 'plan.requestRef'), observationRef: reference(value.observationRef, 'plan.observationRef'), recipe: clone(RECIPE), finding: value.finding, target, alternatives, selectedAlternative: null, ranking: 'NONE', requiredTests: tests, limitations: stringArray(value.limitations, 'plan.limitations', 16), truth: expectedTruth, authority: 'NONE' };
  if (value.planDigest !== hashValue(core)) throw new Error('contract repair plan digest mismatch');
  return { ...core, planDigest: value.planDigest };
}
function normalizeTest(value, label) {
  exact(value, ['id', 'command', 'claim', 'status', 'evidenceRefs'], label);
  if (!Array.isArray(value.command) || value.command.length !== 2 || value.command[0] !== 'node') throw new Error(label + ' command is not allowlisted');
  portablePath(value.command[1], label + '.command[1]');
  if (value.status !== 'NOT_RUN' || !Array.isArray(value.evidenceRefs) || value.evidenceRefs.length) throw new Error(label + ' must remain NOT_RUN without evidence');
  return { id: portableId(value.id, label + '.id'), command: clone(value.command), claim: text(value.claim, label + '.claim', 300), status: 'NOT_RUN', evidenceRefs: [] };
}
function sealCandidate(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'requestRef', 'observationRef', 'planRef', 'target', 'repairClass', 'alternatives', 'comparison', 'requiredTests', 'limitations', 'truth', 'authority'], 'contract repair candidate');
  if (value.schema !== CANDIDATE_SCHEMA || value.version !== VERSION || value.status !== 'EXPERIMENTAL' || value.repairClass !== REPAIR_CLASS || value.authority !== 'NONE') throw new Error('contract repair candidate identity drifted');
  const target = normalizeTarget(value.target, 'candidate.target');
  if (!Array.isArray(value.alternatives) || value.alternatives.length !== ALLOWED_KINDS.length) throw new Error('candidate alternatives are incomplete');
  const alternatives = value.alternatives.map((entry, index) => {
    exact(entry, ['id', 'kind', 'patch', 'candidateRef', 'manifestValidation', 'contractValidation', 'semanticFitness', 'ranking', 'requiresHumanSelection'], 'candidate.alternatives[' + index + ']');
    const expected = alternative(ALLOWED_KINDS[index]);
    if (entry.id !== expected.id || entry.kind !== expected.kind || !same(entry.patch, expected.patch) || entry.semanticFitness !== 'UNKNOWN' || entry.ranking !== null || entry.requiresHumanSelection !== true) throw new Error('candidate alternative policy drifted');
    const candidateRef = fileRef(entry.candidateRef, 'candidate.alternatives[' + index + '].candidateRef');
    if (candidateRef.path !== 'alternatives/' + entry.id + '/manifest.json') throw new Error('candidate alternative path drifted');
    const manifestValidation = validation(entry.manifestValidation, 'candidate.alternatives[' + index + '].manifestValidation');
    const contractValidation = validation(entry.contractValidation, 'candidate.alternatives[' + index + '].contractValidation');
    if (!manifestValidation.pass || !contractValidation.pass) throw new Error('candidate alternative is not structurally valid');
    return { id: entry.id, kind: entry.kind, patch: clone(entry.patch), candidateRef, manifestValidation, contractValidation, semanticFitness: 'UNKNOWN', ranking: null, requiresHumanSelection: true };
  });
  exact(value.comparison, ['ranking', 'selectedAlternative', 'equalAuthority', 'permissionDelta', 'contractBytesChanged'], 'candidate.comparison');
  exact(value.comparison.permissionDelta, ['added', 'removed'], 'candidate.comparison.permissionDelta');
  if (value.comparison.ranking !== 'NONE' || value.comparison.selectedAlternative !== null || value.comparison.equalAuthority !== true || !same(value.comparison.permissionDelta, { added: [], removed: [] }) || value.comparison.contractBytesChanged !== false) throw new Error('candidate comparison silently selected or expanded authority');
  const expectedTruth = { draftDetached: true, alternativesUnranked: true, humanSelectionRequired: true, candidateExecuted: false, testsExecuted: false, sourceWritten: false, permissionsChanged: false, contractBytesChanged: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false };
  exact(value.truth, Object.keys(expectedTruth), 'candidate.truth'); if (!same(value.truth, expectedTruth)) throw new Error('candidate truth drifted');
  if (!Array.isArray(value.requiredTests) || value.requiredTests.length !== 4 || !Array.isArray(value.limitations) || !value.limitations.length) throw new Error('candidate tests or limitations are incomplete');
  const core = { schema: CANDIDATE_SCHEMA, version: VERSION, status: 'EXPERIMENTAL', id: portableId(value.id, 'candidate.id'), requestRef: reference(value.requestRef, 'candidate.requestRef'), observationRef: reference(value.observationRef, 'candidate.observationRef'), planRef: reference(value.planRef, 'candidate.planRef'), target, repairClass: REPAIR_CLASS, alternatives, comparison: clone(value.comparison), requiredTests: value.requiredTests.map((test, index) => normalizeTest(test, 'candidate.requiredTests[' + index + ']')), limitations: stringArray(value.limitations, 'candidate.limitations', 16), truth: expectedTruth, authority: 'NONE' };
  return { ...core, candidateDigest: hashValue(core) };
}
function normalizeCandidate(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'requestRef', 'observationRef', 'planRef', 'target', 'repairClass', 'alternatives', 'comparison', 'requiredTests', 'limitations', 'truth', 'authority', 'candidateDigest'], 'contract repair candidate');
  const { candidateDigest, ...core } = value, sealed = sealCandidate(core);
  if (candidateDigest !== sealed.candidateDigest) throw new Error('contract repair candidate digest mismatch');
  return sealed;
}
function verifyPlan(result, request, observation) { try { return same(result, plan(request, observation)) ? { pass: true, errors: [] } : { pass: false, errors: ['contract repair plan differs from deterministic rebuild'] }; } catch (error) { return { pass: false, errors: [error.message] }; } }
function buildExampleRequest(evaluatedAt = '2026-08-23T05:00:00.000Z', sourceLabel = 'current-workshop', toolId = 'browser-lan-hardware-qa-lab') {
  const target = { toolId, manifestPath: 'tools/' + toolId + '/manifest.json', contractPath: 'tools/' + toolId + '/module.contract.json', selftestPath: 'tools/' + toolId + '/selftest.js' };
  const decisionRef = { id: 'mike-contract-repair-draft-direction', schema: 'axm.explicit-human-direction/v1', sha256: hashValue('Mike authorized a bounded current-Workshop legacy manifest schema-and-kind repair shadow draft with unranked alternatives; execution, source write-back, installation, integration, promotion, and CANON remain false.') };
  return sealRequest({ schema: REQUEST_SCHEMA, id: 'draft-' + toolId + '-missing-kind', sourceLabel, evaluatedAt, recipe: clone(RECIPE), target, rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'contract-repair-' + root.toLowerCase().replace(/_/g, '-'), schema: 'axm.four-root-technical-review/v1', sha256: hashValue('workshop-contract-repair-v0.6:' + root) }] })), authorization: { decisionRef, snapshotRead: true, sandboxDraft: true, sandboxRefresh: true, preview: true, humanSelectionRequired: true, machineSelection: false, candidateExecution: false, sourceWriteBack: false, install: false, integrate: false, publish: false, promote: false, canon: false, authenticatedIdentityProven: false, authority: 'NONE' }, resources: clone(RESOURCES), privacy: clone(PRIVACY), authority: 'NONE' });
}

module.exports = { VERSION, REQUEST_SCHEMA, OBSERVATION_SCHEMA, PLAN_SCHEMA, CANDIDATE_SCHEMA, REPAIR_CLASS, ROOTS, ALLOWED_KINDS, SCOPE_ID, RECIPE, RESOURCES, PRIVACY, clone, canonical, same, compareText, hashBytes, hashValue, portablePath, fileRef, sealRequest, normalizeRequest, sealObservation, normalizeObservation, requiredTests, plan, normalizePlan, sealCandidate, normalizeCandidate, verifyPlan, buildExampleRequest };
