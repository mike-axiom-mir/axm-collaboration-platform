'use strict';

const { isValidRoomCode, isValidSeatId, isValidSessionId, isValidToken } = require('./validation');

function validateInputPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return { ok: false, errors: ['packet-object-required'] };
  if (!isValidRoomCode(packet.roomCode ?? packet.room)) errors.push('invalid-room');
  if (!isValidSessionId(packet.sessionId)) errors.push('invalid-session');
  if (!isValidSeatId(packet.seatId)) errors.push('invalid-seat');
  if (!isValidToken(packet.token)) errors.push('invalid-token');
  if (!Number.isSafeInteger(packet.seq) || packet.seq < 0) errors.push('invalid-sequence');
  if (!packet.input || typeof packet.input !== 'object' || Array.isArray(packet.input)) errors.push('invalid-input');
  return { ok: errors.length === 0, errors };
}

module.exports = { validateInputPacket };
