#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { GAME_ID, ROOM_CODE, TICK_RATE } = require('../shared/constants');
const protocol = require('../shared/protocol');
const { CircuitkinSystem } = require('./circuitkin-system');
const { EconomySystem } = require('./economy-system');
const { EncounterSystem } = require('./encounter-system');
const { revokeAdapterConsent, routeInput, tokensEqual } = require('./input-gate');
const { MissionSystem } = require('./mission-system');
const { buildSeatObservation, getBoundObservation } = require('./observation');
const { ProfileStore } = require('./profile-store');
const { RequestSystem } = require('./request-system');
const { SessionManager } = require('./session-manager');
const { WorldStore } = require('./world-store');
const { WorldSystem } = require('./world-system');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const DATA_ROOT = path.resolve(process.env.AXM_CIRCUITSEED_DATA_ROOT || path.join(ROOT, 'local-data'));
const worldBones = require('../data/world.json');
const circuitkinData = require('../data/circuitkin.json');
const missionData = require('../data/missions.json');
const economyData = require('../data/recipes.json');
const modifiers = require('../data/expedition-modifiers.json');
const controlProfile = require('../data/control-profile.json');
const loreData = require('../data/lore.json');
const requestData = require('../data/field-requests.json');
const itemData = require('../data/items.json');
const loreById = new Map(loreData.entries.map(entry => [entry.id, entry]));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.wav':'audio/wav' };

function parseHubPlayers() {
  try {
    const value = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]');
    if (Array.isArray(value) && value.length) return value;
  } catch (error) {}
  return [{ seat_id: 'seat_1', slot: 1, type: 'human', display_name: 'Local Pathfinder', ready: true }];
}

