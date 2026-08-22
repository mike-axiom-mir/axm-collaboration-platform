'use strict';
const assert = require('assert');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.id, contract.id);
assert.ok(contract.boundaries.refuses.includes('automatic-execution'));
const receipt = require('../../shared/capability-intelligence/generated/verified-workflow/pipeline-receipt.json');
assert.equal(receipt.module1_to_module2.digest_match, true);
assert.equal(receipt.module2.checks.selected_interface_pattern_id, 'searchable_library');
assert.equal(receipt.module2.checks.assurance_status, 'PASS');
const html = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
for (const control of ['search', 'results', 'preview']) {
  assert.ok(html.includes(`data-interface-control="${control}"`), `missing Module 2 control: ${control}`);
}
assert.ok(html.includes('id="applicationNote"'), 'native implementation truth note missing');
for (const worldField of ['worldFitState', 'worldFitSummary', 'worldFitChecks', 'worldFitSources']) {
  assert.ok(html.includes(`id="${worldField}"`), `missing Module 2 world-interface field: ${worldField}`);
}
require('../../shared/capability-intelligence/node-runner').verify(manifest.id);
console.log('Human Interface Intelligence platform selftest: PASS');
