#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('../../../shared/operations/review-operation-lease');
const Core = require('../../../tools/deterministic-json-core');

const sourceCommit = 'a71cd29a3c0652279e5f2db1a42067e7b2c632e5';
const publicationTest = path.resolve(__dirname,'../../../shared/operations/review-operation-lease-retirement-publication-selftest.js');
function digest(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
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

const root = fs.mkdtempSync(path.join(os.tmpdir(),'axm-v51-archival-authorization-gap-'));
let retained = true;
try {
  const stateRoot = path.join(root,'state');
  const crash = childProcess.spawnSync(process.execPath,[publicationTest,'--crash-child',stateRoot,'intent','pre'],{ encoding:'utf8',windowsHide:true });
  if (crash.status !== 70) throw new Error('v5.1 stage fixture did not stop before authoritative publication');
  const lease = Lease.create({ stateRoot,timeoutMs:0 });
  const publication = lease.retirementPublicationStatus();
  const stageFile = publication.records[0].file;
  const plan = lease.retirementPublicationStagePlan(stageFile);
  const reason = 'Baseline v5.1 archival assertion reason exists only in the immediate result.';
  const result = lease.archiveRetirementPublicationStage({
    schema:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,
    stageFile, stageDigest:plan.stageDigest,
    assertion:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION,
    confirmation:plan.confirmationRequired, reason
  });
  const stateFiles = files(stateRoot);
  const reasonPersisted = stateFiles.some(file => fs.readFileSync(path.join(stateRoot,file)).includes(Buffer.from(reason)));
  const receipt = {
    schema:'axm.review-operation-lease-retirement-publication-archival-authorization-gap-baseline/v1',
    status:'REPRODUCED', sourceCommit,
    observations:{
      fixtureCrashExitCode:crash.status, stageStateBeforeArchive:plan.state, archivalResultState:result.state,
      resultDeclaredDurableAuthorizationRecord:result.truth.durableArchivalAuthorizationRecordProvided,
      archivalReasonPersistedInState:reasonPersisted,
      stateFiles,
      authorizationIntentSchemaAvailable:typeof Lease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA === 'string',
      authorizationStatusMethodAvailable:typeof lease.retirementPublicationArchivalAuthorizationStatus === 'function',
      authorizationStatusCliAvailable:fs.readFileSync(path.resolve(__dirname,'../../../shared/operations/review-operation-lease-admin.js'),'utf8').includes('publication-stage-authorization-status')
    },
    truth:{ currentProductEvaluated:false, v51ProductBehaviorEvaluated:true, rawStageBytesRetained:false, specialistPackageIntakeAttempted:false },
    temporaryFixtureRetained:false, receiptDigest:null
  };
  const body = JSON.parse(Core.canonicalJson(receipt));
  delete body.receiptDigest;
  receipt.receiptDigest = digest(Core.canonicalJson(body));
  fs.writeFileSync(path.join(__dirname,'BASELINE_AUTHORIZATION_GAP.json'),JSON.stringify(receipt,null,2) + '\n','utf8');
  process.stdout.write('BASELINE archival authorization gap reproduced · ' + receipt.receiptDigest + '\n');
} finally {
  const resolved = path.resolve(root), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('baseline temp root escaped OS temp');
  fs.rmSync(resolved,{ recursive:true,force:true });
  retained = fs.existsSync(resolved);
  if (retained) throw new Error('baseline temp root retained');
}
