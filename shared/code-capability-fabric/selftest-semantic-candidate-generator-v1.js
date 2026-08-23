#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('./semantic-candidate-generator-v1');
const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(char) {
  return 'sha256:' + char.repeat(64);
}

function ref(id, schema, char) {
  return { id, schema, sha256: digest(char) };
}

function hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function schemaHasNoEmptyObjectSlot(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaHasNoEmptyObjectSlot);
  if (Object.keys(value).length === 0) return false;
  return Object.values(value).every(schemaHasNoEmptyObjectSlot);
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
      const [targetFile, fragment] = value.$ref.split('#');
      const targetName = targetFile || current;
      const key = targetName + '#' + (fragment || '');
      if (!seen.has(key)) {
        const target = read(targetName);
        let cursor = target;
        if (fragment) {
          const parts = fragment.replace(/^\//, '').split('/').filter(Boolean);
          for (const part of parts) cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
          if (cursor === undefined) return false;
        }
        const nextSeen = new Set(seen);
        nextSeen.add(key);
        if (!visit(cursor, targetName, nextSeen)) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current, seen));
  }
  read(file);
  return visit(read(file), file, new Set([file + '#']));
}

function mutateRequest(request, mutate) {
  const core = clone(request);
  delete core.requestDigest;
  mutate(core);
  return core;
}

function reseal(requestCore) {
  return G.sealRequest(requestCore);
}

function withResource(request, field, amount) {
  const core = mutateRequest(request, (value) => {
    value.resourceEnvelope[field] = amount;
    const instanceCore = clone(value.consent.evaluationInput.instance);
    delete instanceCore.instanceDigest;
    instanceCore.resources[field] = amount;
    const instance = Consent.sealInstance(instanceCore);
    value.consent.evaluationInput = {
      policy: value.consent.evaluationInput.policy,
      instance,
      evaluatedAt: value.consent.evaluationInput.evaluatedAt
    };
    value.consent.evaluation = Consent.evaluateGroundedConsent(value.consent.evaluationInput);
  });
  return reseal(core);
}

function updateBundleJson(bundle, filePath, mutate) {
  const file = bundle.files.find((item) => item.path === filePath);
  assert.ok(file, 'bundle fixture file exists: ' + filePath);
  const value = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  mutate(value);
  const bytes = jsonBytes(value);
  file.content = bytes.toString('base64');
  file.sha256 = hex(bytes);
}

function updateBundleText(bundle, filePath, mutate) {
  const file = bundle.files.find((item) => item.path === filePath);
  assert.ok(file, 'bundle fixture file exists: ' + filePath);
  const bytes = Buffer.from(mutate(Buffer.from(file.content, 'base64').toString('utf8')), 'utf8');
  file.content = bytes.toString('base64');
  file.sha256 = hex(bytes);
}

function providerSelector(provider) {
  return { id: provider.id, version: provider.version, descriptorSha256: Fabric.providerDigest(provider) };
}

