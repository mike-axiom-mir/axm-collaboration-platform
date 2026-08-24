#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Adapter = require('./code-specialist-organ-intent-adapter-v1');
const Router = require('./code-specialization-router-v1');
const OrganKernel = require('../deterministic-organ-fabric/core.js');

let checks = 0;
function check(condition, message) { checks += 1; assert.ok(condition, message); }
function equal(actual, expected, message) { checks += 1; assert.deepStrictEqual(actual, expected, message); }
function rejects(fn, pattern, message) { checks += 1; assert.throws(fn, pattern, message); }
function clone(value) { return Adapter.clone(value); }

function adapterCore(request) {
  const core = clone(request);
  delete core.requestDigest;
  return core;
}

function observationCore(observation) {
  const core = clone(observation);
  delete core.observationDigest;
  return core;
}

function specializationCore(request) {
  const core = clone(request);
  delete core.requestDigest;
  return core;
}

function reviseAdapter(request, mutation) {
  const core = adapterCore(request);
  mutation(core);
  return Adapter.sealRequest(core);
}

function reviseSpecialization(request, observationMutation, requestMutation) {
  const adapter = adapterCore(request);
  const specialization = specializationCore(adapter.specializationRequest);
  const observation = observationCore(specialization.observation);
  if (observationMutation) observationMutation(observation);
  specialization.observation = Router.sealObservation(observation);
  if (requestMutation) requestMutation(specialization);
  adapter.specializationRequest = Router.sealRequest(specialization);
  adapter.specializationPlan = Router.plan(adapter.specializationRequest);
  return Adapter.sealRequest(adapter);
}

const schemaCases = [
  ['code-specialist-organ-intent-request.schema.json', Adapter.REQUEST_SCHEMA],
  ['code-specialist-organ-intent-plan.schema.json', Adapter.PLAN_SCHEMA]
];
schemaCases.forEach(([file, schemaId]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  equal(schema.$id, schemaId, file + ' has the expected schema id');
  equal(schema.additionalProperties, false, file + ' rejects unknown top-level fields');
});

equal(Adapter.VERSION, '1.6.0', 'adapter version is v1.6');
equal(Adapter.MODULE_CONTRACT.status, 'TEST', 'adapter remains TEST');
equal(Adapter.MODULE_CONTRACT.permissions, [], 'adapter grants no permissions');
equal(Adapter.MODULE_CONTRACT.boundaries.writes, [], 'adapter declares no writes');
check(Adapter.MODULE_CONTRACT.boundaries.refuses.includes('organ-generation'), 'adapter refuses organ generation');
check(Adapter.MODULE_CONTRACT.boundaries.refuses.includes('generated-organ-execution'), 'adapter refuses generated organ execution');
check(Adapter.MODULE_CONTRACT.boundaries.refuses.includes('knowledge-loading'), 'adapter refuses knowledge loading');
check(Adapter.MODULE_CONTRACT.boundaries.refuses.includes('physical-actuation'), 'adapter refuses physical actuation');
check(Adapter.MODULE_CONTRACT.boundaries.refuses.includes('canon-change'), 'adapter refuses CANON changes');

