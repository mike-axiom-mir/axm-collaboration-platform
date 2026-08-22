'use strict';

const assert = require('assert');
const Core = require('./schema-registry-core');

let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  check(error && error.code === code, `expected ${code}, observed ${error && error.code}`);
}
function schema(id, body) { return { id, path: `schemas/${id.replace(/\W/g, '-')}.json`, value: { $id: id, $schema: 'https://json-schema.org/draft/2020-12/schema', ...body } }; }

function run() {
  const one = schema('axm.example/v1', { type: 'object', required: ['value'], properties: { value: { type: 'string' } } });
  const renamed = schema('axm.alias/v1', { title: 'Different annotation', type: 'object', required: ['value'], properties: { value: { type: 'string' } } });
  const changed = schema('axm.example/v2', { type: 'object', required: ['value', 'extra'], properties: { value: { type: 'string' }, extra: { type: 'number' } } });
  const foreign = schema('other.event/v1', { type: 'object' });
  const registry = Core.createRegistry([one, renamed, changed, foreign], [{ id: 'example-v1-to-v2', from: one.id, to: changed.id, losses: ['missing-extra-is-rejected'] }]);
  check(Core.resolve(registry, one.id).state === 'RESOLVED', 'exact schema resolves');
  check(Core.resolve(registry, 'missing/v1').state === 'UNRESOLVED', 'missing schema remains unresolved');
  check(Core.compatibility(registry, one.id, one.id).state === 'EXACT', 'same schema is exact');
  check(Core.compatibility(registry, one.id, renamed.id).state === 'STRUCTURALLY_EQUIVALENT', 'annotation-only differences are structural equivalents');
  const adapted = Core.compatibility(registry, one.id, changed.id);
  check(adapted.state === 'ADAPTER_REQUIRED' && adapted.losses.length === 1, 'adapter route retains declared loss');
  check(Core.compatibility(registry, changed.id, one.id).state === 'UNKNOWN', 'major version direction is not guessed compatible');
  check(Core.compatibility(registry, one.id, foreign.id).state === 'INCOMPATIBLE', 'different families without adapter are incompatible');
  check(Core.compatibility(registry, one.id, 'missing/v1').state === 'UNKNOWN', 'unresolved schema cannot be compatible');
  expect('DUPLICATE_SCHEMA_ID', () => Core.createRegistry([one, { ...one, value: { ...one.value, type: 'string' } }]));
  expect('UNDECLARED_ADAPTER_LOSS', () => Core.createRegistry([one, changed], [{ id: 'bad', from: one.id, to: changed.id }]));
  expect('UNRESOLVED_ADAPTER_SCHEMA', () => Core.createRegistry([one], [{ id: 'bad', from: one.id, to: 'missing/v1', losses: [] }]));
  const compiled = Core.compile({ graphDigest: 'a'.repeat(64), entries: [one, changed], adapters: [], unresolvedSockets: ['block:missing/v1'] });
  check(compiled.unresolvedSockets.length === 1, 'unresolved sockets stay explicit');
  check(compiled.truth.fullJsonSchemaValidator === false, 'supported subset boundary is explicit');
  check(compiled.truth.authorityGranted === false, 'registry grants no authority');
  process.stdout.write(`schema-registry selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
