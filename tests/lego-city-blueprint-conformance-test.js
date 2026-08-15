'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Harbor = require('../shared/intake-harbor/intake-harbor-core');
const Gates = require('../shared/city-gates/city-gates-core');

const ROOT = path.join(__dirname, '..');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function read(name) { return JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8')); }

function run() {
  const infrastructure = read('shared/city-graph/city-infrastructure.json');
  const graph = read('registry/generated/city-graph.json');
  const schemas = read('registry/generated/city-schemas.json');
  const authority = read('registry/generated/city-authority-map.json');
  const twins = read('registry/generated/city-twins.json');
  const gates = read('shared/city-gates/gate-registry.json');
  const expected = ['live-city-map', 'schema-registry', 'artifact-depot', 'event-journal', 'authority-grid', 'hands-rail', 'workflow-transit', 'evidence-grid', 'local-sync', 'twin-surfaces', 'intake-harbor', 'city-gates'];
  check(infrastructure.blocks.length === 12, 'all twelve infrastructure blocks are registered');
  check(expected.every(id => infrastructure.blocks.some(row => row.id === id)), 'infrastructure IDs match the grounded blueprint');
  check(infrastructure.blocks.every(row => graph.blocks.some(block => block.id === row.module)), 'every infrastructure module is present in live graph');
  check(infrastructure.blocks.every(row => read(`${row.module}/manifest.json`).status === 'EXPERIMENTAL'), 'all twelve modules remain EXPERIMENTAL');
  check(infrastructure.blocks.every(row => fs.existsSync(path.join(ROOT, row.module, 'selftest.js'))), 'every infrastructure module has a focused selftest');
  const commonSchemas = ['axm.block-view/v1', 'axm.city-graph/v1', 'axm.artifact-ref/v1', 'axm.event/v1', 'axm.decision/v1', 'axm.receipt/v1', 'axm.route/v1'];
  check(commonSchemas.every(id => schemas.entries.some(row => row.id === id)), 'all seven common contracts are registered');
  check(schemas.graphDigest === graph.semanticDigest, 'schema registry binds current graph');
  check(twins.graphDigest === graph.semanticDigest && twins.schemaRegistryDigest === schemas.registryDigest, 'twin binds current graph and schema registry');
  check(twins.machinePackets.length === graph.blocks.length && twins.humanLabels.length === graph.blocks.length, 'human and machine twins cover every live block');
  check(authority.graphDigest === graph.semanticDigest && authority.blocks.every(row => row.grants.length === 0 && row.availableIsAuthorized === false), 'generated authority map is current and closed');
  check(Harbor.STEPS.length === 15 && Harbor.STEPS[0] === 'unpack-into-quarantine' && Harbor.STEPS[14] === 'rollback-receipt', 'Harbor retains exact fifteen-step endpoints');
  check(Gates.committedDefaults(gates), 'all external gates are disabled by default');
  check(gates.adapters.every(row => row.transportBundled === false && row.internalAuthority === false), 'no external transport or internal authority is bundled');
  check(infrastructure.authority.canon === false && infrastructure.authority.promote === false && infrastructure.authority.merge === false, 'infrastructure registry grants no governance authority');
  check(graph.truth.automaticCanon === false && graph.truth.automaticPromotion === false && graph.truth.automaticExecution === false, 'live graph keeps global automatic authority closed');
  process.stdout.write(`LEGO city blueprint conformance passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
