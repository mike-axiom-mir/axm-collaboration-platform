'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Inventory = require('../kernel/foundation-public-source-inventory-cell');
const Integrity = require('../kernel/foundation-public-body-integrity-cell');

const ROOT = path.resolve(__dirname, '..');

function write(root, relative, content = '') {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function schema(id, extra = {}) {
  return `${JSON.stringify(Object.assign({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: id,
    type: 'object',
    additionalProperties: false,
    properties: {}
  }, extra), null, 2)}\n`;
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-public-body-'));
  write(root, 'package.json', '{"private":true}\n');
  write(root, 'roots/AXM_ROOTS_v1.json', '{"roots":[]}\n');
  write(root, 'runtime/server.js', "'use strict';\n");
  write(root, 'training/TRAINING_POLICY.json', '{"schema":"fixture"}\n');
  write(root, 'kernel/base-cell.js', "'use strict'; module.exports = true;\n");
  write(root, 'organs/base-organ.js', "'use strict'; module.exports = { authority: false };\n");
  write(root, 'tests/base.test.js', "'use strict'; require('../organs/base-organ');\n");
  write(root, 'contracts/base.schema.json', schema('fixture.base/v1'));
  return root;
}

test('live public body is structurally inspected from the inventory without the Doctor filename list', () => {
  const inventory = Inventory.collect(ROOT);
  const report = Integrity.inspect(ROOT, inventory);
  assert.equal(report.state, Integrity.PASS_STATE);
  assert.equal(report.source.inventoryDigest, inventory.digest);
  assert.ok(inventory.files.some(item => item.path === 'skills/human-discovery-stance/skill.json'));
  assert.ok(report.summary.javascriptSyntaxChecked > 250);
  assert.ok(report.summary.jsonParsed > 180);
  assert.ok(report.summary.contractSchemasChecked > 115);
  assert.equal(report.summary.activeOrgansChecked, report.summary.activeOrgansWithTestReachability);
  assert.equal(report.summary.sourceExecutions, 0);
  assert.equal(Integrity.verify(report, ROOT, inventory), true);
  const doctor = fs.readFileSync(path.join(ROOT, 'scripts', 'mirror-doctor.js'), 'utf8');
  assert.match(doctor, /foundation-public-body-integrity-cell/);
  assert.doesNotMatch(doctor, /const required\s*=\s*\[/);
});

test('a future organ and its transitive test witness are discovered without executing the organ', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  delete global.__mirrorPublicBodyExecuted;
  write(root, 'organs/future-organ.js', "global.__mirrorPublicBodyExecuted = true; throw new Error('must not execute');\n");
  write(root, 'kernel/future-wrapper.js', "module.exports = require('../organs/future-organ');\n");
  write(root, 'tests/future.test.js', "require('../kernel/future-wrapper');\n");
  const report = Integrity.inspect(root);
  assert.equal(report.state, Integrity.PASS_STATE);
  assert.equal(global.__mirrorPublicBodyExecuted, undefined);
  const future = report.coverage.activeOrganTestReachability.find(item => item.path === 'organs/future-organ.js');
  assert.deepEqual(future.testWitnesses, ['tests/future.test.js']);
  fs.rmSync(path.join(root, 'tests', 'future.test.js'));
  fs.rmSync(path.join(root, 'kernel', 'future-wrapper.js'));
  write(root, 'tests/bait.test.js', "// require('../organs/future-organ')\nconst bait = \"require('../organs/future-organ')\";\nvoid bait;\n");
  const held = Integrity.inspect(root);
  assert.equal(held.state, Integrity.HOLD_STATE);
  assert.ok(held.holds.some(item => item.code === 'ACTIVE_ORGAN_HAS_NO_STATIC_TEST_REACHABILITY_WITNESS' && item.path === 'organs/future-organ.js'));
});

test('static require extraction ignores comment, string, template, and identifier bait', () => {
  const source = [
    "// require('../organs/comment-organ')",
    "/* require('../organs/block-organ') */",
    "const text = \"require('../organs/string-organ')\";",
    "const template = `require('../organs/template-organ')`;",
    "prerequire('../organs/identifier-organ');",
    "require('../organs/real-organ');"
  ].join('\n');
  assert.deepEqual(Integrity.staticRequires(source), ['../organs/real-organ']);
});

test('invalid JavaScript and JSON hold while excluded private source remains outside inspection', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'kernel/broken.js', 'function {\n');
  write(root, 'contracts/broken.json', '{not-json\n');
  let report = Integrity.inspect(root);
  assert.ok(report.holds.some(item => item.code === 'JAVASCRIPT_SYNTAX_INVALID' && item.path === 'kernel/broken.js'));
  assert.ok(report.holds.some(item => item.code === 'JSON_PARSE_INVALID' && item.path === 'contracts/broken.json'));
  fs.rmSync(path.join(root, 'kernel', 'broken.js'));
  fs.rmSync(path.join(root, 'contracts', 'broken.json'));
  write(root, 'training/datasets/private-broken.js', 'function {\n');
  report = Integrity.inspect(root);
  assert.equal(report.state, Integrity.PASS_STATE);
  assert.ok(report.coverage.javascriptSyntaxChecked.every(item => !item.includes('datasets')));
});

