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

const mode = process.argv[2];
if (mode === '--child-crash') {
  Lease.create({ stateRoot:process.argv[3] }).withExclusive(() => process.exit(23));
} else if (mode === '--child-hold') {
  Lease.create({ stateRoot:process.argv[3] }).withExclusive(() => {
    if (process.send) process.send('held');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1200);
  });
} else {
  (async function main() {
    let checks = 0;
    function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; }
    function check(value, label) { assert(value, label); checks += 1; }
    function digest(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
    function crash(stateRoot) {
      const result = childProcess.spawnSync(process.execPath, [__filename, '--child-crash', stateRoot], { encoding:'utf8', windowsHide:true });
      equal(result.status, 23, 'crash fixture exits inside the held lease');
    }
    function cli(args) {
      return childProcess.spawnSync(process.execPath, [path.join(__dirname, 'review-operation-lease-admin.js'), ...args], { encoding:'utf8', windowsHide:true });
    }
    function retirementInput(plan, reason) {
      return { schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason };
    }
    function refused(action, label) {
      let error = null;
      try { action(); } catch (caught) { error = caught; }
      equal(error && error.code, 'REVIEW_OPERATION_RETIREMENT_REFUSED', label);
      return error;
    }
    function waitForMessage(child, expected) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('child message timeout')), 5000);
        child.once('message', message => { clearTimeout(timer); message === expected ? resolve() : reject(new Error('unexpected child message')); });
        child.once('error', reject);
      });
    }
    function waitForExit(child) {
      return new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    }

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-operation-retirement-'));
    try {
      const schemas = [
        ['review-operation-lease-retirement-plan.schema.json', Lease.RETIREMENT_PLAN_SCHEMA],
        ['review-operation-lease-retirement-request.schema.json', Lease.RETIREMENT_REQUEST_SCHEMA],
        ['review-operation-lease-retirement-intent.schema.json', Lease.RETIREMENT_INTENT_SCHEMA],
        ['review-operation-lease-retirement-result.schema.json', Lease.RETIREMENT_RESULT_SCHEMA]
      ];
      schemas.forEach(([file, id]) => equal(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id, id, file + ' matches runtime schema'));

      const freeRoot = path.join(root, 'free'), free = Lease.create({ stateRoot:freeRoot });
      const freePlan = free.retirementPlan();
      equal(freePlan.state, 'FREE', 'free lease has no retirement candidate');
      equal(freePlan.ownerDigest, null, 'free plan exposes no owner digest');
      equal(freePlan.exactConfirmation, null, 'free plan exposes no retirement challenge');
      refused(() => free.retireWithOperatorAssertion({}), 'free lease cannot be retired');

      const activeRoot = path.join(root, 'active');
      const holder = childProcess.fork(__filename, ['--child-hold', activeRoot], { stdio:['ignore','ignore','ignore','ipc'], windowsHide:true });
      await waitForMessage(holder, 'held');
      const active = Lease.create({ stateRoot:activeRoot, processId:process.pid + 100000 });
      const activePlan = active.retirementPlan();
      equal(activePlan.state, 'RETIREMENT_REQUIRES_OPERATOR_ASSERTION', 'another-process active holder cannot be distinguished from residue');
      equal(activePlan.truth.holderTerminatedOrAbandonedProven, false, 'active plan proves no holder termination');
      equal(activePlan.truth.retirementSafetyProven, false, 'active plan proves no retirement safety');
      equal(activePlan.truth.falseAssertionCanViolateSerialization, true, 'false assertion risk is explicit');
      check(activePlan.processId === holder.pid, 'plan reports the exact owner metadata process id');
      await waitForExit(holder);
      equal(active.inspect().state, 'FREE', 'normal active holder completion still releases normally');

      const localRoot = path.join(root, 'local'), local = Lease.create({ stateRoot:localRoot });
      local.withExclusive(() => {
        const plan = local.retirementPlan();
        equal(plan.state, 'HELD_BY_CURRENT_PROCESS', 'current-process owner is refused retirement');
        equal(plan.exactConfirmation, null, 'current-process owner receives no retirement challenge');
        refused(() => local.retireWithOperatorAssertion({}), 'current-process held lease cannot be retired');
        equal(fs.existsSync(local.leaseFile), true, 'current-process refusal preserves the live lock');
      });
      equal(local.inspect().state, 'FREE', 'normal current-process release remains intact');

      const crashRoot = path.join(root, 'crash');
      crash(crashRoot);
      const crashed = Lease.create({ stateRoot:crashRoot });
      const crashedBytes = fs.readFileSync(crashed.leaseFile), crashedPlan = crashed.retirementPlan();
      equal(crashedPlan.state, 'RETIREMENT_REQUIRES_OPERATOR_ASSERTION', 'crash residue requires an explicit operator assertion');
      equal(crashedPlan.ownerDigest, digest(crashedBytes), 'retirement challenge binds exact owner bytes');
      equal(crashedPlan.ownerEvidenceValid, true, 'valid crash owner evidence stays typed');
      equal(crashedPlan.assertionRequired, Lease.RETIREMENT_ASSERTION, 'exact caller assertion is named');
      equal(crashedPlan.exactConfirmation, Lease.RETIREMENT_CONFIRMATION_PREFIX + crashedPlan.ownerDigest, 'exact confirmation binds the owner digest');
      equal(fs.existsSync(crashed.retirementsDirectory), false, 'inspection alone creates no retirement state');

      const reason = 'Operator asserts this isolated crash fixture holder has terminated.';
      const exact = retirementInput(crashedPlan, reason);
      refused(() => crashed.retireWithOperatorAssertion(Object.assign({}, exact, { assertion:'MAYBE' })), 'wrong assertion is refused');
      refused(() => crashed.retireWithOperatorAssertion(Object.assign({}, exact, { ownerDigest:digest('wrong') })), 'wrong owner digest is refused');
      refused(() => crashed.retireWithOperatorAssertion(Object.assign({}, exact, { confirmation:'RETIRE' })), 'wrong confirmation is refused');
      refused(() => crashed.retireWithOperatorAssertion(Object.assign({}, exact, { reason:'too short' })), 'short reason is refused');
      refused(() => crashed.retireWithOperatorAssertion(Object.assign({}, exact, { extra:true })), 'open retirement input is refused');
      equal(digest(fs.readFileSync(crashed.leaseFile)), crashedPlan.ownerDigest, 'all precondition refusals preserve exact owner evidence');
      equal(fs.existsSync(crashed.retirementsDirectory), false, 'precondition refusals write no retirement intent');

      const result = crashed.retireWithOperatorAssertion(exact);
      equal(result.schema, Lease.RETIREMENT_RESULT_SCHEMA, 'retirement result is typed');
      equal(result.state, 'RETIRED', 'exact asserted retirement completes');
      equal(result.ownerDigest, crashedPlan.ownerDigest, 'result binds the authorized owner digest');
      equal(result.callerAssertion, Lease.RETIREMENT_ASSERTION, 'result preserves the caller assertion');
      equal(result.reason, reason, 'result preserves the operator reason');
      equal(result.truth.ownerEvidenceQuarantined, true, 'result records quarantined owner evidence');
      equal(result.truth.holderTerminatedOrAbandonedProven, false, 'result still proves no holder termination');
      equal(result.truth.retirementSafetyProven, false, 'result still proves no retirement safety');
      equal(result.truth.automaticRetirement, false, 'retirement remains nonautomatic');
      equal(result.truth.browserRoute, false, 'retirement has no browser route');
      equal(result.truth.apiRoute, false, 'retirement has no API route');
      equal(fs.existsSync(crashed.leaseFile), false, 'retired lock path is freed');
      equal(fs.readdirSync(crashed.retirementsDirectory).sort(), [result.intentFile, result.retirementId + '.decision.json', result.quarantinedOwnerEvidenceFile, result.resultFile].sort(), 'intent decision raw evidence and result are retained');
      equal(digest(fs.readFileSync(path.join(crashed.retirementsDirectory, result.quarantinedOwnerEvidenceFile))), crashedPlan.ownerDigest, 'quarantined bytes match the authorized digest');
      const intent = JSON.parse(fs.readFileSync(path.join(crashed.retirementsDirectory, result.intentFile), 'utf8'));
      equal(intent.state, 'AUTHORIZED_PENDING_RETIREMENT', 'durable intent precedes retirement');
      equal(intent.truth.ownerEvidenceQuarantined, false, 'intent does not pretend quarantine already happened');
      equal(JSON.parse(fs.readFileSync(path.join(crashed.retirementsDirectory, result.resultFile), 'utf8')), result, 'durable result matches returned result');

      const reopened = Review.create({ stateRoot:crashRoot });
      reopened.submit({ sourceRef:'after-explicit-retirement', artifactDigest:digest('after-explicit-retirement').slice(7) });
      equal(reopened.list().length, 1, 'fresh ReviewService can mutate after explicit retirement');
      equal(Lease.create({ stateRoot:crashRoot }).retirementPlan().state, 'FREE', 'fresh process view sees the lock path free');
      equal(fs.readdirSync(crashed.retirementsDirectory).length, 4, 'restart and later mutation preserve retirement evidence');

      const collisionRoot = path.join(root, 'collision');
      crash(collisionRoot);
      const collision = Lease.create({ stateRoot:collisionRoot }), collisionPlan = collision.retirementPlan();
      const fixedRetirementId = '12345678-1234-4123-8123-123456789abc';
      fs.mkdirSync(collision.retirementsDirectory, { recursive:true });
      const existingIntent = path.join(collision.retirementsDirectory, fixedRetirementId + '.intent.json');
      fs.writeFileSync(existingIntent, 'preexisting retirement evidence', 'utf8');
      const originalRandomUUID = crypto.randomUUID;
      let collisionError = null;
      try {
        crypto.randomUUID = () => fixedRetirementId;
        collision.retireWithOperatorAssertion(retirementInput(collisionPlan, reason));
      } catch (error) { collisionError = error; }
      finally { crypto.randomUUID = originalRandomUUID; }
      equal(collisionError && collisionError.code, 'EEXIST', 'exclusive retirement intent collision is refused');
      equal(fs.readFileSync(existingIntent, 'utf8'), 'preexisting retirement evidence', 'intent collision never deletes preexisting evidence');
      equal(fs.existsSync(collision.leaseFile), true, 'intent collision leaves the owner lock held');

      const changedRoot = path.join(root, 'changed');
      crash(changedRoot);
      const changed = Lease.create({ stateRoot:changedRoot }), stalePlan = changed.retirementPlan();
      fs.appendFileSync(changed.leaseFile, 'altered', 'utf8');
      refused(() => changed.retireWithOperatorAssertion(retirementInput(stalePlan, reason)), 'changed owner evidence invalidates the earlier challenge');
      equal(fs.readFileSync(changed.leaseFile, 'utf8').endsWith('altered'), true, 'changed evidence remains held');
      equal(fs.existsSync(changed.retirementsDirectory), false, 'stale challenge writes no intent');

      const invalidRoot = path.join(root, 'invalid'), invalid = Lease.create({ stateRoot:invalidRoot });
      fs.mkdirSync(path.dirname(invalid.leaseFile), { recursive:true });
      fs.writeFileSync(invalid.leaseFile, '{invalid owner evidence', 'utf8');
      const invalidPlan = invalid.retirementPlan();
      equal(invalidPlan.reasonCode, 'INVALID_OWNER_EVIDENCE_REQUIRES_ASSERTION', 'invalid evidence receives an exact local retirement challenge');
      equal(invalidPlan.ownerEvidenceValid, false, 'invalid owner evidence is not relabelled valid');
      const invalidResult = invalid.retireWithOperatorAssertion(retirementInput(invalidPlan, 'Operator quarantines exact invalid owner evidence after inspection.'));
      equal(invalidResult.ownerEvidenceValid, false, 'invalid evidence remains labelled invalid in the result');
      equal(fs.readFileSync(path.join(invalid.retirementsDirectory, invalidResult.quarantinedOwnerEvidenceFile), 'utf8'), '{invalid owner evidence', 'invalid raw evidence is preserved exactly');

      const cliRoot = path.join(root, 'cli');
      crash(cliRoot);
      const inspectResult = cli(['inspect','--state-root',cliRoot]);
      equal(inspectResult.status, 0, 'host-local CLI inspect succeeds');
      const cliPlan = JSON.parse(inspectResult.stdout).result;
      equal(cliPlan.state, 'RETIREMENT_REQUIRES_OPERATOR_ASSERTION', 'CLI inspect returns the exact assertion plan');
      const refusedCli = cli(['retire','--state-root',cliRoot,'--owner-digest',cliPlan.ownerDigest,'--assertion',Lease.RETIREMENT_ASSERTION,'--reason',reason,'--confirmation','wrong']);
      equal(refusedCli.status, 1, 'CLI refuses a wrong confirmation');
      equal(JSON.parse(refusedCli.stderr).code, 'REVIEW_OPERATION_RETIREMENT_REFUSED', 'CLI refusal is typed');
      equal(fs.existsSync(Lease.create({ stateRoot:cliRoot }).leaseFile), true, 'CLI refusal preserves the lock');
      const retiredCli = cli(['retire','--state-root',cliRoot,'--owner-digest',cliPlan.ownerDigest,'--assertion',Lease.RETIREMENT_ASSERTION,'--reason',reason,'--confirmation',cliPlan.exactConfirmation]);
      equal(retiredCli.status, 0, 'CLI exact retirement succeeds');
      equal(JSON.parse(retiredCli.stdout).result.state, 'RETIRED', 'CLI returns the typed retirement result');

      const planSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-operation-lease-retirement-plan.schema.json'), 'utf8'));
      equal(Object.keys(crashedPlan.truth).sort(), planSchema.$defs.truth.required.slice().sort(), 'runtime retirement truth matches the closed schema');
      const leaseSource = fs.readFileSync(path.join(__dirname, 'review-operation-lease.js'), 'utf8');
      const adminSource = fs.readFileSync(path.join(__dirname, 'review-operation-lease-admin.js'), 'utf8');
      const apiSource = fs.readFileSync(path.join(__dirname, 'operations-api.js'), 'utf8');
      const appSource = fs.readFileSync(path.join(__dirname, '../../tools/review-inbox/app.js'), 'utf8');
      check(!/process\.kill|kill\s*\(|stale.{0,30}(unlink|rename)|Date\.now\(\).{0,80}(retire|rename|unlink)/i.test(leaseSource), 'retirement uses no pid probe or age-based stale inference');
      check(leaseSource.includes('fs.renameSync(leaseFile, evidenceFile)'), 'exact owner evidence is quarantined rather than deleted');
      check(adminSource.includes("if (!values['state-root'])"), 'CLI requires an explicit state root');
      check(!apiSource.includes('review-operation-lease-admin') && !/operation-lease\/(retire|recover|unlock)/i.test(apiSource), 'operations API exposes no retirement route');
      check(!/(retire|recover|unlock).{0,30}operation lease/i.test(appSource), 'browser UI exposes no retirement control');

      console.log('Review operation lease retirement selftest: PASS (' + checks + ' assertions, exact challenge, assertion-bound intent, raw evidence quarantine, restart continuity, no automatic/API/browser route)');
    } finally {
      fs.rmSync(root, { recursive:true, force:true });
    }
  })().catch(error => { console.error(error.stack || error); process.exit(1); });
}
