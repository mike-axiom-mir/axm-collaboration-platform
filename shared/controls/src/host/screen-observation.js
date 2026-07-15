'use strict';

const DEFAULT_VIEWPORT = Object.freeze({ width: 1280, height: 720 });
const DEFAULT_FORBIDDEN_KEYS = new Set([
  'token', 'tokens', 'seatToken', 'seatTokens', 'hostToken', 'password', 'secret',
  'input', 'inputHeld', 'pendingPulses', 'randomSeed', 'aiPath', 'aiTarget',
  'nextAttackTick', 'fireQueuedUntilTick', 'privateState', 'hostState',
]);
const DEFAULT_PUBLIC_ENTITY_FIELDS = Object.freeze([
  'id', 'kind', 'role', 'seatId', 'slot', 'displayName', 'controller', 'partyId',
  'hostile', 'state', 'position', 'velocity', 'facing', 'health', 'maxHealth',
  'shield', 'maxShield', 'alive', 'currentVehicleId', 'vehicleSeat', 'radius',
  'rotation', 'speed', 'driverActorId', 'passengerActorIds', 'maxOccupants',
]);

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection instanceof Map) return [...collection.values()];
  if (typeof collection === 'object') return Object.values(collection);
  return [];
}

function clampViewport(value, fallback, minimum, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function entityPosition(entity) {
  const position = entity?.position || entity || {};
  return { x: Number(position.x) || 0, y: Number(position.y) || 0 };
}

function computePartyCamera({ actors, vehicles, partyId, viewport = {}, worldBounds, extraFocalPoints = [] }) {
  const screen = {
    width: clampViewport(viewport.width, DEFAULT_VIEWPORT.width, 320, 3840),
    height: clampViewport(viewport.height, DEFAULT_VIEWPORT.height, 240, 2160),
  };
  const vehicleById = new Map(toArray(vehicles).map((vehicle) => [vehicle.id, vehicle]));
  const focal = toArray(actors)
    .filter((actor) => actor?.partyId === partyId && actor.alive !== false)
    .map((actor) => entityPosition(vehicleById.get(actor.currentVehicleId) || actor));
  for (const point of extraFocalPoints) focal.push(entityPosition(point));
  const bounds = worldBounds || { left: 0, top: 0, right: 2048, bottom: 2048 };
  if (!focal.length) focal.push({
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  });
  const centre = focal.reduce((sum, point) => ({
    x: sum.x + point.x / focal.length,
    y: sum.y + point.y / focal.length,
  }), { x: 0, y: 0 });
  const xs = focal.map((point) => point.x);
  const ys = focal.map((point) => point.y);
  const contentWidth = Math.max(80, Math.max(...xs) - Math.min(...xs));
  const contentHeight = Math.max(80, Math.max(...ys) - Math.min(...ys));
  let zoom = Math.min(screen.width / (contentWidth + 190), screen.height / (contentHeight + 190));
  zoom = Math.max(0.55, Math.min(2.4, zoom));
  const x = Math.max(bounds.left, Math.min(bounds.right, centre.x));
  const y = Math.max(bounds.top, Math.min(bounds.bottom, centre.y));
  const halfWidth = screen.width / (2 * zoom);
  const halfHeight = screen.height / (2 * zoom);
  return {
    viewport: screen,
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

function rectangleVisible(entity, camera) {
  const width = Number(entity?.width ?? entity?.w) || 0;
  const height = Number(entity?.height ?? entity?.h) || 0;
  const point = entityPosition(entity);
  return point.x + width >= camera.bounds.left
    && point.x <= camera.bounds.right
    && point.y + height >= camera.bounds.top
    && point.y <= camera.bounds.bottom;
}

function clonePublicValue(value) {
  if (Array.isArray(value)) return value.map(clonePublicValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePublicValue(entry)]));
}

function projectPublicEntity(entity, extraFields = []) {
  const projected = {};
  for (const field of [...DEFAULT_PUBLIC_ENTITY_FIELDS, ...extraFields]) {
    if (entity?.[field] !== undefined) projected[field] = clonePublicValue(entity[field]);
  }
  return projected;
}

function stripForbidden(value, forbiddenKeys = DEFAULT_FORBIDDEN_KEYS, seen = new WeakSet()) {
  if (Array.isArray(value)) return value.map((entry) => stripForbidden(entry, forbiddenKeys, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular-omitted]';
  seen.add(value);
  const clean = {};
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) continue;
    clean[key] = stripForbidden(entry, forbiddenKeys, seen);
  }
  seen.delete(value);
  return clean;
}

