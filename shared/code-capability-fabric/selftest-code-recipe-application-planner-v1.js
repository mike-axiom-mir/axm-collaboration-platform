#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('./code-recipe-application-planner-v1');
const Consent = require('./grounded-consent-scope-v1');
const Discovery = require('./code-recipe-discovery-v1');
const Bridge = require('./code-recipe-fabric-bridge-v1');

let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function requestCore(request, mutate = () => {}) {
  const value = clone(request);
  delete value.requestDigest;
  mutate(value);
  return value;
}
function refArtifact(id, schema, digest, value) {
  return { id, schema, sha256: digest, byteLength: Planner.jsonBytes(value).length };
}

function rebindConsent(core, options = {}) {
  const policyCore = clone(core.consent.evaluationInput.policy);
  delete policyCore.policyDigest;
  policyCore.domainRules[0].resourceCeilings = clone(core.resourceEnvelope);
  if (options.policy) options.policy(policyCore, policyCore.domainRules[0]);
  const policy = Consent.sealPolicy(policyCore);
  const instanceCore = clone(core.consent.evaluationInput.instance);
  delete instanceCore.instanceDigest;
  instanceCore.policyRef = Consent.policyRef(policy);
  instanceCore.subjectRef = Planner.blueprintRef(core.blueprint);
  instanceCore.domainProfileRef = Planner.moduleRef();
  const discoveryRef = Discovery.packetRef(core.discoveryEvidence);
  const selectionRef = Bridge.selectionPacketRef(core.recipeSelection);
  instanceCore.predecisionEvidenceRefs = [discoveryRef, selectionRef];
  instanceCore.inputArtifacts = [
    refArtifact(core.blueprint.id, core.blueprint.schema, core.blueprint.blueprintDigest, core.blueprint),
    refArtifact(core.discoveryEvidence.id, core.discoveryEvidence.schema, core.discoveryEvidence.packetDigest, core.discoveryEvidence),
    refArtifact(core.recipeSelection.id, core.recipeSelection.schema, core.recipeSelection.packetDigest, core.recipeSelection)
  ];
  instanceCore.resources = clone(core.resourceEnvelope);
  if (options.instance) options.instance(instanceCore);
  const instance = Consent.sealInstance(instanceCore);
  const evaluatedAt = options.evaluatedAt || core.consent.evaluationInput.evaluatedAt;
  const evaluationInput = { policy, instance, evaluatedAt };
  core.consent = { evaluationInput, evaluation: Consent.evaluateGroundedConsent(evaluationInput) };
  return core;
}

function resealPlan(value, mutate) {
  const plan = clone(value);
  delete plan.planDigest;
  mutate(plan);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    plan.planDigest = Planner.sha256(plan);
    const bytes = Planner.jsonBytes(plan).length;
    if (bytes === plan.resourceObservation.planBytes) return plan;
    delete plan.planDigest;
    plan.resourceObservation.planBytes = bytes;
  }
  throw new Error('test plan byte measurement did not converge');
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function schemaRefsResolve(file) {
  const cache = new Map();
  function read(name) {
    if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    return cache.get(name);
  }
  function visit(value, current, seen) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current, seen));
    if (typeof value.$ref === 'string') {
      const [filePart, fragment = ''] = value.$ref.split('#');
      const targetName = filePart || current;
      const key = targetName + '#' + fragment;
      if (!seen.has(key)) {
        let cursor = read(targetName);
        if (fragment) {
          for (const part of fragment.replace(/^\//, '').split('/').filter(Boolean)) {
            cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
          }
          if (cursor === undefined) return false;
        }
        const next = new Set(seen);
        next.add(key);
        if (!visit(cursor, targetName, next)) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current, seen));
  }
  return visit(read(file), file, new Set([file + '#']));
}

function hasKey(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some((item) => hasKey(item, key));
}

const schemaFiles = [
  ['code-recipe-application-request.schema.json', Planner.REQUEST_SCHEMA],
  ['code-recipe-application-plan.schema.json', Planner.PLAN_SCHEMA]
];
check(schemaFiles.every(([file, id]) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id === id),
  'application planner schemas bind exact public identities');
