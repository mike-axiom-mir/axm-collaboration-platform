#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const Pairwise = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const PairwiseFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest-fixture');
const Ledger = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest-fixture');
const Checkpoint = require('./model-shadow-two-phase-history-checkpoint');

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
function copy(value) { return LedgerFixture.copy(value); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function writePackage(parent, name, value) {
  const result = path.join(parent, name + '.json');
  fs.writeFileSync(result, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return result;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  return { status: result.status, parsed: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe test cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function recordPackage(proposalInput, proposalResult, settlementInput, settlementResult) {
  return {
    proposal: {
      input: copy(proposalInput),
      evidence: copy(proposalResult.prewriteEvidence),
      receipt: copy(proposalResult.proposal)
    },
    settlement: settlementResult ? {
      input: copy(settlementInput),
      evidence: copy(settlementResult.postwriteEvidence),
      receipt: copy(settlementResult.settlement)
    } : null
  };
}
function checkpointInput(id, checkpointedAt, serviceOptions, records) {
  return { checkpointId: id, checkpointedAt, serviceOptions: copy(serviceOptions), records: copy(records) };
}
function auditInput(id, auditedAt, checkpoint, serviceOptions, records) {
  return {
    auditId: id,
    auditedAt,
    checkpoint: copy(checkpoint),
    current: { serviceOptions: copy(serviceOptions), records: copy(records) }
  };
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name);
      const childRelative = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        entries.push({ path: childRelative, type: 'directory' });
        walk(absolute, childRelative);
      } else {
        entries.push({ path: childRelative, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
      }
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-history-checkpoint-'));
  let cleanupVerified = false;
  try {
    const scenario = LedgerFixture.buildScenario(tempRoot);
    const genesisRef = LedgerFixture.separatedRef(scenario.baseChain);
    const ledgerRoot = makeDir(tempRoot, 'primary-ledger');
    const options = LedgerFixture.serviceOptions(scenario.state, scenario.sourceRoot, ledgerRoot, 'two-phase-history:primary', genesisRef);
    const service = Ledger.createService(copy(options));

    equal(Checkpoint.VERSION, '2.1.0', 'version is exact');
    equal(Checkpoint.STATUS, 'TEST', 'status remains TEST');
    equal(Checkpoint.MODE, 'CALLER_PORTABLE_UNAUTHENTICATED_CHECKPOINT', 'checkpoint mode is explicitly unauthenticated');
    equal(Checkpoint.CLASSIFICATIONS.length, 7, 'classification set is closed to seven outcomes');
    equal(Checkpoint.MAX_HISTORY_ITEMS, 10000, 'history item bound matches v2.0');
    equal(Checkpoint.MAX_CHECKPOINT_CANONICAL_BYTES, 16777216, 'checkpoint byte bound is exact');
    ['checkpoint', 'audit'].forEach(name => {
      const file = name === 'checkpoint'
        ? 'history-checkpoint.schema.json'
        : 'history-audit.schema.json';
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      equal(schema.type, 'object', name + ' schema is a JSON object schema');
      equal(schema.additionalProperties, false, name + ' schema closes unknown top-level fields');
    });

    const firstProposalInput = LedgerFixture.proposalInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'history-first');
    const firstProposal = service.propose(firstProposalInput);
    const firstSettlementInput = LedgerFixture.settlementInput(firstProposalInput, firstProposal, 'history-first');
    const firstSettlement = service.settle(firstSettlementInput);
    const firstRecord = recordPackage(firstProposalInput, firstProposal, firstSettlementInput, firstSettlement);
    const recordsOne = [firstRecord];
    const rollbackRoot = path.join(tempRoot, 'rollback-ledger');
    fs.cpSync(ledgerRoot, rollbackRoot, { recursive: true });
    const rollbackOptions = Object.assign(copy(options), { stateRoot: rollbackRoot });

    const firstCheckpointInput = checkpointInput('history-checkpoint:first', '2026-08-20T15:36:00.000Z', options, recordsOne);
    const firstCheckpoint = Checkpoint.createCheckpoint(firstCheckpointInput);
    equal(firstCheckpoint.schema, Checkpoint.CHECKPOINT_SCHEMA, 'checkpoint schema is exact');
    equal(firstCheckpoint.history.proposalRefs.length, 1, 'checkpoint commits every proposal reference');
    equal(firstCheckpoint.history.settlementRefs.length, 1, 'checkpoint commits every settlement reference');
    equal(firstCheckpoint.state.currentSettledHeadSeparatedWitnessRef, LedgerFixture.separatedRef(scenario.secondChain), 'checkpoint binds settled-only head');
    equal(firstCheckpoint.truth.checkpointPersistedByModule, false, 'checkpoint truth refuses module persistence claim');
    equal(firstCheckpoint.truth.checkpointExternalRetentionProven, false, 'portable checkpoint refuses retention claim');
    equal(firstCheckpoint.truth.checkpointPinAuthenticated, false, 'portable checkpoint refuses authenticated pin claim');
    equal(firstCheckpoint.truth.ledgerSnapshotAtomic, false, 'bracketing reads refuse atomic snapshot claim');
    equal(Checkpoint.validateCheckpoint(firstCheckpoint), firstCheckpoint, 'checkpoint self-validates exactly');
    equal(Checkpoint.verifyCheckpointOrigin(firstCheckpointInput, firstCheckpoint).pass, true, 'checkpoint exact-rebuilds from origin package');

    const exactInput = auditInput('history-audit:exact-first', '2026-08-20T15:36:10.000Z', firstCheckpoint, options, recordsOne);
    const beforeExactTree = treeDigest(ledgerRoot);
    const exactAudit = Checkpoint.auditCheckpoint(exactInput);
    const afterExactTree = treeDigest(ledgerRoot);
    equal(beforeExactTree, afterExactTree, 'exact audit leaves the ledger byte-for-byte unchanged');
    equal(exactAudit.classification, 'EXACT_HISTORY_MATCH', 'exact current history matches checkpoint');
    equal(exactAudit.comparison.commonProposalPrefixCount, 1, 'exact audit counts complete proposal prefix');
    equal(exactAudit.comparison.commonSettlementPrefixCount, 1, 'exact audit counts complete settlement prefix');
    equal(exactAudit.comparison.checkpointProposalCount, 1, 'exact audit retains bounded checkpoint proposal count');
    equal(exactAudit.comparison.checkpointSettlementCount, 1, 'exact audit retains bounded checkpoint settlement count');
    equal(exactAudit.decision.reviewRequired, true, 'exact audit still requires review');
    equal(exactAudit.decision.autonomousActionCount, 0, 'exact audit authorizes no autonomous action');
    equal(exactAudit.truth.checkpointOriginReauthenticatedAtAudit, false, 'audit does not authenticate checkpoint origin');
    equal(exactAudit.truth.sourceStateRecaptured, false, 'audit does not recapture source state');
    equal(Checkpoint.validateAudit(exactAudit), exactAudit, 'audit self-validates exactly');
    equal(Checkpoint.verifyAudit(exactInput, exactAudit).pass, true, 'audit exact-rebuilds from caller package');

    const checkpointChildPackage = writePackage(tempRoot, 'fresh-checkpoint', { action: 'checkpoint', input: firstCheckpointInput });
    const checkpointChild = runChild(checkpointChildPackage);
    equal(checkpointChild.status, 0, 'fresh process rebuilds checkpoint');
    check(checkpointChild.parsed.pid !== process.pid, 'checkpoint rebuild uses a distinct process');
    equal(checkpointChild.parsed.result, firstCheckpoint, 'fresh-process checkpoint is exact');
    const auditChildPackage = writePackage(tempRoot, 'fresh-audit', { action: 'audit', input: exactInput });
    const auditChild = runChild(auditChildPackage);
    equal(auditChild.status, 0, 'fresh process rebuilds audit');
    check(auditChild.parsed.pid !== process.pid, 'audit rebuild uses a distinct process');
    equal(auditChild.parsed.result, exactAudit, 'fresh-process audit is exact');

    const tamperedCheckpoint = copy(firstCheckpoint);
    tamperedCheckpoint.history.proposalRefs[0].sha256 = 'sha256:' + '0'.repeat(64);
    throwsCode(() => Checkpoint.validateCheckpoint(tamperedCheckpoint), 'INVALID_CHECKPOINT', 'tampered checkpoint fails closed');
    const tamperedAudit = copy(exactAudit);
    tamperedAudit.classification = 'FORWARD_HISTORY_EXTENSION';
    throwsCode(() => Checkpoint.validateAudit(tamperedAudit), 'INVALID_AUDIT', 'tampered audit fails closed');
    const impossibleAbsentExactAudit = copy(exactAudit);
    impossibleAbsentExactAudit.current.snapshotBinding = null;
    impossibleAbsentExactAudit.current.historyDigest = null;
    impossibleAbsentExactAudit.current.proposalCount = null;
    impossibleAbsentExactAudit.current.settlementCount = null;
    impossibleAbsentExactAudit.current.heldSettlementCount = null;
    impossibleAbsentExactAudit.current.currentSettledHeadSeparatedWitnessRef = null;
    impossibleAbsentExactAudit.auditDigest = Checkpoint.sha256(Object.fromEntries(Object.entries(impossibleAbsentExactAudit).filter(([key]) => key !== 'auditDigest')));
    throwsCode(() => Checkpoint.validateAudit(impossibleAbsentExactAudit), 'INVALID_AUDIT', 'validator rejects exact classification without current history');
    const mismatchedRecord = copy(firstRecord);
    mismatchedRecord.proposal.receipt.proposalId += ':tampered';
    const mismatchInput = auditInput('history-audit:bad-package', '2026-08-20T15:36:20.000Z', firstCheckpoint, options, [mismatchedRecord]);
    throwsCode(() => Checkpoint.auditCheckpoint(mismatchInput), 'PROPOSAL_PACKAGE_INVALID', 'valid ledger with bad caller package yields no audit receipt');

    const thirdChallenge = StateFixture.issueChallenge(scenario.state, 0x53, {
      issuedAt: '2026-08-20T15:32:00.000Z', expiresAt: '2026-08-20T15:46:00.000Z'
    });
    StateFixture.answer(scenario.state, thirdChallenge, '2026-08-20T15:32:20.000Z');
    const thirdSnapshot = Continuity.captureState(StateFixture.observationOptions(
      scenario.state, 'local-possession-observation:history-third', '2026-08-20T15:32:30.000Z'
    ));
    const thirdCheckpoint = LedgerFixture.checkpoint(thirdSnapshot, 'local-possession-checkpoint:history-third', '2026-08-20T15:32:40.000Z');
    const thirdChain = PairwiseFixture.buildSeparatedChain(thirdCheckpoint, 'history-third', scenario.authority, { minute: 33 });
    const secondTransitionInput = PairwiseFixture.transitionInput(scenario.secondChain, thirdChain, 'history-second', '2026-08-20T15:36:00.000Z');
    const secondProposalInput = LedgerFixture.proposalInput(secondTransitionInput, Pairwise.buildTransition(secondTransitionInput), 'history-second', {
      observedAt: '2026-08-20T15:36:10.000Z', checkedAt: '2026-08-20T15:36:20.000Z', proposedAt: '2026-08-20T15:36:30.000Z'
    });
    const secondProposal = service.propose(secondProposalInput);
    const pendingRecord = recordPackage(secondProposalInput, secondProposal, null, null);
    const pendingRecords = [firstRecord, pendingRecord];
    const pendingCheckpointInput = checkpointInput('history-checkpoint:pending', '2026-08-20T15:36:40.000Z', options, pendingRecords);
    const pendingCheckpoint = Checkpoint.createCheckpoint(pendingCheckpointInput);
    equal(pendingCheckpoint.state.proposalCount, 2, 'pending checkpoint binds two proposals');
    equal(pendingCheckpoint.state.settlementCount, 1, 'pending checkpoint binds one settlement');
    equal(pendingCheckpoint.state.pendingProposalRef, pendingCheckpoint.history.proposalRefs[1], 'pending checkpoint binds trailing proposal');
    const pendingExact = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:pending-exact', '2026-08-20T15:36:45.000Z', pendingCheckpoint, options, pendingRecords
    ));
    equal(pendingExact.classification, 'EXACT_HISTORY_MATCH', 'pending history can match exactly without advancing head');

    const movementRoot = path.join(tempRoot, 'movement-ledger');
    fs.cpSync(rollbackRoot, movementRoot, { recursive: true });
    const movementOptions = Object.assign(copy(options), { stateRoot: movementRoot });
    const movementService = Ledger.createService(copy(movementOptions));
    const movementProposalInput = copy(secondProposalInput);
    movementProposalInput.proposalId = 'local-possession-two-phase-proposal:history-movement';
    movementProposalInput.observationId = 'local-possession-two-phase-prewrite-observation:history-movement';
    movementProposalInput.auditId = 'local-possession-two-phase-prewrite-audit:history-movement';
    const originalCreateService = Ledger.createService;
    let movementTriggered = false;
    Ledger.createService = function wrappedCreateService(value) {
      const wrapped = originalCreateService(value);
      if (path.resolve(value.stateRoot) !== path.resolve(movementRoot)) return wrapped;
      return Object.freeze(Object.assign({}, wrapped, {
        verifyProposalPersisted(input, evidence, receipt) {
          const result = wrapped.verifyProposalPersisted(input, evidence, receipt);
          if (!movementTriggered) {
            movementTriggered = true;
            movementService.propose(movementProposalInput);
          }
          return result;
        }
      }));
    };
    try {
      const movingCheckpointInput = checkpointInput('history-checkpoint:moving', '2026-08-20T15:36:50.000Z', movementOptions, recordsOne);
      throwsCode(() => Checkpoint.createCheckpoint(movingCheckpointInput), 'LEDGER_MOVED_DURING_PRESENTATION', 'changed bracketing snapshot refuses checkpoint creation');
      equal(movementTriggered, true, 'movement adversary changed the ledger during package verification');
    } finally {
      Ledger.createService = originalCreateService;
    }

    const secondSettlementInput = LedgerFixture.settlementInput(secondProposalInput, secondProposal, 'history-second', {
      observedAt: '2026-08-20T15:36:40.000Z', checkedAt: '2026-08-20T15:36:50.000Z', settledAt: '2026-08-20T15:37:00.000Z'
    });
    const secondSettlement = service.settle(secondSettlementInput);
    const secondRecord = recordPackage(secondProposalInput, secondProposal, secondSettlementInput, secondSettlement);
    const recordsTwo = [firstRecord, secondRecord];
    const pendingForward = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:pending-forward', '2026-08-20T15:37:05.000Z', pendingCheckpoint, options, recordsTwo
    ));
    equal(pendingForward.classification, 'FORWARD_HISTORY_EXTENSION', 'settling a checkpointed pending proposal is a forward history extension');
    equal(pendingForward.comparison.commonProposalPrefixCount, 2, 'pending forward audit preserves both proposal commitments');
    equal(pendingForward.comparison.commonSettlementPrefixCount, 1, 'pending forward audit preserves prior settlement commitment');

    const settledCheckpointInput = checkpointInput('history-checkpoint:settled-two', '2026-08-20T15:37:10.000Z', options, recordsTwo);
    const settledCheckpoint = Checkpoint.createCheckpoint(settledCheckpointInput);
    equal(settledCheckpoint.state.proposalCount, 2, 'settled checkpoint binds two proposals');
    equal(settledCheckpoint.state.settlementCount, 2, 'settled checkpoint binds two settlements');
    equal(settledCheckpoint.state.pendingProposalRef, null, 'settled checkpoint has no pending proposal');

    const rollbackAudit = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:rollback', '2026-08-20T15:42:00.000Z', settledCheckpoint, rollbackOptions, recordsOne
    ));
    equal(rollbackAudit.classification, 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'older valid prefix is typed strict rollback relative to checkpoint');
    equal(rollbackAudit.comparison.commonProposalPrefixCount, 1, 'rollback preserves one proposal prefix');
    equal(rollbackAudit.comparison.commonSettlementPrefixCount, 1, 'rollback preserves one settlement prefix');
    equal(rollbackAudit.truth.strictRollbackObserved, true, 'rollback truth is classification-bound');
    equal(rollbackAudit.truth.deletionOrRollbackPrevented, false, 'rollback observation claims no prevention');

    const replacementRoot = makeDir(tempRoot, 'replacement-ledger');
    const replacementOptions = Object.assign(copy(options), { stateRoot: replacementRoot });
    const replacementService = Ledger.createService(copy(replacementOptions));
    const replacementTransitionInput = PairwiseFixture.transitionInput(scenario.baseChain, thirdChain, 'history-replacement', '2026-08-20T15:38:00.000Z');
    const replacementProposalInput = LedgerFixture.proposalInput(replacementTransitionInput, Pairwise.buildTransition(replacementTransitionInput), 'history-replacement', {
      observedAt: '2026-08-20T15:38:10.000Z', checkedAt: '2026-08-20T15:38:20.000Z', proposedAt: '2026-08-20T15:38:30.000Z'
    });
    const replacementProposal = replacementService.propose(replacementProposalInput);
    const replacementSettlementInput = LedgerFixture.settlementInput(replacementProposalInput, replacementProposal, 'history-replacement', {
      observedAt: '2026-08-20T15:38:40.000Z', checkedAt: '2026-08-20T15:38:50.000Z', settledAt: '2026-08-20T15:39:00.000Z'
    });
    const replacementSettlement = replacementService.settle(replacementSettlementInput);
    const replacementRecord = recordPackage(replacementProposalInput, replacementProposal, replacementSettlementInput, replacementSettlement);
    const replacementAudit = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:replacement', '2026-08-20T15:42:10.000Z', settledCheckpoint, replacementOptions, [replacementRecord]
    ));
    equal(replacementAudit.classification, 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'different valid sequence from same identity is typed replacement or fork');
    equal(replacementAudit.comparison.commonProposalPrefixCount, 0, 'replacement shares no proposal prefix');
    equal(replacementAudit.comparison.commonSettlementPrefixCount, 0, 'replacement shares no settlement prefix');
    equal(replacementAudit.truth.replacementOrForkObserved, true, 'replacement truth is classification-bound');
    equal(replacementAudit.truth.withheldRootsExcluded, false, 'pairwise checkpoint audit excludes no withheld root');

    const replacementCheckpointInput = checkpointInput(
      'history-checkpoint:joint-replacement', '2026-08-20T15:39:10.000Z', replacementOptions, [replacementRecord]
    );
    const replacementCheckpoint = Checkpoint.createCheckpoint(replacementCheckpointInput);
    const jointReplacementAudit = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:joint-replacement', '2026-08-20T15:42:20.000Z', replacementCheckpoint, replacementOptions, [replacementRecord]
    ));
    equal(jointReplacementAudit.classification, 'EXACT_HISTORY_MATCH', 'jointly replaced checkpoint and root form another exact relative chain');
    check(replacementCheckpoint.checkpointDigest !== settledCheckpoint.checkpointDigest, 'joint replacement does not preserve the original checkpoint digest');

    const identityRoot = makeDir(tempRoot, 'identity-ledger');
    const identityOptions = Object.assign(copy(options), { stateRoot: identityRoot, logId: 'two-phase-history:different-identity' });
    const identityService = Ledger.createService(copy(identityOptions));
    const identityProposalInput = LedgerFixture.proposalInput(replacementTransitionInput, Pairwise.buildTransition(replacementTransitionInput), 'history-identity', {
      observedAt: '2026-08-20T15:39:20.000Z', checkedAt: '2026-08-20T15:39:30.000Z', proposedAt: '2026-08-20T15:39:40.000Z'
    });
    const identityProposal = identityService.propose(identityProposalInput);
    const identitySettlementInput = LedgerFixture.settlementInput(identityProposalInput, identityProposal, 'history-identity', {
      observedAt: '2026-08-20T15:39:50.000Z', checkedAt: '2026-08-20T15:40:00.000Z', settledAt: '2026-08-20T15:40:10.000Z'
    });
    const identitySettlement = identityService.settle(identitySettlementInput);
    const identityRecord = recordPackage(identityProposalInput, identityProposal, identitySettlementInput, identitySettlement);
    const identityAudit = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:identity-drift', '2026-08-20T15:42:30.000Z', settledCheckpoint, identityOptions, [identityRecord]
    ));
    equal(identityAudit.classification, 'OBSERVED_LEDGER_IDENTITY_DRIFT', 'different valid ledger identity is typed drift');
    equal(identityAudit.comparison.ledgerIdentityDrift, true, 'identity drift comparison flag is exact');

    const absentRoot = makeDir(tempRoot, 'absent-ledger');
    const absentOptions = Object.assign(copy(options), { stateRoot: absentRoot });
    const absentAudit = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:absent', '2026-08-20T15:42:40.000Z', settledCheckpoint, absentOptions, []
    ));
    equal(absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'absent namespace is typed absent');
    equal(absentAudit.current.snapshotBinding, null, 'absent audit claims no current snapshot');
    equal(absentAudit.truth.absenceCauseProven, false, 'absence does not prove deletion cause');

    const invalidRoot = path.join(tempRoot, 'invalid-ledger');
    fs.cpSync(ledgerRoot, invalidRoot, { recursive: true });
    const invalidProposalPath = path.join(invalidRoot, Ledger.NAMESPACE, Ledger.PROPOSALS_DIRECTORY, '000000000001.json');
    fs.writeFileSync(invalidProposalPath, '{"truncated":true}\n', 'utf8');
    const invalidOptions = Object.assign(copy(options), { stateRoot: invalidRoot });
    const invalidAudit = Checkpoint.auditCheckpoint(auditInput(
      'history-audit:invalid', '2026-08-20T15:42:50.000Z', settledCheckpoint, invalidOptions, []
    ));
    equal(invalidAudit.classification, 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID', 'corrupt namespace is typed ledger or configuration invalid');
    check(typeof invalidAudit.current.errorCode === 'string' && invalidAudit.current.errorCode.length > 0, 'invalid audit retains only bounded error code');
    equal(invalidAudit.current.historyDigest, null, 'invalid audit claims no verified current history');
    const ignoredPackagesInput = auditInput(
      'history-audit:invalid-ignored', '2026-08-20T15:43:00.000Z', settledCheckpoint, invalidOptions, recordsTwo
    );
    throwsCode(() => Checkpoint.auditCheckpoint(ignoredPackagesInput), 'UNUSED_CURRENT_PACKAGES', 'invalid ledger refuses ignored caller packages');
    const malformedOptions = copy(absentOptions);
    malformedOptions.stateRoot = path.parse(absentRoot).root;
    const malformedConfigurationInput = auditInput(
      'history-audit:malformed-configuration', '2026-08-20T15:43:10.000Z', settledCheckpoint, malformedOptions, []
    );
    throwsCode(() => Checkpoint.auditCheckpoint(malformedConfigurationInput), 'INVALID_LEDGER_CONFIGURATION', 'malformed service configuration yields no invalid-ledger receipt');

    const publicText = JSON.stringify({ firstCheckpoint, exactAudit, settledCheckpoint, rollbackAudit, replacementAudit, identityAudit, absentAudit, invalidAudit });
    equal(publicText.includes('BEGIN PUBLIC KEY'), false, 'public artifacts contain no raw public key');
    equal(publicText.includes('"signature"'), false, 'public artifacts contain no raw signature');
    equal(publicText.includes(scenario.sourceRoot), false, 'public artifacts contain no source path');
    equal(publicText.includes(ledgerRoot), false, 'public artifacts contain no ledger path');
    equal(firstCheckpoint.truth.privateKeyIngested, false, 'checkpoint ingests no private key');
    equal(exactAudit.truth.experimentExecuted, false, 'audit executes no experiment');
    equal(exactAudit.truth.evaluationPerformed, false, 'audit performs no evaluation');
    equal(exactAudit.truth.humanBenefitProven, false, 'audit proves no human benefit');
    equal(exactAudit.truth.broadLearningClaimed, false, 'audit claims no broad learning');
    equal(exactAudit.truth.automaticInstall, false, 'audit remains uninstalled');
    equal(exactAudit.truth.automaticPromotion, false, 'audit remains unpromoted');
    equal(exactAudit.truth.automaticMerge, false, 'audit grants no merge');
    equal(exactAudit.truth.automaticCanon, false, 'audit grants no CANON');
    equal(exactAudit.truth.foundationMutation, false, 'audit mutates no Foundation');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
    check(contract.boundaries.writes.length === 0, 'contract declares no writes');
    check(contract.boundaries.refuses.includes('portable-checkpoint-as-proof-of-retention-or-independent-custody'), 'contract refuses retention overclaim');
    check(contract.boundaries.refuses.includes('relative-rollback-detection-as-deletion-or-rollback-prevention'), 'contract refuses rollback-prevention overclaim');

    verifiedRemove(tempRoot, path.dirname(tempRoot));
    cleanupVerified = !fs.existsSync(tempRoot);
    equal(cleanupVerified, true, 'verified cleanup removes only the bounded temporary root');
    console.log('\nTwo-phase settlement portable history checkpoint selftest: PASS (' + checks + ' checks)');
  } finally {
    if (!cleanupVerified && fs.existsSync(tempRoot)) verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main();
