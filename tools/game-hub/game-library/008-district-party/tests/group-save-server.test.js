'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createDistrictPartyServer } = require('../server/server');
const { SessionManager } = require('../server/session-manager');
const { advanceWorld } = require('../server/world-loop');
const { terminalCentre } = require('../server/group-save-system');

const projectRoot = path.join(__dirname, '..');

async function jsonRequest(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const json = await response.json();
  return { response, json };
}

test('live HTTP input can operate the host save computer and invalidates a missing phone seat after load', async (t) => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-group-save-server-'));
  t.after(() => fs.rmSync(storage, { recursive: true, force: true }));
  const sessionManager = new SessionManager({ projectRoot, groupSaveDirectory: storage });
  const runtime = createDistrictPartyServer({
    projectRoot,
    sessionManager,
    host: '127.0.0.1',
    port: 0,
    autoStartLoop: false,
    logger: { error() {} },
  });
  const address = await runtime.listen();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => runtime.close());

  const started = await jsonRequest(base, '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      players: [
        { slot: 1, displayName: 'Connected', controllerType: 'human' },
        { slot: 2, displayName: 'Missing', controllerType: 'human' },
      ],
    }),
  });
  assert.equal(started.response.status, 201);
  const p1 = started.json.controllerLinks.find((link) => link.seatId === 'seat_1');
  const p2 = started.json.controllerLinks.find((link) => link.seatId === 'seat_2');
  const session = sessionManager.getSession(started.json.sessionId);
  session.world.actors['actor-seat-1'].position = terminalCentre(session.world.groupSaveComputer.terminal);
  session.world.actors['actor-seat-1'].walletCents = 45_678;

  let seq = 0;
  async function input(fields) {
    return jsonRequest(base, '/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'AXM1', sessionId: session.id, seatId: 'seat_1', token: p1.token,
        seq: ++seq, input: fields,
      }),
    });
  }
  async function tick(fields) {
    const routed = await input(fields);
    assert.equal(routed.response.status, 200);
    advanceWorld(sessionManager.getRunningSession().world);
    return sessionManager.processPendingGroupSaveOperation(sessionManager.getRunningSession());
  }

  await tick({ action: true });
  await tick({ action: false });
  await tick({ action: true });
  await tick({ action: false });
  const saved = await tick({ action: true });
  assert.equal(saved.ok, true);
  assert.equal(saved.operation, 'save');
  const catalog = await jsonRequest(base, '/api/group-saves');
  assert.equal(catalog.json.slots[0].status, 'ready');
  assert.equal(catalog.json.slots[0].seatCount, 2);

  sessionManager.getRunningSession().world.actors['actor-seat-1'].walletCents = 1;
  await tick({ action: false, moveX: 1 });
  await tick({ moveX: 0 });
  await tick({ action: true });
  await tick({ action: false });
  const loaded = await tick({ action: true });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.operation, 'load');
  assert.equal(loaded.hostAiFilledSeats, 1);

  const active = sessionManager.getRunningSession();
  assert.equal(active.world.actors['actor-seat-1'].walletCents, 45_678);
  assert.equal(active.world.actors['actor-seat-2'].controller, 'ai');
  assert.deepEqual(active.controllerLinks.map((link) => link.seatId), ['seat_1']);
  const oldMissingPhone = await jsonRequest(base, '/api/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'AXM1', sessionId: active.id, seatId: 'seat_2', token: p2.token,
      seq: 1, input: { moveY: 1 },
    }),
  });
  assert.equal(oldMissingPhone.response.status, 403);
  assert.equal(oldMissingPhone.json.reason, 'seat-host-controlled');

  const restoredP1 = await input({ moveY: -1 });
  assert.equal(restoredP1.response.status, 200, 'connected human keeps its original seat token after load');
});
