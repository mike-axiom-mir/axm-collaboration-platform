#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EVALUATION_SCHEMA = 'axm.ai-workflow-evaluation/v1';
const SUMMARY_SCHEMA = 'axm.grounded-growth-current-refresh-summary/v1';
const BASELINE_EVALUATION_AT = '2026-08-19T10:20:00.000Z';
const PACKAGE_EVALUATION_AT = '2026-08-19T10:20:01.000Z';
const BASELINE_OUTCOME_AT = '2026-08-19T10:20:02.000Z';
const PACKAGE_OUTCOME_AT = '2026-08-19T10:20:03.000Z';
const PORTFOLIO_AT = '2026-08-19T10:20:04.000Z';

const FILES = {
  baselineFixtures: path.join(__dirname, 'BASELINE_WORKFLOW_CASES.json'),
  packageFixtures: path.join(__dirname, 'PACKAGE_ROUTE_WORKFLOW_CASES.json'),
  builder: __filename,
  priorPortfolio: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-research-ai-workflow-evaluation', 'CURRENT_PORTFOLIO.json'),
  baselineImplementation: path.join(ROOT, 'shared', 'baseline-simulation-lab', 'baseline-simulation-lab.js'),
  packageImplementation: path.join(ROOT, 'tests', 'tool-forge-package-test.js')
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exactFileReference(file, id, schema) {
  return { id, schema, sha256: Growth.sha256(fs.readFileSync(file)) };
}

function sourceReference(sourcePath) {
  const file = path.resolve(ROOT, sourcePath);
  const rooted = path.relative(ROOT, file);
  if (!rooted || rooted.startsWith('..') || path.isAbsolute(rooted)) throw new Error('case source escapes Workshop: ' + sourcePath);
  if (!fs.statSync(file).isFile()) throw new Error('case source is not a file: ' + sourcePath);
  const extension = path.extname(file).toLowerCase();
  return exactFileReference(file, 'case-source:' + sourcePath.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), extension === '.json' ? 'application/json' : extension === '.js' ? 'text/javascript' : 'text/markdown');
}

function requestDrivenBaselineDecision() {
  return { decision: 'RUN_BOUNDED', ruleId: 'REQUEST_DRIVEN_REGENERATE' };
}

function changeGatedDecision(facts) {
  if (facts.sameSubject === false) return { decision: 'HOLD_INCOMPARABLE', ruleId: 'SUBJECT_MISMATCH_IS_INCOMPARABLE' };
  if (facts.exactBaselineUnchanged === false && facts.declaredNewInformation !== true) return { decision: 'HOLD_CHANGED_WITHOUT_INFORMATION', ruleId: 'BASELINE_CHANGE_REQUIRES_INFORMATION' };
  if (facts.exactBaselineUnchanged === false && facts.declaredNewInformation === true) return { decision: 'RUN_BOUNDED', ruleId: 'BASELINE_CHANGE_WITH_INFORMATION_RUNS' };
  if (facts.newCounterexample && facts.declaredNewInformation) return { decision: 'RUN_BOUNDED', ruleId: 'NEW_COUNTEREXAMPLE_RUNS' };
  if (facts.newRequirement && facts.declaredNewInformation) return { decision: 'RUN_BOUNDED', ruleId: 'NEW_REQUIREMENT_RUNS' };
  if (facts.repeatedAgreementOnly && !facts.declaredNewInformation) return { decision: 'STOP_NO_NEW_INFORMATION', ruleId: 'AGREEMENT_IS_NOT_NEW_INFORMATION' };
  if (facts.restatedKnownRequirementOnly && !facts.declaredNewInformation) return { decision: 'STOP_NO_NEW_INFORMATION', ruleId: 'RESTATEMENT_IS_NOT_NEW_INFORMATION' };
  if (facts.exactBaselineUnchanged === true && facts.declaredNewInformation !== true) return { decision: 'STOP_NO_NEW_INFORMATION', ruleId: 'EXACT_NO_NEW_INFORMATION_STOP' };
  return { decision: 'HOLD_UNRESOLVED', ruleId: 'NO_UNGROUNDED_RUN' };
}

