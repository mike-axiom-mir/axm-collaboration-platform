'use strict';

const assert = require('assert');
const {
  createEngineState,
  assignSeat,
  readySeat,
  startSession
} = require('./engine-core');
const { recoverRuntimeSession } = require('./runtime-lifecycle');

function manifest(minimum) {
  return { game_id: 'seam-test', name: 'Seam Test', min_players: minimum || 1, max_players: 4, allowed_seat_types: ['human', 'adapter', 'ai'] };
}

function run() {
  let assertions = 0;
  const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };

  const state = createEngineState();
  assert.throws(() => readySeat(state, 'seat_1', true), /cannot ready while type is empty/); assertions += 1;
  assignSeat(state, 'seat_1', { type: 'human', display_name: 'One' });
  readySeat(state, 'seat_1', true);
  assignSeat(state, 'seat_1', { type: 'empty' });
  check(state.lobby.seats[0].ready === false && state.lobby.seats[0].ready_order === null, 'emptying a seat clears old ready consent');

  assignSeat(state, 'seat_1', { type: 'human', display_name: 'One' });
  readySeat(state, 'seat_1', true);
  assert.throws(() => startSession(state, manifest(2)), /Not enough ready players/); assertions += 1;
  check(state.session.phase === 'LOBBY' && state.lobby.seats[0].play_status === 'lobby', 'failed minimum-player validation does not half-start a session');

  const running = startSession(state, manifest(1));
  assert.throws(() => startSession(state, manifest(1)), /already running/); assertions += 1;
  const receipt = recoverRuntimeSession(state, { status: 'runtime-lost', reason: 'test-exit' });
  check(receipt && receipt.session_id === running.session_id && receipt.status === 'runtime-lost', 'runtime loss produces an inspectable receipt');
  check(state.session.phase === 'LOBBY' && state.status === 'lobby', 'runtime loss returns the shared engine to a usable lobby');
  check(recoverRuntimeSession(state, {}) === null, 'recovery is idempotent once the session is closed');

  return { assertions };
}

if (require.main === module) {
  const result = run();
  console.log(`PASS shared game engine seams: ${result.assertions} assertions`);
}

module.exports = { run };
