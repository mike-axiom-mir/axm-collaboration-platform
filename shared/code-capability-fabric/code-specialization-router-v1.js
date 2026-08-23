'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const Semantic = require('./semantic-candidate-generator-v1');
const Specialists = require('../specialists/axm-specialist-library');
const HandFoundryContract = require('../../tools/hand-specification-foundry/module.contract.json');
const RAW_CATALOG = require('./code-specialization-catalog-v1.json');
const MODULE_CONTRACT = require('./module-code-specialization-router-v1.contract.json');

const VERSION = '1.5.0';
const CATALOG_SCHEMA = 'axm.code-specialization-catalog/v1';
const OBSERVATION_SCHEMA = 'axm.code-artifact-observation/v1';
const REQUEST_SCHEMA = 'axm.code-specialization-request/v1';
const PLAN_SCHEMA = 'axm.code-specialization-plan/v1';
const PROFILE_SCHEMA = 'axm.code-specialist-organ-profile/v1';
const GAP_SCHEMA = 'axm.capability-gap-report/v1';
const ROOTS = Object.freeze(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
const EVIDENCE_KINDS = Object.freeze([
  'AUTHORIZATION', 'DETERMINISTIC_BEHAVIOR', 'INTERACTION_JOURNEY', 'MOTION_TIMING',
  'PERFORMANCE', 'PERSISTENCE', 'PROVENANCE', 'QUALITY', 'RESOURCE_SAFETY',
  'STATIC_STRUCTURE', 'TRANSPORT', 'VISUAL_APPEARANCE'
]);
const LIMITATIONS = Object.freeze([
  'ARTIFACT_CONTENT_NOT_READ',
  'ARTIFACT_SEMANTICS_NOT_PROVEN',
  'AUTOMATIC_MERGE_NOT_AUTHORIZED',
  'CANDIDATE_NOT_GENERATED',
  'CLASSIFICATION_CATALOG_NOT_COMPLETE_LANGUAGE_UNIVERSE',
  'DECLARED_FRAMEWORK_NOT_INDEPENDENTLY_VERIFIED',
  'DECLARED_LANGUAGE_NOT_INDEPENDENTLY_VERIFIED',
  'DECLARED_RESPONSIBILITY_NOT_INDEPENDENTLY_VERIFIED',
  'FOUR_ROOT_EVIDENCE_CONTENT_NOT_REVERIFIED',
  'HOST_OBSERVATION_NOT_AUTHENTICATED',
  'KNOWLEDGE_LANES_EMPTY_REFERENCE_ONLY',
  'KNOWLEDGE_NOT_LOADED',
  'LESSON_ADMISSION_NOT_AUTHORIZED',
  'RESOURCE_DURATION_NOT_INDEPENDENTLY_ENFORCED',
  'RESOURCE_MEMORY_NOT_INDEPENDENTLY_ENFORCED',
  'RUNTIME_BEHAVIOR_NOT_PROVEN',
  'SOURCE_BYTES_NOT_INCLUDED',
  'SPECIALIST_PROFILE_IS_NOT_CAPABILITY_PROOF',
  'TESTS_NOT_RUN',
  'CANON_CHANGE_NOT_AUTHORIZED'
].sort(compareText));
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+@-]{0,219}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function canonicalJson(value) { return DeterministicJson.canonicalJson(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function sha256Value(value) { return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
function jsonBytes(value) { return Buffer.byteLength(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function fail(message) { throw new Error(message); }

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(label + ' must be a plain object');
  }
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = fields.slice().sort(compareText);
  if (!same(actual, expected)) fail(label + ' fields must be exactly ' + expected.join(', '));
}

function text(value, label, maximum) {
  if (typeof value !== 'string') fail(label + ' must be text');
  const normalized = value.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    fail(label + ' must be bounded normalized text');
  }
  return normalized;
}

function id(value, label) {
  const normalized = text(value, label, 128);
  if (!ID.test(normalized)) fail(label + ' must be a portable identifier');
  return normalized;
}

function token(value, label) {
  const normalized = text(value, label, 220);
  if (!TOKEN.test(normalized)) fail(label + ' must be a portable contract token');
  return normalized;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(label + ' must be a sha256 digest');
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(label + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') fail(label + ' must be boolean');
  return value;
}

function iso(value, label) {
  const normalized = text(value, label, 40);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) fail(label + ' must be exact UTC ISO time');
  return normalized;
}

function uniqueSorted(values, label, normalizer, maximum, minimum = 0) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    fail(label + ' must contain ' + minimum + ' through ' + maximum + ' items');
  }
  const result = values.map((value, index) => normalizer(value, label + '[' + index + ']'))
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  for (let index = 1; index < result.length; index += 1) {
    if (same(result[index - 1], result[index])) fail(label + ' contains duplicates');
  }
  return result;
}

function tokens(values, label, maximum, minimum = 0) {
  return uniqueSorted(values, label, token, maximum, minimum);
}

function ids(values, label, maximum, minimum = 0) {
  return uniqueSorted(values, label, id, maximum, minimum);
}

function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: id(value.id, label + '.id'), schema: token(value.schema, label + '.schema'), sha256: digest(value.sha256, label + '.sha256') };
}

function optionalReference(value, label) { return value === null ? null : reference(value, label); }

function maskReference(mask) {
  return { id: mask.id, schema: mask.schema, version: mask.version, sha256: sha256Value(mask) };
}

function catalogReference() {
  return { id: CATALOG.id, schema: CATALOG.schema, sha256: sha256Value(CATALOG) };
}

