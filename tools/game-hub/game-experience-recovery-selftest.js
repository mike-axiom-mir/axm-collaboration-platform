'use strict';

const assert = require('assert');
const path = require('path');
const verifier = require('./game-package-verifier');
const hub = require('./game-hub-server');

const library = path.join(__dirname, 'game-library');
const errors = verifier.validateRecoveryRegressions(library);
assert.deepStrictEqual(errors, [], errors.join('\n'));

assert.doesNotThrow(() => hub.validatePlayModeRoster(
  { party_rule: 'party-a-only' },
  [{ slot: 1, type: 'human' }]
), 'solo story mode must accept one Party A player');

assert.doesNotThrow(() => hub.validatePlayModeRoster(
  { party_rule: 'balanced-parties' },
  [{ slot: 1, type: 'human' }, { slot: 5, type: 'human' }]
), 'balanced multiplayer must accept 1v1');

assert.throws(() => hub.validatePlayModeRoster(
  { party_rule: 'balanced-parties' },
  [{ slot: 1 }, { slot: 2 }, { slot: 5 }]
), /equal Party A and Party B/, 'unbalanced teams must remain blocked');

assert.strictEqual(hub.runtimeBrowserUrl(8797, '/games/007/?role=host'), 'http://127.0.0.1:8797/?role=host');
assert.strictEqual(hub.runtimeBrowserUrl(8799, '/games/009/party/'), 'http://127.0.0.1:8799/party/');

console.log('Game experience recovery selftest: PASS - entry, modes, variable seats, controls, playable/display routing, refresh and visible globe guarded');
