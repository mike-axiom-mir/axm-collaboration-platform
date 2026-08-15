'use strict';

const State = require('../kernel/state-language');
const Grid = require('../kernel/bounded-grid-curriculum-cell');
const Environment = require('../kernel/declarative-environment-adapter');
const Search = require('../kernel/bounded-state-search-cell');
const Replay = require('./bounded-environment-replay-organ');

const RESPONSE_SCHEMA = 'axm.mirror.bounded-grid-curriculum-response/v1';
const ORGAN_ID = 'axm.mirror.bounded-grid-curriculum-organ/v1';
const RISK = Object.freeze({ low: 0, medium: 1, high: 2, severe: 3 });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fact(observation, factId) { return observation.facts.find(row => row.id === factId) || null; }
function allApplied(receipts) { return receipts.every(receipt => receipt.status === 'APPLIED'); }
function actionRequest(actionId, actor, permissions, consentEvidenceRefs, prefix) {
  return { schema: Environment.ACTION_REQUEST_SCHEMA, requestId: `${prefix}-${actionId}`, actor, actionId, permissions: permissions.slice().sort(), consentEvidenceRefs: (consentEvidenceRefs || []).slice().sort() };
}
function planningProblem(adapter, problemId, target, actor, permissions, algorithm = 'DIJKSTRA') {
  return adapter.toSearchProblem({
    problemId,
    actor,
    permissions,
    goal: { predicates: [{ factId: 'actor.position', operator: 'EQUALS', value: target }] },
    search: { algorithm, maxNodeExpansions: 50000, maxDepth: 48, maxWallTimeMs: 5000, beamWidth: 32 },
    previousFailure: null
  });
}
function navigate(adapter, target, actor, permissions, prefix) {
  const search = Search.run(planningProblem(adapter, `${prefix}-problem`, target, actor, permissions));
  Search.verify(search);
  if (!search.plan) return { adapter, search, receipts: [], state: 'HOLD_NO_NAVIGATION_PLAN' };
  const receipts = search.plan.actionIds.map((actionId, index) => adapter.step(actionRequest(actionId, actor, permissions, [], `${prefix}-${index + 1}`)));
  return { adapter, search, receipts, state: allApplied(receipts) ? 'PASS' : 'FAIL_TRANSITION_REJECTED' };
}
function seal(response) {
  const basis = Object.assign({}, response, { responseId: null, responseDigest: null });
  response.responseDigest = State.digest(basis, 64);
  response.responseId = `bounded-grid-curriculum-${State.digest({ compilationDigest: response.source.compilationDigest, responseDigest: response.responseDigest })}`;
  return response;
}
function exam(state, evidence, seam = null) { return { state, evidence, seam }; }

