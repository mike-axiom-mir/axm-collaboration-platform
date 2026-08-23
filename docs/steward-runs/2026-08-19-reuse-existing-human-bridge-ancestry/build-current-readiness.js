'use strict';

const fs = require('fs');
const path = require('path');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Prior = require('../2026-08-19-human-readiness-portfolio-coverage/build-portfolio-readiness');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GENERATED_AT = '2026-08-19T11:20:00.000Z';
const PRIOR_READINESS = 'docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/PORTFOLIO_READINESS_RECEIPT.json';
const CURRENT_PORTFOLIO = 'docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json';

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function fileRef(relativePath, id, schema) {
  const canonicalText = fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  return { id, schema, path: relativePath, sha256: Bridge.sha256(canonicalText) };
}

function receiptRef(value, idField, digestField) {
  return { id: value[idField], schema: value.schema, sha256: value[digestField] };
}

function buildRequirements() {
  return {
    requirements: [
      {
        id: 'exact-current-ancestry-coverage',
        capabilities: [
          'human.bridge.candidate-ancestry',
          'human.bridge.reuse-existing-ancestry',
          'human.bridge.intervention-link-native-verify',
          'human.bridge.every-current-chain'
        ],
        required: true
      },
      {
        id: 'human-evidence-gates-preserved',
        capabilities: [
          'human.bridge.live-only',
          'human.bridge.scope-bind',
          'human.bridge.source-trust-bind',
          'human.bridge.closure-bind',
          'human.bridge.synthetic-hold'
        ],
        required: true
      },
      {
        id: 'v1-continuity',
        capabilities: ['human.bridge.v1-preserved'],
        required: true
      },
      {
        id: 'authority-preservation',
        capabilities: ['authority.human-steward.preserve'],
        required: true
      },
      {
        id: 'live-human-beneficiary-outcome',
        capabilities: ['growth.human-evidence.live'],
        required: false
      }
    ]
  };
}

function buildInventory(routeCount) {
  return {
    capabilities: [
      { id: 'human.bridge.candidate-ancestry', status: 'available', constraints: ['Derived from cycle.candidate.artifactRef only when no existing-capability ancestry is present.'] },
      { id: 'human.bridge.reuse-existing-ancestry', status: 'available', constraints: ['Derived from cycle.gap.existingCapabilityRef only for exact NO_GAP / REUSE_EXISTING cycles with no candidate.'] },
      { id: 'human.bridge.intervention-link-native-verify', status: 'available', constraints: ['Digest-bound v2 link rebuilds from the exact verified cycle and protocol.'] },
      { id: 'human.bridge.every-current-chain', status: routeCount === 4 ? 'available' : 'degraded', constraints: ['Exact current portfolio coverage must remain four of four routes.'] },
      { id: 'human.bridge.live-only', status: 'available', constraints: ['Synthetic and forged-LIVE fixtures map to UNKNOWN.'] },
      { id: 'human.bridge.scope-bind', status: 'available', constraints: ['Protocol, judgment, binding, claim, and capability scope must agree.'] },
      { id: 'human.bridge.source-trust-bind', status: 'available', constraints: ['Named steward and cohort trust modes require their exact external reference schemas; the bridge does not authenticate identity.'] },
      { id: 'human.bridge.closure-bind', status: 'available', constraints: ['Current closure must cover the cycle, protocol, evaluation, judgment, link, comparison surfaces, baseline, capability surface, and trust reference.'] },
      { id: 'human.bridge.synthetic-hold', status: 'available', constraints: ['Synthetic fixtures remain contract evidence and cannot become human benefit.'] },
      { id: 'human.bridge.v1-preserved', status: 'available', constraints: ['v2 is a separate leaf; no v1 source, schema, contract, or prior sealed receipt is rewritten.'] },
      { id: 'authority.human-steward.preserve', status: 'available', constraints: ['No human input, execution, install, permission, promotion, merge, CANON, or Foundation authority.'] },
      { id: 'growth.human-evidence.live', status: 'degraded', constraints: ['No person opted in; no LIVE session, evaluation, explicit judgment, bridge bundle, or Grounded Growth refresh exists.'] }
    ]
  };
}

