#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const PinTransition = require('../model-shadow-history-checkpoint-pin-transition/model-shadow-history-checkpoint-pin-transition');
const PinLedger = require('./model-shadow-history-checkpoint-pin-settlement-ledger');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function namespace(root) { return path.join(root, PinLedger.NAMESPACE); }
function proposalFile(root, sequence) { return path.join(namespace(root), 'proposals', String(sequence).padStart(12, '0') + '.json'); }
function settlementFile(root, sequence) { return path.join(namespace(root), 'settlements', String(sequence).padStart(12, '0') + '.json'); }
function manifestFile(root) { return path.join(namespace(root), 'ledger.json'); }
function lockFile(root) { return path.join(namespace(root), PinLedger.LOCK_FILE); }
function pinRef(pin) { return { id: pin.pinId, schema: pin.schema, sha256: pin.pinDigest }; }
function expectCode(action, code, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  check(caught instanceof PinLedger.PinSettlementLedgerError, label + ' returns the typed ledger error');
  equal(caught.code, code, label);
}
function treeDigest(root) {
  if (!fs.existsSync(root)) return 'ABSENT';
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name);
      const child = relative ? relative + '/' + entry.name : entry.name;
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory() && !stat.isSymbolicLink()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else if (stat.isFile()) entries.push({ path: child, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
      else entries.push({ path: child, type: stat.isSymbolicLink() ? 'link' : 'other' });
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
function writeCanonical(target, value) { fs.writeFileSync(target, PinLedger.stableStringify(value) + '\n', { encoding: 'utf8', mode: 0o600 }); }
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json');
  fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return target;
}
function runChild(packagePath) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', status => {
      try { resolve({ status, value: JSON.parse(stdout || '{}'), stderr }); }
      catch (error) { reject(new Error('child returned invalid JSON: ' + error.message + '; stderr=' + stderr)); }
    });
  });
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function cloneRoot(sourceRoot, parent, name) {
  const target = makeDir(parent, name);
  fs.cpSync(namespace(sourceRoot), namespace(target), { recursive: true });
  return target;
}
function service(root, fixture, tag) {
  return PinLedger.createService(Fixture.serviceOptions(root, tag || 'v25-pin-settlement-ledger', fixture.genesisPinInput, fixture.genesisPin));
}
function proposePackage(fixture, branch, tag, proposedAt) {
  const input = Fixture.proposalInput(fixture['transition' + branch + 'Input'], fixture['transition' + branch], tag, proposedAt);
  return { input };
}
function settlePackage(proposalInput, proposalReceipt, tag, settledAt) {
  return Fixture.settlementInput(proposalInput, proposalReceipt, tag, settledAt);
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v25-pin-settlement-ledger-'));
  try {
    const fixtureRoot = makeDir(tempRoot, 'fixture');
    const fixture = Fixture.build(fixtureRoot);
    equal(PinLedger.VERSION, '2.5.0', 'version is exact');
    equal(PinLedger.STATUS, 'TEST', 'status remains TEST');
    equal(PinLedger.NAMESPACE, 'model-shadow-history-checkpoint-pin-settlement-ledger', 'namespace is fixed');
    equal(PinLedger.LOCK_FILE, '.operation.lock', 'operation lock filename is fixed');
    equal(PinLedger.MAX_RECORDS, 10000, 'record bound is explicit');
    equal(PinLedger.MAX_ARTIFACT_CANONICAL_BYTES, 4194304, 'persisted artifact bound is four MiB');
    equal(PinLedger.PROPOSE_CONFIRMATION, 'PROPOSE_LOCAL_PIN_SETTLEMENT_REVIEW_REQUIRED', 'proposal confirmation is exact');
    equal(PinLedger.SETTLE_CONFIRMATION, 'SETTLE_LOCAL_PIN_SETTLEMENT_DECLARED_UNAUTHENTICATED', 'settlement confirmation is exact and unauthenticated');
    equal(fixture.transitionA.classification, 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'fixture A is an eligible v2.4 forward transition');
    equal(fixture.transitionB.classification, 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'fixture B is an independently eligible v2.4 forward transition');
    equal(fixture.replay.classification, 'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY', 'fixture replay is valid but ineligible');
    equal(PinTransition.verifyTransition(fixture.transitionAInput, fixture.transitionA).pass, true, 'fixture A exact-rebuilds through v2.4');
    equal(PinTransition.verifyTransition(fixture.transitionBInput, fixture.transitionB).pass, true, 'fixture B exact-rebuilds through v2.4');

    const invalidRoot = makeDir(tempRoot, 'invalid-before-write');
    const invalidService = service(invalidRoot, fixture, 'v25-invalid-before-write');
    const invalidBefore = treeDigest(invalidRoot);
    expectCode(() => invalidService.propose(Fixture.proposalInput(fixture.replayInput, fixture.replay, 'replay')), 'V24_TRANSITION_INELIGIBLE', 'valid replay cannot enter settlement ledger');
    equal(treeDigest(invalidRoot), invalidBefore, 'ineligible transition creates no namespace or manifest');
    const badConfirmation = Fixture.proposalInput(fixture.transitionAInput, fixture.transitionA, 'bad-confirmation');
    badConfirmation.confirmation = 'yes';
    expectCode(() => invalidService.propose(badConfirmation), 'PROPOSAL_CONFIRMATION_REQUIRED', 'proposal requires exact confirmation');
    equal(treeDigest(invalidRoot), invalidBefore, 'bad proposal confirmation creates no state');
    const earlyProposal = Fixture.proposalInput(fixture.transitionAInput, fixture.transitionA, 'early-proposal', '2026-08-20T16:29:59.999Z');
    expectCode(() => invalidService.propose(earlyProposal), 'PROPOSAL_TIME_INVALID', 'proposal cannot predate v2.4 comparison');
    const tamperedTransition = Fixture.proposalInput(fixture.transitionAInput, fixture.transitionA, 'tampered-transition');
    tamperedTransition.transitionReceipt.transitionDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => invalidService.propose(tamperedTransition), 'V24_TRANSITION_INVALID', 'tampered v2.4 receipt fails before write');
    equal(treeDigest(invalidRoot), invalidBefore, 'all preflight proposal failures leave root byte-identical');

    const root = makeDir(tempRoot, 'primary-ledger');
    const primary = service(root, fixture, 'v25-primary-ledger');
    equal(primary.inspect(), null, 'inspect does not initialize absent state');
    equal(fs.existsSync(namespace(root)), false, 'absent inspect creates no namespace');
    const a = proposePackage(fixture, 'A', 'primary-a');
    const proposalA = primary.propose(a.input);
    equal(proposalA.schema, PinLedger.PROPOSAL_SCHEMA, 'proposal receipt schema is exact');
    equal(proposalA.log.sequence, 1, 'first proposal receives sequence one');
    equal(proposalA.previousSettledPinRef, pinRef(fixture.genesisPin), 'proposal binds genesis as previous settled head');
    equal(proposalA.successorPinRef, pinRef(fixture.transitionA.successorPinProposal), 'proposal binds v2.4 successor pin');
    equal(proposalA.decision.pendingSettlement, true, 'proposal is pending only');
    equal(proposalA.decision.settledHeadAdvanced, false, 'proposal does not advance settled head');
    equal(proposalA.truth.authenticatedHumanReviewProven, false, 'proposal claims no authenticated human review');
    equal(proposalA.truth.adoptionAuthorized, false, 'proposal grants no adoption authority');
    equal(proposalA.truth.providerInvoked, false, 'proposal claims no provider invocation');
    equal(proposalA.truth.humanBenefitProven, false, 'proposal claims no human benefit');
    equal(proposalA.truth.automaticCanon, false, 'proposal claims no automatic CANON');
    equal(fs.existsSync(proposalFile(root, 1)), true, 'proposal receipt persists at contiguous canonical path');
    equal(fs.readFileSync(proposalFile(root, 1), 'utf8'), PinLedger.stableStringify(proposalA) + '\n', 'proposal file is exact canonical JSON');
    equal(fs.existsSync(lockFile(root)), false, 'normal proposal removes transient operation lock');
    const pending = primary.inspect();
    equal(pending.currentSettledPinRef, pinRef(fixture.genesisPin), 'pending proposal leaves settled head at genesis');
    equal(pending.proposalCount, 1, 'pending snapshot counts proposal');
    equal(pending.settlementCount, 0, 'pending snapshot counts no settlement');
    equal(pending.pendingProposalRef.sha256, proposalA.proposalDigest, 'pending snapshot references exact proposal');
    equal(pending.truth.currentPinHeadDerivedOnlyFromSettlements, true, 'snapshot states settled-only head derivation');
    equal(fs.existsSync(lockFile(root)), false, 'normal inspect removes transient operation lock');
    expectCode(() => primary.propose(proposePackage(fixture, 'B', 'second-while-pending').input), 'PENDING_SETTLEMENT', 'only one trailing proposal may be pending');
    equal(primary.inspect(), pending, 'rejected second proposal leaves pending snapshot exact');

    const inspectPackagePath = writePackage(tempRoot, 'fresh-inspect', {
      action: 'inspect', options: Fixture.serviceOptions(root, 'v25-primary-ledger', fixture.genesisPinInput, fixture.genesisPin)
    });
    const inspectBefore = treeDigest(root);
    const freshInspect = await runChild(inspectPackagePath);
    equal(freshInspect.status, 0, 'fresh-process inspect exits normally');
    equal(freshInspect.value.ok, true, 'fresh-process inspect reports success');
    check(freshInspect.value.pid !== process.pid, 'fresh inspect uses a distinct process');
    equal(freshInspect.value.result, pending, 'fresh-process pending snapshot is exact');
    equal(treeDigest(root), inspectBefore, 'fresh inspect leaves durable state byte-identical');

    const exactSettlementA = settlePackage(a.input, proposalA, 'primary-a');
    const badSettlementConfirmation = copy(exactSettlementA);
    badSettlementConfirmation.confirmation = 'yes';
    expectCode(() => primary.settle(badSettlementConfirmation), 'SETTLEMENT_CONFIRMATION_REQUIRED', 'settlement requires separate exact confirmation');
    const earlySettlement = copy(exactSettlementA);
    earlySettlement.settledAt = '2026-08-20T16:31:59.999Z';
    expectCode(() => primary.settle(earlySettlement), 'SETTLEMENT_TIME_INVALID', 'settlement cannot predate proposal');
    const tamperedProposalReceipt = copy(exactSettlementA);
    tamperedProposalReceipt.proposalReceipt.proposalDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => primary.settle(tamperedProposalReceipt), 'PROPOSAL_PACKAGE_MISMATCH', 'settlement rejects tampered proposal receipt');
    const tamperedProposalInput = copy(exactSettlementA);
    tamperedProposalInput.proposalInput.transitionReceipt.transitionDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => primary.settle(tamperedProposalInput), 'V24_TRANSITION_INVALID', 'settlement exact-rebuild rejects tampered proposal input');
    equal(primary.inspect(), pending, 'failed settlement attempts leave proposal pending');

    const settlePackagePath = writePackage(tempRoot, 'fresh-settle', {
      action: 'settle', options: Fixture.serviceOptions(root, 'v25-primary-ledger', fixture.genesisPinInput, fixture.genesisPin), input: exactSettlementA
    });
    const freshSettle = await runChild(settlePackagePath);
    equal(freshSettle.status, 0, 'fresh-process settle exits normally');
    equal(freshSettle.value.ok, true, 'fresh-process settle reports success');
    check(freshSettle.value.pid !== process.pid, 'fresh settlement uses a distinct process');
    const settlementA = freshSettle.value.result;
    equal(settlementA.schema, PinLedger.SETTLEMENT_SCHEMA, 'settlement receipt schema is exact');
    equal(settlementA.classification, PinLedger.SETTLEMENT_CLASSIFICATION, 'settlement classification is exact');
    equal(settlementA.previousSettledPinRef, pinRef(fixture.genesisPin), 'settlement binds previous genesis head');
    equal(settlementA.settledPinRef, pinRef(fixture.transitionA.successorPinProposal), 'settlement binds exact successor head');
    equal(settlementA.truth.declaredConfirmationAuthenticatesHost, false, 'settlement confirmation does not authenticate host');
    equal(settlementA.truth.externalRetentionProven, false, 'settlement claims no external retention');
    equal(settlementA.truth.protectedMonotonicStateProven, false, 'settlement claims no protected monotonic state');
    equal(settlementA.truth.deletionOrRollbackPrevented, false, 'settlement claims no rollback prevention');
    equal(settlementA.decision.executionAuthorized, false, 'settlement grants no execution authority');
    equal(settlementA.decision.adoptionAuthorized, false, 'settlement grants no adoption authority');
    equal(fs.readFileSync(settlementFile(root, 1), 'utf8'), PinLedger.stableStringify(settlementA) + '\n', 'settlement file is exact canonical JSON');
    const settled = primary.inspect();
    equal(settled.currentSettledPinRef, pinRef(fixture.transitionA.successorPinProposal), 'settled-only head advances after settlement file exists');
    equal(settled.proposalCount, 1, 'settled snapshot retains proposal count');
    equal(settled.settlementCount, 1, 'settled snapshot counts settlement');
    equal(settled.pendingProposalRef, null, 'settled snapshot has no pending proposal');
    equal(primary.verifyProposalPersisted(a.input, proposalA).pass, true, 'caller package exact-verifies persisted proposal');
    equal(primary.verifySettlementPersisted(exactSettlementA, settlementA).pass, true, 'caller package exact-verifies persisted settlement');
    const wrongProposalForVerification = copy(a.input);
    wrongProposalForVerification.proposalId += ':wrong';
    equal(primary.verifyProposalPersisted(wrongProposalForVerification, proposalA).pass, false, 'different proposal package fails persisted verification');
    const wrongSettlementForVerification = copy(settlementA);
    wrongSettlementForVerification.settlementDigest = 'sha256:' + '0'.repeat(64);
    equal(primary.verifySettlementPersisted(exactSettlementA, wrongSettlementForVerification).pass, false, 'different settlement receipt fails persisted verification');
    expectCode(() => primary.settle(exactSettlementA), 'NO_PENDING_PROPOSAL', 'settlement cannot be replayed after head advance');
    expectCode(() => primary.propose(proposePackage(fixture, 'B', 'stale-after-settle').input), 'STALE_SETTLED_PIN_HEAD', 'original-genesis transition is stale after settlement');

    const concurrentRoot = makeDir(tempRoot, 'concurrent-ledger');
    const concurrentOptions = Fixture.serviceOptions(concurrentRoot, 'v25-concurrent-ledger', fixture.genesisPinInput, fixture.genesisPin);
    const concurrentA = proposePackage(fixture, 'A', 'concurrent-a');
    const concurrentB = proposePackage(fixture, 'B', 'concurrent-b');
    const concurrentAPath = writePackage(tempRoot, 'concurrent-a', { action: 'propose', options: concurrentOptions, input: concurrentA.input });
    const concurrentBPath = writePackage(tempRoot, 'concurrent-b', { action: 'propose', options: concurrentOptions, input: concurrentB.input });
    const concurrentResults = await Promise.all([runChild(concurrentAPath), runChild(concurrentBPath)]);
    equal(concurrentResults.every(result => result.status === 0), true, 'both concurrent child processes exit normally');
    equal(concurrentResults.filter(result => result.value.ok).length, 1, 'exactly one concurrent first writer succeeds');
    equal(concurrentResults.filter(result => !result.value.ok).length, 1, 'exactly one concurrent first writer is refused');
    check(['PIN_LEDGER_BUSY', 'PENDING_SETTLEMENT'].includes(concurrentResults.find(result => !result.value.ok).value.code), 'concurrent loser has bounded busy-or-pending outcome');
    const concurrentSnapshot = service(concurrentRoot, fixture, 'v25-concurrent-ledger').inspect();
    equal(concurrentSnapshot.proposalCount, 1, 'concurrent root contains exactly one proposal');
    equal(concurrentSnapshot.settlementCount, 0, 'concurrent root contains no settlement');
    check(concurrentSnapshot.pendingProposalRef !== null, 'concurrent winner remains one pending proposal');

    fs.writeFileSync(lockFile(concurrentRoot), 'LOCKED\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    const staleLockDigest = treeDigest(concurrentRoot);
    expectCode(() => service(concurrentRoot, fixture, 'v25-concurrent-ledger').inspect(), 'PIN_LEDGER_BUSY', 'stale operation lock fails closed');
    equal(treeDigest(concurrentRoot), staleLockDigest, 'stale lock is not automatically deleted or rewritten');
    fs.unlinkSync(lockFile(concurrentRoot));
    equal(service(concurrentRoot, fixture, 'v25-concurrent-ledger').inspect(), concurrentSnapshot, 'caller-owned stale-lock recovery restores inspect');

    const divergentA = makeDir(tempRoot, 'divergent-a');
    const divergentB = makeDir(tempRoot, 'divergent-b');
    const divergentServiceA = service(divergentA, fixture, 'v25-divergent-a');
    const divergentServiceB = service(divergentB, fixture, 'v25-divergent-b');
    const divergentProposalAInput = proposePackage(fixture, 'A', 'divergent-a').input;
    const divergentProposalBInput = proposePackage(fixture, 'B', 'divergent-b').input;
    const divergentProposalA = divergentServiceA.propose(divergentProposalAInput);
    const divergentProposalB = divergentServiceB.propose(divergentProposalBInput);
    divergentServiceA.settle(settlePackage(divergentProposalAInput, divergentProposalA, 'divergent-a'));
    divergentServiceB.settle(settlePackage(divergentProposalBInput, divergentProposalB, 'divergent-b'));
    equal(divergentServiceA.inspect().currentSettledPinRef, pinRef(fixture.transitionA.successorPinProposal), 'independent root A internally settles successor A');
    equal(divergentServiceB.inspect().currentSettledPinRef, pinRef(fixture.transitionB.successorPinProposal), 'independent root B internally settles successor B');
    check(divergentServiceA.inspect().currentSettledPinRef.sha256 !== divergentServiceB.inspect().currentSettledPinRef.sha256, 'independent roots can diverge without detection');
    equal(divergentServiceA.inspect().truth.independentRootsExcluded, false, 'snapshot explicitly refuses independent-root exclusion claim');

    const deletionRoot = makeDir(tempRoot, 'deletion-reopen');
    const deletionService = service(deletionRoot, fixture, 'v25-deletion-reopen');
    const deletionAInput = proposePackage(fixture, 'A', 'deletion-a').input;
    const deletionAProposal = deletionService.propose(deletionAInput);
    deletionService.settle(settlePackage(deletionAInput, deletionAProposal, 'deletion-a'));
    const removedNamespace = namespace(deletionRoot);
    verifiedRemove(removedNamespace, deletionRoot);
    equal(deletionService.inspect(), null, 'deleting local namespace removes visible history');
    const deletionBInput = proposePackage(fixture, 'B', 'deletion-b').input;
    const deletionBProposal = deletionService.propose(deletionBInput);
    equal(deletionBProposal.log.sequence, 1, 'deleted ledger can reopen at sequence one');
    equal(deletionBProposal.successorPinRef, pinRef(fixture.transitionB.successorPinProposal), 'reopened ledger can select an alternate successor');
    equal(deletionBProposal.truth.localSettledHeadAdvanced, false, 'reopened alternate remains pending until separately settled');

    const manifestCorruptRoot = cloneRoot(root, tempRoot, 'corrupt-manifest-digest');
    const badManifest = JSON.parse(fs.readFileSync(manifestFile(manifestCorruptRoot), 'utf8'));
    badManifest.manifestDigest = 'sha256:' + '0'.repeat(64);
    writeCanonical(manifestFile(manifestCorruptRoot), badManifest);
    expectCode(() => service(manifestCorruptRoot, fixture, 'v25-primary-ledger').inspect(), 'PIN_LEDGER_MANIFEST_CORRUPT', 'manifest digest corruption fails closed');

    const noncanonicalRoot = cloneRoot(root, tempRoot, 'corrupt-noncanonical');
    const noncanonicalProposal = JSON.parse(fs.readFileSync(proposalFile(noncanonicalRoot, 1), 'utf8'));
    fs.writeFileSync(proposalFile(noncanonicalRoot, 1), JSON.stringify(noncanonicalProposal, null, 2) + '\n', 'utf8');
    expectCode(() => service(noncanonicalRoot, fixture, 'v25-primary-ledger').inspect(), 'PIN_LEDGER_PROPOSAL_CORRUPT', 'noncanonical proposal file fails closed');

    const unexpectedRoot = cloneRoot(root, tempRoot, 'corrupt-unexpected-item');
    fs.writeFileSync(path.join(namespace(unexpectedRoot), 'unexpected.txt'), 'unexpected\n', 'utf8');
    expectCode(() => service(unexpectedRoot, fixture, 'v25-primary-ledger').inspect(), 'PIN_LEDGER_NAMESPACE_CORRUPT', 'unexpected namespace item fails closed');

    const gapRoot = cloneRoot(root, tempRoot, 'corrupt-sequence-gap');
    fs.renameSync(proposalFile(gapRoot, 1), proposalFile(gapRoot, 2));
    expectCode(() => service(gapRoot, fixture, 'v25-primary-ledger').inspect(), 'PIN_LEDGER_SEQUENCE_CORRUPT', 'proposal sequence gap fails closed');

    const oversizedRoot = cloneRoot(root, tempRoot, 'corrupt-oversized-file');
    fs.writeFileSync(proposalFile(oversizedRoot, 1), 'x'.repeat(PinLedger.MAX_ARTIFACT_CANONICAL_BYTES + 2), 'utf8');
    expectCode(() => service(oversizedRoot, fixture, 'v25-primary-ledger').inspect(), 'PIN_LEDGER_PROPOSAL_CORRUPT', 'oversized persisted proposal fails before JSON parse');

    const linkedDirectoryRoot = cloneRoot(root, tempRoot, 'corrupt-linked-directory');
    const proposalsBackup = path.join(linkedDirectoryRoot, 'proposal-backup');
    fs.renameSync(path.join(namespace(linkedDirectoryRoot), 'proposals'), proposalsBackup);
    fs.symlinkSync(proposalsBackup, path.join(namespace(linkedDirectoryRoot), 'proposals'), process.platform === 'win32' ? 'junction' : 'dir');
    expectCode(() => service(linkedDirectoryRoot, fixture, 'v25-primary-ledger').inspect(), 'STATE_ROOT_INVALID', 'linked proposal directory is rejected');

    const realRoot = makeDir(tempRoot, 'real-state-root');
    const linkedRoot = path.join(tempRoot, 'linked-state-root');
    fs.symlinkSync(realRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
    expectCode(() => service(linkedRoot, fixture, 'v25-linked-root'), 'STATE_ROOT_INVALID', 'linked state root is rejected');
    const fileRoot = path.join(tempRoot, 'file-root');
    fs.writeFileSync(fileRoot, 'not a directory\n', 'utf8');
    expectCode(() => service(fileRoot, fixture, 'v25-file-root'), 'STATE_ROOT_INVALID', 'regular file cannot be a state root');
    expectCode(() => service(path.parse(tempRoot).root, fixture, 'v25-filesystem-root'), 'STATE_ROOT_INVALID', 'filesystem root cannot be a state root');
    const absentRoot = path.join(tempRoot, 'absent-root');
    expectCode(() => service(absentRoot, fixture, 'v25-absent-root'), 'STATE_ROOT_INVALID', 'state root must be caller-created');
    const badGenesisRoot = makeDir(tempRoot, 'bad-genesis');
    const tamperedGenesis = copy(fixture.genesisPin);
    tamperedGenesis.pinDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => PinLedger.createService(Fixture.serviceOptions(badGenesisRoot, 'v25-bad-genesis', fixture.genesisPinInput, tamperedGenesis)), 'GENESIS_PIN_INVALID', 'tampered genesis configuration fails closed');
    equal(treeDigest(badGenesisRoot), crypto.createHash('sha256').update('[]').digest('hex'), 'invalid genesis creates no ledger files');
    const earlyManifestOptions = Fixture.serviceOptions(badGenesisRoot, 'v25-early-manifest', fixture.genesisPinInput, fixture.genesisPin);
    earlyManifestOptions.createdAt = '2026-08-20T15:59:59.999Z';
    expectCode(() => PinLedger.createService(earlyManifestOptions), 'MANIFEST_TIME_INVALID', 'manifest cannot predate genesis pin');
    const unknownOption = Fixture.serviceOptions(badGenesisRoot, 'v25-unknown-option', fixture.genesisPinInput, fixture.genesisPin);
    unknownOption.unexpected = true;
    expectCode(() => PinLedger.createService(unknownOption), 'INVALID_SHAPE', 'service options reject unknown fields');

    const publicArtifacts = JSON.stringify({ proposalA, settlementA, settled });
    equal(publicArtifacts.includes('BEGIN PUBLIC KEY'), false, 'public artifacts contain no raw public key');
    equal(publicArtifacts.includes(fixture.previousPackage.anchoredInput.policyAuthorizations[0].signature), false, 'public artifacts contain no raw signature');
    equal(publicArtifacts.includes(root), false, 'public artifacts contain no configured path');
    equal(publicArtifacts.includes('PRIVATE KEY'), false, 'public artifacts contain no private key material');
    equal(publicArtifacts.includes(JSON.stringify(fixture.transitionAInput)), false, 'public artifacts omit raw v2.4 transition input package');
    equal(settled.truth.directoryEntryOrHardwareDurabilityProven, false, 'file fsync does not claim directory or hardware durability');
    equal(settled.truth.globallyConsistentLogProven, false, 'local ledger claims no global consistency');
    equal(settled.truth.authenticatedHumanReviewProven, false, 'snapshot claims no authenticated human review');
    equal(settled.truth.providerInvoked, false, 'snapshot claims no provider invocation');
    equal(settled.truth.humanBenefitProven, false, 'snapshot claims no human benefit');
    equal(settled.truth.broadLearningClaimed, false, 'snapshot claims no broad learning');

    const schemas = ['manifest', 'proposal', 'settlement', 'snapshot'].map(name => JSON.parse(fs.readFileSync(path.join(__dirname, name + '.schema.json'), 'utf8')));
    equal(schemas.map(schema => schema.additionalProperties), [false, false, false, false], 'all four schemas close unknown top-level fields');
    equal(schemas.map(schema => schema.properties.status.const), ['TEST', 'TEST', 'TEST', 'TEST'], 'all four schemas keep TEST status');
    equal(schemas[1].properties.decision.properties.settledHeadAdvanced.const, false, 'proposal schema prevents head advance');
    equal(schemas[2].properties.decision.properties.executionAuthorized.const, false, 'settlement schema prevents execution authority');
    equal(schemas[2].properties.decision.properties.adoptionAuthorized.const, false, 'settlement schema prevents adoption authority');
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract).pass, true, 'module contract matches Workshop contract shape');
    equal(contract.version, 'v2.5', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.filter(value => value.startsWith('model.shadow.portable-history-checkpoint-pin-settlement-ledger.')).length, 25, 'contract provides exactly twenty-five bounded v2.5 capabilities');
    check(contract.boundaries.refuses.includes('explicit-confirmation-as-authenticated-host-human-review-or-real-world-identity'), 'contract refuses authentication inference from confirmation');
    check(contract.boundaries.refuses.includes('local-sequence-as-deletion-or-rollback-prevention'), 'contract refuses rollback-prevention inference');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-history-checkpoint-pin-settlement-ledger.js'), 'utf8');
    check(implementation.includes("require('fs')"), 'runtime explicitly uses local filesystem persistence');
    check(implementation.includes("fs.openSync(filePath, 'wx'"), 'persisted receipts use exclusive create');
    check(implementation.includes('fs.fsyncSync(descriptor)'), 'persisted receipts and lock use file fsync');
    check(implementation.includes("fs.openSync(lockPath, 'wx'"), 'operations use an exclusive transient lock');
    equal(implementation.includes('fsyncSync(paths.namespace'), false, 'runtime does not pretend to fsync directory entries');
    equal(implementation.includes('fetch('), false, 'runtime contains no network fetch');
    equal(implementation.includes('crypto.sign'), false, 'runtime creates no signature');
    equal(implementation.includes('createPrivateKey'), false, 'runtime accepts no private key API');

  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
    equal(fs.existsSync(tempRoot), false, 'temporary test root is removed after bounded cleanup');
  }
  console.log('RESULT ' + checks + ' focused assertions passed');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
