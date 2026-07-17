'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { MirrorCore, MIKE_ID, AI_ID } = require('../core/mirror-core');
const { clone, now } = require('../core/utils');

const ROOT = path.resolve(__dirname, '..');

function tempCore(testContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-test-'));
  const runtimeDir = path.join(dir, 'runtime');
  const core = new MirrorCore({ rootDir: ROOT, runtimeDir });
  core.reset();
  if (testContext && testContext.after) testContext.after(function () { fs.rmSync(dir, { recursive: true, force: true }); });
  return { core, dir, runtimeDir };
}

function actor(id, name, permissions) {
  return {
    actor_id: id,
    actor_type: 'human',
    display_name: name || id,
    source_system: 'test',
    capabilities: [],
    permissions: clone(permissions || []),
    active_session: null,
    provenance: [{ source: 'test', at: now() }],
    status: 'active'
  };
}

function entity(core, suffix, overrides) {
  const mike = core.actor(MIKE_ID);
  const at = now();
  const base = {
    mirror_id: 'mir:test:workspace:' + suffix,
    schema_version: 'axm.mirror.entity/v1',
    entity_type: 'workspace',
    name: 'Shared display name',
    description: 'Test representation',
    source_system: 'test-system',
    source_native_id: 'native-' + suffix,
    created_by: mike,
    created_at: at,
    updated_at: at,
    revision: 1,
    truth_facets: {
      origin: 'user_entered',
      representation: 'structured_model',
      verification: 'schema_valid',
      connection: 'proposal_only',
      physical_status: 'not_applicable',
      operational_status: 'prototype'
    },
    state: {},
    capabilities: [],
    relations: [],
    provenance: [{ source_system: 'test-system', source_native_id: 'native-' + suffix }],
    evidence_refs: [],
    permissions: {},
    adapter_metadata: {},
    extensions: {}
  };
  return Object.assign(base, clone(overrides || {}));
}

function projectEntity(core, suffix) {
  const value = entity(core, suffix, { entity_type: 'project' });
  value.mirror_id = 'mir:test:project:' + suffix;
  value.state = {
    type_data: {
      project_status: 'planning',
      goals: [],
      milestones: [],
      tasks: [],
      workspaces: [],
      evidence_gate: {},
      source_document_schema: 'test/v1'
    }
  };
  return value;
}

function proposalInput(overrides) {
  return Object.assign({
    source_system: 'mock-world',
    target_system: 'mock-platform',
    target_adapter_id: 'adapter:mock:platform',
    actor_id: AI_ID,
    intent: 'Exercise a bounded local adapter action.',
    reason: 'Test proposal lifecycle and receipts.',
    operations: [{ type: 'request_adapter_action', action: 'mock.noop', input: { marker: 'test' } }],
    affected_entities: [],
    evidence_refs: [],
    reversibility: 'reversible'
  }, clone(overrides || {}));
}

function approve(core, packetId) {
  core.validateProposal(packetId, AI_ID);
  core.propose(packetId, AI_ID);
  core.review(packetId, MIKE_ID, 'Test review');
  core.approve(packetId, MIKE_ID, 'Test approval');
  return core.store.read().proposals[packetId];
}

function createApproved(core, overrides) {
  const packet = core.createProposal(proposalInput(overrides));
  approve(core, packet.packet_id);
  return core.store.read().proposals[packet.packet_id];
}

module.exports = {
  ROOT,
  MIKE_ID,
  AI_ID,
  tempCore,
  actor,
  entity,
  projectEntity,
  proposalInput,
  approve,
  createApproved
};
