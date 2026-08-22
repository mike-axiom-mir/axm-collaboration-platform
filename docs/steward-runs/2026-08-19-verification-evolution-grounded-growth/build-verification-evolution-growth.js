#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const EvolutionVerification = require('../2026-08-19-verification-source-evolution-review/build-verification-receipt');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EVALUATION_SCHEMA = 'axm.ai-workflow-evaluation/v1';
const SUMMARY_SCHEMA = 'axm.grounded-growth-current-refresh-summary/v1';
const EVALUATION_AT = '2026-08-19T20:13:30.000Z';
const OUTCOME_AT = '2026-08-19T20:13:31.000Z';
const PORTFOLIO_AT = '2026-08-19T20:13:32.000Z';

const FILES = {
  fixtures: path.join(__dirname, 'EVOLUTION_WORKFLOW_CASES.json'),
  builder: __filename,
  priorPortfolio: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-ai-workflow-coverage-refresh', 'CURRENT_PORTFOLIO.json'),
  evolutionPortfolio: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-verification-source-evolution-review', 'CURRENT_EVOLUTION_REVIEW_PORTFOLIO.json'),
  evolutionVerification: path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-verification-source-evolution-review', 'VERIFICATION_RECEIPT.json'),
  evolutionImplementation: path.join(ROOT, 'shared', 'verification-source-evolution-review', 'verification-source-evolution-review.js')
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
  const schema = extension === '.json' ? 'application/json' : extension === '.js' ? 'text/javascript' : 'text/markdown';
  return exactFileReference(file, 'case-source:' + sourcePath.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), schema);
}

function digestMismatchShortcut(facts) {
  if (facts.candidateSelfDigestValid === false) return { decision: 'HOLD_INVALID_ATTESTATION', ruleId: 'INVALID_DIGEST_HOLD' };
  if (facts.currentDigestMismatch) return { decision: 'REJECT_OR_REWRITE_HISTORY', ruleId: 'DIGEST_MISMATCH_IS_FAILURE' };
  if (facts.laterReceiptAttestation) return { decision: 'ACCEPT_AS_CORRECT', ruleId: 'ATTESTATION_EQUALS_CORRECTNESS' };
  if (facts.missingHistoricalSelfDigest) return { decision: 'DISCARD_HISTORY', ruleId: 'NO_SELF_DIGEST_IS_UNUSABLE' };
  if (facts.semanticSnapshotMatch) return { decision: 'ACCEPT_HISTORICAL_BYTES', ruleId: 'SEMANTICS_EQUAL_BYTES' };
  return { decision: 'CONTINUE_UNCLASSIFIED', ruleId: 'DEFAULT_CONTINUE' };
}

function evolutionAwareDecision(facts) {
  if (facts.attemptCorrectnessInference) return { decision: 'REFUSE_CORRECTNESS_INFERENCE', ruleId: 'BYTE_LINEAGE_IS_NOT_CORRECTNESS' };
  if (facts.missingHistoricalSelfDigest) return { decision: 'ANCHOR_FORWARD_HOLD_PREANCHOR', ruleId: 'EXTERNAL_ANCHOR_CANNOT_REPAIR_PRIOR_INTEGRITY' };
  if (facts.laterReceiptAttestation && facts.candidateSelfDigestValid === false) return { decision: 'HOLD_INVALID_ATTESTATION', ruleId: 'LATER_RECEIPT_REQUIRES_VALID_SELF_DIGEST' };
  if (facts.laterReceiptAttestation && facts.candidateSelfDigestValid && facts.candidateCurrentTrackedSources) {
    return { decision: 'ROUTE_CURRENT_BYTES_DIRECT', ruleId: 'EXACT_ATTESTATION_PLUS_CURRENT_CANDIDATE_SCOPE' };
  }
  if (facts.laterReceiptAttestation && facts.candidateSelfDigestValid && facts.candidateEvolutionFullyRouted) {
    return { decision: 'ROUTE_CURRENT_BYTES_TRANSITIVELY', ruleId: 'EXACT_ATTESTATION_PLUS_FULL_CANDIDATE_EVOLUTION_ROUTE' };
  }
  if (facts.laterReceiptAttestation) return { decision: 'HOLD_CANDIDATE_CURRENTNESS', ruleId: 'ATTESTATION_WITHOUT_CURRENT_OR_EVOLUTION_SCOPE_HOLDS' };
  if (facts.knownGeneratedView && facts.semanticSnapshotMatch) return { decision: 'ROUTE_GENERATED_VIEW_SEMANTICS_ONLY', ruleId: 'KNOWN_GENERATOR_BOUNDED_SEMANTIC_ROUTE' };
  if (facts.currentDigestMismatch && facts.mutableDerivedViewOnly) return { decision: 'PRESERVE_DERIVED_VIEW_DRIFT', ruleId: 'MUTABLE_DERIVED_VIEW_IS_NOT_SOURCE_FAILURE' };
  if (facts.currentDigestMismatch) return { decision: 'HOLD_UNROUTED_DRIFT', ruleId: 'UNROUTED_SOURCE_DRIFT_HOLDS' };
  return { decision: 'PRESERVE_EXACT', ruleId: 'NO_DRIFT_PRESERVE' };
}

