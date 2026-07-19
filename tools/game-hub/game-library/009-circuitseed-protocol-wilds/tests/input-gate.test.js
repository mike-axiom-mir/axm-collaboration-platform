'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { consumePulse, revokeAdapterConsent, routeInput } = require('../server/input-gate');

function session() {
  return {
    id: 'session-test', roomCode: 'AXM1', status: 'running',
    seatTokens: { seat_1: 'human-private-token', seat_2: 'adapter-private-token', seat_3: 'ai-private-token' },
    actors: {
      seat_1: { id:'actor-seat-1',seatId:'seat_1',occupied:true,active:true,controllerType:'human',inputSequence:-1,input:{},inputHeld:{},pendingPulses:{},rateWindow:[] },
      seat_2: { id:'actor-seat-2',seatId:'seat_2',occupied:true,active:true,controllerType:'adapter',adapterConsent:true,inputSequence:-1,input:{},inputHeld:{},pendingPulses:{},rateWindow:[] },
      seat_3: { id:'actor-seat-3',seatId:'seat_3',occupied:true,active:true,controllerType:'ai',inputSequence:-1,input:{},inputHeld:{},pendingPulses:{},rateWindow:[] }
    }
  };
}
function packet(seatId, token, seq, input) { return { roomCode:'AXM1',sessionId:'session-test',seatId,token,seq,input }; }

test('human and adapter intents use the same sanitizer and authority gate', () => {
  const s = session();
  const raw = { moveX: 1, moveY: 1, moveActive: true, scan: true };
  const human = routeInput(s, packet('seat_1','human-private-token',0,raw), 1000);
  const adapter = routeInput(s, packet('seat_2','adapter-private-token',0,raw), 1000);
  assert.equal(human.ok, true); assert.equal(adapter.ok, true);
  assert.deepEqual(human.sanitized, adapter.sanitized);
  assert.ok(Math.hypot(human.sanitized.moveX, human.sanitized.moveY) <= 1.000001);
  assert.equal(consumePulse(s.actors.seat_1, 'scan'), true);
  assert.equal(consumePulse(s.actors.seat_2, 'scan'), true);
});

test('unknown and client-asserted outcome actions are rejected', () => {
  const s = session();
  assert.equal(routeInput(s, packet('seat_1','human-private-token',0,{ dance:true }), 1000).reason, 'unknown-intention-field');
  assert.equal(routeInput(s, packet('seat_1','human-private-token',1,{ damage:999 }), 1000).reason, 'machine-or-outcome-action-rejected');
  assert.equal(routeInput(s, packet('seat_1','human-private-token',2,{ tacticalAction:'Win' }), 1000).reason, 'unknown-tactical-action');
});

test('wrong seat, token, stale sequence and Host AI external packets are rejected', () => {
  const s = session();
  assert.equal(routeInput(s, packet('seat_9','no',0,{}), 1000).reason, 'seat-not-active');
  assert.equal(routeInput(s, packet('seat_1','wrong',0,{}), 1000).reason, 'seat-token-rejected');
  assert.equal(routeInput(s, packet('seat_1','human-private-token',2,{}), 1000).ok, true);
  assert.equal(routeInput(s, packet('seat_1','human-private-token',2,{}), 1001).reason, 'stale-sequence');
  assert.equal(routeInput(s, packet('seat_3','ai-private-token',0,{}), 1000).reason, 'seat-host-controlled');
});

test('adapter consent revoke pauses without replacement', () => {
  const s = session();
  const result = revokeAdapterConsent(s, 'seat_2');
  assert.deepEqual(result, { ok:true,seatId:'seat_2',status:'paused',replacementCreated:false });
  assert.equal(routeInput(s, packet('seat_2','adapter-private-token',0,{}), 1000).reason, 'adapter-consent-revoked');
  assert.equal(Object.keys(s.actors).length, 3);
});

test('equal thirty-packet per-second rate limit applies at the gate', () => {
  const s = session();
  for (let index = 0; index < 30; index += 1) assert.equal(routeInput(s, packet('seat_1','human-private-token',index,{}), 1000 + index).ok, true);
  assert.equal(routeInput(s, packet('seat_1','human-private-token',30,{}), 1050).reason, 'seat-rate-limit');
});
