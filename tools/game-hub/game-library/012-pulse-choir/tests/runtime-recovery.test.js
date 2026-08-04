#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const checkpoints = require('../runtime/checkpoint-store');
const core = require('../runtime/game-core');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'runtime', 'server.js');
const roster = [{ slot: 1, seat_id: 'seat_1', display_name: 'Recovery Player', type: 'human' }];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function request(base, pathname, options) {
  const response = await fetch(base + pathname, options);
  const value = await response.json();
  return { response, value };
}

async function waitForHealth(base, child, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 7000);
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('runtime exited before health: ' + child.output.join(''));
    try {
      const result = await request(base, '/health');
      if (result.response.ok) return result.value;
    } catch (error) { lastError = error; }
    await delay(80);
  }
  throw lastError || new Error('runtime health timeout');
}

async function startRuntime(stateFile, extraEnv) {
  const port = await freePort();
  const child = childProcess.spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      HOST: '127.0.0.1',
      PORT: String(port),
      AXM_GAME_SESSION_ID: 'recovery-test-' + Date.now(),
      AXM_PLAYERS_JSON: JSON.stringify(roster),
      PULSE_CHOIR_STATE_FILE: stateFile,
      PULSE_CHOIR_RECOVERY_TTL_MS: '60000',
      PULSE_CHOIR_SEED: '12026'
    }, extraEnv || {}),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.output = [];
  child.stdout.on('data', chunk => child.output.push(String(chunk)));
  child.stderr.on('data', chunk => child.output.push(String(chunk)));
  const base = 'http://127.0.0.1:' + port;
  const health = await waitForHealth(base, child);
  return { base, child, health };
}

async function stopRuntime(runtime) {
  if (!runtime || runtime.child.exitCode !== null) return;
  runtime.child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => runtime.child.once('exit', resolve)),
    delay(3000).then(() => { throw new Error('runtime did not stop after SIGTERM'); })
  ]);
}

