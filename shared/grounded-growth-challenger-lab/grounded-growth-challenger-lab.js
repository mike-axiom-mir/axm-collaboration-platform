#!/usr/bin/env node
'use strict';

const Direction = require('../grounded-growth-direction-handoff/grounded-growth-direction-handoff');
const ToolCommon = require('../../tools/repair-resilience-library/components/common');

const PLAN_SCHEMA = 'axm.grounded-growth-challenger-plan/v1';
const EVALUATION_SCHEMA = 'axm.grounded-growth-challenger-evaluation/v1';
const READINESS_SCHEMA = 'axm.grounded-growth-challenger-readiness/v2';
const VERSION = '0.1.0';
const READINESS_VERSION = '0.2.0';
const CASE_KINDS = ['TECHNICAL', 'AI_WORKFLOW', 'REGRESSION'];
const EXPOSURES = ['DESIGN_VISIBLE', 'HELD_OUT'];
const VERDICTS = ['PASS', 'FAIL', 'UNKNOWN', 'NOT_RUN'];
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return Direction.stableStringify(value);
}

function sha256(value) {
  return Direction.sha256(value);
}

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be non-empty text');
  const result = value.trim();
  if (maximum && result.length > maximum) throw new Error(label + ' is too long');
  return result;
}

function timestamp(value, label) {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
}

function integer(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(label + ' is outside its declared bounds');
  return value;
}

function normalizeRef(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' must be a reference');
  const ref = {
    id: text(input.id, label + '.id', 180),
    schema: text(input.schema, label + '.schema', 180),
    sha256: text(input.sha256, label + '.sha256', 71)
  };
  if (!DIGEST.test(ref.sha256)) throw new Error(label + '.sha256 must be an exact digest');
  return ref;
}

function reference(value, options) {
  options = options || {};
  return {
    id: text(options.id, 'reference id', 180),
    schema: text(options.schema, 'reference schema', 180),
    sha256: sha256(value)
  };
}

function normalizeCases(input) {
  if (!Array.isArray(input) || input.length < 3 || input.length > 64) throw new Error('case manifest must contain 3-64 cases');
  const ids = new Set();
  const cases = input.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('case ' + index + ' must be an object');
    const id = text(item.id, 'case id', 120);
    if (ids.has(id)) throw new Error('duplicate case id ' + id);
    ids.add(id);
    const kind = text(item.kind, 'case kind', 30);
    if (!CASE_KINDS.includes(kind)) throw new Error('case kind is unsupported');
    const exposure = text(item.exposure, 'case exposure', 30);
    if (!EXPOSURES.includes(exposure)) throw new Error('case exposure is unsupported');
    return {
      id,
      kind,
      exposure,
      sourceRef: normalizeRef(item.sourceRef, 'case sourceRef'),
      passCondition: text(item.passCondition, 'case passCondition', 1200),
      counterevidence: text(item.counterevidence, 'case counterevidence', 1200)
    };
  });
  for (const kind of CASE_KINDS) {
    if (!cases.some((item) => item.kind === kind)) throw new Error('case manifest requires ' + kind);
  }
  if (!cases.some((item) => item.kind === 'AI_WORKFLOW' && item.exposure === 'HELD_OUT')) {
    throw new Error('case manifest requires a held-out AI_WORKFLOW case');
  }
  if (!cases.some((item) => item.kind === 'REGRESSION' && item.exposure === 'HELD_OUT')) {
    throw new Error('case manifest requires a held-out REGRESSION case');
  }
  return cases;
}

function selectDirection(handoff, directionId) {
  const verification = Direction.verifyHandoff(handoff);
  if (!verification.pass) throw new Error('direction handoff is invalid: ' + verification.errors.join('; '));
  const item = handoff.directions.find((candidate) => candidate.direction.direction_id === directionId);
  if (!item) throw new Error('direction is not present in the verified handoff');
  if (item.directionDigest !== sha256(item.direction)) throw new Error('direction digest mismatch');
  if (item.direction.action_type === 'WAIT_FOR_EVIDENCE') throw new Error('WAIT_FOR_EVIDENCE cannot create a challenger plan');
  if (item.direction.truth_state !== 'HYPOTHESIS' || item.direction.steward_status !== 'PENDING' || item.direction.execution_status !== 'NOT_STARTED') {
    throw new Error('direction must remain HYPOTHESIS/PENDING/NOT_STARTED');
  }
  if (item.executionPlan.state !== 'PROPOSAL_ONLY' || item.executionPlan.automatic !== false) {
    throw new Error('direction execution plan is not a bounded proposal');
  }
  return item;
}

function buildPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('challenger plan input must be an object');
  const directionHandoff = clone(input.directionHandoff);
  const directionId = text(input.directionId, 'directionId', 180);
  const directionItem = selectDirection(directionHandoff, directionId);
  const baselineRef = normalizeRef(input.baselineRef, 'baselineRef');
  const challengerRef = normalizeRef(input.challengerRef, 'challengerRef');
  if (baselineRef.sha256 === challengerRef.sha256) throw new Error('challenger must differ from the exact baseline');
  const cases = normalizeCases(input.cases);
  const budget = {
    maxCases: integer(input.budget && input.budget.maxCases, 'budget.maxCases', 3, 64),
    maxWallMs: integer(input.budget && input.budget.maxWallMs, 'budget.maxWallMs', 1, 120000),
    maxOperations: integer(input.budget && input.budget.maxOperations, 'budget.maxOperations', 1, 1000)
  };
  if (cases.length > budget.maxCases) throw new Error('case manifest exceeds maxCases budget');
  const caseManifest = {
    id: text(input.caseManifestId, 'caseManifestId', 180),
    splitPolicy: 'DECLARED_EXPOSURE_WITH_HELD_OUT_AI_AND_REGRESSION',
    cases
  };
  caseManifest.manifestDigest = sha256(caseManifest);
  const plan = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    planId: text(input.planId, 'planId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    directionHandoff,
    directionRef: {
      id: directionItem.direction.direction_id,
      schema: 'https://axm.local/schemas/gei/v0.1.0/evolution_direction.schema.json',
      sha256: directionItem.directionDigest
    },
    needRef: {
      id: directionItem.needId,
      schema: 'https://axm.local/schemas/gei/v0.1.0/improvement_need.schema.json',
      sha256: directionItem.needDigest
    },
    actionType: directionItem.direction.action_type,
    baselineRef,
    challengerRef,
    caseManifest,
    budget,
    state: 'READY_FOR_EXPLICIT_SHADOW_EXECUTION',
    truth: {
      sourceDirectionVerifiedNatively: true,
      baselineAndChallengerAreInertDataReferences: true,
      heldOutLabelIsCallerDeclared: true,
      heldOutCasesFetchedOrAuthenticated: false,
      experimentExecutedByPlan: false,
      canonicalStateMutationAuthorized: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false
    },
    planDigest: null
  };
  const payload = clone(plan);
  delete payload.planDigest;
  plan.planDigest = sha256(payload);
  return plan;
}

function verifyPlan(plan) {
  const errors = [];
  if (!plan || plan.schema !== PLAN_SCHEMA) return { pass: false, errors: ['challenger plan schema mismatch'] };
  if (plan.version !== VERSION) errors.push('challenger plan version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildPlan({
      planId: plan.planId,
      generatedAt: plan.generatedAt,
      directionHandoff: plan.directionHandoff,
      directionId: plan.directionRef && plan.directionRef.id,
      baselineRef: plan.baselineRef,
      challengerRef: plan.challengerRef,
      caseManifestId: plan.caseManifest && plan.caseManifest.id,
      cases: plan.caseManifest && plan.caseManifest.cases,
      budget: plan.budget
    });
  } catch (error) {
    errors.push('challenger plan content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(plan)) errors.push('challenger plan content or derived state mismatch');
  return { pass: errors.length === 0, errors };
}

function verifyToolDigest(receipt, label) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error(label + ' must be an object');
  if (!HEX_DIGEST.test(receipt.digest || '')) throw new Error(label + ' digest format mismatch');
  const payload = clone(receipt);
  delete payload.digest;
  if (ToolCommon.sha256(payload) !== receipt.digest) throw new Error(label + ' digest mismatch');
}

