'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Builder = require('./build-portfolio-readiness');
const Route = require('./run-portfolio-human-session');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function throws(fn, pattern, message) {
  assert.throws(fn, pattern);
  ok(true, message);
}

const configuredRoot = process.env.AXM_TEST_TEMP;
if (!configuredRoot) throw new Error('AXM_TEST_TEMP is required for human readiness portfolio selftest');
const exactRoot = path.resolve(configuredRoot);
if (path.parse(exactRoot).root === exactRoot) throw new Error('AXM_TEST_TEMP cannot be a drive root');
fs.mkdirSync(exactRoot, { recursive: true });
const testRoot = fs.mkdtempSync(path.join(exactRoot, 'human-readiness-portfolio-'));

function writeFixture(name, value) {
  const target = path.join(testRoot, name);
  fs.writeFileSync(target, JSON.stringify(value, null, 2), 'utf8');
  return target;
}

function withdrawalInput(protocol, id) {
  return {
    schema: 'axm.human-benefit-response-input/v1',
    protocolRef: { id: protocol.protocolId, schema: protocol.schema, sha256: protocol.protocolDigest },
    sessionId: id,
    generatedAt: '2026-08-19T10:49:00.000Z',
    fixtureMode: 'LIVE',
    startedAt: '2026-08-19T10:46:00.000Z',
    completedAt: '2026-08-19T10:48:00.000Z',
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      grantedAt: '2026-08-19T10:45:30.000Z',
      completionConfirmedAt: null,
      withdrawnAt: '2026-08-19T10:47:00.000Z',
      useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
      retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: [],
    participantJudgment: null
  };
}

