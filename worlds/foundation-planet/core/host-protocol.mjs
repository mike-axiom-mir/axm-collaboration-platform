import { PLANET_DEFAULTS } from './planet-model.mjs';
import { WORLD_STATE_SCHEMA, checksum } from './world-state.mjs';

export const HOST_CONTRACT_SCHEMA = 'axm.foundation-planet.host-contract/v1';
export const HOST_PROJECTION_SCHEMA = 'axm.foundation-planet.host-projection/v1';
export const HOST_PATCH_SCHEMA = 'axm.foundation-planet.host-patch/v1';
export const SECTOR_SUBSCRIPTION_SCHEMA = 'axm.foundation-planet.sector-subscription/v1';
export const LIVING_WORLD_CREATE_SCHEMA = 'axm.living-world.create/v1';
export const LIVING_WORLD_SCHEMA = 'axm.living-world-state/v1';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = value => JSON.parse(JSON.stringify(value));
const normalizeLongitude = longitude => ((Number(longitude) + 540) % 360) - 180;

function cleanId(value, fallback = 'local') {
  const cleaned = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned || fallback;
}

function validCoordinate(value) {
  return Boolean(value && Number.isFinite(Number(value.latitudeDeg ?? value.lat)) &&
    Number.isFinite(Number(value.longitudeDeg ?? value.lon)) &&
    Number(value.latitudeDeg ?? value.lat) >= -90 && Number(value.latitudeDeg ?? value.lat) <= 90);
}

function canonicalCoordinate(value, elevationFallback = 0) {
  if (!validCoordinate(value)) throw new TypeError('a finite canonical latitude/longitude is required');
  return {
    schema: 'axm.foundation-planet.coordinate/v1',
    worldId: PLANET_DEFAULTS.id,
    latitudeDeg: clamp(Number(value.latitudeDeg ?? value.lat), -90, 90),
    longitudeDeg: normalizeLongitude(Number(value.longitudeDeg ?? value.lon)),
    elevationM: Number.isFinite(Number(value.elevationM)) ? Number(value.elevationM) : Number(elevationFallback || 0),
    reference: 'planet-mean-sea-level'
  };
}

function payloadOf(localState) {
  if (!localState || typeof localState !== 'object') throw new TypeError('local Foundation Planet state is required');
  if (localState.schema === WORLD_STATE_SCHEMA && localState.payload) return localState.payload;
  if (localState.payload && typeof localState.payload === 'object') return localState.payload;
  return localState;
}

function lineageOf(localState, options = {}) {
  return String(options.lineageId || localState?.lineageId || `${PLANET_DEFAULTS.id}:${PLANET_DEFAULTS.seed}:root`);
}

function layerFacts(payload) {
  const snapshot = payload.layers || {};
  return clone(snapshot.layers || snapshot);
}

export function createHostBootstrap(localState, options = {}) {
  const payload = payloadOf(localState), lineageId = lineageOf(localState, options);
  const coordinate = canonicalCoordinate(payload.location || options.location || { lat: 0, lon: 0 }, options.elevationM);
  const sourceRevision = Number.isSafeInteger(localState?.revision) ? localState.revision : Number(options.sourceRevision || 0);
  return {
    schema: LIVING_WORLD_CREATE_SCHEMA,
    worldId: PLANET_DEFAULTS.id,
    lineageId,
    seed: PLANET_DEFAULTS.seed,
    coordinateReference: {
      schema: 'axm.foundation-planet.coordinate/v1',
      type: 'latitude-longitude-elevation',
      horizontalReference: 'planet-centered-spherical',
      verticalDatum: 'planet-mean-sea-level',
      radiusM: PLANET_DEFAULTS.radiusM,
      renderCoordinatesCanonical: false
    },
    metadata: {
      title: 'Caelus',
      contract: HOST_CONTRACT_SCHEMA,
      sourceStateSchema: localState?.schema || 'axm.foundation-planet.runtime-state/v1',
      sourceRevision,
      authority: 'living-world-state-server',
      rulesetsOwnWorld: false,
      rulesetsCanResetWorld: false
    },
    facts: {
      'foundation-contract': hostDescription(),
      'planet-clock': { day: Number(payload.day || 1), year: Math.max(1, Number(payload.year || 1)), dayLengthSeconds: PLANET_DEFAULTS.dayLengthSeconds, yearLengthDays: PLANET_DEFAULTS.yearLengthDays },
      'condition-profile': String(payload.profileId || 'temperate'),
      'layer-state': layerFacts(payload),
      'simulation-anchor': { sourceRevision, livingAgeDays: Number(payload.livingAgeDays || 0), coordinate, mode: payload.mode === 'surface' ? 'surface' : 'orbit' }
    }
  };
}

