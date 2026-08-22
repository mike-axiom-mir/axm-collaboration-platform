'use strict';

module.exports = Object.freeze({
  BUILD_NAME: 'AXM District Party',
  BUILD_VERSION: '0.8.0-visual-adventure',
  DEFAULT_PORT: 8795,
  DEFAULT_ROOM: 'AXM1',
  TICK_RATE: 30,
  TICK_MS: 1000 / 30,
  MAX_SEATS: 8,
  FIRST_RELEASE_VISIBLE_SEATS: 4,
  INPUT_TIMEOUT_MS: 600,
  DISCONNECT_TIMEOUT_MS: 5000,
  MAX_JSON_BODY_BYTES: 64 * 1024,
  PARTY_TETHER: Object.freeze({ soft: 300, warning: 410, hard: 510 }),
});
