'use strict';

const crypto = require('crypto');
const Fabric = require('./code-capability-fabric-v2');
const DeterministicJson = require('../../tools/deterministic-json-core');
const HandFoundry = require('../../tools/hand-specification-foundry/hand-specification-core');
const HandFoundryContract = require('../../tools/hand-specification-foundry/module.contract.json');

const VERSION = '0.1.0';
const REQUEST_SCHEMA = 'axm.bounded-creation-program-request/v1';
const PROGRAM_SCHEMA = 'axm.bounded-creation-program/v1';
const GAP_REPORT_SCHEMA = 'axm.capability-gap-report/v1';
const MODULE_CONTRACT_SCHEMA = 'axm.module-contract/v1';
const ROOTS = Object.freeze([
  'truth',
  'agency-non-domination',
  'continuity',
  'wisdom-over-speed'
]);
const REQUEST_CORE_FIELDS = Object.freeze([
  'schema', 'version', 'id', 'goal', 'artifacts', 'requirements', 'routes',
  'settings', 'rootsGate', 'instructionRef', 'authority'
]);
const LIFECYCLE_TIERS = Object.freeze({
  DETACHED_CANDIDATE: 1,
  DISPOSABLE_SANDBOX_TRIAL: 2,
  CAPABILITY_LIBRARY_LESSON: 3,
  INSTALL_INTEGRATE_OR_PUBLISH: 4,
  MODEL_TRAINING_OR_PHYSICAL_ACTUATION: 5
});
const CONSEQUENCE_TIERS = Object.freeze({
  INERT_DIGITAL: 1,
  EXECUTABLE_DIGITAL: 2,
  PUBLIC_OR_SHARED: 4,
  PHYSICAL_SIMULATION: 1,
  PHYSICAL_ACTUATION: 5
});
const AI_MODES = Object.freeze(['OFF', 'UNTRUSTED_CHALLENGER']);
const MUTABILITY = Object.freeze(['read-only', 'candidate-only', 'process-observation']);
const SOURCE_USE = Object.freeze(['inspect-only', 'derive-concepts', 'transform-bytes', 'copy-bytes']);
const CLAIM_KINDS = Object.freeze([
  'EXISTENCE',
  'STATIC_STRUCTURE',
  'DETERMINISTIC_BEHAVIOR',
  'VISUAL_APPEARANCE',
  'MOTION_TIMING',
  'INTERACTION_JOURNEY',
  'PERSISTENCE',
  'TRANSPORT',
  'AUTHORIZATION',
  'PERFORMANCE',
  'RESOURCE_SAFETY',
  'LEARNING_IMPROVEMENT',
  'QUALITY',
  'TASTE_MEANING'
]);
const RISK_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
const REQUIRED_HAND_FIELDS = Object.freeze([
  'inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget',
  'failureRecovery', 'compatibility', 'verification'
]);
const STEP_STAGES = Object.freeze([
  'COMPOSE_TYPED_BLUEPRINT',
  'GENERATE_DETACHED_CANDIDATE',
  'GATHER_DOMAIN_NATIVE_EVIDENCE',
  'PRESENT_FOR_HUMAN_REVIEW'
]);
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT = /^[A-Za-z0-9][A-Za-z0-9._:/+@-]{0,219}$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MAX_REQUEST_BYTES = 1024 * 1024;

const EVIDENCE_ROUTES = Object.freeze({
  EXISTENCE: ['DIRECT_ARTIFACT_OR_RECORD_INSPECTION', 'MISSING_EXACT_ARTIFACT_OR_DIGEST'],
  STATIC_STRUCTURE: ['PARSED_SCHEMA_MANIFEST_OR_CONTRACT_VALIDATION', 'SCHEMA_OR_CONTRACT_REJECTION'],
  DETERMINISTIC_BEHAVIOR: ['FOCUSED_EXECUTION_WITH_IDENTICAL_INPUT_REBUILD', 'NON_IDENTICAL_OUTPUT_OR_ASSERTION_FAILURE'],
  VISUAL_APPEARANCE: ['LIVE_RENDER_AT_DECLARED_VIEWPORT_AND_STATE', 'VISIBLE_RENDER_OR_LAYOUT_MISMATCH'],
  MOTION_TIMING: ['TIMESTAMPED_FRAME_SEQUENCE_OR_RECORDING', 'FRAME_OR_TIMING_MISMATCH'],
  INTERACTION_JOURNEY: ['REAL_INPUT_THROUGH_COMPLETE_RELEVANT_JOURNEY', 'BLOCKED_OR_INCORRECT_USER_JOURNEY'],
  PERSISTENCE: ['SAVE_RESTART_RELOAD_AND_COMPARE', 'STATE_LOSS_OR_DRIFT_AFTER_RESTART'],
  TRANSPORT: ['DIGEST_BOUND_SENDER_AND_RECEIVER_RECEIPTS', 'MISSING_OR_MISMATCHED_RECEIVER_RECEIPT'],
  AUTHORIZATION: ['ALLOWED_AND_DENIED_IDENTITY_BOUNDARY_ATTEMPTS', 'UNAUTHORIZED_SUCCESS_OR_AUTHORIZED_REFUSAL'],
  PERFORMANCE: ['MEASURED_TELEMETRY_UNDER_NAMED_WORKLOAD', 'BUDGET_EXCEEDED_UNDER_DECLARED_WORKLOAD'],
  RESOURCE_SAFETY: ['INDEPENDENT_RESOURCE_TELEMETRY_LOAD_AND_RECOVERY', 'LIMIT_BREACH_THROTTLING_OR_UNCLEAN_RECOVERY'],
  LEARNING_IMPROVEMENT: ['HELD_OUT_EVALUATION_WITH_REGRESSION_COMPARISON', 'HELD_OUT_REGRESSION_OR_PROVENANCE_GAP'],
  QUALITY: ['DECLARED_ACCEPTANCE_CRITERIA_AND_ARTIFACT_INSPECTION', 'FAILED_ACCEPTANCE_CRITERION_OR_REVIEW'],
  TASTE_MEANING: ['EXPLICIT_HUMAN_OR_APPOINTED_STEWARD_JUDGMENT', 'HUMAN_REJECTION_OR_MISSING_JUDGMENT']
});

function canonicalJson(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Value(value) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  return value;
}

function exactKeys(value, fields, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = fields.slice().sort(compareText);
  if (!same(actual, expected)) {
    throw new Error(label + ' fields must be exactly: ' + expected.join(', '));
  }
}

function strictText(value, label, maximum) {
  if (typeof value !== 'string') throw new Error(label + ' must be a string');
  const text = value.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  if (!text) throw new Error(label + ' must not be empty');
  if (text.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new Error(label + ' contains a forbidden control character');
  }
  return text;
}

function id(value, label) {
  const normalized = strictText(value, label, 128);
  if (!ID.test(normalized)) throw new Error(label + ' must be a portable identifier');
  return normalized;
}

function contract(value, label) {
  const normalized = strictText(value, label, 220);
  if (!CONTRACT.test(normalized)) throw new Error(label + ' must be a portable schema or contract token');
  return normalized;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a sha256 digest');
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(label + ' must be boolean');
  return value;
}

