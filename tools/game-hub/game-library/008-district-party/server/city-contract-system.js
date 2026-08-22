'use strict';

const { TICK_RATE } = require('../shared/constants');
const { normalizeCents } = require('./economy-system');
const { createHostileNpc } = require('./npc-factory');

const CONTRACT_RADIUS = 64;

function checkpoint(id, label, x, y) {
  return Object.freeze({ id, label, position: Object.freeze({ x, y }) });
}

const CONTRACT_DEFINITIONS = Object.freeze({
  courier: Object.freeze({
    id: 'courier',
    label: 'NEON COURIER CIRCUIT',
    detail: 'four cooperative ACTION handoffs across the living district',
    durationSeconds: 150,
    rewardCents: 3200,
    mode: 'action',
    checkpoints: Object.freeze([
      checkpoint('courier-armory', 'Collect the armory parcel', 6240, 4190),
      checkpoint('courier-market', 'Deliver to Centre Market', 6940, 4470),
      checkpoint('courier-garage', 'Pick up the garage manifest', 6045, 4680),
      checkpoint('courier-harbour', 'Complete the harbour handoff', 7424, 5248),
    ]),
  }),
  streetRace: Object.freeze({
    id: 'streetRace',
    label: 'CIVIC NIGHT RUN',
    detail: 'load the crew into one car and drive four glowing gates',
    durationSeconds: 105,
    rewardCents: 4000,
    mode: 'vehicle',
    checkpoints: Object.freeze([
      checkpoint('race-north-west', 'North-west gate', 5940, 4240),
      checkpoint('race-north-east', 'North-east gate', 6860, 4240),
      checkpoint('race-south-east', 'South-east gate', 6860, 4930),
      checkpoint('race-south-west', 'South-west finish', 5940, 4930),
    ]),
  }),
  patrol: Object.freeze({
    id: 'patrol',
    label: 'NEON RIVAL PATROL',
    detail: 'answer three calls and clear each deterministic rival pair',
    durationSeconds: 165,
    rewardCents: 4800,
    mode: 'patrol',
    checkpoints: Object.freeze([
      checkpoint('patrol-crossing', 'Answer the civic crossing call', 6200, 4400),
      checkpoint('patrol-market', 'Secure the market lane', 6820, 4520),
      checkpoint('patrol-garage', 'Break the garage ambush', 6200, 4820),
    ]),
  }),
});

const CITY_CONTRACT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'contract-courier', label: 'START NEON COURIER', detail: CONTRACT_DEFINITIONS.courier.detail, priceCents: 0 }),
  Object.freeze({ id: 'contract-race', label: 'START CIVIC NIGHT RUN', detail: CONTRACT_DEFINITIONS.streetRace.detail, priceCents: 0 }),
  Object.freeze({ id: 'contract-patrol', label: 'START RIVAL PATROL', detail: CONTRACT_DEFINITIONS.patrol.detail, priceCents: 0 }),
]);

function distance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function copyCheckpoint(entry) {
  return { ...entry, position: { ...entry.position } };
}

function ensureContractState(world) {
  if (!world.cityLife.contracts) world.cityLife.contracts = { party_a: null, party_b: null };
  world.cityLife.counters.contracts ||= 0;
  world.cityLife.counters.contractsCompleted ||= 0;
  return world.cityLife.contracts;
}

function partyContract(world, partyId) {
  return ensureContractState(world)[partyId] || null;
}

function publicTarget(contract) {
  if (!contract || contract.status !== 'active') return null;
  return contract.checkpoints[contract.stepIndex] || null;
}

function contractMessage(contract, world) {
  if (!contract) return 'No city job active.';
  if (contract.status === 'complete') return `${contract.label} complete - DC ${(contract.rewardCents / 100).toFixed(2)} paid.`;
  if (contract.status === 'failed') return `${contract.label} expired. Dispatch is ready for another attempt.`;
  const target = publicTarget(contract);
  const left = Math.max(0, Math.ceil((contract.endsAtTick - world.tick) / TICK_RATE));
  if (contract.phase === 'clear') return `${contract.label} - clear ${contract.enemyIds.length} rivals - ${left}s`;
  return `${contract.label} - ${contract.stepIndex + 1}/${contract.checkpoints.length} - ${target?.label || 'next stop'} - ${left}s`;
}

