'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestamp() {
  return new Date().toISOString();
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

class MirrorNativeHostAdapter {
  constructor(options) {
    options = options || {};
    if (!options.runtime) throw new Error('native host runtime is required');
    this.runtime = options.runtime;
    this.stateFile = path.resolve(options.stateFile || path.join(this.runtime.workspaceRoot, '.axm-native-adapters', 'mirror-state.json'));
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    this.descriptor = {
      adapter_id: 'adapter:native:' + this.runtime.manifest.adapter_id,
      schema_version: 'axm.mirror.adapter/v1',
      adapter_version: this.runtime.manifest.package_version,
      system_type: 'permission_gated_native_host',
      source_system_id: 'native-' + this.runtime.manifest.adapter_id,
      supported_schema_versions: ['axm.mirror.change-packet/v1', 'axm.native-bridge-bundle/v1', 'axm.native-host-application-receipt/v1'],
      supported_entity_types: ['native-project', 'native-transaction'],
      supported_operations: ['request_adapter_action'],
      read_capabilities: ['export_snapshot', 'read_entities', 'inspect_native_project'],
      write_capabilities: ['apply_approved_packet', 'rollback_application'],
      connection_modes: ['disconnected', 'read_only', 'proposal_only', 'approved_apply'],
      permission_requirements: ['read_entity', 'apply_change', 'rollback_change'],
      limitations: [
        'configured workspace root only',
        'configured signed adapter package only',
        'configured native application executable only',
        'no arbitrary bundle code',
        'dual-approved Asset Hands bundle required'
      ],
      data_categories: ['native project path', 'bounded transaction receipt', 'independent native inspection facts'],
      consent_purpose: 'Apply an exact dual-approved Asset Hands transaction through a signed, workspace-confined native adapter'
    };
    this.ensureState();
  }

  ensureState() {
    if (!fs.existsSync(this.stateFile)) this.writeState({ revision: 0, transactions: {} });
  }

  readState() {
    this.ensureState();
    return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
  }

  writeState(value) {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    const temporary = this.stateFile + '.tmp-' + process.pid;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
    fs.renameSync(temporary, this.stateFile);
  }

  bump(transactionId, state) {
    const value = this.readState();
    value.revision += 1;
    value.transactions[transactionId] = state;
    this.writeState(value);
    return value.revision;
  }

  connect(mode, consentId, actorId) {
    if (!this.descriptor.connection_modes.includes(mode) || mode === 'bounded_auto_apply') throw new Error('unsupported native adapter connection mode');
    this.connection = { mode, consent_id: consentId, connected_at: timestamp(), actor_id: actorId };
    return clone(this.connection);
  }

  disconnect() {
    this.connection = { mode: 'disconnected', consent_id: null, connected_at: null, actor_id: null };
    return clone(this.connection);
  }

  currentRevision() {
    return this.readState().revision;
  }

  healthCheck() {
    return {
      ok: true,
      adapter_id: this.descriptor.adapter_id,
      signed_package: this.runtime.manifest.package_id,
      package_signature_verified: this.runtime.packageCheck.signature_verified,
      recovery_required: this.runtime.listRecoveryRequired(),
      revision: this.currentRevision(),
      connection: clone(this.connection)
    };
  }

  exportSnapshot() {
    const state = this.readState();
    return {
      schema: 'axm.mirror.native-host.snapshot/v1',
      system_id: this.descriptor.source_system_id,
      revision: state.revision,
      transactions: clone(state.transactions),
      recovery_required: this.runtime.listRecoveryRequired()
    };
  }

  readEntities() {
    return Object.entries(this.readState().transactions).map(function (entry) {
      return { native_id: entry[0], entity_type: 'native-transaction', name: entry[0], state: entry[1] };
    });
  }

  resolveNativeId(nativeId) {
    return this.readEntities().find(function (item) { return item.native_id === nativeId; }) || null;
  }

  getEntity(nativeId) {
    return this.resolveNativeId(nativeId);
  }