check(schemaFiles.every(([file]) => schemaObjectNodesAreClosed(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')))),
  'application planner schema object nodes are closed');
check(schemaFiles.every(([file]) => schemaRefsResolve(file)), 'application planner local schema references resolve');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-code-recipe-application-planner-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0 &&
  Planner.canonicalJson(contract.rootsGate) === Planner.canonicalJson(Planner.ROOTS),
  'application planner contract is permissionless, write-free TEST');
check(['held-recipe-application', 'snippet-byte-emission', 'snippet-copying', 'snippet-application', 'snippet-execution',
  'automatic-recipe-selection', 'automatic-semantic-mapping', 'authenticated-human-decision-claim',
  'direct-reuse-authorization', 'provider-call', 'network-use', 'target-workspace-read', 'target-workspace-write',
  'child-process-spawn', 'candidate-generation', 'candidate-materialization', 'test-execution', 'installation',
  'integration', 'promotion', 'persistent-learning', 'hardware-actuation', 'canon-change']
  .every((item) => contract.boundaries.refuses.includes(item)),
  'application planner contract preserves source, consent, runtime, and lifecycle holds');

const source = fs.readFileSync(path.join(__dirname, 'code-recipe-application-planner-v1.js'), 'utf8');
check(!/child_process|execSync|spawnSync|\beval\s*\(|new\s+Function|\bfetch\s*\(|XMLHttpRequest|require\(['"](?:https?|net|tls|vm)['"]\)/.test(source),
  'application planner source exposes no execution, dynamic-code, or network entry point');
check(!/process\.env|process\.cwd|os\.homedir|Date\.now|new Date\s*\(/.test(source),
  'application planner source inherits no environment, workspace location, or host clock');
check(!/localeCompare/.test(source) && /function compareText/.test(source),
  'application planner uses binary deterministic ordering instead of host locale');

const request = Planner.buildExampleRequest();
const plan = Planner.buildPlan(request);
const again = Planner.buildPlan(clone(request));
check(Planner.canonicalJson(plan) === Planner.canonicalJson(again), 'identical application input produces byte-identical plan evidence');
check(request.tier === 1 && request.applicationMode === Planner.APPLICATION_MODE && request.authority === 'NONE',
  'request binds exact Tier-1 intent while granting no authority');
check(request.mappings.map((item) => item.sourceId).join(',') === 'CC-0054,CC-0055',
  'request carries an exact deterministic mapping for every selected identity');
check(request.recipeSelection.mode === 'REFERENCE_ONLY' && request.recipeSelection.selectedRecipes.every((item) => item.snippet === null),
  'application input accepts recipe metadata and snippet references without source text');
check(request.consent.evaluation.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' &&
  request.consent.evaluation.truth.authenticatedHumanDecisionVerified === false,
  'valid grounded scope remains explicit that human authentication is outstanding');
check(plan.planningStatus === 'CONSENT_SCOPE_VALID_AUTHENTICATION_REQUIRED' && plan.consentGate.scopeValidated === true &&
  plan.consentGate.authenticatedHumanDecisionVerified === false && plan.consentGate.hostAuthorizationGranted === false,
  'plan separates validated consent scope from authentication and host authorization');
check(plan.applicationRecords.length === 2 && plan.applicationRecords[0].requesterMapping.nativeOperation === 'MAP_VALUES' &&
  plan.applicationRecords[1].requesterMapping.nativeOperation === 'FILTER_VALUES',
  'game-rule fixture carries the two explicit independent native operation outlines');
check(plan.applicationRecords.every((item) => item.requesterMapping.inferredByMachine === false &&
  item.requesterMapping.authenticatedHumanChoiceVerified === false),
  'requester mappings never become machine inference or an authenticated-choice claim');
check(plan.applicationRecords.every((item) => item.nativeImplementationOutline.targetRuntime === Planner.TARGET_RUNTIME &&
  item.nativeImplementationOutline.implementationStatus === 'NOT_STARTED' && item.nativeImplementationOutline.candidateCodeIncluded === false),
  'native outlines remain implementation-not-started and contain no candidate code');
check(plan.applicationRecords.every((item) => item.sourceTreatment.mode === 'METADATA_REFERENCE_ONLY' &&
  item.sourceTreatment.snippetBytesEmitted === false && item.sourceTreatment.snippetBytesCopied === false &&
  item.sourceTreatment.snippetBytesApplied === false && item.sourceTreatment.snippetExecuted === false &&
  item.sourceTreatment.directReuseAllowed === false),
  'every application record preserves the metadata-only source and direct-reuse hold');
check(!hasKey(plan.applicationRecords, 'snippet') && !hasKey(plan.applicationRecords, 'content') && !hasKey(plan.applicationRecords, 'moduleBundle'),
  'application records expose no snippet, source content, or generated module bundle field');
check(plan.candidate === null && plan.truth.candidateGenerated === false && plan.truth.testsRun === false &&
  plan.acceptancePlan.every((item) => item.executionStatus === 'NOT_RUN' && item.verdict === 'UNKNOWN'),
  'plan emits no candidate and preserves all acceptance evidence as NOT_RUN and UNKNOWN');
check(plan.truth.semanticMappingInferred === false && plan.truth.directReuseAuthorized === false &&
  plan.truth.snippetBytesIncluded === false && plan.truth.snippetsExecuted === false,
  'plan truth cannot inflate mapping, reuse, source, or execution state');
check(plan.truth.installed === false && plan.truth.integrated === false && plan.truth.promoted === false && plan.truth.canonChanged === false,
  'plan grants no install, integration, promotion, or CANON effect');
check(plan.nextGate === Planner.NEXT_GATE && plan.authority === 'NONE', 'next gate requires exact authentication before a new candidate request');
check(plan.resourceObservation.requestBytes === Planner.jsonBytes(request).length &&
  plan.resourceObservation.planBytes === Planner.jsonBytes(plan).length && plan.resourceObservation.mappingCount === 2,
  'request, plan, and mapping resource observations measure exact emitted records');
check(plan.resourceObservation.catalogRecipesVerified === 1000 && plan.resourceObservation.childProcessesSpawned === 0 &&
  plan.resourceObservation.networkUsed === false && plan.resourceObservation.targetWorkspaceRead === false &&
  plan.resourceObservation.targetWorkspaceWrite === false,
  'planner verifies the installed catalog without processes, network, or target-workspace access');
check(plan.lineageRefs.length === 8 && plan.lineageRefs.some((item) => item.sha256 === request.requestDigest) &&
  plan.lineageRefs.some((item) => item.sha256 === request.discoveryEvidence.packetDigest) &&
  plan.lineageRefs.some((item) => item.sha256 === request.recipeSelection.packetDigest),
  'plan lineage binds exact request, discovery, selection, blueprint, consent, and module records');
check(Planner.canonicalJson(Planner.normalizePlan(plan)) === Planner.canonicalJson(plan),
  'application plan survives strict exact-input deterministic rebuild');
check(Planner.canonicalJson(Planner.planRef(plan)) === Planner.canonicalJson({ id: plan.id, schema: plan.schema, sha256: plan.planDigest }),
  'application plan reference binds its exact digest');

const reordered = Planner.sealRequest(requestCore(request, (core) => { core.mappings.reverse(); }));
check(Planner.canonicalJson(reordered) === Planner.canonicalJson(request), 'mapping input order cannot change canonical request bytes');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings.pop(); })), /every and only exact selected/i,
  'missing mapping for a selected recipe is rejected');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings.push(clone(core.mappings[0])); })), /duplicates|must contain/i,
  'duplicate selected-recipe mapping is rejected');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings[1].targetStepId = core.mappings[0].targetStepId; })), /ambiguously target/i,
  'two recipes cannot ambiguously target the same blueprint step');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings[0].nativeOperation = 'EXECUTE_SOURCE'; })), /unsupported/i,
  'unsupported or execution-shaped native operation is rejected');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings[0].targetStepId = 'filter-allowed-actions'; })), /ambiguously target|structurally incompatible/i,
  'native map operation cannot target an incompatible SELECT step');
