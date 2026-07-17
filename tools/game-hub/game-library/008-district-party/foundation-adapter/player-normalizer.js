'use strict';

const { MAX_SLOT, assertValidSlot, partyIdForSlot } = require('./party-mapper');

const ALLOWED_CONTROLLER_TYPES = new Set(['human', 'ai', 'adapter']);

class PlayerNormalizationError extends Error {
  constructor(message, code = 'INVALID_PLAYERS', details = null) {
    super(message);
    this.name = 'PlayerNormalizationError';
    this.code = code;
    this.details = details;
  }
}

function parseAXMPlayersJSON(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.players)) return value.players;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PlayerNormalizationError('AXM_PLAYERS_JSON must contain a JSON array.', 'MALFORMED_PLAYERS_JSON');
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new PlayerNormalizationError(
      `AXM_PLAYERS_JSON could not be parsed: ${error.message}`,
      'MALFORMED_PLAYERS_JSON',
    );
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsed = parsed.players;
  if (!Array.isArray(parsed)) {
    throw new PlayerNormalizationError('AXM_PLAYERS_JSON must decode to an array.', 'MALFORMED_PLAYERS_JSON');
  }
  return parsed;
}

function slotFromRaw(raw, index) {
  const suppliedSlot = raw.slot ?? raw.playerSlot ?? raw.player_index ?? raw.playerIndex;
  const suppliedSeat = raw.seatId ?? raw.seat_id ?? raw.seat;
  const seatMatch = typeof suppliedSeat === 'string' ? suppliedSeat.trim().match(/^seat[_-]?(\d+)$/i) : null;
  const slotFromSeat = seatMatch ? Number(seatMatch[1]) : null;
  const slot = suppliedSlot == null ? (slotFromSeat ?? index + 1) : Number(suppliedSlot);

  try {
    assertValidSlot(slot);
  } catch (error) {
    throw new PlayerNormalizationError(error.message, 'INVALID_SLOT', { index, slot });
  }
  if (slotFromSeat != null && slotFromSeat !== slot) {
    throw new PlayerNormalizationError(
      `Seat ${suppliedSeat} conflicts with slot ${slot}.`,
      'SEAT_SLOT_MISMATCH',
      { index, seatId: suppliedSeat, slot },
    );
  }
  return slot;
}

function controllerTypeFromRaw(raw) {
  let type = raw.controllerType ?? raw.controller_type ?? raw.seatType ?? raw.seat_type ?? raw.type;
  if (type && typeof type === 'object') type = type.type;
  if (typeof type !== 'string') {
    type = raw.adapterId || raw.adapter_id ? 'adapter' : 'human';
  }
  type = type.trim().toLowerCase();
  if (type === 'bot' || type === 'computer') type = 'ai';
  if (!ALLOWED_CONTROLLER_TYPES.has(type)) {
    throw new PlayerNormalizationError(
      `Unsupported controller type: ${String(type)}.`,
      'INVALID_CONTROLLER_TYPE',
      { controllerType: type },
    );
  }
  return type;
}

function cleanDisplayName(value, slot, controllerType) {
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32);
    if (cleaned) return cleaned;
  }
  return controllerType === 'human' ? `Player ${slot}` : `AI ${slot}`;
}

function normalizeSelectedPlayers(input, options = {}) {
  const allowEmpty = options.allowEmpty === true;
  const rawPlayers = Array.isArray(input) ? input : parseAXMPlayersJSON(input);
  if (!allowEmpty && rawPlayers.length === 0) {
    throw new PlayerNormalizationError('At least one selected player is required.', 'NO_PLAYERS');
  }
  if (rawPlayers.length > MAX_SLOT) {
    throw new PlayerNormalizationError(`A maximum of ${MAX_SLOT} seats is supported.`, 'TOO_MANY_PLAYERS');
  }

  const usedSlots = new Set();
  const players = rawPlayers.map((rawValue, index) => {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      throw new PlayerNormalizationError(`Player record ${index + 1} must be an object.`, 'INVALID_PLAYER_RECORD');
    }
    const raw = rawValue;
    const slot = slotFromRaw(raw, index);
    if (usedSlots.has(slot)) {
      throw new PlayerNormalizationError(`Seat seat_${slot} was selected more than once.`, 'DUPLICATE_SEAT', { slot });
    }
    usedSlots.add(slot);

    const controllerType = controllerTypeFromRaw(raw);
    const adapterIdValue = raw.adapterId ?? raw.adapter_id ?? null;
    const adapterId = controllerType === 'human'
      ? null
      : (typeof adapterIdValue === 'string' && adapterIdValue.trim()
        ? adapterIdValue.trim().slice(0, 64)
        : `${controllerType}-local-${slot}`);
    const displayName = cleanDisplayName(
      raw.displayName ?? raw.display_name ?? raw.name ?? raw.label,
      slot,
      controllerType,
    );

    return {
      actorId: `actor-seat-${slot}`,
      seatId: `seat_${slot}`,
      slot,
      displayName,
      controllerType,
      adapterId,
      partyId: partyIdForSlot(slot),
      connected: false,
      ready: raw.ready !== false,
      selectionOrder: Number.isInteger(raw.selectionOrder) ? raw.selectionOrder : index + 1,
    };
  });

  return players.sort((a, b) => a.slot - b.slot);
}

module.exports = {
  ALLOWED_CONTROLLER_TYPES,
  PlayerNormalizationError,
  normalizeSelectedPlayers,
  parseAXMPlayersJSON,
};
