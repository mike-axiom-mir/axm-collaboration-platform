'use strict';

const { FORBIDDEN_OBSERVATION_KEYS } = require('../shared/constants');
const { tokensEqual } = require('./input-gate');
const { publicActor } = require('./session-manager');

const FORBIDDEN = new Set(FORBIDDEN_OBSERVATION_KEYS);

function cameraFor(session, seatId, width = 1280, height = 720) {
  const actor = session.actors[seatId];
  const viewport = { width: Math.max(320, Math.min(1920, Number(width) || 1280)), height: Math.max(240, Math.min(1080, Number(height) || 720)) };
  const party = Object.values(session.actors).filter(item => item.active && item.role === 'field-operator');
  const focus = party.length ? party : [actor];
  const x = focus.reduce((sum, item) => sum + item.position.x, 0) / focus.length;
  const y = focus.reduce((sum, item) => sum + item.position.y, 0) / focus.length;
  const spread = Math.max(0, ...focus.map(item => Math.hypot(item.position.x - x, item.position.y - y)));
  const zoom = Math.max(0.62, Math.min(1.25, 1.12 - spread / 900));
  const halfWidth = viewport.width / (2 * zoom), halfHeight = viewport.height / (2 * zoom);
  return { viewport, x, y, zoom, bounds: { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight }, projection: 'shared-party-camera-target-v1' };
}

function pointVisible(item, camera, margin = 30) {
  return item.x + margin >= camera.bounds.left && item.x - margin <= camera.bounds.right && item.y + margin >= camera.bounds.top && item.y - margin <= camera.bounds.bottom;
}
function rectVisible(bounds, camera) {
  return bounds.x + bounds.width >= camera.bounds.left && bounds.x <= camera.bounds.right && bounds.y + bounds.height >= camera.bounds.top && bounds.y <= camera.bounds.bottom;
}

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) if (!FORBIDDEN.has(key)) out[key] = scrub(child);
  return out;
}

function findForbidden(value, path = '$') {
  const errors = [];
  if (Array.isArray(value)) value.forEach((child, index) => errors.push(...findForbidden(child, path + '[' + index + ']')));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN.has(key)) errors.push(path + '.' + key);
      errors.push(...findForbidden(child, path + '.' + key));
    }
  }
  return errors;
}

