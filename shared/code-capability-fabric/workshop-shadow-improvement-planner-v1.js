'use strict';

const crypto = require('crypto');
const Json = require('../../tools/deterministic-json-core');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.workshop-shadow-refresh-request/v1';
const SNAPSHOT_SCHEMA = 'axm.workshop-shadow-snapshot/v1';
const PLAN_SCHEMA = 'axm.workshop-shadow-improvement-plan/v1';
const ROOTS = Object.freeze(['TRUTH', 'AGENCY_NON_DOMINATION', 'CONTINUITY', 'WISDOM_OVER_SPEED']);
const SCOPE_ID = 'tools-index-declarations-and-selftests-v1';
const RECIPE = Object.freeze({ id: 'refresh-tools-index-v1', outputPath: 'tools-index.json' });
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const RAW_DIGEST = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const RESOURCES = Object.freeze({ maxInputFiles: 8192, maxInputBytes: 67108864, maxOutputFiles: 1, maxOutputBytes: 8388608, maxEvidenceFiles: 16, maxEvidenceBytes: 8388608, maxIterations: 8, maxNetworkRequests: 0, maxChildProcesses: 0 });
const PRIVACY = Object.freeze({ scopeId: SCOPE_ID, rawSourceRetention: false, stdoutRetention: false, stderrRetention: false, machinePathRetention: false, secretsRead: false });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Json.canonicalJson(value); }
function same(a, b) { return Json.sameCanonical(a, b); }
function hashBytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return hashBytes(Buffer.from(canonical(value), 'utf8')); }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  if (!same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(label + ' fields are not closed');
}
function boundedText(value, label, max) {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(label + ' must be bounded text');
  return value;
}
function id(value, label) { if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function timestamp(value, label) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(label + ' must be a canonical timestamp'); return value; }
function portablePath(value, label) {
  value = boundedText(value, label, 300);
  const parts = value.split('/');
  if (value.includes('\\') || value.startsWith('/') || /^[a-z]:/i.test(value) || value.startsWith('//') || value.includes(':') || parts.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) throw new Error(label + ' must be a portable relative path');
  return value;
}
function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: id(value.id, label + '.id'), schema: boundedText(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
}
function fileRef(value, label) {
  exact(value, ['path', 'sha256', 'byteLength'], label);
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1) throw new Error(label + '.byteLength is invalid');
  return { path: portablePath(value.path, label + '.path'), sha256: digest(value.sha256, label + '.sha256'), byteLength: value.byteLength };
}
function summary(value, label, nullable) {
  if (value === null && nullable) return null;
  const keys = ['tools', 'contractsPresent', 'contractsValid', 'topLevelSelftests', 'capabilities', 'readyForHumanReview', 'blocked', 'claimsNeedingReverification'];
  exact(value, keys, label);
  const result = {};
  for (const key of keys) { if (!Number.isSafeInteger(value[key]) || value[key] < 0) throw new Error(label + '.' + key + ' is invalid'); result[key] = value[key]; }
  return result;
}
function normalizeRoots(values) {
  if (!Array.isArray(values) || values.length !== ROOTS.length) throw new Error('rootsGate requires exactly four roots');
  return values.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index] || entry.verdict !== 'PASS') throw new Error('ROOTS_GATE_HOLD:' + ROOTS[index]);
    if (!Array.isArray(entry.evidenceRefs) || entry.evidenceRefs.length < 1 || entry.evidenceRefs.length > 8) throw new Error('root evidence is required');
    return { root: entry.root, verdict: 'PASS', evidenceRefs: entry.evidenceRefs.map((item, refIndex) => reference(item, 'rootsGate[' + index + '].evidenceRefs[' + refIndex + ']')) };
  });
}
function sealRequest(value) {
  exact(value, ['schema', 'id', 'sourceLabel', 'evaluatedAt', 'recipe', 'rootsGate', 'authorization', 'resources', 'privacy', 'authority'], 'shadow refresh request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') throw new Error('shadow refresh request identity or authority drift');
  exact(value.recipe, ['id', 'outputPath'], 'recipe');
  if (!same(value.recipe, RECIPE)) throw new Error('UNSUPPORTED_SHADOW_RECIPE');
  exact(value.authorization, ['decisionRef', 'snapshotRead', 'sandboxDraft', 'sandboxRefresh', 'preview', 'candidateExecution', 'sourceWriteBack', 'install', 'integrate', 'publish', 'promote', 'canon', 'authenticatedIdentityProven', 'authority'], 'authorization');
  const expectedAuthorization = { decisionRef: reference(value.authorization.decisionRef, 'authorization.decisionRef'), snapshotRead: true, sandboxDraft: true, sandboxRefresh: true, preview: true, candidateExecution: false, sourceWriteBack: false, install: false, integrate: false, publish: false, promote: false, canon: false, authenticatedIdentityProven: false, authority: 'NONE' };
  if (!same(value.authorization, expectedAuthorization)) throw new Error('shadow authorization drift');
  exact(value.resources, Object.keys(RESOURCES), 'resources');
  if (!same(value.resources, RESOURCES)) throw new Error('shadow resource envelope drift');
  exact(value.privacy, Object.keys(PRIVACY), 'privacy');
  if (!same(value.privacy, PRIVACY)) throw new Error('shadow privacy scope drift');
  const core = { schema: REQUEST_SCHEMA, id: id(value.id, 'request.id'), sourceLabel: boundedText(value.sourceLabel, 'sourceLabel', 160), evaluatedAt: timestamp(value.evaluatedAt, 'evaluatedAt'), recipe: clone(RECIPE), rootsGate: normalizeRoots(value.rootsGate), authorization: expectedAuthorization, resources: clone(RESOURCES), privacy: clone(PRIVACY), authority: 'NONE' };
  return { ...core, requestDigest: hashValue(core) };
}
function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'sourceLabel', 'evaluatedAt', 'recipe', 'rootsGate', 'authorization', 'resources', 'privacy', 'authority', 'requestDigest'], 'shadow refresh request');
  const { requestDigest, ...core } = value;
  const sealed = sealRequest(core);
  if (requestDigest !== sealed.requestDigest || !same(value, sealed)) throw new Error('shadow refresh request digest mismatch');
  return sealed;
}
function indexObservation(value, label, rebuilt) {
  exact(value, ['state', 'ref', 'sourceDigest', 'summary', 'toolIds'], label);
  if (!['VALID', 'INVALID', 'MISSING'].includes(value.state) || (rebuilt && value.state !== 'VALID')) throw new Error(label + '.state is invalid');
  const refValue = value.ref === null ? null : fileRef(value.ref, label + '.ref');
  if ((value.state === 'MISSING') !== (refValue === null)) throw new Error(label + ' reference state mismatch');
  if (value.sourceDigest !== null && (typeof value.sourceDigest !== 'string' || !RAW_DIGEST.test(value.sourceDigest))) throw new Error(label + '.sourceDigest is invalid');
  const summaryValue = summary(value.summary, label + '.summary', !rebuilt);
  if (rebuilt && (value.sourceDigest === null || summaryValue === null)) throw new Error(label + ' must contain a rebuilt index');
  if (!Array.isArray(value.toolIds) || value.toolIds.length > 4096 || value.toolIds.some((item) => typeof item !== 'string' || !ID.test(item)) || !same(value.toolIds, Array.from(new Set(value.toolIds)).sort())) throw new Error(label + '.toolIds are not canonical');
  return { state: value.state, ref: refValue, sourceDigest: value.sourceDigest, summary: summaryValue, toolIds: value.toolIds.slice() };
}
function sealSnapshot(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'sourceLabel', 'evaluatedAt', 'scopeId', 'inputRefs', 'currentIndex', 'rebuiltIndex', 'resources', 'privacy', 'truth', 'authority'], 'shadow snapshot');
  if (value.schema !== SNAPSHOT_SCHEMA || value.version !== VERSION || value.status !== 'TEST' || value.scopeId !== SCOPE_ID || value.authority !== 'NONE') throw new Error('shadow snapshot identity drift');
  if (!Array.isArray(value.inputRefs) || value.inputRefs.length < 1 || value.inputRefs.length > RESOURCES.maxInputFiles) throw new Error('snapshot inputRefs are invalid');
  const inputRefs = value.inputRefs.map((item, index) => fileRef(item, 'inputRefs[' + index + ']'));
  const keys = inputRefs.map((item) => item.path.toLowerCase());
  if (!same(inputRefs.map((item) => item.path), inputRefs.map((item) => item.path).slice().sort()) || new Set(keys).size !== keys.length) throw new Error('snapshot inputRefs are not unique and canonical');
  const currentIndex = indexObservation(value.currentIndex, 'currentIndex', false);
  const rebuiltIndex = indexObservation(value.rebuiltIndex, 'rebuiltIndex', true);
  exact(value.resources, ['inputFiles', 'inputBytes', 'enforced'], 'snapshot resources');
  const inputBytes = inputRefs.reduce((sum, item) => sum + item.byteLength, 0);
  if (value.resources.inputFiles !== inputRefs.length || value.resources.inputBytes !== inputBytes || value.resources.enforced !== true || inputBytes > RESOURCES.maxInputBytes) throw new Error('snapshot resource observations drifted');
  exact(value.privacy, ['rawSourceRetained', 'machinePathsRetained', 'secretsRead'], 'snapshot privacy');
  if (!same(value.privacy, { rawSourceRetained: false, machinePathsRetained: false, secretsRead: false })) throw new Error('snapshot privacy truth drifted');
  exact(value.truth, ['sourceRead', 'sourceWritten', 'candidateExecuted', 'networkUsed', 'childProcessSpawned', 'installed', 'integrated', 'promoted', 'canonChanged'], 'snapshot truth');
  if (!same(value.truth, { sourceRead: true, sourceWritten: false, candidateExecuted: false, networkUsed: false, childProcessSpawned: false, installed: false, integrated: false, promoted: false, canonChanged: false })) throw new Error('snapshot authority truth drifted');
  const sourceStateDigest = hashValue({ scopeId: SCOPE_ID, inputRefs, currentIndexRef: currentIndex.ref, rebuiltIndexRef: rebuiltIndex.ref });
  const core = { schema: SNAPSHOT_SCHEMA, version: VERSION, status: 'TEST', id: id(value.id, 'snapshot.id'), sourceLabel: boundedText(value.sourceLabel, 'snapshot.sourceLabel', 160), evaluatedAt: timestamp(value.evaluatedAt, 'snapshot.evaluatedAt'), scopeId: SCOPE_ID, inputRefs, currentIndex, rebuiltIndex, sourceStateDigest, resources: clone(value.resources), privacy: clone(value.privacy), truth: clone(value.truth), authority: 'NONE' };
  return { ...core, snapshotDigest: hashValue(core) };
}
function normalizeSnapshot(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'sourceLabel', 'evaluatedAt', 'scopeId', 'inputRefs', 'currentIndex', 'rebuiltIndex', 'sourceStateDigest', 'resources', 'privacy', 'truth', 'authority', 'snapshotDigest'], 'shadow snapshot');
  const { snapshotDigest, sourceStateDigest, ...core } = value;
  const sealed = sealSnapshot(core);
  if (sourceStateDigest !== sealed.sourceStateDigest || snapshotDigest !== sealed.snapshotDigest || !same(value, sealed)) throw new Error('shadow snapshot digest mismatch');
  return sealed;
}
function setDifference(left, right) { const other = new Set(right); return left.filter((item) => !other.has(item)); }
function plan(inputRequest, inputSnapshot) {
  const request = normalizeRequest(inputRequest);
  const snapshot = normalizeSnapshot(inputSnapshot);
  if (request.sourceLabel !== snapshot.sourceLabel || request.evaluatedAt !== snapshot.evaluatedAt) throw new Error('request and snapshot context drift');
  let finding = 'NONE';
  if (snapshot.currentIndex.state === 'MISSING') finding = 'TOOLS_INDEX_MISSING';
  else if (snapshot.currentIndex.state === 'INVALID') finding = 'TOOLS_INDEX_INVALID';
  else if (snapshot.currentIndex.sourceDigest !== snapshot.rebuiltIndex.sourceDigest) finding = 'TOOLS_INDEX_SOURCE_DIGEST_STALE';
  const draft = finding !== 'NONE';
  const changes = draft ? [{ path: RECIPE.outputPath, operation: snapshot.currentIndex.ref ? 'REPLACE' : 'ADD', expectedCurrentSha256: snapshot.currentIndex.ref ? snapshot.currentIndex.ref.sha256 : null, replacementSha256: snapshot.rebuiltIndex.ref.sha256, replacementByteLength: snapshot.rebuiltIndex.ref.byteLength }] : [];
  const outputBytes = draft ? snapshot.rebuiltIndex.ref.byteLength : 0;
  if (outputBytes > request.resources.maxOutputBytes) throw new Error('shadow draft output budget exceeded');
  const core = {
    schema: PLAN_SCHEMA, version: VERSION, status: draft ? 'DRAFT_PLANNED' : 'CURRENT_NO_DRAFT', id: request.id + '-plan',
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest }, snapshotRef: { id: snapshot.id, schema: snapshot.schema, sha256: snapshot.snapshotDigest }, recipe: clone(RECIPE), finding,
    comparison: { sourceDigestBefore: snapshot.currentIndex.sourceDigest, sourceDigestAfter: snapshot.rebuiltIndex.sourceDigest, summaryBefore: clone(snapshot.currentIndex.summary), summaryAfter: clone(snapshot.rebuiltIndex.summary), addedToolIds: setDifference(snapshot.rebuiltIndex.toolIds, snapshot.currentIndex.toolIds), removedToolIds: setDifference(snapshot.currentIndex.toolIds, snapshot.rebuiltIndex.toolIds) },
    changes,
    resources: { inputFiles: snapshot.resources.inputFiles, inputBytes: snapshot.resources.inputBytes, outputFiles: draft ? 1 : 0, outputBytes, networkRequests: 0, childProcesses: 0, enforced: true },
    limitations: ['This first shadow recipe can only refresh tools-index.json from declared tool structure and existing byte-bound selftest receipts.', 'The draft is an immutable detached overlay; it is not installed, integrated, promoted, published, or CANON.', 'A changed source-state digest makes the draft stale and blocks preview or reuse.', 'No candidate code or arbitrary command is executed.'],
    truth: { deterministicPlan: true, sourceCurrentAtPlanning: true, draftDetached: draft, candidateExecuted: false, sourceWritten: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  };
  return { request, snapshot, plan: { ...core, planDigest: hashValue(core) } };
}
function verify(result, request, snapshot) { try { return same(result, plan(request, snapshot)) ? { pass: true, errors: [] } : { pass: false, errors: ['shadow plan differs from deterministic rebuild'] }; } catch (error) { return { pass: false, errors: [error.message] }; } }
function buildExampleRequest(evaluatedAt = '2026-08-23T03:00:00.000Z', sourceLabel = 'current-workshop') {
  const decisionRef = { id: 'mike-shadow-workshop-draft-direction', schema: 'axm.explicit-human-direction/v1', sha256: hashValue('Mike authorized current Workshop read-only snapshots, detached sandbox improvement drafts, refresh, and preview; source write-back and installation remain false.') };
  return sealRequest({ schema: REQUEST_SCHEMA, id: 'refresh-current-workshop-shadow', sourceLabel, evaluatedAt, recipe: clone(RECIPE), rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'shadow-' + root.toLowerCase().replace(/_/g, '-'), schema: 'axm.four-root-technical-review/v1', sha256: hashValue('workshop-shadow-v0.5:' + root) }] })), authorization: { decisionRef, snapshotRead: true, sandboxDraft: true, sandboxRefresh: true, preview: true, candidateExecution: false, sourceWriteBack: false, install: false, integrate: false, publish: false, promote: false, canon: false, authenticatedIdentityProven: false, authority: 'NONE' }, resources: clone(RESOURCES), privacy: clone(PRIVACY), authority: 'NONE' });
}

module.exports = { VERSION, REQUEST_SCHEMA, SNAPSHOT_SCHEMA, PLAN_SCHEMA, ROOTS, SCOPE_ID, RECIPE, RESOURCES, PRIVACY, clone, canonical, same, hashBytes, hashValue, portablePath, sealRequest, normalizeRequest, sealSnapshot, normalizeSnapshot, plan, verify, buildExampleRequest };
