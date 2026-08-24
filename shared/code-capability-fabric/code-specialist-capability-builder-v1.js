'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const Router = require('./code-specialization-router-v1');
const IntentAdapter = require('./code-specialist-organ-intent-adapter-v1');
const BuildProfileRegistry = require('./code-specialist-build-profile-registry-v1');
const CapabilityFabric = require('../capability-fabric');
const HandFoundryContract = require('../../tools/hand-specification-foundry/module.contract.json');
const MODULE_CONTRACT = require('./module-code-specialist-capability-builder-v1.contract.json');

const VERSION = '2.1.0';
const REQUEST_SCHEMA = 'axm.code-specialist-capability-build-request/v1';
const RESULT_SCHEMA = 'axm.code-specialist-capability-candidate/v1';
const TARGETS = BuildProfileRegistry.TARGETS;
const BUILD_PROFILE_CATALOG = BuildProfileRegistry.CATALOG;
const TARGET_SPECIALIST_ID = TARGETS.ONE_EXACT_DATA_SCHEMA_SPECIALIST.specialistId;
const TARGET_RECIPE = TARGETS.ONE_EXACT_DATA_SCHEMA_SPECIALIST.recipe;
const MARKUP_TARGET_RECIPE = TARGETS.ONE_EXACT_MARKUP_STRUCTURE_SPECIALIST.recipe;
const PYTHON_TARGET_RECIPE = TARGETS.ONE_EXACT_PYTHON_APPLICATION_LOGIC_SPECIALIST.recipe;
const CSS_TARGET_RECIPE = TARGETS.ONE_EXACT_CSS_STYLE_PRESENTATION_SPECIALIST.recipe;
const ROOTS = IntentAdapter.ROOTS;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const LIMITATIONS = Object.freeze([
  'AUTHENTICATED_HUMAN_IDENTITY_NOT_PROVEN',
  'CANDIDATE_RUNTIME_NOT_PROVEN',
  'CONSENT_REPLAY_LEDGER_NOT_AVAILABLE',
  'CSS_CASCADE_BROWSER_COMPATIBILITY_AND_VISUAL_QUALITY_NOT_PROVEN',
  'DIRECT_REUSE_AND_PUBLIC_COPY_REMAIN_ON_HOLD',
  'DURATION_NOT_INDEPENDENTLY_ENFORCED',
  'GENERATED_SELFTEST_EMITTED_NOT_RUN',
  'HTML_VISUAL_ACCESSIBILITY_AND_INTERACTION_BEHAVIOR_NOT_PROVEN',
  'BUILD_PROFILE_CATALOG_IS_BOUNDED_NOT_UNIVERSAL',
  'MEMORY_NOT_INDEPENDENTLY_ENFORCED',
  'ORGAN_INTENT_DOES_NOT_PROVE_IMPLEMENTATION_SEMANTICS',
  'PYTHON_RUNTIME_AND_EMITTED_SELFTEST_NOT_EXECUTED',
  'SPECIALIST_PROFILE_IS_ROUTING_CONTEXT_NOT_CAPABILITY_PROOF',
  'CANON_CHANGE_NOT_AUTHORIZED'
].sort(compareText));

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function canonicalJson(value) { return DeterministicJson.canonicalJson(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function sha256Value(value) { return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
function jsonBytes(value) { return Buffer.byteLength(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function fail(message) { throw new Error(message); }

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  const actual = Object.keys(value).sort();
  const expected = fields.slice().sort();
  if (!same(actual, expected)) fail(label + ' fields mismatch');
  return value;
}

function text(value, label, maximum = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) fail(label + ' must be non-empty bounded text');
  return value;
}

function id(value, label) {
  const normalized = text(value, label, 128);
  if (!SAFE_ID.test(normalized)) fail(label + ' is not a portable id');
  return normalized;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(label + ' must be a sha256 digest');
  return value;
}

function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: id(value.id, label + '.id'), schema: text(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
}

function versionedRef(value, label) {
  exact(value, ['id', 'schema', 'version', 'sha256'], label);
  return { id: text(value.id, label + '.id', 180), schema: text(value.schema, label + '.schema', 180), version: text(value.version, label + '.version', 80), sha256: digest(value.sha256, label + '.sha256') };
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail(label + ' must be an exact UTC timestamp');
  return value;
}

function rootDecision(value, index) {
  const label = 'request.rootsGate[' + index + ']';
  exact(value, ['root', 'verdict', 'evidenceRefs'], label);
  if (value.root !== ROOTS[index]) fail(label + '.root must preserve root order');
  if (!['PASS', 'HOLD', 'FAIL'].includes(value.verdict)) fail(label + '.verdict is invalid');
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length < 1 || value.evidenceRefs.length > 8) fail(label + '.evidenceRefs must contain 1 to 8 references');
  return { root: value.root, verdict: value.verdict, evidenceRefs: value.evidenceRefs.map((row, evidenceIndex) => reference(row, label + '.evidenceRefs[' + evidenceIndex + ']')) };
}

function resourceEnvelope(value) {
  exact(value, ['maxInputBytes', 'maxOutputBytes', 'maxCandidateFiles', 'maxCandidateBytes', 'maxBuildPasses', 'maxAttempts', 'maxProcesses', 'maxMemoryBytes', 'maxDurationMs', 'maxCostMinorUnits'], 'request.resourceEnvelope');
  ['maxInputBytes', 'maxOutputBytes', 'maxCandidateFiles', 'maxCandidateBytes', 'maxBuildPasses', 'maxAttempts', 'maxProcesses', 'maxMemoryBytes', 'maxDurationMs', 'maxCostMinorUnits'].forEach((key) => {
    if (!Number.isInteger(value[key]) || value[key] < 0) fail('request.resourceEnvelope.' + key + ' must be a non-negative integer');
  });
  if (value.maxInputBytes < 1 || value.maxOutputBytes < 1 || value.maxCandidateFiles < 1 || value.maxCandidateBytes < 1 || value.maxMemoryBytes < 1 || value.maxDurationMs < 1) fail('request resource byte, file, memory, and duration limits must be positive');
  if (value.maxInputBytes > 8388608 || value.maxOutputBytes > 8388608 || value.maxCandidateFiles > 32 || value.maxCandidateBytes > 1048576) fail('request resource envelope exceeds v1.9 ceilings');
  if (value.maxBuildPasses !== 2 || value.maxAttempts !== 1 || value.maxProcesses !== 0 || value.maxCostMinorUnits !== 0) fail('request resource authority exceeds the deterministic in-memory build rung');
  return clone(value);
}

function consent(value) {
  exact(value, ['tier', 'decisionRef', 'subject', 'evaluatedAt', 'expiresAt', 'nonce', 'revoked', 'replayState', 'scope'], 'request.consent');
  if (value.tier !== 'TIER_1_DETACHED_CANDIDATE') fail('request consent tier must be TIER_1_DETACHED_CANDIDATE');
  const evaluatedAt = timestamp(value.evaluatedAt, 'request.consent.evaluatedAt');
  const expiresAt = timestamp(value.expiresAt, 'request.consent.expiresAt');
  const evaluatedMs = Date.parse(evaluatedAt), expiresMs = Date.parse(expiresAt);
  if (expiresMs <= evaluatedMs || expiresMs - evaluatedMs > 86400000) fail('request consent validity window must be positive and at most 24 hours');
  if (!/^[a-z0-9][a-z0-9-]{15,127}$/.test(String(value.nonce || ''))) fail('request consent nonce is invalid');
  if (value.revoked !== false || value.replayState !== 'UNVERIFIED_SINGLE_USE_CLAIM') fail('request consent revocation or replay state is invalid');
  exact(value.subject, ['intentPlanDigest', 'capabilityRequestDigest', 'catalogDigest', 'recipeDigest', 'buildProfileCatalogDigest', 'buildProfileDigest'], 'request.consent.subject');
  exact(value.scope, ['candidateCount', 'candidateExecution', 'workspaceWrite', 'permissions', 'networkDomains', 'install', 'integrate', 'publish', 'promote', 'canon'], 'request.consent.scope');
  if (value.scope.candidateCount !== 1 || value.scope.candidateExecution !== false || value.scope.workspaceWrite !== false || value.scope.install !== false || value.scope.integrate !== false || value.scope.publish !== false || value.scope.promote !== false || value.scope.canon !== false) fail('request consent scope exceeds one detached candidate');
  if (!Array.isArray(value.scope.permissions) || value.scope.permissions.length || !Array.isArray(value.scope.networkDomains) || value.scope.networkDomains.length) fail('request consent grants permission or network authority');
  return {
    tier: value.tier,
    decisionRef: reference(value.decisionRef, 'request.consent.decisionRef'),
    subject: {
      intentPlanDigest: digest(value.subject.intentPlanDigest, 'request.consent.subject.intentPlanDigest'),
      capabilityRequestDigest: digest(value.subject.capabilityRequestDigest, 'request.consent.subject.capabilityRequestDigest'),
      catalogDigest: digest(value.subject.catalogDigest, 'request.consent.subject.catalogDigest'),
      recipeDigest: digest(value.subject.recipeDigest, 'request.consent.subject.recipeDigest'),
      buildProfileCatalogDigest: digest(value.subject.buildProfileCatalogDigest, 'request.consent.subject.buildProfileCatalogDigest'),
      buildProfileDigest: digest(value.subject.buildProfileDigest, 'request.consent.subject.buildProfileDigest')
    },
    evaluatedAt, expiresAt, nonce: value.nonce, revoked: false,
    replayState: value.replayState, scope: clone(value.scope)
  };
}

function reuseRights(value) {
  exact(value, ['mode', 'externalSourceBytesIncluded', 'publicCopyAuthorized', 'directReuseAuthorized'], 'request.reuseRights');
  if (value.mode !== 'RESEARCH_ONLY_DIRECT_REUSE_HOLD' || value.externalSourceBytesIncluded !== false || value.publicCopyAuthorized !== false || value.directReuseAuthorized !== false) fail('request reuse-rights state exceeds the research-only hold');
  return clone(value);
}

function normalizeRequestCore(value) {
  exact(value, ['schema', 'version', 'id', 'intentAdapterRequest', 'intentAdapterPlan', 'selection', 'capabilityBuildRequest', 'consent', 'resourceEnvelope', 'reuseRights', 'rootsGate', 'authority'], 'request');
  if (value.schema !== REQUEST_SCHEMA || value.version !== VERSION || value.authority !== 'NONE') fail('request identity or authority mismatch');
  object(value.intentAdapterRequest, 'request.intentAdapterRequest');
  object(value.intentAdapterPlan, 'request.intentAdapterPlan');
  object(value.capabilityBuildRequest, 'request.capabilityBuildRequest');
  exact(value.selection, ['artifactId', 'specialistOrganRef', 'buildProfileRef', 'mode'], 'request.selection');
  const target = BuildProfileRegistry.resolveMode(value.selection.mode);
  if (!target) fail('request selection mode is unsupported');
  if (!Array.isArray(value.rootsGate) || value.rootsGate.length !== 4) fail('request must contain exactly four root decisions');
  return {
    schema: REQUEST_SCHEMA,
    version: VERSION,
    id: id(value.id, 'request.id'),
    intentAdapterRequest: clone(value.intentAdapterRequest),
    intentAdapterPlan: clone(value.intentAdapterPlan),
    selection: {
      artifactId: id(value.selection.artifactId, 'request.selection.artifactId'),
      specialistOrganRef: versionedRef(value.selection.specialistOrganRef, 'request.selection.specialistOrganRef'),
      buildProfileRef: versionedRef(value.selection.buildProfileRef, 'request.selection.buildProfileRef'),
      mode: value.selection.mode
    },
    capabilityBuildRequest: clone(value.capabilityBuildRequest),
    consent: consent(value.consent),
    resourceEnvelope: resourceEnvelope(value.resourceEnvelope),
    reuseRights: reuseRights(value.reuseRights),
    rootsGate: value.rootsGate.map(rootDecision),
    authority: 'NONE'
  };
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  return { ...core, requestDigest: sha256Value(core) };
}

function normalizeRequest(value) {
  exact(value, ['schema', 'version', 'id', 'intentAdapterRequest', 'intentAdapterPlan', 'selection', 'capabilityBuildRequest', 'consent', 'resourceEnvelope', 'reuseRights', 'rootsGate', 'authority', 'requestDigest'], 'request');
  const core = normalizeRequestCore(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'requestDigest')));
  if (value.requestDigest !== sha256Value(core)) fail('request digest mismatch');
  const sealed = { ...core, requestDigest: value.requestDigest };
  if (jsonBytes(sealed) > core.resourceEnvelope.maxInputBytes) fail('request exceeds maxInputBytes');
  return sealed;
}

function isSafeCandidatePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || value.includes('\0') || value.includes('\\') || value.includes(':') || /^(?:[A-Za-z]:|\/)/.test(value)) return false;
  const parts = value.split('/');
  return parts.every((part) => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !WINDOWS_RESERVED.test(part));
}

function validateCandidatePaths(paths) {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 32) return { pass: false, errors: ['candidate path set must contain 1 to 32 paths'] };
  const seen = new Set(), errors = [];
  paths.forEach((candidatePath) => {
    if (!isSafeCandidatePath(candidatePath)) errors.push('unsafe candidate path: ' + String(candidatePath));
    const alias = String(candidatePath).toLowerCase();
    if (seen.has(alias)) errors.push('Windows case alias collision: ' + String(candidatePath));
    seen.add(alias);
  });
  return { pass: errors.length === 0, errors };
}

function recipeRef(recipe) {
  return { id: recipe.id, version: recipe.version, digest: recipe.recipeDigest, builderId: recipe.builderId, builderDigest: recipe.builderDigest, capabilityKind: recipe.capabilityKind };
}

function exactTargetRecipe(recipe, target) {
  return recipe && same(recipeRef(recipe), target.recipe) && recipe.activation === 'ACTIVE_SOURCE_REVIEWED' && recipe.family === target.family && recipe.reviewPolicy && recipe.reviewPolicy.sharedUseRequires === 'MIKE_TOBI_MERGE' && recipe.reviewPolicy.canonAuthority === 'NONE';
}

