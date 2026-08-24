'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const SpecializationRouter = require('./code-specialization-router-v1');
const SpecializationCatalog = SpecializationRouter.CATALOG;
const CapabilityRecipeCatalog = require('../capability-fabric/recipes/catalog.json');
const RawCatalog = require('./code-specialist-build-profile-catalog-v1.json');
const MODULE_CONTRACT = require('./module-code-specialist-build-profile-registry-v1.contract.json');

const VERSION = '1.0.0';
const PROFILE_SCHEMA = 'axm.code-specialist-build-profile/v1';
const CATALOG_SCHEMA = 'axm.code-specialist-build-profile-catalog/v1';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const FAMILY = /^[a-z][a-z0-9-]{2,79}$/;
const MODE = /^[A-Z][A-Z0-9_]{2,127}$/;
const GATE = /^[A-Z][A-Z0-9_]{2,159}$/;
const EVIDENCE_KIND = /^[A-Z][A-Z0-9_]{2,63}$/;
const BOUNDARY = Object.freeze({
  authority: 'NONE', permissions: [], networkDomains: [], workspaceRead: false,
  workspaceWrite: false, candidateExecution: false, install: false,
  integrate: false, publish: false, promote: false, canon: false
});

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function canonicalJson(value) { return DeterministicJson.canonicalJson(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function sha256Value(value) { return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
function fail(message) { throw new Error(message); }
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  if (!same(Object.keys(value).sort(compareText), fields.slice().sort(compareText))) fail(label + ' fields mismatch');
  return value;
}

function text(value, label, pattern, maximum) {
  if (typeof value !== 'string' || !value || value.length > maximum || (pattern && !pattern.test(value))) fail(label + ' is invalid');
  return value;
}

function digest(value, label) { return text(value, label, DIGEST, 71); }

function uniqueSorted(values, label, pattern, maximum) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) fail(label + ' must contain 1 to ' + maximum + ' entries');
  const normalized = values.map((value, index) => text(value, label + '[' + index + ']', pattern, 180));
  if (new Set(normalized).size !== normalized.length) fail(label + ' must be unique');
  return normalized.sort(compareText);
}

