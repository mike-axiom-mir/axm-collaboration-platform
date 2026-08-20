'use strict';

const fs = require('fs');
const path = require('path');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Handoff = require('../../../shared/grounded-growth-human-handoff/grounded-growth-human-handoff');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Current = require('../2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness');
const Runner = require('./run-current-human-handoff-interactive');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GENERATED_AT = '2026-08-19T12:05:00.000Z';

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function fileRef(relativePath, id, schema) {
  const canonicalText = fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  return { id, schema, path: relativePath, sha256: Handoff.sha256(canonicalText) };
}

function receiptRef(value, idField, digestField) {
  return { id: value[idField], schema: value.schema, sha256: value[digestField] };
}

function buildRequirements() {
  return {
    requirements: [
      {
        id: 'staged-human-handoff-completeness',
        capabilities: [
          'human.handoff.session-evaluation',
          'human.handoff.explicit-judgment',
          'human.handoff.local-source-declaration',
          'human.handoff.v2-bridge-compose'
        ],
        required: true
      },
      {
        id: 'exact-current-route-coverage',
        capabilities: [
          'human.handoff.every-current-chain',
          'human.handoff.candidate-ancestry',
          'human.handoff.reuse-existing-ancestry'
        ],
        required: true
      },
      {
        id: 'voluntary-input-and-retention-boundary',
        capabilities: [
          'human.handoff.tty-only',
          'human.handoff.external-session-input',
          'human.handoff.no-write',
          'human.handoff.no-auto-participation'
        ],
        required: true
      },
      {
        id: 'source-and-evidence-truth-boundary',
        capabilities: [
          'human.handoff.declaration-not-authentication',
          'human.handoff.synthetic-hold',
          'human.handoff.current-closure-bind'
        ],
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

function buildInventory(stage) {
  const after = stage === 'after';
  const capabilities = [
      { id: 'human.handoff.session-evaluation', status: 'available', constraints: ['Native Human Benefit Evidence builds and verifies a deterministic evaluation from exact session receipts.'] },
      { id: 'human.handoff.explicit-judgment', status: 'available', constraints: ['The numeric signal remains NOT_RUN until a separate explicit claim-scoped judgment is entered.'] },
      { id: 'human.handoff.local-source-declaration', status: 'available', constraints: ['A native digest-bound NAMED_LOCAL_STEWARD declaration binds protocol, sessions, evaluation, judgment, scope and judgeRef.'] },
      { id: 'human.handoff.v2-bridge-compose', status: 'available', constraints: ['The additive handoff composes declaration, current closure and v2 bridge without selecting the judgment.'] },
      { id: 'human.handoff.every-current-chain', status: after ? 'available' : 'degraded', constraints: [after ? 'The exact interactive selector resolves all four current routes through the v2 handoff.' : 'Four session routes existed, but no complete post-session handoff route existed.'] },
      { id: 'human.handoff.candidate-ancestry', status: 'available', constraints: ['Two current routes retain exact CANDIDATE ancestry.'] },
      { id: 'human.handoff.reuse-existing-ancestry', status: 'available', constraints: ['Two current routes retain exact REUSE_EXISTING ancestry without a fabricated candidate.'] },
      { id: 'human.handoff.tty-only', status: 'available', constraints: ['The interactive handoff refuses piped or automated input before reading session evidence.'] },
      { id: 'human.handoff.external-session-input', status: 'available', constraints: ['Session inputs inside the Workshop repository are refused.'] },
      { id: 'human.handoff.no-write', status: 'available', constraints: ['The core performs no I/O and the interactive driver emits to stdout only.'] },
      { id: 'human.handoff.no-auto-participation', status: 'available', constraints: ['No session starts and no judgment is created automatically.'] },
      { id: 'human.handoff.declaration-not-authentication', status: after ? 'available' : 'degraded', constraints: [after ? 'The local declaration explicitly authenticates neither identity nor human presence and cannot represent a cohort.' : 'The v2 bridge accepted an external trust reference but no native declaration receipt preserved its limits.'] },
      { id: 'human.handoff.synthetic-hold', status: 'available', constraints: ['Synthetic positive signals and fixture judgments remain SYNTHETIC_HOLD and map to UNKNOWN.'] },
      { id: 'human.handoff.current-closure-bind', status: 'available', constraints: ['Closure covers cycle, protocol, evaluation, judgment, intervention link, comparison surfaces, baseline, exact capability surface and source declaration.'] },
      { id: 'authority.human-steward.preserve', status: 'available', constraints: ['No participation request, verdict, install, permission, promotion, merge, CANON or Foundation authority.'] },
      { id: 'growth.human-evidence.live', status: 'degraded', constraints: ['No person opted in; no LIVE session, judgment, admitted bridge package or grounded human outcome exists.'] }
  ];
  const missingBefore = new Set([
    'human.handoff.local-source-declaration',
    'human.handoff.v2-bridge-compose'
  ]);
  return { capabilities: after ? capabilities : capabilities.filter((item) => !missingBefore.has(item.id)) };
}

function buildGapReport(requirements, inventory, stage) {
  const byId = new Map(inventory.capabilities.map((capability) => [capability.id, capability]));
  const rows = requirements.requirements.map((requirement) => {
    const capabilities = requirement.capabilities.map((id) => byId.get(id) || { id, status: 'missing', constraints: [] });
    const available = capabilities.filter((item) => item.status === 'available').map((item) => item.id);
    const degraded = capabilities.filter((item) => item.status === 'degraded').map((item) => item.id);
    const unknown = capabilities.filter((item) => item.status === 'unknown').map((item) => item.id);
    const missing = capabilities.filter((item) => item.status === 'missing').map((item) => item.id);
    const status = missing.length ? 'BLOCKED' : degraded.length ? 'DEGRADED' : unknown.length
      ? (requirement.required ? 'UNKNOWN' : 'OPTIONAL_UNKNOWN')
      : 'READY';
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
    overall: rows.some((row) => row.required && row.status === 'BLOCKED') ? 'BLOCKED'
      : rows.some((row) => row.required && row.status !== 'READY') ? 'DEGRADED'
        : 'READY',
    requirements: rows,
    missingCapabilities: rows.flatMap((row) => row.missing),
    proposedHands: stage === 'before' ? [{
      id: 'grounded-growth-human-handoff',
      status: 'PROPOSED_NOT_BUILT',
      purpose: 'Compose exact sessions, explicit judgment, a native local declaration and v2 ancestry without writes, authentication claims or automatic benefit.'
    }] : []
  };
}

function buildAll() {
  const current = Current.verifyRecorded();
  if (current.routes.length !== 4) throw new Error('expected four exact current routes');
  const routeReceipts = current.routes.map((route) => {
    const selected = Runner.loadExactRoute(route.definition.capabilityId);
    if (selected.definition.capabilityId !== route.definition.capabilityId) throw new Error('interactive selector crossed capability routes');
    const protocolCheck = Human.verifyProtocol(route.protocol);
    const linkCheck = Bridge.verifyInterventionLink(route.link, route.current.outcome.cycleReceipt, route.protocol);
    if (!protocolCheck.pass) throw new Error('protocol invalid for ' + route.definition.capabilityId + ': ' + protocolCheck.errors.join('; '));
    if (!linkCheck.pass) throw new Error('v2 link invalid for ' + route.definition.capabilityId + ': ' + linkCheck.errors.join('; '));
    if (route.protocol.fixtureMode !== 'LIVE' || route.protocol.claim.targetScope !== 'NAMED_LOCAL_STEWARD') {
      throw new Error('current interactive route is not a named-local LIVE protocol: ' + route.definition.capabilityId);
    }
    return {
      capabilityId: route.definition.capabilityId,
      humanClaimId: route.definition.claimId,
      ancestryMode: route.link.ancestry.mode,
      capabilitySurfaceRef: route.link.ancestry.capabilitySurfaceRef,
      cycleRef: receiptRef(route.current.outcome.cycleReceipt, 'cycleId', 'receiptDigest'),
      protocolRef: receiptRef(route.protocol, 'protocolId', 'protocolDigest'),
      packetRef: { id: route.packet.packetId, schema: route.packet.schema, sha256: route.packet.packetDigest },
      interventionLinkRef: receiptRef(route.link, 'linkId', 'linkDigest'),
      selectorVerification: 'PASS',
      protocolVerification: 'PASS',
      interventionLinkVerification: 'PASS',
      technicalHandoffState: 'READY_FOR_OPTIONAL_LOCAL_TTY_INPUT',
      humanEvidenceState: 'NOT_RUN',
      humanBenefitEstablished: false
    };
  });
  const counts = routeReceipts.reduce((result, route) => {
    result[route.ancestryMode] = (result[route.ancestryMode] || 0) + 1;
    return result;
  }, {});
  if (counts.CANDIDATE !== 2 || counts.REUSE_EXISTING !== 2) throw new Error('unexpected current ancestry distribution');

  const requirements = buildRequirements();
  const inventoryBefore = buildInventory('before');
  const inventoryAfter = buildInventory('after');
  const gapBefore = buildGapReport(requirements, inventoryBefore, 'before');
  const gapAfter = buildGapReport(requirements, inventoryAfter, 'after');
  const readiness = {
    schema: 'axm.grounded-growth-human-handoff-readiness/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'TECHNICAL_HANDOFF_READY_HUMAN_EVIDENCE_NOT_RUN',
    capabilityComparison: {
      before: {
        currentCapabilityChains: 4,
        sessionCollectionRoutes: 4,
        nativeLocalSourceDeclarations: 0,
        completePostSessionHandoffRoutes: 0,
        liveHumanOutcomes: 0
      },
      after: {
        currentCapabilityChains: routeReceipts.length,
        sessionCollectionRoutes: routeReceipts.length,
        nativeLocalSourceDeclarations: 1,
        completePostSessionHandoffRoutes: routeReceipts.length,
        candidateRoutes: counts.CANDIDATE,
        reuseExistingRoutes: counts.REUSE_EXISTING,
        liveHumanOutcomes: 0
      }
    },
    routes: routeReceipts,
    stagedBoundary: {
      sessionCollection: 'SEPARATE_VOLUNTARY_RUNNER',
      evaluation: 'DETERMINISTIC_FROM_EXACT_SESSION_RECEIPTS',
      judgment: 'SEPARATE_EXPLICIT_LOCAL_TTY_INPUT',
      sourceTrust: 'LOCAL_DECLARATION_NOT_AUTHENTICATION',
      closure: 'CALLER_DECLARED_CURRENT_HELD_OR_UNKNOWN',
      output: 'STANDARD_OUTPUT_ONLY',
      writesAutomatically: false,
      startsParticipationAutomatically: false
    },
    livePath: {
      state: 'NOT_RUN',
      reason: 'No person opted in. Synthetic fixtures prove contract behavior and holds only.',
      sourceAuthentication: 'EXTERNAL_AND_NOT_PERFORMED',
      humanBenefitEstablished: false
    },
    truth: {
      readinessOnly: true,
      humanParticipationOccurred: false,
      liveSessionReceiptCreated: false,
      liveEvaluationCreated: false,
      liveJudgmentCreated: false,
      admittedLiveBridgePackageCreated: false,
      groundedHumanOutcomeCreated: false,
      humanBenefitClaimed: false,
      sourceAuthenticationClaimed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    sourceRefs: [
      fileRef('shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js', 'grounded-growth-human-handoff-core', 'text/javascript'),
      fileRef('shared/grounded-growth-human-handoff/selftest.js', 'grounded-growth-human-handoff-selftest', 'text/javascript'),
      fileRef('shared/grounded-growth-human-handoff/local-steward-source-declaration.schema.json', 'local-steward-source-declaration-schema', Handoff.SOURCE_DECLARATION_SCHEMA),
      fileRef('shared/grounded-growth-human-handoff/module.contract.json', 'grounded-growth-human-handoff-contract', 'axm.module-contract/v1'),
      fileRef('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/run-current-human-handoff-interactive.js', 'current-human-handoff-interactive-runner', 'text/javascript'),
      fileRef('docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/CURRENT_BRIDGE_READINESS.json', 'current-v2-bridge-readiness', 'axm.grounded-growth-human-bridge-v2-readiness/v1')
    ],
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(readiness));
  delete payload.receiptDigest;
  readiness.receiptDigest = Handoff.sha256(payload);
  return { requirements, inventoryBefore, inventoryAfter, gapBefore, gapAfter, readiness };
}

function outputFiles(result) {
  return new Map([
    ['CAPABILITY_REQUIREMENTS.json', result.requirements],
    ['CAPABILITY_INVENTORY_BEFORE.json', result.inventoryBefore],
    ['CAPABILITY_INVENTORY_AFTER.json', result.inventoryAfter],
    ['CAPABILITY_GAP_BEFORE.json', result.gapBefore],
    ['CAPABILITY_GAP_AFTER.json', result.gapAfter],
    ['CURRENT_HANDOFF_READINESS.json', result.readiness]
  ]);
}

function writeAll() {
  const result = buildAll();
  for (const [name, value] of outputFiles(result)) fs.writeFileSync(path.join(__dirname, name), pretty(value), 'utf8');
  return result;
}

function verifyRecorded() {
  const result = buildAll();
  for (const [name, expected] of outputFiles(result)) {
    const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    if (Handoff.stableStringify(recorded) !== Handoff.stableStringify(expected)) throw new Error(name + ' differs from exact current sources');
  }
  return result;
}

function main() {
  if (process.argv.includes('--write')) {
    const result = writeAll();
    console.log('WROTE ' + outputFiles(result).size + ' exact human handoff readiness artifacts; LIVE human evidence NOT_RUN');
    return;
  }
  if (process.argv.includes('--check-recorded')) {
    const result = verifyRecorded();
    console.log('PASS exact human handoff readiness covers ' + result.readiness.routes.length + ' current routes; LIVE human evidence NOT_RUN');
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

module.exports = { buildAll, verifyRecorded, writeAll };
