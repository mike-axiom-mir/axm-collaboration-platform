'use strict';

const path = require('path');
const { JsonStore } = require('../storage/json-store');
const { EventJournal } = require('../journal/event-journal');
const { SnapshotStore } = require('../journal/snapshot-store');
const { SchemaRegistry } = require('./schema-registry');
const { MirrorRegistry } = require('./registry');
const { RelationGraph } = require('./relation-graph');
const { CapabilityRegistry } = require('./capability-registry');
const { PermissionEngine } = require('../gate/permission-engine');
const { ConsentEngine } = require('../gate/consent-engine');
const { MirrorGate } = require('../gate/mirror-gate');
const Lifecycle = require('../gate/proposal-lifecycle');
const Risk = require('../gate/risk-classifier');
const { ConflictDetector } = require('../gate/conflict-detector');
const { BridgeManager, SERVICE_ACTOR_ID } = require('../bridge/bridge-manager');
const { ApplicationService } = require('../bridge/application-service');
const { VerificationService } = require('../bridge/verification-service');
const { RollbackService } = require('../journal/rollback-service');
const { createMockWorldAdapter } = require('../adapters/mock-world');
const { createMockPlatformAdapter } = require('../adapters/mock-platform');
const { SafeFileProjectAdapter } = require('../adapters/safe-file-project');
const Validation = require('./validation');
const {
  clone,
  now,
  makeId,
  safeText
} = require('./utils');
const { OPERATION_TYPES, PERMISSIONS } = require('./constants');

const MIKE_ID = 'actor:human:mike';
const AI_ID = 'actor:ai:axiom-mir-test';

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

function actorRecord(id, type, name, permissions) {
  return {
    actor_id: id,
    actor_type: type,
    display_name: name,
    source_system: 'mirror-core-local',
    capabilities: [],
    permissions: permissions.map(function (permission) {
      return { permission, effect: 'allow', scope: { type: 'global' } };
    }),
    active_session: null,
    provenance: [{ source: 'local bootstrap', at: now() }],
    status: 'active'
  };
}

class MirrorCore {
  constructor(options) {
    options = options || {};
    this.rootDir = path.resolve(options.rootDir || path.join(__dirname, '..'));
    this.runtimeDir = path.resolve(options.runtimeDir || path.join(this.rootDir, 'storage', 'runtime'));
    this.store = new JsonStore(this.runtimeDir);
    this.journal = new EventJournal(this.runtimeDir);
    this.snapshots = new SnapshotStore(this.runtimeDir, this.journal);
    this.schemas = new SchemaRegistry(path.join(this.rootDir, 'schemas'));
    this.registry = new MirrorRegistry(this.store, this.journal);
    this.relations = new RelationGraph(this.store, this.journal);
    this.capabilities = new CapabilityRegistry(this.store, this.journal);
    this.permissionEngine = new PermissionEngine(this.store);
    this.consentEngine = new ConsentEngine(this.store, this.journal);
    this.gate = new MirrorGate(this.permissionEngine, this.consentEngine, this.journal);
    this.bridge = new BridgeManager(this.store, this.gate, this.journal);
    this.adapters = {
      world: createMockWorldAdapter(this.rootDir, this.runtimeDir),
      platform: createMockPlatformAdapter(this.rootDir, this.runtimeDir),
      safeFile: new SafeFileProjectAdapter({
        fixtureSource: path.join(this.rootDir, 'storage', 'fixtures', 'safe-project'),
        root: path.join(this.runtimeDir, 'adapters', 'safe-file-project')
      })
    };
    Object.values(this.adapters).forEach((adapter) => this.bridge.register(adapter));
    this.conflictDetector = new ConflictDetector(this.store);
    this.applicationService = new ApplicationService({
      store: this.store,
      registry: this.registry,
      relations: this.relations,
      capabilities: this.capabilities,
      bridge: this.bridge,
      snapshots: this.snapshots,
      journal: this.journal,
      gate: this.gate,
      conflicts: this.conflictDetector
    });
    this.verificationService = new VerificationService({
      store: this.store,
      bridge: this.bridge,
      registry: this.registry,
      journal: this.journal
    });
    this.rollbackService = new RollbackService({
      store: this.store,
      bridge: this.bridge,
      snapshots: this.snapshots,
      registry: this.registry,
      relations: this.relations,
      gate: this.gate,
      journal: this.journal
    });
    if (!Object.keys(this.store.read().actors).length) this.reset();
  }

