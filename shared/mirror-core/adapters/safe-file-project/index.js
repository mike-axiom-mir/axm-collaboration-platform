'use strict';

const fs = require('fs');
const path = require('path');
const Diff = require('../../journal/diff-engine');
const {
  clone,
  now,
  sha256,
  ensureDir,
  isInside,
  readJson,
  atomicWriteJson,
  makeId
} = require('../../core/utils');

class SafeFileProjectAdapter {
  constructor(options) {
    this.fixtureSource = path.resolve(options.fixtureSource);
    this.root = path.resolve(options.root);
    this.metaFile = path.join(this.root, '.adapter-state.json');
    this.allowlist = new Set(['project.json']);
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    this.descriptor = {
      adapter_id: 'adapter:safe:file-project',
      schema_version: 'axm.mirror.adapter/v1',
      adapter_version: '0.1.0',
      system_type: 'bounded_fixture_folder',
      source_system_id: 'safe-file-project',
      supported_schema_versions: ['axm.mirror.change-packet/v1'],
      supported_entity_types: ['project', 'document'],
      supported_operations: ['request_adapter_action'],
      read_capabilities: ['export_snapshot', 'read_entities'],
      write_capabilities: ['preview_apply', 'apply_approved_packet', 'rollback_application'],
      connection_modes: ['disconnected', 'read_only', 'proposal_only', 'approved_apply'],
      permission_requirements: ['read_entity', 'apply_change', 'rollback_change'],
      limitations: ['configured fixture root only', 'project.json only', 'JSON only', 'no arbitrary paths']
    };
    this.reset();
  }

  reset() {
    ensureDir(this.root);
    atomicWriteJson(path.join(this.root, 'project.json'), readJson(path.join(this.fixtureSource, 'project.json')));
    atomicWriteJson(this.metaFile, { revision: 0, updated_at: now() });
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    return this.exportSnapshot();
  }

  safeFile(name) {
    if (!this.allowlist.has(String(name || ''))) throw new Error('file is not in the safe adapter allowlist');
    const target = path.resolve(this.root, name);
    if (!isInside(this.root, target)) throw new Error('path traversal refused');
    return target;
  }

  readDocument(name) {
    return readJson(this.safeFile(name));
  }

  writeDocument(name, value) {
    atomicWriteJson(this.safeFile(name), value);
  }

  meta() {
    return readJson(this.metaFile, { revision: 0, updated_at: now() });
  }

  bump() {
    const meta = this.meta();
    meta.revision += 1;
    meta.updated_at = now();
    atomicWriteJson(this.metaFile, meta);
    return meta;
  }

  connect(mode, consentId, actorId) {
    if (!this.descriptor.connection_modes.includes(mode) || mode === 'bounded_auto_apply') throw new Error('unsupported connection mode');
    this.connection = { mode, consent_id: consentId, connected_at: now(), actor_id: actorId };
    return clone(this.connection);
  }

  disconnect() {
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    return clone(this.connection);
  }

  currentRevision() {
    return this.meta().revision;
  }

  healthCheck() {
    return { ok: fs.existsSync(this.safeFile('project.json')), adapter_id: this.descriptor.adapter_id, revision: this.currentRevision(), connection: clone(this.connection) };
  }

  exportSnapshot() {
    return {
      schema: 'axm.safe-file-project.snapshot/v1',
      system_id: this.descriptor.source_system_id,
      revision: this.currentRevision(),
      documents: { 'project.json': this.readDocument('project.json') }
    };
  }

  readEntities() {
    return [{ native_id: 'project.json', entity_type: 'document', name: 'Safe fixture project', state: this.readDocument('project.json') }];
  }

  resolveNativeId(nativeId) {
    return nativeId === 'project.json' ? this.readEntities()[0] : null;
  }

  getEntity(nativeId) {
    return this.resolveNativeId(nativeId);
  }

  createProposal(input) {
    return Object.assign({ source_system: this.descriptor.source_system_id }, clone(input || {}));
  }

  nextState(packet) {
    const before = this.exportSnapshot();
    const after = clone(before);
    (packet.operations || []).forEach((operation) => {
      if (operation.type !== 'request_adapter_action' || operation.action !== 'write_fixture_json') throw new Error('safe-file adapter action not allowlisted');
      if (!this.allowlist.has(operation.file)) throw new Error('file is not in the safe adapter allowlist');
      after.documents[operation.file] = clone(operation.data);
    });
    after.revision = before.revision + 1;
    return { before, after };
  }

  previewApply(packet) {
    const state = this.nextState(packet);
    return { ok: true, adapter_id: this.descriptor.adapter_id, diff: Diff.diff(state.before, state.after), before_revision: state.before.revision, after_revision: state.after.revision };
  }

  applyApprovedPacket(packet) {
    if (this.connection.mode !== 'approved_apply') throw new Error('adapter is not connected in approved_apply mode');
    const state = this.nextState(packet);
    Object.keys(state.after.documents).forEach((name) => this.writeDocument(name, state.after.documents[name]));
    const meta = this.bump();
    const current = this.exportSnapshot();
    return {
      ok: true,
      adapter_id: this.descriptor.adapter_id,
      system_id: this.descriptor.source_system_id,
      packet_id: packet.packet_id,
      before_revision: state.before.revision,
      after_revision: meta.revision,
      before_hash: sha256(state.before),
      after_hash: sha256(current),
      operation_results: [{ type: 'request_adapter_action', action: 'write_fixture_json', status: 'completed' }],
      applied_at: now()
    };
  }

  verifyApplication(receipt) {
    const current = this.exportSnapshot();
    const ok = current.revision === receipt.after_revision && sha256(current) === receipt.after_hash;
    return { ok, status: ok ? 'VERIFIED' : 'MISMATCH', expected_revision: receipt.after_revision, actual_revision: current.revision, checked_at: now() };
  }

  rollbackApplication(snapshot) {
    if (!snapshot || snapshot.adapter_id !== this.descriptor.adapter_id) throw new Error('rollback snapshot belongs to another adapter');
    const currentRevision = this.currentRevision();
    Object.keys(snapshot.state.documents || {}).forEach((name) => this.writeDocument(name, snapshot.state.documents[name]));
    atomicWriteJson(this.metaFile, { revision: currentRevision + 1, updated_at: now() });
    return { ok: true, rollback_id: makeId('adapter-rollback'), adapter_id: this.descriptor.adapter_id, restored_from_snapshot: snapshot.snapshot_id, before_revision: currentRevision, after_revision: currentRevision + 1, rolled_back_at: now() };
  }
}

module.exports = { SafeFileProjectAdapter };