rejects(() => Planner.sealRequest(requestCore(request, (core) => {
  core.mappings[0] = { sourceId: 'CC-0054', targetStepId: 'filter-allowed-actions', nativeOperation: 'FILTER_VALUES' };
  core.mappings[1].targetStepId = 'map-action-outcomes';
})), /metadata does not mechanically support/i,
  'recipe without filter metadata cannot impersonate a filter recipe');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings[0].targetStepId = 'missing-step'; })), /absent from the exact blueprint/i,
  'mapping to an absent blueprint step is rejected');

for (const alias of ['cc-0054', '../CC-0054', 'C:/CC-0054', '\\server\\CC-0054', 'CC-0054:stream', 'CON']) {
  rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings[0].sourceId = alias; })), /sourceId is invalid|every and only exact selected/i,
    'path, case, stream, UNC, or reserved-name recipe alias is rejected: ' + JSON.stringify(alias));
}
for (const alias of ['Map-Action-Outcomes', '../map-action-outcomes', 'C:/map-action-outcomes', '\\server\\step', 'map:stream', 'CON']) {
  rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.mappings[0].targetStepId = alias; })), /targetStepId is invalid|absent from the exact blueprint/i,
    'path, case, stream, UNC, or reserved-name step alias is rejected: ' + JSON.stringify(alias));
}

