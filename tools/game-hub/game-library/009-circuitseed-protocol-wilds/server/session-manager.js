'use strict';

const crypto = require('node:crypto');
const { FIELD_OPERATOR_LIMIT, MAX_SEATS, RECONNECT_WINDOW_MS, ROOM_CODE } = require('../shared/constants');
const { validatePartyLayout } = require('../shared/validation');
const { SessionLedger } = require('./ledger');

function randomId(prefix, bytes = 12) { return prefix + '-' + crypto.randomBytes(bytes).toString('hex'); }
function activeCircuitkin(profile) {
  const selected = profile.activeCircuitkinId && profile.circuitkinRoster.find(kin => kin.designId === profile.activeCircuitkinId);
  return selected?.designId || profile.circuitkinRoster[0]?.designId || null;
}
function publicActor(actor) {
  return {
    id: actor.id, seatId: actor.seatId, slot: actor.slot, displayName: actor.displayName,
    controllerType: actor.controllerType, adapterId: actor.adapterId, profileId: actor.profileId,
    role: actor.role, active: actor.active, connected: actor.connected,
    position: { ...actor.position }, facing: { ...actor.facing }, integrity: actor.integrity,
    maxIntegrity: actor.maxIntegrity, energy: actor.energy, currentRegionId: actor.currentRegionId,
    circuitkinId: actor.circuitkinId || null, safeExtraction: actor.safeExtraction === true
  };
}

function normalizePlayers(raw) {
  const records = (Array.isArray(raw) ? raw : []).filter(record => record && record.ready !== false && record.type !== 'spectator');
  const normalized = records.map((record, index) => {
    const slot = Number(record.slot || String(record.seat_id || record.seatId || '').replace(/\D/g, '')) || index + 1;
    return {
      seat_id: record.seat_id || record.seatId || 'seat_' + slot,
      slot, type: record.type || record.controllerType || 'human',
      display_name: String(record.display_name || record.displayName || ('Pathfinder ' + slot)).slice(0, 48),
      adapter_id: record.adapter_id || record.adapterId || null,
      profile_id: record.profile_id || record.profileId || null
    };
  });
  const validation = validatePartyLayout(normalized);
  if (!validation.ok) { const error = new Error(validation.errors.join(',')); error.code = 'INVALID_PARTY'; throw error; }
  return normalized.sort((a, b) => a.slot - b.slot);
}

