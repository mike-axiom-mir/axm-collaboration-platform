#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Conformance = require('../evidence-chain-recovery-adapter-conformance-lab/evidence-chain-recovery-adapter-conformance-core');
const Runner = require('../evidence-chain-recovery-adapter-conformance-lab/conformance-runner');
const Reference = require('../evidence-chain-recovery-adapter-conformance-lab/reference-fixture-adapter');
const Core = require('./evidence-chain-recovery-adapter-integration-core');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function main() {
  const planTime = '2026-07-28T13:00:00.000Z';
  const conformanceTime = '2026-07-28T13:01:00.000Z';
  const packetTime = '2026-07-28T13:02:00.000Z';
  const bundle = await Conformance.example({ generatedAt: planTime });
  const conformanceOptions = {
    confirmPlanId: bundle.plan.planId,
    acknowledgeFixtureOnly: true,
    acknowledgeNoAuthority: true,
    now: conformanceTime
  };
  const receipt = await Runner.run(Reference.createAdapter(), bundle.source, bundle.candidate, bundle.plan, conformanceOptions);
  const root = path.join(__dirname, '..', '..');
  const recoveryManifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'recovery-center', 'manifest.json'), 'utf8'));
  const recoveryContract = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'recovery-center', 'module.contract.json'), 'utf8'));
  const artifact = "'use strict';\nthrow new Error('ADAPTER_ARTIFACT_MUST_REMAIN_DATA');\n";
  const options = {
    acknowledgeArtifactIsData: true,
    acknowledgeNoAuthority: true,
    acknowledgeIndependentIdentityTests: true,
    acknowledgeLiveRollbackRequired: true,
    generatedAt: packetTime
  };
  const planSnapshot = JSON.stringify(bundle.plan);
  const receiptSnapshot = JSON.stringify(receipt);
  const manifestSnapshot = JSON.stringify(recoveryManifest);
  const contractSnapshot = JSON.stringify(recoveryContract);

  assert.equal(Core.CAPABILITY, 'capability.plan.evidence-chain-recovery-adapter-integration/v1');
  assert.equal(Core.LIVE_CAPABILITY, 'capability.apply.evidence-chain-reviewed-recovery/v1');
  assert.deepEqual(Core.REQUIRED_SCENARIOS, Conformance.REQUIRED_SCENARIOS);
  const packet = await Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, options);
  const repeated = await Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, options);
  assert.deepEqual(repeated, packet, 'same exact inputs and time must produce the same packet');
  assert.equal(packet.schema, Core.PACKET_SCHEMA);
  assert.equal(packet.status, 'INTEGRATION_ACCEPTANCE_PACKET_READY_WITH_BLOCKERS');
  assert.equal(packet.adapterArtifact.sha256, await Inspector.sha256(artifact));
  assert.equal(packet.adapterArtifact.bytes, Buffer.byteLength(artifact));
  assert.equal(packet.adapterArtifact.dataOnly, true);
  assert.equal(packet.adapterArtifact.executed, false);
  assert.equal(packet.adapterArtifact.nameIncluded, false);
  assert.equal(packet.adapterArtifact.pathIncluded, false);
  assert.equal(packet.adapterArtifact.sourceIncluded, false);
  assert.equal(packet.recoveryService.requiredPermission, 'recovery.apply');
  assert.equal(packet.recoveryService.permissionCount, 1);
  assert.equal(packet.recoveryService.declarationsAreRuntimeProof, false);
  assert.equal(packet.integrationContract.candidateTransport, 'ADAPTER_IMPLEMENTATION_REQUIRED');
  assert.equal(packet.integrationContract.productionExecutionAvailable, false);
  assert.equal(packet.acceptanceGates.length, 12);
  assert.equal(packet.acceptanceGates.filter(item => item.state === 'PASS_STATIC').length, 3);
  assert.equal(packet.acceptanceGates.filter(item => item.state === 'BLOCKED').length, 1);
  assert.equal(packet.acceptanceGates.filter(item => item.state === 'NOT_RUN').length, 8);
  assert(packet.blockers.includes('CANDIDATE_TO_RECOVERY_REQUEST_ADAPTER_NOT_IMPLEMENTED'));
  assert(packet.blockers.includes('ALLOWED_IDENTITY_NOT_VERIFIED'));
  assert(packet.blockers.includes('DENIED_IDENTITY_NOT_VERIFIED'));
  assert(packet.blockers.includes('LIVE_APPLY_NOT_TESTED'));
  assert(packet.evidenceRoutes.every(item => item.verdict === 'UNKNOWN'));
  assert.equal(packet.truth.packetOnly, true);
  assert.equal(packet.truth.artifactDigestBound, true);
  assert.equal(packet.truth.adapterImplemented, false);
  assert.equal(packet.truth.permissionGranted, false);
  assert.equal(packet.truth.RecoveryCenterCalled, false);
  assert.equal(packet.truth.liveApplyCapabilityClosed, false);
  assert.equal(packet.truth.installed, false);
  assert.equal(packet.truth.promoted, false);
  assert.equal(packet.truth.canon, false);
  const serialized = JSON.stringify(packet);
  assert(!serialized.includes('ADAPTER_ARTIFACT_MUST_REMAIN_DATA'));
  assert(!serialized.includes('retained-evidence.jsonl'));
  assert(!serialized.includes('C:\\'));
  assert.equal(JSON.stringify(bundle.plan), planSnapshot);
  assert.equal(JSON.stringify(receipt), receiptSnapshot);
  assert.equal(JSON.stringify(recoveryManifest), manifestSnapshot);
  assert.equal(JSON.stringify(recoveryContract), contractSnapshot);

  await assert.rejects(() => Core.build('', bundle.plan, receipt, recoveryManifest, recoveryContract, options), /non-empty UTF-8 text/);
  await assert.rejects(() => Core.build('a'.repeat(Core.MAX_ARTIFACT_BYTES + 1), bundle.plan, receipt, recoveryManifest, recoveryContract, options), /no larger than 2 MiB/);
  await assert.rejects(() => Core.build('before\u0000after', bundle.plan, receipt, recoveryManifest, recoveryContract, options), /NUL bytes/);
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, { ...options, acknowledgeArtifactIsData: false }), /artifact-is-data acknowledgement/);
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, { ...options, acknowledgeNoAuthority: false }), /no-authority acknowledgement/);
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, { ...options, acknowledgeIndependentIdentityTests: false }), /identity tests acknowledgement/);
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, { ...options, acknowledgeLiveRollbackRequired: false }), /live rollback acknowledgement/);
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, { ...options, generatedAt: '2026-07-28T13:16:00.001Z' }), /expired/);
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, recoveryContract, { ...options, generatedAt: '2026-07-28T12:59:59.999Z' }), /not active yet/);

  const badRun = clone(receipt); badRun.runId = '0'.repeat(64);
  await assert.rejects(() => Core.build(artifact, bundle.plan, badRun, recoveryManifest, recoveryContract, options), /runId does not recompute/);
  const badScenario = clone(receipt); badScenario.scenarios[0].verdict = 'FAIL';
  await assert.rejects(() => Core.build(artifact, bundle.plan, badScenario, recoveryManifest, recoveryContract, options), /scenario coverage mismatch/);
  const falseLiveTruth = clone(receipt); falseLiveTruth.truth.productionAdapterExecuted = true;
  await assert.rejects(() => Core.build(artifact, bundle.plan, falseLiveTruth, recoveryManifest, recoveryContract, options), /productionAdapterExecuted must be false/);
  const wrongPlan = clone(bundle.plan); wrongPlan.candidate.sha256 = '1'.repeat(64);
  await assert.rejects(() => Core.build(artifact, wrongPlan, receipt, recoveryManifest, recoveryContract, options), /digest binding mismatch/);
  const extraPermission = clone(recoveryManifest); extraPermission.permissions.push('storage');
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, extraPermission, recoveryContract, options), /exactly recovery.apply/);
  const wrongStatus = clone(recoveryManifest); wrongStatus.status = 'WORKING';
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, wrongStatus, recoveryContract, options), /manifest identity mismatch/);
  const missingOutput = clone(recoveryManifest); missingOutput.produces = missingOutput.produces.filter(item => item !== 'axm.recovery-rollback-receipt/v1');
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, missingOutput, recoveryContract, options), /missing axm.recovery-rollback-receipt/);
  const missingPermission = clone(recoveryContract); missingPermission.permissions = [];
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, missingPermission, options), /exactly recovery.apply/);
  const missingRefusal = clone(recoveryContract); missingRefusal.boundaries.refuses = missingRefusal.boundaries.refuses.filter(item => item !== 'rollback-without-safety-copy');
  await assert.rejects(() => Core.build(artifact, bundle.plan, receipt, recoveryManifest, missingRefusal, options), /missing refusal rollback-without-safety-copy/);

  assert.deepEqual(Core.parseReceipt(JSON.stringify(receipt)), receipt);
  assert.deepEqual(Core.parseRecoveryManifest(JSON.stringify(recoveryManifest)), recoveryManifest);
  assert.deepEqual(Core.parseRecoveryContract(JSON.stringify(recoveryContract)), recoveryContract);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert.equal(manifest.status, 'TEST');
  assert.deepEqual(manifest.permissions, []);
  assert(contract.provides.includes(Core.CAPABILITY));
  assert(contract.boundaries.refuses.includes('adapter-import-or-execution'));
  assert(contract.boundaries.refuses.includes('real-identity-authorization-claim'));
  assert(html.includes('Source stays inert') && html.includes('No live authority'));
  assert(!/localStorage|sessionStorage|eval\(|new Function|import\(/.test(app));
  console.log('Evidence Chain Recovery Adapter Integration Foundry selftest: PASS');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