const request = Adapter.buildExampleRequest();
const plan = Adapter.plan(request);
const planSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-specialist-organ-intent-plan.schema.json'), 'utf8'));
const organIntentSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deterministic-organ-fabric', 'schemas', 'organ-intent.schema.json'), 'utf8'));
equal(plan.status, 'READY_FOR_ORGAN_INTENT_REVIEW', 'exact reviewed input reaches intent review only');
equal(plan.nextGate, 'HUMAN_REVIEW_EXACT_ORGAN_INTENT_BEFORE_SEPARATE_GENERATION_REQUEST', 'ready plan requires a separate exact human-reviewed generation request');
equal(plan.fieldPackRef, Adapter.expectedPackRef(), 'ready plan binds the exact canonical software field pack');
equal(plan.organIntent.schema, 'axm.organ-intent/v1', 'ready plan emits the canonical organ-intent contract');
equal(plan.organIntent.status, 'EXPERIMENTAL', 'intent remains experimental');
equal(plan.organIntent.authority, 'NONE', 'intent has no authority');
equal(Object.keys(plan).sort(), planSchema.required.slice().sort(), 'emitted plan has exactly the schema-required top-level fields');
equal(Object.keys(plan.specialistContext).sort(), planSchema.properties.specialistContext.oneOf[1].required.slice().sort(), 'emitted specialist context has exactly the closed schema fields');
equal(Object.keys(plan.organIntent).sort(), organIntentSchema.required.slice().sort(), 'emitted intent has exactly the canonical Organ Fabric fields');
equal(Object.keys(plan.capabilityGapReport).sort(), ['schema', 'overall', 'missingCapabilities', 'proposedContracts', 'handoff', 'automaticInstall', 'automaticPermission', 'automaticQualityReduction', 'truth'].sort(), 'emitted gap report is a closed canonical record');
check(OrganKernel.validateIntent(plan.organIntent, Adapter.SoftwareWorkshopPack).ok, 'emitted intent passes the canonical Organ Fabric validator');
equal(plan.specialistContext.selectedLane.organRef.id, 'organ.code.application-logic', 'one exact specialist lane is bound');
equal(plan.specialistContext.selectedLane.permissions, [], 'selected lane grants no permissions');
equal(plan.specialistContext.selectedLane.networkDomains, [], 'selected lane grants no network');
equal(plan.specialistContext.selectedLane.executionStatus, 'NOT_RUN', 'selected lane is not executed');
equal(plan.specialistContext.selectedLane.candidateStatus, 'NOT_GENERATED', 'selected lane generates no candidate');
equal(plan.specialistContext.selectedLane.knowledge.state, 'REFERENCE_ONLY_EMPTY', 'knowledge lane stays empty reference-only');
equal(plan.specialistContext.selectedLane.knowledge.knowledgeLoaded, false, 'knowledge is not loaded');
equal(plan.specialistContext.selectedLane.knowledge.lessonCandidateGenerated, false, 'no lesson candidate is generated');
check(plan.specialistContext.artifactPlan.coordination.required, 'multi-specialist seam remains marked for coordination');
equal(plan.specialistContext.artifactPlan.coordination.automaticMerge, false, 'coordination cannot auto-merge');
equal(plan.specialistContext.specializationPlanRef.sha256, request.specializationPlan.planDigest, 'context byte-binds the exact specialization plan');
check(plan.organIntent.boundaries.some((entry) => entry.includes(plan.specialistContext.selectedLane.organRef.sha256)), 'intent boundary byte-binds the exact specialist profile digest');
check(plan.organIntent.boundaries.includes('The specialist profile is routing context, not implementation or capability proof.'), 'intent preserves the specialist truth ceiling');
check(plan.organIntent.boundaries.includes('Evidence remains UNKNOWN until domain-native verification is performed.'), 'intent preserves unknown evidence');
check(plan.organIntent.invariants.includes('The selected specialist lane cannot approve, merge, install, promote, or CANON this intent.'), 'intent preserves the authority ceiling');
equal(plan.holds, [], 'ready plan has no holds');
equal(plan.capabilityGapReport.overall, 'READY', 'ready plan has no typed capability gap');
equal(plan.capabilityGapReport.missingCapabilities, [], 'ready plan does not invent gaps');
equal(plan.truth.deterministicPlanOnly, true, 'truth labels the output as a plan only');
equal(plan.truth.intentInferred, false, 'intent is explicit rather than inferred');
equal(plan.truth.specialistProfileProvesCapability, false, 'profile does not prove capability');
equal(plan.truth.pathClassificationProvesSemantics, false, 'path classification does not prove semantics');
equal(plan.truth.organIntentCreated, true, 'truth records that inert intent data was created');
equal(plan.truth.organGenerated, false, 'no organ was generated');
equal(plan.truth.candidateExecuted, false, 'no candidate was executed');
equal(plan.truth.testsRun, false, 'planning claims no test execution');
equal(plan.truth.permissionGranted, false, 'planning grants no permission');
equal(plan.truth.networkUsed, false, 'planning uses no network');
equal(plan.truth.workspaceWritten, false, 'planning writes no workspace');
equal(plan.truth.installed, false, 'planning installs nothing');
equal(plan.truth.integrated, false, 'planning integrates nothing');
equal(plan.truth.promoted, false, 'planning promotes nothing');
equal(plan.truth.canonChanged, false, 'planning changes no CANON');
equal(plan.truth.mikeFinalMergeGatePreserved, true, 'Mike remains final merge gate');
equal(plan.resourceObservation.processesSpawned, 0, 'adapter spawns no child process');
equal(plan.resourceObservation.providerCalled, false, 'adapter calls no provider');
equal(plan.resourceObservation.sourceBytesRead, false, 'adapter reads no source bytes');
equal(plan.resourceObservation.workspaceRead, false, 'adapter reads no workspace content');
equal(plan.resourceObservation.workspaceWritten, false, 'adapter writes no workspace content');
equal(Adapter.verify(plan, request), { pass: true, errors: [] }, 'plan verifies by exact deterministic rebuild');
equal(Adapter.canonicalJson(Adapter.plan(request)), Adapter.canonicalJson(Adapter.plan(request)), 'identical input produces byte-identical plan data');
for (let index = 0; index < 12; index += 1) equal(Adapter.plan(request).planDigest, plan.planDigest, 'repeat ' + index + ' preserves plan digest');

