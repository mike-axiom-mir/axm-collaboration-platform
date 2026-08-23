#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Router = require('./code-specialization-router-v1');
const Specialists = require('../specialists/axm-specialist-library');
const HandFoundry = require('../../tools/hand-specification-foundry/hand-specification-core');

let checks = 0;
function check(condition, message) { checks += 1; assert.ok(condition, message); }
function equal(actual, expected, message) { checks += 1; assert.deepStrictEqual(actual, expected, message); }
function rejects(fn, pattern, message) { checks += 1; assert.throws(fn, pattern, message); }
function clone(value) { return Router.clone(value); }

function observationCore(observation) {
  const result = clone(observation);
  delete result.observationDigest;
  return result;
}

function requestCore(request) {
  const result = clone(request);
  delete result.requestDigest;
  return result;
}

function revise(request, observationMutation, requestMutation) {
  const core = requestCore(request);
  const observation = observationCore(core.observation);
  if (observationMutation) observationMutation(observation);
  core.observation = Router.sealObservation(observation);
  if (requestMutation) requestMutation(core);
  return Router.sealRequest(core);
}

function oneArtifact(request, fields) {
  return revise(request, (observation) => {
    const base = clone(observation.artifacts[0]);
    observation.artifacts = [{ ...base, ...fields, dependsOnArtifactIds: [] }];
  });
}

const schemas = [
  ['code-specialist-organ-profile.schema.json', Router.PROFILE_SCHEMA],
  ['code-specialization-catalog.schema.json', Router.CATALOG_SCHEMA],
  ['code-artifact-observation.schema.json', Router.OBSERVATION_SCHEMA],
  ['code-specialization-request.schema.json', Router.REQUEST_SCHEMA],
  ['code-specialization-plan.schema.json', Router.PLAN_SCHEMA]
];
schemas.forEach(([file, schemaId]) => {
  const value = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  equal(value.$id, schemaId, file + ' has the expected schema id');
  equal(value.additionalProperties, false, file + ' closes unknown top-level fields');
});

equal(Router.VERSION, '1.5.0', 'router version is v1.5');
equal(Router.MODULE_CONTRACT.status, 'TEST', 'module remains TEST');
equal(Router.MODULE_CONTRACT.permissions, [], 'module grants no permissions');
check(Router.MODULE_CONTRACT.boundaries.writes.length === 0, 'module declares no writes');
check(Router.MODULE_CONTRACT.boundaries.refuses.includes('persistent-learning'), 'module refuses persistent learning');
check(Router.MODULE_CONTRACT.boundaries.refuses.includes('physical-actuation'), 'module refuses physical actuation');
check(Router.CATALOG.languages.length >= 60, 'catalog spans at least sixty language/format profiles');
check(Router.CATALOG.specialistOrgans.length >= 14, 'catalog supplies bounded initial specialist organs');
equal(Router.CATALOG.truth.completeLanguageUniverseClaimed, false, 'catalog does not claim every language exists');
equal(Router.CATALOG.truth.fileExtensionProvesLanguage, false, 'extension is not language proof');
equal(Router.CATALOG.knowledgePolicy.automaticAdmission, false, 'knowledge cannot auto-admit');
equal(Router.CATALOG.knowledgePolicy.runningAttemptMutation, false, 'knowledge cannot mutate a running attempt');
check(Router.CATALOG.knowledgePolicy.forbiddenDurableContent.includes('RAW_SOURCE'), 'raw source is forbidden lesson content');
check(Router.CATALOG.knowledgePolicy.forbiddenDurableContent.includes('STDOUT'), 'stdout is forbidden lesson content');
check(Router.CATALOG.knowledgePolicy.forbiddenDurableContent.includes('PRIVATE_CONTENT'), 'private content is forbidden lesson content');

equal(Router.pathCandidates('src/view.html'), [{ id: 'html', family: 'markup-document' }], 'HTML path has one mechanical candidate');
equal(Router.pathCandidates('src/style.css'), [{ id: 'css', family: 'style' }], 'CSS path has one mechanical candidate');
equal(Router.pathCandidates('CMakeLists.txt'), [{ id: 'cmake', family: 'build-infrastructure' }], 'special basename classification is supported');
equal(Router.pathCandidates('Dockerfile'), [{ id: 'dockerfile', family: 'build-infrastructure' }], 'Dockerfile basename classification is supported');
equal(Router.pathCandidates('src/solver.m').map((item) => item.id), ['matlab', 'objective-c'], '.m ambiguity is preserved');
equal(Router.pathCandidates('src/rules.pl').map((item) => item.id), ['perl', 'prolog'], '.pl ambiguity is preserved');
equal(Router.pathCandidates('proof/module.v').map((item) => item.id), ['coq', 'verilog'], '.v ambiguity is preserved');
equal(Router.pathCandidates('unknown/file.xyz'), [], 'unknown extensions remain unknown');

