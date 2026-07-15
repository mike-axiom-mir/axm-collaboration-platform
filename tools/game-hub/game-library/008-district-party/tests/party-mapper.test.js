'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertValidSlot, partyIdForSlot } = require('../foundation-adapter/party-mapper');

test('central party mapping reserves slots 1-4 for A and 5-8 for B', () => {
  assert.equal(partyIdForSlot(1), 'party_a');
  assert.equal(partyIdForSlot(4), 'party_a');
  assert.equal(partyIdForSlot(5), 'party_b');
  assert.equal(partyIdForSlot(8), 'party_b');
  assert.equal(partyIdForSlot(0), null);
  assert.equal(partyIdForSlot(9), null);
  assert.equal(partyIdForSlot('not-a-slot'), null);
  assert.throws(() => assertValidSlot(9), { code: 'INVALID_SLOT' });
});
