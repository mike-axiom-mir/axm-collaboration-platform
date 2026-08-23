#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Planner = require('./bounded-creation-program-planner-v1');
const HandFoundry = require('../../tools/hand-specification-foundry/hand-specification-core');

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

function ref(id, schema, char = 'a') {
  return { id, schema, sha256: digest(char) };
}

function routeResources(overrides = {}) {
  return {
    maxInputBytes: 65536,
    maxOutputBytes: 65536,
    maxMemoryBytes: 67108864,
    maxDurationMs: 1000,
    maxProcesses: 1,
    ...overrides
  };
}

const observerRef = ref('bounded-creation-host-observer', 'axm.host-observer-identity/v1', 'a');

function makeProvider(requirement, suffix, options = {}) {
  return {
    schema: Fabric.PROVIDER_SCHEMA,
    id: requirement.id + '-provider-' + suffix,
    version: options.version || '1.0.0',
    status: 'TEST',
    routes: [{
      capability: requirement.capability,
      inputSchema: requirement.inputSchema,
      outputSchema: requirement.outputSchema,
      minimumInputArtifacts: requirement.minimumInputArtifacts
    }],
    authority: {
      permissions: (options.permissions || []).slice(),
      network: options.network || { mode: 'disabled', domains: [] },
      mutability: options.mutability || 'read-only',
      sourceUse: options.sourceUse || 'inspect-only'
    },
    resources: routeResources(options.resources),
    requiresWorkspaceBoundary: false,
    requiredAssuranceSchemas: [],
    executionBoundary: 'external-explicit-executor',
    evidenceCeiling: 'Opaque digests and verdicts only.',
    lineage: { parents: [] }
  };
}

function selector(provider) {
  return { id: provider.id, version: provider.version, descriptorSha256: Fabric.providerDigest(provider) };
}

function assuranceRefs() {
  return [ref('resource-enforcement-assurance', Fabric.RESOURCE_ENFORCEMENT_SCHEMA, 'b')];
}

function makeObservation(provider, request, options = {}) {
  return Fabric.sealHostObservation({
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: selector(provider),
    observerRef,
    observedAt: options.observedAt || '2026-08-23T06:00:00.000Z',
    expiresAt: options.expiresAt || '2026-08-23T07:00:00.000Z',
    availability: options.availability || 'AVAILABLE',
    workspaceBoundaryRef: null,
    executorRef: ref('explicit-inert-test-executor-ref', 'axm.executor-reference/v1', 'c'),
    authorityEnvelope: clone(provider.authority),
    resourceEnvelope: clone(provider.resources),
    assuranceRefs: assuranceRefs()
  });
}

function makeRoute(requirement, options = {}) {
  const providers = [makeProvider(requirement, 'one', options)];
  if (options.ambiguous) providers.push(makeProvider(requirement, 'two', options));
  const policyResources = routeResources({
    maxInputBytes: 262144,
    maxOutputBytes: 262144,
    maxMemoryBytes: 134217728,
    maxDurationMs: 5000,
    maxProcesses: 2,
    ...(options.policyResources || {})
  });
  const request = {
    schema: Fabric.REQUEST_SCHEMA,
    id: 'route-' + requirement.id,
    capability: requirement.capability,
    inputSchema: requirement.inputSchema,
    outputSchema: requirement.outputSchema,
    selection: options.selection || null,
    inputArtifacts: Array.from({ length: requirement.minimumInputArtifacts }, (_, index) => ({
      id: requirement.id + '-input-' + (index + 1),
      schema: requirement.inputSchema,
      sha256: digest('d'),
      byteLength: 64
    })),
    workspaceBoundaryRef: null,
    reuseRights: { mode: 'RESEARCH_ONLY', authorityRef: null },
    policy: {
      authority: 'PLAN_ONLY',
      allowedPermissions: (options.permissions || []).slice(),
      allowedNetworkDomains: options.network ? options.network.domains.slice() : [],
      allowedMutability: [options.mutability || 'read-only'],
      allowedSourceUse: [options.sourceUse || 'inspect-only'],
      resourceCeilings: policyResources,
      observation: {
        evaluatedAt: options.evaluatedAt || '2026-08-23T06:10:00.000Z',
        maximumAgeMs: 3600000,
        trustedObserverRefs: [observerRef],
        selectedRecordDigest: null
      },
      requiredAssuranceSchemas: []
    }
  };
  const observations = options.noObservation
    ? []
    : providers.map((provider) => makeObservation(provider, request, options));
  return Fabric.buildRoutePlan({ request, providers, hostObservations: observations });
}