function buildChallengerRoute(request, overrides = {}) {
  const observerRef = ref('semantic-challenger-observer', 'axm.host-observer-identity/v1', 'a');
  const provider = {
    schema: Fabric.PROVIDER_SCHEMA,
    id: 'host-supplied-ai-challenger',
    version: '1.0.0',
    status: 'TEST',
    routes: [{
      capability: 'code.semantic-candidate-challenger',
      inputSchema: G.REQUEST_SCHEMA,
      outputSchema: G.PACKET_SCHEMA,
      minimumInputArtifacts: 1
    }],
    authority: {
      permissions: [],
      network: { mode: 'disabled', domains: [] },
      mutability: 'candidate-only',
      sourceUse: 'derive-concepts'
    },
    resources: {
      maxInputBytes: 1048576,
      maxOutputBytes: 524288,
      maxMemoryBytes: 134217728,
      maxDurationMs: 5000,
      maxProcesses: 1
    },
    requiresWorkspaceBoundary: false,
    requiredAssuranceSchemas: [],
    executionBoundary: 'external-host-supplied-challenger',
    evidenceCeiling: 'Candidate bytes and opaque references only.',
    lineage: { parents: [] },
    ...overrides.provider
  };
  const selector = providerSelector(provider);
  const routeRequest = {
    schema: Fabric.REQUEST_SCHEMA,
    id: 'plan-host-supplied-ai-challenger',
    capability: 'code.semantic-candidate-challenger',
    inputSchema: G.REQUEST_SCHEMA,
    outputSchema: G.PACKET_SCHEMA,
    selection: selector,
    inputArtifacts: [clone(request.blueprintPacket.blueprint.ref)],
    workspaceBoundaryRef: null,
    reuseRights: { mode: 'RESEARCH_ONLY', authorityRef: null },
    policy: {
      authority: 'PLAN_ONLY',
      allowedPermissions: [],
      allowedNetworkDomains: [],
      allowedMutability: ['candidate-only'],
      allowedSourceUse: ['derive-concepts'],
      resourceCeilings: clone(provider.resources),
      observation: {
        evaluatedAt: '2026-08-22T19:10:30.000Z',
        maximumAgeMs: 60000,
        trustedObserverRefs: [observerRef],
        selectedRecordDigest: null
      },
      requiredAssuranceSchemas: []
    },
    ...overrides.routeRequest
  };
  const assuranceRefs = [ref('resource-enforcement-assurance', Fabric.RESOURCE_ENFORCEMENT_SCHEMA, 'b')];
  const observationCore = {
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: selector,
    observerRef,
    observedAt: '2026-08-22T19:10:00.000Z',
    expiresAt: '2026-08-22T19:11:00.000Z',
    availability: 'AVAILABLE',
    workspaceBoundaryRef: null,
    executorRef: ref('external-challenger-endpoint', 'axm.executor-reference/v1', 'c'),
    authorityEnvelope: clone(provider.authority),
    resourceEnvelope: clone(provider.resources),
    assuranceRefs,
    ...overrides.observation
  };
  const observation = Fabric.sealHostObservation(observationCore);
  const routeInput = { request: routeRequest, providers: [provider], hostObservations: [observation] };
  return { provider, observation, routeInput, routePlan: Fabric.buildRoutePlan(routeInput) };
}

function buildAiBundle(request, selectedProvider) {
  const native = G.buildNativeBundle(request).bundle;
  const bundle = clone(native);
  const id = 'creation-review-card-adapter-ai';
  updateBundleJson(bundle, 'manifest.json', (value) => {
    value.id = id;
    value.name = 'AXM Creation Review-Card Adapter — AI Challenger Candidate';
  });
  updateBundleJson(bundle, 'module.contract.json', (value) => { value.id = id; });
  updateBundleJson(bundle, 'candidate.receipt.json', (value) => {
    value.candidate.id = id;
    value.creation.lane = 'AI_CHALLENGER';
    value.creation.generatorRef = clone(selectedProvider);
  });
  updateBundleJson(bundle, 'test-plan.json', (value) => { value.candidate.id = id; });
  updateBundleText(bundle, 'README.md', (value) => value.replace('Native Candidate', 'AI Challenger Candidate') + '\nDirect reuse: RESEARCH_ONLY_HOLD.\n');
  updateBundleText(bundle, 'adapter.js', (value) => value + '\n// Host-supplied AI challenger candidate data; not executed.\n');
  bundle.files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return { id, bundle };
}

function parallelRequest(base, route = buildChallengerRoute(base)) {
  check(route.routePlan.status === 'ROUTE_PLANNED', 'test fixture challenger has one exact planned route');
  const ai = buildAiBundle(base, route.routePlan.selected);
  const core = mutateRequest(base, (value) => {
    value.mode = 'NATIVE_WITH_AI_CHALLENGER';
    value.providerPolicy.challenger = {
      enabled: true,
      exactProvider: providerSelector(route.provider),
      routePlanDigest: route.routePlan.planDigest,
      allowedCandidatePermissions: [],
      allowedCandidateNetworkDomains: []
    };
    value.challengerIngress = {
      candidateId: ai.id,
      routeInput: route.routeInput,
      routePlan: route.routePlan,
      moduleBundle: ai.bundle,
      reuseRights: { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, authorityRef: null },
      lineageRefs: [
        { id: base.blueprintPacket.blueprint.ref.id, schema: base.blueprintPacket.blueprint.ref.schema, sha256: base.blueprintPacket.blueprint.value.blueprintDigest },
        { id: 'host-supplied-ai-challenger', schema: Fabric.PROVIDER_SCHEMA, sha256: Fabric.providerDigest(route.provider) }
      ],
      limitations: ['host-supplied-untrusted-data', 'direct-reuse-rights-held']
    };
  });
  return { request: reseal(core), route, ai };
}