const alternativeLane = reviseAdapter(request, (core) => {
  const artifact = core.specializationPlan.artifactPlans.find((row) => row.artifactRef.id === 'game-rules');
  core.selection.specialistOrganRef = clone(artifact.specialistLanes.find((row) => row.organRef.id === 'organ.code.browser-behavior').organRef);
});
const alternativePlan = Adapter.plan(alternativeLane);
equal(alternativePlan.status, 'READY_FOR_ORGAN_INTENT_REVIEW', 'another exact lane can be reviewed separately');
equal(alternativePlan.specialistContext.selectedLane.organRef.id, 'organ.code.browser-behavior', 'alternative remains separately identified');
check(alternativePlan.organIntent.intentDigest !== plan.organIntent.intentDigest, 'different specialist lineage changes intent bytes');
equal(alternativePlan.specialistContext.artifactPlan.coordination.automaticMerge, false, 'alternative never auto-merges with sibling lane');

const rootHold = reviseAdapter(request, (core) => {
  core.rootsGate[0].verdict = 'HOLD';
  core.specializationPlan.planDigest = Adapter.sha256Value('forged-plan');
});
const rootHoldPlan = Adapter.plan(rootHold);
equal(rootHoldPlan.status, 'ROOTS_HOLD', 'root HOLD stops the adapter');
equal(rootHoldPlan.truth.specializationPlanRebuilt, false, 'root HOLD stops before specialization rebuild');
equal(rootHoldPlan.specialistContext, null, 'root HOLD exposes no selected specialist context');
equal(rootHoldPlan.organIntent, null, 'root HOLD emits no organ intent');
equal(rootHoldPlan.nextGate, 'REPAIR_ROOT_EVIDENCE_AND_REPLAN', 'root HOLD cannot be clicked into PASS');

const rootFail = reviseAdapter(request, (core) => { core.rootsGate[3].verdict = 'FAIL'; });
equal(Adapter.plan(rootFail).status, 'ROOTS_HOLD', 'root FAIL stops the adapter');

const forgedPlan = reviseAdapter(request, (core) => { core.specializationPlan.planDigest = Adapter.sha256Value('forged'); });
const forgedPlanResult = Adapter.plan(forgedPlan);
equal(forgedPlanResult.status, 'SPECIALIZATION_HOLD', 'forged specialization plan fails closed');
check(forgedPlanResult.capabilityGapReport.missingCapabilities.includes('code.specialization.exact-plan-rebuild'), 'forged plan emits a typed exact-rebuild gap');
equal(forgedPlanResult.organIntent, null, 'forged plan cannot emit an intent');

const stale = reviseSpecialization(request, null, (specialization) => { specialization.plannedAt = '2026-08-23T18:00:00.000Z'; });
const stalePlan = Adapter.plan(stale);
equal(stale.specializationPlan.status, 'STALE_OBSERVATION_HOLD', 'fixture proves the underlying observation is stale');
equal(stalePlan.status, 'SPECIALIZATION_HOLD', 'stale host observation cannot cross the adapter');
equal(stalePlan.organIntent, null, 'stale host observation emits no intent');

