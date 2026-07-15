'use strict';

const {
  ENTITY_TYPES,
  RELATION_TYPES,
  OPERATION_TYPES,
  ACTOR_TYPES,
  PROPOSAL_STATUSES,
  CONNECTION_MODES
} = require('./constants');
const TruthFacets = require('./truth-facets');
const Identity = require('./identity');

const ENTITY_REQUIRED = [
  'mirror_id', 'schema_version', 'entity_type', 'name', 'description',
  'source_system', 'source_native_id', 'created_by', 'created_at', 'updated_at',
  'truth_facets', 'state', 'capabilities', 'relations', 'provenance',
  'evidence_refs', 'permissions', 'adapter_metadata', 'extensions'
];

const ENTITY_ALLOWED = new Set(ENTITY_REQUIRED.concat(['revision']));
const TYPE_REQUIRED = {
  material: ['material_id', 'category', 'source', 'dimensions', 'mass', 'moisture', 'density', 'strength_properties', 'thermal_properties', 'condition', 'measurement_quality', 'physical_truth_status', 'provenance'],
  structure: ['components', 'joints', 'support_relations', 'geometry_reference', 'material_assignments', 'construction_steps', 'intended_function', 'simulation_refs', 'inspection_refs', 'safety_status', 'physical_truth_status'],
  process: ['inputs', 'outputs', 'tools', 'capabilities', 'ordered_steps', 'preconditions', 'expected_duration', 'energy_requirements', 'waste_outputs', 'safety_constraints', 'evidence', 'verification_status'],
  project: ['project_status', 'goals', 'milestones', 'tasks', 'workspaces', 'evidence_gate', 'source_document_schema'],
  organisation: ['organisation_id', 'name', 'source', 'privacy_class', 'roles', 'teams', 'workspaces', 'processes', 'projects', 'tools', 'policies', 'external_references', 'mirror_scope', 'connection_mode', 'evidence', 'limitations'],
  capability: ['capability_id', 'provider', 'status'],
  evidence: ['evidence_id', 'evidence_type', 'claim_scope', 'limitations']
};

function outcome(errors) {
  return { ok: errors.length === 0, errors };
}