const schemaFiles = [
  ['semantic-common.schema.json', 'axm.semantic-common/v1'],
  ['semantic-generation-request.schema.json', G.REQUEST_SCHEMA],
  ['semantic-candidate-packet.schema.json', G.PACKET_SCHEMA],
  ['candidate-alternative-comparison.schema.json', G.COMPARISON_SCHEMA],
  ['creation-review-card.schema.json', G.REVIEW_CARD_SCHEMA],
  ['semantic-candidate-test-plan.schema.json', G.TEST_PLAN_SCHEMA],
  ['semantic-candidate-generator-profile.schema.json', G.PROFILE_SCHEMA],
  ['native-recipe-library.schema.json', G.RECIPE_LIBRARY_SCHEMA],
  ['semantic-generation-capability-gap.schema.json', G.CAPABILITY_GAP_SCHEMA]
];

check(schemaFiles.every(([file, id]) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id === id),
  'semantic schemas bind exact public identities');
check(schemaFiles.every(([file]) => schemaObjectNodesAreClosed(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')))),
  'all semantic schema object nodes are closed');
check(schemaFiles.every(([file]) => schemaRefsResolve(file)), 'all local semantic schema references resolve');
check(['semantic-candidate-packet.schema.json', 'candidate-alternative-comparison.schema.json', 'creation-review-card.schema.json']
  .every((file) => schemaHasNoEmptyObjectSlot(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')))),
  'emitted semantic record schemas contain no unbounded empty-object slots');

const moduleContract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-semantic-candidate-generator-v1.contract.json'), 'utf8'));
check(moduleContract.status === 'TEST' && moduleContract.permissions.length === 0, 'semantic generator contract is permissionless TEST');
check(moduleContract.boundaries.writes.length === 0, 'semantic generator contract declares no writes');
check(['provider-call', 'candidate-code-execution', 'sandbox-execution', 'installation', 'integration', 'persistent-learning-admission', 'canon-change']
  .every((item) => moduleContract.boundaries.refuses.includes(item)), 'semantic generator contract preserves downstream authority holds');
check(G.PROFILE.defaultMode === 'NATIVE_ONLY' && G.PROFILE.permissions.length === 0 && G.PROFILE.networkDomains.length === 0,
  'native-only is the permissionless networkless default');
check(G.RECIPE_LIBRARY.recipes.length === 1 && G.RECIPE_LIBRARY.recipes[0].operations.length === 6,
  'native recipe library is versioned and exposes the six bounded operations');
check(G.PROFILE.profileDigest === G.sha256Value(Object.fromEntries(Object.entries(G.PROFILE).filter(([key]) => key !== 'profileDigest'))),
  'profile digest binds the exact profile core');
check(G.RECIPE_LIBRARY.libraryDigest === G.sha256Value(Object.fromEntries(Object.entries(G.RECIPE_LIBRARY).filter(([key]) => key !== 'libraryDigest'))),
  'recipe library digest binds the exact recipe bytes');

const base = G.buildExampleRequest();
const native = G.generate(base);
const nativeAgain = G.generate(clone(base));
check(G.canonicalJson(native) === G.canonicalJson(nativeAgain), 'identical native inputs produce byte-identical generation results');
check(native.packets.length === 1 && native.packets[0].lane === 'NATIVE', 'native-only mode emits exactly one native candidate packet');
check(native.comparison.status === 'NATIVE_ONLY' && native.comparison.ranking === null && native.comparison.selection === null,
  'native-only comparison invents no missing alternative or winner');
check(native.reviewCards.length === 1 && native.reviewCards[0].ai.used === false, 'native review card states that AI was not used');
check(native.reviewCards[0].evidence.passed.length === 0 && native.reviewCards[0].evidence.unknown.every((item) => item.verdict === 'UNRUN'),
  'review card preserves all generated acceptance evidence as UNRUN');
check(native.reviewCards[0].nextGate === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED',
  'Tier 1 output cannot impersonate authenticated human acceptance');
check(native.reviewCards[0].choices.find((item) => item.id === 'ACCEPT_FOR_NEXT_GATE').effect === 'REQUEST_AUTHENTICATED_HUMAN_DECISION_ONLY',
  'review acceptance advances only to the next gate');
check(native.packets[0].status === 'EXPERIMENTAL' && native.packets[0].truth.candidateCodeExecuted === false,
  'native candidate starts EXPERIMENTAL and unexecuted');
check(native.packets[0].truth.installed === false && native.packets[0].truth.integrated === false &&
  native.packets[0].truth.persistentLearningAdmitted === false && native.packets[0].truth.canonChanged === false,
  'native packet cannot install, integrate, learn, or alter CANON');
check(native.packets[0].reuseRights.state === 'RESEARCH_ONLY_HOLD' &&
  native.packets[0].reuseRights.directReuseAllowed === false &&
  native.reviewCards[0].reuseRights.state === 'RESEARCH_ONLY_HOLD',
  'native-generated source and its review card preserve Mike’s deferred direct-reuse hold');
check(native.packets[0].truth.fourRootPassDecisionsBound === true &&
  native.packets[0].truth.fourRootEvidenceContentVerified === false,
  'packet binds four-root PASS decisions without pretending the referenced evidence content was inspected');
check(native.truth.workspaceWritten === false && native.truth.networkUsed === false && native.truth.childProcessSpawned === false,
  'generation remains an in-memory transform with no network or child process');
check(G.verifyGeneration(native, base).pass, 'native result verifies against deterministic rebuild');
check(G.jsonBytes(base).length <= base.resourceEnvelope.maxInputBytes,
  'sealed request digest bytes are included under the enforced input ceiling');
check(G.jsonBytes(native).length <= base.resourceEnvelope.maxOutputBytes,
  'complete emitted result stays under the enforced output ceiling');
rejects(() => withResource(base, 'maxInputBytes', 45110), /sealed semantic generation request exceeds/i,
  'sealed request bytes cannot hide outside the declared input ceiling');
const tinyOutput = withResource(base, 'maxOutputBytes', 1);
rejects(() => G.generate(tinyOutput), /complete semantic generation result exceeds/i,
  'comparison, review cards, and packet bytes all count against the output ceiling');

const packet = native.packets[0];
check(packet.moduleBundle.schema === 'axm.module-bundle/v1' && packet.sourceFiles.length === G.REQUIRED_CANDIDATE_FILES.length,
  'candidate packet wraps the existing module bundle with the fixed source set');
check(packet.sourceFiles.every((file) => file.sha256.startsWith('sha256:') && file.byteLength > 0),
  'every candidate source file is byte-length and SHA-256 bound');
check(packet.moduleBundle.files.every((file, index, files) => index === 0 || files[index - 1].path < file.path),
  'module-bundle files use deterministic path order');
check(packet.resourceObservation.fileCountEnforced && packet.resourceObservation.fileByteCeilingEnforced &&
  packet.resourceObservation.totalByteCeilingEnforced && packet.resourceObservation.attemptCountEnforced,
  'count, byte, and attempt resource limits are honestly reported as enforced');
check(packet.resourceObservation.durationEnforced === false && packet.resourceObservation.memoryEnforced === false,
  'duration and memory remain visibly unenforced');
check(packet.limitations.includes('CANDIDATE_CODE_NOT_EXECUTED') && packet.limitations.includes('AUTHENTICATED_HUMAN_DECISION_NOT_VERIFIED'),
  'candidate limitations preserve execution and identity gaps');
const adapterBytes = Buffer.from(packet.moduleBundle.files.find((file) => file.path === 'adapter.js').content, 'base64');
check(adapterBytes.includes(Buffer.from('renderPlainLanguage')) && adapterBytes.includes(Buffer.from('UNKNOWN')),
  'first native candidate contains the planned review-card adapter source as inert bytes');
check(Boolean(new vm.Script(adapterBytes.toString('utf8'), { filename: 'candidate-adapter.js' })),
  'generated adapter bytes pass parse-only JavaScript syntax validation');
check(!adapterBytes.includes(Buffer.from('child_process')) && !adapterBytes.includes(Buffer.from('fetch(')) &&
  !adapterBytes.includes(Buffer.from('XMLHttpRequest')),
  'static adapter bytes contain no child-process or network entry points');
check(!require.cache[Object.keys(require.cache).find((key) => key.endsWith(path.sep + 'adapter.js'))],
  'generated adapter source was not imported or executed by the selftest');
const forgedResult = clone(native);
forgedResult.reviewCards[0].evidence.passed.push(forgedResult.reviewCards[0].evidence.unknown.shift());
forgedResult.reviewCards[0].evidence.passed[0].verdict = 'PASS';
check(!G.verifyGeneration(forgedResult, base).pass, 'strict result verification rejects UNKNOWN-to-PASS record forgery');
const extraFieldResult = clone(native);
extraFieldResult.packets[0].selfApproved = true;
check(!G.verifyGeneration(extraFieldResult, base).pass, 'strict deterministic verification rejects extra emitted record fields');

const gap = G.buildCapabilityGap('game-world-generator', 'Generate a complete game world.');
check(gap.status === 'MISSING_TYPED_RECIPE' && gap.truth.implementationAvailable === false && gap.truth.fallbackPretended === false,
  'unsupported domains emit a typed capability gap without pretending universal support');

rejects(() => reseal(mutateRequest(base, (value) => { value.tier = 2; })), /Tier 1/i,
  'Tier 2 execution cannot inherit Tier 1 generation consent');
rejects(() => reseal(mutateRequest(base, (value) => { value.tier = 4; })), /Tier 1/i,
  'integration or publication tier cannot inherit candidate-generation consent');
rejects(() => reseal(mutateRequest(base, (value) => { value.recipeId = 'universal-executor'; })), /CAPABILITY_GAP/i,
  'unsupported recipe cannot silently fall back to a universal executor');
for (const verdict of ['HOLD', 'FAIL']) {
  rejects(() => reseal(mutateRequest(base, (value) => { value.rootsGate[1].verdict = verdict; })), /ROOTS_GATE_HOLD/i,
    'four-root ' + verdict + ' stops generation and cannot be clicked into PASS');
}
rejects(() => reseal(mutateRequest(base, (value) => { value.rootsGate[0].evidenceRefs = []; })), /bounded array/i,
  'four-root PASS without evidence is rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.rootsGate.reverse(); })), /exact order/i,
  'four-root order drift is rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.components.pop(); })), /exact required Workshop component set/i,
  'missing Workshop component lineage is rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.components[0].contract.version = 'forged'; })), /exact reference/i,
  'forged Workshop component bytes are rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.blueprintPacket.blueprint.value.purpose += ' drift'; })), /byte-bound|deterministic/i,
  'blueprint object drift is rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.blueprintPacket.inputSchema.ref.sha256 = digest('d'); })), /byte-bound/i,
  'compiled input schema digest drift is rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.blueprintPacket.outputSchema.ref.byteLength += 1; })), /byte-bound/i,
  'compiled output schema byte-length drift is rejected');
rejects(() => reseal(mutateRequest(base, (value) => { value.blueprintPacket.acceptanceMatrix.value.cases[0].verdict = 'PASS'; })), /byte-bound|deterministic/i,
  'acceptance matrix cannot replace UNRUN with PASS');
rejects(() => reseal(mutateRequest(base, (value) => { value.consent.evaluation.status = 'ACTION_SCOPE_HOLD'; })), /evaluation/i,
  'forged consent status is rejected by its exact evaluation digest');
rejects(() => reseal(mutateRequest(base, (value) => { value.consent.evaluationInput.instance.resources.maxOutputBytes -= 1; })), /evaluation|resources/i,
  'resource drift forces a new sealed consent instance');
rejects(() => reseal(mutateRequest(base, (value) => { value.resourceEnvelope.maxAttempts = 2; })), /one zero-cost in-process attempt/i,
  'multiple generation attempts exceed the resource model');
rejects(() => reseal(mutateRequest(base, (value) => { value.reuseRights.aiChallenger = 'DECLARED_REUSE_ALLOWED'; })), /research-only|held/i,
  'AI challenger direct reuse cannot be silently declared allowed');
rejects(() => reseal(mutateRequest(base, (value) => { value.providerPolicy.nativeProviderId = 'preferred-ai-provider'; })), /native provider policy/i,
  'native provider identity cannot drift');
rejects(() => reseal(mutateRequest(base, (value) => { value.mode = 'NATIVE_WITH_AI_CHALLENGER'; })), /challenger policy/i,
  'AI mode without an exact challenger policy fails closed');

const dangerousPaths = [
  '../adapter.js',
  'folder/../adapter.js',
  '/adapter.js',
  'C:/adapter.js',
  '//server/share/adapter.js',
  '\\\\server\\share\\adapter.js',
  'folder\\adapter.js',
  'adapter.js:secret',
  'CON',
  'nul.txt',
  'LPT1.log',
  'folder./adapter.js',
  'folder /adapter.js',
  'folder//adapter.js'
];
dangerousPaths.forEach((value) => rejects(() => G.normalizePortablePath(value), /portable|traversal|empty|reserved/i,
  'Windows and traversal alias rejected: ' + JSON.stringify(value)));
check(G.normalizePortablePath('src/review-card-adapter.js') === 'src/review-card-adapter.js',
  'portable nested candidate path is accepted unchanged');

const duplicateCaseBundle = clone(packet.moduleBundle);
const duplicate = clone(duplicateCaseBundle.files[0]);
duplicate.path = duplicate.path.toLowerCase() === duplicate.path ? duplicate.path.toUpperCase() : duplicate.path.toLowerCase();
duplicateCaseBundle.files.push(duplicate);
duplicateCaseBundle.files.sort((left, right) => left.path.localeCompare(right.path));
rejects(() => G.normalizeModuleBundle(duplicateCaseBundle, packet.candidate.id), /case-alias/i,
  'Windows case-colliding bundle paths are rejected');
const digestDriftBundle = clone(packet.moduleBundle);
digestDriftBundle.files[0].sha256 = '0'.repeat(64);
rejects(() => G.normalizeModuleBundle(digestDriftBundle, packet.candidate.id), /digest mismatch/i,
  'candidate source digest drift is rejected');
const malformedBase64Bundle = clone(packet.moduleBundle);
malformedBase64Bundle.files[0].content += '!';
rejects(() => G.normalizeModuleBundle(malformedBase64Bundle, packet.candidate.id), /canonical base64/i,
  'malformed emitted source encoding is rejected');
const missingFileBundle = clone(packet.moduleBundle);
missingFileBundle.files = missingFileBundle.files.filter((file) => file.path !== 'test-plan.json');
rejects(() => G.normalizeModuleBundle(missingFileBundle, packet.candidate.id), /misses required/i,
  'candidate without a test plan is rejected');
const claimedPassBundle = clone(packet.moduleBundle);
updateBundleJson(claimedPassBundle, 'test-plan.json', (value) => { value.cases[0].verdict = 'PASS'; });
rejects(() => G.normalizeModuleBundle(claimedPassBundle, packet.candidate.id), /start UNRUN/i,
  'generated candidate cannot pre-claim a passing test');
const authorityBundle = clone(packet.moduleBundle);
updateBundleJson(authorityBundle, 'candidate.receipt.json', (value) => { value.authority.integrated = true; });
rejects(() => G.normalizeModuleBundle(authorityBundle, packet.candidate.id), /authority/i,
  'candidate cannot claim that it integrated itself');

const parallel = parallelRequest(base);
const dual = G.generate(parallel.request);
const dualAgain = G.generate(clone(parallel.request));
check(G.canonicalJson(dual) === G.canonicalJson(dualAgain), 'parallel native and AI candidate generation is deterministic');
check(dual.packets.length === 2 && dual.packets[0].lane === 'NATIVE' && dual.packets[1].lane === 'AI_CHALLENGER',
  'optional AI output remains a separately identified challenger');
check(dual.packets[1].reuseRights.state === 'RESEARCH_ONLY_HOLD' && dual.packets[1].reuseRights.directReuseAllowed === false,
  'AI challenger packet preserves the direct-reuse hold');
check(dual.packets[1].generator.providerRef.descriptorSha256 === Fabric.providerDigest(parallel.route.provider),
  'AI candidate binds the exact provider descriptor digest');
check(dual.comparison.status === 'ALTERNATIVES_PRESERVED' && dual.comparison.alternatives.length === 2,
  'comparison preserves both alternatives');
check(dual.comparison.ranking === null && dual.comparison.selection === null && dual.comparison.truth.automaticMergeMade === false,
  'comparison neither ranks, selects, nor merges alternatives');
check(dual.comparison.fileDelta.changed.some((file) => file.path === 'adapter.js'),
  'comparison exposes exact source-byte disagreement');
check(dual.reviewCards[1].ai.used === true && dual.reviewCards[1].ai.providerRef.descriptorSha256 === Fabric.providerDigest(parallel.route.provider),
  'AI review card cannot hide challenger involvement or provider identity');
check(dual.reviewCards.every((card) => card.evidence.passed.length === 0),
  'neither candidate receives fabricated passing evidence');
check(G.verifyGeneration(dual, parallel.request).pass, 'parallel result verifies against deterministic rebuild');

rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.challengerIngress.routePlan.planDigest = digest('d');
})), /digest|forged|stale/i, 'forged challenger route plan is rejected');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.providerPolicy.challenger.exactProvider.version = '2.0.0';
})), /exact provider policy/i, 'challenger version ambiguity cannot be silently resolved');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.providerPolicy.challenger.exactProvider.descriptorSha256 = digest('e');
})), /exact provider policy/i, 'challenger descriptor drift is rejected');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.challengerIngress.routeInput.hostObservations[0].availability = 'UNAVAILABLE';
})), /record digest|forged|stale/i, 'tampered host availability observation is rejected');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.challengerIngress.routeInput.request.policy.observation.evaluatedAt = '2026-08-22T20:00:00.000Z';
})), /deterministic rebuild|forged|stale/i, 'stale host observation input is rejected against the route plan');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.challengerIngress.routeInput.providers.push(clone(value.challengerIngress.routeInput.providers[0]));
})), /duplicate|forged|stale/i, 'ambiguous duplicate provider descriptors are rejected');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.challengerIngress.reuseRights.directReuseAllowed = true;
})), /research-only|held/i, 'AI challenger cannot grant itself direct reuse rights');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.providerPolicy.challenger.allowedCandidatePermissions = ['storage.write'];
  updateBundleJson(value.challengerIngress.moduleBundle, 'manifest.json', (manifest) => { manifest.permissions = ['storage.write']; });
})), /contract identity|permissions|permission/i, 'manifest-only permission expansion is rejected against the contract');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  value.providerPolicy.challenger.allowedCandidateNetworkDomains = ['example.invalid'];
  updateBundleJson(value.challengerIngress.moduleBundle, 'module.contract.json', (contract) => {
    contract.networkDomains = ['example.invalid'];
  });
})), /fields must be exactly/i, 'candidate contract remains networkless even when challenger policy names a domain');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  updateBundleJson(value.challengerIngress.moduleBundle, 'candidate.receipt.json', (receipt) => { receipt.creation.lane = 'NATIVE'; });
})), /exact lane/i, 'AI candidate cannot disguise itself as native');
rejects(() => reseal(mutateRequest(parallel.request, (value) => {
  updateBundleJson(value.challengerIngress.moduleBundle, 'test-plan.json', (plan) => { plan.cases[0].verdict = 'PASS'; });
})), /start UNRUN/i, 'AI candidate cannot submit self-authored PASS evidence');