const heldCore = requestCore(request, (core) => {
  const discoveryRequest = Discovery.buildExampleInstalledDiscoveryRequest({
    terms: 'write formatted json', languages: [], domains: [], tags: [], familyKeys: [], maxResults: 8
  });
  core.discoveryEvidence = Discovery.discoverInstalled(discoveryRequest);
  core.recipeSelection = Bridge.selectInstalledForTest(['CC-0031'], 'REFERENCE_ONLY').packet;
  core.mappings = [{ sourceId: 'CC-0031', targetStepId: 'map-action-outcomes', nativeOperation: 'MAP_VALUES' }];
});
rebindConsent(heldCore);
rejects(() => Planner.sealRequest(heldCore), /HELD_RECIPE_APPLICATION_REFUSED/i,
  'structurally held recipe cannot enter an application plan');

const undiscoveredCore = requestCore(request, (core) => {
  const discoveryRequest = Discovery.buildExampleInstalledDiscoveryRequest({
    terms: 'print value', languages: [], domains: [], tags: [], familyKeys: [], maxResults: 8
  });
  core.discoveryEvidence = Discovery.discoverInstalled(discoveryRequest);
  core.recipeSelection = Bridge.selectInstalledForTest(['CC-0054'], 'REFERENCE_ONLY').packet;
  core.mappings = [{ sourceId: 'CC-0054', targetStepId: 'map-action-outcomes', nativeOperation: 'MAP_VALUES' }];
});
rebindConsent(undiscoveredCore);
rejects(() => Planner.sealRequest(undiscoveredCore), /not visible in eligible discovery/i,
  'selected recipe absent from exact eligible discovery results is rejected');

const sourceCore = requestCore(request, (core) => {
  core.recipeSelection = Bridge.selectInstalledForTest(['CC-0054', 'CC-0055'], 'DETACHED_RESEARCH_CONTEXT').packet;
});
rebindConsent(sourceCore);
rejects(() => Planner.sealRequest(sourceCore), /reference-only held-rights/i,
  'selection packet containing recipe source cannot enter application planning');

rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.discoveryEvidence.truth.correctnessProven = true; })),
  /deterministic installed-catalog rebuild/i, 'forged discovery truth fails installed-byte rebuild');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.recipeSelection.selectedRecipes[0].title += ' forged'; })),
  /digest|installed Foundry bytes|deterministic/i, 'forged selection metadata fails installed-byte rebuild');

const staleCore = requestCore(request);
rebindConsent(staleCore, { evaluatedAt: '2026-08-23T10:00:00.000Z' });
rejects(() => Planner.sealRequest(staleCore), /authentication still outstanding/i,
  'expired consent scope cannot produce an application plan');

const evidenceDrift = requestCore(request);
rebindConsent(evidenceDrift, { instance: (instance) => { instance.predecisionEvidenceRefs[0].sha256 = 'sha256:' + 'f'.repeat(64); } });
check(evidenceDrift.consent.evaluation.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED',
  'generic consent evaluator honestly does not inspect predecision evidence content');
rejects(() => Planner.sealRequest(evidenceDrift), /does not bind exact discovery and selection/i,
  'planner independently rejects forged predecision evidence reference');

const artifactDrift = requestCore(request);
rebindConsent(artifactDrift, { instance: (instance) => { instance.inputArtifacts[0].byteLength += 1; } });
rejects(() => Planner.sealRequest(artifactDrift), /input artifacts do not bind exact/i,
  'consent artifact byte drift is rejected even when generic scope evaluation passes');

