#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('./review-operation-lease');

const ARTIFACT_SUFFIX = Object.freeze({ intent:'.intent.json', decision:'.decision.json', result:'.result.json' });

function ownerFixture(stateRoot) {
  const lease = Lease.create({ stateRoot, timeoutMs:0 });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 100000, acquiredAt:new Date().toISOString() };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  return { lease, plan:lease.retirementPlan() };
}

function retirementInput(plan) {
  return {
    schema:Lease.RETIREMENT_REQUEST_SCHEMA,
    assertion:Lease.RETIREMENT_ASSERTION,
    confirmation:plan.exactConfirmation,
    ownerDigest:plan.ownerDigest,
    reason:'Operator asserts the isolated publication-crash fixture holder has terminated.'
  };
}

function recoveryInput(record) {
  return {
    schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA,
    retirementId:record.retirementId,
    action:record.actionRequired,
    ownerDigest:record.ownerDigest,
    assertion:Lease.RETIREMENT_ASSERTION,
    confirmation:record.confirmationRequired,
    reason:'Operator explicitly confirms recovery of this exact publication-crash fixture.'
  };
}

function withdrawalInput(record) {
  return {
    schema:Lease.RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA,
    retirementId:record.retirementId,
    ownerDigest:record.ownerDigest,
    assertion:Lease.RETIREMENT_WITHDRAWAL_ASSERTION,
    confirmation:record.withdrawalConfirmationRequired,
    reason:'Operator explicitly withdraws this exact publication-crash retirement intent.'
  };
}

function crashChild(stateRoot, artifact, phase) {
  const suffix = ARTIFACT_SUFFIX[artifact];
  if (!suffix || !['pre','post'].includes(phase)) throw new Error('invalid crash fixture mode');
  const value = ownerFixture(stateRoot), originalLink = fs.linkSync;
  fs.linkSync = (stage, final) => {
    if (String(final).endsWith(suffix)) {
      if (phase === 'post') originalLink(stage, final);
      process.exit(phase === 'pre' ? 70 : 71);
    }
    return originalLink(stage, final);
  };
  value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  process.exit(72);
}

if (process.argv[2] === '--crash-child') crashChild(path.resolve(process.argv[3]), process.argv[4], process.argv[5]);

let assertions = 0;
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function check(value, label) { assert(value, label); assertions += 1; }
function exactKeys(value, schema, label) { equal(Object.keys(value).sort(), Object.keys(schema.properties).sort(), label); }
function cli(args) { return childProcess.spawnSync(process.execPath, [path.join(__dirname,'review-operation-lease-admin.js'), ...args], { encoding:'utf8', windowsHide:true }); }

function runCrash(root, artifact, phase) {
  const stateRoot = path.join(root, artifact + '-' + phase);
  const child = childProcess.spawnSync(process.execPath, [__filename,'--crash-child',stateRoot,artifact,phase], { encoding:'utf8', windowsHide:true });
  equal(child.status, phase === 'pre' ? 70 : 71, artifact + ' ' + phase + '-link child exits at exact checkpoint');
  equal(child.stderr, '', artifact + ' ' + phase + '-link child emits no incidental stderr');
  const lease = Lease.create({ stateRoot, timeoutMs:0 });
  const publication = lease.retirementPublicationStatus();
  equal(publication.state, 'STAGED', artifact + ' ' + phase + '-link leaves visible non-authoritative staging');
  equal(publication.reasonCode, 'NON_AUTHORITATIVE_STAGED_PUBLICATIONS_PRESENT', artifact + ' ' + phase + '-link staging has exact reason');
  equal(publication.stagedCandidates, 1, artifact + ' ' + phase + '-link leaves one staged candidate');
  equal(publication.invalidEntries, 0, artifact + ' ' + phase + '-link staging entry is structurally valid');
  const record = publication.records[0];
  equal(record.state, 'STAGED_NON_AUTHORITATIVE', artifact + ' ' + phase + '-link stage is explicitly non-authoritative');
  check(record.targetFile.endsWith(suffixFor(artifact)), artifact + ' ' + phase + '-link stage names its exact target kind');
  const stageFile = path.join(lease.retirementPublicationDirectory, record.file);
  const finalFile = path.join(lease.retirementsDirectory, record.targetFile);
  const stagedValue = JSON.parse(fs.readFileSync(stageFile, 'utf8'));
  equal(stagedValue.retirementId + suffixFor(artifact), record.targetFile, artifact + ' ' + phase + '-link staged bytes bind exact target');
  equal(fs.existsSync(finalFile), phase === 'post', artifact + ' ' + phase + '-link authoritative visibility is all-or-absent');
  if (phase === 'post') {
    equal(fs.readFileSync(finalFile), fs.readFileSync(stageFile), artifact + ' post-link authoritative bytes equal complete staged bytes');
    const validators = { intent:Lease.validRetirementIntent, decision:Lease.validRetirementDecision, result:Lease.validRetirementResult };
    equal(validators[artifact](JSON.parse(fs.readFileSync(finalFile, 'utf8'))), true, artifact + ' post-link authoritative JSON is exact');
  }
  return { lease, publication, record, finalFile, stageFile };
}

