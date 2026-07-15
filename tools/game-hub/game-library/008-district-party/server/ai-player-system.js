'use strict';

const { nearestAvailablePackage } = require('./mission-system');
const { activeCrew, territoryTargetForParty } = require('./territory-system');

const AI_PLAYER_STATES = Object.freeze([
  'follow_party',
  'move_to_mission',
  'avoid_hazard',
  'enter_party_vehicle',
  'exit_vehicle',
  'attack_enemy',
  'revive_or_support',
  'regroup',
]);

function normalizeVector(dx, dy) {
  const magnitude = Math.hypot(dx, dy);
  return magnitude > 0.001 ? { x: dx / magnitude, y: dy / magnitude, distance: magnitude } : { x: 0, y: 0, distance: 0 };
}

function gridCellBlocked(world, column, row, resolution, radius = 11) {
  const x = column * resolution + resolution / 2;
  const y = row * resolution + resolution / 2;
  if (x - radius < 0 || y - radius < 0 || x + radius > world.staticMap.width || y + radius > world.staticMap.height) return true;
  return world.staticMap.obstacles.some((box) => (
    x + radius > box.x
    && x - radius < box.x + box.width
    && y + radius > box.y
    && y - radius < box.y + box.height
  ));
}

function findGridPath(world, start, target, resolution = 32) {
  const columns = Math.ceil(world.staticMap.width / resolution);
  const rows = Math.ceil(world.staticMap.height / resolution);
  const clampCell = (value, maximum) => Math.max(0, Math.min(maximum - 1, Math.floor(value / resolution)));
  const startColumn = clampCell(start.x, columns);
  const startRow = clampCell(start.y, rows);
  const goalColumn = clampCell(target.x, columns);
  const goalRow = clampCell(target.y, rows);
  const startIndex = startRow * columns + startColumn;
  const goalIndex = goalRow * columns + goalColumn;
  const parents = new Int32Array(columns * rows);
  parents.fill(-2);
  parents[startIndex] = -1;
  const queue = new Int32Array(columns * rows);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;
  const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  while (head < tail && parents[goalIndex] === -2) {
    const current = queue[head++];
    const column = current % columns;
    const row = Math.floor(current / columns);
    for (const [dx, dy] of offsets) {
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) continue;
      const nextIndex = nextRow * columns + nextColumn;
      if (parents[nextIndex] !== -2 || gridCellBlocked(world, nextColumn, nextRow, resolution)) continue;
      parents[nextIndex] = current;
      queue[tail++] = nextIndex;
    }
  }
  if (parents[goalIndex] === -2) return [];

  const reversed = [];
  for (let cursor = goalIndex; cursor !== -1; cursor = parents[cursor]) {
    reversed.push({
      x: (cursor % columns) * resolution + resolution / 2,
      y: Math.floor(cursor / columns) * resolution + resolution / 2,
    });
  }
  reversed.reverse();
  if (reversed.length && Math.hypot(reversed[0].x - start.x, reversed[0].y - start.y) < resolution) reversed.shift();
  reversed.push({ x: target.x, y: target.y });
  return reversed;
}

function navigationPoint(world, actor, target) {
  const key = `${target.kind || 'target'}:${Math.round(target.x / 16)}:${Math.round(target.y / 16)}`;
  if (actor.aiPathTargetKey !== key || world.tick >= actor.aiRepathAtTick || !Array.isArray(actor.aiPath)) {
    actor.aiPath = findGridPath(world, actor.position, target);
    actor.aiPathTargetKey = key;
    actor.aiRepathAtTick = world.tick + 45;
  }
  while (actor.aiPath.length && Math.hypot(
    actor.aiPath[0].x - actor.position.x,
    actor.aiPath[0].y - actor.position.y,
  ) < 18) actor.aiPath.shift();
  return actor.aiPath[0] || target;
}