const requirements = [
  {
    id: 'game-compose-v1',
    capability: 'game.compose',
    inputSchema: 'axm.game-blueprint/v1',
    outputSchema: 'axm.game-module-bundle/v1',
    minimumInputArtifacts: 1
  },
  {
    id: 'game-static-verifier-v1',
    capability: 'game.verify.static',
    inputSchema: 'axm.game-module-bundle/v1',
    outputSchema: 'axm.static-verification-receipt/v1',
    minimumInputArtifacts: 1
  },
  {
    id: 'game-visual-verifier-v1',
    capability: 'game.verify.visual',
    inputSchema: 'axm.game-render-target/v1',
    outputSchema: 'axm.visual-journey-receipt/v1',
    minimumInputArtifacts: 1
  },
  {
    id: 'media-compose-v1',
    capability: 'media.storyboard.compose',
    inputSchema: 'axm.game-review-packet/v1',
    outputSchema: 'axm.animated-guide-candidate/v1',
    minimumInputArtifacts: 1
  },
  {
    id: 'media-motion-verifier-v1',
    capability: 'media.verify.motion',
    inputSchema: 'axm.animated-guide-candidate/v1',
    outputSchema: 'axm.motion-timing-receipt/v1',
    minimumInputArtifacts: 1
  },
  {
    id: 'hardware-simulation-v1',
    capability: 'hardware.simulate.vendor-neutral',
    inputSchema: 'axm.hardware-design-packet/v1',
    outputSchema: 'axm.hardware-simulation-packet/v1',
    minimumInputArtifacts: 1
  },
  {
    id: 'resource-safety-verifier-v1',
    capability: 'resource.verify.safety',
    inputSchema: 'axm.hardware-simulation-packet/v1',
    outputSchema: 'axm.resource-safety-receipt/v1',
    minimumInputArtifacts: 1
  }
];

