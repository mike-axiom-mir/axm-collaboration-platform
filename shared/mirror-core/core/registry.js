'use strict';

const Validation = require('./validation');
const Identity = require('./identity');
const { clone, now } = require('./utils');

function assertValid(result) {
  if (!result.ok) throw new Error(result.errors.join('; '));
}

class MirrorRegistry {
  constructor(store, journal) {
    this.store = store;
    this.journal = journal;
  }

  registerActor(actor) {
    assertValid(Validation.validateActor(actor));
    const saved = this.store.mutate(function (state) {
      if (state.actors[actor.actor_id]) throw new Error('actor already registered: ' + actor.actor_id);
      const out = clone(actor);
      out.revision = 1;
      state.actors[out.actor_id] = out;
      return out;
    }, { authority: true });
    this.journal.append('actor_registered', { actor: saved, system: 'mirror-core', payload: { actor_type: saved.actor_type } });
    return saved;
  }

  updateActorPermissions(actorId, permissions, changedBy) {
    const saved = this.store.mutate(function (state) {
      const actor = state.actors[actorId];
      if (!actor) throw new Error('actor not found: ' + actorId);
      actor.permissions = clone(permissions);
      actor.revision = Number(actor.revision || 1) + 1;
      return actor;
    }, { authority: true });
    this.journal.append('permission_changed', { actor: changedBy, system: 'mirror-core', payload: { actor_id: actorId, revision: saved.revision } });
    return saved;
  }

  actor(actorId) {
    return this.store.read().actors[actorId] || null;
  }

  registerEntity(entity, options) {
    const input = clone(entity);
    input.revision = Number(input.revision || 1);
    assertValid(Validation.validateEntity(input));
    const saved = this.store.mutate(function (state) {
      if (state.entities[input.mirror_id]) throw new Error('mirror_id already registered: ' + input.mirror_id);
      const duplicate = Object.values(state.entities).find(function (known) {
        return known.source_system === input.source_system && known.source_native_id === input.source_native_id;
      });
      if (duplicate) throw new Error('source native entity already registered as ' + duplicate.mirror_id);
      state.entities[input.mirror_id] = input;
      return input;
    });
    if (!(options && options.quiet)) this.journal.append('entity_registered', {
      actor: saved.created_by,
      system: 'mirror-core',
      related_entities: [saved.mirror_id],
      payload: { entity_type: saved.entity_type, source_system: saved.source_system }
    });
    return saved;
  }

  updateEntity(mirrorId, updater, actor, relatedPacket) {
    const saved = this.store.mutate(function (state) {
      const entity = state.entities[mirrorId];
      if (!entity) throw new Error('entity not found: ' + mirrorId);
      const next = updater(clone(entity));
      next.mirror_id = entity.mirror_id;
      next.revision = Number(entity.revision || 1) + 1;
      next.updated_at = now();
      assertValid(Validation.validateEntity(next));
      state.entities[mirrorId] = next;
      return next;
    });
    this.journal.append('entity_updated', { actor, system: 'mirror-core', related_packet: relatedPacket || null, related_entities: [mirrorId], payload: { revision: saved.revision } });
    return saved;
  }

  removeEntityForRollback(mirrorId) {
    return this.store.mutate(function (state) {
      const entity = state.entities[mirrorId] || null;
      delete state.entities[mirrorId];
      return entity;
    });
  }

  registerEvidence(evidence) {
    assertValid(Validation.validateEvidence(evidence));
    const saved = this.store.mutate(function (state) {
      if (state.evidence[evidence.evidence_id]) throw new Error('evidence already registered');
      state.evidence[evidence.evidence_id] = clone(evidence);
      return evidence;
    });
    this.journal.append('evidence_registered', { actor: saved.creator, system: 'mirror-core', payload: { evidence_id: saved.evidence_id, evidence_type: saved.evidence_type } });
    return saved;
  }

  registerMapping(mapping, options) {
    assertValid(Validation.validateMapping(mapping));
    const saved = this.store.mutate(function (state) {
      if (state.mappings[mapping.mapping_id]) throw new Error('mapping_id already registered');
      if (!state.entities[mapping.mirror_id]) throw new Error('mapping mirror entity not registered: ' + mapping.mirror_id);
      const used = new Map();
      Object.values(state.mappings).filter(function (known) {
        return !['archived', 'superseded'].includes(known.mapping_status);
      }).forEach(function (known) {
        known.endpoints.forEach(function (endpoint) {
          used.set(Identity.endpointKey(endpoint.system_id, endpoint.native_id), known.mapping_id);
        });
      });
      mapping.endpoints.forEach(function (endpoint) {
        const prior = used.get(Identity.endpointKey(endpoint.system_id, endpoint.native_id));
        if (prior) throw new Error('duplicate native mapping conflicts with ' + prior);
      });
      state.mappings[mapping.mapping_id] = clone(mapping);
      return mapping;
    });
    if (!(options && options.quiet)) this.journal.append('mapping_proposed', {
      actor: saved.created_by,
      system: 'mirror-core',
      related_entities: [saved.mirror_id],
      payload: { mapping_id: saved.mapping_id, status: saved.mapping_status }
    });
    return saved;
  }

  removeMappingForRollback(mappingId) {
    return this.store.mutate(function (state) {
      const mapping = state.mappings[mappingId] || null;
      delete state.mappings[mappingId];
      return mapping;
    });
  }

  list(kind) {
    const state = this.store.read();
    if (!state[kind]) throw new Error('unknown registry: ' + kind);
    return Object.values(state[kind]).map(clone);
  }
}

module.exports = { MirrorRegistry, assertValid };
