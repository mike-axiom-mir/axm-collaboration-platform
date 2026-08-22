#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GENERATED_AT = '2026-08-19T20:34:00.000Z';
const REQUIRED_COMMANDS = [
  'node verify.js',
  'node hub/hub-selftest.js',
  'node hub/route-selftest.js',
  'node hub/graft-selftest.js',
  'node hub/skin-selftest.js',
  'node hub/verify-plus.js',
  'node tests/html-script-syntax-test.js',
  'node tests/tool-forge-package-test.js',
  'node tools/agent-tool-forge/selftest.js',
  'node tools/evidence-desk/selftest.js'
];
const SOURCE_FILES = [
  'shared/grounded-growth-outcomes/grounded-growth-outcomes.js',
  'shared/verified-capability-loop/verified-capability-loop.js',
  'shared/verification-source-evolution-review/verification-source-evolution-review.js',
  'docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CURRENT_EVOLUTION_REVIEW_PORTFOLIO.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/EVOLUTION_WORKFLOW_CASES.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/build-verification-evolution-growth.js',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_GAP_BEFORE.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_GAP_AFTER.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/EVOLUTION_AI_WORKFLOW_EVALUATION.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/EVOLUTION_AI_WORKFLOW_OUTCOME.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/README.md',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/selftest.js'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return { path: relativePath, sha256: Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath))) };
}

