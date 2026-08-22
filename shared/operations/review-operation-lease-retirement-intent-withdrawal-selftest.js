#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('./review-operation-lease');

let assertions = 0;
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function check(value, label) { assert(value, label); assertions += 1; }
function exactKeys(value, schema, label) { equal(Object.keys(value).sort(), schema.required.slice().sort(), label); }
function capture(action) { try { return { result:action(), error:null }; } catch (error) { return { result:null, error }; } }
function refused(action, code, label) { const outcome = capture(action); equal(outcome.error && outcome.error.code, code, label); return outcome.error; }
function fixture(stateRoot, ownerProcessId) {
  const lease = Lease.create({ stateRoot, timeoutMs:0, recoveryCheckpointObserveMs:1000 });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:ownerProcessId || process.pid + 100000, acquiredAt:new Date().toISOString() };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  return { lease, owner, plan:lease.retirementPlan() };
}
function retirementInput(plan) {
  return { schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason:'Operator asserts the isolated withdrawal fixture holder has terminated.' };
}
function withdrawalInput(record) {
  return { schema:Lease.RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA, retirementId:record.retirementId, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_WITHDRAWAL_ASSERTION, confirmation:record.withdrawalConfirmationRequired, reason:'Operator explicitly withdraws this exact undecided retirement intent.' };
}
function recoveryInput(record) {
  return { schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA, retirementId:record.retirementId, action:record.actionRequired, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_ASSERTION, confirmation:record.confirmationRequired, reason:'Operator explicitly confirms recovery of this exact retirement intent.' };
}
function undecidedFixture(stateRoot, ownerProcessId) {
  const value = fixture(stateRoot, ownerProcessId), originalLink = fs.linkSync;
  try {
    fs.linkSync = (stage, file) => {
      if (String(file).endsWith('.decision.json')) { const error = new Error('decision interruption'); error.code = 'SIMULATED_DECISION_INTERRUPTION'; throw error; }
      return originalLink(stage, file);
    };
    value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  } catch (error) { value.interruption = error; }
  finally { fs.linkSync = originalLink; }
  return value;
}
function cli(args) {
  return childProcess.spawnSync(process.execPath, [path.join(__dirname,'review-operation-lease-admin.js'), ...args], { encoding:'utf8', windowsHide:true });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-retirement-intent-withdrawal-'));
try {
  const decisionSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-decision.schema.json'),'utf8'));
  const requestSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-withdrawal-request.schema.json'),'utf8'));
  const resultSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-withdrawal-result.schema.json'),'utf8'));
  const statusSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-recovery-status.schema.json'),'utf8'));
  equal(decisionSchema.$id, Lease.RETIREMENT_DECISION_SCHEMA, 'decision schema id matches runtime');
  equal(requestSchema.$id, Lease.RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA, 'withdrawal request schema id matches runtime');
  equal(resultSchema.$id, Lease.RETIREMENT_WITHDRAWAL_RESULT_SCHEMA, 'withdrawal result schema id matches runtime');
  [decisionSchema,requestSchema,resultSchema].forEach(schema => equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', schema.$id + ' uses exact dialect'));

  const undecided = undecidedFixture(path.join(root,'undecided'));
  equal(undecided.interruption && undecided.interruption.code, 'SIMULATED_DECISION_INTERRUPTION', 'fixture interrupts after intent before decision');
  const ownerBytes = fs.readFileSync(undecided.lease.leaseFile), status = undecided.lease.retirementRecoveryStatus(), record = status.records[0];
  equal(status.state, 'RECOVERY_REQUIRED', 'undecided intent is recovery-required');
  equal(record.reasonCode, 'EXACT_OWNER_EVIDENCE_REQUIRES_DECISION', 'undecided intent has exact decision reason');
  equal(record.decisionState, null, 'undecided intent has no decision state');
  equal(record.decisionFile, record.retirementId + '.decision.json', 'status names exact decision file');
  equal(record.withdrawalConfirmationRequired, Lease.RETIREMENT_WITHDRAWAL_CONFIRMATION_PREFIX + record.retirementId + ' ' + record.ownerDigest, 'withdrawal challenge binds id and owner digest');
  exactKeys(record, statusSchema.$defs.record, 'status record matches closed schema');
  const request = withdrawalInput(record);
  refused(() => undecided.lease.withdrawRetirement({ ...request, assertion:'MAYBE' }), 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'wrong withdrawal assertion is refused');
  refused(() => undecided.lease.withdrawRetirement({ ...request, confirmation:'WITHDRAW' }), 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'wrong withdrawal confirmation is refused');
  refused(() => undecided.lease.withdrawRetirement({ ...request, ownerDigest:'sha256:' + '0'.repeat(64) }), 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'wrong withdrawal digest is refused');
  refused(() => undecided.lease.withdrawRetirement({ ...request, reason:'short' }), 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'short withdrawal reason is refused');
  refused(() => undecided.lease.withdrawRetirement({ ...request, extra:true }), 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'open withdrawal request is refused');
  equal(fs.readFileSync(undecided.lease.leaseFile), ownerBytes, 'refusals preserve exact owner bytes');
  equal(fs.readdirSync(undecided.lease.retirementsDirectory).length, 1, 'refusals add no decision evidence');

  const withdrawn = undecided.lease.withdrawRetirement(request);
  equal(withdrawn.schema, Lease.RETIREMENT_WITHDRAWAL_RESULT_SCHEMA, 'withdrawal result is typed');
  equal(withdrawn.state, 'WITHDRAWN', 'first exact withdrawal records withdrawal');
  equal(withdrawn.retirementDecision.state, 'WITHDRAW_RETIREMENT_INTENT', 'withdrawal result carries exact decision');
  equal(withdrawn.retirementDecision.intentDigest, 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(path.join(undecided.lease.retirementsDirectory, record.intentFile))).digest('hex'), 'decision binds exact intent bytes');
  equal(withdrawn.truth.ownerEvidenceDigestVerifiedAtObservation, true, 'withdrawal verifies owner digest at observation');
  equal(withdrawn.truth.ownerLockMutatedByWithdrawal, false, 'withdrawal truth denies lock mutation');
  equal(withdrawn.truth.generalRetirementCancellationSafetyProven, false, 'withdrawal truth denies general cancellation safety');
  equal(withdrawn.truth.holderLivenessProven, false, 'withdrawal proves no holder liveness');
  equal(fs.readFileSync(undecided.lease.leaseFile), ownerBytes, 'withdrawal preserves exact owner bytes');
  equal(fs.readdirSync(undecided.lease.retirementsDirectory).sort(), [record.decisionFile,record.intentFile].sort(), 'withdrawal retains append-only intent and decision evidence only');
  exactKeys(withdrawn, resultSchema, 'withdrawal result matches closed schema');
  exactKeys(withdrawn.retirementDecision, decisionSchema, 'withdrawal decision matches closed schema');
  exactKeys(withdrawn.truth, resultSchema.properties.truth, 'withdrawal truth matches closed schema');
  const withdrawnStatus = undecided.lease.retirementRecoveryStatus();
  equal(withdrawnStatus.state, 'CURRENT', 'withdrawn intent needs no recovery');
  equal(withdrawnStatus.reasonCode, 'WITHDRAWN_RETIREMENT_INTENTS_CURRENT', 'withdrawn status has exact reason');
  equal(withdrawnStatus.records[0].state, 'WITHDRAWN', 'withdrawn record is explicit');
  equal(withdrawnStatus.records[0].decisionState, 'WITHDRAW_RETIREMENT_INTENT', 'withdrawn record exposes decision');
  equal(withdrawnStatus.records[0].withdrawalConfirmationRequired, null, 'withdrawn record offers no second withdrawal challenge');
  const repeated = undecided.lease.withdrawRetirement(request);
  equal(repeated.state, 'ALREADY_WITHDRAWN', 'repeated exact withdrawal is idempotent observation');
  equal(fs.readdirSync(undecided.lease.retirementsDirectory).length, 2, 'repeated withdrawal adds no evidence');
  refused(() => undecided.lease.withExclusive(() => true), 'REVIEW_OPERATION_BUSY', 'withdrawal does not release the owner lock');

  const changedAfterDecision = undecidedFixture(path.join(root,'changed-after-decision'));
  const changedRecord = changedAfterDecision.lease.retirementRecoveryStatus().records[0], changedInput = withdrawalInput(changedRecord), originalChangedLink = fs.linkSync;
  let changedOwnerBytes = null;
  try {
    fs.linkSync = (stage, file) => {
      const linked = originalChangedLink(stage, file);
      if (String(file).endsWith('.decision.json')) {
        const changedOwner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 200000, acquiredAt:new Date().toISOString() };
        changedOwnerBytes = Buffer.from(JSON.stringify(changedOwner) + '\n');
        fs.writeFileSync(changedAfterDecision.lease.leaseFile, changedOwnerBytes);
      }
      return linked;
    };
    changedAfterDecision.withdrawal = capture(() => changedAfterDecision.lease.withdrawRetirement(changedInput));
  } finally { fs.linkSync = originalChangedLink; }
  equal(changedAfterDecision.withdrawal.error, null, 'durable withdrawal is not reported as failed after a later owner change');
  equal(changedAfterDecision.withdrawal.result.state, 'WITHDRAWN', 'durable withdrawal remains the winning typed decision');
  equal(changedAfterDecision.withdrawal.result.truth.ownerEvidenceDigestVerifiedAtObservation, false, 'result reports the later owner mismatch exactly');
  equal(fs.readFileSync(changedAfterDecision.lease.leaseFile), changedOwnerBytes, 'withdrawal does not rewrite the later owner bytes');
  equal(changedAfterDecision.lease.retirementRecoveryStatus().records[0].state, 'WITHDRAWN', 'later owner change does not reverse the append-only withdrawal decision');

  const duplicate = undecidedFixture(path.join(root,'duplicate'));
  const duplicateRecord = duplicate.lease.retirementRecoveryStatus().records[0], duplicateInput = withdrawalInput(duplicateRecord), originalDuplicateLink = fs.linkSync;
  let innerDuplicate = null, duplicateEntered = false;
  try {
    fs.linkSync = (stage, file) => {
      if (!duplicateEntered && String(file).endsWith('.decision.json')) { duplicateEntered = true; innerDuplicate = capture(() => duplicate.lease.withdrawRetirement(duplicateInput)); }
      return originalDuplicateLink(stage, file);
    };
    duplicate.outer = capture(() => duplicate.lease.withdrawRetirement(duplicateInput));
  } finally { fs.linkSync = originalDuplicateLink; }
  equal(duplicateEntered, true, 'duplicate withdrawals meet at exclusive decision checkpoint');
  equal(innerDuplicate.error, null, 'inner withdrawal has no raw race error');
  equal(duplicate.outer.error, null, 'outer withdrawal has no raw race error');
  equal([innerDuplicate.result.state,duplicate.outer.result.state].sort(), ['ALREADY_WITHDRAWN','WITHDRAWN'], 'duplicate withdrawals converge');
  equal(duplicate.lease.retirementRecoveryStatus().records[0].state, 'WITHDRAWN', 'duplicate withdrawal leaves one exact decision');
  equal(fs.readdirSync(duplicate.lease.retirementsDirectory).length, 2, 'duplicate withdrawal retains two evidence files');

  const withdrawalWins = undecidedFixture(path.join(root,'withdrawal-wins'));
  const withdrawalWinsRecord = withdrawalWins.lease.retirementRecoveryStatus().records[0], withdrawalWinsInput = withdrawalInput(withdrawalWinsRecord), recovery = recoveryInput(withdrawalWinsRecord), originalRecoveryLink = fs.linkSync;
  let innerWithdrawal = null, recoveryDecisionEntered = false;
  try {
    fs.linkSync = (stage, file) => {
      if (!recoveryDecisionEntered && String(file).endsWith('.decision.json')) { recoveryDecisionEntered = true; innerWithdrawal = capture(() => withdrawalWins.lease.withdrawRetirement(withdrawalWinsInput)); }
      return originalRecoveryLink(stage, file);
    };
    withdrawalWins.recovery = capture(() => withdrawalWins.lease.recoverRetirement(recovery));
  } finally { fs.linkSync = originalRecoveryLink; }
  equal(innerWithdrawal.error, null, 'withdrawal wins recovery decision without error');
  equal(innerWithdrawal.result.state, 'WITHDRAWN', 'winning withdrawal is typed');
  equal(withdrawalWins.recovery.error && withdrawalWins.recovery.error.code, 'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED', 'losing recovery is typed refusal');
  equal(fs.existsSync(withdrawalWins.lease.leaseFile), true, 'winning withdrawal preserves owner lock');
  equal(withdrawalWins.lease.retirementRecoveryStatus().records[0].state, 'WITHDRAWN', 'withdrawal win leaves withdrawn status');

  const proceedWins = undecidedFixture(path.join(root,'proceed-wins'));
  const proceedRecord = proceedWins.lease.retirementRecoveryStatus().records[0], proceedWithdrawal = withdrawalInput(proceedRecord), proceedRecovery = recoveryInput(proceedRecord), originalRename = fs.renameSync;
  let losingWithdrawal = null, renameEntered = false;
  try {
    fs.renameSync = (from, to) => {
      if (!renameEntered && path.resolve(from) === path.resolve(proceedWins.lease.leaseFile)) { renameEntered = true; losingWithdrawal = capture(() => proceedWins.lease.withdrawRetirement(proceedWithdrawal)); }
      return originalRename(from, to);
    };
    proceedWins.recovery = capture(() => proceedWins.lease.recoverRetirement(proceedRecovery));
  } finally { fs.renameSync = originalRename; }
  equal(renameEntered, true, 'proceed decision exists before owner quarantine');
  equal(losingWithdrawal.error && losingWithdrawal.error.code, 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'withdrawal loses to exact proceed decision');
  equal(proceedWins.recovery.error, null, 'winning recovery completes');
  equal(proceedWins.recovery.result.state, 'RECOVERED', 'winning recovery result is typed');
  equal(proceedWins.lease.retirementRecoveryStatus().records[0].state, 'COMPLETE', 'proceed win leaves complete retirement');
  equal(fs.readdirSync(proceedWins.lease.retirementsDirectory).length, 4, 'proceed win retains intent decision owner and result');

  const directRace = fixture(path.join(root,'direct-race')), directOwnerBytes = fs.readFileSync(directRace.lease.leaseFile), originalDirectLink = fs.linkSync;
  let directWithdrawal = null, directDecisionEntered = false;
  try {
    fs.linkSync = (stage, file) => {
      if (!directDecisionEntered && String(file).endsWith('.decision.json')) {
        directDecisionEntered = true;
        const directRecord = directRace.lease.retirementRecoveryStatus().records[0];
        directWithdrawal = capture(() => directRace.lease.withdrawRetirement(withdrawalInput(directRecord)));
      }
      return originalDirectLink(stage, file);
    };
    directRace.retirement = capture(() => directRace.lease.retireWithOperatorAssertion(retirementInput(directRace.plan)));
  } finally { fs.linkSync = originalDirectLink; }
  equal(directWithdrawal.error, null, 'withdrawal can win direct retirement decision');
  equal(directRace.retirement.error && directRace.retirement.error.code, 'REVIEW_OPERATION_RETIREMENT_REFUSED', 'direct retirement loses with typed refusal');
  equal(fs.readFileSync(directRace.lease.leaseFile), directOwnerBytes, 'direct-race withdrawal preserves owner bytes');
  equal(directRace.lease.retirementRecoveryStatus().records[0].state, 'WITHDRAWN', 'direct race leaves withdrawn intent');

  const ambiguous = undecidedFixture(path.join(root,'ambiguous'));
  const firstName = fs.readdirSync(ambiguous.lease.retirementsDirectory).find(name => name.endsWith('.intent.json'));
  const first = JSON.parse(fs.readFileSync(path.join(ambiguous.lease.retirementsDirectory,firstName),'utf8')), secondId = crypto.randomUUID();
  fs.writeFileSync(path.join(ambiguous.lease.retirementsDirectory,secondId + '.intent.json'), JSON.stringify({ ...first, retirementId:secondId }, null, 2) + '\n');
  const ambiguousStatus = ambiguous.lease.retirementRecoveryStatus();
  equal(ambiguousStatus.state, 'HELD', 'two undecided intents are ambiguous');
  check(ambiguousStatus.records.every(item => item.withdrawalConfirmationRequired), 'each ambiguous intent offers exact withdrawal challenge');
  ambiguous.lease.withdrawRetirement(withdrawalInput(ambiguousStatus.records[0]));
  const repaired = ambiguous.lease.retirementRecoveryStatus();
  equal(repaired.state, 'RECOVERY_REQUIRED', 'withdrawing one ambiguous intent restores one recovery candidate');
  equal(repaired.records.filter(item => item.state === 'WITHDRAWN').length, 1, 'ambiguity repair retains withdrawn evidence');
  equal(repaired.records.filter(item => item.state === 'RECOVERY_REQUIRED').length, 1, 'ambiguity repair retains one recovery candidate');

  const corrupt = undecidedFixture(path.join(root,'corrupt'));
  const corruptRecord = corrupt.lease.retirementRecoveryStatus().records[0];
  fs.writeFileSync(path.join(corrupt.lease.retirementsDirectory,corruptRecord.decisionFile), '{invalid decision', 'utf8');
  const corruptStatus = corrupt.lease.retirementRecoveryStatus();
  equal(corruptStatus.state, 'HELD', 'invalid decision evidence is held');
  equal(corruptStatus.records[0].reasonCode, 'RETIREMENT_DECISION_INVALID', 'invalid decision has exact reason');
  refused(() => corrupt.lease.withdrawRetirement(withdrawalInput(corruptRecord)), 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'invalid decision cannot be overwritten');

  const normal = fixture(path.join(root,'normal'));
  const retired = normal.lease.retireWithOperatorAssertion(retirementInput(normal.plan));
  const normalStatus = normal.lease.retirementRecoveryStatus(), normalRecord = normalStatus.records[0];
  equal(retired.state, 'RETIRED', 'ordinary retirement still completes');
  equal(normalRecord.state, 'COMPLETE', 'ordinary retirement evidence remains complete');
  equal(normalRecord.decisionState, 'PROCEED_RETIREMENT', 'ordinary retirement records proceed decision');
  equal(fs.readdirSync(normal.lease.retirementsDirectory).length, 4, 'ordinary retirement retains four evidence files');

  const cliFixture = undecidedFixture(path.join(root,'cli')), cliRecord = cliFixture.lease.retirementRecoveryStatus().records[0], cliInput = withdrawalInput(cliRecord);
  const wrongCli = cli(['withdraw','--state-root',cliFixture.lease.stateRoot,'--retirement-id',cliInput.retirementId,'--owner-digest',cliInput.ownerDigest,'--assertion',cliInput.assertion,'--confirmation','wrong','--reason',cliInput.reason]);
  equal(wrongCli.status, 1, 'CLI refuses wrong withdrawal confirmation');
  equal(JSON.parse(wrongCli.stderr).code, 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', 'CLI refusal is typed');
  const exactCli = cli(['withdraw','--state-root',cliFixture.lease.stateRoot,'--retirement-id',cliInput.retirementId,'--owner-digest',cliInput.ownerDigest,'--assertion',cliInput.assertion,'--confirmation',cliInput.confirmation,'--reason',cliInput.reason]);
  equal(exactCli.status, 0, 'CLI exact withdrawal succeeds');
  equal(JSON.parse(exactCli.stdout).result.state, 'WITHDRAWN', 'CLI withdrawal result is typed');

  const leaseSource = fs.readFileSync(path.join(__dirname,'review-operation-lease.js'),'utf8');
  const adminSource = fs.readFileSync(path.join(__dirname,'review-operation-lease-admin.js'),'utf8');
  const apiSource = fs.readFileSync(path.join(__dirname,'operations-api.js'),'utf8');
  const appSource = fs.readFileSync(path.join(__dirname,'../../tools/review-inbox/app.js'),'utf8');
  check(adminSource.includes("'withdraw'"), 'host-local admin CLI exposes withdrawal');
  check(!apiSource.includes('withdrawRetirement') && !appSource.includes('withdrawRetirement'), 'API and browser expose no withdrawal route');
  check(!/unlinkSync\([^)]*decision|rmSync\([^)]*decision/.test(leaseSource), 'withdrawal decision evidence has no deletion route');
  check(!leaseSource.includes('generalRetirementCancellationSafetyProven:true'), 'source never claims general cancellation safety');
  console.log('Review operation lease retirement intent withdrawal selftest: PASS (' + assertions + ' assertions, append-only withdrawal, exclusive proceed/withdraw races, ambiguity repair, no release or general cancellation claim)');
} finally { fs.rmSync(root, { recursive:true, force:true }); }