function planReference(plan) {
  return { id: 'code-specialist-organ-intent-' + plan.planDigest.slice(7, 39), schema: plan.schema, sha256: plan.planDigest };
}

function buildGapReport(capabilities, requiredBy) {
  const missingCapabilities = Array.from(new Set(capabilities)).sort(compareText);
  return {
    schema: 'axm.capability-gap-report/v1',
    overall: missingCapabilities.length ? 'DEGRADED' : 'READY',
    missingCapabilities,
    proposedContracts: missingCapabilities.map((capability) => ({ capabilityId: capability, requestedCapability: capability, gapType: 'CONTRACT', requiredBy: [requiredBy], contractState: 'SPEC_REQUIRED', requiredFields: ['inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget', 'failureRecovery', 'compatibility', 'verification'] })),
    handoff: { capability: 'capability.specify.missing-hand/v1', contractRef: { id: HandFoundryContract.id, schema: HandFoundryContract.schema, sha256: sha256Value(HandFoundryContract) }, automaticSpecification: false },
    automaticInstall: false, automaticPermission: false, automaticQualityReduction: false,
    truth: { implementationAvailableForEveryGap: false, specificationClosesGap: false, unsupportedCapabilityPretendedAvailable: false }
  };
}

function sealResult(core) {
  let outputBytes = 0;
  for (let pass = 0; pass < 12; pass += 1) {
    const measured = clone(core);
    measured.resourceObservation.outputBytes = outputBytes;
    const packet = { ...measured, resultDigest: sha256Value(measured) };
    const nextBytes = jsonBytes(packet);
    if (nextBytes === outputBytes) return packet;
    outputBytes = nextBytes;
  }
  fail('result output byte measurement did not stabilize');
}

