#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./evidence-chain-recovery-snapshot-placement-core');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');

const FAULTS = new Set(['AFTER_SCRATCH', 'AFTER_CANDIDATE', 'AFTER_MANIFEST', 'AFTER_RENAME', 'AFTER_RECEIPT']);

function pathKey(value) { return process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value); }

function validateCanonicalDirectory(value, label) {
  const supplied = String(value || '');
  if (!supplied || !path.isAbsolute(supplied)) throw new Error(label + ' must be an absolute path');
  const resolved = path.resolve(supplied);
  if (!fs.existsSync(resolved)) throw new Error(label + ' must already exist');
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(label + ' must be a real directory, not a symlink');
  const parent = path.dirname(resolved);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error(label + ' parent must be a real directory, not a symlink');
  const canonical = fs.realpathSync(resolved);
  if (pathKey(canonical) !== pathKey(resolved)) throw new Error(label + ' must be canonical');
  return canonical;
}

function validateStagingRoot(value) {
  const root = validateCanonicalDirectory(value, 'staging root');
  if (!path.basename(root).startsWith(Core.SAFE_ROOT_PREFIX)) throw new Error('staging root name must start with ' + Core.SAFE_ROOT_PREFIX);
  return root;
}

function validateOutputRoot(value) {
  const root = validateCanonicalDirectory(value, 'packager output root');
  if (path.basename(root).toLowerCase() !== 'workshop-packages' || path.basename(path.dirname(root)).toLowerCase() !== 'exports') throw new Error('packager output root must have the exact exports/workshop-packages shape');
  return root;
}

function assertSeparateRoots(stagingRoot, outputRoot) {
  const stage = pathKey(stagingRoot), output = pathKey(outputRoot);
  const stagePrefix = stage + path.sep, outputPrefix = output + path.sep;
  if (stage === output || stage.startsWith(outputPrefix) || output.startsWith(stagePrefix)) throw new Error('staging and packager output roots must be separate');
}

function safeResolveUnder(root, relative) {
  const target = path.resolve(root, String(relative).split('/').join(path.sep));
  if (!pathKey(target).startsWith(pathKey(root) + path.sep)) throw new Error('package path escaped its root');
  return target;
}

function readUtf8Exact(file, label) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error(label + ' is not exact UTF-8');
  return { bytes, text };
}

function walkTree(root) {
  const files = [], directories = [];
  function visit(folder) {
    const entries = fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(folder, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error('symlink is forbidden in placement input/output: ' + relative);
      if (stat.isDirectory()) { directories.push(relative); visit(absolute); }
      else if (stat.isFile()) files.push(relative);
      else throw new Error('special filesystem entry is forbidden in placement input/output: ' + relative);
    }
  }
  visit(root);
  return { files, directories };
}

function expectedPackageDirectories(target) {
  const parts = target.split('/');
  const dirs = [];
  for (let index = 1; index < parts.length; index += 1) dirs.push(parts.slice(0, index).join('/'));
  return dirs;
}

function equalSorted(left, right) {
  return JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort());
}

function assertExactStagingTree(stagingRoot, snapshotId, target) {
  const tree = walkTree(stagingRoot);
  const expectedFiles = ['STAGING_RECEIPT.json', snapshotId + '/PACKAGE_MANIFEST.json', snapshotId + '/' + target];
  const expectedDirs = [snapshotId].concat(expectedPackageDirectories(target).map(item => snapshotId + '/' + item));
  if (!equalSorted(tree.files, expectedFiles) || !equalSorted(tree.directories, expectedDirs)) throw new Error('staging root contains unexpected or unledgered payload');
}

function assertExactPackageTree(packageRoot, target) {
  const tree = walkTree(packageRoot);
  const expectedFiles = ['PACKAGE_MANIFEST.json', target];
  const expectedDirs = expectedPackageDirectories(target);
  if (!equalSorted(tree.files, expectedFiles) || !equalSorted(tree.directories, expectedDirs)) throw new Error('placed package tree does not match the exact two-file ledger');
}

function maybeFault(code, point) { if (code === point) throw new Error('injected placement fault at ' + point); }

function removeOwnedDirectory(target, parent, label) {
  if (!fs.existsSync(target)) return;
  if (path.dirname(path.resolve(target)) !== path.resolve(parent)) throw new Error(label + ' cleanup target escaped its exact parent');
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(label + ' cleanup target is no longer an owned real directory');
  fs.rmSync(target, { recursive: true, force: true });
  if (fs.existsSync(target)) throw new Error(label + ' cleanup did not remove the exact owned directory');
}

