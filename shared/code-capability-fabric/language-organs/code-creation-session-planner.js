'use strict';

const crypto = require('crypto');
const registry = require('./registry.js');
const discovery = require('./code-native-discovery-seam.js');
const disciplines = require('./human-discipline-perspective-fabric.js');
const cheatcodes = require('./machine-cheatcode-fabric.js');
const prebuild = require('./code-prebuild-twin.js');
const keyboard = require('./machine-code-keyboard-router.js');
const admission = require('./code-candidate-admission-ground.js');
const dock = require('./code-work-context-dock.js');
const production = require('./code-production-draft-fabric.js');
const productionBudget = require('./code-production-budget.js');
const productionContext = require('./code-production-work-context-bridge.js');
const buildWindow = require('./code-artifact-build-window.js');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.code.creation-session-request.v1';
const ROOT_GATE_SCHEMA = 'axm.code.four-root-technical-gate.v1';
const PLAN_SCHEMA = 'axm.code.creation-session-plan.v1';
const ROOTS = Object.freeze([
  'truth',
  'agency-non-domination',
  'continuity',
  'wisdom-over-speed'
]);
const ROOT_STATES = new Set(['PASS', 'HOLD', 'FAIL']);
const OBSERVATION_FIELDS = Object.freeze([
  'goals', 'capabilities', 'gaps', 'constraints', 'risks', 'requirements',
  'paths', 'notes', 'pressures', 'signals', 'factCodes',
  'requestedPerspectives', 'roleIds', 'domainOverlays',
  'optionalRolePerspectives'
]);
const REQUEST_KEYS = new Set([
  'schema', 'version', 'projectId', 'goal', 'primaryLanguageId',
  'primaryRole', 'activeLanguageIds', 'preferredLanguageIds', 'roleBindings',
  'intent', 'observation', 'direction', 'production'
]);
const AUTHORITY = Object.freeze({
  workspaceRead: false,
  workspaceMutation: false,
  sourceGeneration: false,
  candidateExecution: false,
  toolExecution: false,
  providerCall: false,
  network: false,
  install: false,
  deployment: false,
  merge: false,
  promotion: false,
  canon: false
});

function canon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canon(value[key])}`).join(',')}}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(canon(value)).digest('hex');
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label}_MUST_BE_PLAIN_OBJECT`);
  }
  return value;
}

function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error(`${label}_UNKNOWN_FIELDS:${unknown.sort().join(',')}`);
}

function text(value, label, maximum = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label}_INVALID`);
  }
  return value.trim();
}

function id(value, label) {
  const normalized = text(value, label, 128).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(normalized)) throw new Error(`${label}_INVALID`);
  return normalized;
}

function strings(value, label, maximum = 128) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label}_INVALID`);
  const out = value.map((entry, index) => text(entry, `${label}_${index}`, 4000));
  return [...new Set(out)];
}

function ids(value, label, maximum = 128) {
  return strings(value, label, maximum).map((entry, index) => id(entry, `${label}_${index}`));
}

function jsonClone(value, label) {
  let encoded;
  try { encoded = JSON.stringify(value); }
  catch (_) { throw new Error(`${label}_NOT_JSON`); }
  if (encoded === undefined || encoded.length > 1024 * 1024) throw new Error(`${label}_NOT_BOUNDED_JSON`);
  const cloned = JSON.parse(encoded);
  if (canon(cloned) !== canon(value)) throw new Error(`${label}_JSON_LOSS`);
  return cloned;
}

function normalizeRoleBindings(value) {
  if (value == null) return {};
  plain(value, 'ROLE_BINDINGS');
  if (Object.keys(value).length > 32) throw new Error('ROLE_BINDINGS_TOO_MANY');
  return Object.fromEntries(Object.keys(value).sort().map(role => [
    id(role, 'ROLE_BINDING_ROLE'),
    id(value[role], `ROLE_BINDING_LANGUAGE_${role}`)
  ]));
}

function normalizeObservation(value) {
  if (value == null) value = {};
  plain(value, 'OBSERVATION');
  exactKeys(value, new Set(OBSERVATION_FIELDS), 'OBSERVATION');
  return Object.fromEntries(OBSERVATION_FIELDS.map(field => [field, strings(value[field], `OBSERVATION_${field}`, 256)]));
}