function uniqueSorted(values, label, normalizer, maximum, minimum = 0) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must contain ' + minimum + ' through ' + maximum + ' items');
  }
  const result = values.map((value, index) => normalizer(value, label + '[' + index + ']'))
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  for (let index = 1; index < result.length; index += 1) {
    if (same(result[index - 1], result[index])) throw new Error(label + ' must not contain duplicates');
  }
  return result;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: id(value.id, label + '.id'),
    schema: contract(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function providerSelector(value, label) {
  exactKeys(value, ['id', 'version', 'descriptorSha256'], label);
  const version = strictText(value.version, label + '.version', 80);
  if (!SEMVER.test(version)) throw new Error(label + '.version must be semantic version text');
  return {
    id: id(value.id, label + '.id'),
    version,
    descriptorSha256: digest(value.descriptorSha256, label + '.descriptorSha256')
  };
}

function rootDecision(value, index) {
  const label = 'rootsGate[' + index + ']';
  exactKeys(value, ['root', 'verdict', 'evidenceRefs'], label);
  if (value.root !== ROOTS[index]) throw new Error(label + ' must preserve the ordered four-root gate');
  if (!['PASS', 'HOLD', 'FAIL'].includes(value.verdict)) throw new Error(label + '.verdict is unsupported');
  return {
    root: value.root,
    verdict: value.verdict,
    evidenceRefs: uniqueSorted(value.evidenceRefs, label + '.evidenceRefs', reference, 8, 1)
  };
}

function normalizeResources(value, label) {
  const fields = [
    'maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs',
    'maxProcesses', 'maxAttempts', 'maxCostMinorUnits', 'maxArtifacts',
    'maxSteps', 'maxRequirements', 'maxDependencyDepth'
  ];
  exactKeys(value, fields, label);
  return {
    maxInputBytes: integer(value.maxInputBytes, label + '.maxInputBytes', 1, MAX_REQUEST_BYTES),
    maxOutputBytes: integer(value.maxOutputBytes, label + '.maxOutputBytes', 1, 16 * 1024 * 1024),
    maxMemoryBytes: integer(value.maxMemoryBytes, label + '.maxMemoryBytes', 1, Number.MAX_SAFE_INTEGER),
    maxDurationMs: integer(value.maxDurationMs, label + '.maxDurationMs', 1, Number.MAX_SAFE_INTEGER),
    maxProcesses: integer(value.maxProcesses, label + '.maxProcesses', 1, 1024),
    maxAttempts: integer(value.maxAttempts, label + '.maxAttempts', 1, 1000000),
    maxCostMinorUnits: integer(value.maxCostMinorUnits, label + '.maxCostMinorUnits', 0, Number.MAX_SAFE_INTEGER),
    maxArtifacts: integer(value.maxArtifacts, label + '.maxArtifacts', 1, 64),
    maxSteps: integer(value.maxSteps, label + '.maxSteps', 4, 512),
    maxRequirements: integer(value.maxRequirements, label + '.maxRequirements', 1, 256),
    maxDependencyDepth: integer(value.maxDependencyDepth, label + '.maxDependencyDepth', 1, 16)
  };
}

function normalizePrivacy(value, label) {
  exactKeys(value, [
    'durableEvidence', 'retainRawSource', 'retainStdout', 'retainStderr',
    'retainMachinePaths', 'retainPrivateContent'
  ], label);
  if (value.durableEvidence !== 'DIGESTS_MEASUREMENTS_VERDICTS_AND_LIMITATIONS_ONLY') {
    throw new Error(label + '.durableEvidence exceeds the bounded evidence policy');
  }
  const result = { durableEvidence: value.durableEvidence };
  ['retainRawSource', 'retainStdout', 'retainStderr', 'retainMachinePaths', 'retainPrivateContent']
    .forEach((field) => {
      if (boolean(value[field], label + '.' + field) !== false) {
        throw new Error(label + '.' + field + ' must remain false');
      }
      result[field] = false;
    });
  return result;
}

function normalizeReuseRights(value, label) {
  exactKeys(value, ['state', 'directReuseAllowed', 'authorityRef'], label);
  if (!['DECLARED_REUSE_ALLOWED', 'RESEARCH_ONLY_HOLD', 'UNKNOWN'].includes(value.state)) {
    throw new Error(label + '.state is unsupported');
  }
  const directReuseAllowed = boolean(value.directReuseAllowed, label + '.directReuseAllowed');
  const authorityRef = value.authorityRef == null ? null : reference(value.authorityRef, label + '.authorityRef');
  if (value.state === 'DECLARED_REUSE_ALLOWED') {
    if (!directReuseAllowed || authorityRef === null) {
      throw new Error(label + ' declared reuse requires an exact authority reference');
    }
  } else if (directReuseAllowed || authorityRef !== null) {
    throw new Error(label + ' cannot grant direct reuse while rights are held or unknown');
  }
  return { state: value.state, directReuseAllowed, authorityRef };
}

function normalizeSettings(value) {
  exactKeys(value, [
    'lifecycleTarget', 'aiMode', 'challengerProviderRef', 'allowedPermissions',
    'allowedNetworkDomains', 'allowedMutability', 'allowedSourceUse',
    'resourceEnvelope', 'privacy', 'reuseRights'
  ], 'settings');
  if (!Object.prototype.hasOwnProperty.call(LIFECYCLE_TIERS, value.lifecycleTarget)) {
    throw new Error('settings.lifecycleTarget is unsupported');
  }
  if (!AI_MODES.includes(value.aiMode)) throw new Error('settings.aiMode is unsupported');
  const challengerProviderRef = value.challengerProviderRef == null
    ? null
    : providerSelector(value.challengerProviderRef, 'settings.challengerProviderRef');
  if ((value.aiMode === 'OFF') !== (challengerProviderRef === null)) {
    throw new Error('settings AI mode and exact challenger provider reference disagree');
  }
  return {
    lifecycleTarget: value.lifecycleTarget,
    aiMode: value.aiMode,
    challengerProviderRef,
    allowedPermissions: uniqueSorted(value.allowedPermissions, 'settings.allowedPermissions', id, 64),
    allowedNetworkDomains: uniqueSorted(value.allowedNetworkDomains, 'settings.allowedNetworkDomains', id, 32),
    allowedMutability: uniqueSorted(value.allowedMutability, 'settings.allowedMutability', (item, label) => {
      if (!MUTABILITY.includes(item)) throw new Error(label + ' is unsupported');
      return item;
    }, 3),
    allowedSourceUse: uniqueSorted(value.allowedSourceUse, 'settings.allowedSourceUse', (item, label) => {
      if (!SOURCE_USE.includes(item)) throw new Error(label + ' is unsupported');
      return item;
    }, 4),
    resourceEnvelope: normalizeResources(value.resourceEnvelope, 'settings.resourceEnvelope'),
    privacy: normalizePrivacy(value.privacy, 'settings.privacy'),
    reuseRights: normalizeReuseRights(value.reuseRights, 'settings.reuseRights')
  };
}

function normalizeRequirement(value, index) {
  const label = 'requirements[' + index + ']';
  exactKeys(value, ['id', 'capability', 'inputSchema', 'outputSchema', 'minimumInputArtifacts'], label);
  return {
    id: id(value.id, label + '.id'),
    capability: id(value.capability, label + '.capability'),
    inputSchema: contract(value.inputSchema, label + '.inputSchema'),
    outputSchema: contract(value.outputSchema, label + '.outputSchema'),
    minimumInputArtifacts: integer(value.minimumInputArtifacts, label + '.minimumInputArtifacts', 0, 32)
  };
}

function normalizeClaim(value, artifactIndex, claimIndex) {
  const label = 'artifacts[' + artifactIndex + '].acceptanceClaims[' + claimIndex + ']';
  exactKeys(value, [
    'id', 'kind', 'statement', 'risk', 'verifierRequirementId',
    'evidenceSchema', 'humanJudgmentRequired'
  ], label);
  if (!CLAIM_KINDS.includes(value.kind)) throw new Error(label + '.kind is unsupported');
  if (!RISK_LEVELS.includes(value.risk)) throw new Error(label + '.risk is unsupported');
  const verifierRequirementId = value.verifierRequirementId == null
    ? null
    : id(value.verifierRequirementId, label + '.verifierRequirementId');
  const humanJudgmentRequired = boolean(value.humanJudgmentRequired, label + '.humanJudgmentRequired');
  if (value.kind === 'TASTE_MEANING' && (!humanJudgmentRequired || verifierRequirementId !== null)) {
    throw new Error(label + ' taste or meaning requires a human seat and cannot name a machine verifier');
  }
  if (value.kind !== 'TASTE_MEANING' && verifierRequirementId === null) {
    throw new Error(label + ' requires an exact verifier requirement');
  }
  if (['AUTHORIZATION', 'RESOURCE_SAFETY', 'LEARNING_IMPROVEMENT'].includes(value.kind) && value.risk !== 'HIGH') {
    throw new Error(label + ' must be HIGH risk');
  }
  return {
    id: id(value.id, label + '.id'),
    kind: value.kind,
    statement: strictText(value.statement, label + '.statement', 1000),
    risk: value.risk,
    verifierRequirementId,
    evidenceSchema: contract(value.evidenceSchema, label + '.evidenceSchema'),
    humanJudgmentRequired
  };
}

function normalizeArtifact(value, index) {
  const label = 'artifacts[' + index + ']';
  exactKeys(value, [
    'id', 'domain', 'kind', 'purpose', 'consequenceClass', 'dependsOn',
    'requiredRequirementIds', 'acceptanceClaims'
  ], label);
  if (!Object.prototype.hasOwnProperty.call(CONSEQUENCE_TIERS, value.consequenceClass)) {
    throw new Error(label + '.consequenceClass is unsupported');
  }
  const claims = uniqueSorted(
    value.acceptanceClaims,
    label + '.acceptanceClaims',
    (claim, claimLabel) => normalizeClaim(claim, index, Number(claimLabel.match(/\[(\d+)\]$/)[1])),
    32,
    1
  ).sort((left, right) => compareText(left.id, right.id));
  return {
    id: id(value.id, label + '.id'),
    domain: id(value.domain, label + '.domain'),
    kind: contract(value.kind, label + '.kind'),
    purpose: strictText(value.purpose, label + '.purpose', 1000),
    consequenceClass: value.consequenceClass,
    dependsOn: uniqueSorted(value.dependsOn, label + '.dependsOn', id, 32),
    requiredRequirementIds: uniqueSorted(value.requiredRequirementIds, label + '.requiredRequirementIds', id, 64, 1),
    acceptanceClaims: claims
  };
}

function normalizeRoute(value, index, requirementById) {
  const label = 'routes[' + index + ']';
  exactKeys(value, ['requirementId', 'routePlan'], label);
  const requirementId = id(value.requirementId, label + '.requirementId');
  const requirement = requirementById.get(requirementId);
  if (!requirement) throw new Error(label + ' references an unknown requirement');
  const routePlan = Fabric.normalizeRoutePlan(value.routePlan);
  if (routePlan.request.capability !== requirement.capability ||
    routePlan.request.inputSchema !== requirement.inputSchema ||
    routePlan.request.outputSchema !== requirement.outputSchema) {
    throw new Error(label + ' route request does not match the exact capability contract');
  }
  routePlan.candidates.forEach((candidate) => {
    if (candidate.route.capability !== requirement.capability ||
      candidate.route.inputSchema !== requirement.inputSchema ||
      candidate.route.outputSchema !== requirement.outputSchema ||
      candidate.route.minimumInputArtifacts !== requirement.minimumInputArtifacts) {
      throw new Error(label + ' contains a provider route for a different capability contract');
    }
  });
  return { requirementId, routePlan };
}

function topologicalArtifactOrder(artifacts, maximumDepth) {
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  artifacts.forEach((artifact) => {
    artifact.dependsOn.forEach((dependency) => {
      if (!byId.has(dependency)) throw new Error('artifact ' + artifact.id + ' depends on unknown artifact ' + dependency);
      if (dependency === artifact.id) throw new Error('artifact ' + artifact.id + ' cannot depend on itself');
    });
  });
  const indegree = new Map(artifacts.map((artifact) => [artifact.id, artifact.dependsOn.length]));
  const children = new Map(artifacts.map((artifact) => [artifact.id, []]));
  artifacts.forEach((artifact) => artifact.dependsOn.forEach((dependency) => children.get(dependency).push(artifact.id)));
  children.forEach((values) => values.sort(compareText));
  const ready = artifacts.filter((artifact) => indegree.get(artifact.id) === 0).map((artifact) => artifact.id).sort(compareText);
  const order = [];
  const depth = new Map();
  while (ready.length) {
    const current = ready.shift();
    const artifact = byId.get(current);
    const currentDepth = artifact.dependsOn.length
      ? Math.max(...artifact.dependsOn.map((dependency) => depth.get(dependency))) + 1
      : 1;
    if (currentDepth > maximumDepth) throw new Error('artifact dependency depth exceeds the declared ceiling');
    depth.set(current, currentDepth);
    order.push(current);
    children.get(current).forEach((child) => {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) {
        ready.push(child);
        ready.sort(compareText);
      }
    });
  }
  if (order.length !== artifacts.length) throw new Error('artifact dependency graph contains a cycle');
  return order;
}

