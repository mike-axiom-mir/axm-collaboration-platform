'use strict';

const ROOM_PATTERN = /^AXM[0-9A-Z]{1,8}$/;
const SESSION_PATTERN = /^session-[a-f0-9-]{8,80}$/i;
const SEAT_PATTERN = /^seat_([1-8])$/;
const TOKEN_PATTERN = /^(?:seat|host)-[a-f0-9-]{16,160}$/i;

function clamp(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function isValidRoomCode(value) {
  return typeof value === 'string' && ROOM_PATTERN.test(value);
}

function isValidSessionId(value) {
  return typeof value === 'string' && SESSION_PATTERN.test(value);
}

function isValidSeatId(value) {
  return typeof value === 'string' && SEAT_PATTERN.test(value);
}

function isValidToken(value) {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

function sanitizeInputIntent(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const moveX = clamp(raw.moveX ?? raw.x ?? 0, -1, 1);
  const moveY = clamp(raw.moveY ?? raw.y ?? 0, -1, 1);
  const magnitude = Math.hypot(moveX, moveY);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  const aimX = clamp(raw.aimX ?? 0, -1, 1);
  const aimY = clamp(raw.aimY ?? 0, -1, 1);
  const aimMagnitude = Math.hypot(aimX, aimY);
  const aimScale = aimMagnitude > 1 ? 1 / aimMagnitude : 1;
  return {
    moveX: moveX * scale,
    moveY: moveY * scale,
    aimX: aimX * aimScale,
    aimY: aimY * aimScale,
    aimActive: raw.aimActive === true,
    action: raw.action === true || raw.enter === true,
    attack: raw.attack === true,
    fire: raw.fire === true || raw.attackPulse === true,
    sprint: raw.sprint === true || raw.dash === true,
    brake: raw.brake === true,
    inventoryToggle: raw.inventoryToggle === true,
    inventoryPrev: raw.inventoryPrev === true,
    inventoryNext: raw.inventoryNext === true,
    inventoryActivate: raw.inventoryActivate === true,
    mapToggle: raw.mapToggle === true,
  };
}

module.exports = {
  clamp,
  isValidRoomCode,
  isValidSeatId,
  isValidSessionId,
  isValidToken,
  sanitizeInputIntent,
};
