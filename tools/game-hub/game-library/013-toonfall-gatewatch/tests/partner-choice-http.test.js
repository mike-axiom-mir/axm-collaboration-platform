#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createRuntime } = require('../runtime/server');

let now = 1000;
const runtime = createRuntime({
  manualTick: true,
  clock: () => now,
  roster: [
    { seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
    { seat_id: 'seat_2', display_name: 'Nova', type: 'adapter', adapter_id: 'nova' }
  ]
});

function request(base, route, options) {
  return fetch(base + route, options).then(async response => ({ response, body: await response.json() }));
}

(async () => {
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(0, '127.0.0.1', resolve);
  });
  const base = 'http://127.0.0.1:' + runtime.server.address().port;
  try {
    let result = await request(base, '/api/launcher-state');
    assert.strictEqual(result.body.team.partnerMode, 'connected-ai');
    assert.strictEqual(result.body.adapterBindings.length, 1);
    const binding = result.body.adapterBindings[0];
    assert.strictEqual(binding.actorId, 'p2');

    result = await request(base, '/api/adapter-observation?seat=seat_2');
    assert.strictEqual(result.response.status, 403);
    result = await request(base, '/api/adapter-observation?seat=seat_2', { headers: { 'x-axm-seat-token': binding.token } });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.observation.actorId, 'p2');
    assert.strictEqual(result.body.observation.controls.nextSequenceMinimum, 1);

    for (let index = 0; index < 3; index += 1) {
      now += 10;
      await request(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player: 'p1', action: { type: 'story-next' } }) });
    }
    now += 10;
    await request(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player: 'p1', action: { type: 'start' } }) });

    result = await request(base, '/api/input', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seatId: binding.seatId, token: binding.token, seq: 1, input: { moveX: 1, aimX: 1, fire: true } })
    });
    assert.strictEqual(result.response.status, 200);
    now += 50;
    runtime.advance(now);
    assert(runtime.getState().ally.x > 1145);
    result = await request(base, '/api/input', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seatId: binding.seatId, token: binding.token, seq: 1, input: { moveX: -1 } })
    });
    assert.strictEqual(result.response.status, 409);
    console.log('Bloomvale partner-choice HTTP test: PASS');
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