const request = Router.buildExampleRequest();
const normalized = Router.normalizeRequest(request);
equal(normalized.requestDigest, request.requestDigest, 'sealed example request normalizes');
const plan = Router.plan(request);
equal(plan.status, 'READY_FOR_SPECIALIST_IMPROVEMENT_REQUEST', 'supported example routes cleanly');
equal(plan.nextGate, 'NEW_EXACT_TIER_1_DETACHED_CANDIDATE_REQUEST_REQUIRED', 'clean plan still needs new exact Tier-1 request');
equal(plan.authority, 'NONE', 'plan has no authority');
equal(plan.capabilityGapReport.overall, 'READY', 'clean example has no typed gaps');
equal(plan.capabilityGapReport.missingCapabilities, [], 'clean example gap list is empty');
equal(plan.capabilityGapReport.schema, 'axm.capability-gap-report/v1', 'gaps reuse the existing Hand Foundry intake schema');
equal(plan.capabilityGapReport.handoff.capability, 'capability.specify.missing-hand/v1', 'missing profiles route to the existing Hand Specification Foundry');
equal(plan.truth.sourceBytesRead, false, 'router reads no source bytes');
equal(plan.truth.candidateGenerated, false, 'router generates no candidate');
equal(plan.truth.testsRun, false, 'router runs no candidate tests');
equal(plan.truth.persistentLearningAdmitted, false, 'router admits no learning');
equal(plan.truth.mikeFinalMergeGatePreserved, true, 'Mike merge gate remains explicit');
equal(plan.resourceObservation.processesSpawned, 0, 'router spawns no process');
equal(plan.resourceObservation.networkUsed, false, 'router uses no network');
equal(plan.resourceObservation.outputBytes, Router.jsonBytes(plan), 'resource receipt measures exact final plan bytes');
check(Router.verify(plan, request).pass, 'deterministic verifier accepts exact rebuild');
equal(Router.canonicalJson(Router.plan(request)), Router.canonicalJson(Router.plan(request)), 'identical inputs produce byte-identical plans');

const byPath = new Map(plan.artifactPlans.map((entry) => [entry.path, entry]));
check(byPath.get('game/index.html').specialistLanes.some((lane) => lane.organRef.id === 'organ.code.markup-structure'), 'HTML routes to markup structure organ');
check(byPath.get('game/style.css').specialistLanes.some((lane) => lane.organRef.id === 'organ.code.style-presentation'), 'CSS routes to style organ');
check(byPath.get('game/game-rule.js').specialistLanes.some((lane) => lane.organRef.id === 'organ.code.browser-behavior'), 'browser JavaScript routes to browser behavior organ');
check(byPath.get('game/game-rule.js').specialistLanes.some((lane) => lane.organRef.id === 'organ.code.application-logic'), 'game-rule JavaScript also routes to application logic organ');
equal(byPath.get('game/game-rule.js').coordination.mode, 'SEPARATE_CONTRIBUTIONS_COORDINATION_REQUIRED', 'multiple organs remain separate contributions');
check(byPath.get('game/game-state.schema.json').specialistLanes.some((lane) => lane.organRef.id === 'organ.code.data-schema'), 'JSON schema routes to data/schema organ');
check(byPath.get('game/game-rule.test.js').specialistLanes.some((lane) => lane.organRef.id === 'organ.code.test-verification'), 'test artifact routes to verification organ');
check(plan.artifactPlans.every((entry) => entry.specialistLanes.every((lane) => lane.permissions.length === 0 && lane.networkDomains.length === 0 && lane.authority === 'NONE')), 'every specialist lane remains permissionless');
check(plan.artifactPlans.every((entry) => entry.specialistLanes.every((lane) => lane.knowledge.state === 'REFERENCE_ONLY_EMPTY' && lane.knowledge.admittedLessonRefs.length === 0 && lane.knowledge.knowledgeLoaded === false)), 'every knowledge lane is empty and reference-only');

const specialistMap = new Map(Specialists.catalog().map((mask) => [mask.id, mask]));
plan.artifactPlans.flatMap((entry) => entry.specialistLanes).flatMap((lane) => lane.methodMaskRefs).forEach((ref) => {
  check(specialistMap.has(ref.id), 'method mask reuses an existing Workshop specialist: ' + ref.id);
  equal(ref.sha256, Router.sha256Value(specialistMap.get(ref.id)), 'method mask reference is byte-bound: ' + ref.id);
});

