'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const Router = require('./code-specialization-router-v1');
const OrganKernel = require('../deterministic-organ-fabric/core.js');
const SoftwareWorkshopPack = require('../deterministic-organ-fabric/field-packs/software-workshop.json');
const HandFoundryContract = require('../../tools/hand-specification-foundry/module.contract.json');
const MODULE_CONTRACT = require('./module-code-specialist-organ-intent-adapter-v1.contract.json');

const VERSION = '1.6.0';
const REQUEST_SCHEMA = 'axm.code-specialist-organ-intent-request/v1';
const PLAN_SCHEMA = 'axm.code-specialist-organ-intent-plan/v1';
const ROOTS = Object.freeze(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const LIMITATIONS = Object.freeze([
  'AUTOMATIC_MERGE_NOT_AUTHORIZED',
  'FIELD_PACK_SUPPORT_LIMITED_TO_SOFTWARE_WORKSHOP_VERIFICATION_ROUTE_SELECTION',
  'FOUR_ROOT_EVIDENCE_CONTENT_NOT_REVERIFIED',
  'HOST_OBSERVATION_NOT_AUTHENTICATED',
  'INTENT_SEMANTICS_EXPLICIT_NOT_INFERRED',
  'KNOWLEDGE_LANE_EMPTY_REFERENCE_ONLY',
  'ORGAN_CANDIDATE_NOT_GENERATED',
  'RESOURCE_DURATION_NOT_INDEPENDENTLY_ENFORCED',
  'RESOURCE_MEMORY_NOT_INDEPENDENTLY_ENFORCED',
  'SOURCE_BYTES_NOT_INCLUDED_OR_READ',
  'SPECIALIST_PROFILE_IS_ROUTING_CONTEXT_NOT_CAPABILITY_PROOF',
  'TESTS_NOT_RUN',
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
  if (!ID.test(normalized)) fail(label + ' is not a portable id');
  return normalized;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(label + ' must be a sha256 digest');
  return value;
}

function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: id(value.id, label + '.id'), schema: text(value.schema, label + '.schema', 160), sha256: digest(value.sha256, label + '.sha256') };
}

function versionedRef(value, label) {
  exact(value, ['id', 'schema', 'version', 'sha256'], label);
  return { id: text(value.id, label + '.id', 160), schema: text(value.schema, label + '.schema', 160), version: text(value.version, label + '.version', 80), sha256: digest(value.sha256, label + '.sha256') };
}

function packRef(value, label) {
  exact(value, ['id', 'version', 'digest'], label);
  return { id: text(value.id, label + '.id', 160), version: text(value.version, label + '.version', 80), digest: digest(value.digest, label + '.digest') };
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
  exact(value, ['maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs', 'maxProcesses', 'maxAttempts', 'maxCostMinorUnits'], 'request.resourceEnvelope');
  ['maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs'].forEach((key) => {
    if (!Number.isInteger(value[key]) || value[key] < 1) fail('request.resourceEnvelope.' + key + ' must be a positive integer');
  });
  if (value.maxInputBytes > 8388608 || value.maxOutputBytes > 8388608) fail('request byte envelope exceeds v1 ceiling');
  if (value.maxProcesses !== 1 || value.maxAttempts !== 1 || value.maxCostMinorUnits !== 0) fail('request resource authority exceeds this planning rung');
  return clone(value);
}