function suffixFor(artifact) { return ARTIFACT_SUFFIX[artifact]; }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-retirement-publication-'));
try {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-status.schema.json'),'utf8'));
  equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', 'publication status uses exact JSON Schema dialect');
  equal(schema.$id, Lease.RETIREMENT_PUBLICATION_STATUS_SCHEMA, 'publication status schema id matches runtime');
  equal(Lease.MAX_RETIREMENT_PUBLICATION_RECORDS, 200, 'publication status has explicit record bound');

  const ordinary = ownerFixture(path.join(root,'ordinary'));
  const originalOpen = fs.openSync, originalFsync = fs.fsyncSync, originalLink = fs.linkSync;
  let authoritativeWriteOpens = 0, stageWriteOpens = 0, fsyncs = 0;
  const linkedKinds = [];
  try {
    fs.openSync = (file, flags, mode) => {
      const name = String(file), authoritative = name.startsWith(ordinary.lease.retirementsDirectory + path.sep) && /\.(intent|decision|result)\.json$/.test(name);
      if (authoritative && flags !== 'r') authoritativeWriteOpens += 1;
      if (name.startsWith(ordinary.lease.retirementPublicationDirectory + path.sep) && flags === 'wx') stageWriteOpens += 1;
      return originalOpen(file, flags, mode);
    };
    fs.fsyncSync = handle => { fsyncs += 1; return originalFsync(handle); };
    fs.linkSync = (stage, final) => { linkedKinds.push(path.basename(final).replace(/^[^.]+\./,'')); return originalLink(stage, final); };
    ordinary.result = ordinary.lease.retireWithOperatorAssertion(retirementInput(ordinary.plan));
  } finally { fs.openSync = originalOpen; fs.fsyncSync = originalFsync; fs.linkSync = originalLink; }
  equal(ordinary.result.state, 'RETIRED', 'ordinary retirement still completes');
  equal(authoritativeWriteOpens, 0, 'publisher never opens authoritative JSON paths for write');
  equal(stageWriteOpens, 3, 'intent, decision, and result each use a private exclusive stage');
  equal(fsyncs, 3, 'intent, decision, and result bytes are each fsynced before publication');
  equal(linkedKinds.sort(), ['decision.json','intent.json','result.json'], 'all three artifact kinds use hard-link publication');
  const ordinaryPublication = ordinary.lease.retirementPublicationStatus();
  equal(ordinaryPublication.state, 'CURRENT', 'successful publication removes its staging links');
  exactKeys(ordinaryPublication, schema, 'publication status matches closed schema');
  exactKeys(ordinaryPublication.truth, schema.$defs.truth, 'publication truth matches closed schema');
  equal(ordinaryPublication.truth.cooperatingSingleHostHardLinkAtomicVisibility, true, 'truth claims bounded cooperating single-host visibility');
  equal(ordinaryPublication.truth.completeBytesFsyncedBeforeHardLink, true, 'truth claims complete fsynced bytes before link');
  equal(ordinaryPublication.truth.hardLinkPublicationNoOverwrite, true, 'truth claims exclusive hard-link publication');
  equal(ordinaryPublication.truth.authoritativePathNeverOpenedForWriteByPublisher, true, 'truth denies publisher writes through authoritative path');
  equal(ordinaryPublication.truth.staleStageReclamationProvided, false, 'truth denies stale-stage reclamation');
  equal(ordinaryPublication.truth.hardLinkFreeAtomicFallbackProvided, false, 'truth denies a hard-link-free fallback');
  equal(ordinaryPublication.truth.powerLossDurabilityProven, false, 'truth denies power-loss durability');
  equal(ordinaryPublication.truth.crossFileAtomicityProven, false, 'truth denies cross-file atomicity');
  equal(ordinaryPublication.truth.nonCooperatingExternalWritersExcluded, false, 'truth does not exclude external writers');
  equal(ordinaryPublication.truth.browserRoute, false, 'truth denies browser route');
  equal(ordinaryPublication.truth.apiRoute, false, 'truth denies API route');
  equal(ordinaryPublication.truth.executionAuthorized, false, 'publication grants no execution authority');
  equal(ordinaryPublication.truth.mergeAuthorized, false, 'publication grants no merge authority');
  equal(ordinaryPublication.truth.canonAuthorized, false, 'publication grants no CANON authority');

  const collision = ownerFixture(path.join(root,'collision')), collisionOpen = fs.openSync, collisionLink = fs.linkSync;
  const sentinel = Buffer.from('{"external":"sentinel"}\n');
  let collisionFile = null, collisionError = null;
  try {
    fs.linkSync = (stage, final) => {
      if (!collisionFile && String(final).endsWith('.intent.json')) {
        collisionFile = final;
        fs.writeFileSync(final, sentinel, { flag:'wx' });
      }
      return collisionLink(stage, final);
    };
    collision.lease.retireWithOperatorAssertion(retirementInput(collision.plan));
  } catch (error) { collisionError = error; }
  finally { fs.openSync = collisionOpen; fs.linkSync = collisionLink; }
  equal(collisionError && collisionError.code, 'EEXIST', 'pre-existing authoritative path produces exclusive collision');
  equal(fs.readFileSync(collisionFile), sentinel, 'exclusive publication does not overwrite existing authoritative bytes');
  equal(collision.lease.retirementPublicationStatus().state, 'CURRENT', 'ordinary collision cleans its own private stage');

  const crashes = {};
  for (const artifact of ['intent','decision','result']) for (const phase of ['pre','post']) crashes[artifact + '-' + phase] = runCrash(root, artifact, phase);

  equal(crashes['intent-pre'].lease.retirementRecoveryStatus().state, 'CURRENT', 'pre-intent crash creates no authoritative retirement evidence');
  const intentPrePlan = crashes['intent-pre'].lease.retirementPlan();
  equal(crashes['intent-pre'].lease.retireWithOperatorAssertion(retirementInput(intentPrePlan)).state, 'RETIRED', 'pre-intent crash permits an exact fresh retry');
  equal(crashes['intent-pre'].lease.retirementPublicationStatus().stagedCandidates, 1, 'fresh retry does not silently reclaim prior stage');

  for (const key of ['intent-post','decision-pre']) {
    const status = crashes[key].lease.retirementRecoveryStatus(), record = status.records[0];
    equal(status.state, 'RECOVERY_REQUIRED', key + ' exposes exact undecided intent recovery');
    equal(record.reasonCode, 'EXACT_OWNER_EVIDENCE_REQUIRES_DECISION', key + ' has exact undecided reason');
    equal(crashes[key].lease.withdrawRetirement(withdrawalInput(record)).state, 'WITHDRAWN', key + ' can be explicitly withdrawn');
    equal(crashes[key].lease.retirementPublicationStatus().stagedCandidates, 1, key + ' withdrawal preserves prior stage visibility');
  }

  const decisionPostStatus = crashes['decision-post'].lease.retirementRecoveryStatus(), decisionPostRecord = decisionPostStatus.records[0];
  equal(decisionPostRecord.actionRequired, 'RESUME_RETIREMENT', 'post-decision crash requires exact resume');
  equal(crashes['decision-post'].lease.recoverRetirement(recoveryInput(decisionPostRecord)).state, 'RECOVERED', 'post-decision crash resumes exactly');
  equal(crashes['decision-post'].lease.retirementRecoveryStatus().state, 'CURRENT', 'post-decision recovery completes');

  const resultPreStatus = crashes['result-pre'].lease.retirementRecoveryStatus(), resultPreRecord = resultPreStatus.records[0];
  equal(resultPreRecord.actionRequired, 'FINALIZE_RESULT', 'pre-result crash requires exact finalization');
  equal(crashes['result-pre'].lease.recoverRetirement(recoveryInput(resultPreRecord)).state, 'RECOVERED', 'pre-result crash finalizes exactly');
  equal(crashes['result-pre'].lease.retirementRecoveryStatus().state, 'CURRENT', 'pre-result finalization completes');
  equal(crashes['result-post'].lease.retirementRecoveryStatus().state, 'CURRENT', 'post-result crash is already complete');
  equal(crashes['result-post'].lease.retirementRecoveryStatus().records[0].state, 'COMPLETE', 'post-result crash exposes exact complete record');

  const stagedCli = cli(['publication-status','--state-root',crashes['intent-post'].lease.stateRoot]);
  equal(stagedCli.status, 0, 'host-local publication-status CLI succeeds');
  equal(JSON.parse(stagedCli.stdout).result.state, 'STAGED', 'host-local CLI exposes residual non-authoritative stage');

  const invalid = Lease.create({ stateRoot:path.join(root,'invalid-status') });
  fs.mkdirSync(invalid.retirementPublicationDirectory, { recursive:true });
  fs.writeFileSync(path.join(invalid.retirementPublicationDirectory,'unexpected.entry'), 'not authoritative', 'utf8');
  const invalidStatus = invalid.retirementPublicationStatus();
  equal(invalidStatus.state, 'HELD', 'invalid staging entry holds publication status');
  equal(invalidStatus.reasonCode, 'RETIREMENT_PUBLICATION_STAGING_INVALID', 'invalid staging entry has exact reason');
  equal(invalidStatus.invalidEntries, 1, 'invalid staging entry is counted');

  const bounded = Lease.create({ stateRoot:path.join(root,'bounded-status') });
  fs.mkdirSync(bounded.retirementPublicationDirectory, { recursive:true });
  for (let index = 0; index <= Lease.MAX_RETIREMENT_PUBLICATION_RECORDS; index += 1) {
    const name = crypto.randomUUID() + '.intent.json.' + crypto.randomUUID() + '.stage';
    fs.writeFileSync(path.join(bounded.retirementPublicationDirectory,name), '{}\n', 'utf8');
  }
  const boundedStatus = bounded.retirementPublicationStatus();
  equal(boundedStatus.state, 'HELD', 'over-bound staging status holds');
  equal(boundedStatus.reasonCode, 'RETIREMENT_PUBLICATION_STAGING_LIMIT_EXCEEDED', 'over-bound staging has exact reason');
  equal(boundedStatus.records.length, Lease.MAX_RETIREMENT_PUBLICATION_RECORDS, 'staging status records are bounded');
  equal(boundedStatus.recordsTruncated, true, 'staging status reports truncation');

  const leaseSource = fs.readFileSync(path.join(__dirname,'review-operation-lease.js'),'utf8');
  const apiSource = fs.readFileSync(path.join(__dirname,'operations-api.js'),'utf8');
  const appSource = fs.readFileSync(path.join(__dirname,'../../tools/review-inbox/app.js'),'utf8');
  check(leaseSource.includes("fs.openSync(stageFile, 'wx', 0o600)") && leaseSource.includes('fs.fsyncSync(handle)') && leaseSource.includes('fs.linkSync(stageFile, file)'), 'source preserves stage-write, fsync, hard-link order');
  check(!apiSource.includes('retirementPublicationStatus') && !/retirement.{0,30}publication.{0,30}status/i.test(apiSource), 'operations API exposes no publication-status route');
  check(!appSource.includes('retirementPublicationStatus') && !/retirement.{0,30}publication.{0,30}status/i.test(appSource), 'browser UI exposes no publication-status control');

  console.log('Review operation lease retirement publication selftest: PASS (' + assertions + ' assertions, all-or-absent intent/decision/result bytes across six real process crashes, exact retries, bounded host-local staging status, no power-loss/cross-file/API/browser claim)');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
