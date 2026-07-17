'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test('connected AI reads only its token-bound observation then sends ordinary semantic intent', async () => {
  const { ConnectedAiSeatClient } = await import(pathToFileURL(path.join(root, 'src', 'ai', 'connected-ai-client.mjs')).href);
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) {
      return response({
        ok: true, observationType: 'axm-seat-screen-semantics-v1',
        self: { id: 'actor-seat-2' }, visible: { actors: [] },
        controls: { nextSequenceMinimum: 12 },
      });
    }
    const packet = JSON.parse(options.body);
    return response({ ok: true, acceptedSeq: packet.seq });
  };
  const client = new ConnectedAiSeatClient({
    identity: {
      roomCode: 'AXM1', sessionId: 'session-ai', seatId: 'seat_2', token: 'private-adapter-token',
      hostToken: 'must-not-be-forwarded', adapterId: 'foundation-ai-alpha',
    },
    baseUrl: 'http://127.0.0.1:8795/',
    observationUrl: '/api/adapter-observation', inputUrl: '/api/input', fetchImpl,
    policy: async () => ({ moveX: 1, moveY: 0, claimedHit: 'ignored-by-host' }),
  });
  const result = await client.step();
  assert.ok(result);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers['X-AXM-Seat-Token'], 'private-adapter-token');
  assert.doesNotMatch(calls[0].url, /private-adapter-token/);
  const packet = JSON.parse(calls[1].options.body);
  assert.equal(packet.seq, 12);
  assert.equal(packet.seatId, 'seat_2');
  assert.equal('hostToken' in packet, false);
  assert.equal('adapterId' in packet, false);
  assert.deepEqual(packet.input, { moveX: 1, moveY: 0, claimedHit: 'ignored-by-host' });
  assert.equal(client.sequence, 12);
});
