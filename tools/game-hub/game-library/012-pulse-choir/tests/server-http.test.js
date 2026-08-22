#!/usr/bin/env node
'use strict';

const assert = require('assert');
const runtimeModule = require('../runtime/server');

async function request(base, pathname, options) {
  const response = await fetch(base + pathname, options);
  const contentType = response.headers.get('content-type') || '';
  const value = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, value };
}

async function main() {
  let now = 1000;
  const runtime = runtimeModule.createRuntime({
    roster: [
      { slot: 1, seatId: 'seat_1', name: 'HTTP Player', type: 'human' },
      { slot: 2, seatId: 'seat_2', name: 'HTTP Tempo', type: 'ai' }
    ],
    clock: () => now,
    manualTick: true,
    checkpoint: false
  });
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(0, '127.0.0.1', resolve);
  });
  const port = runtime.server.address().port;
  const base = 'http://127.0.0.1:' + port;
  try {
    let result = await request(base, '/health');
    assert.equal(result.response.status, 200);
    assert.equal(result.value.gameId, '012-pulse-choir');
    assert.equal(result.value.stateAuthority, 'server');
    assert.equal(result.value.recovery.status, 'disabled');
    assert.equal(result.value.showRound, 0);

    result = await request(base, '/');
    assert.equal(result.response.status, 200);
    assert(String(result.value).includes('Pulse Choir'));

    result = await request(base, '/controller.html?player=p1');
    assert.equal(result.response.status, 200);
    assert(String(result.value).includes('Movement joystick'));

    result = await request(base, '/games/012/arena-3d.js');
    assert.equal(result.response.status, 200);
    assert(String(result.value).includes("getContext('webgl'"));

    result = await request(base, '/api/start', { method: 'POST' });
    assert.equal(result.response.status, 200);
    assert.equal(result.value.state.phase, 'countdown');
    assert.equal(result.value.state.show.roundNumber, 1);
    const firstSeed = result.value.state.seed;
    const firstActs = result.value.state.setlist.acts.map(act => act.kind);
    assert.equal(result.value.state.setlist.conductor.mode, 'opening');
    now += 3000;
    runtime.advance(now);

    result = await request(base, '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', action: { type: 'move', x: 1, y: 0, seq: 1 } })
    });
    assert.equal(result.response.status, 200);
    const before = result.value.state.players.p1.x;
    now += 100;
    runtime.advance(now);

    result = await request(base, '/api/state');
    assert.equal(result.value.state.phase, 'playing');
    assert(result.value.state.players.p1.x > before);
    assert.equal(result.value.state.setlist.activeIndex, 0);
    assert.equal(result.value.state.setlist.acts.length, 3);
    assert.equal(result.value.authority, 'server');
    assert.equal(result.value.recovery.status, 'disabled');

    result = await request(base, '/api/observe?player=p1');
    assert.equal(result.response.status, 200);
    assert.equal(result.value.observation.player.name, 'HTTP Player');
    assert.equal(result.value.observation.setlist.schema, 'axm.pulse-choir-live-setlist/v1');
    assert.equal(result.value.observation.show.schema, 'axm.pulse-choir-show-arc/v1');
    assert.equal(result.value.observation.venue.id, 'moonwell-atrium');

    result = await request(base, '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', action: { type: 'move', x: -1, y: 0, seq: 1 } })
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.value.reason, 'stale-sequence');

    result = await request(base, '/api/telemetry');
    assert.equal(result.response.status, 200);
    assert.equal(result.value.schema, 'axm.pulse-choir-telemetry/v1');

    now += 75000;
    runtime.advance(now);
    result = await request(base, '/api/state');
    assert.equal(result.value.state.phase, 'results');
    assert.equal(result.value.state.show.completedRounds, 1);
    assert.equal(result.value.state.show.history.length, 1);
    let nextPreview = result.value.state.show.next;
    assert.notEqual(nextPreview.seed, firstSeed);
    assert.notDeepEqual(nextPreview.acts.map(act => act.kind), firstActs);
    assert.equal(nextPreview.conductor.mode, 'reconnect');
    assert.equal(nextPreview.conductor.sourceRound, 1);
    assert.equal(nextPreview.conductor.cue, 'CLEARER HUMAN LINK');

    result = await request(base, '/api/room-signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p2', choice: 'bold' })
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.value.reason, 'room-signal-human-only');
    result = await request(base, '/api/room-signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', choice: 'not-a-signal' })
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.value.reason, 'invalid-room-signal');
    result = await request(base, '/api/room-signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', choice: 'together' })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.value.roomSignal.choice, 'together');
    assert.equal(result.value.roomSignal.totalVotes, 1);
    assert.deepEqual(result.value.state.show.roomSignal.votes, { p1: 'together' });
    assert.deepEqual(result.value.state.show.next.acts.map(act => act.kind), ['human-pulses', 'perfect-choir', 'chain-four']);
    nextPreview = result.value.state.show.next;

    result = await request(base, '/api/start', { method: 'POST' });
    assert.equal(result.response.status, 200);
    assert.equal(result.value.state.show.roundNumber, 2);
    assert.equal(result.value.state.seed, nextPreview.seed);
    assert.equal(result.value.state.venue.id, 'prism-causeway');
    assert.equal(result.value.state.beats.length, 16);
    assert.deepEqual(result.value.state.setlist.acts.map(act => act.kind), nextPreview.acts.map(act => act.kind));
    assert.deepEqual(result.value.state.setlist.conductor, nextPreview.conductor);

    result = await request(base, '/api/reset', { method: 'POST' });
    assert.equal(result.value.state.phase, 'lobby');
    assert.equal(result.value.state.show.completedRounds, 1);
    assert.equal(result.value.state.show.next.roundNumber, 2);
    result = await request(base, '/api/start', { method: 'POST' });
    assert.equal(result.value.state.show.roundNumber, 2);
    assert.equal(result.value.state.seed, nextPreview.seed);
    result = await request(base, '/api/reset', { method: 'POST' });
    console.log('Pulse Choir HTTP lifecycle: PASS (health, static, controller, start, action, show memory, human-only Room Signal, evolving replay, observation, sequence refusal, telemetry, reset)');
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
