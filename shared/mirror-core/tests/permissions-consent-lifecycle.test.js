'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Lifecycle = require('../gate/proposal-lifecycle');
const { tempCore, actor, proposalInput, approve, createApproved, MIKE_ID, AI_ID } = require('./helpers');

test('read does not grant propose, propose does not grant apply, and AI remains attributed', function (t) {
  const { core } = tempCore(t);
  const readOnly = actor('actor:human:reader', 'Reader', [
    { permission: 'read_entity', effect: 'allow', scope: { type: 'global' } }
  ]);
  core.registry.registerActor(readOnly);
  assert.equal(core.permissionEngine.evaluate(readOnly.actor_id, 'read_entity', {}).allow, true);
  assert.equal(core.permissionEngine.evaluate(readOnly.actor_id, 'create_proposal', {}).allow, false);
  assert.equal(core.permissionEngine.evaluate(AI_ID, 'create_proposal', { system_id: 'mock-platform' }).allow, true);
  assert.equal(core.permissionEngine.evaluate(AI_ID, 'apply_change', { system_id: 'mock-platform' }).allow, false);
  const packet = core.createProposal(proposalInput());
  const event = core.journal.read().find(function (item) { return item.related_packet === packet.packet_id && item.event_type === 'proposal_created'; });
  assert.equal(packet.actor.actor_type, 'ai');
  assert.equal(event.actor.actor_id, AI_ID);
});

test('permission scope is exact and default deny', function (t) {
  const { core } = tempCore(t);
  const scoped = actor('actor:human:scoped', 'Scoped', [
    { permission: 'apply_change', effect: 'allow', scope: { type: 'project', project_id: 'p1' } }
  ]);
  core.registry.registerActor(scoped);
  assert.equal(core.permissionEngine.evaluate(scoped.actor_id, 'apply_change', { project_id: 'p1' }).allow, true);
  assert.equal(core.permissionEngine.evaluate(scoped.actor_id, 'apply_change', { project_id: 'p2' }).allow, false);
  assert.match(core.permissionEngine.evaluate(scoped.actor_id, 'approve_proposal', {}).reason, /default deny/);
});

test('revoked and expired consent receipts block covered operations', function (t) {
  const { core } = tempCore(t);
  const adapter = core.adapters.platform;
  const context = {
    adapter_id: adapter.descriptor.adapter_id,
    system_id: adapter.descriptor.source_system_id,
    granted_to: 'actor:local_service:mirror-core',
    connection_mode: 'approved_apply',
    operation: 'apply_change',
    scope: { type: 'adapter', adapter_id: adapter.descriptor.adapter_id }
  };
  assert.equal(core.consentEngine.evaluate(context).allow, true);
  core.consentEngine.revoke('consent:local:mock-platform', core.actor(MIKE_ID));
  assert.equal(core.consentEngine.evaluate(context).allow, false);

  const expired = core.consentFor(adapter);
  expired.consent_id = 'consent:test:expired';
  expired.starts_at = new Date(Date.now() - 60_000).toISOString();
  expired.expires_at = new Date(Date.now() - 1_000).toISOString();
  core.consentEngine.grant(expired, core.actor(MIKE_ID));
  assert.equal(core.consentEngine.evaluate(context).allow, false);
});

test('revoked consent blocks an already approved packet at the real apply gate', function (t) {
  const { core } = tempCore(t);
  const packet = createApproved(core, { intent: 'Revoked consent apply test' });
  core.consentEngine.revoke('consent:local:mock-platform', core.actor(MIKE_ID));
  assert.throws(function () { core.apply(packet.packet_id, MIKE_ID); }, /no active consent receipt/);
  assert.equal(core.adapters.platform.currentRevision(), 0);
});

