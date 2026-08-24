#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Consent = require('./grounded-consent-scope-v1');
const Planner = require('./code-recipe-application-planner-v1');
const Generator = require('./native-game-rule-candidate-generator-v1');

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

function rebindConsent(core, options = {}) {
  const policyCore = clone(core.consent.evaluationInput.policy);
  delete policyCore.policyDigest;
  policyCore.domainRules[0].resourceCeilings = clone(core.resourceEnvelope);
  if (options.policy) options.policy(policyCore, policyCore.domainRules[0]);
  const policy = Consent.sealPolicy(policyCore);
  const instanceCore = clone(core.consent.evaluationInput.instance);
  delete instanceCore.instanceDigest;
  const planRef = Planner.planRef(core.applicationPlan);
  instanceCore.policyRef = Consent.policyRef(policy);
  instanceCore.subjectRef = planRef;
  instanceCore.domainProfileRef = Generator.moduleRef();
  instanceCore.predecisionEvidenceRefs = [planRef];
  instanceCore.inputArtifacts = [Generator.artifactRef(
    core.applicationPlan.id,
    core.applicationPlan.schema,
    core.applicationPlan.planDigest,
    core.applicationPlan
  )];
  instanceCore.resources = clone(core.resourceEnvelope);
  if (options.instance) options.instance(instanceCore);
  const instance = Consent.sealInstance(instanceCore);
  const evaluatedAt = options.evaluatedAt || core.consent.evaluationInput.evaluatedAt;
  const evaluationInput = { policy, instance, evaluatedAt };
  core.consent = { evaluationInput, evaluation: Consent.evaluateGroundedConsent(evaluationInput) };
  return core;
}

function resealPacket(packet, mutate) {
  const value = clone(packet);
  delete value.packetDigest;
  mutate(value);
  return { ...value, packetDigest: Generator.sha256Value(value) };
}

function replaceBundleFile(bundleInput, targetPath, mutateValue) {
  const bundle = clone(bundleInput);
  const file = bundle.files.find((entry) => entry.path === targetPath);
  assert.ok(file, 'test fixture file exists: ' + targetPath);
  const value = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  mutateValue(value);
  const bytes = Generator.jsonBytes(value);
  file.content = bytes.toString('base64');
  file.sha256 = Generator.sha256Bytes(bytes).slice('sha256:'.length);
  return bundle;
}