function normalizeRequestCore(value) {
  exactKeys(value, REQUEST_CORE_FIELDS, 'bounded creation request core');
  if (value.schema !== REQUEST_SCHEMA) throw new Error('bounded creation request schema mismatch');
  if (value.version !== VERSION) throw new Error('bounded creation request version mismatch');
  if (value.authority !== 'NONE') throw new Error('bounded creation request authority must remain NONE');
  const settings = normalizeSettings(value.settings);
  const requirements = value.requirements.map(normalizeRequirement).sort((left, right) => compareText(left.id, right.id));
  if (!requirements.length || requirements.length > settings.resourceEnvelope.maxRequirements) {
    throw new Error('requirements exceed their declared bounds');
  }
  for (let index = 1; index < requirements.length; index += 1) {
    if (requirements[index - 1].id === requirements[index].id) throw new Error('requirement ids must be unique');
  }
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const artifacts = value.artifacts.map(normalizeArtifact).sort((left, right) => compareText(left.id, right.id));
  if (!artifacts.length || artifacts.length > settings.resourceEnvelope.maxArtifacts) {
    throw new Error('artifacts exceed their declared bounds');
  }
  for (let index = 1; index < artifacts.length; index += 1) {
    if (artifacts[index - 1].id === artifacts[index].id) throw new Error('artifact ids must be unique');
  }
  artifacts.forEach((artifact) => {
    artifact.requiredRequirementIds.forEach((requirementId) => {
      if (!requirementById.has(requirementId)) throw new Error('artifact ' + artifact.id + ' requires unknown requirement ' + requirementId);
    });
    artifact.acceptanceClaims.forEach((claim) => {
      if (claim.verifierRequirementId && !artifact.requiredRequirementIds.includes(claim.verifierRequirementId)) {
        throw new Error('claim ' + claim.id + ' verifier must be listed as an artifact requirement');
      }
    });
  });
  topologicalArtifactOrder(artifacts, settings.resourceEnvelope.maxDependencyDepth);
  const routes = value.routes.map((route, index) => normalizeRoute(route, index, requirementById))
    .sort((left, right) => compareText(left.requirementId, right.requirementId));
  for (let index = 1; index < routes.length; index += 1) {
    if (routes[index - 1].requirementId === routes[index].requirementId) {
      throw new Error('each requirement accepts at most one exact route plan');
    }
  }
  if (routes.length > requirements.length) throw new Error('routes exceed requirement count');
  const usedRequirementIds = new Set(artifacts.flatMap((artifact) => artifact.requiredRequirementIds));
  requirements.forEach((requirement) => {
    if (!usedRequirementIds.has(requirement.id)) throw new Error('unused requirement ' + requirement.id + ' is not allowed');
  });
  routes.forEach((route) => {
    if (!usedRequirementIds.has(route.requirementId)) throw new Error('route for unused requirement is not allowed');
  });
  const stepCount = artifacts.length * STEP_STAGES.length;
  if (stepCount > settings.resourceEnvelope.maxSteps) throw new Error('planned steps exceed the declared ceiling');
  const rootsGate = value.rootsGate.map(rootDecision);
  if (rootsGate.length !== ROOTS.length) throw new Error('rootsGate must contain exactly four ordered decisions');
  const core = {
    schema: REQUEST_SCHEMA,
    version: VERSION,
    id: id(value.id, 'request.id'),
    goal: strictText(value.goal, 'request.goal', 2000),
    artifacts,
    requirements,
    routes,
    settings,
    rootsGate,
    instructionRef: reference(value.instructionRef, 'request.instructionRef'),
    authority: 'NONE'
  };
  if (jsonBytes(core) > settings.resourceEnvelope.maxInputBytes) {
    throw new Error('bounded creation request exceeds its declared input byte ceiling');
  }
  return core;
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  const request = { ...core, requestDigest: sha256Value(core) };
  if (jsonBytes(request) > request.settings.resourceEnvelope.maxInputBytes) {
    throw new Error('sealed bounded creation request exceeds its declared input byte ceiling');
  }
  return request;
}