function startCityContract(world, actor, kind) {
  if (!world.cityLife?.enabled || !actor?.partyId) return { ok: false, reason: 'city-contract-disabled', message: 'City jobs are unavailable.' };
  const definition = CONTRACT_DEFINITIONS[kind];
  if (!definition) return { ok: false, reason: 'unknown-contract', message: 'That city job is not available.' };
  const contracts = ensureContractState(world);
  const current = contracts[actor.partyId];
  if (current?.status === 'active') return { ok: false, reason: 'contract-active', message: contractMessage(current, world) };
  const serial = ++world.cityLife.counters.contracts;
  const contract = {
    id: `city-contract-${actor.partyId}-${serial}`,
    kind: definition.id,
    label: definition.label,
    detail: definition.detail,
    mode: definition.mode,
    status: 'active',
    phase: 'checkpoint',
    partyId: actor.partyId,
    startedByActorId: actor.id,
    startedAtTick: world.tick,
    endsAtTick: world.tick + definition.durationSeconds * TICK_RATE,
    rewardCents: definition.rewardCents,
    stepIndex: 0,
    checkpoints: definition.checkpoints.map(copyCheckpoint),
    contributors: [],
    enemyIds: [],
    message: '',
  };
  contract.message = contractMessage(contract, world);
  contracts[actor.partyId] = contract;
  actor.cityMessage = `${definition.label} accepted. ${contract.checkpoints[0].label}.`;
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 8;
  return { ok: true, kind: 'city-contract', action: 'started', contractId: contract.id, contractKind: definition.id, message: actor.cityMessage };
}

function rewardContract(world, actor, contract) {
  const personalCents = Math.round(contract.rewardCents * 0.4);
  const partyCents = contract.rewardCents - personalCents;
  const recipientIds = [...new Set(contract.contributors.filter((id) => world.actors[id]?.partyId === contract.partyId))];
  if (!recipientIds.includes(actor.id)) recipientIds.push(actor.id);
  const baseShare = Math.floor(personalCents / recipientIds.length);
  let remainder = personalCents - baseShare * recipientIds.length;
  const personalRewards = {};
  recipientIds.forEach((actorId) => {
    const recipient = world.actors[actorId];
    const share = baseShare + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    recipient.walletCents = normalizeCents(recipient.walletCents + share);
    personalRewards[actorId] = share;
  });
  world.economy.partyFunds[contract.partyId] = normalizeCents((world.economy.partyFunds[contract.partyId] || 0) + partyCents);
  world.economy.lifetimePartyIncome[contract.partyId] = normalizeCents((world.economy.lifetimePartyIncome[contract.partyId] || 0) + partyCents);
  contract.status = 'complete';
  contract.phase = 'complete';
  contract.completedAtTick = world.tick;
  contract.completedByActorId = actor.id;
  contract.personalRewardCents = personalCents;
  contract.personalRewards = personalRewards;
  contract.partyRewardCents = partyCents;
  contract.message = `${contract.label} complete - DC ${(personalCents / 100).toFixed(2)} personal - DC ${(partyCents / 100).toFixed(2)} party`;
  world.cityLife.counters.contractsCompleted += 1;
  world.effects.push({ id: `effect-contract-${contract.id}-${world.tick}`, kind: 'city-contract-complete', partyId: contract.partyId, position: { ...actor.position }, expiresAtTick: world.tick + 60 });
  actor.cityMessage = contract.message;
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 10;
  return { ok: true, kind: 'city-contract', action: 'completed', contractId: contract.id, personalCents, partyCents, message: contract.message };
}

function advanceContract(world, actor, contract) {
  if (!contract.contributors.includes(actor.id)) contract.contributors.push(actor.id);
  contract.stepIndex += 1;
  contract.phase = 'checkpoint';
  contract.enemyIds = [];
  if (contract.stepIndex >= contract.checkpoints.length) return rewardContract(world, actor, contract);
  contract.message = contractMessage(contract, world);
  actor.cityMessage = `${contract.label}: ${publicTarget(contract).label}.`;
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 6;
  return { ok: true, kind: 'city-contract', action: 'advanced', contractId: contract.id, stepIndex: contract.stepIndex, message: actor.cityMessage };
}

