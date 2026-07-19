'use strict';

const { isPointInZone } = require('./world-state');
const { createHostileNpc } = require('./npc-factory');
const { collidesObstacle } = require('./spatial-index');

const JUSTICE_THRESHOLDS = Object.freeze({ response: 45, pursuit: 75, maximum: 100 });

function justiceStageForHeat(heat) {
  if (heat >= JUSTICE_THRESHOLDS.pursuit) return 'pursuit';
  if (heat >= JUSTICE_THRESHOLDS.response) return 'response';
  if (heat >= 1) return 'caution';
  return 'calm';
}

function refreshStage(world) {
  const previous = world.justice.stage;
  world.justice.stage = justiceStageForHeat(world.justice.heat);
  if (previous === 'calm' && world.justice.stage === 'caution') world.justice.warnings += 1;
  return world.justice.stage;
}

function recordCivilianHarm(world, civilian, damage, downed = false) {
  if (!world?.justice || civilian?.kind !== 'civilian') return null;
  const applied = Math.max(0, Number(damage) || 0);
  world.justice.civilianDamage += applied;
  if (downed) world.justice.civilianDowns += 1;
  world.justice.lastOffenseTick = world.tick;
  world.justice.heat = Math.min(
    JUSTICE_THRESHOLDS.maximum,
    world.justice.heat + applied * 0.5 + (downed ? 10 : 0),
  );
  refreshStage(world);
  return { heat: world.justice.heat, stage: world.justice.stage };
}

function triggerVoluntaryChaos(world) {
  world.justice.voluntaryChaos = true;
  world.justice.lastOffenseTick = world.tick;
  world.justice.heat = Math.max(world.justice.heat, JUSTICE_THRESHOLDS.pursuit);
  refreshStage(world);
  return world.justice;
}

function clearVoluntaryChaos(world) {
  world.justice.voluntaryChaos = false;
  return world.justice;
}

function partyInsideBase(world) {
  const zones = world.staticMap.baseZones || [];
  return Object.values(world.actors).some((actor) => (
    actor.alive && zones.some((zone) => isPointInZone(actor.position, zone))
  ));
}

function justiceNpcCount(world) {
  return Object.values(world.npcs).filter((npc) => npc.source === 'justice' && npc.alive !== false).length;
}

function spawnJusticeNpc(world, index) {
  const livingActors = Object.values(world.actors).filter((actor) => actor.alive);
  const centre = livingActors.length ? {
    x: livingActors.reduce((sum, actor) => sum + actor.position.x, 0) / livingActors.length,
    y: livingActors.reduce((sum, actor) => sum + actor.position.y, 0) / livingActors.length,
  } : { x: world.staticMap.width / 2, y: world.staticMap.height / 2 };
  const margin = 64;
  const clamp = (value, maximum) => Math.max(margin, Math.min(maximum - margin, value));
  const points = [
    { x: centre.x - 360, y: centre.y }, { x: centre.x + 360, y: centre.y },
    { x: centre.x, y: centre.y - 360 }, { x: centre.x, y: centre.y + 360 },
    { x: centre.x - 280, y: centre.y - 260 }, { x: centre.x + 280, y: centre.y + 260 },
  ];
  const candidates = points.map((point) => ({
    x: clamp(point.x, world.staticMap.width),
    y: clamp(point.y, world.staticMap.height),
  }));
  const point = candidates.find((candidate, offset) => (
    offset >= index % candidates.length && !collidesObstacle(world, candidate, 12)
  )) || candidates[index % candidates.length];
  world.nextNpcNumber ||= 100;
  const id = `justice-${String(world.nextNpcNumber++).padStart(3, '0')}`;
  const role = index % 3 === 0 ? 'blocker' : index % 2 === 0 ? 'rusher' : 'skirmisher';
  const npc = createHostileNpc({
    id,
    faction: 'district-justice',
    role,
    position: point,
    source: 'justice',
    kind: 'cop',
  });
  world.npcs[id] = npc;
  return npc;
}

function updateJustice(world, deltaSeconds) {
  const justice = world.justice;
  if (!justice) return;
  const quietTicks = justice.lastOffenseTick == null ? Infinity : world.tick - justice.lastOffenseTick;
  if (!justice.voluntaryChaos && quietTicks > 300 && justice.heat > 0) {
    const decay = partyInsideBase(world) ? 4 : 0.5;
    justice.heat = Math.max(0, justice.heat - decay * Math.max(0, deltaSeconds));
  }
  refreshStage(world);

  const desired = justice.stage === 'pursuit' ? 4 : justice.stage === 'response' ? 2 : 0;
  const activeJustice = Object.values(world.npcs).filter((npc) => npc.source === 'justice' && npc.alive !== false);
  if (activeJustice.length > desired) {
    for (const npc of activeJustice.slice(desired)) delete world.npcs[npc.id];
  }
  if (desired > justiceNpcCount(world) && world.tick % 30 === 0) spawnJusticeNpc(world, justiceNpcCount(world));
  if (desired === 0) {
    for (const npc of Object.values(world.npcs)) {
      if (npc.source === 'justice') delete world.npcs[npc.id];
    }
  }
}

module.exports = {
  JUSTICE_THRESHOLDS,
  clearVoluntaryChaos,
  justiceStageForHeat,
  recordCivilianHarm,
  triggerVoluntaryChaos,
  updateJustice,
};
