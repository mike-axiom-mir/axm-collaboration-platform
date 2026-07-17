'use strict';

const path = require('path');
const { MockSystemAdapter } = require('../mock-system-adapter');

function createMockPlatformAdapter(rootDir, runtimeDir) {
  return new MockSystemAdapter({
    descriptor: {
      adapter_id: 'adapter:mock:platform',
      schema_version: 'axm.mirror.adapter/v1',
      adapter_version: '0.1.0',
      system_type: 'mock_local_axm_platform',
      source_system_id: 'mock-platform',
      supported_schema_versions: ['axm.mirror.entity/v1', 'axm.mirror.change-packet/v1'],
      supported_entity_types: ['project', 'workspace', 'module', 'process', 'team', 'evidence', 'capability'],
      supported_operations: ['create_entity', 'update_fields', 'add_relation', 'remove_relation', 'archive_entity', 'attach_evidence', 'update_truth_facet', 'register_capability', 'request_adapter_action'],
      read_capabilities: ['export_snapshot', 'read_entities', 'resolve_native_id'],
      write_capabilities: ['preview_apply', 'apply_approved_packet', 'rollback_application'],
      connection_modes: ['disconnected', 'read_only', 'proposal_only', 'approved_apply'],
      permission_requirements: ['read_entity', 'create_proposal', 'apply_change', 'rollback_change'],
      limitations: ['standalone harness', 'not installed in Foundation', 'mock project records only']
    },
    seedFile: path.join(rootDir, 'demo', 'seed-platform.json'),
    stateFile: path.join(runtimeDir, 'adapters', 'mock-platform.json')
  });
}

module.exports = { createMockPlatformAdapter };
