'use strict';

const assert = require('assert');
const Core = require('./twin-surfaces-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function block(id, effects, provides) { return { id, name: id, status: 'EXPERIMENTAL', source: { digest: (id === 'publisher' ? 'a' : 'b').repeat(64) }, classification: { kind: 'HAND', state: 'DECLARED' }, sockets: { provides: provides || [], consumes: [] }, effects: { capable: effects, unknownDeclarations: [] } }; }

function run() {
  const graph = { schema: 'axm.city-graph/v1', semanticDigest: 'c'.repeat(64), blocks: [block('publisher', ['NETWORK_WRITE'], ['city.publish']), block('observer', ['OBSERVE_LOCAL'], ['city.observe'])] };
  const schemas = { schema: 'axm.schema-registry/v1', graphDigest: graph.semanticDigest, registryDigest: 'd'.repeat(64) };
  const twin = Core.compile(graph, schemas);
  check(Core.verify(twin), 'twin digest and mappings verify');
  check(twin.humanLabels.length === twin.machinePackets.length, 'every machine packet has one human label');
  const publisher = twin.humanLabels.find(row => row.blockId === 'publisher');
  check(publisher.risk === 'HIGH' && publisher.effects.includes('NETWORK_WRITE'), 'beginner view preserves high-risk effect');
  check(publisher.capabilities.includes('city.publish'), 'beginner view preserves capability');
  check(publisher.effectPacketDigests.length === 1, 'every human effect maps to exact packet');
  check(twin.effectPackets.every(row => row.grantsAuthority === false && row.requiresExactTargetDigest), 'effect templates grant nothing and require exact target');
  check(twin.humanLabels.every(row => row.safe === null && row.grantsAuthority === false), 'human view never labels safe or grants authority');
  expect('TWIN_SOURCE_DRIFT', () => Core.compile(graph, { ...schemas, graphDigest: 'e'.repeat(64) }));
  const tampered = JSON.parse(JSON.stringify(twin));
  tampered.humanLabels.find(row => row.blockId === 'publisher').risk = 'LOW';
  expect('TWIN_DIGEST_DRIFT', () => Core.verify(tampered));
  const remapped = JSON.parse(JSON.stringify(twin));
  remapped.humanLabels.find(row => row.blockId === 'publisher').effectPacketDigests = [];
  const { twinDigest: _old, ...base } = remapped;
  remapped.twinDigest = Core.sha256(Core.canonical(base));
  expect('HUMAN_EFFECT_PACKET_DRIFT', () => Core.verify(remapped));
  const omitted = JSON.parse(JSON.stringify(twin));
  omitted.humanLabels.pop();
  const { twinDigest: _omittedOld, ...omittedBase } = omitted;
  omitted.twinDigest = Core.sha256(Core.canonical(omittedBase));
  expect('HUMAN_MACHINE_TWIN_OMISSION', () => Core.verify(omitted));
  check(Core.humanMarkdown(twin).includes(twin.twinDigest), 'human map binds exact twin digest');
  process.stdout.write(`twin-surfaces selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
