'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canDamage, evaluateDamagePermission } = require('../server/damage-rules');

const A1 = { id: 'a1', partyId: 'party_a' };
const A2 = { id: 'a2', partyId: 'party_a' };
const B1 = { id: 'b1', partyId: 'party_b' };
const B2 = { id: 'b2', partyId: 'party_b' };
const rules = (patch = {}) => ({
  enabled: true,
  crossPartyDamage: true,
  selfDamage: false,
  partyFriendlyFire: { party_a: false, party_b: false },
  environmentDamage: true,
  ...patch,
});

test('enforces every required per-party and cross-party friendly-fire combination', () => {
  assert.equal(canDamage(A1, A2, {}, rules()), false, 'A->A off');
  assert.equal(canDamage(A1, A2, {}, rules({ partyFriendlyFire: { party_a: true, party_b: false } })), true, 'A->A on');
  assert.equal(canDamage(B1, B2, {}, rules()), false, 'B->B off');
  assert.equal(canDamage(B1, B2, {}, rules({ partyFriendlyFire: { party_a: false, party_b: true } })), true, 'B->B on');
  assert.equal(canDamage(A1, B1, {}, rules({ crossPartyDamage: true })), true, 'A->B cross on');
  assert.equal(canDamage(A1, B1, {}, rules({ crossPartyDamage: false })), false, 'A->B cross off');
  assert.equal(canDamage(B1, A1, {}, rules({ crossPartyDamage: true })), true, 'B->A cross on');
  assert.equal(canDamage(A1, A1, {}, rules({ selfDamage: false })), false, 'self off');
  assert.equal(canDamage(A1, A1, {}, rules({ selfDamage: true })), true, 'self on');
});

test('safe zones block player attacks on the authoritative rule path', () => {
  const result = evaluateDamagePermission(A1, B1, { channel: 'projectileDamage', safeZone: true }, rules());
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'safe-zone');
});

test('environment damage follows its separate host rule', () => {
  assert.equal(canDamage(null, A1, { environment: true }, rules({ environmentDamage: true })), true);
  assert.equal(canDamage(null, A1, { channel: 'environmentDamage' }, rules({ environmentDamage: false })), false);
});

test('implemented melee works while reserved and unknown damage channels fail safely', () => {
  assert.equal(canDamage(A1, B1, { channel: 'meleeDamage' }, rules()), true);
  assert.equal(canDamage(A1, B1, { channel: 'explosionDamage' }, rules()), false);
  assert.equal(canDamage(A1, B1, { channel: 'vehicleImpactDamage' }, rules()), false);
  assert.equal(canDamage(A1, B1, { channel: 'inventedDamage' }, rules()), false);
  assert.equal(canDamage(A1, A1, { channel: 'meleeDamage' }, rules({ selfDamage: true })), true);
  assert.equal(canDamage(A1, B1, { channel: 'projectileDamage' }, rules({ channels: { projectileDamage: { crossParty: true } } })), true, 'partial projectile metadata retains implemented=true');
});