function buildSeatObservation(session, seatId, context) {
  const actor = session.actors[seatId]; if (!actor || !actor.active) throw new Error('active-seat-not-found');
  const profile = context.profileStore.get(actor.profileId); const camera = cameraFor(session, seatId, context.width, context.height);
  const discovered = new Set(profile.discoveries.map(item => typeof item === 'string' ? item : item.id));
  const bones = context.worldBones;
  const mission = context.missionSystem.current(session);
  const circuitkin = profile.circuitkinRoster.map(kin => {
    const design = context.circuitkinSystem?.design(kin.designId);
    return {
      instanceId: kin.instanceId,
      designId: kin.designId,
      name: design?.name || kin.name,
      family: design?.family || kin.family,
      tier: design?.tier || kin.tier || 'individual',
      state: kin.state || 'Circuitkin',
      active: actor.circuitkinId === kin.designId,
      trust: Number(kin.trust || 0),
      branch: kin.branch || null,
      components: [...(design?.components || kin.components || [])],
      actions: [...(design?.baseActions || [])],
      signature: design?.signature || null,
      development: JSON.parse(JSON.stringify(kin.development || {})),
      branchChoices: context.circuitkinSystem ? context.circuitkinSystem.branchEligibility(profile, kin.designId) : []
    };
  });
  const codex = context.circuitkinSystem ? context.circuitkinSystem.codex(profile) : [];
  const discoveredPointIds = new Set(profile.discoveries.map(item => typeof item === 'string' ? item : item.id));
  const journalEntries = (context.loreData?.entries || []).filter(entry => {
    const point = bones.points.find(item => item.loreId === entry.id);
    return point && discoveredPointIds.has(point.id);
  });
  const observation = {
    ok: true, schemaVersion: 1, observationType: 'axm-seat-screen-semantics-v1', scope: 'same-party-shared-screen-only',
    sessionId: session.id, roomCode: session.roomCode, tick: session.tick, seatId, partyId: 'expedition-party', screen: camera,
    self: publicActor(actor),
    partyHud: Object.values(session.actors).filter(item => item.occupied).map(item => ({ seatId: item.seatId, displayName: item.displayName, role: item.role, controllerType: item.controllerType, active: item.active, connected: item.connected, integrity: item.integrity, maxIntegrity: item.maxIntegrity, energy: Math.round(item.energy), circuitkinId: item.circuitkinId || null })),
    hud: {
      localOnly: true, alphaStatus: 'ALPHA CANDIDATE / WORKING', region: actor.currentRegionId,
      eventCursor: session.events.length,
      recentEvents: session.events.slice(-12),
      mission: mission ? {
        id: mission.id, title: mission.title, brief: mission.brief, progress: session.missionProgress || null,
        dynamic: mission.id === 'm08-world-response' ? context.missionSystem.dynamicMission(session) : null
      } : { id: null, title: 'Chapter complete', brief: 'Return to Lumen Yard or continue exploring.' },
      encounter: context.encounterSystem.publicState(session.encounter),
      conditions: { dayPhase: session.worldRuntime.conditions.dayPhase, weather: session.worldRuntime.conditions.weather, signalPressure: Math.round(session.worldRuntime.conditions.signalPressure), expeditionModifier: session.worldRuntime.conditions.expeditionModifier },
      business: { profileId: profile.profileId, path: profile.business.path, reputation: profile.business.reputation, open: profile.business.open, localSessionShops: context.economySystem.sessionShops(session) },
      circuitkin,
      collection: {
        total: codex.length,
        connected: circuitkin.length,
        individuals: circuitkin.filter(kin => kin.tier !== 'confluence').length,
        specialists: circuitkin.filter(kin => kin.tier === 'confluence').length,
        entries: codex
      },
      journal: {
        title: context.loreData?.archiveTitle || 'Memory Echoes',
        total: context.loreData?.entries?.length || 0,
        recovered: journalEntries.length,
        entries: journalEntries.map(entry => ({ ...entry }))
      },
      inventory: {
        materials: JSON.parse(JSON.stringify(profile.inventory.materials || {})),
        items: JSON.parse(JSON.stringify(profile.inventory.items || {})),
        capacity: profile.inventory.capacity,
        recipes: [...profile.recipes],
        achievements: [...profile.achievements],
        stats: {
          discoveries: profile.discoveries.length,
          crafted: profile.history.filter(item => item.type === 'crafted').length,
          orders: profile.business.completedOrders.length,
          fieldUses: circuitkin.reduce((sum, kin) => sum + Object.values(kin.development.uses || {}).reduce((inner, value) => inner + Number(value || 0), 0), 0),
          recoveries: circuitkin.reduce((sum, kin) => sum + Number(kin.development.recoveries || 0), 0)
        }
      },
      requests: context.requestSystem ? context.requestSystem.summary(profile) : { title: 'Signal Board', total: 0, claimed: 0, ready: 0, requests: [] },
      currency: profile.currency
    },
    visible: {
      actors: Object.values(session.actors).filter(item => item.active && pointVisible(item.position, camera, 40)).map(publicActor),
      regions: bones.regions.filter(region => rectVisible(region.bounds, camera)).map(region => ({ id: region.id, name: region.name, kind: region.kind, bounds: region.bounds, palette: region.palette, description: region.description })),
      paths: bones.paths,
      points: bones.points.filter(point => pointVisible(point, camera) && (point.hidden !== true || discovered.has(point.id))).map(point => ({
        id: point.id, kind: point.kind, label: point.label, x: point.x, y: point.y, regionId: point.regionId, interaction: point.interaction,
        signalDesignId: point.circuitkinDesignId && discovered.has(point.id) ? point.circuitkinDesignId : null,
        memoryEcho: point.loreId && discovered.has(point.id) ? point.loreId : null
      })),
      resources: bones.resourceNodes.filter(node => !session.worldRuntime.resourcesRecovered[node.id] && pointVisible(node, camera)).map(node => ({ id: node.id, material: node.material, x: node.x, y: node.y, regionId: node.regionId })),
      settlementNpcs: bones.settlementNpcs.filter(npc => pointVisible(npc, camera)).map(npc => ({ ...npc })),
      discoveries: profile.discoveries.slice(-24)
    },
    controls: { protocol: 'axm-semantic-input-v1', profile: '/data/control-profile.json', inputEndpoint: '/api/input', nextSequenceMinimum: actor.inputSequence + 1 }
  };
  return scrub(observation);
}

function getBoundObservation(session, request, context, requireAdapter = false) {
  if (!session || session.status !== 'running') return { ok: false, statusCode: 404, reason: 'session-not-running' };
  if (request.roomCode !== session.roomCode || request.sessionId !== session.id) return { ok: false, statusCode: 403, reason: 'room-session-mismatch' };
  const actor = session.actors[request.seatId]; if (!actor || !actor.active) return { ok: false, statusCode: 404, reason: 'active-seat-not-found' };
  if (requireAdapter && actor.controllerType !== 'adapter') return { ok: false, statusCode: 403, reason: 'adapter-seat-required' };
  if (requireAdapter && actor.adapterConsent !== true) return { ok: false, statusCode: 403, reason: 'adapter-consent-revoked' };
  if (!tokensEqual(request.token, session.seatTokens[request.seatId])) return { ok: false, statusCode: 403, reason: 'seat-token-rejected' };
  const observation = buildSeatObservation(session, request.seatId, { ...context, width: request.width, height: request.height });
  const forbidden = findForbidden(observation);
  if (forbidden.length) return { ok: false, statusCode: 500, reason: 'observation-boundary-failed', forbidden };
  return observation;
}

module.exports = { buildSeatObservation, cameraFor, findForbidden, getBoundObservation, pointVisible, scrub };
