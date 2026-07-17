'use strict';

const MIN_SLOT = 1;
const MAX_SLOT = 8;

function partyIdForSlot(slot) {
  const numericSlot = Number(slot);
  if (!Number.isInteger(numericSlot)) return null;
  if (numericSlot >= 1 && numericSlot <= 4) return 'party_a';
  if (numericSlot >= 5 && numericSlot <= 8) return 'party_b';
  return null;
}

function assertValidSlot(slot) {
  const numericSlot = Number(slot);
  if (!Number.isInteger(numericSlot) || numericSlot < MIN_SLOT || numericSlot > MAX_SLOT) {
    const error = new RangeError(`Player slot must be an integer from ${MIN_SLOT} through ${MAX_SLOT}.`);
    error.code = 'INVALID_SLOT';
    throw error;
  }
  return numericSlot;
}

module.exports = {
  MAX_SLOT,
  MIN_SLOT,
  assertValidSlot,
  partyIdForSlot,
};