const artifacts = [
  {
    id: 'game-module',
    domain: 'games',
    kind: 'axm.game-module-bundle/v1',
    purpose: 'Create a detached game module candidate without executing or installing it.',
    consequenceClass: 'INERT_DIGITAL',
    dependsOn: [],
    requiredRequirementIds: ['game-compose-v1', 'game-static-verifier-v1', 'game-visual-verifier-v1'],
    acceptanceClaims: [
      {
        id: 'game-static-shape',
        kind: 'STATIC_STRUCTURE',
        statement: 'The detached game module satisfies its exact static contracts.',
        risk: 'MEDIUM',
        verifierRequirementId: 'game-static-verifier-v1',
        evidenceSchema: 'axm.static-verification-receipt/v1',
        humanJudgmentRequired: false
      },
      {
        id: 'game-visible-journey',
        kind: 'VISUAL_APPEARANCE',
        statement: 'The reviewed game candidate renders the declared journey.',
        risk: 'MEDIUM',
        verifierRequirementId: 'game-visual-verifier-v1',
        evidenceSchema: 'axm.visual-journey-receipt/v1',
        humanJudgmentRequired: false
      },
      {
        id: 'game-fun-judgment',
        kind: 'TASTE_MEANING',
        statement: 'A human reviewer finds the candidate worth continuing.',
        risk: 'MEDIUM',
        verifierRequirementId: null,
        evidenceSchema: 'axm.human-taste-judgment/v1',
        humanJudgmentRequired: true
      }
    ]
  },
  {
    id: 'animated-guide',
    domain: 'entertainment',
    kind: 'axm.animated-guide-candidate/v1',
    purpose: 'Plan an animated guide candidate derived from the reviewed game packet.',
    consequenceClass: 'INERT_DIGITAL',
    dependsOn: ['game-module'],
    requiredRequirementIds: ['media-compose-v1', 'media-motion-verifier-v1'],
    acceptanceClaims: [{
      id: 'guide-motion-timing',
      kind: 'MOTION_TIMING',
      statement: 'The guide timing matches the exact storyboard timing contract.',
      risk: 'MEDIUM',
      verifierRequirementId: 'media-motion-verifier-v1',
      evidenceSchema: 'axm.motion-timing-receipt/v1',
      humanJudgmentRequired: false
    }]
  },
  {
    id: 'hardware-simulation',
    domain: 'hardware',
    kind: 'axm.hardware-simulation-packet/v1',
    purpose: 'Produce a vendor-neutral simulation packet only, with no physical actuation.',
    consequenceClass: 'PHYSICAL_SIMULATION',
    dependsOn: ['game-module'],
    requiredRequirementIds: ['hardware-simulation-v1', 'resource-safety-verifier-v1'],
    acceptanceClaims: [{
      id: 'simulation-resource-safety',
      kind: 'RESOURCE_SAFETY',
      statement: 'The simulation remains inside the declared resource and recovery envelope.',
      risk: 'HIGH',
      verifierRequirementId: 'resource-safety-verifier-v1',
      evidenceSchema: 'axm.resource-safety-receipt/v1',
      humanJudgmentRequired: false
    }]
  }
];

function rootsGate() {
  return Planner.ROOTS.map((root, index) => ({
    root,
    verdict: 'PASS',
    evidenceRefs: [ref('bounded-creation-' + root, 'axm.four-root-technical-review/v1', 'abcdef'[index])]
  }));
}

function settings() {
  return {
    lifecycleTarget: 'DETACHED_CANDIDATE',
    aiMode: 'OFF',
    challengerProviderRef: null,
    allowedPermissions: [],
    allowedNetworkDomains: [],
    allowedMutability: ['read-only'],
    allowedSourceUse: ['inspect-only'],
    resourceEnvelope: {
      maxInputBytes: 1048576,
      maxOutputBytes: 16777216,
      maxMemoryBytes: 134217728,
      maxDurationMs: 10000,
      maxProcesses: 1,
      maxAttempts: 1,
      maxCostMinorUnits: 0,
      maxArtifacts: 16,
      maxSteps: 64,
      maxRequirements: 32,
      maxDependencyDepth: 8
    },
    privacy: {
      durableEvidence: 'DIGESTS_MEASUREMENTS_VERDICTS_AND_LIMITATIONS_ONLY',
      retainRawSource: false,
      retainStdout: false,
      retainStderr: false,
      retainMachinePaths: false,
      retainPrivateContent: false
    },
    reuseRights: {
      state: 'RESEARCH_ONLY_HOLD',
      directReuseAllowed: false,
      authorityRef: null
    }
  };
}

function coreRequest(overrides = {}) {
  const routes = requirements.map((requirement) => ({
    requirementId: requirement.id,
    routePlan: makeRoute(requirement)
  }));
  return {
    schema: Planner.REQUEST_SCHEMA,
    version: Planner.VERSION,
    id: 'bounded-cross-domain-creation',
    goal: 'PRIVATE_MARKER: plan one game, its animated guide, and a vendor-neutral hardware simulation packet as separate detached artifacts.',
    artifacts: clone(artifacts),
    requirements: clone(requirements),
    routes,
    settings: settings(),
    rootsGate: rootsGate(),
    instructionRef: ref('human-bounded-creation-instruction', 'axm.human-instruction-reference/v1', 'e'),
    authority: 'NONE',
    ...overrides
  };
}

