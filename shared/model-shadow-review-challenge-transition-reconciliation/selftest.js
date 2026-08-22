#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Reconciliation = require('./model-shadow-review-challenge-transition-reconciliation');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

function reconcile(fixture, leftKey, rightKey, tag) {
  const input = Fixture.reconciliationInput(
    fixture.presentationInputs[leftKey], fixture.presentations[leftKey],
    fixture.presentationInputs[rightKey], fixture.presentations[rightKey],
    tag
  );
  return { input, receipt: Reconciliation.buildReconciliation(input) };
}

function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', windowsHide: true
  });
  const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  return { status: result.status, output: lines.length ? JSON.parse(lines[lines.length - 1]) : null, stderr: result.stderr };
}

function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('temporary deletion target escapes selftest root');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-transition-reconciliation-'));
try {
  const fixture = Fixture.buildFixture(tempRoot);
  equal(Reconciliation.VERSION, '0.9.0', 'module version is exact');
  equal(Reconciliation.STATUS, 'TEST', 'module status remains TEST');
  equal(Reconciliation.MAX_PRESENTED_ENTRIES, 4096, 'presentation entry bound is explicit');
  equal(Reconciliation.MAX_PRESENTATION_CANONICAL_BYTES, 16 * 1024 * 1024, 'presentation canonical byte bound is explicit');

  const presentationA = fixture.presentations.a;
  equal(presentationA.schema, Reconciliation.PRESENTATION_SCHEMA, 'presentation schema identity is exact');
  equal(presentationA.entryCount, 1, 'one-entry history reports exact entry count');
  equal(presentationA.entries[0].sequence, 1, 'presentation sequence begins at one');
  equal(presentationA.entries[0].previousEntryRef, null, 'first presented entry begins at manifest genesis');
  equal(presentationA.headSeparatedWitnessRef.sha256, fixture.chains.a.separationReceipt.receiptDigest, 'presentation derives exact local head');
  equal(presentationA.truth.manifestVerifiedByExactRebuild, true, 'manifest exact rebuild is explicit');
  equal(presentationA.truth.everyEntryVerifiedByExactRebuild, true, 'entry exact rebuild is explicit');
  equal(presentationA.truth.everyUpstreamTransitionPackageVerifiedByExactRebuild, true, 'upstream transition exact rebuild is explicit');
  equal(presentationA.truth.callerPackagesEmbeddedInPresentationReceipt, false, 'caller exact-rebuild packages are not embedded');
  equal(presentationA.truth.callerStateRootRead, false, 'presentation is rebuilt without reading a caller state root');
  equal(presentationA.truth.externalRetentionProven, false, 'presentation does not claim external retention');
  equal(presentationA.truth.hostAuthorizationAuthenticated, false, 'presentation does not authenticate host authorization');
  check(Reconciliation.verifyPresentation(fixture.presentationInputs.a, presentationA).pass, 'presentation verifies by exact rebuild');
  equal(
    Reconciliation.stableStringify(Reconciliation.buildPresentation(copy(fixture.presentationInputs.a))),
    Reconciliation.stableStringify(presentationA),
    'presentation rebuild is deterministic from copied input'
  );
  const serializedPresentation = Reconciliation.stableStringify(presentationA);
  const rawSignature = fixture.presentationInputs.a.items[0].advanceInput.transitionInput.previousSeparationInput.anchoredWitnessInput.witnessInput.signedAttestations[0].signature;
  check(!serializedPresentation.includes('BEGIN PUBLIC KEY'), 'presentation receipt embeds no raw public key');
  check(!serializedPresentation.includes(rawSignature), 'presentation receipt embeds no raw signature');
  check(!serializedPresentation.includes(tempRoot), 'presentation receipt embeds no machine path');

  const replay = reconcile(fixture, 'a', 'aReplay', 'exact-replay');
  equal(replay.receipt.schema, Reconciliation.RECEIPT_SCHEMA, 'reconciliation schema identity is exact');
  equal(replay.receipt.decision.classification, 'PRESENTED_LOCAL_HISTORIES_EXACT_REPLAY', 'same exact entry history is classified as replay');
  equal(replay.receipt.decision.pairwiseConsistency, 'CONSISTENT_REPLAY', 'exact history replay is pairwise consistent');
  equal(replay.receipt.decision.reviewRequired, false, 'exact history replay requires no contradiction review');
  equal(replay.receipt.comparison.commonPrefixEntryCount, 1, 'exact replay reports full common prefix');
  equal(replay.receipt.comparison.divergence, null, 'exact replay has no divergence record');
  equal(replay.receipt.truth.exactPresentedHistoryReplayObserved, true, 'exact replay truth is explicit');
  equal(replay.receipt.truth.withheldRootsExcluded, false, 'exact replay does not exclude withheld roots');
  check(Reconciliation.verifyReconciliation(replay.input, replay.receipt).pass, 'exact replay reconciliation verifies');

  const leftPrefix = reconcile(fixture, 'a', 'ac', 'left-prefix');
  equal(leftPrefix.receipt.decision.classification, 'LEFT_PRESENTED_HISTORY_IS_EXACT_PREFIX', 'shorter left history is an exact prefix');
  equal(leftPrefix.receipt.decision.pairwiseConsistency, 'CONSISTENT_PREFIX', 'left prefix is pairwise consistent');
  equal(leftPrefix.receipt.decision.reviewRequired, false, 'exact prefix produces no contradiction review');
  equal(leftPrefix.receipt.comparison.commonPrefixEntryCount, 1, 'left prefix reports one common entry');
  equal(leftPrefix.receipt.truth.exactPrefixRelationshipObserved, true, 'prefix truth is explicit');
  equal(leftPrefix.receipt.truth.adoptionAuthorized, false, 'prefix relation grants no branch adoption authority');

  const rightPrefix = reconcile(fixture, 'ac', 'a', 'right-prefix');
  equal(rightPrefix.receipt.decision.classification, 'RIGHT_PRESENTED_HISTORY_IS_EXACT_PREFIX', 'shorter right history is an exact prefix');
  equal(rightPrefix.receipt.comparison.commonPrefixEntryCount, 1, 'right prefix reports one common entry');

  const siblingAtOne = reconcile(fixture, 'a', 'b', 'sibling-at-one');
  equal(siblingAtOne.receipt.decision.classification, 'HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE', 'different first candidates form a typed sibling fork');
  equal(siblingAtOne.receipt.decision.pairwiseConsistency, 'CONTRADICTION', 'sibling fork is a pairwise contradiction');
  equal(siblingAtOne.receipt.decision.reviewRequired, true, 'sibling fork requires steward review');
  equal(siblingAtOne.receipt.comparison.commonPrefixEntryCount, 0, 'first-entry fork has zero common entries');
  equal(siblingAtOne.receipt.comparison.divergence.sequence, 1, 'first-entry fork identifies exact divergence sequence');
  equal(siblingAtOne.receipt.comparison.divergence.leftCandidateSeparatedWitnessRef.sha256, fixture.chains.a.separationReceipt.receiptDigest, 'fork retains exact left candidate reference');
  equal(siblingAtOne.receipt.comparison.divergence.rightCandidateSeparatedWitnessRef.sha256, fixture.chains.b.separationReceipt.receiptDigest, 'fork retains exact right candidate reference');
  equal(siblingAtOne.receipt.truth.siblingForkAtPresentedSequenceDetected, true, 'sibling-fork truth is explicit');
  equal(siblingAtOne.receipt.decision.autonomousActionCount, 0, 'fork receipt triggers no autonomous action');

  const siblingAtTwo = reconcile(fixture, 'ac', 'ad', 'sibling-at-two');
  equal(siblingAtTwo.receipt.decision.classification, 'HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE', 'histories sharing entry A fork at their second entry');
  equal(siblingAtTwo.receipt.comparison.commonPrefixEntryCount, 1, 'second-entry fork preserves exact common prefix count');
  equal(siblingAtTwo.receipt.comparison.divergence.sequence, 2, 'second-entry fork identifies exact divergence sequence');
  equal(siblingAtTwo.receipt.truth.globallyConsistentTransitionLogProven, false, 'co-presented fork detection does not claim global consistency');
  equal(siblingAtTwo.receipt.truth.thirdRootAbsenceProven, false, 'two histories do not prove third-root absence');

  const alternateRecord = reconcile(fixture, 'a', 'alternateA', 'alternate-record');
  equal(alternateRecord.receipt.decision.classification, 'HOLD_ALTERNATE_LOCAL_RECORD_FOR_SAME_CANDIDATE_HEAD', 'different local records for same candidate head are typed');
  equal(alternateRecord.receipt.truth.alternateLocalRecordForSameCandidateDetected, true, 'alternate local record truth is explicit');

  const entryIdEquivocation = reconcile(fixture, 'a', 'equivocatingB', 'entry-id-equivocation');
  equal(entryIdEquivocation.receipt.decision.classification, 'HOLD_ENTRY_ID_EQUIVOCATION_AT_PRESENTED_SEQUENCE', 'same entry id with different candidate is typed equivocation');
  equal(entryIdEquivocation.receipt.truth.entryIdEquivocationDetected, true, 'entry-id equivocation truth is explicit');

  const logDrift = reconcile(fixture, 'empty', 'otherLog', 'log-drift');
  equal(logDrift.receipt.decision.classification, 'HOLD_LOG_IDENTITY_DRIFT', 'different caller log ids are held');
  equal(logDrift.receipt.domain.logIdentityMatches, false, 'log identity mismatch is explicit');
  equal(logDrift.receipt.truth.logAuthorityAuthenticated, false, 'matching or drifting caller log ids authenticate no log authority');

  const genesisDrift = reconcile(fixture, 'empty', 'otherGenesis', 'genesis-drift');
  equal(genesisDrift.receipt.decision.classification, 'HOLD_GENESIS_DRIFT', 'same log id with different genesis is held');
  equal(genesisDrift.receipt.domain.genesisMatches, false, 'genesis mismatch is explicit');
  equal(genesisDrift.receipt.truth.genesisDriftDetected, true, 'genesis-drift truth is explicit');

  const withheldThirdPresentation = fixture.presentations.b;
  check(Reconciliation.verifyPresentation(fixture.presentationInputs.b, withheldThirdPresentation).pass, 'third independently valid history exact-rebuilds before being withheld');
  const serializedPairwise = Reconciliation.stableStringify(siblingAtTwo.receipt);
  check(!serializedPairwise.includes(withheldThirdPresentation.headSeparatedWitnessRef.sha256), 'pairwise A-C versus A-D receipt contains no withheld B head');
  equal(siblingAtTwo.receipt.truth.unpresentedHistoriesExcluded, false, 'unpresented-history nonexclusion remains explicit');
  equal(siblingAtTwo.receipt.truth.globalTransitionUniquenessProven, false, 'pairwise fork detection does not prove global uniqueness');
  equal(siblingAtTwo.receipt.truth.externalTransitionRetentionProven, false, 'pairwise fork detection does not prove external retention');
  equal(siblingAtTwo.receipt.truth.protectedMonotonicStateProven, false, 'pairwise fork detection does not prove protected state');
  equal(siblingAtTwo.receipt.truth.hostAuthorizationAuthenticated, false, 'pairwise fork detection authenticates no host');
  equal(siblingAtTwo.receipt.truth.executionAuthorized, false, 'pairwise fork detection grants no execution authority');
  equal(siblingAtTwo.receipt.truth.automaticCanon, false, 'pairwise fork detection grants no CANON authority');

  const invalidEntry = copy(fixture.presentationInputs.a);
  invalidEntry.items[0].entry.truth.executionAuthorized = true;
  throws(() => Reconciliation.buildPresentation(invalidEntry), /does not exact-rebuild from its caller package/, 'tampered presented entry is refused');
  const invalidPackage = copy(fixture.presentationInputs.a);
  invalidPackage.items[0].advanceInput.transitionReceipt.truth.globalTransitionUniquenessProven = true;
  throws(() => Reconciliation.buildPresentation(invalidPackage), /pairwise transition receipt is invalid/, 'tampered transient transition package is refused');
  const earlyPresentation = copy(fixture.presentationInputs.a);
  earlyPresentation.presentedAt = '2026-08-20T14:40:00.000Z';
  throws(() => Reconciliation.buildPresentation(earlyPresentation), /cannot predate entry 1/, 'presentation cannot predate a presented entry');
  const oversized = copy(fixture.presentationInputs.empty);
  oversized.items = Array.from({ length: 4097 }, () => copy(fixture.presentationInputs.a.items[0]));
  throws(() => Reconciliation.buildPresentation(oversized), /exceeds the bounded entry limit/, 'presentation over bounded entry limit is refused before rebuild');
  const oversizedBytes = copy(fixture.presentationInputs.empty);
  oversizedBytes.presentationId = 'x'.repeat(Reconciliation.MAX_PRESENTATION_CANONICAL_BYTES + 1);
  throws(() => Reconciliation.buildPresentation(oversizedBytes), /exceeds the bounded canonical byte limit/, 'presentation over canonical byte limit is refused before rebuild');
  const unknownPresentation = copy(fixture.presentationInputs.empty);
  unknownPresentation.globallyComplete = true;
  throws(() => Reconciliation.buildPresentation(unknownPresentation), /unknown fields: globallyComplete/, 'undeclared global-completeness input is refused');

  const tamperedPresentationReceipt = copy(fixture.presentations.a);
  tamperedPresentationReceipt.truth.externalRetentionProven = true;
  equal(Reconciliation.verifyPresentation(fixture.presentationInputs.a, tamperedPresentationReceipt).pass, false, 'presentation authority tampering fails exact verification');
  const invalidLeftReconciliation = copy(leftPrefix.input);
  invalidLeftReconciliation.leftPresentation.truth.protectedMonotonicStateProven = true;
  throws(() => Reconciliation.buildReconciliation(invalidLeftReconciliation), /left transition ledger presentation is invalid/, 'tampered left presentation receipt is refused');
  const earlyReconciliation = copy(leftPrefix.input);
  earlyReconciliation.reconciledAt = '2026-08-20T14:49:00.000Z';
  throws(() => Reconciliation.buildReconciliation(earlyReconciliation), /cannot predate either presentation/, 'reconciliation cannot predate either presentation');
  const unknownReconciliation = copy(leftPrefix.input);
  unknownReconciliation.adoptRight = true;
  throws(() => Reconciliation.buildReconciliation(unknownReconciliation), /unknown fields: adoptRight/, 'undeclared branch adoption input is refused');
  const tamperedReceipt = copy(siblingAtTwo.receipt);
  tamperedReceipt.truth.globallyConsistentTransitionLogProven = true;
  equal(Reconciliation.verifyReconciliation(siblingAtTwo.input, tamperedReceipt).pass, false, 'global-consistency receipt tamper fails exact verification');
  equal(
    Reconciliation.stableStringify(Reconciliation.buildReconciliation(copy(siblingAtTwo.input))),
    Reconciliation.stableStringify(siblingAtTwo.receipt),
    'reconciliation rebuild is deterministic from copied input'
  );

  const packagePath = path.join(tempRoot, 'reconciliation-package.json');
  fs.writeFileSync(packagePath, JSON.stringify({ input: siblingAtTwo.input, receipt: siblingAtTwo.receipt }), { encoding: 'utf8', mode: 0o600 });
  const child = runChild(packagePath);
  equal(child.status, 0, 'fresh process rebuilds serialized reconciliation package');
  equal(child.output.verification.pass, true, 'fresh process verifies serialized reconciliation receipt');
  equal(child.output.rebuilt.receiptDigest, siblingAtTwo.receipt.receiptDigest, 'fresh process derives exact reconciliation digest');

  const presentationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-ledger-presentation.schema.json'), 'utf8'));
  const reconciliationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-reconciliation.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  equal(presentationSchema.$id, Reconciliation.PRESENTATION_SCHEMA, 'presentation schema identity matches implementation');
  equal(reconciliationSchema.$id, Reconciliation.RECEIPT_SCHEMA, 'reconciliation schema identity matches implementation');
  equal(reconciliationSchema.properties.status.const, 'TEST', 'reconciliation schema preserves TEST status');
  check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract remains permissionless TEST');
  equal(contract.boundaries.reads.length, 0, 'contract declares no direct read route');
  equal(contract.boundaries.writes.length, 0, 'contract declares no direct write route');
  check(contract.boundaries.refuses.includes('two-presented-roots-as-all-existing-roots'), 'contract refuses two roots as proof of all roots');
  check(contract.boundaries.refuses.includes('pairwise-prefix-as-global-total-order'), 'contract refuses prefix as global total order');
  check(contract.boundaries.refuses.includes('reconciliation-receipt-as-branch-adoption-or-execution-authority'), 'contract refuses reconciliation as adoption or execution authority');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');

  console.log('\nModel Shadow review challenge transition reconciliation selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
