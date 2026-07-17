'use strict';

const Lifecycle = require('../gate/proposal-lifecycle');
const { clone, now, makeId } = require('../core/utils');
const { SERVICE_ACTOR_ID } = require('../bridge/bridge-manager');

class RollbackService {
  constructor(options) {
    this.store = options.store;
    this.bridge = options.bridge;
    this.snapshots = options.snapshots;
    this.registry = options.registry;
    this.relations = options.relations;
    this.gate = options.gate;
    this.journal = options.journal;
  }

  reverseCoreEffects(effects, actor) {
    (effects || []).slice().reverse().forEach((effect) => {
      if (effect.type === 'mapping_created') this.registry.removeMappingForRollback(effect.mapping_id);
      if (effect.type === 'relation_created') {
        try { this.relations.remove(effect.relation_id, actor); } catch (error) {}
      }
      if (effect.type === 'capability_created') this.store.mutate(function (state) { delete state.capabilities[effect.capability_id]; });
      if (effect.type === 'entity_created') this.registry.removeEntityForRollback(effect.mirror_id);
    });
  }

  rollback(applicationId, actor) {
    const state = this.store.read();
    const application = state.applications[applicationId];
    if (!application) throw new Error('application not found');
    if (!['APPLIED', 'VERIFIED'].includes(application.status)) throw new Error('application is not rollback eligible');
    const adapter = this.bridge.get(application.adapter_id);
    if (!adapter) throw new Error('adapter not registered');
    const post = this.snapshots.get(application.post_snapshot_id);
    const pre = this.snapshots.get(application.pre_snapshot_id);
    if (!post || !pre) throw new Error('rollback snapshot missing');
    if (adapter.currentRevision() !== post.revision) throw new Error('rollback blocked: target changed after application');
    this.gate.require({
      actor_id: actor.actor_id,
      actor,
      permission: 'rollback_change',
      context: { system_id: application.system_id, operation: 'rollback_change' },
      related_packet: application.packet_id,
      consent: {
        adapter_id: application.adapter_id,
        system_id: application.system_id,
        granted_to: SERVICE_ACTOR_ID,
        connection_mode: 'approved_apply',
        operation: 'rollback_change',
        scope: { type: 'adapter', adapter_id: application.adapter_id }
      }
    });
    this.journal.append('rollback_started', { actor, system: application.system_id, related_packet: application.packet_id, payload: { application_id: applicationId, pre_snapshot_id: pre.snapshot_id } });
    const adapterResult = adapter.rollbackApplication(pre);
    if (!adapterResult.ok) throw new Error('adapter rollback failed');
    this.reverseCoreEffects(application.core_effects, actor);
    const restored = this.snapshots.capture(adapter, actor, 'post-rollback', application.packet_id);
    const result = {
      rollback_id: makeId('rollback'),
      application_id: applicationId,
      status: 'ROLLED_BACK',
      adapter_result: clone(adapterResult),
      restored_snapshot_id: restored.snapshot_id,
      rolled_back_by: clone(actor),
      rolled_back_at: now()
    };
    this.store.mutate(function (next) {
      const app = next.applications[applicationId];
      app.rollback = clone(result);
      app.status = 'ROLLED_BACK';
      const packet = next.proposals[app.packet_id];
      if (['APPLIED', 'VERIFIED'].includes(packet.status)) Lifecycle.transition(packet, 'ROLLED_BACK');
    });
    this.journal.append('rollback_completed', { actor, system: application.system_id, related_packet: application.packet_id, payload: { application_id: applicationId, rollback_id: result.rollback_id, restored_snapshot_id: restored.snapshot_id } });
    return result;
  }
}

module.exports = { RollbackService };
