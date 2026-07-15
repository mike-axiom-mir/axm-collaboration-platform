'use strict';

const ENTITY_TYPES = [
  'world', 'region', 'resource', 'material', 'component', 'tool', 'machine',
  'structure', 'workspace', 'process', 'recipe', 'project', 'task', 'asset',
  'document', 'dataset', 'module', 'service', 'capability', 'role', 'actor',
  'team', 'organisation', 'policy', 'evidence', 'measurement', 'simulation',
  'real_reference'
];

const RELATION_TYPES = [
  'contains', 'located_in', 'built_from', 'produced_by', 'consumes', 'produces',
  'depends_on', 'operated_by', 'owned_by', 'stewarded_by', 'represents',
  'mirrors', 'derived_from', 'verifies', 'contradicts', 'supersedes',
  'connected_to', 'exports_to', 'imports_from', 'implements',
  'requires_capability', 'governed_by'
];

const OPERATION_TYPES = [
  'create_entity', 'update_fields', 'add_relation', 'remove_relation',
  'archive_entity', 'attach_evidence', 'update_truth_facet',
  'register_capability', 'map_native_entity', 'request_adapter_action'
];

const CONNECTION_MODES = [
  'disconnected', 'read_only', 'proposal_only', 'approved_apply',
  'bounded_auto_apply'
];

const ACTOR_TYPES = [
  'human', 'ai', 'adapter', 'local_service', 'governance_group',
  'imported_external_actor'
];

const PERMISSIONS = [
  'read_entity', 'read_evidence', 'create_proposal', 'amend_own_proposal',
  'review_proposal', 'approve_proposal', 'apply_change', 'rollback_change',
  'connect_adapter', 'disconnect_adapter', 'export_snapshot',
  'import_snapshot', 'promote_truth_status'
];

const PROPOSAL_STATUSES = [
  'DRAFT', 'VALIDATED', 'PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'APPLYING',
  'APPLIED', 'VERIFIED', 'REJECTED', 'AMENDMENT_REQUIRED', 'CONFLICTED',
  'EXPIRED', 'FAILED', 'ROLLED_BACK', 'PARTIALLY_APPLIED'
];

const TRUTH_FACETS = {
  origin: ['world_native', 'platform_native', 'real_import', 'generated', 'user_entered', 'adapter_import', 'unknown'],
  representation: ['visual_only', 'text_description', 'structured_model', 'executable_model', 'measured_record', 'external_reference'],
  verification: ['unverified', 'schema_valid', 'simulated', 'tested', 'evidence_supported', 'independently_checked', 'failed', 'disputed'],
  connection: ['detached', 'read_only', 'proposal_only', 'approved_sync', 'paused', 'disconnected'],
  physical_status: ['not_applicable', 'not_evaluated', 'approximate', 'simulated', 'physically_tested', 'measurement_backed', 'contradicted'],
  operational_status: ['concept', 'planned', 'prototype', 'active_local', 'archived', 'retired', 'mirrored_real_operation']
};

module.exports = {
  ENTITY_TYPES,
  RELATION_TYPES,
  OPERATION_TYPES,
  CONNECTION_MODES,
  ACTOR_TYPES,
  PERMISSIONS,
  PROPOSAL_STATUSES,
  TRUTH_FACETS
};
