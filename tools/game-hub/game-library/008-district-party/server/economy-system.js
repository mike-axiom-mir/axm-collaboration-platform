'use strict';

const FUND_MIN_CENTS = 0;
const FUND_MAX_CENTS = 99_999_999;
const PERSONAL_REWARD_PERCENT = 40;
const PARTY_REWARD_PERCENT = 60;
const PARTY_IDS = Object.freeze(['party_a', 'party_b']);
const MAX_LEDGER_ENTRIES = 32;

function validPartyId(partyId) {
  return PARTY_IDS.includes(partyId);
}

function normalizeCents(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(FUND_MIN_CENTS, Math.min(FUND_MAX_CENTS, Math.round(Number(value))));
}

function splitRewardCents(grossCents) {
  const gross = normalizeCents(grossCents);
  const partyCents = Math.round(gross * PARTY_REWARD_PERCENT / 100);
  return {
    grossCents: gross,
    personalCents: gross - partyCents,
    partyCents,
    personalPercent: PERSONAL_REWARD_PERCENT,
    partyPercent: PARTY_REWARD_PERCENT,
  };
}

function createEconomyState() {
  return {
    rewardSplit: {
      personalPercent: PERSONAL_REWARD_PERCENT,
      partyPercent: PARTY_REWARD_PERCENT,
    },
    partyFunds: { party_a: 0, party_b: 0 },
    lifetimePartyIncome: { party_a: 0, party_b: 0 },
    recentTransactions: [],
  };
}

function ensureEconomy(world) {
  world.economy ||= createEconomyState();
  world.economy.rewardSplit ||= { personalPercent: PERSONAL_REWARD_PERCENT, partyPercent: PARTY_REWARD_PERCENT };
  world.economy.partyFunds ||= { party_a: 0, party_b: 0 };
  world.economy.lifetimePartyIncome ||= { party_a: 0, party_b: 0 };
  world.economy.recentTransactions ||= [];
  for (const partyId of PARTY_IDS) {
    world.economy.partyFunds[partyId] = normalizeCents(world.economy.partyFunds[partyId]);
    world.economy.lifetimePartyIncome[partyId] = normalizeCents(world.economy.lifetimePartyIncome[partyId]);
  }
  return world.economy;
}

function recordTransaction(world, transaction) {
  const economy = ensureEconomy(world);
  economy.recentTransactions.push({ tick: Number(world.tick) || 0, ...transaction });
  if (economy.recentTransactions.length > MAX_LEDGER_ENTRIES) {
    economy.recentTransactions.splice(0, economy.recentTransactions.length - MAX_LEDGER_ENTRIES);
  }
}

function addCapped(current, requested) {
  const before = normalizeCents(current);
  const amount = normalizeCents(requested);
  const after = Math.min(FUND_MAX_CENTS, before + amount);
  return { before, after, credited: after - before, discarded: amount - (after - before) };
}

function creditSplitReward(world, actor, grossCents, source = 'mission-reward') {
  if (!actor || !validPartyId(actor.partyId)) return { ok: false, reason: 'invalid-reward-actor' };
  const economy = ensureEconomy(world);
  const split = splitRewardCents(grossCents);
  const personal = addCapped(actor.walletCents, split.personalCents);
  const party = addCapped(economy.partyFunds[actor.partyId], split.partyCents);
  actor.walletCents = personal.after;
  economy.partyFunds[actor.partyId] = party.after;
  economy.lifetimePartyIncome[actor.partyId] = addCapped(
    economy.lifetimePartyIncome[actor.partyId],
    party.credited,
  ).after;
  const result = {
    ok: true,
    source,
    actorId: actor.id,
    partyId: actor.partyId,
    ...split,
    personalCreditedCents: personal.credited,
    partyCreditedCents: party.credited,
    discardedCents: personal.discarded + party.discarded,
    personalBalanceCents: personal.after,
    partyBalanceCents: party.after,
  };
  recordTransaction(world, { type: 'split-credit', ...result });
  return result;
}

function creditPartyFunds(world, partyId, amountCents, source = 'party-income') {
  if (!validPartyId(partyId)) return { ok: false, reason: 'unknown-party' };
  const economy = ensureEconomy(world);
  const credit = addCapped(economy.partyFunds[partyId], amountCents);
  economy.partyFunds[partyId] = credit.after;
  economy.lifetimePartyIncome[partyId] = addCapped(economy.lifetimePartyIncome[partyId], credit.credited).after;
  const result = { ok: true, partyId, source, requestedCents: normalizeCents(amountCents), creditedCents: credit.credited, discardedCents: credit.discarded, partyBalanceCents: credit.after };
  recordTransaction(world, { type: 'party-credit', ...result });
  return result;
}

function spendPartyFunds(world, partyId, amountCents, source = 'party-purchase', actorId = null) {
  if (!validPartyId(partyId)) return { ok: false, reason: 'unknown-party' };
  const amount = normalizeCents(amountCents);
  if (amount <= 0) return { ok: false, reason: 'invalid-amount' };
  const economy = ensureEconomy(world);
  const before = economy.partyFunds[partyId];
  if (before < amount) return { ok: false, reason: 'insufficient-party-funds', availableCents: before };
  economy.partyFunds[partyId] = before - amount;
  const result = { ok: true, partyId, actorId, source, spentCents: amount, partyBalanceCents: economy.partyFunds[partyId] };
  recordTransaction(world, { type: 'party-spend', ...result });
  return result;
}

function spendPersonalFunds(world, actor, amountCents, source = 'personal-purchase') {
  if (!actor || !validPartyId(actor.partyId)) return { ok: false, reason: 'invalid-spending-actor' };
  const amount = normalizeCents(amountCents);
  if (amount <= 0) return { ok: false, reason: 'invalid-amount' };
  const before = normalizeCents(actor.walletCents);
  if (before < amount) return { ok: false, reason: 'insufficient-personal-funds', availableCents: before };
  actor.walletCents = before - amount;
  const result = { ok: true, actorId: actor.id, partyId: actor.partyId, source, spentCents: amount, personalBalanceCents: actor.walletCents };
  recordTransaction(world, { type: 'personal-spend', ...result });
  return result;
}

module.exports = {
  FUND_MAX_CENTS,
  FUND_MIN_CENTS,
  PARTY_REWARD_PERCENT,
  PERSONAL_REWARD_PERCENT,
  createEconomyState,
  creditPartyFunds,
  creditSplitReward,
  ensureEconomy,
  normalizeCents,
  spendPartyFunds,
  spendPersonalFunds,
  splitRewardCents,
  validPartyId,
};
