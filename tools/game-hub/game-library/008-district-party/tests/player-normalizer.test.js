'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSelectedPlayers,
  parseAXMPlayersJSON,
} = require('../foundation-adapter/player-normalizer');

test('normalizes human, AI, and adapter identities without changing their type', () => {
  const players = normalizeSelectedPlayers([
    { slot: 1, displayName: 'Mike', controllerType: 'human' },
    { slot: 2, displayName: 'Nova', controllerType: 'ai' },
    { slot: 3, displayName: 'Bridge', controllerType: 'adapter', adapterId: 'adapter-local' },
  ]);
  assert.deepEqual(players.map((p) => p.controllerType), ['human', 'ai', 'adapter']);
  assert.equal(players[0].adapterId, null);
  assert.match(players[1].adapterId, /^ai-local-/);
  assert.equal(players[2].adapterId, 'adapter-local');
  assert.deepEqual(players.map((p) => p.partyId), ['party_a', 'party_a', 'party_a']);
});

test('supplies a clear non-empty display name when one is missing', () => {
  const [human] = normalizeSelectedPlayers([{ slot: 1, controllerType: 'human', displayName: '   ' }]);
  const [ai] = normalizeSelectedPlayers([{ slot: 5, controllerType: 'ai' }]);
  assert.equal(human.displayName, 'Player 1');
  assert.equal(ai.displayName, 'AI 5');
});

test('rejects duplicate seats', () => {
  assert.throws(
    () => normalizeSelectedPlayers([{ slot: 1 }, { seatId: 'seat_1' }]),
    { code: 'DUPLICATE_SEAT' },
  );
});

test('accepts and maps eight selected player records without P1-P4 assumptions', () => {
  const players = normalizeSelectedPlayers(Array.from({ length: 8 }, (_, index) => ({
    slot: index + 1,
    displayName: `Seat ${index + 1}`,
    controllerType: index % 2 ? 'ai' : 'human',
  })));
  assert.equal(players.length, 8);
  assert.deepEqual(players.slice(4).map((p) => p.partyId), ['party_b', 'party_b', 'party_b', 'party_b']);
  assert.equal(players[7].actorId, 'actor-seat-8');
});

test('parses AXM_PLAYERS_JSON array and rejects malformed JSON', () => {
  assert.equal(parseAXMPlayersJSON('[{"slot":1}]').length, 1);
  assert.equal(parseAXMPlayersJSON('{"players":[{"slot":2}]}').length, 1);
  assert.throws(() => parseAXMPlayersJSON('{broken'), { code: 'MALFORMED_PLAYERS_JSON' });
  assert.throws(() => parseAXMPlayersJSON('{"notPlayers":true}'), { code: 'MALFORMED_PLAYERS_JSON' });
});