function organReference(profile) {
  return { id: profile.id, schema: PROFILE_SCHEMA, version: profile.version, sha256: sha256Value(profile) };
}

function normalizeCatalog(raw) {
  exact(raw, ['schema', 'id', 'version', 'status', 'axes', 'languages', 'specialistOrgans', 'knowledgePolicy', 'truth'], 'catalog');
  if (raw.schema !== CATALOG_SCHEMA || raw.version !== VERSION || raw.status !== 'TEST') fail('catalog identity mismatch');
  exact(raw.axes, ['artifactFamilies', 'responsibilities', 'runtimes', 'frameworks'], 'catalog.axes');
  const axes = {
    artifactFamilies: ids(raw.axes.artifactFamilies, 'catalog.axes.artifactFamilies', 64, 1),
    responsibilities: ids(raw.axes.responsibilities, 'catalog.axes.responsibilities', 96, 1),
    runtimes: ids(raw.axes.runtimes, 'catalog.axes.runtimes', 48, 1),
    frameworks: ids(raw.axes.frameworks, 'catalog.axes.frameworks', 128, 1)
  };
  const languages = uniqueSorted(raw.languages, 'catalog.languages', (value, label) => {
    exact(value, ['id', 'family', 'extensions', 'basenames'], label);
    const extensions = uniqueSorted(value.extensions, label + '.extensions', (entry, entryLabel) => {
      const normalized = text(entry, entryLabel, 32).toLowerCase();
      if (!/^\.[a-z0-9][a-z0-9._+-]*$/.test(normalized)) fail(entryLabel + ' must be a lowercase extension');
      return normalized;
    }, 24);
    const basenames = uniqueSorted(value.basenames, label + '.basenames', (entry, entryLabel) => {
      const normalized = text(entry, entryLabel, 80).toLowerCase();
      if (normalized.includes('/') || normalized.includes('\\') || normalized.includes(':')) fail(entryLabel + ' must be one portable basename');
      return normalized;
    }, 12);
    if (!extensions.length && !basenames.length) fail(label + ' must declare an extension or basename');
    return { id: id(value.id, label + '.id'), family: id(value.family, label + '.family'), extensions, basenames };
  }, 256, 1);
  const masks = new Map(Specialists.catalog().map((mask) => [mask.id, mask]));
  const organs = uniqueSorted(raw.specialistOrgans, 'catalog.specialistOrgans', (value, label) => {
    exact(value, ['id', 'version', 'status', 'selectors', 'methodMaskIds', 'knowledgeLane', 'evidenceKinds', 'refuses'], label);
    if (!SEMVER.test(value.version) || value.status !== 'TEST') fail(label + ' version/status mismatch');
    exact(value.selectors, ['languageFamilies', 'languageIds', 'artifactFamilies', 'responsibilities', 'runtimes'], label + '.selectors');
    const selectors = {
      languageFamilies: ids(value.selectors.languageFamilies, label + '.selectors.languageFamilies', 64),
      languageIds: ids(value.selectors.languageIds, label + '.selectors.languageIds', 64),
      artifactFamilies: ids(value.selectors.artifactFamilies, label + '.selectors.artifactFamilies', 64),
      responsibilities: ids(value.selectors.responsibilities, label + '.selectors.responsibilities', 64),
      runtimes: ids(value.selectors.runtimes, label + '.selectors.runtimes', 48)
    };
    selectors.languageIds.forEach((languageId) => {
      if (!languages.some((language) => language.id === languageId)) fail(label + ' selects unknown language ' + languageId);
    });
    selectors.artifactFamilies.forEach((entry) => { if (!axes.artifactFamilies.includes(entry)) fail(label + ' selects unknown artifact family ' + entry); });
    selectors.responsibilities.forEach((entry) => { if (!axes.responsibilities.includes(entry)) fail(label + ' selects unknown responsibility ' + entry); });
    selectors.runtimes.forEach((entry) => { if (!axes.runtimes.includes(entry)) fail(label + ' selects unknown runtime ' + entry); });
    const methodMaskIds = tokens(value.methodMaskIds, label + '.methodMaskIds', 8, 1);
    methodMaskIds.forEach((maskId) => { if (!masks.has(maskId)) fail(label + ' references missing specialist mask ' + maskId); });
    exact(value.knowledgeLane, ['id', 'state', 'allowedLessonKinds', 'admissionGate'], label + '.knowledgeLane');
    if (value.knowledgeLane.state !== 'REFERENCE_ONLY_EMPTY' || value.knowledgeLane.admissionGate !== 'SEPARATE_TIER_3_DECISION_AND_HELD_OUT_REGRESSION') {
      fail(label + ' knowledge lane exceeds this planning rung');
    }
    const knowledgeLane = {
      id: id(value.knowledgeLane.id, label + '.knowledgeLane.id'),
      state: value.knowledgeLane.state,
      allowedLessonKinds: tokens(value.knowledgeLane.allowedLessonKinds, label + '.knowledgeLane.allowedLessonKinds', 8, 1),
      admissionGate: value.knowledgeLane.admissionGate
    };
    const evidenceKinds = tokens(value.evidenceKinds, label + '.evidenceKinds', 16, 1);
    evidenceKinds.forEach((kind) => { if (!EVIDENCE_KINDS.includes(kind)) fail(label + ' uses unsupported evidence kind ' + kind); });
    return {
      id: id(value.id, label + '.id'), version: value.version, status: value.status, selectors,
      methodMaskIds, knowledgeLane, evidenceKinds, refuses: tokens(value.refuses, label + '.refuses', 32, 1)
    };
  }, 64, 1);
  exact(raw.knowledgePolicy, ['allowedLessonKinds', 'forbiddenDurableContent', 'initialState', 'automaticAdmission', 'runningAttemptMutation', 'requiresHeldOutRegression', 'requiresHumanDecision'], 'catalog.knowledgePolicy');
  if (raw.knowledgePolicy.initialState !== 'REFERENCE_ONLY_EMPTY' || raw.knowledgePolicy.automaticAdmission !== false ||
      raw.knowledgePolicy.runningAttemptMutation !== false || raw.knowledgePolicy.requiresHeldOutRegression !== true ||
      raw.knowledgePolicy.requiresHumanDecision !== true) fail('catalog knowledge policy exceeds this rung');
  const knowledgePolicy = {
    allowedLessonKinds: tokens(raw.knowledgePolicy.allowedLessonKinds, 'catalog.knowledgePolicy.allowedLessonKinds', 8, 1),
    forbiddenDurableContent: tokens(raw.knowledgePolicy.forbiddenDurableContent, 'catalog.knowledgePolicy.forbiddenDurableContent', 16, 1),
    initialState: raw.knowledgePolicy.initialState, automaticAdmission: false, runningAttemptMutation: false,
    requiresHeldOutRegression: true, requiresHumanDecision: true
  };
  exact(raw.truth, ['completeLanguageUniverseClaimed', 'fileExtensionProvesLanguage', 'pathClassificationProvesSemantics', 'specialistProfileProvesCapability', 'knowledgeAttached', 'learningPerformed', 'authorityGranted'], 'catalog.truth');
  Object.keys(raw.truth).forEach((field) => { if (raw.truth[field] !== false) fail('catalog.truth.' + field + ' must remain false'); });
  const languageIds = languages.map((language) => language.id);
  if (new Set(languageIds).size !== languageIds.length) fail('catalog language ids must be unique');
  const organIds = organs.map((organ) => organ.id);
  if (new Set(organIds).size !== organIds.length) fail('catalog specialist organ ids must be unique');
  return {
    schema: raw.schema, id: id(raw.id, 'catalog.id'), version: raw.version, status: raw.status,
    axes, languages, specialistOrgans: organs, knowledgePolicy,
    truth: clone(raw.truth)
  };
}