function normalizeRequest(value) {
  exactKeys(value, [...REQUEST_CORE_FIELDS, 'requestDigest'], 'bounded creation request');
  const core = normalizeRequestCore(Object.fromEntries(REQUEST_CORE_FIELDS.map((field) => [field, value[field]])));
  const requestDigest = digest(value.requestDigest, 'request.requestDigest');
  if (sha256Value(core) !== requestDigest) throw new Error('bounded creation request digest mismatch');
  const normalized = { ...core, requestDigest };
  if (!same(normalized, value)) throw new Error('bounded creation request is not in canonical normalized form');
  return normalized;
}

function subset(values, ceiling) {
  return values.every((value) => ceiling.includes(value));
}

function resourceHolds(routeResources, ceiling) {
  return ['maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs', 'maxProcesses']
    .filter((field) => routeResources[field] > ceiling[field])
    .map((field) => 'RESOURCE_EXCEEDS_' + field.replace(/([A-Z])/g, '_$1').toUpperCase());
}

function routeGapType(status, holds) {
  if (holds.some((hold) => hold.startsWith('AUTHORITY_'))) return 'AUTHORITY';
  if (holds.some((hold) => hold.startsWith('RESOURCE_'))) return 'SUBSTRATE';
  if (status === 'MISSING_ROUTE_PLAN' || status === 'MISSING_HAND') return 'HAND';
  if (['HOST_OBSERVATION_REQUIRED', 'HOST_OBSERVATION_AMBIGUOUS', 'HOST_OBSERVATION_STALE',
    'HOST_OBSERVATION_UNTRUSTED', 'HOST_UNAVAILABLE', 'SELECTED_PROVIDER_STALE',
    'SELECTED_PROVIDER_UNAVAILABLE', 'ASSURANCE_HOLD'].includes(status)) return 'EVIDENCE';
  if (status === 'RESOURCE_HOLD') return 'SUBSTRATE';
  if (status === 'AUTHORITY_HOLD') return 'AUTHORITY';
  return 'CONTRACT';
}

function buildResolution(requirement, route, settings) {
  if (!route) {
    return {
      requirementId: requirement.id,
      capability: requirement.capability,
      routePlanRef: null,
      routeStatus: 'MISSING_ROUTE_PLAN',
      resolutionStatus: 'CAPABILITY_GAP',
      selectedProviderRef: null,
      holds: ['EXACT_ROUTE_PLAN_REQUIRED'],
      gapType: 'HAND',
      inputClaimOnly: true
    };
  }
  const plan = route.routePlan;
  const routePlanRef = {
    id: requirement.id + '-route-plan',
    schema: Fabric.PLAN_SCHEMA,
    sha256: plan.planDigest
  };
  const holds = plan.holds.slice().sort(compareText);
  if (plan.status === 'ROUTE_PLANNED') {
    const authority = plan.plannedEnvelope.authority;
    if (!subset(authority.permissions, settings.allowedPermissions)) holds.push('AUTHORITY_PERMISSION_INTERSECTION_HOLD');
    if (authority.network.mode === 'allowlist' && !subset(authority.network.domains, settings.allowedNetworkDomains)) {
      holds.push('AUTHORITY_NETWORK_INTERSECTION_HOLD');
    }
    if (!settings.allowedMutability.includes(authority.mutability)) holds.push('AUTHORITY_MUTABILITY_INTERSECTION_HOLD');
    if (!settings.allowedSourceUse.includes(authority.sourceUse)) holds.push('AUTHORITY_SOURCE_USE_INTERSECTION_HOLD');
    holds.push(...resourceHolds(plan.plannedEnvelope.resources, settings.resourceEnvelope));
  }
  const normalizedHolds = Array.from(new Set(holds)).sort(compareText);
  const ready = plan.status === 'ROUTE_PLANNED' && normalizedHolds.length === 0;
  return {
    requirementId: requirement.id,
    capability: requirement.capability,
    routePlanRef,
    routeStatus: plan.status,
    resolutionStatus: ready ? 'ROUTE_READY_INPUT_CLAIM' : 'CAPABILITY_GAP',
    selectedProviderRef: plan.selected
      ? { id: plan.selected.id, version: plan.selected.version, descriptorSha256: plan.selected.descriptorSha256 }
      : null,
    holds: normalizedHolds,
    gapType: ready ? null : routeGapType(plan.status, normalizedHolds),
    inputClaimOnly: true
  };
}