function verifyShadowReceipt(receipt, plan) {
  verifyToolDigest(receipt, 'shadow receipt');
  if (receipt.schema !== 'axm.shadow-simulation/v1' || receipt.status !== 'PASS') throw new Error('shadow receipt did not PASS');
  if (receipt.canonicalStateTouched !== false || receipt.mutationAuthorized !== false) throw new Error('shadow receipt crossed its authority boundary');
  if (receipt.beforeDigest !== plan.baselineRef.sha256.slice(7) || receipt.afterDigest !== plan.challengerRef.sha256.slice(7)) {
    throw new Error('shadow receipt baseline/challenger digest mismatch');
  }
  if (ToolCommon.sha256(receipt.shadowState) !== receipt.afterDigest) throw new Error('shadow state digest mismatch');
}

function diagnosticResult(receipt, caseItem, subjectRef, label) {
  verifyToolDigest(receipt, label + ' diagnostic receipt');
  if (receipt.schema !== 'axm.diagnostic-experiment.receipt/v1' || receipt.status !== 'PASS') {
    throw new Error(label + ' diagnostic runner did not produce a result');
  }
  if (receipt.canonicalStateTouched !== false || receipt.authority !== 'SHADOW_ONLY') throw new Error(label + ' diagnostic receipt crossed its authority boundary');
  if (receipt.fixtureDigestBefore !== receipt.fixtureDigestAfter) throw new Error(label + ' diagnostic experiment mutated its observation fixture');
  const result = receipt.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(label + ' diagnostic result is missing');
  if (result.caseId !== caseItem.id) throw new Error(label + ' diagnostic case mismatch');
  if (result.subjectDigest !== subjectRef.sha256) throw new Error(label + ' diagnostic subject mismatch');
  if (!VERDICTS.includes(result.verdict)) throw new Error(label + ' diagnostic verdict is unsupported');
  const evidenceRef = normalizeRef(result.evidenceRef, label + ' diagnostic evidenceRef');
  return { verdict: result.verdict, evidenceRef };
}

function comparison(baselineVerdict, challengerVerdict) {
  if (baselineVerdict === 'UNKNOWN' || baselineVerdict === 'NOT_RUN' || challengerVerdict === 'UNKNOWN' || challengerVerdict === 'NOT_RUN') return 'UNKNOWN';
  if (baselineVerdict === 'FAIL' && challengerVerdict === 'PASS') return 'IMPROVED';
  if (baselineVerdict === 'PASS' && challengerVerdict === 'FAIL') return 'REGRESSED';
  if (baselineVerdict === 'PASS' && challengerVerdict === 'PASS') return 'MAINTAINED';
  return 'UNRESOLVED';
}