function createRuntime(options = {}) {
  const dataRoot = path.resolve(options.dataRoot || DATA_ROOT);
  const profileStore = new ProfileStore(path.join(dataRoot, 'profiles'));
  const worldStore = new WorldStore(path.join(dataRoot, 'worlds'));
  const sessionManager = new SessionManager({ profileStore, worldStore, ledgerRoot: path.join(dataRoot, 'ledgers'), worldBones });
  const circuitkinSystem = new CircuitkinSystem(circuitkinData, profileStore);
  const encounterSystem = new EncounterSystem(circuitkinSystem, profileStore);
  const economySystem = new EconomySystem(economyData, profileStore, worldStore);
  const missionSystem = new MissionSystem(missionData, profileStore, worldStore);
  const requestSystem = new RequestSystem(requestData, profileStore);
  const worldSystem = new WorldSystem(worldBones);
  return { dataRoot, profileStore, worldStore, sessionManager, circuitkinSystem, encounterSystem, economySystem, missionSystem, requestSystem, worldSystem, hubPlayers: options.hubPlayers || parseHubPlayers() };
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(value));
}
function notifyGameHubResult(result) {
  const configured = process.env.AXM_GAME_HUB_CALLBACK_URL;
  if (!configured || process.env.AXM_MANAGED_BY_GAME_HUB !== '1') return;
  let endpoint;
  try { endpoint = new URL('/game/end', configured); } catch (error) { return; }
  if (!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)) return;
  const payload = JSON.stringify({ summary: { source: GAME_ID, result } });
  const request = http.request(endpoint, {
    method: 'POST', timeout: 1200,
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
  }, response => response.resume());
  request.on('timeout', () => request.destroy());
  request.on('error', () => {});
  request.end(payload);
}
function sendFile(res, file) {
  const resolved = path.resolve(file); const allowed = [CLIENT, path.join(ROOT, 'data')].some(root => resolved === root || resolved.startsWith(root + path.sep));
  if (!allowed) return sendJson(res, 403, { ok: false, error: 'static-path-refused' });
  fs.readFile(resolved, (error, bytes) => {
    if (error) return sendJson(res, 404, { ok: false, error: 'not-found' });
    res.writeHead(200, { 'content-type': MIME[path.extname(resolved)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' }); res.end(bytes);
  });
}
function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > limit) req.destroy(new Error('request-body-too-large')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(new Error('invalid-json')); } });
    req.on('error', reject);
  });
}
function bearer(req) { return String(req.headers['x-axm-seat-token'] || req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }
function authActor(runtime, body) {
  const session = runtime.sessionManager.getRunning(); if (!session || body.sessionId !== session.id || body.roomCode !== session.roomCode) throw Object.assign(new Error('room-session-mismatch'), { statusCode: 403 });
  const actor = session.actors[body.seatId]; if (!actor || !actor.active) throw Object.assign(new Error('active-seat-not-found'), { statusCode: 404 });
  if (!tokensEqual(body.token, session.seatTokens[body.seatId])) throw Object.assign(new Error('seat-token-rejected'), { statusCode: 403 });
  return { session, actor };
}

function recordDiscovery(runtime, session, actor, point) {
  const profile = runtime.profileStore.get(actor.profileId);
  if (profile.discoveries.some(item => (item.id || item) === point.id)) return profile;
  const lore = point.loreId ? loreById.get(point.loreId) : null;
  const next = runtime.profileStore.mutate(actor.profileId, draft => {
    draft.discoveries.push({ id: point.id, kind: point.kind, regionId: point.regionId, uncertainty: point.kind === 'hidden-route' ? 'declared-uncertain' : 'observed', at: new Date().toISOString() });
    if (lore?.artifactId) draft.inventory.items[lore.artifactId] = (draft.inventory.items[lore.artifactId] || 0) + 1;
    if (lore?.unlocksRecipe && !draft.recipes.includes(lore.unlocksRecipe)) draft.recipes.push(lore.unlocksRecipe);
    draft.history.push({ type: 'discovery', pointId: point.id, at: new Date().toISOString() });
    if (lore) draft.history.push({ type: 'memory-echo-recovered', loreId: lore.id, artifactId: lore.artifactId, recipe: lore.unlocksRecipe || null, at: new Date().toISOString() });
  });
  session.ledger.append('discovery', { profileId: actor.profileId, pointId: point.id, loreId: lore?.id || null, artifactId: lore?.artifactId || null, profileVersion: next.version }, { actorId: actor.id, dedupeKey: 'discovery:' + actor.profileId + ':' + point.id });
  return next;
}

function persistWorldRuntime(runtime, session, mutator) {
  const current = runtime.worldStore.get(session.worldId); const draft = JSON.parse(JSON.stringify(current)); mutator(draft);
  const next = runtime.worldStore.save(draft, current.version); session.worldRuntime = JSON.parse(JSON.stringify(next)); return next;
}

function advanceMissionIfComplete(runtime, session) {
  const progress = session.missionProgress;
  if (!progress || !progress.completed) return null;
  const envelope = runtime.missionSystem.createEnvelope(session);
  const committed = runtime.missionSystem.commitEnvelope(session, envelope);
  session.events.push({ type: 'mission-complete', missionId: committed.missionId, commits: committed.commits });
  runtime.missionSystem.ensureProgress(session);
  return committed;
}

function recordMission(runtime, session, key, count = 1) {
  const result = runtime.missionSystem.record(session, key, count);
  const envelope = result.complete ? advanceMissionIfComplete(runtime, session) : null;
  return { ...result, envelope };
}

function recordKinUse(runtime, actor, action, outcome = {}) {
  const profile = runtime.profileStore.get(actor.profileId); const designId = actor.circuitkinId || profile.circuitkinRoster[0]?.designId;
  if (!designId) return null;
  try { return runtime.circuitkinSystem.recordUse(actor.profileId, designId, action, outcome); } catch (error) { return null; }
}

function processPulses(runtime, session, actor) {
  const pulses = runtime.worldSystem.consumeWorldPulses(actor);
  if (actor.sessionStats.distance > 5 && runtime.missionSystem.current(session)?.id === 'm01-first-light' && !(session.missionProgress?.counts?.move)) recordMission(runtime, session, 'move');
  if (pulses.scan) {
    const point = runtime.worldSystem.nearbyPoint(actor);
    if (point) {
      const before = runtime.profileStore.get(actor.profileId);
      const wasKnown = before.discoveries.some(item => (item.id || item) === point.id);
      recordDiscovery(runtime, session, actor, point); actor.sessionStats.scans += 1;
      recordMission(runtime, session, 'scan:' + point.id); recordKinUse(runtime, actor, 'Scan', { uncertaintyAccepted: point.kind === 'hidden-route' });
      session.events.push({ type: 'scan', seatId: actor.seatId, pointId: point.id });
      if (!wasKnown && point.loreId) session.events.push({ type: 'memory-echo-discovered', seatId: actor.seatId, pointId: point.id, loreId: point.loreId });
    } else session.events.push({ type: 'scan', seatId: actor.seatId, result: 'no-readable-target' });
  }
  if (pulses.interact) {
    const resource = runtime.worldSystem.collectResource(session, actor);
    if (resource) {
      const profile = runtime.profileStore.mutate(actor.profileId, draft => { draft.inventory.materials[resource.material] = (draft.inventory.materials[resource.material] || 0) + 1; draft.history.push({ type: 'material-recovered', material: resource.material, nodeId: resource.id, at: new Date().toISOString() }); });
      persistWorldRuntime(runtime, session, draft => { draft.resourcesRecovered[resource.id] = { profileId: actor.profileId, at: new Date().toISOString() }; });
      session.ledger.append('item-gain', { profileId: actor.profileId, material: resource.material, count: 1, profileVersion: profile.version }, { actorId: actor.id, dedupeKey: 'resource:' + resource.id });
      recordMission(runtime, session, 'collect:' + resource.material);
    } else {
      const point = runtime.worldSystem.nearbyPoint(actor);
      if (point) {
        if (point.id === 'route-beacon') recordMission(runtime, session, 'interact:route-beacon');
        if (point.id === 'corewild-breach' && !session.encounter) runtime.encounterSystem.start(session, 'corewild-breach');
        if (point.id === 'rootsignal-gate' && !session.encounter) runtime.encounterSystem.start(session, 'rootsignal-fracture');
        session.events.push({ type: 'interact', seatId: actor.seatId, pointId: point.id });
      }
    }
  }
  if (pulses.connect) {
    const point = runtime.worldSystem.nearbyPoint(actor);
    if (point) {
      const before = runtime.profileStore.get(actor.profileId);
      const discovered = before.discoveries.some(item => (item.id || item) === point.id);
      if (point.circuitkinDesignId && !before.circuitkinRoster.length) {
        session.events.push({ type: 'connection-paused', seatId: actor.seatId, pointId: point.id, reason: 'starter-relationship-needed-first' });
      } else if (point.circuitkinDesignId && !discovered) {
        session.events.push({ type: 'connection-paused', seatId: actor.seatId, pointId: point.id, reason: 'scan-unfinished-need-first' });
      } else if (point.circuitkinDesignId) {
        const alreadyConnected = before.circuitkinRoster.some(kin => kin.designId === point.circuitkinDesignId);
        const profile = runtime.circuitkinSystem.recruit(actor.profileId, point.circuitkinDesignId, { kind: 'unfinished-need', pointId: point.id, regionId: point.regionId });
        if (!alreadyConnected) {
          session.ledger.append('circuitkin-connected', { profileId: actor.profileId, designId: point.circuitkinDesignId, pointId: point.id, profileVersion: profile.version, method: 'scan-repair-trust-consent' }, { actorId: actor.id, dedupeKey: 'field-connect:' + actor.profileId + ':' + point.circuitkinDesignId });
          session.events.push({ type: 'circuitkin-connected', seatId: actor.seatId, pointId: point.id, designId: point.circuitkinDesignId, method: 'repair-trust-consent' });
        } else session.events.push({ type: 'connect', seatId: actor.seatId, pointId: point.id, result: 'relationship-already-active' });
      } else {
        recordDiscovery(runtime, session, actor, point);
        session.events.push({ type: 'connect', seatId: actor.seatId, pointId: point.id, method: 'trust-or-unfinished-need' });
      }
    }
  }
  if (pulses.assist) { actor.sessionStats.assists += 1; recordKinUse(runtime, actor, 'Synchronize', { trustDelta: 0.7 }); session.events.push({ type: 'assist', seatId: actor.seatId }); }
  if (pulses.recover) {
    actor.sessionStats.recoveries += 1; recordKinUse(runtime, actor, 'Patch', { recovered: true, diagnosed: true, trustDelta: 0.8 });
    if (session.encounter?.status === 'recovery-required') runtime.encounterSystem.recover(session);
  }
  if (pulses.deploy) session.events.push({ type: 'deploy', seatId: actor.seatId, result: 'field-anchor-readied' });
  if (pulses.build) session.events.push({ type: 'build-request', seatId: actor.seatId, location: actor.currentRegionId });
  if (pulses.return) {
    actor.position = { x: worldBones.spawn.x, y: worldBones.spawn.y }; actor.currentRegionId = 'lumen-yard';
    recordMission(runtime, session, 'return:settlement');
    runtime.profileStore.mutate(actor.profileId, draft => { draft.lastSafeCheckpoint = { regionId: 'lumen-yard', x: worldBones.spawn.x, y: worldBones.spawn.y, storyStage: session.worldRuntime.story.stageIndex, recordedAt: new Date().toISOString() }; });
  }
  if (actor.pendingTacticalAction) {
    const pending = actor.pendingTacticalAction; actor.pendingTacticalAction = null;
    if (session.encounter?.status === 'running') {
      const encounter = runtime.encounterSystem.apply(session, actor.seatId, pending.action);
      const partner = pending.action === 'Synchronize' ? Object.values(session.actors).find(item => item.active && item.seatId !== actor.seatId && item.circuitkinId) : null;
      recordKinUse(runtime, actor, pending.action, { recovered: pending.action === 'Patch', diagnosed: pending.action === 'Scan', conflictSurfaced: pending.action === 'Challenge', pairedWith: partner?.circuitkinId || null });
      if (encounter.status === 'resolved') {
        recordMission(runtime, session, 'encounter:' + encounter.id);
        if (encounter.id === 'corewild-breach') {
          const profile = runtime.profileStore.get(actor.profileId);
          if (!profile.circuitkinRoster.some(item => item.designId === 'aegis')) {
            const connected = runtime.circuitkinSystem.recruit(actor.profileId, 'aegis', { kind: 'help', encounter: encounter.id });
            session.ledger.append('circuitkin-connected', { profileId: actor.profileId, designId: 'aegis', encounterId: encounter.id, profileVersion: connected.version, method: 'protective-help-and-consent' }, { actorId: actor.id, dedupeKey: 'encounter-connect:' + actor.profileId + ':aegis' });
            session.events.push({ type: 'circuitkin-connected', seatId: actor.seatId, designId: 'aegis', encounterId: encounter.id, method: 'protective-help-and-consent' });
          }
        }
      }
    }
  }
}

function staticRoute(pathname) {
  if (pathname === '/' || pathname === '/games/009' || pathname === '/games/009/' || pathname === '/index.html') return path.join(CLIENT, 'index.html');
  if (pathname === '/app.js') return path.join(CLIENT, 'app.js');
  if (pathname === '/styles.css') return path.join(CLIENT, 'styles.css');
  if (pathname === '/audio.js') return path.join(CLIENT, 'audio.js');
  if (pathname === '/controller' || pathname === '/controller/') return path.join(CLIENT, 'controller', 'index.html');
  if (pathname === '/controller/controller.js') return path.join(CLIENT, 'controller', 'controller.js');
  if (pathname === '/controller/controller.css') return path.join(CLIENT, 'controller', 'controller.css');
  if (pathname === '/party' || pathname === '/party/' || pathname === '/games/009/party' || pathname === '/games/009/party/') return path.join(CLIENT, 'party', 'index.html');
  if (pathname === '/party/party.js') return path.join(CLIENT, 'party', 'party.js');
  if (pathname === '/party/party.css') return path.join(CLIENT, 'party', 'party.css');
  if (pathname === '/data/control-profile.json') return path.join(ROOT, 'data', 'control-profile.json');
  return null;
}

function createHttpServer(runtime = createRuntime()) {
  let loop = null; let lastTick = Date.now();
  function startLoop() {
    if (loop) return;
    lastTick = Date.now();
    loop = setInterval(() => {
      const session = runtime.sessionManager.getRunning(); const now = Date.now(); const delta = Math.min(0.1, (now - lastTick) / 1000); lastTick = now;
      if (!session) return;
      runtime.worldSystem.tick(session, now, delta);
      for (const actor of Object.values(session.actors)) if (actor.active) processPulses(runtime, session, actor);
      if (session.events.length > 120) session.events.splice(0, session.events.length - 120);
    }, Math.round(1000 / TICK_RATE));
    loop.unref?.();
  }
  function stopLoop() { if (loop) clearInterval(loop); loop = null; }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1'); const pathname = url.pathname;
      if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
      if (req.method === 'GET' && pathname === '/health') return sendJson(res, 200, { ok: true, gameId: GAME_ID, status: 'ALPHA CANDIDATE / WORKING', localOnly: true, runtimeInternetRequired: false, port: Number(process.env.PORT || 8799), sessionStatus: runtime.sessionManager.current?.status || 'waiting', maxSeats: 8, defaultAiFill: false, circuitkinRoster: circuitkinData.rosterModel, dataSchemas: { profile: 'axm.circuitseed-router-profile/v1', world: 'axm.circuitseed-world-save/v1', ledger: 'axm.circuitseed-session-ledger/v1' } });
      if (req.method === 'GET' && pathname === '/api/bootstrap') return sendJson(res, 200, { ok: true, game: { id: GAME_ID, title: 'CIRCUITSEED', subtitle: 'THE PROTOCOL WILDS', descriptor: 'A local-first agent-world adventure', status: 'ALPHA CANDIDATE / WORKING', localOnly: true, managedByGameHub: process.env.AXM_MANAGED_BY_GAME_HUB === '1' }, hubPlayers: runtime.hubPlayers.map(({ seat_id, seatId, slot, type, display_name, displayName, adapter_id, adapterId }) => ({ seatId: seat_id || seatId, slot, type, displayName: display_name || displayName, adapterId: adapter_id || adapterId || null })), profiles: runtime.profileStore.list(), worlds: runtime.worldStore.list(), circuitkin: circuitkinData.designs, circuitkinRosterModel: circuitkinData.rosterModel, missions: missionData.stages.map(item => ({ id: item.id, kind: item.kind, title: item.title })), missionDetails: missionData.stages, modifiers: modifiers.modifiers, economy: economyData, fieldRequests: { title: requestData.boardTitle, total: requestData.requests.length }, memoryArchive: { title: loreData.archiveTitle, total: loreData.entries.length, entries: loreData.entries.map(({ text, ...entry }) => entry) }, itemCatalog: itemData.items, worldMap: { size: worldBones.size, regions: worldBones.regions, paths: worldBones.paths }, controls: controlProfile, currentSession: runtime.sessionManager.current ? runtime.sessionManager.launchResponse(false) : null });
      if (req.method === 'GET' && pathname === '/api/profiles') return sendJson(res, 200, { ok: true, profiles: runtime.profileStore.list() });
      if (req.method === 'POST' && pathname === '/api/profile/create') { const body = await readBody(req); return sendJson(res, 201, { ok: true, profile: runtime.profileStore.create(body) }); }
      if (req.method === 'POST' && pathname === '/api/profile/import') { const body = await readBody(req); const result = runtime.profileStore.import(body); return sendJson(res, result.ok ? 200 : 409, result); }
      if (req.method === 'GET' && pathname === '/api/profile/export') return sendJson(res, 200, { ok: true, packet: runtime.profileStore.export(url.searchParams.get('profile')) });

      if (req.method === 'POST' && pathname === '/api/session/start') {
        const body = await readBody(req);
        const requestedPlayers = Array.isArray(body.players) && body.players.length
          ? body.players
          : runtime.hubPlayers.length
            ? runtime.hubPlayers
            : [{ seat_id: 'seat_1', slot: 1, type: 'human', display_name: 'Local Pathfinder', ready: true }];
        const response = runtime.sessionManager.createSession({ players: requestedPlayers, worldId: body.worldId || 'local-world', seed: body.seed, profileSelections: body.profileSelections || {} });
        runtime.missionSystem.ensureProgress(runtime.sessionManager.getRunning()); startLoop(); return sendJson(res, 201, response);
      }
      if (req.method === 'POST' && pathname === '/api/session/join') { const body = await readBody(req); const session = runtime.sessionManager.getRunning(); if (!session || !tokensEqual(body.hostToken, session.hostToken)) return sendJson(res, 403, { ok: false, error: 'host-token-rejected' }); return sendJson(res, 201, runtime.sessionManager.dropIn(body)); }
      if (req.method === 'POST' && pathname === '/api/session/leave') { const body = await readBody(req); const { actor } = authActor(runtime, body); return sendJson(res, 200, runtime.sessionManager.dropOut(actor.seatId, body.reason || 'voluntary')); }
      if (req.method === 'POST' && pathname === '/api/session/reconnect') { const body = await readBody(req); return sendJson(res, 200, runtime.sessionManager.reconnect(body)); }
      if (req.method === 'POST' && pathname === '/api/session/end') {
        const body = await readBody(req); const session = runtime.sessionManager.current;
        if (!session || !tokensEqual(body.hostToken, session.hostToken)) return sendJson(res, 403, { ok: false, error: 'host-token-rejected' });
        const result = runtime.sessionManager.end(body.summary); stopLoop();
        sendJson(res, 200, { ok: true, result, returningToGameHub: body.summary?.returnToLobby === true && process.env.AXM_MANAGED_BY_GAME_HUB === '1' });
        if (body.summary?.returnToLobby === true) { const timer = setTimeout(() => notifyGameHubResult(result), 30); timer.unref?.(); }
        return;
      }

      if (req.method === 'POST' && pathname === '/api/input') { const body = await readBody(req); const result = routeInput(runtime.sessionManager.getRunning(), body); return sendJson(res, result.statusCode || (result.ok ? 200 : 400), result); }
      if (req.method === 'GET' && pathname === '/api/state') { const session = runtime.sessionManager.getRunning(); const request = { roomCode: url.searchParams.get('room'), sessionId: url.searchParams.get('session'), seatId: url.searchParams.get('seat'), token: bearer(req) || url.searchParams.get('token'), width: url.searchParams.get('width'), height: url.searchParams.get('height') }; const result = getBoundObservation(session, request, { profileStore: runtime.profileStore, worldBones, missionSystem: runtime.missionSystem, encounterSystem: runtime.encounterSystem, economySystem: runtime.economySystem, circuitkinSystem: runtime.circuitkinSystem, requestSystem: runtime.requestSystem, loreData }); return sendJson(res, result.statusCode || (result.ok ? 200 : 400), result); }
      if (req.method === 'GET' && pathname === '/api/adapter-observation') { const session = runtime.sessionManager.getRunning(); const request = { roomCode: url.searchParams.get('room'), sessionId: url.searchParams.get('session'), seatId: url.searchParams.get('seat'), token: bearer(req), width: url.searchParams.get('width'), height: url.searchParams.get('height') }; const result = getBoundObservation(session, request, { profileStore: runtime.profileStore, worldBones, missionSystem: runtime.missionSystem, encounterSystem: runtime.encounterSystem, economySystem: runtime.economySystem, circuitkinSystem: runtime.circuitkinSystem, requestSystem: runtime.requestSystem, loreData }, true); return sendJson(res, result.statusCode || (result.ok ? 200 : 400), result); }
      if (req.method === 'GET' && pathname === '/api/party-state') { const session = runtime.sessionManager.getRunning(); if (!session) return sendJson(res, 200, { ok: true, status: 'waiting' }); const actor = Object.values(session.actors).find(item => item.active); if (!actor) return sendJson(res, 200, { ok: true, status: 'empty' }); const observation = buildSeatObservation(session, actor.seatId, { profileStore: runtime.profileStore, worldBones, missionSystem: runtime.missionSystem, encounterSystem: runtime.encounterSystem, economySystem: runtime.economySystem, circuitkinSystem: runtime.circuitkinSystem, requestSystem: runtime.requestSystem, loreData, width: url.searchParams.get('width'), height: url.searchParams.get('height') }); delete observation.controls.nextSequenceMinimum; return sendJson(res, 200, observation); }

      if (req.method === 'POST' && pathname === '/api/starter') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); if (runtime.missionSystem.current(session)?.id !== 'm02-unfinished-need') throw new Error('starter-choice-not-active'); const currentProfile = runtime.profileStore.get(actor.profileId); const existing = currentProfile.circuitkinRoster[0]; if (existing && existing.designId !== body.choice) throw new Error('profile-already-bound-to-another-starter'); const profile = existing ? currentProfile : runtime.circuitkinSystem.recruitStarter(actor.profileId, body.choice, 'opening unfinished need repaired'); actor.circuitkinId = body.choice; const first = recordMission(runtime, session, 'choose-starter'); const second = recordMission(runtime, session, 'connect:starter'); session.ledger.append(existing ? 'circuitkin-reconnected' : 'circuitkin-connected', { profileId: actor.profileId, designId: body.choice, profileVersion: profile.version, method: existing ? 'returning-profile-trust' : 'repair-trust-consent' }, { actorId: actor.id }); return sendJson(res, 200, { ok: true, profile, returning: !!existing, mission: second.envelope || first.envelope || second }); }
      if (req.method === 'POST' && pathname === '/api/circuitkin/specialize') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const profile = runtime.circuitkinSystem.specialize(actor.profileId, body.designId, body.branchId); session.ledger.append('circuitkin-specialized', { profileId: actor.profileId, designId: body.designId, branchId: body.branchId, profileVersion: profile.version, explicitChoice: true }, { actorId: actor.id, dedupeKey: 'specialization:' + actor.profileId + ':' + body.designId }); return sendJson(res, 200, { ok: true, profile }); }
      if (req.method === 'POST' && pathname === '/api/circuitkin/evolve') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const profile = runtime.circuitkinSystem.evolve(actor.profileId, body.designId); const design = runtime.circuitkinSystem.design(body.designId); session.ledger.append('circuitkin-confluence-evolved', { profileId: actor.profileId, designId: body.designId, components: design.components, parentsPreserved: true, profileVersion: profile.version, explicitChoice: true }, { actorId: actor.id, dedupeKey: 'confluence:' + actor.profileId + ':' + body.designId }); session.events.push({ type: 'circuitkin-confluence-evolved', seatId: actor.seatId, designId: body.designId, components: design.components }); return sendJson(res, 200, { ok: true, profile, evolution: runtime.circuitkinSystem.confluenceEligibility(profile, body.designId) }); }
      if (req.method === 'POST' && pathname === '/api/circuitkin/active') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const profile = runtime.circuitkinSystem.selectActive(actor.profileId, body.designId); actor.circuitkinId = body.designId; session.ledger.append('active-circuitkin-selected', { profileId: actor.profileId, designId: body.designId, profileVersion: profile.version }, { actorId: actor.id }); return sendJson(res, 200, { ok: true, profile, actor: { seatId: actor.seatId, circuitkinId: actor.circuitkinId } }); }
      if (req.method === 'POST' && pathname === '/api/craft') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const profile = runtime.economySystem.craft(actor.profileId, body.recipeId); const mission = recordMission(runtime, session, 'craft:any'); session.ledger.append('craft', { profileId: actor.profileId, recipeId: body.recipeId, profileVersion: profile.version }, { actorId: actor.id }); return sendJson(res, 200, { ok: true, profile, mission }); }
      if (req.method === 'POST' && pathname === '/api/business/choose') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const profile = runtime.economySystem.chooseBusiness(actor.profileId, body.pathId); const mission = recordMission(runtime, session, 'business:choose'); return sendJson(res, 200, { ok: true, profile, mission }); }
      if (req.method === 'POST' && pathname === '/api/shop/state') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const profile = runtime.economySystem.setOpen(actor.profileId, body.open === true); const mission = body.open === true ? recordMission(runtime, session, 'shop:open') : null; session.ledger.append('shop-state', { profileId: actor.profileId, open: profile.business.open }, { actorId: actor.id }); return sendJson(res, 200, { ok: true, profile, mission, shops: runtime.economySystem.sessionShops(session) }); }
      if (req.method === 'POST' && pathname === '/api/shop/fulfill') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const result = runtime.economySystem.fulfill(actor.profileId, session.worldId, body.orderId); session.worldRuntime = JSON.parse(JSON.stringify(result.world)); const mission = recordMission(runtime, session, 'order:fulfill'); session.ledger.append('business-transaction', result.transaction, { actorId: actor.id, dedupeKey: 'order:' + actor.profileId + ':' + session.worldId + ':' + body.orderId }); return sendJson(res, 200, { ok: true, transaction: result.transaction, profile: result.profile, mission }); }
      if (req.method === 'POST' && pathname === '/api/field-request/claim') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const result = runtime.requestSystem.claim(actor.profileId, body.requestId); session.ledger.append('field-request-claimed', { profileId: actor.profileId, requestId: body.requestId, profileVersion: result.profile.version, rewards: result.request.rewards }, { actorId: actor.id, dedupeKey: 'field-request:' + actor.profileId + ':' + body.requestId }); session.events.push({ type: 'field-request-claimed', seatId: actor.seatId, requestId: body.requestId }); return sendJson(res, 200, { ok: true, ...result }); }
      if (req.method === 'POST' && pathname === '/api/dynamic/resolve') { const body = await readBody(req); const { session } = authActor(runtime, body); const result = runtime.missionSystem.resolveDynamic(session, body.action); const envelope = result.complete ? advanceMissionIfComplete(runtime, session) : null; return sendJson(res, 200, { ok: true, dynamic: runtime.missionSystem.dynamicMission(session), result, envelope }); }
      if (req.method === 'POST' && pathname === '/api/coop/synchronize') { const body = await readBody(req); const { session, actor } = authActor(runtime, body); const result = runtime.missionSystem.cooperativePulse(session, actor.seatId); const envelope = result.complete ? advanceMissionIfComplete(runtime, session) : null; return sendJson(res, 200, { ok: true, result, envelope }); }
      if (req.method === 'POST' && pathname === '/api/encounter/start') { const body = await readBody(req); const { session } = authActor(runtime, body); if (!['friendly-1v1','friendly-2v2'].includes(body.encounterId)) throw new Error('manual-encounter-only-friendly-simulation'); if (session.encounter?.status === 'running') throw new Error('encounter-already-running'); return sendJson(res, 201, { ok: true, encounter: runtime.encounterSystem.start(session, body.encounterId) }); }
      if (req.method === 'POST' && pathname === '/api/adapter/consent/revoke') { const body = await readBody(req); const session = runtime.sessionManager.getRunning(); if (!session || !tokensEqual(body.hostToken, session.hostToken)) return sendJson(res, 403, { ok: false, error: 'host-token-rejected' }); const result = revokeAdapterConsent(session, body.seatId); session.ledger.append('adapter-consent-revoked', result); return sendJson(res, result.ok ? 200 : 404, result); }
      if (req.method === 'GET' && pathname === '/api/result') { const session = runtime.sessionManager.current; return sendJson(res, 200, { ok: true, sessionStatus: session?.status || 'waiting', chapterComplete: (session?.worldRuntime?.story?.stageIndex || 0) >= missionData.stages.length, ledger: session?.ledger?.validate() || null, events: session?.events?.slice(-30) || [] }); }

      const file = staticRoute(pathname); if (req.method === 'GET' && file) return sendFile(res, file);
      return sendJson(res, 404, { ok: false, error: 'not-found', path: pathname });
    } catch (error) {
      return sendJson(res, error.statusCode || (String(error.message).includes('conflict') ? 409 : 400), { ok: false, error: error.message, code: error.code || null, missing: error.missing || null });
    }
  });
  server.on('close', stopLoop);
  return { server, runtime, startLoop, stopLoop };
}

if (require.main === module) {
  const host = process.env.HOST || process.env.AXM_CIRCUITSEED_HOST || '0.0.0.0'; const port = Number(process.env.PORT || 8799);
  const app = createHttpServer();
  app.server.listen(port, host, () => {
    console.log('CIRCUITSEED — THE PROTOCOL WILDS');
    console.log('ALPHA CANDIDATE / WORKING · local-only');
    console.log('Listening: http://' + host + ':' + port);
    console.log('Health: /health');
  });
  function shutdown() { app.server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 2500).unref(); }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}

module.exports = { authActor, createHttpServer, createRuntime, parseHubPlayers, processPulses, recordMission };