  actor(actorId) {
    const actor = this.store.read().actors[actorId];
    if (!actor) throw new Error('actor not registered: ' + actorId);
    return clone(actor);
  }

  bootstrapActors() {
    this.registry.registerActor(actorRecord(MIKE_ID, 'human', 'Mike', PERMISSIONS));
    this.registry.registerActor(actorRecord(AI_ID, 'ai', 'Axiom/Mir Test Agent', [
      'read_entity', 'read_evidence', 'create_proposal', 'amend_own_proposal', 'export_snapshot'
    ]));
    this.registry.registerActor(actorRecord(SERVICE_ACTOR_ID, 'local_service', 'Mirror Core Local Service', [
      'read_entity', 'read_evidence', 'export_snapshot', 'import_snapshot'
    ]));
  }

  consentFor(adapter) {
    return {
      consent_id: 'consent:local:' + slug(adapter.descriptor.source_system_id),
      schema_version: 'axm.mirror.consent/v1',
      granted_by: MIKE_ID,
      granted_to: SERVICE_ACTOR_ID,
      adapter: adapter.descriptor.adapter_id,
      system: adapter.descriptor.source_system_id,
      scope: { type: 'adapter', adapter_id: adapter.descriptor.adapter_id },
      allowed_operations: ['connect_adapter', 'read_entity', 'create_proposal', 'apply_change', 'rollback_change'].concat(OPERATION_TYPES),
      denied_operations: ['bounded_auto_apply'],
      connection_mode: 'approved_apply',
      starts_at: now(),
      expires_at: null,
      revocation_method: 'POST /mirror/consents/:id/revoke',
      data_categories: ['mock entities', 'mock evidence', 'mock snapshots'],
      purpose: 'Deterministic local Mirror Core compatibility demonstration',
      audit_reference: 'journal:local',
      status: 'active',
      revoked_at: null,
      revoked_by: null
    };
  }

  reset() {
    this.store.reset();
    this.journal.reset();
    this.snapshots.reset();
    Object.values(this.adapters).forEach(function (adapter) { adapter.reset(); });
    this.bridge.refreshRegistrationState();
    Object.values(this.adapters).forEach((adapter) => {
      this.journal.append('adapter_registered', {
        system: adapter.descriptor.source_system_id,
        payload: { adapter_id: adapter.descriptor.adapter_id, limitations: adapter.descriptor.limitations }
      });
    });
    this.bootstrapActors();
    const mike = this.actor(MIKE_ID);
    Object.values(this.adapters).forEach((adapter) => {
      const receipt = this.consentFor(adapter);
      this.consentEngine.grant(receipt, mike);
      this.bridge.connect(adapter.descriptor.adapter_id, 'approved_apply', mike, receipt.consent_id);
    });
    this.journal.append('demo_reset', { actor: mike, system: 'mirror-core', payload: { note: 'Deterministic mock state restored; no real system touched.' } });
    return this.status();
  }

  status() {
    const state = this.store.read();
    const chain = this.journal.verify();
    return {
      ok: true,
      schema: 'axm.mirror.health/v1',
      status: 'WORKING TEST',
      local_only: true,
      foundation_installed: false,
      foundation_compatibility_harness: true,
      revision: state.revision,
      authority_revision: state.authority_revision,
      counts: {
        actors: Object.keys(state.actors).length,
        entities: Object.keys(state.entities).length,
        relations: Object.keys(state.relations).length,
        evidence: Object.keys(state.evidence).length,
        capabilities: Object.keys(state.capabilities).length,
        mappings: Object.keys(state.mappings).length,
        proposals: Object.keys(state.proposals).length,
        applications: Object.keys(state.applications).length,
        events: chain.count,
        snapshots: this.snapshots.list().length
      },
      journal: chain,
      adapters: this.bridge.list()
    };
  }