function buildGapReport(requirements, inventory) {
  const byId = new Map(inventory.capabilities.map((capability) => [capability.id, capability]));
  const rows = requirements.requirements.map((requirement) => {
    const capabilities = requirement.capabilities.map((id) => byId.get(id) || { id, status: 'missing', constraints: [] });
    const available = capabilities.filter((item) => item.status === 'available').map((item) => item.id);
    const degraded = capabilities.filter((item) => item.status === 'degraded').map((item) => item.id);
    const unknown = capabilities.filter((item) => item.status === 'unknown').map((item) => item.id);
    const missing = capabilities.filter((item) => item.status === 'missing').map((item) => item.id);
    const status = missing.length ? 'BLOCKED' : degraded.length ? 'DEGRADED' : unknown.length ? (requirement.required ? 'UNKNOWN' : 'OPTIONAL_UNKNOWN') : 'READY';
    return {
      id: requirement.id,
      required: requirement.required,
      status,
      available,
      degraded,
      unknown,
      missing,
      declaredConstraints: Object.fromEntries(capabilities.map((item) => [item.id, item.constraints]))
    };
  });
  return {
    schema: 'capability-gap-report/v1',
    overall: rows.some((row) => row.required && row.status === 'BLOCKED') ? 'BLOCKED' : rows.some((row) => row.required && row.status !== 'READY') ? 'DEGRADED' : 'READY',
    requirements: rows,
    missingCapabilities: rows.flatMap((row) => row.missing),
    proposedHands: []
  };
}

