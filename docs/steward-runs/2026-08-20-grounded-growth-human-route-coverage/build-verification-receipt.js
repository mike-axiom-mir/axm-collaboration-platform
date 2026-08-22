#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Builder = require('./build-current-human-route-coverage');
const CheckRunner = require('./run-verification-checks');
const PriorVerification = require('../2026-08-20-grounded-growth-signal-lineage/build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');
const LANE = Builder.LANE;
const PRIOR_VERIFICATION_PATH = 'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/VERIFICATION_RECEIPT.json';
const SOURCE_FILES = [
  LANE + '/CAPABILITY_REQUIREMENTS.json',
  LANE + '/CAPABILITY_INVENTORY_BEFORE.json',
  LANE + '/CAPABILITY_INVENTORY_AFTER.json',
  LANE + '/CAPABILITY_GAP_BEFORE.json',
  LANE + '/CAPABILITY_GAP_AFTER.json',
  LANE + '/EVIDENCE_ROUTES.md',
  LANE + '/README.md',
  LANE + '/CURRENT_HUMAN_ROUTE_COVERAGE.json',
  LANE + '/CURRENT_HUMAN_ROUTE_CATALOG.json',
  LANE + '/CURRENT_SUMMARY.json',
  LANE + '/surfaces/detached-current-state-trust-condition-a.json',
  LANE + '/surfaces/detached-current-state-trust-condition-b.json',
  LANE + '/protocols/detached-current-state-trust-protocol.json',
  LANE + '/protocols/source-closure-current-claim-protocol.json',
  LANE + '/links/detached-current-state-trust-intervention-link.json',
  LANE + '/links/source-closure-current-claim-intervention-link.json',
  LANE + '/packets/source-closure-participant-packet.json',
  LANE + '/packets/baseline-no-new-stop-participant-packet.json',
  LANE + '/packets/research-grounded-disposition-participant-packet.json',
  LANE + '/packets/workspace-local-package-route-participant-packet.json',
  LANE + '/packets/detached-current-state-trust-participant-packet.json',
  LANE + '/build-current-human-route-coverage.js',
  LANE + '/run-current-human-route-interactive.js',
  LANE + '/selftest.js',
  LANE + '/run-verification-checks.js',
  LANE + '/CHECK_RESULTS.json',
  LANE + '/build-verification-receipt.js',
  LANE + '/verification-selftest.js',
  'shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage.js',
  'shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage-receipt.schema.json',
  'shared/grounded-growth-human-route-coverage/module.contract.json',
  'shared/grounded-growth-human-route-coverage/README.md',
  'shared/grounded-growth-human-route-coverage/selftest.js',
  Builder.PORTFOLIO_PATH,
  Builder.LINEAGE_PATH,
  Builder.DISPOSITION_PATH,
  'docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json',
  'docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/CURRENT_BRIDGE_READINESS.json',
  'docs/steward-runs/2026-08-19-human-benefit-readiness/baseline-surface.json',
  'docs/steward-runs/2026-08-19-human-benefit-readiness/candidate-surface.json',
  'docs/steward-runs/2026-08-19-human-benefit-readiness/current-protocol.json',
  'shared/human-benefit-evidence/human-benefit-evidence.js',
  'shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js',
  'shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js',
  PRIOR_VERIFICATION_PATH
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function diffPaths(left, right, prefix, output) {
  if (Growth.stableStringify(left) === Growth.stableStringify(right)) return output;
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
  return declared === Growth.sha256(payload);
}

function requirementStatus(gap, id) {
  const requirement = gap.requirements.find((item) => item.id === id);
  if (!requirement) throw new Error('missing capability-gap requirement ' + id);
  return requirement.status;
}

function build() {
  const current = Builder.checkRecorded();
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
  const refreshed = current.readyRoutes.find((route) => route.capabilityId === 'evidence.registered-source-closure/v1');
  const detached = current.readyRoutes.find((route) => route.capabilityId === Builder.DETACHED.capabilityId);
  const hold = current.coverage.holds[0];

  const receipt = {
    schema: 'axm.grounded-growth-human-route-coverage-verification/v1',
    version: '0.1.0',
    verificationId: 'verification:grounded-growth-human-route-coverage-20260820',
    generatedAt: checks.checkedAt,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    portfolio: {
      outcomes: current.portfolio.summary.outcomeCount,
      currentCapabilityChains: current.portfolio.summary.capabilityCount,
      digest: current.portfolio.portfolioDigest,
      appendedByThisIncrement: 0,
      selfReferentialRouteOutcomeAvoided: true
    },
    coverage: {
      state: current.coverage.state,
      currentCapabilityChains: current.coverage.coverage.currentCapabilityChains,
      readyRoutes: current.coverage.coverage.readyRoutes,
      heldRoutes: current.coverage.coverage.heldRoutes,
      missingRoutes: current.coverage.coverage.missingRoutes,
      candidateAncestryReady: current.coverage.coverage.candidateAncestryReady,
      reuseExistingAncestryReady: current.coverage.coverage.reuseExistingAncestryReady,
      humanPass: current.coverage.coverage.humanPass,
      humanNotRun: current.coverage.coverage.humanNotRun,
      autonomousActionCount: current.coverage.decision.autonomousActionCount,
      reviewableActionCount: current.coverage.decision.reviewableActionCount,
      receiptDigest: current.coverage.receiptDigest
    },
    routeConstruction: {
      exactProtocolAndLinkReuse: current.summary.routes.exactProtocolAndLinkReuse,
      claimRefreshedRoutes: current.summary.routes.claimRefreshedRoutes,
      newClaimNativeRoutes: current.summary.routes.newClaimNativeRoutes,
      newSurfaceRoutes: current.summary.routes.newSurfaceRoutes,
      reboundCurrentPackets: current.summary.routes.reboundCurrentPackets,
      sourceClosureProtocolDigest: refreshed.protocol.protocolDigest,
      detachedProtocolDigest: detached.protocol.protocolDigest
    },
    heldBoundary: {
      capabilityId: hold.capabilityId,
      humanClaimId: hold.humanClaimId,
      state: hold.routeState,
      reasonCode: hold.reasonCode,
      proposalId: hold.proposalId,
      requiredExternalEvent: hold.requiredExternalEvent,
      automaticAction: hold.automaticAction,
      proposalImplemented: current.coverage.truth.deferredProposalImplemented
    },
    optionalDriver: {
      routes: current.catalog.readyRoutes.length,
      heldRouteCommands: current.catalog.heldRoutes.filter((item) => item.commandAvailable).length,
      localTtyRequired: true,
      repositoryLocalSessionInputAllowed: false,
      runByThisIncrement: false,
      writesAutomatically: false
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
      classification: Growth.stableStringify(priorDiff) === Growth.stableStringify(['broadVerification.source.sha256', 'verificationDigest'])
        ? 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT'
        : priorDiff.length === 0 ? 'CURRENT_EXACT' : 'UNCLASSIFIED_DRIFT',
      historicalReceiptRewritten: false
    },
    capabilityGap: {
      before: current.gaps.before.overall,
      after: current.gaps.after.overall,
      requiredMissingAfter: current.gaps.after.missingCapabilities.length,
      liveHumanBenefit: requirementStatus(current.gaps.after, 'live-human-beneficiary-outcome'),
      signalLineageHumanSurface: requirementStatus(current.gaps.after, 'signal-lineage-claim-native-human-surface'),
      humanSourceAuthentication: requirementStatus(current.gaps.after, 'human-source-authentication')
    },
    browserVerification: {
      applicable: false,
      verdict: 'NOT_RUN',
      reason: 'No browser-rendered, controller, game, or visual surface changed, and the optional TTY journey was not run.'
    },
    declaredLimits: [
      'No person opted in and no LIVE session, explicit human judgment, or admitted human outcome was created; all six human claims remain NOT_RUN.',
      'A ready protocol, packet, intervention link, or TTY command is technical route coverage, not evidence of usefulness or human benefit.',
      'The signal-lineage human surface remains deferred pending an explicit steward decision; the deferred proposal was not implemented.',
      'Pseudonymous references and local declarations do not authenticate human identity or presence.',
      'Detached portable verification proves receipt integrity and authority boundaries, not source truth or currentness without the native source graph.',
      'No new Grounded Growth outcome was appended because coverage support is bound directly to the current portfolio and must not create an infinite route-for-route chain.'
    ],
    boundaries: {
      participationOccurred: false,
      humanBenefitEstablished: false,
      humanIdentityAuthenticated: false,
      sourceTruthClaimed: false,
      deferredProposalImplemented: false,
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
  receipt.verificationDigest = Growth.sha256(payload);
  return receipt;
}

function verify(receipt) {
  try {
    return { pass: Growth.stableStringify(receipt) === Growth.stableStringify(build()), errors: [] };
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
      coverage: receipt.coverage.readyRoutes + '+held:' + receipt.coverage.heldRoutes,
      human: receipt.coverage.humanPass + ' PASS / ' + receipt.coverage.humanNotRun + ' NOT_RUN',
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
