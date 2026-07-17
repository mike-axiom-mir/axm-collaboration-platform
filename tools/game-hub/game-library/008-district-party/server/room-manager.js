'use strict';

const { DEFAULT_ROOM } = require('../shared/constants');
const { isValidRoomCode } = require('../shared/validation');

class RoomManager {
  constructor() {
    this.rooms = new Map([[DEFAULT_ROOM, { roomCode: DEFAULT_ROOM, sessionId: null }]]);
  }

  ensureRoom(roomCode = DEFAULT_ROOM) {
    if (!isValidRoomCode(roomCode)) throw Object.assign(new Error('Invalid AXM room code.'), { code: 'INVALID_ROOM' });
    if (!this.rooms.has(roomCode)) this.rooms.set(roomCode, { roomCode, sessionId: null });
    return this.rooms.get(roomCode);
  }

  attachSession(roomCode, sessionId) {
    const room = this.ensureRoom(roomCode);
    room.sessionId = sessionId;
    return room;
  }

  clearSession(roomCode, sessionId) {
    const room = this.rooms.get(roomCode);
    if (room && (!sessionId || room.sessionId === sessionId)) room.sessionId = null;
  }
}

module.exports = { RoomManager };