const ambiguousProvider = clone(parallel.route.provider);
ambiguousProvider.id = 'second-ai-challenger';
const ambiguousRequest = clone(parallel.route.routeInput.request);
ambiguousRequest.selection = null;
const observer = parallel.route.routeInput.hostObservations[0].observerRef;
function obsFor(provider) {
  return Fabric.sealHostObservation({
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: providerSelector(provider),
    observerRef: observer,
    observedAt: '2026-08-22T19:10:00.000Z',
    expiresAt: '2026-08-22T19:11:00.000Z',
    availability: 'AVAILABLE',
    workspaceBoundaryRef: null,
    executorRef: ref('endpoint-' + provider.id, 'axm.executor-reference/v1', provider.id === ambiguousProvider.id ? 'd' : 'c'),
    authorityEnvelope: clone(provider.authority),
    resourceEnvelope: clone(provider.resources),
    assuranceRefs: [ref('resource-' + provider.id, Fabric.RESOURCE_ENFORCEMENT_SCHEMA, provider.id === ambiguousProvider.id ? 'e' : 'b')]
  });
}
const ambiguousPlan = Fabric.buildRoutePlan({
  request: ambiguousRequest,
  providers: [parallel.route.provider, ambiguousProvider],
  hostObservations: [obsFor(parallel.route.provider), obsFor(ambiguousProvider)]
});
check(ambiguousPlan.status === 'SELECTION_REQUIRED', 'ambiguous AI provider alternatives require explicit exact selection');

process.stdout.write('SEMANTIC CANDIDATE GENERATOR SELFTEST PASS (' + checks + ' checks)\n');
