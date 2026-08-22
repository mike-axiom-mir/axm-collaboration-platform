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
const Ledger = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
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

function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function writePackage(parent, name, value) {
  const result = path.join(parent, name + '.json');
  fs.writeFileSync(result, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return result;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { status: result.status, parsed: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function runChildAsync(packagePath) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], { stdio: ['ignore', 'pipe', 'pipe'] });
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
function receiverFor(state, stateRoot) {
  return Possession.createReceiver(Object.assign(copy(state.possession.receiverOptions), { stateRoot }));
}
function answerOn(receiver, state, challenge, answeredAt) {
  return receiver.answer(Object.assign(copy(state.possession.answerInput), { challenge: copy(challenge), answeredAt }));
}
function snapshotOn(state, stateRoot, id, observedAt) {
  return Continuity.captureState(Object.assign(StateFixture.observationOptions(state, id, observedAt), { stateRoot }));
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-two-phase-settlement-'));
  let cleanupVerified = false;
  try {
    const scenario = Fixture.buildScenario(tempRoot);
    const ledgerRoot = makeDir(tempRoot, 'primary-ledger');
    const genesisRef = Fixture.separatedRef(scenario.baseChain);
    const options = Fixture.serviceOptions(scenario.state, scenario.sourceRoot, ledgerRoot, 'two-phase-log:primary', genesisRef);
    const service = Ledger.createService(copy(options));
    const firstProposalInput = Fixture.proposalInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'first');

    equal(Ledger.VERSION, '2.0.0', 'version is exact');
    equal(Ledger.STATUS, 'TEST', 'status remains TEST');
    equal(Ledger.MAX_PROPOSALS, 10000, 'proposal resource bound is exact');
    equal(Ledger.MAX_ARTIFACT_CANONICAL_BYTES, 1048576, 'artifact byte bound is exact');
    equal(Ledger.PROPOSE_CONFIRMATION, 'PROPOSE EXACT CURRENT LOCAL POSSESSION TRANSITION ONCE', 'proposal confirmation is exact');
    equal(Ledger.SETTLE_CONFIRMATION, 'SETTLE EXACT PENDING LOCAL POSSESSION TRANSITION ONCE', 'settlement confirmation is exact');
    ['manifest', 'proposal', 'settlement', 'snapshot'].forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-' + name + '.schema.json'), 'utf8'));
      equal(schema.type, 'object', name + ' schema is valid JSON object schema');
      equal(schema.additionalProperties, false, name + ' schema rejects unknown top-level fields');
    });
    equal(service.inspect(), null, 'absent ledger inspection is read-only');

    const noProposalConfirmation = copy(firstProposalInput);
    noProposalConfirmation.confirmation = 'PROPOSE';
    throwsCode(() => service.propose(noProposalConfirmation), 'PROPOSAL_CONFIRMATION_REQUIRED', 'proposal write requires exact confirmation');
    equal(fs.existsSync(path.join(ledgerRoot, Ledger.NAMESPACE)), false, 'failed proposal confirmation creates no namespace');
    throwsCode(() => Ledger.createService(Object.assign(copy(options), { stateRoot: path.parse(ledgerRoot).root })), 'STATE_ROOT_INVALID', 'filesystem root is refused as state root');

    const firstProposal = service.propose(firstProposalInput);
    equal(firstProposal.proposal.schema, Ledger.PROPOSAL_SCHEMA, 'proposal schema is exact');
    equal(firstProposal.proposal.log.sequence, 1, 'first proposal has sequence one');
    equal(firstProposal.proposal.prewriteCurrentnessAuditReceipt.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'proposal retains exact prewrite match');
    equal(firstProposal.proposal.previousSettledWitnessRef, genesisRef, 'proposal starts at genesis settled head');
    equal(firstProposal.proposal.truth.proposalAdvancesSettledHead, false, 'proposal truth refuses settled-head advance');
    equal(firstProposal.proposal.truth.sourceCaptureAndProposalWriteAtomic, false, 'proposal truth refuses atomic capture/write');
    equal(service.verifyProposalPersisted(firstProposalInput, firstProposal.prewriteEvidence, firstProposal.proposal).pass, true, 'caller package exact-rebuilds persisted proposal');
    const pending = service.inspect();
    equal(pending.proposalCount, 1, 'pending snapshot has one proposal');
    equal(pending.settlementCount, 0, 'pending snapshot has no settlement');
    equal(pending.pendingProposalRef.sha256, firstProposal.proposal.proposalDigest, 'pending snapshot binds proposal digest');
    equal(pending.currentSettledHeadSeparatedWitnessRef, genesisRef, 'pending proposal does not advance settled head');
    throwsCode(() => service.propose(Object.assign(copy(firstProposalInput), { proposalId: 'two-phase:blocked-second' })), 'PENDING_SETTLEMENT', 'new proposal is refused while trailing proposal is pending');

    const proposalText = fs.readFileSync(path.join(ledgerRoot, Ledger.NAMESPACE, Ledger.PROPOSALS_DIRECTORY, '000000000001.json'), 'utf8');
    equal(proposalText.includes('BEGIN PUBLIC KEY'), false, 'stored proposal contains no raw public key');
    equal(proposalText.includes('"signature"'), false, 'stored proposal contains no raw signature');
    equal(proposalText.includes(scenario.sourceRoot), false, 'stored proposal contains no source path');

    const pendingPath = writePackage(tempRoot, 'pending-inspect', {
      action: 'inspect', options, proposalInput: firstProposalInput, prewriteEvidence: firstProposal.prewriteEvidence, proposalReceipt: firstProposal.proposal
    });
    const pendingChild = runChild(pendingPath);
    equal(pendingChild.status, 0, 'fresh process reloads pending proposal');
    check(pendingChild.parsed.pid !== process.pid, 'pending reload uses distinct process');
    equal(pendingChild.parsed.result.snapshot.pendingProposalRef.sha256, firstProposal.proposal.proposalDigest, 'fresh process sees exact pending proposal');
    equal(pendingChild.parsed.result.proposalVerification.pass, true, 'fresh process exact-rebuilds pending proposal');

    const noSettlementConfirmation = Fixture.settlementInput(firstProposalInput, firstProposal, 'first');
    noSettlementConfirmation.confirmation = 'SETTLE';
    throwsCode(() => service.settle(noSettlementConfirmation), 'SETTLEMENT_CONFIRMATION_REQUIRED', 'settlement write requires exact confirmation');
    equal(service.inspect().settlementCount, 0, 'failed settlement confirmation preserves pending proposal');
    const wrongProposalSettlement = Fixture.settlementInput(firstProposalInput, firstProposal, 'wrong-proposal', {
      observedAt: '2026-08-20T15:34:30.000Z', checkedAt: '2026-08-20T15:35:00.000Z', settledAt: '2026-08-20T15:35:30.000Z'
    });
    wrongProposalSettlement.proposalReceipt.proposalId += ':tampered';
    throwsCode(() => service.settle(wrongProposalSettlement), 'PROPOSAL_PACKAGE_MISMATCH', 'settlement refuses a mismatched caller proposal package');
    equal(service.inspect().settlementCount, 0, 'mismatched proposal package preserves pending state');

    const firstSettlementInput = Fixture.settlementInput(firstProposalInput, firstProposal, 'first');
    const firstSettlementPath = writePackage(tempRoot, 'first-settlement', { action: 'settle', options, settlementInput: firstSettlementInput });
    const firstSettlementChild = runChild(firstSettlementPath);
    equal(firstSettlementChild.status, 0, 'fresh process settles pending proposal');
    const firstSettlement = firstSettlementChild.parsed.result;
    equal(firstSettlement.settlement.decision.classification, 'SETTLED_POSTWRITE_SOURCE_MATCH', 'exact postwrite source match settles proposal');
    equal(firstSettlement.settlement.decision.settledHeadAdvanced, true, 'exact settlement advances local settled head');
    equal(firstSettlement.settlement.truth.intermediateOrRevertedSourceChangesExcluded, false, 'settlement refuses intermediate-change exclusion');
    equal(firstSettlement.settlement.truth.candidateStillCurrentAfterSettlementProven, false, 'settlement refuses later-currentness claim');
    equal(firstSettlement.settlement.truth.hostAuthorizationAuthenticated, false, 'settlement confirmation authenticates no host');
    equal(firstSettlement.settlement.truth.executionAuthorized, false, 'settlement grants no execution authority');
    equal(firstSettlement.settlement.truth.adoptionAuthorized, false, 'settlement grants no adoption authority');
    equal(firstSettlement.settlement.truth.automaticCanon, false, 'settlement grants no CANON authority');
    equal(service.verifySettlementPersisted(firstSettlementInput, firstSettlement.postwriteEvidence, firstSettlement.settlement).pass, true, 'caller package exact-rebuilds first settlement');
    const firstSettledSnapshot = service.inspect();
    equal(firstSettledSnapshot.pendingProposalRef, null, 'exact settlement clears pending proposal');
    equal(firstSettledSnapshot.currentSettledHeadSeparatedWitnessRef, Fixture.separatedRef(scenario.secondChain), 'exact settlement advances to candidate head');
    const staleAfterSettlement = copy(firstProposalInput);
    staleAfterSettlement.proposalId = 'local-possession-two-phase-proposal:stale-after-settlement';
    staleAfterSettlement.observationId = 'local-possession-two-phase-prewrite-observation:stale-after-settlement';
    staleAfterSettlement.auditId = 'local-possession-two-phase-prewrite-audit:stale-after-settlement';
    throwsCode(() => service.propose(staleAfterSettlement), 'STALE_SETTLED_HEAD', 'accepted transition cannot propose again from the older settled head');

    const forkLedgerA = path.join(tempRoot, 'fork-ledger-a');
    const forkLedgerB = path.join(tempRoot, 'fork-ledger-b');
    const forkSourceA = path.join(tempRoot, 'fork-source-a');
    const forkSourceB = path.join(tempRoot, 'fork-source-b');
    fs.cpSync(ledgerRoot, forkLedgerA, { recursive: true });
    fs.cpSync(ledgerRoot, forkLedgerB, { recursive: true });
    fs.cpSync(scenario.sourceRoot, forkSourceA, { recursive: true });
    fs.cpSync(scenario.sourceRoot, forkSourceB, { recursive: true });
    const forkChallengeA = StateFixture.issueChallenge(scenario.state, 0x71, { issuedAt: '2026-08-20T15:36:00.000Z', expiresAt: '2026-08-20T15:46:00.000Z' });
    const forkChallengeB = StateFixture.issueChallenge(scenario.state, 0x72, { issuedAt: '2026-08-20T15:36:00.000Z', expiresAt: '2026-08-20T15:46:00.000Z' });
    answerOn(receiverFor(scenario.state, forkSourceA), scenario.state, forkChallengeA, '2026-08-20T15:36:20.000Z');
    answerOn(receiverFor(scenario.state, forkSourceB), scenario.state, forkChallengeB, '2026-08-20T15:36:20.000Z');
    const forkSnapshotA = snapshotOn(scenario.state, forkSourceA, 'local-possession-observation:two-phase-fork-a', '2026-08-20T15:36:30.000Z');
    const forkSnapshotB = snapshotOn(scenario.state, forkSourceB, 'local-possession-observation:two-phase-fork-b', '2026-08-20T15:36:30.000Z');
    const forkCheckpointA = Fixture.checkpoint(forkSnapshotA, 'local-possession-checkpoint:two-phase-fork-a', '2026-08-20T15:36:40.000Z');
    const forkCheckpointB = Fixture.checkpoint(forkSnapshotB, 'local-possession-checkpoint:two-phase-fork-b', '2026-08-20T15:36:40.000Z');
    const forkChainA = PairwiseFixture.buildSeparatedChain(forkCheckpointA, 'two-phase-fork-a', scenario.authority, { minute: 37 });
    const forkChainB = PairwiseFixture.buildSeparatedChain(forkCheckpointB, 'two-phase-fork-b', scenario.authority, { minute: 37 });
    const forkTransitionInputA = PairwiseFixture.transitionInput(scenario.secondChain, forkChainA, 'two-phase-fork-a', '2026-08-20T15:40:00.000Z');
    const forkTransitionInputB = PairwiseFixture.transitionInput(scenario.secondChain, forkChainB, 'two-phase-fork-b', '2026-08-20T15:40:00.000Z');
    const forkProposalInputA = Fixture.proposalInput(forkTransitionInputA, Pairwise.buildTransition(forkTransitionInputA), 'fork-a', { observedAt: '2026-08-20T15:41:00.000Z', checkedAt: '2026-08-20T15:41:30.000Z', proposedAt: '2026-08-20T15:42:00.000Z' });
    const forkProposalInputB = Fixture.proposalInput(forkTransitionInputB, Pairwise.buildTransition(forkTransitionInputB), 'fork-b', { observedAt: '2026-08-20T15:41:00.000Z', checkedAt: '2026-08-20T15:41:30.000Z', proposedAt: '2026-08-20T15:42:00.000Z' });
    const forkOptionsA = Fixture.serviceOptions(scenario.state, forkSourceA, forkLedgerA, options.logId, genesisRef);
    const forkOptionsB = Fixture.serviceOptions(scenario.state, forkSourceB, forkLedgerB, options.logId, genesisRef);
    const racePackage = writePackage(tempRoot, 'fork-a-race', { action: 'propose', options: forkOptionsA, proposalInput: forkProposalInputA });
    const raceResults = await Promise.all([runChildAsync(racePackage), runChildAsync(racePackage)]);
    equal(raceResults.filter(result => result.status === 0).length, 1, 'exclusive proposal create admits one concurrent writer');
    equal(raceResults.filter(result => ['PROPOSAL_ALREADY_RECORDED', 'PROPOSAL_CONTENTION', 'PENDING_SETTLEMENT'].includes(result.parsed.code)).length, 1, 'concurrent proposal loser receives typed contention');
    const forkProposalA = raceResults.find(result => result.status === 0).parsed.result;
    const forkServiceA = Ledger.createService(forkOptionsA);
    const forkServiceB = Ledger.createService(forkOptionsB);
    const forkProposalB = forkServiceB.propose(forkProposalInputB);
    const forkSettlementInputA = Fixture.settlementInput(forkProposalInputA, forkProposalA, 'fork-a', { observedAt: '2026-08-20T15:42:30.000Z', checkedAt: '2026-08-20T15:43:00.000Z', settledAt: '2026-08-20T15:43:30.000Z' });
    const forkSettlementInputB = Fixture.settlementInput(forkProposalInputB, forkProposalB, 'fork-b', { observedAt: '2026-08-20T15:42:30.000Z', checkedAt: '2026-08-20T15:43:00.000Z', settledAt: '2026-08-20T15:43:30.000Z' });
    const forkSettlementA = forkServiceA.settle(forkSettlementInputA);
    const forkSettlementB = forkServiceB.settle(forkSettlementInputB);
    equal(forkSettlementA.settlement.decision.classification, 'SETTLED_POSTWRITE_SOURCE_MATCH', 'fork A settles locally');
    equal(forkSettlementB.settlement.decision.classification, 'SETTLED_POSTWRITE_SOURCE_MATCH', 'fork B settles locally');
    check(forkServiceA.inspect().currentSettledHeadSeparatedWitnessRef.sha256 !== forkServiceB.inspect().currentSettledHeadSeparatedWitnessRef.sha256, 'independent roots settle divergent candidate heads');
    equal(forkSettlementA.settlement.truth.independentStateRootsExcluded, false, 'settlement truth preserves independent roots');
    equal(forkSettlementB.settlement.truth.globalTransitionUniquenessProven, false, 'divergent settlement claims no global uniqueness');

    const deletedNamespace = path.join(forkLedgerA, Ledger.NAMESPACE);
    verifiedRemove(deletedNamespace, forkLedgerA);
    const forkFromGenesisInput = PairwiseFixture.transitionInput(scenario.baseChain, forkChainA, 'two-phase-fork-a-from-genesis', '2026-08-20T15:44:00.000Z');
    const reopenedProposalInput = Fixture.proposalInput(forkFromGenesisInput, Pairwise.buildTransition(forkFromGenesisInput), 'fork-a-reopened', { observedAt: '2026-08-20T15:45:00.000Z', checkedAt: '2026-08-20T15:45:30.000Z', proposedAt: '2026-08-20T15:46:00.000Z' });
    const reopenedService = Ledger.createService(forkOptionsA);
    const reopenedProposal = reopenedService.propose(reopenedProposalInput);
    const reopenedSettlementInput = Fixture.settlementInput(reopenedProposalInput, reopenedProposal, 'fork-a-reopened', { observedAt: '2026-08-20T15:46:30.000Z', checkedAt: '2026-08-20T15:47:00.000Z', settledAt: '2026-08-20T15:47:30.000Z' });
    const reopenedSettlement = reopenedService.settle(reopenedSettlementInput);
    equal(reopenedProposal.proposal.log.sequence, 1, 'deleting local namespace reopens proposal sequence one');
    equal(reopenedSettlement.settlement.truth.deletionOrRollbackPrevented, false, 'reopened settlement claims no deletion prevention');

    const thirdChallenge = StateFixture.issueChallenge(scenario.state, 0x53, { issuedAt: '2026-08-20T15:32:00.000Z', expiresAt: '2026-08-20T15:46:00.000Z' });
    StateFixture.answer(scenario.state, thirdChallenge, '2026-08-20T15:32:20.000Z');
    const thirdSnapshot = Continuity.captureState(StateFixture.observationOptions(scenario.state, 'local-possession-observation:two-phase-third', '2026-08-20T15:32:30.000Z'));
    const thirdCheckpoint = Fixture.checkpoint(thirdSnapshot, 'local-possession-checkpoint:two-phase-third', '2026-08-20T15:32:40.000Z');
    const thirdChain = PairwiseFixture.buildSeparatedChain(thirdCheckpoint, 'two-phase-third', scenario.authority, { minute: 33 });
    const secondTransitionInput = PairwiseFixture.transitionInput(scenario.secondChain, thirdChain, 'two-phase-second', '2026-08-20T15:36:00.000Z');
    const secondProposalInput = Fixture.proposalInput(secondTransitionInput, Pairwise.buildTransition(secondTransitionInput), 'second', { observedAt: '2026-08-20T15:36:10.000Z', checkedAt: '2026-08-20T15:36:20.000Z', proposedAt: '2026-08-20T15:36:30.000Z' });
    const secondProposal = service.propose(secondProposalInput);

    const fourthChallenge = StateFixture.issueChallenge(scenario.state, 0x54, { issuedAt: '2026-08-20T15:36:40.000Z', expiresAt: '2026-08-20T15:46:00.000Z' });
    StateFixture.answer(scenario.state, fourthChallenge, '2026-08-20T15:36:50.000Z');
    const extensionSettlementInput = Fixture.settlementInput(secondProposalInput, secondProposal, 'second-extension', { observedAt: '2026-08-20T15:37:00.000Z', checkedAt: '2026-08-20T15:37:10.000Z', settledAt: '2026-08-20T15:37:20.000Z' });
    const extensionSettlement = service.settle(extensionSettlementInput);
    equal(extensionSettlement.settlement.decision.classification, 'HELD_POSTWRITE_SOURCE_EXTENDED_CANDIDATE', 'post-proposal source extension is held');
    equal(extensionSettlement.settlement.decision.settledHeadAdvanced, false, 'held extension does not advance settled head');
    equal(service.inspect().currentSettledHeadSeparatedWitnessRef, Fixture.separatedRef(scenario.secondChain), 'held extension preserves prior settled head');
    equal(service.inspect().heldSettlementCount, 1, 'snapshot counts one held settlement');
    const prewriteExtensionRoot = makeDir(tempRoot, 'prewrite-extension-refusal');
    const prewriteExtensionOptions = Fixture.serviceOptions(scenario.state, scenario.sourceRoot, prewriteExtensionRoot, 'two-phase-log:prewrite-extension', Fixture.separatedRef(scenario.secondChain));
    const prewriteExtensionInput = copy(secondProposalInput);
    prewriteExtensionInput.proposalId = 'local-possession-two-phase-proposal:prewrite-extension-refusal';
    prewriteExtensionInput.observationId = 'local-possession-two-phase-prewrite-observation:extension-refusal';
    prewriteExtensionInput.auditId = 'local-possession-two-phase-prewrite-audit:extension-refusal';
    prewriteExtensionInput.observedAt = '2026-08-20T15:37:30.000Z';
    prewriteExtensionInput.checkedAt = '2026-08-20T15:37:40.000Z';
    prewriteExtensionInput.proposedAt = '2026-08-20T15:37:50.000Z';
    throwsCode(() => Ledger.createService(prewriteExtensionOptions).propose(prewriteExtensionInput), 'CANDIDATE_NOT_CURRENT_EXACT_MATCH', 'prewrite source extension beyond candidate is refused');
    equal(fs.existsSync(path.join(prewriteExtensionRoot, Ledger.NAMESPACE)), false, 'prewrite extension refusal creates no namespace');

    const fourthSnapshot = Continuity.captureState(StateFixture.observationOptions(scenario.state, 'local-possession-observation:two-phase-fourth', '2026-08-20T15:37:30.000Z'));
    const fourthCheckpoint = Fixture.checkpoint(fourthSnapshot, 'local-possession-checkpoint:two-phase-fourth', '2026-08-20T15:37:40.000Z');
    const fourthChain = PairwiseFixture.buildSeparatedChain(fourthCheckpoint, 'two-phase-fourth', scenario.authority, { minute: 38 });
    const recoveryTransitionInput = PairwiseFixture.transitionInput(scenario.secondChain, fourthChain, 'two-phase-recovery', '2026-08-20T15:41:00.000Z');
    const recoveryProposalInput = Fixture.proposalInput(recoveryTransitionInput, Pairwise.buildTransition(recoveryTransitionInput), 'recovery', { observedAt: '2026-08-20T15:41:10.000Z', checkedAt: '2026-08-20T15:41:20.000Z', proposedAt: '2026-08-20T15:41:30.000Z' });
    const recoveryProposal = service.propose(recoveryProposalInput);
    equal(recoveryProposal.proposal.previousSettledWitnessRef, Fixture.separatedRef(scenario.secondChain), 'proposal after held settlement starts at unchanged settled head');
    const recoverySettlementInput = Fixture.settlementInput(recoveryProposalInput, recoveryProposal, 'recovery', { observedAt: '2026-08-20T15:41:40.000Z', checkedAt: '2026-08-20T15:41:50.000Z', settledAt: '2026-08-20T15:42:00.000Z' });
    const recoverySettlement = service.settle(recoverySettlementInput);
    equal(recoverySettlement.settlement.decision.classification, 'SETTLED_POSTWRITE_SOURCE_MATCH', 'later exact candidate settles after held extension');
    equal(service.inspect().currentSettledHeadSeparatedWitnessRef, Fixture.separatedRef(fourthChain), 'recovery settlement advances settled head to exact current chain');

    const fifthChallenge = StateFixture.issueChallenge(scenario.state, 0x55, { issuedAt: '2026-08-20T15:37:30.000Z', expiresAt: '2026-08-20T15:46:00.000Z' });
    const fifth = StateFixture.answer(scenario.state, fifthChallenge, '2026-08-20T15:37:40.000Z');
    const fifthSnapshot = Continuity.captureState(StateFixture.observationOptions(scenario.state, 'local-possession-observation:two-phase-fifth', '2026-08-20T15:37:50.000Z'));
    const fifthCheckpoint = Fixture.checkpoint(fifthSnapshot, 'local-possession-checkpoint:two-phase-fifth', '2026-08-20T15:38:00.000Z');
    const fifthChain = PairwiseFixture.buildSeparatedChain(fifthCheckpoint, 'two-phase-fifth', scenario.authority, { minute: 38 });
    const rollbackTransitionInput = PairwiseFixture.transitionInput(fourthChain, fifthChain, 'two-phase-rollback', '2026-08-20T15:41:00.000Z');
    const rollbackProposalInput = Fixture.proposalInput(rollbackTransitionInput, Pairwise.buildTransition(rollbackTransitionInput), 'rollback', { observedAt: '2026-08-20T15:42:10.000Z', checkedAt: '2026-08-20T15:42:20.000Z', proposedAt: '2026-08-20T15:42:30.000Z' });
    const rollbackProposal = service.propose(rollbackProposalInput);
    const fifthPath = path.join(scenario.answersDir, fifth.responseFileName);
    const fifthBytes = fs.readFileSync(fifthPath);
    fs.unlinkSync(fifthPath);
    const rollbackSettlementInput = Fixture.settlementInput(rollbackProposalInput, rollbackProposal, 'rollback', { observedAt: '2026-08-20T15:42:40.000Z', checkedAt: '2026-08-20T15:42:50.000Z', settledAt: '2026-08-20T15:43:00.000Z' });
    const rollbackSettlement = service.settle(rollbackSettlementInput);
    equal(rollbackSettlement.settlement.decision.classification, 'HELD_POSTWRITE_SOURCE_ROLLBACK_OR_REPLACEMENT', 'post-proposal rollback is held');
    equal(rollbackSettlement.settlement.decision.settledHeadAdvanced, false, 'held rollback does not advance settled head');
    equal(service.inspect().currentSettledHeadSeparatedWitnessRef, Fixture.separatedRef(fourthChain), 'held rollback preserves fourth-chain settled head');
    const prewriteRollbackRoot = makeDir(tempRoot, 'prewrite-rollback-refusal');
    const prewriteRollbackOptions = Fixture.serviceOptions(scenario.state, scenario.sourceRoot, prewriteRollbackRoot, 'two-phase-log:prewrite-rollback', Fixture.separatedRef(fourthChain));
    const prewriteRollbackInput = copy(rollbackProposalInput);
    prewriteRollbackInput.proposalId = 'local-possession-two-phase-proposal:prewrite-rollback-refusal';
    prewriteRollbackInput.observationId = 'local-possession-two-phase-prewrite-observation:rollback-refusal';
    prewriteRollbackInput.auditId = 'local-possession-two-phase-prewrite-audit:rollback-refusal';
    throwsCode(() => Ledger.createService(prewriteRollbackOptions).propose(prewriteRollbackInput), 'CANDIDATE_NOT_CURRENT_EXACT_MATCH', 'prewrite source rollback relative to candidate is refused');
    equal(fs.existsSync(path.join(prewriteRollbackRoot, Ledger.NAMESPACE)), false, 'prewrite rollback refusal creates no namespace');
    fs.writeFileSync(fifthPath, fifthBytes);

    equal(service.verifyProposalPersisted(recoveryProposalInput, recoveryProposal.prewriteEvidence, recoveryProposal.proposal).pass, true, 'later proposal exact-rebuilds');
    equal(service.verifySettlementPersisted(recoverySettlementInput, recoverySettlement.postwriteEvidence, recoverySettlement.settlement).pass, true, 'later settlement exact-rebuilds');
    const tamperedEvidence = copy(recoverySettlement.postwriteEvidence);
    tamperedEvidence.currentSnapshot.observationId += ':tampered';
    equal(service.verifySettlementPersisted(recoverySettlementInput, tamperedEvidence, recoverySettlement.settlement).pass, false, 'tampered postwrite evidence fails exact rebuild');
    const tamperedSettlement = copy(recoverySettlement.settlement);
    tamperedSettlement.truth.executionAuthorized = true;
    equal(service.verifySettlementPersisted(recoverySettlementInput, recoverySettlement.postwriteEvidence, tamperedSettlement).pass, false, 'tampered settlement truth fails exact rebuild');

    const freshPath = writePackage(tempRoot, 'fresh-verify', {
      action: 'inspect', options,
      proposalInput: recoveryProposalInput, prewriteEvidence: recoveryProposal.prewriteEvidence, proposalReceipt: recoveryProposal.proposal,
      settlementInput: recoverySettlementInput, postwriteEvidence: recoverySettlement.postwriteEvidence, settlementReceipt: recoverySettlement.settlement
    });
    const fresh = runChild(freshPath);
    equal(fresh.status, 0, 'fresh process reloads complete two-phase ledger');
    equal(fresh.parsed.result.snapshot.proposalCount, 4, 'fresh process validates four proposals');
    equal(fresh.parsed.result.snapshot.settlementCount, 4, 'fresh process validates four settlements');
    equal(fresh.parsed.result.snapshot.heldSettlementCount, 2, 'fresh process preserves two held settlements');
    equal(fresh.parsed.result.proposalVerification.pass, true, 'fresh process exact-rebuilds selected proposal');
    equal(fresh.parsed.result.settlementVerification.pass, true, 'fresh process exact-rebuilds selected settlement');

    const corruptSettlementPath = path.join(forkLedgerB, Ledger.NAMESPACE, Ledger.SETTLEMENTS_DIRECTORY, '000000000002.json');
    fs.writeFileSync(corruptSettlementPath, '{"truncated":');
    throwsCode(() => Ledger.createService(forkOptionsB).inspect(), 'SETTLEMENT_LEDGER_SETTLEMENT_CORRUPT', 'truncated settlement fails closed on reload');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
    check(contract.boundaries.refuses.includes('proposal-as-settled-head-advance'), 'contract refuses proposal as settled-head advance');
    check(contract.boundaries.refuses.includes('observed-postwrite-drift-as-settlement'), 'contract refuses drift as settlement');
    check(contract.boundaries.refuses.includes('two-observations-as-exclusion-of-intermediate-or-reverted-source-change'), 'contract refuses intermediate-change exclusion');
    check(contract.boundaries.refuses.includes('local-settled-head-as-global-fork-exclusion'), 'contract refuses local head as global fork exclusion');
    check(contract.boundaries.refuses.includes('explicit-confirmations-as-host-authorization'), 'contract refuses confirmations as authorization');
    check(contract.boundaries.refuses.includes('proposal-or-settlement-as-execution-adoption-promotion-or-canon-authority'), 'contract refuses downstream authority');

    console.log('SUMMARY ' + checks + ' checks');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
    cleanupVerified = !fs.existsSync(tempRoot);
    console.log('CLEANUP ' + (cleanupVerified ? 'verified' : 'failed'));
  }
  if (!cleanupVerified) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