const ambiguous = oneArtifact(request, {
  id: 'ambiguous-m', path: 'src/solver.m', declaredLanguageId: null,
  artifactFamilies: ['module'], responsibilities: ['application-logic'], runtimes: ['desktop'], frameworks: []
});
const ambiguousPlan = Router.plan(ambiguous);
equal(ambiguousPlan.status, 'CLASSIFICATION_HOLD', 'undeclared ambiguous extension fails closed');
equal(ambiguousPlan.artifactPlans[0].languageClassification.status, 'AMBIGUOUS_PATH_KIND', 'ambiguity is named');
equal(ambiguousPlan.artifactPlans[0].specialistLanes, [], 'ambiguous artifact is not silently routed');

const matlab = oneArtifact(request, {
  id: 'matlab-module', path: 'src/solver.m', declaredLanguageId: 'matlab',
  artifactFamilies: ['module'], responsibilities: ['application-logic'], runtimes: ['desktop'], frameworks: []
});
equal(Router.plan(matlab).artifactPlans[0].languageClassification.selected.id, 'matlab', 'exact declaration resolves compatible .m ambiguity');

const declarationConflict = oneArtifact(request, {
  id: 'false-python', path: 'src/solver.m', declaredLanguageId: 'python',
  artifactFamilies: ['module'], responsibilities: ['application-logic'], runtimes: ['desktop'], frameworks: []
});
equal(Router.plan(declarationConflict).artifactPlans[0].languageClassification.status, 'DECLARATION_PATH_CONFLICT', 'incompatible declaration and path are held');

const unknownLanguage = oneArtifact(request, {
  id: 'unknown-lang', path: 'src/code.xyz', declaredLanguageId: null,
  artifactFamilies: ['module'], responsibilities: ['application-logic'], runtimes: ['desktop'], frameworks: []
});
equal(Router.plan(unknownLanguage).status, 'CLASSIFICATION_HOLD', 'unknown language emits classification hold');

const missingFramework = oneArtifact(request, {
  id: 'new-framework', path: 'src/app.js', declaredLanguageId: 'javascript',
  artifactFamilies: ['module'], responsibilities: ['application-logic'], runtimes: ['browser'], frameworks: ['future-framework']
});
const missingFrameworkPlan = Router.plan(missingFramework);
equal(missingFrameworkPlan.status, 'CAPABILITY_GAPS', 'unknown framework is a typed knowledge gap');
check(missingFrameworkPlan.artifactPlans[0].axisGaps.some((entry) => entry.detail === 'FRAMEWORK_PROFILE_MISSING'), 'framework gap remains visible');
check(missingFrameworkPlan.capabilityGapReport.proposedContracts.some((entry) => entry.requestedCapability === 'knowledge.framework.future-framework'), 'framework gap is consumable by the Hand Specification Foundry');
equal(HandFoundry.parseGapReport(missingFrameworkPlan.capabilityGapReport).schema, 'axm.capability-gap-report/v1', 'existing Hand Foundry parses the emitted gap report');
check(HandFoundry.listCandidates(missingFrameworkPlan.capabilityGapReport).some((entry) => entry.capabilityId === 'knowledge.framework.future-framework'), 'existing Hand Foundry exposes the missing framework profile');
check(missingFrameworkPlan.artifactPlans[0].specialistLanes.length > 0, 'base language specialists remain visible beside framework gap');

const permission = oneArtifact(request, {
  id: 'network-module', path: 'src/network.js', declaredLanguageId: 'javascript',
  artifactFamilies: ['module'], responsibilities: ['networking'], runtimes: ['node'], frameworks: ['node'],
  requiredPermissions: ['environment.read'], networkDomains: ['api.example.invalid']
});
equal(Router.plan(permission).status, 'AUTHORITY_HOLD', 'permission or network need cannot inherit planning authority');

const physical = oneArtifact(request, {
  id: 'actuator', path: 'hardware/motor.v', declaredLanguageId: 'verilog',
  artifactFamilies: ['hardware-description'], responsibilities: ['physical-actuation'], runtimes: ['physical-device'], frameworks: []
});
const physicalPlan = Router.plan(physical);
equal(physicalPlan.status, 'AUTHORITY_HOLD', 'physical actuation requires a separate higher-tier policy');
check(physicalPlan.artifactPlans[0].axisGaps.some((entry) => entry.detail === 'TIER_5_PHYSICAL_POLICY_REQUIRED'), 'physical Tier-5 gap is explicit');

const stale = revise(request, null, (core) => { core.plannedAt = '2026-08-23T17:00:00.000Z'; });
const stalePlan = Router.plan(stale);
equal(stalePlan.status, 'STALE_OBSERVATION_HOLD', 'stale observation fails closed');
equal(stalePlan.artifactPlans[0].specialistLanes, [], 'stale observation cannot select specialists');

const futureObservation = revise(request, (observation) => { observation.observedAt = '2026-08-23T15:10:00.000Z'; });
equal(Router.plan(futureObservation).status, 'STALE_OBSERVATION_HOLD', 'future-dated observation fails closed');

