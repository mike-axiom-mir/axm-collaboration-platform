'use strict';

const crypto = require('crypto');

const ORGAN_ID = 'axm.mirror.organ/game-tester-mission-compiler-v1';
const REQUEST_SCHEMA = 'axm.mirror.game-tester-mission-request/v1';
const PLAN_SCHEMA = 'axm.mirror.game-tester-mission-plan/v1';
const EVIDENCE_SCHEMA = 'axm.mirror.game-tester-evidence-return/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.game-tester-evidence-assessment/v1';
const SPECIALIST_ID = 'game-tester-mirror';
const PARENT_IDENTITY = 'axm.machine.mirror/seed-0';

const REQUIRED_CAPABILITIES = Object.freeze([
  'failure.evidence.append-only',
  'game.control.external.execute.authority-gated',
  'game.runtime.launch.authority-gated',
  'game.state.external.observe',
  'game.target.manifest.bind',
  'specialist.evidence.handoff.typed',
  'visual.capture.ephemeral-rolling-buffer',
  'visual.capture.live.authority-gated',
  'visual.proof.typed'
]);
const AUTHORITY_GATED_CAPABILITIES = new Set([
  'game.control.external.execute.authority-gated',
  'game.runtime.launch.authority-gated',
  'visual.capture.live.authority-gated'
]);
const RESULT_STATES = Object.freeze(['PASS', 'FAIL', 'UNKNOWN', 'CONTRADICTORY', 'NOT_APPLICABLE', 'NOT_RUN']);
const FORBIDDEN_AUTHORITY = Object.freeze([
  'parentMirrorWrite', 'testedTargetSourceWrite', 'testedTargetPersistentStateWrite',
  'permissionGrant', 'releaseDecision', 'promotion', 'canonChange', 'externalNetwork'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function boundedText(value, label, maximum, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum || /[\u0000-\u001f]/.test(value)) throw new Error(`${label} is invalid`);
  return value.trim();
}
function identifier(value, label, maximum = 120) {
  const result = boundedText(value, label, maximum, 2);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(result) || result.includes('..')) throw new Error(`${label} is invalid`);
  return result;
}
function sha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new Error(`${label} requires sha256`);
  return value;
}
function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its bound`);
  return value;
}
function uniqueStrings(value, label, allowed, minimum = 0, maximum = 16) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some(item => typeof item !== 'string' || !allowed.includes(item)) || new Set(value).size !== value.length) throw new Error(`${label} is invalid`);
  return value.slice();
}
function seal(value, idField, digestField, prefix) {
  value[idField] = `${prefix}-${digest(Object.assign({}, value, { [idField]: null, [digestField]: null })).slice(0, 24)}`;
  value[digestField] = digest(Object.assign({}, value, { [digestField]: null }));
  return stable(value);
}
function verifySeal(value, idField, digestField, prefix) {
  const expectedId = `${prefix}-${digest(Object.assign({}, value, { [idField]: null, [digestField]: null })).slice(0, 24)}`;
  const expectedDigest = digest(Object.assign({}, value, { [digestField]: null }));
  if (value[idField] !== expectedId || value[digestField] !== expectedDigest) throw new Error(`${prefix} content address changed`);
}

function normalizeEvidenceRefs(value, label, minimum = 1, maximum = 32) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new Error(`${label} is outside its bound`);
  const seen = new Set();
  return value.map((row, index) => {
    exactKeys(row, ['id', 'digest', 'kind'], `${label}[${index}]`);
    const id = identifier(row.id, `${label}[${index}].id`, 160);
    if (seen.has(id)) throw new Error(`${label} contains a duplicate id`);
    seen.add(id);
    if (!['MANIFEST', 'CONTRACT', 'LINEAGE', 'TEST', 'FRAME_SEQUENCE', 'STATE_RECEIPT', 'CONSOLE_TRACE', 'NETWORK_TRACE', 'ACCESSIBILITY_REPORT', 'HUMAN_REVIEW'].includes(row.kind)) throw new Error(`${label}[${index}].kind is invalid`);
    return { id, digest: sha(row.digest, `${label}[${index}].digest`), kind: row.kind };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeProviders(value) {
  if (!Array.isArray(value) || value.length > 32) throw new Error('providers is outside its bound');
  const seen = new Set();
  return value.map((row, index) => {
    exactKeys(row, ['capabilityId', 'providerId', 'providerDigest', 'declarationState', 'verificationState', 'authorityGateState', 'evidenceRefs'], `providers[${index}]`);
    const capabilityId = identifier(row.capabilityId, `providers[${index}].capabilityId`, 160);
    if (!REQUIRED_CAPABILITIES.includes(capabilityId) || seen.has(capabilityId)) throw new Error(`providers[${index}] capability is unknown or duplicate`);
    seen.add(capabilityId);
    if (!['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN'].includes(row.declarationState)) throw new Error(`providers[${index}].declarationState is invalid`);
    if (!['PASS_INDEPENDENT', 'PASS_SAME_BUILDER', 'FAIL', 'NOT_RUN'].includes(row.verificationState)) throw new Error(`providers[${index}].verificationState is invalid`);
    if (!['VERIFIED_EXTERNAL_GATE', 'UNVERIFIED_EXTERNAL_GATE', 'NOT_REQUIRED'].includes(row.authorityGateState)) throw new Error(`providers[${index}].authorityGateState is invalid`);
    if (AUTHORITY_GATED_CAPABILITIES.has(capabilityId) === (row.authorityGateState === 'NOT_REQUIRED')) throw new Error(`providers[${index}] authority gate classification changed`);
    return {
      capabilityId,
      providerId: identifier(row.providerId, `providers[${index}].providerId`, 160),
      providerDigest: sha(row.providerDigest, `providers[${index}].providerDigest`),
      declarationState: row.declarationState,
      verificationState: row.verificationState,
      authorityGateState: row.authorityGateState,
      evidenceRefs: normalizeEvidenceRefs(row.evidenceRefs, `providers[${index}].evidenceRefs`)
    };
  }).sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
}

function normalizeCases(value, budget) {
  if (!Array.isArray(value) || value.length < 1 || value.length > budget.maxCases) throw new Error('cases is outside its bound');
  const caseIds = new Set();
  let totalSteps = 0;
  return value.map((testCase, caseIndex) => {
    exactKeys(testCase, ['caseId', 'purpose', 'resetBefore', 'steps', 'observations'], `cases[${caseIndex}]`);
    const caseId = identifier(testCase.caseId, `cases[${caseIndex}].caseId`, 100);
    if (caseIds.has(caseId)) throw new Error('cases contains a duplicate caseId');
    caseIds.add(caseId);
    if (typeof testCase.resetBefore !== 'boolean') throw new Error(`cases[${caseIndex}].resetBefore is invalid`);
    if (!Array.isArray(testCase.observations) || testCase.observations.length < 1 || testCase.observations.length > 16) throw new Error(`cases[${caseIndex}].observations is outside its bound`);
    const observationIds = new Set();
    const observations = testCase.observations.map((observation, observationIndex) => {
      exactKeys(observation, ['observationId', 'claimKind', 'statement', 'evidenceKinds'], `cases[${caseIndex}].observations[${observationIndex}]`);
      const observationId = identifier(observation.observationId, `cases[${caseIndex}].observations[${observationIndex}].observationId`, 120);
      if (observationIds.has(observationId)) throw new Error(`cases[${caseIndex}] contains a duplicate observationId`);
      observationIds.add(observationId);
      if (!['APPEARANCE', 'INTERACTION', 'STATE', 'PERSISTENCE', 'ACCESSIBILITY', 'MOTION', 'CONSOLE', 'NETWORK'].includes(observation.claimKind)) throw new Error(`cases[${caseIndex}].observations[${observationIndex}].claimKind is invalid`);
      return {
        observationId,
        claimKind: observation.claimKind,
        statement: boundedText(observation.statement, `cases[${caseIndex}].observations[${observationIndex}].statement`, 1000),
        evidenceKinds: uniqueStrings(observation.evidenceKinds, `cases[${caseIndex}].observations[${observationIndex}].evidenceKinds`, ['FRAME_SEQUENCE', 'STATE_RECEIPT', 'CONSOLE_TRACE', 'NETWORK_TRACE', 'ACCESSIBILITY_REPORT', 'HUMAN_REVIEW'], 1, 6)
      };
    });
    if (!Array.isArray(testCase.steps) || testCase.steps.length > 32) throw new Error(`cases[${caseIndex}].steps is outside its bound`);
    totalSteps += testCase.steps.length;
    if (totalSteps > budget.maxSteps) throw new Error('cases exceed maxSteps');
    const stepIds = new Set();
    const steps = testCase.steps.map((step, stepIndex) => {
      exactKeys(step, ['stepId', 'controlKind', 'action', 'value', 'maxDurationMs', 'expectedObservationIds'], `cases[${caseIndex}].steps[${stepIndex}]`);
      const stepId = identifier(step.stepId, `cases[${caseIndex}].steps[${stepIndex}].stepId`, 120);
      if (stepIds.has(stepId)) throw new Error(`cases[${caseIndex}] contains a duplicate stepId`);
      stepIds.add(stepId);
      if (!['KEYBOARD', 'GAMEPAD', 'POINTER', 'WAIT', 'RESET_REQUEST'].includes(step.controlKind)) throw new Error(`cases[${caseIndex}].steps[${stepIndex}].controlKind is invalid`);
      if (step.value !== null && !['string', 'number', 'boolean'].includes(typeof step.value)) throw new Error(`cases[${caseIndex}].steps[${stepIndex}].value must be scalar or null`);
      const expectedObservationIds = step.expectedObservationIds.map(item => identifier(item, 'expectedObservationId', 120));
      if (new Set(expectedObservationIds).size !== expectedObservationIds.length || expectedObservationIds.some(item => !observationIds.has(item))) throw new Error(`cases[${caseIndex}].steps[${stepIndex}] references an unknown or duplicate observation`);
      return {
        stepId,
        controlKind: step.controlKind,
        action: boundedText(step.action, `cases[${caseIndex}].steps[${stepIndex}].action`, 240),
        value: step.value,
        maxDurationMs: integer(step.maxDurationMs, `cases[${caseIndex}].steps[${stepIndex}].maxDurationMs`, 0, 60000),
        expectedObservationIds
      };
    });
    return { caseId, purpose: boundedText(testCase.purpose, `cases[${caseIndex}].purpose`, 500), resetBefore: testCase.resetBefore, steps, observations };
  });
}

function normalizeRequest(input) {
  exactKeys(input, ['schema', 'requestId', 'requestDigest', 'clone', 'target', 'cases', 'providers', 'budget', 'requestedAuthority', 'humanRendering'], 'game tester mission request');
  if (input.schema !== REQUEST_SCHEMA) throw new Error('game tester mission request schema changed');
  exactKeys(input.clone, ['specialistId', 'instanceId', 'parentIdentity', 'disposable', 'automaticReturnPath'], 'clone');
  if (input.clone.specialistId !== SPECIALIST_ID || input.clone.parentIdentity !== PARENT_IDENTITY || input.clone.disposable !== true || input.clone.automaticReturnPath !== false) throw new Error('game tester clone boundary changed');
  exactKeys(input.target, ['targetId', 'targetDigest', 'kind', 'entrypoint', 'sourceWriteAllowed', 'persistentStateWriteAllowed', 'ephemeralRuntimeMutationExpected', 'resetStrategy', 'evidenceRefs'], 'target');
  if (!['BROWSER_GAME', 'NATIVE_GAME', 'DECLARATIVE_FIXTURE'].includes(input.target.kind)) throw new Error('target kind is unsupported');
  if (input.target.sourceWriteAllowed !== false || input.target.persistentStateWriteAllowed !== false || typeof input.target.ephemeralRuntimeMutationExpected !== 'boolean') throw new Error('tested target write boundary changed');
  if (!['RESET_TO_DECLARED_FIXTURE', 'RESTART_DISPOSABLE_RUNTIME', 'CALLER_MANAGED_NO_RESET'].includes(input.target.resetStrategy)) throw new Error('target reset strategy is unsupported');
  exactKeys(input.budget, ['maxCases', 'maxSteps', 'maxDurationMs', 'maxFrames', 'maxEvidenceBytes', 'maxNetworkBytes'], 'budget');
  const budget = {
    maxCases: integer(input.budget.maxCases, 'budget.maxCases', 1, 16),
    maxSteps: integer(input.budget.maxSteps, 'budget.maxSteps', 0, 128),
    maxDurationMs: integer(input.budget.maxDurationMs, 'budget.maxDurationMs', 1000, 600000),
    maxFrames: integer(input.budget.maxFrames, 'budget.maxFrames', 0, 256),
    maxEvidenceBytes: integer(input.budget.maxEvidenceBytes, 'budget.maxEvidenceBytes', 0, 67108864),
    maxNetworkBytes: integer(input.budget.maxNetworkBytes, 'budget.maxNetworkBytes', 0, 16777216)
  };
  exactKeys(input.requestedAuthority, ['launchDisposableRuntime', 'observeTarget', 'ephemeralControl', 'loopbackNetwork', ...FORBIDDEN_AUTHORITY], 'requestedAuthority');
  for (const [key, value] of Object.entries(input.requestedAuthority)) {
    if (typeof value !== 'boolean') throw new Error(`requestedAuthority.${key} is invalid`);
    if (FORBIDDEN_AUTHORITY.includes(key) && value !== false) throw new Error(`requestedAuthority.${key} is refused`);
  }
  const normalized = {
    schema: REQUEST_SCHEMA,
    requestId: input.requestId,
    requestDigest: input.requestDigest,
    clone: { specialistId: SPECIALIST_ID, instanceId: identifier(input.clone.instanceId, 'clone.instanceId', 120), parentIdentity: PARENT_IDENTITY, disposable: true, automaticReturnPath: false },
    target: {
      targetId: identifier(input.target.targetId, 'target.targetId', 160),
      targetDigest: sha(input.target.targetDigest, 'target.targetDigest'),
      kind: input.target.kind,
      entrypoint: boundedText(input.target.entrypoint, 'target.entrypoint', 500),
      sourceWriteAllowed: false,
      persistentStateWriteAllowed: false,
      ephemeralRuntimeMutationExpected: input.target.ephemeralRuntimeMutationExpected,
      resetStrategy: input.target.resetStrategy,
      evidenceRefs: normalizeEvidenceRefs(input.target.evidenceRefs, 'target.evidenceRefs')
    },
    cases: normalizeCases(input.cases, budget),
    providers: normalizeProviders(input.providers),
    budget,
    requestedAuthority: clone(input.requestedAuthority),
    humanRendering: boundedText(input.humanRendering, 'humanRendering', 2000, 0)
  };
  return stable(normalized);
}

function sealRequest(input) {
  const normalized = normalizeRequest(Object.assign({}, clone(input), { requestId: null, requestDigest: null }));
  return seal(normalized, 'requestId', 'requestDigest', 'game-tester-mission-request');
}
function verifyRequest(input) {
  const normalized = normalizeRequest(input);
  verifySeal(normalized, 'requestId', 'requestDigest', 'game-tester-mission-request');
  if (!same(normalized, input)) throw new Error('game tester mission request normalization changed');
  return true;
}

function providerFindings(providers) {
  const byCapability = new Map(providers.map(row => [row.capabilityId, row]));
  const findings = [];
  for (const capabilityId of REQUIRED_CAPABILITIES) {
    const provider = byCapability.get(capabilityId);
    if (!provider) findings.push({ code: 'MISSING_PROVIDER_DECLARATION', capabilityId, severity: 'HOLD', detail: 'No provider declaration was supplied.' });
    else if (provider.declarationState === 'UNAVAILABLE') findings.push({ code: 'PROVIDER_UNAVAILABLE', capabilityId, severity: 'HOLD', detail: 'The declared provider is unavailable.' });
    else if (provider.declarationState === 'UNKNOWN') findings.push({ code: 'PROVIDER_UNKNOWN', capabilityId, severity: 'HOLD', detail: 'The provider state is unknown.' });
    else if (provider.declarationState === 'DEGRADED') findings.push({ code: 'PROVIDER_DEGRADED', capabilityId, severity: 'HOLD', detail: 'The provider is degraded.' });
    else if (provider.verificationState !== 'PASS_INDEPENDENT') findings.push({ code: 'PROVIDER_NOT_INDEPENDENTLY_VERIFIED', capabilityId, severity: 'HOLD', detail: 'Available is only a declaration until independent verification passes.' });
    if (provider && AUTHORITY_GATED_CAPABILITIES.has(capabilityId) && provider.authorityGateState !== 'VERIFIED_EXTERNAL_GATE') findings.push({ code: 'EXTERNAL_AUTHORITY_GATE_NOT_VERIFIED', capabilityId, severity: 'HOLD', detail: 'The mission compiler cannot grant or inherit this external authority.' });
  }
  return findings;
}
function planState(findings) {
  if (findings.some(row => row.code === 'PROVIDER_UNAVAILABLE' || row.code === 'MISSING_PROVIDER_DECLARATION')) return 'HOLD_MISSING_CAPABILITY';
  if (findings.some(row => row.code === 'PROVIDER_UNKNOWN')) return 'HOLD_UNKNOWN_CAPABILITY';
  if (findings.some(row => row.code === 'PROVIDER_DEGRADED' || row.code === 'PROVIDER_NOT_INDEPENDENTLY_VERIFIED')) return 'HOLD_UNVERIFIED_OR_DEGRADED_PROVIDER';
  if (findings.some(row => row.code === 'EXTERNAL_AUTHORITY_GATE_NOT_VERIFIED')) return 'HOLD_EXTERNAL_AUTHORITY_GATE';
  return 'PROPOSAL_ONLY_READY_FOR_INDEPENDENT_EXECUTOR_REVIEW';
}
function compileMission(request) {
  verifyRequest(request);
  const findings = providerFindings(request.providers);
  const state = planState(findings);
  const totalSteps = request.cases.reduce((sum, row) => sum + row.steps.length, 0);
  const totalObservations = request.cases.reduce((sum, row) => sum + row.observations.length, 0);
  const plan = {
    schema: PLAN_SCHEMA,
    planId: null,
    planDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    source: { requestId: request.requestId, requestDigest: request.requestDigest, specialistId: SPECIALIST_ID, instanceId: request.clone.instanceId, targetId: request.target.targetId, targetDigest: request.target.targetDigest },
    state,
    findings,
    execution: { target: clone(request.target), cases: clone(request.cases), providers: clone(request.providers), budget: clone(request.budget), requestedAuthority: clone(request.requestedAuthority), authorityTransferred: false, executableCodeGenerated: false },
    evidenceContract: { schema: EVIDENCE_SCHEMA, allowedResultStates: RESULT_STATES.slice(), rawVisualMaterialAllowed: false, failureErasureAllowed: false, independentVerificationRequiredForCapabilityClaims: true, humanQualityReviewRequiredForFunFairnessAndValue: true },
    counts: { cases: request.cases.length, steps: totalSteps, observations: totalObservations, providerDeclarations: request.providers.length, holds: findings.length, externalActions: 0, targetSourceWrites: 0, targetPersistentStateWrites: 0, parentMirrorWrites: 0, permissionGrants: 0, releaseDecisions: 0, canonChanges: 0 },
    authority: { compileMission: true, launchRuntime: false, observeTarget: false, executeControl: false, useNetwork: false, writeTargetSource: false, writeTargetPersistentState: false, writeParentMirror: false, grantPermission: false, decideRelease: false, promote: false, changeCanon: false, worldAction: false },
    nextGate: state === 'PROPOSAL_ONLY_READY_FOR_INDEPENDENT_EXECUTOR_REVIEW' ? 'INDEPENDENT_EXECUTOR_MUST_REVERIFY_TARGET_PROVIDER_BYTES_AUTHORITY_AND_BUDGET_BEFORE_ACTION' : 'RESOLVE_NAMED_HOLDS_WITH_CURRENT_PROVIDER_EVIDENCE',
    boundary: 'This TEST component compiles one bounded proposal for the outward Game Tester Mirror. It does not launch a game, observe a target, execute input, use a network, grant or inherit authority, retain raw visuals, edit the tested target, write parent Mirror, decide release, promote, change CANON, certify fun, or act. Provider availability and evidence remain externally supplied claims until independently reverified.'
  };
  return seal(plan, 'planId', 'planDigest', 'game-tester-mission-plan');
}
function verifyPlan(plan, request = null) {
  exactKeys(plan, ['schema', 'planId', 'planDigest', 'organ', 'source', 'state', 'findings', 'execution', 'evidenceContract', 'counts', 'authority', 'nextGate', 'boundary'], 'game tester mission plan');
  if (plan.schema !== PLAN_SCHEMA || plan.organ.id !== ORGAN_ID || plan.organ.status !== 'TEST' || plan.organ.body !== 'DETERMINISTIC_KERNEL' || plan.organ.learnedWeights !== false) throw new Error('game tester mission plan identity changed');
  if (!['HOLD_MISSING_CAPABILITY', 'HOLD_UNKNOWN_CAPABILITY', 'HOLD_UNVERIFIED_OR_DEGRADED_PROVIDER', 'HOLD_EXTERNAL_AUTHORITY_GATE', 'PROPOSAL_ONLY_READY_FOR_INDEPENDENT_EXECUTOR_REVIEW'].includes(plan.state)) throw new Error('game tester mission plan state changed');
  if (plan.execution.authorityTransferred !== false || plan.execution.executableCodeGenerated !== false || plan.evidenceContract.rawVisualMaterialAllowed !== false || plan.evidenceContract.failureErasureAllowed !== false) throw new Error('game tester mission plan boundary changed');
  if (!plan.authority || plan.authority.compileMission !== true || Object.entries(plan.authority).some(([key, value]) => key === 'compileMission' ? value !== true : value !== false)) throw new Error('game tester mission plan gained authority');
  for (const key of ['externalActions', 'targetSourceWrites', 'targetPersistentStateWrites', 'parentMirrorWrites', 'permissionGrants', 'releaseDecisions', 'canonChanges']) if (plan.counts[key] !== 0) throw new Error('game tester mission plan action count changed');
  verifySeal(plan, 'planId', 'planDigest', 'game-tester-mission-plan');
  if (request) {
    verifyRequest(request);
    const expected = compileMission(request);
    if (!same(plan, expected)) throw new Error('game tester mission plan no longer matches its request');
  }
  return true;
}

function sealEvidenceReturn(input) {
  const value = clone(input);
  exactKeys(value, ['schema', 'returnId', 'returnDigest', 'plan', 'executor', 'target', 'caseResults', 'cleanup', 'counts', 'authority', 'boundary'], 'game tester evidence return');
  if (value.schema !== EVIDENCE_SCHEMA) throw new Error('game tester evidence return schema changed');
  exactKeys(value.plan, ['planId', 'planDigest'], 'evidence plan');
  exactKeys(value.executor, ['executorId', 'relationToCompiler', 'authorityLeaseDigest', 'authorityVerifiedBy'], 'evidence executor');
  exactKeys(value.target, ['targetId', 'targetDigestBefore', 'targetDigestAfter', 'sourceTreeUnchanged', 'persistentStateUnchanged'], 'evidence target');
  exactKeys(value.cleanup, ['complete', 'rawVisualBytesRetained', 'rawVisualItemsRetained'], 'evidence cleanup');
  exactKeys(value.counts, ['externalActions', 'targetSourceWrites', 'targetPersistentStateWrites', 'parentMirrorWrites', 'permissionGrants', 'releaseDecisions', 'canonChanges'], 'evidence counts');
  exactKeys(value.authority, ['evidenceAdmission', 'releaseDecision', 'promotion', 'permissionGrant', 'canonChange', 'parentMirrorWrite'], 'evidence authority');
  identifier(value.plan.planId, 'evidence planId', 160); sha(value.plan.planDigest, 'evidence planDigest');
  identifier(value.executor.executorId, 'evidence executorId', 160);
  if (!['INDEPENDENT', 'SAME_BUILDER', 'UNKNOWN'].includes(value.executor.relationToCompiler)) throw new Error('evidence executor relation is invalid');
  if (value.executor.authorityLeaseDigest !== null) sha(value.executor.authorityLeaseDigest, 'evidence authorityLeaseDigest');
  if (value.executor.authorityVerifiedBy !== null) identifier(value.executor.authorityVerifiedBy, 'evidence authorityVerifiedBy', 160);
  identifier(value.target.targetId, 'evidence targetId', 160); sha(value.target.targetDigestBefore, 'evidence targetDigestBefore'); sha(value.target.targetDigestAfter, 'evidence targetDigestAfter');
  if (typeof value.target.sourceTreeUnchanged !== 'boolean' || typeof value.target.persistentStateUnchanged !== 'boolean' || typeof value.cleanup.complete !== 'boolean') throw new Error('evidence target or cleanup state is invalid');
  integer(value.cleanup.rawVisualBytesRetained, 'rawVisualBytesRetained', 0, 67108864); integer(value.cleanup.rawVisualItemsRetained, 'rawVisualItemsRetained', 0, 256);
  if (!Array.isArray(value.caseResults) || value.caseResults.length < 1 || value.caseResults.length > 16) throw new Error('caseResults is outside its bound');
  const caseIds = new Set();
  value.caseResults = value.caseResults.map((row, index) => {
    exactKeys(row, ['caseId', 'state', 'evidenceRefs', 'findingCodes'], `caseResults[${index}]`);
    const caseId = identifier(row.caseId, `caseResults[${index}].caseId`, 100);
    if (caseIds.has(caseId) || !RESULT_STATES.includes(row.state)) throw new Error('caseResults contains a duplicate id or invalid state');
    caseIds.add(caseId);
    if (!Array.isArray(row.findingCodes) || row.findingCodes.length > 32 || row.findingCodes.some(item => typeof item !== 'string' || !/^[A-Z0-9_:-]{2,120}$/.test(item)) || new Set(row.findingCodes).size !== row.findingCodes.length) throw new Error(`caseResults[${index}].findingCodes is invalid`);
    return { caseId, state: row.state, evidenceRefs: normalizeEvidenceRefs(row.evidenceRefs, `caseResults[${index}].evidenceRefs`, row.state === 'NOT_RUN' ? 0 : 1), findingCodes: row.findingCodes.slice().sort() };
  }).sort((left, right) => left.caseId.localeCompare(right.caseId));
  for (const key of Object.keys(value.counts)) integer(value.counts[key], `evidence counts.${key}`, 0, 1000000);
  if (Object.values(value.authority).some(item => item !== false)) throw new Error('game tester evidence return cannot claim authority');
  value.boundary = boundedText(value.boundary, 'evidence boundary', 2000);
  value.returnId = null; value.returnDigest = null;
  return seal(stable(value), 'returnId', 'returnDigest', 'game-tester-evidence-return');
}
function verifyEvidenceReturn(value) {
  const resealed = sealEvidenceReturn(Object.assign({}, clone(value), { returnId: null, returnDigest: null }));
  if (!same(resealed, value)) throw new Error('game tester evidence return content address changed');
  return true;
}

function assessEvidenceReturn(plan, evidence) {
  verifyPlan(plan); verifyEvidenceReturn(evidence);
  if (evidence.plan.planId !== plan.planId || evidence.plan.planDigest !== plan.planDigest || evidence.target.targetId !== plan.source.targetId || evidence.target.targetDigestBefore !== plan.source.targetDigest) throw new Error('game tester evidence return source binding changed');
  const expectedCaseIds = plan.execution.cases.map(row => row.caseId).sort();
  if (!same(evidence.caseResults.map(row => row.caseId).sort(), expectedCaseIds)) throw new Error('game tester evidence return case coverage changed');
  const boundaryBreaches = [];
  if (evidence.target.targetDigestAfter !== evidence.target.targetDigestBefore || evidence.target.sourceTreeUnchanged !== true || evidence.counts.targetSourceWrites !== 0) boundaryBreaches.push('TESTED_TARGET_SOURCE_CHANGED');
  if (evidence.target.persistentStateUnchanged !== true || evidence.counts.targetPersistentStateWrites !== 0) boundaryBreaches.push('TESTED_TARGET_PERSISTENT_STATE_CHANGED');
  if (evidence.counts.parentMirrorWrites !== 0) boundaryBreaches.push('PARENT_MIRROR_WRITE_REPORTED');
  if (evidence.counts.permissionGrants !== 0 || evidence.counts.releaseDecisions !== 0 || evidence.counts.canonChanges !== 0) boundaryBreaches.push('FORBIDDEN_AUTHORITY_EFFECT_REPORTED');
  if (evidence.cleanup.complete !== true || evidence.cleanup.rawVisualBytesRetained !== 0 || evidence.cleanup.rawVisualItemsRetained !== 0) boundaryBreaches.push('RAW_VISUAL_CLEANUP_INCOMPLETE');
  const states = evidence.caseResults.map(row => row.state);
  let state = 'PASS_REPORTED_NOT_RELEASE_AUTHORITY';
  if (boundaryBreaches.length) state = 'REFUSED_BOUNDARY_BREACH';
  else if (states.includes('CONTRADICTORY')) state = 'CONTRADICTORY_PRESERVED';
  else if (states.includes('FAIL')) state = 'FAIL_PRESERVED';
  else if (states.some(item => item === 'UNKNOWN' || item === 'NOT_RUN')) state = 'UNKNOWN_PRESERVED';
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    assessmentId: null,
    assessmentDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, independentExecutorIdentityCertified: false },
    source: { planId: plan.planId, planDigest: plan.planDigest, returnId: evidence.returnId, returnDigest: evidence.returnDigest },
    state,
    boundaryBreaches,
    summary: { cases: states.length, passed: states.filter(item => item === 'PASS').length, failed: states.filter(item => item === 'FAIL').length, unknown: states.filter(item => item === 'UNKNOWN').length, contradictory: states.filter(item => item === 'CONTRADICTORY').length, notApplicable: states.filter(item => item === 'NOT_APPLICABLE').length, notRun: states.filter(item => item === 'NOT_RUN').length, rawVisualBytesRetained: evidence.cleanup.rawVisualBytesRetained, parentMirrorWrites: evidence.counts.parentMirrorWrites, targetSourceWrites: evidence.counts.targetSourceWrites, releaseDecisions: evidence.counts.releaseDecisions },
    authority: { assessDeclaredEvidence: true, certifyExecutorIdentity: false, certifyEvidenceTruth: false, evidenceAdmission: false, decideRelease: false, promote: false, grantPermission: false, writeTarget: false, writeParentMirror: false, changeCanon: false, worldAction: false },
    nextGate: state === 'PASS_REPORTED_NOT_RELEASE_AUTHORITY' ? 'INDEPENDENT_HUMAN_OR_MACHINE_REVIEW_MAY_DECIDE_WHAT_THE_EVIDENCE_MEANS' : 'PRESERVE_THIS_RESULT_AND_RESOLVE_THE_NAMED_FAILURE_UNKNOWN_CONTRADICTION_OR_BOUNDARY_BREACH',
    boundary: 'This TEST assessment verifies the typed return shape, content address, exact plan binding, case coverage, reported cleanup, and zero-write counters. It does not prove the executor identity, evidence truth, visual quality, fun, fairness, accessibility, target behavior, permission, release readiness, promotion, or CANON.'
  };
  return seal(assessment, 'assessmentId', 'assessmentDigest', 'game-tester-evidence-assessment');
}
function verifyAssessment(assessment, plan = null, evidence = null) {
  exactKeys(assessment, ['schema', 'assessmentId', 'assessmentDigest', 'organ', 'source', 'state', 'boundaryBreaches', 'summary', 'authority', 'nextGate', 'boundary'], 'game tester evidence assessment');
  if (assessment.schema !== ASSESSMENT_SCHEMA || assessment.organ.id !== ORGAN_ID || assessment.organ.status !== 'TEST' || assessment.organ.learnedWeights !== false || assessment.organ.independentExecutorIdentityCertified !== false) throw new Error('game tester evidence assessment identity changed');
  if (!assessment.authority || assessment.authority.assessDeclaredEvidence !== true || Object.entries(assessment.authority).some(([key, value]) => key === 'assessDeclaredEvidence' ? value !== true : value !== false)) throw new Error('game tester evidence assessment gained authority');
  verifySeal(assessment, 'assessmentId', 'assessmentDigest', 'game-tester-evidence-assessment');
  if (plan || evidence) {
    if (!plan || !evidence || !same(assessment, assessEvidenceReturn(plan, evidence))) throw new Error('game tester evidence assessment no longer matches its sources');
  }
  return true;
}

module.exports = {
  ORGAN_ID, REQUEST_SCHEMA, PLAN_SCHEMA, EVIDENCE_SCHEMA, ASSESSMENT_SCHEMA,
  SPECIALIST_ID, PARENT_IDENTITY, REQUIRED_CAPABILITIES, RESULT_STATES,
  stable, digest, same, sealRequest, verifyRequest, compileMission, verifyPlan,
  sealEvidenceReturn, verifyEvidenceReturn, assessEvidenceReturn, verifyAssessment
};
