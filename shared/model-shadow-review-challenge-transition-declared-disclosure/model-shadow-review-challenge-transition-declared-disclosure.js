#!/usr/bin/env node
'use strict';

const Reconciliation = require('../model-shadow-review-challenge-transition-reconciliation/model-shadow-review-challenge-transition-reconciliation');

const ROSTER_SCHEMA = 'axm.model-shadow-review-challenge-transition-disclosure-roster/v1';
const ASSESSMENT_SCHEMA = 'axm.model-shadow-review-challenge-transition-declared-disclosure/v1';
const VERSION = '1.0.0';
const STATUS = 'TEST';
const NEXT_GATE = 'HOST_AUTHENTICATED_APPEND_ONLY_ROOT_REGISTRY_WITH_INDEPENDENT_RECEIVER_RECEIPTS_OR_PROTECTED_MONOTONIC_STORE';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const MAX_DECLARED_MEMBERS = 64;
const MAX_ROSTER_CANONICAL_BYTES = 128 * 1024;
const MAX_ASSESSMENT_CANONICAL_BYTES = 32 * 1024 * 1024;

function stableStringify(value) {
  return Reconciliation.stableStringify(value);
}

function copy(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return Reconciliation.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) throw new Error(label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}

function reference(value, label, requiredSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
  if (requiredSchema && result.schema !== requiredSchema) throw new Error(label + ' schema mismatch');
  return result;
}

