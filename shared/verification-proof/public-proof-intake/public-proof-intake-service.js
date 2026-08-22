'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('../public-proof-batch1/public-proof-batch1-service');

const SCHEMA = 'axm.public-proof.local-intake-service/v1';
const P0_FILES = Object.freeze({
  VALID: 'valid.json',
  INVALID_REQUIRED_FIELD: 'invalid_required_field.json',
  PRIVACY_BLOCKED: 'privacy_blocked.json',
  ROLLBACK: 'rollback.json'
});
const EXPECTED = Object.freeze({
  VALID: 'ACCEPT_SCHEMA_ONLY',
  INVALID_REQUIRED_FIELD: 'BLOCK',
  PRIVACY_BLOCKED: 'QUARANTINE',
  ROLLBACK: 'ROLLBACK_VERIFIED_SYNTHETIC'
});

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function firstType(schema) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type || (schema.properties ? 'object' : 'string')];
  return types.includes('string') ? 'string' : types[0];
}
function syntheticValue(schema, key, slug) {
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  const type = firstType(schema);
  if (type === 'object') {
    const result = {};
    for (const required of schema.required || []) result[required] = syntheticValue((schema.properties || {})[required] || {}, required, slug);
    return result;
  }
  if (type === 'array') return [syntheticValue(schema.items || { type: 'string' }, key + '-item', slug)];
  if (type === 'integer') return Math.max(1, Number(schema.minimum || 1));
  if (type === 'number') return Math.max(1, Number(schema.minimum || 1));
  if (type === 'boolean') return false;
  const pattern = String(schema.pattern || '');
  if (pattern.includes('axm\\.proof')) return 'axm.proof.synthetic-input.v0.1.0';
  if (pattern.includes('sha256:')) return 'sha256:synthetic-' + slug + '-' + key;
  if (pattern.includes('synthetic:')) return 'synthetic:' + slug + ':' + key;
  return 'synthetic:' + slug + ':' + key;
}