function versionedRef(value, label) {
  exact(value, ['id', 'schema', 'version', 'sha256'], label);
  return {
    id: text(value.id, label + '.id', null, 180),
    schema: text(value.schema, label + '.schema', null, 180),
    version: text(value.version, label + '.version', null, 80),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function recipeRef(value, label) {
  exact(value, ['id', 'version', 'digest', 'builderId', 'builderDigest', 'capabilityKind'], label);
  if (!['HAND', 'SKILL'].includes(value.capabilityKind)) fail(label + '.capabilityKind is invalid');
  return {
    id: text(value.id, label + '.id', FAMILY, 80),
    version: text(value.version, label + '.version', null, 80),
    digest: digest(value.digest, label + '.digest'),
    builderId: text(value.builderId, label + '.builderId', FAMILY, 80),
    builderDigest: digest(value.builderDigest, label + '.builderDigest'),
    capabilityKind: value.capabilityKind
  };
}

function normalizeProfileCore(value) {
  exact(value, ['schema', 'id', 'version', 'status', 'mode', 'specialistOrganRef', 'languageIds', 'capability', 'exampleArtifactId', 'gates', 'gaps', 'evidence', 'boundary'], 'profile');
  if (value.schema !== PROFILE_SCHEMA || value.status !== 'TEST') fail('profile identity or status mismatch');
  if (!/^\d+\.\d+\.\d+$/.test(String(value.version || ''))) fail('profile.version is invalid');
  exact(value.capability, ['family', 'recipeRef'], 'profile.capability');
  exact(value.gates, ['specialist', 'recipe', 'request'], 'profile.gates');
  exact(value.gaps, ['specialist', 'recipe', 'request'], 'profile.gaps');
  exact(value.evidence, ['visualBehavior', 'requiredKinds'], 'profile.evidence');
  exact(value.boundary, Object.keys(BOUNDARY), 'profile.boundary');
  if (!same(value.boundary, BOUNDARY)) fail('profile boundary exceeds detached candidate planning authority');
  if (!['NOT_APPLICABLE', 'UNKNOWN'].includes(value.evidence.visualBehavior)) fail('profile.evidence.visualBehavior is invalid');
  return {
    schema: PROFILE_SCHEMA,
    id: text(value.id, 'profile.id', ID, 128),
    version: value.version,
    status: 'TEST',
    mode: text(value.mode, 'profile.mode', MODE, 128),
    specialistOrganRef: versionedRef(value.specialistOrganRef, 'profile.specialistOrganRef'),
    languageIds: uniqueSorted(value.languageIds, 'profile.languageIds', ID, 16),
    capability: {
      family: text(value.capability.family, 'profile.capability.family', FAMILY, 80),
      recipeRef: recipeRef(value.capability.recipeRef, 'profile.capability.recipeRef')
    },
    exampleArtifactId: text(value.exampleArtifactId, 'profile.exampleArtifactId', ID, 128),
    gates: {
      specialist: text(value.gates.specialist, 'profile.gates.specialist', GATE, 160),
      recipe: text(value.gates.recipe, 'profile.gates.recipe', GATE, 160),
      request: text(value.gates.request, 'profile.gates.request', GATE, 160)
    },
    gaps: {
      specialist: text(value.gaps.specialist, 'profile.gaps.specialist', ID, 180),
      recipe: text(value.gaps.recipe, 'profile.gaps.recipe', ID, 180),
      request: text(value.gaps.request, 'profile.gaps.request', ID, 180)
    },
    evidence: {
      visualBehavior: value.evidence.visualBehavior,
      requiredKinds: uniqueSorted(value.evidence.requiredKinds, 'profile.evidence.requiredKinds', EVIDENCE_KIND, 16)
    },
    boundary: clone(BOUNDARY)
  };
}

function sealProfile(value) {
  const core = normalizeProfileCore(value);
  return { ...core, profileDigest: sha256Value(core) };
}

function normalizeProfile(value) {
  exact(value, ['schema', 'id', 'version', 'status', 'mode', 'specialistOrganRef', 'languageIds', 'capability', 'exampleArtifactId', 'gates', 'gaps', 'evidence', 'boundary', 'profileDigest'], 'profile');
  const core = normalizeProfileCore(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'profileDigest')));
  if (value.profileDigest !== sha256Value(core)) fail('profile digest mismatch');
  return { ...core, profileDigest: value.profileDigest };
}

function organRef(profile) {
  return { id: profile.id, schema: 'axm.code-specialist-organ-profile/v1', version: profile.version, sha256: sha256Value(profile) };
}

function catalogRecipeRef(recipe) {
  return { id: recipe.id, version: recipe.version, digest: recipe.recipeDigest, builderId: recipe.builderId, builderDigest: recipe.builderDigest, capabilityKind: recipe.capabilityKind };
}

