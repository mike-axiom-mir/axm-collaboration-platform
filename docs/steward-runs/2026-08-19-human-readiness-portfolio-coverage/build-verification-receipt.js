'use strict';

const fs = require('fs');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');

function ref(relativePath, id, schema) {
  const raw = fs.readFileSync(path.join(ROOT, ...relativePath.split('/')));
  return { id, schema, path: relativePath, sha256: Human.sha256(raw) };
}

function build() {
  const receipt = {
    schema: 'axm.steward-verification-receipt/v1',
    version: '0.1.0',
    receiptId: 'human-readiness-portfolio-coverage-verification-20260819',
    generatedAt: '2026-08-19T10:56:00.000Z',
    status: 'TEST',
    subject: {
      id: 'human-readiness-portfolio-coverage',
      path: 'docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage',
      claim: 'Every current capability chain has a concrete voluntary protocol route, while human participation and benefit remain NOT_RUN and the reuse-existing bridge gap remains explicit.'
    },
    focused: {
      command: "$env:AXM_TEST_TEMP='D:\\AXM_ACTIVE\\mirror\\.axm-test-scratch'; node docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/selftest.js",
      verdict: 'PASS',
      checks: 53,
      adversarialBoundaries: [
        'cross-capability protocol reference refused',
        'synthetic input cannot become LIVE',
        'non-voluntary consent refused',
        'raw identity or unknown response fields refused',
        'repository-stored live response refused',
        'piped interactive input refused',
        'withdrawal retains no participant evidence'
      ]
    },
    adjacent: {
      verdict: 'PASS',
      checks: 124,
      suites: [
        { id: 'human-benefit-evidence', checks: 46, verdict: 'PASS' },
        { id: 'existing-source-closure-protocol-exact', checks: 1, verdict: 'PASS' },
        { id: 'existing-human-readiness-exact', checks: 1, verdict: 'PASS' },
        { id: 'existing-human-runner-boundaries', checks: 5, verdict: 'PASS' },
        { id: 'grounded-growth-human-bridge', checks: 33, verdict: 'PASS' },
        { id: 'existing-bridge-readiness-exact', checks: 1, verdict: 'PASS' },
        { id: 'grounded-growth-outcomes', checks: 31, verdict: 'PASS' },
        { id: 'portfolio-readiness-exact', checks: 1, verdict: 'PASS' },
        { id: 'new-javascript-syntax', checks: 5, verdict: 'PASS' }
      ]
    },
    requiredChecks: {
      verdict: 'PASS',
      pass: 10,
      fail: 0,
      commands: [
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
      ],
      broadVerifier: { fail: 0, warn: 17 },
      spine: 'VERIFIED_WITH_LIMITS'
    },
    visualVerification: {
      verdict: 'NOT_RUN',
      reason: 'This increment adds inert JSON/JavaScript evidence routes and no browser UI or rendering behavior.'
    },
    capabilityResult: {
      voluntaryProtocolRoutes: { before: 1, after: 4, verdict: 'PASS' },
      answerFreeParticipantPackets: { before: 1, after: 4, verdict: 'PASS' },
      currentBridgeAncestrySupported: { before: 2, after: 2, verdict: 'DEGRADED' },
      reuseExistingBridgeAncestry: { before: 0, after: 0, verdict: 'DEGRADED' },
      humanParticipation: { before: 0, after: 0, verdict: 'NOT_RUN' },
      humanBenefitEstablished: { before: 0, after: 0, verdict: 'NOT_RUN' }
    },
    sourceRefs: [
      ref('docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/build-portfolio-readiness.js', 'portfolio-readiness-builder', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/selftest.js', 'portfolio-readiness-selftest', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/PORTFOLIO_READINESS_RECEIPT.json', 'portfolio-readiness-receipt', 'axm.human-benefit-portfolio-readiness-receipt/v1'),
      ref('docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/CAPABILITY_GAP_REPORT.json', 'portfolio-readiness-gap-report', 'capability-gap-report/v1'),
      ref('docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/run-portfolio-human-session.js', 'portfolio-human-session-route', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/run-portfolio-human-session-interactive.js', 'portfolio-human-session-interactive-route', 'text/javascript')
    ],
    truth: {
      browserBehaviorClaimed: false,
      liveHumanSessionRun: false,
      humanSourceAuthenticated: false,
      humanJudgmentCreated: false,
      humanBenefitClaimed: false,
      bridgeGapClosed: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Human.sha256(payload);
  return receipt;
}

function main() {
  const receipt = build();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    console.log('WROTE exact verification receipt');
    return;
  }
  if (process.argv.includes('--check-recorded')) {
    const recorded = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    if (Human.stableStringify(recorded) !== Human.stableStringify(receipt)) throw new Error('recorded verification receipt differs from exact sources');
    console.log('PASS exact verification receipt (53 focused, 124 adjacent, 10 required)');
    return;
  }
  console.log(JSON.stringify(receipt, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { build };
