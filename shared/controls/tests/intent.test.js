'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const firstPersonProfile = require('../profiles/first-person-explore.json');
const {
  createIntentSanitizer,
  normalizeVector,
  validateInputPacket,
} = require('../src/shared/intent');

test('independent vectors are normalized and unknown authority claims are discarded', () => {
  const sanitize = createIntentSanitizer(firstPersonProfile.intent);
  const clean = sanitize({
    moveX: 9, moveY: 9, lookX: -20, lookY: 0,
    lookActive: true, interact: true,
    finalPosition: { x: 9999, y: 9999 }, claimedHit: 'target-7', money: 999999,
  });
  assert.ok(Math.abs(Math.hypot(clean.moveX, clean.moveY) - 1) < 1e-12);
  assert.deepEqual({ x: clean.lookX, y: clean.lookY }, { x: -1, y: 0 });
  assert.equal(clean.lookActive, true);
  assert.equal(clean.interact, true);
  assert.equal('finalPosition' in clean, false);
  assert.equal('claimedHit' in clean, false);
  assert.equal('money' in clean, false);
});

test('invalid numbers become safe bounded values', () => {
  assert.deepEqual(normalizeVector(Number.NaN, Infinity), { x: 0, y: 0 });
  const sanitize = createIntentSanitizer();
  assert.deepEqual(
    { moveX: sanitize({ moveX: 'bad', moveY: null }).moveX, moveY: sanitize({ moveX: 'bad', moveY: null }).moveY },
    { moveX: 0, moveY: 0 },
  );
});

test('packet validation requires local identity, sequence, and object input', () => {
  const good = {
    roomCode: 'AXM1', sessionId: 'session-one', seatId: 'seat_1', token: 'private-token', seq: 0, input: {},
  };
  assert.deepEqual(validateInputPacket(good), { ok: true, errors: [] });
  const bad = validateInputPacket({ ...good, seq: -1, input: [], token: '' });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors, ['invalid-token', 'invalid-sequence', 'invalid-input']);
});