async function main() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-choir-recovery-test-'));
  const stateFile = path.join(temporaryDirectory, 'checkpoint.json');
  let runtime;
  try {
    runtime = await startRuntime(stateFile);
    assert.equal(runtime.health.recovery.status, 'fresh');
    let result = await request(runtime.base, '/api/start', { method: 'POST' });
    assert.equal(result.response.status, 200);
    await delay(3250);
    result = await request(runtime.base, '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', action: { type: 'move', x: 1, y: 0, seq: 1 } })
    });
    assert.equal(result.response.status, 200);
    await delay(140);
    const before = (await request(runtime.base, '/api/state')).value;
    assert.equal(before.state.phase, 'playing');
    assert.equal(before.state.players.p1.lastSequence, 1);
    assert(before.state.players.p1.input.x > 0);
    const beforePosition = before.state.players.p1.x;
    const beforeRemaining = before.state.timeLeftMs;
    await stopRuntime(runtime);
    runtime = null;
    const validActiveCheckpoint = fs.readFileSync(stateFile, 'utf8');

    await delay(900);
    runtime = await startRuntime(stateFile);
    assert.equal(runtime.health.recovery.status, 'restored');
    assert(runtime.health.recovery.sourceAgeMs >= 800);
    const restored = (await request(runtime.base, '/api/state')).value;
    assert.equal(restored.recovery.status, 'restored');
    assert.equal(restored.state.phase, 'playing');
    assert.equal(restored.state.seed, before.state.seed);
    assert.deepEqual(restored.state.setlist.conductor, before.state.setlist.conductor);
    assert.deepEqual(restored.state.show.next.conductor, before.state.show.next.conductor);
    assert(restored.state.show.next.conductor.cue);
    assert.equal(restored.state.show.roundNumber, before.state.show.roundNumber);
    assert.equal(restored.state.score, before.state.score);
    assert.equal(restored.state.players.p1.lastSequence, 1);
    assert.equal(restored.state.players.p1.input.x, 0);
    assert.equal(restored.state.players.p1.input.y, 0);
    assert(Math.abs(restored.state.players.p1.x - beforePosition) < 5);
    assert(Math.abs(restored.state.timeLeftMs - beforeRemaining) < 900);

    await delay(420);
    const settled = (await request(runtime.base, '/api/state')).value;
    assert(Math.abs(settled.state.players.p1.x - restored.state.players.p1.x) < 0.05);
    result = await request(runtime.base, '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', action: { type: 'move', x: -1, y: 0, seq: 1 } })
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.value.reason, 'stale-sequence');
    result = await request(runtime.base, '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', action: { type: 'move', x: 0, y: 0, seq: 2 } })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.value.state.players.p1.lastSequence, 2);

    await stopRuntime(runtime);
    runtime = null;
    const normalizedRoster = core.normalizeRoster(roster);
    const signalState = core.createInitialState(normalizedRoster, { seed: 12026, now: 0 });
    core.startRound(signalState, 0);
    core.step(signalState, core.METRICS.countdownMs, core.METRICS.countdownMs);
    core.finishRound(signalState, 80000);
    assert.equal(core.applyRoomSignal(signalState, 'p1', 'bold', 80001).ok, true);
    const signalStore = checkpoints.createCheckpointStore({
      clock: () => Date.now(),
      env: { AXM_GAME_SESSION_ID: 'room-signal-recovery-test' },
      filePath: stateFile,
      roster: normalizedRoster,
      ttlMs: 60000
    });
    assert.equal(signalStore.save(signalState, true), true);
    runtime = await startRuntime(stateFile);
    assert.equal(runtime.health.recovery.status, 'restored');
    const signalRestored = (await request(runtime.base, '/api/state')).value;
    assert.deepEqual(signalRestored.state.show.roomSignal.votes, { p1: 'bold' });
    assert.equal(signalRestored.state.show.next.conductor.roomSignal.choice, 'bold');
    assert.deepEqual(signalRestored.state.show.next.acts.map(act => act.kind), ['human-triad', 'all-seat-bank', 'wild-two']);

    result = await request(runtime.base, '/api/new-show', { method: 'POST' });
    assert.equal(result.response.status, 200);
    assert.equal(result.value.state.phase, 'lobby');
    assert.equal(result.value.state.show.completedRounds, 0);
    assert.equal(result.value.recovery.status, 'fresh');
    await stopRuntime(runtime);
    runtime = null;

    fs.writeFileSync(stateFile, '{', 'utf8');
    runtime = await startRuntime(stateFile);
    assert.equal(runtime.health.recovery.status, 'corrupt');
    assert.equal(runtime.health.phase, 'lobby');
    await stopRuntime(runtime);
    runtime = null;

    const expired = JSON.parse(validActiveCheckpoint);
    expired.savedAt = Date.now() - 5000;
    fs.writeFileSync(stateFile, JSON.stringify(expired), 'utf8');
    runtime = await startRuntime(stateFile, { PULSE_CHOIR_RECOVERY_TTL_MS: '1000' });
    assert.equal(runtime.health.recovery.status, 'expired');
    assert.equal(runtime.health.phase, 'lobby');
    await stopRuntime(runtime);
    runtime = null;

    fs.writeFileSync(stateFile, validActiveCheckpoint, 'utf8');
    runtime = await startRuntime(stateFile, {
      AXM_PLAYERS_JSON: JSON.stringify([{ slot: 1, seat_id: 'seat_other', display_name: 'Other Player', type: 'human' }])
    });
    assert.equal(runtime.health.recovery.status, 'roster-mismatch');
    assert.equal(runtime.health.phase, 'lobby');
    await stopRuntime(runtime);
    runtime = null;

    console.log('Pulse Choir recovery: PASS (fresh-process restore, Room Signal persistence, paused clock, neutral input, sequence continuity, new show, corruption, expiry, roster mismatch)');
  } finally {
    if (runtime) await stopRuntime(runtime).catch(() => {});
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
