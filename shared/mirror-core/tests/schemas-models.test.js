'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Validation = require('../core/validation');
const { tempCore, entity, projectEntity, proposalInput } = require('./helpers');

test('base entity and type extension validate while unknown extensions remain preserved', function (t) {
  const { core } = tempCore(t);
  const base = entity(core, 'valid');
  assert.equal(Validation.validateEntity(base).ok, true);
  const project = projectEntity(core, 'typed');
  project.extensions.future_contract = { retained: true };
  assert.equal(Validation.validateEntity(project).ok, true);
  const saved = core.registry.registerEntity(project);
  assert.deepEqual(saved.extensions.future_contract, { retained: true });
});

test('entity validator rejects missing IDs, unknown versions, invalid facets, and invalid type extensions', function (t) {
  const { core } = tempCore(t);
  const missing = entity(core, 'missing');
  delete missing.mirror_id;
  assert.equal(Validation.validateEntity(missing).ok, false);
  const version = entity(core, 'version');
  version.schema_version = 'axm.mirror.entity/v999';
  assert.match(Validation.validateEntity(version).errors.join(' '), /unsupported entity schema version/);
  const facet = entity(core, 'facet');
  facet.truth_facets.verification = 'looks_good';
  assert.match(Validation.validateEntity(facet).errors.join(' '), /invalid truth facet/);
  const typed = projectEntity(core, 'bad-type');
  delete typed.state.type_data.evidence_gate;
  assert.match(Validation.validateEntity(typed).errors.join(' '), /evidence_gate required/);
});

test('schema registry refuses unknown schema versions', function (t) {
  const { core } = tempCore(t);
  const checked = core.schemas.validate('axm.mirror.entity/v999', {});
  assert.equal(checked.ok, false);
  assert.match(checked.errors[0], /unknown schema version/);
});

test('packet rejects arbitrary executable content', function (t) {
  const { core } = tempCore(t);
  assert.throws(function () {
    core.createProposal(proposalInput({
      operations: [{ type: 'request_adapter_action', action: 'mock.noop', input: { command: 'do-not-run' } }]
    }));
  }, /arbitrary executable content refused/);
});

test('shared-controls contract accepts uneven teams and rejects default AI fill', function (t) {
  const { core } = tempCore(t);
  const session = {
    schema_version: 'axm.party.session/v1',
    session_id: 'session:test:uneven',
    game_id: 'relaybound',
    status: 'lobby',
    host_actor_id: 'actor:human:mike',
    min_seats: 1,
    max_seats: 8,
    team_layout: [
      { team_id: 'one', seat_ids: ['s1', 's2'] },
      { team_id: 'two', seat_ids: ['s3'] }
    ],
    seat_ids: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
    ready_policy: 'game_contract',
    local_authority: true,
    default_ai_fill: false,
    created_at: new Date().toISOString()
  };
  assert.equal(core.schemas.validate(session.schema_version, session).ok, true);
  session.default_ai_fill = true;
  assert.match(core.schemas.validate(session.schema_version, session).errors.join(' '), /default AI fill/);
});

test('shared-control parity and seat-visible observation boundaries are enforced', function (t) {
  const { core } = tempCore(t);
  const surface = {
    schema_version: 'axm.controls.surface/v1',
    control_surface_id: 'controls:relaybound:v1',
    game_id: 'relaybound',
    version: '1.0.0',
    actions: [{ action_id: 'move', input_schema: { type: 'object' } }],
    rate_limits: { per_second: 30 },
    actor_neutral: true,
    hidden_machine_actions: false,
    input_intentions_only: true
  };
  assert.equal(core.schemas.validate(surface.schema_version, surface).ok, true);
  surface.hidden_machine_actions = true;
  assert.match(core.schemas.validate(surface.schema_version, surface).errors.join(' '), /shared-control parity/);

  const observation = {
    schema_version: 'axm.controls.observation/v1',
    observation_id: 'obs-1',
    session_id: 'session:test:uneven',
    seat_id: 's1',
    observation_scope_id: 'scope-s1',
    tick: 4,
    representation: 'bounded_semantic_projection',
    observation_basis: 'seat_player_view',
    source_view_hash: 'abc',
    payload: { visible_ball: { x: 1 } },
    withheld_fields: ['hidden-opponents'],
    includes_only_visible_to_seat: true,
    created_at: new Date().toISOString()
  };
  assert.equal(core.schemas.validate(observation.schema_version, observation).ok, true);
  observation.payload.authoritative_state = {};
  assert.match(core.schemas.validate(observation.schema_version, observation).errors.join(' '), /non-seat state/);
});