function assessProfile(value, specializationCatalog = SpecializationCatalog, recipeCatalog = CapabilityRecipeCatalog) {
  const profile = normalizeProfile(value);
  const holds = [];
  const missingCapabilities = [];
  const recipeCatalogCore = clone(recipeCatalog);
  delete recipeCatalogCore.catalogDigest;
  if (!DIGEST.test(String(recipeCatalog.catalogDigest || '')) || recipeCatalog.catalogDigest !== sha256Value(recipeCatalogCore)) {
    holds.push({ code: 'RECIPE_CATALOG_DIGEST_DRIFT', detail: profile.capability.recipeRef.id });
    missingCapabilities.push(profile.gaps.recipe);
  }
  const languages = new Map((specializationCatalog.languages || []).map((row) => [row.id, row]));
  const organs = (specializationCatalog.specialistOrgans || []).filter((row) => row.id === profile.specialistOrganRef.id);
  if (organs.length !== 1) {
    holds.push({ code: organs.length ? 'SPECIALIST_VERSION_AMBIGUITY' : 'SPECIALIST_NOT_FOUND', detail: profile.specialistOrganRef.id });
    missingCapabilities.push(profile.gaps.specialist);
  } else {
    const organ = organs[0];
    if (!same(organRef(organ), profile.specialistOrganRef)) {
      holds.push({ code: 'SPECIALIST_LINEAGE_DRIFT', detail: profile.specialistOrganRef.id });
      missingCapabilities.push(profile.gaps.specialist);
    }
    profile.languageIds.forEach((languageId) => {
      const language = languages.get(languageId);
      if (!language) {
        holds.push({ code: 'LANGUAGE_ID_UNKNOWN', detail: languageId });
        missingCapabilities.push('code.language.' + languageId + '.taxonomy');
      } else if (!(organ.selectors.languageIds || []).includes(languageId) && !(organ.selectors.languageFamilies || []).includes(language.family)) {
        holds.push({ code: 'LANGUAGE_SPECIALIST_MISMATCH', detail: languageId + ' -> ' + organ.id });
        missingCapabilities.push(profile.gaps.specialist);
      }
    });
  }
  const recipes = (recipeCatalog.recipes || []).filter((row) => row.id === profile.capability.recipeRef.id);
  if (recipes.length !== 1) {
    holds.push({ code: recipes.length ? 'RECIPE_VERSION_AMBIGUITY' : 'RECIPE_NOT_FOUND', detail: profile.capability.recipeRef.id });
    missingCapabilities.push(profile.gaps.recipe);
  } else {
    const recipe = recipes[0];
    if (!same(catalogRecipeRef(recipe), profile.capability.recipeRef) || recipe.family !== profile.capability.family || recipe.activation !== 'ACTIVE_SOURCE_REVIEWED' || !recipe.reviewPolicy || recipe.reviewPolicy.sharedUseRequires !== 'MIKE_TOBI_MERGE' || recipe.reviewPolicy.canonAuthority !== 'NONE') {
      holds.push({ code: 'RECIPE_LINEAGE_OR_REVIEW_DRIFT', detail: profile.capability.recipeRef.id });
      missingCapabilities.push(profile.gaps.recipe);
    }
  }
  const gaps = Array.from(new Set(missingCapabilities)).sort(compareText);
  const core = {
    schema: 'axm.code-specialist-build-profile-assessment/v1',
    status: holds.length ? 'CAPABILITY_GAPS' : 'READY_FOR_PROFILE_REGISTRY_REVIEW',
    profileRef: { id: profile.id, schema: profile.schema, version: profile.version, sha256: profile.profileDigest },
    specialistOrganRef: clone(profile.specialistOrganRef),
    recipeRef: clone(profile.capability.recipeRef),
    languageIds: profile.languageIds.slice(),
    holds: holds.sort((left, right) => compareText(left.code + ':' + left.detail, right.code + ':' + right.detail)),
    capabilityGapReport: {
      schema: 'axm.capability-gap-report/v1', overall: gaps.length ? 'DEGRADED' : 'READY', missingCapabilities: gaps,
      proposedContracts: gaps.map((capabilityId) => ({ capabilityId, requestedCapability: capabilityId, gapType: 'CONTRACT', requiredBy: [profile.id], contractState: 'SPEC_REQUIRED', requiredFields: ['inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget', 'failureRecovery', 'compatibility', 'verification'] })),
      automaticInstall: false, automaticPermission: false, automaticQualityReduction: false,
      truth: { implementationAvailableForEveryGap: false, specificationClosesGap: false, unsupportedCapabilityPretendedAvailable: false }
    },
    evidencePlan: profile.evidence.requiredKinds.map((kind) => ({ kind, verdict: 'UNKNOWN', executionStatus: 'NOT_RUN' })),
    authority: 'NONE', registered: false, executed: false, installed: false, integrated: false, promoted: false, canonChanged: false,
    nextGate: holds.length ? 'REPAIR_EXACT_PROFILE_SPECIALIST_RECIPE_BINDING' : 'FOUR_ROOT_REVIEW_AND_MIKE_MERGE_DECISION_REQUIRED'
  };
  return { ...core, assessmentDigest: sha256Value(core) };
}

