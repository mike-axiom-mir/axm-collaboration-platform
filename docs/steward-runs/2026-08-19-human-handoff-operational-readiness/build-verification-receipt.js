'use strict';

const fs = require('fs');
const path = require('path');
const Handoff = require('../../../shared/grounded-growth-human-handoff/grounded-growth-human-handoff');
const Builder = require('./build-current-handoff-readiness');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GENERATED_AT = '2026-08-19T12:10:00.000Z';

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function ref(relativePath, id, schema) {
  const raw = fs.readFileSync(path.join(ROOT, ...relativePath.split('/')));
  return { id, schema, path: relativePath, sha256: Handoff.sha256(raw) };
}

function buildReceipt() {
  const current = Builder.verifyRecorded();
  if (current.gapBefore.overall !== 'BLOCKED' || current.gapAfter.overall !== 'READY') {
    throw new Error('current capability comparison no longer matches verified before/after state');
  }
  const receipt = {
    schema: 'axm.steward-verification-receipt/v1',
    version: '0.1.0',
    receiptId: 'human-handoff-operational-readiness-verification-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    subject: {
      id: 'grounded-growth-human-handoff-operational-readiness',
      paths: [
        'shared/grounded-growth-human-handoff',
        'docs/steward-runs/2026-08-19-human-handoff-operational-readiness'
      ],
      claim: 'A staged, write-free optional handoff now composes exact external sessions, separate explicit judgment, a native local source declaration, current closure and v2 ancestry for all four current capability chains while LIVE human evidence remains NOT_RUN.'
    },
    focused: {
      verdict: 'PASS',
      checks: 92,
      suites: [
        { id: 'grounded-growth-human-handoff-core', checks: 45, verdict: 'PASS' },
        { id: 'current-human-handoff-operational-readiness', checks: 47, verdict: 'PASS' }
      ],
      adversarialBoundaries: [
        'synthetic positive signal and fixture PASS map to UNKNOWN',
        'source declaration cannot cross capability routes',
        'candidate intervention link cannot cross into reuse ancestry',
        'session receipt cannot cross protocol routes',
        'wrong source attestation is refused',
        'synthetic evaluation cannot be relabeled LIVE',
        'held closure remains an evidence hold',
        'source declaration, ancestry and package digest tampering fail verification',
        'non-TTY input is refused before session evidence is read',
        'session input inside the Workshop repository is refused'
      ]
    },
    adjacent: {
      verdict: 'PASS',
      checks: 291,
      suites: [
        { id: 'human-benefit-evidence', checks: 46, verdict: 'PASS' },
        { id: 'grounded-growth-human-bridge-v2', checks: 45, verdict: 'PASS' },
        { id: 'grounded-growth-human-bridge-v1', checks: 33, verdict: 'PASS' },
        { id: 'verified-capability-loop', checks: 21, verdict: 'PASS' },
        { id: 'grounded-growth-outcomes', checks: 31, verdict: 'PASS' },
        { id: 'human-readiness-portfolio', checks: 53, verdict: 'PASS' },
        { id: 'reuse-existing-bridge-ancestry', checks: 53, verdict: 'PASS' },
        { id: 'current-handoff-readiness-exact', checks: 1, verdict: 'PASS' },
        { id: 'before-capability-comparator', checks: 1, verdict: 'PASS' },
        { id: 'after-capability-comparator', checks: 1, verdict: 'PASS' },
        { id: 'new-javascript-syntax', checks: 6, verdict: 'PASS' }
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
      broadVerifier: {
        fail: 0,
        warn: 17,
        spineDigestPrefix: 'b618c5762240070c'
      },
      spine: 'VERIFIED_WITH_LIMITS'
    },
    visualVerification: {
      verdict: 'NOT_RUN',
      reason: 'This increment adds deterministic contracts and a terminal-only optional driver with no browser UI or rendered interaction change.'
    },
    capabilityResult: {
      currentCapabilityChains: 4,
      nativeLocalSourceDeclarations: { before: 0, after: 1, verdict: 'PASS' },
      completePostSessionHandoffRoutes: { before: 0, after: 4, verdict: 'PASS' },
      candidateHandoffRoutes: { before: 0, after: 2, verdict: 'PASS' },
      reuseExistingHandoffRoutes: { before: 0, after: 2, verdict: 'PASS' },
      liveHumanSessions: { before: 0, after: 0, verdict: 'NOT_RUN' },
      admittedLiveBridgePackages: { before: 0, after: 0, verdict: 'NOT_RUN' },
      establishedHumanBenefits: { before: 0, after: 0, verdict: 'NOT_RUN' }
    },
    failureMemory: [
      {
        id: 'invalid-missing-inventory-status',
        observed: 'The first independent comparator rejected status missing as invalid.',
        repair: 'Missing before-capabilities are now absent from the inventory, matching the comparator contract.',
        finalVerdict: 'PASS'
      },
      {
        id: 'missing-required-test-scratch-root',
        observed: 'The first adjacent human-readiness invocation refused to run without AXM_TEST_TEMP.',
        repair: 'The suite was rerun with an explicit disposable D:\\AXM_ACTIVE scratch root and verified zero children afterward.',
        finalVerdict: 'PASS'
      }
    ],
    sourceRefs: [
      ref('shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js', 'grounded-growth-human-handoff-core', 'text/javascript'),
      ref('shared/grounded-growth-human-handoff/selftest.js', 'grounded-growth-human-handoff-selftest', 'text/javascript'),
      ref('shared/grounded-growth-human-handoff/local-steward-source-declaration.schema.json', 'local-steward-source-declaration-schema', Handoff.SOURCE_DECLARATION_SCHEMA),
      ref('shared/grounded-growth-human-handoff/grounded-growth-human-handoff-package.schema.json', 'grounded-growth-human-handoff-package-schema', Handoff.HANDOFF_SCHEMA),
      ref('shared/grounded-growth-human-handoff/module.contract.json', 'grounded-growth-human-handoff-contract', 'axm.module-contract/v1'),
      ref('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/run-current-human-handoff-interactive.js', 'current-human-handoff-interactive-runner', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/build-current-handoff-readiness.js', 'current-human-handoff-readiness-builder', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/selftest.js', 'current-human-handoff-readiness-selftest', 'text/javascript'),
      ref('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json', 'current-human-handoff-readiness', 'axm.grounded-growth-human-handoff-readiness/v1'),
      ref('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CAPABILITY_GAP_BEFORE.json', 'human-handoff-capability-gap-before', 'capability-gap-report/v1'),
      ref('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CAPABILITY_GAP_AFTER.json', 'human-handoff-capability-gap-after', 'capability-gap-report/v1')
    ],
    truth: {
      humanParticipationOccurred: false,
      liveSessionCreated: false,
      liveEvaluationCreated: false,
      liveJudgmentCreated: false,
      admittedLiveBridgePackageCreated: false,
      groundedHumanOutcomeCreated: false,
      humanBenefitClaimed: false,
      identityAuthenticated: false,
      humanPresenceAuthenticated: false,
      sourceAuthenticationClaimed: false,
      syntheticAcceptedAsHumanEvidence: false,
      existingSharedSeamModified: false,
      automaticWrite: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Handoff.sha256(payload);
  return receipt;
}

function write() {
  fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), pretty(buildReceipt()), 'utf8');
}

function verifyRecorded() {
  const current = buildReceipt();
  const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), 'utf8'));
  if (Handoff.stableStringify(current) !== Handoff.stableStringify(recorded)) throw new Error('VERIFICATION_RECEIPT.json differs from exact current sources');
  return current;
}

function main() {
  if (process.argv.includes('--write')) {
    write();
    console.log('WROTE exact human handoff verification receipt');
    return;
  }
  if (process.argv.includes('--check-recorded')) {
    const receipt = verifyRecorded();
    console.log('PASS exact human handoff verification receipt (' + receipt.focused.checks + ' focused, ' + receipt.adjacent.checks + ' adjacent, ' + receipt.requiredChecks.pass + ' required)');
    return;
  }
  console.log(pretty(buildReceipt()));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildReceipt, verifyRecorded, write };
