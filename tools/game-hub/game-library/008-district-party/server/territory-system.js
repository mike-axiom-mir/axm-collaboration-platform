'use strict';

const { TICK_RATE } = require('../shared/constants');
const { clamp } = require('../shared/validation');
const { creditPartyFunds, spendPartyFunds } = require('./economy-system');
const { createHostileNpc } = require('./npc-factory');

const PARTY_IDS = Object.freeze(['party_a', 'party_b']);

function otherPartyId(partyId) {
  return partyId === 'party_a' ? 'party_b' : partyId === 'party_b' ? 'party_a' : null;
}

function territoryEnabled(world) {
  return world?.territory?.enabled === true;
}

function distance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function activeCrew(world, partyId) {
  return Object.values(world.npcs || {}).filter((npc) => (
    npc.kind === 'crew' && npc.partyId === partyId && npc.alive !== false
  ));
}

function zonePresence(world, zone) {
  const presence = { party_a: 0, party_b: 0, actorIds: [], crewIds: [] };
  for (const actor of Object.values(world.actors || {})) {
    if (!actor.alive || !PARTY_IDS.includes(actor.partyId) || distance(actor.position, zone) > zone.radius) continue;
    presence[actor.partyId] += 1;
    presence.actorIds.push(actor.id);
  }
  for (const npc of Object.values(world.npcs || {})) {
    if (npc.kind !== 'crew' || !npc.alive || !PARTY_IDS.includes(npc.partyId) || distance(npc.position, zone) > zone.radius) continue;
    presence[npc.partyId] += 0.75;
    presence.crewIds.push(npc.id);
  }
  return presence;
}

function ownerForProgress(progress) {
  if (progress >= 100) return 'party_a';
  if (progress <= -100) return 'party_b';
  return null;
}

function updateZoneCapture(world, zone, deltaSeconds) {
  const presence = zonePresence(world, zone);
  const difference = presence.party_a - presence.party_b;
  zone.presence = { party_a: presence.party_a, party_b: presence.party_b };
  zone.contested = presence.party_a > 0 && presence.party_b > 0;
  zone.capturingPartyId = difference > 0 ? 'party_a' : difference < 0 ? 'party_b' : null;
  if (difference === 0 || world.territory.status !== 'active') return false;

  const previousOwner = zone.ownerPartyId;
  const previousProgress = zone.progress;
  const speedMultiplier = Math.min(2.5, Math.abs(difference));
  zone.progress = clamp(
    zone.progress + Math.sign(difference) * world.territory.captureRatePerSecond * speedMultiplier * deltaSeconds,
    -100,
    100,
  );
  const endpointOwner = ownerForProgress(zone.progress);
  zone.ownerPartyId = endpointOwner
    || (previousOwner === 'party_a' && zone.progress > 0 ? 'party_a' : null)
    || (previousOwner === 'party_b' && zone.progress < 0 ? 'party_b' : null);
  if (zone.ownerPartyId && zone.ownerPartyId !== previousOwner) {
    world.effects.push({
      id: `effect-zone-captured-${zone.id}-${world.tick}`,
      kind: 'zone-captured',
      partyId: zone.ownerPartyId,
      zoneId: zone.id,
      position: { x: zone.x, y: zone.y },
      expiresAtTick: world.tick + 45,
    });
  }
  return zone.progress !== previousProgress;
}

function ownedZoneCounts(territory) {
  return territory.zones.reduce((counts, zone) => {
    if (PARTY_IDS.includes(zone.ownerPartyId)) counts[zone.ownerPartyId] += 1;
    return counts;
  }, { party_a: 0, party_b: 0 });
}

function scoringZoneCounts(territory) {
  return territory.zones.reduce((counts, zone) => {
    if (!zone.contested && PARTY_IDS.includes(zone.ownerPartyId)) counts[zone.ownerPartyId] += 1;
    return counts;
  }, { party_a: 0, party_b: 0 });
}