function generate(input) {
  const request = normalizeRequest(input);
  const target = TARGETS[request.selection.mode];
  const rootHold = request.rootsGate.some((decision) => decision.verdict !== 'PASS');
  let status = rootHold ? 'ROOTS_HOLD' : 'INTENT_LINEAGE_HOLD';
  let nextGate = rootHold ? 'REPAIR_ROOT_EVIDENCE_AND_REPLAN' : 'REBUILD_EXACT_SPECIALIST_INTENT_AND_REPLAN';
  let holds = rootHold ? request.rootsGate.filter((decision) => decision.verdict !== 'PASS').map((decision) => ({ code: 'ROOT_' + decision.verdict, detail: decision.root })) : [];
  let gaps = rootHold ? ['four-roots.technical-evidence.pass'] : [];
  let specialistContext = null, consentRef = null, catalogRef = null, buildProfileCatalogRef = null, selectedRecipeRef = null, buildRequestRef = null, buildPlan = null, buildReceiptRef = null, detachedCandidate = null;
  let intentRebuilt = false, intentEvidence = 'NOT_RUN', candidateGenerated = false, candidateBytesGeneratedTransiently = false, nativeBuilderInvoked = false, buildPasses = 0;
  let candidateStructureEvidence = 'NOT_RUN', candidateByteEvidence = 'NOT_RUN', candidatePathEvidence = 'NOT_RUN', emittedSelftestEvidence = 'NOT_EMITTED';

  if (!rootHold) {
    const intentVerification = IntentAdapter.verify(request.intentAdapterPlan, request.intentAdapterRequest);
    intentEvidence = intentVerification.pass && request.intentAdapterPlan.status === 'READY_FOR_ORGAN_INTENT_REVIEW' ? 'PASS' : 'FAIL';
    if (!intentVerification.pass || request.intentAdapterPlan.status !== 'READY_FOR_ORGAN_INTENT_REVIEW') {
      holds = [{ code: 'INTENT_PLAN_REBUILD_MISMATCH', detail: intentVerification.errors.join('; ') || request.intentAdapterPlan.status }];
      gaps = ['code.specialist.reviewed-organ-intent'];
    } else {
      intentRebuilt = true;
      const context = request.intentAdapterPlan.specialistContext;
      const exactSelection = context && context.artifactPlan && context.selectedLane && context.artifactPlan.artifactRef.id === request.selection.artifactId && same(context.selectedLane.organRef, request.selection.specialistOrganRef) && same(request.selection.buildProfileRef, target.profileRef);
      const selectedLanguageId = context && context.artifactPlan && context.artifactPlan.languageClassification && context.artifactPlan.languageClassification.selected ? context.artifactPlan.languageClassification.selected.id : null;
      const closedLane = exactSelection && target.languageIds.includes(selectedLanguageId) && same(context.selectedLane.organRef, target.specialistOrganRef) && context.selectedLane.executionStatus === 'NOT_RUN' && context.selectedLane.candidateStatus === 'NOT_GENERATED' && context.selectedLane.authority === 'NONE' && context.selectedLane.permissions.length === 0 && context.selectedLane.networkDomains.length === 0;
      if (!closedLane || request.intentAdapterPlan.truth.specialistLineageBoundIntoIntent !== true || request.intentAdapterPlan.truth.organIntentCreated !== true) {
        status = 'SPECIALIST_HOLD'; nextGate = target.specialistGate;
        holds = [{ code: 'EXACT_SPECIALIST_REQUIRED', detail: 'This rung requires one closed ' + target.specialistId + ' lane bound into the reviewed specialist intent.' }];
        gaps = [target.specialistGap];
      } else {
        specialistContext = { intentPlanRef: planReference(request.intentAdapterPlan), artifactRef: clone(context.artifactPlan.artifactRef), specialistOrganRef: clone(context.selectedLane.organRef), buildProfileRef: clone(target.profileRef), languageId: selectedLanguageId, organIntentRef: { id: request.intentAdapterPlan.organIntent.id, schema: request.intentAdapterPlan.organIntent.schema, sha256: request.intentAdapterPlan.organIntent.intentDigest } };
        const catalog = CapabilityFabric.loadCatalog();
        const catalogValidation = CapabilityFabric.validateCatalog(catalog);
        const recipe = catalog.recipes.find((row) => row.id === target.recipe.id);
        catalogRef = { id: 'capability-recipe-catalog', schema: catalog.schema, sha256: catalog.catalogDigest };
        buildProfileCatalogRef = { id: BUILD_PROFILE_CATALOG.id, schema: BUILD_PROFILE_CATALOG.schema, sha256: BUILD_PROFILE_CATALOG.catalogDigest };
        selectedRecipeRef = recipe ? recipeRef(recipe) : null;
        const capabilityValidation = CapabilityFabric.validateRequest(request.capabilityBuildRequest);
        const expectedConsentSubject = { intentPlanDigest: request.intentAdapterPlan.planDigest, capabilityRequestDigest: request.capabilityBuildRequest.requestDigest, catalogDigest: catalog.catalogDigest, recipeDigest: recipe ? recipe.recipeDigest : target.recipe.digest, buildProfileCatalogDigest: BUILD_PROFILE_CATALOG.catalogDigest, buildProfileDigest: target.profileRef.sha256 };
        const consentExact = same(request.consent.subject, expectedConsentSubject);
        if (!catalogValidation.ok || !exactTargetRecipe(recipe, target)) {
          status = 'RECIPE_HOLD'; nextGate = target.recipeGate;
          holds = [{ code: 'TARGET_RECIPE_LINEAGE_MISMATCH', detail: 'The exact source-reviewed specialist recipe is unavailable or drifted.' }];
          gaps = [target.recipeGap];
        } else if (!capabilityValidation.ok || request.capabilityBuildRequest.humanReviewed !== true || request.capabilityBuildRequest.source.kind !== 'CODE_FABRIC' || request.capabilityBuildRequest.source.ref !== request.intentAdapterPlan.planDigest || request.capabilityBuildRequest.recipeId !== target.recipe.id || request.capabilityBuildRequest.family !== target.family) {
          status = 'BUILD_REQUEST_HOLD'; nextGate = target.requestGate;
          holds = [{ code: 'CAPABILITY_BUILD_REQUEST_MISMATCH', detail: capabilityValidation.ok ? 'Build request lineage, human review, family, or recipe is not exact.' : capabilityValidation.errors.map((row) => row.code).join(',') }];
          gaps = [target.requestGap];
        } else if (!consentExact) {
          status = 'CONSENT_HOLD'; nextGate = 'RECONSENT_TO_EXACT_INTENT_RECIPE_CATALOG_AND_BUILD_BYTES';
          holds = [{ code: 'CONSENT_SUBJECT_DRIFT', detail: 'Tier-1 consent does not bind the exact intent, build request, catalog, and recipe digests.' }];
          gaps = ['human.consent.tier-1.exact-subject'];
        } else {
          consentRef = { decisionRef: clone(request.consent.decisionRef), tier: request.consent.tier, subject: clone(request.consent.subject), evaluatedAt: request.consent.evaluatedAt, expiresAt: request.consent.expiresAt, nonce: request.consent.nonce, replayState: request.consent.replayState };
          buildRequestRef = { id: request.capabilityBuildRequest.id, schema: request.capabilityBuildRequest.schema, sha256: request.capabilityBuildRequest.requestDigest };
          buildPlan = CapabilityFabric.planBuild(request.capabilityBuildRequest, catalog);
          if (buildPlan.status !== 'READY' || !same(buildPlan.recipeRef, target.recipe) || buildPlan.generatedCodeExecuted !== false || !same(buildPlan.authority, CapabilityFabric.AUTHORITY)) {
            status = 'BUILD_PLAN_HOLD'; nextGate = 'REPAIR_EXACT_CAPABILITY_BUILD_PLAN';
            holds = [{ code: 'CAPABILITY_BUILD_PLAN_HELD', detail: (buildPlan.holds || []).map((row) => row.code).join(',') || 'Build plan lineage or authority drifted.' }];
            gaps = ['capability.build-plan.detached.ready'];
          } else {
            nativeBuilderInvoked = true;
            let build = null, buildFailure = null;
            try { build = CapabilityFabric.build(request.capabilityBuildRequest, catalog); }
            catch (error) { buildFailure = String(error && error.message ? error.message : error); }
            const candidate = build && build.status === 'COMPLETE' && build.candidates.length === 1 ? build.candidates[0] : null;
            buildPasses = candidate ? 2 : 0;
            candidateBytesGeneratedTransiently = candidate !== null;
            const selftestPath = recipe && recipe.capabilityContract ? (recipe.capabilityContract.selftest || 'selftest.js') : 'selftest.js';
            emittedSelftestEvidence = candidate && typeof candidate.files[selftestPath] === 'string' ? 'EMITTED_NOT_RUN' : 'NOT_EMITTED';
            const verification = candidate ? CapabilityFabric.verifyCandidate(candidate) : { ok: false, errors: [] };
            const pathCheck = candidate ? validateCandidatePaths(Object.keys(candidate.files)) : { pass: false, errors: ['candidate missing'] };
            candidateStructureEvidence = candidate ? (verification.ok ? 'PASS' : 'FAIL') : 'FAIL';
            candidateByteEvidence = candidate ? (verification.ok ? 'PASS' : 'FAIL') : 'FAIL';
            candidatePathEvidence = candidate ? (pathCheck.pass ? 'PASS' : 'FAIL') : 'FAIL';
            const withinCandidateResources = candidate && candidate.package.files.length <= request.resourceEnvelope.maxCandidateFiles && candidate.package.totalBytes <= request.resourceEnvelope.maxCandidateBytes;
            if (buildFailure) {
              status = 'CANDIDATE_HOLD'; nextGate = 'REPAIR_DETACHED_CANDIDATE_STRUCTURE_OR_RESOURCE_BOUND';
              holds = [{ code: 'NATIVE_BUILDER_REFUSAL', detail: buildFailure.slice(0, 500) }];
              gaps = ['capability.builder.exact-parameter-contract'];
            } else if (!candidate || build.generatedCodeExecuted !== false || !same(build.authority, CapabilityFabric.AUTHORITY) || !verification.ok || !pathCheck.pass || !withinCandidateResources) {
              status = 'CANDIDATE_HOLD'; nextGate = 'REPAIR_DETACHED_CANDIDATE_STRUCTURE_OR_RESOURCE_BOUND';
              holds = [{ code: 'DETACHED_CANDIDATE_REFUSED', detail: !withinCandidateResources ? 'Candidate exceeds declared file or byte budget.' : (pathCheck.errors.concat((verification.errors || []).map((row) => row.code || row.message))).join(',') }];
              gaps = ['capability.candidate.detached.verified'];
            } else {
              status = 'COMPLETE_DETACHED_CANDIDATE'; nextGate = 'HUMAN_REVIEW_EXACT_CANDIDATE_BYTES_BEFORE_SEPARATE_SANDBOX_DECISION';
              buildReceiptRef = { id: 'capability-build-' + build.runDigest.slice(7, 39), schema: build.schema, sha256: build.runDigest };
              detachedCandidate = clone(candidate);
              candidateGenerated = true;
            }
          }
        }
      }
    }
  }

  const core = {
    schema: RESULT_SCHEMA, version: VERSION, status,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    specialistContext, consentRef, catalogRef, buildProfileCatalogRef, recipeRef: selectedRecipeRef, buildRequestRef, buildPlan, buildReceiptRef, detachedCandidate,
    evidence: {
      intentRebuild: intentEvidence,
      candidateStructure: candidateStructureEvidence,
      candidateByteLineage: candidateByteEvidence,
      candidatePaths: candidatePathEvidence,
      emittedSelftest: emittedSelftestEvidence,
      runtimeBehavior: 'UNKNOWN', visualBehavior: target.visualEvidence
    },
    holds,
    capabilityGapReport: buildGapReport(gaps, request.id),
    resourceObservation: {
      inputBytes: jsonBytes(request), outputBytes: 0, buildPasses,
      attemptsEnforced: true, candidateFileCeilingEnforced: true, candidateByteCeilingEnforced: true,
      durationEnforced: false, memoryEnforced: false, processesSpawned: 0,
      providerCalled: false, networkUsed: false, workspaceRead: false, workspaceWritten: false,
      candidateExecuted: false, generatedSelftestExecuted: false
    },
    reuseRights: clone(request.reuseRights), limitations: LIMITATIONS.slice(), nextGate,
    truth: {
      deterministicNativeRecipeBuild: candidateGenerated,
      nativeBuilderInvoked,
      candidateBytesGeneratedTransiently,
      rootsEvaluatedBeforeIntentAndBuild: true,
      exactIntentPlanRebuilt: intentRebuilt,
      specialistProfileProvesCapability: false,
      organIntentProvesImplementationSemantics: false,
      buildRequestCarriesExplicitImplementationSemantics: candidateGenerated,
      sourceReviewedRecipeExact: candidateGenerated,
      authenticatedHumanIdentityProven: false,
      consentReplayPreventionProven: false,
      candidateGenerated,
      candidateDetached: candidateGenerated,
      generatedCodeExecuted: false,
      generatedSelftestExecuted: false,
      candidateRuntimeProven: false,
      workspaceRead: false, workspaceWritten: false, permissionGranted: false, networkUsed: false,
      installed: false, integrated: false, published: false, promoted: false, canonChanged: false,
      mikeFinalMergeGatePreserved: true
    },
    authority: 'NONE'
  };
  const sealed = sealResult(core);
  if (sealed.resourceObservation.outputBytes > request.resourceEnvelope.maxOutputBytes) fail('result exceeds maxOutputBytes');
  return sealed;
}