function normalizeRequestCore(value) {
  exact(value, ['schema', 'version', 'id', 'specializationRequest', 'specializationPlan', 'selection', 'fieldPackRef', 'intentDraft', 'settings', 'resourceEnvelope', 'rootsGate', 'instructionRef', 'authority'], 'request');
  if (value.schema !== REQUEST_SCHEMA || value.version !== VERSION) fail('request identity mismatch');
  exact(value.selection, ['artifactId', 'specialistOrganRef', 'coordinationMode'], 'request.selection');
  if (value.selection.coordinationMode !== 'ONE_EXACT_LANE_NO_AUTOMATIC_MERGE') fail('request selection exceeds one exact no-merge lane');
  exact(value.settings, ['intentInference', 'knowledgeMode', 'generationMode', 'allowedPermissions', 'allowedNetworkDomains'], 'request.settings');
  if (value.settings.intentInference !== 'NONE' || value.settings.knowledgeMode !== 'REFERENCE_LANE_ONLY' || value.settings.generationMode !== 'INTENT_BIND_ONLY') fail('request settings exceed intent-binding rung');
  if (!Array.isArray(value.settings.allowedPermissions) || value.settings.allowedPermissions.length || !Array.isArray(value.settings.allowedNetworkDomains) || value.settings.allowedNetworkDomains.length) fail('request grants permission or network authority');
  if (!Array.isArray(value.rootsGate) || value.rootsGate.length !== 4) fail('request must contain exactly four root decisions');
  if (value.authority !== 'NONE') fail('request authority must remain NONE');
  object(value.specializationRequest, 'request.specializationRequest');
  object(value.specializationPlan, 'request.specializationPlan');
  object(value.intentDraft, 'request.intentDraft');
  return {
    schema: REQUEST_SCHEMA,
    version: VERSION,
    id: id(value.id, 'request.id'),
    specializationRequest: clone(value.specializationRequest),
    specializationPlan: clone(value.specializationPlan),
    selection: {
      artifactId: id(value.selection.artifactId, 'request.selection.artifactId'),
      specialistOrganRef: versionedRef(value.selection.specialistOrganRef, 'request.selection.specialistOrganRef'),
      coordinationMode: value.selection.coordinationMode
    },
    fieldPackRef: packRef(value.fieldPackRef, 'request.fieldPackRef'),
    intentDraft: clone(value.intentDraft),
    settings: clone(value.settings),
    resourceEnvelope: resourceEnvelope(value.resourceEnvelope),
    rootsGate: value.rootsGate.map(rootDecision),
    instructionRef: reference(value.instructionRef, 'request.instructionRef'),
    authority: 'NONE'
  };
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  return { ...core, requestDigest: sha256Value(core) };
}

function normalizeRequest(value) {
  exact(value, ['schema', 'version', 'id', 'specializationRequest', 'specializationPlan', 'selection', 'fieldPackRef', 'intentDraft', 'settings', 'resourceEnvelope', 'rootsGate', 'instructionRef', 'authority', 'requestDigest'], 'request');
  const core = normalizeRequestCore(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'requestDigest')));
  if (value.requestDigest !== sha256Value(core)) fail('request digest mismatch');
  const sealed = { ...core, requestDigest: value.requestDigest };
  if (jsonBytes(sealed) > core.resourceEnvelope.maxInputBytes) fail('request exceeds maxInputBytes');
  return sealed;
}

function expectedPackRef() {
  return { id: SoftwareWorkshopPack.id, version: SoftwareWorkshopPack.version, digest: SoftwareWorkshopPack.packDigest };
}

function planReference(plan) {
  return { id: 'code-specialization-plan-' + plan.planDigest.slice(7, 39), schema: plan.schema, sha256: plan.planDigest };
}

function profileFor(ref) {
  return Router.CATALOG.specialistOrgans.find((profile) => same(Router.organReference(profile), ref)) || null;
}

function mandatoryBoundaries(profile, lane) {
  const ref = Router.organReference(profile);
  return [
    'AXM specialist lineage: ' + ref.id + '@' + ref.version + '#' + ref.sha256 + '.',
    'The specialist profile is routing context, not implementation or capability proof.',
    'Knowledge lane ' + lane.knowledge.laneId + ' remains REFERENCE_ONLY_EMPTY; no knowledge was loaded or admitted.',
    'Evidence remains UNKNOWN until domain-native verification is performed.'
  ].concat(profile.refuses.slice().sort(compareText).map((entry) => 'Selected specialist refusal: ' + entry + '.'));
}

function appendUnique(values, additions) {
  const result = [];
  values.concat(additions).forEach((entry) => { if (!result.includes(entry)) result.push(entry); });
  return result;
}

