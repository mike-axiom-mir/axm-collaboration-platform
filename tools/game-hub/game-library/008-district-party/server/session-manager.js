'use strict';

const crypto = require('node:crypto');
const { DEFAULT_ROOM } = require('../shared/constants');
const { mergeCombatRules } = require('../shared/party-rules');
const { isValidRoomCode } = require('../shared/validation');
const { createLaunchContract } = require('../foundation-adapter/launch-contract');
const { PlayerNormalizationError, normalizeSelectedPlayers } = require('../foundation-adapter/player-normalizer');
const { getDisplayState } = require('../foundation-adapter/display-router');
const { createWorldState } = require('./world-state');
const { RoomManager } = require('./room-manager');

function tokensEqual(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicPlayers(players) {
  return players.map(({ actorId, seatId, slot, displayName, controllerType, adapterId, partyId, connected, ready }) => ({
    actorId,
    seatId,
    slot,
    displayName,
    controllerType,
    adapterId,
    partyId,
    connected,
    ready,
  }));
}

function fillEmptyHostAiSeats(players, mode, enabled) {
  if (mode !== 'district_dominion' || enabled !== true) return players;
  const used = new Set(players.map((player) => player.slot));
  const generated = [];
  for (let slot = 1; slot <= 8; slot += 1) {
    if (used.has(slot)) continue;
    generated.push({
      slot,
      seatId: `seat_${slot}`,
      displayName: `Host AI ${slot}`,
      controllerType: 'ai',
      adapterId: `ai-optional-fill-${slot}`,
      ready: true,
      selectionOrder: players.length + generated.length + 1,
    });
  }
  return normalizeSelectedPlayers([...players, ...generated]);
}

function prepareActiveRoster(rawPlayers, settings = {}) {
  const mode = settings.mode === 'district_dominion' ? 'district_dominion' : 'coop_adventure';
  let players = normalizeSelectedPlayers(rawPlayers, { allowEmpty: true }).filter((player) => player.ready !== false);
  players = fillEmptyHostAiSeats(players, mode, settings.hostAiFillEmptySeats === true);
  if (!players.length) {
    throw new PlayerNormalizationError('At least one ready player is required.', 'NO_READY_PLAYERS');
  }
  if (mode === 'district_dominion') {
    const partyA = players.filter((player) => player.partyId === 'party_a').length;
    const partyB = players.filter((player) => player.partyId === 'party_b').length;
    if (partyA < 1 || partyB < 1) {
      throw new PlayerNormalizationError(
        'District Dominion needs at least one ready seat in Party A and one in Party B.',
        'INVALID_PARTY_ROSTER',
        { partyA, partyB },
      );
    }
  }
  return players;
}

class SessionManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot;
    this.roomManager = options.roomManager || new RoomManager();
    this.currentSession = null;
  }

  createSession({ players, roomCode = DEFAULT_ROOM, settings = {} }) {
    if (!isValidRoomCode(roomCode)) throw Object.assign(new Error('Invalid AXM room code.'), { code: 'INVALID_ROOM' });
    const normalizedPlayers = prepareActiveRoster(players, settings);
    const contract = createLaunchContract(normalizedPlayers, { roomCode });
    const session = {
      id: contract.sessionId,
      roomCode,
      hostToken: contract.hostToken,
      status: 'running',
      createdAt: Date.now(),
      endedAt: null,
      players: contract.players,
      seatTokens: contract.seatTokens,
      controllerLinks: contract.controllerLinks,
      adapterBindings: contract.adapterBindings,
      partyScreenLinks: contract.partyScreenLinks,
      persistentScreenLinks: contract.persistentScreenLinks,
      settings: JSON.parse(JSON.stringify(settings || {})),
      world: null,
    };
    session.world = createWorldState({ players: session.players, settings: session.settings, projectRoot: this.projectRoot });
    this.currentSession = session;
    this.roomManager.attachSession(roomCode, session.id);
    return this.launchResponse(session, true);
  }

  getSession(sessionId) {
    const session = this.currentSession;
    return session && session.id === sessionId ? session : null;
  }

  getRunningSession() {
    return this.currentSession?.status === 'running' ? this.currentSession : null;
  }

  assertHost(sessionId, hostToken) {
    const session = this.getSession(sessionId);
    if (!session) throw Object.assign(new Error('Session not found.'), { code: 'SESSION_NOT_FOUND' });
    if (!tokensEqual(hostToken, session.hostToken)) throw Object.assign(new Error('Host token rejected.'), { code: 'HOST_TOKEN_REJECTED' });
    return session;
  }

  restartSession(sessionId, hostToken) {
    const session = this.assertHost(sessionId, hostToken);
    session.world = createWorldState({ players: session.players, settings: session.settings, projectRoot: this.projectRoot });
    session.status = 'running';
    session.endedAt = null;
    this.roomManager.attachSession(session.roomCode, session.id);
    return this.launchResponse(session, true);
  }

  endSession(sessionId, hostToken) {
    const session = this.assertHost(sessionId, hostToken);
    session.status = 'ended';
    session.endedAt = Date.now();
    this.roomManager.clearSession(session.roomCode, session.id);
    return { ok: true, sessionId: session.id, roomCode: session.roomCode, status: 'ended' };
  }

  updateCombatRules(sessionId, hostToken, suppliedRules) {
    const session = this.assertHost(sessionId, hostToken);
    const patch = suppliedRules || {};
    session.world.combatRules = mergeCombatRules({
      ...session.world.combatRules,
      ...patch,
      partyFriendlyFire: {
        ...session.world.combatRules.partyFriendlyFire,
        ...(patch.partyFriendlyFire || {}),
      },
      channels: {
        ...session.world.combatRules.channels,
        ...(patch.channels || {}),
        allyKnockback: {
          ...session.world.combatRules.channels.allyKnockback,
          ...(patch.allyKnockback || patch.channels?.allyKnockback || {}),
        },
      },
    });
    session.settings.combat = JSON.parse(JSON.stringify(session.world.combatRules));
    return { ok: true, sessionId, combatRules: session.world.combatRules };
  }

  displayState(partyId) {
    return getDisplayState(this.getRunningSession(), partyId);
  }

  launchResponse(session, includeSecrets = false) {
    const players = publicPlayers(session.players).map((player) => ({
      ...player,
      connected: session.world?.actors?.[player.actorId]?.connected ?? player.connected,
    }));
    const response = {
      ok: true,
      roomCode: session.roomCode,
      sessionId: session.id,
      status: session.status,
      mode: session.settings?.mode || 'coop_adventure',
      players,
      controllerLinks: session.controllerLinks.map((link) => includeSecrets ? { ...link } : {
        seatId: link.seatId,
        slot: link.slot,
        displayName: link.displayName,
        partyId: link.partyId,
        path: null,
        url: null,
      }),
      adapterBindings: session.adapterBindings.map((binding) => includeSecrets ? { ...binding } : {
        seatId: binding.seatId,
        slot: binding.slot,
        displayName: binding.displayName,
        partyId: binding.partyId,
        adapterId: binding.adapterId,
        protocol: binding.protocol,
        inputEndpoint: binding.inputEndpoint,
        observationEndpoint: binding.observationEndpoint,
        tokenHeader: binding.tokenHeader,
        controllerProfile: binding.controllerProfile,
      }),
      partyScreenLinks: { ...session.partyScreenLinks },
      persistentScreenLinks: { ...session.persistentScreenLinks },
    };
    if (includeSecrets) response.hostToken = session.hostToken;
    return response;
  }

  launcherState(includeSecrets = false) {
    if (!this.currentSession || this.currentSession.status !== 'running') {
      return {
        ok: true,
        status: 'waiting',
        roomCode: this.currentSession?.roomCode || DEFAULT_ROOM,
        sessionId: null,
        players: [],
        controllerLinks: [],
        adapterBindings: [],
      };
    }
    return this.launchResponse(this.currentSession, includeSecrets);
  }
}

module.exports = {
  SessionManager,
  fillEmptyHostAiSeats,
  prepareActiveRoster,
  publicPlayers,
  tokensEqual,
};
