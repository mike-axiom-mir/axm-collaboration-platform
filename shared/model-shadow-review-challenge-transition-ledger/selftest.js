#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Ledger = require('./model-shadow-review-challenge-transition-ledger');
const TransitionGate = require('../model-shadow-review-challenge-transition-gate/model-shadow-review-challenge-transition-gate');
const TransitionFixture = require('../model-shadow-review-challenge-transition-gate/selftest-fixture');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const ChallengeLedger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const ChallengeFixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throwsCode(fn, code, label) {
  assert.throws(fn, error => error && error.code === code);
  checks += 1;
  console.log('PASS ' + label);
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }

function separatedRef(chain) {
  return {
    id: chain.separationReceipt.receiptId,
    schema: chain.separationReceipt.schema,
    sha256: chain.separationReceipt.receiptDigest
  };
}

function snapshot(root, ledgerId, tag, observedAt) {
  return Continuity.captureState({ stateRoot: root, ledgerId, observationId: 'observation:transition-ledger-' + tag, observedAt });
}

function checkpoint(currentSnapshot, checkpointId, anchoredAt) {
  return Continuity.buildCheckpoint({ checkpointId, anchoredAt, currentSnapshot });
}

function advanceInput(entryId, recordedAt, transitionInput) {
  return {
    entryId,
    recordedAt,
    confirmation: Ledger.CONFIRMATION,
    transitionInput: copy(transitionInput),
    transitionReceipt: TransitionGate.buildTransition(transitionInput)
  };
}

function writePackage(tempRoot, name, value) {
  const packagePath = path.join(tempRoot, name + '.json');
  fs.writeFileSync(packagePath, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return packagePath;
}

function parseChild(result) {
  const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
}

const childPath = path.join(__dirname, 'selftest-child.js');

function runChild(packagePath, stateRoot) {
  const result = childProcess.spawnSync(process.execPath, [childPath, packagePath, stateRoot], {
    encoding: 'utf8', windowsHide: true
  });
  return { status: result.status, output: parseChild(result), stderr: result.stderr };
}

function runChildAsync(packagePath, stateRoot) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [childPath, packagePath, stateRoot], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', (status, signal) => resolve({ status, signal, output: parseChild({ stdout }), stderr }));
  });
}