function territoryTargetForParty(world, partyId, selector = null) {
  if (!territoryEnabled(world) || !PARTY_IDS.includes(partyId)) return null;
  const zones = world.territory.zones;
  const contested = zones.filter((zone) => zone.contested && zone.presence?.[partyId] > 0);
  const candidates = contested.length ? contested : zones.filter((zone) => zone.ownerPartyId !== partyId);
  const pool = candidates.length ? candidates : zones;
  const partyActors = Object.values(world.actors || {}).filter((actor) => actor.partyId === partyId && actor.alive);
  const anchor = partyActors.length ? {
    x: partyActors.reduce((sum, actor) => sum + actor.position.x, 0) / partyActors.length,
    y: partyActors.reduce((sum, actor) => sum + actor.position.y, 0) / partyActors.length,
  } : world.territory.commandPosts[partyId];
  const ranked = pool.map((zone) => {
    const ownershipPriority = zone.ownerPartyId === otherPartyId(partyId) ? -90 : 0;
    const contestedPriority = zone.contested ? -120 : 0;
    const score = distance(anchor, zone) + ownershipPriority + contestedPriority;
    return { ...zone, kind: 'territory', score };
  }).sort((a, b) => a.score - b.score);
  if (Number.isInteger(selector) && ranked.length > 1) {
    return ranked[(Math.max(1, selector) - 1) % Math.min(3, ranked.length)];
  }
  return ranked[0] || null;
}

function createCrewNpc(world, partyId, index) {
  const territory = world.territory;
  const post = territory.commandPosts[partyId];
  const role = index % 2 === 0 ? 'skirmisher' : 'rusher';
  const serial = territory.nextCrewNumber++;
  const id = `crew-${partyId}-${serial}`;
  const angle = (serial % 5) * Math.PI * 0.4;
  const spawn = {
    x: post.reinforcementSpawn.x + Math.cos(angle) * 12,
    y: post.reinforcementSpawn.y + Math.sin(angle) * 12,
  };
  const npc = createHostileNpc({
    id,
    faction: partyId === 'party_a' ? 'party-a-crew' : 'party-b-crew',
    role,
    position: spawn,
    source: 'territory',
    kind: 'crew',
  });
  npc.partyId = partyId;
  npc.displayName = `${partyId === 'party_a' ? 'A' : 'B'} Crew ${serial}`;
  npc.expiresAtTick = world.tick + territory.reinforcement.lifetimeTicks;
  npc.assignedZoneId = territoryTargetForParty(world, partyId)?.id || null;
  npc.respawnAtTick = null;
  world.npcs[id] = npc;
  return npc;
}

function purchaseReinforcement(world, actor) {
  if (!territoryEnabled(world) || world.territory.status !== 'active') return { ok: false, reason: 'territory-not-active' };
  if (!actor?.alive || !PARTY_IDS.includes(actor.partyId)) return { ok: false, reason: 'invalid-actor' };
  const territory = world.territory;
  const post = territory.commandPosts[actor.partyId];
  if (!post || distance(actor.position, post) > post.radius) return { ok: false, reason: 'command-post-not-in-range' };
  const nextPurchaseTick = territory.nextPurchaseTick[actor.partyId] || 0;
  if (world.tick < nextPurchaseTick) return { ok: false, reason: 'reinforcement-cooldown', readyAtTick: nextPurchaseTick };
  const active = activeCrew(world, actor.partyId);
  const availableSlots = Math.max(0, territory.reinforcement.maxActivePerParty - active.length);
  if (availableSlots <= 0) return { ok: false, reason: 'reinforcement-cap' };
  const squadSize = Math.min(availableSlots, territory.reinforcement.squadSize);
  const payment = spendPartyFunds(world, actor.partyId, territory.reinforcement.costCents, 'district-reinforcement', actor.id);
  if (!payment.ok) return payment;
  const spawned = Array.from({ length: squadSize }, (_, index) => createCrewNpc(world, actor.partyId, index));
  territory.nextPurchaseTick[actor.partyId] = world.tick + territory.reinforcement.purchaseCooldownTicks;
  territory.reinforcementsPurchased[actor.partyId] += 1;
  world.effects.push({
    id: `effect-reinforcement-${actor.partyId}-${world.tick}`,
    kind: 'reinforcement-arrival',
    partyId: actor.partyId,
    position: { ...post.reinforcementSpawn },
    expiresAtTick: world.tick + 35,
  });
  return {
    ok: true,
    kind: 'territory-reinforcement',
    partyId: actor.partyId,
    actorId: actor.id,
    spawnedNpcIds: spawned.map((npc) => npc.id),
    squadSize: spawned.length,
    ...payment,
  };
}

