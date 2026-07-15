'use strict';

const fs = require('fs');
const path = require('path');
const Diff = require('../journal/diff-engine');
const {
  clone,
  now,
  sha256,
  readJson,
  atomicWriteJson,
  getPath,
  setPath,
  deepEqual,
  ensureDir,
  makeId
} = require('../core/utils');

function normalizeState(input, systemId) {
  const state = clone(input || {});
  state.schema = 'axm.mock-system/v1';
  state.system_id = systemId;
  state.revision = Number(state.revision || 0);
  state.entities = state.entities && typeof state.entities === 'object' ? state.entities : {};
  state.relations = Array.isArray(state.relations) ? state.relations : [];
  state.capabilities = Array.isArray(state.capabilities) ? state.capabilities : [];
  state.evidence = Array.isArray(state.evidence) ? state.evidence : [];
  state.updated_at = state.updated_at || now();
  return state;
}

class MockSystemAdapter {
  constructor(options) {
    this.descriptor = clone(options.descriptor);
    this.seedFile = path.resolve(options.seedFile);
    this.stateFile = path.resolve(options.stateFile);
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    ensureDir(path.dirname(this.stateFile));
    if (!fs.existsSync(this.stateFile)) this.reset();
  }

  reset() {
    const seed = normalizeState(readJson(this.seedFile), this.descriptor.source_system_id);
    atomicWriteJson(this.stateFile, seed);
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    return this.exportSnapshot();
  }

  load() {
    return normalizeState(readJson(this.stateFile), this.descriptor.source_system_id);
  }

  save(state) {
    state.updated_at = now();
    atomicWriteJson(this.stateFile, state);
    return clone(state);
  }

  connect(mode, consentId, actorId) {
    if (!this.descriptor.connection_modes.includes(mode)) throw new Error('adapter does not support connection mode ' + mode);
    if (mode === 'bounded_auto_apply') throw new Error('bounded_auto_apply is reserved and disabled');
    this.connection = { mode, consent_id: consentId, connected_at: now(), actor_id: actorId };
    return clone(this.connection);
  }

  disconnect() {
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    return clone(this.connection);
  }

  healthCheck() {
    return {
      ok: fs.existsSync(this.stateFile),
      adapter_id: this.descriptor.adapter_id,
      system_id: this.descriptor.source_system_id,
      connection: clone(this.connection),
      revision: this.currentRevision()
    };
  }

  exportSnapshot() {
    return this.load();
  }

  readEntities() {
    return Object.values(this.load().entities).map(clone);
  }

  resolveNativeId(nativeId) {
    return this.getEntity(nativeId);
  }

  getEntity(nativeId) {
    const entity = this.load().entities[nativeId];
    return entity ? clone(entity) : null;
  }

  currentRevision() {
    return Number(this.load().revision || 0);
  }

  createProposal(input) {
    return Object.assign({ source_system: this.descriptor.source_system_id }, clone(input || {}));
  }

  applyOperation(state, operation, results) {
    if (operation.scope === 'mirror_core' || operation.type === 'map_native_entity') {
      results.push({ type: operation.type, status: 'deferred_to_mirror_core' });
      return;
    }
    if (operation.type === 'create_entity') {
      const entity = clone(operation.native_entity);
      if (!entity || !entity.native_id) throw new Error('create_entity requires native_entity.native_id');
      if (state.entities[entity.native_id]) throw new Error('native entity already exists: ' + entity.native_id);
      entity.created_at = entity.created_at || now();
      entity.updated_at = entity.updated_at || entity.created_at;
      entity.revision = 1;
      entity.evidence_refs = Array.isArray(entity.evidence_refs) ? entity.evidence_refs : [];
      state.entities[entity.native_id] = entity;
      results.push({ type: operation.type, native_id: entity.native_id, status: 'created' });
      return;
    }
    if (operation.type === 'update_fields') {
      const entity = state.entities[operation.native_id];
      if (!entity) throw new Error('native entity not found: ' + operation.native_id);
      Object.keys(operation.patch || {}).forEach(function (field) {
        setPath(entity, field, operation.patch[field]);
      });
      entity.revision = Number(entity.revision || 1) + 1;
      entity.updated_at = now();
      results.push({ type: operation.type, native_id: operation.native_id, status: 'updated', fields: Object.keys(operation.patch || {}) });
      return;
    }
    if (operation.type === 'archive_entity') {
      const entity = state.entities[operation.native_id];
      if (!entity) throw new Error('native entity not found: ' + operation.native_id);
      entity.archived = true;
      entity.status = 'archived';
      entity.revision = Number(entity.revision || 1) + 1;
      entity.updated_at = now();
      results.push({ type: operation.type, native_id: operation.native_id, status: 'archived' });
      return;
    }
    if (operation.type === 'attach_evidence') {
      const entity = state.entities[operation.native_id];
      if (!entity) throw new Error('native entity not found: ' + operation.native_id);
      entity.evidence_refs = Array.isArray(entity.evidence_refs) ? entity.evidence_refs : [];
      if (!entity.evidence_refs.includes(operation.evidence_ref)) entity.evidence_refs.push(operation.evidence_ref);
      entity.revision = Number(entity.revision || 1) + 1;
      results.push({ type: operation.type, native_id: operation.native_id, status: 'attached' });
      return;
    }
    if (operation.type === 'update_truth_facet') {
      const entity = state.entities[operation.native_id];
      if (!entity) throw new Error('native entity not found: ' + operation.native_id);
      entity.truth_facets = entity.truth_facets || {};
      entity.truth_facets[operation.facet] = operation.value;
      entity.revision = Number(entity.revision || 1) + 1;
      results.push({ type: operation.type, native_id: operation.native_id, status: 'updated', facet: operation.facet });
      return;
    }
    if (operation.type === 'add_relation') {
      const relation = clone(operation.native_relation);
      if (!relation || !relation.relation_id) throw new Error('add_relation requires native_relation');
      if (!state.entities[relation.source_native_id] || !state.entities[relation.target_native_id]) throw new Error('native relation target missing');
      if (state.relations.some(function (known) { return known.relation_id === relation.relation_id; })) throw new Error('native relation already exists');
      state.relations.push(relation);
      results.push({ type: operation.type, relation_id: relation.relation_id, status: 'added' });
      return;
    }
    if (operation.type === 'remove_relation') {
      const before = state.relations.length;
      state.relations = state.relations.filter(function (relation) { return relation.relation_id !== operation.relation_id; });
      if (before === state.relations.length) throw new Error('native relation not found');
      results.push({ type: operation.type, relation_id: operation.relation_id, status: 'removed' });
      return;
    }
    if (operation.type === 'register_capability') {
      const capability = clone(operation.capability);
      if (!capability || !capability.capability_id) throw new Error('register_capability requires capability');
      if (state.capabilities.some(function (known) { return known.capability_id === capability.capability_id; })) throw new Error('capability already known to target');
      state.capabilities.push(capability);
      results.push({ type: operation.type, capability_id: capability.capability_id, status: 'registered' });
      return;
    }
    if (operation.type === 'request_adapter_action') {
      if (operation.action !== 'mock.noop') throw new Error('mock adapter action not allowlisted');
      results.push({ type: operation.type, action: operation.action, status: 'completed', output: clone(operation.input || {}) });
      return;
    }
    throw new Error('unsupported adapter operation: ' + operation.type);
  }