function normalizeDirection(value) {
  if (value == null) value = {};
  plain(value, 'DIRECTION');
  const allowed = new Set(['actorClass', 'title', 'directionalPrompt', 'roadmap', 'steps', 'constraints', 'sourceLinks']);
  exactKeys(value, allowed, 'DIRECTION');
  const actorClass = String(value.actorClass || 'UNKNOWN').toUpperCase();
  if (!['HUMAN', 'AI', 'MACHINE', 'UNKNOWN'].includes(actorClass)) throw new Error('DIRECTION_ACTOR_CLASS_INVALID');
  const steps = value.steps == null ? [] : jsonClone(value.steps, 'DIRECTION_STEPS');
  if (!Array.isArray(steps) || steps.length > 64) throw new Error('DIRECTION_STEPS_INVALID');
  return {
    actorClass,
    title: value.title == null ? null : text(value.title, 'DIRECTION_TITLE', 400),
    directionalPrompt: value.directionalPrompt == null ? null : text(value.directionalPrompt, 'DIRECTION_PROMPT', 4000),
    roadmap: strings(value.roadmap, 'DIRECTION_ROADMAP'),
    steps,
    constraints: strings(value.constraints, 'DIRECTION_CONSTRAINTS'),
    sourceLinks: strings(value.sourceLinks, 'DIRECTION_SOURCE_LINKS')
  };
}

function normalizeProduction(value) {
  plain(value, 'PRODUCTION');
  exactKeys(value, new Set(['draftCount', 'variantAxes', 'budgetCeilings']), 'PRODUCTION');
  if (!Number.isInteger(value.draftCount) || value.draftCount < 1 || value.draftCount > 16) {
    throw new Error('PRODUCTION_DRAFT_COUNT_INVALID');
  }
  const variantAxes = value.variantAxes == null ? [] : jsonClone(value.variantAxes, 'PRODUCTION_VARIANT_AXES');
  if (!Array.isArray(variantAxes) || variantAxes.length > 16) throw new Error('PRODUCTION_VARIANT_AXES_INVALID');
  const budgetCeilings = jsonClone(plain(value.budgetCeilings, 'PRODUCTION_BUDGET_CEILINGS'), 'PRODUCTION_BUDGET_CEILINGS');
  return { draftCount: value.draftCount, variantAxes, budgetCeilings };
}

function createRequest(input = {}) {
  plain(input, 'REQUEST');
  exactKeys(input, REQUEST_KEYS, 'REQUEST');
  if (input.schema != null && input.schema !== REQUEST_SCHEMA) throw new Error('REQUEST_SCHEMA_INVALID');
  if (input.version != null && input.version !== VERSION) throw new Error('REQUEST_VERSION_INVALID');
  const primaryLanguageId = id(input.primaryLanguageId, 'PRIMARY_LANGUAGE_ID');
  const activeLanguageIds = ids(input.activeLanguageIds, 'ACTIVE_LANGUAGE_IDS');
  const preferredLanguageIds = ids(input.preferredLanguageIds, 'PREFERRED_LANGUAGE_IDS');
  const core = {
    schema: REQUEST_SCHEMA,
    version: VERSION,
    projectId: id(input.projectId, 'PROJECT_ID'),
    goal: text(input.goal, 'GOAL'),
    primaryLanguageId,
    primaryRole: input.primaryRole == null ? null : id(input.primaryRole, 'PRIMARY_ROLE'),
    activeLanguageIds,
    preferredLanguageIds,
    roleBindings: normalizeRoleBindings(input.roleBindings),
    intent: id(input.intent || 'build', 'INTENT'),
    observation: normalizeObservation(input.observation),
    direction: normalizeDirection(input.direction),
    production: normalizeProduction(input.production)
  };
  return freeze({ ...core, requestSha256: hash(core) });
}

function requestCurrent(request) {
  if (!request || request.schema !== REQUEST_SCHEMA || request.version !== VERSION || !request.requestSha256) return false;
  const core = { ...request };
  const digest = core.requestSha256;
  delete core.requestSha256;
  return hash(core) === digest;
}

