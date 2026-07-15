'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMirrorServer } = require('../server/server');
const { tempCore, proposalInput, MIKE_ID, AI_ID } = require('./helpers');

async function request(base, method, pathname, body) {
  const response = await fetch(base + pathname, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const value = await response.json();
  if (!response.ok) throw new Error(pathname + ' returned ' + response.status + ': ' + JSON.stringify(value));
  return value;
}

test('real local HTTP API completes proposal through rollback and shuts down cleanly', async function (t) {
  const { core } = tempCore(t);
  const app = createMirrorServer({ core, port: 0 });
  const info = await app.start();
  try {
    const health = await request(info.url, 'GET', '/health');
    assert.equal(health.ok, true);
    assert.equal(health.local_only, true);
    const discovery = await request(info.url, 'GET', '/foundation/discovery');
    assert.equal(discovery.status, 'standalone_foundation_compatibility_harness');

    const created = await request(info.url, 'POST', '/mirror/proposals', proposalInput({ intent: 'API smoke packet' }));
    const packetId = created.packet.packet_id;
    assert.equal(created.packet.status, 'DRAFT');
    assert.equal((await request(info.url, 'POST', '/mirror/proposals/' + encodeURIComponent(packetId) + '/validate', { actor_id: AI_ID })).packet.status, 'VALIDATED');
    assert.equal((await request(info.url, 'POST', '/mirror/proposals/' + encodeURIComponent(packetId) + '/propose', { actor_id: AI_ID })).packet.status, 'PROPOSED');
    assert.equal((await request(info.url, 'POST', '/mirror/proposals/' + encodeURIComponent(packetId) + '/review', { actor_id: MIKE_ID, note: 'API review' })).packet.status, 'UNDER_REVIEW');
    const preview = await request(info.url, 'POST', '/mirror/proposals/' + encodeURIComponent(packetId) + '/preview', {});
    assert.equal(preview.preview.conflicts.length, 0);
    assert.equal((await request(info.url, 'POST', '/mirror/proposals/' + encodeURIComponent(packetId) + '/approve', { actor_id: MIKE_ID, reason: 'API approval' })).packet.status, 'APPROVED');
    const applied = await request(info.url, 'POST', '/mirror/proposals/' + encodeURIComponent(packetId) + '/apply', { actor_id: MIKE_ID });
    assert.equal(applied.status, 'APPLIED');
    const applicationId = applied.receipt.application_id;
    const verified = await request(info.url, 'POST', '/mirror/applications/' + encodeURIComponent(applicationId) + '/verify', { actor_id: MIKE_ID });
    assert.equal(verified.ok, true);
    const rolled = await request(info.url, 'POST', '/mirror/applications/' + encodeURIComponent(applicationId) + '/rollback', { actor_id: MIKE_ID });
    assert.equal(rolled.rollback.status, 'ROLLED_BACK');

    const entities = await request(info.url, 'GET', '/mirror/entities');
    const proposals = await request(info.url, 'GET', '/mirror/proposals');
    const events = await request(info.url, 'GET', '/mirror/events');
    const snapshots = await request(info.url, 'GET', '/mirror/snapshots');
    const adapters = await request(info.url, 'GET', '/mirror/adapters');
    assert.equal(Array.isArray(entities.items), true);
    assert.equal(proposals.items.some(function (item) { return item.packet_id === packetId && item.status === 'ROLLED_BACK'; }), true);
    assert.equal(events.items.some(function (item) { return item.event_type === 'rollback_completed'; }), true);
    assert.equal(snapshots.items.length >= 3, true);
    assert.equal(adapters.items.every(function (item) { return item.health.ok; }), true);
  } finally {
    await app.stop();
  }
  assert.equal(app.server.listening, false);
});

test('API refuses non-loopback server binding', function () {
  assert.throws(function () { createMirrorServer({ host: '0.0.0.0', port: 0 }); }, /refuses non-loopback/);
});
