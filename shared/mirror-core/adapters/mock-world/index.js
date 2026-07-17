'use strict';

const path = require('path');
const { MockSystemAdapter } = require('../mock-system-adapter');

function createMockWorldAdapter(rootDir, runtimeDir) {
  return new MockSystemAdapter({
    descriptor: {
      adapter_id: 'adapter:mock:world',
      schema_version: 'axm.mirror.adapter/v1',
      adapter_version: '0.1.0',
      system_type: 'headless_mock_world',
      source_system_id: 'mock-world',
      supported_schema_versions: ['axm.mirror.entity/v1', 'axm.mirror.change-packet/v1'],
      supported_entity_types: ['world', 'region', 'resource', 'material', 'structure', 'process', 'actor', 'capability'],
      supported_operations: ['create_entity', 'update_fields', 'add_relation', 'remove_relation', 'archive_entity', 'attach_evidence', 'update_truth_facet', 'register_capability', 'request_adapter_action'],
      read_capabilities: ['export_snapshot', 'read_entities', 'resolve_native_id'],
      write_capabilities: ['preview_apply', 'apply_approved_packet', 'rollback_application'],
      connection_modes: ['disconnected', 'read_only', 'proposal_only', 'approved_apply'],
      permission_requirements: ['read_entity', 'create_proposal', 'apply_change', 'rollback_change'],
      limitations: ['mock data only', 'no renderer', 'no physics', 'no live world']
    },
    seedFile: path.join(rootDir, 'demo', 'seed-world.json'),
    stateFile: path.join(runtimeDir, 'adapters', 'mock-world.json')
  });
}

module.exports = { createMockWorldAdapter };
