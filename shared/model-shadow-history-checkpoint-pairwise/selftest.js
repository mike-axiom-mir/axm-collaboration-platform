#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const LegacyPairwise = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const LegacyPairwiseFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest-fixture');
const Ledger = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest-fixture');
const History = require('../model-shadow-two-phase-history-checkpoint/model-shadow-two-phase-history-checkpoint');
const Anchor = require('../model-shadow-history-checkpoint-anchor/model-shadow-history-checkpoint-anchor');
const Pairwise = require('./model-shadow-history-checkpoint-pairwise');
const Fixture = require('./selftest-fixture');

let checks = 0;
const observedClassifications = new Set();
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return Fixture.copy(value); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function recordPackage(proposalInput, proposalResult, settlementInput, settlementResult) {
  return {
    proposal: { input: copy(proposalInput), evidence: copy(proposalResult.prewriteEvidence), receipt: copy(proposalResult.proposal) },
    settlement: { input: copy(settlementInput), evidence: copy(settlementResult.postwriteEvidence), receipt: copy(settlementResult.settlement) }
  };
}
function checkpointInput(id, checkpointedAt, options, records) {
  return { checkpointId: id, checkpointedAt, serviceOptions: copy(options), records: copy(records) };
}
function redigestCheckpoint(value, id, checkpointedAt, mutate) {
  const result = copy(value);
  result.checkpointId = id;
  result.checkpointedAt = checkpointedAt;
  if (mutate) mutate(result);
  result.checkpointDigest = null;
  result.checkpointDigest = History.sha256(Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'checkpointDigest')));
  return History.validateCheckpoint(result);
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name);
      const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else entries.push({ path: child, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json');
  fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return target;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', maxBuffer: 128 * 1024 * 1024
  });
  return { status: result.status, value: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function transition(previous, candidate, tag) {
  const input = Fixture.transitionInput(previous, candidate, tag);
  const receipt = Pairwise.buildTransition(input);
  observedClassifications.add(receipt.classification);
  return { input, receipt };
}
function withPackage(checkpoint, tag, authority, minute, options) {
  return Fixture.buildAnchoredPackage(checkpoint, tag, authority, minute, options);
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v23-pairwise-'));
  try {
    const scenario = LedgerFixture.buildScenario(tempRoot);
    const ledgerRoot = makeDir(tempRoot, 'base-ledger');
    const genesisRef = LedgerFixture.separatedRef(scenario.baseChain);
    const options = LedgerFixture.serviceOptions(scenario.state, scenario.sourceRoot, ledgerRoot, 'v23-pairwise-ledger', genesisRef);
    const service = Ledger.createService(copy(options));
    const firstProposalInput = LedgerFixture.proposalInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'v23-first');
    const firstProposal = service.propose(firstProposalInput);
    const firstSettlementInput = LedgerFixture.settlementInput(firstProposalInput, firstProposal, 'v23-first');
    const firstSettlement = service.settle(firstSettlementInput);
    const firstRecord = recordPackage(firstProposalInput, firstProposal, firstSettlementInput, firstSettlement);
    const previousCheckpoint = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v23-previous', '2026-08-20T15:36:00.000Z', options, [firstRecord]
    ));

    equal(Pairwise.VERSION, '2.3.0', 'version is exact');
    equal(Pairwise.STATUS, 'TEST', 'status remains TEST');
    equal(Pairwise.CLASSIFICATIONS.length, 15, 'classification set is closed to fifteen outcomes');
    equal(Pairwise.MAX_INPUT_CANONICAL_BYTES, 138412032, 'pairwise envelope covers two bounded v2.2 inputs and receipts');
    equal(History.validateCheckpoint(previousCheckpoint), previousCheckpoint, 'previous v2.1 checkpoint self-validates');

    const authority = Fixture.createAuthority('stable');
    const previousPackage = withPackage(previousCheckpoint, 'previous', authority, 37);
    equal(Anchor.verifyAnchoredCheckpoint(previousPackage.anchoredInput, previousPackage.anchoredReceipt).pass, true, 'previous v2.2 package exact-rebuilds');

    const exact = transition(previousPackage, previousPackage, 'exact');
    equal(exact.receipt.classification, 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY', 'same anchored package is exact replay');
    equal(exact.receipt.decision.holdRequired, false, 'exact replay is not a hold');
    equal(exact.receipt.decision.forwardHistoryCandidate, false, 'exact replay is not a forward candidate');

    const recheckpointValue = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v23-recheckpoint', '2026-08-20T15:37:00.000Z', options, [firstRecord]
    ));
    const recheckpointPackage = withPackage(recheckpointValue, 'recheckpoint', authority, 38);
    const recheckpoint = transition(previousPackage, recheckpointPackage, 'recheckpoint');
    equal(recheckpoint.receipt.classification, 'PRESENTED_HISTORY_EXACT_RECHECKPOINT', 'later same snapshot and history is exact recheckpoint');
    equal(recheckpoint.receipt.comparison.sameHistory, true, 'recheckpoint preserves complete history');
    equal(recheckpoint.receipt.comparison.sameSnapshotBinding, true, 'recheckpoint preserves snapshot binding');
    equal(recheckpoint.receipt.decision.forwardHistoryCandidate, false, 'recheckpoint is not misreported as extension');

    const forkARoot = path.join(tempRoot, 'fork-a-ledger');
    const forkBRoot = path.join(tempRoot, 'fork-b-ledger');
    fs.cpSync(ledgerRoot, forkARoot, { recursive: true });
    fs.cpSync(ledgerRoot, forkBRoot, { recursive: true });
    const thirdChallenge = StateFixture.issueChallenge(scenario.state, 0x63, {
      issuedAt: '2026-08-20T15:32:00.000Z', expiresAt: '2026-08-20T15:50:00.000Z'
    });
    StateFixture.answer(scenario.state, thirdChallenge, '2026-08-20T15:32:20.000Z');
    const thirdSnapshot = Continuity.captureState(StateFixture.observationOptions(
      scenario.state, 'local-possession-observation:v23-third', '2026-08-20T15:32:30.000Z'
    ));
    const thirdCheckpoint = LedgerFixture.checkpoint(thirdSnapshot, 'local-possession-checkpoint:v23-third', '2026-08-20T15:32:40.000Z');
    const thirdChain = LegacyPairwiseFixture.buildSeparatedChain(thirdCheckpoint, 'v23-third', scenario.authority, { minute: 33 });
    const secondTransitionInput = LegacyPairwiseFixture.transitionInput(
      scenario.secondChain, thirdChain, 'v23-second', '2026-08-20T15:36:00.000Z'
    );
    const secondTransitionReceipt = LegacyPairwise.buildTransition(secondTransitionInput);

    function buildFork(root, tag, times, checkpointTime) {
      const forkOptions = Object.assign(copy(options), { stateRoot: root });
      const forkService = Ledger.createService(copy(forkOptions));
      const proposalInput = LedgerFixture.proposalInput(secondTransitionInput, secondTransitionReceipt, tag, times.proposal);
      const proposal = forkService.propose(proposalInput);
      const settlementInput = LedgerFixture.settlementInput(proposalInput, proposal, tag, times.settlement);
      const settlement = forkService.settle(settlementInput);
      const record = recordPackage(proposalInput, proposal, settlementInput, settlement);
      const checkpoint = History.createCheckpoint(checkpointInput('history-checkpoint:' + tag, checkpointTime, forkOptions, [firstRecord, record]));
      return { checkpoint, options: forkOptions, record };
    }
    const forkA = buildFork(forkARoot, 'v23-fork-a', {
      proposal: { observedAt: '2026-08-20T15:37:00.000Z', checkedAt: '2026-08-20T15:37:10.000Z', proposedAt: '2026-08-20T15:37:20.000Z' },
      settlement: { observedAt: '2026-08-20T15:37:30.000Z', checkedAt: '2026-08-20T15:37:40.000Z', settledAt: '2026-08-20T15:38:00.000Z' }
    }, '2026-08-20T15:39:00.000Z');
    const forkB = buildFork(forkBRoot, 'v23-fork-b', {
      proposal: { observedAt: '2026-08-20T15:37:05.000Z', checkedAt: '2026-08-20T15:37:15.000Z', proposedAt: '2026-08-20T15:37:25.000Z' },
      settlement: { observedAt: '2026-08-20T15:37:35.000Z', checkedAt: '2026-08-20T15:37:45.000Z', settledAt: '2026-08-20T15:38:05.000Z' }
    }, '2026-08-20T15:40:00.000Z');
    const forkAPackage = withPackage(forkA.checkpoint, 'fork-a', authority, 41);
    const forkBPackage = withPackage(forkB.checkpoint, 'fork-b', authority, 42);

    const beforeTree = treeDigest(ledgerRoot);
    const forwardA = transition(previousPackage, forkAPackage, 'forward-a');
    const afterTree = treeDigest(ledgerRoot);
    equal(beforeTree, afterTree, 'pairwise comparison leaves origin ledger byte-for-byte unchanged');
    equal(forwardA.receipt.classification, 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'fork A strictly extends complete previous history');
    equal(forwardA.receipt.comparison.commonProposalPrefixCount, 1, 'forward comparison preserves every previous proposal reference');
    equal(forwardA.receipt.comparison.commonSettlementPrefixCount, 1, 'forward comparison preserves every previous settlement reference');
    equal(forwardA.receipt.comparison.anchorContinuityProfileMatches, true, 'normalized anchor profile remains stable despite policy self-digest change');
    equal(forwardA.receipt.comparison.witnessPolicyContinuityProfileMatches, true, 'normalized witness profile remains stable despite checkpoint-bound policy digest change');
    check(forwardA.receipt.anchorContinuity.previousPolicyRef.sha256 !== forwardA.receipt.anchorContinuity.candidatePolicyRef.sha256, 'anchor policy validity-window change produces a different exact self-digest');
    check(forwardA.receipt.witnessContinuity.previousPolicyRef.sha256 !== forwardA.receipt.witnessContinuity.candidatePolicyRef.sha256, 'witness checkpoint binding produces a different exact self-digest');
    equal(forwardA.receipt.decision.forwardHistoryCandidate, true, 'strict prefix is a review-only forward candidate');
    equal(forwardA.receipt.decision.autonomousActionCount, 0, 'forward candidate authorizes no autonomous action');
    equal(forwardA.receipt.truth.executionAuthorized, false, 'forward candidate grants no execution authority');

    const forwardB = transition(previousPackage, forkBPackage, 'forward-b');
    equal(forwardB.receipt.classification, 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'fork B independently extends the same previous history');
    check(forwardA.receipt.candidateCheckpointRef.sha256 !== forwardB.receipt.candidateCheckpointRef.sha256, 'independent forward candidates have distinct checkpoint digests');
    equal(forwardA.receipt.truth.twoIndependentCandidatesMayExtendSamePrevious, true, 'dual-candidate counterexample is explicit');
    equal(forwardA.receipt.truth.withheldBranchesExcluded, false, 'a withheld fork remains unexcluded');
    const forkComparison = transition(forkAPackage, forkBPackage, 'fork-visible');
    equal(forkComparison.receipt.classification, 'HOLD_HISTORY_REPLACEMENT_OR_FORK', 'co-presented divergent candidates expose replacement or fork');
    equal(forkComparison.receipt.comparison.commonProposalPrefixCount, 1, 'fork comparison preserves only shared proposal prefix');
    equal(forkComparison.receipt.comparison.commonSettlementPrefixCount, 1, 'fork comparison preserves only shared settlement prefix');

    const rollbackCheckpoint = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v23-later-presented-prefix', '2026-08-20T15:42:00.000Z', options, [firstRecord]
    ));
    const rollbackPackage = withPackage(rollbackCheckpoint, 'rollback-prefix', authority, 43);
    const rollback = transition(forkAPackage, rollbackPackage, 'rollback');
    equal(rollback.receipt.classification, 'HOLD_STRICT_HISTORY_ROLLBACK', 'later-presented strict earlier prefix is typed rollback');
    equal(rollback.receipt.comparison.candidateHistoryPrefixesPrevious, true, 'rollback candidate is an exact strict prefix');
    equal(rollback.receipt.truth.deletionOrRollbackPrevented, false, 'rollback detection claims no prevention');

    const alternatePackage = withPackage(previousCheckpoint, 'alternate-same-checkpoint', authority, 39);
    const alternate = transition(previousPackage, alternatePackage, 'alternate');
    equal(alternate.receipt.classification, 'HOLD_ALTERNATE_ANCHORED_PACKAGE_FOR_SAME_CHECKPOINT', 'different anchored package for same checkpoint is held');
    equal(alternate.receipt.comparison.sameCheckpointDigest, true, 'alternate package still binds same checkpoint bytes');
    equal(alternate.receipt.comparison.sameAnchoredReceiptDigest, false, 'alternate package receipt is distinct');

    const collisionCheckpoint = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v23-time-collision', '2026-08-20T15:36:00.000Z', options, [firstRecord]
    ));
    const collisionPackage = withPackage(collisionCheckpoint, 'time-collision', authority, 39);
    equal(transition(previousPackage, collisionPackage, 'time-collision').receipt.classification, 'HOLD_PRESENTED_TIME_COLLISION', 'distinct checkpoint at same checkpoint time is held');
    equal(transition(recheckpointPackage, previousPackage, 'time-rollback').receipt.classification, 'HOLD_PRESENTED_TIME_ROLLBACK', 'earlier candidate time is held as presented rollback');

    const equivocationCheckpoint = redigestCheckpoint(
      forkA.checkpoint, previousCheckpoint.checkpointId, '2026-08-20T15:41:00.000Z'
    );
    const equivocationPackage = withPackage(equivocationCheckpoint, 'checkpoint-equivocation', authority, 44);
    equal(transition(previousPackage, equivocationPackage, 'checkpoint-equivocation').receipt.classification, 'HOLD_CHECKPOINT_ID_EQUIVOCATION', 'same checkpoint id with different digest is held');

    const snapshotDriftCheckpoint = redigestCheckpoint(
      recheckpointValue, 'history-checkpoint:v23-snapshot-drift', '2026-08-20T15:43:00.000Z',
      value => { value.snapshotBinding.sha256 = History.sha256('synthetic-v2.3-snapshot-drift'); }
    );
    const snapshotDriftPackage = withPackage(snapshotDriftCheckpoint, 'snapshot-drift', authority, 45);
    equal(transition(previousPackage, snapshotDriftPackage, 'snapshot-drift').receipt.classification, 'HOLD_SNAPSHOT_CHANGED_WITHOUT_HISTORY_EXTENSION', 'snapshot drift without history extension is held');

    const ledgerDriftCheckpoint = redigestCheckpoint(
      forkA.checkpoint, 'history-checkpoint:v23-ledger-drift', '2026-08-20T15:44:00.000Z',
      value => { value.logIdDigest = History.sha256('synthetic-v2.3-other-log'); }
    );
    const ledgerDriftPackage = withPackage(ledgerDriftCheckpoint, 'ledger-drift', authority, 46);
    const ledgerDrift = transition(previousPackage, ledgerDriftPackage, 'ledger-drift');
    equal(ledgerDrift.receipt.classification, 'HOLD_LEDGER_IDENTITY_DRIFT', 'ledger identity drift is held before history acceptance');
    equal(ledgerDrift.receipt.comparison.ledgerIdentityDriftDimensions, ['logIdDigest'], 'ledger drift names exact changed dimension');

    const anchorIdentityPackage = withPackage(forkA.checkpoint, 'anchor-id-drift', authority, 47, { anchorId: 'history-checkpoint-pairwise-anchor:different' });
    equal(transition(previousPackage, anchorIdentityPackage, 'anchor-id-drift').receipt.classification, 'HOLD_ANCHOR_IDENTITY_DRIFT', 'anchor identity drift is held');
    const anchorProfilePackage = withPackage(forkA.checkpoint, 'anchor-profile-drift', authority, 47, { anchorEpoch: 2 });
    equal(transition(previousPackage, anchorProfilePackage, 'anchor-profile-drift').receipt.classification, 'HOLD_ANCHOR_POLICY_PROFILE_DRIFT', 'self-declared anchor epoch change is held without rotation authority');
    const witnessIdentityPackage = withPackage(forkA.checkpoint, 'witness-id-drift', authority, 47, { witnessPolicyId: 'history-checkpoint-pairwise-witness-policy:different' });
    equal(transition(previousPackage, witnessIdentityPackage, 'witness-id-drift').receipt.classification, 'HOLD_WITNESS_POLICY_IDENTITY_DRIFT', 'witness policy identity drift is held');
    const changedWitnessAuthority = Fixture.createAuthority('witness-profile-change', {
      witnessPolicyId: authority.witnessPolicyId,
      anchorPolicyId: authority.anchorPolicyId,
      anchorId: authority.anchorId,
      anchorPairs: authority.anchorPairs,
      anchorKeyIds: authority.anchorKeyIds,
      anchorPrincipals: authority.anchorPrincipals
    });
    const witnessProfilePackage = withPackage(forkA.checkpoint, 'witness-profile-drift', changedWitnessAuthority, 47);
    equal(transition(previousPackage, witnessProfilePackage, 'witness-profile-drift').receipt.classification, 'HOLD_WITNESS_POLICY_PROFILE_DRIFT', 'witness key profile drift is held without rotation authority');

    const replacementAuthority = Fixture.createAuthority('joint-replacement');
    const replacedPreviousCheckpoint = redigestCheckpoint(
      previousCheckpoint, 'history-checkpoint:v23-replaced-previous', '2026-08-20T15:50:00.000Z'
    );
    const replacedCandidateCheckpoint = redigestCheckpoint(
      forkA.checkpoint, 'history-checkpoint:v23-replaced-candidate', '2026-08-20T15:51:00.000Z'
    );
    const replacedPreviousPackage = withPackage(replacedPreviousCheckpoint, 'joint-replaced-previous', replacementAuthority, 52);
    const replacedCandidatePackage = withPackage(replacedCandidateCheckpoint, 'joint-replaced-candidate', replacementAuthority, 54);
    const jointReplacement = transition(replacedPreviousPackage, replacedCandidatePackage, 'joint-replacement');
    equal(jointReplacement.receipt.classification, 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'jointly replaced checkpoints policies signatures and anchors form another valid relative pair');
    check(jointReplacement.receipt.previousCheckpointRef.sha256 !== forwardA.receipt.previousCheckpointRef.sha256, 'joint replacement changes previous checkpoint digest');
    check(jointReplacement.receipt.anchorContinuity.previousProfileDigest !== forwardA.receipt.anchorContinuity.previousProfileDigest, 'joint replacement changes anchor profile');
    equal(jointReplacement.receipt.truth.originalPairContinuityProven, false, 'joint replacement proves no continuity with original pair');
    equal(jointReplacement.receipt.truth.jointPairReplacementStillPossible, true, 'joint replacement limitation is explicit');

    const child = runChild(writePackage(tempRoot, 'fresh-process', { input: forwardA.input }));
    equal(child.status, 0, 'fresh process rebuilds forward pairwise receipt');
    check(child.value.pid !== process.pid, 'fresh rebuild uses a distinct process');
    equal(child.value.result, forwardA.receipt, 'fresh-process receipt is exact');
    equal(Pairwise.verifyTransition(forwardA.input, forwardA.receipt).pass, true, 'forward receipt exact-verifies');
    const tamperedInput = copy(forwardA.input);
    tamperedInput.candidateAnchoredReceipt.receiptDigest = 'sha256:' + '0'.repeat(64);
    equal(Pairwise.verifyTransition(tamperedInput, forwardA.receipt).pass, false, 'tampered candidate anchored receipt fails closed');
    const tamperedReceipt = copy(forwardA.receipt);
    tamperedReceipt.classification = 'PRESENTED_HISTORY_EXACT_RECHECKPOINT';
    equal(Pairwise.verifyTransition(forwardA.input, tamperedReceipt).pass, false, 'tampered pairwise receipt fails closed');
    const earlyComparison = copy(forwardA.input);
    earlyComparison.comparedAt = '2026-08-20T15:00:00.000Z';
    equal(Pairwise.verifyTransition(earlyComparison, forwardA.receipt).pass, false, 'comparison time before anchored verification yields no receipt');
    const unknownFieldInput = copy(forwardA.input);
    unknownFieldInput.unexpected = true;
    equal(Pairwise.verifyTransition(unknownFieldInput, forwardA.receipt).pass, false, 'unknown input field fails closed');
    const oversizedReceipt = { schema: Pairwise.RECEIPT_SCHEMA, padding: 'x'.repeat(Pairwise.MAX_RECEIPT_CANONICAL_BYTES + 1) };
    equal(Pairwise.verifyTransition(forwardA.input, oversizedReceipt).pass, false, 'oversized pairwise receipt fails before comparison');

    const publicReceipt = JSON.stringify(forwardA.receipt);
    equal(publicReceipt.includes('BEGIN PUBLIC KEY'), false, 'receipt contains no raw public key');
    equal(publicReceipt.includes(forwardA.input.previousAnchoredInput.policyAuthorizations[0].signature), false, 'receipt contains no raw signature');
    equal(publicReceipt.includes(ledgerRoot), false, 'receipt contains no ledger path');
    equal(publicReceipt.includes('PRIVATE KEY'), false, 'receipt contains no private key material');
    equal(forwardA.receipt.truth.providerInvoked, false, 'receipt claims no provider invocation');
    equal(forwardA.receipt.truth.humanBenefitProven, false, 'receipt claims no human benefit');
    equal(forwardA.receipt.truth.automaticCanon, false, 'receipt claims no automatic CANON');

    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'transition.schema.json'), 'utf8'));
    equal(schema.additionalProperties, false, 'schema closes unknown top-level fields');
    equal(schema.properties.classification.enum, Pairwise.CLASSIFICATIONS, 'schema classification enum matches runtime exactly');
    equal(schema.properties.decision.properties.autonomousActionCount.const, 0, 'schema prevents autonomous action');
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract).pass, true, 'module contract matches Workshop contract shape');
    equal(contract.version, 'v2.3', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.filter(value => value.startsWith('model.shadow.portable-history-checkpoint-pairwise.')).length, 20, 'contract provides exactly twenty bounded v2.3 capabilities');
    equal(Array.from(observedClassifications).sort(), Pairwise.CLASSIFICATIONS.slice().sort(), 'focused suite observes every closed classification');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-history-checkpoint-pairwise.js'), 'utf8');
    check(implementation.includes("require('../model-shadow-history-checkpoint-anchor/"), 'runtime composes exact v2.2 module');
    equal(implementation.includes("require('fs')"), false, 'runtime imports no filesystem');
    equal(implementation.includes('writeFile'), false, 'runtime contains no file-write operation');
    equal(implementation.includes('fetch('), false, 'runtime contains no network fetch');
    equal(implementation.includes('crypto.sign'), false, 'runtime creates no signature');
    equal(implementation.includes('createPrivateKey'), false, 'runtime accepts no private key API');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main();