const CATALOG = normalizeCatalog(RAW_CATALOG);
const LANGUAGE_BY_ID = new Map(CATALOG.languages.map((language) => [language.id, language]));
const MASK_BY_ID = new Map(Specialists.catalog().map((mask) => [mask.id, mask]));

function artifactEntry(value, label) {
  exact(value, [
    'id', 'path', 'sha256', 'byteLength', 'declaredLanguageId', 'artifactFamilies',
    'responsibilities', 'runtimes', 'frameworks', 'requiredPermissions', 'networkDomains',
    'interfaceContracts', 'dependsOnArtifactIds', 'sharedSeam'
  ], label);
  return {
    id: id(value.id, label + '.id'),
    path: Semantic.normalizePortablePath(value.path, label + '.path'),
    sha256: digest(value.sha256, label + '.sha256'),
    byteLength: integer(value.byteLength, label + '.byteLength', 0, Number.MAX_SAFE_INTEGER),
    declaredLanguageId: value.declaredLanguageId === null ? null : id(value.declaredLanguageId, label + '.declaredLanguageId'),
    artifactFamilies: ids(value.artifactFamilies, label + '.artifactFamilies', 16, 1),
    responsibilities: ids(value.responsibilities, label + '.responsibilities', 24, 1),
    runtimes: ids(value.runtimes, label + '.runtimes', 12, 1),
    frameworks: ids(value.frameworks, label + '.frameworks', 24),
    requiredPermissions: ids(value.requiredPermissions, label + '.requiredPermissions', 24),
    networkDomains: ids(value.networkDomains, label + '.networkDomains', 24),
    interfaceContracts: tokens(value.interfaceContracts, label + '.interfaceContracts', 48),
    dependsOnArtifactIds: ids(value.dependsOnArtifactIds, label + '.dependsOnArtifactIds', 64),
    sharedSeam: boolean(value.sharedSeam, label + '.sharedSeam')
  };
}

function normalizeObservationCore(value) {
  exact(value, ['schema', 'version', 'id', 'observedAt', 'workspaceRef', 'artifacts', 'sourceBytesIncluded', 'sourceBytesRead', 'attestationRef', 'authority'], 'observation');
  if (value.schema !== OBSERVATION_SCHEMA || value.version !== VERSION || value.authority !== 'NONE') fail('observation identity or authority mismatch');
  if (value.sourceBytesIncluded !== false || value.sourceBytesRead !== false) fail('observation must not include or claim reading source bytes');
  const artifacts = uniqueSorted(value.artifacts, 'observation.artifacts', artifactEntry, 256, 1);
  const byId = new Map();
  const pathKeys = new Set();
  artifacts.forEach((artifact) => {
    if (byId.has(artifact.id)) fail('observation artifact ids must be unique');
    byId.set(artifact.id, artifact);
    const key = Semantic.pathKey(artifact.path);
    if (pathKeys.has(key)) fail('observation artifact paths contain a Windows case alias');
    pathKeys.add(key);
  });
  artifacts.forEach((artifact) => artifact.dependsOnArtifactIds.forEach((dependencyId) => {
    if (dependencyId === artifact.id || !byId.has(dependencyId)) fail('artifact dependency must name another observed artifact');
  }));
  const visiting = new Set();
  const visited = new Set();
  function visit(artifactId) {
    if (visiting.has(artifactId)) fail('observation artifact dependency cycle detected');
    if (visited.has(artifactId)) return;
    visiting.add(artifactId);
    byId.get(artifactId).dependsOnArtifactIds.forEach(visit);
    visiting.delete(artifactId);
    visited.add(artifactId);
  }
  artifacts.forEach((artifact) => visit(artifact.id));
  return {
    schema: value.schema, version: value.version, id: id(value.id, 'observation.id'),
    observedAt: iso(value.observedAt, 'observation.observedAt'), workspaceRef: reference(value.workspaceRef, 'observation.workspaceRef'),
    artifacts, sourceBytesIncluded: false, sourceBytesRead: false,
    attestationRef: optionalReference(value.attestationRef, 'observation.attestationRef'), authority: 'NONE'
  };
}

