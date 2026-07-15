'use strict';

const { summarizeAmmo } = require('./inventory-system');
const { serializeWorldState } = require('./display-state');
const { tokensEqual } = require('./session-manager');

const DEFAULT_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

function clampViewport(value, fallback, minimum, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function entityPosition(entity) {
  return entity?.position || { x: Number(entity?.x) || 0, y: Number(entity?.y) || 0 };
}

function computePartyCamera(world, partyId, requestedViewport = {}) {
  const viewport = {
    width: clampViewport(requestedViewport.width, DEFAULT_VIEWPORT.width, 320, 3840),
    height: clampViewport(requestedViewport.height, DEFAULT_VIEWPORT.height, 240, 2160),
  };
  const vehicles = world.vehicles || {};
  const focal = Object.values(world.actors).filter((actor) => (
    actor.alive !== false && actor.partyId === partyId
  )).map((actor) => entityPosition(actor.currentVehicleId ? vehicles[actor.currentVehicleId] || actor : actor));
  if (world.mission?.relay?.includeInCamera && focal.length) focal.push(entityPosition(world.mission.relay));
  if (!focal.length) focal.push({ x: world.staticMap.width / 2, y: world.staticMap.height / 2 });

  const centre = focal.reduce((sum, point) => ({
    x: sum.x + point.x / focal.length,
    y: sum.y + point.y / focal.length,
  }), { x: 0, y: 0 });
  const xs = focal.map((point) => point.x);
  const ys = focal.map((point) => point.y);
  const contentWidth = Math.max(80, Math.max(...xs) - Math.min(...xs));
  const contentHeight = Math.max(80, Math.max(...ys) - Math.min(...ys));
  let zoom = Math.min(viewport.width / (contentWidth + 190), viewport.height / (contentHeight + 190));
  const maximumDistance = Math.max(0, ...focal.map((point) => Math.hypot(point.x - centre.x, point.y - centre.y)));
  if (maximumDistance > 300) zoom *= 0.9;
  zoom = Math.max(0.55, Math.min(2.4, zoom));
  const x = Math.max(0, Math.min(world.staticMap.width, centre.x));
  const y = Math.max(0, Math.min(world.staticMap.height, centre.y));
  const halfWidth = viewport.width / (2 * zoom);
  const halfHeight = viewport.height / (2 * zoom);
  return {
    viewport,
    x,
    y,
    zoom,
    bounds: {
      left: x - halfWidth,
      right: x + halfWidth,
      top: y - halfHeight,
      bottom: y + halfHeight,
    },
    projection: 'party-camera-target-v1',
  };
}

function pointVisible(entity, camera, extra = 24) {
  const point = entityPosition(entity);
  const radius = Math.max(extra, Number(entity?.radius) || 0);
  return point.x + radius >= camera.bounds.left
    && point.x - radius <= camera.bounds.right
    && point.y + radius >= camera.bounds.top
    && point.y - radius <= camera.bounds.bottom;
}

function rectangleVisible(rectangle, camera) {
  const width = Number(rectangle.width ?? rectangle.w) || 0;
  const height = Number(rectangle.height ?? rectangle.h) || 0;
  return rectangle.x + width >= camera.bounds.left
    && rectangle.x <= camera.bounds.right
    && rectangle.y + height >= camera.bounds.top
    && rectangle.y <= camera.bounds.bottom;
}

function actorView(actor) {
  return {
    id: actor.id,
    seatId: actor.seatId,
    slot: actor.slot,
    displayName: actor.displayName,
    controller: actor.controller,
    partyId: actor.partyId,
    position: { ...actor.position },
    velocity: { ...actor.velocity },
    facing: { ...actor.facing },
    health: actor.health,
    maxHealth: actor.maxHealth,
    shield: actor.shield,
    maxShield: actor.maxShield,
    alive: actor.alive,
    state: actor.state,
    currentVehicleId: actor.currentVehicleId,
    vehicleSeat: actor.vehicleSeat,
    carryingPackageId: actor.carryingPackageId,
    tether: actor.tether,
  };
}

function npcView(npc) {
  return {
    id: npc.id,
    kind: npc.kind,
    role: npc.role || null,
    partyId: npc.partyId || null,
    hostile: npc.hostile === true,
    state: npc.state,
    position: { ...npc.position },
    velocity: { ...(npc.velocity || { x: 0, y: 0 }) },
    facing: { ...(npc.facing || { x: 0, y: 1 }) },
    health: npc.health,
    maxHealth: npc.maxHealth,
    alive: npc.alive !== false,
  };
}

function vehicleView(vehicle) {
  return {
    id: vehicle.id,
    kind: 'vehicle',
    position: { ...vehicle.position },
    rotation: vehicle.rotation,
    velocity: { ...(vehicle.velocity || { x: 0, y: 0 }) },
    speed: vehicle.speed,
    health: vehicle.health,
    maxHealth: vehicle.maxHealth,
    destroyed: vehicle.destroyed === true,
    partyOwnerId: vehicle.partyOwnerId,
    driverActorId: vehicle.driverActorId,
    passengerActorIds: [...(vehicle.passengerActorIds || [])],
    maxOccupants: vehicle.maxOccupants,
  };
}

function projectileView(projectile) {
  return {
    id: projectile.id,
    kind: projectile.kind || 'projectile',
    ownerActorId: projectile.ownerActorId || null,
    partyId: projectile.partyId || null,
    position: { ...projectile.position },
    velocity: { ...projectile.velocity },
  };
}

function effectView(effect) {
  return {
    id: effect.id || null,
    type: effect.type || effect.kind,
    partyId: effect.partyId || null,
    position: { ...entityPosition(effect) },
  };
}

function mapFeatureView(feature) {
  return {
    id: feature.id,
    kind: feature.kind || null,
    label: feature.label || null,
    x: feature.x,
    y: feature.y,
    width: Number(feature.width ?? feature.w) || 0,
    height: Number(feature.height ?? feature.h) || 0,
  };
}

function missionHud(mission) {
  return {
    mode: mission.mode,
    title: mission.title,
    status: mission.status,
    hint: mission.hint,
    score: mission.score,
    partyScores: mission.partyScores,
    remainingSeconds: mission.remainingSeconds,
    goal: mission.goal,
    deliveries: mission.deliveries,
    winnerPartyId: mission.winnerPartyId || null,
    result: mission.result || null,
    menuOptions: mission.menuOptions || [],
  };
}

function buildAdapterObservation(session, actor, viewport) {
  const world = session.world;
  const partyId = actor.partyId;
  const camera = computePartyCamera(world, partyId, viewport);
  const display = serializeWorldState(session, partyId).world;
  const publicActors = new Map(display.actors.map((entry) => [entry.id, entry]));
  const selfPublic = publicActors.get(actor.id);
  const territoryZones = (display.territory?.zones || []).map((zone) => ({
    id: zone.id,
    label: zone.label,
    ownerPartyId: zone.ownerPartyId,
    contested: zone.contested === true,
  }));
  return {
    ok: true,
    schemaVersion: 1,
    observationType: 'axm-seat-screen-semantics-v1',
    scope: 'same-party-shared-screen-only',
    sessionId: session.id,
    roomCode: session.roomCode,
    tick: world.tick,
    seatId: actor.seatId,
    partyId,
    screen: camera,
    self: {
      ...actorView(actor),
      ammoSummary: summarizeAmmo(actor.inventory),
      personalFundCents: actor.walletCents,
      partyFundCents: world.economy.partyFunds[partyId] || 0,
      inventoryOpen: actor.inventoryOpen === true,
      inventory: actor.inventoryOpen ? selfPublic?.inventory || actor.inventory : undefined,
    },
    partyHud: display.actors.filter((entry) => entry.partyId === partyId).map((entry) => ({
      seatId: entry.seatId,
      slot: entry.slot,
      displayName: entry.displayName,
      state: entry.state,
      alive: entry.alive,
      health: entry.health,
      maxHealth: entry.maxHealth,
      shield: entry.shield,
      maxShield: entry.maxShield,
      ammoSummary: entry.ammoSummary,
      personalFundCents: entry.personalFundCents,
      currentVehicleId: entry.currentVehicleId,
    })),
    hud: {
      mission: missionHud(display.mission),
      partyFundCents: display.economy.partyFunds[partyId] || 0,
      friendlyFire: display.combatRules.partyFriendlyFire[partyId] === true,
      crossPartyDamage: display.combatRules.crossPartyDamage === true,
      justiceStage: display.justice.stage,
      territoryZones,
    },
    visible: {
      actors: display.actors.filter((entry) => pointVisible(entry, camera)).map(actorView),
      npcs: display.npcs.filter((entry) => pointVisible(entry, camera)).map(npcView),
      vehicles: display.vehicles.filter((entry) => pointVisible(entry, camera, 36)).map(vehicleView),
      projectiles: display.projectiles.filter((entry) => pointVisible(entry, camera, 8)).map(projectileView),
      effects: display.effects.filter((entry) => pointVisible(entry, camera, 12)).map(effectView),
      territoryZones: (display.territory?.zones || []).filter((entry) => pointVisible(entry, camera, entry.radius || 52)),
      map: {
        roads: world.staticMap.roads.filter((entry) => rectangleVisible(entry, camera)).map(mapFeatureView),
        obstacles: world.staticMap.obstacles.filter((entry) => rectangleVisible(entry, camera)).map(mapFeatureView),
        areas: world.staticMap.areas.filter((entry) => rectangleVisible(entry, camera)).map(mapFeatureView),
        safeZones: world.staticMap.safeZones.filter((entry) => rectangleVisible(entry, camera)).map(mapFeatureView),
      },
    },
    controls: {
      protocol: 'axm-semantic-input-v1',
      profile: '/data/controller-profile.json',
      inputEndpoint: '/api/input',
      nextSequenceMinimum: actor.inputSequence + 1,
    },
  };
}

function getAdapterObservation(sessionManager, request = {}) {
  const session = sessionManager.getSession(request.sessionId);
  if (!session || session.status !== 'running') return { ok: false, statusCode: 404, reason: 'session-not-running' };
  if (request.roomCode !== session.roomCode) return { ok: false, statusCode: 403, reason: 'room-session-mismatch' };
  const actor = Object.values(session.world.actors).find((candidate) => candidate.seatId === request.seatId);
  if (!actor || actor.controller !== 'adapter') return { ok: false, statusCode: 404, reason: 'adapter-seat-not-found' };
  if (!tokensEqual(request.token, session.seatTokens[actor.seatId])) {
    return { ok: false, statusCode: 403, reason: 'seat-token-rejected' };
  }
  return buildAdapterObservation(session, actor, { width: request.width, height: request.height });
}

module.exports = {
  DEFAULT_VIEWPORT,
  buildAdapterObservation,
  computePartyCamera,
  getAdapterObservation,
  pointVisible,
};
