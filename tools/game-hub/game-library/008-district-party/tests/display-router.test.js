'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPartyScreenRoute,
  getDisplayState,
  validateInternalPartyScreenRoute,
} = require('../foundation-adapter/display-router');

const session = { id: 'session-12345678abcd', roomCode: 'AXM1', status: 'running' };

test('Party A, Party B, and all build distinct local game routes', () => {
  for (const partyId of ['party_a', 'party_b', 'all']) {
    const state = getDisplayState(session, partyId);
    assert.equal(state.partyId, partyId);
    assert.match(state.screenUrl, /^\/game\/\?/);
    assert.match(state.screenUrl, new RegExp(`party=${partyId}`));
  }
});

test('display route validation rejects external, unknown, and stale routes', () => {
  const expected = { roomCode: 'AXM1', sessionId: session.id, partyId: 'party_a' };
  assert.equal(validateInternalPartyScreenRoute('https://example.com/game/', expected).ok, false);
  assert.equal(validateInternalPartyScreenRoute('//evil.invalid/game/', expected).ok, false);
  assert.throws(() => buildPartyScreenRoute({ ...expected, partyId: 'unknown' }), { code: 'INVALID_PARTY' });
  const old = buildPartyScreenRoute({ roomCode: 'AXM1', sessionId: 'session-aaaaaaaaaaaa', partyId: 'party_a' });
  assert.equal(validateInternalPartyScreenRoute(old, expected).reason, 'stale-session');
});

test('ended session returns the persistent display to waiting', () => {
  assert.equal(getDisplayState(null, 'party_a').status, 'waiting');
  assert.equal(getDisplayState({ ...session, status: 'ended' }, 'party_b').screenUrl, null);
});
