#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const SOURCE_COMMIT = 'c64dd671c0c4bed1f798a546de879b48c8ac93cc';
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function gitShow(spec) {
  const result = childProcess.spawnSync('git',['show',spec],{ cwd:ROOT, encoding:null, windowsHide:true, maxBuffer:16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('unable to load exact baseline source');
  return result.stdout;
}

const container = fs.mkdtempSync(path.join(os.tmpdir(),'axm-v50-stage-accumulation-'));
let retained = true, receipt;
try {
  const moduleFile = path.join(container,'review-operation-lease.js');
  fs.writeFileSync(moduleFile,gitShow(SOURCE_COMMIT + ':shared/operations/review-operation-lease.js'));
  const Lease = require(moduleFile), stateRoot = path.join(container,'state'), lease = Lease.create({ stateRoot });
  fs.mkdirSync(lease.retirementPublicationDirectory,{ recursive:true });
  for (let index = 0; index < Lease.MAX_RETIREMENT_PUBLICATION_RECORDS; index += 1) {
    const name = crypto.randomUUID() + '.intent.json.' + crypto.randomUUID() + '.stage';
    fs.writeFileSync(path.join(lease.retirementPublicationDirectory,name),'{}\n','utf8');
  }
  const atBound = lease.retirementPublicationStatus();
  const extraName = crypto.randomUUID() + '.result.json.' + crypto.randomUUID() + '.stage';
  fs.writeFileSync(path.join(lease.retirementPublicationDirectory,extraName),'{}\n','utf8');
  const overBound = lease.retirementPublicationStatus();
  const adminSource = gitShow(SOURCE_COMMIT + ':shared/operations/review-operation-lease-admin.js').toString('utf8');
  receipt = {
    schema:'axm.review-operation-lease-retirement-stage-accumulation-baseline/v1',
    status:'REPRODUCED', sourceCommit:SOURCE_COMMIT,
    observations:{
      atBound:{ entries:200, state:atBound.state, reasonCode:atBound.reasonCode, stagedCandidates:atBound.stagedCandidates, invalidEntries:atBound.invalidEntries, recordsTruncated:atBound.recordsTruncated },
      overBound:{ entries:201, state:overBound.state, reasonCode:overBound.reasonCode, stagedCandidates:overBound.stagedCandidates, invalidEntries:overBound.invalidEntries, recordsTruncated:overBound.recordsTruncated },
      invalidJsonReportedAsStaged:atBound.records.every(item => item.state === 'STAGED_NON_AUTHORITATIVE'),
      statusRecordKeys:Object.keys(atBound.records[0]).sort(),
      exactPlanMethodAvailable:typeof lease.publicationStagePlan === 'function',
      archivalMethodAvailable:typeof lease.archivePublicationStage === 'function',
      planCliAvailable:adminSource.includes('publication-stage-plan'),
      archivalCliAvailable:adminSource.includes('archive-publication-stage')
    },
    truth:{ stageNamesSynthetic:true, realCrashResidualAlreadyProvenByV50Evidence:true, stageContentValidated:false, automaticCleanupAttempted:false, specialistPackageIntakeAttempted:false },
    temporaryFixtureRetained:false, receiptDigest:null
  };
} finally {
  const resolved = path.resolve(container), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('temporary baseline root escaped OS temp directory');
  fs.rmSync(resolved,{ recursive:true, force:true });
  retained = fs.existsSync(resolved);
}
receipt.temporaryFixtureRetained = retained;
const expected = receipt.observations.atBound.state === 'STAGED' && receipt.observations.atBound.stagedCandidates === 200 &&
  receipt.observations.overBound.state === 'HELD' && receipt.observations.overBound.reasonCode === 'RETIREMENT_PUBLICATION_STAGING_LIMIT_EXCEEDED' &&
  receipt.observations.invalidJsonReportedAsStaged && !receipt.observations.exactPlanMethodAvailable && !receipt.observations.archivalMethodAvailable && !retained;
if (!expected) receipt.status = 'NOT_REPRODUCED';
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.receiptDigest;
receipt.receiptDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname,'BASELINE_STAGE_ACCUMULATION.json'),JSON.stringify(receipt,null,2) + '\n','utf8');
process.stdout.write(receipt.status + ' v5.0 bounded status accumulation at 201 residual stage names\n');
if (receipt.status !== 'REPRODUCED') process.exitCode = 1;