function hostTempBaselineDecision(item) {
  const facts = item.facts;
  if (item.phase === 'ROUTE') {
    if (facts.userPersistentOutput && facts.userSelectedDestination) return { decision: 'USE_USER_SELECTED_DESTINATION', ruleId: 'USER_OUTPUT_REMAINS_USER_ROUTED' };
    return { decision: 'ROUTE_HOST_TEMP', ruleId: 'HOST_TEMP_DEFAULT' };
  }
  if (facts.executionExitCode !== 0) return { decision: 'HOLD_FOR_FAILED_PROOF', ruleId: 'FAILED_PROCESS_HOLD' };
  return { decision: 'COMPLETE_VERIFIED_UNINSTALLED', ruleId: 'EXIT_ZERO_EQUALS_COMPLETE' };
}

function workspaceRouteDecision(item) {
  const facts = item.facts;
  if (item.phase === 'ROUTE') {
    if (facts.userPersistentOutput && facts.userSelectedDestination) return { decision: 'USE_USER_SELECTED_DESTINATION', ruleId: 'USER_OUTPUT_REMAINS_USER_ROUTED' };
    if (facts.transientTechnicalProof && (facts.workingDirectoryDrive || facts.tempEnvironmentDrive)) return { decision: 'ROUTE_WORKSPACE_SCRATCH', ruleId: 'TRANSIENT_PROOF_IGNORES_HOST_TEMP_REDIRECTION' };
    if (facts.transientTechnicalProof) return { decision: 'ROUTE_WORKSPACE_SCRATCH', ruleId: 'TRANSIENT_PROOF_FOLLOWS_WORKSPACE' };
    return { decision: 'HOLD_UNROUTED', ruleId: 'NO_IMPLICIT_OUTPUT_DESTINATION' };
  }
  if (facts.executionExitCode !== 0) return { decision: 'HOLD_FOR_FAILED_PROOF', ruleId: 'FAILED_PROOF_BLOCKS_COMPLETION' };
  if (!facts.pathInsideWorkspaceScratch) return { decision: 'HOLD_FOR_PATH_ESCAPE', ruleId: 'WORKSPACE_ESCAPE_BLOCKS_COMPLETION' };
  if (!facts.cleanupComplete) return { decision: 'HOLD_FOR_CLEANUP', ruleId: 'LEFTOVER_TRANSIENT_STATE_BLOCKS_COMPLETION' };
  if (facts.writeVerified && facts.installed === false) return { decision: 'COMPLETE_VERIFIED_UNINSTALLED', ruleId: 'COMPLETE_REQUIRES_VERIFIED_CLEAN_STATE' };
  return { decision: 'HOLD_UNVERIFIED', ruleId: 'UNVERIFIED_PROOF_BLOCKS_COMPLETION' };
}

function validateFixtures(fixtures, expectedWorkflow) {
  assert.strictEqual(fixtures.schema, 'axm.steward-workflow-case-set/v1');
  assert.strictEqual(fixtures.status, 'TEST');
  assert.strictEqual(fixtures.workflow, expectedWorkflow);
  assert.ok(Array.isArray(fixtures.cases) && fixtures.cases.length === 8, 'eight cases required for ' + fixtures.caseSetId);
  assert.strictEqual(new Set(fixtures.cases.map(item => item.id)).size, 8, 'case ids must be unique');
  assert.strictEqual(fixtures.truth.modelInvoked, false);
  assert.strictEqual(fixtures.truth.humanParticipant, false);
  for (const item of fixtures.cases) {
    assert.ok(item.id && item.sourcePath && item.facts && item.expectedDecision && item.expectedRule, 'incomplete case: ' + item.id);
    sourceReference(item.sourcePath);
  }
}

