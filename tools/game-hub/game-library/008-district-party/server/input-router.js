'use strict';

const { sanitizeInputIntent } = require('../shared/validation');
const { validateInputPacket } = require('../shared/schemas');
const { tokensEqual } = require('./session-manager');

function isExternalController(actor) {
  return actor && (actor.controller === 'human' || actor.controller === 'adapter');
}

function routeInput(sessionManager, packet, now = Date.now()) {
  const validation = validateInputPacket(packet);
  if (!validation.ok) return { ok: false, statusCode: 400, reason: 'malformed-input', errors: validation.errors };
  const session = sessionManager.getSession(packet.sessionId);
  if (!session || session.status !== 'running') return { ok: false, statusCode: 404, reason: 'session-not-running' };
  if ((packet.roomCode ?? packet.room) !== session.roomCode) return { ok: false, statusCode: 403, reason: 'room-session-mismatch' };
  const actor = Object.values(session.world.actors).find((candidate) => candidate.seatId === packet.seatId);
  if (!actor) return { ok: false, statusCode: 404, reason: 'seat-not-active' };
  if (!isExternalController(actor)) return { ok: false, statusCode: 403, reason: 'seat-host-controlled' };
  if (!tokensEqual(packet.token, session.seatTokens[packet.seatId])) {
    return { ok: false, statusCode: 403, reason: 'seat-token-rejected' };
  }
  if (packet.seq <= actor.inputSequence) {
    return { ok: false, statusCode: 409, reason: 'stale-input-sequence', acceptedSeq: actor.inputSequence };
  }

  const nextInput = sanitizeInputIntent(packet.input);
  actor.inputHeld ||= {};
  actor.pendingPulses ||= {};
  for (const field of ['action', 'fire', 'inventoryToggle', 'inventoryPrev', 'inventoryNext', 'inventoryActivate']) {
    const held = nextInput[field] === true;
    if (actor.alive && held && actor.inputHeld[field] !== true) actor.pendingPulses[field] = true;
    actor.inputHeld[field] = held;
    nextInput[field] = actor.alive && actor.pendingPulses[field] === true;
  }
  actor.actionHeld = actor.inputHeld.action === true;
  actor.input = nextInput;
  actor.inputSequence = packet.seq;
  actor.lastInputAt = now;
  actor.connected = true;
  const playerRecord = session.players.find((player) => player.seatId === actor.seatId);
  if (playerRecord) playerRecord.connected = true;
  const player = {
    displayName: actor.displayName,
    partyId: actor.partyId,
    seatId: actor.seatId,
    slot: actor.slot,
  };
  return {
    ok: true,
    tick: session.world.tick,
    player,
    actorId: actor.id,
    seatId: actor.seatId,
    acceptedSeq: actor.inputSequence,
  };
}

function getControllerInfo(sessionManager, { roomCode, sessionId, seatId, token }) {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'running') return { ok: false, statusCode: 404, reason: 'session-not-running' };
  if (roomCode !== session.roomCode) return { ok: false, statusCode: 403, reason: 'room-session-mismatch' };
  const actor = Object.values(session.world.actors).find((candidate) => candidate.seatId === seatId);
  if (!actor || actor.controller !== 'human') return { ok: false, statusCode: 404, reason: 'human-seat-not-found' };
  if (!tokensEqual(token, session.seatTokens[seatId])) return { ok: false, statusCode: 403, reason: 'seat-token-rejected' };
  const player = {
    actorId: actor.id,
    seatId: actor.seatId,
    slot: actor.slot,
    displayName: actor.displayName,
    partyId: actor.partyId,
    connected: actor.connected,
    controlMode: actor.currentVehicleId ? (actor.vehicleSeat === 'driver' ? 'driving' : 'passenger') : 'walking',
    state: actor.state,
    alive: actor.alive,
    health: actor.health,
    maxHealth: actor.maxHealth,
    shield: actor.shield,
    maxShield: actor.maxShield,
    walletCents: actor.walletCents,
    personalFundCents: actor.walletCents,
    partyFundCents: session.world.economy?.partyFunds?.[actor.partyId] || 0,
    inventory: actor.inventory,
    inventoryOpen: actor.inventoryOpen,
    regeneration: actor.regeneration ? {
      insideBase: actor.regeneration.insideBase === true,
      baseZoneId: actor.regeneration.baseZoneId || null,
      healthPerSecond: Number(actor.regeneration.healthPerSecond) || 0,
      shieldPerSecond: 0,
    } : null,
    currentVehicleId: actor.currentVehicleId,
    carryingPackageId: actor.carryingPackageId,
    tether: actor.tether,
    acceptedSeq: actor.inputSequence,
  };
  return {
    ok: true,
    sessionId: session.id,
    roomCode: session.roomCode,
    tick: session.world.tick,
    player,
    actor: player,
    mission: {
      mode: session.world.mission.mode,
      title: session.world.mission.title,
      status: session.world.mission.status,
      deliveredCount: session.world.mission.deliveredCount,
      goal: session.world.mission.goal,
      endsAtTick: session.world.mission.endsAtTick,
    },
  };
}

module.exports = { getControllerInfo, isExternalController, routeInput };