function verify(result, request) {
  try { return same(result, generate(request)) ? { pass: true, errors: [] } : { pass: false, errors: ['result differs from deterministic rebuild'] }; }
  catch (error) { return { pass: false, errors: [String(error.message || error)] }; }
}

function resealIntentRequest(value) {
  const draft = clone(value); delete draft.requestDigest; return IntentAdapter.sealRequest(draft);
}

function buildTargetExampleIntentRequest(target, options) {
  const draft = clone(IntentAdapter.buildExampleRequest());
  if (options.specializationRequest) {
    draft.specializationRequest = clone(options.specializationRequest);
    draft.specializationPlan = Router.plan(draft.specializationRequest);
  }
  const artifact = draft.specializationPlan.artifactPlans.find((row) => row.artifactRef.id === target.artifactId);
  const lane = artifact && artifact.specialistLanes.find((row) => row.organRef.id === target.specialistId);
  if (!artifact || !lane) fail('example specialization plan lacks target artifact or specialist lane');
  draft.selection = { artifactId: artifact.artifactRef.id, specialistOrganRef: clone(lane.organRef), coordinationMode: 'ONE_EXACT_LANE_NO_AUTOMATIC_MERGE' };
  draft.id = options.intentRequestId;
  draft.intentDraft.name = options.intentName;
  draft.intentDraft.purpose = options.intentPurpose;
  return resealIntentRequest(draft);
}

