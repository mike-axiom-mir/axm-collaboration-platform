'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Identity = require('../core/identity');
const { tempCore, entity, MIKE_ID } = require('./helpers');

test('namespaced IDs remain unique and identical display names do not merge entities', function (t) {
  const { core } = tempCore(t);
  assert.equal(Identity.validMirrorId('mir:test:workspace:one'), true);
  const first = core.registry.registerEntity(entity(core, 'one'));
  const second = core.registry.registerEntity(entity(core, 'two', { source_system: 'other-system' }));
  assert.equal(first.name, second.name);
  assert.notEqual(first.mirror_id, second.mirror_id);
  assert.equal(core.data('entities').length, 2);
});

test('duplicate source entity and duplicate native mapping are rejected', function (t) {
  const { core } = tempCore(t);
  const first = core.registry.registerEntity(entity(core, 'one'));
  assert.throws(function () {
    core.registry.registerEntity(entity(core, 'other-id', { source_native_id: first.source_native_id }));
  }, /source native entity already registered/);
  const mapping = {
    mapping_id: 'map:test:first',
    schema_version: 'axm.mirror.mapping/v1',
    mirror_id: first.mirror_id,
    endpoints: [{ system_id: 'native', native_id: 'n1', role: 'representation' }],
    mapping_status: 'active',
    created_by: core.actor(MIKE_ID),
    evidence_refs: [],
    field_mappings: {},
    limitations: [],
    mapping_kind: 'representation_only'
  };
  core.registry.registerMapping(mapping);
  assert.throws(function () {
    core.registry.registerMapping(Object.assign({}, mapping, { mapping_id: 'map:test:second' }));
  }, /duplicate native mapping/);
});

test('one-to-many mapping stays explicitly proposed until a decision', function (t) {
  const { core } = tempCore(t);
  const value = core.registry.registerEntity(entity(core, 'mapped'));
  const mapping = core.registry.registerMapping({
    mapping_id: 'map:test:many',
    schema_version: 'axm.mirror.mapping/v1',
    mirror_id: value.mirror_id,
    endpoints: [
      { system_id: 'world', native_id: 'w1', role: 'source' },
      { system_id: 'platform', native_id: 'p1', role: 'project' },
      { system_id: 'platform', native_id: 'p2', role: 'workspace' }
    ],
    mapping_status: 'proposed',
    created_by: core.actor(MIKE_ID),
    evidence_refs: [],
    field_mappings: {},
    limitations: ['representation only'],
    mapping_kind: 'one_to_many'
  });
  assert.equal(mapping.endpoints.length, 3);
  assert.equal(mapping.mapping_status, 'proposed');
});

test('acyclic relation types reject cycles while unresolved endpoints remain representable', function (t) {
  const { core } = tempCore(t);
  ['a', 'b', 'c'].forEach(function (id) { core.registry.registerEntity(entity(core, id)); });
  const mike = core.actor(MIKE_ID);
  function relation(id, source, target, status) {
    return {
      relation_id: 'rel:test:' + id,
      schema_version: 'axm.mirror.relation/v1',
      source_mirror_id: source,
      relation_type: 'contains',
      target_mirror_id: target,
      created_by: mike,
      created_at: new Date().toISOString(),
      provenance: [],
      status: status || 'active',
      confidence: null,
      verification: 'schema_valid',
      extensions: {}
    };
  }
  core.relations.add(relation('ab', 'mir:test:workspace:a', 'mir:test:workspace:b'));
  core.relations.add(relation('bc', 'mir:test:workspace:b', 'mir:test:workspace:c'));
  assert.throws(function () {
    core.relations.add(relation('ca', 'mir:test:workspace:c', 'mir:test:workspace:a'));
  }, /forbidden contains cycle/);
  const unresolved = core.relations.add(relation('missing', 'mir:test:workspace:a', 'mir:test:workspace:missing', 'unresolved'));
  assert.equal(unresolved.status, 'unresolved');
});
