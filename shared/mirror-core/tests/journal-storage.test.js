'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const HashChain = require('../journal/hash-chain');
const { clone } = require('../core/utils');
const { tempCore, proposalInput, MIKE_ID, AI_ID } = require('./helpers');

test('journal events append in order with previous hashes and actor/packet attribution', function (t) {
  const { core } = tempCore(t);
  const packet = core.createProposal(proposalInput());
  core.validateProposal(packet.packet_id, AI_ID);
  const events = core.journal.read();
  assert.equal(events.length > 2, true);
  events.forEach(function (event, index) {
    assert.equal(event.previous_hash, index === 0 ? null : events[index - 1].event_hash);
  });
  const created = events.find(function (event) { return event.event_type === 'proposal_created' && event.related_packet === packet.packet_id; });
  assert.equal(created.actor.actor_id, AI_ID);
  assert.equal(core.journal.verify().ok, true);
});

test('altered event content causes tamper verification failure', function (t) {
  const { core } = tempCore(t);
  const events = clone(core.journal.read());
  events[1].payload = { altered: true };
  const checked = HashChain.verify(events);
  assert.equal(checked.ok, false);
  assert.equal(checked.errors.some(function (error) { return /hash mismatch/.test(error); }), true);
});

test('snapshot file can be resolved and its journal reference is preserved', function (t) {
  const { core } = tempCore(t);
  const snapshot = core.snapshots.capture(core.adapters.world, core.actor(MIKE_ID), 'test-capture', 'packet:test:snapshot');
  const loaded = core.snapshots.get(snapshot.snapshot_id);
  assert.equal(loaded.state_hash, snapshot.state_hash);
  assert.equal(loaded.related_packet, 'packet:test:snapshot');
  const event = core.journal.read().find(function (item) {
    return item.event_type === 'snapshot_created' && item.payload.snapshot_id === snapshot.snapshot_id;
  });
  assert.equal(event.actor.actor_id, MIKE_ID);
  assert.equal(event.related_packet, 'packet:test:snapshot');
});