function object(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function required(value, fields, errors, prefix) {
  fields.forEach(function (field) {
    if (!(field in (value || {}))) errors.push((prefix || '') + field + ' required');
  });
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateActor(actor) {
  const errors = [];
  if (!object(actor)) return outcome(['actor object required']);
  required(actor, ['actor_id', 'actor_type', 'display_name', 'source_system', 'capabilities', 'permissions', 'provenance', 'status'], errors);
  if (!Identity.validActorId(actor.actor_id)) errors.push('invalid actor_id');
  if (!ACTOR_TYPES.includes(actor.actor_type)) errors.push('invalid actor_type');
  if (!Array.isArray(actor.capabilities)) errors.push('actor capabilities must be an array');
  if (!Array.isArray(actor.permissions)) errors.push('actor permissions must be an array');
  if (!['active', 'paused', 'disconnected', 'revoked', 'retired'].includes(actor.status)) errors.push('invalid actor status');
  return outcome(errors);
}

function validateEntity(entity) {
  const errors = [];
  if (!object(entity)) return outcome(['entity object required']);
  required(entity, ENTITY_REQUIRED, errors);
  Object.keys(entity).forEach(function (key) {
    if (!ENTITY_ALLOWED.has(key)) errors.push('unknown top-level entity field: ' + key + '; use extensions');
  });
  if (!Identity.validMirrorId(entity.mirror_id)) errors.push('invalid mirror_id');
  if (entity.schema_version !== 'axm.mirror.entity/v1') errors.push('unsupported entity schema version');
  if (!ENTITY_TYPES.includes(entity.entity_type)) errors.push('unregistered entity_type');
  if (!String(entity.name || '').trim()) errors.push('entity name required');
  if (!String(entity.source_system || '').trim()) errors.push('source_system required');
  if (!String(entity.source_native_id || '').trim()) errors.push('source_native_id required');
  errors.push.apply(errors, validateActor(entity.created_by).errors.map(function (e) { return 'created_by.' + e; }));
  errors.push.apply(errors, TruthFacets.validate(entity.truth_facets).errors);
  ['state', 'permissions', 'adapter_metadata', 'extensions'].forEach(function (field) {
    if (!object(entity[field])) errors.push(field + ' must be an object');
  });
  ['capabilities', 'relations', 'provenance', 'evidence_refs'].forEach(function (field) {
    if (!Array.isArray(entity[field])) errors.push(field + ' must be an array');
  });
  if (!validDate(entity.created_at) || !validDate(entity.updated_at)) errors.push('created_at and updated_at must be ISO dates');
  const typeFields = TYPE_REQUIRED[entity.entity_type];
  if (typeFields) {
    const data = entity.state && entity.state.type_data;
    if (!object(data)) errors.push(entity.entity_type + ' state.type_data required');
    else required(data, typeFields, errors, 'state.type_data.');
  }
  return outcome(errors);
}

function validateRelation(relation) {
  const errors = [];
  if (!object(relation)) return outcome(['relation object required']);
  required(relation, ['relation_id', 'schema_version', 'source_mirror_id', 'relation_type', 'target_mirror_id', 'created_by', 'created_at', 'provenance', 'status', 'verification'], errors);
  if (!Identity.validRelationId(relation.relation_id)) errors.push('invalid relation_id');
  if (relation.schema_version !== 'axm.mirror.relation/v1') errors.push('unsupported relation schema version');
  if (!RELATION_TYPES.includes(relation.relation_type)) errors.push('unsupported relation_type');
  if (!Identity.validMirrorId(relation.source_mirror_id) || !Identity.validMirrorId(relation.target_mirror_id)) errors.push('invalid relation endpoint');
  return outcome(errors);
}

function validateEvidence(evidence) {
  const errors = [];
  if (!object(evidence)) return outcome(['evidence object required']);
  required(evidence, ['evidence_id', 'schema_version', 'evidence_type', 'source', 'creator', 'timestamp', 'storage_reference', 'claim_scope', 'limitations', 'verification_status'], errors);
  if (!/^evidence:[a-z0-9._-]+(?::[a-z0-9._-]+)+$/.test(String(evidence.evidence_id || ''))) errors.push('invalid evidence_id');
  if (evidence.schema_version !== 'axm.mirror.evidence/v1') errors.push('unsupported evidence schema version');
  if (!['source_document', 'measurement', 'test_result', 'simulation_result', 'screenshot', 'log', 'user_attestation', 'adapter_receipt', 'external_reference', 'verifier_report'].includes(evidence.evidence_type)) errors.push('unsupported evidence_type');
  if (!Array.isArray(evidence.claim_scope) || !Array.isArray(evidence.limitations)) errors.push('claim_scope and limitations must be arrays');
  return outcome(errors);
}

function validateCapability(capability) {
  const errors = [];
  if (!object(capability)) return outcome(['capability object required']);
  required(capability, ['capability_id', 'schema_version', 'version', 'provider', 'description', 'input_schema', 'output_schema', 'permissions', 'truth_requirements', 'risk_class', 'reversibility', 'adapter_id', 'availability', 'status', 'evidence_refs'], errors);
  if (!/^[a-z][a-z0-9.-]*(\.[a-z0-9_-]+)+$/.test(String(capability.capability_id || ''))) errors.push('invalid capability_id');
  if (capability.schema_version !== 'axm.mirror.capability/v1') errors.push('unsupported capability schema version');
  if (!['declared', 'schema_valid', 'test_passed', 'approved', 'active', 'suspended', 'retired'].includes(capability.status)) errors.push('invalid capability status');
  return outcome(errors);
}

function validateMapping(mapping) {
  const errors = [];
  if (!object(mapping)) return outcome(['mapping object required']);
  required(mapping, ['mapping_id', 'schema_version', 'mirror_id', 'endpoints', 'mapping_status', 'created_by', 'evidence_refs', 'field_mappings', 'limitations'], errors);
  if (!Identity.validMappingId(mapping.mapping_id)) errors.push('invalid mapping_id');
  if (mapping.schema_version !== 'axm.mirror.mapping/v1') errors.push('unsupported mapping schema version');
  if (!Identity.validMirrorId(mapping.mirror_id)) errors.push('invalid mapped mirror_id');
  if (!Array.isArray(mapping.endpoints) || !mapping.endpoints.length) errors.push('mapping endpoints required');
  const seen = new Set();
  (mapping.endpoints || []).forEach(function (endpoint, index) {
    if (!endpoint || !endpoint.system_id || !endpoint.native_id || !endpoint.role) errors.push('mapping endpoint ' + index + ' is incomplete');
    const key = Identity.endpointKey(endpoint && endpoint.system_id, endpoint && endpoint.native_id);
    if (seen.has(key)) errors.push('duplicate endpoint inside mapping');
    seen.add(key);
  });
  return outcome(errors);
}

function containsExecutable(value, path, found) {
  found = found || [];
  path = path || 'operations';
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { containsExecutable(item, path + '[' + index + ']', found); });
  } else if (object(value)) {
    Object.keys(value).forEach(function (key) {
      if (['code', 'script', 'command', 'executable', 'shell', 'eval', 'function'].includes(key.toLowerCase())) found.push(path + '.' + key);
      containsExecutable(value[key], path + '.' + key, found);
    });
  }
  return found;
}

