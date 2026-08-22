#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('./review-operation-lease');
const Review = require('./review-service');

let assertions = 0;
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function check(value, label) { assert(value, label); assertions += 1; }
function digest(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function exactSchemaKeys(value, schema, label) {
  equal(schema.additionalProperties, false, label + ' schema is closed');
  equal(Object.keys(value).sort(), schema.required.slice().sort(), label + ' runtime keys match the schema');
}
function fixture(stateRoot, ownerProcessId) {
  const lease = Lease.create({ stateRoot });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = {
    schema:Lease.OWNER_SCHEMA,
    leaseId:crypto.randomUUID(),
    processId:ownerProcessId || process.pid + 100000,
    acquiredAt:new Date().toISOString()
  };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  const plan = lease.retirementPlan();
  return { lease, owner, plan };
}
function retirementInput(plan) {
  return {
    schema:Lease.RETIREMENT_REQUEST_SCHEMA,
    assertion:Lease.RETIREMENT_ASSERTION,
    confirmation:plan.exactConfirmation,
    ownerDigest:plan.ownerDigest,
    reason:'Operator asserts the isolated interrupted-retirement fixture holder has terminated.'
  };
}
function recoveryInput(record, action) {
  const selectedAction = action || record.actionRequired;
  return {
    schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA,
    retirementId:record.retirementId,
    action:selectedAction,
    ownerDigest:record.ownerDigest,
    assertion:Lease.RETIREMENT_ASSERTION,
    confirmation:Lease.RETIREMENT_RECOVERY_CONFIRMATION_PREFIX + selectedAction + ' ' + record.retirementId + ' ' + record.ownerDigest,
    reason:'Operator explicitly confirms recovery of this exact interrupted retirement evidence.'
  };
}
function interruptAfterIntent(stateRoot) {
  const value = fixture(stateRoot), original = fs.renameSync;
  let error = null;
  try {
    fs.renameSync = (from, to) => {
      if (path.resolve(from) === path.resolve(value.lease.leaseFile)) {
        const interrupted = new Error('simulated interruption after retirement intent');
        interrupted.code = 'SIMULATED_INTERRUPTION';
        throw interrupted;
      }
      return original(from, to);
    };
    value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  } catch (caught) { error = caught; }
  finally { fs.renameSync = original; }
  return Object.assign(value, { error });
}
function interruptAfterEvidence(stateRoot) {
  const value = fixture(stateRoot), original = fs.linkSync;
  let error = null;
  try {
    fs.linkSync = (stage, file) => {
      if (String(file).endsWith('.result.json')) {
        const interrupted = new Error('simulated interruption after owner evidence quarantine');
        interrupted.code = 'SIMULATED_INTERRUPTION';
        throw interrupted;
      }
      return original(stage, file);
    };
    value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  } catch (caught) { error = caught; }
  finally { fs.linkSync = original; }
  return Object.assign(value, { error });
}
function refused(action, label) {
  let error = null;
  try { action(); } catch (caught) { error = caught; }
  equal(error && error.code, 'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED', label);
  return error;
}
function cli(args) {
  return childProcess.spawnSync(process.execPath, [path.join(__dirname, 'review-operation-lease-admin.js'), ...args], {
    encoding:'utf8', windowsHide:true
  });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-operation-retirement-recovery-'));
try {
  const statusSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-operation-lease-retirement-recovery-status.schema.json'), 'utf8'));
  const requestSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-operation-lease-retirement-recovery-request.schema.json'), 'utf8'));
  const resultSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-operation-lease-retirement-recovery-result.schema.json'), 'utf8'));
  equal(statusSchema.$id, Lease.RETIREMENT_RECOVERY_STATUS_SCHEMA, 'status schema matches runtime constant');
  equal(requestSchema.$id, Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA, 'request schema matches runtime constant');
  equal(resultSchema.$id, Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA, 'result schema matches runtime constant');
  [statusSchema, requestSchema, resultSchema].forEach(schema => equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', schema.$id + ' declares the exact dialect'));

  const empty = Lease.create({ stateRoot:path.join(root, 'empty') }).retirementRecoveryStatus();
  equal(empty.state, 'CURRENT', 'empty retirement evidence is current');
  equal(empty.reasonCode, 'ALL_RETIREMENT_EVIDENCE_COMPLETE', 'empty evidence has no recovery need');
  equal(empty.records, [], 'empty evidence has no records');
  equal(empty.truth.automaticRecovery, false, 'status promises no automatic recovery');
  equal(empty.truth.cooperatingSingleHostRecoveryCheckpointConvergence, true, 'status declares bounded cooperating single-host checkpoint convergence');
  equal(empty.truth.generalRecoverySerializationProven, false, 'status proves no general recovery serialization');
  equal(empty.truth.retirementCancellationSafetyProven, false, 'status proves no retirement cancellation safety');
  equal(empty.truth.holderTerminatedOrAbandonedProven, false, 'status proves no holder termination');
  exactSchemaKeys(empty, statusSchema, 'empty recovery status');
  exactSchemaKeys(empty.truth, statusSchema.$defs.truth, 'empty recovery truth');

  const intentInterrupted = interruptAfterIntent(path.join(root, 'intent-interrupted'));
  equal(intentInterrupted.error && intentInterrupted.error.code, 'SIMULATED_INTERRUPTION', 'first fixture interrupts after durable intent');
  equal(fs.existsSync(intentInterrupted.lease.leaseFile), true, 'intent interruption retains exact owner lock');
  const intentStatus = intentInterrupted.lease.retirementRecoveryStatus(), intentRecord = intentStatus.records[0];
  equal(intentStatus.state, 'RECOVERY_REQUIRED', 'intent-only interruption is visibly recovery-required');
  equal(intentStatus.recoveryRequiredRetirements, 1, 'intent-only status counts one recovery');
  equal(intentRecord.state, 'RECOVERY_REQUIRED', 'intent-only record is recoverable');
  equal(intentRecord.reasonCode, 'EXACT_PROCEED_DECISION_REQUIRES_RESUME', 'intent-only record has an exact proceed-decision reason');
  equal(intentRecord.decisionState, 'PROCEED_RETIREMENT', 'intent-only record exposes the durable proceed decision');
  equal(intentRecord.withdrawalConfirmationRequired, null, 'committed proceed decision cannot be withdrawn');
  equal(intentRecord.actionRequired, 'RESUME_RETIREMENT', 'intent-only recovery requires resume action');
  equal(intentRecord.ownerDigest, intentInterrupted.plan.ownerDigest, 'intent-only recovery binds exact owner digest');
  equal(intentRecord.confirmationRequired, Lease.RETIREMENT_RECOVERY_CONFIRMATION_PREFIX + 'RESUME_RETIREMENT ' + intentRecord.retirementId + ' ' + intentRecord.ownerDigest, 'resume challenge binds action id and digest');
  equal(intentRecord.truth.intentExact, true, 'intent-only record validates the exact intent');
  equal(intentRecord.truth.ownerEvidenceDigestVerified, false, 'intent-only record does not pretend quarantine occurred');
  exactSchemaKeys(intentRecord, statusSchema.$defs.record, 'intent-only recovery record');

  const resume = recoveryInput(intentRecord);
  const beforeResumeBytes = fs.readFileSync(intentInterrupted.lease.leaseFile);
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { assertion:'MAYBE' })), 'wrong recovery assertion is refused');
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { ownerDigest:digest('wrong') })), 'wrong recovery digest is refused');
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { confirmation:'RECOVER' })), 'wrong recovery confirmation is refused');
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { action:'FINALIZE_RESULT' })), 'wrong recovery action is refused');
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { reason:'short' })), 'short recovery reason is refused');
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { reason:{ value:'not a string reason of sufficient apparent size' } })), 'non-string recovery reason is refused');
  refused(() => intentInterrupted.lease.recoverRetirement(Object.assign({}, resume, { extra:true })), 'open recovery request is refused');
  equal(fs.readFileSync(intentInterrupted.lease.leaseFile), beforeResumeBytes, 'all recovery precondition refusals preserve exact owner bytes');
  const resumed = intentInterrupted.lease.recoverRetirement(resume);
  equal(resumed.schema, Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA, 'resume result is typed');
  equal(resumed.state, 'RECOVERED', 'exact resume completes interrupted retirement');
  equal(resumed.action, 'RESUME_RETIREMENT', 'resume result preserves action');
  equal(resumed.ownerDigest, intentRecord.ownerDigest, 'resume result binds owner digest');
  equal(resumed.retirementResult.state, 'RETIRED', 'resume creates the ordinary retirement result');
  equal(resumed.truth.intentExact, true, 'resume result confirms exact intent');
  equal(resumed.truth.ownerEvidenceDigestVerified, true, 'resume result confirms quarantined digest');
  equal(resumed.truth.retirementResultExact, true, 'resume result confirms exact result');
  equal(resumed.truth.holderTerminatedOrAbandonedProven, false, 'resume proves no holder termination');
  equal(resumed.truth.recoverySafetyProven, false, 'resume proves no recovery safety');
  equal(resumed.truth.falseAssertionCanViolateSerialization, true, 'resume preserves false-assertion risk');
  equal(fs.existsSync(intentInterrupted.lease.leaseFile), false, 'resume frees the exact lock path');
  equal(digest(fs.readFileSync(path.join(intentInterrupted.lease.retirementsDirectory, resumed.retirementResult.quarantinedOwnerEvidenceFile))), intentRecord.ownerDigest, 'resume preserves exact owner evidence');
  const completedStatus = intentInterrupted.lease.retirementRecoveryStatus();
  equal(completedStatus.state, 'CURRENT', 'resumed evidence becomes current');
  equal(completedStatus.completeRetirements, 1, 'resumed evidence counts one complete retirement');
  equal(completedStatus.records[0].state, 'COMPLETE', 'resumed record is complete');
  const repeated = intentInterrupted.lease.recoverRetirement(resume);
  equal(repeated.state, 'ALREADY_COMPLETE', 'repeated exact recovery is idempotent observation');
  equal(fs.readdirSync(intentInterrupted.lease.retirementsDirectory).length, 4, 'idempotent recovery creates no extra evidence files');
  exactSchemaKeys(resumed, resultSchema, 'resume recovery result');
  exactSchemaKeys(resumed.truth, statusSchema.$defs.truth, 'resume recovery truth');
  const restartedReview = Review.create({ stateRoot:intentInterrupted.lease.stateRoot });
  restartedReview.submit({ sourceRef:'after-resumed-retirement', artifactDigest:digest('after-resumed-retirement').slice(7) });
  equal(restartedReview.list().length, 1, 'fresh ReviewService mutates after exact resumed retirement');

  const evidenceInterrupted = interruptAfterEvidence(path.join(root, 'evidence-interrupted'));
  equal(evidenceInterrupted.error && evidenceInterrupted.error.code, 'SIMULATED_INTERRUPTION', 'second fixture interrupts after quarantine');
  equal(fs.existsSync(evidenceInterrupted.lease.leaseFile), false, 'post-quarantine interruption leaves lock path free');
  const finalizationStatus = evidenceInterrupted.lease.retirementRecoveryStatus(), finalizationRecord = finalizationStatus.records[0];
  equal(finalizationStatus.state, 'RECOVERY_REQUIRED', 'quarantined evidence without result requires recovery');
  equal(finalizationRecord.reasonCode, 'QUARANTINED_OWNER_EVIDENCE_REQUIRES_RESULT', 'missing result has an exact reason');
  equal(finalizationRecord.actionRequired, 'FINALIZE_RESULT', 'post-quarantine recovery only finalizes result');
  equal(finalizationRecord.truth.ownerEvidenceDigestVerified, true, 'post-quarantine status verifies owner digest');
  equal(finalizationRecord.truth.retirementResultExact, false, 'post-quarantine status does not pretend result exists');
  const finalize = recoveryInput(finalizationRecord);
  refused(() => evidenceInterrupted.lease.recoverRetirement(Object.assign({}, finalize, { action:'RESUME_RETIREMENT' })), 'post-quarantine evidence refuses resume action');
  const finalized = evidenceInterrupted.lease.recoverRetirement(finalize);
  equal(finalized.state, 'RECOVERED', 'exact finalization completes result evidence');
  equal(finalized.action, 'FINALIZE_RESULT', 'finalization result preserves action');
  equal(evidenceInterrupted.lease.retirementRecoveryStatus().state, 'CURRENT', 'finalized evidence becomes current');
  equal(fs.readdirSync(evidenceInterrupted.lease.retirementsDirectory).length, 4, 'finalization retains exactly intent decision evidence and result');
  const reorderedResultFile = path.join(evidenceInterrupted.lease.retirementsDirectory, finalized.retirementResult.resultFile);
  const reorderedResult = JSON.parse(fs.readFileSync(reorderedResultFile, 'utf8'));
  reorderedResult.truth = Object.fromEntries(Object.entries(reorderedResult.truth).reverse());
  fs.writeFileSync(reorderedResultFile, JSON.stringify(reorderedResult, null, 2) + '\n');
  equal(evidenceInterrupted.lease.retirementRecoveryStatus().state, 'CURRENT', 'valid result truth property reordering does not invalidate evidence');
  equal(evidenceInterrupted.lease.retirementRecoveryStatus().records[0].state, 'COMPLETE', 'semantic validation is independent of JSON property order');

  const changed = interruptAfterIntent(path.join(root, 'changed-owner'));
  fs.appendFileSync(changed.lease.leaseFile, 'changed', 'utf8');
  const changedStatus = changed.lease.retirementRecoveryStatus();
  equal(changedStatus.state, 'HELD', 'changed owner evidence holds recovery');
  equal(changedStatus.records[0].reasonCode, 'CURRENT_OWNER_EVIDENCE_CHANGED', 'changed owner evidence is typed');
  refused(() => changed.lease.recoverRetirement(recoveryInput(intentStatus.records[0])), 'stale recovery record cannot recover another retirement');
  equal(fs.readFileSync(changed.lease.leaseFile, 'utf8').endsWith('changed'), true, 'changed owner evidence remains untouched');

  const currentRoot = path.join(root, 'current-process'), currentFixture = fixture(currentRoot, process.pid);
  fs.mkdirSync(currentFixture.lease.retirementsDirectory, { recursive:true });
  const currentId = crypto.randomUUID(), currentIntent = {
    schema:Lease.RETIREMENT_INTENT_SCHEMA, status:'TEST', state:'AUTHORIZED_PENDING_RETIREMENT', retirementId:currentId,
    recordedAt:new Date().toISOString(), ownerDigest:currentFixture.plan.ownerDigest, ownerEvidenceValid:true,
    observedProcessId:process.pid, observedAcquiredAt:currentFixture.owner.acquiredAt,
    callerAssertion:Lease.RETIREMENT_ASSERTION, reason:'Synthetic exact current-process intent remains held for safety testing.',
    confirmationMatched:true,
    truth:{ holderTerminatedOrAbandonedProven:false, retirementSafetyProven:false, falseAssertionCanViolateSerialization:true, callerAssertionRequired:true, exactOwnerDigestRequired:true, ownerEvidenceQuarantineRequired:true, ownerEvidenceQuarantined:false, currentProcessOwnerRetirementRefused:true, automaticRetirement:false, processLivenessInference:false, browserRoute:false, apiRoute:false, crossFileAtomicityProven:false, nonCooperatingExternalWritersExcluded:false, protectedStorageOrRollbackPreventionProven:false, executionAuthorized:false, adoptionAuthorized:false, promotionAuthorized:false, mergeAuthorized:false, canonAuthorized:false }
  };
  fs.writeFileSync(path.join(currentFixture.lease.retirementsDirectory, currentId + '.intent.json'), JSON.stringify(currentIntent, null, 2) + '\n');
  const currentStatus = currentFixture.lease.retirementRecoveryStatus();
  equal(currentStatus.state, 'HELD', 'current-process pending intent is held');
  equal(currentStatus.records[0].reasonCode, 'CURRENT_PROCESS_OWNER_RECOVERY_REFUSED', 'current-process recovery refusal is typed');

  const ambiguous = interruptAfterIntent(path.join(root, 'ambiguous'));
  const firstIntentName = fs.readdirSync(ambiguous.lease.retirementsDirectory).find(name => name.endsWith('.intent.json'));
  const firstIntent = JSON.parse(fs.readFileSync(path.join(ambiguous.lease.retirementsDirectory, firstIntentName), 'utf8'));
  const secondId = crypto.randomUUID(), secondIntent = Object.assign({}, firstIntent, { retirementId:secondId });
  fs.writeFileSync(path.join(ambiguous.lease.retirementsDirectory, secondId + '.intent.json'), JSON.stringify(secondIntent, null, 2) + '\n');
  const ambiguousStatus = ambiguous.lease.retirementRecoveryStatus();
  equal(ambiguousStatus.state, 'HELD', 'competing intent-only records are held');
  equal(ambiguousStatus.heldRetirements, 2, 'both ambiguous intents are held');
  check(ambiguousStatus.records.every(record => record.reasonCode === 'AMBIGUOUS_PENDING_RETIREMENT_INTENTS'), 'every ambiguous intent has the exact reason');

  const corrupt = interruptAfterEvidence(path.join(root, 'corrupt-evidence'));
  const corruptRecord = corrupt.lease.retirementRecoveryStatus().records[0];
  fs.appendFileSync(path.join(corrupt.lease.retirementsDirectory, corruptRecord.quarantinedOwnerEvidenceFile), 'corrupt', 'utf8');
  const corruptStatus = corrupt.lease.retirementRecoveryStatus();
  equal(corruptStatus.state, 'HELD', 'corrupt quarantined evidence is held');
  equal(corruptStatus.records[0].reasonCode, 'QUARANTINED_OWNER_DIGEST_MISMATCH', 'corrupt evidence mismatch is typed');
  refused(() => corrupt.lease.recoverRetirement(recoveryInput(corruptRecord)), 'corrupt quarantined evidence cannot be finalized');

  const unknownRoot = path.join(root, 'unknown'), unknown = Lease.create({ stateRoot:unknownRoot });
  fs.mkdirSync(unknown.retirementsDirectory, { recursive:true });
  fs.writeFileSync(path.join(unknown.retirementsDirectory, 'unexpected.tmp'), 'data');
  const unknownStatus = unknown.retirementRecoveryStatus();
  equal(unknownStatus.state, 'HELD', 'unrecognized evidence is held');
  equal(unknownStatus.records[0].reasonCode, 'UNRECOGNIZED_RETIREMENT_EVIDENCE', 'unrecognized evidence is typed');

  const nonFileRoot = path.join(root, 'non-file'), nonFile = Lease.create({ stateRoot:nonFileRoot });
  fs.mkdirSync(path.join(nonFile.retirementsDirectory, crypto.randomUUID() + '.intent.json'), { recursive:true });
  equal(nonFile.retirementRecoveryStatus().records[0].reasonCode, 'UNRECOGNIZED_RETIREMENT_EVIDENCE', 'directory-shaped evidence is held without traversal');

  const oversized = interruptAfterIntent(path.join(root, 'oversized'));
  const oversizedIntent = fs.readdirSync(oversized.lease.retirementsDirectory).find(name => name.endsWith('.intent.json'));
  fs.writeFileSync(path.join(oversized.lease.retirementsDirectory, oversizedIntent), 'x'.repeat(Lease.MAX_RETIREMENT_EVIDENCE_BYTES + 1));
  equal(oversized.lease.retirementRecoveryStatus().state, 'HELD', 'oversized retirement evidence is held');
  equal(oversized.lease.retirementRecoveryStatus().records[0].reasonCode, 'RETIREMENT_INTENT_INVALID', 'oversized intent has a typed invalid reason');

  const limitRoot = path.join(root, 'limit'), limited = Lease.create({ stateRoot:limitRoot });
  fs.mkdirSync(limited.retirementsDirectory, { recursive:true });
  for (let index = 0; index < Lease.MAX_RETIREMENT_RECOVERY_RECORDS + 1; index += 1) {
    fs.writeFileSync(path.join(limited.retirementsDirectory, 'unknown-' + String(index).padStart(3, '0')), 'x');
  }
  const limitStatus = limited.retirementRecoveryStatus();
  equal(limitStatus.state, 'HELD', 'evidence count over the bound is held');
  equal(limitStatus.reasonCode, 'RETIREMENT_RECOVERY_EVIDENCE_LIMIT_EXCEEDED', 'evidence limit is typed');
  equal(limitStatus.records.length, Lease.MAX_RETIREMENT_RECOVERY_RECORDS, 'bounded status emits at most the configured records');
  equal(limitStatus.recordsTruncated, true, 'bounded status records truncation');

  const cliInterrupted = interruptAfterEvidence(path.join(root, 'cli'));
  const cliStatusResult = cli(['recovery-status','--state-root',cliInterrupted.lease.stateRoot]);
  equal(cliStatusResult.status, 0, 'CLI recovery-status succeeds');
  const cliStatus = JSON.parse(cliStatusResult.stdout).result, cliRecord = cliStatus.records[0];
  equal(cliStatus.state, 'RECOVERY_REQUIRED', 'CLI exposes interrupted retirement status');
  const cliRequest = recoveryInput(cliRecord);
  const wrongCli = cli(['recover','--state-root',cliInterrupted.lease.stateRoot,'--retirement-id',cliRequest.retirementId,'--action',cliRequest.action,'--owner-digest',cliRequest.ownerDigest,'--assertion',cliRequest.assertion,'--confirmation','wrong','--reason',cliRequest.reason]);
  equal(wrongCli.status, 1, 'CLI refuses wrong recovery confirmation');
  equal(JSON.parse(wrongCli.stderr).code, 'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED', 'CLI recovery refusal is typed');
  const exactCli = cli(['recover','--state-root',cliInterrupted.lease.stateRoot,'--retirement-id',cliRequest.retirementId,'--action',cliRequest.action,'--owner-digest',cliRequest.ownerDigest,'--assertion',cliRequest.assertion,'--confirmation',cliRequest.confirmation,'--reason',cliRequest.reason]);
  equal(exactCli.status, 0, 'CLI exact interrupted-retirement recovery succeeds');
  equal(JSON.parse(exactCli.stdout).result.state, 'RECOVERED', 'CLI returns typed recovery result');

  const leaseSource = fs.readFileSync(path.join(__dirname, 'review-operation-lease.js'), 'utf8');
  const adminSource = fs.readFileSync(path.join(__dirname, 'review-operation-lease-admin.js'), 'utf8');
  const apiSource = fs.readFileSync(path.join(__dirname, 'operations-api.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '../../tools/review-inbox/app.js'), 'utf8');
  check(!/process\.kill|kill\s*\(|Date\.now\(\).{0,80}(recover|rename|unlink)/i.test(leaseSource), 'recovery uses no process kill or age-based inference');
  check(leaseSource.includes("'RESUME_RETIREMENT','FINALIZE_RESULT'"), 'source limits recovery to two exact actions');
  check(adminSource.includes("'recovery-status','publication-status','publication-stage-plan','publication-stage-authorization-status','archive-publication-stage','recover'"), 'local CLI exposes recovery status, publication status, stage planning, archival authorization status, stage archival, and exact recovery');
  check(!apiSource.includes('recoverRetirement') && !/operation-lease\/retirement\/recover/i.test(apiSource), 'operations API exposes no retirement-recovery route');
  check(!appSource.includes('recoverRetirement') && !/recover.{0,30}retirement/i.test(appSource), 'browser UI exposes no retirement-recovery control');

  console.log('Review operation lease retirement recovery selftest: PASS (' + assertions + ' assertions, two interruption windows, exact explicit recovery, corruption holds, bounded status, no automatic/API/browser route)');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