function buildGapReport(request, resolutions) {
  const artifactsByRequirement = new Map(request.requirements.map((requirement) => [requirement.id, []]));
  request.artifacts.forEach((artifact) => artifact.requiredRequirementIds.forEach((requirementId) => {
    artifactsByRequirement.get(requirementId).push(artifact.id);
  }));
  const missing = resolutions.filter((resolution) => resolution.resolutionStatus === 'CAPABILITY_GAP');
  const report = {
    schema: GAP_REPORT_SCHEMA,
    overall: missing.length ? 'DEGRADED' : 'READY',
    missingCapabilities: missing.map((resolution) => resolution.requirementId).sort(compareText),
    proposedContracts: missing.map((resolution) => ({
      capabilityId: resolution.requirementId,
      requestedCapability: resolution.capability,
      gapType: resolution.gapType,
      requiredBy: artifactsByRequirement.get(resolution.requirementId).slice().sort(compareText),
      contractState: 'SPEC_REQUIRED',
      requiredFields: REQUIRED_HAND_FIELDS.slice()
    })).sort((left, right) => compareText(left.capabilityId, right.capabilityId)),
    handoff: {
      capability: HandFoundry.CAPABILITY,
      contractRef: {
        id: HandFoundryContract.id,
        schema: MODULE_CONTRACT_SCHEMA,
        sha256: sha256Value(HandFoundryContract)
      },
      automaticSpecification: false
    },
    automaticInstall: false,
    automaticPermission: false,
    automaticQualityReduction: false,
    truth: {
      implementationAvailableForEveryGap: false,
      specificationClosesGap: false,
      unsupportedCapabilityPretendedAvailable: false
    }
  };
  HandFoundry.parseGapReport(report);
  return report;
}

function evidenceRoute(claim) {
  const route = EVIDENCE_ROUTES[claim.kind];
  return {
    claimId: claim.id,
    kind: claim.kind,
    risk: claim.risk,
    verifierRequirementId: claim.verifierRequirementId,
    evidenceSchema: claim.evidenceSchema,
    primarySurface: route[0],
    counterevidence: route[1],
    humanJudgmentRequired: claim.humanJudgmentRequired,
    observedEvidence: [],
    verdict: 'UNKNOWN',
    executionStatus: 'NOT_RUN'
  };
}

function minimumConsentTier(request) {
  return Math.max(
    LIFECYCLE_TIERS[request.settings.lifecycleTarget],
    ...request.artifacts.map((artifact) => CONSEQUENCE_TIERS[artifact.consequenceClass])
  );
}

function buildSteps(request, order, tier) {
  const artifactById = new Map(request.artifacts.map((artifact) => [artifact.id, artifact]));
  const steps = [];
  order.forEach((artifactId) => {
    const artifact = artifactById.get(artifactId);
    const ids = Object.fromEntries(STEP_STAGES.map((stage) => [stage, artifactId + '-' + stage.toLowerCase().replace(/_/g, '-') ]));
    steps.push({
      id: ids.COMPOSE_TYPED_BLUEPRINT,
      artifactId,
      stage: 'COMPOSE_TYPED_BLUEPRINT',
      dependsOnStepIds: artifact.dependsOn.map((dependency) => dependency + '-present-for-human-review').sort(compareText),
      requiredConsentTier: 0,
      executionStatus: 'NOT_RUN',
      authority: 'NONE'
    });
    steps.push({
      id: ids.GENERATE_DETACHED_CANDIDATE,
      artifactId,
      stage: 'GENERATE_DETACHED_CANDIDATE',
      dependsOnStepIds: [ids.COMPOSE_TYPED_BLUEPRINT],
      requiredConsentTier: 1,
      executionStatus: 'NOT_RUN',
      authority: 'NONE'
    });
    steps.push({
      id: ids.GATHER_DOMAIN_NATIVE_EVIDENCE,
      artifactId,
      stage: 'GATHER_DOMAIN_NATIVE_EVIDENCE',
      dependsOnStepIds: [ids.GENERATE_DETACHED_CANDIDATE],
      requiredConsentTier: Math.max(1, Math.min(2, tier)),
      executionStatus: 'NOT_RUN',
      authority: 'NONE'
    });
    steps.push({
      id: ids.PRESENT_FOR_HUMAN_REVIEW,
      artifactId,
      stage: 'PRESENT_FOR_HUMAN_REVIEW',
      dependsOnStepIds: [ids.GATHER_DOMAIN_NATIVE_EVIDENCE],
      requiredConsentTier: tier,
      executionStatus: 'NOT_RUN',
      authority: 'NONE'
    });
  });
  return steps;
}

function chooseStatus(request, resolutions, tier) {
  if (request.rootsGate.some((decision) => decision.verdict !== 'PASS')) return 'ROOTS_HOLD';
  if (resolutions.some((resolution) => resolution.resolutionStatus === 'CAPABILITY_GAP')) return 'CAPABILITY_GAPS';
  if (tier >= 4 && !request.settings.reuseRights.directReuseAllowed) return 'REUSE_RIGHTS_HOLD';
  if (tier > 1) return 'HIGHER_TIER_CONSENT_REQUIRED';
  return 'READY_FOR_DETACHED_CANDIDATE_REQUEST';
}

function nextGate(status) {
  return {
    ROOTS_HOLD: 'REPAIR_ROOT_EVIDENCE_AND_REPLAN',
    CAPABILITY_GAPS: 'SPECIFY_OR_PROVIDE_MISSING_CAPABILITIES_AND_REPLAN',
    REUSE_RIGHTS_HOLD: 'RESOLVE_REUSE_RIGHTS_AND_RECONSENT',
    HIGHER_TIER_CONSENT_REQUIRED: 'NEW_EXACT_HUMAN_CONSENT_REQUIRED',
    READY_FOR_DETACHED_CANDIDATE_REQUEST: 'SEMANTIC_GENERATION_REQUEST_REQUIRED'
  }[status];
}

function programTruth(request) {
  return {
    deterministicPlanOnly: true,
    naturalLanguageSemanticsProven: false,
    routePlanInputsIndependentlyTrusted: false,
    providerDeclarationIsExecutionProof: false,
    hostObservationIsExecutionProof: false,
    unsupportedCapabilityPretendedAvailable: false,
    unknownEvidenceRenderedAsPass: false,
    humanTasteReplacedByScore: false,
    aiInvolvementHidden: false,
    aiOutputTrusted: false,
    providerCalled: false,
    workspaceRead: false,
    sourceBytesRead: false,
    artifactGenerated: false,
    verifierRun: false,
    humanDecisionAuthenticated: false,
    permissionGranted: false,
    networkUsed: false,
    resourceLimitsEnforced: false,
    sandboxExecuted: false,
    persistentLearningAdmitted: false,
    installed: false,
    integrated: false,
    published: false,
    modelTrainingPerformed: false,
    physicalActuationPerformed: false,
    promoted: false,
    canonChanged: false,
    mikeFinalMergeGatePreserved: true,
    challengerMode: request.settings.aiMode
  };
}