function buildEvaluation(kind) {
  const isBaseline = kind === 'BASELINE_CHANGE_GATE';
  if (!isBaseline && kind !== 'PACKAGE_WORKSPACE_ROUTE') throw new Error('unknown evaluation kind: ' + kind);
  const fixtureFile = isBaseline ? FILES.baselineFixtures : FILES.packageFixtures;
  const fixtures = readJson(fixtureFile);
  const expectedWorkflow = isBaseline
    ? 'Decide whether an AI-assisted baseline simulation workflow should stop, run one bounded cycle, or hold.'
    : 'Decide where a technical package proof belongs and whether its lifecycle may be called complete.';
  validateFixtures(fixtures, expectedWorkflow);
  const fixtureRef = Growth.reference(fixtures, { id: fixtures.caseSetId, schema: fixtures.schema });
  const builderRef = exactFileReference(FILES.builder, 'ai-workflow-coverage-evaluator', 'text/javascript');
  const implementationRef = exactFileReference(
    isBaseline ? FILES.baselineImplementation : FILES.packageImplementation,
    isBaseline ? 'baseline-simulation-lab-implementation' : 'workspace-local-package-proof-implementation',
    'text/javascript'
  );
  const sourceRefsByDigest = new Map();
  const cases = fixtures.cases.map(item => {
    const sourceRef = sourceReference(item.sourcePath);
    sourceRefsByDigest.set(sourceRef.sha256, sourceRef);
    const baseline = isBaseline ? requestDrivenBaselineDecision(item.facts) : hostTempBaselineDecision(item);
    const candidate = isBaseline ? changeGatedDecision(item.facts) : workspaceRouteDecision(item);
    return {
      id: item.id,
      sourceRef,
      phase: item.phase || 'DECIDE',
      expectedDecision: item.expectedDecision,
      expectedRule: item.expectedRule,
      baselineDecision: baseline.decision,
      baselineRule: baseline.ruleId,
      candidateDecision: candidate.decision,
      candidateRule: candidate.ruleId,
      baselineCorrect: baseline.decision === item.expectedDecision,
      candidateCorrect: candidate.decision === item.expectedDecision && candidate.ruleId === item.expectedRule
    };
  });
  const baseline = {
    policyId: isBaseline ? 'REQUEST_DRIVEN_REGENERATE' : 'HOST_TEMP_AND_EXIT_ZERO_SHORTCUTS',
    description: isBaseline
      ? 'A declared comparison policy runs another bounded cycle whenever a simulation request arrives, without exact change gating.'
      : 'A declared comparison policy routes transient proof through host temp and treats exit zero as completion without workspace, readback, cleanup, or path checks.',
    correctDecisions: cases.filter(item => item.baselineCorrect).length,
    totalDecisions: cases.length,
    unsupportedUnsafeOrWastefulDecisions: cases.filter(item => !item.baselineCorrect).length
  };
  const outcome = {
    policyId: isBaseline ? 'EXACT_CHANGE_GATED_BASELINE_WORKFLOW' : 'WORKSPACE_LOCAL_VERIFIED_LIFECYCLE_WORKFLOW',
    description: isBaseline
      ? 'The guard stops exact no-change cases, runs only on declared new information, and holds changed-without-information or incomparable subjects.'
      : 'The guard separates user outputs from transient proof, follows the workspace, and requires verified clean uninstalled state before completion.',
    correctDecisions: cases.filter(item => item.candidateCorrect).length,
    totalDecisions: cases.length,
    unsupportedUnsafeOrWastefulDecisions: cases.filter(item => !item.candidateCorrect).length,
    newlyCorrectedDecisions: cases.filter(item => !item.baselineCorrect && item.candidateCorrect).length
  };
  const verdict = outcome.correctDecisions === cases.length && outcome.unsupportedUnsafeOrWastefulDecisions === 0 && outcome.correctDecisions > baseline.correctDecisions ? 'PASS' : 'FAIL';
  const receipt = {
    schema: EVALUATION_SCHEMA,
    version: '0.1.0',
    evaluationId: isBaseline ? 'baseline-change-gated-ai-workflow-20260819' : 'workspace-local-package-ai-workflow-20260819',
    generatedAt: isBaseline ? BASELINE_EVALUATION_AT : PACKAGE_EVALUATION_AT,
    beneficiary: 'AI_WORKFLOW',
    workflow: expectedWorkflow,
    proofSurface: 'AI_WORKFLOW_EVALUATION',
    fixturePolicy: fixtures.fixturePolicy,
    inputRefs: [fixtureRef, builderRef, implementationRef, ...Array.from(sourceRefsByDigest.values())],
    baseline,
    outcome,
    cases,
    verdict,
    limitations: isBaseline ? [
      'No language model was invoked; this proves a deterministic change-gated workflow guard, not model learning, intelligence, provider behavior, or broad generalization.',
      'The eight cases are representative Workshop situations, not a statistically sampled or independently blinded benchmark.',
      'The request-driven baseline is a declared comparison policy, not a claim about any named model or the current AXM steward.',
      'The result does not establish human benefit, live Mirror or specialist-mask effectiveness, availability, promotion, merge, or CANON.'
    ] : [
      'No language model was invoked; this proves a deterministic package-proof routing workflow, not model learning, intelligence, provider behavior, or broad generalization.',
      'The eight cases cover the repository-required Node proof only; browser, application, and user-selected download behavior remains outside the transient route.',
      'The host-temp baseline is a declared comparison policy, not a claim about any named model or the current AXM steward.',
      'Historical C-temp residue remains a separate retention decision and this result does not establish human benefit, availability, promotion, merge, or CANON.'
    ],
    truth: {
      modelInvoked: false,
      modelWeightsChanged: false,
      modelGeneralizationClaimed: false,
      humanParticipant: false,
      humanBenefitClaimed: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = Growth.sha256(payload);
  return receipt;
}

function verifyEvaluation(receipt, kind) {
  const current = buildEvaluation(kind);
  return { pass: Growth.stableStringify(current) === Growth.stableStringify(receipt), expectedDigest: current.receiptDigest, actualDigest: receipt && receipt.receiptDigest };
}

function closure(id, checkedAt, refs) {
  const coveredDigests = Array.from(new Set(refs.map(ref => ref.sha256))).sort();
  return {
    state: 'CURRENT',
    checkedAt,
    receiptRef: Growth.reference({ id, coveredDigests }, { id, schema: 'axm.evidence-closure-receipt/v1' }),
    coveredDigests
  };
}

function linkedOutcome(prior, evaluation, fixtures, options) {
  const baselineRef = Growth.reference(evaluation.baseline, { id: options.prefix + '-workflow-baseline', schema: 'axm.ai-workflow-evaluation-baseline/v1' });
  const outcomeRef = Growth.reference(evaluation.outcome, { id: options.prefix + '-workflow-outcome', schema: 'axm.ai-workflow-evaluation-outcome/v1' });
  const evaluationRef = Growth.reference(evaluation, { id: evaluation.evaluationId, schema: evaluation.schema });
  const fixtureRef = Growth.reference(fixtures, { id: fixtures.caseSetId, schema: fixtures.schema });
  const builderRef = exactFileReference(FILES.builder, 'ai-workflow-coverage-evaluator', 'text/javascript');
  const implementationRef = exactFileReference(options.implementationFile, options.implementationId, 'text/javascript');
  const evidenceRefs = [evaluationRef, fixtureRef, builderRef, implementationRef];
  const aiClosure = closure(options.closureId, options.generatedAt, [baselineRef, outcomeRef, ...evidenceRefs]);
  const priorSystemClaim = prior.claims.find(claim => claim.beneficiary === 'SHARED_SYSTEM');
  const priorHumanClaim = prior.claims.find(claim => claim.beneficiary === 'HUMAN');
  assert.ok(priorSystemClaim && priorSystemClaim.admittedVerdict === 'PASS', 'prior system effect must be admitted');
  assert.ok(priorHumanClaim && priorHumanClaim.verdict === 'NOT_RUN', 'prior human boundary must remain NOT_RUN');
  const receipt = Growth.buildOutcome({
    outcomeId: options.outcomeId,
    generatedAt: options.generatedAt,
    cycleReceipt: prior.cycleReceipt,
    interventionRef: implementationRef,
    previousOutcomeRef: { id: prior.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: prior.receiptDigest },
    noNewInformation: false,
    informationRefs: evidenceRefs,
    claims: [
      priorSystemClaim,
      priorHumanClaim,
      {
        id: options.claimId,
        beneficiary: 'AI_WORKFLOW',
        statement: options.statement,
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'PASS',
        proofSurface: 'AI_WORKFLOW_EVALUATION',
        baselineRef,
        outcomeRef,
        evidenceRefs,
        evidenceClosure: aiClosure,
        limitations: evaluation.limitations
      }
    ],
    refresh: {
      checkedAt: options.generatedAt,
      due: false,
      reason: options.refreshReason
    }
  });
  return { receipt, evaluationRef };
}

function build() {
  const priorPortfolio = readJson(FILES.priorPortfolio);
  assert.ok(Growth.verifyPortfolio(priorPortfolio).pass, 'prior current portfolio must verify');
  const baselinePrior = priorPortfolio.outcomes.find(outcome => outcome.outcomeId === 'grounded-growth-baseline-no-new-stop-20260819');
  const packagePrior = priorPortfolio.outcomes.find(outcome => outcome.outcomeId === 'grounded-growth-workspace-local-package-proof-20260819');
  assert.ok(baselinePrior && packagePrior, 'both prior AI-workflow gaps must exist');
  assert.ok(priorPortfolio.latest.some(item => item.capabilityId === baselinePrior.capabilityId && item.outcomeId === baselinePrior.outcomeId), 'baseline prior must be latest in its chain');
  assert.ok(priorPortfolio.latest.some(item => item.capabilityId === packagePrior.capabilityId && item.outcomeId === packagePrior.outcomeId), 'package prior must be latest in its chain');

  const baselineEvaluation = buildEvaluation('BASELINE_CHANGE_GATE');
  const packageEvaluation = buildEvaluation('PACKAGE_WORKSPACE_ROUTE');
  assert.strictEqual(baselineEvaluation.verdict, 'PASS');
  assert.strictEqual(packageEvaluation.verdict, 'PASS');
  const baselineFixtures = readJson(FILES.baselineFixtures);
  const packageFixtures = readJson(FILES.packageFixtures);
  const baselineLinked = linkedOutcome(baselinePrior, baselineEvaluation, baselineFixtures, {
    prefix: 'baseline-change-gated',
    implementationFile: FILES.baselineImplementation,
    implementationId: 'baseline-simulation-lab-implementation',
    closureId: 'baseline-change-gated-ai-workflow-closure',
    outcomeId: 'grounded-growth-baseline-ai-workflow-20260819',
    generatedAt: BASELINE_OUTCOME_AT,
    claimId: 'baseline-change-gated-ai-workflow-benefit',
    statement: 'A deterministic AI-assisted baseline workflow makes correct stop, run, and hold decisions on eight representative change scenarios, improving from 3/8 request-driven baseline decisions to 8/8 and reducing unsupported, unsafe, or wasteful decisions from five to zero.',
    refreshReason: 'Rebuild if the baseline workflow cases, change-gating rules, implementation, prior ancestry, or source receipts change.'
  });
  const packageLinked = linkedOutcome(packagePrior, packageEvaluation, packageFixtures, {
    prefix: 'workspace-local-package',
    implementationFile: FILES.packageImplementation,
    implementationId: 'workspace-local-package-proof-implementation',
    closureId: 'workspace-local-package-ai-workflow-closure',
    outcomeId: 'grounded-growth-package-route-ai-workflow-20260819',
    generatedAt: PACKAGE_OUTCOME_AT,
    claimId: 'workspace-local-package-ai-workflow-benefit',
    statement: 'A deterministic AI-assisted package-proof workflow makes correct routing and completion decisions on eight representative scenarios, improving from 3/8 host-temp shortcut decisions to 8/8 and reducing unsupported, unsafe, or wasteful decisions from five to zero.',
    refreshReason: 'Rebuild if package routing cases, test implementation, cleanup contract, prior ancestry, or source receipts change.'
  });

  const portfolio = Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current-ai-workflow-coverage-20260819',
    generatedAt: PORTFOLIO_AT,
    outcomes: [...priorPortfolio.outcomes, baselineLinked.receipt, packageLinked.receipt]
  });
  const effectiveOutcomes = portfolio.latest.map(item => portfolio.outcomes.find(outcome => outcome.outcomeId === item.effectiveOutcomeId));
  const effectiveClaims = effectiveOutcomes.flatMap(outcome => outcome.claims);
  const beneficiaryVerdicts = {};
  for (const claim of effectiveClaims) {
    const key = claim.beneficiary + ':' + claim.admittedVerdict;
    beneficiaryVerdicts[key] = (beneficiaryVerdicts[key] || 0) + 1;
  }
  const aiNeeds = portfolio.latest.filter(item => item.nextEvidenceNeeds.includes('AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE'));
  const summary = {
    schema: SUMMARY_SCHEMA,
    generatedAt: PORTFOLIO_AT,
    portfolioRef: { id: portfolio.portfolioId, schema: portfolio.schema, sha256: portfolio.portfolioDigest },
    priorPortfolioRef: { id: priorPortfolio.portfolioId, schema: priorPortfolio.schema, sha256: priorPortfolio.portfolioDigest },
    evaluationRefs: [baselineLinked.evaluationRef, packageLinked.evaluationRef],
    latestOutcomeRefs: [baselineLinked.receipt, packageLinked.receipt].map(receipt => ({ id: receipt.outcomeId, schema: receipt.schema, sha256: receipt.receiptDigest })),
    capabilityCount: portfolio.summary.capabilityCount,
    outcomeCount: portfolio.summary.outcomeCount,
    overall: portfolio.summary.overall,
    stateCounts: portfolio.summary.stateCounts,
    effectiveBeneficiaryVerdicts: beneficiaryVerdicts,
    systemEffectsAdmitted: effectiveClaims.filter(claim => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS').length,
    aiWorkflowBenefitsAdmitted: effectiveClaims.filter(claim => claim.beneficiary === 'AI_WORKFLOW' && claim.admittedVerdict === 'PASS').length,
    humanBenefitsAdmitted: effectiveClaims.filter(claim => claim.beneficiary === 'HUMAN' && claim.admittedVerdict === 'PASS').length,
    remainingAiWorkflowNativeEvidenceNeeds: aiNeeds.map(item => item.capabilityId),
    nextEvidenceNeeds: Array.from(new Set(portfolio.latest.flatMap(item => item.nextEvidenceNeeds))).sort(),
    truth: {
      portfolioIsDerivedView: true,
      allCurrentCapabilityChainsHaveAdmittedAiWorkflowOutcome: aiNeeds.length === 0,
      modelOrWeightImprovementClaimed: false,
      crossModelAgreementTreatedAsProof: false,
      technicalSystemEffectIsHumanBenefit: false,
      humanBenefitEstablished: false,
      voluntaryHumanGateTouched: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    summaryDigest: null
  };
  const payload = clone(summary);
  delete payload.summaryDigest;
  summary.summaryDigest = Growth.sha256(payload);
  return {
    baselineEvaluation,
    packageEvaluation,
    baselineOutcome: baselineLinked.receipt,
    packageOutcome: packageLinked.receipt,
    portfolio,
    summary
  };
}

function verifyRecorded() {
  const current = build();
  const recorded = {
    baselineEvaluation: readJson(path.join(__dirname, 'BASELINE_AI_WORKFLOW_EVALUATION.json')),
    packageEvaluation: readJson(path.join(__dirname, 'PACKAGE_ROUTE_AI_WORKFLOW_EVALUATION.json')),
    baselineOutcome: readJson(path.join(__dirname, 'BASELINE_AI_WORKFLOW_OUTCOME.json')),
    packageOutcome: readJson(path.join(__dirname, 'PACKAGE_ROUTE_AI_WORKFLOW_OUTCOME.json')),
    portfolio: readJson(path.join(__dirname, 'CURRENT_PORTFOLIO.json')),
    summary: readJson(path.join(__dirname, 'CURRENT_SUMMARY.json'))
  };
  assert.ok(verifyEvaluation(recorded.baselineEvaluation, 'BASELINE_CHANGE_GATE').pass, 'recorded baseline evaluation differs from a fresh rebuild');
  assert.ok(verifyEvaluation(recorded.packageEvaluation, 'PACKAGE_WORKSPACE_ROUTE').pass, 'recorded package evaluation differs from a fresh rebuild');
  assert.deepStrictEqual(recorded, current, 'recorded coverage artifacts differ from a fresh read-only rebuild');
  return current.summary;
}

if (require.main === module) {
  try {
    if (process.argv.includes('--check-recorded')) {
      process.stdout.write(JSON.stringify(verifyRecorded(), null, 2) + '\n');
    } else {
      const result = build();
      const artifactIndex = process.argv.indexOf('--artifact');
      const key = artifactIndex >= 0 ? process.argv[artifactIndex + 1] : null;
      if (key && !Object.prototype.hasOwnProperty.call(result, key)) throw new Error('unknown artifact: ' + key);
      process.stdout.write(JSON.stringify(key ? result[key] : result, null, 2) + '\n');
    }
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  EVALUATION_SCHEMA,
  requestDrivenBaselineDecision,
  changeGatedDecision,
  hostTempBaselineDecision,
  workspaceRouteDecision,
  buildEvaluation,
  verifyEvaluation,
  build,
  verifyRecorded
};