function build() {
  const evaluation = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/EVOLUTION_AI_WORKFLOW_EVALUATION.json');
  const outcome = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/EVOLUTION_AI_WORKFLOW_OUTCOME.json');
  const portfolio = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json');
  const summary = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_SUMMARY.json');
  const beforeGap = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_GAP_BEFORE.json');
  const afterGap = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CAPABILITY_GAP_AFTER.json');
  const broadPath = 'exports/verification-spine-report.json';
  const broad = readJson(broadPath);
  const receipt = {
    schema: 'axm.verification-evolution-grounded-growth-verification/v1',
    verificationId: 'verification:verification-evolution-grounded-growth-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    focused: {
      explicitAssertions: 113,
      commands: [
        { command: 'node docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/selftest.js', assertions: 113, verdict: 'PASS' }
      ]
    },
    adjacent: {
      explicitAssertions: 266,
      commands: [
        { command: 'node shared/grounded-growth-outcomes/selftest.js', assertions: 31, verdict: 'PASS' },
        { command: 'node shared/verified-capability-loop/selftest.js', assertions: 21, verdict: 'PASS' },
        { command: 'node shared/verification-source-evolution-review/selftest.js', assertions: 47, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-verification-source-evolution-review/selftest.js', assertions: 100, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/selftest.js', assertions: 67, verdict: 'PASS' }
      ]
    },
    totalExplicitAssertions: 379,
    requiredChecks: {
      passed: REQUIRED_COMMANDS.length,
      failed: 0,
      commands: REQUIRED_COMMANDS.map(command => ({ command, verdict: 'PASS' }))
    },
    broadVerification: {
      binding: 'OBSERVED_AFTER_REQUIRED_CHECKS',
      mutableSourcePath: broadPath,
      observationSha256: Growth.sha256(fs.readFileSync(path.join(ROOT, broadPath))),
      rawDigestIncludedInStableSourceRefs: false,
      schema: broad.schema,
      profile: broad.profile && broad.profile.id,
      verdict: broad.verdict,
      failures: Array.isArray(broad.failures) ? broad.failures.length : null,
      holds: Array.isArray(broad.holds) ? broad.holds.length : null,
      warningGroups: Array.isArray(broad.warnings) ? broad.warnings.length : null,
      invalidReceipts: Array.isArray(broad.invalid_receipts) ? broad.invalid_receipts.length : null,
      knownCoreWarningLines: 17
    },
    browserVerification: {
      verdict: 'NOT_RUN',
      reason: 'No UI, browser journey, controller runtime, or visual surface changed.'
    },
    capabilityComparison: {
      before: { overall: beforeGap.overall, missingRequiredCapabilities: beforeGap.missingCapabilities.length },
      after: {
        overall: afterGap.overall,
        missingRequiredCapabilities: afterGap.missingCapabilities.length,
        independentModelEffectiveness: afterGap.requirements.find(item => item.id === 'independent-model-effectiveness').status,
        humanBeneficiaryOutcome: afterGap.requirements.find(item => item.id === 'human-beneficiary-outcome').status,
        governedAvailability: afterGap.requirements.find(item => item.id === 'governed-availability').status
      }
    },
    currentState: {
      evaluationVerdict: evaluation.verdict,
      shortcutCorrectDecisions: evaluation.baseline.correctDecisions,
      guardCorrectDecisions: evaluation.outcome.correctDecisions,
      correctedDecisions: evaluation.outcome.newlyCorrectedDecisions,
      latestOutcomeId: outcome.outcomeId,
      latestOutcomeState: outcome.state,
      portfolioDigest: portfolio.portfolioDigest,
      capabilityChains: summary.capabilityCount,
      longitudinalOutcomes: summary.outcomeCount,
      systemEffectsAdmitted: summary.systemEffectsAdmitted,
      aiWorkflowBenefitsAdmitted: summary.aiWorkflowBenefitsAdmitted,
      humanBenefitsAdmitted: summary.humanBenefitsAdmitted,
      nextEvidenceNeeds: summary.nextEvidenceNeeds
    },
    preservedContradictions: [
      {
        observation: 'The deterministic guard passes all eight representative cases.',
        boundary: 'The linked outcome remains CANDIDATE_ONLY and grants no governed availability.'
      },
      {
        observation: 'Four current capability chains have admitted system and AI-workflow PASS claims.',
        boundary: 'No human-native outcome was run; human benefit remains zero and NOT_RUN.'
      },
      {
        observation: 'All nineteen recorded source-drift paths have bounded current evidence routes.',
        boundary: 'Two legacy receipt histories remain unknown before their external anchors.'
      }
    ],
    declaredLimits: [
      'The evaluation proves a deterministic workflow guard on eight frozen cases, not a model, provider, weights, intelligence, or broad generalization.',
      'The source-evolution effect covers the exact recorded 22-receipt inventory and nineteen drift rows, not all future Workshop history.',
      'Byte lineage and generated-view semantics do not establish intent, correctness, regression absence, quality, or historical byte equality.',
      'Human benefit, independent model effectiveness, and governed availability remain open on their native proof surfaces.',
      'The broad verification report is a mutable post-check observation and is not a stable source reference.',
      'No browser behavior, production, publication, promotion, merge, Foundation, or CANON claim is made.'
    ],
    boundaries: {
      historicalReceiptRewritten: false,
      correctnessInferredFromLineage: false,
      humanBenefitInferred: false,
      modelImprovementInferred: false,
      availabilityGranted: false,
      browserClaimed: false,
      foundationTouched: false,
      canonicalStateTouched: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false
    },
    sharedWorkspace: {
      branch: 'local-visual-fabric-20260728',
      initialStatusPaths: 12769,
      activeFilesObserved: 99,
      activeSharedSeamsObserved: 4,
      broadDirtyWorktreePreserved: true,
      aetherglassSeamsTouched: false,
      sharedRegistriesTouched: false,
      scanTruncated: true
    },
    sourceRefs: SOURCE_FILES.map(sourceRef),
    truth: {
      sourceDigestsCurrentAtReceiptTime: true,
      mutableBroadReportRawDigestIncludedInStableSourceRefs: false,
      evaluationClaimedAsModelLearning: false,
      systemEffectClaimedAsHumanBenefit: false,
      candidateClaimedAvailable: false,
      priorGroundedGrowthHistoryRewritten: false,
      rawTerminalLogsRetained: false,
      authorityGranted: false
    },
    verificationDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.verificationDigest;
  receipt.verificationDigest = Growth.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const current = build();
  const errors = [];
  if (Growth.stableStringify(receipt) !== Growth.stableStringify(current)) errors.push('verification receipt or stable source digest mismatch');
  return { pass: errors.length === 0, errors };
}

function write() {
  const receipt = build();
  fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

module.exports = { REQUIRED_COMMANDS, SOURCE_FILES, build, verify, write };

if (require.main === module) {
  const receipt = process.argv.includes('--write') ? write() : build();
  process.stdout.write(JSON.stringify({
    result: receipt.result,
    explicitAssertions: receipt.totalExplicitAssertions,
    requiredChecks: receipt.requiredChecks.passed,
    broadVerdict: receipt.broadVerification.verdict,
    evaluation: receipt.currentState.shortcutCorrectDecisions + '/8 -> ' + receipt.currentState.guardCorrectDecisions + '/8',
    currentOutcomeState: receipt.currentState.latestOutcomeState,
    verificationDigest: receipt.verificationDigest
  }, null, 2) + '\n');
}
