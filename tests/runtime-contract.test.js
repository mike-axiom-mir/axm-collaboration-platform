'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMirrorRuntime } = require('../runtime/server');

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

test('runtime exposes public truth but protects reasoning with a token and explicit session', async t => {
  const runtime = createMirrorRuntime({ config: { host: '127.0.0.1', port: 0, presenceEnabled: false }, token: 't'.repeat(64), persist: false, presence: false });
  await runtime.start();
  t.after(() => runtime.stop());
  const base = `http://127.0.0.1:${runtime.port}`;
  const health = await json(base + '/health');
  assert.equal(health.body.learnedWeights, false);
  assert.equal(health.body.outsideNetworkCalls, false);
  const denied = await json(base + '/axm/v1/session/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(denied.response.status, 401);
  const headers = { authorization: `Bearer ${'t'.repeat(64)}`, 'content-type': 'application/json' };
  const opened = await json(base + '/axm/v1/session/open', { method: 'POST', headers, body: JSON.stringify({ actor: { id: 'test', kind: 'test' } }) });
  assert.equal(opened.response.status, 201);
  const sessionId = opened.body.session.id;
  const traced = await json(base + '/axm/v1/reason', { method: 'POST', headers, body: JSON.stringify({
    sessionId, goal: 'Test one bounded candidate.',
    evidence: [{ id: 'proof', kind: 'test', statement: 'Passed.', source: { kind: 'test', id: 'runtime' } }],
    actions: [{ id: 'hold', kind: 'hold', label: 'Hold safely', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'No mutation.' }]
  }) });
  assert.equal(traced.response.status, 200);
  assert.equal(traced.body.trace.identity, 'axm.machine.mirror/seed-0');
  const fetched = await json(base + `/axm/v1/trace/${traced.body.trace.traceId}`, { headers });
  assert.equal(fetched.body.trace.traceId, traced.body.trace.traceId);
  const closed = await json(base + '/axm/v1/session/close', { method: 'POST', headers, body: JSON.stringify({ sessionId }) });
  assert.deepEqual(closed.body.session.memoryWrites, []);
});

test('runtime refuses non-loopback binding', () => {
  assert.throws(() => createMirrorRuntime({ config: { host: '0.0.0.0', port: 0 }, token: 'x'.repeat(64), persist: false, presence: false }), /non-loopback/);
});
