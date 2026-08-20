#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../grounded-growth-feedback/grounded-growth-feedback');
const Direction = require('../grounded-growth-direction-handoff/grounded-growth-direction-handoff');
const Lab = require('./grounded-growth-challenger-lab');
const Shadow = require('../../tools/repair-resilience-library/components/shadow-simulator');
const Diagnostic = require('../../tools/repair-resilience-library/components/diagnostic-experiment-runner');
const ToolCommon = require('../../tools/repair-resilience-library/components/common');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function resealToolReceipt(receipt) {
  const copy = clone(receipt);
  delete copy.digest;
  receipt.digest = ToolCommon.sha256(copy);
  return receipt;
}

const at = '2026-08-19T13:00:00.000Z';
const planSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-challenger-plan.schema.json'), 'utf8'));
const evaluationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-challenger-evaluation.schema.json'), 'utf8'));
const readinessSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-challenger-readiness.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const shadowContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../tools/repair-resilience-library/components/shadow-simulator/module.contract.json'), 'utf8'));
const diagnosticContract = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../tools/repair-resilience-library/components/diagnostic-experiment-runner/module.contract.json'), 'utf8'));
check(planSchema.$id === Lab.PLAN_SCHEMA && evaluationSchema.$id === Lab.EVALUATION_SCHEMA && readinessSchema.$id === Lab.READINESS_SCHEMA, 'plan, evaluation and readiness schema identities match implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract stays TEST with no permissions or writes');
check(contract.boundaries.refuses.includes('test-win-as-adoption') && contract.boundaries.refuses.includes('ai-workflow-win-as-human-benefit'), 'module contract refuses adoption and human-benefit substitution');
check(contract.version === 'v0.2' && contract.provides.includes(Lab.READINESS_SCHEMA), 'v0.2 contract advertises native challenger readiness');

function ref(id, value, schemaName) {
  return Growth.reference(value, { id, schema: schemaName || 'axm.test-evidence/v1' });
}

