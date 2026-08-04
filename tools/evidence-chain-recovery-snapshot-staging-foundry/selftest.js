#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Conformance = require('../evidence-chain-recovery-adapter-conformance-lab/evidence-chain-recovery-adapter-conformance-core');
const Runner = require('../evidence-chain-recovery-adapter-conformance-lab/conformance-runner');
const Reference = require('../evidence-chain-recovery-adapter-conformance-lab/reference-fixture-adapter');
const Integration = require('../evidence-chain-recovery-adapter-integration-foundry/evidence-chain-recovery-adapter-integration-core');
const Core = require('./evidence-chain-recovery-snapshot-staging-core');
const Materializer = require('./snapshot-staging-materializer');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function removeExact(target) { if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true }); }

async function main() {
  const root = path.join(__dirname, '..', '..');
  const baseMs = Date.now() - 4 * 60 * 1000;
  const planTime = new Date(baseMs).toISOString();
  const conformanceTime = new Date(baseMs + 60 * 1000).toISOString();
  const integrationTime = new Date(baseMs + 120 * 1000).toISOString();
  const stagingTime = new Date(baseMs + 180 * 1000).toISOString();
  const bundle = await Conformance.example({ generatedAt: planTime });
  const conformanceReceipt = await Runner.run(Reference.createAdapter(), bundle.source, bundle.candidate, bundle.plan, {
    confirmPlanId: bundle.plan.planId,
    acknowledgeFixtureOnly: true,
    acknowledgeNoAuthority: true,
    now: conformanceTime
  });
  const recoveryManifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'recovery-center', 'manifest.json'), 'utf8'));
  const recoveryContract = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'recovery-center', 'module.contract.json'), 'utf8'));
  const integrationPacket = await Integration.build("'use strict';\n// inert reviewed adapter candidate\n", bundle.plan, conformanceReceipt, recoveryManifest, recoveryContract, {
    acknowledgeArtifactIsData: true,
    acknowledgeNoAuthority: true,
    acknowledgeIndependentIdentityTests: true,
    acknowledgeLiveRollbackRequired: true,
    generatedAt: integrationTime
  });
  const targetRelativePath = 'state/evidence-retention/selftest-session/events.jsonl';
  const options = {
    confirmPacketId: integrationPacket.packetId,
    acknowledgePrivateTargetPath: true,
    acknowledgeRetainedStaging: true,
    acknowledgeNoLivePlacement: true,
    acknowledgeNoAuthority: true,
    now: stagingTime
  };
  const sourceSnapshot = bundle.source;
  const candidateSnapshot = bundle.candidate;
  const planSnapshot = JSON.stringify(bundle.plan);
  const receiptSnapshot = JSON.stringify(conformanceReceipt);
  const packetSnapshot = JSON.stringify(integrationPacket);

  assert.equal(Core.CAPABILITY, 'capability.stage.evidence-chain-recovery-snapshot/v1');
  assert.equal(Core.PLACE_CAPABILITY, 'capability.place.evidence-chain-recovery-snapshot/v1');
  assert.equal(Core.normalizeTarget(targetRelativePath), targetRelativePath);
  const request = await Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, options);
  const repeatedRequest = await Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, options);
  assert.deepEqual(repeatedRequest, request, 'same exact inputs and time must produce the same request');
  assert.equal(request.schema, Core.REQUEST_SCHEMA);
  assert.equal(request.status, 'READY_FOR_EXPLICIT_RECOVERY_SNAPSHOT_STAGING');
  assert(request.snapshotId.startsWith(Core.SNAPSHOT_PREFIX));
  assert.equal(request.target.relativePath, targetRelativePath);
  assert.equal(request.target.pathIncluded, true);
  assert.equal(request.candidateBytes, Buffer.byteLength(bundle.candidate));
  assert.equal(request.truth.candidatePayloadIncluded, false);
  assert.equal(request.truth.filesystemIoPerformed, false);
  assert.equal(request.truth.snapshotPlacedLive, false);
  assert.equal(request.limits.missingPlacementCapability, Core.PLACE_CAPABILITY);

  assert.throws(() => Core.normalizeTarget('events.jsonl'), /under state\/evidence-retention/);
  assert.throws(() => Core.normalizeTarget('state/evidence-retention/events.jsonl'), /under state\/evidence-retention/);
  assert.throws(() => Core.normalizeTarget('state/evidence-retention/../events.jsonl'), /unsafe path segment/);
  assert.throws(() => Core.normalizeTarget('state/evidence-retention/session/events.txt'), /JSONL file/);
  assert.throws(() => Core.normalizeTarget('C:\\state\\evidence-retention\\session\\events.jsonl'), /relative path/);
  assert.throws(() => Core.normalizeTarget('/state/evidence-retention/session/events.jsonl'), /relative path/);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, { ...options, confirmPacketId: '0'.repeat(64) }), /exact integration packet confirmation/);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, { ...options, acknowledgePrivateTargetPath: false }), /private target path acknowledgement/);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, { ...options, acknowledgeRetainedStaging: false }), /retained staging acknowledgement/);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, { ...options, acknowledgeNoLivePlacement: false }), /no-live-placement acknowledgement/);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, { ...options, acknowledgeNoAuthority: false }), /no-authority acknowledgement/);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, { ...options, now: new Date(baseMs + 16 * 60 * 1000).toISOString() }), /expired/);
  const badPacketId = clone(integrationPacket); badPacketId.packetId = '0'.repeat(64);
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, badPacketId, targetRelativePath, { ...options, confirmPacketId: badPacketId.packetId }), /packetId does not recompute/);
  const falseStaging = clone(integrationPacket); falseStaging.truth.candidateStagingAvailable = true;
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, falseStaging, targetRelativePath, options), /candidateStagingAvailable must be false/);
  const openedGate = clone(integrationPacket); openedGate.acceptanceGates.find(item => item.code === 'CANDIDATE_STAGING_ADAPTER_IMPLEMENTED').state = 'PASS';
  await assert.rejects(() => Core.prepare(bundle.source, bundle.candidate, bundle.plan, conformanceReceipt, openedGate, targetRelativePath, options), /acceptance gates mismatch/);
  const changedCandidate = bundle.candidate.replace('"type"', '"kind"');
  await assert.rejects(() => Core.prepare(bundle.source, changedCandidate, bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, options), /application drill refused/);

  const outputRoot = path.join(root, Core.SAFE_ROOT_PREFIX + 'selftest-' + process.pid + '-' + Date.now());
  removeExact(outputRoot);
  const receipt = await Materializer.execute({
    source: bundle.source,
    candidate: bundle.candidate,
    plan: bundle.plan,
    conformanceReceipt,
    integrationPacket,
    targetRelativePath,
    outputRoot,
    options
  });
  assert.equal(receipt.schema, Core.RECEIPT_SCHEMA);
  assert.equal(receipt.status, 'STAGED_FOR_HUMAN_PLACEMENT_WITH_LIMITS');
  assert.equal(receipt.snapshotId, request.snapshotId);
  assert.equal(receipt.observations.candidateExactBytesObserved, true);
  assert.equal(receipt.observations.manifestCandidateLedgerMatches, true);
  assert.equal(receipt.observations.retainedForHumanReview, true);
  assert.equal(receipt.privacy.outputRootPathIncluded, false);
  assert.equal(receipt.privacy.targetRelativePathIncluded, false);
  assert.equal(receipt.truth.actualFilesystemWrite, true);
  assert.equal(receipt.truth.stagedRootRetained, true);
  assert.equal(receipt.truth.WorkshopPackagerOutputWritten, false);
  assert.equal(receipt.truth.snapshotPlacedLive, false);
  assert.equal(receipt.truth.RecoveryCenterCalled, false);
  assert.equal(receipt.limits.missingPlacementCapability, Core.PLACE_CAPABILITY);
  assert(fs.existsSync(outputRoot));
  const packageRoot = path.join(outputRoot, receipt.snapshotId);
  assert(fs.statSync(packageRoot).isDirectory());
  const stagedTarget = path.join(packageRoot, ...targetRelativePath.split('/'));
  assert.equal(fs.readFileSync(stagedTarget, 'utf8'), bundle.candidate);
  const manifestText = fs.readFileSync(path.join(packageRoot, 'PACKAGE_MANIFEST.json'), 'utf8');
  const packageManifest = JSON.parse(manifestText);
  assert.equal(packageManifest.schema, 'axm.workshop-package/v1');
  assert.equal(packageManifest.mode, 'full');
  assert.equal(packageManifest.file_count, 1);
  assert.equal(packageManifest.files[0].path, targetRelativePath);
  assert.equal(packageManifest.files[0].sha256, request.candidateSha256);
  assert.equal(packageManifest.total_bytes, Buffer.byteLength(bundle.candidate));
  assert.equal(packageManifest.truth.staging_only, true);
  assert.equal(packageManifest.truth.recovery_center_called, false);
  assert.equal(receipt.manifestSha256, await Inspector.sha256(manifestText));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputRoot, 'STAGING_RECEIPT.json'), 'utf8')), receipt);
  const serializedReceipt = JSON.stringify(receipt);
  assert(!serializedReceipt.includes(outputRoot));
  assert(!serializedReceipt.includes(targetRelativePath));
  assert(!serializedReceipt.includes(bundle.source));
  assert(!serializedReceipt.includes(bundle.candidate));

  const existingRoot = path.join(root, Core.SAFE_ROOT_PREFIX + 'existing-' + process.pid);
  removeExact(existingRoot); fs.mkdirSync(existingRoot); fs.writeFileSync(path.join(existingRoot, 'marker.txt'), 'preserve');
  await assert.rejects(() => Materializer.execute({ source: bundle.source, candidate: bundle.candidate, plan: bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, outputRoot: existingRoot, options }), /must not already exist/);
  assert.equal(fs.readFileSync(path.join(existingRoot, 'marker.txt'), 'utf8'), 'preserve');
  removeExact(existingRoot);
  await assert.rejects(() => Materializer.execute({ source: bundle.source, candidate: bundle.candidate, plan: bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, outputRoot: 'relative-stage', options }), /absolute path/);
  await assert.rejects(() => Materializer.execute({ source: bundle.source, candidate: bundle.candidate, plan: bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, outputRoot: path.join(root, 'unsafe-stage-' + process.pid), options }), /name must start/);

  for (const faultAt of ['AFTER_ROOT', 'AFTER_CANDIDATE', 'AFTER_MANIFEST']) {
    const faultRoot = path.join(root, Core.SAFE_ROOT_PREFIX + faultAt.toLowerCase().replace(/_/g, '-') + '-' + process.pid + '-' + Date.now());
    removeExact(faultRoot);
    await assert.rejects(() => Materializer.execute({ source: bundle.source, candidate: bundle.candidate, plan: bundle.plan, conformanceReceipt, integrationPacket, targetRelativePath, outputRoot: faultRoot, options, faultAt }), /injected staging fault/);
    assert.equal(fs.existsSync(faultRoot), false, 'fault root must be cleaned: ' + faultAt);
  }

  const inputRoot = fs.mkdtempSync(path.join(root, '.tmp-evidence-staging-input-'));
  const cliRoot = path.join(root, Core.SAFE_ROOT_PREFIX + 'cli-' + process.pid + '-' + Date.now());
  try {
    const files = {
      source: path.join(inputRoot, 'source.jsonl'),
      candidate: path.join(inputRoot, 'candidate.jsonl'),
      plan: path.join(inputRoot, 'plan.json'),
      conformance: path.join(inputRoot, 'conformance.json'),
      integration: path.join(inputRoot, 'integration.json')
    };
    fs.writeFileSync(files.source, bundle.source);
    fs.writeFileSync(files.candidate, bundle.candidate);
    fs.writeFileSync(files.plan, JSON.stringify(bundle.plan));
    fs.writeFileSync(files.conformance, JSON.stringify(conformanceReceipt));
    fs.writeFileSync(files.integration, JSON.stringify(integrationPacket));
    const before = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'cli.js'), '--source', files.source, '--candidate', files.candidate, '--plan', files.plan, '--conformance', files.conformance, '--integration', files.integration, '--target-relative', targetRelativePath, '--output-root', cliRoot, '--confirm', integrationPacket.packetId, '--target-path-private', '--retain-staging', '--no-live-placement', '--no-authority'], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const cliReceipt = JSON.parse(cli.stdout);
    assert.equal(cliReceipt.status, 'STAGED_FOR_HUMAN_PLACEMENT_WITH_LIMITS');
    assert(fs.existsSync(path.join(cliRoot, cliReceipt.snapshotId, 'PACKAGE_MANIFEST.json')));
    Object.entries(files).forEach(([key, file]) => assert.equal(fs.readFileSync(file, 'utf8'), before[key]));
  } finally {
    removeExact(cliRoot);
    removeExact(inputRoot);
  }

  assert.equal(bundle.source, sourceSnapshot);
  assert.equal(bundle.candidate, candidateSnapshot);
  assert.equal(JSON.stringify(bundle.plan), planSnapshot);
  assert.equal(JSON.stringify(conformanceReceipt), receiptSnapshot);
  assert.equal(JSON.stringify(integrationPacket), packetSnapshot);
  removeExact(outputRoot);
  assert.equal(fs.existsSync(outputRoot), false);

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert.equal(manifest.status, 'TEST');
  assert.deepEqual(manifest.permissions, []);
  assert(contract.provides.includes(Core.CAPABILITY));
  assert(contract.boundaries.refuses.includes('Workshop-Packager-output-write'));
  assert(contract.boundaries.refuses.includes('live-snapshot-placement'));
  assert(html.includes('Staging is not placement') && html.includes('Success retains one explicit root'));
  assert(!/localStorage|sessionStorage|eval\(|new Function|import\(/.test(app));
  console.log('Evidence Chain Recovery Snapshot Staging Foundry selftest: PASS');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