function evaluateRootGate({ request, roots } = {}) {
  if (!requestCurrent(request)) throw new Error('ROOT_GATE_REQUEST_INVALID_OR_STALE');
  if (!Array.isArray(roots) || roots.length !== ROOTS.length) throw new Error('ROOT_GATE_EXACTLY_FOUR_ROOTS_REQUIRED');
  const normalized = roots.map((entry, index) => {
    plain(entry, `ROOT_GATE_${index}`);
    exactKeys(entry, new Set(['root', 'status', 'evidenceDigest', 'reasonCodes']), `ROOT_GATE_${index}`);
    if (entry.root !== ROOTS[index]) throw new Error(`ROOT_GATE_ORDER_OR_ID_INVALID:${index}`);
    const status = String(entry.status || '').toUpperCase();
    if (!ROOT_STATES.has(status)) throw new Error(`ROOT_GATE_STATUS_INVALID:${entry.root}`);
    if (typeof entry.evidenceDigest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(entry.evidenceDigest)) {
      throw new Error(`ROOT_GATE_EVIDENCE_DIGEST_INVALID:${entry.root}`);
    }
    return { root: entry.root, status, evidenceDigest: entry.evidenceDigest, reasonCodes: ids(entry.reasonCodes, `ROOT_GATE_REASON_${entry.root}`, 32) };
  });
  const result = normalized.some(entry => entry.status === 'FAIL')
    ? 'ROOT_GATE_FAIL'
    : normalized.some(entry => entry.status === 'HOLD')
      ? 'ROOT_GATE_HOLD'
      : 'ROOT_GATE_PASS';
  const core = {
    schema: ROOT_GATE_SCHEMA,
    version: VERSION,
    requestSha256: request.requestSha256,
    result,
    roots: normalized,
    truth: {
      rootsPrecedeCreationComposition: true,
      holdOrFailCannotBeClickedIntoPass: true,
      suppliedEvidenceDigestsAreBindingsNotIndependentProof: true,
      passIsNotMergePromotionOrCanon: true,
      mikeFinalMergeGatePreserved: true
    },
    authority: AUTHORITY
  };
  return freeze({ ...core, gateSha256: hash(core) });
}

function gateCurrent(gate, request) {
  if (!gate || gate.schema !== ROOT_GATE_SCHEMA || gate.version !== VERSION || gate.requestSha256 !== request.requestSha256 || !gate.gateSha256) return false;
  const core = { ...gate };
  const digest = core.gateSha256;
  delete core.gateSha256;
  return hash(core) === digest;
}

function held(result, request, rootGate, detail = {}) {
  const core = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    result,
    requestSha256: request && request.requestSha256 || null,
    rootGateSha256: rootGate && rootGate.gateSha256 || null,
    ...detail,
    truth: {
      compositionHeld: true,
      sourceGenerated: false,
      candidateExecuted: false,
      workspaceMutated: false,
      providerCalled: false,
      installed: false,
      promoted: false,
      canonChanged: false
    },
    authority: AUTHORITY
  };
  return freeze({ ...core, planSha256: hash(core) });
}