export function createParticipantEntity(participant, options = {}) {
  if (!participant || typeof participant !== 'object') throw new TypeError('participant is required');
  const participantId = cleanId(participant.participantId || participant.id, 'participant');
  const coordinate = canonicalCoordinate(participant.coordinate || participant.location || options.location || { lat: 0, lon: 0 }, participant.elevationM);
  return {
    id: `participant-${participantId}`.slice(0, 80),
    kind: 'participant',
    data: {
      participantId,
      seatId: cleanId(participant.seatId || 'seat-local', 'seat-local'),
      actorType: ['human', 'ai', 'adapter'].includes(participant.actorType) ? participant.actorType : 'human',
      coordinate,
      headingDeg: normalizeLongitude(Number(participant.headingDeg || 0)),
      movementMode: ['walk', 'sprint', 'swim', 'vehicle', 'flight'].includes(participant.movementMode) ? participant.movementMode : 'walk',
      presence: participant.presence === 'disconnected' ? 'disconnected' : 'present',
      lastInputSequence: Math.max(-1, Math.floor(Number(participant.lastInputSequence ?? -1))),
      gameBinding: participant.gameBinding ? cleanId(participant.gameBinding, 'game') : null
    }
  };
}

export function createHostPatch(localState, expectedRevision, options = {}) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new TypeError('expectedRevision must be a non-negative safe integer');
  const payload = payloadOf(localState), lineageId = lineageOf(localState, options);
  const coordinate = canonicalCoordinate(payload.location || options.location || { lat: 0, lon: 0 }, options.elevationM);
  const sourceRevision = Number.isSafeInteger(localState?.revision) ? localState.revision : Number(options.sourceRevision || 0);
  const participant = createParticipantEntity({
    participantId: options.participantId || 'local-explorer',
    seatId: options.seatId || 'seat-local',
    actorType: options.actorType || 'human',
    coordinate,
    headingDeg: options.headingDeg || 0,
    movementMode: payload.mode === 'surface' ? (options.movementMode || 'walk') : 'flight',
    gameBinding: options.gameBinding || null
  });
  const operations = [
    { type: 'set-fact', key: 'planet-clock', value: { day: Number(payload.day || 1), year: Math.max(1, Number(payload.year || 1)), dayLengthSeconds: PLANET_DEFAULTS.dayLengthSeconds, yearLengthDays: PLANET_DEFAULTS.yearLengthDays } },
    { type: 'set-fact', key: 'condition-profile', value: String(payload.profileId || 'temperate') },
    { type: 'set-fact', key: 'layer-state', value: layerFacts(payload) },
    { type: 'set-fact', key: 'simulation-anchor', value: { sourceRevision, livingAgeDays: Number(payload.livingAgeDays || 0), coordinate, mode: payload.mode === 'surface' ? 'surface' : 'orbit' } },
    { type: 'upsert-entity', entity: participant }
  ];
  const base = {
    schema: HOST_PATCH_SCHEMA,
    worldId: PLANET_DEFAULTS.id,
    lineageId,
    expectedRevision,
    source: 'foundation-planet-host-projection',
    actor: String(options.actor || 'foundation-planet').slice(0, 120),
    operations
  };
  return { ...base, proposalDigest: checksum(base), applyAuthority: false, resetAuthority: false };
}

export function validateHostWorld(world, options = {}) {
  const errors = [];
  if (!world || world.schema !== LIVING_WORLD_SCHEMA) errors.push('schema');
  if (world?.worldId !== PLANET_DEFAULTS.id) errors.push('world-id');
  if (world?.owner !== 'living-world-state-server') errors.push('owner');
  if (!Number.isSafeInteger(world?.revision) || world.revision < 0) errors.push('revision');
  if (!world?.lineageId) errors.push('lineage');
  if (options.lineageId && world?.lineageId !== options.lineageId) errors.push('lineage-mismatch');
  if (world?.seed !== PLANET_DEFAULTS.seed) errors.push('seed');
  if (world?.coordinateReference?.schema !== 'axm.foundation-planet.coordinate/v1') errors.push('coordinate-reference');
  if (!world?.facts || world.facts['foundation-contract']?.schema !== HOST_CONTRACT_SCHEMA) errors.push('foundation-contract');
  if (world?.digest && !/^[a-f0-9]{64}$/.test(world.digest)) errors.push('digest');
  for (const entity of world?.entities || []) {
    if (entity.kind === 'participant' && !validCoordinate(entity.data?.coordinate)) errors.push(`participant-coordinate:${entity.id}`);
  }
  return { valid: errors.length === 0, errors };
}

