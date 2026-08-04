'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.public-proof.batch1-service/v1';
const DECISIONS = Object.freeze({
  VALID: 'ACCEPT_SCHEMA_ONLY',
  INVALID_REQUIRED_FIELD: 'BLOCK',
  PRIVACY_BLOCKED: 'QUARANTINE',
  ROLLBACK: 'ROLLBACK_VERIFIED_SYNTHETIC'
});
const FIXTURE_FILES = Object.freeze({
  VALID: 'valid.json',
  INVALID_REQUIRED_FIELD: 'invalid_required_field.json',
  PRIVACY_BLOCKED: 'privacy_blocked.json',
  ROLLBACK: 'rollback.json'
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function digest(value) {
  return 'sha256:' + crypto.createHash('sha256').update(canonical(value) + '\n', 'utf8').digest('hex');
}

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function typeMatches(expected, value) {
  const actual = jsonType(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function schemaErrors(schema, value, pointer, errors) {
  const at = pointer || '$';
  const output = errors || [];
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && canonical(value) !== canonical(schema.const)) {
    output.push(at + ' must equal its const value');
    return output;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some(item => canonical(item) === canonical(value))) {
    output.push(at + ' is not in the declared enum');
    return output;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => typeMatches(type, value))) {
      output.push(at + ' must have type ' + types.join('|'));
      return output;
    }
  }
  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) output.push(at + ' is shorter than minLength');
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) output.push(at + ' does not match pattern');
  }
  if (typeof value === 'number' && Number.isFinite(schema.minimum) && value < schema.minimum) {
    output.push(at + ' is below minimum');
  }
  if (Array.isArray(value)) {
    if (schema.uniqueItems) {
      const seen = new Set(value.map(canonical));
      if (seen.size !== value.length) output.push(at + ' must contain unique items');
    }
    if (schema.items) value.forEach((item, index) => schemaErrors(schema.items, item, at + '[' + index + ']', output));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    (schema.required || []).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) output.push(at + '.' + key + ' is required');
    });
    Object.keys(value).forEach(key => {
      if (properties[key]) schemaErrors(properties[key], value[key], at + '.' + key, output);
      else if (schema.additionalProperties === false) output.push(at + '.' + key + ' is not allowed');
    });
  }
  return output;
}

function boundaryErrors(packet) {
  const errors = [];
  const authority = packet.authority || {};
  const truth = packet.truth_guard || {};
  if (packet.network_policy !== 'DENY') errors.push('network policy must be DENY');
  if (authority.scope !== 'SCHEMA_AND_DISPOSABLE_SYNTHETIC_FIXTURE_ONLY') errors.push('authority scope drift');
  ['live_activation_allowed', 'canon_authority', 'publication_authority'].forEach(key => {
    if (authority[key] !== false) errors.push('authority.' + key + ' must remain false');
  });
  if (authority.merge_gate_required !== true) errors.push('Merge Gate must remain required');
  ['canon', 'integrated', 'runtime_proof', 'published', 'automatic_promotion_allowed'].forEach(key => {
    if (truth[key] !== false) errors.push('truth_guard.' + key + ' must remain false');
  });
  if (!packet.expected || packet.expected.runtime_claim_upgraded !== false) errors.push('runtime claim upgrade must remain false');
  if (!packet.rollback || packet.rollback.history_policy !== 'APPEND_ONLY_NO_DELETE') errors.push('rollback history must be append-only');
  return errors;
}

function privacyErrors(packet) {
  const canaries = Array.isArray(packet.privacy_canaries) ? packet.privacy_canaries : [];
  const errors = [];
  canaries.forEach((item, index) => {
    const value = String(item && item.value || '');
    if (!item || item.synthetic !== true) errors.push('privacy_canaries[' + index + '] must be synthetic');
    if (!value.includes('AXM_TEST_ONLY') && !value.includes('AXM_SYNTHETIC_SECRET_CANARY')) {
      errors.push('privacy_canaries[' + index + '] lacks an unmistakable test marker');
    }
  });
  return { present: canaries.length > 0, errors };
}

function rollbackErrors(packet) {
  if (packet.fixture_class !== 'ROLLBACK') return [];
  const transition = packet.synthetic_transition || {};
  const before = transition.before || {};
  const mutation = transition.mutation || {};
  const after = transition.after_rollback || {};
  const errors = [];
  if (packet.run_mode !== 'ROLLBACK_SIMULATION') errors.push('rollback run_mode drift');
  if (packet.write_policy !== 'DISPOSABLE_FIXTURE_ONLY') errors.push('rollback write policy drift');
  if (!packet.rollback || packet.rollback.restore_required !== true) errors.push('rollback restore is not required');
  if (before.digest !== after.digest) errors.push('rollback did not restore the prior digest');
  if (mutation.reversible !== true) errors.push('rollback mutation is not reversible');
  return errors;
}