  importAuthorizedSnapshot(adapterId, actorId) {
    const actor = this.actor(actorId);
    const adapter = this.bridge.get(adapterId);
    if (!adapter) throw new Error('adapter not registered');
    this.gate.require({
      actor_id: actorId,
      actor,
      permission: 'read_entity',
      context: { system_id: adapter.descriptor.source_system_id },
      consent: {
        adapter_id: adapterId,
        system_id: adapter.descriptor.source_system_id,
        granted_to: SERVICE_ACTOR_ID,
        connection_mode: 'read_only',
        operation: 'read_entity',
        scope: { type: 'adapter', adapter_id: adapterId }
      }
    });
    const snapshot = this.snapshots.capture(adapter, actor, 'authorised-import', null);
    const imported = [];
    const nativeToMirror = {};
    adapter.readEntities().forEach((nativeEntity) => {
      const existing = Object.values(this.store.read().entities).find(function (entity) {
        return entity.source_system === adapter.descriptor.source_system_id && entity.source_native_id === nativeEntity.native_id;
      });
      if (existing) {
        nativeToMirror[nativeEntity.native_id] = existing.mirror_id;
        return;
      }
      const mirrorId = nativeEntity.mirror_id || ('mir:' + slug(adapter.descriptor.source_system_id) + ':' + slug(nativeEntity.entity_type) + ':' + slug(nativeEntity.native_id));
      const entity = {
        mirror_id: mirrorId,
        schema_version: 'axm.mirror.entity/v1',
        entity_type: nativeEntity.entity_type,
        name: safeText(nativeEntity.name, 200) || nativeEntity.native_id,
        description: safeText(nativeEntity.description, 10000),
        source_system: adapter.descriptor.source_system_id,
        source_native_id: nativeEntity.native_id,
        created_by: clone(nativeEntity.created_by || actor),
        created_at: nativeEntity.created_at || now(),
        updated_at: nativeEntity.updated_at || now(),
        revision: 1,
        truth_facets: clone(nativeEntity.truth_facets || {
          origin: adapter.descriptor.source_system_id === 'mock-world' ? 'world_native' : 'platform_native',
          representation: 'structured_model',
          verification: 'schema_valid',
          connection: 'proposal_only',
          physical_status: 'not_evaluated',
          operational_status: 'prototype'
        }),
        state: { native_state: clone(nativeEntity.state || {}), type_data: clone(nativeEntity.type_data || {}) },
        capabilities: clone(nativeEntity.capabilities || []),
        relations: [],
        provenance: [{
          source_system: adapter.descriptor.source_system_id,
          source_native_id: nativeEntity.native_id,
          transform: 'authorised snapshot projection',
          actor: actor.actor_id,
          time: now(),
          adapter_version: adapter.descriptor.adapter_version,
          input_hash: snapshot.state_hash,
          output_hash: null,
          limitations: clone(adapter.descriptor.limitations)
        }],
        evidence_refs: clone(nativeEntity.evidence_refs || []),
        permissions: {},
        adapter_metadata: { adapter_id: adapterId, native_revision: nativeEntity.revision || 0 },
        extensions: { imported_from_snapshot: snapshot.snapshot_id }
      };
      const saved = this.registry.registerEntity(entity);
      nativeToMirror[nativeEntity.native_id] = saved.mirror_id;
      imported.push(saved.mirror_id);
    });
    const exported = adapter.exportSnapshot();
    (exported.evidence || []).forEach((evidence) => {
      if (!this.store.read().evidence[evidence.evidence_id]) this.registry.registerEvidence(evidence);
    });
    (exported.relations || []).forEach((nativeRelation, index) => {
      const source = nativeToMirror[nativeRelation.source_native_id];
      const target = nativeToMirror[nativeRelation.target_native_id];
      if (!source || !target) return;
      const relation = {
        relation_id: nativeRelation.mirror_relation_id || ('rel:import:' + slug(adapter.descriptor.source_system_id + '-' + index)),
        schema_version: 'axm.mirror.relation/v1',
        source_mirror_id: source,
        relation_type: nativeRelation.relation_type,
        target_mirror_id: target,
        created_by: actor,
        created_at: nativeRelation.created_at || now(),
        provenance: [{ source_system: adapter.descriptor.source_system_id, source_native_id: nativeRelation.relation_id || String(index) }],
        status: 'active',
        confidence: nativeRelation.confidence == null ? null : nativeRelation.confidence,
        verification: nativeRelation.verification || 'schema_valid',
        extensions: {}
      };
      if (!this.store.read().relations[relation.relation_id]) this.relations.add(relation);
    });
    return { snapshot, imported_entities: imported, native_to_mirror: nativeToMirror };
  }