test('module manifests bind a present entry and companion contract without claiming runtime readiness', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'modules/demo/manifest.json', JSON.stringify({ schema: Integrity.MODULE_SCHEMA, id: 'demo', entry: 'server.js' }));
  write(root, 'modules/demo/module.contract.json', '{"schema":"fixture-contract","id":"demo"}\n');
  write(root, 'modules/demo/server.js', "'use strict';\n");
  let report = Integrity.inspect(root);
  assert.equal(report.state, Integrity.PASS_STATE);
  assert.deepEqual(report.coverage.modules[0], {
    path: 'modules/demo/manifest.json', moduleId: 'demo', entry: 'modules/demo/server.js',
    contractPath: 'modules/demo/module.contract.json', state: 'STATIC_DECLARATION_WITNESS_NOT_RUNTIME_READINESS'
  });
  write(root, 'modules/demo/manifest.json', JSON.stringify({ schema: Integrity.MODULE_SCHEMA, id: 'demo', entry: '../outside.js' }));
  report = Integrity.inspect(root);
  assert.ok(report.holds.some(item => item.code === 'MODULE_ENTRY_MISSING_OR_OUTSIDE_MODULE'));
  write(root, 'modules/demo/manifest.json', JSON.stringify({ schema: Integrity.MODULE_SCHEMA, id: 'demo', entry: 'server.js' }));
  write(root, 'modules/demo/module.contract.json', '{"schema":"fixture-contract","id":"other"}\n');
  report = Integrity.inspect(root);
  assert.ok(report.holds.some(item => item.code === 'MODULE_CONTRACT_ID_MISMATCH'));
});

test('open current contract roots hold and explicitly superseded known failures remain visible', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'contracts/replacement.schema.json', schema('fixture.replacement/v2'));
  write(root, 'contracts/legacy.schema.json', schema('fixture.legacy/v1', {
    additionalProperties: undefined,
    'x-axm-status': 'KNOWN_FAIL',
    'x-axm-superseded-by': 'contracts/replacement.schema.json'
  }).replace(/,?\n  "additionalProperties"[^\n]*/, ''));
  let report = Integrity.inspect(root);
  assert.equal(report.state, Integrity.PASS_STATE);
  assert.equal(report.summary.knownFailContractSchemasPreserved, 1);
  write(root, 'contracts/open.schema.json', JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'fixture.open/v1', type: 'object', properties: {}
  }));
  report = Integrity.inspect(root);
  assert.ok(report.holds.some(item => item.code === 'CONTRACT_SCHEMA_ROOT_CLOSURE_UNDECLARED' && item.path === 'contracts/open.schema.json'));
});

test('integrity tampering and authority forgery are refused and runtime remains separate', () => {
  const report = Integrity.inspect(ROOT);
  const forged = JSON.parse(JSON.stringify(report));
  forged.authority.sourceExecution = true;
  forged.digest = Integrity.digest(Object.assign({}, forged, { digest: null }));
  assert.throws(() => Integrity.verify(forged, ROOT), /authority changed/);
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-public-body-integrity.schema.json'), 'utf8'));
  assert.equal(contract.$id, Integrity.INTEGRITY_SCHEMA);
  assert.equal(contract.additionalProperties, false);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.doesNotMatch(runtime, /foundation-public-body-integrity-cell/);
});