function validateProposal(packet) {
  const errors = [];
  if (!object(packet)) return outcome(['proposal object required']);
  required(packet, ['packet_id', 'schema_version', 'source_system', 'target_system', 'source_snapshot_id', 'target_snapshot_id', 'actor', 'intent', 'reason', 'operations', 'affected_entities', 'expected_preconditions', 'evidence_refs', 'risk_level', 'reversibility', 'requested_permissions', 'approval_requirements', 'created_at', 'status', 'validation_results', 'reviewer_decisions'], errors);
  if (!/^packet:[a-z0-9._-]+(?::[a-z0-9._-]+)+$/.test(String(packet.packet_id || ''))) errors.push('invalid packet_id');
  if (packet.schema_version !== 'axm.mirror.change-packet/v1') errors.push('unsupported proposal schema version');
  errors.push.apply(errors, validateActor(packet.actor).errors.map(function (e) { return 'actor.' + e; }));
  if (!Array.isArray(packet.operations) || !packet.operations.length || packet.operations.length > 100) errors.push('operations must contain 1 to 100 items');
  (packet.operations || []).forEach(function (operation, index) {
    if (!object(operation) || !OPERATION_TYPES.includes(operation.type)) errors.push('unsupported operation at index ' + index);
  });
  const executable = containsExecutable(packet.operations);
  if (executable.length) errors.push('arbitrary executable content refused at ' + executable.join(', '));
  if (!PROPOSAL_STATUSES.includes(packet.status)) errors.push('invalid proposal status');
  if (!['low', 'medium', 'high', 'critical'].includes(packet.risk_level)) errors.push('invalid risk level');
  if (!['reversible', 'conditional', 'not_reversible', 'unknown'].includes(packet.reversibility)) errors.push('invalid reversibility');
  if (!Array.isArray(packet.requested_permissions)) errors.push('requested_permissions must be an array');
  if (packet.expires_at && Date.parse(packet.expires_at) <= Date.now()) errors.push('proposal expired');
  return outcome(errors);
}

function validateConsent(receipt) {
  const errors = [];
  if (!object(receipt)) return outcome(['consent object required']);
  required(receipt, ['consent_id', 'schema_version', 'granted_by', 'granted_to', 'adapter', 'system', 'scope', 'allowed_operations', 'denied_operations', 'connection_mode', 'starts_at', 'expires_at', 'revocation_method', 'data_categories', 'purpose', 'audit_reference', 'status'], errors);
  if (receipt.schema_version !== 'axm.mirror.consent/v1') errors.push('unsupported consent schema version');
  if (!['read_only', 'proposal_only', 'approved_apply'].includes(receipt.connection_mode)) errors.push('unsupported consent connection mode');
  if (!Array.isArray(receipt.allowed_operations) || !Array.isArray(receipt.denied_operations)) errors.push('consent operations must be arrays');
  return outcome(errors);
}

function validateAdapterDescriptor(adapter) {
  const errors = [];
  if (!object(adapter)) return outcome(['adapter descriptor required']);
  required(adapter, ['adapter_id', 'schema_version', 'adapter_version', 'system_type', 'source_system_id', 'supported_schema_versions', 'supported_entity_types', 'supported_operations', 'read_capabilities', 'write_capabilities', 'connection_modes', 'permission_requirements', 'limitations'], errors);
  if (adapter.schema_version !== 'axm.mirror.adapter/v1') errors.push('unsupported adapter schema version');
  if (!(adapter.connection_modes || []).every(function (mode) { return CONNECTION_MODES.includes(mode); })) errors.push('unsupported adapter connection mode');
  return outcome(errors);
}