function descriptorItems(descriptor) {
  return toArray(descriptor?.items ?? descriptor);
}

function buildScreenBoundedObservation(options = {}) {
  const actor = options.seatActor;
  if (!actor?.seatId || !actor?.partyId) throw new TypeError('seatActor with seatId and partyId is required.');
  const actors = toArray(options.actors);
  const vehicles = toArray(options.vehicles);
  const camera = options.camera || computePartyCamera({
    actors,
    vehicles,
    partyId: actor.partyId,
    viewport: options.viewport,
    worldBounds: options.worldBounds,
    extraFocalPoints: options.extraFocalPoints,
  });
  const visible = {
    actors: actors.filter((entry) => pointVisible(entry, camera)).map((entry) => projectPublicEntity(entry)),
    vehicles: vehicles.filter((entry) => pointVisible(entry, camera, 36)).map((entry) => projectPublicEntity(entry)),
  };
  for (const [name, descriptor] of Object.entries(options.collections || {})) {
    const items = descriptorItems(descriptor);
    const geometry = descriptor?.geometry || 'point';
    const filter = geometry === 'rectangle' ? rectangleVisible : pointVisible;
    const projector = typeof descriptor?.project === 'function'
      ? descriptor.project
      : (entry) => projectPublicEntity(entry, descriptor?.publicFields);
    visible[name] = items
      .filter((entry) => filter(entry, camera, descriptor?.extraRadius))
      .map((entry) => projector(entry));
  }
  const map = {};
  for (const [name, descriptor] of Object.entries(options.mapLayers || {})) {
    const items = descriptorItems(descriptor);
    map[name] = items
      .filter((entry) => rectangleVisible(entry, camera))
      .map((entry) => projectPublicEntity(entry, ['label', 'x', 'y', 'width', 'height', 'w', 'h']));
  }
  if (Object.keys(map).length) visible.map = map;

  const observation = {
    ok: true,
    schemaVersion: 1,
    observationType: 'axm-seat-screen-semantics-v1',
    scope: 'same-party-shared-screen-only',
    sessionId: options.sessionId,
    roomCode: options.roomCode,
    tick: options.tick ?? null,
    seatId: actor.seatId,
    partyId: actor.partyId,
    screen: camera,
    self: { ...projectPublicEntity(actor), ...(options.publicSelf || {}) },
    partyHud: actors
      .filter((entry) => entry.partyId === actor.partyId)
      .map((entry) => projectPublicEntity(entry)),
    hud: options.publicHud || {},
    visible,
    controls: {
      protocol: 'axm-semantic-input-v1',
      profile: options.controllerProfile || null,
      inputEndpoint: options.inputEndpoint || '/api/input',
      nextSequenceMinimum: (Number.isSafeInteger(actor.inputSequence) ? actor.inputSequence : -1) + 1,
    },
  };
  return stripForbidden(observation, options.forbiddenKeys || DEFAULT_FORBIDDEN_KEYS);
}

module.exports = {
  DEFAULT_FORBIDDEN_KEYS,
  DEFAULT_PUBLIC_ENTITY_FIELDS,
  DEFAULT_VIEWPORT,
  buildScreenBoundedObservation,
  computePartyCamera,
  pointVisible,
  projectPublicEntity,
  rectangleVisible,
  stripForbidden,
  toArray,
};