function replaceSource(bundleInput, text) {
  const bundle = clone(bundleInput);
  const file = bundle.files.find((entry) => entry.path === 'adapter.js');
  const bytes = Buffer.from(text, 'utf8');
  file.content = bytes.toString('base64');
  file.sha256 = Generator.sha256Bytes(bytes).slice('sha256:'.length);
  return bundle;
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

const schemaFiles = [
  ['native-game-rule-candidate-request.schema.json', Generator.REQUEST_SCHEMA],
  ['native-game-rule-candidate-packet.schema.json', Generator.PACKET_SCHEMA]
];
check(schemaFiles.every(([file, schema]) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id === schema),
  'native game-rule schemas bind exact public identities');
check(schemaFiles.every(([file]) => schemaObjectNodesAreClosed(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')))),
  'native game-rule schema object nodes are closed');
check(schemaFiles.every(([file]) => schemaRefsResolve(file)), 'native game-rule local schema references resolve');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-native-game-rule-candidate-generator-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0 &&
  Generator.canonicalJson(contract.rootsGate) === Generator.canonicalJson(Generator.ROOTS),
  'native game-rule generator contract is permissionless, write-free TEST');
check(['atlas-snippet-emission', 'atlas-snippet-copying', 'atlas-snippet-application', 'atlas-snippet-execution',
  'automatic-recipe-selection', 'automatic-semantic-mapping', 'direct-reuse-authorization',
  'authenticated-human-decision-claim', 'provider-call', 'provider-code-load', 'network-use',
  'target-workspace-read', 'target-workspace-write', 'filesystem-write', 'child-process-spawn',
  'candidate-code-execution', 'test-execution', 'candidate-materialization', 'installation', 'integration',
  'publication', 'persistent-learning', 'hardware-actuation', 'promotion', 'canon-change']
  .every((item) => contract.boundaries.refuses.includes(item)),
  'generator contract preserves source, execution, workspace, and lifecycle boundaries');

const generatorSource = fs.readFileSync(path.join(__dirname, 'native-game-rule-candidate-generator-v1.js'), 'utf8');
check(!/child_process|execSync|spawnSync|\beval\s*\(|new\s+Function|\bfetch\s*\(|XMLHttpRequest|require\(['"](?:https?|net|tls|vm|fs|path)['"]\)/.test(generatorSource),
  'generator source exposes no filesystem, child-process, dynamic-code, or network entry point');
check(!/process\.env|process\.cwd|os\.homedir|Date\.now|new Date\s*\(/.test(generatorSource),
  'generator source inherits no environment, workspace path, or host clock');
check(!/localeCompare/.test(generatorSource) && /function compareText/.test(generatorSource),
  'generator uses binary deterministic ordering instead of host locale');

const request = Generator.buildExampleRequest();
const result = Generator.generate(request);
const again = Generator.generate(clone(request));
const packet = result.packet;
const plan = request.applicationPlan;
const bundle = packet.moduleBundle;
const adapterFile = bundle.files.find((file) => file.path === 'adapter.js');
const adapterSource = Buffer.from(adapterFile.content, 'base64').toString('utf8');

check(Generator.canonicalJson(result) === Generator.canonicalJson(again),
  'identical exact input produces a byte-identical candidate result');
check(Generator.verifyGeneration(result, request).pass, 'deterministic verification rebuild accepts the exact result');
check(request.tier === 1 && request.mode === Generator.MODE && request.authority === 'NONE',
  'request binds Tier 1 in-memory draft mode without authority');
check(request.consent.evaluation.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' &&
  request.consent.evaluation.truth.authenticatedHumanDecisionVerified === false,
  'grounded generation scope remains honest that human authentication is outstanding');
check(packet.status === 'EXPERIMENTAL' && packet.generationStatus === 'INERT_DRAFT_CREATED_AUTHENTICATION_REQUIRED_BEFORE_WRITE' &&
  packet.nextGate === Generator.NEXT_GATE && packet.authority === 'NONE',
  'packet is an inert EXPERIMENTAL draft whose next gate is exact-byte authentication');
check(packet.candidate.id.startsWith('bounded-game-rule-') && packet.candidate.status === 'EXPERIMENTAL',
  'candidate identity is digest-derived and lifecycle-bounded');
check(Generator.canonicalJson(packet.operationBindings) === Generator.canonicalJson([
  {
    sourceId: 'CC-0054', recipeId: 'recipe-88ded8335d889c45',
    snippetRef: { byteLength: 45, sha256: 'sha256:e384faad88e101f39e5859e94d01063aab80ac154ca39b98634fe216c7681bfd' },
    targetStepId: 'map-action-outcomes', blueprintOperation: 'TRANSFORM', nativeOperation: 'MAP_VALUES', sourceMode: 'METADATA_REFERENCE_ONLY'
  },
  {
    sourceId: 'CC-0055', recipeId: 'recipe-be6d0ffee77165cc',
    snippetRef: { byteLength: 56, sha256: 'sha256:c4b2a42370a2d6c6e974f65dabeda78cb602ecde46527427d88c5e12d949e60f' },
    targetStepId: 'filter-allowed-actions', blueprintOperation: 'SELECT', nativeOperation: 'FILTER_VALUES', sourceMode: 'METADATA_REFERENCE_ONLY'
  }
]), 'candidate binds the exact Atlas metadata identities to the two requester-declared operations');
check(packet.sourceFiles.length === 9 && Generator.canonicalJson(packet.sourceFiles.map((file) => file.path)) === Generator.canonicalJson(Generator.REQUIRED_FILES),
  'candidate emits exactly the nine declared deterministic files');
check(bundle.files.every((file) => {
  const bytes = Buffer.from(file.content, 'base64');
  return Generator.sha256Bytes(bytes) === 'sha256:' + file.sha256;
}), 'every emitted candidate file is byte-bound to its recorded digest');
check(packet.moduleBundleRef.sha256 === Generator.sha256Bytes(Generator.jsonBytes(bundle)) &&
  packet.moduleBundleRef.byteLength === Generator.jsonBytes(bundle).length,
  'module bundle reference binds the exact serialized bundle bytes');
check(packet.sourceFiles.reduce((sum, file) => sum + file.byteLength, 0) === packet.resourceObservation.sourceBytes &&
  packet.resourceObservation.packetBytes === Generator.jsonBytes(packet).length &&
  packet.resourceObservation.requestBytes === Generator.jsonBytes(request).length,
  'request, packet, and candidate source byte observations are exact');
check(packet.resourceObservation.fileCountEnforced && packet.resourceObservation.fileByteCeilingEnforced &&
  packet.resourceObservation.totalByteCeilingEnforced && packet.resourceObservation.attemptCountEnforced &&
  !packet.resourceObservation.durationEnforced && !packet.resourceObservation.memoryEnforced,
  'enforced byte and attempt budgets are separated from unenforced duration and memory declarations');
check(packet.resourceObservation.processesSpawned === 0 && !packet.resourceObservation.networkUsed &&
  !packet.resourceObservation.targetWorkspaceRead && !packet.resourceObservation.targetWorkspaceWrite,
  'generation observes no child process, network, or target-workspace access');
check(packet.truth.exactApplicationPlanRebuilt && packet.truth.installedAtlasLineageRebuilt &&
  packet.truth.requesterMappingsBound && !packet.truth.semanticMappingInferred,
  'packet separates rebuilt lineage and requester mapping from machine semantic inference');
check(packet.truth.generatedSourceByteBound && packet.truth.candidateGenerated && !packet.truth.candidateCodeExecuted &&
  !packet.truth.candidateTestsRun && !packet.truth.runtimeBehaviorProven && !packet.truth.correctnessProven && !packet.truth.safetyProven,
  'candidate generation does not inflate execution, test, runtime, correctness, or safety truth');
check(!packet.truth.providerCalled && !packet.truth.providerCodeLoaded && !packet.truth.hostAuthorizationGranted &&
  !packet.truth.workspaceWritten && !packet.truth.installed && !packet.truth.integrated && !packet.truth.promoted && !packet.truth.canonChanged,
  'candidate carries no provider, host, workspace, installation, integration, promotion, or CANON effect');
check(packet.reuseRights.atlasSource.state === 'RESEARCH_ONLY_HOLD' && !packet.reuseRights.atlasSource.directReuseAllowed &&
  !packet.reuseRights.atlasSource.sourceBytesIncluded && packet.reuseRights.candidateSource.sourceBytesIncluded &&
  !packet.reuseRights.candidateSource.directReuseAllowed,
  'Atlas bytes remain absent while independently generated candidate bytes remain on direct-reuse hold');
check(plan.applicationRecords.every((record) => !adapterSource.includes(record.sourceId) && !adapterSource.includes(record.recipeId) &&
  !adapterSource.includes(record.recipeEvidence.title) && !adapterSource.includes(record.recipeEvidence.snippetRef.sha256)),
  'generated JavaScript contains no Atlas identity, title, or snippet-digest material');
check(!/\brequire\s*\(|\bimport\s+|\bfetch\s*\(|XMLHttpRequest|WebSocket|process\.|child_process|\beval\s*\(|new\s+Function|fs\.|Deno\.|Bun\./.test(adapterSource),
  'candidate JavaScript contains no ambient provider, filesystem, process, network, or dynamic-code hook');
new vm.Script(adapterSource, { filename: 'adapter.js' });
check(true, 'candidate JavaScript parses statically without being invoked');

const testPlan = JSON.parse(Buffer.from(bundle.files.find((file) => file.path === 'test-plan.json').content, 'base64').toString('utf8'));
check(testPlan.cases.length === 10 && testPlan.cases.every((item) => item.verdict === 'UNRUN') &&
  Object.values(testPlan.truth).every((value) => value === false),
  'candidate test plan starts entirely UNRUN with an inert truth ceiling');
const generatedInputSchema = JSON.parse(Buffer.from(bundle.files.find((file) => file.path === 'game-rule-input.schema.json').content, 'base64').toString('utf8'));
const generatedOutputSchema = JSON.parse(Buffer.from(bundle.files.find((file) => file.path === 'game-rule-result.schema.json').content, 'base64').toString('utf8'));
check(schemaObjectNodesAreClosed(generatedInputSchema) && schemaObjectNodesAreClosed(generatedOutputSchema),
  'generated game-rule input and output schema object nodes are closed');
check(Generator.canonicalJson(Generator.normalizePacket(packet, request)) === Generator.canonicalJson(packet),
  'strict packet normalization accepts the exact deterministic packet');
check(packet.lineageRefs.some((ref) => ref.sha256 === plan.planDigest) &&
  packet.lineageRefs.some((ref) => ref.sha256 === plan.discoveryEvidenceRef.sha256) &&
  packet.lineageRefs.some((ref) => ref.sha256 === plan.recipeSelectionRef.sha256),
  'candidate lineage preserves exact plan, installed discovery, and recipe selection references');

const reorderedCore = requestCore(request);
reorderedCore.applicationPlan.applicationRequest.mappings.reverse();
rejects(() => Generator.sealRequest(reorderedCore), /deterministic exact-input rebuild|canonical/i,
  'application-plan mapping order drift is rejected instead of silently reinterpreted');

const planDigestDrift = requestCore(request, (core) => { core.applicationPlan.planDigest = 'sha256:' + 'f'.repeat(64); });
rejects(() => Generator.sealRequest(planDigestDrift), /deterministic exact-input rebuild/i,
  'application plan digest drift is rejected');
const forgedSelection = requestCore(request, (core) => { core.applicationPlan.applicationRequest.recipeSelection.selectedRecipes[0].title += ' forged'; });
rejects(() => Generator.sealRequest(forgedSelection), /digest|installed Foundry bytes|deterministic/i,
  'forged installed recipe metadata is rejected through exact plan rebuild');
const mappingDrift = requestCore(request, (core) => { core.applicationPlan.applicationRecords[0].requesterMapping.nativeOperation = 'FILTER_VALUES'; });
rejects(() => Generator.sealRequest(mappingDrift), /deterministic exact-input rebuild/i,
  're-digested or direct requester-mapping drift cannot change candidate semantics');
const versionDrift = requestCore(request, (core) => { core.applicationPlan.version = '1.2'; });
rejects(() => Generator.sealRequest(versionDrift), /identity|deterministic/i,
  'ambiguous application plan version is rejected');
const rootDrift = requestCore(request, (core) => { core.applicationPlan.applicationRequest.rootsGate[0].verdict = 'HOLD'; });
rejects(() => Generator.sealRequest(rootDrift), /ROOTS_GATE_HOLD|deterministic/i,
  'four-root HOLD cannot enter candidate generation');
const sourceSmuggle = requestCore(request, (core) => { core.applicationPlan.applicationRecords[0].snippet = 'copied Atlas source'; });
rejects(() => Generator.sealRequest(sourceSmuggle), /deterministic exact-input rebuild/i,
  'source bytes cannot be smuggled through a re-digested plan-shaped record');

const permissionCore = requestCore(request);
rebindConsent(permissionCore, {
  policy: (_policy, rule) => { rule.allowedPermissions = ['filesystem-read']; },
  instance: (instance) => { instance.permissions = ['filesystem-read']; }
});
check(permissionCore.consent.evaluation.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED',
  'expanded permission can be internally policy-consistent');
rejects(() => Generator.sealRequest(permissionCore), /fixed permissionless/i,
  'policy-consistent permission expansion still fails the generator boundary');

const networkCore = requestCore(request);
rebindConsent(networkCore, {
  policy: (_policy, rule) => { rule.allowedNetworkDomains = ['example.test']; },
  instance: (instance) => { instance.networkDomains = ['example.test']; }
});
rejects(() => Generator.sealRequest(networkCore), /fixed permissionless/i,
  'policy-consistent network expansion still fails the generator boundary');

const lifecycleCore = requestCore(request);
rebindConsent(lifecycleCore, {
  policy: (_policy, rule) => { rule.allowedLifecycle.install = true; },
  instance: (instance) => { instance.lifecycle.install = true; }
});
rejects(() => Generator.sealRequest(lifecycleCore), /cannot grant lifecycle/i,
  'policy-consistent installation scope cannot enter in-memory generation');

const resourceDrift = requestCore(request);
rebindConsent(resourceDrift, { instance: (instance) => { instance.resources.maxDurationMs -= 1; } });
rejects(() => Generator.sealRequest(resourceDrift), /scope differs from the fixed/i,
  'resource drift from exact grounded consent forces re-consent');

const artifactDrift = requestCore(request);
rebindConsent(artifactDrift, { instance: (instance) => { instance.inputArtifacts[0].byteLength += 1; } });
rejects(() => Generator.sealRequest(artifactDrift), /exact application plan bytes/i,
  'forged consent artifact byte length is rejected');

const staleCore = requestCore(request);
rebindConsent(staleCore, { evaluatedAt: '2026-08-23T12:00:00.000Z' });
rejects(() => Generator.sealRequest(staleCore), /authentication still outstanding/i,
  'expired grounded consent scope cannot generate a candidate');

rejects(() => Generator.sealRequest(requestCore(request, (core) => { core.instructionRef.sha256 = 'sha256:' + 'f'.repeat(64); })),
  /instruction declaration mismatch/i, 'instruction declaration drift forces a new exact request');
rejects(() => Generator.sealRequest(requestCore(request, (core) => { core.authority = 'INSTALL'; })),
  /authority mismatch/i, 'request cannot grant itself installation authority');
rejects(() => Generator.sealRequest(requestCore(request, (core) => { core.resourceEnvelope.maxProcesses = 2; })),
  /one in-process attempt/i, 'request cannot expand its process count');
rejects(() => Generator.sealRequest(requestCore(request, (core) => { core.resourceEnvelope.maxAttempts = 2; })),
  /one in-process attempt/i, 'request cannot expand its attempt count');
rejects(() => Generator.sealRequest(requestCore(request, (core) => { core.resourceEnvelope.maxCostMinorUnits = 1; })),
  /zero cost/i, 'request cannot add a spend budget');
const unknownRequest = clone(request);
unknownRequest.approved = true;
rejects(() => Generator.generate(unknownRequest), /fields must be exactly/i,
  'unknown request field cannot smuggle approval state');
const digestDrift = clone(request);
digestDrift.requestDigest = 'sha256:' + 'f'.repeat(64);
rejects(() => Generator.generate(digestDrift), /digest or canonical form mismatch/i,
  'request digest drift is rejected');

const tinyOutput = requestCore(request, (core) => { core.resourceEnvelope.maxOutputBytes = 150000; });
rebindConsent(tinyOutput);
const tinyRequest = Generator.sealRequest(tinyOutput);
rejects(() => Generator.generate(tinyRequest), /complete native game-rule generation result exceeds/i,
  'complete result cannot exceed the exact consent-bound output budget');

for (const alias of ['../README.md', 'C:/README.md', '//server/share.md', '\\\\server\\share.md', 'README.md:stream', 'CON', 'folder\\README.md', 'e\u0301.md']) {
  const bad = clone(bundle);
  bad.files.find((file) => file.path === 'README.md').path = alias;
  rejects(() => Generator.normalizeCandidateBundle(bad, plan), /portable|traversal|reserved|path|file set|candidate files/i,
    'portable bundle validation rejects Windows, traversal, UNC, ADS, or Unicode alias: ' + JSON.stringify(alias));
}
const caseCollision = clone(bundle);
caseCollision.files.find((file) => file.path === 'README.md').path = 'Adapter.js';
rejects(() => Generator.normalizeCandidateBundle(caseCollision, plan), /duplicate|case-alias/i,
  'Windows case-colliding candidate paths are rejected');

const contentDrift = replaceSource(bundle, adapterSource + '\n// drift\n');
rejects(() => Generator.normalizeCandidateBundle(contentDrift, plan), /closed native recipe/i,
  're-digested generated source drift is rejected by the closed native recipe');
const sourceInjection = replaceSource(bundle, adapterSource + '\nrequire("fs");\n');
rejects(() => Generator.normalizeCandidateBundle(sourceInjection, plan), /closed native recipe/i,
  're-digested ambient-authority source injection is rejected');
const malformedApplication = replaceBundleFile(bundle, 'recipe-application.json', (value) => { value.approved = true; });
rejects(() => Generator.normalizeCandidateBundle(malformedApplication, plan), /emitted record validation/i,
  'unknown field in re-digested recipe-application record is rejected');
const testTruthInflation = replaceBundleFile(bundle, 'test-plan.json', (value) => { value.cases[0].verdict = 'PASS'; });
rejects(() => Generator.normalizeCandidateBundle(testTruthInflation, plan), /must start UNRUN/i,
  'candidate test record cannot claim PASS without execution');
const installedReceipt = replaceBundleFile(bundle, 'candidate.receipt.json', (value) => { value.authority.installed = true; });
rejects(() => Generator.normalizeCandidateBundle(installedReceipt, plan), /authority or truth ceiling/i,
  'candidate receipt cannot claim installation');
const expandedPermissions = replaceBundleFile(
  replaceBundleFile(bundle, 'manifest.json', (value) => { value.permissions = ['filesystem-read']; }),
  'module.contract.json',
  (value) => { value.permissions = ['filesystem-read']; }
);
rejects(() => Generator.normalizeCandidateBundle(expandedPermissions, plan), /permissionless/i,
  'coordinated manifest and contract mutation cannot expand candidate permissions');

const hugeBundle = clone(bundle);
const hugeAdapter = hugeBundle.files.find((file) => file.path === 'adapter.js');
const hugeBytes = Buffer.alloc(262145, 97);
hugeAdapter.content = hugeBytes.toString('base64');
hugeAdapter.sha256 = Generator.sha256Bytes(hugeBytes).slice('sha256:'.length);
rejects(() => Generator.normalizeCandidateBundle(hugeBundle, plan), /per-file byte ceiling/i,
  'candidate file byte ceiling is enforced');

rejects(() => Generator.normalizePacket(resealPacket(packet, (value) => { value.truth.candidateCodeExecuted = true; }), request),
  /deterministic exact-input rebuild/i, 're-digested packet cannot claim candidate execution');
rejects(() => Generator.normalizePacket(resealPacket(packet, (value) => { value.truth.correctnessProven = true; }), request),
  /deterministic exact-input rebuild/i, 're-digested packet cannot claim correctness');
rejects(() => Generator.normalizePacket(resealPacket(packet, (value) => { value.truth.installed = true; }), request),
  /deterministic exact-input rebuild/i, 're-digested packet cannot claim installation');
rejects(() => Generator.normalizePacket(resealPacket(packet, (value) => { value.reuseRights.atlasSource.directReuseAllowed = true; }), request),
  /deterministic exact-input rebuild/i, 're-digested packet cannot self-authorize Atlas source reuse');
rejects(() => Generator.normalizePacket(resealPacket(packet, (value) => { value.nextGate = 'INSTALL_NOW'; }), request),
  /deterministic exact-input rebuild/i, 're-digested packet cannot replace the authenticated candidate gate');
const packetUnknown = clone(packet);
packetUnknown.promote = true;
rejects(() => Generator.normalizePacket(packetUnknown, request), /deterministic exact-input rebuild/i,
  'unknown packet field cannot smuggle promotion state');

const tamperedResult = clone(result);
tamperedResult.truth.workspaceWritten = true;
check(!Generator.verifyGeneration(tamperedResult, request).pass,
  'result verifier rejects outer truth inflation through deterministic rebuild');

process.stdout.write('Native game-rule candidate generator v1.4 selftest passed: ' + checks + ' checks.\n');
