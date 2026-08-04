#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const Conformance = require('../evidence-chain-recovery-adapter-conformance-lab/evidence-chain-recovery-adapter-conformance-core');
const Runner = require('../evidence-chain-recovery-adapter-conformance-lab/conformance-runner');
const Reference = require('../evidence-chain-recovery-adapter-conformance-lab/reference-fixture-adapter');
const Integration = require('../evidence-chain-recovery-adapter-integration-foundry/evidence-chain-recovery-adapter-integration-core');
const StageCore = require('../evidence-chain-recovery-snapshot-staging-foundry/evidence-chain-recovery-snapshot-staging-core');
const StageMaterializer = require('../evidence-chain-recovery-snapshot-staging-foundry/snapshot-staging-materializer');
const Recovery = require('../../shared/operations/recovery-service');
const Core = require('./evidence-chain-recovery-snapshot-placement-core');
const Materializer = require('./snapshot-placement-materializer');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function removeExact(target) { if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true }); }
function fileSha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function snapshotFiles(files) { return Object.fromEntries(files.map(file => [file, fileSha(file)])); }
function assertFileSnapshot(snapshot) { Object.entries(snapshot).forEach(([file, sha]) => assert.equal(fileSha(file), sha, 'input file changed: ' + file)); }
function makeOutputRoot(parent, name) {
  const output = path.join(parent, name, 'exports', 'workshop-packages');
  fs.mkdirSync(output, { recursive: true });
  return output;
}