export function hostWorldToProjection(world, options = {}) {
  const validation = validateHostWorld(world, options);
  if (!validation.valid) throw new Error(`Foundation host world refused: ${validation.errors.join(', ')}`);
  const anchor = world.facts['simulation-anchor'] || {};
  const participants = (world.entities || []).filter(entity => entity.kind === 'participant').map(entity => ({
    id: entity.id,
    participantId: entity.data.participantId,
    seatId: entity.data.seatId,
    actorType: entity.data.actorType,
    coordinate: canonicalCoordinate(entity.data.coordinate),
    headingDeg: Number(entity.data.headingDeg || 0),
    movementMode: entity.data.movementMode || 'walk',
    presence: entity.data.presence || 'present',
    updatedAt: entity.updatedAt || null
  }));
  return {
    schema: HOST_PROJECTION_SCHEMA,
    worldId: world.worldId,
    lineageId: world.lineageId,
    hostRevision: world.revision,
    worldDigest: world.digest || null,
    owner: world.owner,
    profileId: world.facts['condition-profile'] || 'temperate',
    clock: clone(world.facts['planet-clock'] || { day: 1, year: 1 }),
    layers: clone(world.facts['layer-state'] || {}),
    simulationAnchor: clone(anchor),
    participants,
    authoritative: true,
    localStateReplacement: false
  };
}

export function createSectorSubscription(options = {}) {
  const center = canonicalCoordinate(options.center || options.coordinate || { lat: 0, lon: 0 });
  const subscriberId = cleanId(options.subscriberId || 'local-explorer', 'local-explorer');
  const entityKinds = Array.from(new Set((options.entityKinds || ['participant', 'named-organism', 'game-entity']).map(kind => cleanId(kind, 'entity')))).slice(0, 24);
  const base = {
    schema: SECTOR_SUBSCRIPTION_SCHEMA,
    id: `sector-sub-${subscriberId}`,
    worldId: PLANET_DEFAULTS.id,
    lineageId: String(options.lineageId || `${PLANET_DEFAULTS.id}:${PLANET_DEFAULTS.seed}:root`),
    subscriberId,
    center,
    radiusKm: clamp(Number(options.radiusKm || 120), 1, 500),
    entityKinds,
    sinceRevision: Math.max(0, Math.floor(Number(options.sinceRevision || 0))),
    maximumEntities: clamp(Math.floor(Number(options.maximumEntities || 1024)), 1, 4096)
  };
  return { ...base, subscriptionDigest: checksum(base), readOnly: true };
}

