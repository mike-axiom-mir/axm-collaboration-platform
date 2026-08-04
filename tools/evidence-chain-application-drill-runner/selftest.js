#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Retention = require('../../shared/evidence-retention/evidence-retention-service');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Foundry = require('../evidence-chain-recovery-foundry/evidence-chain-recovery-core');
const ReviewGate = require('../evidence-chain-candidate-review-gate/evidence-chain-review-core');
const Plan = require('../evidence-chain-application-plan-foundry/evidence-chain-application-plan-core');
const Core = require('./evidence-chain-application-drill-core');
const Runner = require('./sandbox-drill-executor');

async function validRechain(source, mutate) {
  const rows = source.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
  mutate(rows);
  let previous = null;
  for (const row of rows) {
    row.previousHash = previous;
    delete row.eventHash;
    row.eventHash = await Inspector.sha256(Inspector.canonical(row));
    previous = row.eventHash;
  }
  return rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}

function requestOptions(plan, now, overrides) {
  return Object.assign({
    confirmPlanId: plan.planId,
    acknowledgeSandboxOnly: true,
    acknowledgeEphemeralCleanup: true,
    now
  }, overrides || {});
}

async function buildPipeline(temporary, generatedAt, secret) {
  const workshop = path.join(temporary, 'workshop');
  const stateRoot = path.join(workshop, 'state');
  const logs = path.join(workshop, 'logs');
  fs.mkdirSync(logs, { recursive: true });
  const sourcePath = path.join(logs, 'source.jsonl');
  const manager = Retention.create({ stateRoot, limits: { maxEvents: 20, maxBytes: 1024 * 1024 } });
  manager.record(sourcePath, { type: 'work-note', marker: secret, at: '2026-07-28T20:25:00.000Z' });
  manager.record(sourcePath, { type: 'repair-check', marker: secret, at: '2026-07-28T20:25:01.000Z' });
  const sealed = manager.seal('application-drill-test');
  const segmentPath = path.join(workshop, sealed.manifest.sourceSegment);
  const validSource = fs.readFileSync(segmentPath, 'utf8');
  const rows = validSource.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
  rows[0].payload.marker = secret + '-TAMPERED';
  const source = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
  const inspection = await Inspector.inspect(source, { label: 'application-drill-test-source' });
  const recovery = await Foundry.build(source, inspection, { acknowledgeAuthenticityUnknown: true, generatedAt });
  const assessment = await ReviewGate.assess(source, inspection, recovery.candidateJsonl, recovery.receipt, { generatedAt });
  const decision = await ReviewGate.decide(assessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', {
    acknowledgeNoAuthority: true,
    acknowledgeAuthenticityUnknown: true,
    generatedAt
  });
  const plan = await Plan.build(source, recovery.candidateJsonl, assessment, decision, {
    posture: 'ISOLATED_REPLACEMENT_COPY',
    acknowledgeCurrentDigestRecheck: true,
    acknowledgeSafetyCopyRequired: true,
    acknowledgeFreshPermissionRequired: true,
    acknowledgeNoAuthority: true,
    generatedAt
  });
  return { source, candidate: recovery.candidateJsonl, plan, sourcePath, segmentPath };
}

