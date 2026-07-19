'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { findForbidden, getBoundObservation } = require('../server/observation');
const { remove, runtimeWithSession } = require('./helpers');

function context(runtime) {
  return {
    profileStore: runtime.profileStore,
    worldBones: require('../data/world.json'),
    missionSystem: runtime.missionSystem,
    encounterSystem: runtime.encounterSystem,
    economySystem: runtime.economySystem,
    circuitkinSystem: runtime.circuitkinSystem
  };
}

test('adapter receives seat-visible semantics without tokens, seed or hidden route', t => {
  const fixture = runtimeWithSession(2, ['human','adapter']); t.after(() => remove(fixture.root));
  const binding = fixture.response.bindings.find(value => value.seatId === 'seat_2');
  const view = getBoundObservation(fixture.session, {
    roomCode:'AXM1',sessionId:fixture.session.id,seatId:'seat_2',token:binding.token,width:640,height:480
  }, context(fixture.runtime), true);
  assert.equal(view.ok, true);
  assert.equal(view.scope, 'same-party-shared-screen-only');
  assert.equal(typeof view.hud.conditions.expeditionModifier,'string');
  assert.equal(view.hud.collection.total,30);
  assert.equal(view.hud.collection.entries.filter(entry=>entry.tier==='confluence').length,10);
  assert.deepEqual(findForbidden(view), []);
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes(binding.token), false);
  assert.equal(serialized.includes(String(fixture.session.worldRuntime.worldSeed)), false);
  assert.equal(serialized.includes('hidden-thread-path'), false);
});

test('off-screen actor is omitted and appears only inside camera bounds', t => {
  const fixture = runtimeWithSession(2, ['human','adapter']); t.after(() => remove(fixture.root));
  const binding = fixture.response.bindings.find(value => value.seatId === 'seat_2');
  fixture.session.actors.seat_1.position = { x: 2300, y: 1500 };
  fixture.session.actors.seat_1.role = 'support-console';
  fixture.session.actors.seat_2.position = { x: 330, y: 360 };
  let view = getBoundObservation(fixture.session, { roomCode:'AXM1',sessionId:fixture.session.id,seatId:'seat_2',token:binding.token,width:480,height:320 }, context(fixture.runtime), true);
  assert.equal(view.visible.actors.some(actor => actor.seatId === 'seat_1'), false);
  fixture.session.actors.seat_1.position = { x: 350, y: 370 };
  view = getBoundObservation(fixture.session, { roomCode:'AXM1',sessionId:fixture.session.id,seatId:'seat_2',token:binding.token,width:480,height:320 }, context(fixture.runtime), true);
  assert.equal(view.visible.actors.some(actor => actor.seatId === 'seat_1'), true);
});

test('adapter observation rejects human seat, wrong token and revoked consent', t => {
  const fixture = runtimeWithSession(2, ['human','adapter']); t.after(() => remove(fixture.root));
  const human = fixture.response.bindings.find(value => value.seatId === 'seat_1');
  const adapter = fixture.response.bindings.find(value => value.seatId === 'seat_2');
  assert.equal(getBoundObservation(fixture.session,{roomCode:'AXM1',sessionId:fixture.session.id,seatId:'seat_1',token:human.token},context(fixture.runtime),true).reason,'adapter-seat-required');
  assert.equal(getBoundObservation(fixture.session,{roomCode:'AXM1',sessionId:fixture.session.id,seatId:'seat_2',token:'wrong'},context(fixture.runtime),true).reason,'seat-token-rejected');
  fixture.session.actors.seat_2.adapterConsent=false;
  assert.equal(getBoundObservation(fixture.session,{roomCode:'AXM1',sessionId:fixture.session.id,seatId:'seat_2',token:adapter.token},context(fixture.runtime),true).reason,'adapter-consent-revoked');
});
