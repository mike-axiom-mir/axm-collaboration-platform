'use strict';

const crypto = require('node:crypto');
const { normalizeSelectedPlayers } = require('./player-normalizer');

function randomId(prefix, bytes = 12) {
  return `${prefix}-${crypto.randomBytes(bytes).toString('hex')}`;
}

function localPath(pathname, query) {
  const params = new URLSearchParams(query);
  return `${pathname}?${params.toString()}`;
}

function createLaunchContract(selectedPlayers, options = {}) {
  const players = normalizeSelectedPlayers(selectedPlayers);
  const roomCode = typeof options.roomCode === 'string' && /^AXM[0-9A-Z]{1,8}$/.test(options.roomCode)
    ? options.roomCode
    : 'AXM1';
  const sessionId = options.sessionId || randomId('session');
  const hostToken = options.hostToken || randomId('host');
  const suppliedTokens = options.seatTokens || {};
  const seatTokens = {};
  const controllerLinks = [];
  const adapterBindings = [];

  for (const player of players) {
    if (!['human', 'adapter'].includes(player.controllerType)) continue;
    const token = suppliedTokens[player.seatId] || randomId('seat');
    seatTokens[player.seatId] = token;
    if (player.controllerType === 'adapter') {
      adapterBindings.push({
        seatId: player.seatId,
        slot: player.slot,
        displayName: player.displayName,
        partyId: player.partyId,
        adapterId: player.adapterId,
        token,
        protocol: 'axm-semantic-input-v1',
        inputEndpoint: '/api/input',
        observationEndpoint: '/api/adapter-observation',
        tokenHeader: 'X-AXM-Seat-Token',
        controllerProfile: '/data/controller-profile.json',
      });
      continue;
    }
    const path = localPath('/controller.html', {
      room: roomCode,
      session: sessionId,
      seat: player.seatId,
      token,
    });
    controllerLinks.push({
      seatId: player.seatId,
      slot: player.slot,
      displayName: player.displayName,
      partyId: player.partyId,
      token,
      path,
      url: path,
    });
  }

  const partyScreenLinks = {};
  const persistentScreenLinks = {};
  for (const partyId of ['party_a', 'party_b', 'all']) {
    partyScreenLinks[partyId] = localPath('/game/', {
      room: roomCode,
      session: sessionId,
      view: 'party',
      party: partyId,
    });
    persistentScreenLinks[partyId] = localPath('/party-screen.html', { party: partyId });
  }

  return {
    roomCode,
    sessionId,
    hostToken,
    players,
    seatTokens,
    controllerLinks,
    adapterBindings,
    partyScreenLinks,
    persistentScreenLinks,
  };
}

module.exports = {
  createLaunchContract,
  randomId,
};