function validatePacketAgainstSchema(seedId, schema, packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new Error('packet must be an object');
  const structural = schemaErrors(schema, packet, '$', []);
  const boundary = boundaryErrors(packet);
  const privacy = privacyErrors(packet);
  const rollback = rollbackErrors(packet);
  const blockers = structural.concat(boundary, privacy.errors, rollback);
  let decision = 'BLOCK';
  if (!blockers.length) {
    if (privacy.present) decision = 'QUARANTINE';
    else if (packet.fixture_class === 'ROLLBACK') decision = 'ROLLBACK_VERIFIED_SYNTHETIC';
    else decision = 'ACCEPT_SCHEMA_ONLY';
  }
  return {
    schema: 'axm.public-proof.run-packet-validation/v1',
    ok: true,
    accepted: decision === 'ACCEPT_SCHEMA_ONLY' || decision === 'ROLLBACK_VERIFIED_SYNTHETIC',
    blocked: decision === 'BLOCK',
    quarantined: decision === 'QUARANTINE',
    seed_id: seedId,
    packet_id: String(packet.packet_id || ''),
    fixture_class: String(packet.fixture_class || ''),
    decision,
    errors: blockers,
    deterministic_digest: digest(packet),
    writes: [],
    network_used: false,
    runtime_proof: false,
    published: false,
    canon: false
  };
}

function create(options) {
  const root = path.resolve(options && options.root || path.join(__dirname, '..', '..', '..'));
  const implementationRoot = path.resolve(options && options.implementationRoot || __dirname);
  const map = readJson(path.join(implementationRoot, 'integration-map.json'));
  const byId = new Map(map.seeds.map(seed => [seed.id, seed]));
  if (map.seeds.length !== 10 || byId.size !== 10) throw new Error('Batch 1 integration map must contain ten unique seeds');
  const seen = new Set();
  map.seeds.forEach(seed => {
    (seed.dependencies || []).forEach(dependency => {
      if (!byId.has(dependency)) throw new Error(seed.id + ' has an unknown dependency ' + dependency);
      if (!seen.has(dependency)) throw new Error(seed.id + ' appears before dependency ' + dependency);
    });
    seen.add(seed.id);
  });

  function schemaFor(seedId) {
    const seed = byId.get(seedId);
    if (!seed) throw new Error('unknown Batch 1 seed');
    const slug = seedId.replace(/^axm\.proof\./, '');
    return readJson(path.join(implementationRoot, 'schemas', slug + '.schema.json'));
  }

  function catalog() {
    const seeds = map.seeds.map(seed => {
      const schema = schemaFor(seed.id);
      return Object.assign({}, seed, {
        schema_id: schema.$id,
        schema_digest: digest(schema),
        required_inputs: schema.properties.inputs.required.slice(),
        fixture_classes: Object.keys(FIXTURE_FILES)
      });
    });
    return {
      ok: true,
      schema: 'axm.public-proof.batch1-catalog/v1',
      status: map.status,
      seed_count: seeds.length,
      seeds,
      truth: map.truth,
      authority: map.authority
    };
  }

  function validate(seedId, packet) {
    const schema = schemaFor(seedId);
    return Object.assign(validatePacketAgainstSchema(seedId, schema, packet), {
      schema: 'axm.public-proof.batch1-validation/v1'
    });
  }

  function selftest() {
    const results = [];
    for (const seed of map.seeds) {
      const slug = seed.id.replace(/^axm\.proof\./, '');
      for (const [fixtureClass, file] of Object.entries(FIXTURE_FILES)) {
        const packet = readJson(path.join(implementationRoot, 'fixtures', slug, file));
        const first = validate(seed.id, packet);
        const second = validate(seed.id, JSON.parse(JSON.stringify(packet)));
        const expected = DECISIONS[fixtureClass];
        results.push({
          seed_id: seed.id,
          fixture_class: fixtureClass,
          expected,
          declared: packet.expected && packet.expected.decision,
          actual: first.decision,
          deterministic: first.deterministic_digest === second.deterministic_digest,
          pass: packet.expected && packet.expected.decision === expected && first.decision === expected && first.deterministic_digest === second.deterministic_digest
        });
      }
    }
    return {
      schema: 'axm.public-proof.batch1-selftest/v1',
      ok: results.every(item => item.pass),
      seed_count: map.seeds.length,
      fixture_count: results.length,
      pass_count: results.filter(item => item.pass).length,
      fail_count: results.filter(item => !item.pass).length,
      results,
      writes: [],
      network_used: false,
      authority_change: false,
      runtime_proof: false,
      published: false,
      canon: false
    };
  }

  return { catalog, validate, selftest, schema: SCHEMA, root };
}

module.exports = { create, canonical, digest, schemaErrors, validatePacketAgainstSchema, SCHEMA };
