'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Compatibility = require('../foundation-adapter/pr13-compatibility');
const { runCompatibilityHarness } = require('../foundation-adapter/compatibility-harness');
const { tempCore, entity } = require('./helpers');

test('Foundation compatibility contract is frozen to PR 13 and reports standalone status honestly', function (t) {
  const { core } = tempCore(t);
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'foundation-adapter', 'foundation-contract.json'), 'utf8'));
  const descriptor = Compatibility.discoveryDescriptor(core);
  assert.equal(contract.$id, descriptor.schema_version);
  assert.equal(descriptor.source_reference.head_sha, '33a87549259d8b4a7ce4753ee1fab49e0ee8091d');
  assert.equal(descriptor.status, 'standalone_foundation_compatibility_harness');
  assert.equal(descriptor.runtime.foundation_installed, false);
  assert.equal(descriptor.boundaries.default_deny_permissions, true);
  assert.equal(runCompatibilityHarness({ core }).status, 'PASS');
});

test('Foundation wrappers expose references and next decisions, never silent writes', function (t) {
  const { core } = tempCore(t);
  const value = entity(core, 'foundation');
  const registration = Compatibility.entityRegistrationProposal(value, 'actor:human:mike');
  assert.equal(registration.data.mode, 'proposal_only');
  assert.equal(registration.data.automatic_write, false);
  const intent = Compatibility.adapterConnectionIntent(core.adapters.world.descriptor, 'consent:local:mock-world', 'approved_apply');
  assert.equal(intent.connected, false);
  assert.equal(intent.next_required_action, 'mirror_gate_authorization');
  const boundary = Compatibility.sharedControlBoundary();
  assert.equal(boundary.max_seats, 8);
  assert.equal(boundary.default_ai_fill, false);
  assert.equal(boundary.actor_control_parity, true);
  assert.equal(boundary.ai_observation_scope, 'seat_player_view_only');
  assert.equal(boundary.mirror_core_runs_game_loop, false);
  assert.notEqual(boundary.live_action_shape, boundary.durable_change_shape);
});
