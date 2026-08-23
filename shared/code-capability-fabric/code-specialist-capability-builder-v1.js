'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const IntentAdapter = require('./code-specialist-organ-intent-adapter-v1');
const CapabilityFabric = require('../capability-fabric');
const HandFoundryContract = require('../../tools/hand-specification-foundry/module.contract.json');
const MODULE_CONTRACT = require('./module-code-specialist-capability-builder-v1.contract.json');

const VERSION = '1.7.0';
const REQUEST_SCHEMA = 'axm.code-specialist-capability-build-request/v1';
const RESULT_SCHEMA = 'axm.code-specialist-capability-candidate/v1';
const TARGET_SPECIALIST_ID = 'organ.code.data-schema';
const TARGET_RECIPE = Object.freeze({
  id: 'closed-json-schema-validator',
  version: '0.1.0',
  digest: 'sha256:8840621b497fda2296a370c220de52a6e18147bf5562a0ff1e050965ec454b23',
  builderId: 'closed-json-schema-validator-v1',
  builderDigest: 'sha256:d5bbf6fc6c4219fd90987b7b458c2d396ce5d5c421f06c8763b85338e40c38a0',
  capabilityKind: 'HAND'
});
const ROOTS = IntentAdapter.ROOTS;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const LIMITATIONS = Object.freeze([
  'AUTHENTICATED_HUMAN_IDENTITY_NOT_PROVEN',
  'CANDIDATE_RUNTIME_NOT_PROVEN',
  'CONSENT_REPLAY_LEDGER_NOT_AVAILABLE',
  'DIRECT_REUSE_AND_PUBLIC_COPY_REMAIN_ON_HOLD',
  'DURATION_NOT_INDEPENDENTLY_ENFORCED',
  'GENERATED_SELFTEST_EMITTED_NOT_RUN',
  'IMPLEMENTATION_SUPPORT_LIMITED_TO_ONE_CLOSED_JSON_SCHEMA_VALIDATOR_RECIPE',
  'MEMORY_NOT_INDEPENDENTLY_ENFORCED',
  'ORGAN_INTENT_DOES_NOT_PROVE_IMPLEMENTATION_SEMANTICS',
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
  if (value.maxInputBytes > 8388608 || value.maxOutputBytes > 8388608 || value.maxCandidateFiles > 32 || value.maxCandidateBytes > 1048576) fail('request resource envelope exceeds v1.7 ceilings');
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
  exact(value.subject, ['intentPlanDigest', 'capabilityRequestDigest', 'catalogDigest', 'recipeDigest'], 'request.consent.subject');
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
      recipeDigest: digest(value.subject.recipeDigest, 'request.consent.subject.recipeDigest')
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
  exact(value.selection, ['artifactId', 'specialistOrganRef', 'mode'], 'request.selection');
  if (value.selection.mode !== 'ONE_EXACT_DATA_SCHEMA_SPECIALIST') fail('request selection mode is unsupported');
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

function exactTargetRecipe(recipe) {
  return recipe && same(recipeRef(recipe), TARGET_RECIPE) && recipe.activation === 'ACTIVE_SOURCE_REVIEWED' && recipe.family === 'schema-validation' && recipe.reviewPolicy && recipe.reviewPolicy.sharedUseRequires === 'MIKE_TOBI_MERGE' && recipe.reviewPolicy.canonAuthority === 'NONE';
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
  const rootHold = request.rootsGate.some((decision) => decision.verdict !== 'PASS');
  let status = rootHold ? 'ROOTS_HOLD' : 'INTENT_LINEAGE_HOLD';
  let nextGate = rootHold ? 'REPAIR_ROOT_EVIDENCE_AND_REPLAN' : 'REBUILD_EXACT_SPECIALIST_INTENT_AND_REPLAN';
  let holds = rootHold ? request.rootsGate.filter((decision) => decision.verdict !== 'PASS').map((decision) => ({ code: 'ROOT_' + decision.verdict, detail: decision.root })) : [];
  let gaps = rootHold ? ['four-roots.technical-evidence.pass'] : [];
  let specialistContext = null, consentRef = null, catalogRef = null, selectedRecipeRef = null, buildRequestRef = null, buildPlan = null, buildReceiptRef = null, detachedCandidate = null;
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
      const exactSelection = context && context.artifactPlan && context.selectedLane && context.artifactPlan.artifactRef.id === request.selection.artifactId && same(context.selectedLane.organRef, request.selection.specialistOrganRef);
      const closedLane = exactSelection && context.selectedLane.organRef.id === TARGET_SPECIALIST_ID && context.selectedLane.executionStatus === 'NOT_RUN' && context.selectedLane.candidateStatus === 'NOT_GENERATED' && context.selectedLane.authority === 'NONE' && context.selectedLane.permissions.length === 0 && context.selectedLane.networkDomains.length === 0;
      if (!closedLane || request.intentAdapterPlan.truth.specialistLineageBoundIntoIntent !== true || request.intentAdapterPlan.truth.organIntentCreated !== true) {
        status = 'SPECIALIST_HOLD'; nextGate = 'SELECT_EXACT_DATA_SCHEMA_SPECIALIST_AND_REPLAN';
        holds = [{ code: 'EXACT_DATA_SCHEMA_SPECIALIST_REQUIRED', detail: 'This rung supports only one closed organ.code.data-schema lane bound into a reviewed v1.6 intent.' }];
        gaps = ['code.specialist.data-schema.exact-lane'];
      } else {
        specialistContext = { intentPlanRef: planReference(request.intentAdapterPlan), artifactRef: clone(context.artifactPlan.artifactRef), specialistOrganRef: clone(context.selectedLane.organRef), organIntentRef: { id: request.intentAdapterPlan.organIntent.id, schema: request.intentAdapterPlan.organIntent.schema, sha256: request.intentAdapterPlan.organIntent.intentDigest } };
        const catalog = CapabilityFabric.loadCatalog();
        const catalogValidation = CapabilityFabric.validateCatalog(catalog);
        const recipe = catalog.recipes.find((row) => row.id === TARGET_RECIPE.id);
        catalogRef = { id: 'capability-recipe-catalog', schema: catalog.schema, sha256: catalog.catalogDigest };
        selectedRecipeRef = recipe ? recipeRef(recipe) : null;
        const capabilityValidation = CapabilityFabric.validateRequest(request.capabilityBuildRequest);
        const expectedConsentSubject = { intentPlanDigest: request.intentAdapterPlan.planDigest, capabilityRequestDigest: request.capabilityBuildRequest.requestDigest, catalogDigest: catalog.catalogDigest, recipeDigest: recipe ? recipe.recipeDigest : TARGET_RECIPE.digest };
        const consentExact = same(request.consent.subject, expectedConsentSubject);
        if (!catalogValidation.ok || !exactTargetRecipe(recipe)) {
          status = 'RECIPE_HOLD'; nextGate = 'RESTORE_EXACT_SOURCE_REVIEWED_SCHEMA_VALIDATOR_RECIPE';
          holds = [{ code: 'TARGET_RECIPE_LINEAGE_MISMATCH', detail: 'The exact source-reviewed closed JSON Schema validator recipe is unavailable or drifted.' }];
          gaps = ['capability.recipe.closed-json-schema-validator.exact'];
        } else if (!capabilityValidation.ok || request.capabilityBuildRequest.humanReviewed !== true || request.capabilityBuildRequest.source.kind !== 'CODE_FABRIC' || request.capabilityBuildRequest.source.ref !== request.intentAdapterPlan.planDigest || request.capabilityBuildRequest.recipeId !== TARGET_RECIPE.id || request.capabilityBuildRequest.family !== 'schema-validation') {
          status = 'BUILD_REQUEST_HOLD'; nextGate = 'REPAIR_EXACT_HUMAN_REVIEWED_SCHEMA_VALIDATOR_REQUEST';
          holds = [{ code: 'CAPABILITY_BUILD_REQUEST_MISMATCH', detail: capabilityValidation.ok ? 'Build request lineage, human review, family, or recipe is not exact.' : capabilityValidation.errors.map((row) => row.code).join(',') }];
          gaps = ['capability.build-request.data-schema.exact'];
        } else if (!consentExact) {
          status = 'CONSENT_HOLD'; nextGate = 'RECONSENT_TO_EXACT_INTENT_RECIPE_CATALOG_AND_BUILD_BYTES';
          holds = [{ code: 'CONSENT_SUBJECT_DRIFT', detail: 'Tier-1 consent does not bind the exact intent, build request, catalog, and recipe digests.' }];
          gaps = ['human.consent.tier-1.exact-subject'];
        } else {
          consentRef = { decisionRef: clone(request.consent.decisionRef), tier: request.consent.tier, subject: clone(request.consent.subject), evaluatedAt: request.consent.evaluatedAt, expiresAt: request.consent.expiresAt, nonce: request.consent.nonce, replayState: request.consent.replayState };
          buildRequestRef = { id: request.capabilityBuildRequest.id, schema: request.capabilityBuildRequest.schema, sha256: request.capabilityBuildRequest.requestDigest };
          buildPlan = CapabilityFabric.planBuild(request.capabilityBuildRequest, catalog);
          if (buildPlan.status !== 'READY' || !same(buildPlan.recipeRef, TARGET_RECIPE) || buildPlan.generatedCodeExecuted !== false || !same(buildPlan.authority, CapabilityFabric.AUTHORITY)) {
            status = 'BUILD_PLAN_HOLD'; nextGate = 'REPAIR_EXACT_CAPABILITY_BUILD_PLAN';
            holds = [{ code: 'CAPABILITY_BUILD_PLAN_HELD', detail: (buildPlan.holds || []).map((row) => row.code).join(',') || 'Build plan lineage or authority drifted.' }];
            gaps = ['capability.build-plan.detached.ready'];
          } else {
            nativeBuilderInvoked = true;
            const build = CapabilityFabric.build(request.capabilityBuildRequest, catalog);
            const candidate = build.status === 'COMPLETE' && build.candidates.length === 1 ? build.candidates[0] : null;
            buildPasses = candidate ? 2 : 0;
            candidateBytesGeneratedTransiently = candidate !== null;
            emittedSelftestEvidence = candidate && typeof candidate.files['selftest.js'] === 'string' ? 'EMITTED_NOT_RUN' : 'NOT_EMITTED';
            const verification = candidate ? CapabilityFabric.verifyCandidate(candidate) : { ok: false, errors: [] };
            const pathCheck = candidate ? validateCandidatePaths(Object.keys(candidate.files)) : { pass: false, errors: ['candidate missing'] };
            candidateStructureEvidence = candidate ? (verification.ok ? 'PASS' : 'FAIL') : 'FAIL';
            candidateByteEvidence = candidate ? (verification.ok ? 'PASS' : 'FAIL') : 'FAIL';
            candidatePathEvidence = candidate ? (pathCheck.pass ? 'PASS' : 'FAIL') : 'FAIL';
            const withinCandidateResources = candidate && candidate.package.files.length <= request.resourceEnvelope.maxCandidateFiles && candidate.package.totalBytes <= request.resourceEnvelope.maxCandidateBytes;
            if (!candidate || build.generatedCodeExecuted !== false || !same(build.authority, CapabilityFabric.AUTHORITY) || !verification.ok || !pathCheck.pass || !withinCandidateResources) {
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
    specialistContext, consentRef, catalogRef, recipeRef: selectedRecipeRef, buildRequestRef, buildPlan, buildReceiptRef, detachedCandidate,
    evidence: {
      intentRebuild: intentEvidence,
      candidateStructure: candidateStructureEvidence,
      candidateByteLineage: candidateByteEvidence,
      candidatePaths: candidatePathEvidence,
      emittedSelftest: emittedSelftestEvidence,
      runtimeBehavior: 'UNKNOWN', visualBehavior: 'NOT_APPLICABLE'
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

function buildExampleIntentRequest() {
  const draft = clone(IntentAdapter.buildExampleRequest());
  const artifact = draft.specializationPlan.artifactPlans.find((row) => row.artifactRef.id === 'game-schema');
  const lane = artifact.specialistLanes.find((row) => row.organRef.id === TARGET_SPECIALIST_ID);
  draft.selection = { artifactId: artifact.artifactRef.id, specialistOrganRef: clone(lane.organRef), coordinationMode: 'ONE_EXACT_LANE_NO_AUTOMATIC_MERGE' };
  draft.id = 'bind-data-schema-specialist-organ-intent';
  draft.intentDraft.name = 'Data Schema Specialist Verification Intent';
  draft.intentDraft.purpose = 'Bind one exact data-schema specialist lane to a reviewed verification intent before a separate candidate-generation decision.';
  return resealIntentRequest(draft);
}

function buildExampleRequest() {
  const intentAdapterRequest = buildExampleIntentRequest();
  const intentAdapterPlan = IntentAdapter.plan(intentAdapterRequest);
  const context = intentAdapterPlan.specialistContext;
  const catalog = CapabilityFabric.loadCatalog();
  const recipe = catalog.recipes.find((row) => row.id === TARGET_RECIPE.id);
  const buildDraft = clone(recipe.exampleRequest);
  buildDraft.id = 'game-schema-validator-candidate';
  buildDraft.purpose = 'Generate one detached bounded validator candidate for an explicitly reviewed synthetic game-schema contract.';
  buildDraft.source = { kind: 'CODE_FABRIC', ref: intentAdapterPlan.planDigest };
  const capabilityBuildRequest = CapabilityFabric.sealRequest(buildDraft, true);
  const subject = { intentPlanDigest: intentAdapterPlan.planDigest, capabilityRequestDigest: capabilityBuildRequest.requestDigest, catalogDigest: catalog.catalogDigest, recipeDigest: recipe.recipeDigest };
  return sealRequest({
    schema: REQUEST_SCHEMA, version: VERSION, id: 'build-data-schema-specialist-candidate',
    intentAdapterRequest, intentAdapterPlan,
    selection: { artifactId: context.artifactPlan.artifactRef.id, specialistOrganRef: clone(context.selectedLane.organRef), mode: 'ONE_EXACT_DATA_SCHEMA_SPECIALIST' },
    capabilityBuildRequest,
    consent: {
      tier: 'TIER_1_DETACHED_CANDIDATE',
      decisionRef: { id: 'mike-tier-1-schema-candidate-direction', schema: 'axm.explicit-human-direction/v1', sha256: sha256Value('Mike authorized the next bounded rung: create one detached data-schema validator candidate; do not execute, write, install, integrate, publish, promote, or CANON.') },
      subject, evaluatedAt: '2026-08-23T21:00:00.000Z', expiresAt: '2026-08-24T21:00:00.000Z',
      nonce: 'schema-candidate-0001', revoked: false, replayState: 'UNVERIFIED_SINGLE_USE_CLAIM',
      scope: { candidateCount: 1, candidateExecution: false, workspaceWrite: false, permissions: [], networkDomains: [], install: false, integrate: false, publish: false, promote: false, canon: false }
    },
    resourceEnvelope: { maxInputBytes: 4194304, maxOutputBytes: 4194304, maxCandidateFiles: 16, maxCandidateBytes: 1048576, maxBuildPasses: 2, maxAttempts: 1, maxProcesses: 0, maxMemoryBytes: 268435456, maxDurationMs: 30000, maxCostMinorUnits: 0 },
    reuseRights: { mode: 'RESEARCH_ONLY_DIRECT_REUSE_HOLD', externalSourceBytesIncluded: false, publicCopyAuthorized: false, directReuseAuthorized: false },
    rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'schema-candidate-' + root, schema: 'axm.four-root-technical-review/v1', sha256: sha256Value('schema-specialist-candidate-v1.7:' + root) }] })),
    authority: 'NONE'
  });
}

if (!MODULE_CONTRACT || MODULE_CONTRACT.id !== 'code-specialist-capability-builder-v1') fail('module contract identity mismatch');

module.exports = {
  VERSION, REQUEST_SCHEMA, RESULT_SCHEMA, TARGET_SPECIALIST_ID, TARGET_RECIPE, ROOTS, LIMITATIONS, MODULE_CONTRACT,
  canonicalJson, clone, same, sha256Value, jsonBytes, isSafeCandidatePath, validateCandidatePaths,
  sealRequest, normalizeRequest, generate, verify, buildExampleIntentRequest, buildExampleRequest
};