function sealObservation(value) {
  const core = normalizeObservationCore(value);
  return { ...core, observationDigest: sha256Value(core) };
}

function normalizeObservation(value) {
  exact(value, ['schema', 'version', 'id', 'observedAt', 'workspaceRef', 'artifacts', 'sourceBytesIncluded', 'sourceBytesRead', 'attestationRef', 'authority', 'observationDigest'], 'observation');
  const core = normalizeObservationCore(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'observationDigest')));
  if (digest(value.observationDigest, 'observation.observationDigest') !== sha256Value(core)) fail('observation digest drift detected');
  return { ...core, observationDigest: value.observationDigest };
}

function rootDecision(value, index) {
  const label = 'request.rootsGate[' + index + ']';
  exact(value, ['root', 'verdict', 'evidenceRefs'], label);
  if (value.root !== ROOTS[index] || !['PASS', 'HOLD', 'FAIL'].includes(value.verdict)) fail(label + ' does not preserve the ordered four-root gate');
  return { root: value.root, verdict: value.verdict, evidenceRefs: uniqueSorted(value.evidenceRefs, label + '.evidenceRefs', reference, 8, 1) };
}

function resources(value) {
  exact(value, ['maxInputBytes', 'maxOutputBytes', 'maxArtifacts', 'maxSpecialistsPerArtifact', 'maxMemoryBytes', 'maxDurationMs', 'maxProcesses', 'maxAttempts', 'maxCostMinorUnits'], 'request.resourceEnvelope');
  return {
    maxInputBytes: integer(value.maxInputBytes, 'request.resourceEnvelope.maxInputBytes', 1, 4 * 1024 * 1024),
    maxOutputBytes: integer(value.maxOutputBytes, 'request.resourceEnvelope.maxOutputBytes', 1, 8 * 1024 * 1024),
    maxArtifacts: integer(value.maxArtifacts, 'request.resourceEnvelope.maxArtifacts', 1, 256),
    maxSpecialistsPerArtifact: integer(value.maxSpecialistsPerArtifact, 'request.resourceEnvelope.maxSpecialistsPerArtifact', 1, 16),
    maxMemoryBytes: integer(value.maxMemoryBytes, 'request.resourceEnvelope.maxMemoryBytes', 1, Number.MAX_SAFE_INTEGER),
    maxDurationMs: integer(value.maxDurationMs, 'request.resourceEnvelope.maxDurationMs', 1, Number.MAX_SAFE_INTEGER),
    maxProcesses: integer(value.maxProcesses, 'request.resourceEnvelope.maxProcesses', 1, 1),
    maxAttempts: integer(value.maxAttempts, 'request.resourceEnvelope.maxAttempts', 1, 1),
    maxCostMinorUnits: integer(value.maxCostMinorUnits, 'request.resourceEnvelope.maxCostMinorUnits', 0, 0)
  };
}

function normalizeRequestCore(value) {
  exact(value, ['schema', 'version', 'id', 'plannedAt', 'maxObservationAgeMs', 'observation', 'catalogRef', 'settings', 'resourceEnvelope', 'rootsGate', 'instructionRef', 'authority'], 'request');
  if (value.schema !== REQUEST_SCHEMA || value.version !== VERSION || value.authority !== 'NONE') fail('request identity or authority mismatch');
  const catalogRef = reference(value.catalogRef, 'request.catalogRef');
  if (!same(catalogRef, catalogReference())) fail('request catalog reference is stale or forged');
  exact(value.settings, ['requireExplicitLanguageForAmbiguousPath', 'knowledgeMode', 'allowedPermissions', 'allowedNetworkDomains'], 'request.settings');
  if (value.settings.requireExplicitLanguageForAmbiguousPath !== true || value.settings.knowledgeMode !== 'REFERENCE_LANES_ONLY') fail('request settings exceed this planning rung');
  const allowedPermissions = ids(value.settings.allowedPermissions, 'request.settings.allowedPermissions', 0);
  const allowedNetworkDomains = ids(value.settings.allowedNetworkDomains, 'request.settings.allowedNetworkDomains', 0);
  if (!Array.isArray(value.rootsGate) || value.rootsGate.length !== ROOTS.length) fail('request.rootsGate must contain the ordered four roots');
  return {
    schema: value.schema, version: value.version, id: id(value.id, 'request.id'),
    plannedAt: iso(value.plannedAt, 'request.plannedAt'),
    maxObservationAgeMs: integer(value.maxObservationAgeMs, 'request.maxObservationAgeMs', 1, 86400000),
    observation: normalizeObservation(value.observation), catalogRef,
    settings: { requireExplicitLanguageForAmbiguousPath: true, knowledgeMode: 'REFERENCE_LANES_ONLY', allowedPermissions, allowedNetworkDomains },
    resourceEnvelope: resources(value.resourceEnvelope),
    rootsGate: value.rootsGate.map(rootDecision), instructionRef: reference(value.instructionRef, 'request.instructionRef'), authority: 'NONE'
  };
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  return { ...core, requestDigest: sha256Value(core) };
}