function buildIntent(draft, profile, lane) {
  const draftFields = ['id', 'name', 'purpose', 'inputs', 'outputs', 'requiredCases', 'desiredCases', 'invariants', 'boundaries', 'resourceBudget', 'metricProfileId'];
  try { exact(draft, draftFields, 'request.intentDraft'); }
  catch (error) { return { ok: false, errors: [{ code: 'INTENT_DRAFT_FIELDS_MISMATCH', message: String(error.message || error) }] }; }
  const next = clone(draft);
  if (!Array.isArray(next.boundaries) || !Array.isArray(next.invariants)) return { ok: false, errors: [{ code: 'INTENT_COLLECTIONS_INVALID', message: 'Intent boundaries and invariants must be arrays.' }] };
  next.boundaries = appendUnique(next.boundaries, mandatoryBoundaries(profile, lane));
  next.invariants = appendUnique(next.invariants, [
    'The selected specialist lane cannot approve, merge, install, promote, or CANON this intent.',
    'The resulting organ intent remains inert data until a separate exact generation request.'
  ]);
  let intent;
  try { intent = OrganKernel.sealIntent(next, SoftwareWorkshopPack); }
  catch (error) { return { ok: false, errors: [{ code: 'INTENT_SEAL_REFUSED', message: String(error.message || error) }] }; }
  const validation = OrganKernel.validateIntent(intent, SoftwareWorkshopPack);
  return validation.ok ? { ok: true, intent, errors: [] } : { ok: false, intent: null, errors: validation.errors.map((row) => ({ code: row.code || 'INTENT_INVALID', message: row.message || 'Intent is invalid.' })) };
}

function buildGapReport(capabilities, requiredBy) {
  const missingCapabilities = Array.from(new Set(capabilities)).sort(compareText);
  return {
    schema: 'axm.capability-gap-report/v1',
    overall: missingCapabilities.length ? 'DEGRADED' : 'READY',
    missingCapabilities,
    proposedContracts: missingCapabilities.map((capability) => ({
      capabilityId: capability,
      requestedCapability: capability,
      gapType: 'CONTRACT',
      requiredBy: [requiredBy],
      contractState: 'SPEC_REQUIRED',
      requiredFields: ['inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget', 'failureRecovery', 'compatibility', 'verification']
    })),
    handoff: {
      capability: 'capability.specify.missing-hand/v1',
      contractRef: { id: HandFoundryContract.id, schema: HandFoundryContract.schema, sha256: sha256Value(HandFoundryContract) },
      automaticSpecification: false
    },
    automaticInstall: false,
    automaticPermission: false,
    automaticQualityReduction: false,
    truth: { implementationAvailableForEveryGap: false, specificationClosesGap: false, unsupportedCapabilityPretendedAvailable: false }
  };
}

