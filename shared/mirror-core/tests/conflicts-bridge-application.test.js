'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { clone, deepEqual } = require('../core/utils');
const { normalizedAdapterState } = require('../demo/demo-flow');
const { tempCore, entity, proposalInput, createApproved, MIKE_ID, AI_ID } = require('./helpers');

function types(core, packet) {
  return core.conflictDetector.detect(packet, core.adapters.platform).map(function (item) { return item.type; });
}

test('conflict detector catches stale, missing, unsupported, incompatible, disconnected, and authority changes', function (t) {
  const { core } = tempCore(t);
  const packet = core.createProposal(proposalInput({
    operations: [{ type: 'update_fields', native_id: 'workspace-mirror-research', patch: { description: 'bounded update' } }]
  }));

  const stale = clone(packet);
  stale.target_revision = 99;
  assert.equal(types(core, stale).includes('stale_target_snapshot'), true);

  const missing = clone(packet);
  missing.operations[0].native_id = 'missing-native';
  assert.equal(types(core, missing).includes('deleted_or_missing_target'), true);

  const unsupported = clone(packet);
  unsupported.operations = [{ type: 'map_native_entity', scope: 'target', mapping: null }];
  assert.equal(types(core, unsupported).includes('operation_unsupported_by_adapter'), true);

  const incompatible = clone(packet);
  incompatible.schema_version = 'axm.mirror.change-packet/v999';
  assert.equal(types(core, incompatible).includes('incompatible_schema'), true);

  core.registry.updateActorPermissions(AI_ID, core.actor(AI_ID).permissions, core.actor(MIKE_ID));
  assert.equal(types(core, packet).includes('permission_changed_after_proposal'), true);

  core.adapters.platform.disconnect();
  assert.equal(types(core, packet).includes('adapter_disconnected'), true);
});

test('field preconditions block same-field collision and tolerate an independent field', function (t) {
  const { core } = tempCore(t);
  core.adapters.platform.simulateExternalFieldChange('workspace-mirror-research', 'state.unrelated', 'new');
  const independent = core.createProposal(proposalInput({
    target_revision: core.adapters.platform.currentRevision(),
    operations: [{ type: 'update_fields', native_id: 'workspace-mirror-research', patch: { description: 'new description' } }],
    expected_preconditions: [{
      kind: 'field_equals',
      native_id: 'workspace-mirror-research',
      path: 'description',
      value: 'Mock platform workspace.',
      proposed_value: 'new description'
    }]
  }));
  assert.equal(types(core, independent).includes('field_level_update_collision'), false);

  core.adapters.platform.simulateExternalFieldChange('workspace-mirror-research', 'description', 'changed elsewhere');
  const collision = clone(independent);
  collision.target_revision = core.adapters.platform.currentRevision();
  const conflicts = core.conflictDetector.detect(collision, core.adapters.platform);
  const field = conflicts.find(function (item) { return item.type === 'field_level_update_collision'; });
  assert.equal(Boolean(field), true);
  assert.equal(field.auto_merge_safe, false);
  assert.equal(field.target_value, 'changed elsewhere');
});

test('duplicate active native mapping is a conflict before apply', function (t) {
  const { core } = tempCore(t);
  const saved = core.registry.registerEntity(entity(core, 'mapping'));
  const mapping = {
    mapping_id: 'map:test:existing',
    schema_version: 'axm.mirror.mapping/v1',
    mirror_id: saved.mirror_id,
    endpoints: [{ system_id: 'mock-platform', native_id: 'workspace-mirror-research', role: 'workspace' }],
    mapping_status: 'active',
    created_by: core.actor(MIKE_ID),
    evidence_refs: [],
    field_mappings: {},
    limitations: [],
    mapping_kind: 'representation_only'
  };
  core.registry.registerMapping(mapping);
  const proposed = clone(mapping);
  proposed.mapping_id = 'map:test:proposed';
  proposed.mapping_status = 'proposed';
  const packet = core.createProposal(proposalInput({
    operations: [{ type: 'map_native_entity', scope: 'mirror_core', mapping: proposed }]
  }));
  assert.equal(types(core, packet).includes('duplicate_native_mapping'), true);
});

