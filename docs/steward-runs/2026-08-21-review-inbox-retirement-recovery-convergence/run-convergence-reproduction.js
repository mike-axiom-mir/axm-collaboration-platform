#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = '8f41d9e039179245d9e7923202d7c82b82158932';
const BASELINE_TREE = 'ace8a0eef1b472ef400c4ef27047c985dfcdfbe3';
const PRODUCT_COMMIT = 'ff0b8e3a2040de6f25082e83af83c13b6cff9237';
const PRODUCT_TREE = '9a9beb9f5f6cc13d6ad73f1ea55cc3d683e65c9c';

function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function capture(action) { try { return { result:action(), error:null }; } catch (error) { return { result:null, error:{ code:error.code || 'UNTYPED' } }; } }
function fixture(Lease, stateRoot, interruption) {
  const lease = Lease.create({ stateRoot, recoveryCheckpointObserveMs:1000 });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 100000, acquiredAt:new Date().toISOString() };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  const plan = lease.retirementPlan();
  const input = { schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason:'Operator confirms the exact isolated concurrency fixture holder has terminated.' };
  const originalRename = fs.renameSync, originalOpen = fs.openSync;
  try {
    if (interruption === 'resume') fs.renameSync = (from, to) => {
      if (path.resolve(from) === path.resolve(lease.leaseFile)) { const error = new Error('interruption'); error.code = 'SIMULATED_INTERRUPTION'; throw error; }
      return originalRename(from, to);
    };
    else fs.openSync = (file, flags, mode) => {
      if (String(file).endsWith('.result.json') && flags === 'wx') { const error = new Error('interruption'); error.code = 'SIMULATED_INTERRUPTION'; throw error; }
      return originalOpen(file, flags, mode);
    };
    lease.retireWithOperatorAssertion(input);
  } catch (error) {
    if (error.code !== 'SIMULATED_INTERRUPTION') throw error;
  } finally { fs.renameSync = originalRename; fs.openSync = originalOpen; }
  const record = lease.retirementRecoveryStatus().records[0];
  return { lease, input:{ schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA, retirementId:record.retirementId, action:record.actionRequired, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_ASSERTION, confirmation:record.confirmationRequired, reason:'Operator confirms the exact isolated concurrent recovery action.' } };
}
function race(Lease, stateRoot, mode) {
  const value = fixture(Lease, stateRoot, mode), originalRename = fs.renameSync, originalOpen = fs.openSync;
  let inner = null, entered = false;
  try {
    if (mode === 'resume') fs.renameSync = (from, to) => {
      if (!entered && path.resolve(from) === path.resolve(value.lease.leaseFile)) { entered = true; inner = capture(() => value.lease.recoverRetirement(value.input)); }
      return originalRename(from, to);
    };
    else fs.openSync = (file, flags, permissions) => {
      if (!entered && String(file).endsWith('.result.json') && flags === 'wx') { entered = true; inner = capture(() => value.lease.recoverRetirement(value.input)); }
      return originalOpen(file, flags, permissions);
    };
    const outer = capture(() => value.lease.recoverRetirement(value.input));
    return {
      entered,
      inner:{ errorCode:inner && inner.error && inner.error.code || null, state:inner && inner.result && inner.result.state || null },
      outer:{ errorCode:outer.error && outer.error.code || null, state:outer.result && outer.result.state || null },
      finalStatus:value.lease.retirementRecoveryStatus().state,
      evidenceFiles:fs.readdirSync(value.lease.retirementsDirectory).length
    };
  } finally { fs.renameSync = originalRename; fs.openSync = originalOpen; }
}
function load(commit, expectedTree, target) {
  const tree = String(git(['rev-parse', commit + '^{tree}'])).trim();
  if (tree !== expectedTree) throw new Error('tree identity mismatch');
  const bytes = git(['show', commit + ':shared/operations/review-operation-lease.js'], null);
  const file = path.join(target, commit.slice(0, 8) + '-review-operation-lease.js');
  fs.writeFileSync(file, bytes);
  return { Lease:require(file), sha256:sha256(bytes) };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v48-convergence-reproduction-'));
try {
  const baseline = load(BASELINE_COMMIT, BASELINE_TREE, temp), product = load(PRODUCT_COMMIT, PRODUCT_TREE, temp);
  const receipt = {
    schema:'axm.review-operation-lease-retirement-recovery-convergence-reproduction/v1', status:'REPRODUCED',
    baseline:{ commit:BASELINE_COMMIT, tree:BASELINE_TREE, leaseSha256:baseline.sha256, resume:race(baseline.Lease, path.join(temp, 'baseline-resume'), 'resume'), finalize:race(baseline.Lease, path.join(temp, 'baseline-finalize'), 'finalize') },
    product:{ commit:PRODUCT_COMMIT, tree:PRODUCT_TREE, leaseSha256:product.sha256, resume:race(product.Lease, path.join(temp, 'product-resume'), 'resume'), finalize:race(product.Lease, path.join(temp, 'product-finalize'), 'finalize') },
    boundary:{ cooperatingSingleHostExactCheckpointOnly:true, realProcessEvidenceSeparate:true, generalSerializationProven:false, cancellationSafetyProven:false, crossFileAtomicityProven:false, holderTerminationProven:false, specialistPackagesInspected:false }
  };
  const baselineCodes = [receipt.baseline.resume.outer.errorCode, receipt.baseline.finalize.outer.errorCode];
  const productOutcomes = [receipt.product.resume, receipt.product.finalize];
  if (JSON.stringify(baselineCodes) !== JSON.stringify(['ENOENT','EEXIST']) ||
    !productOutcomes.every(item => !item.inner.errorCode && !item.outer.errorCode &&
      JSON.stringify([item.inner.state, item.outer.state].sort()) === JSON.stringify(['ALREADY_COMPLETE','RECOVERED']) &&
      item.finalStatus === 'CURRENT' && item.evidenceFiles === 3)) receipt.status = 'NOT_REPRODUCED';
  fs.writeFileSync(path.join(__dirname, 'CONVERGENCE_REPRODUCTION.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(receipt.status + ' exact-parent resume/finalize recovery races');
  if (receipt.status !== 'REPRODUCED') process.exitCode = 1;
} finally { fs.rmSync(temp, { recursive:true, force:true }); }