function plan({ request, rootGate } = {}) {
  if (!requestCurrent(request)) return held('REQUEST_INVALID_OR_STALE', request, rootGate);
  if (!gateCurrent(rootGate, request)) return held('ROOT_GATE_INVALID_OR_STALE', request, rootGate);
  if (rootGate.result !== 'ROOT_GATE_PASS') return held('ROOT_GATE_BLOCKED_CREATION', request, rootGate, { rootGateResult: rootGate.result });

  const organ = registry.getByLanguageId(request.primaryLanguageId);
  if (!organ) return held('EXPLICIT_PRIMARY_LANGUAGE_UNKNOWN', request, rootGate, { primaryLanguageId: request.primaryLanguageId });
  if (request.primaryRole && request.roleBindings[request.primaryRole] !== request.primaryLanguageId) {
    return held('PRIMARY_ROLE_LANGUAGE_BINDING_REQUIRED', request, rootGate, {
      primaryRole: request.primaryRole,
      primaryLanguageId: request.primaryLanguageId,
      observedBinding: request.roleBindings[request.primaryRole] || null
    });
  }

  const observation = {
    ...request.observation,
    activeLanguages: request.activeLanguageIds
  };
  const direction = dock.createDirection({
    projectId: request.projectId,
    actorClass: request.direction.actorClass,
    title: request.direction.title || `Creation plan for ${request.projectId}`,
    goal: request.goal,
    directionalPrompt: request.direction.directionalPrompt,
    roadmap: request.direction.roadmap.length ? request.direction.roadmap : ['route', 'draft', 'verify', 'review'],
    steps: request.direction.steps.length ? request.direction.steps : [
      { id: 'route', title: 'Resolve bounded language and build route' },
      { id: 'draft', title: 'Prepare detached editable draft slots', dependsOn: ['route'] },
      { id: 'verify', title: 'Gather domain-native evidence externally', dependsOn: ['draft'] },
      { id: 'review', title: 'Return candidates and dissent for human review', dependsOn: ['verify'] }
    ],
    constraints: [...request.direction.constraints, 'no automatic source mutation', 'no execution or promotion from this plan'],
    sourceLinks: request.direction.sourceLinks
  });
  if (!direction.validation.usable) return held('WORK_DIRECTION_INVALID', request, rootGate, { direction });

  const organPlan = registry.plan({ organId: organ.organId });
  const grammarPlan = registry.grammarPlan({ languageId: organ.languageId, operation: request.intent });
  const discoveryReport = discovery.review(observation);
  const disciplinePlan = disciplines.compose({
    languageId: organ.languageId,
    observation: { ...observation, signals: request.observation.signals },
    intent: request.intent,
    topDisciplines: 4,
    templateTopN: 3
  });
  const cheatcodeEvaluation = cheatcodes.evaluate({ languageId: organ.languageId, observation });
  const prebuildPlan = prebuild.buildPlan({
    goal: request.goal,
    activeLanguageIds: request.activeLanguageIds,
    preferredLanguageIds: request.preferredLanguageIds,
    roleBindings: request.roleBindings,
    observation,
    topRecipes: 1
  });
  const keyboardLayout = keyboard.layout({
    languageId: organ.languageId,
    prebuildPlan,
    role: request.primaryRole,
    intent: request.intent,
    signals: request.observation.signals
  });
  const admissionPolicy = admission.buildPolicy({ languageId: organ.languageId, mode: 'GUARDED', existingTests: false });

  const analysis = { organPlan, grammarPlan, discoveryReport, disciplinePlan, cheatcodeEvaluation, prebuildPlan, keyboardLayout, admissionPolicy };
  if (prebuildPlan.result !== 'PREBUILD_TWIN_READY' || !prebuildPlan.simulation || !prebuildPlan.simulation.sourceGenerationReady) {
    return held('PREBUILD_BINDINGS_OR_ROUTES_HELD', request, rootGate, { direction, analysis });
  }
  if (keyboardLayout.result !== 'MACHINE_KEYBOARD_READY') {
    return held('MACHINE_KEYBOARD_LAYOUT_HELD', request, rootGate, { direction, analysis });
  }

  const batch = production.createBatch({
    projectId: request.projectId,
    direction,
    draftCount: request.production.draftCount,
    languageId: organ.languageId,
    prebuildPlan,
    role: request.primaryRole,
    intent: request.intent,
    signals: request.observation.signals,
    variantAxes: request.production.variantAxes
  });
  if (batch.result !== 'PRODUCTION_BATCH_READY') return held('PRODUCTION_BATCH_HELD', request, rootGate, { direction, analysis, batch });
  const draftSet = production.spawnDrafts(batch);
  const budget = productionBudget.createBudget({ batch, ceilings: request.production.budgetCeilings, label: 'creation-session' });
  if (budget.result !== 'PRODUCTION_BUDGET_READY') return held('PRODUCTION_BUDGET_HELD', request, rootGate, { direction, analysis, batch, draftSet, budget });
  const budgetStatus = productionBudget.assessBudget({ batch, budget, drafts: draftSet.drafts, currentDirection: direction });
  if (budgetStatus.result !== 'PRODUCTION_WORK_WITHIN_BUDGET') {
    return held('INITIAL_PRODUCTION_BUDGET_HELD', request, rootGate, { direction, analysis, batch, draftSet, budget, budgetStatus });
  }
  const windowState = buildWindow.buildState({
    sessionId: `creation-${request.projectId}`,
    actor: request.direction.actorClass,
    goal: request.goal,
    prebuildPlan,
    keyboardLayout,
    notes: ['Plan only. No source was generated or executed.']
  });
  const contextCard = productionContext.buildProductionContextCard({
    direction,
    currentStepId: 'route',
    buildWindowState: windowState,
    batch,
    drafts: draftSet.drafts,
    selection: null,
    budgetStatus
  });

  const core = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    result: 'CREATION_SESSION_PLAN_READY_NO_EXECUTION',
    requestSha256: request.requestSha256,
    rootGateSha256: rootGate.gateSha256,
    direction,
    selectedLanguage: {
      selectionMode: 'CALLER_EXPLICIT',
      languageId: organ.languageId,
      organId: organ.organId,
      organSha256: organ.sha256,
      execution: organ.execution
    },
    analysis,
    production: { batch, draftSet, budget, budgetStatus, windowState, contextCard },
    deferredSeams: {
      renderer: 'RENDERER_ADAPTER_AND_EXACT_EDIT_PROGRAM_REQUIRED',
      developerRelationship: 'CALLER_SUPPLIED_RELATIONSHIP_OBSERVATION_REQUIRED_AFTER_RENDER',
      reasoningProbe: 'TRACE_EVIDENCE_REQUIRED_AFTER_A_CREATION_ATTEMPT',
      sandbox: 'EXACT_ARTIFACT_AND_SEPARATELY_AUTHORIZED_ENFORCED_EXECUTOR_REQUIRED',
      admission: 'CANDIDATE_DIGEST_AND_DOMAIN_NATIVE_OBSERVATIONS_REQUIRED',
      integration: 'SEPARATE_MIKE_DECISION_REQUIRED'
    },
    truth: {
      fourRootsPassedForExactRequest: true,
      languageSelectedExplicitlyByCaller: true,
      all102OrgansAvailableAsAlternativesNotAutoActivated: true,
      machineGuidanceIsNotCorrectnessProof: true,
      draftsAreEmptyEditableSlotsNotGeneratedPrograms: true,
      sourceGenerated: false,
      candidateExecuted: false,
      workspaceMutated: false,
      providerCalled: false,
      networkUsed: false,
      installed: false,
      merged: false,
      promoted: false,
      canonChanged: false,
      mikeFinalMergeGatePreserved: true
    },
    authority: AUTHORITY
  };
  return freeze({ ...core, planSha256: hash(core) });
}

