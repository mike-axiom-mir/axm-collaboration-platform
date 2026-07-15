'use strict';

const { clone, now } = require('../core/utils');

const SOURCE_REFERENCE = Object.freeze({
  repository: 'mike-axiom-mir/axm-collaboration-platform',
  pull_request: 13,
  head_sha: '33a87549259d8b4a7ce4753ee1fab49e0ee8091d'
});

const SERVICE_METHODS = Object.freeze([
  'mirror.health',
  'mirror.query',
  'mirror.proposal.create',
  'mirror.proposal.preview',
  'mirror.proposal.decide',
  'mirror.application.apply',
  'mirror.application.verify',
  'mirror.application.rollback',
  'mirror.adapter.connect',
  'mirror.adapter.disconnect'
]);

function discoveryDescriptor(core) {
  const status = core.status();
  return {
    schema_version: 'axm.mirror.foundation-contract/v1',
    module_id: 'service.mirror-core',
    module_version: '0.1.0-local-prototype',
    status: 'standalone_foundation_compatibility_harness',
    source_reference: clone(SOURCE_REFERENCE),
    discovery: {
      health_path: '/health',
      descriptor_path: '/foundation/discovery',
      local_only: true
    },
    service_methods: clone(SERVICE_METHODS),
    boundaries: {
      proposal_first: true,
      default_deny_permissions: true,
      specific_consent: true,
      no_hidden_machine_permissions: true,
      durable_packets_not_live_game_input: true,
      no_payload_logging: true,
      no_remote_runtime_dependency: true
    },
    runtime: {
      health: status.ok,
      revision: status.revision,
      authority_revision: status.authority_revision,
      foundation_installed: false
    }
  };
}

function serviceEnvelope(input) {
  input = input || {};
  return {
    ok: input.ok !== false,
    data: input.data === undefined ? null : clone(input.data),
    error: input.error ? { code: String(input.error.code || 'mirror_error'), message: String(input.error.message || input.error) } : null,
    meta: {
      schema_version: 'axm.foundation.service-envelope/v1',
      service: 'mirror-core',
      method: String(input.method || 'mirror.query'),
      request_id: String(input.request_id || 'local-request'),
      produced_at: now(),
      local_only: true
    }
  };
}

function entityRegistrationProposal(entity, actorId) {
  if (!entity || !entity.mirror_id) throw new Error('mirror entity required');
  return serviceEnvelope({
    method: 'mirror.proposal.create',
    data: {
      mode: 'proposal_only',
      actor_id: actorId,
      entity_reference: {
        mirror_id: entity.mirror_id,
        schema_version: entity.schema_version,
        entity_type: entity.entity_type,
        source_system: entity.source_system,
        source_native_id: entity.source_native_id
      },
      automatic_write: false,
      next_required_action: 'explicit_review'
    }
  });
}

function evidenceDeskReference(evidence) {
  if (!evidence || !evidence.evidence_id) throw new Error('evidence record required');
  return {
    schema_version: 'axm.mirror.evidence-reference/v1',
    evidence_id: evidence.evidence_id,
    evidence_type: evidence.evidence_type,
    storage_reference: evidence.storage_reference,
    integrity_hash: evidence.integrity_hash || null,
    claim_scope: clone(evidence.claim_scope || []),
    limitations: clone(evidence.limitations || []),
    payload_embedded: false
  };
}

function projectRoomMapping(mapping, approvedPacket) {
  if (!mapping || !mapping.mapping_id) throw new Error('mapping required');
  if (!approvedPacket || !['APPROVED', 'APPLIED', 'VERIFIED'].includes(approvedPacket.status)) {
    throw new Error('Project Room exposure requires an approved packet');
  }
  return {
    schema_version: 'axm.mirror.project-mapping-reference/v1',
    mapping_id: mapping.mapping_id,
    mirror_id: mapping.mirror_id,
    endpoints: clone(mapping.endpoints || []),
    mapping_kind: mapping.mapping_kind || 'representation_only',
    packet_id: approvedPacket.packet_id,
    limitations: clone(mapping.limitations || []),
    authority: 'mirror-core-approved-reference',
    writes_project_room: false
  };
}

function adapterConnectionIntent(adapterDescriptor, consentId, mode) {
  if (!adapterDescriptor || !adapterDescriptor.adapter_id) throw new Error('adapter descriptor required');
  return {
    schema_version: 'axm.mirror.adapter-connection-intent/v1',
    adapter_id: adapterDescriptor.adapter_id,
    source_system_id: adapterDescriptor.source_system_id,
    requested_mode: mode,
    consent_id: consentId,
    supported_operations: clone(adapterDescriptor.supported_operations || []),
    limitations: clone(adapterDescriptor.limitations || []),
    connected: false,
    next_required_action: 'mirror_gate_authorization'
  };
}

function sharedControlBoundary() {
  return {
    schema_version: 'axm.mirror.shared-controls-boundary/v1',
    live_game_input_owner: 'future-shared-controls-service',
    durable_cross_system_change_owner: 'mirror-core',
    live_action_shape: 'axm.controls.action-intention/v1',
    durable_change_shape: 'axm.mirror.change-packet/v1',
    actor_control_parity: true,
    default_ai_fill: false,
    max_seats: 8,
    arbitrary_team_imbalance_allowed: true,
    ai_observation_scope: 'seat_player_view_only',
    mirror_core_runs_game_loop: false
  };
}

module.exports = {
  SOURCE_REFERENCE,
  SERVICE_METHODS,
  discoveryDescriptor,
  serviceEnvelope,
  entityRegistrationProposal,
  evidenceDeskReference,
  projectRoomMapping,
  adapterConnectionIntent,
  sharedControlBoundary
};
