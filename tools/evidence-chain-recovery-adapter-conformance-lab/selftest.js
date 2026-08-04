#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./evidence-chain-recovery-adapter-conformance-core');
const Runner = require('./conformance-runner');
const Reference = require('./reference-fixture-adapter');

async function main() {
  const generatedAt = '2026-07-28T12:00:00.000Z';
  const now = '2026-07-28T12:01:00.000Z';
  const packet = await Core.example({ generatedAt });
  const options = {
    confirmPlanId: packet.plan.planId,
    acknowledgeFixtureOnly: true,
    acknowledgeNoAuthority: true,
    now
  };
  const sourceSnapshot = packet.source;
  const candidateSnapshot = packet.candidate;
  const planSnapshot = JSON.stringify(packet.plan);

  assert.equal(Core.CAPABILITY, 'capability.verify.evidence-chain-recovery-adapter/v1');
  assert.equal(Core.LIVE_CAPABILITY, 'capability.apply.evidence-chain-reviewed-recovery/v1');
  assert.deepEqual(Core.referenceProfile().methods, Core.REQUIRED_METHODS);
  const probe = await Core.prepare(packet.source, packet.candidate, packet.plan, packet.profile, options);
  const repeatedProbe = await Core.prepare(packet.source, packet.candidate, packet.plan, packet.profile, options);
  assert.deepEqual(repeatedProbe, probe, 'same bundle and time must produce the same probe');
  assert.equal(probe.schema, Core.PROBE_SCHEMA);
  assert.equal(probe.status, 'READY_FOR_FIXTURE_ADAPTER_CONFORMANCE');
  assert.equal(probe.planId, packet.plan.planId);
  assert.deepEqual(probe.requiredScenarios, Core.REQUIRED_SCENARIOS);
  assert.equal(probe.truth.fixtureAdapterExecuted, false);
  assert.equal(probe.truth.RecoveryCenterCalled, false);
  assert.equal(probe.truth.liveApplyCapabilityClosed, false);
  assert.equal(probe.limits.missingCapability, Core.LIVE_CAPABILITY);

  const receipt = await Runner.run(Reference.createAdapter(), packet.source, packet.candidate, packet.plan, options);
  const repeatedReceipt = await Runner.run(Reference.createAdapter(), packet.source, packet.candidate, packet.plan, options);
  assert.deepEqual(repeatedReceipt, receipt, 'same conforming fixture must produce the same receipt');
  assert.equal(receipt.schema, Core.RECEIPT_SCHEMA);
  assert.equal(receipt.status, 'PASS_WITH_LIMITS');
  assert.deepEqual(receipt.scenarios.map(item => item.code), Core.REQUIRED_SCENARIOS);
  assert(receipt.scenarios.every(item => item.verdict === 'PASS'));
  assert.equal(receipt.truth.fixturePermissionDenialObserved, true);
  assert.equal(receipt.truth.fixtureApplyDigestObserved, true);
  assert.equal(receipt.truth.fixtureRollbackDigestObserved, true);
  assert.equal(receipt.truth.productionAdapterExecuted, false);
  assert.equal(receipt.truth.allowedIdentityVerifiedLive, false);
  assert.equal(receipt.truth.deniedIdentityVerifiedLive, false);
  assert.equal(receipt.truth.liveTargetWritten, false);
  assert.equal(receipt.truth.liveApplyCapabilityClosed, false);
  assert.equal(receipt.limits.missingCapability, Core.LIVE_CAPABILITY);
  Runner.assertPrivate(receipt, packet.source, packet.candidate, 'selftest receipt');
  assert(!JSON.stringify(receipt).includes('retained-evidence.jsonl'));
  assert.equal(packet.source, sourceSnapshot);
  assert.equal(packet.candidate, candidateSnapshot);
  assert.equal(JSON.stringify(packet.plan), planSnapshot);

  await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, packet.profile, { ...options, acknowledgeFixtureOnly: false }), /fixture-only acknowledgement/);
  await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, packet.profile, { ...options, acknowledgeNoAuthority: false }), /no-authority acknowledgement/);
  await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, packet.profile, { ...options, confirmPlanId: '0'.repeat(64) }), /exact planId confirmation/);
  await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, packet.profile, { ...options, now: '2026-07-28T12:16:00.001Z' }), /expired/);
  assert.throws(() => Core.parseProfile({ ...packet.profile, filesystemAccess: true }), /zero-authority fixture boundary/);
  assert.throws(() => Core.parseProfile({ ...packet.profile, methods: packet.profile.methods.slice().reverse() }), /method contract mismatch/);
  assert.throws(() => Core.parseProfile('{'), /profile JSON is invalid/);

  const missingMethod = Reference.createAdapter();
  const openFixture = missingMethod.openFixture.bind(missingMethod);
  missingMethod.openFixture = async input => {
    const session = await openFixture(input);
    delete session.audit;
    return session;
  };
  await assert.rejects(() => Runner.run(missingMethod, packet.source, packet.candidate, packet.plan, options), /missing audit/);

  const defects = [
    'ALLOW_PERMISSION_DENIED',
    'ACCEPT_WRONG_APPLY_CONFIRMATION',
    'ACCEPT_STALE_PREVIEW',
    'ACCEPT_TAMPERED_CANDIDATE',
    'ACCEPT_CURRENT_STATE_DRIFT',
    'ACCEPT_WRONG_ROLLBACK_CONFIRMATION',
    'BROKEN_ROLLBACK',
    'LEAK_TARGET_PATH'
  ];
  for (const defect of defects) {
    await assert.rejects(
      () => Runner.run(Reference.createAdapter({ defects: [defect] }), packet.source, packet.candidate, packet.plan, options),
      undefined,
      'runner must reject defect ' + defect
    );
  }

  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  assert.equal(manifest.status, 'TEST');
  assert.deepEqual(manifest.permissions, []);
  assert(contract.provides.includes(Core.CAPABILITY));
  assert(contract.boundaries.refuses.includes('adapter-module-path-loading'));
  assert(contract.boundaries.refuses.includes('real-identity-authorization-claim'));
  assert(html.includes('Fixture conformance') && html.includes('does not grant live authority'));
  assert(!/localStorage|sessionStorage|eval\(|new Function/.test(app));
  assert(fs.existsSync(path.join(root, 'tools', 'evidence-chain-application-drill-runner', 'evidence-chain-application-drill-core.js')));
  console.log('Evidence Chain Recovery Adapter Conformance Lab selftest: PASS');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
