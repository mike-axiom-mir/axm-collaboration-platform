'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createRuntime } = require('../server/server');
const { players, remove, runtimeWithSession, tempRoot } = require('./helpers');

test('every occupied-seat layout from one through eight starts without filling empties', () => {
  for (let count = 1; count <= 8; count += 1) {
    const root = tempRoot('circuitseed-layout-');
    try {
      const types = Array.from({ length: count }, (_, index) => index % 3 === 1 ? 'adapter' : index % 3 === 2 ? 'ai' : 'human');
      const runtime = createRuntime({ dataRoot: root, hubPlayers: players(count, types) });
      const response = runtime.sessionManager.createSession({ players: players(count, types), worldId: 'world-' + count, seed: 'layout-' + count });
      assert.equal(response.players.length, count);
      assert.equal(Object.keys(runtime.sessionManager.current.actors).length, count);
      assert.equal(runtime.sessionManager.current.rules.defaultAiFill, false);
      assert.equal(runtime.sessionManager.current.rules.emptySeatsRemainEmpty, true);
    } finally { remove(root); }
  }
});

test('sparse and uneven slot layouts remain legal and retain original slots', () => {
  const root = tempRoot();
  try {
    const roster = [
      {seat_id:'seat_1',slot:1,type:'human',display_name:'A'},
      {seat_id:'seat_3',slot:3,type:'adapter',display_name:'B',adapter_id:'b'},
      {seat_id:'seat_6',slot:6,type:'human',display_name:'C'},
      {seat_id:'seat_8',slot:8,type:'ai',display_name:'D'}
    ];
    const runtime = createRuntime({ dataRoot: root, hubPlayers: roster });
    const response = runtime.sessionManager.createSession({ players: roster, worldId:'uneven', seed:'uneven' });
    assert.deepEqual(response.players.map(actor => actor.slot), [1,3,6,8]);
    assert.equal(response.players.some(actor => actor.slot === 2), false);
  } finally { remove(root); }
});

test('seats five through eight receive explicit useful encounter roles', t => {
  const fixture = runtimeWithSession(8, ['human','human','human','human','adapter','human','adapter','ai']); t.after(() => remove(fixture.root));
  const roles = fixture.response.players.map(actor => actor.role);
  assert.deepEqual(roles.slice(0,4), ['field-operator','field-operator','field-operator','field-operator']);
  assert.deepEqual(roles.slice(4), ['support-console','scan','item','vote']);
  assert.equal(new Set(roles.slice(4)).size, 4);
});

test('real drop-in, drop-out checkpoint and reconnect retain the same profile', t => {
  const fixture = runtimeWithSession(1, ['human']); t.after(() => remove(fixture.root));
  const joined = fixture.runtime.sessionManager.dropIn({ displayName:'Returning Friend', type:'human', slot:4 });
  assert.equal(joined.actor.slot, 4);
  const profileBefore = fixture.runtime.profileStore.get(joined.actor.profileId);
  fixture.session.actors.seat_4.position = { x: 901, y: 777 };
  fixture.session.actors.seat_4.currentRegionId = 'threadwild';
  const left = fixture.runtime.sessionManager.dropOut('seat_4', 'network-test');
  assert.equal(left.controlTransferred, false);
  assert.equal(left.replacementCreated, false);
  const saved = fixture.runtime.profileStore.get(joined.actor.profileId);
  assert.ok(saved.version > profileBefore.version);
  assert.deepEqual(saved.lastSafeCheckpoint.x, 901);
  assert.throws(() => fixture.runtime.sessionManager.reconnect({seatId:'seat_4',token:'wrong',profileId:joined.actor.profileId}), /reconnect-binding-rejected/);
  const back = fixture.runtime.sessionManager.reconnect({seatId:'seat_4',token:joined.binding.token,profileId:joined.actor.profileId});
  assert.equal(back.actor.profileId, joined.actor.profileId);
  assert.equal(back.actor.active, true);
});

test('explicit AI seat is allowed but no absent seat becomes AI', t => {
  const fixture = runtimeWithSession(2, ['human','ai']); t.after(() => remove(fixture.root));
  assert.equal(fixture.response.players.length, 2);
  assert.equal(fixture.response.players[1].controllerType, 'ai');
  assert.equal(Object.keys(fixture.session.actors).length, 2);
  assert.equal(fixture.session.actors.seat_3, undefined);
});