function verifyPlan(planValue, request, rootGate) {
  const rebuilt = plan({ request, rootGate });
  return freeze({
    schema: 'axm.code.creation-session-plan-verification.v1',
    result: planValue && planValue.planSha256 === rebuilt.planSha256 && canon(planValue) === canon(rebuilt)
      ? 'PLAN_VERIFIED_EXACT'
      : 'PLAN_VERIFICATION_FAILED',
    expectedPlanSha256: rebuilt.planSha256,
    observedPlanSha256: planValue && planValue.planSha256 || null,
    authority: 'NONE'
  });
}

function snapshot() {
  const core = {
    schema: 'axm.code.creation-session-planner-snapshot.v1',
    version: VERSION,
    rootOrder: ROOTS,
    organRegistrySha256: registry.snapshot().snapshotSha256,
    grammarRegistrySha256: registry.grammarSnapshot().snapshotSha256,
    cheatcodeFabricSha256: cheatcodes.snapshot().snapshotSha256,
    prebuildTwinSha256: prebuild.snapshot().snapshotSha256,
    productionDraftSha256: production.snapshot().snapshotSha256,
    productionBudgetSha256: productionBudget.snapshot().snapshotSha256,
    buildWindowSha256: buildWindow.snapshot().snapshotSha256,
    authority: AUTHORITY
  };
  return freeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = Object.freeze({
  VERSION,
  REQUEST_SCHEMA,
  ROOT_GATE_SCHEMA,
  PLAN_SCHEMA,
  ROOTS,
  AUTHORITY,
  canon,
  hash,
  createRequest,
  evaluateRootGate,
  plan,
  verifyPlan,
  snapshot
});