function cycle() {
  const candidateRef = Loop.reference({ candidate: 'challenger lab fixture' }, { id: 'candidate-challenger', schema: 'text/javascript' });
  return Loop.build({
    cycleId: 'cycle-challenger-lab', capabilityId: 'growth.challenger-fixture/v1', generatedAt: at,
    baseline: {
      kind: 'git-and-worktree', identity: 'bounded challenger selftest fixture',
      receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'baseline-challenger', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-challenger', statement: 'Improvement candidates need held-out and regression comparison before review.',
      sourceRef: Loop.reference({ need: 'challenger' }, { id: 'need-challenger-source', schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN', reason: 'No direction-to-challenger receipt composer existed.',
      reportRef: Loop.reference({ missing: 'challenger composer' }, { id: 'gap-challenger', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ source: 'selftest' }, { id: 'provenance-challenger', schema: 'axm.source-provenance/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: true, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ result: 'PASS' }, { id: 'verification-challenger', schema: 'axm.focused-test-receipt/v1' }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic fixture proves contract behavior only.']
    },
    decision: {
      verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: candidateRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'CONTINUE' }, { id: 'decision-challenger', schema: 'axm.review-decision/v1' })
    },
    availability: {
      status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'fixture-availability',
      receiptRef: Loop.reference({ available: true }, { id: 'availability-challenger', schema: 'axm.module-availability-receipt/v1' })
    },
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
}

function closure() {
  const covered = [ref('challenger-claim-baseline', { before: true }).sha256, ref('challenger-claim-outcome', { after: true }).sha256, ref('challenger-claim-evidence', { evidence: true }).sha256];
  return {
    state: 'CURRENT', checkedAt: at,
    receiptRef: ref('challenger-closure', { covered }, 'axm.evidence-closure-receipt/v1'),
    coveredDigests: covered
  };
}

function wrongSurfaceOutcome() {
  return Growth.buildOutcome({
    outcomeId: 'challenger-source-outcome', generatedAt: at, cycleReceipt: cycle(),
    informationRefs: [ref('challenger-information', { signal: 'new' })],
    claims: [{
      id: 'challenger-human-wrong-surface', beneficiary: 'HUMAN',
      statement: 'The human fixture workflow is improved.', kind: 'WORKFLOW_OUTCOME', verdict: 'PASS',
      proofSurface: 'FOCUSED_RUNTIME',
      baselineRef: ref('challenger-claim-baseline', { before: true }),
      outcomeRef: ref('challenger-claim-outcome', { after: true }),
      evidenceRefs: [ref('challenger-claim-evidence', { evidence: true })],
      evidenceClosure: closure(), limitations: ['Wrong proof surface intentionally creates a repair need.']
    }],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
}

function actionHandoff() {
  const feedback = Feedback.buildPacket({
    packetId: 'challenger-feedback', generatedAt: '2026-08-19T13:00:01.000Z',
    sourceReceipt: wrongSurfaceOutcome(), routeStates: [], existingNeeds: [], coverageLinks: []
  });
  const need = feedback.candidateNeeds[0];
  return Direction.buildHandoff({
    handoffId: 'challenger-direction-handoff', generatedAt: '2026-08-19T13:00:02.000Z',
    sourcePacket: feedback,
    selections: [{
      needId: need.need_id, actionType: 'REPAIR', sourceKind: 'SYNTHETIC_FIXTURE',
      sourceRef: ref('challenger-selection', { action: 'REPAIR' }, 'axm.proposal-selection/v1'),
      rationale: 'Use a synthetic REPAIR selection only to verify the challenger contract.'
    }]
  });
}

function waitHandoff() {
  const outcome = Growth.buildOutcome({
    outcomeId: 'challenger-wait-outcome', generatedAt: at, cycleReceipt: cycle(),
    informationRefs: [ref('challenger-wait-information', { signal: 'new' })], claims: [],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  });
  const feedback = Feedback.buildPacket({
    packetId: 'challenger-wait-feedback', generatedAt: '2026-08-19T13:00:03.000Z',
    sourceReceipt: outcome,
    routeStates: [{
      capabilityId: outcome.capabilityId, needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE',
      state: 'READY_FOR_VOLUNTARY_INPUT', evidenceRef: ref('challenger-voluntary-route', { ready: true }),
      detail: 'Voluntary fixture route.'
    }], existingNeeds: [], coverageLinks: []
  });
  return Direction.buildHandoff({
    handoffId: 'challenger-wait-handoff', generatedAt: '2026-08-19T13:00:04.000Z',
    sourcePacket: feedback, selections: []
  });
}

function directionReadinessFor(handoff) {
  const receipt = {
    schema: 'axm.grounded-growth-direction-readiness/v1',
    version: '0.1.0',
    generatedAt: '2026-08-19T13:00:04.500Z',
    status: 'TEST',
    state: 'SELFTEST_DIRECTION_READINESS',
    current: { liveHumanOutcomes: 0 },
    directions: handoff.directions.map((item) => ({
      needId: item.needId,
      needDigest: item.needDigest,
      directionId: item.direction.direction_id,
      directionDigest: item.directionDigest,
      actionType: item.direction.action_type,
      stewardStatus: item.direction.steward_status,
      executionStatus: item.direction.execution_status,
      executionPlanState: item.executionPlan.state
    })),
    sourceRefs: {
      directionHandoff: { id: handoff.handoffId, schema: handoff.schema, sha256: handoff.handoffDigest }
    },
    truth: {
      currentWorkAutomaticallyStarted: false,
      stewardAcceptanceRecorded: false,
      automaticExecution: false,
      automaticCanon: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = Lab.sha256(payload);
  return receipt;
}

function cases() {
  return [
    {
      id: 'technical-contract', kind: 'TECHNICAL', exposure: 'DESIGN_VISIBLE',
      sourceRef: ref('technical-case', { assertion: 'guard enabled' }, 'axm.challenger-case/v1'),
      passCondition: 'The challenger enables the declared guard without changing unrelated state.',
      counterevidence: 'The guard remains disabled or unrelated state changes.'
    },
    {
      id: 'held-out-ai-route', kind: 'AI_WORKFLOW', exposure: 'HELD_OUT',
      sourceRef: ref('held-out-ai-case', { hidden: 'unsafe route' }, 'axm.challenger-case/v1'),
      passCondition: 'The held-out AI workflow refuses the unsupported route.',
      counterevidence: 'The challenger still takes the unsupported route.'
    },
    {
      id: 'held-out-regression', kind: 'REGRESSION', exposure: 'HELD_OUT',
      sourceRef: ref('held-out-regression-case', { hidden: 'known safe route' }, 'axm.challenger-case/v1'),
      passCondition: 'The known safe route remains available.',
      counterevidence: 'The challenger blocks the known safe route.'
    }
  ];
}

async function diagnosticReceipt(caseItem, subjectState, subjectRef, verdict) {
  return Diagnostic.runExperiment({
    experimentId: caseItem.id + '-' + subjectRef.id,
    fixture: subjectState,
    timeoutMs: 1000,
    experiment: () => ({
      caseId: caseItem.id,
      subjectDigest: subjectRef.sha256,
      verdict,
      evidenceRef: Lab.reference({ caseId: caseItem.id, subject: subjectRef.sha256, verdict }, {
        id: caseItem.id + '-' + subjectRef.id + '-observation', schema: 'axm.challenger-observation/v1'
      })
    })
  });
}

(async () => {
  const directionHandoff = actionHandoff();
  check(Direction.verifyHandoff(directionHandoff).pass, 'synthetic non-WAIT direction handoff verifies natively');
  const directionId = directionHandoff.directions[0].direction.direction_id;
  const baseline = { guard: { enabled: false }, safeRoute: true, unrelated: { value: 7 } };
  const baselineCopy = clone(baseline);
  const shadow = Shadow.simulateShadow(baseline, [{ op: 'replace', path: '/guard/enabled', value: true }], { maxOps: 4 });
  const challenger = shadow.shadowState;
  const baselineRef = Lab.reference(baseline, { id: 'challenger-baseline', schema: 'axm.fixture-state/v1' });
  const challengerRef = Lab.reference(challenger, { id: 'challenger-candidate', schema: 'axm.fixture-state/v1' });
  check(shadow.status === 'PASS' && shadow.canonicalStateTouched === false && shadow.beforeDigest === baselineRef.sha256.slice(7), 'existing Shadow Simulator produces an isolated baseline receipt');
  check(Lab.stableStringify(baseline) === Lab.stableStringify(baselineCopy), 'Shadow Simulator leaves the original baseline unchanged');

  const plan = Lab.buildPlan({
    planId: 'challenger-plan-fixture', generatedAt: '2026-08-19T13:00:05.000Z',
    directionHandoff, directionId, baselineRef, challengerRef,
    caseManifestId: 'challenger-cases-fixture', cases: cases(),
    budget: { maxCases: 3, maxWallMs: 5000, maxOperations: 4 }
  });
  check(Lab.verifyPlan(plan).pass, 'fresh challenger plan verifies deterministically');
  check(plan.directionRef.sha256 === directionHandoff.directions[0].directionDigest, 'plan binds the exact direction digest');
  check(plan.needRef.sha256 === directionHandoff.directions[0].needDigest, 'plan binds the exact improvement-need digest');
  check(plan.baselineRef.sha256 !== plan.challengerRef.sha256, 'plan requires distinct baseline and challenger digests');
  check(plan.caseManifest.cases.some((item) => item.kind === 'AI_WORKFLOW' && item.exposure === 'HELD_OUT'), 'plan contains a held-out AI-workflow case');
  check(plan.caseManifest.cases.some((item) => item.kind === 'REGRESSION' && item.exposure === 'HELD_OUT'), 'plan contains a held-out regression case');
  check(plan.truth.experimentExecutedByPlan === false && plan.truth.canonicalStateMutationAuthorized === false, 'plan itself executes nothing and authorizes no canonical mutation');

  const verdicts = {
    'technical-contract': ['PASS', 'PASS'],
    'held-out-ai-route': ['FAIL', 'PASS'],
    'held-out-regression': ['PASS', 'PASS']
  };
  const resultPairs = [];
  for (const caseItem of plan.caseManifest.cases) {
    resultPairs.push({
      caseId: caseItem.id,
      baselineReceipt: await diagnosticReceipt(caseItem, baseline, baselineRef, verdicts[caseItem.id][0]),
      challengerReceipt: await diagnosticReceipt(caseItem, challenger, challengerRef, verdicts[caseItem.id][1])
    });
  }
  check(resultPairs.every((item) => item.baselineReceipt.canonicalStateTouched === false && item.challengerReceipt.authority === 'SHADOW_ONLY'), 'existing Diagnostic Experiment Runner stays shadow-only for all paired cases');

  const evaluation = Lab.buildEvaluation({
    evaluationId: 'challenger-evaluation-fixture', generatedAt: '2026-08-19T13:00:06.000Z',
    plan, shadowReceipt: shadow, caseResults: resultPairs
  });
  check(Lab.verifyEvaluation(evaluation).pass, 'fresh challenger evaluation verifies deterministically');
  check(evaluation.disposition === 'TECHNICAL_AI_REVIEW_CANDIDATE', 'held-out AI improvement with no regression becomes a review candidate');
  check(evaluation.summary.heldOutAiImprovementCount === 1 && evaluation.summary.regressionCount === 0, 'evaluation derives one held-out AI improvement and zero regressions');
  check(evaluation.adoptionState === 'NOT_AUTHORIZED' && evaluation.truth.directionAccepted === false, 'test result grants no adoption or direction acceptance');
  check(evaluation.truth.broadLearningClaimed === false && evaluation.truth.generalizationClaimed === false, 'bounded held-out improvement is not mislabeled as broad learning or generalization');
  check(evaluation.truth.humanBenefitClaimed === false && evaluation.truth.sharedGrowthClaimed === false, 'AI-workflow result is not substituted for human benefit or shared growth');
  check(evaluation.nextGate === 'SEPARATE_STEWARD_REVIEW_AND_GROUNDED_GROWTH_OUTCOME', 'successful challenger still routes to separate steward and outcome gates');

  const regressionPairs = clone(resultPairs);
  regressionPairs[2].challengerReceipt = await diagnosticReceipt(plan.caseManifest.cases[2], challenger, challengerRef, 'FAIL');
  const regression = Lab.buildEvaluation({
    evaluationId: 'challenger-regression-fixture', generatedAt: '2026-08-19T13:00:07.000Z',
    plan, shadowReceipt: shadow, caseResults: regressionPairs
  });
  check(regression.disposition === 'CHALLENGER_REJECT_CANDIDATE' && regression.summary.regressionCount === 1, 'held-out regression rejects the challenger candidate');

  const noGainPairs = clone(resultPairs);
  noGainPairs[1].baselineReceipt = await diagnosticReceipt(plan.caseManifest.cases[1], baseline, baselineRef, 'PASS');
  const noGain = Lab.buildEvaluation({
    evaluationId: 'challenger-no-gain-fixture', generatedAt: '2026-08-19T13:00:08.000Z',
    plan, shadowReceipt: shadow, caseResults: noGainPairs
  });
  check(noGain.disposition === 'NO_MEASURED_GAIN' && noGain.summary.heldOutAiImprovementCount === 0, 'unchanged held-out AI result is not mislabeled as improvement');

  const unknownPairs = clone(resultPairs);
  unknownPairs[1].challengerReceipt = await diagnosticReceipt(plan.caseManifest.cases[1], challenger, challengerRef, 'UNKNOWN');
  const unknown = Lab.buildEvaluation({
    evaluationId: 'challenger-unknown-fixture', generatedAt: '2026-08-19T13:00:09.000Z',
    plan, shadowReceipt: shadow, caseResults: unknownPairs
  });
  check(unknown.disposition === 'EVIDENCE_HOLD' && unknown.summary.unknownCount === 1, 'unknown held-out result remains an evidence hold');

  const wait = waitHandoff();
  const waitDirectionId = wait.directions.find((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE').direction.direction_id;
  const currentReadinessInput = {
    readinessId: 'challenger-readiness-wait-fixture',
    generatedAt: '2026-08-19T13:00:09.500Z',
    directionHandoff: wait,
    directionReadiness: directionReadinessFor(wait),
    shadowContract,
    diagnosticContract,
    plans: [],
    evaluations: []
  };
  const currentReadiness = Lab.buildReadiness(currentReadinessInput);
  check(Lab.verifyReadiness(currentReadiness, currentReadinessInput).pass, 'fresh challenger readiness verifies by exact rebuild');
  check(currentReadiness.current.directionCount === wait.directions.length
    && currentReadiness.current.waitDirectionCount === wait.directions.filter((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE').length,
  'readiness derives the exact supplied WAIT/action direction mix');
  check(currentReadiness.current.challengerPlanCount === 0 && currentReadiness.current.challengerEvaluationCount === 0, 'empty exact inputs produce zero plan and evaluation counts');
  check(currentReadiness.truth.currentExperimentAutomaticallyRequired === false
    && currentReadiness.truth.currentBestAction === (currentReadiness.current.actionableDirectionCount
      ? 'EXPLICIT_STEWARD_REVIEW_BEFORE_OPTIONAL_CHALLENGER_PLAN'
      : 'WAIT_FOR_EVIDENCE'),
  'readiness derives a bounded review or wait without manufacturing an experiment requirement');

  const evaluatedReadinessInput = {
    readinessId: 'challenger-readiness-evaluated-fixture',
    generatedAt: '2026-08-19T13:00:09.750Z',
    directionHandoff,
    directionReadiness: directionReadinessFor(directionHandoff),
    shadowContract,
    diagnosticContract,
    plans: [plan],
    evaluations: [evaluation]
  };
  const evaluatedReadiness = Lab.buildReadiness(evaluatedReadinessInput);
  check(Lab.verifyReadiness(evaluatedReadiness, evaluatedReadinessInput).pass, 'evaluated challenger readiness verifies by exact rebuild');
  check(evaluatedReadiness.state === 'LAB_EVALUATION_PRESENT_FOR_EXPLICIT_REVIEW' && evaluatedReadiness.current.challengerEvaluationCount === 1, 'supplied evaluation becomes an explicit review state');
  check(evaluatedReadiness.truth.broadLearningClaimed === false && evaluatedReadiness.truth.humanBenefitEstablished === false, 'evaluation readiness claims neither broad learning nor human benefit');

  const readinessAncestryTamper = clone(currentReadinessInput);
  readinessAncestryTamper.directionReadiness.sourceRefs.directionHandoff.sha256 = 'sha256:' + '0'.repeat(64);
  const readinessPayload = clone(readinessAncestryTamper.directionReadiness);
  delete readinessPayload.receiptDigest;
  readinessAncestryTamper.directionReadiness.receiptDigest = Lab.sha256(readinessPayload);
  assert.throws(() => Lab.buildReadiness(readinessAncestryTamper), /ancestry mismatch/);
  checks += 1; console.log('PASS challenger readiness refuses a self-consistent direction ancestry mismatch');

  const missingPlanForEvaluation = clone(evaluatedReadinessInput);
  missingPlanForEvaluation.plans = [];
  assert.throws(() => Lab.buildReadiness(missingPlanForEvaluation), /lacks its exact supplied plan/);
  checks += 1; console.log('PASS challenger readiness refuses an evaluation without its exact supplied plan');

  const readinessReceiptTamper = clone(currentReadiness);
  readinessReceiptTamper.truth.broadLearningClaimed = true;
  check(!Lab.verifyReadiness(readinessReceiptTamper, currentReadinessInput).pass, 'challenger readiness cannot be silently changed into a broad-learning claim');

  assert.throws(() => Lab.buildPlan({
    planId: 'illegal-wait-plan', generatedAt: '2026-08-19T13:00:10.000Z',
    directionHandoff: wait, directionId: waitDirectionId, baselineRef, challengerRef,
    caseManifestId: 'illegal-wait-cases', cases: cases(), budget: { maxCases: 3, maxWallMs: 5000, maxOperations: 4 }
  }), /WAIT_FOR_EVIDENCE cannot create a challenger plan/);
  checks += 1; console.log('PASS WAIT_FOR_EVIDENCE direction cannot create a challenger experiment');

  const missingHeldOut = cases();
  missingHeldOut[1].exposure = 'DESIGN_VISIBLE';
  assert.throws(() => Lab.buildPlan({
    planId: 'missing-held-out-plan', generatedAt: '2026-08-19T13:00:11.000Z',
    directionHandoff, directionId, baselineRef, challengerRef,
    caseManifestId: 'missing-held-out-cases', cases: missingHeldOut, budget: { maxCases: 3, maxWallMs: 5000, maxOperations: 4 }
  }), /held-out AI_WORKFLOW/);
  checks += 1; console.log('PASS plan without held-out AI-workflow evidence is refused');

  assert.throws(() => Lab.buildPlan({
    planId: 'same-artifact-plan', generatedAt: '2026-08-19T13:00:12.000Z',
    directionHandoff, directionId, baselineRef, challengerRef: baselineRef,
    caseManifestId: 'same-artifact-cases', cases: cases(), budget: { maxCases: 3, maxWallMs: 5000, maxOperations: 4 }
  }), /challenger must differ/);
  checks += 1; console.log('PASS identical baseline and challenger are refused');

  const authorityTamper = clone(shadow);
  authorityTamper.canonicalStateTouched = true;
  resealToolReceipt(authorityTamper);
  assert.throws(() => Lab.buildEvaluation({
    evaluationId: 'authority-tamper', generatedAt: '2026-08-19T13:00:13.000Z',
    plan, shadowReceipt: authorityTamper, caseResults: resultPairs
  }), /authority boundary/);
  checks += 1; console.log('PASS shadow receipt claiming canonical mutation is refused');

  const subjectTamperPairs = clone(resultPairs);
  subjectTamperPairs[0].challengerReceipt.result.subjectDigest = baselineRef.sha256;
  resealToolReceipt(subjectTamperPairs[0].challengerReceipt);
  assert.throws(() => Lab.buildEvaluation({
    evaluationId: 'subject-tamper', generatedAt: '2026-08-19T13:00:14.000Z',
    plan, shadowReceipt: shadow, caseResults: subjectTamperPairs
  }), /diagnostic subject mismatch/);
  checks += 1; console.log('PASS diagnostic receipt for the wrong subject is refused');

  const acceptedTamper = clone(evaluation);
  acceptedTamper.adoptionState = 'AUTHORIZED';
  check(!Lab.verifyEvaluation(acceptedTamper).pass, 'evaluation cannot be silently changed into adoption authority');

  const planTamper = clone(plan);
  planTamper.directionHandoff.directions[0].direction.steward_status = 'ACCEPTED';
  check(!Lab.verifyPlan(planTamper).pass, 'accepted-direction tamper invalidates the challenger plan');

  check(evaluation.truth.automaticExecution === false && evaluation.truth.automaticWrite === false && evaluation.truth.automaticCanon === false, 'evaluation carries no automatic execution, write or CANON authority');
  console.log('Grounded Growth challenger lab selftest passed: ' + checks + ' checks.');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
