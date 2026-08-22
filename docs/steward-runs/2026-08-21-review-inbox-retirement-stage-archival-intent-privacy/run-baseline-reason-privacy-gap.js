#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const sourceCommit = 'b707aa08f0adf958f6344babf0839c37ab1b9dca';
const repoRoot = path.resolve(__dirname,'../../..');
function digest(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function gitShow(file) {
  const result = childProcess.spawnSync('git',['show',sourceCommit + ':' + file],{ cwd:repoRoot, encoding:'utf8', windowsHide:true, maxBuffer:8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('cannot read exact v5.2 source ' + file);
  return result.stdout;
}
function files(root,current) {
  const base = current || root, values = [];
  if (!fs.existsSync(base)) return values;
  for (const entry of fs.readdirSync(base,{ withFileTypes:true })) {
    const absolute = path.join(base,entry.name);
    if (entry.isDirectory()) values.push(...files(root,absolute));
    else if (entry.isFile()) values.push(path.relative(root,absolute).replace(/\\/g,'/'));
  }
  return values.sort();
}
function stringValues(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringValues);
  return [];
}

const root = fs.mkdtempSync(path.join(os.tmpdir(),'axm-v52-archival-reason-gap-'));
try {
  const oldOperations = path.join(root,'old','shared','operations');
  fs.mkdirSync(oldOperations,{ recursive:true });
  for (const name of ['review-operation-lease.js','review-operation-lease-retirement-publication-selftest.js','review-operation-lease-admin.js']) {
    fs.writeFileSync(path.join(oldOperations,name),gitShow('shared/operations/' + name),'utf8');
  }
  const OldLease = require(path.join(oldOperations,'review-operation-lease.js'));
  const publicationTest = path.join(oldOperations,'review-operation-lease-retirement-publication-selftest.js');
  const stateRoot = path.join(root,'state');
  const crash = childProcess.spawnSync(process.execPath,[publicationTest,'--crash-child',stateRoot,'intent','pre'],{ encoding:'utf8', windowsHide:true });
  if (crash.status !== 70) throw new Error('v5.2 stage fixture did not stop before authoritative publication');
  const lease = OldLease.create({ stateRoot,timeoutMs:0 });
  const stageFile = lease.retirementPublicationStatus().records[0].file;
  const plan = lease.retirementPublicationStagePlan(stageFile);
  const credential = ['axm','fixture','credential'].join('-');
  const machinePath = 'C:\\private\\publisher\\evidence.log';
  const reason = 'Fixture evidence OPENAI_API_KEY="' + credential + '" at ' + machinePath + ' remains held for operator inspection.';
  const request = {
    schema:OldLease.RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,
    stageFile, stageDigest:plan.stageDigest,
    assertion:OldLease.RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION,
    confirmation:plan.confirmationRequired, reason
  };
  const result = lease.archiveRetirementPublicationStage(request);
  const stateFiles = files(stateRoot);
  const stateStrings = stateFiles.flatMap(file => {
    try { return stringValues(JSON.parse(fs.readFileSync(path.join(stateRoot,file),'utf8'))); }
    catch (_) { return []; }
  });
  const cli = childProcess.spawnSync(process.execPath,[path.join(oldOperations,'review-operation-lease-admin.js'),'archive-publication-stage','--state-root',stateRoot,'--stage-file',request.stageFile,'--stage-digest',request.stageDigest,'--assertion',request.assertion,'--confirmation',request.confirmation,'--reason',request.reason],{ encoding:'utf8', windowsHide:true });
  if (cli.status !== 0) throw new Error('v5.2 CLI exact retry failed');
  const cliResult = JSON.parse(cli.stdout);
  const receipt = {
    schema:'axm.review-operation-lease-retirement-publication-archival-reason-privacy-gap-baseline/v1',
    status:'REPRODUCED', sourceCommit,
    observations:{
      fixtureCrashExitCode:crash.status,
      stageStateBeforeArchive:plan.state,
      archivalResultState:result.state,
      intentSchema:OldLease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA,
      resultSchema:OldLease.RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA,
      rawReasonPersistedInState:stateStrings.includes(reason),
      recognizedCredentialPersistedInState:stateStrings.some(value => value.includes(credential)),
      machinePathPersistedInState:stateStrings.some(value => value.includes(machinePath)),
      rawReasonReturnedByRuntime:result.reason === reason,
      recognizedCredentialReturnedByRuntime:stringValues(result).some(value => value.includes(credential)),
      machinePathReturnedByRuntime:stringValues(result).some(value => value.includes(machinePath)),
      rawReasonEmittedByCli:stringValues(cliResult).includes(reason),
      reasonDigestFieldAvailable:Object.prototype.hasOwnProperty.call(result,'reasonDigest'),
      reasonRedactionFieldAvailable:Object.prototype.hasOwnProperty.call(result,'reasonRedacted'),
      stateFileCount:stateFiles.length
    },
    truth:{ exactV52ProductBehaviorEvaluated:true, currentProductEvaluated:false, fixtureCredentialIsSynthetic:true, rawStateBytesRetained:false, rawCliOutputRetained:false, specialistPackageIntakeAttempted:false },
    temporaryFixtureRetained:false,
    receiptDigest:null
  };
  const body = JSON.parse(Core.canonicalJson(receipt));
  delete body.receiptDigest;
  receipt.receiptDigest = digest(Core.canonicalJson(body));
  fs.writeFileSync(path.join(__dirname,'BASELINE_REASON_PRIVACY_GAP.json'),JSON.stringify(receipt,null,2) + '\n','utf8');
  process.stdout.write('BASELINE archival reason privacy gap reproduced · ' + receipt.receiptDigest + '\n');
} finally {
  const resolved = path.resolve(root), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('baseline temp root escaped OS temp');
  fs.rmSync(resolved,{ recursive:true, force:true });
  if (fs.existsSync(resolved)) throw new Error('baseline temp root retained');
}