function normalizeRequest(value) {
  exact(value, ['schema', 'version', 'id', 'plannedAt', 'maxObservationAgeMs', 'observation', 'catalogRef', 'settings', 'resourceEnvelope', 'rootsGate', 'instructionRef', 'authority', 'requestDigest'], 'request');
  const core = normalizeRequestCore(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'requestDigest')));
  if (digest(value.requestDigest, 'request.requestDigest') !== sha256Value(core)) fail('request digest drift detected');
  if (jsonBytes(value) > core.resourceEnvelope.maxInputBytes) fail('request exceeds maxInputBytes');
  if (core.observation.artifacts.length > core.resourceEnvelope.maxArtifacts) fail('observation exceeds maxArtifacts');
  return { ...core, requestDigest: value.requestDigest };
}

function pathCandidates(path) {
  const basename = path.split('/').pop().toLowerCase();
  const dot = basename.lastIndexOf('.');
  const extension = dot >= 0 ? basename.slice(dot) : '';
  return CATALOG.languages.filter((language) => language.basenames.includes(basename) || language.extensions.includes(extension))
    .map((language) => ({ id: language.id, family: language.family })).sort((left, right) => compareText(left.id, right.id));
}

function languageClassification(artifact) {
  const candidates = pathCandidates(artifact.path);
  const declared = artifact.declaredLanguageId;
  if (declared !== null && !LANGUAGE_BY_ID.has(declared)) {
    return { candidates, declaredLanguageId: declared, selected: null, method: 'DECLARED_PLUS_PATH_TABLE', status: 'UNSUPPORTED_DECLARED_LANGUAGE', semanticProof: false };
  }
  if (declared !== null) {
    const selected = LANGUAGE_BY_ID.get(declared);
    if (!candidates.length) return { candidates, declaredLanguageId: declared, selected: null, method: 'DECLARED_PLUS_PATH_TABLE', status: 'DECLARATION_PATH_UNVERIFIED', semanticProof: false };
    if (!candidates.some((candidate) => candidate.id === declared)) return { candidates, declaredLanguageId: declared, selected: null, method: 'DECLARED_PLUS_PATH_TABLE', status: 'DECLARATION_PATH_CONFLICT', semanticProof: false };
    return { candidates, declaredLanguageId: declared, selected: { id: selected.id, family: selected.family }, method: 'DECLARED_PLUS_PATH_TABLE', status: 'DECLARED_PATH_COMPATIBLE', semanticProof: false };
  }
  if (!candidates.length) return { candidates, declaredLanguageId: null, selected: null, method: 'PATH_TABLE_ONLY', status: 'UNKNOWN_PATH_KIND', semanticProof: false };
  if (candidates.length > 1) return { candidates, declaredLanguageId: null, selected: null, method: 'PATH_TABLE_ONLY', status: 'AMBIGUOUS_PATH_KIND', semanticProof: false };
  return { candidates, declaredLanguageId: null, selected: candidates[0], method: 'PATH_TABLE_ONLY', status: 'MECHANICAL_SINGLE_CANDIDATE', semanticProof: false };
}

function intersects(left, right) { return left.some((entry) => right.includes(entry)); }

function matches(profile, classification, artifact) {
  if (!classification.selected) return false;
  const selectors = profile.selectors;
  const languageMatch = (!selectors.languageFamilies.length && !selectors.languageIds.length) ||
    selectors.languageFamilies.includes(classification.selected.family) || selectors.languageIds.includes(classification.selected.id);
  return languageMatch && (!selectors.artifactFamilies.length || intersects(selectors.artifactFamilies, artifact.artifactFamilies)) &&
    (!selectors.responsibilities.length || intersects(selectors.responsibilities, artifact.responsibilities)) &&
    (!selectors.runtimes.length || intersects(selectors.runtimes, artifact.runtimes));
}

function gap(artifactId, type, capability, detail) {
  return { id: 'gap-' + sha256Value([artifactId, type, capability, detail]).slice(7, 23), artifactId, type, capability, status: 'OPEN', detail };
}

function axisGaps(artifact) {
  const result = [];
  artifact.artifactFamilies.filter((entry) => !CATALOG.axes.artifactFamilies.includes(entry))
    .forEach((entry) => result.push(gap(artifact.id, 'CONTRACT', 'taxonomy.artifact-family.' + entry, 'UNKNOWN_ARTIFACT_FAMILY')));
  artifact.responsibilities.filter((entry) => !CATALOG.axes.responsibilities.includes(entry))
    .forEach((entry) => result.push(gap(artifact.id, 'CONTRACT', 'taxonomy.responsibility.' + entry, 'UNKNOWN_RESPONSIBILITY')));
  artifact.runtimes.filter((entry) => !CATALOG.axes.runtimes.includes(entry))
    .forEach((entry) => result.push(gap(artifact.id, 'SUBSTRATE', 'taxonomy.runtime.' + entry, 'UNKNOWN_RUNTIME')));
  artifact.frameworks.filter((entry) => !CATALOG.axes.frameworks.includes(entry))
    .forEach((entry) => result.push(gap(artifact.id, 'SKILL', 'knowledge.framework.' + entry, 'FRAMEWORK_PROFILE_MISSING')));
  if (artifact.responsibilities.includes('physical-actuation') || artifact.runtimes.includes('physical-device')) {
    result.push(gap(artifact.id, 'AUTHORITY', 'physical.actuation.separate-policy', 'TIER_5_PHYSICAL_POLICY_REQUIRED'));
  }
  artifact.requiredPermissions.forEach((entry) => result.push(gap(artifact.id, 'AUTHORITY', 'permission.' + entry, 'PLANNER_GRANTS_NO_PERMISSION')));
  artifact.networkDomains.forEach((entry) => result.push(gap(artifact.id, 'AUTHORITY', 'network.' + entry, 'PLANNER_GRANTS_NO_NETWORK')));
  return result.sort((left, right) => compareText(left.id, right.id));
}