function buildEvaluation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('challenger evaluation input must be an object');
  const plan = clone(input.plan);
  const planVerification = verifyPlan(plan);
  if (!planVerification.pass) throw new Error('challenger plan is invalid: ' + planVerification.errors.join('; '));
  const shadowReceipt = clone(input.shadowReceipt);
  verifyShadowReceipt(shadowReceipt, plan);
  if (!Array.isArray(input.caseResults) || input.caseResults.length !== plan.caseManifest.cases.length) {
    throw new Error('case results must cover the exact plan case count');
  }
  const resultById = new Map();
  for (const item of input.caseResults) {
    const id = text(item && item.caseId, 'case result id', 120);
    if (resultById.has(id)) throw new Error('duplicate case result ' + id);
    resultById.set(id, item);
  }
  const results = plan.caseManifest.cases.map((caseItem) => {
    const supplied = resultById.get(caseItem.id);
    if (!supplied) throw new Error('missing case result ' + caseItem.id);
    const baselineReceipt = clone(supplied.baselineReceipt);
    const challengerReceipt = clone(supplied.challengerReceipt);
    const baseline = diagnosticResult(baselineReceipt, caseItem, plan.baselineRef, 'baseline');
    const challenger = diagnosticResult(challengerReceipt, caseItem, plan.challengerRef, 'challenger');
    return {
      caseId: caseItem.id,
      kind: caseItem.kind,
      exposure: caseItem.exposure,
      baselineReceipt,
      challengerReceipt,
      baselineVerdict: baseline.verdict,
      challengerVerdict: challenger.verdict,
      comparison: comparison(baseline.verdict, challenger.verdict),
      evidenceRefs: [baseline.evidenceRef, challenger.evidenceRef]
    };
  });
  const unknownCount = results.filter((item) => item.comparison === 'UNKNOWN').length;
  const regressionCount = results.filter((item) => item.comparison === 'REGRESSED' ||
    ((item.kind === 'TECHNICAL' || item.kind === 'REGRESSION') && item.challengerVerdict === 'FAIL')).length;
  const heldOutImprovementCount = results.filter((item) => item.exposure === 'HELD_OUT' && item.comparison === 'IMPROVED').length;
  const heldOutAiImprovementCount = results.filter((item) => item.kind === 'AI_WORKFLOW' && item.exposure === 'HELD_OUT' && item.comparison === 'IMPROVED').length;
  let disposition = 'TECHNICAL_AI_REVIEW_CANDIDATE';
  if (unknownCount) disposition = 'EVIDENCE_HOLD';
  else if (regressionCount) disposition = 'CHALLENGER_REJECT_CANDIDATE';
  else if (heldOutAiImprovementCount === 0) disposition = 'NO_MEASURED_GAIN';
  const evaluation = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    evaluationId: text(input.evaluationId, 'evaluationId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    plan,
    shadowReceipt,
    results,
    summary: {
      caseCount: results.length,
      heldOutCaseCount: results.filter((item) => item.exposure === 'HELD_OUT').length,
      improvedCount: results.filter((item) => item.comparison === 'IMPROVED').length,
      heldOutImprovementCount,
      heldOutAiImprovementCount,
      maintainedCount: results.filter((item) => item.comparison === 'MAINTAINED').length,
      regressionCount,
      unknownCount
    },
    disposition,
    adoptionState: 'NOT_AUTHORIZED',
    nextGate: disposition === 'TECHNICAL_AI_REVIEW_CANDIDATE'
      ? 'SEPARATE_STEWARD_REVIEW_AND_GROUNDED_GROWTH_OUTCOME'
      : 'REPAIR_OR_NEW_EVIDENCE_BEFORE_REVIEW',
    truth: {
      planVerifiedNatively: true,
      shadowReceiptVerifiedNatively: true,
      diagnosticReceiptsVerifiedNatively: true,
      canonicalStateTouched: false,
      heldOutImprovementObserved: heldOutImprovementCount > 0,
      heldOutAiWorkflowImprovementObserved: heldOutAiImprovementCount > 0,
      broadLearningClaimed: false,
      generalizationClaimed: false,
      modelWeightTrainingClaimed: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false,
      directionAccepted: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    evaluationDigest: null
  };
  const payload = clone(evaluation);
  delete payload.evaluationDigest;
  evaluation.evaluationDigest = sha256(payload);
  return evaluation;
}