function reseal(request, change) {
  const core = clone(request);
  delete core.requestDigest;
  change(core);
  return Planner.sealRequest(core);
}

function redigestProgram(program, change) {
  const value = clone(program);
  delete value.programDigest;
  change(value);
  return { ...value, programDigest: Planner.sha256Value(value) };
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function localSchemaRefsResolve(file) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  function visit(value, current) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current));
    if (typeof value.$ref === 'string' && !value.$ref.startsWith('https://')) {
      const [targetFile, fragment] = value.$ref.split('#');
      const target = targetFile
        ? JSON.parse(fs.readFileSync(path.join(__dirname, targetFile), 'utf8'))
        : current;
      if (fragment) {
        const parts = fragment.replace(/^\//, '').split('/').filter(Boolean);
        let cursor = target;
        for (const part of parts) cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
        if (cursor === undefined) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current));
  }
  return visit(schema, schema);
}

const schemaFiles = [
  ['bounded-creation-program-request.schema.json', Planner.REQUEST_SCHEMA],
  ['bounded-creation-program.schema.json', Planner.PROGRAM_SCHEMA]
];
check(schemaFiles.every(([file, identity]) => {
  const value = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return value.$id === identity && value.additionalProperties === false;
}), 'v0.8 schemas bind exact identities and close their top-level records');
check(schemaFiles.every(([file]) => {
  const value = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schemaObjectNodesAreClosed(value) && localSchemaRefsResolve(file);
}), 'every v0.8 schema object node is closed and every local reference resolves');

const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-bounded-creation-program-planner-v1.contract.json'), 'utf8'));
const plannerSource = fs.readFileSync(path.join(__dirname, 'bounded-creation-program-planner-v1.js'), 'utf8');
check(contractValue.status === 'TEST' && contractValue.authority === 'NONE' && contractValue.permissions.length === 0,
  'module contract remains permissionless TEST with authority NONE');
check(contractValue.boundaries.reads.length === 0 && contractValue.boundaries.writes.length === 0 &&
  contractValue.boundaries.network.length === 0 && contractValue.boundaries.processes.length === 0,
  'module contract declares no filesystem, network, or process surface');
