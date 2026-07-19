'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Episode = require('../training/session-episode');

function valid() {
  return {
    schema: Episode.SCHEMA,
    groupId: 'studio-first-mark/session-family-1',
    source: {
      provider: 'axm-workshop', model: 'mirror-seed-0', sessionRef: 'studio://session-1',
      usePermission: 'allowed', permissionBasis: 'Mike explicitly allowed this bounded session for local Mirror learning review.', capturedBy: 'mike'
    },
    goal: 'Place one visible mark on the Mirror layer.',
    observations: ['The Mirror layer was blank and writable only through the bounded Studio route.'],
    evidenceRefs: ['receipt://studio-session-1'],
    candidates: ['Place one dot.', 'Hold because no candidate organ exists.'],
    decision: 'Hold because no independent candidate organ exists.',
    outcome: 'No pixels changed.',
    verification: ['The before and after pixel hashes matched.'],
    repairs: ['Add a bounded candidate proposal organ before repeating.'],
    limitations: ['This does not demonstrate creative capability.']
  };
}

test('session intake creates a candidate, never automatic training material', () => {
  const episode = Episode.normalize(valid());
  assert.equal(episode.review.state, 'CANDIDATE');
  assert.equal(episode.review.promoted, false);
  assert.equal(episode.digest.length, 64);
  assert.throws(() => Episode.toTrainingText(episode), /APPROVED/);
});

test('approval is digest-bound and creates reviewable training text', () => {
  const episode = Episode.normalize(valid());
  assert.throws(() => Episode.approve(episode, { reviewer: 'mike', statement: 'checked', expectedDigest: 'bad' }), /digest/);
  const approved = Episode.approve(episode, { reviewer: 'mike', statement: 'Outcome and boundary checked.', expectedDigest: episode.digest });
  assert.equal(approved.review.state, 'APPROVED');
  assert.match(Episode.toTrainingText(approved), /<VERIFY>/);
});

test('unknown rights and hidden reasoning are refused', () => {
  const rights = valid(); rights.source.usePermission = 'unknown';
  assert.throws(() => Episode.normalize(rights), /explicit usePermission/);
  const hidden = valid(); hidden.source.scratchpad = 'private';
  assert.throws(() => Episode.normalize(hidden), /private reasoning field refused/);
});
