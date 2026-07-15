'use strict';

const Validation = require('../core/validation');
const Identity = require('../core/identity');
const TruthFacets = require('../core/truth-facets');
const { clone, deepEqual, getPath, makeId } = require('../core/utils');

function conflict(type, detail) {
  return Object.assign({
    conflict_id: makeId('conflict'),
    type,
    affected_entity: null,
    field: null,
    source_value: null,
    target_value: null,
    proposal_base_value: null,
    possible_resolutions: ['amend proposal', 'refresh target snapshot', 'reject proposal'],
    auto_merge_safe: false
  }, clone(detail || {}));
}

class ConflictDetector {
  constructor(store) {
    this.store = store;
  }

  detect(packet, adapter) {
    const state = this.store.read();
    const conflicts = [];
    const createdNativeIds = new Set((packet.operations || []).filter(function (operation) {
      return operation.type === 'create_entity' && operation.native_entity && operation.native_entity.native_id;
    }).map(function (operation) { return operation.native_entity.native_id; }));
    const checked = Validation.validateProposal(packet);
    if (!checked.ok) conflicts.push(conflict('incompatible_schema', { possible_resolutions: checked.errors }));
    if (!adapter) return conflicts.concat([conflict('adapter_missing')]);
    if (adapter.connection.mode === 'disconnected') conflicts.push(conflict('adapter_disconnected'));
    else if (adapter.connection.mode !== 'approved_apply') {
      conflicts.push(conflict('adapter_connection_mode_blocks_apply', {
        source_value: adapter.connection.mode,
        target_value: 'approved_apply',
        possible_resolutions: ['obtain specific consent for approved_apply', 'connect the adapter explicitly in approved_apply mode']
      }));
    }
    if (Number(packet.target_revision) !== Number(adapter.currentRevision())) {
      conflicts.push(conflict('stale_target_snapshot', {
        source_value: packet.target_revision,
        target_value: adapter.currentRevision(),
        proposal_base_value: packet.target_revision,
        possible_resolutions: ['export a fresh target snapshot', 'rebuild proposal against current revision']
      }));
    }
    if (Number(packet.authority_revision) !== Number(state.authority_revision)) {
      conflicts.push(conflict('permission_changed_after_proposal', {
        source_value: packet.authority_revision,
        target_value: state.authority_revision,
        possible_resolutions: ['revalidate proposal under current permissions']
      }));
    }
    (packet.operations || []).forEach(function (operation) {
      if (!adapter.descriptor.supported_operations.includes(operation.type) && operation.scope !== 'mirror_core') {
        conflicts.push(conflict('operation_unsupported_by_adapter', { field: operation.type }));
      }
      if (['update_fields', 'archive_entity', 'attach_evidence', 'update_truth_facet'].includes(operation.type)) {
        const target = adapter.getEntity(operation.native_id);
        if (!target && !createdNativeIds.has(operation.native_id)) conflicts.push(conflict('deleted_or_missing_target', { affected_entity: operation.native_id }));
      }
      if (operation.type === 'map_native_entity' && operation.mapping) {
        const used = new Map();
        Object.values(state.mappings).forEach(function (mapping) {
          if (['archived', 'superseded'].includes(mapping.mapping_status)) return;
          mapping.endpoints.forEach(function (endpoint) {
            used.set(Identity.endpointKey(endpoint.system_id, endpoint.native_id), mapping.mapping_id);
          });
        });
        operation.mapping.endpoints.forEach(function (endpoint) {
          const prior = used.get(Identity.endpointKey(endpoint.system_id, endpoint.native_id));
          if (prior) conflicts.push(conflict('duplicate_native_mapping', { affected_entity: endpoint.native_id, target_value: prior }));
        });
      }
      if (operation.type === 'add_relation' && operation.relation) {
        const rel = operation.relation;
        if (!state.entities[rel.source_mirror_id] || !state.entities[rel.target_mirror_id]) {
          conflicts.push(conflict('relation_target_missing', { affected_entity: !state.entities[rel.source_mirror_id] ? rel.source_mirror_id : rel.target_mirror_id }));
        }
      }
      if (operation.type === 'update_truth_facet' && operation.before !== undefined &&
          TruthFacets.isDowngrade(operation.facet, operation.before, operation.value) &&
          !operation.explicit_downgrade_approval) {
        conflicts.push(conflict('truth_downgrade_without_approval', { affected_entity: operation.native_id, field: operation.facet, proposal_base_value: operation.before, source_value: operation.value }));
      }
    });
    (packet.expected_preconditions || []).forEach(function (precondition) {
      if (precondition.kind !== 'field_equals') return;
      const entity = adapter.getEntity(precondition.native_id);
      if (!entity) {
        conflicts.push(conflict('deleted_or_missing_target', { affected_entity: precondition.native_id, field: precondition.path }));
        return;
      }
      const current = getPath(entity, precondition.path);
      if (!deepEqual(current, precondition.value)) {
        conflicts.push(conflict('field_level_update_collision', {
          affected_entity: precondition.native_id,
          field: precondition.path,
          target_value: current,
          proposal_base_value: precondition.value,
          source_value: precondition.proposed_value,
          possible_resolutions: ['keep target value', 'use proposal value after review', 'amend field only'],
          auto_merge_safe: false
        }));
      }
    });
    return conflicts;
  }
}

module.exports = { ConflictDetector, conflict };