  previewApply(packet) {
    const before = this.load();
    const after = clone(before);
    const results = [];
    (packet.operations || []).forEach((operation) => this.applyOperation(after, operation, results));
    after.revision = before.revision + 1;
    return { ok: true, adapter_id: this.descriptor.adapter_id, operation_results: results, diff: Diff.diff(before, after), before_revision: before.revision, after_revision: after.revision };
  }

  applyApprovedPacket(packet) {
    if (this.connection.mode !== 'approved_apply') throw new Error('adapter is not connected in approved_apply mode');
    if (!['APPROVED', 'APPLYING'].includes(packet.status)) throw new Error('packet is not approved for application');
    const before = this.load();
    const next = clone(before);
    const results = [];
    (packet.operations || []).forEach((operation) => this.applyOperation(next, operation, results));
    next.revision = before.revision + 1;
    this.save(next);
    return {
      ok: true,
      adapter_id: this.descriptor.adapter_id,
      system_id: this.descriptor.source_system_id,
      packet_id: packet.packet_id,
      before_revision: before.revision,
      after_revision: next.revision,
      before_hash: sha256(before),
      after_hash: sha256(next),
      operation_results: results,
      applied_at: now()
    };
  }

  verifyApplication(receipt) {
    const current = this.load();
    const pass = current.revision === receipt.after_revision && sha256(current) === receipt.after_hash;
    return {
      ok: pass,
      status: pass ? 'VERIFIED' : 'MISMATCH',
      adapter_id: this.descriptor.adapter_id,
      expected_revision: receipt.after_revision,
      actual_revision: current.revision,
      expected_hash: receipt.after_hash,
      actual_hash: sha256(current),
      checked_at: now()
    };
  }

  rollbackApplication(snapshot) {
    if (!snapshot || snapshot.adapter_id !== this.descriptor.adapter_id) throw new Error('rollback snapshot belongs to another adapter');
    const current = this.load();
    const restored = normalizeState(snapshot.state, this.descriptor.source_system_id);
    const contentBeforeRevision = clone(restored);
    restored.revision = current.revision + 1;
    restored.updated_at = now();
    this.save(restored);
    const expected = clone(contentBeforeRevision);
    const actual = clone(restored);
    delete expected.revision;
    delete expected.updated_at;
    delete actual.revision;
    delete actual.updated_at;
    return {
      ok: deepEqual(expected, actual),
      rollback_id: makeId('adapter-rollback'),
      adapter_id: this.descriptor.adapter_id,
      restored_from_snapshot: snapshot.snapshot_id,
      before_revision: current.revision,
      after_revision: restored.revision,
      restored_content_hash: sha256(actual),
      rolled_back_at: now()
    };
  }

  simulateExternalFieldChange(nativeId, field, value) {
    const state = this.load();
    const entity = state.entities[nativeId];
    if (!entity) throw new Error('native entity not found');
    setPath(entity, field, value);
    entity.revision = Number(entity.revision || 1) + 1;
    state.revision += 1;
    this.save(state);
    return clone(entity);
  }
}

module.exports = { MockSystemAdapter, normalizeState };