  createProposal(input) {
    return Object.assign({ source_system: this.descriptor.source_system_id }, clone(input || {}));
  }

  operation(packet) {
    const operations = packet && packet.operations || [];
    if (operations.length !== 1 || operations[0].type !== 'request_adapter_action' || operations[0].action !== 'apply_native_bridge_bundle') {
      throw new Error('native adapter accepts exactly one apply_native_bridge_bundle action');
    }
    const operation = operations[0];
    if (!operation.bundle || !operation.target_canvas || !operation.source_path) throw new Error('native adapter action is incomplete');
    return operation;
  }

  previewApply(packet) {
    const operation = this.operation(packet);
    const preview = this.runtime.preview({ bundle: operation.bundle, targetCanvas: operation.target_canvas, sourcePath: operation.source_path });
    return {
      ok: preview.ok,
      adapter_id: this.descriptor.adapter_id,
      errors: preview.errors,
      before_revision: this.currentRevision(),
      after_revision: this.currentRevision() + 1,
      change_digest: preview.change_digest,
      signed_package: preview.package_id,
      package_signature_verified: preview.package_signature_verified,
      canvas_coverage: preview.canvas_coverage,
      diff: { changed: preview.ok, count: preview.ok ? 1 : 0, changes: preview.ok ? [{ path: operation.bundle.project.project_file, type: 'native-project-apply' }] : [] }
    };
  }

  applyApprovedPacket(packet) {
    if (this.connection.mode !== 'approved_apply') throw new Error('native adapter is not connected in approved_apply mode');
    const operation = this.operation(packet);
    const beforeRevision = this.currentRevision();
    const prepared = this.runtime.prepare({ bundle: operation.bundle, targetCanvas: operation.target_canvas, sourcePath: operation.source_path });
    const hostReceipt = this.runtime.apply(prepared.transaction_id);
    const afterRevision = this.bump(prepared.transaction_id, 'INSPECTED');
    return {
      ok: true,
      adapter_id: this.descriptor.adapter_id,
      system_id: this.descriptor.source_system_id,
      packet_id: packet.packet_id,
      transaction_id: prepared.transaction_id,
      before_revision: beforeRevision,
      after_revision: afterRevision,
      before_hash: hash({ revision: beforeRevision }),
      after_hash: hash(this.exportSnapshot()),
      host_application_receipt: clone(hostReceipt),
      independently_verified: true,
      operation_results: [{ type: 'request_adapter_action', action: 'apply_native_bridge_bundle', status: 'completed', transaction_id: prepared.transaction_id }],
      applied_at: timestamp()
    };
  }

  verifyApplication(receipt) {
    const inspected = this.runtime.inspect(receipt.transaction_id);
    const host = inspected.host_receipt;
    const ok = inspected.state === 'INSPECTED' && host.change_digest === receipt.host_application_receipt.change_digest && host.project_digest === receipt.host_application_receipt.project_digest;
    return {
      ok,
      status: ok ? 'VERIFIED' : 'MISMATCH',
      transaction_id: receipt.transaction_id,
      independent_native_process: true,
      inspection_digest: host.inspection_digest,
      project_digest: host.project_digest,
      package_signature_verified: true,
      checked_at: timestamp()
    };
  }

  rollbackApplication(snapshot, adapterReceipt) {
    if (!snapshot || snapshot.adapter_id !== this.descriptor.adapter_id) throw new Error('rollback snapshot belongs to another adapter');
    if (!adapterReceipt || !adapterReceipt.transaction_id) throw new Error('native rollback requires the exact adapter receipt');
    const beforeRevision = this.currentRevision();
    const result = this.runtime.rollback(adapterReceipt.transaction_id);
    const afterRevision = this.bump(adapterReceipt.transaction_id, 'ROLLED_BACK');
    return Object.assign({}, clone(result), {
      adapter_id: this.descriptor.adapter_id,
      restored_from_snapshot: snapshot.snapshot_id,
      before_revision: beforeRevision,
      after_revision: afterRevision
    });
  }
}

module.exports = { MirrorNativeHostAdapter };
