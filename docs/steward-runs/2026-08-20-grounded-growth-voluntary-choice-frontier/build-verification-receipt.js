#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Choice = require('../../../shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier');
const Builder = require('./build-current-voluntary-choice-frontier');
const CheckRunner = require('./run-verification-checks');
const PriorVerification = require('../2026-08-20-grounded-growth-human-route-coverage/build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');
const LANE = Builder.LANE;
const PRIOR_VERIFICATION_PATH = 'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/VERIFICATION_RECEIPT.json';
const SOURCE_FILES = [
  LANE + '/CAPABILITY_REQUIREMENTS.json',
  LANE + '/CAPABILITY_INVENTORY_BEFORE.json',
  LANE + '/CAPABILITY_INVENTORY_AFTER.json',
  LANE + '/CAPABILITY_GAP_BEFORE.json',
  LANE + '/CAPABILITY_GAP_AFTER.json',
  LANE + '/EVIDENCE_ROUTES.md',
  LANE + '/README.md',
  LANE + '/CURRENT_VOLUNTARY_CHOICE_FRONTIER.json',
  LANE + '/CURRENT_SUMMARY.json',
  LANE + '/build-current-voluntary-choice-frontier.js',
  LANE + '/selftest.js',
  LANE + '/run-verification-checks.js',
  LANE + '/CHECK_RESULTS.json',
  LANE + '/build-verification-receipt.js',
  LANE + '/verification-selftest.js',
  'shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier.js',
  'shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier.schema.json',
  'shared/grounded-growth-voluntary-choice-frontier/module.contract.json',
  'shared/grounded-growth-voluntary-choice-frontier/README.md',
  'shared/grounded-growth-voluntary-choice-frontier/selftest.js',
  'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/CURRENT_STATE_RECEIPT.json',
  'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/CURRENT_PORTFOLIO.json',
  'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/build-signal-lineage-growth.js',
  'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/CURRENT_HUMAN_ROUTE_COVERAGE.json',
  'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/CURRENT_HUMAN_ROUTE_CATALOG.json',
  'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/build-current-human-route-coverage.js',
  PRIOR_VERIFICATION_PATH
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Choice.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function diffPaths(left, right, prefix, output) {
  if (Choice.stableStringify(left) === Choice.stableStringify(right)) return output;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) {
    output.push(prefix);
    return output;
  }
  Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort()
    .forEach((key) => diffPaths(left[key], right[key], prefix ? prefix + '.' + key : key, output));
  return output;
}

function selfDigestValid(receipt, field) {
  const payload = JSON.parse(JSON.stringify(receipt));
  const declared = payload[field];
  delete payload[field];
  return declared === Choice.sha256(payload);
}

function requirementStatus(gap, id) {
  const requirement = gap.requirements.find((item) => item.id === id);
  if (!requirement) throw new Error('missing capability-gap requirement ' + id);
  return requirement.status;
}