function partyAnchor(world, actor) {
  const allies = Object.values(world.actors).filter((other) => (
    other.id !== actor.id && other.partyId === actor.partyId && other.alive
  ));
  if (allies.length === 0) return actor.spawnPosition;
  const externallyControlled = allies.filter((other) => ['human', 'adapter'].includes(other.controller));
  const pool = externallyControlled.length ? externallyControlled : allies;
  return {
    x: pool.reduce((sum, other) => sum + other.position.x, 0) / pool.length,
    y: pool.reduce((sum, other) => sum + other.position.y, 0) / pool.length,
  };
}

function chooseAiTarget(world, actor) {
  if (world.territory?.enabled) {
    const partyRelativeSlot = ((actor.slot - 1) % 4) + 1;
    const territoryTarget = territoryTargetForParty(world, actor.partyId, partyRelativeSlot);
    if (territoryTarget) return territoryTarget;
  }
  if (actor.carryingPackageId) {
    const zones = world.staticMap.mission.deliveryZones;
    return zones.reduce((nearest, zone) => {
      const centre = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
      const distance = Math.hypot(actor.position.x - centre.x, actor.position.y - centre.y);
      return !nearest || distance < nearest.distance ? { ...centre, distance, kind: 'delivery' } : nearest;
    }, null);
  }
  const packageEntity = nearestAvailablePackage(world, actor, 900);
  if (packageEntity) return { ...packageEntity.position, kind: 'package' };
  return { ...partyAnchor(world, actor), kind: 'party' };
}

function nearestEnemy(world, actor, maximumDistance = 180) {
  let nearest = null;
  const candidates = [
    ...Object.values(world.actors).filter((candidate) => candidate.partyId && candidate.partyId !== actor.partyId),
    ...Object.values(world.npcs).filter((candidate) => (
      candidate.hostile && (!candidate.partyId || candidate.partyId !== actor.partyId)
    )),
  ];
  for (const candidate of candidates) {
    if (!candidate.alive || candidate.id === actor.id) continue;
    const d = Math.hypot(candidate.position.x - actor.position.x, candidate.position.y - actor.position.y);
    if (d <= maximumDistance && (!nearest || d < nearest.distance)) nearest = { actor: candidate, distance: d };
  }
  return nearest;
}

function nearbyAllyVehicle(world, actor, maximumDistance = 190) {
  let nearest = null;
  for (const vehicle of Object.values(world.vehicles)) {
    const driver = vehicle.driverActorId ? world.actors[vehicle.driverActorId] : null;
    if (!driver || driver.partyId !== actor.partyId || vehicle.passengerActorIds.length >= vehicle.maxOccupants - 1) continue;
    const distance = Math.hypot(vehicle.position.x - actor.position.x, vehicle.position.y - actor.position.y);
    if (distance <= maximumDistance && (!nearest || distance < nearest.distance)) nearest = { vehicle, distance };
  }
  return nearest;
}

