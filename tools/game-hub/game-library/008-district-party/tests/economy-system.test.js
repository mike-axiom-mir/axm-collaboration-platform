'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const {
  FUND_MAX_CENTS,
  creditPartyFunds,
  creditSplitReward,
  spendPartyFunds,
  spendPersonalFunds,
  splitRewardCents,
} = require('../server/economy-system');

function makeWorld(count = 8) {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: Array.from({ length: count }, (_, index) => ({
      actorId: `actor-seat-${index + 1}`,
      seatId: `seat_${index + 1}`,
      slot: index + 1,
      displayName: `P${index + 1}`,
      controllerType: 'human',
      partyId: index < 4 ? 'party_a' : 'party_b',
    })),
  });
}

test('60/40 reward split uses integer cents and never loses a cent', () => {
  assert.deepEqual(splitRewardCents(1500), {
    grossCents: 1500,
    personalCents: 600,
    partyCents: 900,
    personalPercent: 40,
    partyPercent: 60,
  });
  for (let gross = 0; gross < 101; gross += 1) {
    const split = splitRewardCents(gross);
    assert.equal(split.personalCents + split.partyCents, gross);
  }
});

test('split credit changes only the earning player and that player party treasury', () => {
  const world = makeWorld();
  const actor = world.actors['actor-seat-5'];
  const result = creditSplitReward(world, actor, 2500, 'test-reward');
  assert.equal(result.ok, true);
  assert.equal(actor.walletCents, 11000);
  assert.deepEqual(world.economy.partyFunds, { party_a: 0, party_b: 1500 });
  assert.equal(world.actors['actor-seat-1'].walletCents, 10000);
});

test('eight seats can contribute independently while Party A and Party B funds stay isolated', () => {
  const world = makeWorld();
  Object.values(world.actors).forEach((actor) => creditSplitReward(world, actor, 1500));
  assert.ok(Object.values(world.actors).every((actor) => actor.walletCents === 10600));
  assert.deepEqual(world.economy.partyFunds, { party_a: 3600, party_b: 3600 });
  assert.deepEqual(world.economy.lifetimePartyIncome, { party_a: 3600, party_b: 3600 });
});

test('personal and group spending are host-owned, bounded and cannot cross party balances', () => {
  const world = makeWorld();
  const actor = world.actors['actor-seat-1'];
  assert.equal(creditPartyFunds(world, 'party_a', 3000).creditedCents, 3000);
  assert.equal(spendPartyFunds(world, 'party_a', 1200, 'future-squad', actor.id).partyBalanceCents, 1800);
  assert.equal(spendPartyFunds(world, 'party_b', 1).reason, 'insufficient-party-funds');
  assert.equal(spendPartyFunds(world, 'unknown', 1).reason, 'unknown-party');
  assert.equal(spendPersonalFunds(world, actor, 2500, 'future-weapon').personalBalanceCents, 7500);
  assert.equal(spendPersonalFunds(world, actor, 8000).reason, 'insufficient-personal-funds');
});

test('fund caps report discarded overflow without silently moving it between balances', () => {
  const world = makeWorld(1);
  const actor = world.actors['actor-seat-1'];
  actor.walletCents = FUND_MAX_CENTS - 100;
  world.economy.partyFunds.party_a = FUND_MAX_CENTS - 100;
  const result = creditSplitReward(world, actor, 1000);
  assert.equal(actor.walletCents, FUND_MAX_CENTS);
  assert.equal(world.economy.partyFunds.party_a, FUND_MAX_CENTS);
  assert.equal(result.personalCreditedCents, 100);
  assert.equal(result.partyCreditedCents, 100);
  assert.equal(result.discardedCents, 800);
});