function run(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bounded grid curriculum request must be an object');
  const unknown = Object.keys(input).filter(key => !['world'].includes(key));
  if (unknown.length) throw new Error(`bounded grid curriculum request has unknown critical fields: ${unknown.join(', ')}`);
  const at = String(options.at || '1970-01-01T00:00:00.000Z');
  const compilation = Grid.compile(input.world);
  Grid.verify(compilation);
  const world = compilation.world;
  const declaration = compilation.declaration;
  const actorDeclaration = world.actors.find(row => row.kind === 'MACHINE');
  const actor = { id: actorDeclaration.id, kind: 'MACHINE' };
  const ordinaryPermissions = ['fixture:grid-step'];
  const observationPermissions = ['fixture:grid-step', world.observations.hiddenObstacle.observationPermission].sort();
  const activeGoal = world.goals.find(row => row.id === world.activeGoalId);
  const laterGoal = world.goals.find(row => row.version > activeGoal.version) || world.goals.find(row => row.id !== activeGoal.id);

  const observationAdapter = Environment.create(declaration);
  const initialObservation = observationAdapter.observe({ actor, permissions: ordinaryPermissions });
  const inspectionNavigation = navigate(observationAdapter, world.observations.hiddenObstacle.inspectFrom[0], actor, observationPermissions, 'inspection-navigation');
  const inspectionReceipt = observationAdapter.step(actionRequest(`inspect-hidden-obstacle-from-${world.observations.hiddenObstacle.inspectFrom[0].replace(',', '-')}`, actor, observationPermissions, [], 'inspection'));
  const correctedObservation = observationAdapter.observe({ actor, permissions: ordinaryPermissions });
  const initialActual = fact(initialObservation, 'hidden-obstacle.actual-present');
  const correctedBelief = fact(correctedObservation, 'hidden-obstacle.belief-present');
  const disproof = fact(correctedObservation, 'high-confidence-observation.disproven');
  const sourceReliabilities = world.observations.sources.map(source => ({ sourceId: source.id, reliability: fact(initialObservation, `source.${source.id}.reliability`).value, claimObstaclePresent: fact(initialObservation, `source.${source.id}.claim-obstacle-present`).value, sourceRef: fact(initialObservation, `source.${source.id}.ref`).value }));
  const observationPass = initialActual && initialActual.observation === 'HELD_HIDDEN' && initialActual.status === 'UNKNOWN' && inspectionNavigation.state === 'PASS' && inspectionReceipt.status === 'APPLIED' && correctedBelief && correctedBelief.status === 'KNOWN' && correctedBelief.value === world.observations.hiddenObstacle.present && disproof && disproof.value === true;

  const objectAdapter = Environment.create(declaration);
  const crateStart = world.movableObjects[0].start; const cratePoint = crateStart.split(',').map(Number); const pushFrom = `${cratePoint[0] - 1},${cratePoint[1]}`; const pushTo = `${cratePoint[0] + 1},${cratePoint[1]}`;
  const objectNavigation = navigate(objectAdapter, pushFrom, actor, ordinaryPermissions, 'object-navigation');
  const pushActionId = `push-${pushFrom.replace(',', '-')}-via-${crateStart.replace(',', '-')}-to-${pushTo.replace(',', '-')}`;
  const beforePush = objectAdapter.observe({ actor, permissions: ordinaryPermissions });
  const pushReceipt = objectAdapter.step(actionRequest(pushActionId, actor, ordinaryPermissions, [], 'object-push'));
  const afterPush = objectAdapter.observe({ actor, permissions: ordinaryPermissions });
  const objectPass = objectNavigation.state === 'PASS' && pushReceipt.status === 'APPLIED' && fact(afterPush, 'object.position').value === pushTo && fact(afterPush, 'actor.energy').value < fact(beforePush, 'actor.energy').value && fact(afterPush, 'world.time').value > fact(beforePush, 'world.time').value;

  const resourceAdapter = Environment.create(declaration);
  const resourceNavigation = navigate(resourceAdapter, world.sharedResource.cell, actor, ordinaryPermissions, 'resource-navigation');
  const resourcePermissions = ['fixture:grid-step', world.sharedResource.permission].sort();
  const missingConsentAdapter = resourceAdapter.clone();
  const missingConsentReceipt = missingConsentAdapter.step(actionRequest('change-shared-resource-direct-irreversible', actor, resourcePermissions, [], 'consent-missing'));
  const directAdapter = resourceAdapter.clone();
  const directReceipt = directAdapter.step(actionRequest('change-shared-resource-direct-irreversible', actor, resourcePermissions, [world.sharedResource.consentEvidenceRef], 'consent-direct'));
  const directObservation = directAdapter.observe({ actor, permissions: ordinaryPermissions });
  const slowAdapter = resourceAdapter.clone();
  const slowReceipt = slowAdapter.step(actionRequest('change-shared-resource-slow-reversible', actor, resourcePermissions, [world.sharedResource.consentEvidenceRef], 'consent-slow'));
  const restoreReceipt = slowAdapter.step(actionRequest('restore-shared-resource-slow-route', actor, resourcePermissions, [world.sharedResource.consentEvidenceRef], 'consent-restore'));
  const restoredObservation = slowAdapter.observe({ actor, permissions: ordinaryPermissions });
  const consentPass = resourceNavigation.state === 'PASS' && missingConsentReceipt.status === 'REJECTED' && missingConsentReceipt.reason === 'MISSING_CONSENT_EVIDENCE' && directReceipt.status === 'APPLIED' && fact(directObservation, 'irreversible-change.applied').value === true && slowReceipt.status === 'APPLIED' && restoreReceipt.status === 'APPLIED' && fact(restoredObservation, 'shared-resource.state').value === world.sharedResource.initialState;

  const repairableHazard = world.hazards.find(row => row.repairable);
  const repairAdapter = Environment.create(declaration);
  const failureNavigation = navigate(repairAdapter, repairableHazard.cell, actor, ordinaryPermissions, 'failure-navigation');
  const failedObservation = repairAdapter.observe({ actor, permissions: ordinaryPermissions });
  const repairReceipt = repairAdapter.step(actionRequest(`repair-at-${repairableHazard.cell.replace(',', '-')}`, actor, ordinaryPermissions, [], 'repair'));
  const repairedObservation = repairAdapter.observe({ actor, permissions: ordinaryPermissions });
  const repairPass = failureNavigation.state === 'PASS' && fact(failedObservation, 'failure.active').value === true && repairReceipt.status === 'APPLIED' && fact(repairedObservation, 'failure.active').value === false;

  const goalAdapter = Environment.create(declaration);
  const goalBefore = goalAdapter.observe({ actor, permissions: ordinaryPermissions });
  const goalUpdateReceipt = goalAdapter.step(actionRequest('advance-to-next-goal-version', actor, ['fixture:grid-step', 'fixture:goal-update'], [], 'goal-update'));
  const goalAfter = goalAdapter.observe({ actor, permissions: ordinaryPermissions });
  const goalPass = goalUpdateReceipt.status === 'APPLIED' && fact(goalBefore, 'goal.active-id').value === activeGoal.id && fact(goalAfter, 'goal.active-id').value === laterGoal.id && fact(goalAfter, 'goal.version').value === laterGoal.version;

  const shortcutAdapter = Environment.create(declaration);
  const shortcutReceipt = shortcutAdapter.step(actionRequest('unauthorized-shortcut', actor, ordinaryPermissions, [], 'unauthorized-shortcut'));
  const shortcutPass = shortcutReceipt.status === 'REJECTED' && shortcutReceipt.reason === 'MISSING_PERMISSION' && shortcutReceipt.stateChanged === false;

  const routeAdapter = Environment.create(declaration);
  const shortestProblem = planningProblem(routeAdapter, 'shortest-route-exam', activeGoal.cell, actor, observationPermissions, 'BFS');
  const shortest = Search.run(shortestProblem); Search.verify(shortest);
  const safetyProblem = clone(shortestProblem);
  safetyProblem.problemId = 'safety-weighted-route-exam'; safetyProblem.search.algorithm = 'DIJKSTRA'; delete safetyProblem.problemDigest;
  safetyProblem.actions.forEach(action => { action.cost += ({ low: 0, medium: 20, high: 100, severe: 1000 })[action.risk]; });
  const safest = Search.run(safetyProblem); Search.verify(safest);
  const conflictPass = shortest.plan && safest.plan && shortest.plan.stepCount < safest.plan.stepCount && RISK[shortest.plan.risk] > RISK[safest.plan.risk];

  const activeGoalReplay = Replay.run({
    environment: declaration,
    planning: {
      problemId: 'active-grid-goal-differential-exam', actor, permissions: observationPermissions, consentEvidence: [],
      goal: { predicates: [{ factId: 'actor.position', operator: 'EQUALS', value: activeGoal.cell }] },
      search: { algorithm: 'DIJKSTRA', maxNodeExpansions: 50000, maxDepth: 48, maxWallTimeMs: 5000, beamWidth: 32 }, previousFailure: null
    },
    reasoning: {
      schema: 'axm.mirror.reasoning-session/v1', goal: `Reach active bounded grid goal ${activeGoal.id} through an inspectable declared plan.`,
      evidence: [{ id: 'grid-world-declaration', kind: 'test', status: 'tested', statement: 'The exact bounded grid declaration was compiled and content-digested.', source: { kind: 'fixture', id: world.worldId, uri: `sha256:${world.worldDigest}` } }],
      unknowns: [], constraints: [], permissions: [], actions: [], pathProfiles: []
    }
  }, { at });
  Replay.verify(activeGoalReplay);
  const activeGoalReplayPass = activeGoalReplay.state === 'PASS_DETERMINISTIC_DIFFERENTIAL' && activeGoalReplay.boundedReasoning.search.plan && activeGoalReplay.boundedReasoning.search.plan.stepCount > 0 && activeGoalReplay.counts.authoritativeFixtureTransitions === activeGoalReplay.boundedReasoning.search.plan.stepCount && activeGoalReplay.postObservationReasoning.pathSet.selectedActionId === activeGoalReplay.boundedReasoning.search.plan.planId;

  const zeroReplay = Replay.run({
    environment: declaration,
    planning: {
      problemId: 'zero-action-already-satisfied-exam', actor, permissions: observationPermissions, consentEvidence: [],
      goal: { predicates: [{ factId: 'actor.position', operator: 'EQUALS', value: actorDeclaration.start }] },
      search: { algorithm: 'DIJKSTRA', maxNodeExpansions: 64, maxDepth: 4, maxWallTimeMs: 1000, beamWidth: 4 }, previousFailure: null
    },
    reasoning: {
      schema: 'axm.mirror.reasoning-session/v1', goal: 'Preserve the already-satisfied declared grid goal with exactly zero world actions.',
      evidence: [{ id: 'grid-world-declaration', kind: 'test', status: 'tested', statement: 'The exact bounded grid declaration was compiled and content-digested.', source: { kind: 'fixture', id: world.worldId, uri: `sha256:${world.worldDigest}` } }],
      unknowns: [], constraints: [], permissions: [], actions: [], pathProfiles: []
    }
  }, { at });
  Replay.verify(zeroReplay);
  const zeroPass = zeroReplay.state === 'PASS_DETERMINISTIC_DIFFERENTIAL' && zeroReplay.boundedReasoning.search.state === 'INITIAL_STATE_ALREADY_SATISFIES_GOAL' && zeroReplay.boundedReasoning.search.plan.stepCount === 0 && zeroReplay.counts.authoritativeFixtureTransitions === 0 && zeroReplay.postObservationReasoning.pathSet.selectedActionId === zeroReplay.boundedReasoning.search.plan.planId;

  const exams = {
    partialNoisyObservationAndLaterDisproof: exam(observationPass ? 'PASS' : 'FAIL', { initialObservation, sourceReliabilities, inspectionSearch: inspectionNavigation.search, inspectionReceipts: inspectionNavigation.receipts.concat(inspectionReceipt), correctedObservation }, observationPass ? null : 'Observation, reliability, or later-disproof evidence diverged.'),
    movableObjectEnergyAndTime: exam(objectPass ? 'PASS' : 'FAIL', { navigationSearch: objectNavigation.search, navigationReceipts: objectNavigation.receipts, pushReceipt, beforePush, afterPush }, objectPass ? null : 'Object, energy, or time transition diverged.'),
    consentIrreversibilityAndSlowerRecovery: exam(consentPass ? 'PASS' : 'FAIL', { navigationSearch: resourceNavigation.search, navigationReceipts: resourceNavigation.receipts, missingConsentReceipt, directReceipt, directObservation, slowReceipt, restoreReceipt, restoredObservation }, consentPass ? null : 'Consent refusal, irreversible marker, or slower recovery diverged.'),
    repairableFailure: exam(repairPass ? 'PASS' : 'FAIL', { navigationSearch: failureNavigation.search, navigationReceipts: failureNavigation.receipts, failedObservation, repairReceipt, repairedObservation }, repairPass ? null : 'Repairable failure did not enter and leave the declared state.'),
    changingGoalContinuity: exam(goalPass ? 'PASS' : 'FAIL', { before: goalBefore, updateReceipt: goalUpdateReceipt, after: goalAfter }, goalPass ? null : 'Versioned goal update did not preserve an exact before/after trace.'),
    unauthorizedShortcut: exam(shortcutPass ? 'PASS' : 'FAIL', { shortcutReceipt }, shortcutPass ? null : 'Undelegated shortcut was not explicitly rejected.'),
    shortestVersusSafest: exam(conflictPass ? 'PASS' : 'FAIL', { shortest, safest, safetyCostPolicy: { low: 0, medium: 20, high: 100, severe: 1000, claim: 'Declared exam weighting only; not a universal value function.' } }, conflictPass ? null : 'The fixture did not expose distinct shorter and safer routes.'),
    activeGoalDifferentialReplay: exam(activeGoalReplayPass ? 'PASS' : 'FAIL', { replay: activeGoalReplay }, activeGoalReplayPass ? null : 'The multi-step grid plan did not predict the authoritative fixture and frozen replay state.'),
    zeroActionDecision: exam(zeroPass ? 'PASS' : 'FAIL', { replay: zeroReplay }, zeroPass ? null : 'The exact zero-action plan did not close the observation loop.')
  };
  const states = Object.values(exams).map(row => row.state);
  const response = {
    schema: RESPONSE_SCHEMA, responseId: null, responseDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_FIRST_BOUNDED_GRID_CURRICULUM_WORLD_FAMILY_NOT_GENERAL_WORLD_REASONING' },
    source: { worldId: world.worldId, worldDigest: world.worldDigest, compilationId: compilation.compilationId, compilationDigest: compilation.compilationDigest, at },
    state: states.every(value => value === 'PASS') ? 'PASS_BOUNDED_GRID_CURRICULUM' : states.some(value => value === 'FAIL') ? 'FAIL_BOUNDED_GRID_CURRICULUM' : 'HOLD_BOUNDED_GRID_CURRICULUM',
    compilation,
    exams,
    summary: { exams: states.length, passed: states.filter(value => value === 'PASS').length, failed: states.filter(value => value === 'FAIL').length, held: states.filter(value => value === 'HOLD').length, externalWorldActions: 0, permissionGrants: 0, trainingAdmissions: 0, runtimePromotions: 0, canonChanges: 0 },
    remainingPhase12Gaps: ['DETERMINISTIC_MICRO_PHYSICS_WORLD', 'THOUSANDS_OF_SEEDED_EPISODES_WITH_FULL_GROUND_TRUTH', 'LIVE_VISUAL_REPLAY_DEBUG_SCREEN_AND_VISUAL_VERIFICATION'],
    authority: { testFixtureOnly: true, proposalOnly: true, externalWorldAction: false, toolUse: false, permissionGrant: false, trainingAdmission: false, runtimePromotion: false, canonChange: false },
    boundary: 'This TEST organ compiles and examines one bounded data-declared 10x10 curriculum-world family. It does not prove general world understanding, learned improvement, real-world transfer, physics, visual correctness, autonomous training, runtime authority, release readiness, or CANON.'
  };
  return seal(response);
}