function validateInteraction(schemaId, value) {
  const errors = [];
  if (!object(value)) return outcome(['interaction object required']);
  if (value.schema_version !== schemaId) errors.push('schema_version must be ' + schemaId);
  if (schemaId === 'axm.party.session/v1') {
    required(value, ['session_id', 'game_id', 'status', 'host_actor_id', 'min_seats', 'max_seats', 'team_layout', 'seat_ids', 'ready_policy', 'local_authority', 'default_ai_fill', 'created_at'], errors);
    if (value.default_ai_fill !== false) errors.push('default AI fill must remain false');
    if (!Number.isInteger(value.min_seats) || value.min_seats < 1 || value.min_seats > 8) errors.push('min_seats must be 1..8');
    if (!Number.isInteger(value.max_seats) || value.max_seats < 1 || value.max_seats > 8) errors.push('max_seats must be 1..8');
    if (Number.isInteger(value.min_seats) && Number.isInteger(value.max_seats) && value.min_seats > value.max_seats) errors.push('min_seats cannot exceed max_seats');
    if (!Array.isArray(value.seat_ids) || new Set(value.seat_ids).size !== value.seat_ids.length) errors.push('seat_ids must be unique');
    if (Array.isArray(value.seat_ids) && (value.seat_ids.length < 1 || value.seat_ids.length > value.max_seats)) errors.push('seat_ids must contain 1..max_seats available seats');
    const assigned = new Set();
    (value.team_layout || []).forEach(function (team) {
      (team.seat_ids || []).forEach(function (seatId) {
        if (!(value.seat_ids || []).includes(seatId)) errors.push('team refers to unknown seat: ' + seatId);
        if (assigned.has(seatId)) errors.push('seat belongs to more than one team: ' + seatId);
        assigned.add(seatId);
      });
    });
  } else if (schemaId === 'axm.controls.seat-binding/v1') {
    required(value, ['binding_id', 'session_id', 'seat_id', 'actor_id', 'actor_type', 'controller_kind', 'controller_adapter_id', 'control_surface_id', 'observation_scope_id', 'assignment_status', 'assigned_by', 'consent_id', 'permissions', 'visible_to_party', 'created_at'], errors);
    if (value.visible_to_party !== true) errors.push('seat binding must be visible to party');
    if (value.actor_type === 'ai' && (value.controller_kind !== 'ai_adapter' || !value.controller_adapter_id)) errors.push('AI seat requires a visible AI adapter binding');
    if (value.actor_type === 'human' && value.controller_kind !== 'human_client') errors.push('human seat requires the human client control shape');
  } else if (schemaId === 'axm.controls.surface/v1') {
    required(value, ['control_surface_id', 'game_id', 'version', 'actions', 'rate_limits', 'actor_neutral', 'hidden_machine_actions', 'input_intentions_only'], errors);
    if (value.actor_neutral !== true || value.hidden_machine_actions !== false || value.input_intentions_only !== true) errors.push('control surface violates shared-control parity');
  } else if (schemaId === 'axm.controls.action-intention/v1') {
    required(value, ['intention_id', 'session_id', 'seat_id', 'actor_id', 'binding_id', 'control_surface_id', 'control_surface_version', 'action_id', 'sequence', 'payload', 'created_at'], errors);
  } else if (schemaId === 'axm.controls.observation/v1') {
    required(value, ['observation_id', 'session_id', 'seat_id', 'observation_scope_id', 'tick', 'representation', 'observation_basis', 'source_view_hash', 'payload', 'withheld_fields', 'includes_only_visible_to_seat', 'created_at'], errors);
    if (value.observation_basis !== 'seat_player_view' || value.includes_only_visible_to_seat !== true) errors.push('observation must be limited to the seat player view');
    const forbidden = ['authoritative_state', 'server_state', 'omniscient', 'hidden_entities', 'all_private_players'];
    forbidden.forEach(function (key) {
      if (value.payload && key in value.payload) errors.push('observation exposes non-seat state: ' + key);
    });
  } else {
    errors.push('unknown interaction schema');
  }
  return outcome(errors);
}

module.exports = {
  validateActor,
  validateEntity,
  validateRelation,
  validateEvidence,
  validateCapability,
  validateMapping,
  validateProposal,
  validateConsent,
  validateAdapterDescriptor,
  validateInteraction,
  containsExecutable
};