test('expired consent blocks an already approved packet at the real apply gate', function (t) {
  const { core } = tempCore(t);
  const packet = createApproved(core, { intent: 'Expired consent apply test' });
  core.store.mutate(function (state) {
    state.consents['consent:local:mock-platform'].expires_at = new Date(Date.now() - 1000).toISOString();
  }, { authority: true });
  assert.throws(function () { core.apply(packet.packet_id, MIKE_ID); }, /no active consent receipt/);
  assert.equal(core.adapters.platform.currentRevision(), 0);
});

test('consent project scope does not leak to another project', function (t) {
  const { core } = tempCore(t);
  const adapter = core.adapters.platform;
  core.consentEngine.revoke('consent:local:mock-platform', core.actor(MIKE_ID));
  const receipt = core.consentFor(adapter);
  receipt.consent_id = 'consent:test:project';
  receipt.scope = { type: 'project', project_id: 'p1' };
  core.consentEngine.grant(receipt, core.actor(MIKE_ID));
  const base = {
    adapter_id: adapter.descriptor.adapter_id,
    system_id: adapter.descriptor.source_system_id,
    granted_to: 'actor:local_service:mirror-core',
    connection_mode: 'approved_apply',
    operation: 'apply_change'
  };
  assert.equal(core.consentEngine.evaluate(Object.assign({}, base, { project_id: 'p1' })).allow, true);
  assert.equal(core.consentEngine.evaluate(Object.assign({}, base, { project_id: 'p2' })).allow, false);
});

test('proposal lifecycle accepts legal transitions and rejects illegal terminal transitions', function () {
  const packet = { status: 'DRAFT' };
  ['VALIDATED', 'PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'APPLYING', 'APPLIED', 'VERIFIED', 'ROLLED_BACK'].forEach(function (state) {
    Lifecycle.transition(packet, state);
  });
  assert.equal(packet.status, 'ROLLED_BACK');
  assert.throws(function () { Lifecycle.transition(packet, 'DRAFT'); }, /illegal proposal transition/);
  const rejected = { status: 'REJECTED' };
  assert.throws(function () { Lifecycle.transition(rejected, 'APPLYING'); }, /illegal proposal transition/);
  const conflicted = { status: 'CONFLICTED' };
  assert.equal(Lifecycle.transition(conflicted, 'DRAFT').status, 'DRAFT');
});

test('rejected, conflicted, and expired proposals cannot apply', function (t) {
  const { core } = tempCore(t);
  const rejected = core.createProposal(proposalInput({ intent: 'Rejected test' }));
  core.validateProposal(rejected.packet_id, AI_ID);
  core.propose(rejected.packet_id, AI_ID);
  core.review(rejected.packet_id, MIKE_ID, 'review');
  core.reject(rejected.packet_id, MIKE_ID, 'no');
  assert.throws(function () { core.apply(rejected.packet_id, MIKE_ID); }, /only an APPROVED proposal/);

  const expired = createApproved(core, { intent: 'Expired test' });
  core.store.mutate(function (state) { state.proposals[expired.packet_id].expires_at = new Date(Date.now() - 1000).toISOString(); });
  const expiredResult = core.apply(expired.packet_id, MIKE_ID);
  assert.equal(expiredResult.applied, false);
  assert.equal(expiredResult.status, 'CONFLICTED');
  assert.equal(expiredResult.conflicts.some(function (item) { return item.type === 'incompatible_schema'; }), true);

  const conflicted = core.store.read().proposals[expired.packet_id];
  assert.equal(conflicted.status, 'CONFLICTED');
  assert.throws(function () { core.apply(expired.packet_id, MIKE_ID); }, /only an APPROVED proposal/);
});

test('approval does not grant adapter connection', function (t) {
  const { core } = tempCore(t);
  const packet = core.createProposal(proposalInput({ intent: 'Disconnected apply test' }));
  approve(core, packet.packet_id);
  core.bridge.disconnect('adapter:mock:platform', core.actor(MIKE_ID));
  const result = core.apply(packet.packet_id, MIKE_ID);
  assert.equal(result.applied, false);
  assert.equal(result.conflicts.some(function (item) { return item.type === 'adapter_disconnected'; }), true);
});