function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) {
    throw new Error('temporary deletion target escapes selftest root');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-transition-ledger-'));
  try {
    const challengeRoots = {};
    ['base', 'fork-a', 'fork-b', 'fork-c', 'fork-d'].forEach(name => {
      challengeRoots[name] = path.join(tempRoot, 'challenge-' + name);
      fs.mkdirSync(challengeRoots[name]);
    });
    const challengeLedgerId = 'ledger:transition-ledger-selftest';
    const requests = {
      base: ChallengeFixture.buildRequest('transition-ledger-base'),
      a: ChallengeFixture.buildRequest('transition-ledger-a'),
      b: ChallengeFixture.buildRequest('transition-ledger-b'),
      c: ChallengeFixture.buildRequest('transition-ledger-c'),
      d: ChallengeFixture.buildRequest('transition-ledger-d')
    };
    ChallengeLedger.createService({ stateRoot: challengeRoots.base, ledgerId: challengeLedgerId }).consume(copy(requests.base));
    const serviceA = ChallengeLedger.createService({ stateRoot: challengeRoots['fork-a'], ledgerId: challengeLedgerId });
    serviceA.consume(copy(requests.base));
    serviceA.consume(copy(requests.a));
    const serviceB = ChallengeLedger.createService({ stateRoot: challengeRoots['fork-b'], ledgerId: challengeLedgerId });
    serviceB.consume(copy(requests.base));
    serviceB.consume(copy(requests.b));
    const serviceC = ChallengeLedger.createService({ stateRoot: challengeRoots['fork-c'], ledgerId: challengeLedgerId });
    serviceC.consume(copy(requests.base));
    serviceC.consume(copy(requests.a));
    serviceC.consume(copy(requests.c));
    const serviceD = ChallengeLedger.createService({ stateRoot: challengeRoots['fork-d'], ledgerId: challengeLedgerId });
    serviceD.consume(copy(requests.base));
    serviceD.consume(copy(requests.a));
    serviceD.consume(copy(requests.d));

    const checkpoints = {
      base: checkpoint(snapshot(challengeRoots.base, challengeLedgerId, 'base', '2026-08-20T14:07:00.000Z'), 'checkpoint:transition-ledger-base', '2026-08-20T14:07:30.000Z'),
      a: checkpoint(snapshot(challengeRoots['fork-a'], challengeLedgerId, 'a', '2026-08-20T14:12:00.000Z'), 'checkpoint:transition-ledger-a', '2026-08-20T14:12:30.000Z'),
      b: checkpoint(snapshot(challengeRoots['fork-b'], challengeLedgerId, 'b', '2026-08-20T14:13:00.000Z'), 'checkpoint:transition-ledger-b', '2026-08-20T14:13:30.000Z'),
      c: checkpoint(snapshot(challengeRoots['fork-c'], challengeLedgerId, 'c', '2026-08-20T14:17:00.000Z'), 'checkpoint:transition-ledger-c', '2026-08-20T14:17:30.000Z'),
      d: checkpoint(snapshot(challengeRoots['fork-d'], challengeLedgerId, 'd', '2026-08-20T14:18:00.000Z'), 'checkpoint:transition-ledger-d', '2026-08-20T14:18:30.000Z')
    };
    const authority = TransitionFixture.createAuthority('transition-ledger-stable');
    const chains = {
      base: TransitionFixture.buildSeparatedChain(checkpoints.base, 'ledger-base', authority, { minute: 8 }),
      a: TransitionFixture.buildSeparatedChain(checkpoints.a, 'ledger-a', authority, { minute: 13 }),
      b: TransitionFixture.buildSeparatedChain(checkpoints.b, 'ledger-b', authority, { minute: 14 }),
      c: TransitionFixture.buildSeparatedChain(checkpoints.c, 'ledger-c', authority, { minute: 18 }),
      d: TransitionFixture.buildSeparatedChain(checkpoints.d, 'ledger-d', authority, { minute: 19 })
    };
    const transitions = {
      a: TransitionFixture.transitionInput(chains.base, chains.a, 'ledger-base-to-a'),
      b: TransitionFixture.transitionInput(chains.base, chains.b, 'ledger-base-to-b'),
      c: TransitionFixture.transitionInput(chains.a, chains.c, 'ledger-a-to-c'),
      d: TransitionFixture.transitionInput(chains.a, chains.d, 'ledger-a-to-d'),
      replay: TransitionFixture.transitionInput(chains.base, chains.base, 'ledger-replay'),
      forkHold: TransitionFixture.transitionInput(chains.a, chains.b, 'ledger-a-to-b-hold')
    };
    const advances = {
      a: advanceInput('entry:transition-ledger-a', '2026-08-20T14:41:00.000Z', transitions.a),
      b: advanceInput('entry:transition-ledger-b', '2026-08-20T14:41:30.000Z', transitions.b),
      c: advanceInput('entry:transition-ledger-c', '2026-08-20T14:42:00.000Z', transitions.c),
      d: advanceInput('entry:transition-ledger-d', '2026-08-20T14:42:30.000Z', transitions.d)
    };
    const genesisRef = separatedRef(chains.base);
    const logId = 'transition-log:selftest-local-head';
    const primaryRoot = path.join(tempRoot, 'transition-primary');
    fs.mkdirSync(primaryRoot);
    const primary = Ledger.createService({ stateRoot: primaryRoot, logId, genesisSeparatedWitnessRef: genesisRef });

    equal(Ledger.VERSION, '0.8.0', 'module version is exact');
    equal(Ledger.STATUS, 'TEST', 'module status remains TEST');
    equal(primary.inspect(), null, 'unused caller root has no transition ledger state');
    const noConfirmation = copy(advances.a);
    noConfirmation.confirmation = 'ADVANCE';
    throwsCode(() => primary.advance(noConfirmation), 'CONFIRMATION_REQUIRED', 'write is refused without exact explicit confirmation');
    equal(fs.existsSync(path.join(primaryRoot, Ledger.NAMESPACE)), false, 'failed confirmation performs no namespace write');
    throwsCode(() => Ledger.createService({ stateRoot: path.parse(primaryRoot).root, logId, genesisSeparatedWitnessRef: genesisRef }), 'STATE_ROOT_INVALID', 'filesystem root is refused as state root');
    const missingRoot = path.join(tempRoot, 'missing-transition-root');
    throwsCode(() => Ledger.createService({ stateRoot: missingRoot, logId, genesisSeparatedWitnessRef: genesisRef }), 'STATE_ROOT_INVALID', 'missing caller state root is refused');

    const first = primary.advance(advances.a);
    equal(first.schema, Ledger.ENTRY_SCHEMA, 'first local entry has exact schema identity');
    equal(first.log.sequence, 1, 'first local entry has sequence one');
    equal(first.previousEntryRef, null, 'first local entry begins at manifest genesis');
    equal(first.previousSeparatedWitnessRef.sha256, genesisRef.sha256, 'first local entry binds exact genesis head');
    equal(first.candidateSeparatedWitnessRef.sha256, chains.a.separationReceipt.receiptDigest, 'first local entry advances to exact candidate head');
    equal(first.transitionReceipt.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_CHAIN', 'persisted transition is an exact forward extension');
    equal(first.truth.transitionReceiptVerifiedByExactRebuildBeforeWrite, true, 'upstream transition is exact-rebuilt before write');
    equal(first.truth.exactLocalHeadMatchedBeforeWrite, true, 'entry reports exact local head match before write');
    equal(first.truth.entryFileFsyncCompleted, true, 'returned entry follows file fsync completion');
    equal(first.truth.persistedUpstreamTransitionInput, false, 'exact-rebuild input is not persisted in the entry');
    equal(first.truth.upstreamTransitionReverifiedAfterReloadWithoutCallerPackage, false, 'reload alone does not claim upstream signature re-verification');
    equal(first.truth.globalTransitionUniquenessProven, false, 'local advance does not claim global uniqueness');
    equal(first.truth.globallyConsistentTransitionLogProven, false, 'local advance does not claim global consistency');
    equal(first.truth.protectedMonotonicStateProven, false, 'caller files do not claim protected monotonic state');
    equal(first.truth.hostAuthorizationAuthenticated, false, 'explicit call does not authenticate host authorization');
    equal(first.truth.executionAuthorized, false, 'local transition recording grants no execution authority');
    equal(first.truth.adoptionAuthorized, false, 'local transition recording grants no adoption authority');
    equal(first.truth.automaticCanon, false, 'local transition recording grants no CANON authority');
    const serializedFirst = Ledger.stableStringify(first);
    check(!serializedFirst.includes('BEGIN PUBLIC KEY'), 'persisted local entry contains no raw public key');
    check(!serializedFirst.includes(advances.a.transitionInput.previousSeparationInput.anchoredWitnessInput.witnessInput.signedAttestations[0].signature), 'persisted local entry contains no raw signature');
    check(!serializedFirst.includes(tempRoot), 'persisted local entry contains no machine state-root path');
    check(primary.verifyPersisted(advances.a, first).pass, 'caller package exact-rebuilds first persisted entry');

    const snapshotOne = primary.inspect();
    equal(snapshotOne.schema, Ledger.SNAPSHOT_SCHEMA, 'local snapshot has exact schema identity');
    equal(snapshotOne.entryCount, 1, 'snapshot reports one validated local entry');
    equal(snapshotOne.currentHeadSeparatedWitnessRef.sha256, chains.a.separationReceipt.receiptDigest, 'snapshot derives exact head from first entry');
    equal(snapshotOne.truth.upstreamTransitionsReverifiedWithoutCallerPackages, false, 'snapshot distinguishes local validation from upstream exact rebuild');
    equal(snapshotOne.truth.independentStateRootsExcluded, false, 'snapshot does not exclude independent roots');

    const inspectPackage = writePackage(tempRoot, 'inspect-primary', { action: 'inspect', logId, genesisSeparatedWitnessRef: genesisRef });
    const freshInspect = runChild(inspectPackage, primaryRoot);
    equal(freshInspect.status, 0, 'fresh process reloads the local transition ledger');
    equal(freshInspect.output.snapshot.snapshotDigest, snapshotOne.snapshotDigest, 'fresh process derives the exact same local snapshot');
    const verifyPackage = writePackage(tempRoot, 'verify-first', { action: 'verify', logId, genesisSeparatedWitnessRef: genesisRef, advanceInput: advances.a, entry: first });
    const freshVerify = runChild(verifyPackage, primaryRoot);
    equal(freshVerify.status, 0, 'fresh process accepts caller-presented exact-rebuild package');
    equal(freshVerify.output.verification.pass, true, 'fresh process verifies caller package against persisted entry');

    const second = primary.advance(advances.c);
    equal(second.log.sequence, 2, 'second exact-head extension receives sequence two');
    equal(second.previousEntryRef.sha256, first.entryDigest, 'second entry digest-links the first entry');
    equal(second.previousSeparatedWitnessRef.sha256, chains.a.separationReceipt.receiptDigest, 'second entry starts at exact current local head');
    const snapshotTwo = primary.inspect();
    equal(snapshotTwo.entryCount, 2, 'snapshot reports two validated local entries');
    equal(snapshotTwo.currentHeadSeparatedWitnessRef.sha256, chains.c.separationReceipt.receiptDigest, 'snapshot derives exact second local head');
    check(primary.verifyPersisted(advances.c, second).pass, 'caller package exact-rebuilds second persisted entry');

    throwsCode(() => primary.advance(advances.b), 'STALE_LOCAL_HEAD', 'alternate fork from genesis is stale after local head advances');
    equal(primary.inspect().entryCount, 2, 'stale fork performs no local entry write');
    throwsCode(() => primary.advance(advances.a), 'STALE_LOCAL_HEAD', 'exact previously recorded transition cannot advance the later local head');
    const replayAdvance = advanceInput('entry:replay', '2026-08-20T14:43:00.000Z', transitions.replay);
    throwsCode(() => primary.advance(replayAdvance), 'TRANSITION_NOT_FORWARD_EXTENSION', 'pairwise exact replay cannot advance local head');
    const holdAdvance = advanceInput('entry:hold', '2026-08-20T14:43:30.000Z', transitions.forkHold);
    throwsCode(() => primary.advance(holdAdvance), 'TRANSITION_NOT_FORWARD_EXTENSION', 'pairwise HOLD cannot advance local head');
    const tampered = copy(advances.c);
    tampered.transitionReceipt.truth.globalTransitionUniquenessProven = true;
    throwsCode(() => primary.advance(tampered), 'TRANSITION_INVALID', 'tampered upstream transition receipt is refused before head inspection');

    throwsCode(
      () => Ledger.createService({ stateRoot: primaryRoot, logId: 'transition-log:conflict', genesisSeparatedWitnessRef: genesisRef }).inspect(),
      'LOG_ID_MISMATCH',
      'existing caller root refuses conflicting log id'
    );
    throwsCode(
      () => Ledger.createService({ stateRoot: primaryRoot, logId, genesisSeparatedWitnessRef: separatedRef(chains.b) }).inspect(),
      'GENESIS_MISMATCH',
      'existing caller root refuses conflicting genesis head'
    );

    const independentA = path.join(tempRoot, 'independent-a');
    const independentB = path.join(tempRoot, 'independent-b');
    fs.mkdirSync(independentA);
    fs.mkdirSync(independentB);
    const rootA = Ledger.createService({ stateRoot: independentA, logId: 'transition-log:independent-a', genesisSeparatedWitnessRef: genesisRef });
    const rootB = Ledger.createService({ stateRoot: independentB, logId: 'transition-log:independent-b', genesisSeparatedWitnessRef: genesisRef });
    const independentEntryA = rootA.advance(advances.a);
    const independentEntryB = rootB.advance(advances.b);
    equal(independentEntryA.previousSeparatedWitnessRef.sha256, independentEntryB.previousSeparatedWitnessRef.sha256, 'independent roots begin from the same exact genesis head');
    check(independentEntryA.candidateSeparatedWitnessRef.sha256 !== independentEntryB.candidateSeparatedWitnessRef.sha256, 'independent roots accept different pairwise-valid fork heads');
    equal(rootA.inspect().truth.independentStateRootsExcluded, false, 'independent-root counterexample remains explicit in snapshot truth');
    equal(rootB.inspect().truth.globallyConsistentTransitionLogProven, false, 'independent-root fork is not promoted to global consistency');

    const reopenedNamespace = path.join(independentB, Ledger.NAMESPACE);
    check(path.resolve(reopenedNamespace).startsWith(path.resolve(tempRoot) + path.sep), 'deletion counterexample target is bounded inside selftest root');
    verifiedRemove(reopenedNamespace, tempRoot);
    const reopened = Ledger.createService({ stateRoot: independentB, logId: 'transition-log:independent-b', genesisSeparatedWitnessRef: genesisRef }).advance(advances.a);
    equal(reopened.candidateSeparatedWitnessRef.sha256, independentEntryA.candidateSeparatedWitnessRef.sha256, 'deleting caller state reopens a different branch from the same genesis');
    equal(reopened.truth.deletionOrRollbackPrevented, false, 'deletion counterexample preserves rollback-resistance limitation');

    const raceRoot = path.join(tempRoot, 'race-root');
    fs.mkdirSync(raceRoot);
    const raceLogId = 'transition-log:race';
    const raceService = Ledger.createService({ stateRoot: raceRoot, logId: raceLogId, genesisSeparatedWitnessRef: genesisRef });
    raceService.advance(advances.a);
    const racePackageC = writePackage(tempRoot, 'race-c', { action: 'advance', logId: raceLogId, genesisSeparatedWitnessRef: genesisRef, advanceInput: advances.c });
    const racePackageD = writePackage(tempRoot, 'race-d', { action: 'advance', logId: raceLogId, genesisSeparatedWitnessRef: genesisRef, advanceInput: advances.d });
    const contenders = await Promise.all([runChildAsync(racePackageC, raceRoot), runChildAsync(racePackageD, raceRoot)]);
    const winners = contenders.filter(result => result.status === 0);
    const losers = contenders.filter(result => result.status === 17 && result.output && ['STALE_LOCAL_HEAD', 'TRANSITION_LEDGER_SEQUENCE_CONFLICT'].includes(result.output.code));
    equal(winners.length, 1, 'two concurrent extensions of one local head produce exactly one winner');
    equal(losers.length, 1, 'concurrent losing fork receives typed local refusal');
    equal(Ledger.createService({ stateRoot: raceRoot, logId: raceLogId, genesisSeparatedWitnessRef: genesisRef }).inspect().entryCount, 2, 'concurrent contention leaves one next local sequence entry');

    const corruptRoot = path.join(tempRoot, 'corrupt-root');
    fs.mkdirSync(corruptRoot);
    const corruptService = Ledger.createService({ stateRoot: corruptRoot, logId: 'transition-log:corrupt', genesisSeparatedWitnessRef: genesisRef });
    const corruptEntry = corruptService.advance(advances.a);
    const corruptEntryPath = path.join(corruptRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000001.json');
    fs.writeFileSync(corruptEntryPath, '{"truncated":');
    throwsCode(() => Ledger.createService({ stateRoot: corruptRoot, logId: 'transition-log:corrupt', genesisSeparatedWitnessRef: genesisRef }).inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'truncated local entry fails closed on fresh reload');
    check(fs.existsSync(corruptEntryPath), 'corrupt local entry is retained for steward inspection');
    check(Boolean(corruptEntry.entryDigest), 'pre-corruption entry digest remains available as evidence');

    const sequenceRoot = path.join(tempRoot, 'sequence-root');
    fs.mkdirSync(sequenceRoot);
    const sequenceService = Ledger.createService({ stateRoot: sequenceRoot, logId: 'transition-log:sequence', genesisSeparatedWitnessRef: genesisRef });
    sequenceService.advance(advances.a);
    fs.renameSync(
      path.join(sequenceRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000001.json'),
      path.join(sequenceRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000002.json')
    );
    throwsCode(() => sequenceService.inspect(), 'TRANSITION_LEDGER_SEQUENCE_CORRUPT', 'noncontiguous local entry sequence fails closed');

    const boundaryRoot = path.join(tempRoot, 'boundary-root');
    fs.mkdirSync(boundaryRoot);
    const boundaryService = Ledger.createService({ stateRoot: boundaryRoot, logId: 'transition-log:boundary', genesisSeparatedWitnessRef: genesisRef });
    const boundaryEntry = boundaryService.advance(advances.a);
    const boundaryPath = path.join(boundaryRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000001.json');
    const boundaryTamper = copy(boundaryEntry);
    boundaryTamper.truth.executionAuthorized = true;
    const boundaryPayload = copy(boundaryTamper);
    delete boundaryPayload.entryDigest;
    boundaryTamper.entryDigest = Ledger.sha256(boundaryPayload);
    fs.writeFileSync(boundaryPath, Ledger.stableStringify(boundaryTamper) + '\n');
    throwsCode(() => boundaryService.inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'stored authority-boundary tamper fails closed even with recomputed entry digest');

    const transitionBoundaryRoot = path.join(tempRoot, 'transition-boundary-root');
    fs.mkdirSync(transitionBoundaryRoot);
    const transitionBoundaryService = Ledger.createService({ stateRoot: transitionBoundaryRoot, logId: 'transition-log:inner-boundary', genesisSeparatedWitnessRef: genesisRef });
    const transitionBoundaryEntry = transitionBoundaryService.advance(advances.a);
    const transitionBoundaryPath = path.join(transitionBoundaryRoot, Ledger.NAMESPACE, Ledger.ENTRIES_DIRECTORY, '000000000001.json');
    const transitionBoundaryTamper = copy(transitionBoundaryEntry);
    transitionBoundaryTamper.transitionReceipt.state = 'LOCAL_REWRITE_PRETENDS_TO_BE_VALID';
    const transitionPayload = copy(transitionBoundaryTamper.transitionReceipt);
    delete transitionPayload.receiptDigest;
    transitionBoundaryTamper.transitionReceipt.receiptDigest = Ledger.sha256(transitionPayload);
    const transitionBoundaryPayload = copy(transitionBoundaryTamper);
    delete transitionBoundaryPayload.entryDigest;
    transitionBoundaryTamper.entryDigest = Ledger.sha256(transitionBoundaryPayload);
    fs.writeFileSync(transitionBoundaryPath, Ledger.stableStringify(transitionBoundaryTamper) + '\n');
    throwsCode(() => transitionBoundaryService.inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'redigested stored transition state tamper fails closed without claiming protected storage');

    const missingManifestRoot = path.join(tempRoot, 'missing-manifest-root');
    fs.mkdirSync(missingManifestRoot);
    const missingManifestService = Ledger.createService({ stateRoot: missingManifestRoot, logId: 'transition-log:missing-manifest', genesisSeparatedWitnessRef: genesisRef });
    missingManifestService.advance(advances.a);
    fs.unlinkSync(path.join(missingManifestRoot, Ledger.NAMESPACE, Ledger.MANIFEST_FILE));
    throwsCode(() => missingManifestService.inspect(), 'TRANSITION_LEDGER_MANIFEST_MISSING', 'missing manifest with existing entries fails closed');

    const absentPackageVerification = primary.verifyPersisted(copy(advances.a), copy(first));
    equal(absentPackageVerification.pass, true, 'persisted first entry remains exact after a later local advance');
    const wrongPackage = copy(advances.a);
    wrongPackage.entryId = 'entry:wrong-package';
    equal(primary.verifyPersisted(wrongPackage, first).pass, false, 'caller package mismatch fails persisted exact rebuild');
    const wrongEntry = copy(first);
    wrongEntry.truth.executionAuthorized = true;
    equal(primary.verifyPersisted(advances.a, wrongEntry).pass, false, 'presented persisted-entry truth tamper fails exact rebuild');

    const entrySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-ledger-entry.schema.json'), 'utf8'));
    const manifestSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-ledger-manifest.schema.json'), 'utf8'));
    const snapshotSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-ledger-snapshot.schema.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(entrySchema.$id, Ledger.ENTRY_SCHEMA, 'entry schema identity matches implementation');
    equal(manifestSchema.$id, Ledger.MANIFEST_SCHEMA, 'manifest schema identity matches implementation');
    equal(snapshotSchema.$id, Ledger.SNAPSHOT_SCHEMA, 'snapshot schema identity matches implementation');
    equal(entrySchema.properties.status.const, 'TEST', 'entry schema preserves TEST status');
    check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST with no host permission integration');
    check(contract.boundaries.refuses.includes('one-local-root-as-globally-consistent-log'), 'contract refuses local serialization as global consistency');
    check(contract.boundaries.refuses.includes('stored-transition-receipt-as-upstream-signature-reverification-after-restart'), 'contract distinguishes reload from upstream signature re-verification');
    check(contract.boundaries.refuses.includes('explicit-confirmation-as-host-authorization'), 'contract refuses confirmation as host authorization');
    check(contract.boundaries.refuses.includes('transition-recording-as-execution-or-adoption-authority'), 'contract refuses transition recording as downstream authority');
    check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');

    console.log('\nModel Shadow review challenge transition ledger selftest: PASS (' + checks + ' checks)');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