function validateFixtures(fixtures) {
  assert.strictEqual(fixtures.schema, 'axm.steward-workflow-case-set/v1');
  assert.strictEqual(fixtures.status, 'TEST');
  assert.ok(Array.isArray(fixtures.cases) && fixtures.cases.length === 8, 'eight representative cases required');
  assert.strictEqual(new Set(fixtures.cases.map(item => item.id)).size, 8, 'case ids must be unique');
  assert.strictEqual(fixtures.truth.modelInvoked, false);
  assert.strictEqual(fixtures.truth.humanParticipant, false);
  assert.strictEqual(fixtures.truth.historicalReceiptRewritten, false);
  for (const item of fixtures.cases) {
    assert.ok(item.id && item.sourcePath && item.expectedDecision && item.expectedRule && item.facts, 'incomplete case: ' + item.id);
    sourceReference(item.sourcePath);
  }
}

function buildEvaluation() {
  const fixtures = readJson(FILES.fixtures);
  validateFixtures(fixtures);
  const fixtureRef = Growth.reference(fixtures, { id: fixtures.caseSetId, schema: fixtures.schema });
  const builderRef = exactFileReference(FILES.builder, 'verification-evolution-workflow-evaluator', 'text/javascript');
  const implementationRef = exactFileReference(FILES.evolutionImplementation, 'verification-source-evolution-review-implementation', 'text/javascript');
  const portfolioRef = exactFileReference(FILES.evolutionPortfolio, 'verification-source-evolution-review-portfolio', 'axm.verification-source-evolution-review-portfolio/v1');
  const verificationRef = exactFileReference(FILES.evolutionVerification, 'verification-source-evolution-review-verification', 'axm.verification-source-evolution-review-verification/v1');
  const sourceRefsByDigest = new Map();
  const cases = fixtures.cases.map(item => {
    const sourceRef = sourceReference(item.sourcePath);
    sourceRefsByDigest.set(sourceRef.sha256, sourceRef);
    const baseline = digestMismatchShortcut(item.facts);
    const candidate = evolutionAwareDecision(item.facts);
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
    policyId: 'DIGEST_MISMATCH_AND_ATTESTATION_SHORTCUTS',
    description: 'A declared comparison policy treats digest mismatch as failure or rewrite pressure, later attestation as correctness, missing self-digests as disposable history, and semantic alignment as byte equality.',
    correctDecisions: cases.filter(item => item.baselineCorrect).length,
    totalDecisions: cases.length,
    unsupportedUnsafeOrHistoryErasingDecisions: cases.filter(item => !item.baselineCorrect).length
  };
  const outcome = {
    policyId: 'EVIDENCE_EVOLUTION_AWARE_STEWARD_GUARD',
    description: 'The guard separates mutable views, direct and transitive byte lineage, generated semantics, invalid attestations, legacy forward anchors, and correctness boundaries.',
    correctDecisions: cases.filter(item => item.candidateCorrect).length,
    totalDecisions: cases.length,
    unsupportedUnsafeOrHistoryErasingDecisions: cases.filter(item => !item.candidateCorrect).length,
    newlyCorrectedDecisions: cases.filter(item => !item.baselineCorrect && item.candidateCorrect).length
  };
  const verdict = outcome.correctDecisions === cases.length &&
    outcome.unsupportedUnsafeOrHistoryErasingDecisions === 0 &&
    outcome.correctDecisions > baseline.correctDecisions ? 'PASS' : 'FAIL';
  const receipt = {
    schema: EVALUATION_SCHEMA,
    version: '0.1.0',
    evaluationId: 'verification-evolution-ai-workflow-20260819',
    generatedAt: EVALUATION_AT,
    beneficiary: 'AI_WORKFLOW',
    workflow: fixtures.workflow,
    proofSurface: 'AI_WORKFLOW_EVALUATION',
    fixturePolicy: fixtures.fixturePolicy,
    inputRefs: [fixtureRef, builderRef, implementationRef, portfolioRef, verificationRef, ...Array.from(sourceRefsByDigest.values())],
    baseline,
    outcome,
    cases,
    verdict,
    limitations: [
      'No language model was invoked; this proves a deterministic guard for an AI-assisted stewardship workflow, not model learning, weights, intelligence, provider behavior, or broad generalization.',
      'The eight cases are representative recorded and adversarial Workshop situations, not a statistically sampled or independently blinded benchmark.',
      'The shortcut baseline is a declared comparison policy, not a claim about any named model, provider, person, or current AXM steward.',
      'Byte lineage and semantic routing do not establish intent, correctness, regression absence, quality, human benefit, governed availability, promotion, merge, or CANON.'
    ],
    truth: {
      modelInvoked: false,
      modelWeightsChanged: false,
      modelGeneralizationClaimed: false,
      humanParticipant: false,
      humanBenefitClaimed: false,
      historicalReceiptRewritten: false,
      correctnessInferredFromLineage: false,
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
  const evolutionPortfolio = readJson(FILES.evolutionPortfolio);
  const evolutionVerification = readJson(FILES.evolutionVerification);
  assert.ok(Growth.verifyPortfolio(priorPortfolio).pass, 'prior Grounded Growth portfolio must verify');
  assert.ok(EvolutionVerification.verify(evolutionVerification).pass, 'source-evolution verification receipt must rebuild exactly');
  assert.strictEqual(evolutionVerification.result, 'PASS_WITH_DECLARED_LIMITS');
  assert.strictEqual(evolutionPortfolio.counts.unresolvedCurrentByteProvenance, 0);
  assert.strictEqual(evolutionPortfolio.counts.unresolvedCandidateCurrentness, 0);
  assert.strictEqual(evolutionPortfolio.counts.legacyPreAnchorIntegrityUnknown, 2);

  const priorLatest = priorPortfolio.latest.find(item => item.capabilityId === 'evidence.registered-source-closure/v1');
  assert.ok(priorLatest, 'evidence-closure capability chain is missing');
  const priorOutcome = priorPortfolio.outcomes.find(item => item.outcomeId === priorLatest.effectiveOutcomeId);
  assert.ok(priorOutcome, 'effective evidence-closure outcome is missing');

  const evaluation = buildEvaluation();
  assert.strictEqual(evaluation.verdict, 'PASS');
  const fixtures = readJson(FILES.fixtures);
  const evaluationRef = Growth.reference(evaluation, { id: evaluation.evaluationId, schema: evaluation.schema });
  const fixtureRef = Growth.reference(fixtures, { id: fixtures.caseSetId, schema: fixtures.schema });
  const builderRef = exactFileReference(FILES.builder, 'verification-evolution-workflow-evaluator', 'text/javascript');
  const implementationRef = exactFileReference(FILES.evolutionImplementation, 'verification-source-evolution-review-implementation', 'text/javascript');
  const portfolioRef = exactFileReference(FILES.evolutionPortfolio, 'verification-source-evolution-review-portfolio', evolutionPortfolio.schema);
  const verificationRef = exactFileReference(FILES.evolutionVerification, 'verification-source-evolution-review-verification', evolutionVerification.schema);
  const evidenceRefs = [evaluationRef, fixtureRef, builderRef, implementationRef, portfolioRef, verificationRef];

  const priorSystemClaim = priorOutcome.claims.find(claim => claim.beneficiary === 'SHARED_SYSTEM');
  const priorHumanClaim = priorOutcome.claims.find(claim => claim.beneficiary === 'HUMAN');
  assert.ok(priorSystemClaim && priorSystemClaim.admittedVerdict === 'PASS', 'prior system effect must remain admitted');
  assert.ok(priorHumanClaim && priorHumanClaim.verdict === 'NOT_RUN', 'prior human boundary must remain NOT_RUN');

  const systemBaselineRef = Growth.reference(priorSystemClaim, { id: 'registered-source-closure-prior-system-effect', schema: 'axm.grounded-growth-claim/v1' });
  const systemOutcomeRef = Growth.reference({
    counts: evolutionPortfolio.counts,
    decision: evolutionPortfolio.decision,
    verificationDigest: evolutionVerification.verificationDigest
  }, { id: 'verification-source-evolution-system-effect', schema: 'axm.verification-source-evolution-effect/v1' });
  const aiBaselineRef = Growth.reference(evaluation.baseline, { id: 'verification-evolution-shortcut-baseline', schema: 'axm.ai-workflow-evaluation-baseline/v1' });
  const aiOutcomeRef = Growth.reference(evaluation.outcome, { id: 'verification-evolution-steward-guard-outcome', schema: 'axm.ai-workflow-evaluation-outcome/v1' });

  const outcome = Growth.buildOutcome({
    outcomeId: 'grounded-growth-verification-evolution-ai-workflow-20260819',
    generatedAt: OUTCOME_AT,
    cycleReceipt: priorOutcome.cycleReceipt,
    interventionRef: implementationRef,
    previousOutcomeRef: { id: priorOutcome.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: priorOutcome.receiptDigest },
    noNewInformation: false,
    informationRefs: evidenceRefs,
    claims: [
      {
        id: 'verification-source-evolution-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'The bounded source-evolution review preserves historical receipts while routing all nineteen observed current drift paths through direct later-current evidence, one transitive candidate-scope route, or one known generated-view semantic route, with two pre-anchor integrity holds retained.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: systemBaselineRef,
        outcomeRef: systemOutcomeRef,
        evidenceRefs,
        evidenceClosure: closure('verification-source-evolution-system-closure', [systemBaselineRef, systemOutcomeRef, ...evidenceRefs]),
        limitations: [
          'The result covers the exact 22-receipt inventory and nineteen drift rows in the recorded TEST portfolio, not all future Workshop history.',
          'Two receipts lack declared self-digests, so integrity before their external anchors remains unknown.',
          'The generated-view bridge compares bounded semantics and does not reconstruct historical report bytes.'
        ]
      },
      priorHumanClaim,
      {
        id: 'verification-source-evolution-ai-workflow-benefit',
        beneficiary: 'AI_WORKFLOW',
        statement: 'A deterministic AI-assisted stewardship guard makes correct preserve, route, hold, and refusal decisions on eight representative verification-evolution cases, improving from 1/8 shortcut-baseline decisions to 8/8 and reducing unsupported, unsafe, or history-erasing decisions from seven to zero.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'PASS',
        proofSurface: 'AI_WORKFLOW_EVALUATION',
        baselineRef: aiBaselineRef,
        outcomeRef: aiOutcomeRef,
        evidenceRefs,
        evidenceClosure: closure('verification-source-evolution-ai-workflow-closure', [aiBaselineRef, aiOutcomeRef, ...evidenceRefs]),
        limitations: evaluation.limitations
      }
    ],
    refresh: {
      checkedAt: OUTCOME_AT,
      due: false,
      reason: 'Rebuild if the source-evolution portfolio, verification receipt, held-out cases, decision rules, implementation, or prior Grounded Growth ancestry changes.'
    }
  });

  const portfolio = Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current-verification-evolution-20260819',
    generatedAt: PORTFOLIO_AT,
    outcomes: [...priorPortfolio.outcomes, outcome]
  });
  const effectiveOutcomes = portfolio.latest.map(item => portfolio.outcomes.find(outcomeReceipt => outcomeReceipt.outcomeId === item.effectiveOutcomeId));
  const effectiveClaims = effectiveOutcomes.flatMap(outcomeReceipt => outcomeReceipt.claims);
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
    latestOutcomeRef: { id: outcome.outcomeId, schema: outcome.schema, sha256: outcome.receiptDigest },
    evaluationRef,
    sourceEvolutionVerificationRef: verificationRef,
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
      sourceEvolutionOutcomeNowAccountedFor: true,
      sourceEvolutionImprovedBoundedAiWorkflow: true,
      historicalReceiptRewritten: false,
      modelOrWeightImprovementClaimed: false,
      humanBenefitEstablished: false,
      voluntaryHumanGateTouched: false,
      availabilityGranted: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    summaryDigest: null
  };
  const summaryPayload = clone(summary);
  delete summaryPayload.summaryDigest;
  summary.summaryDigest = Growth.sha256(summaryPayload);
  return { evaluation, outcome, portfolio, summary };
}