function lane(profile, artifact) {
  return {
    organRef: organReference(profile),
    artifactRef: { id: artifact.id, schema: 'axm.code-artifact-observation-entry/v1', sha256: sha256Value(artifact) },
    proposedPaths: [artifact.path],
    methodMaskRefs: profile.methodMaskIds.map((maskId) => maskReference(MASK_BY_ID.get(maskId))).sort((left, right) => compareText(left.id, right.id)),
    knowledge: {
      laneId: profile.knowledgeLane.id, state: profile.knowledgeLane.state,
      allowedLessonKinds: profile.knowledgeLane.allowedLessonKinds.slice(), admittedLessonRefs: [],
      admissionGate: profile.knowledgeLane.admissionGate, knowledgeLoaded: false, lessonCandidateGenerated: false
    },
    evidencePlan: profile.evidenceKinds.map((kind) => ({ kind, verdict: 'UNKNOWN', executionStatus: 'NOT_RUN' })),
    permissions: [], networkDomains: [], executionStatus: 'NOT_RUN', candidateStatus: 'NOT_GENERATED', authority: 'NONE'
  };
}

function heldArtifactPlan(artifact, reason) {
  return {
    artifactRef: { id: artifact.id, schema: 'axm.code-artifact-observation-entry/v1', sha256: sha256Value(artifact) },
    path: artifact.path,
    languageClassification: { candidates: [], declaredLanguageId: artifact.declaredLanguageId, selected: null, method: 'NOT_EVALUATED', status: reason, semanticProof: false },
    declaredAxes: { artifactFamilies: artifact.artifactFamilies, responsibilities: artifact.responsibilities, runtimes: artifact.runtimes, frameworks: artifact.frameworks, interfaceContracts: artifact.interfaceContracts },
    axisGaps: [], specialistLanes: [], coordination: { required: false, sharedSeam: artifact.sharedSeam, mode: 'NOT_PLANNED', automaticMerge: false }, status: reason
  };
}

function activeArtifactPlan(artifact, maxSpecialists) {
  const classification = languageClassification(artifact);
  let gaps = axisGaps(artifact);
  if (!classification.selected) {
    const type = classification.status === 'UNSUPPORTED_DECLARED_LANGUAGE' || classification.status === 'UNKNOWN_PATH_KIND' ? 'CONTRACT' : 'EVIDENCE';
    gaps.push(gap(artifact.id, type, 'taxonomy.language.classify', classification.status));
  }
  let profiles = classification.selected ? CATALOG.specialistOrgans.filter((profile) => matches(profile, classification, artifact)) : [];
  if (profiles.length > maxSpecialists) {
    gaps.push(gap(artifact.id, 'CONTRACT', 'specialist.coordination.bound', 'MAX_SPECIALISTS_PER_ARTIFACT_EXCEEDED'));
    profiles = [];
  }
  if (classification.selected && !profiles.length) gaps.push(gap(artifact.id, 'SKILL', 'specialist.organ.' + classification.selected.family, 'SPECIALIST_PROFILE_MISSING'));
  gaps = gaps.sort((left, right) => compareText(left.id, right.id));
  const specialistLanes = profiles.map((profile) => lane(profile, artifact)).sort((left, right) => compareText(left.organRef.id, right.organRef.id));
  const blockingClassification = !classification.selected;
  const authorityHold = gaps.some((entry) => entry.type === 'AUTHORITY');
  const status = blockingClassification ? 'CLASSIFICATION_HOLD' : authorityHold ? 'AUTHORITY_HOLD' : gaps.length ? 'ROUTED_WITH_CAPABILITY_GAPS' : 'ROUTED_FOR_INERT_IMPROVEMENT_PLANNING';
  return {
    artifactRef: { id: artifact.id, schema: 'axm.code-artifact-observation-entry/v1', sha256: sha256Value(artifact) },
    path: artifact.path, languageClassification: classification,
    declaredAxes: { artifactFamilies: artifact.artifactFamilies, responsibilities: artifact.responsibilities, runtimes: artifact.runtimes, frameworks: artifact.frameworks, interfaceContracts: artifact.interfaceContracts },
    axisGaps: gaps, specialistLanes,
    coordination: {
      required: specialistLanes.length > 1 || artifact.sharedSeam,
      sharedSeam: artifact.sharedSeam,
      mode: specialistLanes.length > 1 || artifact.sharedSeam ? 'SEPARATE_CONTRIBUTIONS_COORDINATION_REQUIRED' : 'SINGLE_LANE',
      automaticMerge: false
    },
    status
  };
}

function requestRef(request) { return { id: request.id, schema: request.schema, sha256: request.requestDigest }; }
function observationRef(observation) { return { id: observation.id, schema: observation.schema, sha256: observation.observationDigest }; }