function spawnPatrolWave(world, actor, contract, target) {
  const serial = `${contract.id}-${contract.stepIndex}`;
  const offsets = [{ x: 32, y: -22 }, { x: -30, y: 24 }];
  contract.enemyIds = offsets.map((offset, index) => {
    const id = `${serial}-rival-${index + 1}`;
    const npc = createHostileNpc({
      id,
      faction: 'neon-rivals',
      role: index ? (contract.stepIndex % 2 ? 'sapper' : 'skirmisher') : (contract.stepIndex >= 2 ? 'blocker' : 'rusher'),
      position: { x: target.position.x + offset.x, y: target.position.y + offset.y },
      source: 'city-contract',
      kind: 'rival',
    });
    npc.contractId = contract.id;
    npc.contractPartyId = contract.partyId;
    world.npcs[id] = npc;
    return id;
  });
  contract.phase = 'clear';
  contract.message = `${target.label}: clear both Neon Rivals.`;
  if (!contract.contributors.includes(actor.id)) contract.contributors.push(actor.id);
  actor.cityMessage = contract.message;
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 8;
  return { ok: true, kind: 'city-contract', action: 'wave-started', contractId: contract.id, enemyIds: [...contract.enemyIds], message: contract.message };
}

function interactWithCityContract(world, actor) {
  const contract = partyContract(world, actor.partyId);
  if (!contract || contract.status !== 'active') return { ok: false, reason: 'no-active-contract' };
  if (contract.mode === 'vehicle') return { ok: false, reason: 'vehicle-contract-auto-progress' };
  if (contract.phase === 'clear') return { ok: false, reason: 'contract-wave-active' };
  const target = publicTarget(contract);
  if (!target || distance(actor.position, target.position) > CONTRACT_RADIUS) return { ok: false, reason: 'contract-not-in-range' };
  if (contract.mode === 'patrol') return spawnPatrolWave(world, actor, contract, target);
  return advanceContract(world, actor, contract);
}

function cityContractPrompt(world, actor) {
  const contract = partyContract(world, actor.partyId);
  if (!contract || contract.status !== 'active') return null;
  if (contract.phase === 'clear') {
    const living = contract.enemyIds.filter((id) => world.npcs[id]?.alive).length;
    return living ? `CITY JOB - CLEAR ${living} NEON RIVAL${living === 1 ? '' : 'S'}` : 'CITY JOB - AREA SECURED';
  }
  const target = publicTarget(contract);
  if (!target) return null;
  const near = distance(actor.position, target.position) <= CONTRACT_RADIUS;
  if (contract.mode === 'vehicle') return near
    ? (actor.currentVehicleId ? `CITY JOB - DRIVE THROUGH ${target.label.toUpperCase()}` : 'CITY JOB - VEHICLE REQUIRED')
    : null;
  return near ? `ACTION - ${target.label.toUpperCase()}` : null;
}

function failContract(world, contract) {
  for (const id of contract.enemyIds || []) if (world.npcs[id]?.source === 'city-contract') delete world.npcs[id];
  contract.enemyIds = [];
  contract.status = 'failed';
  contract.phase = 'failed';
  contract.failedAtTick = world.tick;
  contract.message = `${contract.label} expired. Return to Metro Dispatch to retry.`;
}

function updateCityContracts(world) {
  if (!world.cityLife?.enabled) return;
  const contracts = ensureContractState(world);
  for (const contract of Object.values(contracts).filter(Boolean)) {
    if (contract.status !== 'active') continue;
    if (world.tick >= contract.endsAtTick) {
      failContract(world, contract);
      continue;
    }
    if (contract.phase === 'clear') {
      const living = contract.enemyIds.filter((id) => world.npcs[id]?.alive).length;
      if (living > 0) {
        contract.message = contractMessage(contract, world);
        continue;
      }
      for (const id of contract.enemyIds) if (world.npcs[id]?.source === 'city-contract') delete world.npcs[id];
      const actor = Object.values(world.actors).find((candidate) => candidate.alive && candidate.partyId === contract.partyId)
        || world.actors[contract.startedByActorId];
      if (actor) advanceContract(world, actor, contract);
      continue;
    }
    if (contract.mode === 'vehicle') {
      const target = publicTarget(contract);
      const driver = Object.values(world.actors).find((actor) => (
        actor.alive && actor.partyId === contract.partyId && actor.vehicleSeat === 'driver'
        && actor.currentVehicleId && distance(actor.position, target.position) <= CONTRACT_RADIUS
      ));
      if (driver) advanceContract(world, driver, contract);
    }
    if (contract.status === 'active') contract.message = contractMessage(contract, world);
  }
}

module.exports = {
  CITY_CONTRACT_OPTIONS,
  CONTRACT_DEFINITIONS,
  CONTRACT_RADIUS,
  cityContractPrompt,
  contractMessage,
  ensureContractState,
  interactWithCityContract,
  partyContract,
  publicTarget,
  startCityContract,
  updateCityContracts,
};