function verifyRecorded() {
  const current = build();
  const recorded = {
    evaluation: readJson(path.join(__dirname, 'EVOLUTION_AI_WORKFLOW_EVALUATION.json')),
    outcome: readJson(path.join(__dirname, 'EVOLUTION_AI_WORKFLOW_OUTCOME.json')),
    portfolio: readJson(path.join(__dirname, 'CURRENT_PORTFOLIO.json')),
    summary: readJson(path.join(__dirname, 'CURRENT_SUMMARY.json'))
  };
  assert.ok(verifyEvaluation(recorded.evaluation).pass, 'recorded evaluation differs from a fresh rebuild');
  assert.deepStrictEqual(recorded, current, 'recorded Grounded Growth artifacts differ from a fresh rebuild');
  return current.summary;
}

function write() {
  const result = build();
  const outputs = {
    EVOLUTION_AI_WORKFLOW_EVALUATION: result.evaluation,
    EVOLUTION_AI_WORKFLOW_OUTCOME: result.outcome,
    CURRENT_PORTFOLIO: result.portfolio,
    CURRENT_SUMMARY: result.summary
  };
  for (const [name, value] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(__dirname, name + '.json'), JSON.stringify(value, null, 2) + '\n');
  }
  return result;
}

if (require.main === module) {
  try {
    if (process.argv.includes('--write')) {
      const result = write();
      process.stdout.write(JSON.stringify({
        evaluation: result.evaluation.verdict,
        baseline: result.evaluation.baseline.correctDecisions + '/' + result.evaluation.baseline.totalDecisions,
        outcome: result.evaluation.outcome.correctDecisions + '/' + result.evaluation.outcome.totalDecisions,
        portfolioDigest: result.portfolio.portfolioDigest,
        nextEvidenceNeeds: result.summary.nextEvidenceNeeds
      }, null, 2) + '\n');
    } else if (process.argv.includes('--check-recorded')) {
      process.stdout.write(JSON.stringify(verifyRecorded(), null, 2) + '\n');
    } else {
      process.stdout.write(JSON.stringify(build(), null, 2) + '\n');
    }
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  EVALUATION_SCHEMA,
  digestMismatchShortcut,
  evolutionAwareDecision,
  buildEvaluation,
  verifyEvaluation,
  build,
  verifyRecorded,
  write
};
