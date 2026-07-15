'use strict';

const Lifecycle = require('../gate/proposal-lifecycle');
const { clone, now, makeId } = require('../core/utils');
const { SERVICE_ACTOR_ID } = require('./bridge-manager');

class ApplicationService {
  constructor(options) {
    this.store = options.store;
    this.registry = options.registry;
    this.relations = options.relations;
    this.capabilities = options.capabilities;
    this.bridge = options.bridge;
    this.snapshots = options.snapshots;
    this.journal = options.journal;
    this.gate = options.gate;
    this.conflicts = options.conflicts;
  }

  proposal(packetId) {
    return this.store.read().proposals[packetId] || null;
  }

  adapterFor(packet) {
    const explicit = packet.extensions && packet.extensions.target_adapter_id;
    return explicit ? this.bridge.get(explicit) : this.bridge.findBySystem(packet.target_system);
  }

  preview(packetId) {
    const packet = this.proposal(packetId);
    if (!packet) throw new Error('proposal not found');
    const adapter = this.adapterFor(packet);
    if (!adapter) throw new Error('target adapter not found');
    const conflicts = this.conflicts.detect(packet, adapter);
    let adapterPreview = null;
    try { adapterPreview = adapter.previewApply(packet); }
    catch (error) { adapterPreview = { ok: false, error: error.message, diff: { changed: false, count: 0, changes: [] } }; }
    return {
      packet_id: packetId,
      adapter_id: adapter.descriptor.adapter_id,
      source: packet.source_system,
      target: packet.target_system,
      operations: clone(packet.operations),
      risk_level: packet.risk_level,
      reversibility: packet.reversibility,
      evidence_refs: clone(packet.evidence_refs),
      truth_unknowns: clone(packet.extensions && packet.extensions.truth_unknowns || []),
      conflicts,
      adapter_preview: adapterPreview
    };
  }

  requireApplyAuthority(packet, adapter, actor) {
    this.gate.require({
      actor_id: actor.actor_id,
      actor,
      permission: 'apply_change',
      context: { system_id: packet.target_system, operation: 'apply_change' },
      related_packet: packet.packet_id,
      consent: {
        adapter_id: adapter.descriptor.adapter_id,
        system_id: packet.target_system,
        granted_to: SERVICE_ACTOR_ID,
        connection_mode: 'approved_apply',
        operation: 'apply_change',
        scope: { type: 'adapter', adapter_id: adapter.descriptor.adapter_id }
      }
    });
    packet.operations.forEach((operation) => {
      this.gate.require({
        actor_id: actor.actor_id,
        actor,
        permission: 'apply_change',
        context: { system_id: packet.target_system, operation: operation.type },
        related_packet: packet.packet_id,
        consent: {
          adapter_id: adapter.descriptor.adapter_id,
          system_id: packet.target_system,
          granted_to: SERVICE_ACTOR_ID,
          connection_mode: 'approved_apply',
          operation: operation.type,
          scope: { type: 'adapter', adapter_id: adapter.descriptor.adapter_id }
        }
      });
    });
  }

  applyCoreEffects(packet, actor) {
    const effects = [];
    packet.operations.forEach((operation) => {
      if (operation.type === 'create_entity' && operation.mirror_entity) {
        const saved = this.registry.registerEntity(operation.mirror_entity, { quiet: true });
        effects.push({ type: 'entity_created', mirror_id: saved.mirror_id });
      }
      if (operation.type === 'map_native_entity' && operation.mapping) {
        const mapping = clone(operation.mapping);
        mapping.mapping_status = 'active';
        const saved = this.registry.registerMapping(mapping, { quiet: true });
        effects.push({ type: 'mapping_created', mapping_id: saved.mapping_id });
      }
      if (operation.type === 'add_relation' && operation.scope === 'mirror_core' && operation.relation) {
        const saved = this.relations.add(operation.relation);
        effects.push({ type: 'relation_created', relation_id: saved.relation_id });
      }
      if (operation.type === 'register_capability' && operation.scope === 'mirror_core' && operation.capability) {
        const saved = this.capabilities.register(operation.capability, actor, packet.packet_id);
        effects.push({ type: 'capability_created', capability_id: saved.capability_id });
      }
    });
    return effects;
  }