function verify(response) {
  if (!response || response.schema !== RESPONSE_SCHEMA || !response.organ || response.organ.id !== ORGAN_ID || response.organ.learnedWeights !== false) throw new Error('invalid bounded grid curriculum response');
  Grid.verify(response.compilation);
  for (const item of Object.values(response.exams)) {
    if (!['PASS', 'FAIL', 'HOLD'].includes(item.state)) throw new Error('bounded grid curriculum exam state is invalid');
  }
  const states = Object.values(response.exams).map(row => row.state);
  if (response.summary.exams !== states.length || response.summary.passed !== states.filter(value => value === 'PASS').length || response.summary.failed !== states.filter(value => value === 'FAIL').length || response.summary.held !== states.filter(value => value === 'HOLD').length) throw new Error('bounded grid curriculum summary changed');
  const expectedState = states.every(value => value === 'PASS') ? 'PASS_BOUNDED_GRID_CURRICULUM' : states.some(value => value === 'FAIL') ? 'FAIL_BOUNDED_GRID_CURRICULUM' : 'HOLD_BOUNDED_GRID_CURRICULUM';
  if (response.state !== expectedState) throw new Error('bounded grid curriculum state contradicts exams');
  const observations = [];
  const receipts = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (value.schema === Environment.OBSERVATION_SCHEMA) observations.push(value);
    if (value.schema === Environment.TRANSITION_RECEIPT_SCHEMA) receipts.push(value);
    for (const child of Object.values(value)) if (child && typeof child === 'object') collect(child);
  }
  for (const [name, item] of Object.entries(response.exams)) if (!['zeroActionDecision', 'activeGoalDifferentialReplay'].includes(name)) collect(item.evidence);
  observations.forEach(Environment.verifyObservation); receipts.forEach(Environment.verifyTransitionReceipt);
  Search.verify(response.exams.shortestVersusSafest.evidence.shortest); Search.verify(response.exams.shortestVersusSafest.evidence.safest);
  Replay.verify(response.exams.activeGoalDifferentialReplay.evidence.replay);
  Replay.verify(response.exams.zeroActionDecision.evidence.replay);
  const basis = Object.assign({}, response, { responseId: null, responseDigest: null });
  const expectedDigest = State.digest(basis, 64); const expectedId = `bounded-grid-curriculum-${State.digest({ compilationDigest: response.source.compilationDigest, responseDigest: expectedDigest })}`;
  if (response.responseDigest !== expectedDigest || response.responseId !== expectedId) throw new Error('bounded grid curriculum response digest changed');
  if (response.summary.externalWorldActions !== 0 || response.summary.permissionGrants !== 0 || response.summary.trainingAdmissions !== 0 || response.summary.runtimePromotions !== 0 || response.summary.canonChanges !== 0 || response.authority.externalWorldAction !== false || response.authority.toolUse !== false || response.authority.permissionGrant !== false || response.authority.trainingAdmission !== false || response.authority.runtimePromotion !== false || response.authority.canonChange !== false) throw new Error('bounded grid curriculum gained authority');
  return true;
}

module.exports = { RESPONSE_SCHEMA, ORGAN_ID, run, verify };
