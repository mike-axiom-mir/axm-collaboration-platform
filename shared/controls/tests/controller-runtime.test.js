'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

async function runtimeModule() {
  return import(pathToFileURL(path.join(root, 'src', 'browser', 'axm-controller-runtime.mjs')).href);
}

test('floating-stick radial math has a generous dead zone and reaches full range', async () => {
  const { normalizeRadialInput } = await import(pathToFileURL(path.join(root, 'src', 'browser', 'axm-virtual-stick.mjs')).href);
  const quiet = normalizeRadialInput(0.05, -0.04);
  assert.equal(quiet.magnitude, 0);
  const half = normalizeRadialInput(0.5, 0);
  assert.ok(half.x > 0 && half.x < 0.5);
  const diagonal = normalizeRadialInput(1, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
});

test('top-down runtime keeps movement and aim independent and sends release-to-fire once', async () => {
  const { AxmControllerRuntime } = await runtimeModule();
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'top-down-twin-stick.json')));
  const packets = [];
  const runtime = new AxmControllerRuntime({
    identity: { roomCode: 'AXM1', sessionId: 'session-runtime', seatId: 'seat_1', token: 'private-token' },
    profile,
    transport: async (packet) => { packets.push(packet); return { ok: true, acceptedSeq: packet.seq }; },
  });
  runtime.setVector('left', { x: 1, y: 1, active: true });
  runtime.setVector('right', { x: 0, y: -1, active: true });
  runtime.setVector('right', { x: 0, y: -1, active: false });
  runtime.releaseVector('right');
  await delay();
  assert.equal(packets.length, 1);
  assert.ok(Math.abs(Math.hypot(packets[0].input.moveX, packets[0].input.moveY) - 1) < 1e-12);
  assert.deepEqual({ x: packets[0].input.aimX, y: packets[0].input.aimY }, { x: 0, y: -1 });
  assert.equal(packets[0].input.fire, true);
  await runtime.flush();
  assert.equal(packets[1].input.fire, false);
  assert.equal(packets[1].seq, packets[0].seq + 1);
});

test('first-person profile keeps the physical right stick but removes release-to-fire', async () => {
  const { AxmControllerRuntime } = await runtimeModule();
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'first-person-explore.json')));
  const packets = [];
  const runtime = new AxmControllerRuntime({
    identity: { roomCode: 'AXM1', sessionId: 'session-runtime', seatId: 'seat_1', token: 'private-token' },
    profile,
    transport: async (packet) => { packets.push(packet); return { ok: true, acceptedSeq: packet.seq }; },
  });
  runtime.setVector('right', { x: 0.4, y: -0.7, active: true });
  runtime.releaseVector('right');
  await runtime.flush();
  assert.equal(packets[0].input.lookActive, true);
  assert.equal('fire' in packets[0].input, false);
});

test('neutralize immediately transmits zero vectors and released buttons through the ordinary gate transport', async () => {
  const { AxmControllerRuntime } = await runtimeModule();
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'top-down-twin-stick.json')));
  const packets = [];
  const runtime = new AxmControllerRuntime({
    identity: {
      roomCode: 'AXM1', sessionId: 'session-runtime', seatId: 'seat_1', token: 'private-token',
      inputSourceBindingId: 'binding-phone', inputSourceEpoch: 0,
    },
    profile,
    transport: async (packet) => { packets.push(packet); return { ok: true, acceptedSeq: packet.seq }; },
  });
  runtime.setVector('left', { x: 1, y: -0.5, active: true });
  runtime.setButton('sprint', true);
  await runtime.flush();
  await runtime.neutralize();
  const neutral = packets.at(-1);
  assert.equal(neutral.inputSourceBindingId, 'binding-phone');
  assert.equal(neutral.inputSourceEpoch, 0);
  assert.deepEqual({ x: neutral.input.moveX, y: neutral.input.moveY }, { x: 0, y: 0 });
  assert.equal(neutral.input.sprint, false);
});