function buildAll() {
  const prior = Prior.verifyRecorded();
  const routes = prior.routes.map((route) => {
    const link = Bridge.buildInterventionLink({
      linkId: 'human-bridge-v2-' + route.definition.slug + '-20260819',
      generatedAt: GENERATED_AT,
      cycleReceipt: route.current.outcome.cycleReceipt,
      protocol: route.protocol
    });
    const linkCheck = Bridge.verifyInterventionLink(link, route.current.outcome.cycleReceipt, route.protocol);
    if (!linkCheck.pass) throw new Error('current intervention link invalid for ' + route.definition.capabilityId + ': ' + linkCheck.errors.join('; '));
    if (route.current.humanClaim.admittedVerdict !== 'NOT_RUN' || route.current.humanClaim.routeStatus !== 'NOT_PROVEN') {
      throw new Error('current human claim is no longer NOT_RUN / NOT_PROVEN for ' + route.definition.capabilityId);
    }
    return { ...route, link };
  });
  if (routes.length !== 4 || new Set(routes.map((route) => route.definition.capabilityId)).size !== 4) {
    throw new Error('exact current route coverage is not four unique capability chains');
  }
  const modeCounts = routes.reduce((counts, route) => {
    counts[route.link.ancestry.mode] = (counts[route.link.ancestry.mode] || 0) + 1;
    return counts;
  }, {});
  if (modeCounts.CANDIDATE !== 2 || modeCounts.REUSE_EXISTING !== 2) throw new Error('unexpected current ancestry distribution');

  const routeReceipts = routes.map((route) => ({
    capabilityId: route.definition.capabilityId,
    humanClaimId: route.definition.claimId,
    currentCycleRef: receiptRef(route.current.outcome.cycleReceipt, 'cycleId', 'receiptDigest'),
    currentOutcomeRef: receiptRef(route.current.outcome, 'outcomeId', 'receiptDigest'),
    protocolRef: receiptRef(route.protocol, 'protocolId', 'protocolDigest'),
    participantPacketRef: {
      id: route.packet.packetId,
      schema: route.packet.schema,
      sha256: route.packet.packetDigest
    },
    ancestryMode: route.link.ancestry.mode,
    capabilitySurfaceRef: route.link.ancestry.capabilitySurfaceRef,
    interventionLinkRef: receiptRef(route.link, 'linkId', 'linkDigest'),
    interventionLinkVerification: 'PASS',
    bridgeState: 'WAITING_FOR_VOLUNTARY_LIVE_HUMAN_EVIDENCE',
    humanEvidenceState: 'NOT_RUN',
    humanBenefitEstablished: false
  }));

  const readiness = {
    schema: 'axm.grounded-growth-human-bridge-v2-readiness/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'ANCESTRY_COVERAGE_READY_HUMAN_EVIDENCE_NOT_RUN',
    capabilityComparison: {
      before: {
        currentCapabilityChains: 4,
        nativeInterventionLinks: 0,
        candidateAncestrySupported: 2,
        reuseExistingAncestrySupported: 0,
        endToEndAncestryReady: 2,
        establishedHumanBenefits: 0
      },
      after: {
        currentCapabilityChains: 4,
        nativeInterventionLinks: 4,
        candidateAncestrySupported: 2,
        reuseExistingAncestrySupported: 2,
        endToEndAncestryReady: 4,
        establishedHumanBenefits: 0
      }
    },
    routes: routeReceipts,
    evidenceGate: {
      exactCycleAndProtocolRequired: true,
      ancestryModeDerived: true,
      ambiguousAncestryRefused: true,
      candidateInventedForReuse: false,
      liveNativeEvaluationRequired: true,
      liveNativeJudgmentRequired: true,
      exactClaimCapabilityScopeRequired: true,
      externalSourceTrustReferenceRequired: true,
      currentExactClosureRequired: true,
      positiveLivePathVerified: false
    },
    supersession: {
      priorReadinessRef: fileRef(PRIOR_READINESS, 'prior-human-readiness-portfolio-coverage', 'axm.human-benefit-portfolio-readiness-receipt/v1'),
      exactFindingSuperseded: 'The prior finding that two REUSE_EXISTING routes lacked bridge ancestry support is superseded by four verified v2 intervention links.',
      findingsNotSuperseded: [
        'Human participation remains voluntary and NOT_RUN.',
        'No human benefit is established.',
        'The positive LIVE bridge path remains NOT_RUN.',
        'Mike remains the merge, promotion and CANON gate.'
      ]
    },
    nextGate: {
      authority: 'VOLUNTARY_LOCAL_HUMAN',
      action: 'A person may independently choose one exact answer-free packet, opt in, complete or withdraw, and later enter an explicit claim-scoped judgment. This receipt does not request participation.',
      automatic: false,
      requiredForHumanBenefitClaim: true
    },
    truth: {
      ancestryContractReady: true,
      liveOperationalPathRun: false,
      humanParticipationOccurred: false,
      sessionReceiptCreated: false,
      evaluationReceiptCreated: false,
      humanJudgmentCreated: false,
      bridgeBundleCreatedFromHumanEvidence: false,
      groundedOutcomeRefreshed: false,
      humanBenefitClaimed: false,
      humanBenefitEstablished: false,
      sourceAuthenticationClaimed: false,
      v1BridgeModified: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    sourceRefs: [
      fileRef(CURRENT_PORTFOLIO, 'current-grounded-growth-portfolio', 'axm.grounded-growth-portfolio/v1'),
      fileRef('shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js', 'grounded-growth-human-bridge-v2-core', 'text/javascript'),
      fileRef('shared/grounded-growth-human-bridge-v2/selftest.js', 'grounded-growth-human-bridge-v2-selftest', 'text/javascript'),
      fileRef('shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js', 'preserved-grounded-growth-human-bridge-v1-core', 'text/javascript')
    ],
    receiptDigest: null
  };
  const readinessPayload = JSON.parse(JSON.stringify(readiness));
  delete readinessPayload.receiptDigest;
  readiness.receiptDigest = Bridge.sha256(readinessPayload);

  const requirements = buildRequirements();
  const inventory = buildInventory(routes.length);
  return {
    routes,
    requirements,
    inventory,
    gapReport: buildGapReport(requirements, inventory),
    readiness
  };
}

function outputFiles(result) {
  const files = new Map();
  for (const route of result.routes) files.set('links/' + route.definition.slug + '-intervention-link.json', route.link);
  files.set('CAPABILITY_REQUIREMENTS.json', result.requirements);
  files.set('CAPABILITY_INVENTORY.json', result.inventory);
  files.set('CAPABILITY_GAP_REPORT.json', result.gapReport);
  files.set('CURRENT_BRIDGE_READINESS.json', result.readiness);
  return files;
}

function writeAll() {
  const result = buildAll();
  for (const [relativePath, value] of outputFiles(result)) {
    const target = path.join(__dirname, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pretty(value), 'utf8');
  }
  return result;
}

function loadRecordedRoutes() {
  return Prior.loadRecordedRoutes().map((route) => {
    const link = JSON.parse(fs.readFileSync(path.join(__dirname, 'links', route.definition.slug + '-intervention-link.json'), 'utf8'));
    const linkCheck = Bridge.verifyInterventionLink(link, route.current.outcome.cycleReceipt, route.protocol);
    if (!linkCheck.pass) {
      throw new Error('recorded intervention link invalid for ' + route.definition.capabilityId + ': ' + linkCheck.errors.join('; '));
    }
    return { ...route, link };
  });
}

function verifyRecorded() {
  const result = buildAll();
  for (const [relativePath, expected] of outputFiles(result)) {
    const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, ...relativePath.split('/')), 'utf8'));
    if (Bridge.stableStringify(recorded) !== Bridge.stableStringify(expected)) throw new Error(relativePath + ' differs from exact current sources');
  }
  return result;
}

function main() {
  if (process.argv.includes('--write')) {
    const result = writeAll();
    console.log('WROTE ' + outputFiles(result).size + ' exact v2 ancestry readiness artifacts; human evidence NOT_RUN');
    return;
  }
  if (process.argv.includes('--check-recorded')) {
    const result = verifyRecorded();
    console.log('PASS exact v2 ancestry readiness covers ' + result.routes.length + ' current capability chains; human evidence NOT_RUN');
    return;
  }
  console.log(pretty(buildAll().readiness));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildAll, loadRecordedRoutes, verifyRecorded, writeAll };