function greatCircleDistanceKm(a, b) {
  const lat1 = Number(a.latitudeDeg ?? a.lat) * Math.PI / 180, lat2 = Number(b.latitudeDeg ?? b.lat) * Math.PI / 180;
  const dLat = lat2 - lat1, dLon = normalizeLongitude(Number(b.longitudeDeg ?? b.lon) - Number(a.longitudeDeg ?? a.lon)) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * PLANET_DEFAULTS.radiusM / 1000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function selectSectorEntities(world, subscription) {
  const validation = validateHostWorld(world, { lineageId: subscription?.lineageId });
  if (!validation.valid) throw new Error(`sector source world refused: ${validation.errors.join(', ')}`);
  if (!subscription || subscription.schema !== SECTOR_SUBSCRIPTION_SCHEMA || subscription.worldId !== world.worldId) throw new Error('sector subscription schema or world mismatch');
  const entities = [];
  for (const entity of world.entities || []) {
    if (!subscription.entityKinds.includes(entity.kind) || !validCoordinate(entity.data?.coordinate)) continue;
    const distanceKm = greatCircleDistanceKm(subscription.center, entity.data.coordinate);
    if (distanceKm <= subscription.radiusKm) entities.push({ ...clone(entity), distanceKm: Number(distanceKm.toFixed(3)) });
  }
  entities.sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
  return {
    schema: 'axm.foundation-planet.sector-entities/v1',
    worldId: world.worldId,
    lineageId: world.lineageId,
    revision: world.revision,
    subscriptionId: subscription.id,
    center: clone(subscription.center),
    radiusKm: subscription.radiusKm,
    entities: entities.slice(0, subscription.maximumEntities),
    totalMatching: entities.length,
    truncated: entities.length > subscription.maximumEntities
  };
}

function unwrapResponse(response) {
  if (!response || typeof response !== 'object') throw new Error('host response is missing');
  if (response.ok === false) throw new Error(String(response.error || 'host request failed'));
  return response.result === undefined ? response : response.result;
}

export class FoundationHostClient {
  constructor(options = {}) {
    if (!options.transport || typeof options.transport.getWorld !== 'function') throw new TypeError('host transport.getWorld is required');
    this.transport = options.transport;
    this.lineageId = options.lineageId || null;
    this.revision = -1;
    this.digest = null;
    this.projection = null;
    this.status = 'disconnected';
  }

  async pull() {
    const world = unwrapResponse(await this.transport.getWorld(PLANET_DEFAULTS.id));
    const projection = hostWorldToProjection(world, { lineageId: this.lineageId || undefined });
    if (this.revision >= 0 && projection.hostRevision < this.revision) throw new Error('host revision moved backwards');
    this.lineageId ||= projection.lineageId;
    this.revision = projection.hostRevision;
    this.digest = projection.worldDigest;
    this.projection = projection;
    this.status = 'attached';
    return clone(projection);
  }

  async pullChanges() {
    if (this.revision < 0) return this.pull();
    if (typeof this.transport.getChanges !== 'function') throw new TypeError('host transport.getChanges is required');
    const packet = unwrapResponse(await this.transport.getChanges(PLANET_DEFAULTS.id, this.revision));
    if (packet.worldId !== PLANET_DEFAULTS.id || packet.lineageId !== this.lineageId) throw new Error('host change packet identity mismatch');
    if (packet.resyncRequired) return this.pull();
    if (!Number.isSafeInteger(packet.toRevision) || packet.toRevision < this.revision) throw new Error('host change packet revision moved backwards');
    this.revision = packet.toRevision;
    return clone(packet);
  }

  async propose(localState, options = {}) {
    if (this.revision < 0) throw new Error('pull the authoritative host before proposing a patch');
    if (typeof this.transport.patchWorld !== 'function') throw new TypeError('host transport.patchWorld is required');
    const proposal = createHostPatch(localState, this.revision, { ...options, lineageId: this.lineageId });
    const applied = unwrapResponse(await this.transport.patchWorld(proposal));
    const projection = hostWorldToProjection(applied.world, { lineageId: this.lineageId });
    this.revision = projection.hostRevision;
    this.digest = projection.worldDigest;
    this.projection = projection;
    return { proposal: clone(proposal), projection: clone(projection), event: clone(applied.event) };
  }

  descriptor() {
    return {
      schema: HOST_CONTRACT_SCHEMA,
      status: this.status,
      worldId: PLANET_DEFAULTS.id,
      lineageId: this.lineageId,
      revision: this.revision,
      digest: this.digest,
      authoritative: this.status === 'attached',
      transportReplaceable: true
    };
  }
}

export async function probeFoundationHost(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return { available: false, attached: false, reason: 'fetch-unavailable' };
  try {
    const response = await fetchImpl('/api/living-worlds', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return { available: false, attached: false, reason: `catalog-http-${response.status}` };
    const catalog = unwrapResponse(await response.json());
    const worlds = Array.isArray(catalog.worlds) ? catalog.worlds : [];
    const match = worlds.find(world => world.worldId === PLANET_DEFAULTS.id);
    if (!match) return { available: true, attached: false, reason: 'caelus-not-created', worldCount: worlds.length };
    const worldResponse = await fetchImpl(`/api/living-world?worldId=${encodeURIComponent(PLANET_DEFAULTS.id)}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!worldResponse.ok) return { available: true, attached: false, reason: `world-http-${worldResponse.status}` };
    const world = unwrapResponse(await worldResponse.json()), validation = validateHostWorld(world);
    return validation.valid
      ? { available: true, attached: true, reason: null, projection: hostWorldToProjection(world) }
      : { available: true, attached: false, reason: `world-invalid:${validation.errors.join(',')}` };
  } catch (error) {
    return { available: false, attached: false, reason: String(error?.message || error).slice(0, 180) };
  }
}

export function hostDescription() {
  return {
    schema: HOST_CONTRACT_SCHEMA,
    worldId: PLANET_DEFAULTS.id,
    authoritativeOwner: 'living-world-state-server',
    namedWorldIsolation: true,
    expectedRevisionWrites: true,
    boundedChangeJournal: true,
    snapshotsAndGuardedRestore: true,
    sectorSubscriptions: SECTOR_SUBSCRIPTION_SCHEMA,
    controllerTransport: 'axm.controller-input/v1',
    rulesetsOwnWorld: false,
    rulesetsCanResetWorld: false,
    browserRuntimeDefault: 'local-revisioned-v2',
    automaticHostMutation: false
  };
}
