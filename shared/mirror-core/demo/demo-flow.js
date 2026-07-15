'use strict';

const path = require('path');
const { MirrorCore, MIKE_ID, AI_ID } = require('../core/mirror-core');
const { clone, now, atomicWriteJson, deepEqual } = require('../core/utils');

function actorForEntity(actor) {
  return clone(actor);
}

function projectMirrorEntity(actor) {
  const at = now();
  return {
    mirror_id: 'mir:shared:project:forest-workshop',
    schema_version: 'axm.mirror.entity/v1',
    entity_type: 'project',
    name: 'Forest Workshop Project',
    description: 'Approved local project representation proposed from the mock-world Forest Workshop concept.',
    source_system: 'mock-world',
    source_native_id: 'proposed-project:structure-forest-workshop',
    created_by: actorForEntity(actor),
    created_at: at,
    updated_at: at,
    revision: 1,
    truth_facets: {
      origin: 'world_native',
      representation: 'structured_model',
      verification: 'schema_valid',
      connection: 'approved_sync',
      physical_status: 'not_evaluated',
      operational_status: 'prototype'
    },
    state: {
      native_state: { proposed_from: 'structure-forest-workshop' },
      type_data: {
        project_status: 'planning',
        goals: ['Review the workshop concept without claiming physical validity.'],
        milestones: [],
        tasks: [],
        workspaces: ['workspace-forest-workshop'],
        evidence_gate: { completion_requires_evidence: true },
        source_document_schema: 'axm.project-room/v1'
      }
    },
    capabilities: ['world.construct.structure'],
    relations: [],
    provenance: [{ source_system: 'mock-world', source_native_id: 'structure-forest-workshop', transform: 'reviewed project representation proposal', actor: actor.actor_id, time: at, adapter_version: '0.1.0', input_hash: null, output_hash: null, limitations: ['No physical validity implied.'] }],
    evidence_refs: ['evidence:mock-world:seed-fixture'],
    permissions: {},
    adapter_metadata: { target_adapter_id: 'adapter:mock:platform' },
    extensions: {}
  };
}

function workspaceMirrorEntity(actor) {
  const at = now();
  return {
    mirror_id: 'mir:shared:workspace:forest-workshop',
    schema_version: 'axm.mirror.entity/v1',
    entity_type: 'workspace',
    name: 'Forest Workshop Workspace',
    description: 'Local workspace representation created only after explicit review.',
    source_system: 'mock-world',
    source_native_id: 'proposed-workspace:structure-forest-workshop',
    created_by: actorForEntity(actor),
    created_at: at,
    updated_at: at,
    revision: 1,
    truth_facets: {
      origin: 'world_native',
      representation: 'structured_model',
      verification: 'schema_valid',
      connection: 'approved_sync',
      physical_status: 'not_applicable',
      operational_status: 'prototype'
    },
    state: { native_state: { purpose: 'reviewed workshop planning' } },
    capabilities: [],
    relations: [],
    provenance: [{ source_system: 'mock-world', source_native_id: 'structure-forest-workshop', transform: 'reviewed workspace representation proposal', actor: actor.actor_id, time: at, adapter_version: '0.1.0', input_hash: null, output_hash: null, limitations: ['Standalone compatibility harness only.'] }],
    evidence_refs: ['evidence:mock-world:seed-fixture'],
    permissions: {},
    adapter_metadata: { target_adapter_id: 'adapter:mock:platform' },
    extensions: {}
  };
}

function constructionCapability() {
  return {
    capability_id: 'world.construct.structure',
    schema_version: 'axm.mirror.capability/v1',
    version: '0.1.0-mock',
    provider: 'mock-world',
    description: 'Mock declaration that structured construction proposals can be represented. No physical build is performed.',
    input_schema: { type: 'object', required: ['structure_native_id'] },
    output_schema: { type: 'object', required: ['proposal_reference'] },
    permissions: ['create_proposal'],
    truth_requirements: { structure_verification: ['schema_valid'], physical_claim_allowed: false },
    risk_class: 'high',
    reversibility: 'reversible',
    adapter_id: 'adapter:mock:world',
    availability: 'available',
    status: 'declared',
    evidence_refs: ['evidence:mock-world:seed-fixture'],
    extensions: { mock_only: true }
  };
}