async function main() {
  const root = path.join(__dirname, '..', '..');
  const fixtureRoot = fs.mkdtempSync(path.join(root, '.tmp-evidence-placement-'));
  try {
    const baseMs = Date.now() - 5 * 60 * 1000;
    const planTime = new Date(baseMs).toISOString();
    const conformanceTime = new Date(baseMs + 60 * 1000).toISOString();
    const integrationTime = new Date(baseMs + 120 * 1000).toISOString();
    const stagingTime = new Date(baseMs + 180 * 1000).toISOString();
    const placementTime = new Date(baseMs + 240 * 1000).toISOString();
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
    const target = 'state/evidence-retention/placement-selftest/events.jsonl';
    const stageOptions = {
      confirmPacketId: integrationPacket.packetId,
      acknowledgePrivateTargetPath: true,
      acknowledgeRetainedStaging: true,
      acknowledgeNoLivePlacement: true,
      acknowledgeNoAuthority: true,
      now: stagingTime
    };
    let stageCounter = 0;
    async function buildStage(label) {
      stageCounter += 1;
      const stageRoot = path.join(fixtureRoot, StageCore.SAFE_ROOT_PREFIX + label + '-' + stageCounter);
      const receipt = await StageMaterializer.execute({
        source: bundle.source,
        candidate: bundle.candidate,
        plan: bundle.plan,
        conformanceReceipt,
        integrationPacket,
        targetRelativePath: target,
        outputRoot: stageRoot,
        options: stageOptions
      });
      return { stageRoot, receipt };
    }

    const staged = await buildStage('main');
    const stageReceiptFile = path.join(staged.stageRoot, 'STAGING_RECEIPT.json');
    const packageRoot = path.join(staged.stageRoot, staged.receipt.snapshotId);
    const manifestFile = path.join(packageRoot, 'PACKAGE_MANIFEST.json');
    const candidateFile = path.join(packageRoot, ...target.split('/'));
    const stagingReceiptText = fs.readFileSync(stageReceiptFile, 'utf8');
    const manifestText = fs.readFileSync(manifestFile, 'utf8');
    const candidateText = fs.readFileSync(candidateFile, 'utf8');
    const inputSnapshot = snapshotFiles([stageReceiptFile, manifestFile, candidateFile]);
    const requestOutput = makeOutputRoot(fixtureRoot, 'request');
    const options = {
      confirmSnapshotId: staged.receipt.snapshotId,
      acknowledgePackagerOutputPlacement: true,
      acknowledgePrivateLocalData: true,
      acknowledgeRetainedStaging: true,
      acknowledgeNoRestoreAuthority: true,
      now: placementTime
    };

    assert.equal(Core.CAPABILITY, 'capability.place.evidence-chain-recovery-snapshot/v1');
    assert.equal(Core.LIVE_CAPABILITY, 'capability.apply.evidence-chain-reviewed-recovery/v1');
    assert.equal(Core.normalizeTarget(target), target);
    const request = await Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), options);
    const repeated = await Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), options);
    assert.deepEqual(repeated, request, 'same exact inputs, output binding, and time must produce the same request');
    assert.equal(request.schema, Core.REQUEST_SCHEMA);
    assert.equal(request.status, 'READY_FOR_EXPLICIT_PACKAGER_OUTPUT_PLACEMENT');
    assert.equal(request.snapshotId, staged.receipt.snapshotId);
    assert.equal(request.placementContract.copyFileCount, 2);
    assert.equal(request.placementContract.privateScratchThenAtomicRename, true);
    assert.equal(request.privacy.outputRootPathIncluded, false);
    assert.equal(request.truth.filesystemIoPerformed, false);
    assert.equal(request.truth.snapshotPlacedForDiscovery, false);
    assert.equal(request.truth.candidateApplied, false);
    assert.equal(request.limits.missingLiveApplyCapability, Core.LIVE_CAPABILITY);
    assert(!JSON.stringify(request).includes(fs.realpathSync(requestOutput)));
    assert(!JSON.stringify(request).includes(target));
    assert(!JSON.stringify(request).includes(candidateText));

    assert.throws(() => Core.normalizeTarget('state/evidence-retention/events.jsonl'), /below a retained/);
    assert.throws(() => Core.normalizeTarget('state/evidence-retention/../events.jsonl'), /unsafe path/);
    assert.throws(() => Core.normalizeTarget('state/evidence-retention/session/events.txt'), /JSONL file/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), { ...options, confirmSnapshotId: 'wrong' }), /exact snapshot confirmation/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), { ...options, acknowledgePackagerOutputPlacement: false }), /packager output placement acknowledgement/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), { ...options, acknowledgePrivateLocalData: false }), /private local data acknowledgement/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), { ...options, acknowledgeRetainedStaging: false }), /retained staging acknowledgement/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), { ...options, acknowledgeNoRestoreAuthority: false }), /no restore authority acknowledgement/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, '', options), /private packager output binding/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText + '\n', fs.realpathSync(requestOutput), options), /candidate bytes do not match/);
    const tamperedReceipt = clone(JSON.parse(stagingReceiptText)); tamperedReceipt.truth.snapshotPlacedLive = true;
    await assert.rejects(() => Core.prepare(JSON.stringify(tamperedReceipt), manifestText, candidateText, fs.realpathSync(requestOutput), options), /snapshotPlacedLive must be false/);
    const tamperedManifest = clone(JSON.parse(manifestText)); tamperedManifest.files[0].sha256 = '0'.repeat(64);
    await assert.rejects(() => Core.prepare(stagingReceiptText, JSON.stringify(tamperedManifest), candidateText, fs.realpathSync(requestOutput), options), /candidate ledger mismatch|exact-byte digest mismatch/);
    await assert.rejects(() => Core.prepare(stagingReceiptText, manifestText, candidateText, fs.realpathSync(requestOutput), { ...options, now: new Date(baseMs + Core.DEFAULT_MAX_AGE_MS + 10 * 60 * 1000).toISOString() }), /stale/);

    await assert.rejects(() => Materializer.execute({ stagingRoot: 'relative-stage', packagerOutputRoot: requestOutput, options }), /absolute path/);
    const wrongOutput = path.join(fixtureRoot, 'wrong-output'); fs.mkdirSync(wrongOutput);
    await assert.rejects(() => Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: wrongOutput, options }), /exact exports\/workshop-packages shape/);

    const unexpected = path.join(staged.stageRoot, 'unexpected.txt');
    fs.writeFileSync(unexpected, 'refuse extra payload');
    await assert.rejects(() => Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: requestOutput, options }), /unexpected or unledgered payload/);
    fs.unlinkSync(unexpected);
    assertFileSnapshot(inputSnapshot);

    const collisionOutput = makeOutputRoot(fixtureRoot, 'collision');
    const collisionFinal = path.join(collisionOutput, staged.receipt.snapshotId);
    fs.mkdirSync(collisionFinal); fs.writeFileSync(path.join(collisionFinal, 'preserve.txt'), 'preserve');
    await assert.rejects(() => Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: collisionOutput, options }), /already exists/);
    assert.equal(fs.readFileSync(path.join(collisionFinal, 'preserve.txt'), 'utf8'), 'preserve');

    const orphanOutput = makeOutputRoot(fixtureRoot, 'orphan');
    const orphan = path.join(orphanOutput, '.' + staged.receipt.snapshotId + '.placement-evidence');
    fs.mkdirSync(orphan); fs.writeFileSync(path.join(orphan, 'preserve.txt'), 'preserve');
    await assert.rejects(() => Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: orphanOutput, options }), /orphan placement scratch/);
    assert.equal(fs.readFileSync(path.join(orphan, 'preserve.txt'), 'utf8'), 'preserve');

    for (const faultAt of Materializer.FAULTS) {
      const faultOutput = makeOutputRoot(fixtureRoot, 'fault-' + faultAt.toLowerCase());
      await assert.rejects(() => Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: faultOutput, options, faultAt }), /injected placement fault/);
      assert.deepEqual(fs.readdirSync(faultOutput), [], 'owned output must be cleaned after ' + faultAt);
      assert.equal(fs.existsSync(path.join(staged.stageRoot, 'PLACEMENT_RECEIPT.json')), false, 'receipt must be cleaned after ' + faultAt);
      assertFileSnapshot(inputSnapshot);
    }

    const liveOutput = makeOutputRoot(fixtureRoot, 'success');
    const placement = await Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: liveOutput, options });
    assert.equal(placement.schema, Core.RECEIPT_SCHEMA);
    assert.equal(placement.status, 'PLACED_FOR_RECOVERY_CENTER_DISCOVERY_WITH_LIMITS');
    assert.equal(placement.snapshotId, staged.receipt.snapshotId);
    assert.equal(placement.observations.atomicRenameCompleted, true);
    assert.equal(placement.observations.receiverFolderLayoutCompatible, true);
    assert.equal(placement.truth.packagerOutputWritten, true);
    assert.equal(placement.truth.snapshotPlacedForDiscovery, true);
    assert.equal(placement.truth.RecoveryCenterCalled, false);
    assert.equal(placement.truth.restorePreviewCreated, false);
    assert.equal(placement.truth.restoreTestRun, false);
    assert.equal(placement.truth.permissionChecked, false);
    assert.equal(placement.truth.candidateApplied, false);
    assert.equal(placement.limits.missingLiveApplyCapability, Core.LIVE_CAPABILITY);
    assertFileSnapshot(inputSnapshot);
    const finalRoot = path.join(liveOutput, placement.snapshotId);
    assert.equal(fs.readFileSync(path.join(finalRoot, ...target.split('/')), 'utf8'), candidateText);
    assert.equal(fs.readFileSync(path.join(finalRoot, 'PACKAGE_MANIFEST.json'), 'utf8'), manifestText);
    const persistedPlacement = JSON.parse(fs.readFileSync(path.join(staged.stageRoot, 'PLACEMENT_RECEIPT.json'), 'utf8'));
    assert.deepEqual(persistedPlacement, placement);
    const serializedPlacement = JSON.stringify(placement);
    assert(!serializedPlacement.includes(staged.stageRoot));
    assert(!serializedPlacement.includes(liveOutput));
    assert(!serializedPlacement.includes(target));
    assert(!serializedPlacement.includes(candidateText));
    await assert.rejects(() => Materializer.execute({ stagingRoot: staged.stageRoot, packagerOutputRoot: liveOutput, options }), /placement receipt already exists/);

    const isolatedWorkshop = path.join(fixtureRoot, 'isolated-workshop');
    const stateRoot = path.join(fixtureRoot, 'receiver-state');
    const backupRoot = path.join(fixtureRoot, 'receiver-backups');
    fs.mkdirSync(isolatedWorkshop); fs.mkdirSync(stateRoot); fs.mkdirSync(backupRoot);
    const receiver = Recovery.create({
      root: isolatedWorkshop,
      stateRoot,
      backupRoot,
      packager: { outputDir: liveOutput, isActive: () => false, create: async () => { throw new Error('not used'); } }
    });
    const listed = receiver.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, placement.snapshotId);
    assert.equal(listed[0].files, 1);
    assert.equal(listed[0].restoreTest, 'UNPROVEN');
    const preview = receiver.preview(placement.snapshotId, [target], 'placement-selftest');
    assert.equal(preview.schema, 'axm.restore-preview/v2');
    assert.equal(preview.snapshotId, placement.snapshotId);
    assert.equal(preview.changes.length, 1);
    assert.equal(preview.changes[0].change, 'CREATE');
    assert.equal(fs.existsSync(path.join(isolatedWorkshop, ...target.split('/'))), false, 'preview must not apply candidate bytes');
    assert.equal(receiver.status().restores.length, 0, 'receiver compatibility test must not apply a restore');

    const cliStage = await buildStage('cli');
    const cliOutput = makeOutputRoot(fixtureRoot, 'cli-output');
    const cli = spawnSync(process.execPath, [
      path.join(__dirname, 'cli.js'),
      '--staging-root', cliStage.stageRoot,
      '--packager-output', cliOutput,
      '--confirm-snapshot', cliStage.receipt.snapshotId,
      '--place-in-packager-output', '--private-local-data', '--retain-staging', '--no-restore-authority'
    ], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const cliReceipt = JSON.parse(cli.stdout);
    assert.equal(cliReceipt.status, 'PLACED_FOR_RECOVERY_CENTER_DISCOVERY_WITH_LIMITS');
    assert(fs.existsSync(path.join(cliOutput, cliReceipt.snapshotId, 'PACKAGE_MANIFEST.json')));
    assert(fs.existsSync(path.join(cliStage.stageRoot, 'PLACEMENT_RECEIPT.json')));
    assert(!cli.stdout.includes(cliStage.stageRoot));
    assert(!cli.stdout.includes(cliOutput));

    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    assert.equal(manifest.status, 'TEST');
    assert.deepEqual(manifest.permissions, ['files', 'export', 'gate']);
    assert(contract.provides.includes(Core.CAPABILITY));
    assert(contract.boundaries.refuses.includes('Recovery-Center-call'));
    assert(contract.boundaries.refuses.includes('apply-or-rollback-claim'));
    assert(html.includes('Placement is not restore') && html.includes('No Recovery Center request is sent'));
    assert(!/localStorage|sessionStorage|eval\(|new Function|import\(/.test(app));
    console.log('Evidence Chain Recovery Snapshot Placement Foundry selftest: PASS');
  } finally {
    removeExact(fixtureRoot);
  }
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