function buildPythonSpecializationRequest() {
  const draft = clone(Router.buildExampleRequest());
  const observation = clone(draft.observation);
  delete observation.observationDigest;
  observation.id = 'example-python-code-artifact-observation';
  observation.artifacts.push({
    id: 'python-transform', path: 'module/record_transform.py', sha256: Router.sha256Value('example-bytes:module/record_transform.py'), byteLength: 128,
    declaredLanguageId: 'python', artifactFamilies: ['module'], responsibilities: ['application-logic'], runtimes: ['server'], frameworks: ['python-stdlib'],
    requiredPermissions: [], networkDomains: [], interfaceContracts: [], dependsOnArtifactIds: [], sharedSeam: false
  });
  draft.id = 'route-example-python-application-specialist';
  draft.observation = Router.sealObservation(observation);
  delete draft.requestDigest;
  return Router.sealRequest(draft);
}

function buildCssSpecializationRequest() {
  const draft = clone(Router.buildExampleRequest());
  const observation = clone(draft.observation);
  delete observation.observationDigest;
  observation.id = 'example-css-code-artifact-observation';
  observation.artifacts.push({
    id: 'game-theme', path: 'styles/theme.css', sha256: Router.sha256Value('example-bytes:styles/theme.css'), byteLength: 256,
    declaredLanguageId: 'css', artifactFamilies: ['style'], responsibilities: ['accessibility', 'layout', 'visual-presentation'], runtimes: ['browser'], frameworks: [],
    requiredPermissions: [], networkDomains: [], interfaceContracts: [], dependsOnArtifactIds: [], sharedSeam: false
  });
  draft.id = 'route-example-css-style-presentation-specialist';
  draft.observation = Router.sealObservation(observation);
  delete draft.requestDigest;
  return Router.sealRequest(draft);
}