function sameReference(left, right) {
  return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function withoutField(value, field) {
  const result = copy(value);
  delete result[field];
  return result;
}

function presentationRef(presentation) {
  return {
    id: presentation.presentationId,
    schema: presentation.schema,
    sha256: presentation.presentationDigest
  };
}

function rosterTruth() {
  return {
    memberSetCallerDeclared: true,
    expectedPresentationDigestsCommitted: true,
    declaredMemberSetAuthorityAuthenticated: false,
    declaredMemberIdentitiesAuthenticated: false,
    allExistingRootsEnumerated: false,
    actualMultiPartyDisclosureCompelled: false,
    realWorldControllerIndependenceProven: false,
    externallyRetained: false,
    protectedMonotonicStateProven: false,
    declarationTimeExternallyTrusted: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function buildRoster(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('declared disclosure roster input must be an object');
  if (Buffer.byteLength(stableStringify(input), 'utf8') > MAX_ROSTER_CANONICAL_BYTES) {
    throw new Error('declared disclosure roster exceeds the bounded canonical byte limit');
  }
  exactKeys(input, ['rosterId', 'declaredAt', 'members'], 'declared disclosure roster input');
  if (!Array.isArray(input.members)) throw new Error('declared disclosure roster members must be an array');
  if (input.members.length < 2) throw new Error('declared disclosure roster requires at least two members');
  if (input.members.length > MAX_DECLARED_MEMBERS) throw new Error('declared disclosure roster exceeds the bounded member limit');
  const rosterId = exactText(input.rosterId, 'declared disclosure roster id', 180);
  const declaredAt = timestamp(input.declaredAt, 'declared disclosure roster time');
  const seenMembers = new Set();
  const seenCommitments = new Set();
  const members = input.members.map((member, index) => {
    exactKeys(member, ['memberId', 'expectedPresentationRef'], 'declared disclosure roster member ' + (index + 1));
    const memberId = exactText(member.memberId, 'declared disclosure roster member id', 120);
    const expectedPresentationRef = reference(
      member.expectedPresentationRef,
      'declared disclosure expected presentation reference',
      Reconciliation.PRESENTATION_SCHEMA
    );
    if (seenMembers.has(memberId)) throw new Error('declared disclosure roster member ids must be unique');
    const commitmentKey = stableStringify(expectedPresentationRef);
    if (seenCommitments.has(commitmentKey)) throw new Error('declared disclosure expected presentation references must be unique');
    seenMembers.add(memberId);
    seenCommitments.add(commitmentKey);
    return { memberId, expectedPresentationRef };
  }).sort((left, right) => compareText(left.memberId, right.memberId));
  const roster = {
    schema: ROSTER_SCHEMA,
    version: VERSION,
    rosterId,
    declaredAt,
    status: STATUS,
    members,
    memberCount: members.length,
    truth: rosterTruth(),
    rosterDigest: null
  };
  roster.rosterDigest = sha256(withoutField(roster, 'rosterDigest'));
  return roster;
}

function verifyRoster(input, roster) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!roster || roster.schema !== ROSTER_SCHEMA) throw new Error('declared disclosure roster schema mismatch');
    rebuilt = buildRoster(copy(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(roster)) errors.push('declared disclosure roster content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

function exactRoster(input, roster) {
  const check = verifyRoster(copy(input), copy(roster));
  if (!check.pass) throw new Error('declared disclosure roster is invalid: ' + check.errors.join('; '));
  return check.rebuilt;
}

function exactPresentation(input, presentation, memberId) {
  const check = Reconciliation.verifyPresentation(copy(input), copy(presentation));
  if (!check.pass) throw new Error('declared disclosure presentation for ' + memberId + ' is invalid: ' + check.errors.join('; '));
  return check.rebuilt;
}

function pairReconciliation(roster, assessedAt, left, right) {
  const pairDigest = sha256({
    rosterDigest: roster.rosterDigest,
    leftMemberId: left.memberId,
    leftPresentationRef: left.submittedPresentationRef,
    rightMemberId: right.memberId,
    rightPresentationRef: right.submittedPresentationRef
  }).slice('sha256:'.length);
  const input = {
    reconciliationId: 'reconciliation:declared-disclosure:' + pairDigest,
    reconciledAt: assessedAt,
    leftPresentationInput: copy(left.presentationInput),
    leftPresentation: copy(left.presentation),
    rightPresentationInput: copy(right.presentationInput),
    rightPresentation: copy(right.presentation)
  };
  return Reconciliation.buildReconciliation(input);
}

function assessmentTruth(values) {
  return {
    rosterVerifiedByExactRebuild: true,
    everySubmittedPresentationVerifiedByExactRebuild: true,
    everyMatchingPresentationPairDeterministicallyReconciled: true,
    declaredPresentationCommitmentCoverageComplete: values.coverageComplete,
    declaredMissingPresentationCommitmentsDetected: values.missingCount > 0,
    declaredPresentationCommitmentMismatchDetected: values.mismatchCount > 0,
    coPresentedContradictionDetected: values.contradictionCount > 0,
    allDeclaredMatchingPairsPairwiseCompatible: values.coverageComplete && values.contradictionCount === 0,
    declaredMemberSetExhaustiveProven: false,
    unlistedRootsExcluded: false,
    undeclaredHistoryAbsenceProven: false,
    actualMultiPartyDisclosureCompelled: false,
    declaredMemberSetAuthorityAuthenticated: false,
    declaredMemberIdentitiesAuthenticated: false,
    realWorldControllerIndependenceProven: false,
    globallyConsistentTransitionLogProven: false,
    globalTransitionUniquenessProven: false,
    externalTransitionRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    assessmentTimeExternallyTrusted: false,
    actualHumanParticipationProven: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function classify(coverageComplete, contradictionCount) {
  if (!coverageComplete) return 'HOLD_DECLARED_PRESENTATION_COMMITMENT_COVERAGE_INCOMPLETE';
  if (contradictionCount > 0) return 'HOLD_DECLARED_SET_PRESENTED_HISTORY_CONTRADICTION';
  return 'DECLARED_SET_PRESENTATIONS_PAIRWISE_COMPATIBLE';
}

function bestAction(classification) {
  if (classification === 'HOLD_DECLARED_PRESENTATION_COMMITMENT_COVERAGE_INCOMPLETE') {
    return 'PRESERVE_ROSTER_AND_SUBMISSIONS_AND_REQUEST_MISSING_OR_EXACT_COMMITTED_PRESENTATIONS';
  }
  if (classification === 'HOLD_DECLARED_SET_PRESENTED_HISTORY_CONTRADICTION') {
    return 'PRESERVE_ALL_PRESENTATIONS_AND_PAIR_RECEIPTS_AND_REQUEST_STEWARD_RECONCILIATION';
  }
  return 'PRESERVE_DECLARED_SET_RECEIPT_AND_ALLOW_NO_AUTONOMOUS_ADOPTION';
}

function buildAssessment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('declared disclosure assessment input must be an object');
  if (Buffer.byteLength(stableStringify(input), 'utf8') > MAX_ASSESSMENT_CANONICAL_BYTES) {
    throw new Error('declared disclosure assessment exceeds the bounded canonical byte limit');
  }
  exactKeys(input, ['assessmentId', 'assessedAt', 'rosterInput', 'roster', 'submissions'], 'declared disclosure assessment input');
  if (!Array.isArray(input.submissions)) throw new Error('declared disclosure submissions must be an array');
  if (input.submissions.length > MAX_DECLARED_MEMBERS) throw new Error('declared disclosure submissions exceed the bounded member limit');
  const assessmentId = exactText(input.assessmentId, 'declared disclosure assessment id', 180);
  const assessedAt = timestamp(input.assessedAt, 'declared disclosure assessment time');
  const roster = exactRoster(input.rosterInput, input.roster);
  if (Date.parse(assessedAt) < Date.parse(roster.declaredAt)) throw new Error('declared disclosure assessment cannot predate the roster');

  const rosterMembers = new Map(roster.members.map(member => [member.memberId, member]));
  const seenSubmissions = new Set();
  const rebuiltSubmissions = input.submissions.map((submission, index) => {
    exactKeys(submission, ['memberId', 'presentationInput', 'presentation'], 'declared disclosure submission ' + (index + 1));
    const memberId = exactText(submission.memberId, 'declared disclosure submission member id', 120);
    if (!rosterMembers.has(memberId)) throw new Error('declared disclosure submission member is not in the roster: ' + memberId);
    if (seenSubmissions.has(memberId)) throw new Error('declared disclosure submissions must contain at most one item per member');
    seenSubmissions.add(memberId);
    const presentation = exactPresentation(submission.presentationInput, submission.presentation, memberId);
    if (Date.parse(assessedAt) < Date.parse(presentation.presentedAt)) {
      throw new Error('declared disclosure assessment cannot predate presentation for ' + memberId);
    }
    const submittedPresentationRef = presentationRef(presentation);
    const expectedPresentationRef = copy(rosterMembers.get(memberId).expectedPresentationRef);
    return {
      memberId,
      expectedPresentationRef,
      submittedPresentationRef,
      commitmentMatches: sameReference(expectedPresentationRef, submittedPresentationRef),
      presentationInput: copy(submission.presentationInput),
      presentation
    };
  }).sort((left, right) => compareText(left.memberId, right.memberId));

  const missingMemberIds = roster.members
    .filter(member => !seenSubmissions.has(member.memberId))
    .map(member => member.memberId);
  const mismatchedCommitments = rebuiltSubmissions
    .filter(submission => !submission.commitmentMatches)
    .map(submission => ({
      memberId: submission.memberId,
      expectedPresentationRef: copy(submission.expectedPresentationRef),
      submittedPresentationRef: copy(submission.submittedPresentationRef)
    }));
  const matching = rebuiltSubmissions.filter(submission => submission.commitmentMatches);
  const pairwiseComparisons = [];
  for (let leftIndex = 0; leftIndex < matching.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < matching.length; rightIndex += 1) {
      const left = matching[leftIndex];
      const right = matching[rightIndex];
      const reconciliation = pairReconciliation(roster, assessedAt, left, right);
      pairwiseComparisons.push({
        leftMemberId: left.memberId,
        rightMemberId: right.memberId,
        reconciliationRef: {
          id: reconciliation.reconciliationId,
          schema: reconciliation.schema,
          sha256: reconciliation.receiptDigest
        },
        classification: reconciliation.decision.classification,
        pairwiseConsistency: reconciliation.decision.pairwiseConsistency,
        commonPrefixEntryCount: reconciliation.comparison.commonPrefixEntryCount
      });
    }
  }
  const contradictionCount = pairwiseComparisons.filter(pair => pair.pairwiseConsistency === 'CONTRADICTION').length;
  const coverageComplete = missingMemberIds.length === 0 && mismatchedCommitments.length === 0;
  const classification = classify(coverageComplete, contradictionCount);
  const submissionSummaries = rebuiltSubmissions.map(submission => ({
    memberId: submission.memberId,
    expectedPresentationRef: copy(submission.expectedPresentationRef),
    submittedPresentationRef: copy(submission.submittedPresentationRef),
    commitmentMatches: submission.commitmentMatches
  }));
  const receipt = {
    schema: ASSESSMENT_SCHEMA,
    version: VERSION,
    assessmentId,
    assessedAt,
    status: STATUS,
    rosterRef: { id: roster.rosterId, schema: roster.schema, sha256: roster.rosterDigest },
    declaredMemberCount: roster.memberCount,
    submittedMemberCount: rebuiltSubmissions.length,
    matchingCommitmentCount: matching.length,
    missingMemberIds,
    mismatchedCommitments,
    submissions: submissionSummaries,
    pairwiseComparisons,
    decision: {
      classification,
      declaredCommitmentCoverage: coverageComplete ? 'COMPLETE' : 'INCOMPLETE',
      pairwiseContradictionCount: contradictionCount,
      reviewRequired: classification.startsWith('HOLD_'),
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    state: 'DECLARED_PRESENTATION_COMMITMENTS_ASSESSED_UNLISTED_ROOTS_NOT_EXCLUDED',
    nextGate: NEXT_GATE,
    truth: assessmentTruth({
      coverageComplete,
      missingCount: missingMemberIds.length,
      mismatchCount: mismatchedCommitments.length,
      contradictionCount
    }),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  return receipt;
}

function verifyAssessment(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== ASSESSMENT_SCHEMA) throw new Error('declared disclosure assessment receipt schema mismatch');
    rebuilt = buildAssessment(copy(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('declared disclosure assessment receipt content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  ROSTER_SCHEMA,
  ASSESSMENT_SCHEMA,
  VERSION,
  STATUS,
  NEXT_GATE,
  MAX_DECLARED_MEMBERS,
  MAX_ROSTER_CANONICAL_BYTES,
  MAX_ASSESSMENT_CANONICAL_BYTES,
  stableStringify,
  sha256,
  presentationRef,
  buildRoster,
  verifyRoster,
  buildAssessment,
  verifyAssessment
};
