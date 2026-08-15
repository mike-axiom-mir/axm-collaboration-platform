'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Cell = require('../kernel/workshop-module-delivery-cell');
const ZipCell = require('../kernel/workshop-zip-module-bundle-cell');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/workshop-module-delivery-adapter-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_ROOT = path.join(ROOT, 'state', 'workshop-module-delivery-receipts');
const DEFAULT_SOURCE_ZIP_ROOT = path.join(ROOT, 'state', 'workshop-module-source-zips');
const DEFAULT_WORKSHOP_ROOT = process.env.AXM_WORKSHOP_ROOT ? path.resolve(process.env.AXM_WORKSHOP_ROOT) : path.resolve('C:\\axm workshop');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8788';
const MAX_RECEIPTS = 128;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function inside(parent, child) {
  const root = path.resolve(parent);
  const target = path.resolve(child);
  return target === root || target.startsWith(root + path.sep);
}
function json(value) { return JSON.stringify(Cell.stable(value), null, 2) + '\n'; }
function safeEndpoint(value) {
  const url = new URL(String(value || DEFAULT_ENDPOINT));
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Workshop delivery endpoint must be a plain loopback HTTP origin');
  return url.origin;
}
async function api(pathname, request = {}, options = {}) {
  if (typeof options.transport === 'function') return options.transport(pathname, request);
  const endpoint = safeEndpoint(options.endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs || 30000);
  try {
    const response = await fetch(endpoint + pathname, {
      method: request.method || 'GET',
      headers: Object.assign({ accept: 'application/json' }, request.body === undefined ? {} : { 'content-type': 'application/json' }, request.headers || {}),
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal
    });
    let envelope;
    try { envelope = await response.json(); } catch (_) { throw new Error(`Workshop returned non-JSON HTTP ${response.status}`); }
    if (!response.ok || !envelope || envelope.ok !== true) throw new Error(String(envelope && envelope.error || `Workshop HTTP ${response.status}`).slice(0, 2000));
    return envelope.result;
  } finally { clearTimeout(timeout); }
}
function permissionAllowed(status) {
  const rows = status && Array.isArray(status.grants) ? status.grants.filter(item => item.moduleId === 'module-installer' && item.permission === 'module.install') : [];
  if (!rows.length) return false;
  const latest = rows[rows.length - 1];
  return latest.allowed === true && (!latest.expiresAt || Date.parse(latest.expiresAt) > Date.now());
}
async function status(options = {}) {
  let installer;
  let review;
  let permissions;
  let error = null;
  try {
    [installer, review, permissions] = await Promise.all([
      api('/api/installer', {}, options),
      api('/api/reviews', {}, options),
      api('/api/permissions', {}, options)
    ]);
  } catch (caught) { error = caught; }
  const receipts = listReceipts(options.stateRoot || DEFAULT_STATE_ROOT);
  if (error) {
    const unavailable = {
      organ: { id: ORGAN_ID, status: 'HOLD_WORKSHOP_INSTALLER_UNAVAILABLE', learnedWeights: false },
      workshopOnline: false,
      endpoint: safeEndpoint(options.endpoint),
      error: String(error.message || error).slice(0, 500),
      candidates: [],
      temporaryInstallPermissionActive: false,
      latestReceipt: receipts[0] || null,
      statusDigest: null,
      boundary: 'The Workshop native installer could not be read. No staging, approval, permission, install, rollback, quarantine, or Workshop write occurred.'
    };
    unavailable.statusDigest = Cell.digest(Object.assign({}, unavailable, { statusDigest: null }));
    return unavailable;
  }
  const reviews = new Map(((review && review.items) || []).map(item => [item.id, item]));
  const candidates = ((installer && installer.candidates) || []).slice(0, 30).map(candidate => {
    const reviewItem = reviews.get(candidate.reviewId) || null;
    return {
      id: candidate.id,
      moduleId: candidate.moduleId,
      name: candidate.name,
      version: candidate.version,
      mode: candidate.mode,
      state: candidate.state,
      digest: candidate.digest,
      fileCount: candidate.fileCount,
      totalBytes: candidate.totalBytes,
      warnings: Array.isArray(candidate.warnings) ? candidate.warnings.slice(0, 20) : [],
      reviewId: candidate.reviewId,
      reviewState: reviewItem ? reviewItem.state : 'REVIEW_NOT_FOUND',
      requiredSeats: reviewItem ? reviewItem.requiredSeats : null,
      appliedAt: candidate.appliedAt || null,
      backupId: candidate.backupId || null,
      canApproveAndInstall: !candidate.appliedAt && !!reviewItem && ['PENDING', 'HOLD', 'APPROVED'].includes(reviewItem.state)
    };
  });
  const result = {
    organ: { id: ORGAN_ID, status: 'TEST_WORKSHOP_NATIVE_INSTALLER_COMPOSITION', learnedWeights: false },
    workshopOnline: true,
    endpoint: safeEndpoint(options.endpoint),
    error: null,
    candidates,
    temporaryInstallPermissionActive: permissionAllowed(permissions),
    latestReceipt: receipts[0] || null,
    statusDigest: null,
    boundary: 'Bundles enter the Workshop native module installer as staged review candidates. Only an explicit exact-digest button may cast Mike’s review vote, grant short-lived module.install permission, and invoke the atomic installer. Updates use Workshop-native backups. A post-install verifier failure rolls back an update or moves a new module to recoverable intake quarantine, then leaves a repair flag.'
  };
  result.statusDigest = Cell.digest(Object.assign({}, result, { statusDigest: null }));
  return result;
}
function receiptDirectoryName(receipt) { return receipt.receiptId; }
function verifyReceiptDirectory(runDir) {
  const receipt = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
  Cell.verifyReceipt(receipt);
  const name = path.basename(runDir);
  const stage = name.startsWith(`.stage-${receipt.receiptId}-`);
  if (name !== receipt.receiptId && !stage) throw new Error('Workshop delivery receipt directory identity changed');
  return receipt;
}
function storeReceipt(receipt, stateRoot = DEFAULT_STATE_ROOT) {
  Cell.verifyReceipt(receipt);
  const root = path.resolve(stateRoot);
  fs.mkdirSync(root, { recursive: true });
  const runDir = path.join(root, receiptDirectoryName(receipt));
  if (!inside(root, runDir)) throw new Error('Workshop delivery receipt escaped its private state root');
  if (fs.existsSync(runDir)) return { receipt: verifyReceiptDirectory(runDir), runDir, reused: true };
  const stageDir = path.join(root, `.stage-${receipt.receiptId}-${process.pid}`);
  if (!inside(root, stageDir) || fs.existsSync(stageDir)) throw new Error('Workshop delivery receipt staging boundary refused');
  fs.mkdirSync(stageDir, { recursive: false });
  fs.writeFileSync(path.join(stageDir, 'receipt.json'), json(receipt), { flag: 'wx' });
  verifyReceiptDirectory(stageDir);
  const committed = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { receipt: verifyReceiptDirectory(runDir), runDir, reused: committed.reused };
}
function listReceipts(stateRoot = DEFAULT_STATE_ROOT) {
  const root = path.resolve(stateRoot);
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.stage-'));
  if (entries.length > MAX_RECEIPTS) throw new Error(`Workshop delivery receipts exceed ${MAX_RECEIPTS}; curate session evidence before continuing`);
  return entries.map(entry => {
    const runDir = path.join(root, entry.name);
    return { receipt: verifyReceiptDirectory(runDir), modifiedMs: fs.statSync(runDir).mtimeMs };
  }).sort((a, b) => b.modifiedMs - a.modifiedMs || b.receipt.receiptId.localeCompare(a.receipt.receiptId)).map(item => item.receipt);
}
function sourceZipDirectoryName(source) { return `workshop-module-source-zip-${source.zipSha256.slice(0, 24)}`; }
function verifySourceZipDirectory(runDir) {
  const record = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
  const zipBytes = fs.readFileSync(path.join(runDir, 'source.zip'));
  ZipCell.verifySource(record, zipBytes);
  const name = path.basename(runDir);
  const stage = name.startsWith(`.stage-${sourceZipDirectoryName(record)}-`);
  if (name !== sourceZipDirectoryName(record) && !stage) throw new Error('Workshop source ZIP directory identity changed');
  return record;
}
function storeSourceZip(zipBytes, source, sourceZipRoot = DEFAULT_SOURCE_ZIP_ROOT) {
  ZipCell.verifySource(source, zipBytes);
  const root = path.resolve(sourceZipRoot);
  fs.mkdirSync(root, { recursive: true });
  const runDir = path.join(root, sourceZipDirectoryName(source));
  if (!inside(root, runDir)) throw new Error('Workshop source ZIP escaped its private state root');
  if (fs.existsSync(runDir)) return { source: verifySourceZipDirectory(runDir), runDir, reused: true };
  const stageDir = path.join(root, `.stage-${sourceZipDirectoryName(source)}-${process.pid}`);
  if (!inside(root, stageDir) || fs.existsSync(stageDir)) throw new Error('Workshop source ZIP staging boundary refused');
  fs.mkdirSync(stageDir, { recursive: false });
  fs.writeFileSync(path.join(stageDir, 'source.zip'), zipBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), json(source), { flag: 'wx' });
  verifySourceZipDirectory(stageDir);
  const committed = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { source: verifySourceZipDirectory(runDir), runDir, reused: committed.reused };
}
function candidateBinding(candidate) {
  if (!candidate || !/^candidate-[A-Za-z0-9-]+$/.test(String(candidate.id || '')) || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(candidate.moduleId || '')) || !/^[a-f0-9]{64}$/.test(String(candidate.digest || '')) || !/^review-[A-Za-z0-9-]+$/.test(String(candidate.reviewId || ''))) throw new Error('Workshop installer returned an invalid candidate binding');
  return {
    id: candidate.id,
    moduleId: candidate.moduleId,
    name: String(candidate.name || candidate.moduleId).slice(0, 180),
    version: String(candidate.version || '').slice(0, 80),
    mode: candidate.mode,
    state: candidate.state,
    digest: candidate.digest,
    fileCount: candidate.fileCount,
    totalBytes: candidate.totalBytes,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.slice(0, 20) : [],
    reviewId: candidate.reviewId,
    reviewState: candidate.reviewState || 'PENDING',
    backupId: candidate.backupId || null
  };
}
async function stagePrepared(rawBytes, input = {}, options = {}, sourceArtifact = null) {
  const parsed = Cell.parseBundle(rawBytes);
  const candidate = await api('/api/installer/stage', {
    method: 'POST',
    headers: { 'x-axm-installer': 'explicit-stage' },
    body: { bundle: parsed.bundle, actor: input.actorId || 'mike-local-steward' },
    timeoutMs: 60000
  }, options);
  if (candidate.moduleId !== parsed.summary.moduleId) throw new Error('Workshop staged a different module id than the supplied bundle');
  const receipt = Cell.buildReceipt({
    action: 'STAGE_WORKSHOP_MODULE_BUNDLE',
    actorId: input.actorId,
    candidate: candidateBinding(Object.assign({}, candidate, { reviewState: 'PENDING' })),
    verification: { bundlePreflight: 'PASS', workshopNativeStage: 'PASS', sourceExecution: false, sourceArtifact: sourceArtifact ? clone(sourceArtifact) : { schema: 'axm.mirror.workshop-module-source-json/v1', preservedCopy: false }, bundleSummary: parsed.summary },
    result: { state: 'STAGED_AWAITING_EXACT_DIGEST_REVIEW', activeWorkshopFilesChanged: 0, backupsCreated: 0, rollbacks: 0, quarantines: 0 }
  });
  const stored = storeReceipt(receipt, options.stateRoot || DEFAULT_STATE_ROOT);
  return { receipt: stored.receipt, candidate, bundleSummary: parsed.summary, reused: stored.reused };
}
async function stage(rawBytes, input = {}, options = {}) {
  return stagePrepared(rawBytes, input, options, null);
}
async function stageZip(rawBytes, input = {}, options = {}) {
  const zipBytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes || '');
  const parsed = ZipCell.parseZip(zipBytes);
  const storedSource = storeSourceZip(zipBytes, parsed.source, options.sourceZipRoot || DEFAULT_SOURCE_ZIP_ROOT);
  const result = await stagePrepared(parsed.bundleBytes, input, options, Object.assign({}, storedSource.source, {
    preservedCopy: true,
    privateStateDirectory: path.basename(storedSource.runDir)
  }));
  return Object.assign(result, { inputKind: 'ZIP', sourceZip: storedSource.source, sourceZipReused: storedSource.reused });
}
async function stageUpload(rawBytes, input = {}, options = {}) {
  const bytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes || '');
  const sourceName = String(input.sourceName || '').replace(/\\/g, '/').split('/').pop().slice(0, 240);
  const looksLikeZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (/\.zip$/i.test(sourceName) && !looksLikeZip) throw new Error('The selected .zip file does not contain ZIP bytes');
  if (looksLikeZip) return stageZip(bytes, input, options);
  const result = await stage(bytes, input, options);
  return Object.assign(result, { inputKind: 'JSON', sourceZip: null, sourceZipReused: false });
}
function runVerifier(options = {}) {
  if (typeof options.verifier === 'function') return Promise.resolve(options.verifier());
  const workshopRoot = path.resolve(options.workshopRoot || DEFAULT_WORKSHOP_ROOT);
  const verifier = path.join(workshopRoot, 'verify.js');
  if (!inside(workshopRoot, verifier) || !fs.existsSync(verifier)) return Promise.resolve({ state: 'WORKSHOP_VERIFIER_UNAVAILABLE', passed: false, exitCode: null, outputTail: 'verify.js is absent', outputSha256: null });
  const executed = childProcess.spawnSync(process.execPath, [verifier], { cwd: workshopRoot, encoding: 'utf8', timeout: 600000, windowsHide: true, maxBuffer: 12 * 1024 * 1024 });
  const output = `${executed.stdout || ''}\n${executed.stderr || ''}`.trim();
  return Promise.resolve({
    state: executed.status === 0 && !executed.error ? 'WORKSHOP_NATIVE_VERIFIER_PASS' : 'WORKSHOP_NATIVE_VERIFIER_FAIL',
    passed: executed.status === 0 && !executed.error,
    exitCode: executed.status,
    outputTail: output.slice(-6000),
    outputSha256: Cell.digest(output),
    timedOut: !!(executed.error && executed.error.code === 'ETIMEDOUT')
  });
}
function quarantineNewInstall(candidate, options = {}) {
  if (candidate.mode !== 'install') throw new Error('Only a failed new install may enter new-module quarantine');
  const workshopRoot = path.resolve(options.workshopRoot || DEFAULT_WORKSHOP_ROOT);
  const toolsRoot = path.join(workshopRoot, 'tools');
  const source = path.join(toolsRoot, candidate.moduleId);
  const quarantineRoot = path.join(workshopRoot, 'intakes', 'mirror-failed-module-deliveries');
  const destination = path.join(quarantineRoot, `${candidate.id}-${candidate.moduleId}`);
  if (!inside(toolsRoot, source) || path.basename(source) !== candidate.moduleId || !inside(workshopRoot, quarantineRoot) || !inside(quarantineRoot, destination)) throw new Error('New-module quarantine path boundary refused');
  if (!fs.existsSync(source)) throw new Error('Failed new module is absent from its exact Workshop tool path');
  if (fs.existsSync(destination)) throw new Error('Failed new-module quarantine destination already exists');
  fs.mkdirSync(quarantineRoot, { recursive: true });
  fs.renameSync(source, destination);
  return { state: 'NEW_MODULE_MOVED_TO_RECOVERABLE_INTAKE_QUARANTINE', source: `tools/${candidate.moduleId}`, destination: `intakes/mirror-failed-module-deliveries/${path.basename(destination)}` };
}
async function permissionDecision(allowed, actorId, reason, options) {
  return api('/api/permissions/decision', {
    method: 'POST',
    headers: { 'x-axm-permission': 'explicit-decision' },
    body: {
      moduleId: 'module-installer', permission: 'module.install', allowed,
      reason: String(reason).slice(0, 500), actor: actorId,
      expiresAt: allowed ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null,
      confirmation: 'SET MODULE PERMISSION'
    }
  }, options);
}
async function approveInstall(input = {}, options = {}) {
  const actorId = String(input.actorId || 'mike-local-steward').slice(0, 80);
  const before = await status(options);
  if (!before.workshopOnline || input.expectedStatusDigest !== before.statusDigest) throw new Error('Workshop delivery state changed; reload before installing');
  const candidate = before.candidates.find(item => item.id === input.candidateId);
  if (!candidate || candidate.digest !== input.candidateDigest || candidate.reviewId !== input.reviewId || !candidate.canApproveAndInstall) throw new Error('Workshop candidate exact binding changed or is not installable');
  const bound = candidateBinding(candidate);
  const baseline = await runVerifier(options);
  if (!baseline.passed) {
    const receipt = Cell.buildReceipt({
      action: 'APPROVE_INSTALL_AND_VERIFY', actorId, candidate: bound,
      verification: { baseline, postInstall: null, recovery: null },
      result: { state: 'HOLD_BASELINE_WORKSHOP_VERIFIER_FAILED', activeWorkshopFilesChanged: 0, backupsCreated: 0, rollbacks: 0, quarantines: 0 },
      repairFlag: { state: 'REPAIR_REQUIRED_BEFORE_INSTALL', detail: baseline.outputTail || baseline.state }
    });
    return { receipt: storeReceipt(receipt, options.stateRoot || DEFAULT_STATE_ROOT).receipt };
  }
  let permissionGranted = false;
  let applied = null;
  let postInstall = null;
  let recovery = null;
  let operationError = null;
  try {
    if (candidate.reviewState !== 'APPROVED') await api('/api/reviews/vote', {
      method: 'POST', headers: { 'x-axm-review': 'exact-digest-vote' },
      body: { id: candidate.reviewId, actor: actorId, actorKind: 'human-declared-local', verdict: 'APPROVE', note: 'Explicit same-page exact-digest Workshop module delivery approval.', artifactDigest: candidate.digest, confirmation: 'REVIEW EXACT DIGEST' }
    }, options);
    await permissionDecision(true, actorId, `Temporary exact-candidate install permission for ${candidate.id}`, options);
    permissionGranted = true;
    applied = await api('/api/installer/apply', {
      method: 'POST', headers: { 'x-axm-installer': 'apply-approved-digest' },
      body: { candidateId: candidate.id, actor: actorId, confirmation: 'INSTALL REVIEWED MODULE' }, timeoutMs: 120000
    }, options);
    postInstall = await runVerifier(options);
    if (!postInstall.passed) {
      if (applied.backupId) recovery = await api('/api/installer/rollback', {
        method: 'POST', headers: { 'x-axm-installer': 'explicit-rollback' },
        body: { moduleId: candidate.moduleId, backupId: applied.backupId, actor: actorId, confirmation: 'ROLL BACK MODULE' }, timeoutMs: 120000
      }, options);
      else recovery = quarantineNewInstall(candidate, options);
      recovery.verifier = await runVerifier(options);
    }
  } catch (error) { operationError = error; }
  finally {
    if (permissionGranted) {
      try { await permissionDecision(false, actorId, `Temporary install permission closed after ${candidate.id}`, options); }
      catch (error) { operationError = operationError || new Error(`install completed but temporary permission revoke failed: ${error.message}`); }
    }
  }
  const passed = !operationError && postInstall && postInstall.passed;
  const recovered = !!(postInstall && !postInstall.passed && recovery && recovery.verifier && recovery.verifier.passed);
  const resultState = passed ? 'INSTALLED_WORKSHOP_VERIFIER_PASS_PERMISSION_REVOKED' : recovered ? 'INSTALL_FAILED_RECOVERED_REPAIR_FLAGGED' : 'HOLD_INSTALL_OR_RECOVERY_INCOMPLETE';
  const receipt = Cell.buildReceipt({
    action: 'APPROVE_INSTALL_AND_VERIFY', actorId,
    candidate: Object.assign({}, bound, { backupId: applied && applied.backupId || null }),
    verification: { baseline, postInstall, recovery, operationError: operationError ? String(operationError.message || operationError).slice(0, 2000) : null },
    result: {
      state: resultState,
      activeWorkshopFilesChanged: passed ? candidate.fileCount : recovery || !applied ? 0 : null,
      backupsCreated: applied && applied.backupId ? 1 : 0,
      rollbacks: recovery && applied && applied.backupId ? 1 : 0,
      quarantines: recovery && !applied?.backupId ? 1 : 0
    },
    repairFlag: passed ? null : { state: 'REPAIR_REQUIRED', detail: String(operationError && operationError.message || postInstall && postInstall.outputTail || 'Workshop delivery did not reach verified success').slice(0, 6000) }
  });
  return { receipt: storeReceipt(receipt, options.stateRoot || DEFAULT_STATE_ROOT).receipt, applied, recovery };
}

module.exports = { ORGAN_ID, DEFAULT_STATE_ROOT, DEFAULT_SOURCE_ZIP_ROOT, DEFAULT_WORKSHOP_ROOT, DEFAULT_ENDPOINT, MAX_RECEIPTS, inside, safeEndpoint, api, permissionAllowed, status, verifyReceiptDirectory, storeReceipt, listReceipts, sourceZipDirectoryName, verifySourceZipDirectory, storeSourceZip, candidateBinding, stage, stageZip, stageUpload, runVerifier, quarantineNewInstall, permissionDecision, approveInstall };