check(['automatic-hand-implementation', 'automatic-install-integration-or-publication',
  'automatic-model-training-or-physical-actuation', 'automatic-canon']
  .every((item) => contractValue.boundaries.refuses.includes(item)),
'module contract preserves universal-planning authority ceilings');
check(!/(?:require\(['"](?:fs|child_process|http|https|net|tls|vm|worker_threads)['"]\)|process\.env|\beval\s*\(|new\s+Function\b)/.test(plannerSource),
  'planner source exposes no filesystem, process, network, environment, worker, VM, or dynamic-code hand');

const request = Planner.sealRequest(coreRequest());
const program = Planner.buildProgram(request);
check(program.status === 'READY_FOR_DETACHED_CANDIDATE_REQUEST' && program.nextGate === 'SEMANTIC_GENERATION_REQUEST_REQUIRED',
  'exact cross-domain routes stop at a detached candidate request gate');
check(Planner.canonicalJson(program.scope.domains) === Planner.canonicalJson(['entertainment', 'games', 'hardware']),
  'one typed graph spans games, entertainment, and hardware simulation without domain ranking');
check(Planner.canonicalJson(program.artifactOrder) === Planner.canonicalJson(['game-module', 'animated-guide', 'hardware-simulation']),
  'artifact graph compiles to a stable dependency order');
check(program.steps.length === 12 && program.steps.every((step) => step.executionStatus === 'NOT_RUN' && step.authority === 'NONE'),
  'all four stages per artifact remain inert NOT_RUN records');
check(program.artifactPlans.every((artifact) => artifact.evidenceRoutes.every((route) =>
  route.verdict === 'UNKNOWN' && route.executionStatus === 'NOT_RUN' && route.observedEvidence.length === 0)),
'domain-native evidence routes never turn planning into proof');
const tasteRoute = program.artifactPlans.find((artifact) => artifact.artifactId === 'game-module')
  .evidenceRoutes.find((route) => route.kind === 'TASTE_MEANING');
check(tasteRoute.humanJudgmentRequired === true && tasteRoute.verifierRequirementId === null &&
  tasteRoute.primarySurface === 'EXPLICIT_HUMAN_OR_APPOINTED_STEWARD_JUDGMENT',
'taste remains an explicit human seat rather than a machine score');
check(!Planner.canonicalJson(program).includes('PRIVATE_MARKER') && !Planner.canonicalJson(program).includes('vendor-neutral hardware simulation packet'),
  'durable program omits raw goal, purpose, and claim text while retaining exact request digest');
check(program.capabilityGapReport.overall === 'READY' &&
  HandFoundry.parseGapReport(program.capabilityGapReport).schema === HandFoundry.REPORT_SCHEMA,
'gap view is directly compatible with the existing Hand Specification Foundry');
check(program.truth.deterministicPlanOnly === true && program.truth.routePlanInputsIndependentlyTrusted === false &&
  program.truth.providerCalled === false && program.truth.artifactGenerated === false &&
  program.truth.mikeFinalMergeGatePreserved === true,
'truth ceiling separates declared routes, creation, and Mike-controlled integration');

const repeated = Planner.buildProgram(request);
check(Planner.canonicalJson(repeated) === Planner.canonicalJson(program),
  'identical input produces byte-identical bounded creation programs');
const reorderedCore = coreRequest();
reorderedCore.artifacts.reverse();
reorderedCore.artifacts.forEach((artifact) => {
  artifact.dependsOn.reverse();
  artifact.requiredRequirementIds.reverse();
  artifact.acceptanceClaims.reverse();
});
reorderedCore.requirements.reverse();
reorderedCore.routes.reverse();
const reorderedRequest = Planner.sealRequest(reorderedCore);
check(reorderedRequest.requestDigest === request.requestDigest &&
  Planner.buildProgram(reorderedRequest).programDigest === program.programDigest,
'set-like input ordering cannot alter request or program bytes');
check(Planner.normalizeProgram(program).programDigest === program.programDigest,
  'emitted program passes strict standalone truth and digest validation');
check(Planner.verifyProgram(program, request).pass,
  'emitted program verifies against an exact deterministic rebuild');
const forgedProgram = clone(program);
forgedProgram.truth.installed = true;
check(!Planner.verifyProgram(forgedProgram, request).pass,
  'forged lifecycle truth cannot validate against the emitted record');
const contradictoryStatus = redigestProgram(program, (value) => {
  value.status = 'HIGHER_TIER_CONSENT_REQUIRED';
  value.nextGate = 'NEW_EXACT_HUMAN_CONSENT_REQUIRED';
});
rejects(() => Planner.normalizeProgram(contradictoryStatus), /status contradicts/,
  'a self-consistent digest cannot hide a contradictory lifecycle status');
const wrongEvidenceSurface = redigestProgram(program, (value) => {
  value.artifactPlans[0].evidenceRoutes[0].primarySurface = 'CONVENIENT_BUT_WRONG_TEST';
});
rejects(() => Planner.normalizeProgram(wrongEvidenceSurface), /non-native proof surface/,
  'a self-consistent digest cannot substitute the wrong evidence surface');
const forgedResolution = redigestProgram(program, (value) => {
  value.capabilityResolutions[0].resolutionStatus = 'CAPABILITY_GAP';
  value.capabilityResolutions[0].gapType = 'HAND';
  value.artifactPlans[0].capabilityStates[0].resolutionStatus = 'CAPABILITY_GAP';
});
rejects(() => Planner.normalizeProgram(forgedResolution), /contradicts route status or holds/,
  'a self-consistent digest cannot turn a ready route into an invented gap');
const forgedRootsStatus = redigestProgram(program, (value) => {
  value.scope.rootsGate[0].verdict = 'HOLD';
});
rejects(() => Planner.normalizeProgram(forgedRootsStatus), /status contradicts/,
  'a self-consistent digest cannot conceal a four-root HOLD behind READY');

const missingRouteRequest = reseal(request, (core) => {
  core.routes = core.routes.filter((route) => route.requirementId !== 'hardware-simulation-v1');
  core.artifacts[2].domain = 'imagined-device-world';
});
const missingRouteProgram = Planner.buildProgram(missingRouteRequest);
check(missingRouteProgram.status === 'CAPABILITY_GAPS' &&
  missingRouteProgram.capabilityGapReport.missingCapabilities.includes('hardware-simulation-v1'),
'an unsupported imagined domain emits a typed capability gap instead of pretending support');
const missingContract = missingRouteProgram.capabilityGapReport.proposedContracts
  .find((item) => item.capabilityId === 'hardware-simulation-v1');
check(missingContract.gapType === 'HAND' && missingContract.contractState === 'SPEC_REQUIRED' &&
  Planner.canonicalJson(missingContract.requiredFields) === Planner.canonicalJson(Planner.REQUIRED_HAND_FIELDS),
'missing capability emits the exact nine-field Foundry handoff contract core');
check(missingRouteProgram.truth.unsupportedCapabilityPretendedAvailable === false &&
  missingRouteProgram.capabilityGapReport.truth.specificationClosesGap === false,
'a proposed specification never closes or implements its capability gap');

const ambiguousRequest = reseal(request, (core) => {
  const requirement = core.requirements.find((item) => item.id === 'game-compose-v1');
  core.routes.find((route) => route.requirementId === requirement.id).routePlan = makeRoute(requirement, { ambiguous: true });
});
const ambiguousProgram = Planner.buildProgram(ambiguousRequest);
check(ambiguousProgram.status === 'CAPABILITY_GAPS' &&
  ambiguousProgram.capabilityResolutions.find((item) => item.requirementId === 'game-compose-v1').routeStatus === 'SELECTION_REQUIRED',
'ambiguous providers remain a contract gap and are never silently ranked');

const forgedRouteCore = coreRequest();
forgedRouteCore.routes[0].routePlan.planDigest = digest('f');
rejects(() => Planner.sealRequest(forgedRouteCore), /route plan digest mismatch/,
  'forged route-plan lineage fails before program construction');
const wrongContractCore = coreRequest();
wrongContractCore.requirements[0].outputSchema = 'axm.drifted-output/v2';
rejects(() => Planner.sealRequest(wrongContractCore), /does not match the exact capability contract/,
  'schema or version drift between requirement and route fails closed');

const permissionRequest = reseal(request, (core) => {
  const requirement = core.requirements.find((item) => item.id === 'game-compose-v1');
  core.routes.find((route) => route.requirementId === requirement.id).routePlan = makeRoute(requirement, { permissions: ['storage.read'] });
});
const permissionResolution = Planner.buildProgram(permissionRequest).capabilityResolutions
  .find((item) => item.requirementId === 'game-compose-v1');
check(permissionResolution.gapType === 'AUTHORITY' && permissionResolution.holds.includes('AUTHORITY_PERMISSION_INTERSECTION_HOLD'),
  'permission requirements outside the human settings envelope become an authority gap');
const networkRequest = reseal(request, (core) => {
  const requirement = core.requirements.find((item) => item.id === 'media-compose-v1');
  core.routes.find((route) => route.requirementId === requirement.id).routePlan = makeRoute(requirement, {
    network: { mode: 'allowlist', domains: ['media.example'] }
  });
});
check(Planner.buildProgram(networkRequest).capabilityResolutions
  .find((item) => item.requirementId === 'media-compose-v1').holds.includes('AUTHORITY_NETWORK_INTERSECTION_HOLD'),
'network requirements outside the settings envelope fail closed');
const resourceRequest = reseal(request, (core) => {
  const requirement = core.requirements.find((item) => item.id === 'hardware-simulation-v1');
  core.routes.find((route) => route.requirementId === requirement.id).routePlan = makeRoute(requirement, {
    resources: { maxMemoryBytes: 268435456 },
    policyResources: { maxMemoryBytes: 536870912 }
  });
});
check(Planner.buildProgram(resourceRequest).capabilityResolutions
  .find((item) => item.requirementId === 'hardware-simulation-v1').holds.includes('RESOURCE_EXCEEDS_MAX_MEMORY_BYTES'),
'route resource declarations above the creation envelope become a substrate gap');

const rootsHold = reseal(request, (core) => { core.rootsGate[0].verdict = 'HOLD'; });
check(Planner.buildProgram(rootsHold).status === 'ROOTS_HOLD',
  'the ordered four-root gate runs before a candidate-generation readiness result');
const wrongRoots = coreRequest();
[wrongRoots.rootsGate[0], wrongRoots.rootsGate[1]] = [wrongRoots.rootsGate[1], wrongRoots.rootsGate[0]];
rejects(() => Planner.sealRequest(wrongRoots), /ordered four-root gate/,
  'reordered root decisions cannot masquerade as the technical gate');

const installHeld = reseal(request, (core) => { core.settings.lifecycleTarget = 'INSTALL_INTEGRATE_OR_PUBLISH'; });
const installHeldProgram = Planner.buildProgram(installHeld);
check(installHeldProgram.status === 'REUSE_RIGHTS_HOLD' && installHeldProgram.scope.minimumNextConsentTier === 4,
  'install, integration, or publication requires tier four and resolved direct-reuse rights');
const rightsRef = ref('declared-reuse-authority', 'axm.reuse-rights-authority/v1', 'f');
const installTier = reseal(installHeld, (core) => {
  core.settings.reuseRights = {
    state: 'DECLARED_REUSE_ALLOWED',
    directReuseAllowed: true,
    authorityRef: rightsRef
  };
});
check(Planner.buildProgram(installTier).status === 'HIGHER_TIER_CONSENT_REQUIRED',
  'reuse rights do not substitute for a new exact tier-four human decision');
const physical = reseal(installTier, (core) => {
  core.settings.lifecycleTarget = 'MODEL_TRAINING_OR_PHYSICAL_ACTUATION';
  core.artifacts.find((artifact) => artifact.id === 'hardware-simulation').consequenceClass = 'PHYSICAL_ACTUATION';
});
const physicalProgram = Planner.buildProgram(physical);
check(physicalProgram.status === 'HIGHER_TIER_CONSENT_REQUIRED' && physicalProgram.scope.minimumNextConsentTier === 5 &&
  physicalProgram.truth.physicalActuationPerformed === false,
'physical actuation remains a separate tier-five decision and is never performed by planning');

const badAi = coreRequest();
badAi.settings.aiMode = 'UNTRUSTED_CHALLENGER';
rejects(() => Planner.sealRequest(badAi), /AI mode and exact challenger provider reference disagree/,
  'AI challenger mode cannot hide an absent exact provider reference');
const aiRequest = reseal(request, (core) => {
  core.settings.aiMode = 'UNTRUSTED_CHALLENGER';
  core.settings.challengerProviderRef = {
    id: 'optional-ai-challenger',
    version: '1.0.0',
    descriptorSha256: digest('a')
  };
});
const aiProgram = Planner.buildProgram(aiRequest);
check(aiProgram.scope.aiMode === 'UNTRUSTED_CHALLENGER' && aiProgram.scope.challengerProviderRef.id === 'optional-ai-challenger' &&
  aiProgram.truth.aiInvolvementHidden === false && aiProgram.truth.aiOutputTrusted === false,
'optional AI remains exact, visible, uncalled, and untrusted');

const badTaste = coreRequest();
badTaste.artifacts[0].acceptanceClaims[2].verifierRequirementId = 'game-visual-verifier-v1';
rejects(() => Planner.sealRequest(badTaste), /taste or meaning requires a human seat/,
  'machine verification cannot replace human taste or meaning');
const badSafetyRisk = coreRequest();
badSafetyRisk.artifacts[2].acceptanceClaims[0].risk = 'MEDIUM';
rejects(() => Planner.sealRequest(badSafetyRisk), /must be HIGH risk/,
  'resource safety claims cannot be down-labelled to medium risk');
const cycle = coreRequest();
cycle.artifacts.find((artifact) => artifact.id === 'game-module').dependsOn = ['animated-guide'];
rejects(() => Planner.sealRequest(cycle), /contains a cycle/,
  'cyclic artifact dependencies are rejected');
const unknownDependency = coreRequest();
unknownDependency.artifacts[0].dependsOn = ['missing-artifact'];
rejects(() => Planner.sealRequest(unknownDependency), /depends on unknown artifact/,
  'unknown artifact dependencies are rejected');
const duplicateRequirement = coreRequest();
duplicateRequirement.requirements.push(clone(duplicateRequirement.requirements[0]));
rejects(() => Planner.sealRequest(duplicateRequirement), /requirement ids must be unique/,
  'duplicate capability requirements cannot create ambiguous lineage');
const unusedRequirement = coreRequest();
unusedRequirement.requirements.push({
  id: 'unused-capability-v1',
  capability: 'unused.capability',
  inputSchema: 'axm.unused-input/v1',
  outputSchema: 'axm.unused-output/v1',
  minimumInputArtifacts: 0
});
rejects(() => Planner.sealRequest(unusedRequirement), /unused requirement/,
  'unused requirements cannot silently expand the creation scope');
const duplicateRoute = coreRequest();
duplicateRoute.routes.push(clone(duplicateRoute.routes[0]));
rejects(() => Planner.sealRequest(duplicateRoute), /at most one exact route plan/,
  'each exact requirement accepts only one route-plan record');
const lowStepCeiling = coreRequest();
lowStepCeiling.settings.resourceEnvelope.maxSteps = 8;
rejects(() => Planner.sealRequest(lowStepCeiling), /planned steps exceed/,
  'artifact steps must fit the declared bounded program size');
const lowInputCeiling = coreRequest();
lowInputCeiling.settings.resourceEnvelope.maxInputBytes = 1;
rejects(() => Planner.sealRequest(lowInputCeiling), /input byte ceiling/,
  'request bytes are measured against the declared input ceiling');
const lowOutputRequest = reseal(request, (core) => { core.settings.resourceEnvelope.maxOutputBytes = 1; });
rejects(() => Planner.buildProgram(lowOutputRequest), /output byte ceiling/,
  'program bytes are measured against the declared output ceiling');

check(program.capabilityResolutions.every((resolution) => resolution.inputClaimOnly === true) &&
  program.truth.hostObservationIsExecutionProof === false && program.truth.resourceLimitsEnforced === false,
'route observations and budget declarations remain input claims rather than execution proof');
check(program.scope.grantsAuthority === false && program.truth.permissionGranted === false &&
  program.truth.networkUsed === false && program.truth.sandboxExecuted === false &&
  program.truth.installed === false && program.truth.canonChanged === false,
'planning grants no permissions, network, sandbox, lifecycle, or CANON authority');

process.stdout.write('Bounded creation program planner selftest: ' + checks + ' cases PASS\n');