async function main() {
  const root = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const executorSource = fs.readFileSync(path.join(root, 'sandbox-drill-executor.js'), 'utf8');

  assert.equal(manifest.id, 'evidence-chain-application-drill-runner');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.equal(manifest.risk, 'HIGH');
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  assert(contract.provides.includes('capability.drill.evidence-chain-recovery-application/v1'));
  assert(contract.boundaries.refuses.includes('existing-sandbox-root'));
  assert(contract.boundaries.refuses.includes('live-target-read-or-write'));
  assert(contract.boundaries.refuses.includes('live-apply-capability-claim'));
  assert(contract.boundaries.refuses.includes('drill-file-retention'));

  assert(/<html\b[^>]*\blang=/i.test(html));
  assert(/name=["']viewport["']/i.test(html));
  assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
  ['sourceFile', 'candidateFile', 'planFile', 'planAck', 'sandboxAck', 'cleanupAck']
    .forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
  const localScripts = Array.from(html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi), match => match[1]);
  assert.deepEqual(localScripts, [
    '../evidence-chain-inspector/evidence-chain-core.js',
    '../evidence-chain-recovery-foundry/evidence-chain-recovery-core.js',
    '../evidence-chain-candidate-review-gate/evidence-chain-review-core.js',
    '../evidence-chain-application-plan-foundry/evidence-chain-application-plan-core.js',
    'evidence-chain-application-drill-core.js',
    'app.js'
  ]);
  localScripts.forEach(source => assert(fs.existsSync(path.resolve(root, source)), source + ' must resolve locally'));
  assert(css.includes(':focus-visible'));
  assert(css.includes('min-height: 44px'));
  assert(!/\sonclick\s*=/i.test(html));
  assert(!/<textarea\b/i.test(html));
  assert(executorSource.includes('isSymbolicLink()'));
  assert(executorSource.includes('fs.rmSync(sandboxRoot'));

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-evidence-application-drill-test-'));
  try {
    const runtimeNow = new Date().toISOString();
    const secret = 'PRIVATE-DRILL-PAYLOAD';
    const packet = await buildPipeline(temporary, runtimeNow, secret);
    const sourceSnapshot = packet.source;
    const candidateSnapshot = packet.candidate;

    const request = await Core.prepare(packet.source, packet.candidate, packet.plan, requestOptions(packet.plan, runtimeNow));
    assert.equal(request.schema, 'axm.evidence-chain-recovery-application-drill-request/v1');
    assert.equal(request.capability, 'capability.drill.evidence-chain-recovery-application/v1');
    assert.equal(request.status, 'READY_FOR_OWNED_SANDBOX_DRILL');
    assert(request.checks.every(check => check.verdict === 'PASS'));
    assert.equal(request.sandboxContract.rootMustNotExist, true);
    assert.equal(request.sandboxContract.safeNamePrefix, 'axm-evidence-chain-drill-');
    assert.deepEqual(request.drillCoverage.actualFilesystemPhases, [1, 2, 3, 4, 6, 7, 8]);
    assert.equal(request.drillCoverage.excludedPlanPhase, 5);
    ['filesystemIoPerformed', 'liveStateRead', 'liveStateWritten', 'permissionChecked', 'permissionGranted', 'trustedRecoveryServiceCalled', 'liveApplyCapabilityClosed', 'candidateAppliedLive', 'filesRetained', 'authorityGranted', 'promoted', 'canon']
      .forEach(field => assert.equal(request.truth[field], false, field + ' must remain false'));
    const repeatedRequest = await Core.prepare(packet.source, packet.candidate, packet.plan, requestOptions(packet.plan, runtimeNow));
    assert.deepEqual(repeatedRequest, request, 'request is deterministic for exact inputs and time');

    const sandboxRoot = path.join(temporary, 'axm-evidence-chain-drill-pass');
    const receipt = await Runner.execute({
      source: packet.source,
      candidate: packet.candidate,
      plan: packet.plan,
      sandboxRoot,
      confirmPlanId: packet.plan.planId,
      acknowledgeSandboxOnly: true,
      acknowledgeEphemeralCleanup: true
    }, { now: runtimeNow });
    assert.equal(receipt.schema, 'axm.evidence-chain-recovery-application-drill/v1');
    assert.equal(receipt.status, 'PASS_WITH_LIMITS');
    assert.equal(receipt.failureCode, null);
    assert.deepEqual(receipt.phaseResults.map(row => row.planPhase), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(receipt.phaseResults.find(row => row.planPhase === 5).status, 'SKIPPED_BY_CONTRACT');
    assert.equal(receipt.phaseResults.find(row => row.planPhase === 6).status, 'SANDBOX_SIMULATION_PASS');
    assert.equal(receipt.observations.safetyCopyDigestMatchesSource, true);
    assert.equal(receipt.observations.appliedCandidateDigestObserved, true);
    assert.equal(receipt.observations.rollbackSourceDigestObserved, true);
    assert.equal(receipt.observations.rollbackExactBytesRestored, true);
    assert.equal(receipt.cleanup.ownedRootCreated, true);
    assert.equal(receipt.cleanup.ownedRootDeleted, true);
    assert.equal(receipt.cleanup.filesRetained, false);
    assert.equal(fs.existsSync(sandboxRoot), false);
    assert.equal(packet.source, sourceSnapshot);
    assert.equal(packet.candidate, candidateSnapshot);
    assert.equal(receipt.limits.liveApplyCapabilityClosed, false);
    assert.equal(receipt.limits.missingCapability, 'capability.apply.evidence-chain-reviewed-recovery/v1');
    ['inputSourceFileWritten', 'inputCandidateFileWritten', 'liveStateRead', 'liveStateWritten', 'pathsEmitted', 'fileNamesEmitted', 'payloadsEmitted', 'rawLinesEmitted', 'permissionChecked', 'permissionGranted', 'trustedRecoveryServiceCalled', 'candidateAppliedLive', 'liveApplyCapabilityClosed', 'filesRetained', 'serverStarted', 'authorityGranted', 'promoted', 'canon']
      .forEach(field => assert.equal(receipt.truth[field], false, field + ' must remain false'));
    assert.equal(receipt.truth.ownedSandboxOnly, true);
    assert.equal(receipt.truth.actualFilesystemIoObserved, true);
    assert(!JSON.stringify(receipt).includes(secret));
    assert(!JSON.stringify(receipt).includes(packet.sourcePath));
    assert(!JSON.stringify(receipt).includes(packet.segmentPath));
    assert(!JSON.stringify(receipt).includes(sandboxRoot));
    ['target.jsonl', 'safety-copy.jsonl', 'candidate.stage.jsonl', 'rollback-source.jsonl'].forEach(name => assert(!JSON.stringify(receipt).includes(name)));

    const existingRoot = path.join(temporary, 'axm-evidence-chain-drill-existing');
    fs.mkdirSync(existingRoot);
    const marker = path.join(existingRoot, 'owned-by-test.txt');
    fs.writeFileSync(marker, 'preserve');
    await assert.rejects(() => Runner.execute({
      source: packet.source, candidate: packet.candidate, plan: packet.plan, sandboxRoot: existingRoot,
      confirmPlanId: packet.plan.planId, acknowledgeSandboxOnly: true, acknowledgeEphemeralCleanup: true
    }, { now: runtimeNow }), /must not already exist/);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'preserve');
    await assert.rejects(() => Runner.execute({
      source: packet.source, candidate: packet.candidate, plan: packet.plan, sandboxRoot: path.join(temporary, 'unsafe-name'),
      confirmPlanId: packet.plan.planId, acknowledgeSandboxOnly: true, acknowledgeEphemeralCleanup: true
    }, { now: runtimeNow }), /safe drill prefix/);
    await assert.rejects(() => Runner.execute({
      source: packet.source, candidate: packet.candidate, plan: packet.plan, sandboxRoot: 'axm-evidence-chain-drill-relative',
      confirmPlanId: packet.plan.planId, acknowledgeSandboxOnly: true, acknowledgeEphemeralCleanup: true
    }, { now: runtimeNow }), /absolute path/);

    await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, requestOptions(packet.plan, runtimeNow, { confirmPlanId: 'wrong' })), /exact planId/);
    await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, requestOptions(packet.plan, runtimeNow, { acknowledgeSandboxOnly: false })), /sandbox-only/);
    await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, requestOptions(packet.plan, runtimeNow, { acknowledgeEphemeralCleanup: false })), /cleanup acknowledgement/);
    const expiredNow = new Date(Date.parse(packet.plan.expiresAt) + 1000).toISOString();
    await assert.rejects(() => Core.prepare(packet.source, packet.candidate, packet.plan, requestOptions(packet.plan, expiredNow)), /expired/);
    const badPlanId = JSON.parse(JSON.stringify(packet.plan));
    badPlanId.planId = '0'.repeat(64);
    await assert.rejects(() => Core.prepare(packet.source, packet.candidate, badPlanId, requestOptions(badPlanId, runtimeNow)), /PLAN_ID_RECOMPUTES/);

    const alteredCandidate = await validRechain(packet.candidate, rows => { rows[0].payload.marker = secret + '-SECOND-CHANGE'; });
    assert.equal((await Inspector.inspect(alteredCandidate)).verdict, 'PASS');
    await assert.rejects(() => Core.prepare(packet.source, alteredCandidate, packet.plan, requestOptions(packet.plan, runtimeNow)), /CANDIDATE_DIGEST_MATCHES_PLAN, NON_HASH_FIELDS_PRESERVED/);
    const invalidCandidate = packet.candidate.replace(/"eventHash":"[a-f0-9]{64}"/, '"eventHash":"invalid"');
    await assert.rejects(() => Core.prepare(packet.source, invalidCandidate, packet.plan, requestOptions(packet.plan, runtimeNow)), /CANDIDATE_CHAIN_VALID/);

    for (const faultAt of ['AFTER_BACKUP', 'AFTER_STAGE', 'AFTER_APPLY']) {
      const faultRoot = path.join(temporary, 'axm-evidence-chain-drill-' + faultAt.toLowerCase().replace(/_/g, '-'));
      const aborted = await Runner.execute({
        source: packet.source, candidate: packet.candidate, plan: packet.plan, sandboxRoot: faultRoot,
        confirmPlanId: packet.plan.planId, acknowledgeSandboxOnly: true, acknowledgeEphemeralCleanup: true
      }, { now: runtimeNow, faultAt });
      assert.equal(aborted.status, 'ABORTED');
      assert.equal(aborted.failureCode, 'INJECTED_' + faultAt);
      assert.equal(aborted.cleanup.ownedRootDeleted, true);
      assert.equal(aborted.cleanup.filesRetained, false);
      assert.equal(fs.existsSync(faultRoot), false);
      assert.equal(aborted.truth.liveStateWritten, false);
    }

    const cliSource = path.join(temporary, 'cli-source.jsonl');
    const cliCandidate = path.join(temporary, 'cli-candidate.jsonl');
    const cliPlan = path.join(temporary, 'cli-plan.json');
    fs.writeFileSync(cliSource, packet.source);
    fs.writeFileSync(cliCandidate, packet.candidate);
    fs.writeFileSync(cliPlan, JSON.stringify(packet.plan));
    const cliSourceBefore = fs.readFileSync(cliSource, 'utf8');
    const cliCandidateBefore = fs.readFileSync(cliCandidate, 'utf8');
    const cliRoot = path.join(temporary, 'axm-evidence-chain-drill-cli');
    const cli = spawnSync(process.execPath, [path.join(root, 'cli.js'), '--source', cliSource, '--candidate', cliCandidate, '--plan', cliPlan, '--sandbox-root', cliRoot, '--confirm', packet.plan.planId, '--sandbox-only', '--cleanup'], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const cliReceipt = JSON.parse(cli.stdout);
    assert.equal(cliReceipt.status, 'PASS_WITH_LIMITS');
    assert.equal(fs.existsSync(cliRoot), false);
    assert.equal(fs.readFileSync(cliSource, 'utf8'), cliSourceBefore);
    assert.equal(fs.readFileSync(cliCandidate, 'utf8'), cliCandidateBefore);
    assert(!cli.stdout.includes(cliSource));
    assert(!cli.stdout.includes(cliCandidate));
    assert(!cli.stdout.includes(cliRoot));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  const sampleTime = new Date().toISOString();
  const sample = await Core.example({ generatedAt: sampleTime });
  const sampleRequest = await Core.prepare(sample.source, sample.candidate, sample.plan, requestOptions(sample.plan, sampleTime));
  assert.equal(sampleRequest.status, 'READY_FOR_OWNED_SANDBOX_DRILL');
  assert(app.includes('.text()'));
  assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
  assert(!app.includes('localStorage'));
  assert(!app.includes('sessionStorage'));
  assert(!app.includes('fetch('));

  console.log('Evidence Chain Application Drill Runner selftest: PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