async function verifyPackage(packageRoot, target, manifestBytes, candidateBytes, request) {
  assertExactPackageTree(packageRoot, target);
  const manifestFile = path.join(packageRoot, 'PACKAGE_MANIFEST.json');
  const candidateFile = safeResolveUnder(packageRoot, target);
  const observedManifest = fs.readFileSync(manifestFile);
  const observedCandidate = fs.readFileSync(candidateFile);
  if (!observedManifest.equals(manifestBytes)) throw new Error('receiver-visible manifest byte readback mismatch');
  if (!observedCandidate.equals(candidateBytes)) throw new Error('receiver-visible candidate byte readback mismatch');
  const manifestText = observedManifest.toString('utf8');
  const candidateText = observedCandidate.toString('utf8');
  if (await Inspector.sha256(manifestText) !== request.manifestSha256 || await Inspector.sha256(candidateText) !== request.candidateSha256) throw new Error('receiver-visible package digest mismatch');
}

function privateScratchName(snapshotId) {
  return '.' + snapshotId + '.placement-' + process.pid + '-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex');
}

async function execute(input) {
  input = input || {};
  const faultAt = input.faultAt || null;
  if (faultAt && !FAULTS.has(faultAt)) throw new Error('unsupported placement fault');
  const stagingRoot = validateStagingRoot(input.stagingRoot);
  const outputRoot = validateOutputRoot(input.packagerOutputRoot);
  assertSeparateRoots(stagingRoot, outputRoot);
  const stagingReceiptFile = path.join(stagingRoot, 'STAGING_RECEIPT.json');
  const placementReceiptFile = path.join(stagingRoot, 'PLACEMENT_RECEIPT.json');
  if (!fs.existsSync(stagingReceiptFile) || !fs.lstatSync(stagingReceiptFile).isFile() || fs.lstatSync(stagingReceiptFile).isSymbolicLink()) throw new Error('exact staging receipt file is required');
  if (fs.existsSync(placementReceiptFile)) throw new Error('placement receipt already exists; repeat placement is refused');
  const stagingReceipt = readUtf8Exact(stagingReceiptFile, 'staging receipt');
  const receipt = Core.parseStagingReceipt(stagingReceipt.text);
  const packageRoot = path.join(stagingRoot, receipt.snapshotId);
  if (!fs.existsSync(packageRoot) || !fs.lstatSync(packageRoot).isDirectory() || fs.lstatSync(packageRoot).isSymbolicLink() || pathKey(fs.realpathSync(packageRoot)) !== pathKey(packageRoot)) throw new Error('exact canonical staged package folder is required');
  const manifestFile = path.join(packageRoot, 'PACKAGE_MANIFEST.json');
  if (!fs.existsSync(manifestFile) || !fs.lstatSync(manifestFile).isFile() || fs.lstatSync(manifestFile).isSymbolicLink()) throw new Error('exact staged package manifest is required');
  const manifest = readUtf8Exact(manifestFile, 'package manifest');
  const manifestObject = JSON.parse(manifest.text);
  const target = Core.normalizeTarget(manifestObject && manifestObject.files && manifestObject.files[0] && manifestObject.files[0].path);
  assertExactStagingTree(stagingRoot, receipt.snapshotId, target);
  const candidateFile = safeResolveUnder(packageRoot, target);
  if (!fs.existsSync(candidateFile) || !fs.lstatSync(candidateFile).isFile() || fs.lstatSync(candidateFile).isSymbolicLink()) throw new Error('exact staged candidate file is required');
  const candidate = readUtf8Exact(candidateFile, 'candidate');
  const canonicalOutputBinding = fs.realpathSync(outputRoot);
  const request = await Core.prepare(stagingReceipt.text, manifest.text, candidate.text, canonicalOutputBinding, input.options || {});
  if (request.snapshotId !== receipt.snapshotId) throw new Error('prepared placement snapshot mismatch');
  const finalRoot = path.join(outputRoot, request.snapshotId);
  if (fs.existsSync(finalRoot)) throw new Error('final recovery snapshot already exists; overwrite is refused');
  const scratchPrefix = '.' + request.snapshotId + '.placement-';
  const orphan = fs.readdirSync(outputRoot).find(name => name.startsWith(scratchPrefix));
  if (orphan) throw new Error('orphan placement scratch requires human review: ' + orphan);
  const scratchRoot = path.join(outputRoot, privateScratchName(request.snapshotId));
  let scratchCreated = false;
  let finalCreated = false;
  let placementReceiptCreated = false;
  let placementReceiptText = null;
  try {
    fs.mkdirSync(scratchRoot);
    scratchCreated = true;
    maybeFault(faultAt, 'AFTER_SCRATCH');
    const scratchCandidate = safeResolveUnder(scratchRoot, target);
    fs.mkdirSync(path.dirname(scratchCandidate), { recursive: true });
    fs.copyFileSync(candidateFile, scratchCandidate);
    if (!fs.readFileSync(scratchCandidate).equals(candidate.bytes)) throw new Error('scratch candidate byte readback mismatch');
    maybeFault(faultAt, 'AFTER_CANDIDATE');
    fs.copyFileSync(manifestFile, path.join(scratchRoot, 'PACKAGE_MANIFEST.json'));
    await verifyPackage(scratchRoot, target, manifest.bytes, candidate.bytes, request);
    maybeFault(faultAt, 'AFTER_MANIFEST');
    fs.renameSync(scratchRoot, finalRoot);
    scratchCreated = false;
    finalCreated = true;
    await verifyPackage(finalRoot, target, manifest.bytes, candidate.bytes, request);
    maybeFault(faultAt, 'AFTER_RENAME');
    const placementId = await Inspector.sha256(Inspector.canonical({ requestId: request.requestId, snapshotId: request.snapshotId, outputRootSha256: request.outputRootSha256, manifestSha256: request.manifestSha256, candidateSha256: request.candidateSha256 }));
    const placementReceipt = {
      schema: Core.RECEIPT_SCHEMA,
      capability: Core.CAPABILITY,
      status: 'PLACED_FOR_RECOVERY_CENTER_DISCOVERY_WITH_LIMITS',
      placementId,
      requestId: request.requestId,
      stagingRequestId: request.stagingRequestId,
      snapshotId: request.snapshotId,
      packetId: request.packetId,
      planId: request.planId,
      conformanceRunId: request.conformanceRunId,
      stagingReceiptSha256: request.stagingReceiptSha256,
      manifestSha256: request.manifestSha256,
      sourceSha256: request.sourceSha256,
      candidateSha256: request.candidateSha256,
      targetPathSha256: request.targetPathSha256,
      outputRootSha256: request.outputRootSha256,
      candidateBytes: request.candidateBytes,
      candidateEvents: request.candidateEvents,
      observations: {
        stagingSourceVerified: true,
        exactTwoFilePackageObserved: true,
        outputRootCanonicalAndShapeMatched: true,
        privateScratchVerified: true,
        atomicRenameCompleted: true,
        receiverVisibleManifestReadbackObserved: true,
        receiverVisibleCandidateReadbackObserved: true,
        receiverFolderLayoutCompatible: true,
        stagingSourceRetained: true
      },
      privacy: {
        outputRootPathIncluded: false,
        stagingRootPathIncluded: false,
        targetRelativePathIncluded: false,
        sourcePayloadIncluded: false,
        candidatePayloadIncluded: false,
        identityIncluded: false,
        secretIncluded: false
      },
      truth: {
        actualFilesystemWrite: true,
        packagerOutputWritten: true,
        snapshotPlacedForDiscovery: true,
        sourceStagingDeleted: false,
        RecoveryCenterCalled: false,
        recoveryCenterListObserved: false,
        restorePreviewCreated: false,
        restoreTestRun: false,
        permissionChecked: false,
        permissionGranted: false,
        liveTargetRead: false,
        liveTargetWritten: false,
        candidateApplied: false,
        rollbackPerformed: false,
        liveApplyCapabilityClosed: false,
        installed: false,
        promoted: false,
        canon: false
      },
      limits: {
        missingLiveApplyCapability: Core.LIVE_CAPABILITY,
        receiverRuntimeObservation: 'NOT_RUN',
        restoreTestStatus: 'NOT_RUN'
      }
    };
    placementReceiptText = JSON.stringify(placementReceipt, null, 2) + '\n';
    fs.writeFileSync(placementReceiptFile, placementReceiptText, { encoding: 'utf8', flag: 'wx' });
    placementReceiptCreated = true;
    if (fs.readFileSync(placementReceiptFile, 'utf8') !== placementReceiptText) throw new Error('placement receipt readback mismatch');
    maybeFault(faultAt, 'AFTER_RECEIPT');
    return placementReceipt;
  } catch (error) {
    const cleanupErrors = [];
    if (placementReceiptCreated) {
      try {
        if (fs.readFileSync(placementReceiptFile, 'utf8') !== placementReceiptText) throw new Error('owned receipt changed before cleanup');
        fs.unlinkSync(placementReceiptFile);
      } catch (cleanupError) { cleanupErrors.push('placement receipt cleanup failed: ' + cleanupError.message); }
    }
    if (finalCreated) {
      try { removeOwnedDirectory(finalRoot, outputRoot, 'final placement'); }
      catch (cleanupError) { cleanupErrors.push(cleanupError.message); }
    }
    if (scratchCreated) {
      try { removeOwnedDirectory(scratchRoot, outputRoot, 'placement scratch'); }
      catch (cleanupError) { cleanupErrors.push(cleanupError.message); }
    }
    if (cleanupErrors.length) throw new Error(error.message + '; ' + cleanupErrors.join('; '));
    throw error;
  }
}

module.exports = {
  execute,
  validateStagingRoot,
  validateOutputRoot,
  assertExactStagingTree,
  assertExactPackageTree,
  FAULTS
};
