#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EVALUATION_SCHEMA = 'axm.ai-workflow-evaluation/v1';
const SUMMARY_SCHEMA = 'axm.grounded-growth-current-refresh-summary/v1';
const GENERATED_AT = '2026-08-19T09:58:00.000Z';
const OUTCOME_AT = '2026-08-19T09:58:01.000Z';
const PORTFOLIO_AT = '2026-08-19T09:58:02.000Z';

const FILES = {
  fixtures: path.join(__dirname, 'HELD_OUT_CASES.json'),
  builder: __filename,
  researchDisposition: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run', 'RESEARCH_DISPOSITION.json'),
  priorPortfolio: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-grounded-growth-current-refresh', 'CURRENT_PORTFOLIO.json'),
  priorResearchOutcome: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-grounded-growth-current-refresh', 'PUBLIC_RESEARCH_OUTCOME.json')
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function exactFileReference(file, id, schema) {
  return {
    id,
    schema,
    sha256: Growth.sha256(fs.readFileSync(file))
  };
}

function sourceReference(sourcePath) {
  const file = path.resolve(ROOT, sourcePath);
  const rooted = path.relative(ROOT, file);
  if (!rooted || rooted.startsWith('..') || path.isAbsolute(rooted)) throw new Error('case source escapes Workshop: ' + sourcePath);
  if (!fs.statSync(file).isFile()) throw new Error('case source is not a file: ' + sourcePath);
  const extension = path.extname(file).toLowerCase();
  return exactFileReference(file, 'case-source:' + sourcePath.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), extension === '.json' ? 'application/json' : 'text/markdown');
}

function baselineDecision(facts) {
  if (facts.campaignOrRoadmapArtifact) return { decision: 'CONTINUE_WITH_CLAIM', ruleId: 'STATUS_OR_ARTIFACT_SHORTCUT' };
  if (facts.declarationPresent) return { decision: 'ACCEPT_DECLARATION', ruleId: 'LATEST_DECLARATION_SHORTCUT' };
  if (facts.sameHighLevelGoal) return { decision: facts.exactNeedIdentitySame ? 'SUPPRESS_EXACT_DUPLICATE' : 'SUPPRESS_AS_DUPLICATE', ruleId: 'GOAL_LABEL_DEDUPLICATION' };
  if (facts.proposalPresent) return { decision: 'BUILD_NEW', ruleId: 'PROPOSAL_FIRST_BUILD' };
  if (facts.humanEvaluationVerdict === 'PASS') return { decision: 'ADMIT_HUMAN_PASS', ruleId: 'VERDICT_LABEL_SHORTCUT' };
  if (facts.candidateVerification === 'PASS') return { decision: 'PROMOTE', ruleId: 'VERIFICATION_EQUALS_AUTHORITY' };
  if (facts.registeredSourceClosure === 'CURRENT') return { decision: 'CONTINUE', ruleId: 'CURRENT_CLOSURE_CAN_CONTINUE' };
  return { decision: 'CONTINUE_UNRESOLVED', ruleId: 'DEFAULT_CONTINUE' };
}

function groundedDecision(facts) {
  if (facts.campaignOrRoadmapArtifact && !facts.nativeLaunchEvidence) return { decision: 'WAIT_FOR_EVIDENCE', ruleId: 'CLAIM_NATIVE_EVIDENCE' };
  if (facts.contradictoryVerifiedState) return { decision: 'REPAIR_OR_VERIFY', ruleId: 'CONTRADICTION_REQUIRES_REPAIR' };
  if (facts.sameHighLevelGoal && facts.exactNeedIdentitySame === false) return { decision: 'PRESERVE_BOTH', ruleId: 'EXACT_IDENTITY_BEFORE_DEDUPLICATION' };
  if (facts.proposalPresent && facts.existingCapabilityMatch === 'EXACT') return { decision: 'REUSE_EXISTING', ruleId: 'REUSE_BEFORE_BUILD' };
  if (facts.humanEvaluationVerdict === 'PASS' && facts.humanEvidenceMode !== 'LIVE') return { decision: 'REFUSE_AS_HUMAN_EVIDENCE', ruleId: 'VOLUNTARY_HUMAN_EVIDENCE' };
  if (facts.candidateVerification === 'PASS' && facts.humanStewardDecision !== true) return { decision: 'AWAIT_STEWARD', ruleId: 'HUMAN_STEWARD_GATE' };
  if (facts.sameHighLevelGoal && facts.exactNeedIdentitySame === true && facts.activeCoverage === true) return { decision: 'SUPPRESS_EXACT_DUPLICATE', ruleId: 'EXACT_ACTIVE_NEED_DEDUPLICATION' };
  if (facts.registeredSourceClosure === 'CURRENT') return { decision: 'CONTINUE', ruleId: 'CURRENT_CLOSURE_CAN_CONTINUE' };
  return { decision: 'HOLD_UNRESOLVED', ruleId: 'NO_UNGROUNDED_CONTINUE' };
}