const permissionExpansion = reviseSpecialization(request, (observation) => {
  observation.artifacts.find((row) => row.id === 'game-rules').requiredPermissions = ['filesystem-write'];
});
equal(permissionExpansion.specializationPlan.status, 'AUTHORITY_HOLD', 'permission expansion is held by the specialist router');
equal(Adapter.plan(permissionExpansion).status, 'SPECIALIZATION_HOLD', 'permission expansion cannot cross the adapter');

const networkExpansion = reviseSpecialization(request, (observation) => {
  observation.artifacts.find((row) => row.id === 'game-rules').networkDomains = ['example.invalid'];
});
equal(networkExpansion.specializationPlan.status, 'AUTHORITY_HOLD', 'network expansion is held by the specialist router');
equal(Adapter.plan(networkExpansion).status, 'SPECIALIZATION_HOLD', 'network expansion cannot cross the adapter');

const ambiguous = reviseSpecialization(request, (observation) => {
  const artifact = clone(observation.artifacts.find((row) => row.id === 'game-rules'));
  artifact.path = 'src/ambiguous.m';
  artifact.declaredLanguageId = null;
  artifact.dependsOnArtifactIds = [];
  observation.artifacts = [artifact];
});
equal(ambiguous.specializationPlan.status, 'CLASSIFICATION_HOLD', 'ambiguous .m path is preserved as a classification hold');
equal(Adapter.plan(ambiguous).status, 'SPECIALIZATION_HOLD', 'ambiguous language cannot cross the adapter');

const missingArtifact = reviseAdapter(request, (core) => { core.selection.artifactId = 'missing-artifact'; });
equal(Adapter.plan(missingArtifact).status, 'SELECTION_HOLD', 'missing artifact selection fails closed');

const forgedProfile = reviseAdapter(request, (core) => { core.selection.specialistOrganRef.sha256 = Adapter.sha256Value('forged-profile'); });
equal(Adapter.plan(forgedProfile).status, 'SELECTION_HOLD', 'specialist profile digest drift fails closed');

const forgedVersion = reviseAdapter(request, (core) => { core.selection.specialistOrganRef.version = '9.9.9'; });
equal(Adapter.plan(forgedVersion).status, 'SELECTION_HOLD', 'specialist profile version drift fails closed');

['id', 'version', 'digest'].forEach((field) => {
  const changed = reviseAdapter(request, (core) => {
    if (field === 'id') core.fieldPackRef.id = 'creative-production';
    if (field === 'version') core.fieldPackRef.version = '9.9.9';
    if (field === 'digest') core.fieldPackRef.digest = Adapter.sha256Value('drifted-pack');
  });
  const result = Adapter.plan(changed);
  equal(result.status, 'FIELD_PACK_HOLD', 'field-pack ' + field + ' drift fails closed');
  equal(result.organIntent, null, 'field-pack ' + field + ' drift emits no intent');
});

const missingInput = reviseAdapter(request, (core) => { core.intentDraft.inputs = core.intentDraft.inputs.filter((row) => row.name !== 'risk'); });
equal(Adapter.plan(missingInput).status, 'INTENT_HOLD', 'missing required pack input is held');

const missingOutput = reviseAdapter(request, (core) => { core.intentDraft.outputs = core.intentDraft.outputs.filter((row) => row.name !== 'route'); });
equal(Adapter.plan(missingOutput).status, 'INTENT_HOLD', 'missing required pack output is held');

const budgetExpansion = reviseAdapter(request, (core) => { core.intentDraft.resourceBudget.maxPackageBytes = 999999999; });
equal(Adapter.plan(budgetExpansion).status, 'INTENT_HOLD', 'organ resource expansion above canonical ceiling is held');

const malformedRecord = reviseAdapter(request, (core) => { core.intentDraft.rawSource = 'private source must not enter this record'; });
equal(Adapter.plan(malformedRecord).status, 'INTENT_HOLD', 'unknown/raw-source field is rejected from the emitted intent');

