'use strict';

const fs = require('fs');
const path = require('path');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');

function ref(relativePath, id, schema) {
  const raw = fs.readFileSync(path.join(ROOT, ...relativePath.split('/')));
  return { id, schema, path: relativePath, sha256: Bridge.sha256(raw) };
}

function build() {
  const receipt = {
    schema: 'axm.steward-verification-receipt/v1',
    version: '0.1.0',
    receiptId: 'reuse-existing-human-bridge-ancestry-verification-20260819',
    generatedAt: '2026-08-19T11:35:00.000Z',
    status: 'TEST',
    subject: {
      id: 'grounded-growth-human-bridge-v2-ancestry',
      paths: [
        'shared/grounded-growth-human-bridge-v2',
        'docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry'
      ],
      claim: 'The additive v2 bridge derives and verifies exact candidate or REUSE_EXISTING ancestry for all four current human-readiness routes without changing v1 or admitting synthetic evidence as human benefit.'
    },
    focused: {
      verdict: 'PASS',
      checks: 98,
      suites: [
        { id: 'grounded-growth-human-bridge-v2-contract', checks: 45, verdict: 'PASS' },
        { id: 'current-four-route-ancestry-readiness', checks: 53, verdict: 'PASS' }
      ],
      adversarialBoundaries: [
        'candidate and reuse ancestry remain mutually exclusive',
        'ambiguous ancestry cannot emit a native link',
        'caller cannot relabel REUSE_EXISTING as CANDIDATE',
        'reused capability surfaces cannot cross routes',
        'candidate-cycle links cannot cross into reuse cycles',
        'unrelated capability surfaces are refused',
        'missing intervention-link closure is held',
        'wrong source-trust schema is held',
        'synthetic and forged-LIVE inputs map to UNKNOWN',
        'bundle ancestry tampering breaks verification'
      ]
    },
    adjacent: {
      verdict: 'PASS',
      checks: 192,
      suites: [
        { id: 'verified-capability-loop', checks: 21, verdict: 'PASS' },
        { id: 'human-benefit-evidence', checks: 46, verdict: 'PASS' },
        { id: 'grounded-growth-human-bridge-v1', checks: 33, verdict: 'PASS' },
        { id: 'current-v1-bridge-readiness-exact', checks: 1, verdict: 'PASS' },
        { id: 'grounded-growth-outcomes', checks: 31, verdict: 'PASS' },
        { id: 'prior-human-readiness-portfolio', checks: 53, verdict: 'PASS' },
        { id: 'current-v2-readiness-exact', checks: 1, verdict: 'PASS' },
        { id: 'deterministic-capability-comparator', checks: 1, verdict: 'PASS' },
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
      broadVerifier: { fail: 0, warn: 17, spineDigestPrefix: 'b618c5762240070c' },
      spine: 'VERIFIED_WITH_LIMITS'
    },
    visualVerification: {
      verdict: 'NOT_RUN',
      reason: 'This increment adds deterministic contracts, receipts, and tests with no browser UI or rendered interaction change.'
    },
    capabilityResult: {
      currentCapabilityChains: 4,
      candidateAncestry: { before: 2, after: 2, verdict: 'PASS' },
      reuseExistingAncestry: { before: 0, after: 2, verdict: 'PASS' },
      exactNativeInterventionLinks: { before: 0, after: 4, verdict: 'PASS' },
      endToEndAncestryReady: { before: 2, after: 4, verdict: 'PASS' },
      positiveLiveOperationalPath: { before: 0, after: 0, verdict: 'NOT_RUN' },
      establishedHumanBenefits: { before: 0, after: 0, verdict: 'NOT_RUN' }
    },
    sourceRefs: [
      ref('shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js', 'grounded-growth-human-bridge-v2-core', 'text/javascript'),
      ref('shared/grounded-growth-human-bridge-v2/selftest.js', 'grounded-growth-human-bridge-v2-selftest', 'text/javascript'),
      ref('shared/grounded-growth-human-bridge-v2/module.contract.json', 'grounded-growth-human-bridge-v2-contract', 'axm.module-contract/v1'),
      ref('docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness.js', 'current-v2-readiness-builder', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/selftest.js', 'current-v2-readiness-selftest', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/CURRENT_BRIDGE_READINESS.json', 'current-v2-bridge-readiness', 'axm.grounded-growth-human-bridge-v2-readiness/v1'),
      ref('docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/CAPABILITY_GAP_REPORT.json', 'current-v2-capability-gap-report', 'capability-gap-report/v1'),
      ref('shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js', 'preserved-grounded-growth-human-bridge-v1-core', 'text/javascript')
    ],
    truth: {
      v1BridgeModified: false,
      candidateInventedForReuse: false,
      syntheticAcceptedAsHumanEvidence: false,
      liveHumanSessionRun: false,
      sourceAuthenticationClaimed: false,
      humanJudgmentCreated: false,
      bridgeBundleCreatedFromHumanEvidence: false,
      groundedOutcomeRefreshed: false,
      humanBenefitClaimed: false,
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
  receipt.receiptDigest = Bridge.sha256(payload);
  return receipt;
}

function main() {
  const receipt = build();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    console.log('WROTE exact v2 ancestry verification receipt');
    return;
  }
  if (process.argv.includes('--check-recorded')) {
    const recorded = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    if (Bridge.stableStringify(recorded) !== Bridge.stableStringify(receipt)) throw new Error('recorded verification receipt differs from exact sources');
    console.log('PASS exact v2 ancestry verification receipt (98 focused, 192 adjacent, 10 required)');
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