test('mock adapters export separately and read-only/proposal-only modes block direct apply', function (t) {
  const first = tempCore(t).core;
  assert.equal(first.adapters.world.exportSnapshot().system_id, 'mock-world');
  assert.equal(first.adapters.platform.exportSnapshot().system_id, 'mock-platform');
  assert.notDeepEqual(first.adapters.world.exportSnapshot().entities, first.adapters.platform.exportSnapshot().entities);

  const packet = createApproved(first, { intent: 'Read-only block' });
  first.bridge.disconnect('adapter:mock:platform', first.actor(MIKE_ID));
  first.bridge.connect('adapter:mock:platform', 'read_only', first.actor(MIKE_ID), 'consent:local:mock-platform');
  const readOnlyResult = first.apply(packet.packet_id, MIKE_ID);
  assert.equal(readOnlyResult.applied, false);
  assert.equal(readOnlyResult.conflicts.some(function (item) { return item.type === 'adapter_connection_mode_blocks_apply'; }), true);

  const second = tempCore(t).core;
  const secondPacket = createApproved(second, { intent: 'Proposal-only block' });
  second.bridge.disconnect('adapter:mock:platform', second.actor(MIKE_ID));
  second.bridge.connect('adapter:mock:platform', 'proposal_only', second.actor(MIKE_ID), 'consent:local:mock-platform');
  const proposalOnlyResult = second.apply(secondPacket.packet_id, MIKE_ID);
  assert.equal(proposalOnlyResult.applied, false);
  assert.equal(proposalOnlyResult.conflicts.some(function (item) { return item.type === 'adapter_connection_mode_blocks_apply'; }), true);
});

test('approved apply produces a receipt and verifier detects native mismatch', function (t) {
  const { core } = tempCore(t);
  const packet = createApproved(core, { intent: 'Verifier mismatch' });
  const applied = core.apply(packet.packet_id, MIKE_ID);
  assert.equal(applied.ok, true);
  assert.equal(applied.receipt.applied_by.actor_id, MIKE_ID);
  assert.equal(applied.receipt.adapter_receipt.operation_results[0].status, 'completed');
  core.adapters.platform.simulateExternalFieldChange('workspace-mirror-research', 'description', 'external mismatch');
  const verified = core.verify(applied.receipt.application_id, MIKE_ID);
  assert.equal(verified.ok, false);
  assert.equal(verified.report.status, 'MISMATCH');
});

test('rollback restores target content and reverses the application receipt state', function (t) {
  const { core } = tempCore(t);
  const before = core.adapters.platform.exportSnapshot();
  const packet = createApproved(core, { intent: 'Rollback restore' });
  const applied = core.apply(packet.packet_id, MIKE_ID);
  const verified = core.verify(applied.receipt.application_id, MIKE_ID);
  assert.equal(verified.ok, true);
  const rollback = core.rollback(applied.receipt.application_id, MIKE_ID);
  assert.equal(rollback.status, 'ROLLED_BACK');
  assert.equal(deepEqual(normalizedAdapterState(before), normalizedAdapterState(core.adapters.platform.exportSnapshot())), true);
  assert.equal(core.store.read().applications[applied.receipt.application_id].status, 'ROLLED_BACK');
});

test('safe-file adapter rejects traversal, unknown files, and non-allowlisted actions', function (t) {
  const { core } = tempCore(t);
  const adapter = core.adapters.safeFile;
  assert.throws(function () { adapter.safeFile('../project.json'); }, /allowlist|traversal/);
  assert.throws(function () { adapter.readDocument('other.json'); }, /allowlist/);
  assert.throws(function () {
    adapter.previewApply({ operations: [{ type: 'request_adapter_action', action: 'read_any_file', file: 'project.json' }] });
  }, /not allowlisted/);
});

test('safe-file fixture supports approved write, verification, and rollback inside its allowlist', function (t) {
  const { core } = tempCore(t);
  const before = core.adapters.safeFile.readDocument('project.json');
  const next = { schema: 'axm.safe-project/v1', name: 'Reviewed fixture', status: 'approved-local-test' };
  const packet = createApproved(core, {
    source_system: 'mirror-core',
    target_system: 'safe-file-project',
    target_adapter_id: 'adapter:safe:file-project',
    intent: 'Write only the allowlisted fixture document.',
    operations: [{ type: 'request_adapter_action', action: 'write_fixture_json', file: 'project.json', data: next }]
  });
  const applied = core.apply(packet.packet_id, MIKE_ID);
  assert.deepEqual(core.adapters.safeFile.readDocument('project.json'), next);
  assert.equal(core.verify(applied.receipt.application_id, MIKE_ID).ok, true);
  assert.equal(core.rollback(applied.receipt.application_id, MIKE_ID).status, 'ROLLED_BACK');
  assert.deepEqual(core.adapters.safeFile.readDocument('project.json'), before);
});
