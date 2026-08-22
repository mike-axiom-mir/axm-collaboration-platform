#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'db9b6c979d8bcf15cf302e502233dbb5b5f0ea61';
const BASELINE_TREE = 'd7704d0b4f8388f0ab738aaaf5c83cf4d39a01e1';

function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, {
    cwd:ROOT,
    encoding:encoding === null ? null : 'utf8',
    windowsHide:true,
    maxBuffer:16 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function ownerFixture(Lease, stateRoot) {
  const lease = Lease.create({ stateRoot });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = {
    schema:Lease.OWNER_SCHEMA,
    leaseId:crypto.randomUUID(),
    processId:process.pid + 100000,
    acquiredAt:new Date().toISOString()
  };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  const plan = lease.retirementPlan();
  const input = {
    schema:Lease.RETIREMENT_REQUEST_SCHEMA,
    assertion:Lease.RETIREMENT_ASSERTION,
    confirmation:plan.exactConfirmation,
    ownerDigest:plan.ownerDigest,
    reason:'Operator asserts the isolated baseline interruption fixture holder has terminated.'
  };
  return { lease, plan, input };
}
function evidenceCounts(directory) {
  const names = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
  return {
    intentFiles:names.filter(name => name.endsWith('.intent.json')).length,
    ownerEvidenceFiles:names.filter(name => name.endsWith('.owner-evidence')).length,
    resultFiles:names.filter(name => name.endsWith('.result.json')).length
  };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v44-retirement-interruption-'));
try {
  const observedTree = String(git(['rev-parse', BASELINE_COMMIT + '^{tree}'])).trim();
  if (observedTree !== BASELINE_TREE) throw new Error('baseline tree mismatch');
  const leaseBytes = git(['show', BASELINE_COMMIT + ':shared/operations/review-operation-lease.js'], null);
  const moduleFile = path.join(temp, 'review-operation-lease.js');
  fs.writeFileSync(moduleFile, leaseBytes);
  const BaselineLease = require(moduleFile);

  const intentFixture = ownerFixture(BaselineLease, path.join(temp, 'intent-only'));
  const originalRename = fs.renameSync;
  let intentError = null;
  try {
    fs.renameSync = (from, to) => {
      if (path.resolve(from) === path.resolve(intentFixture.lease.leaseFile)) {
        const error = new Error('simulated interruption after intent');
        error.code = 'SIMULATED_INTERRUPTION_AFTER_INTENT';
        throw error;
      }
      return originalRename(from, to);
    };
    intentFixture.lease.retireWithOperatorAssertion(intentFixture.input);
  } catch (error) { intentError = error; }
  finally { fs.renameSync = originalRename; }

  const evidenceFixture = ownerFixture(BaselineLease, path.join(temp, 'evidence-only'));
  const originalOpen = fs.openSync;
  let evidenceError = null;
  try {
    fs.openSync = (file, flags, mode) => {
      if (String(file).endsWith('.result.json') && flags === 'wx') {
        const error = new Error('simulated interruption after evidence quarantine');
        error.code = 'SIMULATED_INTERRUPTION_AFTER_EVIDENCE';
        throw error;
      }
      return originalOpen(file, flags, mode);
    };
    evidenceFixture.lease.retireWithOperatorAssertion(evidenceFixture.input);
  } catch (error) { evidenceError = error; }
  finally { fs.openSync = originalOpen; }

  const receipt = {
    schema:'axm.review-operation-lease-retirement-recovery-baseline-reproduction/v1',
    status:'REPRODUCED',
    baselineCommit:BASELINE_COMMIT,
    baselineTree:BASELINE_TREE,
    source:{
      leaseSha256:sha256(leaseBytes),
      exactGitBlobExecuted:true,
      temporaryModuleCopyOnly:true
    },
    intentOnlyInterruption:{
      errorCode:intentError && intentError.code || null,
      lockPathStillPresent:fs.existsSync(intentFixture.lease.leaseFile),
      lockDigestStillMatches:fs.existsSync(intentFixture.lease.leaseFile) && sha256(fs.readFileSync(intentFixture.lease.leaseFile)) === intentFixture.plan.ownerDigest,
      evidenceCounts:evidenceCounts(intentFixture.lease.retirementsDirectory),
      retirementPlanState:intentFixture.lease.retirementPlan().state
    },
    quarantinedEvidenceInterruption:{
      errorCode:evidenceError && evidenceError.code || null,
      lockPathStillPresent:fs.existsSync(evidenceFixture.lease.leaseFile),
      evidenceCounts:evidenceCounts(evidenceFixture.lease.retirementsDirectory),
      retirementPlanState:evidenceFixture.lease.retirementPlan().state
    },
    missingBaselineCapability:{
      retirementRecoveryStatusExported:typeof intentFixture.lease.retirementRecoveryStatus === 'function',
      recoverRetirementExported:typeof intentFixture.lease.recoverRetirement === 'function',
      recoveryStatusSchemaExported:typeof BaselineLease.RETIREMENT_RECOVERY_STATUS_SCHEMA === 'string'
    },
    boundary:{
      productionInterruptionFrequencyProven:false,
      holderTerminationProven:false,
      recoverySafetyProven:false,
      crossFileAtomicityProven:false,
      providerActionPerformed:false,
      specialistPackagesInspected:false
    }
  };
  if (receipt.intentOnlyInterruption.errorCode !== 'SIMULATED_INTERRUPTION_AFTER_INTENT' ||
    !receipt.intentOnlyInterruption.lockPathStillPresent || receipt.intentOnlyInterruption.evidenceCounts.intentFiles !== 1 ||
    receipt.quarantinedEvidenceInterruption.errorCode !== 'SIMULATED_INTERRUPTION_AFTER_EVIDENCE' ||
    receipt.quarantinedEvidenceInterruption.lockPathStillPresent || receipt.quarantinedEvidenceInterruption.evidenceCounts.ownerEvidenceFiles !== 1 ||
    Object.values(receipt.missingBaselineCapability).some(Boolean)) {
    receipt.status = 'NOT_REPRODUCED';
  }
  fs.writeFileSync(path.join(__dirname, 'BASELINE_INTERRUPTION_REPRODUCTION.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(receipt.status + ' exact v4.4 interrupted retirement windows');
  if (receipt.status !== 'REPRODUCED') process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
