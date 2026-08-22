#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const Pairwise = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const PairwiseFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest-fixture');
const Ledger = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throwsCode(action, code, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught, label + ' should throw');
  assert.strictEqual(caught.code, code, label + ' code');
  checks += 2;
  console.log('PASS ' + label);
}
function copy(value) { return Fixture.copy(value); }

function makeDir(parent, name) {
  const result = path.join(parent, name);
  fs.mkdirSync(result);
  return result;
}

function writePackage(parent, name, value) {
  const result = path.join(parent, name + '.json');
  fs.writeFileSync(result, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return result;
}

function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  });
  const parsed = JSON.parse(result.stdout || '{}');
  return { status: result.status, parsed, stderr: result.stderr };
}

function runChildAsync(packagePath) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, parsed: JSON.parse(stdout || '{}'), stderr }));
  });
}

function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe test cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-transition-ledger-'));
  let cleanupVerified = false;
  try {
    const scenario = Fixture.buildScenario(tempRoot);
    const ledgerRoot = makeDir(tempRoot, 'primary-ledger');
    const logId = 'local-possession-transition-log:primary';
    const genesisRef = Fixture.separatedRef(scenario.baseChain);
    const options = Fixture.serviceOptions(scenario.state, scenario.sourceRoot, ledgerRoot, logId, genesisRef);
    const service = Ledger.createService(copy(options));
    const firstInput = Fixture.recordInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'first');

    equal(Ledger.VERSION, '1.9.0', 'version is exact');
    equal(Ledger.STATUS, 'TEST', 'status remains TEST');
    equal(Ledger.CONFIRMATION, 'RECORD EXACT CURRENT LOCAL POSSESSION TRANSITION ONCE', 'confirmation phrase is exact');
    equal(Ledger.MAX_ARTIFACT_CANONICAL_BYTES, 1048576, 'artifact byte bound is exact');
    ['entry', 'manifest', 'snapshot'].forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-' + name + '.schema.json'), 'utf8'));
      equal(schema.type, 'object', name + ' schema is valid JSON object schema');
      equal(schema.additionalProperties, false, name + ' schema rejects unknown top-level fields');
    });
    equal(service.inspect(), null, 'inspection is read-only when ledger namespace is absent');

    const noConfirmation = copy(firstInput);
    noConfirmation.confirmation = 'RECORD';
    throwsCode(() => service.record(noConfirmation), 'CONFIRMATION_REQUIRED', 'write is refused without exact confirmation');
    equal(fs.existsSync(path.join(ledgerRoot, Ledger.NAMESPACE)), false, 'failed confirmation creates no ledger namespace');
    throwsCode(() => Ledger.createService(Object.assign(copy(options), { stateRoot: path.parse(ledgerRoot).root })), 'STATE_ROOT_INVALID', 'filesystem root is refused as ledger state root');

    const first = service.record(firstInput);
    equal(first.entry.schema, Ledger.ENTRY_SCHEMA, 'first persisted entry schema is exact');
    equal(first.entry.status, 'TEST', 'first persisted entry remains TEST');
    equal(first.entry.log.sequence, 1, 'first persisted entry has sequence one');
    equal(first.entry.transitionReceipt.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN', 'first entry retains exact v1.8 forward extension');
    equal(first.entry.candidateCurrentnessAuditReceipt.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'first entry retains exact pre-write candidate source match');
    equal(first.entry.capturedSnapshotRef.sha256, first.currentnessEvidence.currentSnapshot.snapshotDigest, 'first entry binds captured snapshot digest');
    equal(first.entry.previousSeparatedWitnessRef, genesisRef, 'first entry extends exact configured genesis');
    equal(first.entry.candidateSeparatedWitnessRef, Fixture.separatedRef(scenario.secondChain), 'first entry advances to exact candidate separated witness');
    equal(first.entry.truth.candidateSourceStateCapturedBeforeWrite, true, 'entry reports pre-write source capture');
    equal(first.entry.truth.sourceCaptureAndLedgerAppendAtomic, false, 'entry refuses atomic source/ledger claim');
    equal(first.entry.truth.candidateStillCurrentAfterWriteProven, false, 'entry refuses later-currentness claim');
    equal(first.entry.truth.globalTransitionUniquenessProven, false, 'entry refuses global uniqueness claim');
    equal(first.entry.truth.hostAuthorizationAuthenticated, false, 'confirmation does not authenticate host authority');
    equal(first.entry.truth.executionAuthorized, false, 'recording grants no execution authority');
    equal(first.entry.truth.adoptionAuthorized, false, 'recording grants no adoption authority');
    equal(first.entry.truth.automaticCanon, false, 'recording grants no CANON authority');
    equal(first.entry.truth.humanBenefitProven, false, 'recording invents no human benefit');
    const firstVerification = service.verifyPersisted(firstInput, first.currentnessEvidence, first.entry);
    if (!firstVerification.pass) console.log('DIAGNOSTIC first persisted verification: ' + firstVerification.errors.join('; '));
    equal(firstVerification.pass, true, 'caller package exact-rebuilds first persisted entry');

    const storedText = fs.readFileSync(path.join(ledgerRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000001.json'), 'utf8');
    equal(storedText.includes('BEGIN PUBLIC KEY'), false, 'persisted entry contains no raw public key');
    equal(storedText.includes('"signature"'), false, 'persisted entry contains no raw signature');
    equal(storedText.includes(scenario.sourceRoot), false, 'persisted entry contains no source state path');
    const firstSnapshot = service.inspect();
    equal(firstSnapshot.entryCount, 1, 'inspection reloads one entry');
    equal(firstSnapshot.currentHeadSeparatedWitnessRef, Fixture.separatedRef(scenario.secondChain), 'inspection derives first local head');
    equal(firstSnapshot.truth.currentSourceStateRecapturedOnInspect, false, 'inspection does not imply live source recapture');

    const repeat = copy(firstInput);
    repeat.entryId = 'local-possession-transition-ledger-entry:first-repeat';
    repeat.observationId = 'local-possession-transition-ledger-observation:first-repeat';
    repeat.auditId = 'local-possession-transition-ledger-audit:first-repeat';
    throwsCode(() => service.record(repeat), 'STALE_LOCAL_HEAD', 'previously accepted branch cannot advance the later local head again');
    equal(service.inspect().entryCount, 1, 'stale-head refusal preserves one entry');

    const thirdChallenge = StateFixture.issueChallenge(scenario.state, 0x53, {
      issuedAt: '2026-08-20T15:35:00.000Z', expiresAt: '2026-08-20T15:55:00.000Z'
    });
    const third = StateFixture.answer(scenario.state, thirdChallenge, '2026-08-20T15:35:30.000Z');
    const thirdSnapshot = Continuity.captureState(StateFixture.observationOptions(scenario.state, 'local-possession-observation:transition-ledger-third', '2026-08-20T15:36:00.000Z'));
    const thirdCheckpoint = Fixture.checkpoint(thirdSnapshot, 'local-possession-checkpoint:transition-ledger-third', '2026-08-20T15:36:30.000Z');
    const thirdChain = PairwiseFixture.buildSeparatedChain(thirdCheckpoint, 'transition-ledger-third', scenario.authority, { minute: 37 });
    const secondTransitionInput = PairwiseFixture.transitionInput(scenario.secondChain, thirdChain, 'transition-ledger-second', '2026-08-20T15:41:00.000Z');
    const secondTransitionReceipt = Pairwise.buildTransition(secondTransitionInput);
    const secondInput = Fixture.recordInput(secondTransitionInput, secondTransitionReceipt, 'second', {
      observedAt: '2026-08-20T15:42:00.000Z', checkedAt: '2026-08-20T15:42:30.000Z', recordedAt: '2026-08-20T15:43:00.000Z'
    });

    const extensionRoot = makeDir(tempRoot, 'extension-refusal-ledger');
    const extensionService = Ledger.createService(Fixture.serviceOptions(scenario.state, scenario.sourceRoot, extensionRoot, 'local-possession-transition-log:extension-refusal', genesisRef));
    const extensionInput = Fixture.recordInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'extension-refusal', {
      observedAt: '2026-08-20T15:42:00.000Z', checkedAt: '2026-08-20T15:42:30.000Z', recordedAt: '2026-08-20T15:43:00.000Z'
    });
    throwsCode(() => extensionService.record(extensionInput), 'CANDIDATE_NOT_CURRENT_EXACT_MATCH', 'source extension beyond candidate checkpoint is refused');
    equal(fs.existsSync(path.join(extensionRoot, Ledger.NAMESPACE)), false, 'currentness refusal occurs before ledger namespace write');

    const thirdPath = path.join(scenario.answersDir, third.responseFileName);
    const thirdBytes = fs.readFileSync(thirdPath);
    fs.unlinkSync(thirdPath);
    const rollbackRoot = makeDir(tempRoot, 'rollback-refusal-ledger');
    const rollbackService = Ledger.createService(Fixture.serviceOptions(scenario.state, scenario.sourceRoot, rollbackRoot, 'local-possession-transition-log:rollback-refusal', Fixture.separatedRef(scenario.secondChain)));
    throwsCode(() => rollbackService.record(secondInput), 'CANDIDATE_NOT_CURRENT_EXACT_MATCH', 'source rollback relative to candidate checkpoint is refused');
    equal(fs.existsSync(path.join(rollbackRoot, Ledger.NAMESPACE)), false, 'rollback refusal occurs before ledger namespace write');
    fs.writeFileSync(thirdPath, thirdBytes);

    const second = service.record(secondInput);
    equal(second.entry.log.sequence, 2, 'second current transition advances sequence two');
    equal(second.entry.previousEntryRef.sha256, first.entry.entryDigest, 'second entry binds first entry digest');
    equal(second.entry.previousSeparatedWitnessRef, Fixture.separatedRef(scenario.secondChain), 'second entry starts at exact first head');
    equal(second.entry.candidateSeparatedWitnessRef, Fixture.separatedRef(thirdChain), 'second entry advances to exact third chain');
    equal(service.inspect().entryCount, 2, 'inspection validates two-entry digest chain');
    equal(service.verifyPersisted(secondInput, second.currentnessEvidence, second.entry).pass, true, 'caller package exact-rebuilds second persisted entry');

    const wrongEvidence = copy(second.currentnessEvidence);
    wrongEvidence.currentSnapshot.observationId += ':tampered';
    equal(service.verifyPersisted(secondInput, wrongEvidence, second.entry).pass, false, 'tampered caller currentness evidence fails exact rebuild');
    const wrongEntry = copy(second.entry);
    wrongEntry.truth.executionAuthorized = true;
    equal(service.verifyPersisted(secondInput, second.currentnessEvidence, wrongEntry).pass, false, 'tampered presented entry truth fails exact rebuild');
    const contextOptions = copy(options);
    contextOptions.logId = 'local-possession-transition-log:wrong';
    throwsCode(() => Ledger.createService(contextOptions).inspect(), 'LOG_ID_MISMATCH', 'existing ledger refuses a different log id');
    const wrongPolicy = copy(options);
    wrongPolicy.receiverPolicy.policyDigest = 'sha256:' + '0'.repeat(64);
    throwsCode(() => Ledger.createService(wrongPolicy).inspect(), 'SOURCE_CONTEXT_MISMATCH', 'existing ledger refuses a different configured policy reference');

    const freshPath = writePackage(tempRoot, 'fresh-inspect', { action: 'inspect', options, input: secondInput, evidence: second.currentnessEvidence, entry: second.entry });
    const fresh = runChild(freshPath);
    equal(fresh.status, 0, 'fresh process reloads local transition ledger');
    check(fresh.parsed.pid !== process.pid, 'fresh reload uses distinct process');
    equal(fresh.parsed.snapshot.entryCount, 2, 'fresh process validates two entries');
    equal(fresh.parsed.verification.pass, true, 'fresh process exact-rebuilds persisted entry from caller package');

    const forkParent = makeDir(tempRoot, 'fork-fixture');
    const forkScenario = Fixture.buildScenario(forkParent);
    const forkBSource = path.join(tempRoot, 'fork-b-source');
    fs.cpSync(forkScenario.sourceRoot, forkBSource, { recursive: true });
    const forkBAnswers = path.join(forkBSource, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY);
    fs.unlinkSync(path.join(forkBAnswers, forkScenario.second.responseFileName));
    const forkBReceiver = Possession.createReceiver(Object.assign(copy(forkScenario.state.possession.receiverOptions), { stateRoot: forkBSource }));
    const forkBChallenge = StateFixture.issueChallenge(forkScenario.state, 0x62, {
      issuedAt: '2026-08-20T15:26:00.000Z', expiresAt: '2026-08-20T15:46:00.000Z'
    });
    forkBReceiver.answer(Object.assign(copy(forkScenario.state.possession.answerInput), { challenge: copy(forkBChallenge), answeredAt: '2026-08-20T15:26:30.000Z' }));
    const forkBSnapshot = Continuity.captureState(Object.assign(StateFixture.observationOptions(forkScenario.state, 'local-possession-observation:fork-b', '2026-08-20T15:27:00.000Z'), { stateRoot: forkBSource }));
    const forkBCheckpoint = Fixture.checkpoint(forkBSnapshot, 'local-possession-checkpoint:fork-b', '2026-08-20T15:27:30.000Z');
    const forkBChain = PairwiseFixture.buildSeparatedChain(forkBCheckpoint, 'transition-ledger-fork-b', forkScenario.authority, { minute: 28 });
    const forkBTransitionInput = PairwiseFixture.transitionInput(forkScenario.baseChain, forkBChain, 'transition-ledger-fork-b', '2026-08-20T15:31:00.000Z');
    const forkBTransitionReceipt = Pairwise.buildTransition(forkBTransitionInput);
    const independentA = makeDir(tempRoot, 'independent-ledger-a');
    const independentB = makeDir(tempRoot, 'independent-ledger-b');
    const forkGenesis = Fixture.separatedRef(forkScenario.baseChain);
    const forkAResult = Ledger.createService(Fixture.serviceOptions(forkScenario.state, forkScenario.sourceRoot, independentA, 'local-possession-transition-log:independent', forkGenesis)).record(Fixture.recordInput(forkScenario.firstTransitionInput, forkScenario.firstTransitionReceipt, 'fork-a'));
    const forkBResult = Ledger.createService(Fixture.serviceOptions(forkScenario.state, forkBSource, independentB, 'local-possession-transition-log:independent', forkGenesis)).record(Fixture.recordInput(forkBTransitionInput, forkBTransitionReceipt, 'fork-b'));
    check(forkAResult.entry.candidateSeparatedWitnessRef.sha256 !== forkBResult.entry.candidateSeparatedWitnessRef.sha256, 'independent roots can accept divergent candidate branches');
    equal(forkAResult.entry.truth.independentStateRootsExcluded, false, 'entry truth preserves independent-root counterexample');
    equal(forkBResult.entry.truth.globalTransitionUniquenessProven, false, 'divergent root claims no global uniqueness');

    const deletedNamespace = path.join(independentA, Ledger.NAMESPACE);
    verifiedRemove(deletedNamespace, independentA);
    equal(fs.existsSync(deletedNamespace), false, 'local ledger namespace deletion is observable in test');
    const reopened = Ledger.createService(Fixture.serviceOptions(forkScenario.state, forkScenario.sourceRoot, independentA, 'local-possession-transition-log:independent', forkGenesis)).record(Fixture.recordInput(forkScenario.firstTransitionInput, forkScenario.firstTransitionReceipt, 'fork-a'));
    equal(reopened.entry.log.sequence, 1, 'deleting the local root reopens sequence one');
    equal(reopened.entry.truth.deletionOrRollbackPrevented, false, 'reopened entry claims no deletion prevention');

    const corruptPath = path.join(independentB, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000001.json');
    fs.writeFileSync(corruptPath, '{"truncated":');
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(forkScenario.state, forkBSource, independentB, 'local-possession-transition-log:independent', forkGenesis)).inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'truncated entry fails closed on reload');

    const raceParent = makeDir(tempRoot, 'race-fixture');
    const raceScenario = Fixture.buildScenario(raceParent);
    const raceLedger = makeDir(tempRoot, 'race-ledger');
    const raceOptions = Fixture.serviceOptions(raceScenario.state, raceScenario.sourceRoot, raceLedger, 'local-possession-transition-log:race', Fixture.separatedRef(raceScenario.baseChain));
    const raceInput = Fixture.recordInput(raceScenario.firstTransitionInput, raceScenario.firstTransitionReceipt, 'race');
    const racePackage = writePackage(tempRoot, 'race-record', { action: 'record', options: raceOptions, input: raceInput });
    const raceResults = await Promise.all([runChildAsync(racePackage), runChildAsync(racePackage)]);
    equal(raceResults.filter(result => result.status === 0).length, 1, 'exclusive create admits one concurrent writer');
    equal(raceResults.filter(result => result.parsed.code === 'TRANSITION_ALREADY_RECORDED' || result.parsed.code === 'STALE_LOCAL_HEAD').length, 1, 'concurrent loser receives typed local contention result');
    equal(Ledger.createService(raceOptions).inspect().entryCount, 1, 'concurrent contention leaves one local entry');

    const badTimes = copy(firstInput);
    badTimes.observedAt = '2026-08-20T15:30:00.000Z';
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(scenario.state, scenario.sourceRoot, makeDir(tempRoot, 'bad-time-ledger'), 'local-possession-transition-log:bad-time', genesisRef)).record(badTimes), 'INVALID_INPUT', 'observation time before comparison is refused');
    const oversized = copy(firstInput);
    oversized.unexpected = 'x'.repeat(Ledger.MAX_ARTIFACT_CANONICAL_BYTES);
    throwsCode(() => service.record(oversized), 'ARTIFACT_TOO_LARGE', 'oversized record input is refused before parsing fields');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
    check(contract.boundaries.refuses.includes('prewrite-source-capture-as-atomic-with-ledger-append'), 'contract refuses atomic source/append claim');
    check(contract.boundaries.refuses.includes('local-sequence-as-global-fork-exclusion'), 'contract refuses local sequence as global fork exclusion');
    check(contract.boundaries.refuses.includes('explicit-confirmation-as-host-authorization'), 'contract refuses confirmation as host authorization');
    check(contract.boundaries.refuses.includes('transition-recording-as-execution-adoption-promotion-or-canon-authority'), 'contract refuses downstream authority');

    console.log('SUMMARY ' + checks + ' checks');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
    cleanupVerified = !fs.existsSync(tempRoot);
    console.log('CLEANUP ' + (cleanupVerified ? 'verified' : 'failed'));
  }
  if (!cleanupVerified) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