function buildGapReport(gaps, degraded) {
  const grouped = new Map();
  gaps.forEach((entry) => {
    if (!grouped.has(entry.capability)) grouped.set(entry.capability, { type: entry.type, requiredBy: new Set() });
    const group = grouped.get(entry.capability);
    group.requiredBy.add(entry.artifactId);
    if (group.type !== entry.type) group.type = 'UNKNOWN';
  });
  if (grouped.size > 200) fail('capability gap report exceeds Hand Specification Foundry maximum');
  const missingCapabilities = Array.from(grouped.keys()).sort(compareText);
  const proposedContracts = missingCapabilities.map((capability) => {
    const group = grouped.get(capability);
    return {
      capabilityId: capability,
      requestedCapability: capability,
      gapType: group.type,
      requiredBy: Array.from(group.requiredBy).sort(compareText),
      contractState: 'SPEC_REQUIRED',
      requiredFields: ['inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget', 'failureRecovery', 'compatibility', 'verification']
    };
  });
  return {
    schema: GAP_SCHEMA,
    overall: degraded || gaps.length ? 'DEGRADED' : 'READY',
    missingCapabilities,
    proposedContracts,
    handoff: {
      capability: 'capability.specify.missing-hand/v1',
      contractRef: { id: HandFoundryContract.id, schema: HandFoundryContract.schema, sha256: sha256Value(HandFoundryContract) },
      automaticSpecification: false
    },
    automaticInstall: false,
    automaticPermission: false,
    automaticQualityReduction: false,
    truth: {
      implementationAvailableForEveryGap: false,
      specificationClosesGap: false,
      unsupportedCapabilityPretendedAvailable: false
    }
  };
}

function sealPlan(core) {
  let outputBytes = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const measuredCore = clone(core);
    measuredCore.resourceObservation.outputBytes = outputBytes;
    const packet = { ...measuredCore, planDigest: sha256Value(measuredCore) };
    const measured = jsonBytes(packet);
    if (measured === outputBytes) return packet;
    outputBytes = measured;
  }
  fail('plan output byte measurement did not stabilize');
}

function plan(input) {
  const request = normalizeRequest(input);
  const rootHold = request.rootsGate.some((decision) => decision.verdict !== 'PASS');
  const plannedMs = Date.parse(request.plannedAt);
  const observedMs = Date.parse(request.observation.observedAt);
  const observationAgeMs = plannedMs - observedMs;
  const stale = observationAgeMs < 0 || observationAgeMs > request.maxObservationAgeMs;
  let artifactPlans;
  if (rootHold) artifactPlans = request.observation.artifacts.map((artifact) => heldArtifactPlan(artifact, 'ROOTS_HOLD_NOT_CLASSIFIED'));
  else if (stale) artifactPlans = request.observation.artifacts.map((artifact) => heldArtifactPlan(artifact, 'STALE_OBSERVATION_NOT_CLASSIFIED'));
  else artifactPlans = request.observation.artifacts.map((artifact) => activeArtifactPlan(artifact, request.resourceEnvelope.maxSpecialistsPerArtifact));
  const gaps = artifactPlans.flatMap((artifactPlan) => artifactPlan.axisGaps).sort((left, right) => compareText(left.id, right.id));
  const classificationHolds = artifactPlans.filter((artifactPlan) => artifactPlan.status === 'CLASSIFICATION_HOLD').length;
  const authorityHolds = artifactPlans.filter((artifactPlan) => artifactPlan.status === 'AUTHORITY_HOLD').length;
  const specialistLaneCount = artifactPlans.reduce((sum, artifactPlan) => sum + artifactPlan.specialistLanes.length, 0);
  let status;
  let nextGate;
  if (rootHold) { status = 'ROOTS_HOLD'; nextGate = 'REPAIR_ROOT_EVIDENCE_AND_REPLAN'; }
  else if (stale) { status = 'STALE_OBSERVATION_HOLD'; nextGate = 'REFRESH_EXACT_ARTIFACT_OBSERVATION_AND_REPLAN'; }
  else if (authorityHolds) { status = 'AUTHORITY_HOLD'; nextGate = 'REMOVE_AUTHORITY_EXPANSION_OR_REQUEST_SEPARATE_HIGHER_TIER_POLICY'; }
  else if (classificationHolds) { status = 'CLASSIFICATION_HOLD'; nextGate = 'DECLARE_OR_DISAMBIGUATE_EXACT_CODE_LANGUAGE'; }
  else if (gaps.length) { status = 'CAPABILITY_GAPS'; nextGate = 'ADD_REVIEWED_TAXONOMY_OR_SPECIALIST_PROFILE_AND_REPLAN'; }
  else { status = 'READY_FOR_SPECIALIST_IMPROVEMENT_REQUEST'; nextGate = 'NEW_EXACT_TIER_1_DETACHED_CANDIDATE_REQUEST_REQUIRED'; }
  const core = {
    schema: PLAN_SCHEMA, version: VERSION, status,
    requestRef: requestRef(request), catalogRef: catalogReference(), observationRef: observationRef(request.observation),
    classificationSummary: {
      artifactCount: artifactPlans.length,
      classifiedCount: artifactPlans.filter((item) => item.languageClassification.selected !== null).length,
      classificationHoldCount: classificationHolds,
      capabilityGapCount: gaps.length,
      authorityHoldCount: authorityHolds,
      specialistLaneCount,
      coordinationRequiredCount: artifactPlans.filter((item) => item.coordination.required).length
    },
    artifactPlans,
    capabilityGapReport: buildGapReport(gaps, rootHold || stale),
    resourceObservation: {
      inputBytes: jsonBytes(request), outputBytes: 0, artifactCount: artifactPlans.length,
      specialistLaneCount, attemptsEnforced: true, artifactCountEnforced: true,
      specialistCountEnforced: true, durationEnforced: false, memoryEnforced: false,
      processesSpawned: 0, networkUsed: false, sourceBytesRead: false, workspaceRead: false, workspaceWritten: false
    },
    limitations: LIMITATIONS.slice(), nextGate,
    truth: {
      deterministicPlanOnly: true,
      rootsEvaluatedBeforeClassification: true,
      observationDigestVerified: true,
      observationAttestationPresent: request.observation.attestationRef !== null,
      hostObservationIndependentlyTrusted: false,
      pathClassificationProvesLanguage: false,
      declarationsProveSemantics: false,
      specialistProfileProvesCapability: false,
      sourceBytesIncluded: false,
      sourceBytesRead: false,
      frameworkKnowledgeLoaded: false,
      persistentLearningAdmitted: false,
      candidateGenerated: false,
      candidateExecuted: false,
      testsRun: false,
      permissionGranted: false,
      networkUsed: false,
      workspaceWritten: false,
      installed: false,
      integrated: false,
      published: false,
      promoted: false,
      canonChanged: false,
      mikeFinalMergeGatePreserved: true
    },
    authority: 'NONE'
  };
  const sealed = sealPlan(core);
  if (sealed.resourceObservation.outputBytes > request.resourceEnvelope.maxOutputBytes) fail('plan exceeds maxOutputBytes');
  return sealed;
}