try {
  const result = Builder.verifyRecorded();
  ok(result.routes.length === 4, 'one exact readiness route exists for every current capability chain');
  ok(result.routes.filter((route) => route.provenance === 'REUSED_EXACT_EXISTING_ROUTE').length === 1, 'existing source-closure route is reused without rewrite');
  ok(result.routes.filter((route) => route.provenance === 'NEW_SCOPED_ROUTE').length === 3, 'three previously uncovered capability chains receive scoped routes');
  ok(new Set(result.routes.map((route) => route.definition.capabilityId)).size === 4, 'capability route identities are unique');
  ok(new Set(result.routes.map((route) => route.protocol.protocolDigest)).size === 4, 'protocol digests are capability-specific');

  for (const route of result.routes) {
    const protocolCheck = Human.verifyProtocol(route.protocol);
    const packetCheck = Builder.verifyParticipantPacket(route.protocol, route.packet);
    ok(protocolCheck.pass, route.definition.capabilityId + ' protocol passes the native verifier');
    ok(packetCheck.pass, route.definition.capabilityId + ' participant packet is exact and answer-free');
    ok(route.protocol.fixtureMode === 'LIVE', route.definition.capabilityId + ' protocol cannot accept a synthetic fixture as live');
    ok(route.protocol.claim.targetScope === 'NAMED_LOCAL_STEWARD', route.definition.capabilityId + ' protocol remains one-person scoped');
    ok(route.protocol.consent.mode === 'VOLUNTARY_OPT_IN' && route.protocol.consent.withdrawalAllowed, route.definition.capabilityId + ' protocol requires voluntary opt-in and permits withdrawal');
    ok(route.protocol.retention.freeText === 'FORBIDDEN' && route.protocol.retention.rawRecording === 'FORBIDDEN', route.definition.capabilityId + ' protocol forbids free text and raw recording');
    ok(route.current.humanClaim.admittedVerdict === 'NOT_RUN', route.definition.capabilityId + ' current human claim remains NOT_RUN');
  }

  const allTrialIds = result.routes.flatMap((route) => route.protocol.trials.map((trial) => route.definition.capabilityId + ':' + trial.id));
  ok(new Set(allTrialIds).size === allTrialIds.length, 'trial identities are unique within their explicit capability route');
  ok(result.readiness.capabilityComparison.after.concreteVoluntaryProtocolRoutes === 4, 'readiness receipt records full voluntary protocol coverage');
  ok(result.readiness.capabilityComparison.after.establishedHumanBenefits === 0, 'readiness receipt does not convert coverage into human benefit');
  ok(result.readiness.capabilityComparison.after.currentBridgeAncestrySupported === 2, 'candidate-cycle bridge ancestry is recognized for two routes');
  ok(result.readiness.capabilityComparison.after.currentBridgeAncestryBlocked === 2, 'reuse-existing bridge ancestry gap stays explicit for two routes');
  ok(result.gapReport.overall === 'DEGRADED', 'capability gap report refuses a fully ready label while reuse ancestry is unsupported');
  ok(result.gapReport.proposedHands[0].status === 'PROPOSED_NOT_BUILT', 'missing bridge hand stays a proposal rather than a claimed implementation');
  ok(result.readiness.unresolvedTechnicalGate.humanParticipationShouldWaitForBridgeRepair === true, 'receipt tells humans to wait where the technical bridge is incomplete');
  ok(result.readiness.truth.humanParticipationOccurred === false && result.readiness.truth.sessionReceiptCreated === false, 'readiness receipt claims no participation or session');
  ok(result.readiness.truth.humanBenefitClaimed === false && result.readiness.truth.humanBenefitEstablished === false, 'readiness receipt claims no human benefit');

  const baselineCapability = 'simulation.baseline.capsule.verify';
  const packageCapability = 'test.tool-forge.package-proof.workspace-local-route';
  const baseline = Route.selectExact(baselineCapability);
  const packageRoute = Route.selectExact(packageCapability);
  const withdrawalPath = writeFixture('withdrawal.json', withdrawalInput(baseline.protocol, 'portfolio-withdrawal-check'));
  const withdrawal = Route.buildSession(baselineCapability, withdrawalPath);
  ok(withdrawal.state === 'WITHDRAWN', 'selected route accepts an explicit voluntary withdrawal');
  ok(withdrawal.participantRef === null && withdrawal.observations.length === 0 && withdrawal.participantJudgment === null, 'withdrawal retains no participant reference, observations, or judgment');
  ok(withdrawal.usableAsLiveEvidence === false, 'withdrawal cannot become live human evidence');

  const cross = withdrawalInput(baseline.protocol, 'cross-capability-check');
  const crossPath = writeFixture('cross-capability.json', cross);
  throws(() => Route.buildSession(packageCapability, crossPath), /protocolRef does not match/, 'cross-capability response binding is refused');

  const synthetic = withdrawalInput(baseline.protocol, 'synthetic-relabel-check');
  synthetic.fixtureMode = 'SYNTHETIC';
  const syntheticPath = writeFixture('synthetic.json', synthetic);
  throws(() => Route.buildSession(baselineCapability, syntheticPath), /fixtureMode must match protocol/, 'synthetic input cannot be relabelled as a live route');

  const coerced = withdrawalInput(baseline.protocol, 'coerced-consent-check');
  coerced.consent.mode = 'REQUIRED';
  const coercedPath = writeFixture('coerced.json', coerced);
  throws(() => Route.buildSession(baselineCapability, coercedPath), /mode must be VOLUNTARY_OPT_IN/, 'non-voluntary consent mode is refused');

  const unknown = withdrawalInput(packageRoute.protocol, 'identity-retention-check');
  unknown.name = 'must-not-be-retained';
  const unknownPath = writeFixture('unknown.json', unknown);
  throws(() => Route.buildSession(packageCapability, unknownPath), /forbidden or unknown fields: name/, 'raw identity or unknown response fields are refused');

  const insidePath = path.join(__dirname, 'PORTFOLIO_READINESS_RECEIPT.json');
  throws(() => Route.loadResponse(baselineCapability, insidePath), /outside the Workshop repository/, 'live response input inside the repository is refused');

  const interactive = spawnSync(process.execPath, [
    path.join(__dirname, 'run-portfolio-human-session-interactive.js'), baselineCapability
  ], { encoding: 'utf8', input: 'YES\n' });
  ok(interactive.status !== 0 && /local TTY/.test(interactive.stderr), 'interactive route refuses piped or automated input before prompting');

  const humanReceiptSchemas = new Set([Human.SESSION_SCHEMA, Human.EVALUATION_SCHEMA, Human.JUDGMENT_SCHEMA]);
  const forbiddenArtifacts = fs.readdirSync(__dirname).filter((name) => {
    if (!name.endsWith('.json')) return false;
    try {
      return humanReceiptSchemas.has(JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')).schema);
    } catch (_) {
      return false;
    }
  });
  ok(forbiddenArtifacts.length === 0, 'readiness lane contains no human session, evaluation, or judgment JSON');
} finally {
  const resolvedTestRoot = fs.realpathSync(testRoot);
  const relative = path.relative(exactRoot, resolvedTestRoot);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('refusing unsafe temporary cleanup');
  fs.rmSync(resolvedTestRoot, { recursive: true, force: true });
}

console.log('\nHuman readiness portfolio coverage selftest: PASS (' + checks + ' checks)');