function specialistContext(specializationPlan, artifactPlan, lane) {
  return {
    specializationRequestRef: clone(specializationPlan.requestRef),
    specializationPlanRef: planReference(specializationPlan),
    catalogRef: clone(specializationPlan.catalogRef),
    observationRef: clone(specializationPlan.observationRef),
    artifactPlan: clone(artifactPlan),
    selectedLane: clone(lane)
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
  let status = rootHold ? 'ROOTS_HOLD' : 'SPECIALIZATION_HOLD';
  let nextGate = rootHold ? 'REPAIR_ROOT_EVIDENCE_AND_REPLAN' : 'REFRESH_EXACT_SPECIALIZATION_PLAN_AND_REPLAN';
  let context = null;
  let organIntent = null;
  let pack = null;
  let holds = [];
  let gaps = [];
  let specializationPlanRebuilt = false;

  if (rootHold) {
    holds = request.rootsGate.filter((decision) => decision.verdict !== 'PASS').map((decision) => ({ code: 'ROOT_' + decision.verdict, detail: decision.root }));
    gaps = ['four-roots.technical-evidence.pass'];
  } else {
    const verification = Router.verify(request.specializationPlan, request.specializationRequest);
    if (!verification.pass) {
      holds = verification.errors.slice(0, 32).map((message) => ({ code: 'SPECIALIZATION_PLAN_REBUILD_MISMATCH', detail: message }));
      gaps = ['code.specialization.exact-plan-rebuild'];
    } else if (request.specializationPlan.status !== 'READY_FOR_SPECIALIST_IMPROVEMENT_REQUEST') {
      specializationPlanRebuilt = true;
      holds = [{ code: 'SPECIALIZATION_PLAN_NOT_READY', detail: request.specializationPlan.status }];
      gaps = request.specializationPlan.capabilityGapReport.missingCapabilities.length ? request.specializationPlan.capabilityGapReport.missingCapabilities : ['code.specialization.ready-plan'];
    } else {
      specializationPlanRebuilt = true;
      const artifactMatches = request.specializationPlan.artifactPlans.filter((row) => row.artifactRef.id === request.selection.artifactId);
      const artifactPlan = artifactMatches.length === 1 ? artifactMatches[0] : null;
      const laneMatches = artifactPlan ? artifactPlan.specialistLanes.filter((row) => same(row.organRef, request.selection.specialistOrganRef)) : [];
      const lane = laneMatches.length === 1 ? laneMatches[0] : null;
      const laneClosed = lane && lane.permissions.length === 0 && lane.networkDomains.length === 0 && lane.executionStatus === 'NOT_RUN' && lane.candidateStatus === 'NOT_GENERATED' && lane.authority === 'NONE' && lane.knowledge.state === 'REFERENCE_ONLY_EMPTY' && lane.knowledge.knowledgeLoaded === false && lane.knowledge.lessonCandidateGenerated === false;
      const profile = lane ? profileFor(lane.organRef) : null;
      if (!artifactPlan || artifactPlan.status !== 'ROUTED_FOR_INERT_IMPROVEMENT_PLANNING' || !lane || !laneClosed || !profile) {
        status = 'SELECTION_HOLD';
        nextGate = 'SELECT_ONE_EXACT_SPECIALIST_LANE_AND_REPLAN';
        holds = [{ code: 'EXACT_SPECIALIST_LANE_REQUIRED', detail: 'Selection must name one closed lane in the exact rebuilt READY plan.' }];
        gaps = ['organ.specialist.exact-lane-selection'];
      } else {
        context = specialistContext(request.specializationPlan, artifactPlan, lane);
        if (!same(request.fieldPackRef, expectedPackRef())) {
          status = 'FIELD_PACK_HOLD';
          nextGate = 'USE_EXACT_REVIEWED_SOFTWARE_WORKSHOP_FIELD_PACK';
          holds = [{ code: 'FIELD_PACK_LINEAGE_MISMATCH', detail: 'This rung supports only the exact canonical software-workshop@1.1.0 field pack.' }];
          gaps = ['organ.intent.adapter.field-pack.software-workshop-exact'];
        } else {
          pack = expectedPackRef();
          const result = buildIntent(request.intentDraft, profile, lane);
          if (!result.ok) {
            status = 'INTENT_HOLD';
            nextGate = 'REPAIR_EXPLICIT_TYPED_ORGAN_INTENT_DRAFT';
            holds = result.errors.slice(0, 64).map((row) => ({ code: row.code, detail: row.message }));
            gaps = ['organ.intent.reviewed.typed-contract'];
          } else {
            status = 'READY_FOR_ORGAN_INTENT_REVIEW';
            nextGate = 'HUMAN_REVIEW_EXACT_ORGAN_INTENT_BEFORE_SEPARATE_GENERATION_REQUEST';
            organIntent = result.intent;
          }
        }
      }
    }
  }

  const core = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    status,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    specialistContext: context,
    fieldPackRef: pack,
    organIntent,
    holds,
    capabilityGapReport: buildGapReport(gaps, request.id),
    resourceObservation: {
      inputBytes: jsonBytes(request), outputBytes: 0, attemptsEnforced: true,
      durationEnforced: false, memoryEnforced: false, processesSpawned: 0,
      providerCalled: false, networkUsed: false, sourceBytesRead: false,
      workspaceRead: false, workspaceWritten: false
    },
    limitations: LIMITATIONS.slice(),
    nextGate,
    truth: {
      deterministicPlanOnly: true,
      rootsEvaluatedBeforeSpecialization: true,
      specializationPlanRebuilt,
      specialistProfileProvesCapability: false,
      pathClassificationProvesSemantics: false,
      intentInferred: false,
      specialistLineageBoundIntoIntent: organIntent !== null,
      knowledgeLoaded: false,
      lessonAdmitted: false,
      organIntentCreated: organIntent !== null,
      organGenerated: false,
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
  catch (error) { return { pass: false, errors: [String(error.message || error)] }; }
}

function buildExampleIntentDraft() {
  const draft = clone(SoftwareWorkshopPack.exampleIntent);
  draft.id = 'code-specialist-verification-route';
  draft.name = 'Code Specialist Verification Route';
  draft.purpose = 'Select a bounded verification route for one explicitly selected code specialist lane.';
  draft.boundaries = appendUnique(draft.boundaries, ['Human review is required before any separate Organ Fabric generation request.']);
  draft.resourceBudget = {
    maxNodes: 32, maxDepth: 8, maxOperations: 256, maxListItems: 128,
    maxInputBytes: 8192, maxOutputBytes: 8192, maxPackageFiles: 8, maxPackageBytes: 131072
  };
  return draft;
}

function buildExampleRequest() {
  const specializationRequest = Router.buildExampleRequest();
  const specializationPlan = Router.plan(specializationRequest);
  const artifact = specializationPlan.artifactPlans.find((row) => row.artifactRef.id === 'game-rules');
  const lane = artifact.specialistLanes.find((row) => row.organRef.id === 'organ.code.application-logic');
  return sealRequest({
    schema: REQUEST_SCHEMA,
    version: VERSION,
    id: 'bind-code-specialist-organ-intent',
    specializationRequest,
    specializationPlan,
    selection: { artifactId: artifact.artifactRef.id, specialistOrganRef: lane.organRef, coordinationMode: 'ONE_EXACT_LANE_NO_AUTOMATIC_MERGE' },
    fieldPackRef: expectedPackRef(),
    intentDraft: buildExampleIntentDraft(),
    settings: { intentInference: 'NONE', knowledgeMode: 'REFERENCE_LANE_ONLY', generationMode: 'INTENT_BIND_ONLY', allowedPermissions: [], allowedNetworkDomains: [] },
    resourceEnvelope: { maxInputBytes: 4194304, maxOutputBytes: 4194304, maxMemoryBytes: 268435456, maxDurationMs: 30000, maxProcesses: 1, maxAttempts: 1, maxCostMinorUnits: 0 },
    rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'organ-intent-adapter-' + root, schema: 'axm.four-root-technical-review/v1', sha256: sha256Value('organ-intent-adapter-' + root) }] })),
    instructionRef: { id: 'mike-code-specialist-organ-intent-direction', schema: 'axm.explicit-human-direction/v1', sha256: sha256Value('Connect exact code specialist lanes to reviewed Organ Fabric intent without inference, generation, execution, installation, promotion, or CANON.') },
    authority: 'NONE'
  });
}

const packValidation = OrganKernel.validatePack(SoftwareWorkshopPack);
if (!packValidation.ok) fail('software-workshop field pack is invalid');
if (!MODULE_CONTRACT || MODULE_CONTRACT.id !== 'code-specialist-organ-intent-adapter-v1') fail('module contract identity mismatch');

module.exports = {
  VERSION, REQUEST_SCHEMA, PLAN_SCHEMA, ROOTS, LIMITATIONS, MODULE_CONTRACT,
  SoftwareWorkshopPack, canonicalJson, clone, same, sha256Value, jsonBytes,
  expectedPackRef, mandatoryBoundaries, sealRequest, normalizeRequest, plan, verify,
  buildExampleIntentDraft, buildExampleRequest
};