  reverseCoreEffects(effects, actor) {
    (effects || []).slice().reverse().forEach((effect) => {
      if (effect.type === 'mapping_created') this.registry.removeMappingForRollback(effect.mapping_id);
      if (effect.type === 'relation_created') {
        try { this.relations.remove(effect.relation_id, actor); } catch (error) {}
      }
      if (effect.type === 'capability_created') {
        this.store.mutate(function (state) { delete state.capabilities[effect.capability_id]; });
      }
      if (effect.type === 'entity_created') this.registry.removeEntityForRollback(effect.mirror_id);
    });
  }

  apply(packetId, actor) {
    let packet = this.proposal(packetId);
    if (!packet) throw new Error('proposal not found');
    if (packet.status !== 'APPROVED') throw new Error('only an APPROVED proposal may apply');
    const adapter = this.adapterFor(packet);
    if (!adapter) throw new Error('target adapter not found');
    this.requireApplyAuthority(packet, adapter, actor);
    const conflicts = this.conflicts.detect(packet, adapter);
    if (conflicts.length) {
      this.store.mutate(function (state) {
        const current = state.proposals[packetId];
        Lifecycle.transition(current, 'CONFLICTED');
        current.validation_results.push({ at: now(), type: 'conflict_check', ok: false, conflicts: clone(conflicts) });
      });
      conflicts.forEach((item) => this.journal.append('conflict_detected', {
        actor,
        system: packet.target_system,
        related_packet: packet.packet_id,
        related_entities: item.affected_entity ? [item.affected_entity] : [],
        payload: item
      }));
      return { ok: false, applied: false, status: 'CONFLICTED', conflicts };
    }
    const pre = this.snapshots.capture(adapter, actor, 'pre-apply', packet.packet_id);
    this.store.mutate(function (state) {
      Lifecycle.transition(state.proposals[packetId], 'APPLYING');
    });
    this.journal.append('apply_started', { actor, system: packet.target_system, related_packet: packet.packet_id, payload: { pre_snapshot_id: pre.snapshot_id } });
    packet = this.proposal(packetId);
    let adapterReceipt = null;
    let coreEffects = [];
    try {
      adapterReceipt = adapter.applyApprovedPacket(packet);
      coreEffects = this.applyCoreEffects(packet, actor);
      const post = this.snapshots.capture(adapter, actor, 'post-apply', packet.packet_id);
      const receipt = {
        application_id: makeId('application'),
        schema_version: 'axm.mirror.application-receipt/v1',
        packet_id: packet.packet_id,
        adapter_id: adapter.descriptor.adapter_id,
        system_id: packet.target_system,
        applied_by: clone(actor),
        applied_at: now(),
        pre_snapshot_id: pre.snapshot_id,
        post_snapshot_id: post.snapshot_id,
        pre_revision: pre.revision,
        post_revision: post.revision,
        adapter_receipt: clone(adapterReceipt),
        core_effects: clone(coreEffects),
        status: 'APPLIED',
        verification: null,
        rollback: null
      };
      this.store.mutate(function (state) {
        const current = state.proposals[packetId];
        Lifecycle.transition(current, 'APPLIED');
        current.application_receipt = clone(receipt);
        current.rollback_reference = { application_id: receipt.application_id, pre_snapshot_id: pre.snapshot_id };
        state.applications[receipt.application_id] = clone(receipt);
      });
      this.journal.append('apply_completed', {
        actor,
        system: packet.target_system,
        related_packet: packet.packet_id,
        related_entities: clone(packet.affected_entities),
        payload: { application_id: receipt.application_id, post_snapshot_id: post.snapshot_id, operation_results: adapterReceipt.operation_results }
      });
      return { ok: true, applied: true, status: 'APPLIED', receipt };
    } catch (error) {
      this.reverseCoreEffects(coreEffects, actor);
      if (adapterReceipt) {
        try { adapter.rollbackApplication(pre); } catch (rollbackError) {}
      }
      this.store.mutate(function (state) {
        const current = state.proposals[packetId];
        if (current.status === 'APPLYING') Lifecycle.transition(current, 'FAILED');
        current.validation_results.push({ at: now(), type: 'application', ok: false, error: error.message });
      });
      this.journal.append('apply_failed', { actor, system: packet.target_system, related_packet: packet.packet_id, payload: { error: error.message } });
      throw error;
    }
  }
}

module.exports = { ApplicationService };