const authoritySmuggling = reviseAdapter(request, (core) => { core.intentDraft.authority = 'INSTALL'; });
equal(Adapter.plan(authoritySmuggling).status, 'INTENT_HOLD', 'intent authority smuggling is rejected');

const invalidMetric = reviseAdapter(request, (core) => { core.intentDraft.metricProfileId = 'fastest-wins'; });
equal(Adapter.plan(invalidMetric).status, 'INTENT_HOLD', 'unsupported metric profile is rejected');

const malformedOutput = clone(plan);
malformedOutput.unexpected = true;
equal(Adapter.verify(malformedOutput, request).pass, false, 'strict rebuild rejects an emitted record with unknown fields');

const digestDrift = clone(request);
digestDrift.intentDraft.purpose = 'changed after request sealing';
rejects(() => Adapter.plan(digestDrift), /request digest mismatch/, 'request digest drift is rejected');

rejects(() => reviseAdapter(request, (core) => { core.settings.allowedPermissions = ['filesystem-write']; }), /grants permission or network authority/, 'permission setting expansion is rejected before planning');
rejects(() => reviseAdapter(request, (core) => { core.settings.allowedNetworkDomains = ['example.invalid']; }), /grants permission or network authority/, 'network setting expansion is rejected before planning');
rejects(() => reviseAdapter(request, (core) => { core.settings.intentInference = 'FROM_FILENAME'; }), /settings exceed intent-binding rung/, 'filename-to-intent inference is rejected');
rejects(() => reviseAdapter(request, (core) => { core.resourceEnvelope.maxAttempts = 2; }), /resource authority exceeds/, 'multiple attempts are rejected');
rejects(() => reviseAdapter(request, (core) => { core.resourceEnvelope.maxProcesses = 2; }), /resource authority exceeds/, 'additional process authority is rejected');
rejects(() => reviseAdapter(request, (core) => { core.selection.artifactId = 'C:\\repo\\game.js'; }), /portable id/, 'Windows drive path cannot masquerade as an artifact id');
rejects(() => reviseAdapter(request, (core) => { core.provider = { id: 'ambiguous-provider' }; }), /request fields mismatch/, 'provider injection is rejected');
rejects(() => reviseAdapter(request, (core) => { core.unknown = true; }), /request fields mismatch/, 'unknown request field is rejected');
rejects(() => {
  reviseSpecialization(request, (observation) => { observation.artifacts[0].path = 'C:\\repo\\source.js'; });
}, /absolute or drive paths|portable/i, 'Windows absolute artifact path is rejected by inherited portable-path validation');
rejects(() => {
  reviseSpecialization(request, (observation) => {
    const first = clone(observation.artifacts[0]);
    first.id = 'case-one';
    first.path = 'src/Game.js';
    first.dependsOnArtifactIds = [];
    const second = clone(first);
    second.id = 'case-two';
    second.path = 'SRC/game.js';
    observation.artifacts = [first, second];
  });
}, /Windows case alias/, 'Windows case aliases are rejected by inherited observation validation');

const tinyInput = adapterCore(request);
tinyInput.resourceEnvelope.maxInputBytes = 1;
const tinyInputSealed = Adapter.sealRequest(tinyInput);
rejects(() => Adapter.plan(tinyInputSealed), /exceeds maxInputBytes/, 'input-byte ceiling is enforced');

const tinyOutput = reviseAdapter(request, (core) => { core.resourceEnvelope.maxOutputBytes = 1; });
rejects(() => Adapter.plan(tinyOutput), /exceeds maxOutputBytes/, 'output-byte ceiling is enforced');

const source = fs.readFileSync(path.join(__dirname, 'code-specialist-organ-intent-adapter-v1.js'), 'utf8');
equal(source.includes('generateCandidates('), false, 'adapter source never invokes Organ Fabric generation');
equal(source.includes('executeGraph('), false, 'adapter source never invokes the Organ Fabric runtime graph');
equal(source.includes("require('fs')"), false, 'adapter has no filesystem capability');
equal(source.includes('child_process'), false, 'adapter has no child-process capability');
equal(source.includes('fetch('), false, 'adapter has no network fetch capability');

console.log('Code specialist organ-intent adapter selftest: ' + checks + ' PASS');