function buildTargetExampleRequest(target, options) {
  const intentAdapterRequest = buildTargetExampleIntentRequest(target, options);
  const intentAdapterPlan = IntentAdapter.plan(intentAdapterRequest);
  const context = intentAdapterPlan.specialistContext;
  const catalog = CapabilityFabric.loadCatalog();
  const recipe = catalog.recipes.find((row) => row.id === target.recipe.id);
  if (!recipe || !exactTargetRecipe(recipe, target)) fail('example target recipe is unavailable or drifted');
  const buildDraft = clone(recipe.exampleRequest);
  buildDraft.id = options.buildRequestId;
  buildDraft.purpose = options.buildPurpose;
  buildDraft.source = { kind: 'CODE_FABRIC', ref: intentAdapterPlan.planDigest };
  const capabilityBuildRequest = CapabilityFabric.sealRequest(buildDraft, true);
  const subject = { intentPlanDigest: intentAdapterPlan.planDigest, capabilityRequestDigest: capabilityBuildRequest.requestDigest, catalogDigest: catalog.catalogDigest, recipeDigest: recipe.recipeDigest, buildProfileCatalogDigest: BUILD_PROFILE_CATALOG.catalogDigest, buildProfileDigest: target.profileRef.sha256 };
  return sealRequest({
    schema: REQUEST_SCHEMA, version: VERSION, id: options.outerRequestId,
    intentAdapterRequest, intentAdapterPlan,
    selection: { artifactId: context.artifactPlan.artifactRef.id, specialistOrganRef: clone(context.selectedLane.organRef), buildProfileRef: clone(target.profileRef), mode: target.mode },
    capabilityBuildRequest,
    consent: {
      tier: 'TIER_1_DETACHED_CANDIDATE',
      decisionRef: { id: options.decisionId, schema: 'axm.explicit-human-direction/v1', sha256: sha256Value(options.decisionText) },
      subject, evaluatedAt: options.evaluatedAt, expiresAt: options.expiresAt,
      nonce: options.nonce, revoked: false, replayState: 'UNVERIFIED_SINGLE_USE_CLAIM',
      scope: { candidateCount: 1, candidateExecution: false, workspaceWrite: false, permissions: [], networkDomains: [], install: false, integrate: false, publish: false, promote: false, canon: false }
    },
    resourceEnvelope: { maxInputBytes: 4194304, maxOutputBytes: 4194304, maxCandidateFiles: 16, maxCandidateBytes: 1048576, maxBuildPasses: 2, maxAttempts: 1, maxProcesses: 0, maxMemoryBytes: 268435456, maxDurationMs: 30000, maxCostMinorUnits: 0 },
    reuseRights: { mode: 'RESEARCH_ONLY_DIRECT_REUSE_HOLD', externalSourceBytesIncluded: false, publicCopyAuthorized: false, directReuseAuthorized: false },
    rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: options.rootEvidencePrefix + root, schema: 'axm.four-root-technical-review/v1', sha256: sha256Value(options.rootEvidenceSubject + ':' + root) }] })),
    authority: 'NONE'
  });
}

function buildExampleIntentRequest() {
  return buildTargetExampleIntentRequest(TARGETS.ONE_EXACT_DATA_SCHEMA_SPECIALIST, {
    intentRequestId: 'bind-data-schema-specialist-organ-intent',
    intentName: 'Data Schema Specialist Verification Intent',
    intentPurpose: 'Bind one exact data-schema specialist lane to a reviewed verification intent before a separate candidate-generation decision.'
  });
}

function buildExampleRequest() {
  return buildTargetExampleRequest(TARGETS.ONE_EXACT_DATA_SCHEMA_SPECIALIST, {
    intentRequestId: 'bind-data-schema-specialist-organ-intent',
    intentName: 'Data Schema Specialist Verification Intent',
    intentPurpose: 'Bind one exact data-schema specialist lane to a reviewed verification intent before a separate candidate-generation decision.',
    buildRequestId: 'game-schema-validator-candidate',
    buildPurpose: 'Generate one detached bounded validator candidate for an explicitly reviewed synthetic game-schema contract.',
    outerRequestId: 'build-data-schema-specialist-candidate',
    decisionId: 'mike-tier-1-schema-candidate-direction',
    decisionText: 'Mike authorized the bounded data-schema rung: create one detached validator candidate; do not execute, write, install, integrate, publish, promote, or CANON.',
    evaluatedAt: '2026-08-24T00:00:00.000Z', expiresAt: '2026-08-25T00:00:00.000Z', nonce: 'schema-candidate-0002',
    rootEvidencePrefix: 'schema-candidate-', rootEvidenceSubject: 'schema-specialist-candidate-v1.9'
  });
}

function buildMarkupExampleIntentRequest() {
  return buildTargetExampleIntentRequest(TARGETS.ONE_EXACT_MARKUP_STRUCTURE_SPECIALIST, {
    intentRequestId: 'bind-markup-specialist-organ-intent',
    intentName: 'Markup Structure Specialist Creation Intent',
    intentPurpose: 'Bind one exact markup-structure specialist lane to a reviewed semantic-page intent before a separate detached candidate-generation decision.'
  });
}

