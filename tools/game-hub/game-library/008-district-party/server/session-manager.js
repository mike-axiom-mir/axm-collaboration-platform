'use strict';

const crypto = require('node:crypto');
const { BUILD_VERSION, DEFAULT_ROOM, DISCONNECT_TIMEOUT_MS } = require('../shared/constants');
const { mergeCombatRules } = require('../shared/party-rules');
const { isValidRoomCode } = require('../shared/validation');
const { createLaunchContract } = require('../foundation-adapter/launch-contract');
const { PlayerNormalizationError, normalizeSelectedPlayers } = require('../foundation-adapter/player-normalizer');
const { getDisplayState } = require('../foundation-adapter/display-router');
const { createWorldState } = require('./world-state');
const {
  GroupSaveError,
  GroupSaveStore,
  applyGroupSaveToWorld,
  createGroupSaveSnapshot,
} = require('./group-save-store');
const { createGroupSaveComputerState } = require('./group-save-system');
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
    this.groupSaveStore = options.groupSaveStore || new GroupSaveStore({
      projectRoot: this.projectRoot,
      storageDirectory: options.groupSaveDirectory,
    });
    this.currentSession = null;
  }

  createWorld(players, settings) {
    const world = createWorldState({ players, settings, projectRoot: this.projectRoot });
    world.groupSaveComputer = createGroupSaveComputerState(world.staticMap, this.groupSaveStore.catalog());
    return world;
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
    session.world = this.createWorld(session.players, session.settings);
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
    session.world = this.createWorld(session.players, session.settings);
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

  groupSaveCatalog() {
    return this.groupSaveStore.catalog();
  }

  connectedExternalPlayers(session, savedSeatSlots) {
    const allowed = new Set(savedSeatSlots);
    const connected = [];
    const now = Date.now();
    for (const player of session.players) {
      const actor = session.world.actors[player.actorId];
      const live = actor?.connected
        && Number(actor.lastInputAt) > 0
        && now - Number(actor.lastInputAt) <= DISCONNECT_TIMEOUT_MS;
      if (!live || !['human', 'adapter'].includes(actor.controller)) continue;
      if (!allowed.has(player.slot)) {
        throw new GroupSaveError(
          `Connected ${player.seatId} is not part of this fixed save roster.`,
          'SAVE_CONNECTED_ROSTER_MISMATCH',
          { seatId: player.seatId, savedSeatSlots },
        );
      }
      connected.push(player);
    }
    return connected;
  }

  loadGroupSaveIntoSession(session, save) {
    const savedSlots = [...save.roster.seatSlots];
    const connected = this.connectedExternalPlayers(session, savedSlots);
    if (connected.length > save.roster.seatCount) {
      throw new GroupSaveError('More external players are connected than the selected save permits.', 'SAVE_TOO_MANY_CONNECTED_PLAYERS');
    }
    if ((session.settings?.mode || 'coop_adventure') !== save.mode) {
      throw new GroupSaveError('This save belongs to another game mode.', 'SAVE_MODE_MISMATCH');
    }
    const connectedBySlot = new Map(connected.map((player) => [player.slot, player]));
    const roster = savedSlots.map((slot, index) => {
      const external = connectedBySlot.get(slot);
      if (external) return { ...external, ready: true, selectionOrder: index + 1 };
      return {
        slot,
        seatId: `seat_${slot}`,
        displayName: `Group AI ${slot}`,
        controllerType: 'ai',
        adapterId: `ai-group-save-${slot}`,
        ready: true,
        selectionOrder: index + 1,
      };
    });
    const preservedTokens = Object.fromEntries(connected.map((player) => [player.seatId, session.seatTokens[player.seatId]]));
    const contract = createLaunchContract(roster, {
      roomCode: session.roomCode,
      sessionId: session.id,
      hostToken: session.hostToken,
      seatTokens: preservedTokens,
    });
    const loadedWorld = this.createWorld(contract.players, session.settings);
    applyGroupSaveToWorld(loadedWorld, save);
    const connectedIds = new Set(connected.map((player) => player.actorId));
    for (const actor of Object.values(loadedWorld.actors)) {
      if (!connectedIds.has(actor.id)) continue;
      actor.connected = true;
      actor.lastInputAt = Date.now();
    }
    contract.players.forEach((player) => { player.connected = connectedIds.has(player.actorId); });
    loadedWorld.groupSaveComputer.message = `SLOT ${save.slot} LOADED · ${connected.length} CONNECTED · ${save.roster.seatCount - connected.length} HOST AI FILL`;
    loadedWorld.groupSaveComputer.messageUntilTick = loadedWorld.tick + 180;
    session.players = contract.players;
    session.seatTokens = contract.seatTokens;
    session.controllerLinks = contract.controllerLinks;
    session.adapterBindings = contract.adapterBindings;
    session.partyScreenLinks = contract.partyScreenLinks;
    session.persistentScreenLinks = contract.persistentScreenLinks;
    session.world = loadedWorld;
    session.groupSave = {
      slot: save.slot,
      seatCount: save.roster.seatCount,
      seatSlots: savedSlots,
      connectedExternalSeats: connected.length,
      hostAiFilledSeats: save.roster.seatCount - connected.length,
      loadedAt: Date.now(),
    };
    return {
      ok: true,
      operation: 'load',
      ...session.groupSave,
      players: publicPlayers(session.players),
    };
  }

  processPendingGroupSaveOperation(session = this.getRunningSession()) {
    const state = session?.world?.groupSaveComputer;
    const pending = state?.pendingOperation;
    if (!pending) return null;
    state.pendingOperation = null;
    try {
      if (pending.operation === 'save') {
        const snapshot = createGroupSaveSnapshot(session.world, pending.slot, { buildVersion: BUILD_VERSION });
        const result = this.groupSaveStore.writeSlot(pending.slot, snapshot);
        state.catalog = this.groupSaveStore.catalog();
        state.busy = false;
        state.message = `SLOT ${pending.slot} SAVED · ${snapshot.roster.seatCount} FIXED SEATS`;
        state.messageUntilTick = session.world.tick + 180;
        return { ok: true, operation: 'save', slot: pending.slot, summary: result.summary };
      }
      if (pending.operation === 'load') {
        const result = this.groupSaveStore.readSlot(pending.slot);
        if (result.status !== 'ready') {
          throw new GroupSaveError(
            result.status === 'corrupt' ? 'The selected save is corrupt.' : 'The selected save slot is empty.',
            result.status === 'corrupt' ? 'SAVE_CORRUPT' : 'SAVE_EMPTY',
          );
        }
        return this.loadGroupSaveIntoSession(session, result.save);
      }
      throw new GroupSaveError('Unknown group save operation.', 'INVALID_SAVE_OPERATION');
    } catch (error) {
      const activeState = session.world.groupSaveComputer;
      activeState.busy = false;
      activeState.confirmation = null;
      activeState.message = error.code === 'SAVE_CONNECTED_ROSTER_MISMATCH'
        ? 'LOAD BLOCKED · A CONNECTED SEAT IS OUTSIDE THIS SAVE ROSTER'
        : error.code === 'SAVE_ROSTER_LOCKED'
          ? 'SAVE BLOCKED · THIS SLOT IS LOCKED TO ITS ORIGINAL ROSTER'
          : `SAVE ERROR · ${String(error.code || 'UNKNOWN').replaceAll('_', ' ')}`;
      activeState.messageUntilTick = session.world.tick + 240;
      return { ok: false, operation: pending.operation, slot: pending.slot, reason: error.code || 'GROUP_SAVE_ERROR' };
    }
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
      mapId: session.world?.staticMap?.mapSelectionId || session.settings?.mapId || null,
      mapName: session.world?.staticMap?.mapDisplayName || session.world?.staticMap?.id || null,
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
      groupSave: session.groupSave ? { ...session.groupSave, seatSlots: [...session.groupSave.seatSlots] } : null,
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