function interactWithTerritory(world, actor) {
  if (!territoryEnabled(world)) return { ok: false, reason: 'territory-disabled' };
  if (world.territory.status === 'results') return { ok: false, reason: 'territory-results-active' };
  return purchaseReinforcement(world, actor);
}

function removeExpiredCrew(world) {
  for (const npc of Object.values(world.npcs || {})) {
    if (npc.kind !== 'crew') continue;
    const expired = Number.isFinite(npc.expiresAtTick) && world.tick >= npc.expiresAtTick;
    const downedLongEnough = npc.alive === false && npc.downedAtTick != null && world.tick - npc.downedAtTick >= 45;
    if (expired || downedLongEnough) delete world.npcs[npc.id];
  }
}

function completeTerritoryMatch(world, reason) {
  const territory = world.territory;
  if (!territoryEnabled(world) || territory.status !== 'active') return territory?.result || null;
  const scoreA = territory.scores.party_a;
  const scoreB = territory.scores.party_b;
  const winnerPartyId = scoreA === scoreB ? null : scoreA > scoreB ? 'party_a' : 'party_b';
  territory.status = 'results';
  territory.phase = 'results';
  territory.completedAtTick = world.tick;
  territory.winnerPartyId = winnerPartyId;
  territory.result = {
    reason,
    winnerPartyId,
    draw: winnerPartyId === null,
    scores: { ...territory.scores },
    ownedZones: ownedZoneCounts(territory),
    reinforcementsPurchased: { ...territory.reinforcementsPurchased },
    partyFundTotals: { ...world.economy.partyFunds },
  };
  world.mission.status = 'results';
  world.mission.phase = 'results';
  world.mission.result = territory.result;
  world.mission.completedAtTick = world.tick;
  world.projectiles = {};
  return territory.result;
}

function awardTerritoryScore(world) {
  const territory = world.territory;
  const counts = scoringZoneCounts(territory);
  for (const partyId of PARTY_IDS) territory.scores[partyId] += counts[partyId];
  world.mission.partyScores = { ...territory.scores };
  if (territory.scores.party_a >= territory.scoreGoal || territory.scores.party_b >= territory.scoreGoal) {
    completeTerritoryMatch(world, 'score-goal');
  }
}

function awardTerritoryIncome(world) {
  const territory = world.territory;
  const counts = scoringZoneCounts(territory);
  for (const partyId of PARTY_IDS) {
    const amount = counts[partyId] * territory.incomePerOwnedZoneCents;
    if (amount > 0) creditPartyFunds(world, partyId, amount, 'district-control-income');
  }
}

function updateTerritory(world, deltaSeconds = 1 / TICK_RATE) {
  if (!territoryEnabled(world)) return null;
  removeExpiredCrew(world);
  const territory = world.territory;
  if (territory.status !== 'active') return territory;
  for (const zone of territory.zones) updateZoneCapture(world, zone, deltaSeconds);

  territory.scoreAccumulator += Math.max(0, deltaSeconds);
  while (territory.scoreAccumulator >= territory.scoreIntervalSeconds && territory.status === 'active') {
    territory.scoreAccumulator -= territory.scoreIntervalSeconds;
    awardTerritoryScore(world);
  }
  territory.incomeAccumulator += Math.max(0, deltaSeconds);
  while (territory.incomeAccumulator >= territory.incomeIntervalSeconds && territory.status === 'active') {
    territory.incomeAccumulator -= territory.incomeIntervalSeconds;
    awardTerritoryIncome(world);
  }
  if (territory.status === 'active' && world.tick >= territory.endsAtTick) completeTerritoryMatch(world, 'timer');
  return territory;
}

module.exports = {
  activeCrew,
  completeTerritoryMatch,
  interactWithTerritory,
  otherPartyId,
  ownerForProgress,
  purchaseReinforcement,
  territoryEnabled,
  territoryTargetForParty,
  updateTerritory,
  updateZoneCapture,
  zonePresence,
};
