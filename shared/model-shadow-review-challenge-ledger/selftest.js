#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Ledger = require('./model-shadow-review-challenge-ledger');
const Fixture = require('./selftest-fixture');
const SignedReview = require('../model-shadow-signed-review-evidence/model-shadow-signed-review-evidence');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throwsCode(fn, code, label) {
  assert.throws(fn, error => error && error.code === code);
  checks += 1;
  console.log('PASS ' + label);
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }

const childPath = path.join(__dirname, 'selftest-child.js');

function writeRequest(tempRoot, name, request) {
  const requestPath = path.join(tempRoot, name + '.json');
  fs.writeFileSync(requestPath, JSON.stringify(request), { encoding: 'utf8', mode: 0o600 });
  return requestPath;
}

function parseChild(result) {
  const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
}

function runChild(requestPath, stateRoot, ledgerId) {
  const result = childProcess.spawnSync(process.execPath, [childPath, requestPath, stateRoot, ledgerId], {
    encoding: 'utf8',
    windowsHide: true
  });
  return { status: result.status, signal: result.signal, output: parseChild(result), stderr: result.stderr };
}

function runChildAsync(requestPath, stateRoot, ledgerId) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [childPath, requestPath, stateRoot, ledgerId], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', (status, signal) => resolve({ status, signal, output: parseChild({ stdout }), stderr }));
  });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-challenge-ledger-'));
  try {
    const stateRoot = path.join(tempRoot, 'state-a');
    const secondStateRoot = path.join(tempRoot, 'state-b');
    fs.mkdirSync(stateRoot);
    fs.mkdirSync(secondStateRoot);
    const ledgerId = 'ledger:challenge-selftest-a';
    const request = Fixture.buildRequest('restart');
    const requestPath = writeRequest(tempRoot, 'restart-request', request);

    check(SignedReview.verifyReceipt(request.signedReviewInput, request.signedReviewReceipt).pass, 'upstream signed review receipt verifies before persistence');
    equal(request.signedReviewReceipt.truth.challengeSingleUseProven, false, 'upstream stateless receipt does not claim replay prevention');

    const noConfirmation = copy(request);
    noConfirmation.confirmation = 'CONSUME';
    const preflight = Ledger.createService({ stateRoot, ledgerId });
    throwsCode(() => preflight.consume(noConfirmation), 'CONFIRMATION_REQUIRED', 'write is refused without the exact explicit confirmation');
    equal(fs.existsSync(path.join(stateRoot, Ledger.NAMESPACE)), false, 'failed confirmation performs no namespace write');

    throwsCode(
      () => Ledger.createService({ stateRoot: path.parse(stateRoot).root, ledgerId }),
      'STATE_ROOT_INVALID',
      'filesystem root is refused as state root'
    );
    const missingRoot = path.join(tempRoot, 'missing-root');
    throwsCode(
      () => Ledger.createService({ stateRoot: missingRoot, ledgerId }),
      'STATE_ROOT_INVALID',
      'missing state root is refused rather than created implicitly'
    );
    const fileRoot = path.join(tempRoot, 'not-a-directory');
    fs.writeFileSync(fileRoot, 'file');
    throwsCode(
      () => Ledger.createService({ stateRoot: fileRoot, ledgerId }),
      'STATE_ROOT_INVALID',
      'non-directory state root is refused'
    );

    const first = runChild(requestPath, stateRoot, ledgerId);
    equal(first.status, 0, 'first fresh process wins exclusive challenge creation');
    check(first.output && first.output.ok === true, 'first fresh process returns a bounded receipt');
    const receipt = first.output.receipt;
    equal(receipt.state, 'CHALLENGE_REPLAY_REFUSED_WHILE_CALLER_LEDGER_STATE_IS_PRESERVED_EXECUTION_NOT_AUTHORIZED', 'receipt reports state-preserving replay refusal without execution authority');
    equal(receipt.truth.challengeReplayRefusedWhileLedgerStatePreserved, true, 'receipt bounds replay refusal to preserved ledger state');
    equal(receipt.truth.ledgerDeletionOrRollbackResistanceProven, false, 'caller-owned files do not prove deletion or rollback resistance');
    equal(receipt.truth.challengeGloballySingleUseProven, false, 'receipt refuses global single-use claim');
    equal(receipt.truth.ledgerAuthorityAuthenticated, false, 'caller ledger id is not treated as authenticated authority');
    equal(receipt.truth.hostAuthorizationAuthenticated, false, 'state write does not authenticate host authorization');
    equal(receipt.truth.actualHumanParticipationProven, false, 'synthetic fixture does not prove human participation');
    equal(receipt.truth.executionAuthorized, false, 'challenge consumption grants no execution authority');
    equal(receipt.truth.adoptionAuthorized, false, 'challenge consumption grants no adoption authority');
    equal(receipt.truth.entryFileFsyncCompleted, true, 'returned receipt is emitted only after file fsync success');
    equal(receipt.truth.ledgerManifestVerified, true, 'returned receipt binds the immutable ledger manifest');
    check(Ledger.verifyReceipt(request, ledgerId, receipt).pass, 'consumption receipt verifies by exact rebuild');

    const serialized = SignedReview.stableStringify(receipt);
    check(!serialized.includes('fixture-human'), 'persisted receipt retains no raw Review Inbox actor string');
    check(!serialized.includes('Synthetic fixture note'), 'persisted receipt retains no Review Inbox vote note');
    check(!serialized.includes('BEGIN PUBLIC KEY'), 'persisted receipt retains no raw public key');
    check(!serialized.includes(request.signedReviewInput.signedAttestations[0].signature), 'persisted receipt retains no raw signature');
    check(!serialized.includes(tempRoot), 'persisted receipt retains no machine state-root path');

    const reloaded = Ledger.createService({ stateRoot, ledgerId });
    const inspected = reloaded.inspect(receipt.challengeRef.sha256);
    equal(inspected.receiptDigest, receipt.receiptDigest, 'new service instance reloads exact persisted receipt');
    check(reloaded.verifyPersisted(request, receipt).pass, 'new service instance verifies exact receipt against persisted state');

    const replay = runChild(requestPath, stateRoot, ledgerId);
    equal(replay.status, 17, 'second fresh process receives typed replay refusal');
    equal(replay.output.code, 'CHALLENGE_ALREADY_CONSUMED', 'fresh-process replay refusal has exact error code');
    const entriesPath = path.join(stateRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY);
    equal(fs.readdirSync(entriesPath).length, 1, 'replay creates no second entry');
    const manifestPath = path.join(stateRoot, Ledger.NAMESPACE, Ledger.MANIFEST_FILE);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    equal(manifest.ledgerId, ledgerId, 'immutable manifest binds ledger id to caller state root');
    equal(manifest.schema, Ledger.MANIFEST_SCHEMA, 'persisted manifest has exact schema identity');
    const conflictingRequest = Fixture.buildRequest('conflicting-ledger-id');
    throwsCode(
      () => Ledger.createService({ stateRoot, ledgerId: 'ledger:conflicting-id' }).consume(conflictingRequest),
      'LEDGER_ID_MISMATCH',
      'one state root refuses a conflicting ledger id'
    );
    equal(fs.readdirSync(entriesPath).length, 1, 'conflicting ledger id performs no entry write');

    const otherLedger = Ledger.createService({ stateRoot: secondStateRoot, ledgerId: 'ledger:challenge-selftest-b' });
    const otherReceipt = otherLedger.consume(request);
    equal(otherReceipt.challengeRef.sha256, receipt.challengeRef.sha256, 'same challenge can be consumed in a different caller state root');
    equal(otherReceipt.truth.challengeGloballySingleUseProven, false, 'different-root demonstration keeps global single-use false');
    const secondManifestPath = path.join(secondStateRoot, Ledger.NAMESPACE, Ledger.MANIFEST_FILE);
    fs.unlinkSync(secondManifestPath);
    const missingManifestRequest = Fixture.buildRequest('missing-manifest');
    throwsCode(
      () => Ledger.createService({ stateRoot: secondStateRoot, ledgerId: 'ledger:challenge-selftest-b' }).consume(missingManifestRequest),
      'LEDGER_MANIFEST_MISSING',
      'missing manifest with existing ledger state fails closed instead of rebinding'
    );
    equal(fs.existsSync(secondManifestPath), false, 'missing existing-state manifest is not silently recreated');
    const secondNamespace = path.resolve(secondStateRoot, Ledger.NAMESPACE);
    check(secondNamespace.startsWith(path.resolve(tempRoot) + path.sep), 'temporary deletion target is verified inside the selftest root');
    fs.rmSync(secondNamespace, { recursive: true, force: true });
    const reopenedReceipt = Ledger.createService({
      stateRoot: secondStateRoot,
      ledgerId: 'ledger:challenge-selftest-b'
    }).consume(request);
    equal(reopenedReceipt.challengeRef.sha256, receipt.challengeRef.sha256, 'deleting caller-owned ledger state demonstrably reopens the same challenge');
    equal(reopenedReceipt.truth.ledgerDeletionOrRollbackResistanceProven, false, 'deletion demonstration preserves the protected-state limitation');

    const concurrentRequest = Fixture.buildRequest('concurrent');
    const concurrentPath = writeRequest(tempRoot, 'concurrent-request', concurrentRequest);
    const contenders = await Promise.all([
      runChildAsync(concurrentPath, stateRoot, ledgerId),
      runChildAsync(concurrentPath, stateRoot, ledgerId)
    ]);
    const winners = contenders.filter(result => result.status === 0);
    const replayLosers = contenders.filter(result => result.status === 17 && result.output && result.output.code === 'CHALLENGE_ALREADY_CONSUMED');
    equal(winners.length, 1, 'two concurrent processes produce exactly one exclusive-create winner');
    equal(replayLosers.length, 1, 'two concurrent processes produce exactly one typed replay loser');
    equal(fs.readdirSync(entriesPath).length, 2, 'concurrent contention leaves one entry for the second challenge');

    const corruptRequest = Fixture.buildRequest('corrupt');
    const corruptReceipt = reloaded.consume(corruptRequest);
    const corruptName = corruptReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json';
    const corruptPath = path.join(entriesPath, corruptName);
    fs.writeFileSync(corruptPath, '{"truncated":');
    throwsCode(
      () => Ledger.createService({ stateRoot, ledgerId }).inspect(corruptReceipt.challengeRef.sha256),
      'CHALLENGE_ENTRY_CORRUPT',
      'corrupt persisted entry fails closed on fresh reload'
    );
    throwsCode(
      () => Ledger.createService({ stateRoot, ledgerId }).consume(corruptRequest),
      'CHALLENGE_ENTRY_CORRUPT',
      'corrupt persisted entry is never treated as an unused challenge'
    );
    check(fs.existsSync(corruptPath), 'corrupt fail-closed entry is retained for steward inspection');

    const boundaryRequest = Fixture.buildRequest('boundary-tamper');
    const boundaryReceipt = reloaded.consume(boundaryRequest);
    const boundaryPath = path.join(
      entriesPath,
      boundaryReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json'
    );
    const boundaryTamper = copy(boundaryReceipt);
    boundaryTamper.truth.executionAuthorized = true;
    const boundaryPayload = copy(boundaryTamper);
    delete boundaryPayload.receiptDigest;
    boundaryTamper.receiptDigest = SignedReview.sha256(boundaryPayload);
    fs.writeFileSync(boundaryPath, SignedReview.stableStringify(boundaryTamper) + '\n');
    throwsCode(
      () => Ledger.createService({ stateRoot, ledgerId }).inspect(boundaryReceipt.challengeRef.sha256),
      'CHALLENGE_ENTRY_CORRUPT',
      'stored truth-boundary tamper fails closed even with a recomputed digest'
    );

    const signedTamper = copy(Fixture.buildRequest('tampered-upstream'));
    signedTamper.signedReviewReceipt.truth.executionAuthorized = true;
    const countBeforeTamper = fs.readdirSync(entriesPath).length;
    throwsCode(() => reloaded.consume(signedTamper), 'SIGNED_REVIEW_INVALID', 'tampered upstream signed receipt is refused');
    equal(fs.readdirSync(entriesPath).length, countBeforeTamper, 'invalid upstream receipt performs no entry write');

    const receiptTamper = copy(receipt);
    receiptTamper.truth.executionAuthorized = true;
    equal(Ledger.verifyReceipt(request, ledgerId, receiptTamper).pass, false, 'consumption receipt authority tampering is detected');
    const unknownInput = Object.assign({}, request, { surprise: true });
    throwsCode(() => reloaded.consume(unknownInput), 'INVALID_INPUT', 'unknown consumption input field is refused');

    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-consumption.schema.json'), 'utf8'));
    const manifestSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-ledger-manifest.schema.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(schema.$id, Ledger.RECEIPT_SCHEMA, 'consumption schema identity matches implementation');
    equal(schema.properties.status.const, 'TEST', 'consumption schema retains TEST status');
    equal(manifestSchema.$id, Ledger.MANIFEST_SCHEMA, 'ledger manifest schema identity matches implementation');
    check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST and claims no host permission integration');
    equal(contract.boundaries.writes.length, 2, 'contract declares its two fixed state-write patterns');
    check(contract.boundaries.refuses.includes('caller-ledger-single-use-as-global-single-use'), 'contract refuses local replay protection as global protection');
    check(contract.boundaries.refuses.includes('consumption-as-execution-authority'), 'contract refuses challenge consumption as execution authority');
    check(contract.boundaries.refuses.includes('corrupt-entry-as-absent-challenge'), 'contract declares corruption fail-closed boundary');
    check(contract.boundaries.refuses.includes('missing-ledger-manifest-with-existing-state-as-new-ledger'), 'contract refuses manifest deletion as fresh initialization');
    check(contract.boundaries.refuses.includes('explicit-confirmation-as-host-authorization') && contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract keeps confirmation separate from host authorization and remains uninstalled and unpromoted');

    console.log('\nModel Shadow review challenge ledger selftest: PASS (' + checks + ' checks)');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