function build() {
  const current = Builder.checkRecorded();
  const frontier = current.frontier;
  const checks = readJson(LANE + '/CHECK_RESULTS.json');
  if (!selfDigestValid(checks, 'resultsDigest') || checks.summary.failed !== 0 ||
      checks.summary.focusedPassed !== CheckRunner.FOCUSED.length ||
      checks.summary.requiredPassed !== CheckRunner.REQUIRED.length) {
    throw new Error('current check results are absent, invalid, incomplete, or failing');
  }

  const broadPath = 'exports/verification-spine-report.json';
  const broad = readJson(broadPath);
  const historicalPrior = readJson(PRIOR_VERIFICATION_PATH);
  const rebuiltPrior = PriorVerification.build();
  const priorDiff = diffPaths(historicalPrior, rebuiltPrior, '', []);
  const expectedMutableDiff = ['broadVerification.source.sha256', 'verificationDigest'];

  const receipt = {
    schema: 'axm.grounded-growth-voluntary-choice-frontier-verification/v1',
    version: '0.1.0',
    verificationId: 'verification:grounded-growth-voluntary-choice-frontier-20260820',
    generatedAt: checks.checkedAt,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    portfolio: {
      outcomes: current.signal.portfolio.summary.outcomeCount,
      currentCapabilityChains: frontier.current.capabilityChains,
      digest: frontier.sourceRefs.portfolio.sha256,
      appendedByThisIncrement: 0,
      selfReferentialChoiceOutcomeAvoided: true
    },
    reconciliation: {
      state: frontier.state,
      olderOptionalReviewCandidates: frontier.current.priorOptionalReviewCandidates,
      currentAvailableChoices: frontier.current.availableChoices,
      currentHeldChoices: frontier.current.heldChoices,
      missingChoiceDispositions: 0,
      oldSingleCandidateTreatedAsCompleteMenu: frontier.truth.oldSingleReviewCandidateIsCompleteCurrentMenu,
      frontierDigest: frontier.frontierDigest
    },
    selection: {
      state: frontier.decision.state,
      policy: frontier.selectionPolicy.mode,
      defaultChoiceId: frontier.selectionPolicy.defaultChoiceId,
      rankedChoices: frontier.selectionPolicy.rankedChoiceIds.length,
      preselectedChoices: frontier.selectionPolicy.preselectedChoiceIds.length,
      selectedChoices: frontier.decision.selectedChoiceCount,
      waitAllowed: frontier.selectionPolicy.waitAllowed,
      optOutHasNoPenalty: frontier.selectionPolicy.optOutHasNoPenalty,
      explicitHumanRequestRequiredBeforeMenuOrPrompt: frontier.selectionPolicy.explicitHumanRequestRequiredBeforeMenuOrPrompt,
      automaticPrompt: frontier.truth.automaticPrompt,
      autonomousActionCount: frontier.decision.autonomousActionCount,
      reviewableActionCount: frontier.decision.reviewableActionCount
    },
    evidenceBalance: {
      technicalPassSignals: frontier.balance.technicalPassSignals,
      currentHumanPassSignals: frontier.balance.currentHumanPassSignals,
      technicalEvidenceAheadOfHumanEvidence: frontier.balance.technicalEvidenceAheadOfHumanEvidence,
      currentRoutesCoverEveryHumanClaim: frontier.balance.currentRoutesCoverEveryHumanClaim,
      groundedGrowthForAiAndHumansEstablished: frontier.balance.groundedGrowthForAiAndHumansEstablished,
      humanNotRun: frontier.current.humanNotRun
    },
    capabilityGap: {
      before: current.gaps.before.overall,
      after: current.gaps.after.overall,
      requiredMissingAfter: current.gaps.after.missingCapabilities.length,
      explicitHumanSelectionEvent: requirementStatus(current.gaps.after, 'explicit-human-selection-event'),
      liveHumanBenefit: requirementStatus(current.gaps.after, 'live-human-beneficiary-outcome'),
      humanSourceAuthentication: requirementStatus(current.gaps.after, 'human-source-authentication')
    },
    focusedAndAdjacent: {
      total: checks.summary.focusedTotal,
      passed: checks.summary.focusedPassed,
      failed: checks.checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT' && item.exitCode !== 0).length,
      explicitAssertions: checks.summary.explicitAssertions,
      checks: checks.checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT')
    },
    requiredChecks: {
      total: checks.summary.requiredTotal,
      passed: checks.summary.requiredPassed,
      failed: checks.checks.filter((item) => item.phase === 'REQUIRED' && item.exitCode !== 0).length,
      checks: checks.checks.filter((item) => item.phase === 'REQUIRED')
    },
    broadVerification: {
      binding: 'OBSERVED_AFTER_REQUIRED_CHECKS',
      source: sourceRef(broadPath),
      schema: broad.schema,
      profile: broad.profile && broad.profile.id,
      verdict: broad.verdict,
      receipts: broad.receipt_count,
      atomicClaims: broad.claim_count,
      warnings: Array.isArray(broad.warnings) ? broad.warnings.length : null,
      failures: Array.isArray(broad.failures) ? broad.failures.length : null,
      holds: Array.isArray(broad.holds) ? broad.holds.length : null,
      invalidReceipts: Array.isArray(broad.invalid_receipts) ? broad.invalid_receipts.length : null
    },
    historicalEvolution: {
      priorVerificationDigest: historicalPrior.verificationDigest,
      exactAgainstCurrentMutableView: PriorVerification.verify(historicalPrior).pass ? 'PASS' : 'EXPECTED_FAIL',
      changedFields: priorDiff,
      classification: Choice.stableStringify(priorDiff) === Choice.stableStringify(expectedMutableDiff)
        ? 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT'
        : priorDiff.length === 0 ? 'CURRENT_EXACT' : 'UNCLASSIFIED_DRIFT',
      historicalReceiptRewritten: false
    },
    browserVerification: {
      applicable: false,
      verdict: 'NOT_RUN',
      reason: 'No browser, controller, game, visual, or interactive route-selection surface was built or run.'
    },
    declaredLimits: [
      'No person requested, selected, started, completed, or withdrew from a route; no selection event or participation receipt exists.',
      'Five available routes are technical options only. Availability is not a recommendation, default, prompt, selection, participation event, or human-benefit result.',
      'All six current human claims remain NOT_RUN, so grounded growth for AI and humans together is not established.',
      'Local pseudonymous references and declarations do not authenticate identity or human presence.',
      'Detached portable verification proves receipt integrity and authority boundaries, not source truth or currentness without the native source graph.',
      'The held signal-lineage route remains commandless pending an explicit steward decision and a claim-native human surface.',
      'No new Grounded Growth outcome was appended because a choice-support layer must not manufacture another benefit claim or recursive route obligation.'
    ],
    boundaries: {
      humanRequestOccurred: false,
      selectionOccurred: false,
      participationOccurred: false,
      humanBenefitEstablished: false,
      humanIdentityAuthenticated: false,
      sourceTruthClaimed: false,
      deferredProposalImplemented: false,
      automaticPrompt: false,
      automaticAction: false,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      modelLearningClaimed: false,
      historicalReceiptRewritten: false
    },
    sourceRefs: SOURCE_FILES.map(sourceRef),
    verificationDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.verificationDigest;
  receipt.verificationDigest = Choice.sha256(payload);
  return receipt;
}

function verify(receipt) {
  try {
    return { pass: Choice.stableStringify(receipt) === Choice.stableStringify(build()), errors: [] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

if (require.main === module) {
  try {
    const receipt = build();
    if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n');
    process.stdout.write(JSON.stringify({
      result: receipt.result,
      choices: receipt.reconciliation.currentAvailableChoices + '+held:' + receipt.reconciliation.currentHeldChoices,
      selected: receipt.selection.selectedChoices,
      evidence: receipt.evidenceBalance.technicalPassSignals + ' technical / ' + receipt.evidenceBalance.currentHumanPassSignals + ' human PASS',
      focused: receipt.focusedAndAdjacent.passed + '/' + receipt.focusedAndAdjacent.total,
      assertions: receipt.focusedAndAdjacent.explicitAssertions,
      required: receipt.requiredChecks.passed + '/' + receipt.requiredChecks.total,
      broad: receipt.broadVerification.verdict,
      history: receipt.historicalEvolution.classification,
      digest: receipt.verificationDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { ROOT, OUTPUT, LANE, SOURCE_FILES, diffPaths, selfDigestValid, build, verify };