function buildMarkupExampleRequest() {
  return buildTargetExampleRequest(TARGETS.ONE_EXACT_MARKUP_STRUCTURE_SPECIALIST, {
    intentRequestId: 'bind-markup-specialist-organ-intent',
    intentName: 'Markup Structure Specialist Creation Intent',
    intentPurpose: 'Bind one exact markup-structure specialist lane to a reviewed semantic-page intent before a separate detached candidate-generation decision.',
    buildRequestId: 'game-index-html-renderer-candidate',
    buildPurpose: 'Generate one detached semantic HTML page-renderer candidate for the explicitly reviewed synthetic game-index artifact.',
    outerRequestId: 'build-markup-specialist-candidate',
    decisionId: 'mike-tier-1-markup-candidate-direction',
    decisionText: 'Mike authorized the next bounded rung: create one detached HTML markup candidate; do not execute, render, write, install, integrate, publish, promote, or CANON.',
    evaluatedAt: '2026-08-24T00:00:00.000Z', expiresAt: '2026-08-25T00:00:00.000Z', nonce: 'markup-candidate-0001',
    rootEvidencePrefix: 'markup-candidate-', rootEvidenceSubject: 'markup-specialist-candidate-v1.9'
  });
}

function buildPythonExampleIntentRequest() {
  return buildTargetExampleIntentRequest(TARGETS.ONE_EXACT_PYTHON_APPLICATION_LOGIC_SPECIALIST, {
    specializationRequest: buildPythonSpecializationRequest(),
    intentRequestId: 'bind-python-application-specialist-organ-intent',
    intentName: 'Bounded Python Application Specialist Intent',
    intentPurpose: 'Bind one exact Python application-logic specialist lane to a reviewed inert record-transform intent before a separate detached candidate-generation decision.'
  });
}

function buildPythonExampleRequest() {
  return buildTargetExampleRequest(TARGETS.ONE_EXACT_PYTHON_APPLICATION_LOGIC_SPECIALIST, {
    specializationRequest: buildPythonSpecializationRequest(),
    intentRequestId: 'bind-python-application-specialist-organ-intent',
    intentName: 'Bounded Python Application Specialist Intent',
    intentPurpose: 'Bind one exact Python application-logic specialist lane to a reviewed inert record-transform intent before a separate detached candidate-generation decision.',
    buildRequestId: 'python-record-transform-candidate',
    buildPurpose: 'Generate one detached bounded Python record-transform candidate for the explicitly reviewed synthetic Python artifact.',
    outerRequestId: 'build-python-application-specialist-candidate',
    decisionId: 'mike-tier-1-python-candidate-direction',
    decisionText: 'Mike authorized bounded stepwise Code Capability Fabric improvement: create one detached Python candidate; do not execute, write, install, integrate, publish, promote, or CANON.',
    evaluatedAt: '2026-08-24T00:00:00.000Z', expiresAt: '2026-08-25T00:00:00.000Z', nonce: 'python-candidate-0001',
    rootEvidencePrefix: 'python-candidate-', rootEvidenceSubject: 'python-specialist-candidate-v2.0'
  });
}

function buildCssExampleIntentRequest() {
  return buildTargetExampleIntentRequest(TARGETS.ONE_EXACT_CSS_STYLE_PRESENTATION_SPECIALIST, {
    specializationRequest: buildCssSpecializationRequest(),
    intentRequestId: 'bind-css-style-presentation-specialist-organ-intent',
    intentName: 'Bounded CSS Style Presentation Specialist Intent',
    intentPurpose: 'Bind one exact CSS style-presentation specialist lane to a reviewed typed design-token intent before a separate detached candidate-generation decision.'
  });
}

function buildCssExampleRequest() {
  return buildTargetExampleRequest(TARGETS.ONE_EXACT_CSS_STYLE_PRESENTATION_SPECIALIST, {
    specializationRequest: buildCssSpecializationRequest(),
    intentRequestId: 'bind-css-style-presentation-specialist-organ-intent',
    intentName: 'Bounded CSS Style Presentation Specialist Intent',
    intentPurpose: 'Bind one exact CSS style-presentation specialist lane to a reviewed typed design-token intent before a separate detached candidate-generation decision.',
    buildRequestId: 'game-theme-token-stylesheet-candidate',
    buildPurpose: 'Generate one detached bounded CSS token stylesheet renderer for the explicitly reviewed synthetic game-theme artifact.',
    outerRequestId: 'build-css-style-presentation-specialist-candidate',
    decisionId: 'mike-tier-1-css-candidate-direction',
    decisionText: 'Mike authorized bounded stepwise Code Capability Fabric improvement: create one detached CSS token stylesheet candidate; do not execute, render, write, install, integrate, publish, promote, or CANON.',
    evaluatedAt: '2026-08-24T00:00:00.000Z', expiresAt: '2026-08-25T00:00:00.000Z', nonce: 'css-candidate-0001',
    rootEvidencePrefix: 'css-candidate-', rootEvidenceSubject: 'css-specialist-candidate-v2.1'
  });
}

if (!MODULE_CONTRACT || MODULE_CONTRACT.id !== 'code-specialist-capability-builder-v1') fail('module contract identity mismatch');

module.exports = {
  VERSION, REQUEST_SCHEMA, RESULT_SCHEMA, TARGET_SPECIALIST_ID, TARGET_RECIPE, MARKUP_TARGET_RECIPE, PYTHON_TARGET_RECIPE, CSS_TARGET_RECIPE, TARGETS, BUILD_PROFILE_CATALOG, BuildProfileRegistry, ROOTS, LIMITATIONS, MODULE_CONTRACT,
  canonicalJson, clone, same, sha256Value, jsonBytes, isSafeCandidatePath, validateCandidatePaths,
  sealRequest, normalizeRequest, generate, verify, buildExampleIntentRequest, buildExampleRequest,
  buildMarkupExampleIntentRequest, buildMarkupExampleRequest,
  buildPythonSpecializationRequest, buildPythonExampleIntentRequest, buildPythonExampleRequest,
  buildCssSpecializationRequest, buildCssExampleIntentRequest, buildCssExampleRequest
};