function buildProgram(input) {
  const request = normalizeRequest(input);
  const order = topologicalArtifactOrder(request.artifacts, request.settings.resourceEnvelope.maxDependencyDepth);
  const routeByRequirement = new Map(request.routes.map((route) => [route.requirementId, route]));
  const resolutions = request.requirements.map((requirement) => buildResolution(
    requirement,
    routeByRequirement.get(requirement.id),
    request.settings
  ));
  const resolutionById = new Map(resolutions.map((resolution) => [resolution.requirementId, resolution]));
  const artifactById = new Map(request.artifacts.map((artifact) => [artifact.id, artifact]));
  const tier = minimumConsentTier(request);
  const status = chooseStatus(request, resolutions, tier);
  const core = {
    schema: PROGRAM_SCHEMA,
    version: VERSION,
    status,
    requestRef: { id: request.id, schema: REQUEST_SCHEMA, sha256: request.requestDigest },
    scope: {
      domains: Array.from(new Set(request.artifacts.map((artifact) => artifact.domain))).sort(compareText),
      lifecycleTarget: request.settings.lifecycleTarget,
      planningConsentTier: 0,
      minimumNextConsentTier: tier,
      aiMode: request.settings.aiMode,
      challengerProviderRef: request.settings.challengerProviderRef,
      allowedPermissions: request.settings.allowedPermissions.slice(),
      allowedNetworkDomains: request.settings.allowedNetworkDomains.slice(),
      allowedMutability: request.settings.allowedMutability.slice(),
      allowedSourceUse: request.settings.allowedSourceUse.slice(),
      resourceEnvelope: clone(request.settings.resourceEnvelope),
      privacy: clone(request.settings.privacy),
      reuseRights: clone(request.settings.reuseRights),
      rootsGate: clone(request.rootsGate),
      grantsAuthority: false
    },
    artifactOrder: order,
    artifactPlans: order.map((artifactId) => {
      const artifact = artifactById.get(artifactId);
      return {
        artifactId,
        domain: artifact.domain,
        kind: artifact.kind,
        consequenceClass: artifact.consequenceClass,
        dependsOn: artifact.dependsOn.slice(),
        requirementIds: artifact.requiredRequirementIds.slice(),
        capabilityStates: artifact.requiredRequirementIds.map((requirementId) => ({
          requirementId,
          resolutionStatus: resolutionById.get(requirementId).resolutionStatus
        })),
        evidenceRoutes: artifact.acceptanceClaims.map(evidenceRoute)
      };
    }),
    capabilityResolutions: resolutions,
    capabilityGapReport: buildGapReport(request, resolutions),
    steps: buildSteps(request, order, tier),
    nextGate: nextGate(status),
    truth: programTruth(request),
    authority: 'NONE'
  };
  const program = { ...core, programDigest: sha256Value(core) };
  if (jsonBytes(program) > request.settings.resourceEnvelope.maxOutputBytes) {
    throw new Error('bounded creation program exceeds its declared output byte ceiling');
  }
  return program;
}