function updateAiPlayerInputs(world) {
  for (const actor of Object.values(world.actors)) {
    if (actor.controller !== 'ai' || !actor.alive) continue;
    if (['board', 'countdown', 'results'].includes(world.mission?.status)) {
      actor.aiState = 'follow_party';
      actor.input = { moveX: 0, moveY: 0, action: false, attack: false, sprint: false, brake: false };
      continue;
    }
    if (world.territory?.enabled && world.territory.status === 'active' && !actor.currentVehicleId) {
      const partyAi = Object.values(world.actors)
        .filter((candidate) => candidate.partyId === actor.partyId && candidate.controller === 'ai' && candidate.alive)
        .sort((a, b) => a.slot - b.slot);
      const partyHasExternalController = Object.values(world.actors)
        .some((candidate) => candidate.partyId === actor.partyId && ['human', 'adapter'].includes(candidate.controller));
      const post = world.territory.commandPosts[actor.partyId];
      const isAutoBuyer = partyAi[0]?.id === actor.id;
      const canAutoHire = isAutoBuyer
        && !partyHasExternalController
        && activeCrew(world, actor.partyId).length === 0
        && (world.economy?.partyFunds?.[actor.partyId] || 0) >= world.territory.reinforcement.costCents
        && Math.hypot(actor.position.x - post.x, actor.position.y - post.y) <= post.radius;
      if (canAutoHire) {
        actor.aiState = 'revive_or_support';
        actor.input = { moveX: 0, moveY: 0, action: true, attack: false, sprint: false, brake: false };
        continue;
      }
    }
    if (actor.currentVehicleId) {
      const vehicle = world.vehicles[actor.currentVehicleId];
      if (vehicle?.driverActorId === actor.id) {
        actor.aiState = 'move_to_mission';
        actor.input = { moveX: Math.sin(world.tick / 90) * 0.6, moveY: -0.65, action: false, attack: false, sprint: false, brake: false };
      } else {
        const enemy = nearestEnemy(world, actor, 220);
        const aim = enemy
          ? normalizeVector(enemy.actor.position.x - actor.position.x, enemy.actor.position.y - actor.position.y)
          : { x: 0, y: 0 };
        actor.aiState = enemy ? 'attack_enemy' : 'enter_party_vehicle';
        actor.input = {
          moveX: aim.x,
          moveY: aim.y,
          action: false,
          attack: Boolean(enemy) && world.tick >= actor.nextAttackTick,
          sprint: false,
          brake: false,
        };
      }
      continue;
    }

    const allyVehicle = !actor.carryingPackageId ? nearbyAllyVehicle(world, actor) : null;
    if (allyVehicle) {
      const vector = normalizeVector(
        allyVehicle.vehicle.position.x - actor.position.x,
        allyVehicle.vehicle.position.y - actor.position.y,
      );
      actor.aiState = 'enter_party_vehicle';
      actor.input = {
        moveX: vector.distance > 42 ? vector.x : 0,
        moveY: vector.distance > 42 ? vector.y : 0,
        action: vector.distance <= 42,
        attack: false,
        sprint: vector.distance > 110,
        brake: false,
      };
      continue;
    }

    const target = chooseAiTarget(world, actor);
    const waypoint = navigationPoint(world, actor, target);
    const vector = normalizeVector(waypoint.x - actor.position.x, waypoint.y - actor.position.y);
    const targetDistance = Math.hypot(target.x - actor.position.x, target.y - actor.position.y);
    const enemy = nearestEnemy(world, actor);
    let movementVector = vector;
    if (enemy && enemy.distance < 58) {
      movementVector = normalizeVector(
        actor.position.x - enemy.actor.position.x,
        actor.position.y - enemy.actor.position.y,
      );
      if (movementVector.distance < 0.01) movementVector = { x: actor.slot % 2 ? 1 : -1, y: actor.slot % 3 ? 0.45 : -0.45 };
    } else if (enemy && enemy.distance < 125) {
      const side = actor.slot % 2 ? 1 : -1;
      const aimVector = normalizeVector(enemy.actor.position.x - actor.position.x, enemy.actor.position.y - actor.position.y);
      movementVector = { x: -aimVector.y * side * 0.7, y: aimVector.x * side * 0.7 };
    }
    actor.aiState = enemy ? 'attack_enemy' : target.kind === 'party' ? 'follow_party' : 'move_to_mission';
    actor.input = {
      moveX: movementVector.distance === 0 || vector.distance <= 8 ? 0 : movementVector.x,
      moveY: movementVector.distance === 0 || vector.distance <= 8 ? 0 : movementVector.y,
      action: targetDistance <= 34 && (target.kind === 'package' || target.kind === 'delivery'),
      attack: Boolean(enemy) && world.tick >= actor.nextAttackTick,
      sprint: vector.distance > 180,
      brake: false,
    };
    if (enemy) {
      const aim = normalizeVector(enemy.actor.position.x - actor.position.x, enemy.actor.position.y - actor.position.y);
      actor.facing = { x: aim.x, y: aim.y };
    }
  }
}

module.exports = {
  AI_PLAYER_STATES,
  chooseAiTarget,
  findGridPath,
  gridCellBlocked,
  navigationPoint,
  nearbyAllyVehicle,
  partyAnchor,
  updateAiPlayerInputs,
};