function normalizeCatalogCore(value) {
  exact(value, ['schema', 'id', 'version', 'status', 'profiles', 'truth'], 'catalog');
  if (value.schema !== CATALOG_SCHEMA || value.id !== 'workshop-code-specialist-build-profile-catalog-v1' || value.version !== VERSION || value.status !== 'TEST') fail('catalog identity mismatch');
  if (!Array.isArray(value.profiles) || value.profiles.length < 1 || value.profiles.length > 128) fail('catalog.profiles must contain 1 to 128 profiles');
  exact(value.truth, ['completeCodeFamilyUniverseClaimed', 'profileProvesRuntime', 'profileGrantsAuthority', 'automaticRegistration', 'automaticRecipeAdmission', 'automaticInstall', 'mikeFinalMergeGateRequired'], 'catalog.truth');
  const expectedTruth = { completeCodeFamilyUniverseClaimed: false, profileProvesRuntime: false, profileGrantsAuthority: false, automaticRegistration: false, automaticRecipeAdmission: false, automaticInstall: false, mikeFinalMergeGateRequired: true };
  if (!same(value.truth, expectedTruth)) fail('catalog.truth exceeds the extension registry boundary');
  const profiles = value.profiles.map(normalizeProfile).sort((left, right) => compareText(left.id, right.id));
  const unique = (rows, label) => { if (new Set(rows).size !== rows.length) fail('catalog ' + label + ' must be unique'); };
  unique(profiles.map((row) => row.id), 'profile ids');
  unique(profiles.map((row) => row.mode), 'profile modes');
  unique(profiles.flatMap((row) => row.languageIds.map((languageId) => row.specialistOrganRef.id + '|' + languageId)), 'specialist-language bindings');
  profiles.forEach((profile) => {
    const assessment = assessProfile(profile);
    if (assessment.status !== 'READY_FOR_PROFILE_REGISTRY_REVIEW') fail('catalog profile is not ready: ' + profile.id + ' (' + assessment.holds.map((row) => row.code).join(',') + ')');
  });
  return { schema: CATALOG_SCHEMA, id: value.id, version: VERSION, status: 'TEST', profiles, truth: expectedTruth };
}

function sealCatalog(value) {
  const core = normalizeCatalogCore(value);
  return { ...core, catalogDigest: sha256Value(core) };
}

function normalizeCatalog(value) {
  exact(value, ['schema', 'id', 'version', 'status', 'profiles', 'truth', 'catalogDigest'], 'catalog');
  const core = normalizeCatalogCore(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'catalogDigest')));
  if (value.catalogDigest !== sha256Value(core)) fail('catalog digest mismatch');
  return { ...core, catalogDigest: value.catalogDigest };
}

function profileReference(profile) {
  return { id: profile.id, schema: profile.schema, version: profile.version, sha256: profile.profileDigest };
}

const CATALOG = deepFreeze(normalizeCatalog(RawCatalog));
const TARGETS = Object.freeze(Object.fromEntries(CATALOG.profiles.map((profile) => [profile.mode, Object.freeze({
  mode: profile.mode,
  profileRef: Object.freeze(profileReference(profile)),
  specialistId: profile.specialistOrganRef.id,
  specialistOrganRef: Object.freeze(clone(profile.specialistOrganRef)),
  languageIds: Object.freeze(profile.languageIds.slice()),
  recipe: Object.freeze(clone(profile.capability.recipeRef)),
  family: profile.capability.family,
  artifactId: profile.exampleArtifactId,
  specialistGate: profile.gates.specialist,
  recipeGate: profile.gates.recipe,
  requestGate: profile.gates.request,
  specialistGap: profile.gaps.specialist,
  recipeGap: profile.gaps.recipe,
  requestGap: profile.gaps.request,
  visualEvidence: profile.evidence.visualBehavior,
  evidenceKinds: Object.freeze(profile.evidence.requiredKinds.slice())
})])));

function resolveMode(mode) {
  if (typeof mode !== 'string' || !Object.prototype.hasOwnProperty.call(TARGETS, mode)) return null;
  return TARGETS[mode];
}

if (!MODULE_CONTRACT || MODULE_CONTRACT.id !== 'code-specialist-build-profile-registry-v1') fail('module contract identity mismatch');

module.exports = {
  VERSION, PROFILE_SCHEMA, CATALOG_SCHEMA, BOUNDARY, CATALOG, TARGETS, MODULE_CONTRACT,
  canonicalJson, clone, same, sha256Value, deepFreeze, normalizeProfileCore, sealProfile, normalizeProfile,
  assessProfile, sealCatalog, normalizeCatalog, profileReference, resolveMode
};
