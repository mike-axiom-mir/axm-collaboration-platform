'use strict';

const DEFAULT_BASE_RULES = Object.freeze({
  baseHealth: 100,
  healthRegenCap: 100,
  outsideHealthRegenPerSecond: 1,
  insideHealthRegenPerSecond: 10,
  baseShield: 1,
  shieldRegenPerSecond: 0,
  maximumDeltaSeconds: 1,
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value, fallback) {
  return Math.max(0, finiteNumber(value, fallback));
}

function normalizeZone(zone) {
  if (!zone || typeof zone !== 'object') return null;
  const width = nonNegative(zone.width ?? zone.w, 0);
  const height = nonNegative(zone.height ?? zone.h, 0);
  const x = finiteNumber(zone.x, NaN);
  const y = finiteNumber(zone.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) return null;
  return { ...zone, x, y, width, height };
}

function baseZonesForWorld(world) {
  const candidates = world?.staticMap?.baseZones
    || world?.staticMap?.layers?.base_zones
    || world?.baseZones
    || [];
  return Array.isArray(candidates) ? candidates.map(normalizeZone).filter(Boolean) : [];
}

function isPointInZone(position, zone, margin = 0) {
  const rect = normalizeZone(zone);
  if (!position || !rect) return false;
  const x = finiteNumber(position.x, NaN);
  const y = finiteNumber(position.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.x - margin
    && x <= rect.x + rect.width + margin
    && y >= rect.y - margin
    && y <= rect.y + rect.height + margin;
}

function findActorBaseZone(world, actor) {
  if (!actor?.position) return null;
  return baseZonesForWorld(world).find((zone) => (
    (!zone.partyId || zone.partyId === actor.partyId) && isPointInZone(actor.position, zone)
  )) || null;
}

function initializeActorVitals(actor, rules = DEFAULT_BASE_RULES) {
  if (!actor || typeof actor !== 'object') throw new TypeError('actor is required');
  const baseHealth = nonNegative(rules.baseHealth, DEFAULT_BASE_RULES.baseHealth);
  const regenCap = nonNegative(rules.healthRegenCap, DEFAULT_BASE_RULES.healthRegenCap);
  const baseShield = nonNegative(rules.baseShield, DEFAULT_BASE_RULES.baseShield);

  actor.baseHealth = baseHealth;
  actor.defaultHealthRegenCap = regenCap;
  actor.health = nonNegative(actor.health, baseHealth);
  actor.maxHealth = Math.max(baseHealth, nonNegative(actor.maxHealth, baseHealth));
  actor.shield = nonNegative(actor.shield, baseShield);
  actor.maxShield = Math.max(baseShield, nonNegative(actor.maxShield, baseShield));
  actor.regeneration = {
    healthAccumulator: nonNegative(actor.regeneration?.healthAccumulator, 0),
    insideBase: Boolean(actor.regeneration?.insideBase),
    baseZoneId: actor.regeneration?.baseZoneId || null,
    healthPerSecond: nonNegative(actor.regeneration?.healthPerSecond, 0),
    shieldPerSecond: 0,
  };
  return actor;
}

function actorsForWorld(world) {
  if (Array.isArray(world?.actors)) return world.actors;
  if (world?.actors && typeof world.actors === 'object') return Object.values(world.actors);
  return [];
}

function updateBaseRegeneration(world, deltaSeconds, rules = DEFAULT_BASE_RULES) {
  const delta = Math.min(
    nonNegative(rules.maximumDeltaSeconds, DEFAULT_BASE_RULES.maximumDeltaSeconds),
    nonNegative(deltaSeconds, 0),
  );
  const regenCap = nonNegative(rules.healthRegenCap, DEFAULT_BASE_RULES.healthRegenCap);
  const outsideRate = nonNegative(
    rules.outsideHealthRegenPerSecond,
    DEFAULT_BASE_RULES.outsideHealthRegenPerSecond,
  );
  const insideDefaultRate = nonNegative(
    rules.insideHealthRegenPerSecond,
    DEFAULT_BASE_RULES.insideHealthRegenPerSecond,
  );
  const updates = [];
  let healthRestored = 0;

  for (const actor of actorsForWorld(world)) {
    initializeActorVitals(actor, rules);
    const zone = findActorBaseZone(world, actor);
    const insideBase = Boolean(zone);
    const rate = insideBase
      ? nonNegative(zone.healthRegenPerSecond, insideDefaultRate)
      : outsideRate;

    actor.regeneration.insideBase = insideBase;
    actor.regeneration.baseZoneId = zone?.id || null;
    actor.regeneration.healthPerSecond = rate;
    // Shield recharge is deliberately absent in the default base rules.
    actor.regeneration.shieldPerSecond = 0;

    if (actor.alive === false || actor.state === 'downed' || actor.state === 'respawning') continue;
    if (actor.health >= regenCap || rate <= 0 || delta <= 0) {
      if (actor.health >= regenCap) actor.regeneration.healthAccumulator = 0;
      continue;
    }

    const pending = actor.regeneration.healthAccumulator + rate * delta;
    const wholeHealth = Math.floor(pending + 1e-9);
    if (wholeHealth < 1) {
      actor.regeneration.healthAccumulator = pending;
      continue;
    }

    const missingBelowDefaultCap = Math.max(0, regenCap - actor.health);
    const restored = Math.min(wholeHealth, missingBelowDefaultCap);
    actor.health = Math.min(regenCap, actor.health + restored);
    actor.regeneration.healthAccumulator = actor.health >= regenCap
      ? 0
      : Math.max(0, pending - wholeHealth);
    healthRestored += restored;
    if (restored > 0) {
      updates.push({
        actorId: actor.id,
        restored,
        insideBase,
        baseZoneId: zone?.id || null,
        health: actor.health,
      });
    }
  }

  return { healthRestored, actorsUpdated: updates.length, updates };
}

function initializeWorldVitals(world, rules = DEFAULT_BASE_RULES) {
  for (const actor of actorsForWorld(world)) initializeActorVitals(actor, rules);
  return world;
}

module.exports = {
  DEFAULT_BASE_RULES,
  baseZonesForWorld,
  findActorBaseZone,
  initializeActorVitals,
  initializeWorldVitals,
  isPointInZone,
  normalizeZone,
  updateBaseRegeneration,
};