  createProposal(input) {
    input = input || {};
    const actor = this.actor(input.actor_id);
    const adapter = input.target_adapter_id ? this.bridge.get(input.target_adapter_id) : this.bridge.findBySystem(input.target_system);
    if (!adapter) throw new Error('target adapter not found');
    if (adapter.connection.mode === 'disconnected') throw new Error('target adapter is disconnected');
    this.gate.require({
      actor_id: actor.actor_id,
      actor,
      permission: 'create_proposal',
      context: { system_id: input.target_system, operation: 'create_proposal' },
      consent: {
        adapter_id: adapter.descriptor.adapter_id,
        system_id: input.target_system,
        granted_to: SERVICE_ACTOR_ID,
        connection_mode: 'proposal_only',
        operation: 'create_proposal',
        scope: { type: 'adapter', adapter_id: adapter.descriptor.adapter_id }
      }
    });
    const risk = Risk.classify(input.operations || []);
    const packet = {
      packet_id: input.packet_id || makeId('packet:' + slug(input.source_system || 'local')),
      schema_version: 'axm.mirror.change-packet/v1',
      source_system: input.source_system,
      target_system: input.target_system,
      source_snapshot_id: input.source_snapshot_id || null,
      target_snapshot_id: input.target_snapshot_id || null,
      target_revision: input.target_revision == null ? adapter.currentRevision() : Number(input.target_revision),
      authority_revision: this.store.read().authority_revision,
      actor,
      intent: safeText(input.intent, 1000),
      reason: safeText(input.reason, 5000),
      operations: clone(input.operations || []),
      affected_entities: clone(input.affected_entities || []),
      expected_preconditions: clone(input.expected_preconditions || []),
      evidence_refs: clone(input.evidence_refs || []),
      risk_level: input.risk_level || risk.level,
      reversibility: input.reversibility || 'conditional',
      requested_permissions: clone(input.requested_permissions || ['apply_change']),
      approval_requirements: clone(input.approval_requirements || { human_review: true, min_approvals: 1 }),
      created_at: now(),
      expires_at: input.expires_at || null,
      status: 'DRAFT',
      validation_results: [],
      reviewer_decisions: [],
      application_receipt: null,
      rollback_reference: null,
      extensions: Object.assign({}, clone(input.extensions || {}), { target_adapter_id: adapter.descriptor.adapter_id, risk_score: risk.score })
    };
    const checked = Validation.validateProposal(packet);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    this.store.mutate(function (state) {
      if (state.proposals[packet.packet_id]) throw new Error('packet_id already exists');
      state.proposals[packet.packet_id] = clone(packet);
    });
    this.journal.append('proposal_created', { actor, system: packet.source_system, related_packet: packet.packet_id, related_entities: packet.affected_entities, evidence_refs: packet.evidence_refs, payload: { target_system: packet.target_system, intent: packet.intent, risk_level: packet.risk_level } });
    return clone(packet);
  }

  validateProposal(packetId, actorId) {
    const actor = this.actor(actorId);
    const packet = this.store.read().proposals[packetId];
    if (!packet) throw new Error('proposal not found');
    const checked = this.schemas.validate(packet.schema_version, packet);
    this.store.mutate(function (state) {
      const current = state.proposals[packetId];
      current.validation_results.push({ at: now(), type: 'schema_and_contract', ok: checked.ok, errors: clone(checked.errors) });
      if (checked.ok) Lifecycle.transition(current, 'VALIDATED');
    });
    this.journal.append('proposal_validated', { actor, system: 'mirror-core', related_packet: packetId, payload: checked });
    return { packet: clone(this.store.read().proposals[packetId]), validation: checked };
  }

