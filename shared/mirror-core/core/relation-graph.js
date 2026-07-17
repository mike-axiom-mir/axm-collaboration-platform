'use strict';

const Validation = require('./validation');
const { clone } = require('./utils');

const ACYCLIC = new Set(['contains', 'located_in', 'depends_on', 'supersedes']);

class RelationGraph {
  constructor(store, journal) {
    this.store = store;
    this.journal = journal;
  }

  wouldCycle(state, source, target, relationType) {
    if (!ACYCLIC.has(relationType)) return false;
    const next = new Map();
    Object.values(state.relations).filter(function (relation) {
      return relation.relation_type === relationType && relation.status === 'active';
    }).forEach(function (relation) {
      if (!next.has(relation.source_mirror_id)) next.set(relation.source_mirror_id, []);
      next.get(relation.source_mirror_id).push(relation.target_mirror_id);
    });
    if (!next.has(source)) next.set(source, []);
    next.get(source).push(target);
    const seen = new Set();
    const stack = [target];
    while (stack.length) {
      const id = stack.pop();
      if (id === source) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      (next.get(id) || []).forEach(function (child) { stack.push(child); });
    }
    return false;
  }

  add(relation) {
    const checked = Validation.validateRelation(relation);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    const saved = this.store.mutate((state) => {
      if (state.relations[relation.relation_id]) throw new Error('relation already registered');
      const source = state.entities[relation.source_mirror_id];
      const target = state.entities[relation.target_mirror_id];
      if ((!source || !target) && relation.status !== 'unresolved') throw new Error('relation target missing');
      if (this.wouldCycle(state, relation.source_mirror_id, relation.target_mirror_id, relation.relation_type)) {
        throw new Error('forbidden ' + relation.relation_type + ' cycle');
      }
      state.relations[relation.relation_id] = clone(relation);
      return relation;
    });
    this.journal.append('relation_added', {
      actor: saved.created_by,
      system: 'mirror-core',
      related_entities: [saved.source_mirror_id, saved.target_mirror_id],
      payload: { relation_id: saved.relation_id, relation_type: saved.relation_type }
    });
    return saved;
  }

  remove(relationId, actor) {
    const removed = this.store.mutate(function (state) {
      const relation = state.relations[relationId];
      if (!relation) throw new Error('relation not found');
      delete state.relations[relationId];
      return relation;
    });
    this.journal.append('relation_removed', { actor, system: 'mirror-core', related_entities: [removed.source_mirror_id, removed.target_mirror_id], payload: { relation_id: relationId } });
    return removed;
  }
}

module.exports = { RelationGraph, ACYCLIC };