const permissionCore = requestCore(request);
rebindConsent(permissionCore, {
  policy: (_policy, rule) => { rule.allowedPermissions = ['filesystem-read']; },
  instance: (instance) => { instance.permissions = ['filesystem-read']; }
});
check(permissionCore.consent.evaluation.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED', 'expanded permission can be internally policy-consistent');
rejects(() => Planner.sealRequest(permissionCore), /permissionless application-planning contract/i,
  'policy-consistent permission expansion still fails the fixed planner boundary');

const networkCore = requestCore(request);
rebindConsent(networkCore, {
  policy: (_policy, rule) => { rule.allowedNetworkDomains = ['example.test']; },
  instance: (instance) => { instance.networkDomains = ['example.test']; }
});
rejects(() => Planner.sealRequest(networkCore), /permissionless application-planning contract/i,
  'policy-consistent network expansion still fails the fixed planner boundary');

const lifecycleCore = requestCore(request);
rebindConsent(lifecycleCore, {
  policy: (_policy, rule) => { rule.allowedLifecycle.install = true; },
  instance: (instance) => { instance.lifecycle.install = true; }
});
rejects(() => Planner.sealRequest(lifecycleCore), /cannot grant lifecycle authority/i,
  'policy-consistent install scope cannot enter a plan-only adapter');

const resourceDrift = requestCore(request);
rebindConsent(resourceDrift, { instance: (instance) => { instance.resources.maxDurationMs -= 1; } });
rejects(() => Planner.sealRequest(resourceDrift), /does not match the exact permissionless/i,
  'consent resource drift forces a new exact scope');

const evidenceRemoval = requestCore(request);
rebindConsent(evidenceRemoval, { instance: (instance) => { instance.requiredEvidenceSchemas.pop(); } });
rejects(() => Planner.sealRequest(evidenceRemoval), /authentication still outstanding/i,
  'removing required evidence yields a consent hold instead of a plan');

const triggerExpansion = requestCore(request);
rebindConsent(triggerExpansion, {
  policy: (policy) => { policy.mandatoryReconsentTriggers.push('provider-drift'); },
  instance: (instance) => { instance.reconsentTriggers.push('provider-drift'); }
});
rejects(() => Planner.sealRequest(triggerExpansion), /mandatory re-consent and stop/i,
  'changed re-consent trigger set requires a new exact planner contract');

for (const verdict of ['HOLD', 'FAIL']) {
  rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.rootsGate[0].verdict = verdict; })), /ROOTS_GATE_HOLD/i,
    'four-root ' + verdict + ' stops recipe application planning');
}
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.rootsGate.reverse(); })), /exact AXM root order/i,
  'four-root order drift is rejected');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.rootsGate[0].evidenceRefs = []; })), /must contain from 1 to 8/i,
  'root PASS without evidence is rejected');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.authority = 'INSTALL'; })), /authority mismatch/i,
  'request cannot grant itself installation authority');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.instructionRef.sha256 = 'sha256:' + 'f'.repeat(64); })), /instruction declaration mismatch/i,
  'instruction declaration drift forces a new request');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.id = 'x'.repeat(110); })), /bounded canonical text/i,
  'request identity leaves room for bounded plan and consent-reference suffixes');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.resourceEnvelope.maxProcesses = 2; })), /one declared host process/i,
  'request cannot expand its process count');
rejects(() => Planner.sealRequest(requestCore(request, (core) => { core.resourceEnvelope.maxCostMinorUnits = 1; })), /zero cost/i,
  'request cannot add a spend budget');

const tinyOutput = requestCore(request, (core) => { core.resourceEnvelope.maxOutputBytes = 1024; });
rebindConsent(tinyOutput);
const tinyRequest = Planner.sealRequest(tinyOutput);
rejects(() => Planner.buildPlan(tinyRequest), /output byte ceiling/i,
  'plan cannot exceed the exact consent-bound output budget');

const digestDrift = clone(request);
digestDrift.requestDigest = 'sha256:' + 'f'.repeat(64);
rejects(() => Planner.buildPlan(digestDrift), /digest or canonical form mismatch/i,
  'request digest drift is rejected');
const requestUnknown = clone(request);
requestUnknown.approved = true;
rejects(() => Planner.buildPlan(requestUnknown), /fields must be exactly/i,
  'unknown request fields cannot smuggle approval state');

rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.consentGate.authenticatedHumanDecisionVerified = true; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot claim authenticated human consent');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.candidate = { status: 'EXPERIMENTAL' }; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot create a candidate');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.applicationRecords[0].snippet = 'copied source'; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot add recipe source');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.applicationRecords[0].sourceTreatment.directReuseAllowed = true; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot self-authorize direct reuse');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.truth.testsRun = true; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot claim tests were run');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.truth.correctnessProven = true; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot claim correctness');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.truth.installed = true; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot claim installation');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.nextGate = 'INSTALL_NOW'; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot replace the next human gate');
rejects(() => Planner.normalizePlan(resealPlan(plan, (value) => { value.applicationRecords[0].requesterMapping.inferredByMachine = true; })),
  /deterministic exact-input rebuild/i, 're-digested plan cannot claim machine-inferred semantic mapping');
const byteDrift = clone(plan);
byteDrift.resourceObservation.planBytes += 1;
rejects(() => Planner.normalizePlan(byteDrift), /deterministic exact-input rebuild/i,
  'plan byte-observation drift is rejected');
const planUnknown = clone(plan);
planUnknown.promote = true;
rejects(() => Planner.normalizePlan(planUnknown), /deterministic exact-input rebuild/i,
  'unknown plan fields cannot smuggle promotion state');

process.stdout.write('Code recipe application planner v1.2 selftest passed: ' + checks + ' checks.\n');
