#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Multiplayer = require('../../shared/operations/multiplayer-transport-service');

const PREFIX = 'axm-multiplayer-selftest-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
const root = path.join(temp, 'workshop');
const options = { root, stateRoot: path.join(root, 'state'), exportRoot: path.join(root, 'exports') };
let pass = 0;
let multiplayer = null;

function check(label, run) {
  run();
  pass += 1;
  console.log('PASS  ' + label);
}

async function checkAsync(label, run) {
  await run();
  pass += 1;
  console.log('PASS  ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function cleanup() {
  const resolved = path.resolve(temp), allowedRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowedRoot) || !path.basename(resolved).startsWith(PREFIX)) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

async function main() {
  try {
    fs.mkdirSync(options.stateRoot, { recursive: true });
    fs.mkdirSync(options.exportRoot, { recursive: true });

    const manifest = readJson('manifest.json');
    const contract = readJson('module.contract.json');
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    multiplayer = Multiplayer.create(options);

    check('manifest and contract bound temporary transport authority', () => {
      assert.equal(manifest.id, 'multiplayer-controller-transport');
      assert.equal(contract.id, manifest.id);
      assert.deepStrictEqual(contract.permissions, manifest.permissions);
      assert(contract.boundaries.refuses.includes('permanent-listener'));
      assert(contract.boundaries.refuses.includes('workshop-lan-exposure'));
      assert(contract.boundaries.refuses.includes('more-than-eight-seats'));
      assert(contract.boundaries.refuses.includes('whole-network-discovery'));
    });

    check('WebSocket text framing is bounded and reversible', () => {
      const short = Multiplayer.parseFrames(Multiplayer.textFrame({ type: 'ping' }));
      const mediumText = 'x'.repeat(300);
      const medium = Multiplayer.parseFrames(Multiplayer.textFrame(mediumText));
      assert.equal(JSON.parse(short.messages[0].data.toString()).type, 'ping');
      assert.equal(medium.messages[0].data.toString(), mediumText);
      assert.equal(short.rest.length, 0);
      assert.throws(() => Multiplayer.textFrame('x'.repeat(65536)), /exceeds 64 KB/);
    });

    const party = await multiplayer.start({ seats: 2, ttlMinutes: 2 }, 'selftest');

    await checkAsync('temporary sidecar serves real loopback health and controller HTML', async () => {
      const base = 'http://127.0.0.1:' + party.session.port;
      const health = await (await fetch(base + '/health')).json();
      const controller = await (await fetch(party.join[0].localUrl)).text();
      assert.equal(health.ok, true);
      assert.equal(health.seats, 2);
      assert(controller.includes('AXM Controller Transport'));
      assert.equal(party.workshopExposedToLan, false);
      assert(party.join.every(item => item.localUrl.startsWith(base + '/join?')));
    });

    await checkAsync('a second listener cannot start over an active party', async () => {
      await assert.rejects(multiplayer.start({ seats: 1, ttlMinutes: 2 }, 'selftest'), /already running/);
    });

    check('bounded controller input is normalized and drained as a typed packet', () => {
      const seat = { id: 'seat-1', messages: 0, rateLimited: 0, rateSecond: 0, rateCount: 0, lastSeenAt: null };
      const accepted = multiplayer.handleMessageForTest(seat, JSON.stringify({ type: 'input', seq: 7, axes: [-2, 0.5, 3], buttons: { action: 1, 'bad name': true } }));
      const packets = multiplayer.drainInputs();
      assert.equal(accepted.type, 'input-accepted');
      assert.equal(packets.length, 1);
      assert.equal(packets[0].schema, 'axm.controller-input/v1');
      assert.deepStrictEqual(packets[0].axes, [-1, 0.5, 1]);
      assert.deepStrictEqual(packets[0].buttons, { action: true });
    });

    check('calibration and rate limits remain bounded', () => {
      const seat = { id: 'seat-1', messages: 0, rateLimited: 0, rateSecond: 0, rateCount: 0, lastSeenAt: null };
      const recorded = multiplayer.handleMessageForTest(seat, JSON.stringify({ type: 'calibration', deadZone: 9, invertY: true, gamepad: { id: 'Test Pad', mapping: 'standard', axes: 99, buttons: 99 } }));
      assert.equal(recorded.type, 'calibration-recorded');
      assert.equal(recorded.calibration.deadZone, 0.6);
      assert.equal(recorded.calibration.gamepad.axes, 32);
      assert.equal(recorded.calibration.gamepad.buttons, 64);
      const rateSeat = { rateSecond: 0, rateCount: 0 };
      for (let index = 0; index < 60; index += 1) assert.equal(multiplayer.rateAllowed(rateSeat), true);
      assert.equal(multiplayer.rateAllowed(rateSeat), false);
    });

    check('invalid signaling targets and message types are refused', () => {
      const seat = { id: 'seat-1', messages: 0, rateLimited: 0, rateSecond: 0, rateCount: 0, lastSeenAt: null };
      assert.throws(() => multiplayer.handleMessageForTest(seat, JSON.stringify({ type: 'signal', targetSeatId: 'missing', kind: 'offer', payload: {} })), /target or kind invalid/);
      assert.throws(() => multiplayer.handleMessageForTest(seat, JSON.stringify({ type: 'take-over-host' })), /type is unsupported/);
    });

    check('public status exposes limits but never seat claim tokens', () => {
      const status = multiplayer.status();
      assert.equal(status.running, true);
      assert.equal(status.limits.seats, 8);
      assert.equal(status.limits.inputPerSeatPerSecond, 60);
      assert.equal(status.workshopExposedToLan, false);
      assert.equal(status.wholeNetworkDiscovery, false);
      assert(status.session.seats.every(seat => !Object.prototype.hasOwnProperty.call(seat, 'token') && !Object.prototype.hasOwnProperty.call(seat, 'tokenDigest')));
    });

    check('explicit stop closes the sidecar and persists a digest receipt', () => {
      const stopped = multiplayer.stop('selftest');
      assert.equal(stopped.stopped, true);
      assert.equal(stopped.receipt.seats.length, 2);
      assert.equal(stopped.receipt.workshopExposedToLan, false);
      assert.match(stopped.receipt.digest, /^[a-f0-9]{64}$/);
      assert.equal(multiplayer.status().running, false);
      assert.equal(multiplayer.status().receipts.length, 1);
      assert.equal(multiplayer.stop('selftest').stopped, false);
    });

    check('browser surface makes start and stop explicit', () => {
      assert(app.includes("O.post('/api/multiplayer-transport/start'"));
      assert(app.includes("O.post('/api/multiplayer-transport/stop'"));
      assert(app.includes("'x-axm-multiplayer':'explicit-listen'"));
      assert(app.includes("'x-axm-multiplayer':'explicit-stop'"));
    });

    console.log('Multiplayer & Controller Transport selftest: PASS (' + pass + ' controls)');
  } finally {
    if (multiplayer && multiplayer.status().running) multiplayer.stop('selftest-cleanup');
    cleanup();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