  propose(packetId, actorId) {
    const actor = this.actor(actorId);
    this.store.mutate(function (state) {
      Lifecycle.transition(state.proposals[packetId], 'PROPOSED');
    });
    this.journal.append('proposal_submitted', { actor, system: 'mirror-core', related_packet: packetId, payload: {} });
    return clone(this.store.read().proposals[packetId]);
  }

  review(packetId, actorId, note) {
    const actor = this.actor(actorId);
    this.gate.require({ actor_id: actorId, actor, permission: 'review_proposal', context: { system_id: 'mirror-core' }, related_packet: packetId });
    this.store.mutate(function (state) {
      const packet = state.proposals[packetId];
      Lifecycle.transition(packet, 'UNDER_REVIEW');
      packet.reviewer_decisions.push({ decision: 'REVIEW_STARTED', reviewer: clone(actor), reason: safeText(note, 2000), at: now() });
    });
    this.journal.append('proposal_reviewed', { actor, system: 'mirror-core', related_packet: packetId, payload: { decision: 'REVIEW_STARTED', note: safeText(note, 2000) } });
    return clone(this.store.read().proposals[packetId]);
  }

  approve(packetId, actorId, reason) {
    const actor = this.actor(actorId);
    this.gate.require({ actor_id: actorId, actor, permission: 'approve_proposal', context: { system_id: 'mirror-core' }, related_packet: packetId });
    this.store.mutate(function (state) {
      const packet = state.proposals[packetId];
      Lifecycle.transition(packet, 'APPROVED');
      packet.reviewer_decisions.push({ decision: 'APPROVED', reviewer: clone(actor), reason: safeText(reason, 2000), at: now() });
    });
    this.journal.append('proposal_approved', { actor, system: 'mirror-core', related_packet: packetId, payload: { reason: safeText(reason, 2000) } });
    return clone(this.store.read().proposals[packetId]);
  }

  reject(packetId, actorId, reason) {
    const actor = this.actor(actorId);
    this.gate.require({ actor_id: actorId, actor, permission: 'review_proposal', context: { system_id: 'mirror-core' }, related_packet: packetId });
    this.store.mutate(function (state) {
      const packet = state.proposals[packetId];
      Lifecycle.transition(packet, 'REJECTED');
      packet.reviewer_decisions.push({ decision: 'REJECTED', reviewer: clone(actor), reason: safeText(reason, 2000), at: now() });
    });
    this.journal.append('proposal_rejected', { actor, system: 'mirror-core', related_packet: packetId, payload: { reason: safeText(reason, 2000) } });
    return clone(this.store.read().proposals[packetId]);
  }

  requestAmendment(packetId, actorId, reason) {
    const actor = this.actor(actorId);
    this.gate.require({ actor_id: actorId, actor, permission: 'review_proposal', context: { system_id: 'mirror-core' }, related_packet: packetId });
    this.store.mutate(function (state) {
      const packet = state.proposals[packetId];
      Lifecycle.transition(packet, 'AMENDMENT_REQUIRED');
      packet.reviewer_decisions.push({ decision: 'AMENDMENT_REQUIRED', reviewer: clone(actor), reason: safeText(reason, 2000), at: now() });
    });
    this.journal.append('proposal_amendment_required', { actor, system: 'mirror-core', related_packet: packetId, payload: { reason: safeText(reason, 2000) } });
    return clone(this.store.read().proposals[packetId]);
  }

  preview(packetId) {
    return this.applicationService.preview(packetId);
  }

  apply(packetId, actorId) {
    return this.applicationService.apply(packetId, this.actor(actorId));
  }

  verify(applicationId, actorId) {
    return this.verificationService.verify(applicationId, this.actor(actorId));
  }

  rollback(applicationId, actorId) {
    return this.rollbackService.rollback(applicationId, this.actor(actorId));
  }

  data(kind) {
    const state = this.store.read();
    if (kind === 'events') return this.journal.read();
    if (kind === 'snapshots') return this.snapshots.list();
    if (kind === 'adapters') return this.bridge.list();
    if (!state[kind]) throw new Error('unknown data collection: ' + kind);
    return Object.values(state[kind]).map(clone);
  }
}

module.exports = { MirrorCore, MIKE_ID, AI_ID, SERVICE_ACTOR_ID };
