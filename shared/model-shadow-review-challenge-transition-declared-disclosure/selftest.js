#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const DeclaredDisclosure = require('./model-shadow-review-challenge-transition-declared-disclosure');
const Fixture = require('./selftest-fixture');
const Reconciliation = require('../model-shadow-review-challenge-transition-reconciliation/model-shadow-review-challenge-transition-reconciliation');

let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function equal(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function throws(fn, pattern, message) {
  assert.throws(fn, pattern, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function fakePresentationRef(index) {
  return {
    id: 'presentation:bounded-' + String(index).padStart(2, '0'),
    schema: Reconciliation.PRESENTATION_SCHEMA,
    sha256: DeclaredDisclosure.sha256({ boundedPresentation: index })
  };
}

function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-declared-disclosure-'));
  try {
    const fixture = Fixture.buildFixture(tempRoot);
    const rosterSchema = readJson('model-shadow-review-challenge-transition-disclosure-roster.schema.json');
    const assessmentSchema = readJson('model-shadow-review-challenge-transition-declared-disclosure.schema.json');
    const contract = readJson('module.contract.json');
    const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-declared-disclosure.js'), 'utf8');

    equal(DeclaredDisclosure.VERSION, '1.0.0', 'module version is exact');
    equal(DeclaredDisclosure.STATUS, 'TEST', 'module status remains TEST');
    equal(DeclaredDisclosure.MAX_DECLARED_MEMBERS, 64, 'declared member bound is exact');
    equal(DeclaredDisclosure.MAX_ROSTER_CANONICAL_BYTES, 128 * 1024, 'roster canonical byte bound is exact');
    equal(DeclaredDisclosure.MAX_ASSESSMENT_CANONICAL_BYTES, 32 * 1024 * 1024, 'assessment canonical byte bound is exact');
    check(!source.includes("require('fs')") && !source.includes("require('path')") && !source.includes("require('child_process')"), 'runtime has no filesystem process or path dependency');

    const roster = fixture.rosters.compatible;
    equal(roster.schema, DeclaredDisclosure.ROSTER_SCHEMA, 'roster schema identity is exact');
    equal(roster.memberCount, 2, 'roster retains exact declared member count');
    equal(roster.members.map(item => item.memberId), ['member:a', 'member:ac'], 'roster normalizes member labels by deterministic code-unit order');
    check(roster.truth.memberSetCallerDeclared, 'roster labels are explicitly caller declared');
    check(roster.truth.expectedPresentationDigestsCommitted, 'roster commits exact expected presentation digests');
    equal(roster.truth.declaredMemberSetAuthorityAuthenticated, false, 'roster authenticates no registry authority');
    equal(roster.truth.allExistingRootsEnumerated, false, 'roster does not claim all roots are enumerated');
    equal(roster.truth.actualMultiPartyDisclosureCompelled, false, 'roster does not claim actual compelled disclosure');
    equal(roster.truth.realWorldControllerIndependenceProven, false, 'distinct labels do not prove independent controllers');
    check(DeclaredDisclosure.verifyRoster(fixture.rosterInputs.compatible, roster).pass, 'roster verifies by exact rebuild');
    equal(
      DeclaredDisclosure.buildRoster(Fixture.copy(fixture.rosterInputs.compatible)),
      roster,
      'roster rebuild is deterministic from copied input'
    );

    const compatible = DeclaredDisclosure.buildAssessment(fixture.assessmentInputs.compatible);
    equal(compatible.schema, DeclaredDisclosure.ASSESSMENT_SCHEMA, 'assessment schema identity is exact');
    equal(compatible.declaredMemberCount, 2, 'compatible receipt retains declared member count');
    equal(compatible.submittedMemberCount, 2, 'compatible receipt retains submitted member count');
    equal(compatible.matchingCommitmentCount, 2, 'compatible receipt matches both exact commitments');
    equal(compatible.missingMemberIds, [], 'compatible receipt has no missing declared member');
    equal(compatible.mismatchedCommitments, [], 'compatible receipt has no mismatched commitment');
    equal(compatible.pairwiseComparisons.length, 1, 'two matching members produce exactly one pair');
    equal(compatible.pairwiseComparisons[0].classification, 'LEFT_PRESENTED_HISTORY_IS_EXACT_PREFIX', 'compatible pair preserves exact v0.9 prefix classification');
    equal(compatible.pairwiseComparisons[0].pairwiseConsistency, 'CONSISTENT_PREFIX', 'compatible pair preserves v0.9 consistency result');
    equal(compatible.decision.classification, 'DECLARED_SET_PRESENTATIONS_PAIRWISE_COMPATIBLE', 'complete compatible declared set is typed');
    equal(compatible.decision.declaredCommitmentCoverage, 'COMPLETE', 'compatible declared commitment coverage is complete');
    equal(compatible.decision.pairwiseContradictionCount, 0, 'compatible declared set has zero co-presented contradictions');
    equal(compatible.decision.reviewRequired, false, 'compatible declared set adds no contradiction hold');
    equal(compatible.decision.autonomousActionCount, 0, 'compatible declared set triggers no autonomous action');
    check(compatible.truth.rosterVerifiedByExactRebuild, 'assessment exact-rebuilds roster');
    check(compatible.truth.everySubmittedPresentationVerifiedByExactRebuild, 'assessment exact-rebuilds every submitted v0.9 presentation');
    check(compatible.truth.everyMatchingPresentationPairDeterministicallyReconciled, 'assessment reconciles every matching pair');
    check(compatible.truth.declaredPresentationCommitmentCoverageComplete, 'assessment states bounded declared commitment coverage');
    check(compatible.truth.allDeclaredMatchingPairsPairwiseCompatible, 'assessment states bounded pairwise compatibility');
    equal(compatible.truth.declaredMemberSetExhaustiveProven, false, 'declared coverage is not exhaustive-root proof');
    equal(compatible.truth.unlistedRootsExcluded, false, 'compatible declared set does not exclude unlisted roots');
    equal(compatible.truth.actualMultiPartyDisclosureCompelled, false, 'compatible declared set does not claim compulsion');
    equal(compatible.truth.declaredMemberIdentitiesAuthenticated, false, 'compatible declared set authenticates no member identity');
    equal(compatible.truth.globallyConsistentTransitionLogProven, false, 'all declared pairs do not prove a globally consistent log');
    equal(compatible.truth.executionAuthorized, false, 'compatible receipt grants no execution authority');
    equal(compatible.truth.adoptionAuthorized, false, 'compatible receipt grants no adoption authority');
    equal(compatible.truth.automaticCanon, false, 'compatible receipt grants no CANON authority');
    check(DeclaredDisclosure.verifyAssessment(fixture.assessmentInputs.compatible, compatible).pass, 'compatible assessment verifies by exact rebuild');
    equal(
      DeclaredDisclosure.buildAssessment(Fixture.copy(fixture.assessmentInputs.compatible)),
      compatible,
      'assessment rebuild is deterministic from copied input'
    );

    const serializedCompatible = JSON.stringify(compatible);
    check(!serializedCompatible.includes('publicKey'), 'assessment receipt embeds no raw public key');
    check(!serializedCompatible.includes('signature'), 'assessment receipt embeds no raw signature');
    check(!serializedCompatible.includes(tempRoot), 'assessment receipt embeds no temporary machine path');
    check(!serializedCompatible.includes('advanceInput'), 'assessment receipt embeds no transient v0.8 advance package');
    check(!serializedCompatible.includes('transitionInput'), 'assessment receipt embeds no transient v0.7 transition package');

    const missing = DeclaredDisclosure.buildAssessment(fixture.assessmentInputs.missing);
    equal(missing.decision.classification, 'HOLD_DECLARED_PRESENTATION_COMMITMENT_COVERAGE_INCOMPLETE', 'missing declared submission creates a typed coverage hold');
    equal(missing.decision.declaredCommitmentCoverage, 'INCOMPLETE', 'missing declared submission leaves commitment coverage incomplete');
    equal(missing.missingMemberIds, ['member:b'], 'missing receipt identifies exact declared member label');
    equal(missing.mismatchedCommitments.length, 0, 'missing receipt distinguishes absence from mismatch');
    equal(missing.matchingCommitmentCount, 2, 'missing receipt preserves matching submitted commitments');
    equal(missing.pairwiseComparisons.length, 1, 'missing receipt still reconciles every matching submitted pair');
    check(missing.truth.declaredMissingPresentationCommitmentsDetected, 'missing commitment truth is explicit');
    equal(missing.truth.declaredPresentationCommitmentMismatchDetected, false, 'missing commitment is not mislabeled as mismatch');
    equal(missing.truth.actualMultiPartyDisclosureCompelled, false, 'detecting declared absence is not actual compulsion');
    check(missing.decision.reviewRequired, 'missing declared submission requires review');
    equal(missing.decision.autonomousActionCount, 0, 'missing declared submission triggers no autonomous action');

    const mismatch = DeclaredDisclosure.buildAssessment(fixture.assessmentInputs.mismatch);
    equal(mismatch.decision.classification, 'HOLD_DECLARED_PRESENTATION_COMMITMENT_COVERAGE_INCOMPLETE', 'valid alternate submission creates a typed coverage hold');
    equal(mismatch.missingMemberIds.length, 0, 'mismatch receipt distinguishes mismatch from absence');
    equal(mismatch.mismatchedCommitments.length, 1, 'mismatch receipt identifies one exact mismatch');
    equal(mismatch.mismatchedCommitments[0].memberId, 'member:a', 'mismatch receipt identifies exact declared member label');
    check(!mismatch.submissions.find(item => item.memberId === 'member:a').commitmentMatches, 'mismatched valid presentation is marked without accepting its commitment');
    equal(mismatch.matchingCommitmentCount, 1, 'mismatched valid presentation is excluded from matching pair set');
    equal(mismatch.pairwiseComparisons.length, 0, 'one matching commitment produces no pair');
    check(mismatch.truth.declaredPresentationCommitmentMismatchDetected, 'commitment mismatch truth is explicit');
    equal(mismatch.truth.declaredMissingPresentationCommitmentsDetected, false, 'commitment mismatch is not mislabeled as missing');
    check(DeclaredDisclosure.verifyAssessment(fixture.assessmentInputs.mismatch, mismatch).pass, 'mismatch assessment verifies by exact rebuild');

    const contradiction = DeclaredDisclosure.buildAssessment(fixture.assessmentInputs.contradiction);
    equal(contradiction.decision.classification, 'HOLD_DECLARED_SET_PRESENTED_HISTORY_CONTRADICTION', 'complete declared set with fork creates typed contradiction hold');
    equal(contradiction.decision.declaredCommitmentCoverage, 'COMPLETE', 'forking declared set can still have complete commitment coverage');
    equal(contradiction.decision.pairwiseContradictionCount, 1, 'forking two-member set reports one contradiction');
    equal(contradiction.pairwiseComparisons[0].classification, 'HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE', 'declared-set contradiction preserves exact v0.9 fork type');
    equal(contradiction.pairwiseComparisons[0].commonPrefixEntryCount, 1, 'declared-set contradiction preserves exact common prefix count');
    check(contradiction.truth.coPresentedContradictionDetected, 'co-presented contradiction truth is explicit');
    equal(contradiction.truth.allDeclaredMatchingPairsPairwiseCompatible, false, 'co-presented contradiction defeats bounded pairwise compatibility');
    check(contradiction.decision.reviewRequired, 'co-presented contradiction requires review');
    equal(contradiction.decision.autonomousActionCount, 0, 'co-presented contradiction triggers no autonomous action');

    const allPairs = DeclaredDisclosure.buildAssessment(fixture.assessmentInputs.allPairs);
    equal(allPairs.declaredMemberCount, 3, 'three-member declared set retains exact count');
    equal(allPairs.pairwiseComparisons.length, 3, 'three matching members produce every one of three pairs');
    equal(allPairs.decision.pairwiseContradictionCount, 1, 'all-pairs receipt counts only the conflicting branch pair');
    equal(allPairs.pairwiseComparisons.filter(item => item.pairwiseConsistency === 'CONSISTENT_PREFIX').length, 2, 'all-pairs receipt preserves two exact prefix relations');
    equal(allPairs.pairwiseComparisons.filter(item => item.pairwiseConsistency === 'CONTRADICTION').length, 1, 'all-pairs receipt preserves one exact contradiction');

    check(
      Reconciliation.verifyPresentation(fixture.upstream.presentationInputs.b, fixture.upstream.presentations.b).pass,
      'independently valid unlisted presentation exact-rebuilds'
    );
    check(
      !serializedCompatible.includes(fixture.upstream.presentations.b.presentationDigest),
      'complete declared-set receipt contains no unlisted presentation digest'
    );
    equal(compatible.truth.unlistedRootsExcluded, false, 'unlisted-root nonexclusion remains explicit');
    equal(compatible.truth.undeclaredHistoryAbsenceProven, false, 'undeclared-history absence remains unproven');
    equal(compatible.truth.globalTransitionUniquenessProven, false, 'declared all-pairs comparison does not prove global uniqueness');
    equal(compatible.truth.externalTransitionRetentionProven, false, 'declared all-pairs comparison does not prove external retention');
    equal(compatible.truth.protectedMonotonicStateProven, false, 'declared all-pairs comparison does not prove protected state');
    equal(compatible.truth.deletionOrRollbackPrevented, false, 'declared all-pairs comparison does not prove rollback resistance');
    equal(compatible.truth.actualHumanParticipationProven, false, 'declared member labels do not prove human participation');
    equal(compatible.truth.humanBenefitProven, false, 'declared-set assessment does not prove human benefit');
    equal(compatible.truth.broadLearningClaimed, false, 'declared-set assessment makes no broad learning claim');

    const oneMember = Fixture.copy(fixture.rosterInputs.compatible);
    oneMember.members = [oneMember.members[0]];
    throws(() => DeclaredDisclosure.buildRoster(oneMember), /at least two members/, 'one-member roster is refused');

    const maxMembers = Array.from({ length: 64 }, (_, index) => ({
      memberId: 'member:bounded-' + String(index).padStart(2, '0'),
      expectedPresentationRef: fakePresentationRef(index)
    }));
    equal(DeclaredDisclosure.buildRoster({
      rosterId: 'disclosure-roster:max-members',
      declaredAt: '2026-08-20T15:00:00.000Z',
      members: maxMembers
    }).memberCount, 64, 'maximum bounded roster is accepted');

    const maxAssessmentMembers = [];
    const maxAssessmentSubmissions = [];
    for (let index = 0; index < 64; index += 1) {
      const tag = 'bounded-empty-' + String(index).padStart(2, '0');
      const presentationInput = Fixture.copy(fixture.upstream.presentationInputs.empty);
      presentationInput.presentationId = 'presentation:reconciliation-' + tag;
      const presentation = Reconciliation.buildPresentation(presentationInput);
      const memberId = 'member:' + tag;
      maxAssessmentMembers.push(Fixture.member(memberId, presentation));
      maxAssessmentSubmissions.push(Fixture.submission(memberId, presentationInput, presentation));
    }
    const maxAssessmentRosterInput = Fixture.rosterInput('max-assessment', maxAssessmentMembers);
    const maxAssessmentRoster = DeclaredDisclosure.buildRoster(maxAssessmentRosterInput);
    const maxAssessmentInput = Fixture.assessmentInput(
      'max-assessment',
      maxAssessmentRosterInput,
      maxAssessmentRoster,
      maxAssessmentSubmissions
    );
    const maxAssessment = DeclaredDisclosure.buildAssessment(maxAssessmentInput);
    equal(maxAssessment.matchingCommitmentCount, 64, 'maximum bounded assessment exact-rebuilds all sixty-four submissions');
    equal(maxAssessment.pairwiseComparisons.length, 2016, 'maximum bounded assessment reconciles all 2,016 distinct pairs');
    equal(maxAssessment.decision.pairwiseContradictionCount, 0, 'maximum bounded replay assessment preserves zero contradictions');

    const tooManyMembers = maxMembers.concat([{
      memberId: 'member:bounded-64',
      expectedPresentationRef: fakePresentationRef(64)
    }]);
    throws(() => DeclaredDisclosure.buildRoster({
      rosterId: 'disclosure-roster:too-many-members',
      declaredAt: '2026-08-20T15:00:00.000Z',
      members: tooManyMembers
    }), /bounded member limit/, 'roster over bounded member limit is refused');

    const duplicateMember = Fixture.copy(fixture.rosterInputs.compatible);
    duplicateMember.members[1].memberId = duplicateMember.members[0].memberId;
    throws(() => DeclaredDisclosure.buildRoster(duplicateMember), /member ids must be unique/, 'duplicate declared member label is refused');
    const duplicateCommitment = Fixture.copy(fixture.rosterInputs.compatible);
    duplicateCommitment.members[1].expectedPresentationRef = duplicateCommitment.members[0].expectedPresentationRef;
    throws(() => DeclaredDisclosure.buildRoster(duplicateCommitment), /presentation references must be unique/, 'duplicate expected presentation commitment is refused');
    const wrongPresentationSchema = Fixture.copy(fixture.rosterInputs.compatible);
    wrongPresentationSchema.members[0].expectedPresentationRef.schema = 'axm.wrong/v1';
    throws(() => DeclaredDisclosure.buildRoster(wrongPresentationSchema), /schema mismatch/, 'non-v0.9 presentation commitment is refused');

    const oversizedRoster = Fixture.copy(fixture.rosterInputs.compatible);
    oversizedRoster.padding = 'x'.repeat(DeclaredDisclosure.MAX_ROSTER_CANONICAL_BYTES);
    throws(() => DeclaredDisclosure.buildRoster(oversizedRoster), /canonical byte limit/, 'roster over canonical byte limit is refused before field processing');

    const unknownMember = Fixture.copy(fixture.assessmentInputs.compatible);
    unknownMember.submissions[0].memberId = 'member:undeclared';
    throws(() => DeclaredDisclosure.buildAssessment(unknownMember), /not in the roster/, 'submission for undeclared member label is refused');
    const duplicateSubmission = Fixture.copy(fixture.assessmentInputs.compatible);
    duplicateSubmission.submissions[1].memberId = duplicateSubmission.submissions[0].memberId;
    throws(() => DeclaredDisclosure.buildAssessment(duplicateSubmission), /at most one item per member/, 'duplicate submission for one member label is refused');
    const tooManySubmissions = Fixture.copy(fixture.assessmentInputs.compatible);
    tooManySubmissions.submissions = Array.from({ length: 65 }, () => Fixture.copy(fixture.submissions.a));
    throws(() => DeclaredDisclosure.buildAssessment(tooManySubmissions), /submissions exceed the bounded member limit/, 'assessment over bounded submission limit is refused');

    const tamperedPresentation = Fixture.copy(fixture.assessmentInputs.compatible);
    tamperedPresentation.submissions[0].presentation.presentationDigest = DeclaredDisclosure.sha256({ tampered: true });
    throws(() => DeclaredDisclosure.buildAssessment(tamperedPresentation), /presentation.*is invalid/, 'tampered submitted presentation is refused');
    const tamperedUpstreamPackage = Fixture.copy(fixture.assessmentInputs.compatible);
    tamperedUpstreamPackage.submissions[0].presentationInput.items[0].advanceInput.entryId += '-tampered';
    throws(() => DeclaredDisclosure.buildAssessment(tamperedUpstreamPackage), /presentation.*is invalid/, 'tampered transient upstream package is refused');
    const earlyAssessment = Fixture.copy(fixture.assessmentInputs.compatible);
    earlyAssessment.assessedAt = '2026-08-20T14:59:59.000Z';
    throws(() => DeclaredDisclosure.buildAssessment(earlyAssessment), /cannot predate the roster/, 'assessment cannot predate caller roster');
    const beforePresentation = Fixture.copy(fixture.assessmentInputs.compatible);
    beforePresentation.rosterInput.declaredAt = '2026-08-20T14:40:00.000Z';
    beforePresentation.roster = DeclaredDisclosure.buildRoster(beforePresentation.rosterInput);
    beforePresentation.assessedAt = '2026-08-20T14:49:59.000Z';
    throws(() => DeclaredDisclosure.buildAssessment(beforePresentation), /cannot predate presentation/, 'assessment cannot predate a submitted presentation');

    const undeclaredGlobalClaim = Fixture.copy(fixture.assessmentInputs.compatible);
    undeclaredGlobalClaim.globalCoverageProven = true;
    throws(() => DeclaredDisclosure.buildAssessment(undeclaredGlobalClaim), /unknown fields/, 'undeclared global coverage input is refused');
    const undeclaredAdoption = Fixture.copy(fixture.assessmentInputs.compatible);
    undeclaredAdoption.adoptionAuthorized = true;
    throws(() => DeclaredDisclosure.buildAssessment(undeclaredAdoption), /unknown fields/, 'undeclared adoption authority input is refused');

    const tamperedRosterReceipt = Fixture.copy(fixture.assessmentInputs.compatible);
    tamperedRosterReceipt.roster.truth.allExistingRootsEnumerated = true;
    throws(() => DeclaredDisclosure.buildAssessment(tamperedRosterReceipt), /roster is invalid/, 'roster authority tampering is refused');
    const tamperedAssessmentReceipt = Fixture.copy(compatible);
    tamperedAssessmentReceipt.truth.unlistedRootsExcluded = true;
    check(!DeclaredDisclosure.verifyAssessment(fixture.assessmentInputs.compatible, tamperedAssessmentReceipt).pass, 'global-exclusion receipt tamper fails exact verification');

    const oversizedAssessment = Fixture.copy(fixture.assessmentInputs.compatible);
    oversizedAssessment.padding = 'x'.repeat(DeclaredDisclosure.MAX_ASSESSMENT_CANONICAL_BYTES);
    throws(() => DeclaredDisclosure.buildAssessment(oversizedAssessment), /canonical byte limit/, 'assessment over canonical byte limit is refused before field processing');

    const child = childProcess.spawnSync(
      process.execPath,
      [path.join(__dirname, 'selftest-child.js')],
      {
        input: JSON.stringify({ input: fixture.assessmentInputs.allPairs }),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
      }
    );
    equal(child.status, 0, 'fresh process rebuild exits successfully');
    const childResult = JSON.parse(child.stdout);
    check(childResult.rosterPass, 'fresh process verifies rebuilt roster');
    check(childResult.receiptPass, 'fresh process verifies rebuilt assessment');
    equal(childResult.receiptDigest, allPairs.receiptDigest, 'fresh process derives exact assessment digest');
    equal(childResult.classification, allPairs.decision.classification, 'fresh process derives exact assessment classification');

    equal(rosterSchema.$id, DeclaredDisclosure.ROSTER_SCHEMA, 'roster schema identity matches implementation');
    equal(assessmentSchema.$id, DeclaredDisclosure.ASSESSMENT_SCHEMA, 'assessment schema identity matches implementation');
    equal(rosterSchema.properties.status.const, 'TEST', 'roster schema preserves TEST status');
    equal(assessmentSchema.properties.status.const, 'TEST', 'assessment schema preserves TEST status');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.permissions, [], 'contract remains permissionless');
    equal(contract.boundaries.reads, [], 'contract declares no direct read route');
    equal(contract.boundaries.writes, [], 'contract declares no direct write route');
    check(contract.boundaries.refuses.includes('complete-declared-commitment-coverage-as-all-existing-roots'), 'contract refuses declared coverage as all-root proof');
    check(contract.boundaries.refuses.includes('distinct-member-labels-as-independent-real-world-controllers'), 'contract refuses labels as controller-independence proof');
    check(contract.boundaries.refuses.includes('declared-coverage-as-actual-compelled-disclosure'), 'contract refuses declared coverage as actual compulsion');
    check(contract.boundaries.refuses.includes('all-pairs-prefix-compatibility-as-global-total-order-or-global-consistency'), 'contract refuses all-pairs prefix compatibility as global consistency');
    check(contract.boundaries.refuses.includes('assessment-receipt-as-branch-adoption-or-execution-authority'), 'contract refuses assessment as adoption or execution authority');
    equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');

    process.stdout.write('\nModel Shadow review challenge transition declared disclosure selftest: PASS (' + checks + ' checks)\n');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run();