function verify(result, request) {
  try { return same(result, plan(request)) ? { pass: true, errors: [] } : { pass: false, errors: ['plan differs from deterministic rebuild'] }; }
  catch (error) { return { pass: false, errors: [error.message] }; }
}

function buildExampleObservation(observedAt = '2026-08-23T15:00:00.000Z') {
  const artifact = (artifactId, path, language, families, responsibilities, runtimes, frameworks, dependsOn = [], sharedSeam = false) => ({
    id: artifactId, path, sha256: sha256Value('example-bytes:' + path), byteLength: 128,
    declaredLanguageId: language, artifactFamilies: families, responsibilities, runtimes, frameworks,
    requiredPermissions: [], networkDomains: [], interfaceContracts: [], dependsOnArtifactIds: dependsOn, sharedSeam
  });
  return sealObservation({
    schema: OBSERVATION_SCHEMA, version: VERSION, id: 'example-code-artifact-observation', observedAt,
    workspaceRef: { id: 'example-workshop-snapshot', schema: 'axm.workshop-shadow-snapshot/v1', sha256: sha256Value('example-workshop-snapshot') },
    artifacts: [
      artifact('game-index', 'game/index.html', 'html', ['markup'], ['accessibility', 'document-structure', 'interface'], ['browser'], ['web-platform'], [], true),
      artifact('game-style', 'game/style.css', 'css', ['style'], ['accessibility', 'layout', 'visual-presentation'], ['browser'], ['web-platform'], ['game-index']),
      artifact('game-rules', 'game/game-rule.js', 'javascript', ['module', 'script'], ['application-logic', 'game-rules'], ['browser'], ['web-platform'], ['game-index']),
      artifact('game-schema', 'game/game-state.schema.json', 'json', ['data', 'schema'], ['data-contract', 'validation'], ['inert-data'], [], []),
      artifact('game-test', 'game/game-rule.test.js', 'javascript', ['test'], ['testing', 'validation'], ['node'], ['node'], ['game-rules'])
    ],
    sourceBytesIncluded: false, sourceBytesRead: false, attestationRef: null, authority: 'NONE'
  });
}

function buildExampleRequest(plannedAt = '2026-08-23T15:05:00.000Z') {
  const observation = buildExampleObservation('2026-08-23T15:00:00.000Z');
  return sealRequest({
    schema: REQUEST_SCHEMA, version: VERSION, id: 'route-example-code-specialists', plannedAt, maxObservationAgeMs: 3600000,
    observation, catalogRef: catalogReference(),
    settings: { requireExplicitLanguageForAmbiguousPath: true, knowledgeMode: 'REFERENCE_LANES_ONLY', allowedPermissions: [], allowedNetworkDomains: [] },
    resourceEnvelope: { maxInputBytes: 1048576, maxOutputBytes: 2097152, maxArtifacts: 32, maxSpecialistsPerArtifact: 8, maxMemoryBytes: 268435456, maxDurationMs: 30000, maxProcesses: 1, maxAttempts: 1, maxCostMinorUnits: 0 },
    rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'code-taxonomy-' + root, schema: 'axm.four-root-technical-review/v1', sha256: sha256Value('code-taxonomy-' + root) }] })),
    instructionRef: { id: 'mike-code-specialization-direction', schema: 'axm.explicit-human-direction/v1', sha256: sha256Value('Categorize code before routing specialist knowledge; plans only, no execution, learning, installation, promotion, or CANON.') },
    authority: 'NONE'
  });
}

if (!MODULE_CONTRACT || MODULE_CONTRACT.id !== 'code-specialization-router-v1') fail('module contract identity mismatch');

module.exports = {
  VERSION, CATALOG_SCHEMA, OBSERVATION_SCHEMA, REQUEST_SCHEMA, PLAN_SCHEMA, PROFILE_SCHEMA, GAP_SCHEMA,
  ROOTS, EVIDENCE_KINDS, LIMITATIONS, CATALOG, MODULE_CONTRACT,
  canonicalJson, clone, same, sha256Value, jsonBytes, catalogReference, organReference,
  normalizeCatalog, sealObservation, normalizeObservation, sealRequest, normalizeRequest,
  pathCandidates, languageClassification, plan, verify, buildExampleObservation, buildExampleRequest
};