function validateFixtures(fixtures) {
  assert.strictEqual(fixtures.schema, 'axm.steward-workflow-case-set/v1');
  assert.strictEqual(fixtures.status, 'TEST');
  assert.ok(Array.isArray(fixtures.cases) && fixtures.cases.length === 8, 'eight representative cases are required');
  assert.strictEqual(new Set(fixtures.cases.map(item => item.id)).size, fixtures.cases.length, 'case ids must be unique');
  assert.strictEqual(fixtures.truth.modelInvoked, false);
  assert.strictEqual(fixtures.truth.humanParticipant, false);
  for (const item of fixtures.cases) {
    assert.ok(item.id && item.sourcePath && item.expectedDecision && item.expectedRule && item.facts, 'case is incomplete: ' + item.id);
    sourceReference(item.sourcePath);
  }
}

function buildEvaluation() {
  const fixtures = readJson(FILES.fixtures);
  validateFixtures(fixtures);
  const fixtureRef = Growth.reference(fixtures, { id: fixtures.caseSetId, schema: fixtures.schema });
  const dispositionRef = exactFileReference(FILES.researchDisposition, 'public-baseline-research-disposition', 'axm.research-disposition/v1');
  const builderRef = exactFileReference(FILES.builder, 'research-ai-workflow-evaluator', 'text/javascript');
  const sourceRefsByDigest = new Map();

  const cases = fixtures.cases.map((item) => {
    const sourceRef = sourceReference(item.sourcePath);
    sourceRefsByDigest.set(sourceRef.sha256, sourceRef);
    const baseline = baselineDecision(item.facts);
    const candidate = groundedDecision(item.facts);
    return {
      id: item.id,
      sourceRef,
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
    policyId: 'STATUS_CONSENSUS_AND_LABEL_SHORTCUTS',
    description: 'A bounded legacy shortcut accepts declarations, verdict labels, verification labels, proposals, or high-level goal overlap without the needed native evidence and authority checks.',
    correctDecisions: cases.filter(item => item.baselineCorrect).length,
    totalDecisions: cases.length,
    unsupportedOrUnsafeDecisions: cases.filter(item => !item.baselineCorrect).length
  };
  const outcome = {
    policyId: 'GROUNDED_RESEARCH_STEWARD_GUARD',
    description: 'The guard routes claims to native evidence, preserves contradictions and distinct needs, reuses exact capabilities, refuses synthetic human evidence, and preserves the human steward gate.',
    correctDecisions: cases.filter(item => item.candidateCorrect).length,
    totalDecisions: cases.length,
    unsupportedOrUnsafeDecisions: cases.filter(item => !item.candidateCorrect).length,
    newlyCorrectedDecisions: cases.filter(item => !item.baselineCorrect && item.candidateCorrect).length
  };
  const verdict = outcome.correctDecisions === cases.length && outcome.unsupportedOrUnsafeDecisions === 0 && outcome.correctDecisions > baseline.correctDecisions ? 'PASS' : 'FAIL';
  const receipt = {
    schema: EVALUATION_SCHEMA,
    version: '0.1.0',
    evaluationId: 'grounded-research-steward-guard-20260819',
    generatedAt: GENERATED_AT,
    beneficiary: 'AI_WORKFLOW',
    workflow: 'Bounded AI-assisted steward routing across claim, contradiction, reuse, deduplication, human-evidence, lifecycle, and evidence-closure situations.',
    proofSurface: 'AI_WORKFLOW_EVALUATION',
    fixturePolicy: fixtures.fixturePolicy,
    inputRefs: [dispositionRef, fixtureRef, builderRef, ...Array.from(sourceRefsByDigest.values())],
    baseline,
    outcome,
    cases,
    verdict,
    limitations: [
      'No language model was invoked; this evaluates a deterministic guard for an AI-assisted workflow, not a model, provider, model weights, intelligence, or generalization.',
      'The eight fixtures are representative existing Workshop situations, not a statistically sampled or independently blinded benchmark.',
      'The baseline is an explicit shortcut policy used for comparison, not a claim about any named model or the current AXM steward implementation.',
      'Passing these cases does not establish human benefit, production availability, permission, promotion, merge, or CANON status.'
    ],
    truth: {
      modelInvoked: false,
      modelWeightsChanged: false,
      modelGeneralizationClaimed: false,
      humanParticipant: false,
      humanBenefitClaimed: false,
      automaticExecution: false,
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

function verifyEvaluation(receipt) {
  const current = buildEvaluation();
  return {
    pass: Growth.stableStringify(current) === Growth.stableStringify(receipt),
    expectedDigest: current.receiptDigest,
    actualDigest: receipt && receipt.receiptDigest
  };
}

function closure(id, refs) {
  const coveredDigests = Array.from(new Set(refs.map(ref => ref.sha256))).sort();
  return {
    state: 'CURRENT',
    checkedAt: OUTCOME_AT,
    receiptRef: Growth.reference({ id, coveredDigests }, { id, schema: 'axm.evidence-closure-receipt/v1' }),
    coveredDigests
  };
}

function build() {
  const priorPortfolio = readJson(FILES.priorPortfolio);
  const priorResearchFile = readJson(FILES.priorResearchOutcome);
  assert.ok(Growth.verifyPortfolio(priorPortfolio).pass, 'prior current portfolio must verify');
  const priorResearch = priorPortfolio.outcomes.find(outcome => outcome.outcomeId === priorResearchFile.outcomeId);
  assert.ok(priorResearch, 'prior public research outcome is missing from current portfolio');
  assert.deepStrictEqual(priorResearch, priorResearchFile, 'prior research file differs from portfolio ancestry');

  const evaluation = buildEvaluation();
  assert.strictEqual(evaluation.verdict, 'PASS', 'AI workflow evaluation must pass before it can be linked');
  const fixtures = readJson(FILES.fixtures);
  const baselineRef = Growth.reference(evaluation.baseline, { id: 'grounded-research-shortcut-baseline', schema: 'axm.ai-workflow-evaluation-baseline/v1' });
  const outcomeRef = Growth.reference(evaluation.outcome, { id: 'grounded-research-steward-guard-outcome', schema: 'axm.ai-workflow-evaluation-outcome/v1' });
  const evaluationRef = Growth.reference(evaluation, { id: evaluation.evaluationId, schema: evaluation.schema });
  const fixtureRef = Growth.reference(fixtures, { id: fixtures.caseSetId, schema: fixtures.schema });
  const dispositionRef = exactFileReference(FILES.researchDisposition, 'public-baseline-research-disposition', 'axm.research-disposition/v1');
  const builderRef = exactFileReference(FILES.builder, 'research-ai-workflow-evaluator', 'text/javascript');
  const priorOutcomeRef = { id: priorResearch.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: priorResearch.receiptDigest };
  const aiClosure = closure('grounded-research-ai-workflow-closure', [baselineRef, outcomeRef, evaluationRef, fixtureRef, dispositionRef, builderRef]);

  const priorSystemClaim = priorResearch.claims.find(claim => claim.beneficiary === 'SHARED_SYSTEM');
  const priorHumanClaim = priorResearch.claims.find(claim => claim.beneficiary === 'HUMAN');
  assert.ok(priorSystemClaim && priorSystemClaim.admittedVerdict === 'PASS', 'prior system effect must remain explicit');
  assert.ok(priorHumanClaim && priorHumanClaim.verdict === 'NOT_RUN', 'prior human boundary must remain explicit');

  const researchOutcome = Growth.buildOutcome({
    outcomeId: 'grounded-growth-public-research-ai-workflow-20260819',
    generatedAt: OUTCOME_AT,
    cycleReceipt: priorResearch.cycleReceipt,
    interventionRef: dispositionRef,
    previousOutcomeRef: priorOutcomeRef,
    noNewInformation: false,
    informationRefs: [evaluationRef, fixtureRef, dispositionRef, builderRef],
    claims: [
      priorSystemClaim,
      priorHumanClaim,
      {
        id: 'public-research-grounded-guard-ai-workflow-benefit',
        beneficiary: 'AI_WORKFLOW',
        statement: 'A deterministic AI-assisted steward guard makes correct bounded decisions on eight representative Workshop situations after applying grounded research rules, improving from 2/8 shortcut-baseline decisions to 8/8 and reducing unsupported or unsafe decisions from six to zero.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'PASS',
        proofSurface: 'AI_WORKFLOW_EVALUATION',
        baselineRef,
        outcomeRef,
        evidenceRefs: [evaluationRef, fixtureRef, dispositionRef, builderRef],
        evidenceClosure: aiClosure,
        limitations: evaluation.limitations
      }
    ],
    refresh: {
      checkedAt: OUTCOME_AT,
      due: false,
      reason: 'Rebuild if the research disposition, frozen cases, evaluator, prior research ancestry, or grounded decision rules change.'
    }
  });

  const portfolio = Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current-ai-workflow-refresh-20260819',
    generatedAt: PORTFOLIO_AT,
    outcomes: [...priorPortfolio.outcomes, researchOutcome]
  });
  const effectiveOutcomes = portfolio.latest.map(item => portfolio.outcomes.find(outcome => outcome.outcomeId === item.effectiveOutcomeId));
  const effectiveClaims = effectiveOutcomes.flatMap(outcome => outcome.claims);
  const beneficiaryVerdicts = {};
  for (const claim of effectiveClaims) {
    const key = claim.beneficiary + ':' + claim.admittedVerdict;
    beneficiaryVerdicts[key] = (beneficiaryVerdicts[key] || 0) + 1;
  }
  const summary = {
    schema: SUMMARY_SCHEMA,
    generatedAt: PORTFOLIO_AT,
    portfolioRef: { id: portfolio.portfolioId, schema: portfolio.schema, sha256: portfolio.portfolioDigest },
    priorPortfolioRef: { id: priorPortfolio.portfolioId, schema: priorPortfolio.schema, sha256: priorPortfolio.portfolioDigest },
    latestResearchOutcomeRef: { id: researchOutcome.outcomeId, schema: researchOutcome.schema, sha256: researchOutcome.receiptDigest },
    evaluationRef,
    capabilityCount: portfolio.summary.capabilityCount,
    outcomeCount: portfolio.summary.outcomeCount,
    overall: portfolio.summary.overall,
    stateCounts: portfolio.summary.stateCounts,
    effectiveBeneficiaryVerdicts: beneficiaryVerdicts,
    systemEffectsAdmitted: effectiveClaims.filter(claim => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS').length,
    aiWorkflowBenefitsAdmitted: effectiveClaims.filter(claim => claim.beneficiary === 'AI_WORKFLOW' && claim.admittedVerdict === 'PASS').length,
    humanBenefitsAdmitted: effectiveClaims.filter(claim => claim.beneficiary === 'HUMAN' && claim.admittedVerdict === 'PASS').length,
    nextEvidenceNeeds: Array.from(new Set(portfolio.latest.flatMap(item => item.nextEvidenceNeeds))).sort(),
    truth: {
      portfolioIsDerivedView: true,
      laterResearchEvaluationNowAccountedFor: true,
      researchRulesImprovedBoundedWorkflow: true,
      modelOrWeightImprovementClaimed: false,
      humanBenefitEstablished: false,
      voluntaryHumanGateTouched: false,
      crossModelAgreementTreatedAsProof: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    summaryDigest: null
  };
  const summaryPayload = clone(summary);
  delete summaryPayload.summaryDigest;
  summary.summaryDigest = Growth.sha256(summaryPayload);

  return { evaluation, researchOutcome, portfolio, summary };
}

function verifyRecorded() {
  const current = build();
  const recorded = {
    evaluation: readJson(path.join(__dirname, 'AI_WORKFLOW_EVALUATION.json')),
    researchOutcome: readJson(path.join(__dirname, 'PUBLIC_RESEARCH_AI_WORKFLOW_OUTCOME.json')),
    portfolio: readJson(path.join(__dirname, 'CURRENT_PORTFOLIO.json')),
    summary: readJson(path.join(__dirname, 'CURRENT_SUMMARY.json'))
  };
  assert.ok(verifyEvaluation(recorded.evaluation).pass, 'recorded evaluation differs from frozen cases and evaluator');
  assert.deepStrictEqual(recorded, current, 'recorded artifacts differ from a fresh read-only rebuild');
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
  baselineDecision,
  groundedDecision,
  buildEvaluation,
  verifyEvaluation,
  build,
  verifyRecorded
};
