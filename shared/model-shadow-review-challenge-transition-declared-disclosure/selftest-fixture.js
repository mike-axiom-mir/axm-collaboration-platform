'use strict';

const DeclaredDisclosure = require('./model-shadow-review-challenge-transition-declared-disclosure');
const ReconciliationFixture = require('../model-shadow-review-challenge-transition-reconciliation/selftest-fixture');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function member(memberId, presentation) {
  return {
    memberId,
    expectedPresentationRef: DeclaredDisclosure.presentationRef(presentation)
  };
}

function rosterInput(tag, members, declaredAt) {
  return {
    rosterId: 'disclosure-roster:' + tag,
    declaredAt: declaredAt || '2026-08-20T15:00:00.000Z',
    members: copy(members)
  };
}

function submission(memberId, presentationInput, presentation) {
  return {
    memberId,
    presentationInput: copy(presentationInput),
    presentation: copy(presentation)
  };
}

function assessmentInput(tag, rosterInputValue, roster, submissions, assessedAt) {
  return {
    assessmentId: 'disclosure-assessment:' + tag,
    assessedAt: assessedAt || '2026-08-20T15:05:00.000Z',
    rosterInput: copy(rosterInputValue),
    roster: copy(roster),
    submissions: copy(submissions)
  };
}

function buildFixture(tempRoot) {
  const upstream = ReconciliationFixture.buildFixture(tempRoot);
  const rosterInputs = {
    compatible: rosterInput('compatible', [
      member('member:ac', upstream.presentations.ac),
      member('member:a', upstream.presentations.a)
    ]),
    contradiction: rosterInput('contradiction', [
      member('member:ac', upstream.presentations.ac),
      member('member:ad', upstream.presentations.ad)
    ]),
    allPairs: rosterInput('all-pairs', [
      member('member:ad', upstream.presentations.ad),
      member('member:a', upstream.presentations.a),
      member('member:ac', upstream.presentations.ac)
    ]),
    missing: rosterInput('missing', [
      member('member:a', upstream.presentations.a),
      member('member:ac', upstream.presentations.ac),
      member('member:b', upstream.presentations.b)
    ]),
    mismatch: rosterInput('mismatch', [
      member('member:a', upstream.presentations.a),
      member('member:ac', upstream.presentations.ac)
    ])
  };
  const rosters = {};
  Object.entries(rosterInputs).forEach(([key, value]) => {
    rosters[key] = DeclaredDisclosure.buildRoster(value);
  });
  const submissions = {
    a: submission('member:a', upstream.presentationInputs.a, upstream.presentations.a),
    ac: submission('member:ac', upstream.presentationInputs.ac, upstream.presentations.ac),
    ad: submission('member:ad', upstream.presentationInputs.ad, upstream.presentations.ad),
    b: submission('member:b', upstream.presentationInputs.b, upstream.presentations.b),
    mismatchedAWithB: submission('member:a', upstream.presentationInputs.b, upstream.presentations.b)
  };
  const assessmentInputs = {
    compatible: assessmentInput('compatible', rosterInputs.compatible, rosters.compatible, [submissions.ac, submissions.a]),
    contradiction: assessmentInput('contradiction', rosterInputs.contradiction, rosters.contradiction, [submissions.ad, submissions.ac]),
    allPairs: assessmentInput('all-pairs', rosterInputs.allPairs, rosters.allPairs, [submissions.ad, submissions.a, submissions.ac]),
    missing: assessmentInput('missing', rosterInputs.missing, rosters.missing, [submissions.ac, submissions.a]),
    mismatch: assessmentInput('mismatch', rosterInputs.mismatch, rosters.mismatch, [submissions.ac, submissions.mismatchedAWithB])
  };
  return {
    upstream,
    rosterInputs,
    rosters,
    submissions,
    assessmentInputs,
    member,
    rosterInput,
    submission,
    assessmentInput
  };
}

module.exports = { copy, member, rosterInput, submission, assessmentInput, buildFixture };