function verifyEvaluation(evaluation) {
  const errors = [];
  if (!evaluation || evaluation.schema !== EVALUATION_SCHEMA) return { pass: false, errors: ['challenger evaluation schema mismatch'] };
  if (evaluation.version !== VERSION) errors.push('challenger evaluation version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildEvaluation({
      evaluationId: evaluation.evaluationId,
      generatedAt: evaluation.generatedAt,
      plan: evaluation.plan,
      shadowReceipt: evaluation.shadowReceipt,
      caseResults: evaluation.results.map((item) => ({
        caseId: item.caseId,
        baselineReceipt: item.baselineReceipt,
        challengerReceipt: item.challengerReceipt
      }))
    });
  } catch (error) {
    errors.push('challenger evaluation content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(evaluation)) errors.push('challenger evaluation content or derived state mismatch');
  return { pass: errors.length === 0, errors };
}

function verifyDirectionReadiness(readiness, directionHandoff) {
  if (!readiness || readiness.schema !== 'axm.grounded-growth-direction-readiness/v1' || readiness.status !== 'TEST') {
    throw new Error('direction readiness identity mismatch');
  }
  if (!DIGEST.test(readiness.receiptDigest || '')) throw new Error('direction readiness digest format mismatch');
  const payload = clone(readiness);
  delete payload.receiptDigest;
  if (sha256(payload) !== readiness.receiptDigest) throw new Error('direction readiness digest mismatch');
  if (!readiness.sourceRefs || !readiness.sourceRefs.directionHandoff
    || readiness.sourceRefs.directionHandoff.sha256 !== directionHandoff.handoffDigest) {
    throw new Error('direction readiness handoff ancestry mismatch');
  }
  const expectedDirections = directionHandoff.directions.map((item) => ({
    needId: item.needId,
    needDigest: item.needDigest,
    directionId: item.direction.direction_id,
    directionDigest: item.directionDigest,
    actionType: item.direction.action_type,
    stewardStatus: item.direction.steward_status,
    executionStatus: item.direction.execution_status,
    executionPlanState: item.executionPlan.state
  }));
  if (stableStringify(readiness.directions) !== stableStringify(expectedDirections)) {
    throw new Error('direction readiness does not cover the exact handoff directions');
  }
  if (!readiness.truth || readiness.truth.currentWorkAutomaticallyStarted !== false
    || readiness.truth.stewardAcceptanceRecorded !== false
    || readiness.truth.automaticExecution !== false
    || readiness.truth.automaticCanon !== false) {
    throw new Error('direction readiness authority boundary mismatch');
  }
}

function verifyExperimentalOrgan(contract, expected) {
  if (!contract || contract.schema !== 'axm.module-contract/v1' || contract.id !== expected.id) {
    throw new Error(expected.label + ' contract identity mismatch');
  }
  if (contract.status !== 'EXPERIMENTAL' || !Array.isArray(contract.permissions) || contract.permissions.length !== 0) {
    throw new Error(expected.label + ' contract must remain EXPERIMENTAL with zero permissions');
  }
  if (!contract.authority || contract.authority.tier !== expected.tier || contract.authority.automaticMutation !== false) {
    throw new Error(expected.label + ' authority boundary mismatch');
  }
  if (!Array.isArray(contract.provides) || !contract.provides.includes(expected.provides)) {
    throw new Error(expected.label + ' provided contract mismatch');
  }
}

function buildReadiness(input) {
  exactKeys(input, [
    'readinessId', 'generatedAt', 'directionHandoff', 'directionReadiness',
    'shadowContract', 'diagnosticContract', 'plans', 'evaluations'
  ], 'challenger readiness input');
  const directionHandoff = clone(input.directionHandoff);
  const directionVerification = Direction.verifyHandoff(directionHandoff);
  if (!directionVerification.pass) throw new Error('direction handoff invalid: ' + directionVerification.errors.join('; '));
  const directionReadiness = clone(input.directionReadiness);
  verifyDirectionReadiness(directionReadiness, directionHandoff);
  const shadowContract = clone(input.shadowContract);
  const diagnosticContract = clone(input.diagnosticContract);
  verifyExperimentalOrgan(shadowContract, {
    id: 'axm.repair.shadow-simulator', label: 'shadow simulator',
    tier: 'TIER_2_SHADOW_REPAIR', provides: 'axm.shadow-simulation/v1'
  });
  verifyExperimentalOrgan(diagnosticContract, {
    id: 'axm.repair.diagnostic-experiment-runner', label: 'diagnostic runner',
    tier: 'TIER_2_SHADOW_EXPERIMENT', provides: 'axm.diagnostic-experiment.receipt/v1'
  });
  if (!Array.isArray(input.plans) || input.plans.length > 64) throw new Error('plans must be a bounded array');
  if (!Array.isArray(input.evaluations) || input.evaluations.length > 64) throw new Error('evaluations must be a bounded array');
  const plans = clone(input.plans);
  const evaluations = clone(input.evaluations);
  const planByDigest = new Map();
  plans.forEach((plan) => {
    const check = verifyPlan(plan);
    if (!check.pass) throw new Error('challenger plan invalid: ' + check.errors.join('; '));
    if (plan.directionHandoff.handoffDigest !== directionHandoff.handoffDigest) {
      throw new Error('challenger plan targets another direction handoff');
    }
    if (planByDigest.has(plan.planDigest)) throw new Error('duplicate challenger plan');
    planByDigest.set(plan.planDigest, plan);
  });
  const evaluationIds = new Set();
  evaluations.forEach((evaluation) => {
    const check = verifyEvaluation(evaluation);
    if (!check.pass) throw new Error('challenger evaluation invalid: ' + check.errors.join('; '));
    if (!planByDigest.has(evaluation.plan.planDigest)) throw new Error('challenger evaluation lacks its exact supplied plan');
    if (evaluationIds.has(evaluation.evaluationId)) throw new Error('duplicate challenger evaluation');
    evaluationIds.add(evaluation.evaluationId);
  });

  const waitDirections = directionHandoff.directions.filter((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE');
  const actionableDirections = directionHandoff.directions.filter((item) => item.direction.action_type !== 'WAIT_FOR_EVIDENCE');
  let state = 'LAB_CAPABILITY_READY_CURRENT_DIRECTIONS_HELD';
  if (actionableDirections.length) state = plans.length
    ? (evaluations.length ? 'LAB_EVALUATION_PRESENT_FOR_EXPLICIT_REVIEW' : 'LAB_PLAN_PRESENT_AWAITING_EXPLICIT_SHADOW_EXECUTION')
    : 'LAB_CAPABILITY_READY_DIRECTION_AWAITS_EXPLICIT_PLAN';
  const currentBestAction = evaluations.length
    ? 'EXPLICIT_STEWARD_REVIEW_OF_CHALLENGER_EVALUATION'
    : plans.length
      ? 'EXPLICIT_SHADOW_EXECUTION_DECISION'
      : actionableDirections.length
        ? 'EXPLICIT_STEWARD_REVIEW_BEFORE_OPTIONAL_CHALLENGER_PLAN'
        : 'WAIT_FOR_EVIDENCE';

  const readiness = {
    schema: READINESS_SCHEMA,
    version: READINESS_VERSION,
    readinessId: text(input.readinessId, 'readinessId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    state,
    current: {
      directionCount: directionHandoff.directions.length,
      waitDirectionCount: waitDirections.length,
      actionableDirectionCount: actionableDirections.length,
      challengerPlanCount: plans.length,
      challengerEvaluationCount: evaluations.length,
      acceptedDirectionCount: directionHandoff.summary.acceptedDirectionCount,
      executedDirectionCount: directionHandoff.summary.executedDirectionCount,
      liveHumanOutcomes: directionReadiness.current.liveHumanOutcomes
    },
    sourceRefs: {
      directionHandoff: {
        id: directionHandoff.handoffId,
        schema: directionHandoff.schema,
        sha256: directionHandoff.handoffDigest
      },
      directionReadiness: {
        id: 'current-grounded-growth-direction-readiness',
        schema: directionReadiness.schema,
        sha256: directionReadiness.receiptDigest
      },
      shadowContract: reference(shadowContract, { id: shadowContract.id, schema: shadowContract.schema }),
      diagnosticContract: reference(diagnosticContract, { id: diagnosticContract.id, schema: diagnosticContract.schema })
    },
    plans,
    evaluations,
    truth: {
      directionHandoffVerifiedNatively: true,
      directionReadinessVerifiedExactly: true,
      experimentalOrganContractsVerifiedExactly: true,
      challengerContractReady: true,
      currentExperimentAutomaticallyRequired: false,
      currentBestAction,
      currentPlanCreated: plans.length > 0,
      currentEvaluationCreated: evaluations.length > 0,
      canonicalStateTouched: false,
      directionAccepted: false,
      humanBenefitEstablished: false,
      sharedGrowthClaimed: false,
      broadLearningClaimed: false,
      modelWeightTrainingClaimed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = clone(readiness);
  delete payload.receiptDigest;
  readiness.receiptDigest = sha256(payload);
  return readiness;
}

function verifyReadiness(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== READINESS_SCHEMA) throw new Error('challenger readiness schema mismatch');
    if (receipt.version !== READINESS_VERSION) throw new Error('challenger readiness version mismatch');
    const rebuilt = buildReadiness(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('challenger readiness content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  PLAN_SCHEMA,
  EVALUATION_SCHEMA,
  READINESS_SCHEMA,
  VERSION,
  READINESS_VERSION,
  CASE_KINDS,
  EXPOSURES,
  VERDICTS,
  stableStringify,
  sha256,
  reference,
  buildPlan,
  verifyPlan,
  buildEvaluation,
  verifyEvaluation,
  buildReadiness,
  verifyReadiness
};