function normalizeProgram(program) {
  exactKeys(program, [
    'schema', 'version', 'status', 'requestRef', 'scope', 'artifactOrder',
    'artifactPlans', 'capabilityResolutions', 'capabilityGapReport', 'steps',
    'nextGate', 'truth', 'authority', 'programDigest'
  ], 'bounded creation program');
  if (program.schema !== PROGRAM_SCHEMA || program.version !== VERSION) throw new Error('bounded creation program identity mismatch');
  if (!['ROOTS_HOLD', 'CAPABILITY_GAPS', 'REUSE_RIGHTS_HOLD', 'HIGHER_TIER_CONSENT_REQUIRED',
    'READY_FOR_DETACHED_CANDIDATE_REQUEST'].includes(program.status)) throw new Error('bounded creation program status is unsupported');
  if (program.authority !== 'NONE') throw new Error('bounded creation program authority must remain NONE');
  reference(program.requestRef, 'program.requestRef');
  exactKeys(program.scope, [
    'domains', 'lifecycleTarget', 'planningConsentTier', 'minimumNextConsentTier',
    'aiMode', 'challengerProviderRef', 'allowedPermissions', 'allowedNetworkDomains',
    'allowedMutability', 'allowedSourceUse', 'resourceEnvelope', 'privacy',
    'reuseRights', 'rootsGate', 'grantsAuthority'
  ], 'program.scope');
  if (program.scope.planningConsentTier !== 0 || program.scope.grantsAuthority !== false) {
    throw new Error('program scope cannot grant authority');
  }
  if (!Object.prototype.hasOwnProperty.call(LIFECYCLE_TIERS, program.scope.lifecycleTarget)) {
    throw new Error('program scope lifecycle target is invalid');
  }
  if (!AI_MODES.includes(program.scope.aiMode)) throw new Error('program scope AI mode is invalid');
  const normalizedChallenger = program.scope.challengerProviderRef == null
    ? null
    : providerSelector(program.scope.challengerProviderRef, 'program.scope.challengerProviderRef');
  if ((program.scope.aiMode === 'OFF') !== (normalizedChallenger === null)) {
    throw new Error('program scope AI mode and provider reference disagree');
  }
  const normalizedScope = {
    domains: uniqueSorted(program.scope.domains, 'program.scope.domains', id, 64, 1),
    allowedPermissions: uniqueSorted(program.scope.allowedPermissions, 'program.scope.allowedPermissions', id, 64),
    allowedNetworkDomains: uniqueSorted(program.scope.allowedNetworkDomains, 'program.scope.allowedNetworkDomains', id, 32),
    allowedMutability: uniqueSorted(program.scope.allowedMutability, 'program.scope.allowedMutability', (item, label) => {
      if (!MUTABILITY.includes(item)) throw new Error(label + ' is unsupported');
      return item;
    }, 3),
    allowedSourceUse: uniqueSorted(program.scope.allowedSourceUse, 'program.scope.allowedSourceUse', (item, label) => {
      if (!SOURCE_USE.includes(item)) throw new Error(label + ' is unsupported');
      return item;
    }, 4),
    resourceEnvelope: normalizeResources(program.scope.resourceEnvelope, 'program.scope.resourceEnvelope'),
    privacy: normalizePrivacy(program.scope.privacy, 'program.scope.privacy'),
    reuseRights: normalizeReuseRights(program.scope.reuseRights, 'program.scope.reuseRights'),
    rootsGate: program.scope.rootsGate.map(rootDecision)
  };
  if (normalizedScope.rootsGate.length !== ROOTS.length) throw new Error('program scope requires four ordered roots');
  ['domains', 'allowedPermissions', 'allowedNetworkDomains', 'allowedMutability', 'allowedSourceUse',
    'resourceEnvelope', 'privacy', 'reuseRights', 'rootsGate'].forEach((field) => {
    if (!same(program.scope[field], normalizedScope[field])) throw new Error('program scope ' + field + ' is not canonical');
  });
  if (!Array.isArray(program.artifactOrder) || !Array.isArray(program.artifactPlans) ||
    !Array.isArray(program.capabilityResolutions) || !Array.isArray(program.steps)) {
    throw new Error('program bounded collections are malformed');
  }
  const artifactIds = new Set();
  const allRequirementIds = new Set();
  program.artifactPlans.forEach((artifact, index) => {
    exactKeys(artifact, [
      'artifactId', 'domain', 'kind', 'consequenceClass', 'dependsOn',
      'requirementIds', 'capabilityStates', 'evidenceRoutes'
    ], 'program.artifactPlans[' + index + ']');
    artifact.artifactId = id(artifact.artifactId, 'program artifact id');
    artifact.domain = id(artifact.domain, 'program artifact domain');
    artifact.kind = contract(artifact.kind, 'program artifact kind');
    if (!Object.prototype.hasOwnProperty.call(CONSEQUENCE_TIERS, artifact.consequenceClass)) {
      throw new Error('program artifact consequence class is invalid');
    }
    if (artifactIds.has(artifact.artifactId)) throw new Error('program artifact ids must be unique');
    artifactIds.add(artifact.artifactId);
    const dependsOn = uniqueSorted(artifact.dependsOn, 'program artifact dependencies', id, 32);
    const requirementIds = uniqueSorted(artifact.requirementIds, 'program artifact requirements', id, 64, 1);
    if (!same(dependsOn, artifact.dependsOn) || !same(requirementIds, artifact.requirementIds)) {
      throw new Error('program artifact dependencies and requirements must be canonical');
    }
    requirementIds.forEach((requirementId) => allRequirementIds.add(requirementId));
    if (!Array.isArray(artifact.capabilityStates) || artifact.capabilityStates.length !== requirementIds.length) {
      throw new Error('program artifact capability states must cover every requirement once');
    }
    artifact.capabilityStates.forEach((state, stateIndex) => {
      exactKeys(state, ['requirementId', 'resolutionStatus'], 'program capability state ' + stateIndex);
      if (state.requirementId !== requirementIds[stateIndex]) throw new Error('program capability-state order drift');
      if (!['ROUTE_READY_INPUT_CLAIM', 'CAPABILITY_GAP'].includes(state.resolutionStatus)) {
        throw new Error('program capability state is invalid');
      }
    });
    if (!Array.isArray(artifact.evidenceRoutes) || artifact.evidenceRoutes.length < 1 || artifact.evidenceRoutes.length > 32) {
      throw new Error('program artifact evidence routes are unbounded');
    }
    artifact.evidenceRoutes.forEach((route, routeIndex) => {
      exactKeys(route, [
        'claimId', 'kind', 'risk', 'verifierRequirementId', 'evidenceSchema',
        'primarySurface', 'counterevidence', 'humanJudgmentRequired',
        'observedEvidence', 'verdict', 'executionStatus'
      ], 'program evidence route ' + routeIndex);
      if (!Array.isArray(route.observedEvidence) || route.verdict !== 'UNKNOWN' ||
        route.executionStatus !== 'NOT_RUN' || route.observedEvidence.length !== 0) {
        throw new Error('program evidence routes must remain unrun and unknown');
      }
      id(route.claimId, 'program evidence claim id');
      if (!CLAIM_KINDS.includes(route.kind) || !RISK_LEVELS.includes(route.risk)) {
        throw new Error('program evidence route kind or risk is invalid');
      }
      if (!same([route.primarySurface, route.counterevidence], EVIDENCE_ROUTES[route.kind])) {
        throw new Error('program evidence route uses a non-native proof surface');
      }
      contract(route.evidenceSchema, 'program evidence schema');
      if (route.kind === 'TASTE_MEANING') {
        if (route.verifierRequirementId !== null || route.humanJudgmentRequired !== true) {
          throw new Error('program taste route must remain a human judgment');
        }
      } else {
        id(route.verifierRequirementId, 'program verifier requirement id');
        if (!requirementIds.includes(route.verifierRequirementId)) {
          throw new Error('program verifier requirement is outside its artifact boundary');
        }
      }
      if (['AUTHORIZATION', 'RESOURCE_SAFETY', 'LEARNING_IMPROVEMENT'].includes(route.kind) && route.risk !== 'HIGH') {
        throw new Error('program high-risk evidence route was down-labelled');
      }
    });
  });
  if (!same(program.artifactOrder, program.artifactPlans.map((artifact) => artifact.artifactId))) {
    throw new Error('program artifact order and artifact plans disagree');
  }
  const rebuiltOrder = topologicalArtifactOrder(
    program.artifactPlans.map((artifact) => ({ id: artifact.artifactId, dependsOn: artifact.dependsOn })),
    program.scope.resourceEnvelope.maxDependencyDepth
  );
  if (!same(program.artifactOrder, rebuiltOrder)) throw new Error('program artifact order is not deterministic');
  const resolutionsById = new Map();
  program.capabilityResolutions.forEach((resolution, index) => {
    exactKeys(resolution, [
      'requirementId', 'capability', 'routePlanRef', 'routeStatus',
      'resolutionStatus', 'selectedProviderRef', 'holds', 'gapType', 'inputClaimOnly'
    ], 'program.capabilityResolutions[' + index + ']');
    if (resolution.inputClaimOnly !== true) throw new Error('capability resolution must remain an input claim');
    resolution.requirementId = id(resolution.requirementId, 'program resolution requirement id');
    resolution.capability = id(resolution.capability, 'program resolution capability');
    if (resolutionsById.has(resolution.requirementId)) throw new Error('program resolution ids must be unique');
    resolutionsById.set(resolution.requirementId, resolution);
    if (resolution.routePlanRef == null) {
      if (resolution.routeStatus !== 'MISSING_ROUTE_PLAN') throw new Error('missing route reference must remain a missing route plan');
    } else {
      const routeRef = reference(resolution.routePlanRef, 'program resolution routePlanRef');
      if (routeRef.schema !== Fabric.PLAN_SCHEMA || routeRef.id !== resolution.requirementId + '-route-plan') {
        throw new Error('program resolution route reference drift');
      }
    }
    if (resolution.selectedProviderRef !== null) providerSelector(resolution.selectedProviderRef, 'program selected provider');
    const holds = uniqueSorted(resolution.holds, 'program resolution holds', (item, label) => strictText(item, label, 300), 64);
    if (!same(holds, resolution.holds)) throw new Error('program resolution holds are not canonical');
    const expectedReady = resolution.routeStatus === 'ROUTE_PLANNED' && resolution.holds.length === 0;
    if ((resolution.resolutionStatus === 'ROUTE_READY_INPUT_CLAIM') !== expectedReady) {
      throw new Error('program resolution status contradicts route status or holds');
    }
    if (expectedReady) {
      if (resolution.gapType !== null || resolution.selectedProviderRef === null) {
        throw new Error('ready program resolution cannot retain a gap or omit its exact provider');
      }
    } else if (!['HAND', 'SKILL', 'AUTHORITY', 'SUBSTRATE', 'EVIDENCE', 'CONTRACT', 'UNKNOWN'].includes(resolution.gapType)) {
      throw new Error('held program resolution requires a typed gap');
    }
  });
  if (!same(Array.from(resolutionsById.keys()), Array.from(resolutionsById.keys()).slice().sort(compareText))) {
    throw new Error('program capability resolutions are not deterministic');
  }
  if (!same(Array.from(allRequirementIds).sort(compareText), Array.from(resolutionsById.keys()).sort(compareText))) {
    throw new Error('program resolutions do not exactly cover artifact requirements');
  }
  program.artifactPlans.forEach((artifact) => artifact.capabilityStates.forEach((state) => {
    if (resolutionsById.get(state.requirementId).resolutionStatus !== state.resolutionStatus) {
      throw new Error('artifact capability state disagrees with its resolution');
    }
  }));
  program.steps.forEach((step, index) => {
    exactKeys(step, [
      'id', 'artifactId', 'stage', 'dependsOnStepIds', 'requiredConsentTier',
      'executionStatus', 'authority'
    ], 'program.steps[' + index + ']');
    if (step.executionStatus !== 'NOT_RUN' || step.authority !== 'NONE') throw new Error('program steps must remain inert');
  });
  const report = program.capabilityGapReport;
  exactKeys(report, [
    'schema', 'overall', 'missingCapabilities', 'proposedContracts', 'handoff',
    'automaticInstall', 'automaticPermission', 'automaticQualityReduction', 'truth'
  ], 'program.capabilityGapReport');
  HandFoundry.parseGapReport(report);
  const missingResolutions = program.capabilityResolutions.filter((resolution) => resolution.resolutionStatus === 'CAPABILITY_GAP');
  const missingIds = missingResolutions.map((resolution) => resolution.requirementId).sort(compareText);
  if (!same(report.missingCapabilities, missingIds) || report.overall !== (missingIds.length ? 'DEGRADED' : 'READY')) {
    throw new Error('program capability-gap summary contradicts its resolutions');
  }
  if (!Array.isArray(report.proposedContracts) || report.proposedContracts.length !== missingIds.length) {
    throw new Error('program capability-gap contracts do not cover every gap');
  }
  const artifactsByRequirement = new Map(Array.from(resolutionsById.keys()).map((requirementId) => [requirementId, []]));
  program.artifactPlans.forEach((artifact) => artifact.requirementIds.forEach((requirementId) => {
    artifactsByRequirement.get(requirementId).push(artifact.artifactId);
  }));
  report.proposedContracts.forEach((proposed, index) => {
    exactKeys(proposed, [
      'capabilityId', 'requestedCapability', 'gapType', 'requiredBy',
      'contractState', 'requiredFields'
    ], 'program proposed contract ' + index);
    const resolution = resolutionsById.get(proposed.capabilityId);
    if (!resolution || resolution.resolutionStatus !== 'CAPABILITY_GAP' ||
      proposed.requestedCapability !== resolution.capability || proposed.gapType !== resolution.gapType) {
      throw new Error('program proposed contract contradicts its capability resolution');
    }
    if (!same(proposed.requiredBy, artifactsByRequirement.get(proposed.capabilityId).sort(compareText)) ||
      proposed.contractState !== 'SPEC_REQUIRED' || !same(proposed.requiredFields, REQUIRED_HAND_FIELDS)) {
      throw new Error('program proposed contract drifts from the exact Foundry handoff');
    }
  });
  if (!same(report.proposedContracts.map((proposed) => proposed.capabilityId), missingIds)) {
    throw new Error('program proposed contracts are not in deterministic gap order');
  }
  exactKeys(report.handoff, ['capability', 'contractRef', 'automaticSpecification'], 'program gap handoff');
  const handoffRef = reference(report.handoff.contractRef, 'program gap handoff contractRef');
  if (report.handoff.capability !== HandFoundry.CAPABILITY || report.handoff.automaticSpecification !== false ||
    handoffRef.id !== HandFoundryContract.id || handoffRef.schema !== MODULE_CONTRACT_SCHEMA ||
    handoffRef.sha256 !== sha256Value(HandFoundryContract)) {
    throw new Error('program Hand Specification Foundry handoff drift');
  }
  if (report.automaticInstall !== false || report.automaticPermission !== false || report.automaticQualityReduction !== false) {
    throw new Error('program capability-gap report cannot grant automatic authority or weaken quality');
  }
  exactKeys(report.truth, [
    'implementationAvailableForEveryGap', 'specificationClosesGap',
    'unsupportedCapabilityPretendedAvailable'
  ], 'program gap truth');
  if (Object.values(report.truth).some((value) => value !== false)) throw new Error('program capability-gap truth inflation');
  const truth = program.truth;
  exactKeys(truth, [
    'deterministicPlanOnly', 'naturalLanguageSemanticsProven',
    'routePlanInputsIndependentlyTrusted', 'providerDeclarationIsExecutionProof',
    'hostObservationIsExecutionProof', 'unsupportedCapabilityPretendedAvailable',
    'unknownEvidenceRenderedAsPass', 'humanTasteReplacedByScore',
    'aiInvolvementHidden', 'aiOutputTrusted', 'providerCalled', 'workspaceRead',
    'sourceBytesRead', 'artifactGenerated', 'verifierRun',
    'humanDecisionAuthenticated', 'permissionGranted', 'networkUsed',
    'resourceLimitsEnforced', 'sandboxExecuted', 'persistentLearningAdmitted',
    'installed', 'integrated', 'published', 'modelTrainingPerformed',
    'physicalActuationPerformed', 'promoted', 'canonChanged',
    'mikeFinalMergeGatePreserved', 'challengerMode'
  ], 'program.truth');
  Object.keys(truth).forEach((field) => {
    if (field === 'challengerMode') {
      if (!AI_MODES.includes(truth[field])) throw new Error('program truth challenger mode is invalid');
    } else {
      const expected = field === 'deterministicPlanOnly' || field === 'mikeFinalMergeGatePreserved';
      if (truth[field] !== expected) throw new Error('program truth ceiling violated at ' + field);
    }
  });
  if (truth.challengerMode !== program.scope.aiMode) throw new Error('program challenger truth and scope disagree');
  const derivedTier = Math.max(
    LIFECYCLE_TIERS[program.scope.lifecycleTarget],
    ...program.artifactPlans.map((artifact) => CONSEQUENCE_TIERS[artifact.consequenceClass])
  );
  if (program.scope.minimumNextConsentTier !== derivedTier) throw new Error('program minimum consent tier drift');
  const expectedStatus = program.scope.rootsGate.some((decision) => decision.verdict !== 'PASS')
    ? 'ROOTS_HOLD'
    : missingIds.length
      ? 'CAPABILITY_GAPS'
      : derivedTier >= 4 && !program.scope.reuseRights.directReuseAllowed
        ? 'REUSE_RIGHTS_HOLD'
        : derivedTier > 1
          ? 'HIGHER_TIER_CONSENT_REQUIRED'
          : 'READY_FOR_DETACHED_CANDIDATE_REQUEST';
  if (program.status !== expectedStatus) throw new Error('program status contradicts roots, gaps, rights, or consent tier');
  const expectedSteps = buildSteps({
    artifacts: program.artifactPlans.map((artifact) => ({
      id: artifact.artifactId,
      dependsOn: artifact.dependsOn
    }))
  }, program.artifactOrder, derivedTier);
  if (!same(program.steps, expectedSteps)) throw new Error('program step graph or consent tiers drifted');
  const programDigest = digest(program.programDigest, 'program.programDigest');
  const core = clone(program);
  delete core.programDigest;
  if (sha256Value(core) !== programDigest) throw new Error('bounded creation program digest mismatch');
  if (program.nextGate !== nextGate(program.status)) throw new Error('program next gate conflicts with status');
  if (jsonBytes(program) > program.scope.resourceEnvelope.maxOutputBytes) {
    throw new Error('bounded creation program exceeds its declared output byte ceiling');
  }
  return clone(program);
}

function verifyProgram(program, input) {
  const errors = [];
  try {
    const normalized = normalizeProgram(program);
    const rebuilt = buildProgram(input);
    if (!same(normalized, rebuilt)) throw new Error('bounded creation program differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  VERSION,
  REQUEST_SCHEMA,
  PROGRAM_SCHEMA,
  GAP_REPORT_SCHEMA,
  ROOTS,
  LIFECYCLE_TIERS,
  CONSEQUENCE_TIERS,
  CLAIM_KINDS,
  REQUIRED_HAND_FIELDS,
  STEP_STAGES,
  MAX_REQUEST_BYTES,
  canonicalJson,
  sha256Value,
  jsonBytes,
  sealRequest,
  normalizeRequest,
  normalizeProgram,
  buildProgram,
  verifyProgram,
  clone
};