class SessionManager {
  constructor(options) {
    this.profileStore = options.profileStore; this.worldStore = options.worldStore;
    this.ledgerRoot = options.ledgerRoot; this.worldBones = options.worldBones;
    this.current = null;
  }
  ensureProfile(player, selectedProfileId) {
    const requested = selectedProfileId || player.profile_id;
    if (requested) {
      const existing = this.profileStore.get(requested);
      if (existing) return existing;
    }
    const stableId = 'local-' + String(player.type) + '-seat-' + player.slot;
    const existing = this.profileStore.get(stableId);
    return existing || this.profileStore.create({
      profileId: stableId, displayName: player.display_name, identityType: player.type,
      operatingEngine: player.type === 'human' ? null : (player.adapter_id || 'game-local-host-ai')
    });
  }
  createSession(input = {}) {
    if (this.current && this.current.status === 'running') throw new Error('session-already-running');
    const players = normalizePlayers(input.players);
    const world = this.worldStore.getOrCreate(input.worldId || 'local-world', input.seed || null);
    const id = randomId('session');
    const session = {
      schema: 'axm.circuitseed-party-session/v1', id, roomCode: ROOM_CODE, status: 'running', createdAt: Date.now(),
      hostToken: randomId('host'), worldId: world.worldId, worldRuntime: JSON.parse(JSON.stringify(world)),
      actors: {}, seatTokens: {}, reconnect: {}, encounter: null, events: [], tick: 0,
      rules: { defaultAiFill: false, emptySeatsRemainEmpty: true, hostAuthority: true, maxSeats: MAX_SEATS },
      ledger: new SessionLedger(this.ledgerRoot, id)
    };
    players.forEach((player, index) => {
      const profile = this.ensureProfile(player, input.profileSelections && input.profileSelections[player.seat_id]);
      const token = randomId('seat');
      const role = index < FIELD_OPERATOR_LIMIT ? 'field-operator' : ['support-console','scan','item','vote'][index - FIELD_OPERATOR_LIMIT] || 'round-rotation';
      session.seatTokens[player.seat_id] = token;
      session.actors[player.seat_id] = {
        id: 'actor-' + player.seat_id, seatId: player.seat_id, slot: player.slot, displayName: profile.displayName,
        controllerType: player.type, adapterId: player.adapter_id, profileId: profile.profileId, role,
        occupied: true, active: true, connected: player.type === 'ai', adapterConsent: player.type === 'adapter',
        position: { x: 330 + (index % 4) * 28, y: 360 + Math.floor(index / 4) * 30 }, facing: { x: 0, y: 1 },
        integrity: 100, maxIntegrity: 100, energy: 100, currentRegionId: 'lumen-yard',
        input: {}, inputHeld: {}, pendingPulses: {}, pendingTacticalAction: null, inputSequence: -1,
        lastInputAt: 0, rateWindow: [], circuitkinId: activeCircuitkin(profile),
        safeExtraction: profile.permissions.safeExtraction === true, lastCheckpoint: { ...profile.lastSafeCheckpoint }, sessionStats: { distance: 0, scans: 0, assists: 0, recoveries: 0 }
      };
    });
    session.ledger.append('session-start', { participants: Object.values(session.actors).map(publicActor), profileVersions: Object.values(session.actors).map(actor => ({ profileId: actor.profileId, version: this.profileStore.get(actor.profileId).version })) });
    this.current = session;
    return this.launchResponse(true);
  }
  launchResponse(includeSecrets = false) {
    const session = this.current; if (!session) return { ok: true, status: 'waiting' };
    const actors = Object.values(session.actors).map(publicActor);
    const response = { ok: true, status: session.status, roomCode: session.roomCode, sessionId: session.id, worldId: session.worldId, players: actors, roles: actors.map(actor => ({ seatId: actor.seatId, role: actor.role })), defaultAiFill: false };
    if (includeSecrets) {
      response.hostToken = session.hostToken;
      response.bindings = actors.map(actor => ({
        seatId: actor.seatId, token: session.seatTokens[actor.seatId], controllerType: actor.controllerType,
        protocol: 'axm-semantic-input-v1', observation: 'axm-seat-screen-semantics-v1',
        inputEndpoint: '/api/input', observationEndpoint: '/api/adapter-observation', profile: '/data/control-profile.json'
      }));
    }
    return response;
  }
  getRunning() { return this.current && this.current.status === 'running' ? this.current : null; }
  dropIn(input) {
    const session = this.getRunning(); if (!session) throw new Error('session-not-running');
    const used = new Set(Object.values(session.actors).filter(actor => actor.occupied).map(actor => actor.slot));
    const slot = Number(input.slot) || Array.from({ length: MAX_SEATS }, (_, i) => i + 1).find(value => !used.has(value));
    if (!slot || used.has(slot) || slot < 1 || slot > MAX_SEATS) throw new Error('seat-unavailable');
    const player = normalizePlayers([{ slot, seat_id: 'seat_' + slot, type: input.type || 'human', display_name: input.displayName || 'Guest ' + slot, adapter_id: input.adapterId || null }])[0];
    const profile = this.ensureProfile(player, input.profileId);
    const index = Object.values(session.actors).filter(actor => actor.active).length;
    const token = randomId('seat');
    const actor = {
      id: 'actor-' + player.seat_id, seatId: player.seat_id, slot, displayName: profile.displayName, controllerType: player.type,
      adapterId: player.adapter_id, profileId: profile.profileId, role: index < FIELD_OPERATOR_LIMIT ? 'field-operator' : ['support-console','scan','item','vote'][index - FIELD_OPERATOR_LIMIT] || 'round-rotation',
      occupied: true, active: true, connected: player.type === 'ai', adapterConsent: player.type === 'adapter',
      position: { x: profile.lastSafeCheckpoint.x, y: profile.lastSafeCheckpoint.y }, facing: { x: 0, y: 1 }, integrity: 100, maxIntegrity: 100, energy: 100,
      currentRegionId: profile.lastSafeCheckpoint.regionId, input: {}, inputHeld: {}, pendingPulses: {}, pendingTacticalAction: null,
      inputSequence: -1, lastInputAt: 0, rateWindow: [], circuitkinId: activeCircuitkin(profile),
      safeExtraction: profile.permissions.safeExtraction === true, lastCheckpoint: { ...profile.lastSafeCheckpoint }, sessionStats: { distance: 0, scans: 0, assists: 0, recoveries: 0 }
    };
    session.actors[actor.seatId] = actor; session.seatTokens[actor.seatId] = token;
    session.ledger.append('drop-in', { actor: publicActor(actor) }, { actorId: actor.id });
    return { ok: true, actor: publicActor(actor), binding: { seatId: actor.seatId, token, protocol: 'axm-semantic-input-v1' } };
  }
  dropOut(seatId, reason = 'voluntary') {
    const session = this.getRunning(); const actor = session && session.actors[seatId];
    if (!actor || !actor.active) throw new Error('active-seat-not-found');
    actor.active = false; actor.connected = false; actor.input = {}; actor.pendingPulses = {}; actor.pendingTacticalAction = null;
    const profile = this.profileStore.mutate(actor.profileId, value => {
      value.lastSafeCheckpoint = { regionId: actor.currentRegionId, x: actor.position.x, y: actor.position.y, storyStage: session.worldRuntime.story.stageIndex, recordedAt: new Date().toISOString() };
      value.history.push({ type: 'disconnect', reason, at: new Date().toISOString(), earnedProgressPreserved: true });
    });
    if (actor.safeExtraction) { actor.position = { x: profile.lastSafeCheckpoint.x, y: profile.lastSafeCheckpoint.y }; actor.state = 'safely-extracted'; }
    session.reconnect[seatId] = { until: Date.now() + RECONNECT_WINDOW_MS, profileId: actor.profileId };
    session.ledger.append('disconnect', { seatId, reason, checkpoint: profile.lastSafeCheckpoint, controlTransferred: false, rewardsPreserved: true }, { actorId: actor.id });
    return { ok: true, seatId, reconnectUntil: session.reconnect[seatId].until, controlTransferred: false, replacementCreated: false };
  }
  reconnect(input) {
    const session = this.getRunning(); const actor = session && session.actors[input.seatId]; const window = session && session.reconnect[input.seatId];
    if (!actor || !window || window.until < Date.now()) throw new Error('reconnect-window-unavailable');
    if (session.seatTokens[input.seatId] !== input.token || actor.profileId !== input.profileId) throw new Error('reconnect-binding-rejected');
    actor.active = true; actor.connected = actor.controllerType === 'ai'; actor.state = 'active'; actor.inputSequence = -1;
    delete session.reconnect[input.seatId];
    session.ledger.append('reconnect', { seatId: actor.seatId, profileId: actor.profileId, restored: true }, { actorId: actor.id });
    return { ok: true, actor: publicActor(actor), nextSequenceMinimum: 0 };
  }
  end(summary = {}) {
    const session = this.current; if (!session) throw new Error('session-not-found');
    session.status = 'ended';
    const result = { schema: 'axm.circuitseed-result/v1', sessionId: session.id, gameId: '009-circuitseed-protocol-wilds', endedAt: new Date().toISOString(), participants: Object.values(session.actors).map(publicActor), summary };
    session.ledger.append('session-end', result);
    return { ...result, ledger: session.ledger.validate() };
  }
}

module.exports = { SessionManager, activeCircuitkin, normalizePlayers, publicActor, randomId };