function create(options) {
  const implementationRoot = path.resolve(options && options.implementationRoot || __dirname);
  const map = readJson(path.join(implementationRoot, 'intake-map.json'));
  const byId = new Map(map.seeds.map(seed => [seed.id, seed]));
  if (map.counts.seeds !== 100 || map.counts.eligible !== 52 || map.counts.held !== 48 || byId.size !== 100) {
    throw new Error('public proof intake count invariant failed');
  }

  function rowFor(seedId) {
    const row = byId.get(seedId);
    if (!row) throw new Error('unknown public proof seed');
    return row;
  }
  function schemaFor(seedId) {
    const row = rowFor(seedId);
    return readJson(path.join(implementationRoot, 'schemas', row.schema_file));
  }
  function syntheticPacket(seedId, fixtureClass) {
    const row = rowFor(seedId);
    const schema = schemaFor(seedId);
    const slug = seedId.replace(/^axm\.proof\./, '');
    const inputsSchema = schema.properties.inputs;
    const inputs = {};
    for (const key of inputsSchema.required || []) inputs[key] = syntheticValue((inputsSchema.properties || {})[key] || {}, key, slug);
    if (fixtureClass === 'INVALID_REQUIRED_FIELD') delete inputs[(inputsSchema.required || [])[0]];
    return {
      packet_schema_version: schema.properties.packet_schema_version.const,
      packet_id: 'synthetic:' + slug + ':' + fixtureClass.toLowerCase(),
      seed_id: seedId,
      seed_schema_version: schema.properties.seed_schema_version.const,
      fixture_class: fixtureClass,
      run_mode: 'VALIDATE_ONLY',
      authority: {
        scope: 'SCHEMA_AND_DISPOSABLE_SYNTHETIC_FIXTURE_ONLY',
        live_activation_allowed: false,
        canon_authority: false,
        publication_authority: false,
        merge_gate_required: true
      },
      network_policy: 'DENY',
      write_policy: 'NONE',
      inputs,
      expected: {
        decision: fixtureClass === 'INVALID_REQUIRED_FIELD' ? 'BLOCK' : 'ACCEPT_SCHEMA_ONLY',
        reason_codes: fixtureClass === 'INVALID_REQUIRED_FIELD' ? ['AXM_PROOF_REQUIRED_FIELD_MISSING'] : [],
        output_emitted: fixtureClass !== 'INVALID_REQUIRED_FIELD',
        runtime_claim_upgraded: false
      },
      privacy_canaries: [],
      rollback: {
        checkpoint_id: 'synthetic:' + slug + ':checkpoint:clean',
        restore_required: false,
        expected_restore_digest: 'sha256:synthetic-' + slug + '-clean',
        history_policy: 'APPEND_ONLY_NO_DELETE'
      },
      fixture_note: 'Deterministic ' + fixtureClass + ' fixture for ' + row.priority + '.',
      truth_guard: {
        canon: false,
        integrated: false,
        runtime_proof: false,
        published: false,
        automatic_promotion_allowed: false
      }
    };
  }
  function sourceFixture(seedId, fixtureClass) {
    const row = rowFor(seedId);
    const slug = seedId.replace(/^axm\.proof\./, '');
    if (row.priority !== 'P0_CONTRACT_OR_GUARD') return syntheticPacket(seedId, fixtureClass);
    return readJson(path.join(implementationRoot, 'fixtures', 'P0', slug, P0_FILES[fixtureClass]));
  }
  function catalog() {
    return {
      ok: true,
      schema: 'axm.public-proof.local-intake-catalog/v1',
      counts: map.counts,
      eligible: map.seeds.filter(seed => seed.eligible),
      held: map.seeds.filter(seed => !seed.eligible),
      truth: map.truth
    };
  }
  function validate(seedId, packet) {
    const row = rowFor(seedId);
    if (!row.eligible) {
      return {
        schema: 'axm.public-proof.local-intake-validation/v1',
        ok: true,
        accepted: false,
        blocked: true,
        quarantined: false,
        seed_id: seedId,
        intake_state: row.intake_state,
        decision: 'HELD_RESEARCH_OR_DEPENDENCY',
        errors: ['Seed remains held by Run 39.', ...row.hold_blockers.map(item => 'Research blocker: ' + item)],
        writes: [],
        network_used: false,
        runtime_proof: false,
        published: false,
        canon: false
      };
    }
    return Object.assign(Core.validatePacketAgainstSchema(seedId, schemaFor(seedId), packet), {
      schema: 'axm.public-proof.local-intake-validation/v1',
      intake_state: row.intake_state,
      source_decision: row.source_decision,
      recommended_existing_owner: row.recommended_existing_owner,
      overlap_strength: row.overlap_strength
    });
  }
  function selftest() {
    const contractChecks = [];
    const eligibleFixtureChecks = [];
    const holdRefusalChecks = [];
    for (const row of map.seeds) {
      const schema = schemaFor(row.id);
      contractChecks.push({
        seed_id: row.id,
        pass: schema.$id === row.id + '.run-packet.schema.v0.3.0' && schema.properties.seed_id.const === row.id
      });
      if (!row.eligible) {
        const refusal = validate(row.id, {});
        holdRefusalChecks.push({ seed_id: row.id, decision: refusal.decision, pass: refusal.decision === 'HELD_RESEARCH_OR_DEPENDENCY' && refusal.blocked });
        continue;
      }
      const classes = row.priority === 'P0_CONTRACT_OR_GUARD' ? Object.keys(P0_FILES) : ['VALID', 'INVALID_REQUIRED_FIELD'];
      for (const fixtureClass of classes) {
        const packet = sourceFixture(row.id, fixtureClass);
        const first = validate(row.id, packet);
        const second = validate(row.id, JSON.parse(JSON.stringify(packet)));
        const expected = EXPECTED[fixtureClass];
        eligibleFixtureChecks.push({
          seed_id: row.id,
          fixture_class: fixtureClass,
          expected,
          actual: first.decision,
          deterministic: first.deterministic_digest === second.deterministic_digest,
          pass: first.decision === expected && first.deterministic_digest === second.deterministic_digest
        });
      }
    }
    const all = [...contractChecks, ...eligibleFixtureChecks, ...holdRefusalChecks];
    return {
      schema: 'axm.public-proof.local-intake-selftest/v1',
      ok: all.every(item => item.pass),
      contract_checks: contractChecks.length,
      eligible_fixture_checks: eligibleFixtureChecks.length,
      hold_refusal_checks: holdRefusalChecks.length,
      pass_count: all.filter(item => item.pass).length,
      fail_count: all.filter(item => !item.pass).length,
      contract_failures: contractChecks.filter(item => !item.pass),
      fixture_failures: eligibleFixtureChecks.filter(item => !item.pass),
      hold_failures: holdRefusalChecks.filter(item => !item.pass),
      writes: [],
      network_used: false,
      runtime_proof: false,
      published: false,
      canon: false
    };
  }

  return { catalog, validate, selftest, syntheticPacket, schemaFor, schema: SCHEMA };
}

module.exports = { create, syntheticValue, SCHEMA };