function normalizedAdapterState(state) {
  const out = clone(state);
  delete out.revision;
  delete out.updated_at;
  return out;
}

function runDemo(options) {
  options = options || {};
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '..'));
  const core = new MirrorCore({ rootDir, runtimeDir: options.runtimeDir });
  core.reset();
  const mike = core.actor(MIKE_ID);
  const ai = core.actor(AI_ID);

  const worldImport = core.importAuthorizedSnapshot('adapter:mock:world', MIKE_ID);
  const platformImport = core.importAuthorizedSnapshot('adapter:mock:platform', MIKE_ID);
  const platformSeed = clone(core.adapters.platform.exportSnapshot());

  const capability = constructionCapability();
  const capabilityPacket = core.createProposal({
    source_system: 'mock-world',
    target_system: 'mock-world',
    target_adapter_id: 'adapter:mock:world',
    actor_id: AI_ID,
    source_snapshot_id: worldImport.snapshot.snapshot_id,
    target_snapshot_id: worldImport.snapshot.snapshot_id,
    intent: 'Register a bounded future construction capability in the mock world.',
    reason: 'Prove capability growth through a reviewed packet instead of a hardcoded hidden update.',
    operations: [{ type: 'register_capability', capability }],
    affected_entities: ['mir:world:structure:forest-workshop'],
    evidence_refs: ['evidence:mock-world:seed-fixture'],
    reversibility: 'reversible',
    extensions: { truth_unknowns: ['No physics or physical construction capability exists.'] }
  });
  core.validateProposal(capabilityPacket.packet_id, AI_ID);
  core.propose(capabilityPacket.packet_id, AI_ID);
  core.review(capabilityPacket.packet_id, MIKE_ID, 'Review mock capability boundaries.');
  core.approve(capabilityPacket.packet_id, MIKE_ID, 'Approve mock-only capability registration.');
  const capabilityApply = core.apply(capabilityPacket.packet_id, MIKE_ID);
  const capabilityVerify = core.verify(capabilityApply.receipt.application_id, MIKE_ID);
  const worldAfterCapability = core.snapshots.capture(core.adapters.world, mike, 'post-capability', capabilityPacket.packet_id);

  const projectMirror = projectMirrorEntity(ai);
  const workspaceMirror = workspaceMirrorEntity(ai);
  const primaryPacket = core.createProposal({
    source_system: 'mock-world',
    target_system: 'mock-platform',
    target_adapter_id: 'adapter:mock:platform',
    actor_id: AI_ID,
    source_snapshot_id: worldAfterCapability.snapshot_id,
    target_snapshot_id: platformImport.snapshot.snapshot_id,
    intent: 'Create a reviewed local project and workspace representation for Forest Workshop.',
    reason: 'Coordinate the world concept with local planning while keeping both systems separate.',
    operations: [
      {
        type: 'create_entity',
        native_entity: {
          native_id: 'project-forest-workshop',
          entity_type: 'project',
          name: 'Forest Workshop Project',
          description: 'Local project representation; not a physically validated workshop.',
          state: { status: 'planning', source_world_entity: 'structure-forest-workshop' },
          evidence_refs: ['evidence:mock-world:seed-fixture']
        },
        mirror_entity: projectMirror
      },
      {
        type: 'create_entity',
        native_entity: {
          native_id: 'workspace-forest-workshop',
          entity_type: 'workspace',
          name: 'Forest Workshop Workspace',
          description: 'Review workspace created from an approved Mirror packet.',
          state: { status: 'active_local' },
          evidence_refs: []
        },
        mirror_entity: workspaceMirror
      },
      {
        type: 'add_relation',
        native_relation: {
          relation_id: 'platform-rel-forest-workshop',
          source_native_id: 'project-forest-workshop',
          relation_type: 'contains',
          target_native_id: 'workspace-forest-workshop'
        }
      },
      {
        type: 'attach_evidence',
        native_id: 'project-forest-workshop',
        evidence_ref: 'evidence:mock-world:seed-fixture'
      },
      {
        type: 'register_capability',
        capability: capability
      },
      {
        type: 'map_native_entity',
        scope: 'mirror_core',
        mapping: {
          mapping_id: 'map:forest-workshop:project',
          schema_version: 'axm.mirror.mapping/v1',
          mirror_id: 'mir:shared:project:forest-workshop',
          endpoints: [
            { system_id: 'mock-world', native_id: 'structure-forest-workshop', role: 'world_representation' },
            { system_id: 'mock-platform', native_id: 'project-forest-workshop', role: 'platform_representation' }
          ],
          mapping_status: 'proposed',
          created_by: ai,
          evidence_refs: ['evidence:mock-world:seed-fixture'],
          field_mappings: { name: 'name', description: 'description' },
          limitations: ['Representation link, not identity equivalence.', 'No real project or structure is controlled.'],
          mapping_kind: 'representation_only'
        }
      }
    ],
    affected_entities: ['mir:world:structure:forest-workshop', 'mir:shared:project:forest-workshop', 'mir:shared:workspace:forest-workshop'],
    evidence_refs: ['evidence:mock-world:seed-fixture'],
    reversibility: 'reversible',
    extensions: {
      truth_unknowns: ['Material measurements unknown.', 'Physics not evaluated.', 'No real company or construction system connected.']
    }
  });
  core.validateProposal(primaryPacket.packet_id, AI_ID);
  core.propose(primaryPacket.packet_id, AI_ID);
  core.review(primaryPacket.packet_id, MIKE_ID, 'Check source, unknowns, evidence scope, exact diff, and rollback.');
  const primaryPreview = core.preview(primaryPacket.packet_id);
  core.approve(primaryPacket.packet_id, MIKE_ID, 'Mock-only, reversible, source-bounded application approved.');
  const primaryApply = core.apply(primaryPacket.packet_id, MIKE_ID);
  const primaryVerify = core.verify(primaryApply.receipt.application_id, MIKE_ID);

  const backPacket = core.createProposal({
    source_system: 'mock-platform',
    target_system: 'mock-world',
    target_adapter_id: 'adapter:mock:world',
    actor_id: AI_ID,
    source_snapshot_id: primaryApply.receipt.post_snapshot_id,
    target_snapshot_id: worldAfterCapability.snapshot_id,
    intent: 'Propose a description update back to the mock world.',
    reason: 'Demonstrate that reverse direction requires its own decision.',
    operations: [{
      type: 'update_fields',
      native_id: 'structure-forest-workshop',
      patch: { description: 'Platform-proposed description; not accepted.' }
    }],
    affected_entities: ['mir:world:structure:forest-workshop'],
    evidence_refs: [],
    reversibility: 'reversible'
  });
  core.validateProposal(backPacket.packet_id, AI_ID);
  core.propose(backPacket.packet_id, AI_ID);
  core.review(backPacket.packet_id, MIKE_ID, 'Reverse direction is reviewed separately.');
  core.reject(backPacket.packet_id, MIKE_ID, 'Keep the mock-world description unchanged.');

  const conflictPacket = core.createProposal({
    source_system: 'mock-world',
    target_system: 'mock-platform',
    target_adapter_id: 'adapter:mock:platform',
    actor_id: AI_ID,
    source_snapshot_id: worldAfterCapability.snapshot_id,
    target_snapshot_id: platformImport.snapshot.snapshot_id,
    target_revision: platformImport.snapshot.revision,
    intent: 'Attempt a stale update to prove optimistic concurrency.',
    reason: 'This packet intentionally targets the pre-application platform revision.',
    operations: [{
      type: 'update_fields',
      native_id: 'workspace-mirror-research',
      patch: { description: 'This stale update must be blocked.' }
    }],
    affected_entities: ['mir:platform:workspace:mirror-research'],
    expected_preconditions: [{
      kind: 'field_equals',
      native_id: 'workspace-mirror-research',
      path: 'description',
      value: 'Mock platform workspace.',
      proposed_value: 'This stale update must be blocked.'
    }],
    evidence_refs: [],
    reversibility: 'reversible'
  });
  core.validateProposal(conflictPacket.packet_id, AI_ID);
  core.propose(conflictPacket.packet_id, AI_ID);
  core.review(conflictPacket.packet_id, MIKE_ID, 'Intentionally approve for conflict-detector proof.');
  core.approve(conflictPacket.packet_id, MIKE_ID, 'Approval does not bypass concurrency checks.');
  const conflictResult = core.apply(conflictPacket.packet_id, MIKE_ID);

  const rollback = core.rollback(primaryApply.receipt.application_id, MIKE_ID);
  const platformRestored = deepEqual(
    normalizedAdapterState(platformSeed),
    normalizedAdapterState(core.adapters.platform.exportSnapshot())
  );
  const journal = core.journal.verify();
  const finalState = core.store.read();
  const result = {
    schema: 'axm.mirror.demo-result/v1',
    status: journal.ok && platformRestored && conflictResult.status === 'CONFLICTED' && rollback.status === 'ROLLED_BACK' ? 'PASS' : 'FAIL',
    completed_at: now(),
    world_import: { snapshot_id: worldImport.snapshot.snapshot_id, imported_entities: worldImport.imported_entities.length },
    platform_import: { snapshot_id: platformImport.snapshot.snapshot_id, imported_entities: platformImport.imported_entities.length },
    capability_gain: {
      packet_id: capabilityPacket.packet_id,
      application_id: capabilityApply.receipt.application_id,
      verified: capabilityVerify.ok,
      world_has_capability: core.adapters.world.exportSnapshot().capabilities.some(function (item) { return item.capability_id === capability.capability_id; })
    },
    primary_flow: {
      packet_id: primaryPacket.packet_id,
      preview_changes: primaryPreview.adapter_preview.diff.count,
      preview_conflicts: primaryPreview.conflicts.length,
      application_id: primaryApply.receipt.application_id,
      verified: primaryVerify.ok,
      final_status: finalState.proposals[primaryPacket.packet_id].status
    },
    reverse_flow: {
      packet_id: backPacket.packet_id,
      final_status: finalState.proposals[backPacket.packet_id].status,
      world_description_unchanged: core.adapters.world.getEntity('structure-forest-workshop').description === 'A proposed workshop represented in the mock world.'
    },
    conflict_flow: {
      packet_id: conflictPacket.packet_id,
      blocked: conflictResult.applied === false,
      final_status: conflictResult.status,
      conflicts: conflictResult.conflicts.map(function (item) { return item.type; })
    },
    rollback: {
      application_id: primaryApply.receipt.application_id,
      status: rollback.status,
      platform_restored_to_seed: platformRestored,
      core_effects_reversed:
        !finalState.entities['mir:shared:project:forest-workshop'] &&
        !finalState.entities['mir:shared:workspace:forest-workshop'] &&
        !finalState.mappings['map:forest-workshop:project']
    },
    journal,
    truth_boundaries: {
      world_built: false,
      physics_built: false,
      vr_built: false,
      real_company_connected: false,
      foundation_installed: false,
      github_modified: false
    }
  };
  atomicWriteJson(path.join(core.runtimeDir, 'demo-result.json'), result);
  return result;
}

if (require.main === module) {
  try {
    const result = runDemo();
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    process.stderr.write('DEMO FAIL: ' + error.stack + '\n');
    process.exitCode = 1;
  }
}

module.exports = { runDemo, constructionCapability, normalizedAdapterState };