const rootsHold = revise(request, null, (core) => { core.rootsGate[0].verdict = 'HOLD'; });
const rootsPlan = Router.plan(rootsHold);
equal(rootsPlan.status, 'ROOTS_HOLD', 'four-root HOLD stops the route');
check(rootsPlan.artifactPlans.every((entry) => entry.languageClassification.status === 'ROOTS_HOLD_NOT_CLASSIFIED'), 'roots are evaluated before classification');
check(rootsPlan.artifactPlans.every((entry) => entry.specialistLanes.length === 0), 'roots HOLD emits no specialist lane');

const forgedObservation = clone(request);
forgedObservation.observation.artifacts[0].byteLength += 1;
rejects(() => Router.plan(forgedObservation), /observation digest drift/i, 'forged observation content is rejected');
const forgedRequest = clone(request);
forgedRequest.plannedAt = '2026-08-23T15:06:00.000Z';
rejects(() => Router.plan(forgedRequest), /request digest drift/i, 'request digest drift is rejected');
const forgedCatalog = requestCore(request);
forgedCatalog.catalogRef.sha256 = Router.sha256Value('forged-catalog');
rejects(() => Router.sealRequest(forgedCatalog), /catalog reference is stale or forged/i, 'forged catalog reference is rejected');
const requestVersionDrift = requestCore(request);
requestVersionDrift.version = '1.5.1';
rejects(() => Router.sealRequest(requestVersionDrift), /request identity/i, 'request version ambiguity is rejected');
rejects(() => revise(request, (observation) => { observation.version = '1.5.1'; }), /observation identity/i, 'observation version ambiguity is rejected');
const extraRequestField = requestCore(request);
extraRequestField.promote = true;
rejects(() => Router.sealRequest(extraRequestField), /fields must be exactly/i, 'unknown request fields cannot smuggle promotion');
rejects(() => revise(request, (observation) => { observation.artifacts[0].knowledge = ['secret']; }), /fields must be exactly/i, 'unknown artifact fields cannot smuggle knowledge');

const declaredAttestation = revise(request, (observation) => {
  observation.attestationRef = { id: 'declared-host-attestation', schema: 'axm.code-host-observation-attestation/v1', sha256: Router.sha256Value('declared-host-attestation') };
});
equal(Router.plan(declaredAttestation).truth.observationAttestationPresent, true, 'declared attestation presence is visible');
equal(Router.plan(declaredAttestation).truth.hostObservationIndependentlyTrusted, false, 'declared attestation is not silently treated as independent trust');

for (const alias of ['../app.js', 'C:/app.js', '//server/share.js', '\\\\server\\share.js', 'app.js:stream', 'CON', 'folder\\app.js', 'e\u0301.js', 'folder/app.js.']) {
  rejects(() => revise(request, (observation) => { observation.artifacts[0].path = alias; }), /portable|traversal|reserved|path/i,
    'Windows, traversal, ADS, Unicode, or separator alias is rejected: ' + JSON.stringify(alias));
}

rejects(() => revise(request, (observation) => {
  const duplicate = clone(observation.artifacts[0]);
  duplicate.id = 'case-alias';
  duplicate.path = observation.artifacts[0].path.toUpperCase();
  observation.artifacts.push(duplicate);
}), /Windows case alias/i, 'Windows case-colliding artifact paths are rejected');

rejects(() => revise(request, (observation) => {
  observation.artifacts = observation.artifacts.slice(0, 2);
  observation.artifacts[0].dependsOnArtifactIds = [observation.artifacts[1].id];
  observation.artifacts[1].dependsOnArtifactIds = [observation.artifacts[0].id];
}), /dependency cycle/i, 'artifact dependency cycles are rejected');

const tinyOutput = revise(request, null, (core) => { core.resourceEnvelope.maxOutputBytes = 512; });
rejects(() => Router.plan(tinyOutput), /maxOutputBytes/i, 'exact output byte budget is enforced');
const zeroSpecialists = requestCore(request);
zeroSpecialists.resourceEnvelope.maxSpecialistsPerArtifact = 0;
rejects(() => Router.sealRequest(zeroSpecialists), /maxSpecialistsPerArtifact/i, 'invalid specialist budget is rejected');

const tamperedPlan = clone(plan);
tamperedPlan.truth.testsRun = true;
check(!Router.verify(tamperedPlan, request).pass, 'deterministic verification rejects truth inflation');
const learningTamper = clone(plan);
learningTamper.artifactPlans[0].specialistLanes[0].knowledge.knowledgeLoaded = true;
check(!Router.verify(learningTamper, request).pass, 'deterministic verification rejects hidden knowledge loading');

process.stdout.write('Code specialization router v1.5 selftest passed: ' + checks + ' checks.\n');
