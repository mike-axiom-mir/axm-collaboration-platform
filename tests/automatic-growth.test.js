'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Episode = require('../training/session-episode');
const AutomaticGrowth = require('../training/automatic-growth');
const Curriculum = require('../training/workshop-steward-curriculum');

function candidate() {
  return Episode.normalize({
    schema: Episode.SCHEMA, groupId: 'automatic-practice/fixture',
    source: { provider: 'axm-workshop-local', model: 'mirror-kernel', usePermission: 'allowed', permissionBasis: 'fixture permission', capturedBy: 'fixture' },
    goal: 'Test automatic bounded practice.', observations: ['Observed fixture.'], evidenceRefs: ['fixture://one'],
    candidates: ['Hold the fixture.'], decision: 'Hold.', outcome: 'Held without mutation.',
    verification: ['Expected hold observed.'], repairs: ['Add evidence later.'], limitations: ['Fixture only.']
  });
}

test('standing policy admits verified local practice without promoting authority', () => {
  const approved = AutomaticGrowth.approvePracticeEpisode(candidate(), {
    explicitSession: true, expectedDecisionMatched: true, outcomeVerified: true,
    worldMutations: 0, networkCalls: 0, runtimePointerChanged: false, unexpectedSeams: [], behavior: 'held correctly'
  });
  assert.equal(approved.review.state, 'APPROVED');
  assert.equal(approved.review.mode, 'standing-permission-policy');
  assert.equal(approved.review.promoted, false);
  assert.equal(Episode.toTrainingText(approved).includes('Held without mutation.'), true);
});

test('automatic practice refuses mutation, network use, or an unexpected seam', () => {
  const base = { explicitSession: true, expectedDecisionMatched: true, outcomeVerified: true, worldMutations: 0, networkCalls: 0, runtimePointerChanged: false, unexpectedSeams: [] };
  assert.throws(() => AutomaticGrowth.approvePracticeEpisode(candidate(), Object.assign({}, base, { worldMutations: 1 })), /refuses mutation/);
  assert.throws(() => AutomaticGrowth.approvePracticeEpisode(candidate(), Object.assign({}, base, { networkCalls: 1 })), /refuses mutation/);
  assert.throws(() => AutomaticGrowth.approvePracticeEpisode(candidate(), Object.assign({}, base, { unexpectedSeams: ['surprise'] })), /unexpected seams/);
});

test('unexpected seam is preserved as a frontier proposal without automatic admission', () => {
  const proposal = AutomaticGrowth.proposeUnexpectedFrontier(candidate(), {
    explicitSession: true, outcomeVerified: true, worldMutations: 0, networkCalls: 0,
    runtimePointerChanged: false, unexpectedSeams: ['new-state-shape']
  });
  assert.equal(proposal.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.equal(proposal.proposal.state, 'AWAITING_REVIEW');
  assert.equal(proposal.authority.automaticPromotion, false);
});

test('curriculum spans pass, hold, and refusal behavior without action execution', () => {
  const lessons = Curriculum.lessonDefinitions('C:\\axm workshop');
  assert.equal(lessons.length, 5);
  assert.deepEqual(Array.from(new Set(lessons.map(lesson => lesson.expectedValue))).sort(), [-1, 0, 1]);
  assert.ok(lessons.every(lesson => lesson.contractFile && lesson.expectedAction));
});
